import type {
  ClassConfig,
  OfficerAccountRecord,
  OfficerRoleId,
  RoleAssignmentRecord,
  StudentRecord,
} from '../types/gvcn';
import {
  ROLE_ID_TO_LABEL,
  VALID_CLASS_OFFICER_ROLES,
  areRoleListsEqual,
  compareStudentsByRosterOrder,
  getStudentMoetCode,
  getStudentRoles,
  getTeamNumberFromRole,
  normalizeNameKey,
} from './studentExcelImport';

export type UnifiedRoleLifecycleStatus =
  | 'unassigned'
  | 'assigned_no_account'
  | 'has_account_pending_activation'
  | 'active'
  | 'locked'
  | 'revoked'
  | 'needs_reconciliation';

export const UNIFIED_STATUS_META: Record<
  UnifiedRoleLifecycleStatus,
  { label: string; tone: 'slate' | 'amber' | 'sky' | 'emerald' | 'rose' }
> = {
  unassigned: { label: 'Chưa phân công', tone: 'slate' },
  assigned_no_account: { label: 'Đã phân công – Chưa có tài khoản', tone: 'amber' },
  has_account_pending_activation: { label: 'Đã có tài khoản – Chờ kích hoạt', tone: 'sky' },
  active: { label: 'Đang hoạt động', tone: 'emerald' },
  locked: { label: 'Tạm khóa', tone: 'rose' },
  revoked: { label: 'Đã thu hồi', tone: 'rose' },
  needs_reconciliation: { label: 'Cần đối chiếu', tone: 'rose' },
};

export interface OfficerLiveMembershipStatus {
  exists?: boolean;
  active?: boolean;
  studentCode?: string;
  studentId?: string;
  moetCode?: string;
  roles?: OfficerRoleId[];
  assignedTeam?: number;
  mustChangePassword?: boolean;
  lastLoginAtMs?: number;
  permissionStatus?: 'pending_activation' | 'active' | 'locked' | 'revoked';
  securityLockReason?: string;
}

export type AccountLinkageKind =
  | 'exact_match'
  | 'legacy_code_relinkable'
  | 'mismatched_student'
  | 'orphan_not_in_roster';

export interface AnalyzedOfficerAccount {
  account: OfficerAccountRecord;
  liveMembership?: OfficerLiveMembershipStatus | null;
  linkage: AccountLinkageKind;
  matchedStudent: StudentRecord | null;
  relinkCandidateStudent: StudentRecord | null;
  firebaseAuthStatusLabel: string;
  firebaseAuthTone: 'slate' | 'amber' | 'sky' | 'emerald' | 'rose';
  classPermissionStatus: UnifiedRoleLifecycleStatus;
  classPermissionLabel: string;
  classPermissionTone: 'slate' | 'amber' | 'sky' | 'emerald' | 'rose';
  securityLockReason: string;
  hasRoleDrift: boolean;
  diagnosticNote: string;
}

export interface PositionCandidateInfo {
  student: StudentRecord;
  studentId: string;
  moetCode: string;
  inProfileRoles: boolean;
  inConfirmedAssignment: boolean;
  inActiveAccountRoles: boolean;
  inAnyAccountRoles: boolean;
  profileRoles: OfficerRoleId[];
  linkedAccount: AnalyzedOfficerAccount | null;
  teamMismatch: boolean;
  requiredTeam: number | null;
}

export interface PositionReconciliationSummary {
  roleId: OfficerRoleId;
  label: string;
  requiredTeam: number | null;
  confirmedAssignment: RoleAssignmentRecord | null;
  officialStudent: StudentRecord | null;
  officialAccount: AnalyzedOfficerAccount | null;
  candidates: PositionCandidateInfo[];
  conflictingAccounts: AnalyzedOfficerAccount[];
  isDuplicate: boolean;
  isUnassigned: boolean;
  isConfirmed: boolean;
  hasTeamMismatch: boolean;
  firebaseAuthStatusLabel: string;
  firebaseAuthTone: 'slate' | 'amber' | 'sky' | 'emerald' | 'rose';
  permissionStatus: UnifiedRoleLifecycleStatus;
  permissionStatusLabel: string;
  permissionStatusTone: 'slate' | 'amber' | 'sky' | 'emerald' | 'rose';
  actionHint: string;
}

export interface OfficerGovernanceSummary {
  totalPositions: number;
  confirmedPositionsCount: number;
  duplicatePositionsCount: number;
  unassignedPositionsCount: number;
  activeAccountsCount: number;
  pendingActivationAccountsCount: number;
  lockedAccountsCount: number;
  revokedAccountsCount: number;
  mismatchedAccountsCount: number;
  totalCreatedAccountsCount: number;
  positions: PositionReconciliationSummary[];
  analyzedAccounts: AnalyzedOfficerAccount[];
}

