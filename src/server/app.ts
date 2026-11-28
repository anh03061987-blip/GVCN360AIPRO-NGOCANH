import express, { type Request, type Response, type NextFunction } from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth, type DecodedIdToken } from 'firebase-admin/auth';
import {
  GEMINI_MODEL,
  VaultStorageError,
  buildPublicVaultStatus,
  classifyGeminiApiError,
  createGeminiClientWithPersonalKey,
  deleteTeacherVaultDocRest,
  encryptPersonalApiKey,
  generateContentWithRetry,
  generateJsonWithRetry,
  getTeacherVaultDocRest,
  isProductionRuntime,
  isUsingDedicatedVaultSecret,
  isVercelPreviewRuntime,
  loadFirebaseAppletConfig,
  maskApiKeyHint,
  resolveAndMigrateTeacherApiKey,
  sanitizeForLog,
  upsertTeacherVaultDocRest,
  validatePersonalGeminiApiKeyFormat,
  verifyPersonalGeminiApiKeyLive,
} from './geminiKeyVault.js';

dotenv.config();

const firebaseConfig = loadFirebaseAppletConfig();

const PRIMARY_ADMIN_EMAIL = 'anh03061987@gmail.com';
const OFFICER_AUTH_DOMAIN = 'officers.gvcn360.app';

// Initialize Firebase Admin Auth ONLY for cryptographic ID token verification (requires zero IAM / zero service account)
const adminApp = getApps().length
  ? getApp()
  : initializeApp({ projectId: firebaseConfig.projectId });
const adminAuth = getAdminAuth(adminApp);

export interface AuthenticatedRequest extends Request {
  authUser?: {
    uid: string;
    email: string;
    emailVerified: boolean;
    isPrimaryAdmin: boolean;
    token: string;
    decoded: DecodedIdToken;
  };
}

