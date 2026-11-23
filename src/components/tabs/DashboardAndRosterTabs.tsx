import React, { useMemo, useState } from 'react';
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
  X,
  UserCheck,
  ArrowUpDown,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { ROLES, TICKET_TYPES } from '../../constants/gvcnConstants';
import type {
  AttendanceRecord,
  AuditLogRecord,
  ClassConfig,
  OfficerAccountRecord,
  OfficerRoleId,
  PermissionAuditLogRecord,
  RoleAssignmentHistoryRecord,
  RoleAssignmentRecord,
  RoleDefinition,
  StudentPiiRecord,
  StudentRecord,
  TeacherAccessRequest,
  TeacherAccessStatus,
  WeeklyTeamStat,
} from '../../types/gvcn';
import { OfficerManagementSection } from '../OfficerManagementSection';
import {
  ROLE_BADGE_CLASSES,
  ROLE_ID_TO_LABEL,
  VALID_CLASS_OFFICER_ROLES,
  compareStudentsByRosterOrder,
  formatDobToDmy,
  formatStudentRolesLabel,
  getStudentMoetCode,
  getStudentPermissionStatus,
  getStudentRoles,
  getTeamNumberFromRole,
  isMissingPlaceholderValue,
  isValidRosterOrder,
  stripVietnameseAccents,
} from '../../utils/studentExcelImport';
import {
  analyzeOfficerPositionsAndAccounts,
  type OfficerGovernanceSummary,
  type OfficerLiveMembershipStatus,
} from '../../utils/officerReconciliation';

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
  isRealOfficer?: boolean;
  classConfig: ClassConfig;
  students: StudentRecord[];
  filteredStudents: StudentRecord[];
  studentPiiMap: Record<string, StudentPiiRecord>;
  officerAccounts?: OfficerAccountRecord[];
  officerLoginStatusMap?: Record<
    string,
    { active?: boolean; mustChangePassword?: boolean; lastLoginAtMs?: number }
  >;
  permissionAuditLogs?: PermissionAuditLogRecord[];
  searchStudent: string;
  setSearchStudent: (v: string) => void;
  filterTeam: string;
  setFilterTeam: (v: string) => void;
  onSeedSampleStudents: () => void;
  onOpenRosterOrderModal?: () => void;
  onOpenBulkModal: () => void;
  onOpenAddModal: () => void;
  onOpenEditModal: (st: StudentRecord) => void;
  onDeleteStudent: (id: string, name: string) => void;
  onOpenDeleteAllModal: () => void;
  onQuickUpdateStudentRoles?: (payload: {
    student: StudentRecord;
    nextTeam: number;
    nextRoles: OfficerRoleId[];
    replaceHolders?: { student: StudentRecord; roleToRemove: OfficerRoleId }[];
  }) => Promise<void>;
  onNavigateToRoles?: () => void;
}

