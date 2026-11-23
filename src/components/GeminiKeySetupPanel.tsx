import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  Lock,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unlink,
  X,
} from 'lucide-react';
import { getAuthBearerHeaders } from '../firebase';

export interface TeacherGeminiKeyStatus {
  loading: boolean;
  loaded: boolean;
  connected: boolean;
  status: 'connected' | 'not_connected' | 'needs_reconnect';
  maskedHint: string;
  lastVerifiedAtMs: number | null;
  updatedAtMs: number | null;
  usingDedicatedVaultSecret: boolean;
  encryptionKeyVersion?: 'v1-env' | 'v1-fallback' | null;
  isProduction?: boolean;
  message?: string;
}

export const INITIAL_GEMINI_KEY_STATUS: TeacherGeminiKeyStatus = {
  loading: false,
  loaded: false,
  connected: false,
  status: 'not_connected',
  maskedHint: '',
  lastVerifiedAtMs: null,
  updatedAtMs: null,
  usingDedicatedVaultSecret: false,
  encryptionKeyVersion: null,
  isProduction: false,
};

interface GeminiKeySetupPanelProps {
  mode: 'step2_screen' | 'tab' | 'modal';
  teacherEmail: string;
  teacherName: string;
  classLabel?: string;
  keyStatus: TeacherGeminiKeyStatus;
  onStatusUpdated: (next: TeacherGeminiKeyStatus) => void;
  onContinueWithoutAi?: () => void;
  onClose?: () => void;
  onSignOut?: () => void;
  onToast?: (message: string, type?: 'success' | 'error') => void;
}

const GEMINI_API_KEY_URL = 'https://aistudio.google.com/apikey';

