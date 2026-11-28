import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  GoogleGenAI,
  ThinkingLevel,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from '@google/genai';

export interface FirebaseAppletConfig {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId?: string;
}

export function loadFirebaseAppletConfig(): FirebaseAppletConfig {
  const candidates = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    new URL('../../firebase-applet-config.json', import.meta.url),
    new URL('../firebase-applet-config.json', import.meta.url),
  ];

  for (const candidate of candidates) {
    try {
      const raw = fs.readFileSync(candidate, 'utf8');
      return JSON.parse(raw) as FirebaseAppletConfig;
    } catch {
      // Try next candidate path
    }
  }

  throw new Error('Không tìm thấy tệp cấu hình firebase-applet-config.json trên máy chủ.');
}

const firebaseConfig = loadFirebaseAppletConfig();

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
  code?: string;
  message?: string;
}

export class VaultStorageError extends Error {
  readonly httpStatus: number;
  readonly code: string;

  constructor(message: string, httpStatus: number, code: string) {
    super(message);
    this.name = 'VaultStorageError';
    this.httpStatus = httpStatus;
    this.code = code;
  }
}

export function sanitizeForLog(input: unknown): string {
  const text = input instanceof Error ? input.message : String(input ?? 'Unknown error');
  return text
    .replace(/AIza[0-9A-Za-z_-]{15,}/g, '[REDACTED_API_KEY]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[REDACTED_JWT]')
    .slice(0, 300);
}

const MIN_SECRET_LENGTH = 16;

export function isProductionRuntime(): boolean {
  return (
    (process.env.NODE_ENV || '').trim().toLowerCase() === 'production' ||
    Boolean(process.env.VERCEL)
  );
}

