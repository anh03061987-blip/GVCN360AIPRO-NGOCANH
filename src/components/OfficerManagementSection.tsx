import React, { useEffect, useMemo, useState } from 'react';
import {
  UserPlus,
  KeyRound,
  Lock,
  Unlock,
  Trash2,
  Copy,
  Check,
  ShieldCheck,
  RefreshCw,
  Edit3,
  Eye,
  EyeOff,
  History,
  AlertCircle,
  Users,
  ExternalLink,
  ClipboardCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Link2,
  UserX,
  SlidersHorizontal,
} from 'lucide-react';
import { ROLES } from '../constants/gvcnConstants';
import {
  checkOfficerAuthHealth,
  generateStrongOfficerPassword,
  normalizeOfficerNickname,
} from '../firebase';
import type {
  ClassConfig,
  OfficerAccountRecord,
  OfficerRoleId,
  PermissionAuditLogRecord,
  RoleAssignmentHistoryRecord,
  RoleAssignmentRecord,
  StudentRecord,
} from '../types/gvcn';
import {
  compareStudentsByRosterOrder,
  formatStudentRolesLabel,
  getStudentMoetCode,
  getStudentRoles,
  isValidRosterOrder,
} from '../utils/studentExcelImport';
import {
  analyzeOfficerPositionsAndAccounts,
  type OfficerGovernanceSummary,
  type OfficerLiveMembershipStatus,
} from '../utils/officerReconciliation';

const OFFICER_ROLES = ROLES.filter((r) => r.id !== 'gvcn') as Array<
  (typeof ROLES)[number] & { id: OfficerRoleId }
>;

const ROLE_NICK_SUFFIX: Record<OfficerRoleId, string> = {
  lop_truong: 'lt',
  to_truong_1: 'tt1',
  to_truong_2: 'tt2',
  to_truong_3: 'tt3',
  to_truong_4: 'tt4',
  thu_quy: 'tq',
  bi_thu: 'bt',
};

function getRoleTitle(roleId: string): string {
  return ROLES.find((r) => r.id === roleId)?.title || roleId;
}

function getRoleBadgeColor(roleId: string): string {
  return ROLES.find((r) => r.id === roleId)?.badgeColor || 'bg-slate-700 text-white';
}

function suggestNicknameForClass(className: string, roleId: OfficerRoleId): string {
  const cleanClass = (className || 'lop')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const suffix = ROLE_NICK_SUFFIX[roleId] || 'cb';
  return `${cleanClass || 'lop'}.${suffix}`;
}

export interface OfficerManagementSectionProps {
  classConfig: ClassConfig;
  students: StudentRecord[];
  officerAccounts: OfficerAccountRecord[];
  roleAssignments?: RoleAssignmentRecord[];
  roleAssignmentHistory?: RoleAssignmentHistoryRecord[];
  governance?: OfficerGovernanceSummary;
  officerLoginStatusMap?: Record<string, OfficerLiveMembershipStatus>;
  permissionAuditLogs: PermissionAuditLogRecord[];
  onOpenReconciliationModal?: () => void;
  onCreateOfficerAccount: (payload: {
    student: StudentRecord;
    nickname: string;
    roles: OfficerRoleId[];
    initialPassword: string;
    mustChangePassword: boolean;
    allowDirectClassAttendance?: boolean;
  }) => Promise<{ nickname: string; password: string }>;
  onUpdateOfficerRoles: (
    account: OfficerAccountRecord,
    nextRoles: OfficerRoleId[]
  ) => Promise<void>;
  onToggleMonitorDirectAttendance?: (account: OfficerAccountRecord) => Promise<void>;
  onToggleOfficerLock: (account: OfficerAccountRecord) => Promise<void>;
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
  onResetOfficerPassword: (
    account: OfficerAccountRecord,
    newPassword: string,
    mustChangePassword: boolean
  ) => Promise<{ nickname: string; password: string }>;
  onBatchResetPasswords: (
    accounts: OfficerAccountRecord[],
    newPassword: string,
    mustChangePassword: boolean
  ) => Promise<{ succeeded: string[]; failed: { nickname: string; error: string }[] }>;
  onDeleteOfficerAccount: (account: OfficerAccountRecord) => Promise<void>;
}

function statusPillToneClass(tone: 'slate' | 'amber' | 'sky' | 'emerald' | 'rose'): string {
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
}