export function matchAccountToStudentStrict(
  account: OfficerAccountRecord,
  students: StudentRecord[]
): {
  linkage: AccountLinkageKind;
  matchedStudent: StudentRecord | null;
  relinkCandidateStudent: StudentRecord | null;
  note: string;
} {
  const byId = new Map<string, StudentRecord>();
  const byCode = new Map<string, StudentRecord>();
  const byMoet = new Map<string, StudentRecord>();

  for (const st of students) {
    byId.set(st.id, st);
    if (st.code) byCode.set(st.code.trim().toUpperCase(), st);
    const moet = getStudentMoetCode(st).toUpperCase();
    if (moet) byMoet.set(moet, st);
  }

  const accStudentId = (account.studentId || '').trim();
  const accCode = (account.studentCode || '').trim().toUpperCase();
  const accMoet = (account.moetCode || '').trim().toUpperCase();

  // 1. Khớp chính xác theo studentId / studentCode / moetCode
  const exact =
    (accStudentId ? byId.get(accStudentId) : undefined) ||
    byId.get(account.studentCode) ||
    (accCode ? byCode.get(accCode) : undefined) ||
    (accMoet ? byMoet.get(accMoet) : undefined) ||
    (accCode ? byMoet.get(accCode) : undefined) ||
    null;

  if (exact) {
    // Kiểm tra chéo tên học sinh để phát hiện nguy cơ mã cũ từng trỏ sang HS khác
    const accNameKey = normalizeNameKey(account.studentName);
    const exactNameKey = normalizeNameKey(exact.fullName);
    if (accNameKey && exactNameKey && accNameKey !== exactNameKey) {
      return {
        linkage: 'mismatched_student',
        matchedStudent: exact,
        relinkCandidateStudent: null,
        note: `Tài khoản "${account.nickname}" đang ghi tên "${account.studentName}" nhưng mã ${account.studentCode} hiện trỏ sang "${exact.fullName}". Tuyệt đối không tự chuyển UID — cần GVCN đối chiếu.`,
      };
    }
    return {
      linkage: 'exact_match',
      matchedStudent: exact,
      relinkCandidateStudent: null,
      note: 'Liên kết chính xác theo studentId / Mã MOET.',
    };
  }

  // 2. Nếu mã cũ (ví dụ HS001) không còn trong danh sách lớp mới (đã chuyển sang Mã MOET),
  // chỉ gợi ý đối chiếu khi trùng DUY NHẤT 1 học sinh theo Họ tên chuẩn hóa (KHÔNG tự ghi đè)
  const accNameKey = normalizeNameKey(account.studentName);
  const nameMatches = accNameKey
    ? students.filter((st) => normalizeNameKey(st.fullName) === accNameKey)
    : [];

  if (nameMatches.length === 1) {
    return {
      linkage: 'legacy_code_relinkable',
      matchedStudent: null,
      relinkCandidateStudent: nameMatches[0],
      note: `Tài khoản dùng mã cũ "${account.studentCode}" chưa gắn Mã MOET "${getStudentMoetCode(nameMatches[0]) || nameMatches[0].id}". Cần GVCN xác nhận "Liên kết tài khoản hiện có" để giữ nguyên Firebase UID.`,
    };
  }

  return {
    linkage: 'orphan_not_in_roster',
    matchedStudent: null,
    relinkCandidateStudent: null,
    note: `Không tìm thấy học sinh khớp với tài khoản "${account.nickname}" (mã "${account.studentCode}") trong danh sách lớp chính thức.`,
  };
}

