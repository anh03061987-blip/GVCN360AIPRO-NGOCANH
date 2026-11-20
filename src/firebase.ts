import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type { OfficerRoleId } from './types/gvcn';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export const PRIMARY_ADMIN_EMAIL = 'anh03061987@gmail.com';
export const OFFICER_AUTH_DOMAIN = 'officers.gvcn360.app';

export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function signInWithGoogle() {
  googleProvider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(auth, googleProvider);
}

export async function signOutUser() {
  return firebaseSignOut(auth);
}

export async function getAuthBearerHeaders(): Promise<Record<string, string>> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }
  const idToken = await currentUser.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${idToken}`,
  };
}

// ============================================================================
// CLASS OFFICER REAL AUTHENTICATION HELPERS (Firebase Email/Password Auth)
// ============================================================================
export function normalizeOfficerNickname(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._-]/g, '');
}

export function nicknameToDocId(nickname: string): string {
  const normalized = normalizeOfficerNickname(nickname);
  return normalized
    .replace(/\./g, '__dot__')
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 120);
}

export function buildOfficerAuthEmail(nicknameId: string, credentialVersion: number): string {
  const safeId = nicknameId.replace(/[^a-z0-9_-]/g, '_');
  if (credentialVersion <= 1) {
    return `${safeId}@${OFFICER_AUTH_DOMAIN}`;
  }
  return `${safeId}.v${credentialVersion}@${OFFICER_AUTH_DOMAIN}`;
}

export function isOfficerAuthEmail(email?: string | null): boolean {
  return Boolean(email && email.toLowerCase().endsWith(`@${OFFICER_AUTH_DOMAIN}`));
}

export function getTeamFromOfficerRoles(roles: OfficerRoleId[]): number {
  for (const r of roles) {
    if (r === 'to_truong_1') return 1;
    if (r === 'to_truong_2') return 2;
    if (r === 'to_truong_3') return 3;
    if (r === 'to_truong_4') return 4;
  }
  return 0;
}

export function generateStrongOfficerPassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '@#$%&*!';
  const all = upper + lower + digits + symbols;
  const bytes = new Uint32Array(length);
  window.crypto.getRandomValues(bytes);

  const chars = [
    upper[bytes[0] % upper.length],
    lower[bytes[1] % lower.length],
    digits[bytes[2] % digits.length],
    symbols[bytes[3] % symbols.length],
  ];
  for (let i = 4; i < length; i++) {
    chars.push(all[bytes[i] % all.length]);
  }
  // Fisher-Yates shuffle using crypto random
  const shuffleBytes = new Uint32Array(chars.length);
  window.crypto.getRandomValues(shuffleBytes);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffleBytes[i] % (i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  return chars.join('');
}

function mapFirebaseAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';

  if (code === 'auth/operation-not-allowed') {
    return 'Phương thức đăng nhập Email/Password chưa được bật trên Firebase Console. Vui lòng vào Firebase Console → Authentication → Sign-in method → bật Email/Password rồi thử lại.';
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return 'Nickname hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại hoặc liên hệ GVCN.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'Định danh đăng nhập này đã tồn tại trên Firebase Auth. Hãy tăng phiên bản mật khẩu hoặc chọn nickname khác.';
  }
  if (code === 'auth/weak-password') {
    return 'Mật khẩu quá yếu. Vui lòng sử dụng mật khẩu có ít nhất 8 ký tự gồm chữ và số.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Tài khoản tạm thời bị giới hạn do nhập sai nhiều lần. Vui lòng thử lại sau ít phút.';
  }
  if (code === 'auth/requires-recent-login') {
    return 'Phiên đăng nhập đã cũ. Vui lòng nhập mật khẩu hiện tại hoặc đăng nhập lại để đổi mật khẩu.';
  }
  return err instanceof Error ? err.message : 'Lỗi xác thực Firebase Authentication.';
}

export interface OfficerAuthHealthStatus {
  emailPasswordEnabled: boolean;
  rawStatus: string;
  projectId: string;
  consoleProvidersUrl: string;
}

const CLIENT_RATE_LIMIT_MAX = 5;
const CLIENT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

function getClientRateLimitKey(normalizedNickname: string): string {
  return `gvcn360_officer_rl_${normalizedNickname}`;
}

function readClientRateLimit(normalizedNickname: string): { count: number; lockedUntilMs: number } {
  try {
    const raw = window.sessionStorage.getItem(getClientRateLimitKey(normalizedNickname));
    if (!raw) return { count: 0, lockedUntilMs: 0 };
    const parsed = JSON.parse(raw) as { count?: number; lockedUntilMs?: number };
    return {
      count: Number(parsed.count) || 0,
      lockedUntilMs: Number(parsed.lockedUntilMs) || 0,
    };
  } catch {
    return { count: 0, lockedUntilMs: 0 };
  }
}

function writeClientRateLimit(
  normalizedNickname: string,
  state: { count: number; lockedUntilMs: number } | null
): void {
  try {
    const key = getClientRateLimitKey(normalizedNickname);
    if (!state) {
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, JSON.stringify(state));
    }
  } catch {
    // Ignore storage quota errors
  }
}

function isJsonResponse(resp: Response): boolean {
  const ct = (resp.headers.get('content-type') || '').toLowerCase();
  return ct.includes('application/json');
}

async function probeEmailPasswordDirect(): Promise<OfficerAuthHealthStatus> {
  const consoleProvidersUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`;
  try {
    const probeResp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
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
    return {
      emailPasswordEnabled,
      rawStatus: emailPasswordEnabled ? 'ENABLED' : errMsg || 'PASSWORD_LOGIN_DISABLED',
      projectId: firebaseConfig.projectId,
      consoleProvidersUrl,
    };
  } catch {
    return {
      emailPasswordEnabled: false,
      rawStatus: 'CHECK_ERROR',
      projectId: firebaseConfig.projectId,
      consoleProvidersUrl,
    };
  }
}

