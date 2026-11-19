import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Aperture,
  Check,
  History,
  Lock,
  Maximize2,
  Minimize2,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserCheck,
  UserX,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { ROLES } from '../../constants/gvcnConstants';
import type { ClassConfig, RoleDefinition, StudentRecord } from '../../types/gvcn';
import { CelebrationConfetti, LuckyWheelCanvas } from './LuckyWheelCanvas';
import {
  computeSpinTarget,
  getEligibleWheelStudents,
  getFairRandomInt,
  getScopeDisplayLabel,
  getSliceIndexAtRotation,
  sanitizeStudentsForWheel,
  spinEaseCurve,
  type SafeWheelStudent,
  type WheelRepeatMode,
  type WheelScopeMode,
  type WheelSpinHistoryItem,
} from '../../utils/luckyWheelLogic';

interface LuckyWheelTabProps {
  userId: string;
  classWorkspaceId: string;
  classConfig: Pick<ClassConfig, 'schoolName' | 'className' | 'schoolYear' | 'teacherName' | 'subject'>;
  students: StudentRecord[];
  activeRoleId: string;
  currentRole: RoleDefinition;
  allowedRoleIds: string[];
  onToggleRolePermission: (roleId: string) => void;
  onShowToast: (message: string, type?: 'success' | 'error') => void;
}