export function isVercelPreviewRuntime(): boolean {
  return (process.env.VERCEL_ENV || '').trim().toLowerCase() === 'preview';
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
      throw new VaultStorageError(
        'Biến môi trường API_KEY_ENCRYPTION_SECRET hiện chưa được cấu hình hoặc đã bị thay đổi trên máy chủ. Vui lòng kiểm tra cấu hình Secrets/Environment Variables.',
        503,
        'PRODUCTION_ENCRYPTION_SECRET_REQUIRED'
      );
    }
    return crypto.createHash('sha256').update(secret, 'utf8').digest();
  }
  if (isProductionRuntime() && !options?.allowFallbackInProd) {
    throw new VaultStorageError(
      'Môi trường vận hành chính thức (production/Vercel) không cho phép dùng khóa mã hóa dự phòng v1-fallback. Vui lòng thiết lập biến môi trường API_KEY_ENCRYPTION_SECRET.',
      503,
      'PRODUCTION_ENCRYPTION_SECRET_REQUIRED'
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
    throw new VaultStorageError(
      'Thiếu mã định danh giáo viên (UID) để mã hóa API key.',
      400,
      'MISSING_UID'
    );
  }
  const formatCheck = validatePersonalGeminiApiKeyFormat(rawApiKey);
  if (!formatCheck.valid) {
    throw new VaultStorageError(
      formatCheck.error || 'Gemini API key không hợp lệ.',
      400,
      'INVALID_KEY_FORMAT'
    );
  }

  const hasDedicatedSecret = isUsingDedicatedVaultSecret();
  if (!hasDedicatedSecret && isProductionRuntime()) {
    throw new VaultStorageError(
      'Môi trường vận hành chính thức (production/Vercel) bắt buộc cấu hình biến bí mật API_KEY_ENCRYPTION_SECRET (tối thiểu 16 ký tự, khuyến nghị ≥ 32 ký tự) trước khi lưu API key cá nhân.',
      503,
      'PRODUCTION_ENCRYPTION_SECRET_REQUIRED'
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
    throw new VaultStorageError(
      'Không được phép giải mã khóa của tài khoản giáo viên khác.',
      403,
      'VAULT_UID_MISMATCH'
    );
  }
  if (envelope.alg !== VAULT_ALGORITHM || envelope.provider !== VAULT_PROVIDER) {
    throw new VaultStorageError(
      'Cấu trúc bản ghi khóa mã hóa không hợp lệ.',
      500,
      'VAULT_CORRUPT_RECORD'
    );
  }
  const keyVersion = envelope.keyVersion === 'v1-env' ? 'v1-env' : 'v1-fallback';
  const masterKey = getMasterKeyForVersion(keyVersion, options);
  const salt = Buffer.from(envelope.saltB64, 'base64');
  const iv = Buffer.from(envelope.ivB64, 'base64');
  const authTag = Buffer.from(envelope.authTagB64, 'base64');
  const ciphertext = Buffer.from(envelope.ciphertextB64, 'base64');
  const dek = deriveTeacherDek(masterKey, uid, salt, keyVersion);
  const aad = buildVaultAad(uid);

  let plaintext = '';
  try {
    const decipher = crypto.createDecipheriv(VAULT_ALGORITHM, dek, iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(authTag);
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    throw new VaultStorageError(
      'Không thể giải mã Gemini API key cá nhân bằng khóa mã hóa máy chủ hiện tại (API_KEY_ENCRYPTION_SECRET không khớp hoặc đã thay đổi). Bản mã hóa và dữ liệu hiện có trên Firestore vẫn được giữ nguyên an toàn.',
      428,
      'GEMINI_KEY_RECONNECT_REQUIRED'
    );
  }
  if (!plaintext) {
    throw new VaultStorageError(
      'Khóa giải mã rỗng. Vui lòng kết nối lại Gemini API key cá nhân.',
      428,
      'VAULT_EMPTY_PLAINTEXT'
    );
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

export class GeminiResponseParseError extends Error {
  constructor(message = 'Phản hồi JSON từ Gemini không hợp lệ hoặc bị rỗng.') {
    super(message);
    this.name = 'GeminiResponseParseError';
  }
}

export class GeminiSafetyBlockedError extends Error {
  readonly finishReason: string;

  constructor(finishReason: string) {
    super(`Nội dung bị bộ lọc an toàn của Google Gemini chặn (${finishReason}).`);
    this.name = 'GeminiSafetyBlockedError';
    this.finishReason = finishReason;
  }
}

export function extractUpstreamErrorStatus(error: unknown): number | null {
  if (typeof error === 'object' && error !== null) {
    const obj = error as {
      status?: unknown;
      statusCode?: unknown;
      code?: unknown;
      response?: { status?: unknown };
    };
    for (const candidate of [obj.status, obj.statusCode, obj.response?.status, obj.code]) {
      if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 100 && candidate < 600) {
        return Math.trunc(candidate);
      }
      if (typeof candidate === 'string' && /^\d{3}$/.test(candidate.trim())) {
        return Number(candidate.trim());
      }
    }
  }
  const msg = error instanceof Error ? error.message : String(error || '');
  const jsonCodeMatch = msg.match(/"code"\s*:\s*(\d{3})/);
  if (jsonCodeMatch) return Number(jsonCodeMatch[1]);
  const statusMatch = msg.match(/\bstatus(?:\s*code)?\s*[:=]\s*(\d{3})\b/i);
  if (statusMatch) return Number(statusMatch[1]);
  return null;
}

export function parseGeminiJsonResponse<T>(rawText: string): T {
  const cleaned = String(rawText || '')
    .replace(/^\uFEFF/, '')
    .trim();
  if (!cleaned) {
    throw new GeminiResponseParseError('Google Gemini trả về nội dung rỗng.');
  }

  const unfenced = cleaned
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(unfenced) as T;
  } catch {
    // Fallback: extract the outermost balanced JSON object when model adds brief wrapper text
    const startIdx = unfenced.indexOf('{');
    const endIdx = unfenced.lastIndexOf('}');
    if (startIdx !== -1 && endIdx > startIdx) {
      const candidate = unfenced.slice(startIdx, endIdx + 1);
      try {
        return JSON.parse(candidate) as T;
      } catch {
        // Fall through to typed parse error
      }
    }
    throw new GeminiResponseParseError('Phản hồi từ Google Gemini chưa đúng định dạng JSON.');
  }
}

export function isRetryableGeminiError(error: unknown): boolean {
  if (error instanceof GeminiSafetyBlockedError) {
    return false;
  }
  if (error instanceof GeminiResponseParseError || error instanceof SyntaxError) {
    return true;
  }

  const status = extractUpstreamErrorStatus(error);
  const rawMessage = error instanceof Error ? error.message : String(error || '');
  const lower = rawMessage.toLowerCase();

  // Never retry auth, permission, invalid key, model not found, bad request, or quota exhaustion
  if (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    status === 404 ||
    status === 429 ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('permission_denied') ||
    lower.includes('resource_exhausted') ||
    lower.includes('not_found') ||
    lower.includes('invalid_argument') ||
    lower.includes('safety') ||
    lower.includes('prohibited_content')
  ) {
    return false;
  }

  return (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    lower.includes('unavailable') ||
    lower.includes('internal') ||
    lower.includes('overloaded') ||
    lower.includes('high demand') ||
    lower.includes('deadline_exceeded') ||
    lower.includes('timeout') ||
    lower.includes('etimedout') ||
    lower.includes('econnreset') ||
    lower.includes('socket hang up') ||
    lower.includes('fetch failed') ||
    lower.includes('eai_again')
  );
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertNotSafetyBlocked(response: GenerateContentResponse): void {
  const blockReason = String(response.promptFeedback?.blockReason || '').toUpperCase();
  if (blockReason && blockReason !== 'BLOCK_REASON_UNSPECIFIED') {
    throw new GeminiSafetyBlockedError(blockReason);
  }
  const finishReason = String(response.candidates?.[0]?.finishReason || '').toUpperCase();
  if (
    finishReason === 'SAFETY' ||
    finishReason === 'PROHIBITED_CONTENT' ||
    finishReason === 'BLOCKLIST' ||
    finishReason === 'SPII' ||
    finishReason === 'RECITATION'
  ) {
    throw new GeminiSafetyBlockedError(finishReason);
  }
}

export async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: GenerateContentParameters,
  maxAttempts = 3
): Promise<GenerateContentResponse> {
  let lastError: unknown;
  const attempts = Math.max(1, Math.min(maxAttempts, 4));
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await ai.models.generateContent(params);
      assertNotSafetyBlocked(response);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isRetryableGeminiError(error)) {
        throw error;
      }
      const backoff = 700 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 250);
      await delayMs(backoff);
    }
  }
  throw lastError;
}

