import React, { useMemo, useState } from 'react';
import {
  Users,
  ClipboardCheck,
  FileText,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  Lock,
  Sparkles,
  ListChecks,
  Eye,
  XCircle,
  RefreshCw,
  Edit3,
  KeyRound,
  LogOut,
  ShieldCheck,
  UserCircle,
} from 'lucide-react';
import { ROLES } from '../../constants/gvcnConstants';
import type {
  AttendanceRecord,
  ClassConfig,
  OfficerMembershipRecord,
  StudentRecord,
  TicketRecord,
} from '../../types/gvcn';

function formatTicketStatus(status: TicketRecord['status']) {
  if (status === 'approved') {
    return {
      label: 'GVCN đã duyệt',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    };
  }
  if (status === 'needs_revision') {
    return {
      label: 'GVCN yêu cầu sửa',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    };
  }
  if (status === 'rejected') {
    return {
      label: 'GVCN từ chối',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
    };
  }
  return {
    label: 'Chờ GVCN duyệt',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
  };
}

function getTodayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function extractTeamReportsForDate(tickets: TicketRecord[], targetDate: string) {
  const byTeam: Record<number, TicketRecord[]> = { 1: [], 2: [], 3: [], 4: [] };
  tickets.forEach((t) => {
    if (t.type !== 'diem_danh') return;
    if (targetDate && t.date !== targetDate) return;
    const match = /^to_truong_([1-4])$/.exec(t.submittedByRole || '');
    if (match) {
      const teamNum = Number(match[1]);
      byTeam[teamNum].push(t);
    }
  });
  return byTeam;
}

// ============================================================================
// 1. TỔNG QUAN LỚP TRƯỞNG
// ============================================================================
interface MonitorOverviewTabProps {
  classConfig: ClassConfig;
  membership: OfficerMembershipRecord;
  currentUserUid: string;
  students: StudentRecord[];
  tickets: TicketRecord[];
  attendanceRecords: AttendanceRecord[];
  onNavigate: (tabId: string) => void;
}

