import React, { useState } from 'react';
import { Sparkles, ShieldCheck, CheckCircle2, LogIn, AlertCircle } from 'lucide-react';
import { signInWithGoogle } from '../firebase';

interface AuthGateProps {
  authError?: string;
}

export function AuthGate({ authError }: AuthGateProps) {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleLogin = async () => {
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

  const displayError = localError || authError;

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-200 p-8 space-y-6">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shrink-0">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-xl text-[#102744] tracking-tight">GVCN 360 AI PRO</h1>
            <p className="text-xs text-teal-700 font-semibold">Phiên bản Hoàn thiện • 4.2</p>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900">Đăng nhập Không gian Chủ nhiệm</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Dữ liệu lớp học, hồ sơ học sinh, thi đua A/B/C, sổ quỹ và bảng điểm vnEdu được bảo mật riêng tư trên Cloud Firestore theo tài khoản Google của Giáo viên.
          </p>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2.5 text-xs text-slate-700">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
            <span>Cách ly dữ liệu đa trường, đa lớp, đa năm học an toàn</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
            <span>Hỗ trợ kiểm thử đầy đủ 8 vị trí vận hành trong lớp</span>
          </div>
        </div>

        {displayError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{displayError}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleLogin}
          disabled={isSigningIn}
          className="w-full py-3.5 px-4 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 disabled:opacity-60 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2.5"
        >
          <LogIn className="w-4 h-4" />
          <span>{isSigningIn ? 'Đang kết nối Google...' : 'Đăng nhập bằng tài khoản Google'}</span>
        </button>
      </div>
    </div>
  );
}