function formatTimestampVi(ms: number | null): string {
  if (!ms || !Number.isFinite(ms)) return '—';
  try {
    return new Date(ms).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function GeminiKeySetupPanel({
  mode,
  teacherEmail,
  teacherName,
  classLabel,
  keyStatus,
  onStatusUpdated,
  onContinueWithoutAi,
  onClose,
  onSignOut,
  onToast,
}: GeminiKeySetupPanelProps) {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isReplacing, setIsReplacing] = useState(!keyStatus.connected);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (keyStatus.connected) {
      setIsReplacing(false);
    }
  }, [keyStatus.connected]);

  const handleStartReplace = () => {
    setIsReplacing(true);
    setConfirmDisconnect(false);
    setFeedback({
      type: 'info',
      message: 'Nhập Gemini API key mới vào ô bên dưới, sau đó bấm "KIỂM TRA KẾT NỐI" hoặc "LƯU AN TOÀN".',
    });
    setTimeout(() => {
      inputRef.current?.focus();
    }, 40);
  };

  const handleTestConnection = async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed && !keyStatus.connected) {
      setFeedback({
        type: 'error',
        message: 'Vui lòng dán Gemini API key cá nhân vào ô nhập trước khi kiểm tra kết nối.',
      });
      return;
    }

    setIsTesting(true);
    setFeedback(null);
    try {
      const headers = await getAuthBearerHeaders();
      const resp = await fetch('/api/teacher/gemini-key/test', {
        method: 'POST',
        headers,
        body: JSON.stringify(
          trimmed
            ? { apiKey: trimmed }
            : { useSaved: true }
        ),
      });
      const data = (await resp.json()) as {
        ok?: boolean;
        valid?: boolean;
        message?: string;
        error?: string;
        maskedHint?: string;
      };
      if (!resp.ok || !data.valid) {
        const errMsg = data.error || 'Kết nối Gemini API thất bại. Vui lòng kiểm tra lại API key.';
        setFeedback({ type: 'error', message: errMsg });
        onToast?.(errMsg, 'error');
        return;
      }

      const okMsg =
        data.message ||
        `Kết nối Gemini API thành công (${data.maskedHint || keyStatus.maskedHint}).`;
      setFeedback({ type: 'success', message: okMsg });
      onToast?.(okMsg, 'success');
    } catch {
      const errMsg = 'Không thể kết nối tới máy chủ để kiểm tra API key. Vui lòng thử lại.';
      setFeedback({ type: 'error', message: errMsg });
      onToast?.(errMsg, 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveSafe = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      setFeedback({
        type: 'error',
        message: 'Vui lòng nhập Gemini API key cá nhân trước khi bấm "LƯU AN TOÀN".',
      });
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      const headers = await getAuthBearerHeaders();
      const resp = await fetch('/api/teacher/gemini-key/save', {
        method: 'POST',
        headers,
        body: JSON.stringify({ apiKey: trimmed }),
      });
      const data = (await resp.json()) as {
        ok?: boolean;
        connected?: boolean;
        status?: 'connected' | 'not_connected' | 'needs_reconnect';
        maskedHint?: string;
        lastVerifiedAtMs?: number | null;
        updatedAtMs?: number | null;
        usingDedicatedVaultSecret?: boolean;
        encryptionKeyVersion?: 'v1-env' | 'v1-fallback' | null;
        isProduction?: boolean;
        message?: string;
        error?: string;
      };

      if (!resp.ok || !data.ok) {
        const errMsg = data.error || 'Không thể lưu Gemini API key. Vui lòng kiểm tra lại khóa.';
        setFeedback({ type: 'error', message: errMsg });
        onToast?.(errMsg, 'error');
        return;
      }

      // Xóa ngay khóa gốc khỏi state giao diện để không lưu dấu vết trên trình duyệt
      setApiKeyInput('');
      setShowKey(false);
      setIsReplacing(false);
      setConfirmDisconnect(false);

      const nextStatus: TeacherGeminiKeyStatus = {
        loading: false,
        loaded: true,
        connected: true,
        status: 'connected',
        maskedHint: data.maskedHint || '',
        lastVerifiedAtMs: data.lastVerifiedAtMs ?? Date.now(),
        updatedAtMs: data.updatedAtMs ?? Date.now(),
        usingDedicatedVaultSecret: Boolean(data.usingDedicatedVaultSecret),
        encryptionKeyVersion: data.encryptionKeyVersion ?? null,
        isProduction: Boolean(data.isProduction),
      };
      onStatusUpdated(nextStatus);

      const okMsg =
        data.message || 'Đã mã hóa và lưu an toàn Gemini API key cá nhân trên máy chủ!';
      setFeedback({ type: 'success', message: okMsg });
      onToast?.(okMsg, 'success');

      if (mode === 'modal' && onClose) {
        onClose();
      }
    } catch {
      const errMsg = 'Lỗi kết nối máy chủ khi lưu Gemini API key. Vui lòng thử lại.';
      setFeedback({ type: 'error', message: errMsg });
      onToast?.(errMsg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    setFeedback(null);
    try {
      const headers = await getAuthBearerHeaders();
      const resp = await fetch('/api/teacher/gemini-key', {
        method: 'DELETE',
        headers,
      });
      const data = (await resp.json()) as {
        ok?: boolean;
        usingDedicatedVaultSecret?: boolean;
        message?: string;
        error?: string;
      };
      if (!resp.ok || !data.ok) {
        const errMsg = data.error || 'Không thể ngắt kết nối Gemini API key lúc này.';
        setFeedback({ type: 'error', message: errMsg });
        onToast?.(errMsg, 'error');
        return;
      }

      setApiKeyInput('');
      setShowKey(false);
      setConfirmDisconnect(false);
      setIsReplacing(true);

      onStatusUpdated({
        loading: false,
        loaded: true,
        connected: false,
        status: 'not_connected',
        maskedHint: '',
        lastVerifiedAtMs: null,
        updatedAtMs: null,
        usingDedicatedVaultSecret: Boolean(data.usingDedicatedVaultSecret),
        encryptionKeyVersion: null,
        isProduction: Boolean(keyStatus.isProduction),
      });

      const okMsg =
        data.message || 'Đã ngắt kết nối và xóa Gemini API key cá nhân khỏi kho bảo mật.';
      setFeedback({ type: 'info', message: okMsg });
      onToast?.(okMsg, 'success');
    } catch {
      const errMsg = 'Lỗi kết nối máy chủ khi ngắt kết nối Gemini API key.';
      setFeedback({ type: 'error', message: errMsg });
      onToast?.(errMsg, 'error');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const showKeyEditor = !keyStatus.connected || isReplacing;

  const content = (
    <div className="space-y-6">
      {/* Banner tiêu đề & tiến trình 2 bước */}
      <div className="rounded-2xl bg-gradient-to-r from-[#102744] via-[#15365C] to-[#0C7D87] text-white p-5 md:p-6 shadow-md">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-xs font-bold text-teal-100">
              <Sparkles className="w-3.5 h-3.5 text-teal-300" />
              <span>BƯỚC 2 / 2 • KẾT NỐI TRỢ LÝ AI RIÊNG CỦA GIÁO VIÊN</span>
            </div>
            <h2 className="text-xl md:text-2xl font-extrabold tracking-tight">
              KẾT NỐI GEMINI AI CÁ NHÂN
            </h2>
            <p className="text-xs sm:text-sm text-teal-100/95 max-w-2xl leading-relaxed">
              Mỗi giáo viên sử dụng <strong>Gemini API key cá nhân riêng</strong> để kích hoạt các tính năng AI
              (Nhận xét học bạ, Tin nhắn phụ huynh, Phân tích học tập &amp; Gợi ý bài tập). Hệ thống{' '}
              <strong>không dùng chung khóa AI</strong> giữa các giáo viên.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start shrink-0">
            {mode === 'modal' && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {mode === 'step2_screen' && onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 text-xs font-bold flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Đăng xuất</span>
              </button>
            )}
          </div>
        </div>

        {/* Tiến trình 2 bước (hiển thị rõ ở màn hình Step 2) */}
        <div className="mt-4 pt-4 border-t border-white/15 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2.5 bg-white/10 rounded-xl px-3.5 py-2.5 border border-emerald-300/30">
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-white">Bước 1: Đăng nhập Google &amp; bảo vệ dữ liệu lớp</div>
              <div className="text-teal-100/90 truncate">
                {teacherName || 'GVCN'} • {teacherEmail}
                {classLabel ? ` • ${classLabel}` : ''}
              </div>
            </div>
          </div>
          <div
            className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 border ${
              keyStatus.connected
                ? 'bg-emerald-500/20 border-emerald-300/40'
                : 'bg-amber-400/15 border-amber-300/40'
            }`}
          >
            {keyStatus.connected ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
            ) : (
              <KeyRound className="w-4 h-4 text-amber-300 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="font-bold text-white">Bước 2: Kết nối Gemini API key cá nhân</div>
              <div className="text-teal-100/90">
                {keyStatus.connected
                  ? `Đã kết nối (${keyStatus.maskedHint})`
                  : 'Chưa kết nối — Có thể kết nối ngay hoặc để sau'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Thẻ Trạng thái kết nối hiện tại */}
      <div
        className={`rounded-2xl border p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          keyStatus.connected
            ? 'bg-emerald-50/80 border-emerald-200'
            : keyStatus.status === 'needs_reconnect'
              ? 'bg-rose-50/80 border-rose-200'
              : 'bg-amber-50/70 border-amber-200'
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              keyStatus.connected
                ? 'bg-emerald-600 text-white'
                : keyStatus.status === 'needs_reconnect'
                  ? 'bg-rose-600 text-white'
                  : 'bg-amber-500 text-white'
            }`}
          >
            {keyStatus.connected ? (
              <ShieldCheck className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Trạng thái kết nối:
              </span>
              {keyStatus.connected ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white">
                  Đã kết nối Gemini AI cá nhân
                </span>
              ) : keyStatus.status === 'needs_reconnect' ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white">
                  Cần kết nối lại
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-600 text-white">
                  Chưa kết nối API key
                </span>
              )}
            </div>

            {keyStatus.connected ? (
              <div className="text-xs text-emerald-900 space-y-0.5">
                <div>
                  Mã nhận diện khóa (đã che):{' '}
                  <code className="px-1.5 py-0.5 rounded bg-white border border-emerald-200 font-bold text-emerald-950">
                    {keyStatus.maskedHint}
                  </code>
                </div>
                <div className="text-emerald-800/90">
                  Xác minh gần nhất: <strong>{formatTimestampVi(keyStatus.lastVerifiedAtMs)}</strong> • Lưu mã hóa AES-256-GCM trên máy chủ
                </div>
                {!keyStatus.usingDedicatedVaultSecret && (
                  <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100/90 border border-amber-300 text-amber-900 text-[11px] font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-700" />
                    <span>
                      Đang chạy chế độ phát triển. Trước khi chia sẻ rộng rãi (Publish), quản trị viên cần thêm biến bí mật{' '}
                      <code className="font-bold">API_KEY_ENCRYPTION_SECRET</code> trong Settings → Secrets (khóa đã lưu sẽ tự động nâng cấp an toàn).
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-700">
                {keyStatus.message ||
                  'Bạn vẫn sử dụng bình thường mọi chức năng quản lý lớp (hồ sơ học sinh, điểm danh, thi đua, bảng điểm vnEdu, sổ quỹ, phân quyền 8 vị trí). Chỉ cần kết nối Gemini API key cá nhân khi muốn dùng trợ lý AI.'}
              </p>
            )}
          </div>
        </div>

        {/* Nút thao tác nhanh khi ĐÃ kết nối: KIỂM TRA KẾT NỐI / THAY API KEY / NGẮT KẾT NỐI */}
        {keyStatus.connected && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isTesting || isSaving || isDisconnecting}
              onClick={handleTestConnection}
              className="px-3 py-2 rounded-xl bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
              <span>KIỂM TRA KẾT NỐI</span>
            </button>
            <button
              type="button"
              disabled={isTesting || isSaving || isDisconnecting}
              onClick={handleStartReplace}
              className="px-3 py-2 rounded-xl bg-[#102744] hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>THAY API KEY</span>
            </button>
            <button
              type="button"
              disabled={isTesting || isSaving || isDisconnecting}
              onClick={() => setConfirmDisconnect(true)}
              className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-700 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              <Unlink className="w-3.5 h-3.5" />
              <span>NGẮT KẾT NỐI</span>
            </button>
          </div>
        )}
      </div>

      {/* Xác nhận nội tuyến cho nút NGẮT KẾT NỐI (không dùng window.confirm) */}
      {confirmDisconnect && (
        <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-rose-950 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Xác nhận ngắt kết nối Gemini API key cá nhân?</span>
            </div>
            <p className="text-rose-800">
              Hệ thống sẽ xóa bản mã hóa khóa khỏi máy chủ. Toàn bộ dữ liệu lớp học của bạn được giữ nguyên 100%, chỉ tạm tắt các tính năng AI cho tới khi bạn kết nối lại.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isDisconnecting}
              onClick={() => setConfirmDisconnect(false)}
              className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={isDisconnecting}
              onClick={handleDisconnect}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              {isDisconnecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
              <span>Xác nhận ngắt kết nối</span>
            </button>
          </div>
        </div>
      )}

      {/* Lưới 2 cột: Hướng dẫn lấy API key + Biểu mẫu nhập an toàn */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Cột trái: Nút LẤY GEMINI API KEY + Link + Hướng dẫn tiếng Việt */}
        <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-sm text-[#102744]">
              Hướng dẫn lấy Gemini API key cá nhân
            </h3>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
              Miễn phí khởi tạo
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-teal-50/70 border border-teal-200 space-y-2.5">
            <a
              href={GEMINI_API_KEY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              <span>LẤY GEMINI API KEY</span>
            </a>
            <div className="text-xs text-slate-600 break-all">
              Đường dẫn chính thức Google AI Studio:{' '}
              <a
                href={GEMINI_API_KEY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono font-semibold text-[#0C9BA6] underline hover:text-teal-800"
              >
                {GEMINI_API_KEY_URL}
              </a>
            </div>
          </div>

          <ol className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#102744] text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              <span>
                Bấm nút <strong>“LẤY GEMINI API KEY”</strong> ở trên để mở trang{' '}
                <strong>Google AI Studio</strong> (<code className="text-[#0C9BA6]">aistudio.google.com/apikey</code>).
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#102744] text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                2
              </span>
              <span>
                Đăng nhập bằng <strong>tài khoản Google cá nhân của thầy/cô</strong> (nên dùng cùng tài khoản Google vừa đăng nhập ứng dụng).
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#102744] text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                3
              </span>
              <span>
                Chọn nút <strong>“Create API key”</strong> (Tạo khóa API), chọn hoặc tạo dự án Google Cloud theo hướng dẫn trên màn hình.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#102744] text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                4
              </span>
              <span>
                Bấm <strong>“Copy”</strong> để sao chép chuỗi API key (thường bắt đầu bằng{' '}
                <code className="bg-slate-100 px-1 rounded">AIza...</code>), quay lại màn hình này dán vào ô nhập bên phải, bấm{' '}
                <strong>“KIỂM TRA KẾT NỐI”</strong> rồi bấm <strong>“LƯU AN TOÀN”</strong>.
              </span>
            </li>
          </ol>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#0C9BA6]" />
              <span>Cam kết bảo mật khóa cá nhân</span>
            </div>
            <p>
              • Khóa được gửi qua kết nối xác thực riêng của bạn, mã hóa <strong>AES-256-GCM</strong> trên máy chủ theo đúng UID giáo viên.
            </p>
            <p>
              • Tuyệt đối không lưu trong <code>localStorage</code>/trình duyệt và không bao giờ hiển thị lại khóa gốc sau khi đã lưu.
            </p>
            <p>
              • Giáo viên khác và 7 tài khoản Cán bộ lớp không thể xem, sử dụng hay truy cập cấu hình API key của bạn.
            </p>
          </div>
        </div>

        {/* Cột phải: Ô nhập API key (ẩn/hiện) + các nút điều khiển */}
        <div className="lg:col-span-7 rounded-2xl bg-white border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-5">
          <form onSubmit={handleSaveSafe} className="space-y-4">
            <div>
              <h3 className="font-bold text-sm text-[#102744]">
                {keyStatus.connected && !isReplacing
                  ? 'Quản lý kết nối Gemini API key cá nhân'
                  : keyStatus.connected
                    ? 'Thay đổi Gemini API key cá nhân'
                    : 'Nhập và xác thực Gemini API key cá nhân'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {keyStatus.connected && !isReplacing
                  ? 'API key cá nhân của bạn đang hoạt động an toàn. Bạn có thể kiểm tra lại kết nối, thay khóa mới hoặc ngắt kết nối bất cứ lúc nào.'
                  : 'Dán chuỗi API key bạn vừa sao chép từ Google AI Studio. Máy chủ sẽ xác thực trực tiếp trước khi mã hóa và lưu.'}
              </p>
            </div>

            {showKeyEditor ? (
              <div className="space-y-2">
                <label
                  htmlFor="teacher-gemini-api-key-input"
                  className="block text-xs font-bold text-slate-700"
                >
                  Gemini API key cá nhân của {teacherName || teacherEmail}
                </label>
                <div className="relative flex items-center">
                  <input
                    ref={inputRef}
                    id="teacher-gemini-api-key-input"
                    type={showKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Dán Gemini API key (ví dụ: AIzaSy...)"
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full pr-24 pl-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6] text-sm font-mono text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((prev) => !prev)}
                    className="absolute right-2 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1"
                    aria-label={showKey ? 'Ẩn API key' : 'Hiện API key'}
                  >
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showKey ? 'Ẩn' : 'Hiện'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Mẹo: Không chia sẻ API key với người khác. Sau khi bấm <strong>“LƯU AN TOÀN”</strong>, ô nhập sẽ tự xóa trắng ngay lập tức.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-600">Khóa đang lưu bảo mật:</span>
                  <code className="px-2 py-0.5 rounded bg-white border border-slate-200 font-bold text-[#102744]">
                    {keyStatus.maskedHint}
                  </code>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-600">Tài khoản sở hữu:</span>
                  <span className="font-medium text-slate-800">{teacherEmail}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-600">Cập nhật gần nhất:</span>
                  <span className="font-medium text-slate-800">{formatTimestampVi(keyStatus.updatedAtMs)}</span>
                </div>
              </div>
            )}

            {/* Phản hồi kiểm tra / lưu / lỗi */}
            {feedback && (
              <div
                className={`p-3.5 rounded-xl border text-xs font-medium flex items-start gap-2.5 ${
                  feedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : feedback.type === 'error'
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : 'bg-sky-50 border-sky-200 text-sky-900'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      feedback.type === 'error' ? 'text-rose-600' : 'text-sky-600'
                    }`}
                  />
                )}
                <span>{feedback.message}</span>
              </div>
            )}

            {/* Hàng nút hành động đầy đủ */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                disabled={isTesting || isSaving || isDisconnecting || (!apiKeyInput.trim() && !keyStatus.connected)}
                onClick={handleTestConnection}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-bold flex items-center gap-2 disabled:opacity-50 transition-all"
              >
                {isTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4 text-[#0C9BA6]" />}
                <span>{isTesting ? 'Đang kiểm tra...' : 'KIỂM TRA KẾT NỐI'}</span>
              </button>

              {showKeyEditor && (
                <button
                  type="submit"
                  disabled={isSaving || isTesting || isDisconnecting || !apiKeyInput.trim()}
                  className="px-4 py-2.5 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm disabled:opacity-50 transition-all"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>{isSaving ? 'Đang mã hóa & lưu...' : 'LƯU AN TOÀN'}</span>
                </button>
              )}

              {keyStatus.connected && !isReplacing && (
                <button
                  type="button"
                  onClick={handleStartReplace}
                  className="px-4 py-2.5 rounded-xl bg-[#102744] hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-2 transition-all"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>THAY API KEY</span>
                </button>
              )}

              {keyStatus.connected && isReplacing && (
                <button
                  type="button"
                  onClick={() => {
                    setIsReplacing(false);
                    setApiKeyInput('');
                    setShowKey(false);
                    setFeedback(null);
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-600 text-xs font-bold"
                >
                  Hủy thay khóa
                </button>
              )}

              {keyStatus.connected && (
                <button
                  type="button"
                  disabled={isDisconnecting || isSaving || isTesting}
                  onClick={() => setConfirmDisconnect(true)}
                  className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-700 text-xs font-bold flex items-center gap-2 disabled:opacity-50 transition-all"
                >
                  <Unlink className="w-4 h-4" />
                  <span>NGẮT KẾT NỐI</span>
                </button>
              )}
            </div>
          </form>

          {/* Chân thẻ: Chuyển tiếp vào quản lý lớp (đặc biệt ở Bước 2 hoặc Modal) */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {keyStatus.connected
                ? 'Trợ lý AI đã sẵn sàng phục vụ riêng cho các lớp của bạn.'
                : 'Chưa có API key? Bạn vẫn có thể vào quản lý lớp học bình thường và kết nối sau.'}
            </p>
            {mode === 'step2_screen' && onContinueWithoutAi && (
              <button
                type="button"
                onClick={onContinueWithoutAi}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shrink-0 transition-all ${
                  keyStatus.connected
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                    : 'bg-[#102744] hover:bg-slate-800 text-white'
                }`}
              >
                <span>
                  {keyStatus.connected
                    ? 'Vào không gian quản lý lớp'
                    : 'Để sau — Vào quản lý lớp không cần AI'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {mode === 'modal' && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold shrink-0"
              >
                Đóng cửa sổ
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (mode === 'step2_screen') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/40 to-slate-100 py-8 px-4 flex items-center justify-center">
        <div className="w-full max-w-5xl">{content}</div>
      </div>
    );
  }

  if (mode === 'modal') {
    return (
      <div
        className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl bg-slate-50 p-4 md:p-6 shadow-2xl border border-slate-200"
          onClick={(e) => e.stopPropagation()}
        >
          {content}
        </div>
      </div>
    );
  }

  return content;
}