export function StudentsTab({
  activeRoleId,
  isRealOfficer = false,
  classConfig,
  students,
  filteredStudents,
  studentPiiMap,
  officerAccounts = [],
  officerLoginStatusMap = {},
  permissionAuditLogs = [],
  searchStudent,
  setSearchStudent,
  filterTeam,
  setFilterTeam,
  onSeedSampleStudents,
  onOpenRosterOrderModal,
  onOpenBulkModal,
  onOpenAddModal,
  onOpenEditModal,
  onDeleteStudent,
  onOpenDeleteAllModal,
  onQuickUpdateStudentRoles,
  onNavigateToRoles,
}: StudentsTabProps) {
  const canGvcnManageRoles = !isRealOfficer && activeRoleId === 'gvcn';
  const [filterRole, setFilterRole] = useState<string>('all');
  const [sortMode, setSortMode] = useState<'excel_stt' | 'name_asc' | 'team_asc' | 'code_asc'>('excel_stt');

  // Quick inline role editor modal state (GVCN-only)
  const [roleEditStudent, setRoleEditStudent] = useState<StudentRecord | null>(null);
  const [draftTeam, setDraftTeam] = useState<number>(1);
  const [draftPrimaryRole, setDraftPrimaryRole] = useState<string>('member');
  const [draftSecondRole, setDraftSecondRole] = useState<string>('');
  const [replaceConflictKeys, setReplaceConflictKeys] = useState<Record<string, boolean>>({});
  const [isSavingQuickRole, setIsSavingQuickRole] = useState<boolean>(false);
  const [showStudentRoleHistory, setShowStudentRoleHistory] = useState<boolean>(false);

  const officerAccountByCode = useMemo(() => {
    const map: Record<string, OfficerAccountRecord> = {};
    for (const acc of officerAccounts) {
      map[acc.studentCode] = acc;
    }
    return map;
  }, [officerAccounts]);

  const roleFilteredStudents = useMemo(() => {
    const base =
      filterRole === 'all'
        ? [...filteredStudents]
        : filteredStudents.filter((st) => {
            const stRoles = getStudentRoles(st);
            if (filterRole === 'officers') return stRoles.length > 0;
            if (filterRole === 'member') return stRoles.length === 0;
            return stRoles.includes(filterRole as OfficerRoleId);
          });

    if (sortMode === 'excel_stt') {
      return base.sort(compareStudentsByRosterOrder);
    }
    if (sortMode === 'name_asc') {
      return base.sort((a, b) => {
        const aParts = (a.fullName || '').trim().split(/\s+/);
        const bParts = (b.fullName || '').trim().split(/\s+/);
        const aGiven = aParts[aParts.length - 1] || '';
        const bGiven = bParts[bParts.length - 1] || '';
        const cmpGiven = aGiven.localeCompare(bGiven, 'vi');
        if (cmpGiven !== 0) return cmpGiven;
        return (a.fullName || '').localeCompare(b.fullName || '', 'vi');
      });
    }
    if (sortMode === 'team_asc') {
      return base.sort(
        (a, b) => Number(a.team) - Number(b.team) || compareStudentsByRosterOrder(a, b)
      );
    }
    return base.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  }, [filteredStudents, filterRole, sortMode]);

  const studentsWithRosterOrderCount = useMemo(
    () => students.filter((s) => isValidRosterOrder(s.rosterOrder)).length,
    [students]
  );

  const officerCountSummary = useMemo(() => {
    let totalOfficers = 0;
    let dualRoleCount = 0;
    let activatedCount = 0;
    let missingAccountCount = 0;
    for (const st of students) {
      const roles = getStudentRoles(st);
      if (roles.length > 0) {
        totalOfficers++;
        if (roles.length >= 2) dualRoleCount++;
        const acc = officerAccountByCode[st.code] || officerAccountByCode[st.id];
        if (acc && acc.active && acc.officerUid) {
          activatedCount++;
        } else if (!acc) {
          missingAccountCount++;
        }
      }
    }
    return { totalOfficers, dualRoleCount, activatedCount, missingAccountCount };
  }, [students, officerAccountByCode]);

  const openQuickRoleEditor = (st: StudentRecord) => {
    if (!canGvcnManageRoles) return;
    const currentRoles = getStudentRoles(st);
    setRoleEditStudent(st);
    setDraftTeam(Number(st.team) || 1);
    setDraftPrimaryRole(currentRoles[0] || 'member');
    setDraftSecondRole(currentRoles[1] || '');
    setReplaceConflictKeys({});
    setShowStudentRoleHistory(false);
  };

  const draftSelectedRoles = useMemo<OfficerRoleId[]>(() => {
    const list: OfficerRoleId[] = [];
    if (draftPrimaryRole && draftPrimaryRole !== 'member') {
      list.push(draftPrimaryRole as OfficerRoleId);
    }
    if (
      draftSecondRole &&
      draftSecondRole !== 'member' &&
      draftSecondRole !== draftPrimaryRole
    ) {
      list.push(draftSecondRole as OfficerRoleId);
    }
    return list.slice(0, 2);
  }, [draftPrimaryRole, draftSecondRole]);

  const draftTeamMismatchRole = useMemo(() => {
    for (const r of draftSelectedRoles) {
      const reqTeam = getTeamNumberFromRole(r);
      if (reqTeam !== null && reqTeam !== draftTeam) {
        return { roleId: r, requiredTeam: reqTeam };
      }
    }
    return null;
  }, [draftSelectedRoles, draftTeam]);

  const draftRoleConflicts = useMemo(() => {
    if (!roleEditStudent || draftSelectedRoles.length === 0) return [];
    const conflicts: { key: string; roleId: OfficerRoleId; holder: StudentRecord }[] = [];
    for (const r of draftSelectedRoles) {
      for (const other of students) {
        if (other.id === roleEditStudent.id) continue;
        const otherRoles = getStudentRoles(other);
        if (otherRoles.includes(r)) {
          conflicts.push({
            key: `${other.id}:${r}`,
            roleId: r,
            holder: other,
          });
        }
      }
    }
    return conflicts;
  }, [roleEditStudent, draftSelectedRoles, students]);

  const studentRoleHistory = useMemo(() => {
    if (!roleEditStudent) return [];
    return permissionAuditLogs
      .filter(
        (log) =>
          log.studentCode === roleEditStudent.code ||
          log.studentCode === roleEditStudent.id ||
          log.studentName === roleEditStudent.fullName
      )
      .slice(0, 15);
  }, [roleEditStudent, permissionAuditLogs]);

  const handleConfirmQuickRoleSave = async () => {
    if (!roleEditStudent || !onQuickUpdateStudentRoles || !canGvcnManageRoles) return;
    setIsSavingQuickRole(true);
    try {
      const replaceHolders = draftRoleConflicts
        .filter((c) => Boolean(replaceConflictKeys[c.key]))
        .map((c) => ({ student: c.holder, roleToRemove: c.roleId }));

      await onQuickUpdateStudentRoles({
        student: roleEditStudent,
        nextTeam: draftTeam,
        nextRoles: draftSelectedRoles,
        replaceHolders,
      });
      setRoleEditStudent(null);
    } finally {
      setIsSavingQuickRole(false);
    }
  };

  const permissionToneBadgeClass = (tone: 'slate' | 'amber' | 'sky' | 'emerald' | 'rose') => {
    switch (tone) {
      case 'emerald':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'amber':
        return 'bg-amber-50 text-amber-800 border border-amber-200';
      case 'sky':
        return 'bg-sky-50 text-sky-800 border border-sky-200';
      case 'rose':
        return 'bg-rose-50 text-rose-700 border border-rose-200';
      default:
        return 'bg-slate-100 text-slate-500 border border-slate-200';
    }
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

        {canGvcnManageRoles && (
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
            {students.length > 0 && onOpenRosterOrderModal && (
              <button
                type="button"
                onClick={onOpenRosterOrderModal}
                className="px-3.5 py-2 rounded-xl bg-[#102744] hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-teal-300" />
                <span>Cập nhật STT theo Excel</span>
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

      {/* Quick Class Officers Summary Strip */}
      <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-bold text-[#102744] flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-[#0C9BA6]" />
            <span>Tổng quan Ban cán sự &amp; Thứ tự lớp:</span>
          </span>
          <span
            className={`px-2.5 py-1 rounded-lg font-bold border ${
              students.length > 0 && studentsWithRosterOrderCount === students.length
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            STT Excel: {studentsWithRosterOrderCount}/{students.length} HS
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-[#102744]/10 text-[#102744] font-bold">
            {officerCountSummary.totalOfficers} học sinh có chức vụ
          </span>
          {officerCountSummary.dualRoleCount > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 font-bold">
              {officerCountSummary.dualRoleCount} HS kiêm nhiệm 2 chức vụ
            </span>
          )}
          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
            {officerCountSummary.activatedCount} đã kích hoạt tài khoản
          </span>
          {officerCountSummary.missingAccountCount > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
              {officerCountSummary.missingAccountCount} chưa tạo tài khoản đăng nhập
            </span>
          )}
        </div>
        {canGvcnManageRoles && onNavigateToRoles && (
          <button
            type="button"
            onClick={onNavigateToRoles}
            className="text-xs font-bold text-[#0C9BA6] hover:underline flex items-center gap-1"
          >
            <span>Quản lý tài khoản tại Phân quyền 8 vị trí</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Search, Team, Role & View-Only Sort Filter */}
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
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-medium bg-slate-50"
        >
          <option value="all">Tất cả chức vụ</option>
          <option value="officers">Ban cán sự lớp ({officerCountSummary.totalOfficers})</option>
          <option value="member">Thành viên ({students.length - officerCountSummary.totalOfficers})</option>
          {VALID_CLASS_OFFICER_ROLES.map((rId) => (
            <option key={rId} value={rId}>
              {ROLE_ID_TO_LABEL[rId]}
            </option>
          ))}
        </select>
        <select
          value={sortMode}
          onChange={(e) =>
            setSortMode(e.target.value as 'excel_stt' | 'name_asc' | 'team_asc' | 'code_asc')
          }
          title="Chỉ thay đổi thứ tự xem tạm thời, tuyệt đối không ghi đè STT Excel đã lưu"
          className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-semibold bg-slate-50 text-[#102744]"
        >
          <option value="excel_stt">Sắp xếp: STT Excel (mặc định)</option>
          <option value="name_asc">Xem theo Tên (A → Z)</option>
          <option value="team_asc">Xem theo Tổ (1 → 4)</option>
          <option value="code_asc">Xem theo Mã MOET / Mã HS</option>
        </select>
        {sortMode !== 'excel_stt' && (
          <button
            type="button"
            onClick={() => setSortMode('excel_stt')}
            className="px-3 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 text-xs font-bold inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Khôi phục thứ tự Excel</span>
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-3 px-3 text-center w-14">STT</th>
                <th className="py-3 px-4">Mã HS / MOET</th>
                <th className="py-3 px-4">Họ và tên</th>
                <th className="py-3 px-4">Giới tính</th>
                <th className="py-3 px-4">Ngày sinh</th>
                <th className="py-3 px-4">Tổ</th>
                <th className="py-3 px-4 min-w-[190px]">Chức vụ trong lớp</th>
                <th className="py-3 px-4 min-w-[175px]">Trạng thái phân quyền</th>
                <th className="py-3 px-4">Phụ huynh &amp; SĐT</th>
                <th className="py-3 px-4">Ghi chú</th>
                {canGvcnManageRoles && <th className="py-3 px-4 text-right">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roleFilteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={canGvcnManageRoles ? 11 : 10} className="py-10 text-center text-slate-500">
                    Chưa có hồ sơ học sinh nào phù hợp bộ lọc.
                  </td>
                </tr>
              ) : (
                roleFilteredStudents.map((st) => {
                  const pii = studentPiiMap[st.code] || studentPiiMap[st.id];
                  const rawPhone = pii?.parentPhone || (canGvcnManageRoles ? st.parentPhone || '' : '');
                  const rawParentName = pii?.parentName || '';
                  const parentName = isMissingPlaceholderValue(rawParentName) ? '' : rawParentName.trim();
                  const phone = isMissingPlaceholderValue(rawPhone) ? '' : rawPhone.trim();
                  const isMissingAllParent = !parentName && !phone;
                  const displayMoet = getStudentMoetCode(st);
                  const studentRoles = getStudentRoles(st);
                  const officerAcc = officerAccountByCode[st.code] || officerAccountByCode[st.id] || null;
                  const loginStatus = officerAcc ? officerLoginStatusMap[officerAcc.officerUid] : null;
                  const permStatus = getStudentPermissionStatus(studentRoles, officerAcc, loginStatus);

                  return (
                    <tr key={st.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3 text-center font-mono text-xs font-extrabold text-[#102744]">
                        {isValidRosterOrder(st.rosterOrder) ? (
                          <span className="inline-flex items-center justify-center min-w-[26px] px-1.5 py-0.5 rounded-md bg-slate-100 text-[#102744]">
                            {st.rosterOrder}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal" title="Chưa cập nhật STT theo Excel">
                            —
                          </span>
                        )}
                      </td>
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
                        {st.team >= 1 && st.team <= 4 ? (
                          <span className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 text-xs font-bold whitespace-nowrap">
                            Tổ {st.team}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-300 text-xs font-semibold whitespace-nowrap">
                            Chưa phân tổ
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {canGvcnManageRoles && onQuickUpdateStudentRoles ? (
                          <button
                            type="button"
                            onClick={() => openQuickRoleEditor(st)}
                            title="Nhấn để giao, thêm kiêm nhiệm, đổi hoặc thu hồi chức vụ"
                            className="group inline-flex flex-wrap items-center gap-1.5 text-left rounded-xl p-1 -m-1 hover:bg-teal-50/70 transition"
                          >
                            {studentRoles.length === 0 ? (
                              <span className={`px-2 py-0.5 rounded-md font-medium ${ROLE_BADGE_CLASSES.member}`}>
                                Thành viên
                              </span>
                            ) : (
                              studentRoles.map((rId) => (
                                <span
                                  key={rId}
                                  className={`px-2 py-0.5 rounded-md font-bold whitespace-nowrap ${
                                    ROLE_BADGE_CLASSES[rId] || ROLE_BADGE_CLASSES.member
                                  }`}
                                >
                                  {ROLE_ID_TO_LABEL[rId] || rId}
                                </span>
                              ))
                            )}
                            <Edit3 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition shrink-0" />
                          </button>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {studentRoles.length === 0 ? (
                              <span className={`px-2 py-0.5 rounded-md font-medium ${ROLE_BADGE_CLASSES.member}`}>
                                Thành viên
                              </span>
                            ) : (
                              studentRoles.map((rId) => (
                                <span
                                  key={rId}
                                  className={`px-2 py-0.5 rounded-md font-bold whitespace-nowrap ${
                                    ROLE_BADGE_CLASSES[rId] || ROLE_BADGE_CLASSES.member
                                  }`}
                                >
                                  {ROLE_ID_TO_LABEL[rId] || rId}
                                </span>
                              ))
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="space-y-0.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap ${permissionToneBadgeClass(
                              permStatus.tone
                            )}`}
                          >
                            {permStatus.permissionStatusLabel}
                          </span>
                          {officerAcc && (
                            <div className="text-[11px] text-slate-500 font-mono">
                              TK: {officerAcc.nickname}
                            </div>
                          )}
                          {permStatus.subNote && (
                            <div className="text-[10px] text-amber-700 font-medium">{permStatus.subNote}</div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        {canGvcnManageRoles ? (
                          isMissingAllParent ? (
                            <button
                              type="button"
                              onClick={() => onOpenEditModal(st)}
                              title="Nhấn để bổ sung Tên và SĐT phụ huynh"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-semibold text-[11px] transition"
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                              Chưa cập nhật thông tin phụ huynh
                            </button>
                          ) : (
                            <div className="space-y-0.5">
                              {parentName ? (
                                <div className="font-semibold text-slate-800">{parentName}</div>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-semibold">
                                  Chưa có tên PH
                                </span>
                              )}
                              {phone ? (
                                <div className="font-mono text-slate-600">{phone}</div>
                              ) : (
                                <div className="text-[10px] text-amber-700 font-medium">Chưa có SĐT PH</div>
                              )}
                            </div>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            <Lock className="w-3 h-3" /> Chỉ GVCN
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 max-w-xs truncate">{st.note || '—'}</td>
                      {canGvcnManageRoles && (
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

      {/* GVCN-Only Quick Inline Role Edit Modal */}
      {canGvcnManageRoles && roleEditStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3 gap-3">
              <div>
                <h3 className="font-bold text-base sm:text-lg text-[#102744]">
                  Chỉnh sửa Chức vụ trong lớp
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Học sinh: <strong className="text-slate-900">{roleEditStudent.fullName}</strong> (Mã:{' '}
                  <span className="font-mono">{getStudentMoetCode(roleEditStudent) || roleEditStudent.code}</span>)
                </p>
              </div>
              <button
                type="button"
                disabled={isSavingQuickRole}
                onClick={() => setRoleEditStudent(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-sm">
              {/* Team Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Tổ học tập</label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setDraftTeam(t)}
                      className={`py-2 rounded-xl border text-xs font-bold transition ${
                        draftTeam === t
                          ? 'bg-[#102744] text-white border-[#102744]'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Tổ {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Primary Role */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Chức vụ chính (Vị trí 1)
                </label>
                <select
                  value={draftPrimaryRole}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    if (nextVal === 'member') {
                      // Nếu có chức vụ 2, đôn chức vụ 2 lên thành chức vụ chính để không mất chức vụ còn lại
                      if (draftSecondRole) {
                        setDraftPrimaryRole(draftSecondRole);
                        setDraftSecondRole('');
                      } else {
                        setDraftPrimaryRole('member');
                      }
                      return;
                    }
                    setDraftPrimaryRole(nextVal);
                    if (
                      draftSecondRole === nextVal ||
                      (nextVal.startsWith('to_truong_') && draftSecondRole.startsWith('to_truong_'))
                    ) {
                      setDraftSecondRole('');
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium"
                >
                  <option value="member">Thành viên (không giữ chức vụ)</option>
                  {VALID_CLASS_OFFICER_ROLES.map((rId) => (
                    <option key={rId} value={rId}>
                      {ROLE_ID_TO_LABEL[rId]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Secondary Dual Role */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-600">
                    Chức vụ kiêm nhiệm (Vị trí 2 — Tối đa 2 chức vụ)
                  </label>
                  {draftSecondRole && (
                    <button
                      type="button"
                      onClick={() => setDraftSecondRole('')}
                      className="text-[11px] font-semibold text-rose-600 hover:underline"
                    >
                      Gỡ chức vụ kiêm nhiệm
                    </button>
                  )}
                </div>
                <select
                  value={draftSecondRole}
                  disabled={draftPrimaryRole === 'member'}
                  onChange={(e) => setDraftSecondRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">Không kiêm nhiệm</option>
                  {VALID_CLASS_OFFICER_ROLES.filter(
                    (rId) =>
                      rId !== draftPrimaryRole &&
                      !(draftPrimaryRole.startsWith('to_truong_') && rId.startsWith('to_truong_'))
                  ).map((rId) => (
                    <option key={rId} value={rId}>
                      {ROLE_ID_TO_LABEL[rId]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Revoke All */}
              {draftSelectedRoles.length > 0 && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <span className="text-slate-700">
                    Chức vụ sau khi lưu:{' '}
                    <strong className="text-[#102744]">{formatStudentRolesLabel(draftSelectedRoles)}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftPrimaryRole('member');
                      setDraftSecondRole('');
                    }}
                    className="text-rose-700 font-bold hover:underline"
                  >
                    Thu hồi tất cả chức vụ
                  </button>
                </div>
              )}

              {/* Team Mismatch Warning */}
              {draftTeamMismatchRole && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Học sinh đang chọn chức vụ{' '}
                      <strong>{ROLE_ID_TO_LABEL[draftTeamMismatchRole.roleId]}</strong> nhưng Tổ học tập hiện tại là{' '}
                      <strong>Tổ {draftTeam}</strong>. Tổ trưởng cần thuộc đúng Tổ phụ trách.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDraftTeam(draftTeamMismatchRole.requiredTeam)}
                    className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold"
                  >
                    Đồng bộ học sinh sang Tổ {draftTeamMismatchRole.requiredTeam}
                  </button>
                </div>
              )}

              {/* Duplicate Role Holder Conflict Warning (NEVER silently strip!) */}
              {draftRoleConflicts.length > 0 && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-950 space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-rose-900">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Cảnh báo trùng chức vụ trong lớp — Cần GVCN xác nhận:</span>
                  </div>
                  {draftRoleConflicts.map((c) => (
                    <label
                      key={c.key}
                      className="flex items-start gap-2 p-2 rounded-lg bg-white border border-rose-200 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(replaceConflictKeys[c.key])}
                        onChange={(e) =>
                          setReplaceConflictKeys((prev) => ({
                            ...prev,
                            [c.key]: e.target.checked,
                          }))
                        }
                        className="mt-0.5 rounded border-rose-400 text-rose-600"
                      />
                      <span>
                        Vị trí <strong>{ROLE_ID_TO_LABEL[c.roleId]}</strong> hiện đang do{' '}
                        <strong>{c.holder.fullName}</strong> (Tổ {c.holder.team}) đảm nhiệm. Tick chọn nếu muốn{' '}
                        <strong>chuyển chức vụ này khỏi {c.holder.fullName}</strong> (bỏ tick để giữ nguyên bạn cũ).
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {/* Separation of Class Role vs Login Account Notice */}
              <div className="p-2.5 rounded-xl bg-teal-50/70 border border-teal-200 text-[11px] text-teal-950">
                <strong>Lưu ý bảo mật:</strong> Cập nhật chức vụ trong lớp tại đây giúp hiển thị chuẩn xác trên danh sách lớp và bảng tổng hợp. Tài khoản đăng nhập Cán bộ lớp (tạo, khóa hoặc thu hồi quyền đăng nhập) vẫn do GVCN kích hoạt riêng tại mục <strong>Phân quyền 8 vị trí</strong>.
              </div>

              {/* Per-Student Role Change History */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowStudentRoleHistory((v) => !v)}
                  className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-[#0C9BA6]" />
                    <span>Lịch sử thay đổi chức vụ &amp; phân quyền ({studentRoleHistory.length})</span>
                  </span>
                  <span className="text-[#0C9BA6]">{showStudentRoleHistory ? 'Ẩn' : 'Xem'}</span>
                </button>
                {showStudentRoleHistory && (
                  <div className="p-3 max-h-36 overflow-y-auto space-y-2 text-xs bg-white">
                    {studentRoleHistory.length === 0 ? (
                      <div className="text-slate-400 text-center py-2">
                        Chưa có lịch sử điều chỉnh chức vụ nào cho học sinh này.
                      </div>
                    ) : (
                      studentRoleHistory.map((log) => (
                        <div key={log.id} className="border-b border-slate-100 pb-1.5 last:border-b-0 last:pb-0">
                          <div className="font-bold text-[#102744]">{log.action}</div>
                          <div className="text-slate-600">{log.details}</div>
                          <div className="text-[10px] text-slate-400">
                            {log.timestampMs
                              ? new Date(log.timestampMs).toLocaleString('vi-VN')
                              : ''}{' '}
                            • {log.actorEmail}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                disabled={isSavingQuickRole}
                onClick={() => setRoleEditStudent(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isSavingQuickRole}
                onClick={handleConfirmQuickRoleSave}
                className="px-4 py-2 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold"
              >
                {isSavingQuickRole ? 'Đang lưu...' : 'Xác nhận lưu chức vụ'}
              </button>
            </div>
          </div>
        </div>
      )}
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
                <th className="py-3 px-3 text-center w-14">STT</th>
                <th className="py-3 px-4">Học sinh</th>
                <th className="py-3 px-4">Tổ</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4">Lý do / Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scopedStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Không có học sinh trong phạm vi điểm danh.
                  </td>
                </tr>
              ) : (
                scopedStudents.map((st) => {
                  const entry = dailyAttendanceDraft[st.id] || { status: 'present', note: '' };
                  return (
                    <tr key={st.id}>
                      <td className="py-3 px-3 text-center font-mono text-xs font-bold text-slate-600">
                        {isValidRosterOrder(st.rosterOrder) ? st.rosterOrder : '—'}
                      </td>
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
  roleAssignments?: RoleAssignmentRecord[];
  roleAssignmentHistory?: RoleAssignmentHistoryRecord[];
  governance?: OfficerGovernanceSummary;
  officerLoginStatusMap?: Record<string, OfficerLiveMembershipStatus>;
  permissionAuditLogs?: PermissionAuditLogRecord[];
  onOpenReconciliationModal?: () => void;
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
  onLockOfficerWithReason?: (account: OfficerAccountRecord, reason: string) => Promise<void>;
  onRelinkExistingOfficerAccount?: (
    account: OfficerAccountRecord,
    targetStudent: StudentRecord,
    roles: OfficerRoleId[]
  ) => Promise<void>;
  onActivateOfficerPosition?: (payload: {
    roleId: OfficerRoleId;
    securityLockVerifiedByGvcn?: boolean;
  }) => Promise<{ ok: boolean; message: string }>;
  onRevokeOfficerPosition?: (account: OfficerAccountRecord, reason?: string) => Promise<void>;
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
  roleAssignments = [],
  roleAssignmentHistory = [],
  governance: externalGovernance,
  officerLoginStatusMap = {},
  permissionAuditLogs = [],
  onOpenReconciliationModal,
  onCreateOfficerAccount,
  onUpdateOfficerRoles,
  onToggleMonitorDirectAttendance,
  onToggleOfficerLock,
  onLockOfficerWithReason,
  onRelinkExistingOfficerAccount,
  onActivateOfficerPosition,
  onRevokeOfficerPosition,
  onResetOfficerPassword,
  onBatchResetPasswords,
  onDeleteOfficerAccount,
}: RolesTabProps) {
  const pendingTeacherCount = teacherRequests.filter((r) => r.status === 'pending').length;

  const governance = useMemo(
    () =>
      externalGovernance ||
      analyzeOfficerPositionsAndAccounts({
        students,
        officerAccounts,
        roleAssignments,
        officerLoginStatusMap,
      }),
    [externalGovernance, students, officerAccounts, roleAssignments, officerLoginStatusMap]
  );

  const unassignedPositionCount = governance.unassignedPositionsCount;
  const duplicatePositionCount = governance.duplicatePositionsCount;

  const toneClass = (tone: 'slate' | 'amber' | 'sky' | 'emerald' | 'rose') => {
    switch (tone) {
      case 'emerald':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'amber':
        return 'bg-amber-50 text-amber-800 border border-amber-200';
      case 'sky':
        return 'bg-sky-50 text-sky-800 border border-sky-200';
      case 'rose':
        return 'bg-rose-50 text-rose-700 border border-rose-200';
      default:
        return 'bg-slate-100 text-slate-600 border border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#102744]">Phân quyền 8 Vị trí Vận hành Lớp học</h2>
          <p className="text-sm text-slate-500">
            Tách bạch rõ <strong>Chức vụ chính thức</strong> (<code>role_assignments</code>), <strong>Trạng thái tài khoản Firebase Auth</strong> và <strong>Trạng thái quyền trong lớp</strong>. Mọi thay đổi đều yêu cầu GVCN rà soát &amp; xác nhận.
          </p>
        </div>
        {activeRoleId === 'gvcn' && onOpenReconciliationModal && (
          <button
            type="button"
            onClick={onOpenReconciliationModal}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#102744] to-[#0C9BA6] hover:opacity-95 text-white text-xs sm:text-sm font-bold shadow-sm inline-flex items-center gap-2 shrink-0"
          >
            <SlidersHorizontal className="w-4 h-4 text-teal-200" />
            <span>RÀ SOÁT VÀ ĐỒNG BỘ CÁN BỘ LỚP</span>
          </button>
        )}
      </div>

      {/* 8-Position Class Officers Summary Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 bg-gradient-to-r from-[#102744] to-[#0C9BA6] text-white flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-200" />
              <span>Bảng Tổng hợp Ban Cán sự Lớp {classConfig?.className || ''} (8 Vị trí)</span>
            </h3>
            <p className="text-xs text-teal-100 mt-0.5">
              Mỗi chức vụ chỉ có tối đa 1 học sinh chính thức (kiêm nhiệm tối đa 2 chức vụ trên cùng 1 hồ sơ &amp; 1 tài khoản). Dữ liệu Excel chỉ là đề xuất — bảng phân công chính thức do GVCN chốt.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {unassignedPositionCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-amber-400/20 border border-amber-200/40 text-amber-100 font-bold">
                {unassignedPositionCount} vị trí chưa phân công
              </span>
            )}
            {duplicatePositionCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-rose-500/30 border border-rose-200/50 text-rose-100 font-bold">
                {duplicatePositionCount} vị trí phân công trùng
              </span>
            )}
            {unassignedPositionCount === 0 &&
              duplicatePositionCount === 0 &&
              governance.confirmedPositionsCount === 7 && (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-400/20 border border-emerald-200/40 text-emerald-100 font-bold">
                  Đã chốt chuẩn 7/7 vị trí cán bộ
                </span>
              )}
          </div>
        </div>

        {/* 7-Counter Governance Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 p-3.5 bg-slate-50 border-b border-slate-200 text-xs">
          <div className="bg-white rounded-xl border border-slate-200 px-3 py-2">
            <div className="text-[10px] font-bold uppercase text-slate-500">Tổng vị trí CB</div>
            <div className="text-base font-extrabold text-[#102744]">{governance.totalPositions}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 px-3 py-2">
            <div className="text-[10px] font-bold uppercase text-slate-500">Đã xác nhận</div>
            <div className="text-base font-extrabold text-teal-700">
              {governance.confirmedPositionsCount}/7
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 px-3 py-2">
            <div className="text-[10px] font-bold uppercase text-slate-500">Còn trùng</div>
            <div
              className={`text-base font-extrabold ${
                governance.duplicatePositionsCount > 0 ? 'text-rose-600' : 'text-emerald-700'
              }`}
            >
              {governance.duplicatePositionsCount}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 px-3 py-2">
            <div className="text-[10px] font-bold uppercase text-slate-500">TK hoạt động</div>
            <div className="text-base font-extrabold text-emerald-700">
              {governance.activeAccountsCount}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 px-3 py-2">
            <div className="text-[10px] font-bold uppercase text-slate-500">Chờ kích hoạt</div>
            <div className="text-base font-extrabold text-sky-700">
              {governance.pendingActivationAccountsCount}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 px-3 py-2">
            <div className="text-[10px] font-bold uppercase text-slate-500">Khóa / Thu hồi</div>
            <div className="text-base font-extrabold text-rose-700">
              {governance.lockedAccountsCount + governance.revokedAccountsCount}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 px-3 py-2">
            <div className="text-[10px] font-bold uppercase text-slate-500">Liên kết lệch</div>
            <div
              className={`text-base font-extrabold ${
                governance.mismatchedAccountsCount > 0 ? 'text-amber-700' : 'text-slate-700'
              }`}
            >
              {governance.mismatchedAccountsCount}
            </div>
          </div>
        </div>

        {(duplicatePositionCount > 0 || governance.mismatchedAccountsCount > 0) &&
          activeRoleId === 'gvcn' &&
          onOpenReconciliationModal && (
            <div className="px-5 py-3 bg-rose-50/80 border-b border-rose-200 flex flex-wrap items-center justify-between gap-2 text-xs text-rose-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>
                  Phát hiện <strong>{duplicatePositionCount} vị trí phân công trùng</strong> và{' '}
                  <strong>{governance.mismatchedAccountsCount} tài khoản lệch liên kết</strong>. Hệ thống KHÔNG tự xóa hay tự đổi dữ liệu — bấm{' '}
                  <strong>RÀ SOÁT VÀ ĐỒNG BỘ CÁN BỘ LỚP</strong> để chọn đúng 1 học sinh/vị trí, tải bản sao lưu JSON và kích hoạt an toàn.
                </span>
              </div>
              <button
                type="button"
                onClick={onOpenReconciliationModal}
                className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-bold shrink-0"
              >
                Mở Rà soát ngay
              </button>
            </div>
          )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase text-slate-500">
                <th className="py-3 px-4 min-w-[175px]">Chức vụ</th>
                <th className="py-3 px-4 min-w-[230px]">Học sinh đảm nhiệm / Đang đối chiếu</th>
                <th className="py-3 px-4">Tổ</th>
                <th className="py-3 px-4 min-w-[185px]">Trạng thái TK Firebase Auth</th>
                <th className="py-3 px-4 min-w-[195px]">Trạng thái quyền trong lớp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Row 1: GVCN */}
              <tr className="bg-teal-50/30">
                <td className="py-3 px-4">
                  <span className="inline-flex px-2.5 py-1 rounded-lg bg-[#102744] text-white text-xs font-bold">
                    GVCN quản lý lớp
                  </span>
                </td>
                <td className="py-3 px-4 font-bold text-[#102744]">
                  {classConfig?.teacherName || 'Giáo viên chủ nhiệm'}
                  <span className="ml-2 text-[11px] font-medium text-slate-500">
                    ({classConfig?.schoolName || ''})
                  </span>
                </td>
                <td className="py-3 px-4 text-xs font-semibold text-slate-600">Toàn lớp</td>
                <td className="py-3 px-4">
                  <span className="inline-flex px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                    Tài khoản Google (Chính chủ)
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="inline-flex px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                    Đang hoạt động — Toàn quyền
                  </span>
                </td>
              </tr>

              {/* Rows 2-8: 7 Student Officer Positions (from canonical governance summary) */}
              {governance.positions.map((pos) => {
                const isUnassigned = pos.isUnassigned;
                const isDuplicate = pos.isDuplicate;
                return (
                  <tr
                    key={pos.roleId}
                    className={
                      isDuplicate
                        ? 'bg-rose-50/40'
                        : isUnassigned
                          ? 'bg-amber-50/30'
                          : 'hover:bg-slate-50/60'
                    }
                  >
                    <td className="py-3 px-4 align-top">
                      <div className="space-y-1">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold ${
                            ROLE_BADGE_CLASSES[pos.roleId] || 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {pos.label}
                        </span>
                        {pos.isConfirmed && !isDuplicate && (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            GVCN đã xác nhận
                          </div>
                        )}
                        {!pos.isConfirmed && !isUnassigned && !isDuplicate && (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                            Đề xuất từ hồ sơ — Chưa chốt
                          </div>
                        )}
                        {isDuplicate && (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-bold">
                            <AlertTriangle className="w-3 h-3" />
                            Phân công trùng ({pos.candidates.length} HS)
                          </div>
                        )}
                        {pos.hasTeamMismatch && (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                            <AlertTriangle className="w-3 h-3" />
                            Lệch tổ (yêu cầu Tổ {pos.requiredTeam})
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 align-top">
                      {isUnassigned ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
                          <AlertTriangle className="w-3.5 h-3.5" /> Chưa phân công
                        </span>
                      ) : (
                        <div className="space-y-2">
                          {pos.candidates.map((cand) => {
                            const isDual = cand.profileRoles.length >= 2;
                            return (
                              <div key={cand.studentId} className="space-y-0.5">
                                <div className="font-bold text-slate-900 flex flex-wrap items-center gap-1.5">
                                  {isValidRosterOrder(cand.student.rosterOrder) && (
                                    <span className="text-[11px] font-mono text-slate-500">
                                      #{cand.student.rosterOrder}
                                    </span>
                                  )}
                                  <span>{cand.student.fullName}</span>
                                  {cand.inConfirmedAssignment && (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                      Chính thức
                                    </span>
                                  )}
                                  {isDual && (
                                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                                      Kiêm nhiệm ({formatStudentRolesLabel(cand.profileRoles)})
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] font-mono text-slate-500 flex flex-wrap items-center gap-1.5">
                                  <span>MOET: {cand.moetCode || cand.student.code}</span>
                                  {cand.linkedAccount && (
                                    <span className="text-[#0C9BA6] font-bold">
                                      • {cand.linkedAccount.account.nickname}
                                    </span>
                                  )}
                                  {isDuplicate && (
                                    <span className="font-sans text-[10px] text-rose-700">
                                      ({cand.inProfileRoles ? 'Hồ sơ/Excel' : ''}
                                      {cand.inProfileRoles && cand.inAnyAccountRoles ? ' + ' : ''}
                                      {cand.inAnyAccountRoles ? 'TK cũ' : ''})
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 align-top">
                      {isUnassigned ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <div className="space-y-2">
                          {pos.candidates.map((cand) => (
                            <div key={cand.studentId}>
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-bold ${
                                  cand.teamMismatch
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-sky-50 text-sky-800'
                                }`}
                              >
                                Tổ {cand.student.team}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 align-top">
                      <div className="space-y-1">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold ${toneClass(
                            pos.firebaseAuthTone
                          )}`}
                        >
                          {pos.firebaseAuthStatusLabel}
                        </span>
                        {pos.officialAccount?.account.nickname && (
                          <div className="text-[11px] font-mono text-[#0C9BA6] font-bold">
                            Nickname: {pos.officialAccount.account.nickname}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 align-top">
                      <div className="space-y-1">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold ${toneClass(
                            pos.permissionStatusTone
                          )}`}
                        >
                          {pos.permissionStatusLabel}
                        </span>
                        {pos.actionHint && (
                          <div className="text-[10px] text-slate-500 leading-snug max-w-[230px]">
                            {pos.actionHint}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
            roleAssignments={roleAssignments}
            roleAssignmentHistory={roleAssignmentHistory}
            governance={governance}
            officerLoginStatusMap={officerLoginStatusMap}
            permissionAuditLogs={permissionAuditLogs}
            onOpenReconciliationModal={onOpenReconciliationModal}
            onCreateOfficerAccount={onCreateOfficerAccount}
            onUpdateOfficerRoles={onUpdateOfficerRoles}
            onToggleMonitorDirectAttendance={onToggleMonitorDirectAttendance}
            onToggleOfficerLock={onToggleOfficerLock}
            onLockOfficerWithReason={onLockOfficerWithReason}
            onRelinkExistingOfficerAccount={onRelinkExistingOfficerAccount}
            onActivateOfficerPosition={onActivateOfficerPosition}
            onRevokeOfficerPosition={onRevokeOfficerPosition}
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

      <div className="space-y-3">
        <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-[#0C9BA6] shrink-0 mt-0.5" />
          <span>
            <strong>Lưu ý bảo mật (Mục IX):</strong> Chế độ xem bên dưới chỉ giúp GVCN <em>xem bố cục giao diện tham khảo</em>, tuyệt đối không cấp hay thay đổi quyền thật. Để kiểm tra phân quyền thực tế của cán bộ lớp, hãy đăng xuất (hoặc mở trình duyệt ẩn danh) và đăng nhập bằng <strong>Nickname + Mật khẩu</strong> thật của cán bộ lớp.
          </span>
        </div>
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
                  {isActive
                    ? role.id === 'gvcn'
                      ? 'Đang ở chế độ GVCN chính thức'
                      : `Đang xem bố cục tham khảo: ${role.title}`
                    : role.id === 'gvcn'
                      ? 'Quay lại chế độ GVCN chính thức'
                      : `Xem bố cục giao diện tham khảo: ${role.title}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
