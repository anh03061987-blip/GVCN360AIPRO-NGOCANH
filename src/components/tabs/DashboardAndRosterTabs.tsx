import React from 'react';
import {
  Users,
  CheckCircle2,
  DollarSign,
  BookOpen,
  Sparkles,
  Plus,
  Upload,
  Search,
  Edit3,
  Trash2,
  ClipboardCheck,
  AlertTriangle,
  ShieldCheck,
  Trophy,
  ArrowRight,
  Lock,
  History,
} from 'lucide-react';
import { ROLES, TICKET_TYPES } from '../../constants/gvcnConstants';
import type {
  AttendanceRecord,
  AuditLogRecord,
  ClassConfig,
  OfficerAccountRecord,
  OfficerRoleId,
  PermissionAuditLogRecord,
  RoleDefinition,
  StudentPiiRecord,
  StudentRecord,
  TeacherAccessRequest,
  TeacherAccessStatus,
  WeeklyTeamStat,
} from '../../types/gvcn';
import { OfficerManagementSection } from '../OfficerManagementSection';
import {
  formatDobToDmy,
  getStudentMoetCode,
  stripVietnameseAccents,
} from '../../utils/studentExcelImport';

interface DashboardTabProps {
  classConfig: ClassConfig;
  activeRoleId: string;
  students: StudentRecord[];
  stats: {
    totalStudents: number;
    pendingCount: number;
    approvedCount: number;
    fundBalance: number;
    avgSubjectScore: string | null;
    scoredStudentsCount: number;
    teamStandings: {
      team: number;
      memberCount: number;
      countA: number;
      countB: number;
      countC: number;
      rateA: number;
    }[];
    scoreDistribution: {
      gioi: number;
      kha: number;
      trungBinh: number;
      canHoTro: number;
    };
    earlyWarnings: (StudentRecord & { reasons: string[] })[];
  };
  weeklySnapshotsCount: number;
  auditLogs: AuditLogRecord[];
  onNavigate: (tab: string) => void;
  onSeedSampleStudents: () => void;
}