export function analyzeOfficerAccount(
  account: OfficerAccountRecord,
  students: StudentRecord[],
  roleAssignmentsByRole: Partial<Record<OfficerRoleId, RoleAssignmentRecord>>,
  liveMembership?: OfficerLiveMembershipStatus | null
): AnalyzedOfficerAccount {
  const linkageResult = matchAccountToStudentStrict(account, students);
  const matchedStudent = linkageResult.matchedStudent;
  const securityLockReason = (
    liveMembership?.securityLockReason ||
    account.securityLockReason ||
    ''
  ).trim();

  const effectivePermissionStatus =
    liveMembership?.permissionStatus || account.permissionStatus;
  const membershipExists = liveMembership ? liveMembership.exists !== false : true;
  const isAuthActive = Boolean(
    account.officerUid && account.active && membershipExists && liveMembership?.active !== false
  );

  // Tách bạch trạng thái tài khoản Firebase Authentication
  let firebaseAuthStatusLabel = 'Đã tạo Auth';
  let firebaseAuthTone: 'slate' | 'amber' | 'sky' | 'emerald' | 'rose' = 'emerald';

  if (!account.officerUid) {
    firebaseAuthStatusLabel = 'Thiếu Firebase UID';
    firebaseAuthTone = 'rose';
  } else if (linkageResult.linkage === 'mismatched_student' || linkageResult.linkage === 'orphan_not_in_roster') {
    firebaseAuthStatusLabel = `Sai liên kết HS (${account.nickname})`;
    firebaseAuthTone = 'rose';
  } else if (linkageResult.linkage === 'legacy_code_relinkable') {
    firebaseAuthStatusLabel = `Cần liên kết mã mới (${account.nickname})`;
    firebaseAuthTone = 'amber';
  } else if (!membershipExists) {
    firebaseAuthStatusLabel = `Thiếu hồ sơ Auth (${account.nickname})`;
    firebaseAuthTone = 'rose';
  } else if (!account.active || liveMembership?.active === false) {
    firebaseAuthStatusLabel =
      effectivePermissionStatus === 'revoked'
        ? `Auth đã thu hồi (${account.nickname})`
        : effectivePermissionStatus === 'pending_activation'
          ? `Đã tạo Auth – Chưa bật (${account.nickname})`
          : `Auth đang tạm khóa (${account.nickname})`;
    firebaseAuthTone = effectivePermissionStatus === 'pending_activation' ? 'sky' : 'rose';
  } else if (
    (liveMembership?.mustChangePassword ?? account.mustChangePassword) &&
    !liveMembership?.lastLoginAtMs
  ) {
    firebaseAuthStatusLabel = `Auth hợp lệ – Chờ đổi MK đầu (${account.nickname})`;
    firebaseAuthTone = 'sky';
  } else {
    firebaseAuthStatusLabel = `Auth hợp lệ (${account.nickname})`;
    firebaseAuthTone = 'emerald';
  }

  // Xác định chức vụ chính thức (ưu tiên role_assignments nếu đã có xác nhận GVCN)
  const confirmedRolesForStudent: OfficerRoleId[] = [];
  if (matchedStudent) {
    for (const rId of VALID_CLASS_OFFICER_ROLES) {
      const a = roleAssignmentsByRole[rId];
      if (a && a.studentId === matchedStudent.id) {
        confirmedRolesForStudent.push(rId);
      }
    }
  }
  const hasAnyConfirmedTable = Object.keys(roleAssignmentsByRole).length > 0;
  const expectedRoles = matchedStudent
    ? hasAnyConfirmedTable
      ? confirmedRolesForStudent
      : getStudentRoles(matchedStudent)
    : [];
  const hasRoleDrift = Boolean(
    matchedStudent && !areRoleListsEqual(expectedRoles, account.roles || [])
  );

  // Tách bạch trạng thái quyền chức vụ trong lớp (7 trạng thái chuẩn Mục VII)
  let classPermissionStatus: UnifiedRoleLifecycleStatus = 'active';
  if (linkageResult.linkage !== 'exact_match') {
    classPermissionStatus = 'needs_reconciliation';
  } else if (effectivePermissionStatus === 'revoked') {
    classPermissionStatus = 'revoked';
  } else if (securityLockReason) {
    classPermissionStatus = 'locked';
  } else if (effectivePermissionStatus === 'pending_activation') {
    classPermissionStatus = 'has_account_pending_activation';
  } else if (!isAuthActive) {
    classPermissionStatus = 'locked';
  } else if (expectedRoles.length === 0) {
    classPermissionStatus = hasAnyConfirmedTable ? 'revoked' : 'needs_reconciliation';
  } else if (hasRoleDrift) {
    classPermissionStatus = 'needs_reconciliation';
  } else {
    classPermissionStatus = 'active';
  }

  const meta = UNIFIED_STATUS_META[classPermissionStatus];
  let diagnosticNote = linkageResult.note;
  if (securityLockReason) {
    diagnosticNote = `Bị khóa bảo mật: ${securityLockReason}`;
  } else if (classPermissionStatus === 'needs_reconciliation' && hasRoleDrift) {
    diagnosticNote = `Vai trò trên tài khoản (${(account.roles || []).map((r) => ROLE_ID_TO_LABEL[r] || r).join(' + ')}) đang lệch với chức vụ hiện hành của học sinh.`;
  } else if (classPermissionStatus === 'revoked') {
    diagnosticNote = 'Học sinh không còn giữ chức vụ chính thức — cần thu hồi quyền đăng nhập.';
  }

  return {
    account,
    liveMembership,
    linkage: linkageResult.linkage,
    matchedStudent,
    relinkCandidateStudent: linkageResult.relinkCandidateStudent,
    firebaseAuthStatusLabel,
    firebaseAuthTone,
    classPermissionStatus,
    classPermissionLabel: meta.label,
    classPermissionTone: meta.tone,
    securityLockReason,
    hasRoleDrift,
    diagnosticNote,
  };
}