export async function generateJsonWithRetry<T>(
  ai: GoogleGenAI,
  params: GenerateContentParameters,
  validateFn?: (parsed: T) => boolean,
  maxAttempts = 3
): Promise<T> {
  let lastError: unknown;
  const attempts = Math.max(1, Math.min(maxAttempts, 4));
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await ai.models.generateContent(params);
      assertNotSafetyBlocked(response);
      const parsed = parseGeminiJsonResponse<T>(response.text || '');
      if (validateFn && !validateFn(parsed)) {
        throw new GeminiResponseParseError('Phản hồi JSON từ Google Gemini thiếu trường nội dung bắt buộc.');
      }
      return parsed;
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isRetryableGeminiError(error)) {
        throw error;
      }
      const backoff = 700 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 250);
      await delayMs(backoff);
    }
  }
  throw lastError;
}

export function classifyGeminiApiError(
  error: unknown,
  context: 'verify' | 'generate' = 'generate'
): {
  status: number;
  code: string;
  message: string;
} {
  if (error instanceof GeminiSafetyBlockedError) {
    return {
      status: 422,
      code: 'GEMINI_SAFETY_BLOCKED',
      message:
        'Nội dung đầu vào chạm bộ lọc an toàn của Google Gemini. Vui lòng rà soát lại ghi chú (tránh từ ngữ nhạy cảm) rồi thử lại.',
    };
  }

  if (error instanceof GeminiResponseParseError || error instanceof SyntaxError) {
    return {
      status: 502,
      code: 'GEMINI_INVALID_RESPONSE',
      message:
        'Google Gemini trả về định dạng chưa chuẩn ở lượt gọi này. Vui lòng bấm tạo lại sau vài giây.',
    };
  }

  const upstreamStatus = extractUpstreamErrorStatus(error);
  const rawMessage = error instanceof Error ? error.message : String(error || '');
  const lower = rawMessage.toLowerCase();

  if (
    upstreamStatus === 401 ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('invalid api key') ||
    lower.includes('api_key_expired') ||
    lower.includes('unauthenticated')
  ) {
    return {
      status: 400,
      code: 'GEMINI_KEY_INVALID',
      message:
        'Gemini API key không hợp lệ hoặc đã bị thu hồi trên Google AI Studio. Vui lòng kiểm tra lại hoặc tạo khóa mới.',
    };
  }

  if (
    upstreamStatus === 403 ||
    lower.includes('permission_denied') ||
    lower.includes('permission denied') ||
    lower.includes('forbidden')
  ) {
    return {
      status: 403,
      code: 'GEMINI_KEY_FORBIDDEN',
      message:
        'Gemini API key không có quyền truy cập mô hình Gemini API (hoặc API chưa được bật trong dự án Google AI Studio).',
    };
  }

  if (
    upstreamStatus === 429 ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests')
  ) {
    return {
      status: 429,
      code: 'GEMINI_QUOTA_EXCEEDED',
      message:
        'Gemini API key cá nhân của bạn đã vượt hạn mức lượt gọi tạm thời hoặc hết quota trên Google AI Studio (HTTP 429). Vui lòng thử lại sau hoặc kiểm tra hạn mức/billing.',
    };
  }

  if (
    upstreamStatus === 404 ||
    lower.includes('not_found') ||
    lower.includes('is not found')
  ) {
    return {
      status: 404,
      code: 'GEMINI_MODEL_NOT_FOUND',
      message:
        'Không tìm thấy mô hình Gemini được yêu cầu cho API key này (HTTP 404). Vui lòng kiểm tra phiên bản mô hình trên hệ thống.',
    };
  }

  if (
    lower.includes('safety') ||
    lower.includes('prohibited_content') ||
    lower.includes('blocklist') ||
    lower.includes('harm_category')
  ) {
    return {
      status: 422,
      code: 'GEMINI_SAFETY_BLOCKED',
      message:
        'Nội dung yêu cầu bị bộ lọc an toàn của Google Gemini từ chối. Vui lòng điều chỉnh ngắn gọn, trung lập hơn rồi thử lại.',
    };
  }

  if (upstreamStatus === 400 || lower.includes('invalid_argument')) {
    return {
      status: 400,
      code: 'GEMINI_BAD_REQUEST',
      message:
        'Yêu cầu gửi tới Google Gemini API chưa hợp lệ (HTTP 400). Vui lòng rút gọn ghi chú bổ sung hoặc thử lại.',
    };
  }

  if (
    upstreamStatus === 503 ||
    lower.includes('unavailable') ||
    lower.includes('overloaded') ||
    lower.includes('high demand')
  ) {
    return {
      status: 503,
      code: 'GEMINI_SERVICE_UNAVAILABLE',
      message:
        'Máy chủ Google Gemini API đang quá tải tạm thời (HTTP 503). Hệ thống đã tự thử lại nhưng chưa thành công — vui lòng bấm thử lại sau vài giây.',
    };
  }

  if (
    upstreamStatus === 504 ||
    lower.includes('deadline_exceeded') ||
    lower.includes('etimedout') ||
    lower.includes('timeout')
  ) {
    return {
      status: 504,
      code: 'GEMINI_TIMEOUT',
      message:
        'Yêu cầu tới Google Gemini API bị quá thời gian chờ. Vui lòng bấm thử lại.',
    };
  }

  if (
    lower.includes('fetch failed') ||
    lower.includes('enotfound') ||
    lower.includes('econnreset') ||
    lower.includes('econnrefused') ||
    lower.includes('socket hang up') ||
    lower.includes('network')
  ) {
    return {
      status: 503,
      code: 'GEMINI_NETWORK_ERROR',
      message:
        'Lỗi mạng khi máy chủ kết nối tới dịch vụ Google Gemini API. Vui lòng thử lại sau ít phút.',
    };
  }

  return {
    status: 502,
    code: 'GEMINI_UPSTREAM_ERROR',
    message:
      context === 'verify'
        ? 'Dịch vụ Google Gemini API tạm thời phản hồi lỗi khi xác thực khóa cá nhân. Vui lòng thử lại sau ít phút.'
        : 'Dịch vụ Google Gemini API tạm thời gặp sự cố xử lý phản hồi. Vui lòng bấm thử lại sau ít giây.',
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
    await generateContentWithRetry(
      ai,
      {
        model: GEMINI_MODEL,
        contents: 'Trả lời đúng 1 từ: OK',
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      },
      2
    );
    return {
      valid: true,
      status: 200,
      code: 'OK',
      message: 'Kết nối Gemini API cá nhân thành công! Khóa hợp lệ và sẵn sàng sử dụng.',
    };
  } catch (error) {
    const classified = classifyGeminiApiError(error, 'verify');
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

function mapFirestoreHttpFailure(
  actionLabel: string,
  status: number
): VaultStorageError {
  if (status === 401) {
    return new VaultStorageError(
      `Phiên đăng nhập Firebase đã hết hạn khi ${actionLabel}. Vui lòng đăng nhập lại.`,
      401,
      'FIRESTORE_AUTH_EXPIRED'
    );
  }
  if (status === 403) {
    return new VaultStorageError(
      `Firestore từ chối quyền truy cập khi ${actionLabel} (HTTP 403). Vui lòng kiểm tra quyền giáo viên đã được phê duyệt và quy tắc bảo mật firestore.rules.`,
      403,
      'FIRESTORE_PERMISSION_DENIED'
    );
  }
  if (status === 429) {
    return new VaultStorageError(
      `Cơ sở dữ liệu Firestore đang chạm hạn mức lượt truy cập khi ${actionLabel} (HTTP 429). Vui lòng thử lại sau.`,
      429,
      'FIRESTORE_QUOTA_EXCEEDED'
    );
  }
  return new VaultStorageError(
    `Lỗi lưu trữ Firestore khi ${actionLabel} (HTTP ${status}). Vui lòng thử lại sau.`,
    status >= 500 ? 502 : 500,
    'FIRESTORE_STORAGE_ERROR'
  );
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
  let resp: Response;
  try {
    resp = await fetch(getVaultDocumentUrl(uid), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
        Accept: 'application/json',
      },
    });
  } catch {
    throw new VaultStorageError(
      'Lỗi mạng khi máy chủ đọc trạng thái khóa bảo mật từ Firestore.',
      503,
      'FIRESTORE_NETWORK_ERROR'
    );
  }

  if (resp.status === 404) {
    return null;
  }
  if (!resp.ok) {
    throw mapFirestoreHttpFailure('đọc trạng thái kho khóa bảo mật', resp.status);
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

  let resp: Response;
  try {
    resp = await fetch(commitUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(writePayload),
    });
  } catch {
    throw new VaultStorageError(
      'Lỗi mạng khi máy chủ lưu khóa mã hóa vào Firestore.',
      503,
      'FIRESTORE_NETWORK_ERROR'
    );
  }

  if (!resp.ok) {
    throw mapFirestoreHttpFailure('lưu khóa mã hóa vào kho bảo mật', resp.status);
  }
}

