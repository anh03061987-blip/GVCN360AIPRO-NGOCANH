import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Download,
  Users,
  Lock,
  Unlock,
  Link2,
  UserX,
  RefreshCw,
  ArrowRight,
  Check,
  Info,
} from 'lucide-react';
import type {
  ClassConfig,
  OfficerAccountRecord,
  OfficerRoleId,
  RoleAssignmentRecord,
  StudentRecord,
} from '../types/gvcn';
import {
  ROLE_BADGE_CLASSES,
  ROLE_ID_TO_LABEL,
  VALID_CLASS_OFFICER_ROLES,
  compareStudentsByRosterOrder,
  formatStudentRolesLabel,
  getStudentMoetCode,
  isValidRosterOrder,
} from '../utils/studentExcelImport';
import {
  buildOfficerGovernanceBackupPayload,
  evaluateEightPointActivationCheck,
  validateOfficerReconciliationDraft,
  type AnalyzedOfficerAccount,
  type OfficerGovernanceSummary,
  type OfficerLiveMembershipStatus,
} from '../utils/officerReconciliation';

export interface BatchActivationPositionResult {
  roleId: OfficerRoleId;
  roleLabel: string;
  studentName: string;
  nickname: string;
  status: 'activated' | 'already_active' | 'blocked';
  message: string;
}

interface OfficerReconciliationModalProps {
  open: boolean;
  onClose: () => void;
  classConfig: ClassConfig;
  workspaceId: string;
  teacherEmail: string;
  students: StudentRecord[];
  officerAccounts: OfficerAccountRecord[];
  roleAssignments: RoleAssignmentRecord[];
  officerLoginStatusMap: Record<string, OfficerLiveMembershipStatus>;
  governance: OfficerGovernanceSummary;
  onConfirmOfficialAssignments: (payload: {
    selections: Record<OfficerRoleId, string>;
    acknowledgedTeamMismatches: Partial<Record<OfficerRoleId, boolean>>;
    revokeStaleAccountIds: string[];
  }) => Promise<void>;
  onRelinkExistingOfficerAccount: (
    account: OfficerAccountRecord,
    targetStudent: StudentRecord,
    roles: OfficerRoleId[]
  ) => Promise<void>;
  onActivateOfficerPosition: (payload: {
    roleId: OfficerRoleId;
    securityLockVerifiedByGvcn?: boolean;
  }) => Promise<{ ok: boolean; message: string }>;
  onActivateAllSevenPositions: (payload: {
    verifiedSecurityLockAccountIds: string[];
  }) => Promise<BatchActivationPositionResult[]>;
  onRevokeOfficerAccount: (account: OfficerAccountRecord, reason?: string) => Promise<void>;
}

function toneBadgeClass(tone: 'slate' | 'amber' | 'sky' | 'emerald' | 'rose'): string {
  switch (tone) {
    case 'emerald':
      return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
    case 'amber':
      return 'bg-amber-50 text-amber-900 border border-amber-200';
    case 'sky':
      return 'bg-sky-50 text-sky-900 border border-sky-200';
    case 'rose':
      return 'bg-rose-50 text-rose-800 border border-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 border border-slate-200';
  }
}