export function analyzeOfficerPositionsAndAccounts(params: {
  students: StudentRecord[];
  officerAccounts: OfficerAccountRecord[];
  roleAssignments: RoleAssignmentRecord[];
  officerLoginStatusMap?: Record<string, OfficerLiveMembershipStatus>;
}): OfficerGovernanceSummary {
  const {
    students,
    officerAccounts,
    roleAssignments,
    officerLoginStatusMap = {},
  } = params;

  const sortedStudents = [...students].sort(compareStudentsByRosterOrder);
  const roleAssignmentsByRole: Partial<Record<OfficerRoleId, RoleAssignmentRecord>> = {};
  for (const a of roleAssignments) {
    roleAssignmentsByRole[a.roleId] = a;
  }

  const analyzedAccounts = officerAccounts.map((acc) =>
    analyzeOfficerAccount(
      acc,
      sortedStudents,
      roleAssignmentsByRole,
      officerLoginStatusMap[acc.officerUid] || null
    )
  );

  const accountByExactStudentId = new Map<string, AnalyzedOfficerAccount>();
  for (const analyzed of analyzedAccounts) {
    if (analyzed.linkage === 'exact_match' && analyzed.matchedStudent) {
      accountByExactStudentId.set(analyzed.matchedStudent.id, analyzed);
    }
  }

  const studentById = new Map<string, StudentRecord>();
  for (const st of sortedStudents) {
    studentById.set(st.id, st);
  }

  const positions: PositionReconciliationSummary[] = VALID_CLASS_OFFICER_ROLES.map((roleId) => {
    const requiredTeam = getTeamNumberFromRole(roleId);
    const confirmedAssignment = roleAssignmentsByRole[roleId] || null;
    const confirmedStudent =
      confirmedAssignment ? studentById.get(confirmedAssignment.studentId) || null : null;

    // Thu thập TẤT CẢ học sinh hiện đang được gán chức vụ từ hồ sơ/Excel, xác nhận GVCN, hoặc tài khoản cán bộ
    const candidateMap = new Map<string, PositionCandidateInfo>();
    for (const st of sortedStudents) {
      const profileRoles = getStudentRoles(st);
      const inProfileRoles = profileRoles.includes(roleId);
      const inConfirmedAssignment = Boolean(confirmedStudent && confirmedStudent.id === st.id);
      const linkedAcc = accountByExactStudentId.get(st.id) || null;
      const inAnyAccountRoles = Boolean(linkedAcc && (linkedAcc.account.roles || []).includes(roleId));
      const inActiveAccountRoles = Boolean(
        linkedAcc && linkedAcc.account.active && (linkedAcc.account.roles || []).includes(roleId)
      );

      if (inProfileRoles || inConfirmedAssignment || inActiveAccountRoles) {
        candidateMap.set(st.id, {
          student: st,
          studentId: st.id,
          moetCode: getStudentMoetCode(st),
          inProfileRoles,
          inConfirmedAssignment,
          inActiveAccountRoles,
          inAnyAccountRoles,
          profileRoles,
          linkedAccount: linkedAcc,
          teamMismatch: requiredTeam !== null && Number(st.team) !== requiredTeam,
          requiredTeam,
        });
      }
    }

    const candidates = Array.from(candidateMap.values());
    // Các tài khoản có liên kết sai/mồ côi nhưng vẫn giữ vai trò roleId
    const conflictingAccounts = analyzedAccounts.filter(
      (a) =>
        (a.account.roles || []).includes(roleId) &&
        (a.linkage !== 'exact_match' ||
          (confirmedStudent && a.matchedStudent && a.matchedStudent.id !== confirmedStudent.id))
    );

    const isDuplicate = candidates.length > 1;
    const isUnassigned = candidates.length === 0 && !confirmedStudent;
    const officialStudent =
      confirmedStudent || (candidates.length === 1 ? candidates[0].student : null);
    const officialAccount = officialStudent
      ? accountByExactStudentId.get(officialStudent.id) || null
      : null;

    const isConfirmed = Boolean(
      confirmedAssignment &&
        confirmedStudent &&
        !isDuplicate &&
        conflictingAccounts.filter((a) => a.account.active).length === 0
    );

    const hasTeamMismatch = Boolean(
      officialStudent && requiredTeam !== null && Number(officialStudent.team) !== requiredTeam
    );

    let firebaseAuthStatusLabel = 'Chưa có tài khoản';
    let firebaseAuthTone: 'slate' | 'amber' | 'sky' | 'emerald' | 'rose' = 'amber';
    let permissionStatus: UnifiedRoleLifecycleStatus = 'unassigned';
    let actionHint = 'Chọn học sinh chính thức';

    if (isDuplicate) {
      permissionStatus = 'needs_reconciliation';
      firebaseAuthStatusLabel = `${candidates.length} hồ sơ đang trùng`;
      firebaseAuthTone = 'rose';
      actionHint = 'Rà soát chọn 1 học sinh duy nhất';
    } else if (!officialStudent) {
      permissionStatus = 'unassigned';
      firebaseAuthStatusLabel = 'Chưa phân công';
      firebaseAuthTone = 'slate';
      actionHint = 'Phân công học sinh';
    } else if (!officialAccount) {
      permissionStatus = confirmedAssignment ? 'assigned_no_account' : 'needs_reconciliation';
      firebaseAuthStatusLabel = 'Chưa tạo tài khoản Firebase Auth';
      firebaseAuthTone = 'amber';
      actionHint = confirmedAssignment ? 'Tạo tài khoản hoặc liên kết TK cũ' : 'Xác nhận phân công & tạo TK';
    } else {
      firebaseAuthStatusLabel = officialAccount.firebaseAuthStatusLabel;
      firebaseAuthTone = officialAccount.firebaseAuthTone;
      if (!confirmedAssignment && conflictingAccounts.length > 0) {
        permissionStatus = 'needs_reconciliation';
        actionHint = 'Rà soát tài khoản trùng / sai liên kết';
      } else {
        permissionStatus = officialAccount.classPermissionStatus;
        if (permissionStatus === 'active') {
          actionHint = 'Đang vận hành ổn định';
        } else if (permissionStatus === 'has_account_pending_activation') {
          actionHint = 'Kích hoạt quyền';
        } else if (permissionStatus === 'locked') {
          actionHint = officialAccount.securityLockReason
            ? 'Xác minh lý do khóa bảo mật'
            : 'Kích hoạt / Mở khóa quyền';
        } else if (permissionStatus === 'revoked') {
          actionHint = 'Thu hồi hoặc cấp lại quyền';
        } else {
          actionHint = 'Đối chiếu & đồng bộ quyền';
        }
      }
    }

    const pMeta = UNIFIED_STATUS_META[permissionStatus];

    return {
      roleId,
      label: ROLE_ID_TO_LABEL[roleId] || roleId,
      requiredTeam,
      confirmedAssignment,
      officialStudent,
      officialAccount,
      candidates,
      conflictingAccounts,
      isDuplicate,
      isUnassigned,
      isConfirmed,
      hasTeamMismatch,
      firebaseAuthStatusLabel,
      firebaseAuthTone,
      permissionStatus,
      permissionStatusLabel: pMeta.label,
      permissionStatusTone: pMeta.tone,
      actionHint,
    };
  });

  const confirmedPositionsCount = positions.filter((p) => p.isConfirmed).length;
  const duplicatePositionsCount = positions.filter((p) => p.isDuplicate).length;
  const unassignedPositionsCount = positions.filter((p) => p.isUnassigned).length;

  const activeAccountsCount = analyzedAccounts.filter(
    (a) => a.classPermissionStatus === 'active'
  ).length;
  const pendingActivationAccountsCount = analyzedAccounts.filter(
    (a) => a.classPermissionStatus === 'has_account_pending_activation'
  ).length;
  const lockedAccountsCount = analyzedAccounts.filter(
    (a) => a.classPermissionStatus === 'locked'
  ).length;
  const revokedAccountsCount = analyzedAccounts.filter(
    (a) => a.classPermissionStatus === 'revoked'
  ).length;
  const mismatchedAccountsCount = analyzedAccounts.filter(
    (a) =>
      a.linkage !== 'exact_match' ||
      (a.classPermissionStatus === 'needs_reconciliation' && a.hasRoleDrift)
  ).length;

  return {
    totalPositions: VALID_CLASS_OFFICER_ROLES.length,
    confirmedPositionsCount,
    duplicatePositionsCount,
    unassignedPositionsCount,
    activeAccountsCount,
    pendingActivationAccountsCount,
    lockedAccountsCount,
    revokedAccountsCount,
    mismatchedAccountsCount,
    totalCreatedAccountsCount: analyzedAccounts.length,
    positions,
    analyzedAccounts,
  };
}