export async function checkOfficerAuthHealth(): Promise<OfficerAuthHealthStatus> {
  try {
    const headers = await getAuthBearerHeaders();
    const resp = await fetch('/api/officer/auth-health', {
      method: 'GET',
      headers,
    });
    if (isJsonResponse(resp)) {
      const data = (await resp.json().catch(() => ({}))) as Partial<OfficerAuthHealthStatus>;
      if (typeof data.emailPasswordEnabled === 'boolean') {
        return {
          emailPasswordEnabled: data.emailPasswordEnabled,
          rawStatus: data.rawStatus || (resp.ok ? 'ENABLED' : `HTTP_${resp.status}`),
          projectId: data.projectId || firebaseConfig.projectId,
          consoleProvidersUrl:
            data.consoleProvidersUrl ||
            `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`,
        };
      }
    }
  } catch {
    // Fallback below when static hosting does not expose /api/officer/auth-health
  }
  return probeEmailPasswordDirect();
}

/**
 * Tạo tài khoản Firebase Auth thật cho Cán bộ lớp thông qua backend được bảo vệ (/api/officer/provision).
 * Nếu ứng dụng chạy trên bản triển khai tĩnh không định tuyến /api/officer/provision (non-JSON 404),
 * tự động gọi Firebase Identity Toolkit REST (accounts:signUp) — vẫn tuyệt đối không ảnh hưởng phiên Google của GVCN.
 */