export function DashboardTab({
  classConfig,
  activeRoleId,
  students,
  stats,
  weeklySnapshotsCount,
  auditLogs,
  onNavigate,
  onSeedSampleStudents,
}: DashboardTabProps) {
  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-[#0f172a] via-[#102744] to-[#0C9BA6] rounded-3xl p-6 md:p-8 text-white shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-teal-200 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {classConfig.schoolName} • Lớp {classConfig.className} • Năm học {classConfig.schoolYear}
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Bảng Điều Hành Chủ Nhiệm — GVCN {classConfig.teacherName}
          </h2>
          <p className="text-sm text-slate-200 max-w-2xl">
            Tổng hợp thời gian thực về sĩ số, thi đua A/B/C theo tiêu chuẩn chính thức, kiểm duyệt phiếu đề xuất, sổ quỹ lớp và kết quả môn {classConfig.subject}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {students.length === 0 && activeRoleId === 'gvcn' && (
            <button
              type="button"
              onClick={onSeedSampleStudents}
              className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-md transition-all"
            >
              Khởi tạo 8 học sinh mẫu
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('tickets')}
            className="px-4 py-2.5 rounded-xl bg-white text-[#102744] hover:bg-slate-100 font-bold text-xs shadow-md transition-all"
          >
            + Lập phiếu đề xuất
          </button>
          <button
            type="button"
            onClick={() => onNavigate('moderation')}
            className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-bold text-xs shadow-md transition-all"
          >
            Kiểm duyệt ({stats.pendingCount})
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('students')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs text-left hover:border-teal-400 transition-all"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
            <span>Sĩ số lớp</span>
            <Users className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-3xl font-extrabold text-[#102744] mt-2">{stats.totalStudents}</div>
          <div className="text-xs text-slate-500 mt-1">Chia đều 4 Tổ học tập</div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('moderation')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs text-left hover:border-amber-400 transition-all"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
            <span>Phiếu chờ duyệt</span>
            <CheckCircle2 className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-3xl font-extrabold text-amber-700 mt-2">{stats.pendingCount}</div>
          <div className="text-xs text-slate-500 mt-1">Đã phê duyệt: {stats.approvedCount} phiếu</div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('fund')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs text-left hover:border-emerald-400 transition-all"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
            <span>Số dư Quỹ lớp</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-2">
            {stats.fundBalance.toLocaleString('vi-VN')} đ
          </div>
          <div className="text-xs text-slate-500 mt-1">Tự động cập nhật khi GVCN duyệt</div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('my_subject')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs text-left hover:border-indigo-400 transition-all"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
            <span>ĐTB Môn {classConfig.subject}</span>
            <BookOpen className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-3xl font-extrabold text-indigo-900 mt-2">
            {stats.avgSubjectScore ?? 'Chưa có'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {stats.scoredStudentsCount}/{stats.totalStudents} HS đã nhập điểm
          </div>
        </button>
      </div>

      {/* Team Standings + Score Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-[#102744] flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>Thống kê Thi đua 4 Tổ ({weeklySnapshotsCount} tuần đã chốt)</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('team_emulation')}
              className="text-xs font-bold text-[#0C9BA6] hover:underline flex items-center gap-1"
            >
              <span>Xem chi tiết</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-2.5">
            {stats.teamStandings.map((t, idx) => (
              <div key={t.team} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-[#102744] text-white text-xs font-bold flex items-center justify-center">
                    #{idx + 1}
                  </span>
                  <div>
                    <div className="font-bold text-sm text-slate-900">Tổ {t.team}</div>
                    <div className="text-xs text-slate-500">Sĩ số: {t.memberCount} HS</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-extrabold text-[#0C9BA6]">{t.rateA}% Loại A</div>
                  <div className="text-[11px] text-slate-500">
                    A: {t.countA} • B: {t.countB} • C: {t.countC}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-[#102744] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <span>Cảnh báo sớm & Phổ điểm Môn {classConfig.subject}</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('vnedu_import')}
              className="text-xs font-bold text-[#0C9BA6] hover:underline"
            >
              Nhập điểm vnEdu
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="font-extrabold text-lg text-emerald-800">{stats.scoreDistribution.gioi}</div>
              <div className="text-emerald-700">Giỏi (≥8.0)</div>
            </div>
            <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200">
              <div className="font-extrabold text-lg text-sky-800">{stats.scoreDistribution.kha}</div>
              <div className="text-sky-700">Khá (6.5–7.9)</div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
              <div className="font-extrabold text-lg text-amber-800">{stats.scoreDistribution.trungBinh}</div>
              <div className="text-amber-700">TB (5.0–6.4)</div>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
              <div className="font-extrabold text-lg text-rose-800">{stats.scoreDistribution.canHoTro}</div>
              <div className="text-rose-700">Cần hỗ trợ</div>
            </div>
          </div>

          {stats.earlyWarnings.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
              Chưa có học sinh nào nằm trong nhóm cảnh báo điểm bộ môn dưới 5.5 hoặc rèn luyện dưới 95.
            </div>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {stats.earlyWarnings.map((w) => (
                <div key={w.id} className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs flex items-center justify-between">
                  <span className="font-bold text-rose-950">
                    {w.fullName} (Tổ {w.team})
                  </span>
                  <span className="text-rose-800">{w.reasons.join(' • ')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Audit Logs */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#102744] flex items-center gap-2">
            <History className="w-4 h-4 text-[#0C9BA6]" />
            <span>Hoạt động kiểm duyệt gần nhất</span>
          </h3>
          <button
            type="button"
            onClick={() => onNavigate('moderation')}
            className="text-xs font-bold text-[#0C9BA6] hover:underline"
          >
            Mở Trung tâm kiểm duyệt
          </button>
        </div>
        {auditLogs.length === 0 ? (
          <p className="text-xs text-slate-500">Chưa có hoạt động kiểm duyệt nào được ghi nhận.</p>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {auditLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <span className="font-bold text-[#102744]">[{log.action}]</span> {log.summary}
                </div>
                <span className="text-slate-400">{log.approvedBy}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface StudentsTabProps {
  activeRoleId: string;
  classConfig: ClassConfig;
  students: StudentRecord[];
  filteredStudents: StudentRecord[];
  studentPiiMap: Record<string, StudentPiiRecord>;
  searchStudent: string;
  setSearchStudent: (v: string) => void;
  filterTeam: string;
  setFilterTeam: (v: string) => void;
  onSeedSampleStudents: () => void;
  onOpenBulkModal: () => void;
  onOpenAddModal: () => void;
  onOpenEditModal: (st: StudentRecord) => void;
  onDeleteStudent: (id: string, name: string) => void;
  onOpenDeleteAllModal: () => void;
}

export function StudentsTab({
  activeRoleId,
  classConfig,
  students,
  filteredStudents,
  studentPiiMap,
  searchStudent,
  setSearchStudent,
  filterTeam,
  setFilterTeam,
  onSeedSampleStudents,
  onOpenBulkModal,
  onOpenAddModal,
  onOpenEditModal,
  onDeleteStudent,
  onOpenDeleteAllModal,
}: StudentsTabProps) {
  const roleLabel = (roleId: string) => {
    if (!roleId || roleId === 'member') return 'Thành viên';
    return ROLES.find((r) => r.id === roleId)?.title || roleId;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#102744]">Hồ sơ Học sinh Lớp {classConfig.className}</h2>
          <p className="text-sm text-slate-500">
            Quản lý sĩ số {students.length} học sinh chia theo 4 Tổ. Thông tin phụ huynh (tên &amp; SĐT) được bảo vệ riêng cho GVCN.
          </p>
        </div>

        {activeRoleId === 'gvcn' && (
          <div className="flex flex-wrap items-center gap-2">
            {students.length === 0 && (
              <button
                type="button"
                onClick={onSeedSampleStudents}
                className="px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold"
              >
                Khởi tạo 8 HS mẫu
              </button>
            )}
            {students.length > 0 && (
              <button
                type="button"
                onClick={onOpenDeleteAllModal}
                className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa tất cả danh sách</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenBulkModal}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Nhập Excel / Dán hàng loạt</span>
            </button>
            <button
              type="button"
              onClick={onOpenAddModal}
              className="px-3.5 py-2 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm học sinh</span>
            </button>
          </div>
        )}
      </div>

      {/* Search & Team Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchStudent}
            onChange={(e) => setSearchStudent(e.target.value)}
            placeholder="Tìm theo họ tên, mã HS hoặc mã MOET..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-teal-600"
          />
        </div>
        <select
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value)}
          className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-medium bg-slate-50"
        >
          <option value="all">Tất cả 4 Tổ ({students.length})</option>
          <option value="1">Tổ 1 ({students.filter((s) => Number(s.team) === 1).length})</option>
          <option value="2">Tổ 2 ({students.filter((s) => Number(s.team) === 2).length})</option>
          <option value="3">Tổ 3 ({students.filter((s) => Number(s.team) === 3).length})</option>
          <option value="4">Tổ 4 ({students.filter((s) => Number(s.team) === 4).length})</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-3 px-4">Mã HS / MOET</th>
                <th className="py-3 px-4">Họ và tên</th>
                <th className="py-3 px-4">Giới tính</th>
                <th className="py-3 px-4">Ngày sinh</th>
                <th className="py-3 px-4">Tổ</th>
                <th className="py-3 px-4">Chức vụ</th>
                <th className="py-3 px-4">Phụ huynh &amp; SĐT</th>
                <th className="py-3 px-4">Ghi chú</th>
                {activeRoleId === 'gvcn' && <th className="py-3 px-4 text-right">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={activeRoleId === 'gvcn' ? 9 : 8} className="py-10 text-center text-slate-500">
                    Chưa có hồ sơ học sinh nào phù hợp bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st) => {
                  const pii = studentPiiMap[st.code] || studentPiiMap[st.id];
                  const phone = pii?.parentPhone || (activeRoleId === 'gvcn' ? st.parentPhone || '' : '');
                  const parentName = pii?.parentName || '';
                  const isMissingParent = stripVietnameseAccents(parentName) === 'khong co';
                  const displayMoet = getStudentMoetCode(st);
                  return (
                    <tr key={st.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-xs font-bold text-slate-700">
                        <div>{st.code}</div>
                        {displayMoet && displayMoet !== st.code && (
                          <div className="text-[11px] font-normal text-indigo-700">
                            MOET: {displayMoet}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">{st.fullName}</td>
                      <td className="py-3 px-4 text-slate-600">{st.gender}</td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600">
                        {formatDobToDmy(st.dob) || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 text-xs font-bold">
                          Tổ {st.team}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <span className="font-semibold text-slate-800">{roleLabel(st.role)}</span>
                        {st.secondRole && (
                          <span className="ml-1.5 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">
                            + {roleLabel(st.secondRole)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        {activeRoleId === 'gvcn' ? (
                          <div className="space-y-0.5">
                            {parentName ? (
                              isMissingParent ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-semibold">
                                  <AlertTriangle className="w-3 h-3" /> Không có
                                </span>
                              ) : (
                                <div className="font-semibold text-slate-800">{parentName}</div>
                              )
                            ) : null}
                            <div className="font-mono text-slate-600">{phone || '—'}</div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            <Lock className="w-3 h-3" /> Chỉ GVCN
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 max-w-xs truncate">{st.note || '—'}</td>
                      {activeRoleId === 'gvcn' && (
                        <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onOpenEditModal(st)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                            title="Sửa hồ sơ"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteStudent(st.id, st.fullName)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700"
                            title="Xóa hồ sơ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface AttendanceTabProps {
  activeRoleId: string;
  currentRole: RoleDefinition;
  students: StudentRecord[];
  attendanceDate: string;
  setAttendanceDate: (v: string) => void;
  attendanceSession: 'Sáng' | 'Chiều';
  setAttendanceSession: (v: 'Sáng' | 'Chiều') => void;
  dailyAttendanceDraft: Record<string, { status: 'present' | 'excused' | 'unexcused' | 'late'; note: string }>;
  setDailyAttendanceDraft: React.Dispatch<
    React.SetStateAction<Record<string, { status: 'present' | 'excused' | 'unexcused' | 'late'; note: string }>>
  >;
  isSavingAttendance: boolean;
  onSaveAttendance: () => void;
  attendanceRecords: AttendanceRecord[];
}

export function AttendanceTab({
  activeRoleId,
  currentRole,
  students,
  attendanceDate,
  setAttendanceDate,
  attendanceSession,
  setAttendanceSession,
  dailyAttendanceDraft,
  setDailyAttendanceDraft,
  isSavingAttendance,
  onSaveAttendance,
  attendanceRecords,
}: AttendanceTabProps) {
  const scopedStudents = students.filter((s) => !currentRole.team || Number(s.team) === currentRole.team);
  const canRecordAttendance = currentRole.allowedTicketTypes.includes('diem_danh');

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#102744]">Điểm danh Hằng ngày</h2>
          <p className="text-sm text-slate-500">
            {activeRoleId === 'gvcn'
              ? 'GVCN lưu trực tiếp vào sổ điểm danh chính thức.'
              : canRecordAttendance
                ? `${currentRole.title} ghi nhận sĩ số phạm vi phụ trách và gửi phiếu chờ GVCN duyệt.`
                : `${currentRole.title} đang ở chế độ chỉ xem sổ điểm danh (không có quyền lập phiếu điểm danh).`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={attendanceDate}
            onChange={(e) => setAttendanceDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
          />
          <select
            value={attendanceSession}
            onChange={(e) => setAttendanceSession(e.target.value as 'Sáng' | 'Chiều')}
            className="px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white font-semibold"
          >
            <option value="Sáng">Buổi Sáng</option>
            <option value="Chiều">Buổi Chiều</option>
          </select>
          {canRecordAttendance ? (
            <button
              type="button"
              disabled={isSavingAttendance || scopedStudents.length === 0}
              onClick={onSaveAttendance}
              className="px-4 py-2 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-1.5"
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>
                {isSavingAttendance
                  ? 'Đang lưu...'
                  : activeRoleId === 'gvcn'
                    ? 'Lưu sổ điểm danh chính thức'
                    : 'Gửi phiếu điểm danh'}
              </span>
            </button>
          ) : (
            <span className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-500 text-xs font-bold flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>Không có quyền điểm danh</span>
            </span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
              <th className="py-3 px-4">Học sinh</th>
              <th className="py-3 px-4">Tổ</th>
              <th className="py-3 px-4">Trạng thái</th>
              <th className="py-3 px-4">Lý do / Ghi chú</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {scopedStudents.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-500">
                  Không có học sinh trong phạm vi điểm danh.
                </td>
              </tr>
            ) : (
              scopedStudents.map((st) => {
                const entry = dailyAttendanceDraft[st.id] || { status: 'present', note: '' };
                return (
                  <tr key={st.id}>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {st.fullName} <span className="text-xs font-mono text-slate-400">({st.code})</span>
                    </td>
                    <td className="py-3 px-4 text-xs font-bold text-sky-700">Tổ {st.team}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        {(
                          [
                            { id: 'present', label: 'Có mặt', cls: 'bg-emerald-600 text-white' },
                            { id: 'late', label: 'Đi muộn', cls: 'bg-amber-500 text-white' },
                            { id: 'excused', label: 'Vắng CP', cls: 'bg-sky-600 text-white' },
                            { id: 'unexcused', label: 'Vắng KP', cls: 'bg-rose-600 text-white' },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() =>
                              setDailyAttendanceDraft((prev) => ({
                                ...prev,
                                [st.id]: { ...entry, status: opt.id },
                              }))
                            }
                            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                              entry.status === opt.id
                                ? opt.cls
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={entry.note}
                        onChange={(e) =>
                          setDailyAttendanceDraft((prev) => ({
                            ...prev,
                            [st.id]: { ...entry, note: e.target.value },
                          }))
                        }
                        placeholder="Ghi chú (nếu vắng/muộn)..."
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs"
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <h3 className="font-bold text-sm text-[#102744]">Lịch sử Sổ Điểm danh chính thức ({attendanceRecords.length})</h3>
        {attendanceRecords.length === 0 ? (
          <p className="text-xs text-slate-500">Chưa có bản ghi điểm danh chính thức nào.</p>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {attendanceRecords.slice(0, 15).map((rec) => (
              <div key={rec.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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

interface RolesTabProps {
  activeRoleId: string;
  onSelectRole: (roleId: string) => void;
  isPrimaryAdmin?: boolean;
  teacherRequests?: TeacherAccessRequest[];
  onUpdateTeacherRequestStatus?: (
    req: TeacherAccessRequest,
    nextStatus: TeacherAccessStatus
  ) => Promise<void>;
  processingTeacherUid?: string | null;
  classConfig?: ClassConfig;
  students?: StudentRecord[];
  officerAccounts?: OfficerAccountRecord[];
  officerLoginStatusMap?: Record<string, { lastLoginAtMs?: number; mustChangePassword?: boolean }>;
  permissionAuditLogs?: PermissionAuditLogRecord[];
  onCreateOfficerAccount?: (payload: {
    student: StudentRecord;
    nickname: string;
    roles: OfficerRoleId[];
    initialPassword: string;
    mustChangePassword: boolean;
    allowDirectClassAttendance?: boolean;
  }) => Promise<{ nickname: string; password: string }>;
  onUpdateOfficerRoles?: (
    account: OfficerAccountRecord,
    nextRoles: OfficerRoleId[]
  ) => Promise<void>;
  onToggleMonitorDirectAttendance?: (account: OfficerAccountRecord) => Promise<void>;
  onToggleOfficerLock?: (account: OfficerAccountRecord) => Promise<void>;
  onResetOfficerPassword?: (
    account: OfficerAccountRecord,
    newPassword: string,
    mustChangePassword: boolean
  ) => Promise<{ nickname: string; password: string }>;
  onBatchResetPasswords?: (
    accounts: OfficerAccountRecord[],
    newPassword: string,
    mustChangePassword: boolean
  ) => Promise<{ succeeded: string[]; failed: { nickname: string; error: string }[] }>;
  onDeleteOfficerAccount?: (account: OfficerAccountRecord) => Promise<void>;
}

export function RolesTab({
  activeRoleId,
  onSelectRole,
  isPrimaryAdmin = false,
  teacherRequests = [],
  onUpdateTeacherRequestStatus,
  processingTeacherUid = null,
  classConfig,
  students = [],
  officerAccounts = [],
  officerLoginStatusMap = {},
  permissionAuditLogs = [],
  onCreateOfficerAccount,
  onUpdateOfficerRoles,
  onToggleMonitorDirectAttendance,
  onToggleOfficerLock,
  onResetOfficerPassword,
  onBatchResetPasswords,
  onDeleteOfficerAccount,
}: RolesTabProps) {
  const pendingTeacherCount = teacherRequests.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#102744]">Phân quyền 8 Vị trí Vận hành Lớp học</h2>
        <p className="text-sm text-slate-500">
          Hệ thống tách bạch rõ quyền lập phiếu đề xuất của Ban cán sự lớp và quyền phê duyệt duy nhất của GVCN.
        </p>
      </div>

      {activeRoleId === 'gvcn' &&
        classConfig &&
        onCreateOfficerAccount &&
        onUpdateOfficerRoles &&
        onToggleOfficerLock &&
        onResetOfficerPassword &&
        onBatchResetPasswords &&
        onDeleteOfficerAccount && (
          <OfficerManagementSection
            classConfig={classConfig}
            students={students}
            officerAccounts={officerAccounts}
            officerLoginStatusMap={officerLoginStatusMap}
            permissionAuditLogs={permissionAuditLogs}
            onCreateOfficerAccount={onCreateOfficerAccount}
            onUpdateOfficerRoles={onUpdateOfficerRoles}
            onToggleMonitorDirectAttendance={onToggleMonitorDirectAttendance}
            onToggleOfficerLock={onToggleOfficerLock}
            onResetOfficerPassword={onResetOfficerPassword}
            onBatchResetPasswords={onBatchResetPasswords}
            onDeleteOfficerAccount={onDeleteOfficerAccount}
          />
        )}

      {isPrimaryAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-r from-[#102744] to-[#0C9BA6] text-white flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-200" />
                <span>Phê duyệt Tài khoản Giáo viên mới (Quản trị hệ thống)</span>
              </h3>
              <p className="text-xs text-teal-100 mt-0.5">
                Tài khoản Google mới đăng nhập sẽ ở trạng thái &ldquo;Chờ cấp quyền&rdquo; cho đến khi bạn phê duyệt. Giáo viên được duyệt chỉ thấy dữ liệu lớp riêng của họ.
              </p>
            </div>
            <span className="px-3 py-1 rounded-lg bg-white/15 text-xs font-bold">
              {pendingTeacherCount} yêu cầu chờ duyệt
            </span>
          </div>

          <div className="p-5">
            {teacherRequests.length === 0 ? (
              <div className="text-sm text-slate-500 text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Chưa có giáo viên nào khác gửi yêu cầu cấp quyền.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase">
                      <th className="py-2.5 pr-4">Giáo viên / Gmail</th>
                      <th className="py-2.5 pr-4">Trường & Lớp dự kiến</th>
                      <th className="py-2.5 pr-4">Trạng thái</th>
                      <th className="py-2.5 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {teacherRequests.map((req) => {
                      const isBusy = processingTeacherUid === req.uid;
                      return (
                        <tr key={req.uid} className="hover:bg-slate-50/70">
                          <td className="py-3 pr-4">
                            <div className="font-bold text-[#102744]">{req.displayName}</div>
                            <div className="text-xs text-slate-500">{req.email}</div>
                            {req.note && (
                              <div className="text-xs text-slate-500 italic mt-0.5">Ghi chú: {req.note}</div>
                            )}
                          </td>
                          <td className="py-3 pr-4">
                            <div className="font-medium text-slate-800">
                              {req.requestedSchool || 'Chưa ghi'} • Lớp {req.requestedClass || '—'}
                            </div>
                            <div className="text-xs text-slate-500">
                              Môn {req.requestedSubject || '—'} ({req.requestedYear || '2026–2027'})
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <span
                              className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold ${
                                req.status === 'approved'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : req.status === 'pending'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {req.status === 'approved'
                                ? 'Đã phê duyệt'
                                : req.status === 'pending'
                                ? 'Chờ cấp quyền'
                                : req.status === 'rejected'
                                ? 'Đã từ chối'
                                : 'Đã thu hồi'}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <div className="inline-flex flex-wrap justify-end gap-1.5">
                              {req.status !== 'approved' && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => onUpdateTeacherRequestStatus?.(req, 'approved')}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold"
                                >
                                  Phê duyệt
                                </button>
                              )}
                              {req.status === 'pending' && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => onUpdateTeacherRequestStatus?.(req, 'rejected')}
                                  className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 border border-rose-200 text-xs font-bold"
                                >
                                  Từ chối
                                </button>
                              )}
                              {req.status === 'approved' && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => onUpdateTeacherRequestStatus?.(req, 'revoked')}
                                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 hover:text-rose-700 disabled:opacity-50 text-slate-700 text-xs font-bold"
                                >
                                  Thu hồi quyền
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ROLES.map((role) => {
          const isActive = role.id === activeRoleId;
          return (
            <div
              key={role.id}
              className={`bg-white p-5 rounded-2xl border shadow-xs flex flex-col justify-between gap-4 ${
                isActive ? 'border-[#0C9BA6] ring-2 ring-[#0C9BA6]/15' : 'border-slate-200'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold ${role.badgeColor}`}>
                    {role.title}
                  </span>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                      role.canApprove
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {role.canApprove ? 'Toàn quyền Phê duyệt' : 'Chỉ lập phiếu đề xuất'}
                  </span>
                </div>
                <p className="text-sm text-slate-700">{role.scope}</p>
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>
                    Loại phiếu được lập:{' '}
                    {role.allowedTicketTypes.map((t) => TICKET_TYPES[t]?.label || t).join(' • ')}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onSelectRole(role.id)}
                className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                }`}
              >
                {isActive ? 'Đang sử dụng vai trò này' : `Chuyển sang vai trò ${role.title}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
