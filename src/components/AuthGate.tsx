import React, { useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  LogIn,
  AlertCircle,
  GraduationCap,
  Users,
  Lock,
  Eye,
  EyeOff,
  Clock,
  RefreshCw,
  LogOut,
  Send,
  Building2,
  BookOpen,
  KeyRound,
} from 'lucide-react';
import {
  signInWithGoogle,
  signOutUser,
  signInOfficerWithNickname,
  changeCurrentOfficerPassword,
} from '../firebase';
import type { TeacherAccessRequest } from '../types/gvcn';

interface AuthGateProps {
  authError?: string;
}

export function AuthGate({ authError }: AuthGateProps) {
  const [loginMode, setLoginMode] = useState<'teacher' | 'officer'>('teacher');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isOfficerSigningIn, setIsOfficerSigningIn] = useState(false);
  const [localError, setLocalError] = useState('');

  // Form Cán bộ lớp (xác thực thật qua Firebase Auth Email/Password)
  const [officerNickname, setOfficerNickname] = useState('');
  const [officerPassword, setOfficerPassword] = useState('');
  const [showOfficerPassword, setShowOfficerPassword] = useState(false);
  const [officerNotice, setOfficerNotice] = useState('');

  const handleTeacherLogin = async () => {
    setIsSigningIn(true);
    setLocalError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể đăng nhập bằng Google.';
      setLocalError(msg);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleOfficerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    setOfficerNotice('');
    if (!officerNickname.trim() || !officerPassword) {
      setLocalError('Vui lòng nhập đầy đủ Nickname cán bộ lớp và Mật khẩu do GVCN cấp.');
      return;
    }
    setIsOfficerSigningIn(true);
    try {
      await signInOfficerWithNickname(officerNickname, officerPassword);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể đăng nhập Cán bộ lớp.';
      setLocalError(msg);
    } finally {
      setIsOfficerSigningIn(false);
    }
  };

  const displayError = localError || authError;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/40 to-slate-100 text-slate-900 flex flex-col">
      {/* Thanh tiêu đề công khai */}
      <header className="w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#102744] to-[#0C9BA6] flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-extrabold text-sm sm:text-base text-[#102744] tracking-tight">
                GVCN 360 AI PRO
              </div>
              <div className="text-[11px] font-semibold text-[#0C9BA6]">
                TRỢ LÝ CHỦ NHIỆM THÔNG MINH
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-[#102744] bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg">
            <Lock className="w-3.5 h-3.5 text-[#0C9BA6]" />
            <span>Cổng xác thực bảo mật • Không công khai dữ liệu lớp học</span>
          </div>
        </div>
      </header>

      {/* Nội dung chính */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10">
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Cột giới thiệu công khai */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#102744]/5 border border-[#102744]/15 text-[#102744] text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-[#0C9BA6]" />
              <span>Hệ thống Quản trị Lớp học Đa giáo viên & Phân quyền 8 Vị trí</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#102744] tracking-tight leading-tight">
                GVCN 360 AI PRO
                <span className="block text-xl sm:text-2xl font-bold text-[#0C9BA6] mt-1">
                  TRỢ LÝ CHỦ NHIỆM THÔNG MINH
                </span>
              </h1>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Nền tảng số hóa toàn diện công tác chủ nhiệm THPT: hồ sơ học sinh, điểm danh hằng ngày,
                thi đua A/B/C minh bạch, trung tâm kiểm duyệt phiếu cán bộ lớp, nhập điểm vnEdu và hỗ trợ
                giảng dạy bộ môn an toàn theo từng tài khoản.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#102744]">
                  <ShieldCheck className="w-4 h-4 text-[#0C9BA6]" />
                  <span>Bảo vệ dữ liệu học sinh</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Người chưa đăng nhập và chưa được cấp quyền không thể xem hồ sơ, điểm số hay thông tin phụ huynh.
                </p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#102744]">
                  <CheckCircle2 className="w-4 h-4 text-[#0C9BA6]" />
                  <span>Cô lập theo từng lớp & năm học</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Mỗi giáo viên quản lý không gian lớp riêng biệt; mọi phiếu cán bộ lớp đều phải qua GVCN duyệt.
                </p>
              </div>
            </div>
          </div>

          {/* Cột cổng đăng nhập 2 lựa chọn */}
          <div className="lg:col-span-6">
            <div className="bg-white rounded-3xl shadow-xl border border-slate-200/90 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0f172a] via-[#102744] to-[#0C9BA6] px-6 py-5 text-white">
                <h2 className="text-lg font-bold tracking-tight">Cổng Đăng nhập Hệ thống</h2>
                <p className="text-xs text-teal-100 mt-0.5">
                  Vui lòng chọn đúng đối tượng sử dụng để xác thực tài khoản
                </p>
              </div>

              <div className="p-6 sm:p-7 space-y-5">
                {/* 2 lựa chọn đăng nhập */}
                <div className="grid grid-cols-2 gap-2.5 p-1.5 rounded-2xl bg-slate-100 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMode('teacher');
                      setOfficerNotice('');
                    }}
                    className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                      loginMode === 'teacher'
                        ? 'bg-[#102744] text-white shadow-sm'
                        : 'text-slate-600 hover:text-[#102744]'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4 shrink-0" />
                    <span>1. Đăng nhập Giáo viên</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMode('officer');
                      setLocalError('');
                    }}
                    className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                      loginMode === 'officer'
                        ? 'bg-[#0C9BA6] text-white shadow-sm'
                        : 'text-slate-600 hover:text-[#102744]'
                    }`}
                  >
                    <Users className="w-4 h-4 shrink-0" />
                    <span>2. Đăng nhập Cán bộ lớp</span>
                  </button>
                </div>

                {displayError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{displayError}</span>
                  </div>
                )}

                {loginMode === 'teacher' ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-700">
                      <div className="font-bold text-[#102744]">Dành cho Giáo viên Chủ nhiệm</div>
                      <p className="leading-relaxed text-slate-600">
                        Đăng nhập bằng tài khoản <strong>Google</strong> thông qua Firebase Authentication.
                        Giáo viên đã được cấp quyền sẽ vào thẳng không gian lớp học của mình. Tài khoản mới
                        sẽ chuyển sang màn hình <strong>Chờ cấp quyền</strong> để đảm bảo an toàn dữ liệu.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleTeacherLogin}
                      disabled={isSigningIn}
                      className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#102744] to-[#0C9BA6] hover:opacity-95 disabled:opacity-60 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2.5"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>
                        {isSigningIn ? 'Đang kết nối Google...' : 'Đăng nhập Giáo viên bằng Google'}
                      </span>
                    </button>

                    <div className="text-[11px] text-slate-500 text-center">
                      Tự động bảo vệ bởi Firebase Authentication, Firestore Security Rules và xác thực API máy chủ.
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleOfficerSubmit} className="space-y-4">
                    <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200/80 text-xs text-teal-950 space-y-1">
                      <div className="font-bold text-[#102744]">
                        Dành cho Lớp trưởng, 4 Tổ trưởng, Thủ quỹ, Bí thư
                      </div>
                      <p className="text-slate-600">
                        Sử dụng <strong>Nickname</strong> (ví dụ: <code>12d6.lt</code>, <code>12d6.tt1</code>,{' '}
                        <code>12d6.tq</code>, <code>12d6.bt</code>) và mật khẩu do GVCN cấp riêng.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Nickname Cán bộ lớp
                        </label>
                        <input
                          type="text"
                          autoComplete="username"
                          value={officerNickname}
                          onChange={(e) => setOfficerNickname(e.target.value)}
                          placeholder="Ví dụ: 12d6.lt hoặc 12d6.tt1"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6] focus:border-[#0C9BA6]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Mật khẩu</label>
                        <div className="relative">
                          <input
                            type={showOfficerPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            value={officerPassword}
                            onChange={(e) => setOfficerPassword(e.target.value)}
                            placeholder="Nhập mật khẩu được GVCN cấp"
                            className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6] focus:border-[#0C9BA6]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowOfficerPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                            aria-label="Ẩn hoặc hiện mật khẩu"
                          >
                            {showOfficerPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {officerNotice && (
                      <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                        {officerNotice}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isOfficerSigningIn}
                      className="w-full py-3 px-4 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 disabled:opacity-60 text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>
                        {isOfficerSigningIn ? 'Đang xác thực Cán bộ lớp...' : 'Đăng nhập Cán bộ lớp'}
                      </span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

interface PendingTeacherGateProps {
  userEmail: string;
  userDisplayName: string;
  accessState: 'unregistered' | 'pending' | 'rejected' | 'revoked';
  existingRequest: TeacherAccessRequest | null;
  onSubmitRequest: (payload: {
    displayName: string;
    requestedSchool: string;
    requestedClass: string;
    requestedSubject: string;
    requestedYear: string;
    note: string;
  }) => Promise<void>;
  onRefreshStatus: () => Promise<void>;
  isSubmitting: boolean;
}

export function PendingTeacherGate({
  userEmail,
  userDisplayName,
  accessState,
  existingRequest,
  onSubmitRequest,
  onRefreshStatus,
  isSubmitting,
}: PendingTeacherGateProps) {
  const [displayName, setDisplayName] = useState(existingRequest?.displayName || userDisplayName || '');
  const [requestedSchool, setRequestedSchool] = useState(existingRequest?.requestedSchool || '');
  const [requestedClass, setRequestedClass] = useState(existingRequest?.requestedClass || '');
  const [requestedSubject, setRequestedSubject] = useState(existingRequest?.requestedSubject || '');
  const [requestedYear, setRequestedYear] = useState(existingRequest?.requestedYear || '2026–2027');
  const [note, setNote] = useState(existingRequest?.note || '');
  const [formError, setFormError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!displayName.trim() || !requestedSchool.trim() || !requestedClass.trim()) {
      setFormError('Vui lòng nhập đầy đủ Họ tên giáo viên, Tên trường và Lớp dự kiến quản lý.');
      return;
    }
    try {
      await onSubmitRequest({
        displayName: displayName.trim(),
        requestedSchool: requestedSchool.trim(),
        requestedClass: requestedClass.trim(),
        requestedSubject: requestedSubject.trim() || 'Chưa chọn',
        requestedYear: requestedYear.trim() || '2026–2027',
        note: note.trim(),
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không thể gửi yêu cầu cấp quyền.');
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshStatus();
    } finally {
      setIsRefreshing(false);
    }
  };

  const statusMeta = {
    unregistered: {
      badge: 'Chờ cấp quyền',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-200',
      title: 'Tài khoản chưa được cấp quyền sử dụng',
      desc: 'Để bảo vệ tuyệt đối dữ liệu học sinh của các lớp đang vận hành, tài khoản Google mới cần gửi yêu cầu và được quản trị viên phê duyệt trước khi tạo không gian lớp học riêng.',
    },
    pending: {
      badge: 'Đang chờ phê duyệt',
      badgeClass: 'bg-sky-100 text-sky-900 border-sky-200',
      title: 'Chờ cấp quyền từ Quản trị viên',
      desc: 'Yêu cầu của bạn đã được ghi nhận an toàn. Ngay khi quản trị viên phê duyệt, bạn sẽ có không gian lớp học độc lập riêng và toàn quyền quản lý lớp mình.',
    },
    rejected: {
      badge: 'Yêu cầu chưa được duyệt',
      badgeClass: 'bg-rose-100 text-rose-900 border-rose-200',
      title: 'Yêu cầu cấp quyền chưa được chấp thuận',
      desc: existingRequest?.reviewNote || 'Vui lòng liên hệ quản trị viên hệ thống nếu cần hỗ trợ cấp quyền.',
    },
    revoked: {
      badge: 'Đã tạm thu hồi quyền',
      badgeClass: 'bg-rose-100 text-rose-900 border-rose-200',
      title: 'Quyền truy cập của tài khoản này đang tạm khóa',
      desc: existingRequest?.reviewNote || 'Vui lòng liên hệ quản trị viên hệ thống để được khôi phục quyền.',
    },
  }[accessState];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-[#0f172a] via-[#102744] to-[#0C9BA6] px-6 py-5 text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Clock className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <h1 className="font-bold text-base">GVCN 360 AI PRO • Cổng kiểm soát truy cập</h1>
              <p className="text-xs text-teal-100 truncate max-w-xs">{userEmail}</p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${statusMeta.badgeClass}`}>
            {statusMeta.badge}
          </span>
        </div>

        <div className="p-6 sm:p-7 space-y-5">
          <div className="space-y-1.5">
            <h2 className="text-lg font-extrabold text-[#102744]">{statusMeta.title}</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{statusMeta.desc}</p>
          </div>

          {accessState === 'unregistered' ? (
            <form onSubmit={handleFormSubmit} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Họ và tên Giáo viên *
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ví dụ: Nguyễn Văn A"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Trường học *
                  </label>
                  <input
                    type="text"
                    required
                    value={requestedSchool}
                    onChange={(e) => setRequestedSchool(e.target.value)}
                    placeholder="Ví dụ: THPT Nguyễn Trãi"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Lớp chủ nhiệm dự kiến *
                  </label>
                  <input
                    type="text"
                    required
                    value={requestedClass}
                    onChange={(e) => setRequestedClass(e.target.value)}
                    placeholder="Ví dụ: 11A2"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Môn giảng dạy
                  </label>
                  <input
                    type="text"
                    value={requestedSubject}
                    onChange={(e) => setRequestedSubject(e.target.value)}
                    placeholder="Ví dụ: Ngữ văn, Vật lí..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Năm học</label>
                  <input
                    type="text"
                    value={requestedYear}
                    onChange={(e) => setRequestedYear(e.target.value)}
                    placeholder="2026–2027"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ghi chú gửi quản trị viên
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Không bắt buộc"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#102744] to-[#0C9BA6] hover:opacity-95 disabled:opacity-60 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu cấp quyền Giáo viên'}</span>
              </button>
            </form>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Họ tên đăng ký:</span>
                <strong className="text-[#102744]">{existingRequest?.displayName || userDisplayName}</strong>
              </div>
              {existingRequest?.requestedSchool && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Trường / Lớp dự kiến:</span>
                  <strong className="text-[#102744]">
                    {existingRequest.requestedSchool} • Lớp {existingRequest.requestedClass}
                  </strong>
                </div>
              )}
              {existingRequest?.requestedSubject && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Môn / Năm học:</span>
                  <strong className="text-[#102744]">
                    {existingRequest.requestedSubject} ({existingRequest.requestedYear || '2026–2027'})
                  </strong>
                </div>
              )}
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#102744] text-xs font-bold flex items-center gap-2 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Kiểm tra lại trạng thái</span>
            </button>

            <button
              type="button"
              onClick={() => signOutUser()}
              className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-2 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất / Đổi tài khoản</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface NewTeacherSetupGateProps {
  userEmail: string;
  defaultTeacherName: string;
  defaultSchool?: string;
  defaultClass?: string;
  defaultSubject?: string;
  defaultYear?: string;
  onCreateFirstWorkspace: (payload: {
    teacherName: string;
    schoolName: string;
    className: string;
    subject: string;
    schoolYear: string;
  }) => Promise<void>;
  isSaving: boolean;
}

