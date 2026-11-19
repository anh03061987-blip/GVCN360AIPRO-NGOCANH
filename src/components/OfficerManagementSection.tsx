import React, { useMemo, useState } from 'react';
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
} from 'lucide-react';
import { ROLES } from '../constants/gvcnConstants';
import {
  generateStrongOfficerPassword,
  normalizeOfficerNickname,
} from '../firebase';
import type {
  ClassConfig,
  OfficerAccountRecord,
  OfficerRoleId,
  PermissionAuditLogRecord,
  StudentRecord,
} from '../types/gvcn';

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
  permissionAuditLogs: PermissionAuditLogRecord[];
  onCreateOfficerAccount: (payload: {
    student: StudentRecord;
    nickname: string;
    roles: OfficerRoleId[];
    initialPassword: string;
    mustChangePassword: boolean;
  }) => Promise<{ nickname: string; password: string }>;
  onUpdateOfficerRoles: (
    account: OfficerAccountRecord,
    nextRoles: OfficerRoleId[]
  ) => Promise<void>;
  onToggleOfficerLock: (account: OfficerAccountRecord) => Promise<void>;
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

export function OfficerManagementSection({
  classConfig,
  students,
  officerAccounts,
  permissionAuditLogs,
  onCreateOfficerAccount,
  onUpdateOfficerRoles,
  onToggleOfficerLock,
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
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState('');

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

  // Đổi mật khẩu hàng loạt cho các nickname được chọn (GVCN nhập trực tiếp, không hardcode)
  const [selectedBatchCodes, setSelectedBatchCodes] = useState<string[]>([]);
  const [batchPassword, setBatchPassword] = useState('');
  const [showBatchPassword, setShowBatchPassword] = useState(false);
  const [batchMustChange, setBatchMustChange] = useState(false);
  const [isRunningBatch, setIsRunningBatch] = useState(false);
  const [batchFeedback, setBatchFeedback] = useState<string>('');

  const assignedStudentCodes = useMemo(
    () => new Set(officerAccounts.map((a) => a.studentCode)),
    [officerAccounts]
  );

  const availableStudents = useMemo(
    () => students.filter((st) => !assignedStudentCodes.has(st.code)),
    [students, assignedStudentCodes]
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
      const issued = await onCreateOfficerAccount({
        student,
        nickname: cleanNick,
        roles,
        initialPassword: finalPassword,
        mustChangePassword,
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
          <span className="px-3 py-1 rounded-lg bg-white/15 text-xs font-bold">
            {officerAccounts.length} tài khoản đã cấp
          </span>
        </div>

        <div className="p-5 space-y-6">
          {formError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{formError}</span>
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
                  onChange={(e) => setSelectedStudentCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6]"
                >
                  <option value="">-- Chọn học sinh --</option>
                  {availableStudents.map((st) => (
                    <option key={st.code} value={st.code}>
                      {st.fullName} ({st.code} • Tổ {st.team})
                    </option>
                  ))}
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
                      <th className="py-3 px-3">Học sinh / Nickname</th>
                      <th className="py-3 px-3">Chức vụ & Phạm vi</th>
                      <th className="py-3 px-3">Trạng thái</th>
                      <th className="py-3 px-3 text-right">Thao tác quản trị</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {officerAccounts.map((acc) => {
                      const isBusy = busyStudentCode === acc.studentCode;
                      return (
                        <tr key={acc.studentCode} className="hover:bg-slate-50/70">
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={selectedBatchCodes.includes(acc.studentCode)}
                              onChange={() => toggleBatchSelect(acc.studentCode)}
                            />
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-[#102744]">{acc.studentName}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                              <span className="font-mono font-bold text-[#0C9BA6] bg-teal-50 px-1.5 py-0.5 rounded">
                                {acc.nickname}
                              </span>
                              <span>
                                {acc.studentCode} • Tổ {acc.team} • v{acc.credentialVersion}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
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
                          </td>
                          <td className="py-3 px-3">
                            <div className="space-y-1">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                  acc.active
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {acc.active ? 'Đang hoạt động' : 'Đang bị khóa'}
                              </span>
                              <div className="text-[11px] text-slate-500">
                                {acc.mustChangePassword ? 'Chờ đổi MK lần đầu' : 'Đã xác nhận MK'}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex flex-wrap justify-end gap-1.5">
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
                                  setBusyStudentCode(acc.studentCode);
                                  try {
                                    await onToggleOfficerLock(acc);
                                  } finally {
                                    setBusyStudentCode(null);
                                  }
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 ${
                                  acc.active
                                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                                }`}
                              >
                                {acc.active ? (
                                  <>
                                    <Lock className="w-3.5 h-3.5" />
                                    <span>Khóa</span>
                                  </>
                                ) : (
                                  <>
                                    <Unlock className="w-3.5 h-3.5" />
                                    <span>Mở khóa</span>
                                  </>
                                )}
                              </button>
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
                                className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold inline-flex items-center gap-1"
                                title="Thu hồi toàn bộ tài khoản"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Thu hồi</span>
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
