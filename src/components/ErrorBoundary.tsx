import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'Đã xảy ra lỗi không mong muốn.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in GVCN 360 AI PRO:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let friendlyDetail = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage);
        if (parsed && parsed.error) {
          friendlyDetail = `Thao tác Firestore (${parsed.operationType}) tại "${parsed.path}" gặp lỗi: ${parsed.error}`;
        }
      } catch {
        // Giữ nguyên chuỗi thông báo gốc nếu không phải JSON
      }

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white rounded-2xl border border-rose-200 p-6 shadow-lg space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-slate-900">Hệ thống tạm dừng để bảo vệ dữ liệu</h2>
                <p className="text-xs text-slate-500">GVCN 360 AI PRO • Phục hồi phiên làm việc an toàn</p>
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-100 text-xs text-rose-900 break-words">
              {friendlyDetail}
            </div>
            <button
              type="button"
              onClick={this.handleReset}
              className="w-full py-2.5 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 text-white font-bold text-sm flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Tải lại ứng dụng</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