export function OfficerReconciliationModal({
  open,
  onClose,
  classConfig,
  workspaceId,
  teacherEmail,
  students,
  officerAccounts,
  roleAssignments,
  officerLoginStatusMap,
  governance,
  onConfirmOfficialAssignments,
  onRelinkExistingOfficerAccount,
  onActivateOfficerPosition,
  onActivateAllSevenPositions,
  onRevokeOfficerAccount,
}: OfficerReconciliationModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selections, setSelections] = useState<Record<OfficerRoleId, string>>({
    lop_truong: '',
    to_truong_1: '',
    to_truong_2: '',
    to_truong_3: '',
    to_truong_4: '',
    thu_quy: '',
    bi_thu: '',
  });
  const [acknowledgedTeamMismatches, setAcknowledgedTeamMismatches] = useState<
    Partial<Record<OfficerRoleId, boolean>>
  >({});
  const [revokeStaleAccountIds, setRevokeStaleAccountIds] = useState<Record<string, boolean>>({});
  const [verifiedSecurityLockIds, setVerifiedSecurityLockIds] = useState<Record<string, boolean>>({});
  const [backupDownloaded, setBackupDownloaded] = useState(false);
  const [isSavingAssignments, setIsSavingAssignments] = useState(false);
  const [isRunningBatchActivate, setIsRunningBatchActivate] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [batchResults, setBatchResults] = useState<BatchActivationPositionResult[] | null>(null);

  const sortedStudents = useMemo(
    () => [...students].sort(compareStudentsByRosterOrder),
    [students]
  );

  // Khởi tạo lựa chọn mặc định khi mở modal (CHỈ ở state nháp cục bộ — TUYỆT ĐỐI không ghi Firestore)
  useEffect(() => {
    if (!open) return;
    const initial: Record<OfficerRoleId, string> = {
      lop_truong: '',
      to_truong_1: '',
      to_truong_2: '',
      to_truong_3: '',
      to_truong_4: '',
      thu_quy: '',
      bi_thu: '',
    };
    const initialAck: Partial<Record<OfficerRoleId, boolean>> = {};
    for (const pos of governance.positions) {
      if (pos.confirmedAssignment && pos.officialStudent) {
        initial[pos.roleId] = pos.officialStudent.id;
        if (pos.confirmedAssignment.teamMismatchAcknowledged) {
          initialAck[pos.roleId] = true;
        }
      } else if (pos.candidates.length === 1) {
        initial[pos.roleId] = pos.candidates[0].studentId;
      } else {
        // Nếu đang bị trùng 2–3 HS, KHÔNG tự động chọn bừa — để trống buộc GVCN chọn đích danh!
        initial[pos.roleId] = '';
      }
    }
    setSelections(initial);
    setAcknowledgedTeamMismatches(initialAck);
    setRevokeStaleAccountIds({});
    setVerifiedSecurityLockIds({});
    setBackupDownloaded(false);
    setErrorMsg('');
    setSuccessMsg('');
    setBatchResults(null);
    setStep(1);
    // Chỉ khởi tạo lại khi modal chuyển từ đóng sang mở
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const draftValidation = useMemo(
    () =>
      validateOfficerReconciliationDraft({
        selections,
        acknowledgedTeamMismatches,
        students: sortedStudents,
        analyzedAccounts: governance.analyzedAccounts,
      }),
    [selections, acknowledgedTeamMismatches, sortedStudents, governance.analyzedAccounts]
  );

  const allSevenConfirmedInDb =
    governance.confirmedPositionsCount === 7 && governance.duplicatePositionsCount === 0;

  if (!open) return null;

  const handleDownloadBackup = () => {
    const payload = buildOfficerGovernanceBackupPayload({
      classConfig,
      workspaceId,
      teacherEmail,
      students: sortedStudents,
      roleAssignments,
      officerAccounts,
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeClass = (classConfig.className || 'lop').replace(/[^a-zA-Z0-9_-]/g, '');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `backup_phan_quyen_${safeClass}_${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setBackupDownloaded(true);
  };

  const handleConfirmStage2 = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!draftValidation.valid) {
      setErrorMsg('Cần hoàn tất chọn đúng 1 học sinh hợp lệ cho cả 7 vị trí và xử lý cảnh báo lệch tổ trước khi xác nhận.');
      return;
    }
    setIsSavingAssignments(true);
    try {
      const selectedRevokeIds = Object.entries(revokeStaleAccountIds)
        .filter(([, checked]) => checked)
        .map(([accId]) => accId);

      await onConfirmOfficialAssignments({
        selections,
        acknowledgedTeamMismatches,
        revokeStaleAccountIds: selectedRevokeIds,
      });
      setSuccessMsg(
        'Đã lưu thành công 7 phân công chính thức trong giao dịch Firestore, lưu lịch sử phân công cũ và đồng bộ về Hồ sơ học sinh (giữ nguyên toàn bộ STT Excel, Mã MOET và StudentId).'
      );
      setStep(3);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Không thể lưu 7 phân công chính thức lên Firestore.'
      );
    } finally {
      setIsSavingAssignments(false);
    }
  };

  const handleRelinkAccount = async (
    analyzed: AnalyzedOfficerAccount,
    targetStudent: StudentRecord,
    roles: OfficerRoleId[]
  ) => {
    setBusyKey(`relink_${analyzed.account.id}`);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await onRelinkExistingOfficerAccount(analyzed.account, targetStudent, roles);
      setSuccessMsg(
        `Đã liên kết tài khoản "${analyzed.account.nickname}" (giữ nguyên Firebase UID) sang hồ sơ ${targetStudent.fullName} (${getStudentMoetCode(targetStudent) || targetStudent.id}).`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể liên kết tài khoản hiện có.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleActivateSingle = async (roleId: OfficerRoleId, accId?: string) => {
    setBusyKey(`act_${roleId}`);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await onActivateOfficerPosition({
        roleId,
        securityLockVerifiedByGvcn: accId ? Boolean(verifiedSecurityLockIds[accId]) : false,
      });
      if (!res.ok) {
        setErrorMsg(res.message);
      } else {
        setSuccessMsg(res.message);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể kích hoạt quyền.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleActivateAll7 = async () => {
    setIsRunningBatchActivate(true);
    setErrorMsg('');
    setSuccessMsg('');
    setBatchResults(null);
    try {
      const verifiedIds = Object.entries(verifiedSecurityLockIds)
        .filter(([, checked]) => checked)
        .map(([id]) => id);
      const results = await onActivateAllSevenPositions({
        verifiedSecurityLockAccountIds: verifiedIds,
      });
      setBatchResults(results);
      const okCount = results.filter((r) => r.status === 'activated' || r.status === 'already_active').length;
      const blockedCount = results.filter((r) => r.status === 'blocked').length;
      if (blockedCount === 0) {
        setSuccessMsg(`Hoàn tất xác minh & kích hoạt: ${okCount}/7 vị trí đang hoạt động hợp lệ.`);
      } else {
        setSuccessMsg(
          `Đã kiểm tra từng tài khoản: ${okCount}/7 vị trí hợp lệ/đã kích hoạt, ${blockedCount} vị trí chưa đủ điều kiện (xem chi tiết từng dòng bên dưới).`
        );
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi khi kích hoạt hàng loạt 7 vị trí.');
    } finally {
      setIsRunningBatchActivate(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#0f172a] via-[#102744] to-[#0C9BA6] text-white flex items-start justify-between gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-2 text-base sm:text-lg font-extrabold">
              <ShieldCheck className="w-5 h-5 text-teal-200 shrink-0" />
              <span>RÀ SOÁT &amp; ĐỒNG BỘ 7 VỊ TRÍ CÁN BỘ LỚP — LỚP {classConfig.className}</span>
            </div>
            <p className="text-xs text-teal-100 mt-0.5">
              {classConfig.schoolName} • Năm học {classConfig.schoolYear} • Sĩ số chính thức: {students.length} học sinh • Chỉ GVCN xác nhận mới ghi dữ liệu chính thức.
            </p>
          </div>
          <button
            type="button"
            disabled={isSavingAssignments || isRunningBatchActivate}
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                step === 1
                  ? 'bg-[#102744] text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>1. Chọn 7 học sinh chính thức</span>
            </button>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <button
              type="button"
              onClick={() => setStep(2)}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                step === 2
                  ? 'bg-[#102744] text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>2. Xem trước thay đổi &amp; Sao lưu</span>
            </button>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <button
              type="button"
              onClick={() => setStep(3)}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                step === 3
                  ? 'bg-[#0C9BA6] text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>3. Bảng kiểm tra &amp; Kích hoạt 7 vị trí</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownloadBackup}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border transition ${
              backupDownloaded
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-white hover:bg-teal-50 text-[#102744] border-slate-300'
            }`}
          >
            {backupDownloaded ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Download className="w-3.5 h-3.5 text-[#0C9BA6]" />
            )}
            <span>
              {backupDownloaded ? 'Đã tải bản sao lưu JSON' : 'Tải bản sao lưu trước khi sửa'}
            </span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Summary strip (Mục VIII) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] text-slate-500">Vị trí cần phân công</div>
              <div className="text-lg font-extrabold text-[#102744]">{governance.totalPositions}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
              <div className="text-[11px] text-emerald-800">Đã xác nhận chuẩn</div>
              <div className="text-lg font-extrabold text-emerald-700">
                {governance.confirmedPositionsCount}/7
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200">
              <div className="text-[11px] text-rose-800">Vị trí còn trùng</div>
              <div className="text-lg font-extrabold text-rose-700">
                {governance.duplicatePositionsCount}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-teal-50/70 border border-teal-200">
              <div className="text-[11px] text-teal-800">TK đang hoạt động</div>
              <div className="text-lg font-extrabold text-teal-700">
                {governance.activeAccountsCount}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-200">
              <div className="text-[11px] text-sky-800">TK chờ kích hoạt</div>
              <div className="text-lg font-extrabold text-sky-700">
                {governance.pendingActivationAccountsCount}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200">
              <div className="text-[11px] text-amber-800">TK bị khóa / thu hồi</div>
              <div className="text-lg font-extrabold text-amber-800">
                {governance.lockedAccountsCount + governance.revokedAccountsCount}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200">
              <div className="text-[11px] text-rose-800">TK sai liên kết / lệch</div>
              <div className="text-lg font-extrabold text-rose-700">
                {governance.mismatchedAccountsCount}
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-900 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">{successMsg}</div>
            </div>
          )}

          {/* STEP 1: Đối chiếu và chọn đúng 1 học sinh cho từng vị trí */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-950 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold">
                    Giai đoạn 1 (Rà soát an toàn — chưa thay đổi dữ liệu thật trên Firestore):
                  </div>
                  <p className="leading-relaxed">
                    Chức vụ nhập từ Excel chỉ là thông tin đề xuất. Hãy chọn <strong>chính xác 1 học sinh</strong> cho mỗi vị trí dưới đây. Một học sinh có thể kiêm nhiệm tối đa <strong>2 chức vụ khác nhau</strong> (không kiêm 2 vị trí Tổ trưởng). Nếu học sinh làm Tổ trưởng khác tổ hiện tại, hệ thống sẽ cảnh báo để GVCN tự quyết định, tuyệt đối không tự sửa tổ.
                  </p>
                </div>
              </div>

              <div className="space-y-3.5">
                {governance.positions.map((pos, idx) => {
                  const selectedId = selections[pos.roleId] || '';
                  const selectedStudent = sortedStudents.find((s) => s.id === selectedId) || null;
                  const teamMismatchWarning = draftValidation.teamMismatchWarnings.find(
                    (w) => w.roleId === pos.roleId
                  );

                  return (
                    <div
                      key={pos.roleId}
                      className={`rounded-2xl border p-4 space-y-3 ${
                        pos.isDuplicate && !selectedId
                          ? 'border-rose-300 bg-rose-50/30'
                          : teamMismatchWarning && !teamMismatchWarning.acknowledged
                            ? 'border-amber-300 bg-amber-50/30'
                            : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-[#102744] text-white text-xs font-extrabold inline-flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                              ROLE_BADGE_CLASSES[pos.roleId] || 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {pos.label}
                          </span>
                          {pos.requiredTeam && (
                            <span className="text-[11px] font-semibold text-slate-500">
                              (Yêu cầu thuộc Tổ {pos.requiredTeam})
                            </span>
                          )}
                          {pos.isDuplicate && (
                            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 text-[11px] font-bold">
                              Đang trùng {pos.candidates.length} học sinh
                            </span>
                          )}
                          {pos.confirmedAssignment && (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                              GVCN đã xác nhận: {pos.confirmedAssignment.studentName}
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-bold text-[#102744]">
                          {selectedStudent ? (
                            <span className="text-emerald-700">
                              Đang chọn: {selectedStudent.fullName} (Tổ {selectedStudent.team})
                            </span>
                          ) : (
                            <span className="text-rose-700">Chưa chọn học sinh chính thức</span>
                          )}
                        </div>
                      </div>

                      {/* Danh sách học sinh đang bị gán / trùng ở vị trí này */}
                      {pos.candidates.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-[11px] font-bold uppercase text-slate-500">
                            Học sinh hiện đang xuất hiện ở vị trí {pos.label} ({pos.candidates.length} hồ sơ):
                          </div>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                            {pos.candidates.map((cand) => {
                              const isSelected = selectedId === cand.studentId;
                              const acc = cand.linkedAccount;
                              return (
                                <label
                                  key={cand.studentId}
                                  className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 text-xs ${
                                    isSelected
                                      ? 'border-[#0C9BA6] bg-teal-50/50 ring-2 ring-[#0C9BA6]/20'
                                      : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/70'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`pos_${pos.roleId}`}
                                    checked={isSelected}
                                    onChange={() =>
                                      setSelections((prev) => ({
                                        ...prev,
                                        [pos.roleId]: cand.studentId,
                                      }))
                                    }
                                    className="mt-0.5 text-[#0C9BA6] focus:ring-[#0C9BA6]"
                                  />
                                  <div className="space-y-1 flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center justify-between gap-1">
                                      <span className="font-bold text-slate-900">
                                        {isValidRosterOrder(cand.student.rosterOrder)
                                          ? `#${cand.student.rosterOrder} `
                                          : ''}
                                        {cand.student.fullName}
                                      </span>
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                          cand.teamMismatch
                                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                            : 'bg-sky-50 text-sky-800 border border-sky-200'
                                        }`}
                                      >
                                        Tổ {cand.student.team}
                                        {cand.teamMismatch ? ` ≠ Tổ ${cand.requiredTeam}` : ''}
                                      </span>
                                    </div>
                                    <div className="font-mono text-[11px] text-slate-600 flex flex-wrap gap-x-3 gap-y-0.5">
                                      <span>Mã MOET: {cand.moetCode || '—'}</span>
                                      <span>StudentId: {cand.studentId}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                                      {cand.inProfileRoles && (
                                        <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-semibold text-slate-700">
                                          Hồ sơ/Excel: {formatStudentRolesLabel(cand.profileRoles)}
                                        </span>
                                      )}
                                      {cand.inConfirmedAssignment && (
                                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                          GVCN đã xác nhận trước đó
                                        </span>
                                      )}
                                    </div>
                                    <div className="pt-1 border-t border-slate-200/70 space-y-0.5 text-[11px]">
                                      {acc ? (
                                        <>
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="font-mono font-bold text-[#0C9BA6]">
                                              TK: {acc.account.nickname}
                                            </span>
                                            <span className="font-mono text-[10px] text-slate-400">
                                              UID: {acc.account.officerUid.slice(0, 12)}…
                                            </span>
                                          </div>
                                          <div className="flex flex-wrap gap-1.5">
                                            <span
                                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${toneBadgeClass(
                                                acc.firebaseAuthTone
                                              )}`}
                                            >
                                              Auth: {acc.firebaseAuthStatusLabel}
                                            </span>
                                            <span
                                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${toneBadgeClass(
                                                acc.classPermissionTone
                                              )}`}
                                            >
                                              Quyền: {acc.classPermissionLabel}
                                            </span>
                                          </div>
                                        </>
                                      ) : (
                                        <div className="text-amber-800 font-medium">
                                          Tài khoản Auth: Chưa có tài khoản liên kết với StudentId này
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Tài khoản có liên kết sai/mã cũ nhưng đang mang vai trò này */}
                      {pos.conflictingAccounts.length > 0 && (
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1">
                          <div className="font-bold flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>
                              Phát hiện {pos.conflictingAccounts.length} tài khoản liên kết mã cũ / sai học sinh đang giữ vai trò {pos.label}:
                            </span>
                          </div>
                          {pos.conflictingAccounts.map((ca) => (
                            <div key={ca.account.id} className="pl-5 text-[11px]">
                              • Nickname <code className="font-bold">{ca.account.nickname}</code> (UID{' '}
                              <code>{ca.account.officerUid.slice(0, 10)}…</code>, mã ghi trên TK:{' '}
                              <code>{ca.account.studentCode}</code>, tên: <strong>{ca.account.studentName}</strong>) —{' '}
                              {ca.diagnosticNote}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Chọn bất kỳ học sinh nào từ danh sách lớp 46 HS */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
                        <label className="text-xs font-bold text-slate-600 shrink-0">
                          Hoặc chọn từ danh sách {sortedStudents.length} HS lớp {classConfig.className}:
                        </label>
                        <select
                          value={selectedId}
                          onChange={(e) =>
                            setSelections((prev) => ({
                              ...prev,
                              [pos.roleId]: e.target.value,
                            }))
                          }
                          className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0C9BA6]"
                        >
                          <option value="">-- Chọn chính xác 1 học sinh đảm nhiệm {pos.label} --</option>
                          {sortedStudents.map((st) => {
                            const moet = getStudentMoetCode(st) || st.code;
                            return (
                              <option key={st.id} value={st.id}>
                                {isValidRosterOrder(st.rosterOrder) ? `#${st.rosterOrder} ` : ''}
                                {st.fullName} — Tổ {st.team} (Mã: {moet})
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* Cảnh báo lệch tổ cho Tổ trưởng (KHÔNG tự sửa tổ!) */}
                      {teamMismatchWarning && (
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 space-y-2">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <span>
                              <strong>Cảnh báo lệch tổ:</strong> Học sinh{' '}
                              <strong>{teamMismatchWarning.student.fullName}</strong> hiện đang thuộc{' '}
                              <strong>Tổ {teamMismatchWarning.student.team}</strong>, khác với vị trí{' '}
                              <strong>{teamMismatchWarning.roleLabel}</strong> (Tổ {teamMismatchWarning.requiredTeam}). Hệ thống <strong>không tự sửa tổ</strong> của học sinh — hãy chọn học sinh đúng Tổ {teamMismatchWarning.requiredTeam} hoặc xác nhận rõ bên dưới nếu giữ nguyên ngoại lệ.
                            </span>
                          </div>
                          <label className="inline-flex items-center gap-2 font-bold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(acknowledgedTeamMismatches[pos.roleId])}
                              onChange={(e) =>
                                setAcknowledgedTeamMismatches((prev) => ({
                                  ...prev,
                                  [pos.roleId]: e.target.checked,
                                }))
                              }
                              className="rounded border-amber-500 text-amber-700"
                            />
                            <span>
                              GVCN xác nhận giữ nguyên lựa chọn này (không tự thay đổi Tổ {teamMismatchWarning.student.team} của học sinh)
                            </span>
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Cảnh báo tổng hợp của bước 1 */}
              {draftValidation.blockingErrors.length > 0 && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1">
                  <div className="font-bold">Cần hoàn tất trước khi sang bước xác nhận:</div>
                  {draftValidation.blockingErrors.map((err, i) => (
                    <div key={i}>• {err}</div>
                  ))}
                </div>
              )}

              {draftValidation.dualRoleHolders.length > 0 && (
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-950">
                  <strong>Học sinh kiêm nhiệm (tối đa 2 vị trí, giữ 1 hồ sơ &amp; 1 tài khoản):</strong>{' '}
                  {draftValidation.dualRoleHolders
                    .map(
                      (d) =>
                        `${d.student.fullName} (${d.roles.map((r) => ROLE_ID_TO_LABEL[r]).join(' + ')})`
                    )
                    .join('; ')}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Xem trước thay đổi, Bảng kiểm tra 7 vị trí & Sao lưu */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 space-y-1.5">
                <div className="font-bold text-sm flex items-center gap-2 text-emerald-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>Cam kết bảo toàn dữ liệu lớp {classConfig.className} (Mục X)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                  <div>✓ Giữ nguyên toàn bộ {students.length} hồ sơ học sinh (0 xóa, 0 tạo lại)</div>
                  <div>✓ Không thay đổi thứ tự STT Excel (rosterOrder)</div>
                  <div>✓ Không thay đổi StudentId, Mã MOET, Tổ, SĐT phụ huynh</div>
                  <div>✓ Không thay đổi bảng điểm vnEdu, điểm danh, thi đua, quỹ lớp</div>
                  <div>✓ Không tự chuyển Firebase UID từ học sinh cũ sang học sinh mới</div>
                  <div>✓ Không tự mở khóa tài khoản bị khóa bảo mật</div>
                </div>
                <div className="pt-1 text-[11px] text-emerald-800">
                  <strong>Phương án khôi phục:</strong> Nhấn nút <em>&ldquo;Tải bản sao lưu trước khi sửa&rdquo;</em> ở góc trên phải để lưu file JSON chụp nguyên trạng 46 học sinh + phân công + tài khoản trước khi xác nhận. Mọi thay đổi phân công cũ cũng được lưu bất biến vào bộ sưu tập <code>role_assignment_history</code> và nhật ký <code>permission_audit_logs</code>.
                </div>
              </div>

              {/* Bảng xem trước 7 vị trí theo đúng cấu trúc Mục VIII */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 font-bold text-xs text-[#102744] uppercase">
                  Bảng xem trước 7 vị trí chính thức sau xác nhận
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] text-slate-500 uppercase">
                        <th className="py-2.5 px-3">Chức vụ</th>
                        <th className="py-2.5 px-3">Học sinh chính thức</th>
                        <th className="py-2.5 px-3">Mã MOET</th>
                        <th className="py-2.5 px-3">Tổ</th>
                        <th className="py-2.5 px-3">Nickname</th>
                        <th className="py-2.5 px-3">Trạng thái tài khoản</th>
                        <th className="py-2.5 px-3">Trạng thái quyền dự kiến</th>
                        <th className="py-2.5 px-3">Thao tác dự kiến</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {draftValidation.previewRows.map((row) => (
                        <tr key={row.roleId} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-bold text-[#102744] whitespace-nowrap">
                            {row.label}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {row.selectedStudent ? (
                              <>
                                {isValidRosterOrder(row.selectedStudent.rosterOrder)
                                  ? `#${row.selectedStudent.rosterOrder} `
                                  : ''}
                                {row.selectedStudent.fullName}
                              </>
                            ) : (
                              <span className="text-rose-600">Chưa chọn</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            {row.moetCode || '—'}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-sky-800">
                            {row.team ? `Tổ ${row.team}` : '—'}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-[#0C9BA6]">
                            {row.matchedAccount?.account.nickname ||
                              row.relinkCandidateAccount?.account.nickname ||
                              '—'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold ${toneBadgeClass(
                                row.firebaseAuthTone
                              )}`}
                            >
                              {row.firebaseAuthStatusLabel}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold ${toneBadgeClass(
                                row.projectedPermissionStatus === 'active'
                                  ? 'emerald'
                                  : row.projectedPermissionStatus === 'has_account_pending_activation'
                                    ? 'sky'
                                    : row.projectedPermissionStatus === 'assigned_no_account'
                                      ? 'amber'
                                      : 'rose'
                              )}`}
                            >
                              {row.projectedPermissionLabel}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">{row.projectedActionLabel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Danh sách hồ sơ học sinh sẽ đồng bộ lại chức vụ */}
              <div className="border border-slate-200 rounded-2xl p-4 space-y-2.5">
                <div className="font-bold text-xs text-[#102744] uppercase">
                  Thay đổi trường chức vụ trên hồ sơ học sinh ({draftValidation.studentRoleDiffs.length} hồ sơ thay đổi, {students.length - draftValidation.studentRoleDiffs.length} hồ sơ giữ nguyên)
                </div>
                {draftValidation.studentRoleDiffs.length === 0 ? (
                  <div className="text-xs text-slate-500">
                    Chức vụ trên toàn bộ {students.length} hồ sơ học sinh đã khớp với lựa chọn (vẫn sẽ tạo/cập nhật 7 bản ghi phân công duy nhất <code>role_assignments</code>).
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs max-h-48 overflow-y-auto pr-1">
                    {draftValidation.studentRoleDiffs.map((d) => (
                      <div
                        key={d.student.id}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-bold text-slate-900">
                            {isValidRosterOrder(d.student.rosterOrder) ? `#${d.student.rosterOrder} ` : ''}
                            {d.student.fullName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            <span className="line-through text-rose-600">
                              {formatStudentRolesLabel(d.oldRoles)}
                            </span>{' '}
                            →{' '}
                            <span className="font-bold text-emerald-700">
                              {formatStudentRolesLabel(d.newRoles)}
                            </span>
                          </div>
                        </div>
                        <span className="font-mono text-[10px] text-slate-400">
                          {getStudentMoetCode(d.student) || d.student.code}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Xử lý tài khoản cũ không còn giữ chức vụ / sai liên kết (chỉ thực hiện nếu GVCN chủ động tick!) */}
              {draftValidation.staleOrMismatchedAccounts.length > 0 && (
                <div className="border border-amber-300 bg-amber-50/50 rounded-2xl p-4 space-y-2.5">
                  <div className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Rà soát tài khoản cũ / sai liên kết ({draftValidation.staleOrMismatchedAccounts.length} tài khoản) — Không tự động thu hồi nếu GVCN chưa chọn:
                    </span>
                  </div>
                  <div className="space-y-2">
                    {draftValidation.staleOrMismatchedAccounts.map((item) => {
                      const canRevoke = item.expectedRolesAfterSync.length === 0;
                      return (
                        <div
                          key={item.analyzed.account.id}
                          className="p-2.5 rounded-xl bg-white border border-amber-200 text-xs flex flex-wrap items-start justify-between gap-2"
                        >
                          <div className="space-y-0.5 flex-1">
                            <div className="font-bold text-slate-900">
                              Nickname <code className="text-[#0C9BA6]">{item.analyzed.account.nickname}</code> —{' '}
                              {item.analyzed.account.studentName} (Mã TK:{' '}
                              <code>{item.analyzed.account.studentCode}</code>)
                            </div>
                            <div className="text-[11px] text-slate-600">{item.reason}</div>
                          </div>
                          {canRevoke && (
                            <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-700 cursor-pointer shrink-0">
                              <input
                                type="checkbox"
                                checked={Boolean(revokeStaleAccountIds[item.analyzed.account.id])}
                                onChange={(e) =>
                                  setRevokeStaleAccountIds((prev) => ({
                                    ...prev,
                                    [item.analyzed.account.id]: e.target.checked,
                                  }))
                                }
                                className="rounded border-rose-400 text-rose-600"
                              />
                              <span>Thu hồi quyền đăng nhập TK cũ này</span>
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Bảng kiểm tra trước khi kích hoạt & Kích hoạt 7 vị trí */}
          {step === 3 && (
            <div className="space-y-4">
              {!allSevenConfirmedInDb && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    Hiện có <strong>{governance.confirmedPositionsCount}/7 vị trí đã xác nhận chính thức</strong> và{' '}
                    <strong>{governance.duplicatePositionsCount} vị trí còn trùng</strong>. Nút{' '}
                    <strong>&ldquo;Xác nhận và kích hoạt 7 vị trí&rdquo;</strong> chỉ mở khi cả 7 vị trí đã được GVCN xác nhận duy nhất ở Bước 1 &amp; Bước 2.
                  </div>
                </div>
              )}

              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-xs sm:text-sm text-[#102744]">
                      BẢNG KIỂM TRA TRƯỚC KHI KÍCH HOẠT (7 VỊ TRÍ CÁN BỘ LỚP)
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Mỗi lần kích hoạt sẽ chạy đủ 8 bước kiểm tra (danh sách lớp, Mã MOET, StudentId, chức vụ chính thức, Firebase UID, cờ khóa bảo mật, đồng bộ backend).
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!allSevenConfirmedInDb || isRunningBatchActivate}
                    onClick={handleActivateAll7}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#102744] to-[#0C9BA6] hover:opacity-95 disabled:opacity-45 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      {isRunningBatchActivate
                        ? 'Đang xác minh từng tài khoản...'
                        : 'Xác nhận và kích hoạt 7 vị trí'}
                    </span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] uppercase text-slate-500">
                        <th className="py-2.5 px-3">Chức vụ</th>
                        <th className="py-2.5 px-3">Học sinh chính thức</th>
                        <th className="py-2.5 px-3">Mã MOET</th>
                        <th className="py-2.5 px-3">Tổ</th>
                        <th className="py-2.5 px-3">Nickname</th>
                        <th className="py-2.5 px-3">Trạng thái tài khoản</th>
                        <th className="py-2.5 px-3">Trạng thái quyền</th>
                        <th className="py-2.5 px-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {governance.positions.map((pos) => {
                        const st = pos.officialStudent;
                        const acc = pos.officialAccount;
                        const relinkCandidate =
                          st && !acc
                            ? governance.analyzedAccounts.find(
                                (a) =>
                                  a.linkage === 'legacy_code_relinkable' &&
                                  a.relinkCandidateStudent?.id === st.id
                              ) || null
                            : null;
                        const liveMem = acc ? officerLoginStatusMap[acc.account.officerUid] : null;
                        const check8 = evaluateEightPointActivationCheck({
                          roleId: pos.roleId,
                          assignment: pos.confirmedAssignment,
                          student: st,
                          account: acc?.account || null,
                          liveMembership: liveMem,
                          allStudents: sortedStudents,
                          securityLockVerifiedByGvcn: acc
                            ? Boolean(verifiedSecurityLockIds[acc.account.id])
                            : false,
                        });
                        const isBusy =
                          busyKey === `act_${pos.roleId}` ||
                          (relinkCandidate && busyKey === `relink_${relinkCandidate.account.id}`);

                        return (
                          <tr key={pos.roleId} className="hover:bg-slate-50/70">
                            <td className="py-3 px-3 font-bold text-[#102744] whitespace-nowrap">
                              {pos.label}
                            </td>
                            <td className="py-3 px-3">
                              {st ? (
                                <div>
                                  <div className="font-bold text-slate-900">
                                    {isValidRosterOrder(st.rosterOrder) ? `#${st.rosterOrder} ` : ''}
                                    {st.fullName}
                                  </div>
                                  <div className="font-mono text-[10px] text-slate-400">
                                    ID: {st.id}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-rose-600 font-bold">
                                  {pos.isDuplicate ? `Đang trùng ${pos.candidates.length} HS` : 'Chưa phân công'}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-600">
                              {st ? getStudentMoetCode(st) || st.code : '—'}
                            </td>
                            <td className="py-3 px-3 font-bold text-sky-800 whitespace-nowrap">
                              {st ? `Tổ ${st.team}` : '—'}
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-[#0C9BA6]">
                              {acc ? (
                                <div>
                                  <div>{acc.account.nickname}</div>
                                  <div className="text-[10px] text-slate-400 font-normal">
                                    UID: {acc.account.officerUid.slice(0, 8)}…
                                  </div>
                                </div>
                              ) : relinkCandidate ? (
                                <span className="text-amber-700">
                                  {relinkCandidate.account.nickname} (mã cũ)
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold ${toneBadgeClass(
                                  pos.firebaseAuthTone
                                )}`}
                              >
                                {pos.firebaseAuthStatusLabel}
                              </span>
                              {acc?.securityLockReason && (
                                <label className="mt-1.5 flex items-start gap-1.5 text-[10px] text-rose-800 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(verifiedSecurityLockIds[acc.account.id])}
                                    onChange={(e) =>
                                      setVerifiedSecurityLockIds((prev) => ({
                                        ...prev,
                                        [acc.account.id]: e.target.checked,
                                      }))
                                    }
                                    className="mt-0.5 rounded border-rose-400 text-rose-600"
                                  />
                                  <span>
                                    Xác minh khóa bảo mật ({acc.securityLockReason})
                                  </span>
                                </label>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold ${toneBadgeClass(
                                  pos.permissionStatusTone
                                )}`}
                              >
                                {pos.permissionStatusLabel}
                              </span>
                              {!check8.eligible && pos.permissionStatus !== 'active' && (
                                <div className="text-[10px] text-slate-500 mt-0.5 max-w-[200px]">
                                  {check8.blockingReason}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              {relinkCandidate && st && pos.confirmedAssignment ? (
                                <button
                                  type="button"
                                  disabled={Boolean(isBusy)}
                                  onClick={() => {
                                    const studentConfirmedRoles = VALID_CLASS_OFFICER_ROLES.filter(
                                      (r) =>
                                        roleAssignments.find((a) => a.roleId === r)?.studentId ===
                                        st.id
                                    );
                                    void handleRelinkAccount(
                                      relinkCandidate,
                                      st,
                                      studentConfirmedRoles.length > 0
                                        ? studentConfirmedRoles
                                        : [pos.roleId]
                                    );
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-[11px] font-bold inline-flex items-center gap-1"
                                >
                                  <Link2 className="w-3.5 h-3.5" />
                                  <span>Liên kết TK hiện có</span>
                                </button>
                              ) : acc && pos.confirmedAssignment ? (
                                pos.permissionStatus === 'active' ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Đang hoạt động
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={Boolean(isBusy) || !check8.eligible}
                                    onClick={() => handleActivateSingle(pos.roleId, acc.account.id)}
                                    title={check8.eligible ? 'Chạy đủ 8 bước kiểm tra & kích hoạt quyền' : check8.blockingReason}
                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 text-white text-[11px] font-bold inline-flex items-center gap-1"
                                  >
                                    <Unlock className="w-3.5 h-3.5" />
                                    <span>Kích hoạt quyền</span>
                                  </button>
                                )
                              ) : (
                                <span className="text-[11px] text-amber-800 font-semibold">
                                  {pos.confirmedAssignment
                                    ? 'Tạo TK ở bảng bên dưới'
                                    : 'Cần xác nhận ở Bước 1–2'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Báo cáo kết quả thực tế sau khi bấm "Xác nhận và kích hoạt 7 vị trí" */}
              {batchResults && (
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-2">
                  <div className="font-bold text-xs text-[#102744] uppercase">
                    Kết quả kiểm tra &amp; kích hoạt thực tế theo từng vị trí
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    {batchResults.map((r) => (
                      <div
                        key={r.roleId}
                        className={`p-2.5 rounded-xl border ${
                          r.status === 'blocked'
                            ? 'bg-rose-50 border-rose-200 text-rose-900'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        }`}
                      >
                        <div className="font-bold flex items-center justify-between gap-2">
                          <span>
                            {r.roleLabel} — {r.studentName || 'Chưa phân công'}
                          </span>
                          {r.nickname && <code className="text-[11px]">{r.nickname}</code>}
                        </div>
                        <div className="text-[11px] mt-0.5">{r.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Danh sách tài khoản liên kết sai / dư cần thu hồi */}
              {governance.analyzedAccounts.filter(
                (a) => a.linkage === 'mismatched_student' || a.linkage === 'orphan_not_in_roster'
              ).length > 0 && (
                <div className="border border-rose-200 bg-rose-50/50 rounded-2xl p-4 space-y-2.5">
                  <div className="font-bold text-xs text-rose-900 flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-rose-600" />
                    <span>
                      Tài khoản sai liên kết / mồ côi (tuyệt đối không chuyển UID sang học sinh mới):
                    </span>
                  </div>
                  {governance.analyzedAccounts
                    .filter(
                      (a) =>
                        a.linkage === 'mismatched_student' || a.linkage === 'orphan_not_in_roster'
                    )
                    .map((a) => (
                      <div
                        key={a.account.id}
                        className="p-2.5 rounded-xl bg-white border border-rose-200 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900">
                            <code>{a.account.nickname}</code> — {a.account.studentName} (Mã:{' '}
                            <code>{a.account.studentCode}</code>)
                          </div>
                          <div className="text-[11px] text-rose-700">{a.diagnosticNote}</div>
                        </div>
                        <button
                          type="button"
                          disabled={busyKey === `rev_${a.account.id}`}
                          onClick={async () => {
                            setBusyKey(`rev_${a.account.id}`);
                            setErrorMsg('');
                            try {
                              await onRevokeOfficerAccount(
                                a.account,
                                'Thu hồi tài khoản sai liên kết sau khi GVCN rà soát 7 vị trí'
                              );
                              setSuccessMsg(
                                `Đã thu hồi quyền của tài khoản sai liên kết "${a.account.nickname}".`
                              );
                            } catch (err) {
                              setErrorMsg(
                                err instanceof Error ? err.message : 'Không thể thu hồi tài khoản.'
                              );
                            } finally {
                              setBusyKey(null);
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-[11px] font-bold inline-flex items-center gap-1"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>Thu hồi quyền cũ</span>
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 flex items-center gap-2">
            <Users className="w-4 h-4 text-[#0C9BA6] shrink-0" />
            <span>
              {step === 1
                ? 'Bước 1/3: Chọn đúng 1 học sinh cho từng vị trí trong 7 vị trí cán bộ lớp.'
                : step === 2
                  ? 'Bước 2/3: Kiểm tra bảng xem trước & tải sao lưu trước khi xác nhận Giai đoạn 2.'
                  : 'Bước 3/3: Kiểm tra đủ 8 điều kiện an toàn và kích hoạt từng tài khoản hoặc đồng loạt.'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                disabled={isSavingAssignments || isRunningBatchActivate}
                onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
                className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold"
              >
                Quay lại
              </button>
            )}

            {step === 1 && (
              <button
                type="button"
                disabled={!draftValidation.valid}
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-xl bg-[#102744] hover:bg-slate-800 disabled:opacity-45 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <span>Tiếp tục xem trước thay đổi</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                disabled={!draftValidation.valid || isSavingAssignments}
                onClick={handleConfirmStage2}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#102744] to-[#0C9BA6] hover:opacity-95 disabled:opacity-45 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs"
              >
                {isSavingAssignments ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang lưu giao dịch Firestore...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Xác nhận lưu 7 phân công chính thức</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              disabled={isSavingAssignments || isRunningBatchActivate}
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