export function LuckyWheelTab({
  userId,
  classWorkspaceId,
  classConfig,
  students,
  activeRoleId,
  currentRole,
  allowedRoleIds,
  onToggleRolePermission,
  onShowToast,
}: LuckyWheelTabProps) {
  const safeStudents = useMemo(() => sanitizeStudentsForWheel(students), [students]);

  const hasAccess = activeRoleId === 'gvcn' || allowedRoleIds.includes(activeRoleId);
  const isGvcn = activeRoleId === 'gvcn';

  // Trạng thái cấu hình phiên quay (chỉ dùng trong phiên lớp học, không ghi điểm/thi đua)
  const [scopeMode, setScopeMode] = useState<WheelScopeMode>('all');
  const [repeatMode, setRepeatMode] = useState<WheelRepeatMode>('no_repeat');
  const [manualSelectedCodes, setManualSelectedCodes] = useState<string[]>([]);
  const [absentCodes, setAbsentCodes] = useState<string[]>([]);
  const [calledInCycleCodes, setCalledInCycleCodes] = useState<string[]>([]);
  const [spinHistory, setSpinHistory] = useState<WheelSpinHistoryItem[]>([]);
  const [rosterSearch, setRosterSearch] = useState('');
  const [rightDeckTab, setRightDeckTab] = useState<'roster' | 'history'>('roster');
  const [showPermissionPanel, setShowPermissionPanel] = useState(false);

  // Trạng thái quay & trình chiếu
  const [isSpinning, setIsSpinning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [winnerResult, setWinnerResult] = useState<{
    student: SafeWheelStudent;
    turnNumber: number;
    scopeLabel: string;
  } | null>(null);
  const [livePointerName, setLivePointerName] = useState<string>('');
  const [displayWheelSnapshot, setDisplayWheelSnapshot] = useState<{
    students: SafeWheelStudent[];
    rotation: number;
  } | null>(null);

  // Refs cho animation 60fps không gây re-render giữa vòng quay
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const wheelGroupRef = useRef<SVGGElement | null>(null);
  const pointerRef = useRef<SVGGElement | null>(null);
  const rotationRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const pointerFlickTimeoutRef = useRef<number | null>(null);
  const isSpinningRef = useRef<boolean>(false);
  const soundEnabledRef = useRef<boolean>(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastTickTimeRef = useRef<number>(0);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Đồng bộ khi đổi tài khoản hoặc đổi lớp học -> reset toàn bộ phiên quay để tránh lẫn dữ liệu
  useEffect(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (pointerFlickTimeoutRef.current !== null) {
      window.clearTimeout(pointerFlickTimeoutRef.current);
      pointerFlickTimeoutRef.current = null;
    }
    isSpinningRef.current = false;
    rotationRef.current = 0;
    if (wheelGroupRef.current) {
      wheelGroupRef.current.style.transform = 'rotate(0deg)';
    }
    setIsSpinning(false);
    setWinnerResult(null);
    setDisplayWheelSnapshot(null);
    setLivePointerName('');
    setScopeMode('all');
    setAbsentCodes([]);
    setCalledInCycleCodes([]);
    setSpinHistory([]);
    setManualSelectedCodes(safeStudents.map((s) => s.code));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, classWorkspaceId]);

  // Lọc bỏ mã học sinh không còn tồn tại nếu GVCN thêm/xóa học sinh trong lớp hiện tại
  useEffect(() => {
    const validSet = new Set(safeStudents.map((s) => s.code));
    setAbsentCodes((prev) => prev.filter((c) => validSet.has(c)));
    setCalledInCycleCodes((prev) => prev.filter((c) => validSet.has(c)));
    setManualSelectedCodes((prev) => {
      const kept = prev.filter((c) => validSet.has(c));
      return kept.length > 0 || prev.length === 0 ? kept : safeStudents.map((s) => s.code);
    });
  }, [safeStudents]);

  // Dọn dẹp animation & AudioContext khi unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (pointerFlickTimeoutRef.current !== null) {
        window.clearTimeout(pointerFlickTimeoutRef.current);
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Lắng nghe sự kiện thoát fullscreen trình duyệt (Esc)
  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen && !document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  // Khởi tạo / đánh thức Web Audio API
  const getAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      return audioCtxRef.current;
    } catch {
      return null;
    }
  }, []);

  const playTickSound = useCallback(() => {
    if (!soundEnabledRef.current) return;
    const nowMs = performance.now();
    if (nowMs - lastTickTimeRef.current < 34) return;
    lastTickTimeRef.current = nowMs;

    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(760, t);
      osc.frequency.exponentialRampToValueAtTime(340, t + 0.028);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.032);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.035);
    } catch {
      // Bỏ qua lỗi âm thanh nếu trình duyệt chặn
    }
  }, [getAudioContext]);

  const playWinFanfare = useCallback(() => {
    if (!soundEnabledRef.current) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
      notes.forEach((freq, idx) => {
        const start = ctx.currentTime + idx * 0.085;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx === notes.length - 1 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.13, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + (idx === notes.length - 1 ? 0.55 : 0.25));
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.6);
      });
    } catch {
      // Bỏ qua lỗi âm thanh
    }
  }, [getAudioContext]);

  const flickPointer = useCallback(() => {
    const el = pointerRef.current;
    if (!el) return;
    el.style.transform = 'rotate(-14deg)';
    if (pointerFlickTimeoutRef.current !== null) {
      window.clearTimeout(pointerFlickTimeoutRef.current);
    }
    pointerFlickTimeoutRef.current = window.setTimeout(() => {
      if (pointerRef.current) {
        pointerRef.current.style.transform = 'rotate(0deg)';
      }
    }, 65);
  }, []);

  // Danh sách học sinh khả dụng theo bộ lọc hiện tại
  const { scopeStudents, presentScopeStudents, eligibleStudents } = useMemo(
    () =>
      getEligibleWheelStudents({
        students: safeStudents,
        scopeMode,
        manualSelectedCodes,
        absentCodes,
        repeatMode,
        calledInCycleCodes,
      }),
    [safeStudents, scopeMode, manualSelectedCodes, absentCodes, repeatMode, calledInCycleCodes]
  );

  // Khi đang giữ snapshot của lượt vừa quay (để kim dừng khớp đúng lát cắt vừa trúng), giữ nguyên lát cắt đó cho đến lượt tiếp theo hoặc thay đổi cấu hình
  const wheelDisplayStudents = displayWheelSnapshot ? displayWheelSnapshot.students : eligibleStudents;

  // Danh sách hiển thị ở bảng quản lý tham gia / báo vắng bên phải
  const rosterFilterList = useMemo(() => {
    const baseList =
      scopeMode === 'all' || scopeMode === 'manual'
        ? safeStudents
        : safeStudents.filter((s) => s.team === Number(scopeMode.replace('team_', '')));

    const q = rosterSearch.trim().toLowerCase();
    if (!q) return baseList;
    return baseList.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        `tổ ${s.team}`.includes(q)
    );
  }, [safeStudents, scopeMode, rosterSearch]);

  const startSpinWithPool = useCallback(
    (pool: SafeWheelStudent[], modeLabel: string) => {
      if (isSpinningRef.current) return;
      if (pool.length === 0) return;

      // Đánh thức audio context ngay trong sự kiện click
      if (soundEnabledRef.current) {
        getAudioContext();
      }

      const winnerIndex = getFairRandomInt(pool.length);
      const winnerStudent = pool[winnerIndex];
      const startRotation = rotationRef.current;
      const extraSpins = 6 + getFairRandomInt(3); // 6..8 vòng quay
      const targetRotation = computeSpinTarget(startRotation, winnerIndex, pool.length, extraSpins);
      const durationMs = 4600 + getFairRandomInt(900); // 4.6s .. 5.5s

      isSpinningRef.current = true;
      setIsSpinning(true);
      setWinnerResult(null);
      setDisplayWheelSnapshot({ students: pool, rotation: startRotation });
      setLivePointerName(pool[getSliceIndexAtRotation(startRotation, pool.length)]?.fullName || '');

      let lastSliceIdx = getSliceIndexAtRotation(startRotation, pool.length);
      const startTime = performance.now();

      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        const eased = spinEaseCurve(progress);
        const currentAngle = startRotation + (targetRotation - startRotation) * eased;

        rotationRef.current = currentAngle;
        if (wheelGroupRef.current) {
          wheelGroupRef.current.style.transform = `rotate(${currentAngle}deg)`;
        }

        const currentIdx = getSliceIndexAtRotation(currentAngle, pool.length);
        if (currentIdx !== lastSliceIdx) {
          lastSliceIdx = currentIdx;
          setLivePointerName(pool[currentIdx]?.fullName || '');
          if (pool.length > 1) {
            playTickSound();
            flickPointer();
          }
        }

        if (progress < 1) {
          rafIdRef.current = requestAnimationFrame(animate);
        } else {
          rafIdRef.current = null;
          rotationRef.current = targetRotation;
          if (wheelGroupRef.current) {
            wheelGroupRef.current.style.transform = `rotate(${targetRotation}deg)`;
          }

          // Đối chiếu chéo lần cuối từ góc dừng thực tế để đảm bảo kết quả & kim trùng khớp 100%
          const finalIdx = getSliceIndexAtRotation(targetRotation, pool.length);
          const verifiedWinner = pool[finalIdx] || winnerStudent;

          isSpinningRef.current = false;
          setIsSpinning(false);
          setLivePointerName(verifiedWinner.fullName);
          setDisplayWheelSnapshot({ students: pool, rotation: targetRotation });

          setSpinHistory((prev) => {
            const turnNumber = prev.length + 1;
            const entry: WheelSpinHistoryItem = {
              id: `${verifiedWinner.code}_${Date.now()}_${turnNumber}`,
              turnNumber,
              studentCode: verifiedWinner.code,
              studentName: verifiedWinner.fullName,
              team: verifiedWinner.team,
              timestampMs: Date.now(),
              scopeLabel: modeLabel,
            };
            setWinnerResult({
              student: verifiedWinner,
              turnNumber,
              scopeLabel: modeLabel,
            });
            return [entry, ...prev];
          });

          if (repeatMode === 'no_repeat') {
            setCalledInCycleCodes((prev) =>
              prev.includes(verifiedWinner.code) ? prev : [...prev, verifiedWinner.code]
            );
          }

          playWinFanfare();
        }
      };

      rafIdRef.current = requestAnimationFrame(animate);
    },
    [flickPointer, getAudioContext, playTickSound, playWinFanfare, repeatMode]
  );

  const handleSpinNow = () => {
    if (isSpinningRef.current) return;
    if (eligibleStudents.length === 0) {
      if (repeatMode === 'no_repeat' && presentScopeStudents.length > 0) {
        onShowToast('Đã gọi hết lượt học sinh. Nhấn "Bắt đầu vòng mới" để tiếp tục quay.', 'error');
      } else {
        onShowToast('Chưa có học sinh nào đủ điều kiện trong phạm vi đã chọn.', 'error');
      }
      return;
    }
    startSpinWithPool(eligibleStudents, getScopeDisplayLabel(scopeMode));
  };

  const handleSpinNext = () => {
    if (isSpinningRef.current) return;
    if (eligibleStudents.length > 0) {
      startSpinWithPool(eligibleStudents, getScopeDisplayLabel(scopeMode));
      return;
    }
    // Nếu vừa gọi đến học sinh cuối cùng trong chế độ không lặp, cho phép bắt đầu vòng mới và quay tiếp luôn
    if (repeatMode === 'no_repeat' && presentScopeStudents.length > 0) {
      setCalledInCycleCodes([]);
      setDisplayWheelSnapshot(null);
      startSpinWithPool(presentScopeStudents, getScopeDisplayLabel(scopeMode));
    }
  };

  const handleChangeScope = (nextScope: WheelScopeMode) => {
    if (isSpinningRef.current) return;
    setScopeMode(nextScope);
    setWinnerResult(null);
    setDisplayWheelSnapshot(null);
    setLivePointerName('');
    if (nextScope === 'manual' && manualSelectedCodes.length === 0) {
      setManualSelectedCodes(safeStudents.map((s) => s.code));
    }
  };

  const handleChangeRepeatMode = (nextMode: WheelRepeatMode) => {
    if (isSpinningRef.current) return;
    setRepeatMode(nextMode);
    setWinnerResult(null);
    setDisplayWheelSnapshot(null);
  };

  const handleToggleAbsent = (code: string) => {
    if (isSpinningRef.current) return;
    setWinnerResult(null);
    setDisplayWheelSnapshot(null);
    setAbsentCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleToggleManualStudent = (code: string) => {
    if (isSpinningRef.current) return;
    setWinnerResult(null);
    setDisplayWheelSnapshot(null);
    setManualSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleResetCycleOnly = () => {
    if (isSpinningRef.current) return;
    setCalledInCycleCodes([]);
    setWinnerResult(null);
    setDisplayWheelSnapshot(null);
    setLivePointerName('');
    onShowToast('Đã mở lại lượt quay mới cho tất cả học sinh đủ điều kiện!');
  };

  const handleResetFullSession = () => {
    if (isSpinningRef.current) return;
    setCalledInCycleCodes([]);
    setAbsentCodes([]);
    setSpinHistory([]);
    setWinnerResult(null);
    setDisplayWheelSnapshot(null);
    setLivePointerName('');
    rotationRef.current = 0;
    if (wheelGroupRef.current) {
      wheelGroupRef.current.style.transform = 'rotate(0deg)';
    }
    onShowToast('Đã đặt lại toàn bộ phiên quay may mắn.');
  };

  const handleToggleFullscreen = async () => {
    const next = !isFullscreen;
    setIsFullscreen(next);
    if (next) {
      try {
        if (stageContainerRef.current?.requestFullscreen && !document.fullscreenElement) {
          await stageContainerRef.current.requestFullscreen();
        }
      } catch {
        // Iframe sandbox có thể chặn native fullscreen; vẫn dùng chế độ toàn màn hình nội bộ mượt mà
      }
    } else {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
      } catch {
        // Bỏ qua
      }
    }
  };

  if (!hasAccess) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-8 max-w-2xl mx-auto text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 text-[#102744] flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-[#102744]">
          Vòng quay may mắn – Gọi tên học sinh
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Vai trò hiện tại là <strong>{currentRole.title}</strong>. Chức năng này chỉ dành cho{' '}
          <strong>Giáo viên chủ nhiệm</strong> hoặc các vị trí Ban cán sự được GVCN cấp phép sử dụng.
        </p>
        <div className="text-xs text-slate-500 pt-1">
          Nếu cần trình chiếu trên lớp, vui lòng chuyển sang vai trò Giáo viên chủ nhiệm hoặc đề nghị GVCN bật quyền truy cập tại mục Phân quyền Vòng quay.
        </div>
      </div>
    );
  }

  const cycleCompleted =
    repeatMode === 'no_repeat' && presentScopeStudents.length > 0 && eligibleStudents.length === 0;
  const studentRolesForPermission = ROLES.filter((r) => r.id !== 'gvcn');

  return (
    <div
      ref={stageContainerRef}
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 bg-gradient-to-br from-slate-50 via-white to-teal-50/50 overflow-y-auto p-4 md:p-6 lg:p-8 flex flex-col gap-4'
          : 'space-y-5'
      }
    >
      {/* Thanh tiêu đề & công cụ nhanh */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#102744] to-[#0C9BA6] text-white flex items-center justify-center shadow-sm shrink-0">
            <Aperture className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-extrabold text-[#102744] tracking-tight">
              VÒNG QUAY MAY MẮN – GỌI TÊN HỌC SINH
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span>Lớp {classConfig.className}</span>
              <span aria-hidden="true">·</span>
              <span>{classConfig.schoolName}</span>
              <span aria-hidden="true">·</span>
              <span>Năm học {classConfig.schoolYear}</span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-teal-700">
                Chỉ phục vụ tương tác lớp học
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isGvcn && (
            <button
              type="button"
              onClick={() => setShowPermissionPanel((prev) => !prev)}
              className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                showPermissionPanel
                  ? 'bg-[#102744] text-white border-[#102744]'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Phân quyền Vòng quay</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setSoundEnabled((prev) => !prev)}
            className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              soundEnabled
                ? 'bg-teal-50 text-teal-800 border-teal-300 hover:bg-teal-100'
                : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>{soundEnabled ? 'Âm thanh: Bật' : 'Âm thanh: Tắt'}</span>
          </button>

          <button
            type="button"
            onClick={handleResetFullSession}
            disabled={isSpinning}
            className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Đặt lại phiên quay</span>
          </button>

          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="px-4 py-2 rounded-xl bg-[#102744] hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span>{isFullscreen ? 'Thu gọn màn hình' : 'Trình chiếu TV 16:9'}</span>
          </button>
        </div>
      </div>

      {/* Bảng phân quyền dành riêng cho GVCN */}
      {isGvcn && showPermissionPanel && (
        <div className="bg-white rounded-2xl border border-teal-200 shadow-xs p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-[#102744]">
                Phân quyền sử dụng Vòng quay may mắn (Lớp {classConfig.className})
              </h3>
              <p className="text-xs text-slate-500">
                Giáo viên chủ nhiệm luôn có toàn quyền. Chọn thêm vị trí Ban cán sự được phép điều khiển vòng quay khi cần:
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPermissionPanel(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              aria-label="Đóng bảng phân quyền"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {studentRolesForPermission.map((r) => {
              const allowed = allowedRoleIds.includes(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onToggleRolePermission(r.id)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    allowed
                      ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <Check className={`w-3.5 h-3.5 ${allowed ? 'opacity-100' : 'opacity-25'}`} />
                  <span>{r.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bố cục chính 2 vùng: Sân khấu Vòng quay (trái) + Điều khiển & Lịch sử (phải) */}
      <div
        className={`grid gap-6 items-start ${
          isFullscreen
            ? 'flex-1 grid-cols-1 lg:grid-cols-12'
            : 'grid-cols-1 xl:grid-cols-12'
        }`}
      >
        {/* VÙNG TRÁI: VÒNG QUAY & HIỂN THỊ KẾT QUẢ */}
        <div
          className={`bg-white rounded-3xl border border-slate-200 shadow-xs p-5 md:p-6 flex flex-col items-center relative overflow-hidden ${
            isFullscreen ? 'lg:col-span-7 xl:col-span-8 h-full justify-center' : 'xl:col-span-7'
          }`}
        >
          <CelebrationConfetti active={Boolean(winnerResult) && !isSpinning} />

          {/* Thanh trạng thái trực tiếp */}
          <div className="w-full flex flex-wrap items-center justify-between gap-2 mb-4 z-10">
            <div className="text-xs font-semibold text-slate-600 flex items-center gap-2">
              <span className="text-[#102744] font-bold">{getScopeDisplayLabel(scopeMode)}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {repeatMode === 'no_repeat'
                  ? `Còn ${eligibleStudents.length}/${presentScopeStudents.length} HS chưa gọi`
                  : `Sẵn sàng ${eligibleStudents.length} HS`}
              </span>
              {absentCodes.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-700 font-semibold tabular-nums">
                    Vắng: {absentCodes.length}
                  </span>
                </>
              )}
            </div>

            {livePointerName && (
              <div className="text-xs font-bold text-[#0C9BA6] bg-teal-50 border border-teal-200 px-3 py-1 rounded-lg max-w-[260px] truncate">
                {isSpinning ? `Đang qua: ${livePointerName}` : `Kim dừng tại: ${livePointerName}`}
              </div>
            )}
          </div>

          {/* Sân khấu bánh xe SVG */}
          <div className="w-full flex items-center justify-center py-2 z-10">
            <LuckyWheelCanvas
              students={wheelDisplayStudents}
              wheelRef={wheelGroupRef}
              pointerRef={pointerRef}
              initialRotation={displayWheelSnapshot ? displayWheelSnapshot.rotation : rotationRef.current}
              isSpinning={isSpinning}
              onCenterSpinClick={() => {
                if (!isSpinning && eligibleStudents.length > 0) {
                  handleSpinNow();
                }
              }}
              sizeClassName={
                isFullscreen
                  ? 'w-full max-w-[420px] sm:max-w-[500px] lg:max-w-[540px] xl:max-w-[600px]'
                  : 'w-full max-w-[360px] sm:max-w-[440px] lg:max-w-[480px]'
              }
            />
          </div>

          {/* Thông báo kết quả nổi bật khi có học sinh trúng chọn */}
          {winnerResult && !isSpinning && (
            <div className="w-full mt-5 p-5 md:p-6 rounded-2xl bg-gradient-to-r from-[#102744] via-[#13365e] to-[#0C9BA6] text-white shadow-lg text-center space-y-3 z-30 relative">
              <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
                <Trophy className="w-4 h-4" />
                <span>Chúc mừng học sinh được gọi — Lượt #{winnerResult.turnNumber}</span>
              </div>

              <div className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight break-words">
                {winnerResult.student.fullName}
              </div>

              <div className="text-sm font-medium text-teal-100 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                <span>Mã HS: {winnerResult.student.code}</span>
                <span aria-hidden="true">·</span>
                <span>Tổ {winnerResult.student.team}</span>
                <span aria-hidden="true">·</span>
                <span>{winnerResult.scopeLabel}</span>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleSpinNext}
                  disabled={presentScopeStudents.length === 0}
                  className="px-7 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-extrabold text-sm md:text-base shadow-md flex items-center gap-2 transition-transform active:scale-[0.98]"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>
                    {cycleCompleted ? 'BẮT ĐẦU VÒNG MỚI & QUAY TIẾP' : 'QUAY TIẾP'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setWinnerResult(null)}
                  className="px-4 py-3 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold text-sm transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          )}

          {/* Nút QUAY NGAY hoặc trạng thái hết lượt / trống */}
          {(!winnerResult || isSpinning) && (
            <div className="w-full mt-5 flex flex-col items-center gap-3 z-10">
              {safeStudents.length === 0 ? (
                <div className="w-full p-4 rounded-2xl bg-amber-50 border border-amber-200 text-center text-sm text-amber-900">
                  Lớp {classConfig.className} chưa có học sinh nào. Hãy thêm danh sách ở mục{' '}
                  <strong>Hồ sơ học sinh</strong> để sử dụng vòng quay.
                </div>
              ) : cycleCompleted ? (
                <div className="w-full p-4 rounded-2xl bg-teal-50 border border-teal-200 text-center space-y-3">
                  <div className="text-sm font-bold text-[#102744] flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4 text-teal-600" />
                    <span>
                      Đã gọi hết tất cả {presentScopeStudents.length} học sinh đủ điều kiện trong phạm vi{' '}
                      {getScopeDisplayLabel(scopeMode)}!
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetCycleOnly}
                    className="px-6 py-3 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 text-white font-bold text-sm shadow-md inline-flex items-center gap-2 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Bắt đầu vòng mới (giữ lịch sử)</span>
                  </button>
                </div>
              ) : eligibleStudents.length === 0 ? (
                <div className="w-full p-4 rounded-2xl bg-slate-100 border border-slate-200 text-center space-y-2">
                  <p className="text-sm font-semibold text-slate-700">
                    Không còn học sinh nào đủ điều kiện quay trong phạm vi hiện tại.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {absentCodes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setAbsentCodes([])}
                        className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-700"
                      >
                        Bỏ đánh dấu vắng ({absentCodes.length})
                      </button>
                    )}
                    {scopeMode === 'manual' && (
                      <button
                        type="button"
                        onClick={() => setManualSelectedCodes(safeStudents.map((s) => s.code))}
                        className="px-3.5 py-2 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 text-xs font-bold text-white"
                      >
                        Chọn tất cả học sinh
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSpinNow}
                  disabled={isSpinning}
                  className="px-10 py-4 rounded-2xl bg-gradient-to-r from-[#102744] to-[#0C9BA6] hover:from-[#0f172a] hover:to-teal-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-extrabold text-base md:text-lg tracking-wide shadow-lg hover:shadow-xl transition-all active:scale-[0.98] flex items-center gap-3 min-h-[54px]"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>{isSpinning ? 'ĐANG QUAY VÒNG MAY MẮN...' : 'QUAY NGAY'}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* VÙNG PHẢI: BỘ LỌC PHẠM VI, CHẾ ĐỘ LẶP, BÁO VẮNG & LỊCH SỬ */}
        <div
          className={`space-y-4 ${
            isFullscreen ? 'lg:col-span-5 xl:col-span-4' : 'xl:col-span-5'
          }`}
        >
          {/* Card 1: Phạm vi quay & Chế độ lặp */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                1. Phạm vi gọi tên học sinh
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'all', label: 'Toàn lớp' },
                    { id: 'team_1', label: 'Tổ 1' },
                    { id: 'team_2', label: 'Tổ 2' },
                    { id: 'team_3', label: 'Tổ 3' },
                    { id: 'team_4', label: 'Tổ 4' },
                    { id: 'manual', label: 'Chọn thủ công' },
                  ] as { id: WheelScopeMode; label: string }[]
                ).map((opt) => {
                  const active = scopeMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={isSpinning}
                      onClick={() => handleChangeScope(opt.id)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all disabled:opacity-50 ${
                        active
                          ? 'bg-[#102744] text-white border-[#102744] shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                2. Chế độ lặp trong phiên
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isSpinning}
                  onClick={() => handleChangeRepeatMode('no_repeat')}
                  className={`px-3.5 py-2.5 rounded-xl border text-left transition-all disabled:opacity-50 ${
                    repeatMode === 'no_repeat'
                      ? 'bg-teal-50 border-teal-500 text-teal-950'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="text-xs font-bold">Không lặp tên</div>
                  <div className="text-[11px] opacity-80">Quay hết lượt rồi mới mở lại</div>
                </button>
                <button
                  type="button"
                  disabled={isSpinning}
                  onClick={() => handleChangeRepeatMode('allow_repeat')}
                  className={`px-3.5 py-2.5 rounded-xl border text-left transition-all disabled:opacity-50 ${
                    repeatMode === 'allow_repeat'
                      ? 'bg-teal-50 border-teal-500 text-teal-950'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="text-xs font-bold">Ngẫu nhiên có thể lặp</div>
                  <div className="text-[11px] opacity-80">Mọi học sinh đều có cơ hội mỗi lượt</div>
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Tab chuyển đổi Danh sách tham gia/vắng & Lịch sử đã gọi */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
            <div className="flex border-b border-slate-200 bg-slate-50 p-1.5 gap-1.5">
              <button
                type="button"
                onClick={() => setRightDeckTab('roster')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  rightDeckTab === 'roster'
                    ? 'bg-white text-[#102744] shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Danh sách ({scopeStudents.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setRightDeckTab('history')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  rightDeckTab === 'history'
                    ? 'bg-white text-[#102744] shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <History className="w-4 h-4" />
                <span>Lịch sử đã gọi ({spinHistory.length})</span>
              </button>
            </div>

            {rightDeckTab === 'roster' ? (
              <div className="p-4 space-y-3">
                {/* Tìm kiếm & tác vụ nhanh */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={rosterSearch}
                      onChange={(e) => setRosterSearch(e.target.value)}
                      placeholder="Tìm theo tên hoặc mã HS..."
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                  {absentCodes.length > 0 && (
                    <button
                      type="button"
                      disabled={isSpinning}
                      onClick={() => {
                        setAbsentCodes([]);
                        setDisplayWheelSnapshot(null);
                      }}
                      className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-semibold whitespace-nowrap"
                    >
                      Xóa báo vắng ({absentCodes.length})
                    </button>
                  )}
                </div>

                {scopeMode === 'manual' && (
                  <div className="flex items-center justify-between gap-2 text-xs bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                    <span className="font-semibold text-slate-700">
                      Đã chọn: {manualSelectedCodes.length}/{safeStudents.length} HS
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isSpinning}
                        onClick={() => {
                          setManualSelectedCodes(safeStudents.map((s) => s.code));
                          setDisplayWheelSnapshot(null);
                        }}
                        className="text-teal-700 hover:underline font-bold"
                      >
                        Chọn hết
                      </button>
                      <span aria-hidden="true">·</span>
                      <button
                        type="button"
                        disabled={isSpinning}
                        onClick={() => {
                          setManualSelectedCodes([]);
                          setDisplayWheelSnapshot(null);
                        }}
                        className="text-slate-600 hover:underline font-semibold"
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  </div>
                )}

                {repeatMode === 'no_repeat' && calledInCycleCodes.length > 0 && (
                  <div className="flex items-center justify-between gap-2 text-xs bg-teal-50/70 px-3 py-2 rounded-xl border border-teal-200">
                    <span className="text-teal-900 font-medium">
                      Đã gọi trong vòng này: <strong>{calledInCycleCodes.length}</strong> HS
                    </span>
                    <button
                      type="button"
                      disabled={isSpinning}
                      onClick={handleResetCycleOnly}
                      className="text-teal-700 hover:underline font-bold whitespace-nowrap"
                    >
                      Mở lại lượt
                    </button>
                  </div>
                )}

                {/* Danh sách học sinh */}
                <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100 pr-1">
                  {rosterFilterList.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">
                      Không tìm thấy học sinh phù hợp.
                    </div>
                  ) : (
                    rosterFilterList.map((st) => {
                      const isAbsent = absentCodes.includes(st.code);
                      const isCalled = repeatMode === 'no_repeat' && calledInCycleCodes.includes(st.code);
                      const isManualIncluded = manualSelectedCodes.includes(st.code);

                      return (
                        <div
                          key={st.code}
                          className={`py-2.5 flex items-center justify-between gap-2 ${
                            isAbsent ? 'opacity-60' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {scopeMode === 'manual' && (
                              <input
                                type="checkbox"
                                checked={isManualIncluded}
                                disabled={isSpinning}
                                onChange={() => handleToggleManualStudent(st.code)}
                                aria-label={`Chọn ${st.fullName}`}
                                className="w-4 h-4 rounded accent-teal-600 shrink-0"
                              />
                            )}
                            <div className="min-w-0">
                              <div
                                className={`text-sm font-semibold truncate ${
                                  isAbsent ? 'line-through text-slate-400' : 'text-slate-800'
                                }`}
                              >
                                {st.fullName}
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                                <span className="font-mono">{st.code}</span>
                                <span aria-hidden="true">·</span>
                                <span>Tổ {st.team}</span>
                                {isCalled && !isAbsent && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="text-teal-700 font-semibold">Đã gọi lượt này</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={isSpinning}
                            onClick={() => handleToggleAbsent(st.code)}
                            title={isAbsent ? 'Bỏ đánh dấu vắng' : 'Loại tạm thời học sinh vắng'}
                            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-colors ${
                              isAbsent
                                ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {isAbsent ? (
                              <>
                                <UserX className="w-3.5 h-3.5" />
                                <span>Vắng</span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                                <span>Có mặt</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Ghi nhận các lượt gọi trong phiên làm việc hiện tại</span>
                  {spinHistory.length > 0 && (
                    <button
                      type="button"
                      disabled={isSpinning}
                      onClick={() => setSpinHistory([])}
                      className="text-rose-600 hover:underline font-semibold"
                    >
                      Xóa lịch sử
                    </button>
                  )}
                </div>

                <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100 pr-1">
                  {spinHistory.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-500">
                      Chưa có lượt gọi nào. Nhấn <strong>QUAY NGAY</strong> để bắt đầu.
                    </div>
                  ) : (
                    spinHistory.map((item) => (
                      <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-7 h-7 rounded-lg bg-[#102744] text-white text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
                            #{item.turnNumber}
                          </span>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-900 truncate">
                              {item.studentName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              <span className="font-mono">{item.studentCode}</span> · Tổ {item.team} ·{' '}
                              {item.scopeLabel}
                            </div>
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono shrink-0 tabular-nums">
                          {new Date(item.timestampMs).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                  Lưu ý: Lịch sử phiên quay chỉ phục vụ tương tác gọi tên trên lớp, không tự động ghi vào điểm số, vi phạm hay kết quả thi đua.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