export interface ReconciliationDraftValidation {
  valid: boolean;
  blockingErrors: string[];
  teamMismatchWarnings: Array<{
    roleId: OfficerRoleId;
    roleLabel: string;
    student: StudentRecord;
    requiredTeam: number;
    acknowledged: boolean;
  }>;
  dualRoleHolders: Array<{
    student: StudentRecord;
    roles: OfficerRoleId[];
  }>;
  rolesByStudentId: Record<string, OfficerRoleId[]>;
  studentRoleDiffs: Array<{
    student: StudentRecord;
    oldRoles: OfficerRoleId[];
    newRoles: OfficerRoleId[];
  }>;
  staleOrMismatchedAccounts: Array<{
    analyzed: AnalyzedOfficerAccount;
    expectedRolesAfterSync: OfficerRoleId[];
    reason: string;
  }>;
  previewRows: Array<{
    roleId: OfficerRoleId;
    label: string;
    selectedStudent: StudentRecord | null;
    moetCode: string;
    team: number | null;
    matchedAccount: AnalyzedOfficerAccount | null;
    relinkCandidateAccount: AnalyzedOfficerAccount | null;
    firebaseAuthStatusLabel: string;
    firebaseAuthTone: 'slate' | 'amber' | 'sky' | 'emerald' | 'rose';
    projectedPermissionStatus: UnifiedRoleLifecycleStatus;
    projectedPermissionLabel: string;
    projectedActionLabel: string;
  }>;
}

