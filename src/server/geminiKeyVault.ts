import crypto from 'node:crypto';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

export const GEMINI_MODEL = 'gemini-4-hydrogen';
export const VAULT_PROVIDER = 'gemini';
export const VAULT_DOC_ID = 'gemini';
export const VAULT_ALGORITHM = 'aes-256-gcm';

export interface EncryptedApiKeyEnvelope {
  ownerUid: string;
  provider: 'gemini';
  alg: 'aes-256-gcm';
  keyVersion: 'v1-env' | 'v1-fallback';
  saltB64: string;
  ivB64: string;
  authTagB64: string;
  ciphertextB64: string;
  maskedHint: string;
  status: 'connected';
  lastVerifiedAtMs: number;
  updatedAtMs: number;
}

export interface StoredVaultRecord extends EncryptedApiKeyEnvelope {
  createdAtTimestamp?: string;
}

export interface PublicGeminiKeyStatus {
  connected: boolean;
  status: 'connected' | 'not_connected' | 'needs_reconnect';
  maskedHint: string;
  lastVerifiedAtMs: number | null;
  updatedAtMs: number | null;
  usingDedicatedVaultSecret: boolean;
  encryptionKeyVersion: 'v1-env' | 'v1-fallback' | null;
  isProduction: boolean;
  message?: string;
}

const MIN_SECRET_LENGTH = 16;