function isAllowedCorsOrigin(origin: string, reqHost: string): boolean {
  try {
    const parsed = new URL(origin);
    if (reqHost && parsed.host.toLowerCase() === reqHost.toLowerCase()) {
      return true;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.vercel.app') ||
      hostname.endsWith('.run.app') ||
      hostname.endsWith('.ai.studio')
    ) {
      return true;
    }
    const extraOrigins = (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return extraOrigins.includes(origin.toLowerCase());
  } catch {
    return false;
  }
}

export function createApiApp(): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  // Strict CORS, preflight OPTIONS, and no-cache headers for all /api/* routes
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const origin = req.headers.origin;
    const reqHost = req.headers.host || '';
    if (typeof origin === 'string' && origin.trim() && isAllowedCorsOrigin(origin.trim(), reqHost)) {
      res.setHeader('Access-Control-Allow-Origin', origin.trim());
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Max-Age', '600');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // Public non-secret health check (used to verify Vercel Serverless / Node backend deployment)
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: 'gvcn-360-ai-pro-api',
      runtime: process.env.VERCEL ? 'vercel' : 'node',
      isProduction: isProductionRuntime(),
      encryptionSecretConfigured: isUsingDedicatedVaultSecret(),
    });
  });

  async function checkTeacherApprovedViaFirestoreRest(
    uid: string,
    idToken: string
  ): Promise<{ approved: boolean; status: string }> {
    const dbId = encodeURIComponent(firebaseConfig.firestoreDatabaseId || '(default)');
    const safeUid = encodeURIComponent(uid);
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      firebaseConfig.projectId
    )}/databases/${dbId}/documents/teacher_access_requests/${safeUid}`;

    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
        Accept: 'application/json',
      },
    });

    if (resp.status === 404) {
      return { approved: false, status: 'unregistered' };
    }
    if (!resp.ok) {
      return { approved: false, status: 'denied' };
    }

    const data = (await resp.json()) as {
      fields?: {
        status?: { stringValue?: string };
      };
    };
    const status = data.fields?.status?.stringValue || 'pending';
    return { approved: status === 'approved', status };
  }

  async function requireApprovedTeacher(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization || '';
      if (!authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          error: 'Yêu cầu đăng nhập tài khoản Giáo viên hợp lệ để sử dụng chức năng này.',
          code: 'UNAUTHENTICATED',
        });
        return;
      }

      const idToken = authHeader.slice(7).trim();
      if (!idToken) {
        res.status(401).json({
          error: 'Thiếu mã xác thực phiên đăng nhập (Firebase ID Token).',
          code: 'UNAUTHENTICATED',
        });
        return;
      }

      const decoded = await adminAuth.verifyIdToken(idToken);
      const email = (decoded.email || '').trim().toLowerCase();
      const emailVerified = decoded.email_verified === true;

      // Tuyệt đối chặn tài khoản cán bộ lớp (@officers.gvcn360.app) gọi API giáo viên / Gemini
      if (email.endsWith(`@${OFFICER_AUTH_DOMAIN}`)) {
        res.status(403).json({
          error:
            'Tài khoản Cán bộ lớp không có quyền truy cập cấu hình Gemini AI hoặc API dành riêng cho Giáo viên.',
          code: 'OFFICER_FORBIDDEN',
        });
        return;
      }

      if (!email || !emailVerified) {
        res.status(403).json({
          error: 'Tài khoản chưa xác minh email hoặc không có quyền truy cập API Giáo viên.',
          code: 'EMAIL_NOT_VERIFIED',
        });
        return;
      }

      const isPrimaryAdmin = email === PRIMARY_ADMIN_EMAIL;
      if (!isPrimaryAdmin) {
        const approval = await checkTeacherApprovedViaFirestoreRest(decoded.uid, idToken);
        if (!approval.approved) {
          res.status(403).json({
            error: 'Tài khoản của bạn đang chờ quản trị viên phê duyệt quyền Giáo viên.',
            code: 'TEACHER_PENDING_APPROVAL',
            status: approval.status,
          });
          return;
        }
      }

      req.authUser = {
        uid: decoded.uid,
        email,
        emailVerified,
        isPrimaryAdmin,
        token: idToken,
        decoded,
      };
      next();
    } catch (error) {
      const fbCode =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code || '')
          : '';
      const rawMsg = error instanceof Error ? error.message.toLowerCase() : '';

      console.error('Auth verification failed:', fbCode || sanitizeForLog(error));

      if (fbCode === 'auth/id-token-expired' || rawMsg.includes('expired')) {
        res.status(401).json({
          error: 'Phiên đăng nhập Google/Firebase đã hết hạn. Vui lòng tải lại trang hoặc đăng nhập lại.',
          code: 'TOKEN_EXPIRED',
        });
        return;
      }

      if (
        rawMsg.includes('enotfound') ||
        rawMsg.includes('etimedout') ||
        rawMsg.includes('econnreset') ||
        rawMsg.includes('fetch failed') ||
        rawMsg.includes('error fetching public keys')
      ) {
        res.status(503).json({
          error: 'Máy chủ tạm thời không thể xác minh chứng thư đăng nhập Google. Vui lòng thử lại sau ít giây.',
          code: 'AUTH_VERIFICATION_UNAVAILABLE',
        });
        return;
      }

      res.status(401).json({
        error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
        code: 'INVALID_TOKEN',
      });
    }
  }

  /**
   * Resolve ONLY the currently authenticated, approved teacher's personal Gemini client.
   * NEVER falls back to process.env.GEMINI_API_KEY or any other teacher's API key.
   */
  async function resolveTeacherGeminiClient(
    authUser: NonNullable<AuthenticatedRequest['authUser']>
  ): Promise<
    | { ok: true; ai: GoogleGenAI; maskedHint: string }
    | { ok: false; status: number; code: string; error: string }
  > {
    try {
      const vaultDoc = await getTeacherVaultDocRest(authUser.uid, authUser.token);
      if (!vaultDoc) {
        return {
          ok: false,
          status: 428,
          code: 'GEMINI_KEY_NOT_CONNECTED',
          error:
            'Bạn chưa kết nối Gemini API key cá nhân. Các chức năng quản lý lớp vẫn hoạt động bình thường; hãy mở mục "Kết nối Gemini AI cá nhân" để kích hoạt trợ lý AI.',
        };
      }

      const resolvedKey = await resolveAndMigrateTeacherApiKey(
        authUser.uid,
        authUser.token,
        vaultDoc
      );
      return {
        ok: true,
        ai: createGeminiClientWithPersonalKey(resolvedKey.apiKey),
        maskedHint: resolvedKey.record.maskedHint,
      };
    } catch (err) {
      if (err instanceof VaultStorageError) {
        return {
          ok: false,
          status: err.httpStatus,
          code: err.code,
          error: err.message,
        };
      }
      const message =
        err instanceof Error
          ? err.message
          : 'Không thể giải mã Gemini API key cá nhân. Vui lòng kết nối lại trong mục Gemini AI cá nhân.';
      return {
        ok: false,
        status: 428,
        code: 'GEMINI_KEY_RECONNECT_REQUIRED',
        error: message,
      };
    }
  }

  // ============================================================================
  // AUTH VERIFICATION & PERSONAL GEMINI API KEY VAULT ENDPOINTS (Teacher Only)
  // ============================================================================
  app.get('/api/auth/verify', requireApprovedTeacher, (req: AuthenticatedRequest, res) => {
    res.json({
      authenticated: true,
      approved: true,
      uid: req.authUser?.uid,
      email: req.authUser?.email,
      isPrimaryAdmin: req.authUser?.isPrimaryAdmin === true,
    });
  });

  app.get(
    '/api/teacher/gemini-key/status',
    requireApprovedTeacher,
    async (req: AuthenticatedRequest, res) => {
      try {
        const authUser = req.authUser!;
        let vaultDoc = await getTeacherVaultDocRest(authUser.uid, authUser.token);
        if (
          vaultDoc &&
          vaultDoc.keyVersion === 'v1-fallback' &&
          isUsingDedicatedVaultSecret() &&
          !isVercelPreviewRuntime()
        ) {
          try {
            const migrated = await resolveAndMigrateTeacherApiKey(
              authUser.uid,
              authUser.token,
              vaultDoc
            );
            vaultDoc = migrated.record;
          } catch {
            // Không tự ý xóa bản ghi cũ; để buildPublicVaultStatus báo trạng thái chính xác
          }
        }
        res.json(buildPublicVaultStatus(vaultDoc, authUser.uid));
      } catch (error) {
        if (error instanceof VaultStorageError) {
          console.error('Gemini key status storage error:', error.code);
          res.status(error.httpStatus).json({
            error: error.message,
            code: error.code,
          });
          return;
        }
        console.error('Gemini key status error:', sanitizeForLog(error));
        res.status(500).json({
          error: 'Không thể kiểm tra trạng thái kết nối Gemini API key cá nhân.',
          code: 'VAULT_STATUS_ERROR',
        });
      }
    }
  );

  app.post(
    '/api/teacher/gemini-key/test',
    requireApprovedTeacher,
    async (req: AuthenticatedRequest, res) => {
      try {
        const authUser = req.authUser!;
        const { apiKey, useSaved } = (req.body || {}) as { apiKey?: string; useSaved?: boolean };

        let keyToTest = '';
        if (useSaved === true && (!apiKey || !apiKey.trim())) {
          const vaultDoc = await getTeacherVaultDocRest(authUser.uid, authUser.token);
          if (!vaultDoc) {
            res.status(400).json({
              ok: false,
              valid: false,
              code: 'GEMINI_KEY_NOT_CONNECTED',
              error: 'Bạn chưa lưu Gemini API key cá nhân nào để kiểm tra.',
            });
            return;
          }
          const resolvedKey = await resolveAndMigrateTeacherApiKey(
            authUser.uid,
            authUser.token,
            vaultDoc
          );
          keyToTest = resolvedKey.apiKey;
        } else {
          const formatCheck = validatePersonalGeminiApiKeyFormat(apiKey);
          if (!formatCheck.valid) {
            res.status(400).json({
              ok: false,
              valid: false,
              code: 'INVALID_KEY_FORMAT',
              error: formatCheck.error,
            });
            return;
          }
          keyToTest = formatCheck.cleaned;
        }

        const result = await verifyPersonalGeminiApiKeyLive(keyToTest);
        if (!result.valid) {
          res.status(result.status).json({
            ok: false,
            valid: false,
            code: result.code,
            error: result.message,
          });
          return;
        }

        res.json({
          ok: true,
          valid: true,
          code: 'OK',
          message: result.message,
          maskedHint: maskApiKeyHint(keyToTest),
        });
      } catch (error) {
        if (error instanceof VaultStorageError) {
          console.error('Gemini key test storage error:', error.code);
          res.status(error.httpStatus).json({
            ok: false,
            valid: false,
            code: error.code,
            error: error.message,
          });
          return;
        }
        console.error('Gemini key test error:', sanitizeForLog(error));
        res.status(500).json({
          ok: false,
          valid: false,
          code: 'TEST_FAILED',
          error: 'Lỗi máy chủ khi kiểm tra kết nối Gemini API key. Vui lòng thử lại.',
        });
      }
    }
  );

  app.post(
    '/api/teacher/gemini-key/save',
    requireApprovedTeacher,
    async (req: AuthenticatedRequest, res) => {
      try {
        const authUser = req.authUser!;
        const { apiKey } = (req.body || {}) as { apiKey?: string };

        if (isProductionRuntime() && !isUsingDedicatedVaultSecret()) {
          res.status(503).json({
            ok: false,
            code: 'PRODUCTION_ENCRYPTION_SECRET_REQUIRED',
            error:
              'Môi trường vận hành chính thức (production/Vercel) yêu cầu quản trị viên cấu hình biến bí mật API_KEY_ENCRYPTION_SECRET trong Environment Variables / Secrets trước khi lưu Gemini API key cá nhân.',
          });
          return;
        }

        const formatCheck = validatePersonalGeminiApiKeyFormat(apiKey);
        if (!formatCheck.valid) {
          res.status(400).json({
            ok: false,
            code: 'INVALID_KEY_FORMAT',
            error: formatCheck.error,
          });
          return;
        }

        // Xác thực trực tiếp Gemini API key cá nhân trước khi mã hóa và lưu vào kho bảo mật
        const verification = await verifyPersonalGeminiApiKeyLive(formatCheck.cleaned);
        if (!verification.valid) {
          res.status(verification.status).json({
            ok: false,
            code: verification.code,
            error: verification.message,
          });
          return;
        }

        const nowMs = Date.now();
        const encryptedEnvelope = encryptPersonalApiKey(authUser.uid, formatCheck.cleaned, nowMs);
        await upsertTeacherVaultDocRest(authUser.uid, authUser.token, encryptedEnvelope);

        // Tuyệt đối không trả khóa gốc hoặc bản mã hóa về trình duyệt
        res.json({
          ok: true,
          connected: true,
          status: 'connected',
          maskedHint: encryptedEnvelope.maskedHint,
          lastVerifiedAtMs: encryptedEnvelope.lastVerifiedAtMs,
          updatedAtMs: encryptedEnvelope.updatedAtMs,
          usingDedicatedVaultSecret: isUsingDedicatedVaultSecret(),
          encryptionKeyVersion: encryptedEnvelope.keyVersion,
          isProduction: isProductionRuntime(),
          message: 'Đã xác thực và lưu an toàn Gemini API key cá nhân trên máy chủ.',
        });
      } catch (error) {
        if (error instanceof VaultStorageError) {
          console.error('Gemini key save storage error:', error.code);
          res.status(error.httpStatus).json({
            ok: false,
            code: error.code,
            error: error.message,
          });
          return;
        }
        console.error('Gemini key save error:', sanitizeForLog(error));
        res.status(500).json({
          ok: false,
          code: 'VAULT_SAVE_ERROR',
          error: 'Lỗi máy chủ khi lưu Gemini API key cá nhân vào kho bảo mật.',
        });
      }
    }
  );

  app.delete(
    '/api/teacher/gemini-key',
    requireApprovedTeacher,
    async (req: AuthenticatedRequest, res) => {
      try {
        const authUser = req.authUser!;
        await deleteTeacherVaultDocRest(authUser.uid, authUser.token);
        res.json({
          ok: true,
          connected: false,
          status: 'not_connected',
          maskedHint: '',
          lastVerifiedAtMs: null,
          updatedAtMs: null,
          usingDedicatedVaultSecret: isUsingDedicatedVaultSecret(),
          encryptionKeyVersion: null,
          isProduction: isProductionRuntime(),
          message: 'Đã ngắt kết nối và xóa Gemini API key cá nhân khỏi kho bảo mật.',
        });
      } catch (error) {
        if (error instanceof VaultStorageError) {
          console.error('Gemini key delete storage error:', error.code);
          res.status(error.httpStatus).json({
            ok: false,
            code: error.code,
            error: error.message,
          });
          return;
        }
        console.error('Gemini key delete error:', sanitizeForLog(error));
        res.status(500).json({
          ok: false,
          code: 'VAULT_DELETE_ERROR',
          error: 'Lỗi máy chủ khi ngắt kết nối Gemini API key.',
        });
      }
    }
  );

  // ============================================================================
  // CLASS OFFICER REAL AUTHENTICATION BACKEND (Zero IAM — Works on Starter & Blaze)
  // ============================================================================
  const OFFICER_RATE_LIMIT_MAX_ATTEMPTS = 5;
  const OFFICER_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
  const officerFailedLoginMap = new Map<string, { count: number; lockedUntilMs: number }>();

  function normalizeNicknameServer(raw: string): string {
    return String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9._-]/g, '');
  }

  function nicknameToDocIdServer(nickname: string): string {
    return normalizeNicknameServer(nickname)
      .replace(/\./g, '__dot__')
      .replace(/[^a-z0-9_-]/g, '_')
      .slice(0, 120);
  }

  function buildOfficerAuthEmailServer(nicknameId: string, credentialVersion: number): string {
    const safeId = nicknameId.replace(/[^a-z0-9_-]/g, '_');
    if (credentialVersion <= 1) {
      return `${safeId}@${OFFICER_AUTH_DOMAIN}`;
    }
    return `${safeId}.v${credentialVersion}@${OFFICER_AUTH_DOMAIN}`;
  }

  function getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0].trim();
    }
    return req.socket?.remoteAddress || 'unknown';
  }

  async function fetchOfficerDirectoryDocRest(nicknameId: string): Promise<
    | { exists: false }
    | {
        exists: true;
        nickname: string;
        authEmail: string;
        active: boolean;
        teacherUid: string;
        workspaceId: string;
        credentialVersion: number;
      }
  > {
    const dbId = encodeURIComponent(firebaseConfig.firestoreDatabaseId || '(default)');
    const safeDocId = encodeURIComponent(nicknameId);
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      firebaseConfig.projectId
    )}/databases/${dbId}/documents/officer_directory/${safeDocId}`;

    const resp = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (resp.status === 404) {
      return { exists: false };
    }
    if (!resp.ok) {
      throw new Error(`Không thể tra cứu danh bạ cán bộ lớp (HTTP ${resp.status}).`);
    }

    const data = (await resp.json()) as {
      fields?: {
        nickname?: { stringValue?: string };
        authEmail?: { stringValue?: string };
        active?: { booleanValue?: boolean };
        teacherUid?: { stringValue?: string };
        workspaceId?: { stringValue?: string };
        credentialVersion?: { integerValue?: string; doubleValue?: number };
      };
    };

    const fields = data.fields || {};
    return {
      exists: true,
      nickname: fields.nickname?.stringValue || nicknameId,
      authEmail: fields.authEmail?.stringValue || '',
      active: fields.active?.booleanValue === true,
      teacherUid: fields.teacherUid?.stringValue || '',
      workspaceId: fields.workspaceId?.stringValue || '',
      credentialVersion: Number(
        fields.credentialVersion?.integerValue ?? fields.credentialVersion?.doubleValue ?? 1
      ),
    };
  }

  // 1. Kiểm tra trực tiếp xem phương thức Email/Password trên Firebase Auth đã được bật chưa (chỉ GVCN)
  app.get(
    '/api/officer/auth-health',
    requireApprovedTeacher,
    async (_req: AuthenticatedRequest, res) => {
      try {
        const apiKey = firebaseConfig.apiKey;
        const probeResp = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: `healthcheck_${Date.now()}@${OFFICER_AUTH_DOMAIN}`,
              password: 'DiagnosticProbePassword99!',
              returnSecureToken: true,
            }),
          }
        );
        const probeJson = (await probeResp.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        const errMsg = String(probeJson?.error?.message || '');
        const emailPasswordEnabled =
          !errMsg.includes('PASSWORD_LOGIN_DISABLED') && !errMsg.includes('OPERATION_NOT_ALLOWED');

        res.json({
          emailPasswordEnabled,
          rawStatus: emailPasswordEnabled ? 'ENABLED' : errMsg || 'PASSWORD_LOGIN_DISABLED',
          projectId: firebaseConfig.projectId,
          consoleProvidersUrl: `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`,
        });
      } catch (error) {
        console.error('Officer auth-health check error:', sanitizeForLog(error));
        res.status(500).json({
          emailPasswordEnabled: false,
          rawStatus: 'CHECK_ERROR',
          projectId: firebaseConfig.projectId,
          consoleProvidersUrl: `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`,
        });
      }
    }
  );

  // 2. Tạo tài khoản Firebase Auth thật cho Cán bộ lớp thông qua backend được bảo vệ
  app.post(
    '/api/officer/provision',
    requireApprovedTeacher,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { nickname, password, mode, credentialVersion } = req.body as {
          nickname?: string;
          password?: string;
          mode?: 'create' | 'reset';
          credentialVersion?: number;
        };

        const normalized = normalizeNicknameServer(nickname || '');
        if (normalized.length < 3 || normalized.length > 60) {
          res.status(400).json({
            code: 'INVALID_NICKNAME',
            error:
              'Nickname không hợp lệ (cần 3–60 ký tự chữ thường, số, dấu chấm hoặc gạch dưới).',
          });
          return;
        }

        if (!password || typeof password !== 'string' || password.length < 8) {
          res.status(400).json({
            code: 'WEAK_PASSWORD',
            error: 'Mật khẩu cán bộ lớp phải có tối thiểu 8 ký tự.',
          });
          return;
        }

        const version = Math.max(1, Math.min(100, Math.floor(Number(credentialVersion) || 1)));
        const nicknameId = nicknameToDocIdServer(normalized);

        if (mode !== 'reset') {
          const existingDir = await fetchOfficerDirectoryDocRest(nicknameId);
          if (existingDir.exists) {
            res.status(409).json({
              code: 'NICKNAME_EXISTS',
              error: `Nickname "${normalized}" đã tồn tại trên hệ thống. Vui lòng chọn Nickname khác.`,
            });
            return;
          }
        }

        const authEmail = buildOfficerAuthEmailServer(nicknameId, version);
        const signUpResp = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: authEmail,
              password,
              returnSecureToken: true,
            }),
          }
        );

        const signUpJson = (await signUpResp.json().catch(() => ({}))) as {
          localId?: string;
          error?: { message?: string };
        };

        if (!signUpResp.ok || !signUpJson.localId) {
          const errCode = String(signUpJson?.error?.message || '');
          if (
            errCode.includes('OPERATION_NOT_ALLOWED') ||
            errCode.includes('PASSWORD_LOGIN_DISABLED')
          ) {
            res.status(503).json({
              code: 'PASSWORD_LOGIN_DISABLED',
              error:
                'Phương thức đăng nhập Email/Password chưa được bật trên Firebase Console của dự án. Vui lòng mở Firebase Console → Authentication → Sign-in method → bật Email/Password rồi bấm Save.',
              consoleProvidersUrl: `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`,
            });
            return;
          }
          if (errCode.includes('EMAIL_EXISTS')) {
            res.status(409).json({
              code: 'EMAIL_EXISTS',
              error: `Định danh xác thực cho "${normalized}" (v${version}) đã tồn tại trên Firebase Auth. Hãy tăng phiên bản hoặc chọn nickname khác.`,
            });
            return;
          }
          if (errCode.includes('WEAK_PASSWORD')) {
            res.status(400).json({
              code: 'WEAK_PASSWORD',
              error:
                'Mật khẩu chưa đủ mạnh theo tiêu chuẩn Firebase Authentication (tối thiểu 8 ký tự).',
            });
            return;
          }
          res.status(500).json({
            code: 'PROVISION_FAILED',
            error: `Không thể tạo tài khoản Firebase Auth (${errCode || `HTTP ${signUpResp.status}`}).`,
          });
          return;
        }

        res.json({
          ok: true,
          officerUid: signUpJson.localId,
          authEmail,
          nickname: normalized,
          nicknameId,
          credentialVersion: version,
        });
      } catch (error) {
        console.error('Officer provision error:', sanitizeForLog(error));
        res.status(500).json({
          code: 'PROVISION_ERROR',
          error:
            error instanceof Error
              ? error.message
              : 'Lỗi máy chủ khi khởi tạo tài khoản cán bộ lớp.',
        });
      }
    }
  );

  // 3. Xác thực Nickname + Mật khẩu Cán bộ lớp có chống dò mật khẩu
  app.post('/api/officer/login', async (req: Request, res: Response) => {
    try {
      const { nickname, password } = req.body as { nickname?: string; password?: string };
      const normalized = normalizeNicknameServer(nickname || '');
      if (normalized.length < 3) {
        res.status(400).json({
          code: 'INVALID_NICKNAME',
          error: 'Nickname không hợp lệ (cần tối thiểu 3 ký tự, ví dụ: 12d6.lt).',
        });
        return;
      }
      if (!password || typeof password !== 'string') {
        res.status(400).json({
          code: 'MISSING_PASSWORD',
          error: 'Vui lòng nhập mật khẩu do GVCN cấp.',
        });
        return;
      }

      const rateKey = `${getClientIp(req)}::${normalized}`;
      const now = Date.now();
      const rateState = officerFailedLoginMap.get(rateKey);
      if (rateState && rateState.lockedUntilMs > now) {
        const minutesLeft = Math.max(1, Math.ceil((rateState.lockedUntilMs - now) / 60000));
        res.status(429).json({
          code: 'RATE_LIMITED',
          error: `Bạn đã nhập sai mật khẩu quá ${OFFICER_RATE_LIMIT_MAX_ATTEMPTS} lần. Vui lòng thử lại sau ${minutesLeft} phút hoặc nhờ GVCN đặt lại mật khẩu.`,
        });
        return;
      }

      const nicknameId = nicknameToDocIdServer(normalized);
      const dirDoc = await fetchOfficerDirectoryDocRest(nicknameId);

      if (!dirDoc.exists) {
        res.status(404).json({
          code: 'ACCOUNT_NOT_FOUND',
          error: `Tài khoản cán bộ lớp "${normalized}" chưa được tạo trên hệ thống. Vui lòng nhờ GVCN đăng nhập Google vào mục "Hệ thống → Phân quyền 8 vị trí → Quản lý tài khoản Cán bộ lớp" để cấp tài khoản chính thức.`,
        });
        return;
      }

      if (!dirDoc.active || !dirDoc.authEmail) {
        res.status(403).json({
          code: 'ACCOUNT_LOCKED',
          error: `Tài khoản cán bộ lớp "${normalized}" hiện đang bị khóa hoặc đã được GVCN thu hồi quyền.`,
        });
        return;
      }

      const verifyResp = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: dirDoc.authEmail,
            password,
            returnSecureToken: true,
          }),
        }
      );

      const verifyJson = (await verifyResp.json().catch(() => ({}))) as {
        localId?: string;
        idToken?: string;
        error?: { message?: string };
      };

      if (!verifyResp.ok || !verifyJson.localId || !verifyJson.idToken) {
        const errCode = String(verifyJson?.error?.message || '');
        if (
          errCode.includes('PASSWORD_LOGIN_DISABLED') ||
          errCode.includes('OPERATION_NOT_ALLOWED')
        ) {
          res.status(503).json({
            code: 'PASSWORD_LOGIN_DISABLED',
            error:
              'Phương thức đăng nhập Email/Password hiện đang tắt trên Firebase Authentication của dự án. Vui lòng báo GVCN bật Email/Password trong Firebase Console → Authentication → Sign-in method.',
          });
          return;
        }

        if (errCode.includes('USER_DISABLED')) {
          res.status(403).json({
            code: 'ACCOUNT_LOCKED',
            error: `Tài khoản "${normalized}" đã bị vô hiệu hóa trên Firebase Authentication.`,
          });
          return;
        }

        const prevCount = rateState && rateState.lockedUntilMs <= now ? rateState.count : 0;
        const nextCount = prevCount + 1;
        if (nextCount >= OFFICER_RATE_LIMIT_MAX_ATTEMPTS) {
          officerFailedLoginMap.set(rateKey, {
            count: nextCount,
            lockedUntilMs: now + OFFICER_RATE_LIMIT_WINDOW_MS,
          });
          res.status(429).json({
            code: 'RATE_LIMITED',
            error: `Bạn đã nhập sai mật khẩu ${OFFICER_RATE_LIMIT_MAX_ATTEMPTS} lần liên tiếp. Tài khoản tạm khóa đăng nhập 15 phút để bảo mật.`,
          });
          return;
        }

        officerFailedLoginMap.set(rateKey, { count: nextCount, lockedUntilMs: 0 });
        const remaining = OFFICER_RATE_LIMIT_MAX_ATTEMPTS - nextCount;
        res.status(401).json({
          code: 'INVALID_PASSWORD',
          error: `Mật khẩu của tài khoản "${normalized}" chưa chính xác (còn ${remaining} lần thử). Nếu quên mật khẩu, hãy nhờ GVCN đặt lại.`,
        });
        return;
      }

      const dbId = encodeURIComponent(firebaseConfig.firestoreDatabaseId || '(default)');
      const memUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
        firebaseConfig.projectId
      )}/databases/${dbId}/documents/officer_memberships/${encodeURIComponent(verifyJson.localId)}`;
      const memResp = await fetch(memUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${verifyJson.idToken}`,
          Accept: 'application/json',
        },
      });

      if (memResp.status === 404) {
        res.status(403).json({
          code: 'MEMBERSHIP_NOT_FOUND',
          error: `Tài khoản "${normalized}" chưa có hồ sơ phân quyền hợp lệ trong lớp hoặc đã bị thu hồi. Vui lòng liên hệ GVCN kiểm tra.`,
        });
        return;
      }
      if (!memResp.ok) {
        res.status(403).json({
          code: 'MEMBERSHIP_DENIED',
          error: `Không thể xác minh phân quyền lớp cho tài khoản "${normalized}" (HTTP ${memResp.status}).`,
        });
        return;
      }

      const memData = (await memResp.json()) as {
        fields?: {
          active?: { booleanValue?: boolean };
          permissionStatus?: { stringValue?: string };
          securityLockReason?: { stringValue?: string };
          teacherUid?: { stringValue?: string };
          workspaceId?: { stringValue?: string };
          studentCode?: { stringValue?: string };
          studentName?: { stringValue?: string };
          className?: { stringValue?: string };
          assignedTeam?: { integerValue?: string; doubleValue?: number };
          roles?: { arrayValue?: { values?: Array<{ stringValue?: string }> } };
        };
      };
      const mf = memData.fields || {};
      const memActive = mf.active?.booleanValue === true;
      const memPermStatus = mf.permissionStatus?.stringValue || '';
      const memLockReason = mf.securityLockReason?.stringValue || '';
      const memTeacherUid = mf.teacherUid?.stringValue || '';
      const memWorkspaceId = mf.workspaceId?.stringValue || '';
      const memRoles = (mf.roles?.arrayValue?.values || [])
        .map((v) => v.stringValue || '')
        .filter(Boolean);

      if (
        !memActive ||
        memPermStatus === 'revoked' ||
        memPermStatus === 'locked' ||
        memRoles.length === 0
      ) {
        res.status(403).json({
          code: 'MEMBERSHIP_REVOKED',
          error: memLockReason
            ? `Tài khoản "${normalized}" đang bị khóa bảo mật (${memLockReason}). Vui lòng liên hệ GVCN.`
            : `Quyền Cán bộ lớp của tài khoản "${normalized}" hiện đang tạm khóa, chờ kích hoạt hoặc đã bị GVCN thu hồi.`,
        });
        return;
      }

      if (memTeacherUid !== dirDoc.teacherUid || memWorkspaceId !== dirDoc.workspaceId) {
        res.status(403).json({
          code: 'WORKSPACE_MISMATCH',
          error: `Phát hiện sai lệch liên kết lớp học cho tài khoản "${normalized}". Vui lòng báo GVCN rà soát lại.`,
        });
        return;
      }

      officerFailedLoginMap.delete(rateKey);
      res.json({
        ok: true,
        nickname: dirDoc.nickname,
        authEmail: dirDoc.authEmail,
        officerUid: verifyJson.localId,
        roles: memRoles,
        assignedTeam: Number(mf.assignedTeam?.integerValue ?? mf.assignedTeam?.doubleValue ?? 0),
        studentCode: mf.studentCode?.stringValue || '',
        studentName: mf.studentName?.stringValue || '',
        className: mf.className?.stringValue || '',
      });
    } catch (error) {
      console.error('Officer login route error:', sanitizeForLog(error));
      res.status(500).json({
        code: 'LOGIN_ERROR',
        error:
          error instanceof Error ? error.message : 'Lỗi máy chủ khi xác thực Cán bộ lớp.',
      });
    }
  });

  // 4. Backend kiểm tra điều kiện kích hoạt quyền cán bộ lớp (chỉ GVCN sở hữu lớp)
  app.post(
    '/api/officer/verify-activation',
    requireApprovedTeacher,
    async (req: AuthenticatedRequest, res) => {
      try {
        const authUser = req.authUser!;
        const {
          workspaceId,
          roleId,
          studentId,
          accountDocId,
          officerUid,
          nicknameId,
          securityLockVerifiedByGvcn,
        } = req.body as {
          workspaceId?: string;
          roleId?: string;
          studentId?: string;
          accountDocId?: string;
          officerUid?: string;
          nicknameId?: string;
          securityLockVerifiedByGvcn?: boolean;
        };

        if (!workspaceId || !roleId || !studentId || !accountDocId || !officerUid || !nicknameId) {
          res.status(400).json({
            ok: false,
            eligible: false,
            blockingReason: 'Thiếu thông tin xác minh kích hoạt tài khoản cán bộ lớp.',
          });
          return;
        }

        const dbId = encodeURIComponent(firebaseConfig.firestoreDatabaseId || '(default)');
        const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
          firebaseConfig.projectId
        )}/databases/${dbId}/documents`;
        const fetchDoc = async (docPath: string) => {
          const r = await fetch(`${baseUrl}/${docPath}`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${authUser.token}`,
              Accept: 'application/json',
            },
          });
          if (r.status === 404) return null;
          if (!r.ok) {
            throw new Error(`Firestore từ chối truy cập tài liệu "${docPath}" (HTTP ${r.status}).`);
          }
          return (await r.json()) as { fields?: Record<string, Record<string, unknown>> };
        };

        const wsPrefix = `users/${encodeURIComponent(authUser.uid)}/workspaces/${encodeURIComponent(workspaceId)}`;
        const [studentDoc, assignmentDoc, accountDoc, membershipDoc, dirDoc] = await Promise.all([
          fetchDoc(`${wsPrefix}/students/${encodeURIComponent(studentId)}`),
          fetchDoc(`${wsPrefix}/role_assignments/${encodeURIComponent(roleId)}`),
          fetchDoc(`${wsPrefix}/officer_accounts/${encodeURIComponent(accountDocId)}`),
          fetchDoc(`officer_memberships/${encodeURIComponent(officerUid)}`),
          fetchDoc(`officer_directory/${encodeURIComponent(nicknameId)}`),
        ]);

        const strVal = (
          docObj: { fields?: Record<string, Record<string, unknown>> } | null,
          key: string
        ) => String(docObj?.fields?.[key]?.stringValue || '').trim();
        const arrStr = (
          docObj: { fields?: Record<string, Record<string, unknown>> } | null,
          key: string
        ) => {
          const values = (
            docObj?.fields?.[key]?.arrayValue as
              | { values?: Array<{ stringValue?: string }> }
              | undefined
          )?.values;
          return (values || []).map((v) => String(v.stringValue || '')).filter(Boolean);
        };

        const stName = strVal(studentDoc, 'fullName');
        const stCode = strVal(studentDoc, 'code');
        const stMoet = strVal(studentDoc, 'moetCode') || (/^\d{10}$/.test(stCode) ? stCode : '');
        const stRoles = arrStr(studentDoc, 'roles');
        const stSingleRole = strVal(studentDoc, 'role');
        const assignStudentId = strVal(assignmentDoc, 'studentId');
        const accOfficerUid = strVal(accountDoc, 'officerUid');
        const accStudentId = strVal(accountDoc, 'studentId');
        const accStudentCode = strVal(accountDoc, 'studentCode');
        const accStudentName = strVal(accountDoc, 'studentName');
        const accLockReason = strVal(accountDoc, 'securityLockReason');
        const memLockReason = strVal(membershipDoc, 'securityLockReason');
        const memTeacherUid = strVal(membershipDoc, 'teacherUid');
        const memWorkspaceId = strVal(membershipDoc, 'workspaceId');
        const dirTeacherUid = strVal(dirDoc, 'teacherUid');
        const dirWorkspaceId = strVal(dirDoc, 'workspaceId');

        const lockReason = memLockReason || accLockReason;
        const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

        const check1 = Boolean(studentDoc && stName);
        const check2 = Boolean(
          studentDoc && (stMoet || stCode) && (!assignmentDoc || assignStudentId === studentId)
        );
        const check3 = Boolean(
          assignmentDoc &&
            assignStudentId === studentId &&
            (stRoles.includes(roleId) || stSingleRole === roleId)
        );
        const check4 = Boolean(
          accountDoc &&
            membershipDoc &&
            dirDoc &&
            accOfficerUid === officerUid &&
            memTeacherUid === authUser.uid &&
            memWorkspaceId === workspaceId &&
            dirTeacherUid === authUser.uid &&
            dirWorkspaceId === workspaceId &&
            (accStudentId === studentId ||
              accStudentCode === studentId ||
              accStudentCode === stCode) &&
            norm(accStudentName) === norm(stName)
        );
        const check5 = !lockReason || Boolean(securityLockVerifiedByGvcn);

        const checks = [
          {
            step: 1,
            label: 'Học sinh tồn tại trong danh sách lớp chính thức trên Firestore',
            passed: check1,
            detail: check1
              ? `Hồ sơ ${stName} tồn tại trên Firestore.`
              : 'Không tìm thấy hồ sơ học sinh trên Firestore.',
          },
          {
            step: 2,
            label: 'Mã MOET & StudentId khớp với phân công',
            passed: check2,
            detail: check2
              ? `StudentId ${studentId} • Mã MOET ${stMoet || stCode}`
              : 'Lệch StudentId hoặc thiếu Mã MOET trên Firestore.',
          },
          {
            step: 3,
            label: 'Học sinh giữ đúng chức vụ đã GVCN xác nhận duy nhất',
            passed: check3,
            detail: check3
              ? `Khớp bản ghi role_assignments/${roleId} và hồ sơ lớp.`
              : `Chưa có bản ghi phân công chính thức role_assignments/${roleId} khớp với học sinh này.`,
          },
          {
            step: 4,
            label: 'Firebase UID, danh bạ nickname và hồ sơ tài khoản liên kết đúng học sinh',
            passed: check4,
            detail: check4
              ? `UID ${officerUid.slice(0, 10)}… khớp tuyệt đối giữa officer_accounts, officer_memberships và officer_directory.`
              : 'Phát hiện sai lệch UID, mã học sinh, họ tên hoặc workspace giữa các bảng tài khoản.',
          },
          {
            step: 5,
            label: 'Không có khóa bảo mật chưa được GVCN xác minh',
            passed: check5,
            detail: !lockReason
              ? 'Tài khoản không có cờ khóa bảo mật.'
              : securityLockVerifiedByGvcn
                ? `GVCN đã xác minh lý do khóa ("${lockReason}").`
                : `Tài khoản đang có cờ khóa bảo mật: "${lockReason}".`,
          },
        ];

        const firstFailed = checks.find((c) => !c.passed);
        res.json({
          ok: true,
          eligible: !firstFailed,
          checks,
          blockingReason: firstFailed ? `Bước ${firstFailed.step}: ${firstFailed.detail}` : '',
        });
      } catch (error) {
        console.error('Officer verify-activation error:', sanitizeForLog(error));
        res.status(500).json({
          ok: false,
          eligible: false,
          blockingReason:
            error instanceof Error
              ? error.message
              : 'Lỗi máy chủ khi xác minh điều kiện kích hoạt.',
        });
      }
    }
  );

  // ============================================================================
  // SERVER-SIDE GEMINI API ROUTES (GVCN 360 AI PRO — Per-Teacher Personal Key Only)
  // ============================================================================
  app.post('/api/gemini/analyze', requireApprovedTeacher, async (req: AuthenticatedRequest, res) => {
    try {
      const resolved = await resolveTeacherGeminiClient(req.authUser!);
      if (!resolved.ok) {
        res.status(resolved.status).json({ error: resolved.error, code: resolved.code });
        return;
      }

      const { prompt } = req.body as { prompt?: string };
      if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: 'Thiếu nội dung dữ liệu đầu vào để phân tích.' });
        return;
      }

      const response = await generateContentWithRetry(resolved.ai, {
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'Bạn là chuyên gia tư vấn sư phạm cho Giáo viên Chủ nhiệm THPT tại Việt Nam. Chỉ phân tích dựa trên dữ liệu đã xác nhận được cung cấp, tuyệt đối không bịa thêm số liệu và không tự ý kết luận xếp loại rèn luyện thay giáo viên.',
        },
      });

      res.json({ text: response.text || '' });
    } catch (error) {
      const classified = classifyGeminiApiError(error, 'generate');
      console.error('Gemini analyze error:', classified.code, sanitizeForLog(error));
      res.status(classified.status).json({ error: classified.message, code: classified.code });
    }
  });

  app.post(
    '/api/gemini/subject-analyze',
    requireApprovedTeacher,
    async (req: AuthenticatedRequest, res) => {
      try {
        const resolved = await resolveTeacherGeminiClient(req.authUser!);
        if (!resolved.ok) {
          res.status(resolved.status).json({ error: resolved.error, code: resolved.code });
          return;
        }

        const { prompt } = req.body as { prompt?: string };
        if (!prompt || typeof prompt !== 'string') {
          res.status(400).json({ error: 'Thiếu dữ liệu bộ môn để phân tích.' });
          return;
        }

        const response = await generateContentWithRetry(resolved.ai, {
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            systemInstruction:
              'Bạn là trợ lý chuyên môn hỗ trợ giáo viên bộ môn THPT. Dựa trên bản đồ kiến thức, kết quả kiểm tra nhanh và sổ tay lỗi sai thực tế, hãy đề xuất phương án phụ đạo theo nhóm kỹ năng cụ thể, ngắn gọn, dễ áp dụng.',
          },
        });

        res.json({ text: response.text || '' });
      } catch (error) {
        const classified = classifyGeminiApiError(error, 'generate');
        console.error('Gemini subject-analyze error:', classified.code, sanitizeForLog(error));
        res.status(classified.status).json({ error: classified.message, code: classified.code });
      }
    }
  );

  app.post(
    '/api/gemini/parent-comm',
    requireApprovedTeacher,
    async (req: AuthenticatedRequest, res) => {
      try {
        const resolved = await resolveTeacherGeminiClient(req.authUser!);
        if (!resolved.ok) {
          res.status(resolved.status).json({ error: resolved.error, code: resolved.code });
          return;
        }

        const { prompt } = req.body as { prompt?: string };
        if (!prompt || typeof prompt !== 'string') {
          res.status(400).json({ error: 'Thiếu thông tin học sinh để soạn thảo.' });
          return;
        }

        const parsed = await generateJsonWithRetry<{ message?: string; reportCardDraft?: string }>(
          resolved.ai,
          {
            model: GEMINI_MODEL,
            contents: prompt,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              systemInstruction:
                'Bạn là Giáo viên Chủ nhiệm tận tâm, chuẩn mực sư phạm. Hãy viết 1 tin nhắn gửi phụ huynh và 1 nhận xét học bạ ngắn gọn bằng tiếng Việt dựa đúng trên dữ liệu được cung cấp.',
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  message: {
                    type: Type.STRING,
                    description: 'Tin nhắn gửi phụ huynh lịch sự, chân thành, có dữ liệu cụ thể.',
                  },
                  reportCardDraft: {
                    type: Type.STRING,
                    description: 'Nhận xét học bạ súc tích, đúng chuẩn sư phạm.',
                  },
                },
                required: ['message', 'reportCardDraft'],
              },
            },
          },
          (data) => Boolean(data && (String(data.message || '').trim() || String(data.reportCardDraft || '').trim()))
        );

        res.json({
          message: String(parsed.message || '').trim(),
          reportCardDraft: String(parsed.reportCardDraft || '').trim(),
        });
      } catch (error) {
        const classified = classifyGeminiApiError(error, 'generate');
        console.error('Gemini parent-comm error:', classified.code, sanitizeForLog(error));
        res.status(classified.status).json({ error: classified.message, code: classified.code });
      }
    }
  );

  function sanitizePedagogicalInput(value: unknown, maxLen = 1500): string {
    return String(value ?? '')
      .replace(/(?:\+84|0)(?:[\s.\-]*\d){8,10}/g, '[đã ẩn SĐT]')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[đã ẩn email]')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLen);
  }

  const PEDAGOGICAL_ACTION_INSTRUCTIONS: Record<string, string> = {
    generate: 'Soạn mới 01 bản chuẩn mực dựa đúng trên minh chứng đã cung cấp.',
    regenerate:
      'Soạn 01 phương án DIỄN ĐẠT MỚI KHÁC BIỆT về cấu trúc câu và cách mở đầu so với bản hiện tại nhưng vẫn bám sát hoàn toàn cùng tập minh chứng.',
    shorten:
      'Rút gọn bản hiện tại cho súc tích, gọn gàng hơn nhưng vẫn giữ đủ ý chính có căn cứ và giọng sư phạm nhân văn.',
    more_formal:
      'Chỉnh sửa bản hiện tại theo hướng trang trọng, chuẩn mực hành chính - giáo dục hơn nhưng không khô cứng.',
    gentler:
      'Chỉnh sửa bản hiện tại theo hướng nhẹ nhàng, ấm áp, khích lệ và giàu tính động viên hơn nhưng vẫn khách quan.',
    more_specific:
      'Chỉnh sửa bản hiện tại để nêu cụ thể, sát hơn với các minh chứng thực tế có trong hồ sơ (tuyệt đối không bịa thêm chi tiết ngoài minh chứng).',
    rephrase_keep_meaning:
      'GIỮ NGUYÊN toàn bộ ý chính và mức độ nhận định của bản GVCN hiện tại, chỉ trau chuốt lại diễn đạt tiếng Việt cho tự nhiên, mượt mà và chuẩn mực sư phạm.',
  };

  const REPORT_CARD_SYSTEM_INSTRUCTION = [
    'Bạn là chuyên gia giáo dục THPT Việt Nam am hiểu sâu sắc công tác chủ nhiệm và Thông tư 22/2021/TT-BGDĐT.',
    'Nhiệm vụ DUY NHẤT của bạn là soạn NHẬN XÉT HỌC BẠ cho 01 học sinh cụ thể dựa HOÀN TOÀN trên minh chứng đã xác thực do GVCN cung cấp.',
    'QUY TẮC BẮT BUỘC:',
    '1. Tuyệt đối KHÔNG bịa đặt điểm số, giải thưởng, thành tích, sự việc hay phẩm chất không có trong minh chứng.',
    '2. Tách bạch tuyệt đối Thi đua tuần nội bộ (A/B/C) với Xếp loại Rèn luyện chính thức theo Thông tư 22 (Tốt / Khá / Đạt / Chưa đạt). KHÔNG BAO GIỜ viết "rèn luyện loại A/B/C" hoặc tự suy ra xếp loại chính thức nếu GVCN chưa xác nhận.',
    '3. Bố cục chuẩn sư phạm: Ưu điểm có căn cứ -> Nội dung cần cải thiện (chỉ nêu nếu có minh chứng thực tế) -> Định hướng tích cực, phù hợp.',
    '4. Mở đầu bằng "Em..." (trừ khi mẫu riêng của trường yêu cầu khác). Ngôn ngữ tiếng Việt trong sáng, tự nhiên, nhân văn, không dán nhãn ("cá biệt", "lười biếng", "vô kỷ luật", "yếu kém", "hư hỏng").',
    '5. Không ghi tên AI, không ghi mã học sinh/mã MOET/mã kỹ thuật, không ghi số điện thoại, không nhắc tới học sinh khác, không đưa phản ánh chưa xác minh (pending_verification) thành kết luận học bạ.',
    '6. Tránh lặp nguyên văn cách mở đầu của các học sinh khác trong danh sách recentOpenings.',
    '7. Tuân thủ nghiêm ngặt khoảng số từ theo chế độ độ dài và giới hạn ký tự (nếu có).',
  ].join('\n');

  const PARENT_MESSAGE_SYSTEM_INSTRUCTION = [
    'Bạn là Giáo viên Chủ nhiệm THPT tận tâm, điềm tĩnh, chuẩn mực sư phạm và tinh tế trong giao tiếp với gia đình học sinh Việt Nam.',
    'Nhiệm vụ DUY NHẤT của bạn là soạn BẢN NHÁP TIN NHẮN PHỐI HỢP PHỤ HUYNH cho 01 học sinh cụ thể dựa đúng minh chứng cung cấp.',
    'QUY TẮC BẮT BUỘC:',
    '1. Bắt đầu bằng lời xưng hô tôn trọng theo đúng mẫu GVCN chọn (mặc định "Kính gửi quý phụ huynh...").',
    '2. Giọng điệu tôn trọng, đồng hành, xây dựng; TUYỆT ĐỐI KHÔNG đổ lỗi phụ huynh, không miệt thị hay dán nhãn học sinh ("lười biếng", "cá biệt", "vô kỷ luật", "gia đình buông lỏng"...).',
    '3. Tuyệt đối KHÔNG bịa sự việc, điểm số hay thành tích ngoài minh chứng. Chỉ đề cập đúng 01 học sinh đang chọn, KHÔNG nhắc tên hay thông tin của học sinh khác.',
    '4. ĐẶC BIỆT QUAN TRỌNG VỚI THÔNG TIN CHƯA XÁC MINH (incidentStatus = pending_verification hoặc mục đích xác minh thông tin): TUYỆT ĐỐI KHÔNG khẳng định học sinh đã vi phạm hay quy kết lỗi; chỉ trình bày trung lập rằng GVCN đang tìm hiểu/xác minh thêm và mong trao đổi phối hợp cùng gia đình.',
    '5. Không đưa số điện thoại, không ghi nhãn AI/mã hệ thống/mã MOET. Kết thúc lịch sự, mở ra hướng phối hợp cụ thể.',
    '6. Nếu học sinh có hoàn cảnh khó khăn, giữ sự tế nhị, tôn trọng riêng tư, tránh thương hại, tập trung trân trọng nỗ lực và đề nghị đồng hành.',
  ].join('\n');

  app.post(
    '/api/gemini/pedagogical/report-card',
    requireApprovedTeacher,
    async (req: AuthenticatedRequest, res) => {
      try {
        const resolved = await resolveTeacherGeminiClient(req.authUser!);
        if (!resolved.ok) {
          res.status(resolved.status).json({ error: resolved.error, code: resolved.code });
          return;
        }

        const body = req.body as {
          action?: string;
          studentName?: string;
          gender?: string;
          className?: string;
          schoolName?: string;
          schoolYear?: string;
          semester?: string;
          lengthMode?: 'short' | 'standard' | 'detailed';
          schoolTemplate?: string;
          maxChars?: number;
          officialAcademic?: string;
          officialConduct?: string;
          evidenceItems?: string[];
          hasEnoughEvidence?: boolean;
          currentDraft?: string;
          recentOpenings?: string[];
          extraInstruction?: string;
        };

        const studentName = sanitizePedagogicalInput(body.studentName, 120);
        if (!studentName) {
          res.status(400).json({ error: 'Thiếu thông tin học sinh để soạn nhận xét học bạ.' });
          return;
        }

        const action =
          typeof body.action === 'string' && PEDAGOGICAL_ACTION_INSTRUCTIONS[body.action]
            ? body.action
            : 'generate';
        const lengthMode =
          body.lengthMode === 'short' || body.lengthMode === 'detailed'
            ? body.lengthMode
            : 'standard';
        const lengthGuide =
          lengthMode === 'short'
            ? '25–40 từ (ngắn gọn, súc tích)'
            : lengthMode === 'detailed'
              ? '65–90 từ (chi tiết, nêu rõ minh chứng và định hướng)'
              : '40–65 từ (tiêu chuẩn học bạ THPT)';
        const maxChars =
          typeof body.maxChars === 'number' && Number.isFinite(body.maxChars) && body.maxChars >= 80
            ? Math.min(Math.round(body.maxChars), 1500)
            : 0;
        const evidenceList = Array.isArray(body.evidenceItems)
          ? body.evidenceItems
              .slice(0, 15)
              .map((item) => sanitizePedagogicalInput(item, 400))
              .filter(Boolean)
          : [];
        const recentOpenings = Array.isArray(body.recentOpenings)
          ? body.recentOpenings
              .slice(0, 10)
              .map((item) => sanitizePedagogicalInput(item, 120))
              .filter(Boolean)
          : [];

        const userPrompt = [
          `YÊU CẦU THAO TÁC: ${PEDAGOGICAL_ACTION_INSTRUCTIONS[action]}`,
          `HỌC SINH: ${studentName} (${sanitizePedagogicalInput(body.gender, 20) || 'Chưa rõ giới tính'}) | Lớp ${sanitizePedagogicalInput(body.className, 30)} | Trường ${sanitizePedagogicalInput(body.schoolName, 100)} | Năm học ${sanitizePedagogicalInput(body.schoolYear, 30)} | Kỳ đánh giá: ${sanitizePedagogicalInput(body.semester, 30)}`,
          `XẾP LOẠI CHÍNH THỨC THÔNG TƯ 22 DO GVCN XÁC NHẬN: Học tập = ${sanitizePedagogicalInput(body.officialAcademic, 30) || 'Chưa xác nhận'}; Rèn luyện = ${sanitizePedagogicalInput(body.officialConduct, 30) || 'Chưa xác nhận'}.`,
          `CHẾ ĐỘ ĐỘ DÀI: ${lengthGuide}${maxChars ? ` (KHÔNG vượt quá ${maxChars} ký tự)` : ''}.`,
          body.schoolTemplate
            ? `MẪU / QUY ĐỊNH RIÊNG CỦA TRƯỜNG: ${sanitizePedagogicalInput(body.schoolTemplate, 350)}`
            : '',
          `MINH CHỨNG ĐÃ XÁC THỰC CỦA RIÊNG HỌC SINH NÀY (${evidenceList.length} mục):`,
          evidenceList.length > 0
            ? evidenceList.map((e, i) => `${i + 1}. ${e}`).join('\n')
            : '(Chưa có đủ minh chứng chi tiết — tuyệt đối không bịa đặt, chỉ nêu nhận định thận trọng ở mức cơ bản và nhắc GVCN bổ sung trong notesForTeacher.)',
          body.currentDraft && action !== 'generate'
            ? `BẢN NHÁP HIỆN TẠI ĐỂ ĐIỀU CHỈNH:\n"""${sanitizePedagogicalInput(body.currentDraft, 1600)}"""`
            : '',
          recentOpenings.length > 0
            ? `CÁC CÂU MỞ ĐẦU ĐÃ DÙNG CHO HỌC SINH KHÁC (TRÁNH LẶP NGUYÊN VĂN):\n- ${recentOpenings.join('\n- ')}`
            : '',
          body.extraInstruction
            ? `LƯU Ý BỔ SUNG CỦA GVCN: ${sanitizePedagogicalInput(body.extraInstruction, 400)}`
            : '',
        ]
          .filter(Boolean)
          .join('\n\n');

        const parsed = await generateJsonWithRetry<{ text?: string; notesForTeacher?: string }>(
          resolved.ai,
          {
            model: GEMINI_MODEL,
            contents: userPrompt,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              systemInstruction: REPORT_CARD_SYSTEM_INSTRUCTION,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  text: {
                    type: Type.STRING,
                    description:
                      'Đoạn nhận xét học bạ hoàn chỉnh bằng tiếng Việt, mở đầu bằng "Em...", không kèm tiêu đề hay giải thích.',
                  },
                  notesForTeacher: {
                    type: Type.STRING,
                    description:
                      'Ghi chú ngắn gọn cho riêng GVCN (ví dụ: điểm cần GVCN kiểm tra thêm hoặc xác nhận trước khi duyệt).',
                  },
                },
                required: ['text', 'notesForTeacher'],
              },
            },
          },
          (data) => Boolean(data && String(data.text || '').trim().length > 0)
        );

        res.json({
          text: String(parsed.text || '').trim(),
          notesForTeacher: String(parsed.notesForTeacher || '').trim(),
        });
      } catch (error) {
        const classified = classifyGeminiApiError(error, 'generate');
        console.error('Gemini pedagogical/report-card error:', classified.code, sanitizeForLog(error));
        res.status(classified.status).json({ error: classified.message, code: classified.code });
      }
    }
  );

  app.post(
    '/api/gemini/pedagogical/parent-message',
    requireApprovedTeacher,
    async (req: AuthenticatedRequest, res) => {
      try {
        const resolved = await resolveTeacherGeminiClient(req.authUser!);
        if (!resolved.ok) {
          res.status(resolved.status).json({ error: resolved.error, code: resolved.code });
          return;
        }

        const body = req.body as {
          action?: string;
          studentName?: string;
          recipientName?: string;
          teacherName?: string;
          className?: string;
          schoolName?: string;
          schoolYear?: string;
          semester?: string;
          purposeLabel?: string;
          purposeId?: string;
          salutation?: string;
          toneLabel?: string;
          incidentStatus?: 'none' | 'verified' | 'pending_verification';
          evidenceItems?: string[];
          pendingNote?: string;
          currentDraft?: string;
          extraInstruction?: string;
        };

        const studentName = sanitizePedagogicalInput(body.studentName, 120);
        if (!studentName) {
          res
            .status(400)
            .json({ error: 'Thiếu thông tin học sinh để soạn bản nháp tin nhắn phụ huynh.' });
          return;
        }

        const action =
          typeof body.action === 'string' && PEDAGOGICAL_ACTION_INSTRUCTIONS[body.action]
            ? body.action
            : 'generate';
        const incidentStatus =
          body.incidentStatus === 'verified' || body.incidentStatus === 'pending_verification'
            ? body.incidentStatus
            : 'none';
        const isUnverifiedGuard =
          incidentStatus === 'pending_verification' ||
          body.purposeId === 'xac_minh_thong_tin_chua_xac_nhan';

        const evidenceList = Array.isArray(body.evidenceItems)
          ? body.evidenceItems
              .slice(0, 15)
              .map((item) => sanitizePedagogicalInput(item, 400))
              .filter(Boolean)
          : [];

        const userPrompt = [
          `YÊU CẦU THAO TÁC: ${PEDAGOGICAL_ACTION_INSTRUCTIONS[action]}`,
          `MỤC ĐÍCH TIN NHẮN: ${sanitizePedagogicalInput(body.purposeLabel, 180)}`,
          `CÁCH XƯNG HÔ MỞ ĐẦU: ${sanitizePedagogicalInput(body.salutation, 160) || `Kính gửi quý phụ huynh em ${studentName}`}`,
          `GIỌNG ĐIỆU MONG MUỐN: ${sanitizePedagogicalInput(body.toneLabel, 80) || 'Trang trọng, phối hợp'}`,
          `NGƯỜI GỬI (GVCN): ${sanitizePedagogicalInput(body.teacherName, 100) || 'Giáo viên chủ nhiệm'} - Lớp ${sanitizePedagogicalInput(body.className, 30)} - ${sanitizePedagogicalInput(body.schoolName, 100)} (${sanitizePedagogicalInput(body.schoolYear, 30)}, ${sanitizePedagogicalInput(body.semester, 30)})`,
          body.recipientName
            ? `PHỤ HUYNH ĐƯỢC GỬI: ${sanitizePedagogicalInput(body.recipientName, 120)}`
            : '',
          `TRẠNG THÁI XÁC MINH SỰ VIỆC: ${
            isUnverifiedGuard
              ? 'CHƯA XÁC MINH (pending_verification) — BẮT BUỘC viết trung lập để hẹn trao đổi/tìm hiểu, TUYỆT ĐỐI KHÔNG khẳng định lỗi hay quy chụp học sinh.'
              : incidentStatus === 'verified'
                ? 'ĐÃ ĐƯỢC GVCN XÁC MINH — trình bày khách quan, tôn trọng, tập trung giải pháp giáo dục phối hợp.'
                : 'Thông tin thông thường đã xác thực.'
          }`,
          `MINH CHỨNG CỦA RIÊNG HỌC SINH ${studentName}:`,
          evidenceList.length > 0
            ? evidenceList.map((e, i) => `${i + 1}. ${e}`).join('\n')
            : '(Ít dữ liệu chi tiết — chỉ viết ngắn gọn, lịch sự, không bịa thêm sự việc hay điểm số.)',
          body.pendingNote
            ? `PHẢN ÁNH CHƯA XÁC MINH (CHỈ DÙNG ĐỂ ĐỀ NGHỊ TRAO ĐỔI TRUNG LẬP): ${sanitizePedagogicalInput(body.pendingNote, 400)}`
            : '',
          body.currentDraft && action !== 'generate'
            ? `BẢN NHÁP HIỆN TẠI ĐỂ ĐIỀU CHỈNH:\n"""${sanitizePedagogicalInput(body.currentDraft, 2200)}"""`
            : '',
          body.extraInstruction
            ? `LƯU Ý BỔ SUNG CỦA GVCN: ${sanitizePedagogicalInput(body.extraInstruction, 400)}`
            : '',
        ]
          .filter(Boolean)
          .join('\n\n');

        const parsed = await generateJsonWithRetry<{ text?: string; notesForTeacher?: string }>(
          resolved.ai,
          {
            model: GEMINI_MODEL,
            contents: userPrompt,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              systemInstruction: PARENT_MESSAGE_SYSTEM_INSTRUCTION,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  text: {
                    type: Type.STRING,
                    description:
                      'Bản nháp tin nhắn gửi phụ huynh hoàn chỉnh, tôn trọng, chân thành, sẵn sàng để GVCN xem xét và chỉnh sửa trước khi tự sao chép gửi.',
                  },
                  notesForTeacher: {
                    type: Type.STRING,
                    description:
                      'Lưu ý ngắn gọn dành riêng cho GVCN trước khi gửi (ví dụ: nhắc GVCN xác minh trực tiếp nếu có thông tin chưa xác nhận).',
                  },
                },
                required: ['text', 'notesForTeacher'],
              },
            },
          },
          (data) => Boolean(data && String(data.text || '').trim().length > 0)
        );

        res.json({
          text: String(parsed.text || '').trim(),
          notesForTeacher: String(parsed.notesForTeacher || '').trim(),
        });
      } catch (error) {
        const classified = classifyGeminiApiError(error, 'generate');
        console.error('Gemini pedagogical/parent-message error:', classified.code, sanitizeForLog(error));
        res.status(classified.status).json({ error: classified.message, code: classified.code });
      }
    }
  );

  // Explicit JSON 404 for any unmatched /api/* route (never fall through to HTML)
  app.all('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({
      error: 'Không tìm thấy đường dẫn API yêu cầu.',
      code: 'API_ROUTE_NOT_FOUND',
    });
  });

  return app;
}

const app = createApiApp();
export default app;