export function validateOfficerReconciliationDraft(params: {
  selections: Record<OfficerRoleId, string>;
  acknowledgedTeamMismatches: Partial<Record<OfficerRoleId, boolean>>;
  students: StudentRecord[];
  analyzedAccounts: AnalyzedOfficerAccount[];
}): ReconciliationDraftValidation {
  const { selections, acknowledgedTeamMismatches, students, analyzedAccounts } = params;
  const studentById = new Map<string, StudentRecord>();
  for (const st of students) {
    studentById.set(st.id, st);
  }

  const blockingErrors: string[] = [];
  const teamMismatchWarnings: ReconciliationDraftValidation['teamMismatchWarnings'] = [];
  const rolesByStudentId: Record<string, OfficerRoleId[]> = {};

  for (const roleId of VALID_CLASS_OFFICER_ROLES) {
    const selectedId = (selections[roleId] || '').trim();
    if (!selectedId) {
      blockingErrors.push(`Vị trí "${ROLE_ID_TO_LABEL[roleId]}" chưa chọn học sinh chính thức.`);
      continue;
    }
    const st = studentById.get(selectedId);
    if (!st) {
      blockingErrors.push(
        `Học sinh được chọn cho vị trí "${ROLE_ID_TO_LABEL[roleId]}" không tồn tại trong danh sách lớp chính thức.`
      );
      continue;
    }
    if (!rolesByStudentId[st.id]) rolesByStudentId[st.id] = [];
    rolesByStudentId[st.id].push(roleId);

    const requiredTeam = getTeamNumberFromRole(roleId);
    if (requiredTeam !== null && Number(st.team) !== requiredTeam) {
      const acknowledged = Boolean(acknowledgedTeamMismatches[roleId]);
      teamMismatchWarnings.push({
        roleId,
        roleLabel: ROLE_ID_TO_LABEL[roleId],
        student: st,
        requiredTeam,
        acknowledged,
      });
      if (!acknowledged) {
        blockingErrors.push(
          `Học sinh ${st.fullName} (Tổ ${st.team}) được chọn làm ${ROLE_ID_TO_LABEL[roleId]} (không cùng Tổ ${requiredTeam}). Vui lòng xác nhận quyết định hoặc đổi học sinh đúng tổ.`
        );
      }
    }
  }

  const dualRoleHolders: ReconciliationDraftValidation['dualRoleHolders'] = [];
  for (const [stId, roles] of Object.entries(rolesByStudentId)) {
    const st = studentById.get(stId);
    if (!st) continue;
    if (roles.length > 2) {
      blockingErrors.push(
        `Học sinh ${st.fullName} đang được chọn tới ${roles.length} chức vụ (tối đa chỉ cho phép kiêm nhiệm 2 chức vụ khác nhau).`
      );
    }
    const teamRoles = roles.filter((r) => r.startsWith('to_truong_'));
    if (teamRoles.length > 1) {
      blockingErrors.push(
        `Học sinh ${st.fullName} không thể đồng thời làm Tổ trưởng của hai tổ khác nhau (${teamRoles.map((r) => ROLE_ID_TO_LABEL[r]).join(' & ')}).`
      );
    }
    if (roles.length === 2) {
      dualRoleHolders.push({ student: st, roles });
    }
  }

  // Tính danh sách hồ sơ học sinh sẽ thay đổi chức vụ (chỉ role/secondRole/roles — KHÔNG đụng rosterOrder/MOET/studentId)
  const studentRoleDiffs: ReconciliationDraftValidation['studentRoleDiffs'] = [];
  for (const st of [...students].sort(compareStudentsByRosterOrder)) {
    const oldRoles = getStudentRoles(st);
    const newRoles = rolesByStudentId[st.id] || [];
    if (!areRoleListsEqual(oldRoles, newRoles)) {
      studentRoleDiffs.push({ student: st, oldRoles, newRoles });
    }
  }

  // Phân loại các tài khoản hiện có so với lựa chọn mới
  const exactAccountByStudentId = new Map<string, AnalyzedOfficerAccount>();
  const relinkAccountByStudentId = new Map<string, AnalyzedOfficerAccount>();
  const staleOrMismatchedAccounts: ReconciliationDraftValidation['staleOrMismatchedAccounts'] = [];

  for (const analyzed of analyzedAccounts) {
    if (analyzed.linkage === 'exact_match' && analyzed.matchedStudent) {
      exactAccountByStudentId.set(analyzed.matchedStudent.id, analyzed);
      const nextRoles = rolesByStudentId[analyzed.matchedStudent.id] || [];
      if (nextRoles.length === 0) {
        staleOrMismatchedAccounts.push({
          analyzed,
          expectedRolesAfterSync: [],
          reason: `Học sinh ${analyzed.matchedStudent.fullName} không còn trong 7 vị trí chính thức — cần thu hồi quyền tài khoản "${analyzed.account.nickname}" (tuyệt đối không chuyển UID cho học sinh mới).`,
        });
      } else if (!areRoleListsEqual(analyzed.account.roles || [], nextRoles)) {
        staleOrMismatchedAccounts.push({
          analyzed,
          expectedRolesAfterSync: nextRoles,
          reason: `Tài khoản "${analyzed.account.nickname}" đang giữ vai trò cũ — sẽ đồng bộ đúng chức vụ mới sau xác nhận (giữ nguyên Firebase UID).`,
        });
      }
    } else if (analyzed.linkage === 'legacy_code_relinkable' && analyzed.relinkCandidateStudent) {
      relinkAccountByStudentId.set(analyzed.relinkCandidateStudent.id, analyzed);
      const nextRoles = rolesByStudentId[analyzed.relinkCandidateStudent.id] || [];
      staleOrMismatchedAccounts.push({
        analyzed,
        expectedRolesAfterSync: nextRoles,
        reason:
          nextRoles.length > 0
            ? `Tài khoản "${analyzed.account.nickname}" dùng mã cũ "${analyzed.account.studentCode}" trùng tên ${analyzed.relinkCandidateStudent.fullName} — cần GVCN bấm "Liên kết tài khoản hiện có" hoặc tạo mới.`
            : `Tài khoản mã cũ "${analyzed.account.nickname}" không thuộc 7 vị trí chính thức — cần thu hồi.`,
      });
    } else {
      staleOrMismatchedAccounts.push({
        analyzed,
        expectedRolesAfterSync: [],
        reason: analyzed.diagnosticNote,
      });
    }
  }

  const previewRows: ReconciliationDraftValidation['previewRows'] = VALID_CLASS_OFFICER_ROLES.map(
    (roleId) => {
      const selectedId = (selections[roleId] || '').trim();
      const st = selectedId ? studentById.get(selectedId) || null : null;
      const matchedAccount = st ? exactAccountByStudentId.get(st.id) || null : null;
      const relinkCandidateAccount =
        st && !matchedAccount ? relinkAccountByStudentId.get(st.id) || null : null;

      let firebaseAuthStatusLabel = 'Chưa có tài khoản';
      let firebaseAuthTone: 'slate' | 'amber' | 'sky' | 'emerald' | 'rose' = 'amber';
      let projectedPermissionStatus: UnifiedRoleLifecycleStatus = 'unassigned';
      let projectedActionLabel = 'Chọn học sinh';

      if (!st) {
        projectedPermissionStatus = 'unassigned';
        firebaseAuthStatusLabel = 'Chưa phân công';
        firebaseAuthTone = 'slate';
        projectedActionLabel = 'Bắt buộc chọn 1 HS';
      } else if (matchedAccount) {
        firebaseAuthStatusLabel = matchedAccount.firebaseAuthStatusLabel;
        firebaseAuthTone = matchedAccount.firebaseAuthTone;
        if (matchedAccount.securityLockReason) {
          projectedPermissionStatus = 'locked';
          projectedActionLabel = 'Bị khóa bảo mật — GVCN xác minh riêng';
        } else if (!matchedAccount.account.active) {
          projectedPermissionStatus = 'has_account_pending_activation';
          projectedActionLabel = 'Giữ UID cũ — Chờ GVCN kích hoạt';
        } else {
          projectedPermissionStatus = 'active';
          projectedActionLabel = 'Giữ nguyên UID & đồng bộ vai trò';
        }
      } else if (relinkCandidateAccount) {
        firebaseAuthStatusLabel = `Tìm thấy TK mã cũ (${relinkCandidateAccount.account.nickname})`;
        firebaseAuthTone = 'sky';
        projectedPermissionStatus = 'needs_reconciliation';
        projectedActionLabel = 'Cần GVCN xác nhận liên kết TK hiện có';
      } else {
        firebaseAuthStatusLabel = 'Chưa tạo Firebase Auth';
        firebaseAuthTone = 'amber';
        projectedPermissionStatus = 'assigned_no_account';
        projectedActionLabel = 'Sẽ tạo tài khoản mới sau khi lưu phân công';
      }

      return {
        roleId,
        label: ROLE_ID_TO_LABEL[roleId],
        selectedStudent: st,
        moetCode: st ? getStudentMoetCode(st) : '',
        team: st ? Number(st.team) : null,
        matchedAccount,
        relinkCandidateAccount,
        firebaseAuthStatusLabel,
        firebaseAuthTone,
        projectedPermissionStatus,
        projectedPermissionLabel: UNIFIED_STATUS_META[projectedPermissionStatus].label,
        projectedActionLabel,
      };
    }
  );

  return {
    valid: blockingErrors.length === 0,
    blockingErrors,
    teamMismatchWarnings,
    dualRoleHolders,
    rolesByStudentId,
    studentRoleDiffs,
    staleOrMismatchedAccounts,
    previewRows,
  };
}