export function isProductionRuntime(): boolean {
  return (process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
}

export function isUsingDedicatedVaultSecret(): boolean {
  const secret = (process.env.API_KEY_ENCRYPTION_SECRET || '').trim();
  return secret.length >= MIN_SECRET_LENGTH;
}

function getFallbackMasterKeyMaterial(): Buffer {
  const seed = [
    'gvcn360-ai-pro',
    'teacher-personal-gemini-vault',
    firebaseConfig.projectId || 'default-project',
    firebaseConfig.firestoreDatabaseId || '(default)',
    'v1-fallback',
  ].join('::');
  return crypto.createHash('sha256').update(seed, 'utf8').digest();
}

function getMasterKeyForVersion(
  version: 'v1-env' | 'v1-fallback',
  options?: { allowFallbackInProd?: boolean }
): Buffer {
  if (version === 'v1-env') {
    const secret = (process.env.API_KEY_ENCRYPTION_SECRET || '').trim();
    if (secret.length < MIN_SECRET_LENGTH) {
      throw new Error(
        'Khóa mã hóa máy chủ (API_KEY_ENCRYPTION_SECRET) hiện chưa được cấu hình hoặc đã bị gỡ. Vui lòng thiết lập lại API_KEY_ENCRYPTION_SECRET hoặc kết nối lại Gemini API key cá nhân.'
      );
    }
    return crypto.createHash('sha256').update(secret, 'utf8').digest();
  }
  if (isProductionRuntime() && !options?.allowFallbackInProd) {
    throw new Error(
      'Môi trường vận hành chính thức (production) không cho phép sử dụng khóa mã hóa dự phòng v1-fallback. Vui lòng thiết lập API_KEY_ENCRYPTION_SECRET trong Settings > Secrets.'
    );
  }
  return getFallbackMasterKeyMaterial();
}

function deriveTeacherDek(
  masterKey: Buffer,
  uid: string,
  salt: Buffer,
  keyVersion: 'v1-env' | 'v1-fallback'
): Buffer {
  const info = Buffer.from(`gvcn360-vault:${keyVersion}:${uid}:${VAULT_PROVIDER}`, 'utf8');
  return Buffer.from(crypto.hkdfSync('sha256', masterKey, salt, info, 32));
}

function buildVaultAad(uid: string): Buffer {
  return Buffer.from(`gvcn360-vault:${uid}:${VAULT_PROVIDER}`, 'utf8');
}

export function validatePersonalGeminiApiKeyFormat(rawKey: unknown): {
  valid: boolean;
  cleaned: string;
  error?: string;
} {
  if (typeof rawKey !== 'string') {
    return { valid: false, cleaned: '', error: 'Vui lòng nhập Gemini API key cá nhân.' };
  }
  const cleaned = rawKey.trim();
  if (!cleaned) {
    return { valid: false, cleaned: '', error: 'Gemini API key không được để trống.' };
  }
  if (cleaned.length < 20 || cleaned.length > 200) {
    return {
      valid: false,
      cleaned: '',
      error: 'Định dạng Gemini API key không hợp lệ (độ dài phải từ 20 đến 200 ký tự).',
    };
  }
  if (/[\s\r\n\t]/.test(cleaned) || !/^[\x21-\x7E]+$/.test(cleaned)) {
    return {
      valid: false,
      cleaned: '',
      error: 'Gemini API key không được chứa khoảng trắng hoặc ký tự đặc biệt ngoài bảng ASCII.',
    };
  }
  return { valid: true, cleaned };
}

export function maskApiKeyHint(rawKey: string): string {
  const cleaned = rawKey.trim();
  if (cleaned.length <= 8) {
    return `••••${cleaned.slice(-4)}`;
  }
  return `${cleaned.slice(0, 4)}••••••${cleaned.slice(-4)}`;
}

export function encryptPersonalApiKey(
  uid: string,
  rawApiKey: string,
  nowMs = Date.now()
): EncryptedApiKeyEnvelope {
  if (!uid || !uid.trim()) {
    throw new Error('Thiếu mã định danh giáo viên (UID) để mã hóa API key.');
  }
  const formatCheck = validatePersonalGeminiApiKeyFormat(rawApiKey);
  if (!formatCheck.valid) {
    throw new Error(formatCheck.error || 'Gemini API key không hợp lệ.');
  }

  const hasDedicatedSecret = isUsingDedicatedVaultSecret();
  if (!hasDedicatedSecret && isProductionRuntime()) {
    throw new Error(
      'Môi trường vận hành chính thức (production) bắt buộc cấu hình biến bí mật API_KEY_ENCRYPTION_SECRET (tối thiểu 16 ký tự, khuyến nghị ≥ 32 ký tự) trong Settings > Secrets trước khi lưu API key cá nhân.'
    );
  }

  const keyVersion: 'v1-env' | 'v1-fallback' = hasDedicatedSecret ? 'v1-env' : 'v1-fallback';
  const masterKey = getMasterKeyForVersion(keyVersion);
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const dek = deriveTeacherDek(masterKey, uid, salt, keyVersion);
  const aad = buildVaultAad(uid);

  const cipher = crypto.createCipheriv(VAULT_ALGORITHM, dek, iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(formatCheck.cleaned, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ownerUid: uid,
    provider: VAULT_PROVIDER,
    alg: VAULT_ALGORITHM,
    keyVersion,
    saltB64: salt.toString('base64'),
    ivB64: iv.toString('base64'),
    authTagB64: authTag.toString('base64'),
    ciphertextB64: ciphertext.toString('base64'),
    maskedHint: maskApiKeyHint(formatCheck.cleaned),
    status: 'connected',
    lastVerifiedAtMs: nowMs,
    updatedAtMs: nowMs,
  };
}

export function decryptPersonalApiKey(
  uid: string,
  envelope: EncryptedApiKeyEnvelope,
  options?: { allowFallbackInProd?: boolean }
): string {
  if (!uid || envelope.ownerUid !== uid) {
    throw new Error('Không được phép giải mã khóa của tài khoản giáo viên khác.');
  }
  if (envelope.alg !== VAULT_ALGORITHM || envelope.provider !== VAULT_PROVIDER) {
    throw new Error('Cấu trúc bản ghi khóa mã hóa không hợp lệ.');
  }
  const keyVersion = envelope.keyVersion === 'v1-env' ? 'v1-env' : 'v1-fallback';
  const masterKey = getMasterKeyForVersion(keyVersion, options);
  const salt = Buffer.from(envelope.saltB64, 'base64');
  const iv = Buffer.from(envelope.ivB64, 'base64');
  const authTag = Buffer.from(envelope.authTagB64, 'base64');
  const ciphertext = Buffer.from(envelope.ciphertextB64, 'base64');
  const dek = deriveTeacherDek(masterKey, uid, salt, keyVersion);
  const aad = buildVaultAad(uid);

  const decipher = crypto.createDecipheriv(VAULT_ALGORITHM, dek, iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  if (!plaintext) {
    throw new Error('Khóa giải mã rỗng. Vui lòng kết nối lại Gemini API key cá nhân.');
  }
  return plaintext;
}

export function createGeminiClientWithPersonalKey(personalApiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: personalApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function classifyGeminiApiError(error: unknown): {
  status: number;
  code: string;
  message: string;
} {
  const rawMessage = error instanceof Error ? error.message : String(error || '');
  const lower = rawMessage.toLowerCase();

  if (
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('invalid api key') ||
    lower.includes('unauthenticated') ||
    lower.includes('401')
  ) {
    return {
      status: 400,
      code: 'GEMINI_KEY_INVALID',
      message:
        'Gemini API key không hợp lệ hoặc đã bị thu hồi trên Google AI Studio. Vui lòng kiểm tra lại hoặc tạo khóa mới.',
    };
  }

  if (
    lower.includes('permission_denied') ||
    lower.includes('permission denied') ||
    lower.includes('403') ||
    lower.includes('forbidden')
  ) {
    return {
      status: 403,
      code: 'GEMINI_KEY_FORBIDDEN',
      message:
        'Gemini API key không có quyền truy cập mô hình Gemini API. Vui lòng kiểm tra dự án Google AI Studio của bạn.',
    };
  }

  if (
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('429')
  ) {
    return {
      status: 429,
      code: 'GEMINI_QUOTA_EXCEEDED',
      message:
        'Gemini API key cá nhân của bạn đã vượt hạn mức lượt gọi tạm thời hoặc hết quota trên Google AI Studio. Vui lòng thử lại sau hoặc đổi API key.',
    };
  }

  return {
    status: 502,
    code: 'GEMINI_UPSTREAM_ERROR',
    message:
      'Không thể kết nối tới dịch vụ Gemini API bằng khóa cá nhân lúc này. Vui lòng thử lại sau ít phút.',
  };
}

export async function verifyPersonalGeminiApiKeyLive(
  personalApiKey: string
): Promise<{ valid: boolean; status: number; code: string; message: string }> {
  const formatCheck = validatePersonalGeminiApiKeyFormat(personalApiKey);
  if (!formatCheck.valid) {
    return {
      valid: false,
      status: 400,
      code: 'INVALID_KEY_FORMAT',
      message: formatCheck.error || 'Gemini API key không đúng định dạng.',
    };
  }

  try {
    const ai = createGeminiClientWithPersonalKey(formatCheck.cleaned);
    await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: 'Trả lời đúng 1 từ: OK',
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        maxOutputTokens: 8,
      },
    });
    return {
      valid: true,
      status: 200,
      code: 'OK',
      message: 'Kết nối Gemini API cá nhân thành công! Khóa hợp lệ và sẵn sàng sử dụng.',
    };
  } catch (error) {
    const classified = classifyGeminiApiError(error);
    return {
      valid: false,
      status: classified.status,
      code: classified.code,
      message: classified.message,
    };
  }
}

// ============================================================================
// FIRESTORE REST HELPERS (Strictly scoped to users/{uid}/ai_key_vault/gemini)
// ============================================================================
function getFirestoreDbResourceRoot(): string {
  const projectId = encodeURIComponent(firebaseConfig.projectId);
  const dbId = encodeURIComponent(firebaseConfig.firestoreDatabaseId || '(default)');
  return `projects/${projectId}/databases/${dbId}`;
}

function getVaultDocumentUrl(uid: string): string {
  const safeUid = encodeURIComponent(uid);
  return `https://firestore.googleapis.com/v1/${getFirestoreDbResourceRoot()}/documents/users/${safeUid}/ai_key_vault/${VAULT_DOC_ID}`;
}

function getVaultDocumentName(uid: string): string {
  const projectId = firebaseConfig.projectId;
  const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
  return `projects/${projectId}/databases/${dbId}/documents/users/${uid}/ai_key_vault/${VAULT_DOC_ID}`;
}

interface FirestoreRestDoc {
  name?: string;
  fields?: Record<
    string,
    {
      stringValue?: string;
      integerValue?: string;
      doubleValue?: number;
      timestampValue?: string;
    }
  >;
}

function parseVaultFirestoreDoc(doc: FirestoreRestDoc): StoredVaultRecord | null {
  const f = doc.fields;
  if (!f) return null;
  const ownerUid = f.ownerUid?.stringValue || '';
  const provider = f.provider?.stringValue;
  const alg = f.alg?.stringValue;
  const keyVersion = f.keyVersion?.stringValue;
  const saltB64 = f.saltB64?.stringValue || '';
  const ivB64 = f.ivB64?.stringValue || '';
  const authTagB64 = f.authTagB64?.stringValue || '';
  const ciphertextB64 = f.ciphertextB64?.stringValue || '';
  const maskedHint = f.maskedHint?.stringValue || '';
  const lastVerifiedAtMs = Number(
    f.lastVerifiedAtMs?.integerValue ?? f.lastVerifiedAtMs?.doubleValue ?? 0
  );
  const updatedAtMs = Number(f.updatedAtMs?.integerValue ?? f.updatedAtMs?.doubleValue ?? 0);

  if (
    !ownerUid ||
    provider !== VAULT_PROVIDER ||
    alg !== VAULT_ALGORITHM ||
    (keyVersion !== 'v1-env' && keyVersion !== 'v1-fallback') ||
    !saltB64 ||
    !ivB64 ||
    !authTagB64 ||
    !ciphertextB64
  ) {
    return null;
  }

  return {
    ownerUid,
    provider: VAULT_PROVIDER,
    alg: VAULT_ALGORITHM,
    keyVersion,
    saltB64,
    ivB64,
    authTagB64,
    ciphertextB64,
    maskedHint,
    status: 'connected',
    lastVerifiedAtMs: Number.isFinite(lastVerifiedAtMs) ? lastVerifiedAtMs : 0,
    updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : 0,
    createdAtTimestamp: f.createdAt?.timestampValue,
  };
}

export async function getTeacherVaultDocRest(
  uid: string,
  idToken: string
): Promise<StoredVaultRecord | null> {
  const resp = await fetch(getVaultDocumentUrl(uid), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
      Accept: 'application/json',
    },
  });

  if (resp.status === 404) {
    return null;
  }
  if (!resp.ok) {
    throw new Error(`Không thể đọc trạng thái kho khóa bảo mật (HTTP ${resp.status}).`);
  }

  const data = (await resp.json()) as FirestoreRestDoc;
  return parseVaultFirestoreDoc(data);
}