export function NewTeacherSetupGate({
  userEmail,
  defaultTeacherName,
  defaultSchool = '',
  defaultClass = '',
  defaultSubject = '',
  defaultYear = '2026–2027',
  onCreateFirstWorkspace,
  isSaving,
}: NewTeacherSetupGateProps) {
  const [teacherName, setTeacherName] = useState(defaultTeacherName);
  const [schoolName, setSchoolName] = useState(defaultSchool);
  const [className, setClassName] = useState(defaultClass);
  const [subject, setSubject] = useState(defaultSubject);
  const [schoolYear, setSchoolYear] = useState(defaultYear);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!teacherName.trim() || !schoolName.trim() || !className.trim() || !subject.trim() || !schoolYear.trim()) {
      setError('Vui lòng nhập đầy đủ Tên giáo viên, Trường, Lớp, Môn giảng dạy và Năm học.');
      return;
    }
    try {
      await onCreateFirstWorkspace({
        teacherName: teacherName.trim(),
        schoolName: schoolName.trim(),
        className: className.trim(),
        subject: subject.trim(),
        schoolYear: schoolYear.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể khởi tạo không gian lớp học.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-[#0f172a] via-[#102744] to-[#0C9BA6] px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <h1 className="font-bold text-base">Khởi tạo Không gian Lớp học Riêng</h1>
              <p className="text-xs text-teal-100">{userEmail} • Đã được phê duyệt quyền Giáo viên</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Chào mừng thầy/cô đến với <strong>GVCN 360 AI PRO</strong>. Hãy thiết lập thông tin lớp đầu tiên
            để hệ thống tạo dữ liệu độc lập hoàn toàn cho tài khoản của thầy/cô.
          </p>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Họ và tên Giáo viên chủ nhiệm *
              </label>
              <input
                type="text"
                required
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                placeholder="Nhập họ tên giáo viên"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Trường học *</label>
              <input
                type="text"
                required
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="Ví dụ: THPT Trần Phú"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Lớp chủ nhiệm *</label>
              <input
                type="text"
                required
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="Ví dụ: 10A1"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Môn giảng dạy *</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ví dụ: Toán, Ngữ văn..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Năm học *</label>
              <input
                type="text"
                required
                value={schoolYear}
                onChange={(e) => setSchoolYear(e.target.value)}
                placeholder="2026–2027"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6]"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => signOutUser()}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất</span>
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#102744] to-[#0C9BA6] hover:opacity-95 disabled:opacity-60 text-white text-sm font-bold shadow-sm flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              <span>{isSaving ? 'Đang khởi tạo...' : 'Khởi tạo Không gian Lớp học'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface OfficerChangePasswordModalProps {
  open: boolean;
  forced?: boolean;
  nickname: string;
  studentName: string;
  onSuccess: () => Promise<void>;
  onClose?: () => void;
}

export function OfficerChangePasswordModal({
  open,
  forced = false,
  nickname,
  studentName,
  onSuccess,
  onClose,
}: OfficerChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự để đảm bảo an toàn.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp với mật khẩu mới.');
      return;
    }
    if (!forced && !currentPassword) {
      setError('Vui lòng nhập mật khẩu hiện tại để xác minh.');
      return;
    }

    setIsSaving(true);
    try {
      await changeCurrentOfficerPassword(newPassword, currentPassword || undefined);
      await onSuccess();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (!forced && onClose) {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đổi mật khẩu. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-[#0f172a] via-[#102744] to-[#0C9BA6] px-6 py-5 text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5 text-teal-200" />
          </div>
          <div>
            <h2 className="font-bold text-base">
              {forced ? 'Đổi mật khẩu bắt buộc lần đầu' : 'Đổi mật khẩu Cán bộ lớp'}
            </h2>
            <p className="text-xs text-teal-100">
              {studentName} • Nickname: <strong>{nickname}</strong>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200 text-xs text-slate-700 leading-relaxed">
            {forced
              ? 'GVCN yêu cầu bạn đặt mật khẩu cá nhân mới (tối thiểu 8 ký tự) trước khi bắt đầu làm việc. Mật khẩu mới được mã hóa trực tiếp trên Firebase Authentication.'
              : 'Nhập mật khẩu hiện tại và mật khẩu mới (tối thiểu 8 ký tự). Không chia sẻ mật khẩu cho học sinh khác.'}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!forced && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mật khẩu hiện tại *
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Nhập mật khẩu đang dùng"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mật khẩu mới (tối thiểu 8 ký tự) *
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nhập mật khẩu mới..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Xác nhận mật khẩu mới *
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6]"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showPasswords}
              onChange={(e) => setShowPasswords(e.target.checked)}
              className="rounded border-slate-300 text-[#0C9BA6] focus:ring-[#0C9BA6]"
            />
            <span>Hiển thị mật khẩu</span>
          </label>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5">
            {forced ? (
              <button
                type="button"
                onClick={() => signOutUser()}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Đăng xuất</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Hủy
              </button>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#102744] to-[#0C9BA6] hover:opacity-95 disabled:opacity-60 text-white text-sm font-bold shadow-sm flex items-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              <span>{isSaving ? 'Đang cập nhật...' : 'Lưu mật khẩu mới'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
