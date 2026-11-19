import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type { OfficerDirectoryRecord, OfficerRoleId } from './types/gvcn';

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

/**
 * Tạo tài khoản Firebase Auth thật cho Cán bộ lớp bằng Secondary Auth App
 * để phiên đăng nhập Google của GVCN không bị đăng xuất.
 */
export async function provisionOfficerAuthCredential(
  authEmail: string,
  password: string
): Promise<string> {
  if (password.length < 8) {
    throw new Error('Mật khẩu cán bộ lớp phải có ít nhất 8 ký tự.');
  }

  const secondaryAppName = 'gvcn360-officer-provisioner';
  const existingApp = getApps().find((a) => a.name === secondaryAppName);
  const secondaryApp = existingApp || initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, authEmail, password);
    const uid = cred.user.uid;
    await firebaseSignOut(secondaryAuth);
    return uid;
  } catch (err) {
    await firebaseSignOut(secondaryAuth).catch(() => {});
    throw new Error(mapFirebaseAuthError(err));
  }
}

export async function signInOfficerWithNickname(nicknameRaw: string, password: string) {
  const normalized = normalizeOfficerNickname(nicknameRaw);
  if (normalized.length < 3) {
    throw new Error('Nickname không hợp lệ (cần tối thiểu 3 ký tự, ví dụ: 12d6.lt).');
  }
  if (!password) {
    throw new Error('Vui lòng nhập mật khẩu.');
  }

  const nickDocId = nicknameToDocId(normalized);
  const dirSnap = await getDoc(doc(db, 'officer_directory', nickDocId));
  if (!dirSnap.exists()) {
    throw new Error(`Không tìm thấy tài khoản cán bộ lớp "${normalized}". Vui lòng kiểm tra lại với GVCN.`);
  }

  const dirData = dirSnap.data() as OfficerDirectoryRecord;
  if (!dirData.active) {
    throw new Error(`Tài khoản "${normalized}" hiện đang bị khóa hoặc đã thu hồi quyền.`);
  }

  try {
    return await signInWithEmailAndPassword(auth, dirData.authEmail, password);
  } catch (err) {
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