export interface ActivationCheckStep {
  step: number;
  label: string;
  passed: boolean;
  detail: string;
}

export interface EightPointActivationCheckResult {
  eligible: boolean;
  checks: ActivationCheckStep[];
  blockingReason: string;
}

/**
 * Kiểm tra đầy đủ 8 điều kiện bắt buộc trước khi "Kích hoạt quyền" (Mục VII).
 */
export function evaluateEightPointActivationCheck(params: {
  roleId: OfficerRoleId;
  assignment: RoleAssignmentRecord | null;
  student: StudentRecord | null;
  account: OfficerAccountRecord | null;
  liveMembership?: OfficerLiveMembershipStatus | null;
  allStudents: StudentRecord[];
  securityLockVerifiedByGvcn?: boolean;
}): EightPointActivationCheckResult {
  const {
    roleId,
    assignment,
    student,
    account,
    liveMembership,
    allStudents,
    securityLockVerifiedByGvcn = false,
  } = params;

  const rosterStudent = student
    ? allStudents.find((s) => s.id === student.id) || null
    : null;
  const studentMoet = rosterStudent ? getStudentMoetCode(rosterStudent) : '';
  const profileRoles = rosterStudent ? getStudentRoles(rosterStudent) : [];
  const lockReason = (
    liveMembership?.securityLockReason ||
    account?.securityLockReason ||
    ''
  ).trim();

  const check1Passed = Boolean(rosterStudent);
  const check2Passed = Boolean(
    rosterStudent &&
      rosterStudent.id &&
      (studentMoet || rosterStudent.code) &&
      (!assignment || assignment.studentId === rosterStudent.id)
  );
  const check3Passed = Boolean(
    rosterStudent &&
      assignment &&
      assignment.roleId === roleId &&
      assignment.studentId === rosterStudent.id &&
      profileRoles.includes(roleId)
  );
  const accountMatchesStudent = Boolean(
    account &&
      rosterStudent &&
      account.officerUid &&
      (account.studentId === rosterStudent.id ||
        account.studentCode === rosterStudent.id ||
        account.studentCode === rosterStudent.code ||
        (studentMoet && account.moetCode === studentMoet)) &&
      normalizeNameKey(account.studentName) === normalizeNameKey(rosterStudent.fullName)
  );
  const check4Passed = accountMatchesStudent;
  const check5Passed = !lockReason || securityLockVerifiedByGvcn;

  const checks: ActivationCheckStep[] = [
    {
      step: 1,
      label: 'Xác nhận học sinh có trong danh sách lớp chính thức',
      passed: check1Passed,
      detail: check1Passed
        ? `${rosterStudent!.fullName} (STT #${rosterStudent!.rosterOrder ?? '—'}) thuộc danh sách ${allStudents.length} HS.`
        : 'Không tìm thấy học sinh trong danh sách lớp chính thức.',
    },
    {
      step: 2,
      label: 'Xác nhận Mã MOET và StudentId khớp',
      passed: check2Passed,
      detail: check2Passed
        ? `StudentId: ${rosterStudent!.id} • Mã MOET: ${studentMoet || rosterStudent!.code}`
        : 'Thiếu hoặc lệch StudentId / Mã MOET giữa phân công và hồ sơ lớp.',
    },
    {
      step: 3,
      label: 'Xác nhận học sinh giữ đúng chức vụ đã GVCN phê duyệt',
      passed: check3Passed,
      detail: check3Passed
        ? `Đã được GVCN xác nhận chính thức vị trí ${ROLE_ID_TO_LABEL[roleId]}.`
        : `Chưa hoàn tất xác nhận phân công duy nhất cho vị trí ${ROLE_ID_TO_LABEL[roleId]} (cần lưu đối chiếu trước).`,
    },
    {
      step: 4,
      label: 'Kiểm tra tài khoản Firebase UID liên kết đúng học sinh',
      passed: check4Passed,
      detail: check4Passed
        ? `Nickname ${account!.nickname} • UID ${account!.officerUid.slice(0, 10)}… khớp đúng học sinh.`
        : account
          ? `Tài khoản "${account.nickname}" không khớp đúng học sinh hoặc thiếu Firebase UID — không kích hoạt.`
          : 'Học sinh chưa được cấp tài khoản Firebase Auth thật.',
    },
    {
      step: 5,
      label: 'Kiểm tra tài khoản không bị khóa bảo mật chưa xử lý',
      passed: check5Passed,
      detail: !lockReason
        ? 'Không có cảnh báo khóa bảo mật tồn đọng.'
        : securityLockVerifiedByGvcn
          ? `GVCN đã xác minh lý do khóa bảo mật ("${lockReason}").`
          : `Tài khoản đang bị khóa bảo mật ("${lockReason}") — yêu cầu GVCN xác minh trước khi kích hoạt.`,
    },
  ];

  const firstFailed = checks.find((c) => !c.passed);
  return {
    eligible: !firstFailed,
    checks,
    blockingReason: firstFailed ? `Bước ${firstFailed.step}: ${firstFailed.detail}` : '',
  };
}

