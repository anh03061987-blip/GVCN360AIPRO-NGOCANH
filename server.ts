import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth, type DecodedIdToken } from 'firebase-admin/auth';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const PRIMARY_ADMIN_EMAIL = 'anh03061987@gmail.com';

// Initialize Firebase Admin Auth ONLY for cryptographic ID token verification (requires zero IAM)
const adminApp = getApps().length
  ? getApp()
  : initializeApp({ projectId: firebaseConfig.projectId });
const adminAuth = getAdminAuth(adminApp);

interface AuthenticatedRequest extends Request {
  authUser?: {
    uid: string;
    email: string;
    emailVerified: boolean;
    isPrimaryAdmin: boolean;
    token: string;
    decoded: DecodedIdToken;
  };
}

app.use(express.json({ limit: '1mb' }));

// Prevent caching of any API response
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  next();
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
        error: 'Thiếu mã xác thực phiên đăng nhập.',
        code: 'UNAUTHENTICATED',
      });
      return;
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const email = (decoded.email || '').trim().toLowerCase();
    const emailVerified = decoded.email_verified === true;

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
    console.error('Auth verification failed:', error instanceof Error ? error.message : 'Invalid token');
    res.status(401).json({
      error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
      code: 'INVALID_TOKEN',
    });
  }
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// ============================================================================
// AUTH VERIFICATION ENDPOINT (Protected)
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

// ============================================================================
// CLASS OFFICER REAL AUTHENTICATION BACKEND (Zero IAM — Works on Starter & Blaze)
// ============================================================================
const OFFICER_AUTH_DOMAIN = 'officers.gvcn360.app';
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
app.get('/api/officer/auth-health', requireApprovedTeacher, async (_req: AuthenticatedRequest, res) => {
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
    console.error('Officer auth-health check error:', error);
    res.status(500).json({
      emailPasswordEnabled: false,
      rawStatus: 'CHECK_ERROR',
      projectId: firebaseConfig.projectId,
      consoleProvidersUrl: `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`,
    });
  }
});

// 2. Tạo tài khoản Firebase Auth thật cho Cán bộ lớp thông qua backend được bảo vệ (không ảnh hưởng phiên Google của GVCN)
app.post('/api/officer/provision', requireApprovedTeacher, async (req: AuthenticatedRequest, res) => {
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
        error: 'Nickname không hợp lệ (cần 3–60 ký tự chữ thường, số, dấu chấm hoặc gạch dưới).',
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
      if (errCode.includes('OPERATION_NOT_ALLOWED') || errCode.includes('PASSWORD_LOGIN_DISABLED')) {
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
          error: 'Mật khẩu chưa đủ mạnh theo tiêu chuẩn Firebase Authentication (tối thiểu 8 ký tự).',
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
    console.error('Officer provision error:', error);
    res.status(500).json({
      code: 'PROVISION_ERROR',
      error: error instanceof Error ? error.message : 'Lỗi máy chủ khi khởi tạo tài khoản cán bộ lớp.',
    });
  }
});

// 3. Xác thực Nickname + Mật khẩu Cán bộ lớp có chống dò mật khẩu và chẩn đoán chính xác nguyên nhân
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

    // Không tự kết luận sai mật khẩu nếu tài khoản chưa được GVCN tạo trên Firestore!
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

    // Xác thực mật khẩu trực tiếp qua Firebase Authentication
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
      error?: { message?: string };
    };

    if (!verifyResp.ok || !verifyJson.localId) {
      const errCode = String(verifyJson?.error?.message || '');
      if (errCode.includes('PASSWORD_LOGIN_DISABLED') || errCode.includes('OPERATION_NOT_ALLOWED')) {
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

    officerFailedLoginMap.delete(rateKey);
    res.json({
      ok: true,
      nickname: dirDoc.nickname,
      authEmail: dirDoc.authEmail,
      officerUid: verifyJson.localId,
    });
  } catch (error) {
    console.error('Officer login route error:', error);
    res.status(500).json({
      code: 'LOGIN_ERROR',
      error: error instanceof Error ? error.message : 'Lỗi máy chủ khi xác thực Cán bộ lớp.',
    });
  }
});

// ============================================================================
// SERVER-SIDE GEMINI API ROUTES (GVCN 360 AI PRO — Strictly Protected)
// ============================================================================
app.post('/api/gemini/analyze', requireApprovedTeacher, async (req: AuthenticatedRequest, res) => {
  try {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ. Vui lòng thiết lập khóa trong Settings > Secrets.',
      });
      return;
    }

    const { prompt } = req.body as { prompt?: string };
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Thiếu nội dung dữ liệu đầu vào để phân tích.' });
      return;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'Bạn là chuyên gia tư vấn sư phạm cho Giáo viên Chủ nhiệm THPT tại Việt Nam. Chỉ phân tích dựa trên dữ liệu đã xác nhận được cung cấp, tuyệt đối không bịa thêm số liệu và không tự ý kết luận xếp loại rèn luyện thay giáo viên.',
      },
    });

    res.json({ text: response.text || '' });
  } catch (error) {
    console.error('Gemini analyze error:', error);
    const message = error instanceof Error ? error.message : 'Lỗi khi gọi Gemini AI.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/gemini/subject-analyze', requireApprovedTeacher, async (req: AuthenticatedRequest, res) => {
  try {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ. Vui lòng thiết lập khóa trong Settings > Secrets.',
      });
      return;
    }

    const { prompt } = req.body as { prompt?: string };
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Thiếu dữ liệu bộ môn để phân tích.' });
      return;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'Bạn là trợ lý chuyên môn hỗ trợ giáo viên bộ môn THPT. Dựa trên bản đồ kiến thức, kết quả kiểm tra nhanh và sổ tay lỗi sai thực tế, hãy đề xuất phương án phụ đạo theo nhóm kỹ năng cụ thể, ngắn gọn, dễ áp dụng.',
      },
    });

    res.json({ text: response.text || '' });
  } catch (error) {
    console.error('Gemini subject-analyze error:', error);
    const message = error instanceof Error ? error.message : 'Lỗi khi gọi Gemini AI.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/gemini/parent-comm', requireApprovedTeacher, async (req: AuthenticatedRequest, res) => {
  try {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ. Vui lòng thiết lập khóa trong Settings > Secrets.',
      });
      return;
    }

    const { prompt } = req.body as { prompt?: string };
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Thiếu thông tin học sinh để soạn thảo.' });
      return;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
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
    });

    const raw = (response.text || '{}').trim();
    const parsed = JSON.parse(raw);
    res.json(parsed);
  } catch (error) {
    console.error('Gemini parent-comm error:', error);
    const message = error instanceof Error ? error.message : 'Lỗi khi gọi Gemini AI.';
    res.status(500).json({ error: message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GVCN 360 AI PRO server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