export function OfficerManagementSection({
  classConfig,
  students,
  officerAccounts,
  roleAssignments = [],
  roleAssignmentHistory = [],
  governance: externalGovernance,
  officerLoginStatusMap = {},
  permissionAuditLogs,
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
}: OfficerManagementSectionProps) {
  const [selectedStudentCode, setSelectedStudentCode] = useState('');
  const [primaryRole, setPrimaryRole] = useState<OfficerRoleId>('lop_truong');
  const [secondaryRole, setSecondaryRole] = useState<'' | OfficerRoleId>('');
  const [nickname, setNickname] = useState(() =>
    suggestNicknameForClass(classConfig.className, 'lop_truong')
  );
  const [passwordMode, setPasswordMode] = useState<'random' | 'custom'>('random');
  const [customPassword, setCustomPassword] = useState('');
  const [showCustomPassword, setShowCustomPassword] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [allowDirectClassAttendance, setAllowDirectClassAttendance] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState('');

  // Kiểm tra trạng thái bật Email/Password trên Firebase Authentication
  const [authHealth, setAuthHealth] = useState<{
    loading: boolean;
    emailPasswordEnabled: boolean | null;
    rawStatus: string;
    consoleProvidersUrl: string;
  }>({
    loading: true,
    emailPasswordEnabled: null,
    rawStatus: '',
    consoleProvidersUrl: 'https://console.firebase.google.com',
  });

  const refreshAuthHealth = async () => {
    setAuthHealth((prev) => ({ ...prev, loading: true }));
    const res = await checkOfficerAuthHealth();
    setAuthHealth({
      loading: false,
      emailPasswordEnabled: res.emailPasswordEnabled,
      rawStatus: res.rawStatus,
      consoleProvidersUrl: res.consoleProvidersUrl,
    });
  };

  useEffect(() => {
    void refreshAuthHealth();
  }, []);

  // Hiển thị mật khẩu 1 lần sau khi tạo hoặc đặt lại (không lưu Firestore)
  const [issuedCredential, setIssuedCredential] = useState<{
    nickname: string;
    password: string;
    label: string;
  } | null>(null);
  const [copiedCred, setCopiedCred] = useState(false);

  // Sửa chức vụ / đặt lại mật khẩu cho từng tài khoản
  const [editingRolesAccount, setEditingRolesAccount] = useState<OfficerAccountRecord | null>(null);
  const [editRole1, setEditRole1] = useState<OfficerRoleId>('lop_truong');
  const [editRole2, setEditRole2] = useState<'' | OfficerRoleId>('');
  const [resetTargetAccount, setResetTargetAccount] = useState<OfficerAccountRecord | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetMustChange, setResetMustChange] = useState(false);
  const [showResetPw, setShowResetPw] = useState(false);
  const [busyStudentCode, setBusyStudentCode] = useState<string | null>(null);
  const [lockTargetAccount, setLockTargetAccount] = useState<OfficerAccountRecord | null>(null);
  const [lockReasonInput, setLockReasonInput] = useState('');
  const [actionSuccessBanner, setActionSuccessBanner] = useState('');

  // Đổi mật khẩu hàng loạt cho các nickname được chọn (GVCN nhập trực tiếp, không hardcode)
  const [selectedBatchCodes, setSelectedBatchCodes] = useState<string[]>([]);
  const [batchPassword, setBatchPassword] = useState('');
  const [showBatchPassword, setShowBatchPassword] = useState(false);
  const [batchMustChange, setBatchMustChange] = useState(false);
  const [isRunningBatch, setIsRunningBatch] = useState(false);
  const [batchFeedback, setBatchFeedback] = useState<string>('');

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

  const analyzedByCode = useMemo(() => {
    const map: Record<string, (typeof governance.analyzedAccounts)[number]> = {};
    for (const item of governance.analyzedAccounts) {
      map[item.account.studentCode] = item;
    }
    return map;
  }, [governance]);

  const assignedStudentIdsOrCodes = useMemo(() => {
    const set = new Set<string>();
    for (const item of governance.analyzedAccounts) {
      set.add(item.account.studentCode);
      if (item.account.studentId) set.add(item.account.studentId);
      if (item.matchedStudent) {
        set.add(item.matchedStudent.id);
        set.add(item.matchedStudent.code);
      }
    }
    return set;
  }, [governance]);

  const availableStudents = useMemo(
    () =>
      students.filter(
        (st) => !assignedStudentIdsOrCodes.has(st.code) && !assignedStudentIdsOrCodes.has(st.id)
      ),
    [students, assignedStudentIdsOrCodes]
  );

  const handlePrimaryRoleChange = (nextRole: OfficerRoleId) => {
    setPrimaryRole(nextRole);
    if (secondaryRole === nextRole) setSecondaryRole('');
    setNickname(suggestNicknameForClass(classConfig.className, nextRole));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const student = students.find((s) => s.code === selectedStudentCode);
    if (!student) {
      setFormError('Vui lòng chọn một học sinh từ danh sách lớp.');
      return;
    }

    const cleanNick = normalizeOfficerNickname(nickname);
    if (cleanNick.length < 3) {
      setFormError('Nickname cần tối thiểu 3 ký tự (chỉ gồm chữ thường, số, dấu chấm, gạch ngang).');
      return;
    }

    const roles: OfficerRoleId[] = secondaryRole
      ? [primaryRole, secondaryRole]
      : [primaryRole];

    const teamLeaderRoles = roles.filter((r) => r.startsWith('to_truong_'));
    if (teamLeaderRoles.length > 1) {
      setFormError('Một học sinh không thể kiêm nhiệm hai vị trí Tổ trưởng cùng lúc.');
      return;
    }

    const finalPassword =
      passwordMode === 'random' ? generateStrongOfficerPassword(12) : customPassword.trim();

    if (finalPassword.length < 8) {
      setFormError('Mật khẩu phải có tối thiểu 8 ký tự để đảm bảo an toàn cho tài khoản Firebase.');
      return;
    }

    setIsCreating(true);
    try {
      const includesMonitor = roles.includes('lop_truong');
      const issued = await onCreateOfficerAccount({
        student,
        nickname: cleanNick,
        roles,
        initialPassword: finalPassword,
        mustChangePassword,
        allowDirectClassAttendance: includesMonitor ? allowDirectClassAttendance : false,
      });
      setIssuedCredential({
        nickname: issued.nickname,
        password: issued.password,
        label: `Tài khoản mới cho ${student.fullName}`,
      });
      setCopiedCred(false);
      setSelectedStudentCode('');
      setSecondaryRole('');
      setCustomPassword('');
      setAllowDirectClassAttendance(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không thể tạo tài khoản cán bộ lớp.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSaveEditedRoles = async () => {
    if (!editingRolesAccount) return;
    const nextRoles: OfficerRoleId[] = editRole2 ? [editRole1, editRole2] : [editRole1];
    const teamLeaderRoles = nextRoles.filter((r) => r.startsWith('to_truong_'));
    if (teamLeaderRoles.length > 1) {
      setFormError('Không thể gán hai vai trò Tổ trưởng cho cùng một học sinh.');
      return;
    }
    setBusyStudentCode(editingRolesAccount.studentCode);
    setFormError('');
    try {
      await onUpdateOfficerRoles(editingRolesAccount, nextRoles);
      setEditingRolesAccount(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không thể cập nhật chức vụ.');
    } finally {
      setBusyStudentCode(null);
    }
  };

  const handleConfirmSingleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetAccount) return;
    const pw = resetNewPassword.trim();
    if (pw.length < 8) {
      setFormError('Mật khẩu mới cần tối thiểu 8 ký tự.');
      return;
    }
    setBusyStudentCode(resetTargetAccount.studentCode);
    setFormError('');
    try {
      const issued = await onResetOfficerPassword(resetTargetAccount, pw, resetMustChange);
      setIssuedCredential({
        nickname: issued.nickname,
        password: issued.password,
        label: `Đã cấp mật khẩu mới cho ${resetTargetAccount.studentName}`,
      });
      setCopiedCred(false);
      setResetTargetAccount(null);
      setResetNewPassword('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không thể đặt lại mật khẩu.');
    } finally {
      setBusyStudentCode(null);
    }
  };

  const handleBatchResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBatchFeedback('');
    setFormError('');
    const targets = officerAccounts.filter((a) => selectedBatchCodes.includes(a.studentCode));
    if (targets.length === 0) {
      setFormError('Hãy chọn ít nhất 1 tài khoản cán bộ lớp trong bảng để đổi mật khẩu.');
      return;
    }
    if (batchPassword.trim().length < 8) {
      setFormError('Mật khẩu mới cần tối thiểu 8 ký tự.');
      return;
    }

    setIsRunningBatch(true);
    try {
      const result = await onBatchResetPasswords(targets, batchPassword.trim(), batchMustChange);
      const okText =
        result.succeeded.length > 0
          ? `Thành công (${result.succeeded.length}): ${result.succeeded.join(', ')}.`
          : '';
      const failText =
        result.failed.length > 0
          ? ` Lỗi (${result.failed.length}): ${result.failed
              .map((f) => `${f.nickname} (${f.error})`)
              .join('; ')}.`
          : '';
      setBatchFeedback(`${okText}${failText}`.trim());
      if (result.succeeded.length > 0) {
        setBatchPassword('');
        setSelectedBatchCodes([]);
      }
    } finally {
      setIsRunningBatch(false);
    }
  };

  const copyCredentialText = () => {
    if (!issuedCredential) return;
    const text = `Tài khoản Cán bộ lớp GVCN 360 AI PRO\nNickname: ${issuedCredential.nickname}\nMật khẩu: ${issuedCredential.password}`;
    navigator.clipboard.writeText(text);
    setCopiedCred(true);
    setTimeout(() => setCopiedCred(false), 3000);
  };

  const toggleBatchSelect = (studentCode: string) => {
    setSelectedBatchCodes((prev) =>
      prev.includes(studentCode) ? prev.filter((c) => c !== studentCode) : [...prev, studentCode]
    );
  };

  const toggleSelectAllBatch = () => {
    if (selectedBatchCodes.length === officerAccounts.length) {
      setSelectedBatchCodes([]);
    } else {
      setSelectedBatchCodes(officerAccounts.map((a) => a.studentCode));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 bg-gradient-to-r from-[#0f172a] via-[#102744] to-[#0C9BA6] text-white flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-200" />
              <span>QUẢN LÝ TÀI KHOẢN CÁN BỘ LỚP — LỚP {classConfig.className}</span>
            </h3>
            <p className="text-xs text-teal-100 mt-0.5">
              Cấp tài khoản Firebase Auth thật (Nickname duy nhất toàn hệ thống, hỗ trợ kiêm nhiệm tối đa 2 chức vụ trên 1 tài khoản, không lưu mật khẩu dạng văn bản trong Firestore).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-lg bg-emerald-400/20 border border-emerald-200/40 text-emerald-100 text-xs font-bold">
              {governance.activeAccountsCount} đang hoạt động / {governance.totalCreatedAccountsCount} bản ghi TK
            </span>
            {governance.pendingActivationAccountsCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-sky-400/20 border border-sky-200/40 text-sky-100 text-xs font-bold">
                {governance.pendingActivationAccountsCount} chờ kích hoạt
              </span>
            )}
            {governance.lockedAccountsCount + governance.revokedAccountsCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-rose-500/30 border border-rose-200/40 text-rose-100 text-xs font-bold">
                {governance.lockedAccountsCount} khóa • {governance.revokedAccountsCount} thu hồi
              </span>
            )}
            {governance.mismatchedAccountsCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-amber-400/25 border border-amber-200/40 text-amber-100 text-xs font-bold">
                {governance.mismatchedAccountsCount} liên kết lệch
              </span>
            )}
            {onOpenReconciliationModal && (
              <button
                type="button"
                onClick={onOpenReconciliationModal}
                className="px-3 py-1.5 rounded-lg bg-white text-[#102744] hover:bg-teal-50 text-xs font-bold inline-flex items-center gap-1.5 shadow-xs"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#0C9BA6]" />
                <span>Rà soát &amp; Kích hoạt 7 vị trí</span>
              </button>
            )}
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* Trạng thái phương thức Email/Password trên Firebase Authentication */}
          {!authHealth.loading && authHealth.emailPasswordEnabled === false && (
            <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-xs text-amber-950 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold text-sm flex items-center gap-2 text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Phương thức Email/Password chưa được bật trên Firebase Authentication ({authHealth.rawStatus || 'PASSWORD_LOGIN_DISABLED'})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={authHealth.consoleProvidersUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold inline-flex items-center gap-1.5"
                  >
                    <span>Mở Firebase Console</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => void refreshAuthHealth()}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 font-bold inline-flex items-center gap-1 hover:bg-amber-100"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Kiểm tra lại</span>
                  </button>
                </div>
              </div>
              <p className="leading-relaxed">
                Để cấp tài khoản và cho phép Cán bộ lớp đăng nhập bằng Nickname + Mật khẩu thật (không ảnh hưởng phiên Google của GVCN), vui lòng bật <strong>Email/Password</strong> trong Firebase Console:
                <strong> Authentication → Sign-in method → Add new provider → Email/Password → Enable → Save</strong>, sau đó bấm <strong>Kiểm tra lại</strong>.
              </p>
            </div>
          )}

          {!authHealth.loading && authHealth.emailPasswordEnabled === true && (
            <div className="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Firebase Authentication (Email/Password) đang hoạt động. Tài khoản Cán bộ lớp được cấp qua máy chủ bảo vệ, không làm gián đoạn phiên Google của GVCN.
                </span>
              </div>
              <button
                type="button"
                onClick={() => void refreshAuthHealth()}
                className="text-emerald-700 font-bold hover:underline inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Kiểm tra lại</span>
              </button>
            </div>
          )}

          {formError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{formError}</span>
            </div>
          )}

          {actionSuccessBanner && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{actionSuccessBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionSuccessBanner('')}
                className="text-emerald-700 font-bold hover:underline"
              >
                Đóng
              </button>
            </div>
          )}

          {/* Thẻ hiển thị mật khẩu 1 lần duy nhất */}
          {issuedCredential && (
            <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>{issuedCredential.label} (Chỉ hiển thị 1 lần)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={copyCredentialText}
                    className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    {copiedCred ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCred ? 'Đã sao chép' : 'Sao chép thông tin'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIssuedCredential(null)}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-900 text-xs font-semibold"
                  >
                    Đóng
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-white rounded-xl p-3 border border-emerald-200">
                  <div className="text-slate-500">Nickname đăng nhập</div>
                  <div className="font-mono font-bold text-base text-[#102744] mt-0.5">
                    {issuedCredential.nickname}
                  </div>
                </div>
                <div className="bg-white rounded-xl p-3 border border-emerald-200">
                  <div className="text-slate-500">Mật khẩu ban đầu</div>
                  <div className="font-mono font-bold text-base text-emerald-800 mt-0.5">
                    {issuedCredential.password}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-emerald-800">
                Mật khẩu được mã hóa và quản lý trực tiếp bởi Firebase Authentication, không lưu dạng văn bản trong cơ sở dữ liệu Firestore.
              </p>
            </div>
          )}

          {/* Form cấp tài khoản cán bộ lớp mới */}
          <form
            onSubmit={handleCreateSubmit}
            className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-4"
          >
            <div className="font-bold text-sm text-[#102744] flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#0C9BA6]" />
              <span>Cấp tài khoản mới cho Học sinh trong lớp</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Chọn Học sinh ({availableStudents.length} khả dụng) *
                </label>
                <select
                  value={selectedStudentCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    setSelectedStudentCode(code);
                    const picked = availableStudents.find((s) => s.code === code);
                    if (picked) {
                      const pickedRoles = getStudentRoles(picked);
                      if (pickedRoles.length > 0) {
                        setPrimaryRole(pickedRoles[0]);
                        setSecondaryRole(pickedRoles[1] || '');
                        setNickname(suggestNicknameForClass(classConfig.className, pickedRoles[0]));
                      }
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6]"
                >
                  <option value="">-- Chọn học sinh --</option>
                  {[...availableStudents]
                    .sort((a, b) => {
                      const aHas = getStudentRoles(a).length > 0 ? 1 : 0;
                      const bHas = getStudentRoles(b).length > 0 ? 1 : 0;
                      if (bHas !== aHas) return bHas - aHas;
                      return compareStudentsByRosterOrder(a, b);
                    })
                    .map((st) => {
                      const stRoles = getStudentRoles(st);
                      return (
                        <option key={st.code} value={st.code}>
                          {isValidRosterOrder(st.rosterOrder) ? `#${st.rosterOrder} ` : ''}
                          {st.fullName} ({st.code} • Tổ {st.team}
                          {stRoles.length > 0 ? ` — ${formatStudentRolesLabel(stRoles)}` : ''})
                        </option>
                      );
                    })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Chức vụ chính *
                </label>
                <select
                  value={primaryRole}
                  onChange={(e) => handlePrimaryRoleChange(e.target.value as OfficerRoleId)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6]"
                >
                  {OFFICER_ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kiêm nhiệm chức vụ thứ 2 (tùy chọn)
                </label>
                <select
                  value={secondaryRole}
                  onChange={(e) => setSecondaryRole(e.target.value as '' | OfficerRoleId)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6]"
                >
                  <option value="">Không kiêm nhiệm</option>
                  {OFFICER_ROLES.filter((r) => r.id !== primaryRole).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nickname duy nhất *
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Ví dụ: 12d6.lt"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
              <div className="md:col-span-4 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Phương thức tạo mật khẩu ban đầu
                </label>
                <div className="grid grid-cols-2 gap-1.5 bg-white p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setPasswordMode('random')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                      passwordMode === 'random'
                        ? 'bg-[#102744] text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Ngẫu nhiên mạnh
                  </button>
                  <button
                    type="button"
                    onClick={() => setPasswordMode('custom')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                      passwordMode === 'custom'
                        ? 'bg-[#0C9BA6] text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    GVCN tự nhập
                  </button>
                </div>
              </div>

              {passwordMode === 'custom' ? (
                <div className="md:col-span-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mật khẩu ban đầu (tối thiểu 8 ký tự) *
                  </label>
                  <div className="relative">
                    <input
                      type={showCustomPassword ? 'text' : 'password'}
                      value={customPassword}
                      onChange={(e) => setCustomPassword(e.target.value)}
                      placeholder="Nhập mật khẩu ban đầu..."
                      className="w-full px-3 py-2 pr-9 rounded-xl border border-slate-300 bg-white text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCustomPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      {showCustomPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="md:col-span-4 text-xs text-slate-600 bg-white rounded-xl px-3 py-2.5 border border-slate-200">
                  Hệ thống tự sinh mật khẩu 12 ký tự an toàn bằng <code>crypto.getRandomValues</code>.
                </div>
              )}

              <div className="md:col-span-4 flex flex-col gap-2">
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mustChangePassword}
                    onChange={(e) => setMustChangePassword(e.target.checked)}
                    className="rounded border-slate-300 text-[#0C9BA6] focus:ring-[#0C9BA6]"
                  />
                  <span>Bắt buộc đổi mật khẩu khi đăng nhập lần đầu</span>
                </label>
                {(primaryRole === 'lop_truong' || secondaryRole === 'lop_truong') && (
                  <label className="inline-flex items-start gap-2 text-xs text-slate-700 font-medium cursor-pointer bg-white px-2.5 py-2 rounded-xl border border-slate-200">
                    <input
                      type="checkbox"
                      checked={allowDirectClassAttendance}
                      onChange={(e) => setAllowDirectClassAttendance(e.target.checked)}
                      className="rounded border-slate-300 text-[#0C9BA6] focus:ring-[#0C9BA6] mt-0.5"
                    />
                    <span className="leading-snug">
                      Cho phép Lớp trưởng <strong>điểm danh trực tiếp toàn lớp</strong> (mặc định TẮT — chỉ tổng hợp từ 4 Tổ trưởng)
                    </span>
                  </label>
                )}
                <button
                  type="submit"
                  disabled={isCreating || availableStudents.length === 0}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#102744] to-[#0C9BA6] hover:opacity-95 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-xs flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isCreating ? 'Đang tạo tài khoản...' : 'Tạo tài khoản Cán bộ lớp'}</span>
                </button>
              </div>
            </div>
          </form>

          {/* Danh sách tài khoản cán bộ lớp đã cấp */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-bold text-sm text-[#102744]">
                Danh sách tài khoản Cán bộ lớp hiện tại
              </h4>
              {officerAccounts.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAllBatch}
                  className="text-xs font-bold text-[#0C9BA6] hover:underline"
                >
                  {selectedBatchCodes.length === officerAccounts.length
                    ? 'Bỏ chọn tất cả'
                    : 'Chọn tất cả để đổi mật khẩu hàng loạt'}
                </button>
              )}
            </div>

            {officerAccounts.length === 0 ? (
              <div className="text-sm text-slate-500 text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                Chưa có tài khoản cán bộ lớp nào. Hãy chọn học sinh ở biểu mẫu phía trên để cấp tài khoản đầu tiên (ví dụ: <code>12d6.lt</code>, <code>12d6.tt1</code>, <code>12d6.tq</code>, <code>12d6.bt</code>).
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase">
                      <th className="py-3 px-3 w-8">
                        <input
                          type="checkbox"
                          checked={
                            officerAccounts.length > 0 &&
                            selectedBatchCodes.length === officerAccounts.length
                          }
                          onChange={toggleSelectAllBatch}
                        />
                      </th>
                      <th className="py-3 px-3">Học sinh / Nickname / Mã MOET</th>
                      <th className="py-3 px-3">Chức vụ & Phạm vi</th>
                      <th className="py-3 px-3">Trạng thái TK Firebase Auth</th>
                      <th className="py-3 px-3">Trạng thái quyền trong lớp</th>
                      <th className="py-3 px-3 text-right">Thao tác quản trị</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {officerAccounts.map((acc) => {
                      const isBusy = busyStudentCode === acc.studentCode;
                      const analyzed = analyzedByCode[acc.studentCode];
                      const liveStatus = officerLoginStatusMap[acc.officerUid];
                      const lastLoginAtMs = liveStatus?.lastLoginAtMs;
                      const effectiveMustChange =
                        liveStatus?.mustChangePassword !== undefined
                          ? liveStatus.mustChangePassword
                          : acc.mustChangePassword;
                      const isMonitorAccount = acc.roles.includes('lop_truong');
                      const matchedSt = analyzed?.matchedStudent || null;
                      const relinkSt = analyzed?.relinkCandidateStudent || null;
                      const officialRoleForAccount = matchedSt
                        ? roleAssignments.find(
                            (ra) => ra.studentId === matchedSt.id && ra.status !== 'revoked'
                          ) || null
                        : null;
                      const canRunEightPointActivate = Boolean(
                        onActivateOfficerPosition &&
                          officialRoleForAccount &&
                          analyzed &&
                          analyzed.classPermissionStatus !== 'active' &&
                          !analyzed.securityLockReason
                      );
                      return (
                        <tr
                          key={acc.studentCode}
                          className={
                            analyzed &&
                            (analyzed.linkage === 'mismatched_student' ||
                              analyzed.linkage === 'orphan_not_in_roster')
                              ? 'bg-rose-50/40'
                              : analyzed && analyzed.linkage === 'legacy_code_relinkable'
                                ? 'bg-amber-50/30'
                                : 'hover:bg-slate-50/70'
                          }
                        >
                          <td className="py-3 px-3 align-top">
                            <input
                              type="checkbox"
                              checked={selectedBatchCodes.includes(acc.studentCode)}
                              onChange={() => toggleBatchSelect(acc.studentCode)}
                            />
                          </td>
                          <td className="py-3 px-3 align-top">
                            <div className="font-bold text-[#102744]">{acc.studentName}</div>
                            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span className="font-mono font-bold text-[#0C9BA6] bg-teal-50 px-1.5 py-0.5 rounded">
                                {acc.nickname}
                              </span>
                              <span className="font-mono text-[11px]">
                                MOET: {(matchedSt ? getStudentMoetCode(matchedSt) : acc.moetCode) || acc.studentCode}
                              </span>
                              <span>
                                • Tổ {matchedSt ? matchedSt.team : acc.team} • v{acc.credentialVersion}
                              </span>
                            </div>
                            {analyzed && analyzed.linkage !== 'exact_match' && (
                              <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-bold">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                <span>
                                  {analyzed.linkage === 'legacy_code_relinkable'
                                    ? `Mã cũ (${acc.studentCode}) → có thể liên kết lại với ${relinkSt?.fullName}`
                                    : analyzed.linkage === 'mismatched_student'
                                      ? 'Liên kết lệch học sinh — Cấm tự gộp UID'
                                      : 'Không khớp danh sách lớp hiện tại'}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 align-top">
                            <div className="flex flex-wrap gap-1.5">
                              {acc.roles.map((r) => (
                                <span
                                  key={r}
                                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${getRoleBadgeColor(
                                    r
                                  )}`}
                                >
                                  {getRoleTitle(r)}
                                </span>
                              ))}
                            </div>
                            {acc.assignedTeam > 0 && (
                              <div className="text-[11px] text-slate-500 mt-1">
                                Phạm vi tổ phụ trách: Tổ {acc.assignedTeam}
                              </div>
                            )}
                            {isMonitorAccount && (
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                    acc.allowDirectClassAttendance
                                      ? 'bg-teal-50 text-teal-800 border-teal-200'
                                      : 'bg-slate-100 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  <ClipboardCheck className="w-3 h-3" />
                                  <span>
                                    Điểm danh trực tiếp toàn lớp:{' '}
                                    {acc.allowDirectClassAttendance ? 'BẬT' : 'TẮT (mặc định)'}
                                  </span>
                                </span>
                                {onToggleMonitorDirectAttendance && (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={async () => {
                                      setBusyStudentCode(acc.studentCode);
                                      setFormError('');
                                      try {
                                        await onToggleMonitorDirectAttendance(acc);
                                      } catch (err) {
                                        setFormError(
                                          err instanceof Error
                                            ? err.message
                                            : 'Không thể cập nhật quyền điểm danh trực tiếp.'
                                        );
                                      } finally {
                                        setBusyStudentCode(null);
                                      }
                                    }}
                                    className="text-[11px] font-bold text-[#0C9BA6] hover:underline"
                                  >
                                    {acc.allowDirectClassAttendance ? 'Tắt' : 'Bật'}
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 align-top">
                            <div className="space-y-1">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold ${statusPillToneClass(
                                  analyzed?.firebaseAuthTone || (acc.active ? 'emerald' : 'rose')
                                )}`}
                              >
                                {analyzed?.firebaseAuthStatusLabel ||
                                  (acc.active ? 'Đã tạo Firebase Auth (Bật)' : 'Đã tạo Firebase Auth (Tắt)')}
                              </span>
                              <div className="text-[11px] text-slate-600 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                {lastLoginAtMs ? (
                                  <span>
                                    Đăng nhập gần nhất:{' '}
                                    {new Date(lastLoginAtMs).toLocaleString('vi-VN', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">Chưa từng đăng nhập</span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {effectiveMustChange ? 'Chờ đổi MK lần đầu' : 'Đã xác nhận MK'}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 align-top">
                            <div className="space-y-1">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold ${statusPillToneClass(
                                  analyzed?.classPermissionTone || (acc.active ? 'emerald' : 'rose')
                                )}`}
                              >
                                {analyzed?.classPermissionLabel ||
                                  (acc.active ? 'Đang hoạt động' : 'Tạm khóa')}
                              </span>
                              {analyzed?.securityLockReason && (
                                <div className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5">
                                  Lý do khóa bảo mật: {analyzed.securityLockReason}
                                </div>
                              )}
                              {analyzed?.diagnosticNote && (
                                <div className="text-[10px] text-slate-500 leading-snug max-w-[210px]">
                                  {analyzed.diagnosticNote}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 align-top text-right">
                            <div className="inline-flex flex-wrap justify-end gap-1.5">
                              {analyzed?.linkage === 'legacy_code_relinkable' &&
                                relinkSt &&
                                onRelinkExistingOfficerAccount && (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={async () => {
                                      setBusyStudentCode(acc.studentCode);
                                      setFormError('');
                                      setActionSuccessBanner('');
                                      try {
                                        await onRelinkExistingOfficerAccount(
                                          acc,
                                          relinkSt,
                                          acc.roles
                                        );
                                        setActionSuccessBanner(
                                          `Đã liên kết lại tài khoản ${acc.nickname} (giữ nguyên Firebase UID) với ${relinkSt.fullName}.`
                                        );
                                      } catch (err) {
                                        setFormError(
                                          err instanceof Error
                                            ? err.message
                                            : 'Không thể liên kết lại tài khoản.'
                                        );
                                      } finally {
                                        setBusyStudentCode(null);
                                      }
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold inline-flex items-center gap-1"
                                    title="Liên kết lại cùng 1 học sinh theo Mã MOET, giữ nguyên UID"
                                  >
                                    <Link2 className="w-3.5 h-3.5" />
                                    <span>Liên kết TK</span>
                                  </button>
                                )}
                              {canRunEightPointActivate && officialRoleForAccount && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={async () => {
                                    setBusyStudentCode(acc.studentCode);
                                    setFormError('');
                                    setActionSuccessBanner('');
                                    try {
                                      const res = await onActivateOfficerPosition!({
                                        roleId: officialRoleForAccount.roleId,
                                        securityLockVerifiedByGvcn: false,
                                      });
                                      if (res.ok) setActionSuccessBanner(res.message);
                                      else setFormError(res.message);
                                    } catch (err) {
                                      setFormError(
                                        err instanceof Error
                                          ? err.message
                                          : 'Không thể kích hoạt quyền.'
                                      );
                                    } finally {
                                      setBusyStudentCode(null);
                                    }
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1"
                                  title="Chạy kiểm tra 8 bước & kích hoạt quyền trong lớp"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  <span>Kích hoạt quyền</span>
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                  setEditingRolesAccount(acc);
                                  setEditRole1(acc.roles[0] || 'lop_truong');
                                  setEditRole2(acc.roles[1] || '');
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1"
                                title="Sửa hoặc thu hồi từng chức vụ"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Chức vụ</span>
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                  setResetTargetAccount(acc);
                                  setResetNewPassword('');
                                  setResetMustChange(false);
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs font-bold inline-flex items-center gap-1"
                                title="Đặt lại / Đổi mật khẩu an toàn"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                                <span>Đổi MK</span>
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={async () => {
                                  if (acc.active && onLockOfficerWithReason) {
                                    setLockTargetAccount(acc);
                                    setLockReasonInput('');
                                    return;
                                  }
                                  if (!acc.active && analyzed?.securityLockReason && onOpenReconciliationModal) {
                                    onOpenReconciliationModal();
                                    return;
                                  }
                                  setBusyStudentCode(acc.studentCode);
                                  setFormError('');
                                  try {
                                    await onToggleOfficerLock(acc);
                                  } catch (err) {
                                    setFormError(
                                      err instanceof Error
                                        ? err.message
                                        : 'Không thể thay đổi trạng thái khóa.'
                                    );
                                  } finally {
                                    setBusyStudentCode(null);
                                  }
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 ${
                                  acc.active
                                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                                }`}
                                title={
                                  acc.active
                                    ? 'Tạm khóa quyền đăng nhập (có thể ghi lý do bảo mật)'
                                    : analyzed?.securityLockReason
                                      ? 'Tài khoản bị khóa bảo mật — mở màn hình Rà soát để xác minh trước khi mở khóa'
                                      : 'Mở khóa tài khoản'
                                }
                              >
                                {acc.active ? (
                                  <>
                                    <Lock className="w-3.5 h-3.5" />
                                    <span>Tạm khóa</span>
                                  </>
                                ) : (
                                  <>
                                    <Unlock className="w-3.5 h-3.5" />
                                    <span>
                                      {analyzed?.securityLockReason ? 'Xác minh mở khóa' : 'Mở khóa'}
                                    </span>
                                  </>
                                )}
                              </button>
                              {onRevokeOfficerPosition && acc.permissionStatus !== 'revoked' && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={async () => {
                                    setBusyStudentCode(acc.studentCode);
                                    setFormError('');
                                    try {
                                      await onRevokeOfficerPosition(
                                        acc,
                                        'GVCN thu hồi chức vụ trực tiếp tại bảng quản lý tài khoản'
                                      );
                                      setActionSuccessBanner(
                                        `Đã thu hồi chức vụ và ngắt quyền của ${acc.nickname} (lưu lịch sử phân quyền).`
                                      );
                                    } catch (err) {
                                      setFormError(
                                        err instanceof Error
                                          ? err.message
                                          : 'Không thể thu hồi chức vụ.'
                                      );
                                    } finally {
                                      setBusyStudentCode(null);
                                    }
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold inline-flex items-center gap-1"
                                  title="Thu hồi chức vụ & ngắt quyền tức thì (lưu lịch sử, không xóa hồ sơ học sinh)"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                  <span>Thu hồi CV</span>
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={async () => {
                                  setBusyStudentCode(acc.studentCode);
                                  try {
                                    await onDeleteOfficerAccount(acc);
                                  } finally {
                                    setBusyStudentCode(null);
                                  }
                                }}
                                className="px-2 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold inline-flex items-center gap-1"
                                title="Xóa hẳn bản ghi tài khoản khỏi danh sách (không ảnh hưởng hồ sơ học sinh)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
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

          {/* Hộp nhập lý do Tạm khóa quyền (tránh dùng window.prompt) */}
          {lockTargetAccount && onLockOfficerWithReason && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusyStudentCode(lockTargetAccount.studentCode);
                setFormError('');
                try {
                  await onLockOfficerWithReason(lockTargetAccount, lockReasonInput.trim());
                  setActionSuccessBanner(
                    `Đã tạm khóa quyền của ${lockTargetAccount.nickname}${
                      lockReasonInput.trim() ? ` (Lý do: ${lockReasonInput.trim()})` : ''
                    }.`
                  );
                  setLockTargetAccount(null);
                  setLockReasonInput('');
                } catch (err) {
                  setFormError(
                    err instanceof Error ? err.message : 'Không thể tạm khóa tài khoản.'
                  );
                } finally {
                  setBusyStudentCode(null);
                }
              }}
              className="p-4 rounded-2xl bg-amber-50 border border-amber-300 space-y-3"
            >
              <div className="font-bold text-sm text-amber-950 flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-700" />
                <span>
                  Tạm khóa quyền tài khoản {lockTargetAccount.studentName} (
                  <code>{lockTargetAccount.nickname}</code>)
                </span>
              </div>
              <p className="text-xs text-amber-900">
                Nếu nhập lý do bảo mật (ví dụ: nghi lộ mật khẩu, sai người dùng), hệ thống sẽ gắn cờ <strong>Khóa bảo mật</strong> và tuyệt đối không tự mở lại khi kích hoạt hàng loạt.
              </p>
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  type="text"
                  value={lockReasonInput}
                  onChange={(e) => setLockReasonInput(e.target.value)}
                  placeholder="Lý do tạm khóa / khóa bảo mật (tùy chọn)..."
                  className="flex-1 min-w-[220px] px-3 py-2 rounded-xl border border-amber-300 bg-white text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    setLockTargetAccount(null);
                    setLockReasonInput('');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={busyStudentCode === lockTargetAccount.studentCode}
                  className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold"
                >
                  Xác nhận tạm khóa
                </button>
              </div>
            </form>
          )}

          {/* Công cụ đổi mật khẩu hàng loạt cho các tài khoản đã chọn */}
          {officerAccounts.length > 0 && (
            <form
              onSubmit={handleBatchResetSubmit}
              className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold text-xs sm:text-sm text-[#102744] flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-[#0C9BA6]" />
                  <span>
                    Đổi mật khẩu đồng loạt cho tài khoản đã tích chọn ({selectedBatchCodes.length}{' '}
                    tài khoản)
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <div className="md:col-span-5 relative">
                  <input
                    type={showBatchPassword ? 'text' : 'password'}
                    value={batchPassword}
                    onChange={(e) => setBatchPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới (≥ 8 ký tự) để áp dụng..."
                    className="w-full px-3.5 py-2 pr-9 rounded-xl border border-slate-300 bg-white text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowBatchPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showBatchPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <label className="md:col-span-4 inline-flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={batchMustChange}
                    onChange={(e) => setBatchMustChange(e.target.checked)}
                    className="rounded border-slate-300 text-[#0C9BA6]"
                  />
                  <span>Bắt buộc đổi mật khẩu ở lần đăng nhập tới</span>
                </label>
                <div className="md:col-span-3">
                  <button
                    type="submit"
                    disabled={isRunningBatch || selectedBatchCodes.length === 0}
                    className="w-full py-2 px-3 rounded-xl bg-[#102744] hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold"
                  >
                    {isRunningBatch ? 'Đang cập nhật...' : 'Áp dụng mật khẩu mới'}
                  </button>
                </div>
              </div>
              {batchFeedback && (
                <div className="text-xs font-medium text-emerald-900 bg-white border border-emerald-200 rounded-xl p-2.5">
                  {batchFeedback}
                </div>
              )}
            </form>
          )}

          {/* Hộp sửa chức vụ kiêm nhiệm */}
          {editingRolesAccount && (
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3">
              <div className="font-bold text-sm text-[#102744]">
                Cập nhật / Thu hồi từng chức vụ cho {editingRolesAccount.studentName} (
                <code>{editingRolesAccount.nickname}</code>)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Chức vụ 1 *</label>
                  <select
                    value={editRole1}
                    onChange={(e) => {
                      const next = e.target.value as OfficerRoleId;
                      setEditRole1(next);
                      if (editRole2 === next) setEditRole2('');
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                  >
                    {OFFICER_ROLES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Chức vụ 2 (kiêm nhiệm — chọn &ldquo;Không&rdquo; để thu hồi chức vụ 2)
                  </label>
                  <select
                    value={editRole2}
                    onChange={(e) => setEditRole2(e.target.value as '' | OfficerRoleId)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                  >
                    <option value="">Không kiêm nhiệm</option>
                    {OFFICER_ROLES.filter((r) => r.id !== editRole1).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRolesAccount(null)}
                  className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditedRoles}
                  disabled={busyStudentCode === editingRolesAccount.studentCode}
                  className="px-4 py-2 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 text-white text-xs font-bold"
                >
                  Lưu thay đổi chức vụ
                </button>
              </div>
            </div>
          )}

          {/* Hộp đặt lại mật khẩu đơn lẻ */}
          {resetTargetAccount && (
            <form
              onSubmit={handleConfirmSingleReset}
              className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-3"
            >
              <div className="font-bold text-sm text-[#102744]">
                Đặt lại / Đổi mật khẩu an toàn cho {resetTargetAccount.studentName} (
                <code>{resetTargetAccount.nickname}</code>)
              </div>
              <p className="text-xs text-slate-600">
                Hệ thống sẽ cấp phiên bản mật khẩu mới (v{resetTargetAccount.credentialVersion + 1}) trên Firebase Auth và vô hiệu hóa tức thì phiên bản cũ.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <div className="sm:col-span-6 relative">
                  <input
                    type={showResetPw ? 'text' : 'password'}
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới (≥ 8 ký tự)..."
                    className="w-full px-3 py-2 pr-9 rounded-xl border border-slate-300 bg-white text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPw((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {showResetPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="sm:col-span-3">
                  <button
                    type="button"
                    onClick={() => {
                      setResetNewPassword(generateStrongOfficerPassword(12));
                      setShowResetPw(true);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-white border border-slate-300 text-xs font-bold text-[#102744]"
                  >
                    Sinh MK ngẫu nhiên
                  </button>
                </div>
                <div className="sm:col-span-3 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setResetTargetAccount(null)}
                    className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={busyStudentCode === resetTargetAccount.studentCode}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#102744] text-white text-xs font-bold"
                  >
                    Lưu MK
                  </button>
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={resetMustChange}
                  onChange={(e) => setResetMustChange(e.target.checked)}
                />
                <span>Yêu cầu học sinh tự đổi lại mật khẩu khi đăng nhập</span>
              </label>
            </form>
          )}

          {/* Lịch sử phân công 7 vị trí bất biến (role_assignment_history) */}
          {roleAssignmentHistory.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="text-xs font-bold text-[#102744] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#0C9BA6]" />
                <span>Lịch sử phân công chính thức 7 vị trí ({roleAssignmentHistory.length})</span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {roleAssignmentHistory.slice(0, 15).map((item) => (
                  <div
                    key={item.id}
                    className="text-xs bg-teal-50/50 border border-teal-200/80 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-bold text-[#102744]">{getRoleTitle(item.roleId)}</span>:{' '}
                      {item.previousStudentName ? (
                        <span className="text-slate-600">
                          {item.previousStudentName} → <strong>{item.newStudentName || 'Đã thu hồi'}</strong>
                        </span>
                      ) : (
                        <span className="text-slate-700 font-semibold">{item.newStudentName}</span>
                      )}
                      {item.reason && (
                        <span className="text-slate-500"> — {item.reason}</span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {new Date(item.changedAtMs).toLocaleString('vi-VN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nhật ký thay đổi phân quyền */}
          {permissionAuditLogs.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="text-xs font-bold text-[#102744] flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-[#0C9BA6]" />
                <span>Lịch sử thay đổi tài khoản & phân quyền ({permissionAuditLogs.length})</span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {permissionAuditLogs.slice(0, 15).map((log) => (
                  <div
                    key={log.id}
                    className="text-xs bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-bold text-[#102744]">{log.action}</span> •{' '}
                      <span className="font-mono text-[#0C9BA6]">{log.nickname}</span> (
                      {log.studentName}): <span className="text-slate-600">{log.details}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {new Date(log.timestampMs).toLocaleString('vi-VN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