export async function upsertTeacherVaultDocRest(
  uid: string,
  idToken: string,
  envelope: EncryptedApiKeyEnvelope
): Promise<void> {
  const existing = await getTeacherVaultDocRest(uid, idToken);
  const commitUrl = `https://firestore.googleapis.com/v1/${getFirestoreDbResourceRoot()}/documents:commit`;

  const fields: Record<string, unknown> = {
    ownerUid: { stringValue: envelope.ownerUid },
    provider: { stringValue: envelope.provider },
    alg: { stringValue: envelope.alg },
    keyVersion: { stringValue: envelope.keyVersion },
    saltB64: { stringValue: envelope.saltB64 },
    ivB64: { stringValue: envelope.ivB64 },
    authTagB64: { stringValue: envelope.authTagB64 },
    ciphertextB64: { stringValue: envelope.ciphertextB64 },
    maskedHint: { stringValue: envelope.maskedHint },
    status: { stringValue: envelope.status },
    lastVerifiedAtMs: { integerValue: String(Math.round(envelope.lastVerifiedAtMs)) },
    updatedAtMs: { integerValue: String(Math.round(envelope.updatedAtMs)) },
  };

  const updateTransforms: Array<{ fieldPath: string; setToServerValue: 'REQUEST_TIME' }> = [];

  if (existing?.createdAtTimestamp) {
    fields.createdAt = { timestampValue: existing.createdAtTimestamp };
    updateTransforms.push({ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' });
  } else {
    updateTransforms.push(
      { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
      { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }
    );
  }

  const writePayload = {
    writes: [
      {
        update: {
          name: getVaultDocumentName(uid),
          fields,
        },
        updateTransforms,
        currentDocument: { exists: Boolean(existing) },
      },
    ],
  };

  const resp = await fetch(commitUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(writePayload),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(
      `Không thể lưu khóa mã hóa vào kho bảo mật (HTTP ${resp.status})${errText ? ': ' + errText.slice(0, 160) : ''}`
    );
  }
}

export async function deleteTeacherVaultDocRest(uid: string, idToken: string): Promise<void> {
  const resp = await fetch(getVaultDocumentUrl(uid), {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${idToken}`,
      Accept: 'application/json',
    },
  });

  if (resp.status === 404 || resp.ok) {
    return;
  }
  throw new Error(`Không thể xóa kết nối Gemini API key khỏi kho bảo mật (HTTP ${resp.status}).`);
}

export async function resolveAndMigrateTeacherApiKey(
  uid: string,
  idToken: string,
  record: StoredVaultRecord
): Promise<{
  apiKey: string;
  record: StoredVaultRecord;
  migrated: boolean;
}> {
  const hasDedicatedSecret = isUsingDedicatedVaultSecret();
  const inProduction = isProductionRuntime();

  if (record.keyVersion === 'v1-fallback') {
    if (!hasDedicatedSecret) {
      if (inProduction) {
        throw new Error(
          'Môi trường vận hành chính thức (production) không cho phép giải mã bằng khóa dự phòng v1-fallback. Vui lòng thiết lập API_KEY_ENCRYPTION_SECRET trong Settings > Secrets; bản ghi khóa cũ vẫn được giữ nguyên an toàn.'
        );
      }
      const apiKey = decryptPersonalApiKey(uid, record);
      return { apiKey, record, migrated: false };
    }

    // API_KEY_ENCRYPTION_SECRET đã được cấu hình: giải mã khóa cũ (vẫn kiểm tra chặt ownerUid, AAD, authTag)
    // rồi tái mã hóa bằng v1-env và lưu lại an toàn mà không làm mất khóa đã kết nối của giáo viên.
    const plaintext = decryptPersonalApiKey(uid, record, { allowFallbackInProd: true });
    const nowMs = Date.now();
    const upgradedEnvelope: EncryptedApiKeyEnvelope = {
      ...encryptPersonalApiKey(uid, plaintext, nowMs),
      lastVerifiedAtMs: record.lastVerifiedAtMs || nowMs,
      updatedAtMs: nowMs,
    };

    try {
      await upsertTeacherVaultDocRest(uid, idToken, upgradedEnvelope);
      return {
        apiKey: plaintext,
        record: {
          ...upgradedEnvelope,
          createdAtTimestamp: record.createdAtTimestamp,
        },
        migrated: true,
      };
    } catch {
      if (inProduction) {
        throw new Error(
          'Không thể nâng cấp bản ghi khóa mã hóa sang chuẩn bảo mật API_KEY_ENCRYPTION_SECRET. Bản ghi cũ vẫn được giữ nguyên; vui lòng thử lại hoặc kết nối lại Gemini API key cá nhân.'
        );
      }
      return { apiKey: plaintext, record, migrated: false };
    }
  }

  const apiKey = decryptPersonalApiKey(uid, record);
  return { apiKey, record, migrated: false };
}

export function buildPublicVaultStatus(record: StoredVaultRecord | null, uid: string): PublicGeminiKeyStatus {
  const usingDedicatedVaultSecret = isUsingDedicatedVaultSecret();
  const isProduction = isProductionRuntime();
  if (!record) {
    return {
      connected: false,
      status: 'not_connected',
      maskedHint: '',
      lastVerifiedAtMs: null,
      updatedAtMs: null,
      usingDedicatedVaultSecret,
      encryptionKeyVersion: null,
      isProduction,
    };
  }

  if (record.keyVersion === 'v1-fallback' && isProduction && !usingDedicatedVaultSecret) {
    return {
      connected: false,
      status: 'needs_reconnect',
      maskedHint: record.maskedHint,
      lastVerifiedAtMs: record.lastVerifiedAtMs || null,
      updatedAtMs: record.updatedAtMs || null,
      usingDedicatedVaultSecret,
      encryptionKeyVersion: record.keyVersion,
      isProduction,
      message:
        'Môi trường vận hành chính thức (production) không cho phép dùng khóa dự phòng v1-fallback. Vui lòng thiết lập API_KEY_ENCRYPTION_SECRET trong Settings > Secrets (khóa đã lưu của giáo viên vẫn được giữ nguyên an toàn để tự động nâng cấp).',
    };
  }

  // Verify the stored ciphertext can still be decrypted cleanly for this exact teacher UID
  try {
    decryptPersonalApiKey(uid, record);
    return {
      connected: true,
      status: 'connected',
      maskedHint: record.maskedHint,
      lastVerifiedAtMs: record.lastVerifiedAtMs || null,
      updatedAtMs: record.updatedAtMs || null,
      usingDedicatedVaultSecret,
      encryptionKeyVersion: record.keyVersion,
      isProduction,
    };
  } catch {
    return {
      connected: false,
      status: 'needs_reconnect',
      maskedHint: record.maskedHint,
      lastVerifiedAtMs: record.lastVerifiedAtMs || null,
      updatedAtMs: record.updatedAtMs || null,
      usingDedicatedVaultSecret,
      encryptionKeyVersion: record.keyVersion,
      isProduction,
      message:
        record.keyVersion === 'v1-env' && !usingDedicatedVaultSecret
          ? 'Biến bí mật API_KEY_ENCRYPTION_SECRET hiện chưa được cấu hình hoặc đã bị thay đổi. Vui lòng kiểm tra Settings > Secrets hoặc kết nối lại Gemini API key cá nhân.'
          : 'Khóa mã hóa máy chủ đã thay đổi. Vui lòng nhập lại Gemini API key cá nhân.',
    };
  }
}