export async function deleteTeacherVaultDocRest(uid: string, idToken: string): Promise<void> {
  let resp: Response;
  try {
    resp = await fetch(getVaultDocumentUrl(uid), {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${idToken}`,
        Accept: 'application/json',
      },
    });
  } catch {
    throw new VaultStorageError(
      'Lỗi mạng khi máy chủ ngắt kết nối khóa bảo mật trên Firestore.',
      503,
      'FIRESTORE_NETWORK_ERROR'
    );
  }

  if (resp.status === 404 || resp.ok) {
    return;
  }
  throw mapFirestoreHttpFailure('xóa kết nối Gemini API key khỏi kho bảo mật', resp.status);
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
        throw new VaultStorageError(
          'Môi trường vận hành chính thức (production/Vercel) không cho phép giải mã bằng khóa dự phòng v1-fallback. Vui lòng thiết lập API_KEY_ENCRYPTION_SECRET trong Environment Variables / Secrets; bản ghi khóa cũ vẫn được giữ nguyên an toàn.',
          503,
          'PRODUCTION_ENCRYPTION_SECRET_REQUIRED'
        );
      }
      const apiKey = decryptPersonalApiKey(uid, record);
      return { apiKey, record, migrated: false };
    }

    // Trên Vercel Preview, tuyệt đối không tự ghi đè bản ghi v1-fallback lên Firestore khi đang kiểm thử secret
    if (isVercelPreviewRuntime()) {
      throw new VaultStorageError(
        'Bản ghi khóa hiện tại đang ở định dạng v1-fallback. Môi trường Vercel Preview không tự ghi đè dữ liệu Firestore để bảo toàn bản ghi gốc.',
        428,
        'PREVIEW_READONLY_MIGRATION_BLOCKED'
      );
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
        throw new VaultStorageError(
          'Không thể nâng cấp bản ghi khóa mã hóa sang chuẩn bảo mật API_KEY_ENCRYPTION_SECRET. Bản ghi cũ vẫn được giữ nguyên; vui lòng thử lại hoặc kết nối lại Gemini API key cá nhân.',
          502,
          'VAULT_MIGRATION_FAILED'
        );
      }
      return { apiKey: plaintext, record, migrated: false };
    }
  }

  const apiKey = decryptPersonalApiKey(uid, record);
  return { apiKey, record, migrated: false };
}

export function buildPublicVaultStatus(
  record: StoredVaultRecord | null,
  uid: string
): PublicGeminiKeyStatus {
  const usingDedicatedVaultSecret = isUsingDedicatedVaultSecret();
  const isProduction = isProductionRuntime();

  if (!record) {
    if (isProduction && !usingDedicatedVaultSecret) {
      return {
        connected: false,
        status: 'not_connected',
        maskedHint: '',
        lastVerifiedAtMs: null,
        updatedAtMs: null,
        usingDedicatedVaultSecret,
        encryptionKeyVersion: null,
        isProduction,
        code: 'PRODUCTION_ENCRYPTION_SECRET_REQUIRED',
        message:
          'Máy chủ vận hành chính thức chưa có biến môi trường API_KEY_ENCRYPTION_SECRET. Quản trị viên cần thêm biến này trên Vercel (Settings → Environment Variables) hoặc AI Studio Secrets trước khi lưu API key cá nhân.',
      };
    }
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
      code: 'PRODUCTION_ENCRYPTION_SECRET_REQUIRED',
      message:
        'Môi trường vận hành chính thức (production/Vercel) không cho phép dùng khóa dự phòng v1-fallback. Vui lòng thiết lập biến môi trường API_KEY_ENCRYPTION_SECRET (khóa đã lưu của giáo viên vẫn được giữ nguyên an toàn để tự động nâng cấp).',
    };
  }

  if (record.keyVersion === 'v1-fallback' && isVercelPreviewRuntime()) {
    return {
      connected: false,
      status: 'needs_reconnect',
      maskedHint: record.maskedHint,
      lastVerifiedAtMs: record.lastVerifiedAtMs || null,
      updatedAtMs: record.updatedAtMs || null,
      usingDedicatedVaultSecret,
      encryptionKeyVersion: record.keyVersion,
      isProduction,
      code: 'PREVIEW_READONLY_V1_FALLBACK',
      message:
        'Bản ghi trên Firestore hiện đang ở phiên bản v1-fallback (chưa mã hóa bằng API_KEY_ENCRYPTION_SECRET). Môi trường Vercel Preview giữ nguyên bản ghi gốc và không tự ghi đè Firestore.',
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
      code:
        record.keyVersion === 'v1-env' && !usingDedicatedVaultSecret
          ? 'PRODUCTION_ENCRYPTION_SECRET_REQUIRED'
          : 'KEY_RECONNECT_REQUIRED',
      message:
        record.keyVersion === 'v1-env' && !usingDedicatedVaultSecret
          ? 'Biến bí mật API_KEY_ENCRYPTION_SECRET hiện chưa được cấu hình trên máy chủ. Bản mã hóa gốc trên Firestore vẫn được giữ nguyên an toàn.'
          : 'Không thể giải mã Gemini API key cá nhân bằng API_KEY_ENCRYPTION_SECRET hiện tại (khóa không khớp hoặc đã thay đổi). Bản mã hóa và metadata gốc trên Firestore vẫn được giữ nguyên an toàn.',
    };
  }
}