export async function provisionOfficerAuthCredential(
  nickname: string,
  password: string,
  options?: { mode?: 'create' | 'reset'; credentialVersion?: number }
): Promise<{ officerUid: string; authEmail: string; nickname: string; nicknameId: string }> {
  if (password.length < 8) {
    throw new Error('Mật khẩu cán bộ lớp phải có ít nhất 8 ký tự.');
  }

  const normalized = normalizeOfficerNickname(nickname);
  const nicknameId = nicknameToDocId(normalized);
  const version = Math.max(1, Math.min(100, Math.floor(Number(options?.credentialVersion) || 1)));

  let shouldFallbackToRest = false;

  try {
    const headers = await getAuthBearerHeaders();
    const resp = await fetch('/api/officer/provision', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        nickname: normalized,
        password,
        mode: options?.mode || 'create',
        credentialVersion: version,
      }),
    });

    if (isJsonResponse(resp)) {
      const data = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        officerUid?: string;
        authEmail?: string;
        nickname?: string;
        nicknameId?: string;
        error?: string;
      };

      if (!resp.ok || !data.ok || !data.officerUid || !data.authEmail) {
        throw new Error(data.error || `Không thể tạo tài khoản cán bộ lớp (HTTP ${resp.status}).`);
      }

      return {
        officerUid: data.officerUid,
        authEmail: data.authEmail,
        nickname: data.nickname || normalized,
        nicknameId: data.nicknameId || nicknameId,
      };
    }

    if (resp.status === 404 || resp.status === 405 || resp.status === 502 || resp.status === 503) {
      shouldFallbackToRest = true;
    } else {
      throw new Error(`Không thể tạo tài khoản cán bộ lớp (HTTP ${resp.status}).`);
    }
  } catch (err) {
    if (err instanceof TypeError) {
      shouldFallbackToRest = true;
    } else if (!shouldFallbackToRest) {
      throw err;
    }
  }

  // Fallback REST thuần tới Firebase Identity Toolkit (không dùng createUserWithEmailAndPassword của SDK nên không đụng phiên Google của GVCN)
  const authEmail = buildOfficerAuthEmail(nicknameId, version);
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
      throw new Error(
        'Phương thức đăng nhập Email/Password chưa được bật trên Firebase Console. Vui lòng vào Firebase Console → Authentication → Sign-in method → bật Email/Password rồi bấm Save.'
      );
    }
    if (errCode.includes('EMAIL_EXISTS')) {
      throw new Error(
        `Định danh xác thực cho "${normalized}" (v${version}) đã tồn tại trên Firebase Auth. Hãy tăng phiên bản hoặc chọn nickname khác.`
      );
    }
    if (errCode.includes('WEAK_PASSWORD')) {
      throw new Error('Mật khẩu chưa đủ mạnh theo tiêu chuẩn Firebase Authentication (tối thiểu 8 ký tự).');
    }
    throw new Error(`Không thể tạo tài khoản Firebase Auth (${errCode || `HTTP ${signUpResp.status}`}).`);
  }

  return {
    officerUid: signUpJson.localId,
    authEmail,
    nickname: normalized,
    nicknameId,
  };
}