export function buildOfficerGovernanceBackupPayload(params: {
  classConfig: ClassConfig;
  workspaceId: string;
  teacherEmail: string;
  students: StudentRecord[];
  roleAssignments: RoleAssignmentRecord[];
  officerAccounts: OfficerAccountRecord[];
}) {
  return {
    backupType: 'GVCN360_OFFICER_GOVERNANCE_SNAPSHOT',
    createdAtIso: new Date().toISOString(),
    teacherEmail: params.teacherEmail,
    workspaceId: params.workspaceId,
    classInfo: {
      schoolName: params.classConfig.schoolName,
      className: params.classConfig.className,
      schoolYear: params.classConfig.schoolYear,
      teacherName: params.classConfig.teacherName,
      totalStudents: params.students.length,
    },
    studentsRolesSnapshot: [...params.students]
      .sort(compareStudentsByRosterOrder)
      .map((s) => ({
        studentId: s.id,
        code: s.code,
        moetCode: getStudentMoetCode(s),
        rosterOrder: s.rosterOrder ?? null,
        fullName: s.fullName,
        team: s.team,
        role: s.role,
        secondRole: s.secondRole || '',
        roles: getStudentRoles(s),
      })),
    roleAssignmentsSnapshot: params.roleAssignments,
    officerAccountsSnapshot: params.officerAccounts.map((a) => ({
      id: a.id,
      studentCode: a.studentCode,
      studentId: a.studentId || '',
      moetCode: a.moetCode || '',
      studentName: a.studentName,
      team: a.team,
      nickname: a.nickname,
      nicknameId: a.nicknameId,
      officerUid: a.officerUid,
      roles: a.roles,
      assignedTeam: a.assignedTeam,
      active: a.active,
      permissionStatus: a.permissionStatus || null,
      securityLockReason: a.securityLockReason || '',
      credentialVersion: a.credentialVersion,
    })),
  };
}