export function MonitorOverviewTab({
  classConfig,
  membership,
  currentUserUid,
  students,
  tickets,
  attendanceRecords,
  onNavigate,
}: MonitorOverviewTabProps) {
  const today = getTodayIso();

  const rosterStats = useMemo(() => {
    const male = students.filter((s) => s.gender === 'Nam').length;
    const female = students.filter((s) => s.gender === 'Nữ').length;
    const teamCounts = [1, 2, 3, 4].map(
      (team) => students.filter((s) => Number(s.team) === team).length
    );
    return { total: students.length, male, female, teamCounts };
  }, [students]);

  const teamReportsToday = useMemo(
    () => extractTeamReportsForDate(tickets, today),
    [tickets, today]
  );

  const reportedTeamCount = useMemo(
    () => [1, 2, 3, 4].filter((t) => teamReportsToday[t].length > 0).length,
    [teamReportsToday]
  );

  const myTickets = useMemo(
    () => tickets.filter((t) => t.submittedByUid === currentUserUid),
    [tickets, currentUserUid]
  );

  const myTodayAttendanceSummary = useMemo(
    () => myTickets.some((t) => t.type === 'diem_danh' && t.date === today),
    [myTickets, today]
  );

  const myTodayClassReport = useMemo(
    () => myTickets.some((t) => t.type === 'ne_nep' && t.date === today),
    [myTickets, today]
  );

  const latestOfficialAttendance = attendanceRecords[0] || null;
  const missingTeams = [1, 2, 3, 4].filter((t) => teamReportsToday[t].length === 0);

  return (
    <div className="space-y-6">
      {/* Banner Không gian làm việc Lớp trưởng */}
      <div className="rounded-3xl bg-gradient-to-r from-[#0f172a] via-[#102744] to-[#0C9BA6] text-white p-6 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white/15 border border-white/20 text-xs font-bold text-teal-100">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {classConfig.schoolName} • Năm học {classConfig.schoolYear} • GVCN: {classConfig.teacherName}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              KHÔNG GIAN LÀM VIỆC LỚP TRƯỞNG – LỚP {classConfig.className}
            </h1>
            <p className="text-xs sm:text-sm text-teal-100/95">
              Xin chào <strong>{membership.studentName}</strong> (<code>{membership.nickname}</code>).
              Mọi báo cáo gửi từ không gian này sẽ được chuyển trực tiếp vào Trung tâm kiểm duyệt của GVCN.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNavigate('monitor_attendance')}
              className="px-4 py-2.5 rounded-xl bg-white text-[#102744] hover:bg-teal-50 text-xs font-bold shadow-xs flex items-center gap-2"
            >
              <ClipboardCheck className="w-4 h-4 text-[#0C9BA6]" />
              <span>Theo dõi chuyên cần</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('monitor_report')}
              className="px-4 py-2.5 rounded-xl bg-teal-400/20 hover:bg-teal-400/30 border border-white/25 text-white text-xs font-bold flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              <span>Báo cáo tình hình lớp</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Thẻ thống kê cơ bản (tuyệt đối không lộ điểm số hay SĐT phụ huynh) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Sĩ số cơ bản</span>
            <Users className="w-4 h-4 text-[#0C9BA6]" />
          </div>
          <div className="text-3xl font-extrabold text-[#102744]">{rosterStats.total}</div>
          <div className="text-xs text-slate-600">
            Nam: <strong>{rosterStats.male}</strong> • Nữ: <strong>{rosterStats.female}</strong>
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            {rosterStats.teamCounts.map((cnt, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded bg-slate-100 text-[11px] font-semibold text-slate-700"
              >
                Tổ {idx + 1}: {cnt}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Số tổ đã gửi báo cáo hôm nay</span>
            <ClipboardCheck className="w-4 h-4 text-[#0C9BA6]" />
          </div>
          <div className="text-3xl font-extrabold text-[#102744]">{reportedTeamCount} / 4</div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {[1, 2, 3, 4].map((teamNum) => {
              const hasSent = teamReportsToday[teamNum].length > 0;
              return (
                <span
                  key={teamNum}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                    hasSent
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  Tổ {teamNum}: {hasSent ? 'Đã gửi' : 'Chưa'}
                </span>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Chuyên cần chính thức gần nhất</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          {latestOfficialAttendance ? (
            <>
              <div className="text-2xl font-extrabold text-emerald-700">
                {latestOfficialAttendance.presentCount}/{latestOfficialAttendance.totalStudents}
              </div>
              <div className="text-xs text-slate-600">
                Ngày {latestOfficialAttendance.date} ({latestOfficialAttendance.session})
              </div>
              <div className="text-[11px] text-slate-500 line-clamp-2">
                {latestOfficialAttendance.absentSummary}
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-500 pt-2">
              Chưa có bản ghi sổ điểm danh chính thức nào được GVCN chốt.
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Báo cáo bạn đã gửi GVCN</span>
            <Send className="w-4 h-4 text-[#0C9BA6]" />
          </div>
          <div className="text-3xl font-extrabold text-[#102744]">{myTickets.length}</div>
          <div className="text-xs text-slate-600 flex flex-wrap gap-2">
            <span className="text-sky-700 font-semibold">
              Chờ duyệt: {myTickets.filter((t) => t.status === 'pending').length}
            </span>
            <span className="text-emerald-700 font-semibold">
              Đã duyệt: {myTickets.filter((t) => t.status === 'approved').length}
            </span>
          </div>
        </div>
      </div>

      {/* Nhiệm vụ đang chờ thực hiện & Phiếu đã gửi gần nhất */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3.5">
          <div className="flex items-center gap-2 font-bold text-sm text-[#102744]">
            <ListChecks className="w-4 h-4 text-[#0C9BA6]" />
            <span>Nhiệm vụ đang chờ thực hiện ({today})</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div
              className={`p-3 rounded-xl border flex items-start justify-between gap-3 ${
                missingTeams.length === 0
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50/80 border-amber-200 text-amber-950'
              }`}
            >
              <div>
                <div className="font-bold">
                  {missingTeams.length === 0
                    ? 'Cả 4 tổ đã gửi báo cáo điểm danh hôm nay'
                    : `Đôn đốc Tổ ${missingTeams.join(', ')} gửi báo cáo điểm danh`}
                </div>
                <div className="text-[11px] opacity-80 mt-0.5">
                  Lớp trưởng theo dõi tiến độ 4 tổ trước khi tổng hợp gửi GVCN.
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('monitor_attendance')}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[#102744] font-bold shrink-0"
              >
                Xem
              </button>
            </div>

            <div
              className={`p-3 rounded-xl border flex items-start justify-between gap-3 ${
                myTodayAttendanceSummary
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <div>
                <div className="font-bold">
                  {myTodayAttendanceSummary
                    ? 'Đã gửi báo cáo tổng hợp chuyên cần hôm nay'
                    : 'Gửi báo cáo tổng hợp điểm danh hằng ngày'}
                </div>
                <div className="text-[11px] opacity-80 mt-0.5">
                  Tổng hợp có mặt, vắng, muộn, chưa xác minh để GVCN kiểm tra.
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('monitor_attendance')}
                className="px-2.5 py-1.5 rounded-lg bg-[#0C9BA6] text-white font-bold shrink-0"
              >
                {myTodayAttendanceSummary ? 'Xem lại' : 'Thực hiện'}
              </button>
            </div>

            <div
              className={`p-3 rounded-xl border flex items-start justify-between gap-3 ${
                myTodayClassReport
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <div>
                <div className="font-bold">
                  {myTodayClassReport
                    ? 'Đã gửi báo cáo tình hình lớp hôm nay'
                    : 'Gửi báo cáo tình hình lớp trong ngày'}
                </div>
                <div className="text-[11px] opacity-80 mt-0.5">
                  Cập nhật nề nếp tập thể, việc tích cực và nội dung đề xuất GVCN hỗ trợ.
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('monitor_report')}
                className="px-2.5 py-1.5 rounded-lg bg-[#102744] text-white font-bold shrink-0"
              >
                {myTodayClassReport ? 'Gửi thêm' : 'Soạn báo cáo'}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm text-[#102744]">
              <Send className="w-4 h-4 text-[#0C9BA6]" />
              <span>Những báo cáo Lớp trưởng đã gửi GVCN</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('monitor_tickets')}
              className="text-xs font-bold text-[#0C9BA6] hover:underline"
            >
              Xem tất cả ({myTickets.length})
            </button>
          </div>

          {myTickets.length === 0 ? (
            <div className="text-xs text-slate-500 py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              Bạn chưa gửi báo cáo nào cho GVCN. Hãy bắt đầu từ mục <strong>Theo dõi chuyên cần</strong> hoặc{' '}
              <strong>Báo cáo tình hình lớp</strong>.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {myTickets.slice(0, 5).map((t) => {
                const st = formatTicketStatus(t.status);
                return (
                  <div key={t.id} className="py-3 flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-[#102744]">{t.category}</span>
                        <span className="text-[11px] text-slate-400">• {t.date}</span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2 whitespace-pre-line">
                        {t.description}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border shrink-0 ${st.badgeClass}`}
                    >
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 2. THEO DÕI CHUYÊN CẦN (LỚP TRƯỞNG)
// ============================================================================
interface MonitorAttendanceTabProps {
  classConfig: ClassConfig;
  allowDirectClassAttendance: boolean;
  students: StudentRecord[];
  tickets: TicketRecord[];
  attendanceRecords: AttendanceRecord[];
  attendanceDate: string;
  setAttendanceDate: (d: string) => void;
  attendanceSession: 'Sáng' | 'Chiều';
  setAttendanceSession: (s: 'Sáng' | 'Chiều') => void;
  dailyAttendanceDraft: Record<
    string,
    { status: 'present' | 'excused' | 'unexcused' | 'late'; note: string }
  >;
  setDailyAttendanceDraft: React.Dispatch<
    React.SetStateAction<
      Record<string, { status: 'present' | 'excused' | 'unexcused' | 'late'; note: string }>
    >
  >;
  isSavingAttendance: boolean;
  onSaveDirectClassAttendanceTicket: () => Promise<void>;
  onSubmitAttendanceSummary: (payload: {
    date: string;
    session: 'Sáng' | 'Chiều';
    totalStudents: number;
    presentCount: number;
    excusedCount: number;
    unexcusedCount: number;
    lateCount: number;
    unverifiedCount: number;
    issuesForTeacher: string;
  }) => Promise<void>;
}

export function MonitorAttendanceTab({
  classConfig,
  allowDirectClassAttendance,
  students,
  tickets,
  attendanceRecords,
  attendanceDate,
  setAttendanceDate,
  attendanceSession,
  setAttendanceSession,
  dailyAttendanceDraft,
  setDailyAttendanceDraft,
  isSavingAttendance,
  onSaveDirectClassAttendanceTicket,
  onSubmitAttendanceSummary,
}: MonitorAttendanceTabProps) {
  const [presentCount, setPresentCount] = useState<number>(students.length);
  const [excusedCount, setExcusedCount] = useState<number>(0);
  const [unexcusedCount, setUnexcusedCount] = useState<number>(0);
  const [lateCount, setLateCount] = useState<number>(0);
  const [unverifiedCount, setUnverifiedCount] = useState<number>(0);
  const [issuesForTeacher, setIssuesForTeacher] = useState('');
  const [isSubmittingSummary, setIsSubmittingSummary] = useState(false);

  const teamReports = useMemo(
    () => extractTeamReportsForDate(tickets, attendanceDate),
    [tickets, attendanceDate]
  );

  const handleSummarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingSummary(true);
    try {
      await onSubmitAttendanceSummary({
        date: attendanceDate,
        session: attendanceSession,
        totalStudents: students.length,
        presentCount: Math.max(0, Number(presentCount) || 0),
        excusedCount: Math.max(0, Number(excusedCount) || 0),
        unexcusedCount: Math.max(0, Number(unexcusedCount) || 0),
        lateCount: Math.max(0, Number(lateCount) || 0),
        unverifiedCount: Math.max(0, Number(unverifiedCount) || 0),
        issuesForTeacher: issuesForTeacher.trim(),
      });
      setIssuesForTeacher('');
    } finally {
      setIsSubmittingSummary(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-[#102744] flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-[#0C9BA6]" />
            <span>Theo dõi chuyên cần – Lớp {classConfig.className}</span>
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Xem báo cáo điểm danh của 4 tổ trưởng (chỉ đọc), tổng hợp chuyên cần hằng ngày và gửi GVCN kiểm duyệt.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="date"
            value={attendanceDate}
            onChange={(e) => setAttendanceDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-[#102744]"
          />
          <select
            value={attendanceSession}
            onChange={(e) => setAttendanceSession(e.target.value as 'Sáng' | 'Chiều')}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-[#102744] bg-white"
          >
            <option value="Sáng">Buổi Sáng</option>
            <option value="Chiều">Buổi Chiều</option>
          </select>
        </div>
      </div>

      {/* Phần 1: Báo cáo điểm danh từ 4 tổ trưởng (CHỈ ĐỌC) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-sm text-[#102744] flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#0C9BA6]" />
            <span>Thông tin điểm danh do 4 Tổ trưởng gửi ngày {attendanceDate}</span>
          </h3>
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
            Chỉ đọc • Không tự sửa dữ liệu gốc tổ trưởng & không tự duyệt
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {[1, 2, 3, 4].map((teamNum) => {
            const list = teamReports[teamNum];
            const teamSize = students.filter((s) => Number(s.team) === teamNum).length;
            return (
              <div
                key={teamNum}
                className={`rounded-2xl border p-4 space-y-2 ${
                  list.length > 0
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : 'bg-amber-50/40 border-amber-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-[#102744]">
                    Tổ {teamNum}{' '}
                    <span className="text-xs font-normal text-slate-500">({teamSize} HS)</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border ${
                      list.length > 0
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : 'bg-amber-100 text-amber-800 border-amber-200'
                    }`}
                  >
                    {list.length > 0 ? `Đã gửi (${list.length})` : 'Chưa gửi báo cáo'}
                  </span>
                </div>

                {list.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Chưa có phiếu điểm danh từ Tổ trưởng Tổ {teamNum} cho ngày {attendanceDate}.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {list.map((t) => {
                      const st = formatTicketStatus(t.status);
                      return (
                        <div
                          key={t.id}
                          className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-[#102744]">{t.category}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${st.badgeClass}`}>
                              {st.label}
                            </span>
                          </div>
                          <p className="text-slate-700 leading-relaxed">{t.description}</p>
                          <div className="text-[11px] text-slate-400">Người gửi: {t.submittedByTitle}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Phần 2: Báo cáo tổng hợp chuyên cần hằng ngày gửi GVCN */}
      <form
        onSubmit={handleSummarySubmit}
        className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4"
      >
        <div>
          <h3 className="font-bold text-sm text-[#102744]">
            Gửi Báo cáo tổng hợp điểm danh hằng ngày ({attendanceDate} • Buổi {attendanceSession})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Tổng hợp số liệu từ 4 tổ và ghi rõ những vấn đề cần GVCN kiểm tra. Phiếu sẽ ở trạng thái Chờ GVCN duyệt.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500">Sĩ số lớp</div>
            <div className="text-xl font-extrabold text-[#102744] mt-1">{students.length}</div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-emerald-700 mb-1">Có mặt</label>
            <input
              type="number"
              min={0}
              max={students.length || 100}
              value={presentCount}
              onChange={(e) => setPresentCount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold text-emerald-800"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-sky-700 mb-1">Vắng có phép</label>
            <input
              type="number"
              min={0}
              max={students.length || 100}
              value={excusedCount}
              onChange={(e) => setExcusedCount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold text-sky-800"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-rose-700 mb-1">Vắng không phép</label>
            <input
              type="number"
              min={0}
              max={students.length || 100}
              value={unexcusedCount}
              onChange={(e) => setUnexcusedCount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold text-rose-800"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-amber-700 mb-1">Đi muộn</label>
            <input
              type="number"
              min={0}
              max={students.length || 100}
              value={lateCount}
              onChange={(e) => setLateCount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold text-amber-800"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Chưa xác minh</label>
            <input
              type="number"
              min={0}
              max={students.length || 100}
              value={unverifiedCount}
              onChange={(e) => setUnverifiedCount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold text-slate-800"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Những vấn đề cần GVCN kiểm tra (ví dụ: tổ chưa báo cáo, học sinh vắng chưa liên hệ được...)
          </label>
          <textarea
            rows={3}
            value={issuesForTeacher}
            onChange={(e) => setIssuesForTeacher(e.target.value)}
            placeholder="Nhập ghi chú cụ thể để GVCN kiểm tra và xử lý..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6]"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmittingSummary}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#102744] to-[#0C9BA6] hover:opacity-95 disabled:opacity-60 text-white text-sm font-bold shadow-xs flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span>
              {isSubmittingSummary ? 'Đang gửi GVCN...' : 'Gửi Báo cáo tổng hợp điểm danh'}
            </span>
          </button>
        </div>
      </form>

      {/* Phần 3: Quyền bổ sung riêng - Điểm danh trực tiếp toàn lớp (mặc định TẮT) */}
      {allowDirectClassAttendance ? (
        <div className="bg-white rounded-2xl border border-teal-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-[#102744]">
                Điểm danh trực tiếp toàn lớp (Quyền bổ sung đã được GVCN bật)
              </h3>
              <p className="text-xs text-slate-500">
                Chọn trạng thái từng học sinh rồi gửi phiếu điểm danh toàn lớp chờ GVCN kiểm duyệt.
              </p>
            </div>
            <button
              type="button"
              disabled={isSavingAttendance}
              onClick={onSaveDirectClassAttendanceTicket}
              className="px-4 py-2 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSavingAttendance ? 'Đang gửi phiếu...' : 'Gửi phiếu điểm danh toàn lớp'}</span>
            </button>
          </div>

          <div className="overflow-x-auto max-h-96 border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2.5 px-3">Học sinh</th>
                  <th className="py-2.5 px-3">Tổ</th>
                  <th className="py-2.5 px-3">Trạng thái</th>
                  <th className="py-2.5 px-3">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((st) => {
                  const entry = dailyAttendanceDraft[st.id] || { status: 'present', note: '' };
                  return (
                    <tr key={st.id}>
                      <td className="py-2 px-3 font-semibold text-[#102744]">{st.fullName}</td>
                      <td className="py-2 px-3 text-slate-500">Tổ {st.team}</td>
                      <td className="py-2 px-3">
                        <select
                          value={entry.status}
                          onChange={(e) =>
                            setDailyAttendanceDraft((prev) => ({
                              ...prev,
                              [st.id]: {
                                ...entry,
                                status: e.target.value as 'present' | 'excused' | 'unexcused' | 'late',
                              },
                            }))
                          }
                          className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-xs"
                        >
                          <option value="present">Có mặt</option>
                          <option value="excused">Vắng CP</option>
                          <option value="unexcused">Vắng KP</option>
                          <option value="late">Đi muộn</option>
                        </select>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={entry.note}
                          onChange={(e) =>
                            setDailyAttendanceDraft((prev) => ({
                              ...prev,
                              [st.id]: { ...entry, note: e.target.value },
                            }))
                          }
                          placeholder="Ghi chú..."
                          className="w-full px-2.5 py-1 rounded-lg border border-slate-200 text-xs"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3 text-xs text-slate-600">
          <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-[#102744]">Điểm danh trực tiếp toàn lớp đang tắt (mặc định).</strong>{' '}
            Theo quy định phân quyền, Lớp trưởng theo dõi báo cáo của 4 tổ trưởng và gửi báo cáo tổng hợp hằng ngày.
            Nếu cần điểm danh trực tiếp toàn lớp, GVCN có thể bật quyền bổ sung riêng trong mục Quản lý tài khoản Cán bộ lớp.
          </div>
        </div>
      )}

      {/* Phần 4: Lịch sử sổ điểm danh chính thức (chỉ đọc) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <h3 className="font-bold text-sm text-[#102744]">
          Lịch sử Sổ điểm danh chính thức đã được GVCN chốt ({attendanceRecords.length})
        </h3>
        {attendanceRecords.length === 0 ? (
          <p className="text-xs text-slate-500">Chưa có bản ghi điểm danh chính thức nào.</p>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {attendanceRecords.slice(0, 10).map((rec) => (
              <div
                key={rec.id}
                className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <span className="font-bold text-[#102744]">
                    {rec.date} ({rec.session})
                  </span>
                  <span className="ml-2 text-emerald-700 font-bold">
                    Có mặt: {rec.presentCount}/{rec.totalStudents}
                  </span>
                  <span className="ml-2 text-slate-600">— {rec.absentSummary}</span>
                </div>
                <span className="text-slate-400 shrink-0">{rec.recordedBy}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 3. BÁO CÁO TÌNH HÌNH LỚP (LỚP TRƯỞNG)
// ============================================================================
interface MonitorClassReportTabProps {
  classConfig: ClassConfig;
  onSubmitClassReport: (payload: {
    date: string;
    weekLabel: string;
    generalSituation: string;
    studyAndDiscipline: string;
    upcomingTasks: string;
    positiveHighlights: string;
    teacherSupportProposals: string;
  }) => Promise<void>;
}

export function MonitorClassReportTab({
  classConfig,
  onSubmitClassReport,
}: MonitorClassReportTabProps) {
  const [date, setDate] = useState(getTodayIso());
  const [weekLabel, setWeekLabel] = useState('Tuần 1');
  const [generalSituation, setGeneralSituation] = useState('');
  const [studyAndDiscipline, setStudyAndDiscipline] = useState('');
  const [upcomingTasks, setUpcomingTasks] = useState('');
  const [positiveHighlights, setPositiveHighlights] = useState('');
  const [teacherSupportProposals, setTeacherSupportProposals] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!generalSituation.trim()) {
      setError('Vui lòng nhập nội dung Tình hình chung trong ngày trước khi gửi GVCN.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitClassReport({
        date,
        weekLabel,
        generalSituation: generalSituation.trim(),
        studyAndDiscipline: studyAndDiscipline.trim(),
        upcomingTasks: upcomingTasks.trim(),
        positiveHighlights: positiveHighlights.trim(),
        teacherSupportProposals: teacherSupportProposals.trim(),
      });
      setGeneralSituation('');
      setStudyAndDiscipline('');
      setUpcomingTasks('');
      setPositiveHighlights('');
      setTeacherSupportProposals('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể gửi báo cáo tình hình lớp.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5"
    >
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-lg font-extrabold text-[#102744] flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#0C9BA6]" />
          <span>Báo cáo tình hình lớp {classConfig.className} gửi GVCN</span>
        </h2>
        <p className="text-xs text-slate-600 mt-1">
          Ghi nhận tình hình chung trong ngày, học tập – nề nếp tập thể, việc tích cực và nội dung đề xuất GVCN hỗ trợ.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Ngày báo cáo *</label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Tuần học</label>
          <input
            type="text"
            value={weekLabel}
            onChange={(e) => setWeekLabel(e.target.value)}
            placeholder="Ví dụ: Tuần 8"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">
          1. Tình hình chung trong ngày *
        </label>
        <textarea
          rows={3}
          required
          value={generalSituation}
          onChange={(e) => setGeneralSituation(e.target.value)}
          placeholder="Ví dụ: Lớp ổn định sĩ số, vệ sinh trực nhật sạch sẽ, 5 tiết học diễn ra nghiêm túc..."
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6]"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">
          2. Tình hình học tập và nề nếp tập thể (ở mức tập thể)
        </label>
        <textarea
          rows={3}
          value={studyAndDiscipline}
          onChange={(e) => setStudyAndDiscipline(e.target.value)}
          placeholder="Ví dụ: Tiết Toán và Ngữ văn lớp phát biểu tích cực; giờ truy bài đầu buổi cần nhắc nhở Tổ 2 giữ trật tự hơn..."
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6]"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            3. Công việc lớp cần thực hiện
          </label>
          <textarea
            rows={3}
            value={upcomingTasks}
            onChange={(e) => setUpcomingTasks(e.target.value)}
            placeholder="Ví dụ: Chuẩn bị tiết sinh hoạt lớp thứ Bảy, phân công trực nhật tuần tới..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6]"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-emerald-700 mb-1">
            4. Ghi nhận những việc tích cực
          </label>
          <textarea
            rows={3}
            value={positiveHighlights}
            onChange={(e) => setPositiveHighlights(e.target.value)}
            placeholder="Ví dụ: Tổ 1 hoàn thành tốt trực nhật sớm, nhiều bạn hỗ trợ nhau ôn bài trước giờ kiểm tra..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6]"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-[#102744] mb-1">
          5. Những nội dung đề xuất GVCN hỗ trợ
        </label>
        <textarea
          rows={2}
          value={teacherSupportProposals}
          onChange={(e) => setTeacherSupportProposals(e.target.value)}
          placeholder="Ví dụ: Đề xuất cô trao đổi thêm với Tổ 3 về kế hoạch trực nhật hoặc sắp xếp lại sơ đồ chỗ ngồi..."
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6]"
        />
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#102744] to-[#0C9BA6] hover:opacity-95 disabled:opacity-60 text-white text-sm font-bold shadow-xs flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          <span>{isSubmitting ? 'Đang gửi báo cáo...' : 'Gửi Báo cáo tình hình lớp cho GVCN'}</span>
        </button>
      </div>
    </form>
  );
}

// ============================================================================
// 4. PHIẾU ĐÃ GỬI (LỚP TRƯỞNG) — Hỗ trợ sửa và gửi lại phiếu bị GVCN yêu cầu bổ sung
// ============================================================================
interface MonitorSentTicketsTabProps {
  currentUserUid: string;
  tickets: TicketRecord[];
  onResubmitRevisedTicket: (
    ticket: TicketRecord,
    updates: { category: string; date: string; description: string }
  ) => Promise<void>;
}

export function MonitorSentTicketsTab({
  currentUserUid,
  tickets,
  onResubmitRevisedTicket,
}: MonitorSentTicketsTabProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | TicketRecord['status']>('all');
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSavingRevision, setIsSavingRevision] = useState(false);
  const [revisionError, setRevisionError] = useState('');

  const myTickets = useMemo(() => {
    const own = tickets.filter((t) => t.submittedByUid === currentUserUid);
    if (statusFilter === 'all') return own;
    return own.filter((t) => t.status === statusFilter);
  }, [tickets, currentUserUid, statusFilter]);

  const startEditingRevision = (t: TicketRecord) => {
    setEditingTicketId(t.id);
    setEditCategory(t.category || '');
    setEditDate(t.date || getTodayIso());
    setEditDescription(t.description || '');
    setRevisionError('');
  };

  const handleSaveRevision = async (t: TicketRecord) => {
    setRevisionError('');
    if (!editDescription.trim()) {
      setRevisionError('Vui lòng nhập nội dung báo cáo đã bổ sung trước khi gửi lại GVCN.');
      return;
    }
    setIsSavingRevision(true);
    try {
      await onResubmitRevisedTicket(t, {
        category: editCategory.trim() || t.category,
        date: editDate || t.date,
        description: editDescription.trim(),
      });
      setEditingTicketId(null);
    } catch (err) {
      setRevisionError(err instanceof Error ? err.message : 'Không thể gửi lại phiếu đã sửa.');
    } finally {
      setIsSavingRevision(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-extrabold text-[#102744] flex items-center gap-2">
            <Send className="w-5 h-5 text-[#0C9BA6]" />
            <span>Phiếu Lớp trưởng đã gửi GVCN</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Theo dõi trạng thái phê duyệt từ GVCN. Với phiếu ở trạng thái <strong>GVCN yêu cầu sửa</strong>, bạn có thể chỉnh sửa và gửi lại để GVCN duyệt.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'all', label: 'Tất cả' },
              { id: 'pending', label: 'Chờ duyệt' },
              { id: 'approved', label: 'Đã duyệt' },
              { id: 'needs_revision', label: 'Cần sửa' },
              { id: 'rejected', label: 'Từ chối' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === f.id
                  ? 'bg-[#102744] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {myTickets.length === 0 ? (
        <div className="text-sm text-slate-500 py-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          Không có phiếu nào trong trạng thái đã chọn.
        </div>
      ) : (
        <div className="space-y-3">
          {myTickets.map((t) => {
            const st = formatTicketStatus(t.status);
            const isEditing = editingTicketId === t.id;
            return (
              <div
                key={t.id}
                className="p-4 rounded-2xl border border-slate-200 hover:border-teal-200 transition-all space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#102744]/10 text-[#102744] text-[11px] font-bold">
                      {t.typeLabel}
                    </span>
                    <span className="font-bold text-sm text-[#102744]">{t.category}</span>
                    <span className="text-xs text-slate-400">• Ngày {t.date}</span>
                    {t.weekLabel && (
                      <span className="text-xs text-slate-400">• {t.weekLabel}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border inline-flex items-center gap-1 ${st.badgeClass}`}
                    >
                      {t.status === 'approved' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : t.status === 'rejected' ? (
                        <XCircle className="w-3.5 h-3.5" />
                      ) : t.status === 'needs_revision' ? (
                        <RefreshCw className="w-3.5 h-3.5" />
                      ) : (
                        <Clock className="w-3.5 h-3.5" />
                      )}
                      <span>{st.label}</span>
                    </span>
                    {t.status === 'needs_revision' && !isEditing && (
                      <button
                        type="button"
                        onClick={() => startEditingRevision(t)}
                        className="px-3 py-1 rounded-lg bg-[#0C9BA6] hover:bg-teal-700 text-white text-xs font-bold inline-flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Sửa & gửi lại</span>
                      </button>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3">
                    <div className="text-xs font-bold text-amber-900">
                      Chỉnh sửa phiếu theo yêu cầu bổ sung của GVCN (sau khi gửi lại, phiếu sẽ về trạng thái Chờ GVCN duyệt)
                    </div>
                    {revisionError && (
                      <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                        {revisionError}
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Tiêu đề / Hạng mục</label>
                        <input
                          type="text"
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          maxLength={140}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Ngày báo cáo</label>
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Nội dung đã bổ sung *</label>
                      <textarea
                        rows={4}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        maxLength={1950}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingTicketId(null)}
                        className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        disabled={isSavingRevision}
                        onClick={() => void handleSaveRevision(t)}
                        className="px-4 py-1.5 rounded-xl bg-[#102744] hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{isSavingRevision ? 'Đang gửi lại...' : 'Gửi lại cho GVCN duyệt'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                    {t.description}
                  </p>
                )}

                {t.reviewedByTeacher && (
                  <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    Người kiểm duyệt: <strong>{t.reviewedByTeacher}</strong>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 5. TÀI KHOẢN (LỚP TRƯỞNG)
// ============================================================================
interface MonitorAccountTabProps {
  classConfig: ClassConfig;
  membership: OfficerMembershipRecord;
  onOpenChangePassword: () => void;
  onSignOut: () => void;
}

export function MonitorAccountTab({
  classConfig,
  membership,
  onOpenChangePassword,
  onSignOut,
}: MonitorAccountTabProps) {
  const roleTitles = (membership.roles || []).map(
    (r) => ROLES.find((def) => def.id === r)?.title || r
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-[#0f172a] via-[#102744] to-[#0C9BA6] text-white flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
            <UserCircle className="w-8 h-8 text-teal-200" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold">{membership.studentName}</h2>
            <p className="text-xs text-teal-100 mt-0.5">
              Nickname đăng nhập: <code className="font-mono font-bold bg-white/15 px-2 py-0.5 rounded">{membership.nickname}</code>
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-xs text-slate-500">Trường & Lớp phụ trách</div>
              <div className="font-bold text-[#102744] mt-0.5">
                Lớp {classConfig.className} — {classConfig.schoolName}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">Năm học {classConfig.schoolYear}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-xs text-slate-500">Giáo viên chủ nhiệm</div>
              <div className="font-bold text-[#102744] mt-0.5">{classConfig.teacherName}</div>
              <div className="text-xs text-slate-500 mt-0.5">Mã học sinh: {membership.studentCode}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-xs text-slate-500">Chức vụ được GVCN cấp</div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {roleTitles.map((title) => (
                  <span
                    key={title}
                    className="px-2.5 py-1 rounded-lg bg-[#102744] text-white text-xs font-bold"
                  >
                    {title}
                  </span>
                ))}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-xs text-slate-500">Phạm vi chuyên cần</div>
              <div className="font-bold text-[#102744] mt-0.5 text-xs sm:text-sm">
                {membership.allowDirectClassAttendance
                  ? 'Tổng hợp 4 tổ + Điểm danh trực tiếp toàn lớp (GVCN đã bật)'
                  : 'Tổng hợp báo cáo chuyên cần từ 4 Tổ trưởng (mặc định)'}
              </div>
              {membership.lastLoginAtMs && (
                <div className="text-[11px] text-slate-500 mt-1">
                  Đăng nhập gần nhất: {new Date(membership.lastLoginAtMs).toLocaleString('vi-VN')}
                </div>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-teal-50/70 border border-teal-200 text-xs text-teal-900 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#0C9BA6] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Tài khoản được xác thực thật qua Firebase Authentication và bảo vệ quyền hạn theo Firestore Security Rules. Mọi phiếu gửi lên đều cần GVCN kiểm duyệt trước khi cập nhật sổ chính thức.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onOpenChangePassword}
              className="px-4 py-2.5 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 text-white text-sm font-bold inline-flex items-center gap-2 shadow-xs"
            >
              <KeyRound className="w-4 h-4" />
              <span>Đổi mật khẩu</span>
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-sm font-bold inline-flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Đăng xuất an toàn</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