export async function signInOfficerWithNickname(nicknameRaw: string, password: string) {
  const normalized = normalizeOfficerNickname(nicknameRaw);
  if (normalized.length < 3) {
    throw new Error('Nickname không hợp lệ (cần tối thiểu 3 ký tự, ví dụ: 12d6.lt).');
  }
  if (!password) {
    throw new Error('Vui lòng nhập mật khẩu.');
  }

  let resolvedAuthEmail: string | null = null;
  let shouldFallbackDirect = false;

  // 1. Ưu tiên xác thực qua backend /api/officer/login (có chống brute-force phía máy chủ)
  try {
    const resp = await fetch('/api/officer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: normalized, password }),
    });

    if (isJsonResponse(resp)) {
      const data = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        authEmail?: string;
        code?: string;
        error?: string;
      };

      if (resp.ok && data.ok && data.authEmail) {
        resolvedAuthEmail = data.authEmail;
      } else if (data.error || data.code) {
        throw new Error(
          data.error || `Không thể xác thực tài khoản cán bộ lớp "${normalized}" (HTTP ${resp.status}).`
        );
      } else {
        shouldFallbackDirect = true;
      }
    } else if (
      resp.status === 404 ||
      resp.status === 405 ||
      resp.status === 502 ||
      resp.status === 503
    ) {
      // Môi trường triển khai tĩnh / bản chia sẻ không định tuyến Express POST /api/officer/login
      shouldFallbackDirect = true;
    } else {
      throw new Error(`Không thể xác thực tài khoản cán bộ lớp "${normalized}" (HTTP ${resp.status}).`);
    }
  } catch (err) {
    if (err instanceof TypeError) {
      shouldFallbackDirect = true;
    } else if (!shouldFallbackDirect) {
      throw err;
    }
  }

  // 2. Fallback an toàn: tra cứu trực tiếp 1 bản ghi officer_directory/{nicknameId} trên Firestore + xác thực thật bằng Firebase Auth
  if (shouldFallbackDirect || !resolvedAuthEmail) {
    const now = Date.now();
    const rateState = readClientRateLimit(normalized);
    if (rateState.lockedUntilMs > now) {
      const minutesLeft = Math.max(1, Math.ceil((rateState.lockedUntilMs - now) / 60000));
      throw new Error(
        `Bạn đã nhập sai mật khẩu quá ${CLIENT_RATE_LIMIT_MAX} lần. Vui lòng thử lại sau ${minutesLeft} phút hoặc nhờ GVCN đặt lại mật khẩu.`
      );
    }

    const nicknameId = nicknameToDocId(normalized);
    const dirSnap = await getDocFromServer(doc(db, 'officer_directory', nicknameId));
    if (!dirSnap.exists()) {
      throw new Error(
        `Tài khoản cán bộ lớp "${normalized}" chưa được tạo trên hệ thống. Vui lòng nhờ GVCN đăng nhập Google vào mục "Hệ thống → Phân quyền 8 vị trí → Quản lý tài khoản Cán bộ lớp" để cấp tài khoản chính thức.`
      );
    }

    const dirData = dirSnap.data() as { active?: boolean; authEmail?: string };
    if (dirData.active !== true || !dirData.authEmail) {
      throw new Error(
        `Tài khoản cán bộ lớp "${normalized}" hiện đang bị khóa hoặc đã được GVCN thu hồi quyền.`
      );
    }

    resolvedAuthEmail = dirData.authEmail;
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, resolvedAuthEmail, password);
    writeClientRateLimit(normalized, null);
    return cred;
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code || '')
        : '';
    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/user-not-found'
    ) {
      const now = Date.now();
      const prev = readClientRateLimit(normalized);
      const nextCount = (prev.lockedUntilMs <= now ? prev.count : 0) + 1;
      if (nextCount >= CLIENT_RATE_LIMIT_MAX) {
        writeClientRateLimit(normalized, {
          count: nextCount,
          lockedUntilMs: now + CLIENT_RATE_LIMIT_WINDOW_MS,
        });
        throw new Error(
          `Bạn đã nhập sai mật khẩu ${CLIENT_RATE_LIMIT_MAX} lần liên tiếp. Tài khoản tạm khóa đăng nhập 15 phút để bảo mật.`
        );
      }
      writeClientRateLimit(normalized, { count: nextCount, lockedUntilMs: 0 });
      const remaining = CLIENT_RATE_LIMIT_MAX - nextCount;
      throw new Error(
        `Mật khẩu của tài khoản "${normalized}" chưa chính xác (còn ${remaining} lần thử). Nếu quên mật khẩu, hãy nhờ GVCN đặt lại.`
      );
    }
    throw new Error(mapFirebaseAuthError(err));
  }
}

export async function changeCurrentOfficerPassword(
  newPassword: string,
  currentPassword?: string
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.email) {
    throw new Error('Không tìm thấy phiên đăng nhập Cán bộ lớp.');
  }
  if (newPassword.length < 8) {
    throw new Error('Mật khẩu mới phải có ít nhất 8 ký tự.');
  }

  try {
    if (currentPassword) {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
    }
    await updatePassword(currentUser, newPassword);
  } catch (err) {
    throw new Error(mapFirebaseAuthError(err));
  }
}
