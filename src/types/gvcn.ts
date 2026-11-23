export type TicketType = 'diem_danh' | 'ne_nep' | 'thu_chi' | 'chi_doan' | 'hoc_tap';
export type TicketStatus = 'pending' | 'needs_revision' | 'approved' | 'rejected';
export type EmulationRank = 'A' | 'B' | 'C';
export type QuickCheckLevel = 'mastered' | 'consolidating' | 'need_support';

export interface RoleDefinition {
  id: string;
  title: string;
  badgeColor: string;
  scope: string;
  team?: number;
  canApprove: boolean;
  allowedTicketTypes: TicketType[];
}

export interface ClassConfig {
  teacherName: string;
  subject: string;
  schoolName: string;
  className: string;
  schoolYear: string;
  fundBalance: number;
  updatedAt?: unknown;
}

export type TeacherAccessStatus = 'pending' | 'approved' | 'rejected' | 'revoked';

export interface TeacherAccessRequest {
  uid: string;
  email: string;
  displayName: string;
  requestedSchool?: string;
  requestedClass?: string;
  requestedSubject?: string;
  requestedYear?: string;
  note?: string;
  status: TeacherAccessStatus;
  approvedBy?: string;
  reviewNote?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type OfficerRoleId =
  | 'lop_truong'
  | 'to_truong_1'
  | 'to_truong_2'
  | 'to_truong_3'
  | 'to_truong_4'
  | 'thu_quy'
  | 'bi_thu';

export interface OfficerDirectoryRecord {
  nickname: string;
  nicknameId: string;
  authEmail: string;
  teacherUid: string;
  workspaceId: string;
  active: boolean;
  credentialVersion: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type OfficerAccountPermissionStatus =
  | 'pending_activation'
  | 'active'
  | 'locked'
  | 'revoked';

export type RoleAssignmentStatus =
  | 'assigned_no_account'
  | 'has_account_pending_activation'
  | 'active'
  | 'locked'
  | 'revoked';

export interface OfficerMembershipRecord {
  officerUid: string;
  teacherUid: string;
  workspaceId: string;
  schoolName: string;
  className: string;
  schoolYear: string;
  teacherName: string;
  studentCode: string;
  studentId?: string;
  moetCode?: string;
  studentName: string;
  nickname: string;
  nicknameId: string;
  roles: OfficerRoleId[];
  assignedTeam: number;
  active: boolean;
  permissionStatus?: OfficerAccountPermissionStatus;
  securityLockReason?: string;
  mustChangePassword: boolean;
  allowDirectClassAttendance?: boolean;
  lastLoginAtMs?: number;
  credentialVersion: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface OfficerAccountRecord {
  id: string;
  ownerUid: string;
  studentCode: string;
  studentId?: string;
  moetCode?: string;
  studentName: string;
  team: number;
  nickname: string;
  nicknameId: string;
  officerUid: string;
  authEmail: string;
  roles: OfficerRoleId[];
  assignedTeam: number;
  active: boolean;
  permissionStatus?: OfficerAccountPermissionStatus;
  securityLockReason?: string;
  mustChangePassword: boolean;
  allowDirectClassAttendance?: boolean;
  credentialVersion: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RoleAssignmentRecord {
  id: OfficerRoleId;
  ownerUid: string;
  roleId: OfficerRoleId;
  studentId: string;
  studentCode: string;
  moetCode?: string;
  studentName: string;
  team: number;
  officerUid?: string;
  nickname?: string;
  status: RoleAssignmentStatus;
  teamMismatchAcknowledged?: boolean;
  confirmedByEmail: string;
  confirmedAtMs: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RoleAssignmentHistoryRecord {
  id: string;
  ownerUid: string;
  roleId: OfficerRoleId;
  previousStudentId: string;
  previousStudentName: string;
  newStudentId: string;
  newStudentName: string;
  reason: string;
  changedByEmail: string;
  changedAtMs: number;
  createdAt?: unknown;
}

export interface PermissionAuditLogRecord {
  id: string;
  ownerUid: string;
  action: string;
  nickname: string;
  studentCode: string;
  studentName: string;
  details: string;
  actorEmail: string;
  timestampMs: number;
  createdAt?: unknown;
}

export interface SavedWorkspace {
  id: string;
  teacherName: string;
  subject: string;
  schoolName: string;
  className: string;
  schoolYear: string;
  updatedAtMs: number;
}

export interface StudentRecord {
  id: string;
  code: string;
  moetCode?: string;
  fullName: string;
  gender: 'Nam' | 'Nữ';
  dob?: string;
  team: number;
  rosterOrder?: number;
  role: string;
  secondRole?: string;
  roles?: OfficerRoleId[];
  parentPhone?: string;
  note?: string;
  meritPoints: number;
  attendancePresent?: number;
  attendanceAbsent?: number;
}

export interface StudentPiiRecord {
  studentCode: string;
  parentName?: string;
  parentPhone: string;
}

export interface TicketRecord {
  id: string;
  type: TicketType;
  typeLabel: string;
  studentId?: string | null;
  studentName: string;
  category: string;
  emulationGroup?: string;
  criterionId?: string;
  criterionText?: string;
  suggestedGrade?: string;
  evidence?: string;
  weekLabel?: string;
  amount?: number;
  date: string;
  description: string;
  submittedByRole: string;
  submittedByTitle: string;
  submittedByUid: string;
  status: TicketStatus;
  version?: number;
  approvalId?: string | null;
  batchApprovalId?: string | null;
  reviewedByTeacher?: string;
  reviewedByUid?: string;
  reviewedAtMs?: number;
  createdAtMs: number;
}

export interface AuditLogRecord {
  id: string;
  action: string;
  approvalId?: string | null;
  batchApprovalId?: string | null;
  ticketId: string;
  ticketType: string;
  summary: string;
  submittedBy: string;
  approvedBy: string;
  timestampMs: number;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  session: 'Sáng' | 'Chiều';
  totalStudents: number;
  presentCount: number;
  excusedCount: number;
  unexcusedCount: number;
  lateCount: number;
  absentSummary: string;
  recordedBy: string;
}

export interface ClassPlanRecord {
  id: string;
  week: string;
  title: string;
  targetDate: string;
  content?: string;
  status: 'Đang thực hiện' | 'Hoàn thành';
  createdAtMs: number;
}

export interface YouthActivityRecord {
  id: string;
  title: string;
  date: string;
  participantCount: number;
  description?: string;
  status: string;
  createdAtMs: number;
}

export interface SubjectScoreRecord {
  id: string;
  code: string;
  fullName: string;
  team: number;
  subject: string;
  tx1: number | null;
  tx2: number | null;
  gk: number | null;
  ck: number | null;
  avg: number | null;
  note?: string;
  updatedBy: string;
}

export interface VneduImportLog {
  id: string;
  subject: string;
  studentCount: number;
  importedBy: string;
  importedAtMs: number;
}

export interface Grade12Profile {
  id: string;
  studentCode: string;
  studentName: string;
  examBlock: string;
  targetUniversity?: string;
  targetMajor?: string;
  mockScore1?: string;
  mockScore2?: string;
  readiness: string;
  teacherNote?: string;
}

export interface EmulationCriterionA {
  id: string;
  title: string;
  requiresEvidence: boolean;
}

export interface EmulationCriterionItem {
  id: string;
  text: string;
  conditional?: boolean;
  repeatRequired?: boolean;
  conditionNote?: string;
}

export interface EmulationStandards {
  gradeA: EmulationCriterionA[];
  gradeB: EmulationCriterionItem[];
  gradeC: EmulationCriterionItem[];
  severeSemesterFail: EmulationCriterionItem[];
  semesterRules: {
    cToBWeight: number;
    totMaxB: number;
    khaMinB: number;
    khaMaxB: number;
    datMinB: number;
    datMaxB: number;
    minWeeksRequired: number;
  };
}

export interface WeeklyTeamStat {
  team: number;
  lockedSize: number;
  countA: number;
  countB: number;
  countC: number;
  unfinalizedCount: number;
  rateA: number;
}

export interface WeeklySnapshot {
  id: string;
  weekNumber: number;
  weekLabel: string;
  monthLabel: string;
  semesterLabel: string;
  totalLockedStudents: number;
  records: Record<
    string,
    {
      studentCode: string;
      studentName: string;
      team: number;
      rank: EmulationRank;
      note?: string;
    }
  >;
  teamStats: WeeklyTeamStat[];
  lockedBy: string;
  lockedAtMs: number;
}

export interface WeeklyEmulationDraftEntry {
  rank?: EmulationRank;
  note?: string;
  spoken?: boolean;
  updatedByRole?: string;
  updatedByTitle?: string;
  updatedAtMs?: number;
}

export interface WeeklyEmulationDraftDoc {
  id: string;
  weekNumber: number;
  weekLabel: string;
  drafts: Record<string, WeeklyEmulationDraftEntry>;
}

export interface EmulationAdjustmentLog {
  id: string;
  weekLabel: string;
  studentCode: string;
  studentName: string;
  team: number;
  oldRank: EmulationRank;
  newRank: EmulationRank;
  reason: string;
  adjustedBy: string;
  timestampMs: number;
}

export interface KnowledgeTopic {
  id: string;
  subjectKey?: string;
  semester: string;
  topicName: string;
  skillName: string;
  requirement?: string;
  createdBy?: string;
  createdAtMs?: number;
}

export interface QuickCheckRecord {
  id: string;
  subjectKey?: string;
  date: string;
  topicId: string;
  topicName?: string;
  skillName?: string;
  semester?: string;
  studentCode: string;
  studentName: string;
  team: number;
  evidenceType: string;
  level: QuickCheckLevel;
  note?: string;
  confirmedBy: string;
  timestampMs: number;
}

export interface ErrorLogRecord {
  id: string;
  subjectKey?: string;
  date: string;
  topicId: string;
  topicName?: string;
  skillName?: string;
  semester?: string;
  studentCode: string;
  studentName: string;
  team: number;
  errorCategory: string;
  note?: string;
  remedy?: string;
  status: 'unfixed' | 'fixed';
  fixedAt?: string | null;
  recordedBy: string;
  timestampMs: number;
}

export type PedagogicalSemester = 'Học kỳ I' | 'Học kỳ II' | 'Cả năm';
export type OfficialTt22Level = '' | 'Tốt' | 'Khá' | 'Đạt' | 'Chưa đạt';
export type ReportCardLengthMode = 'short' | 'standard' | 'detailed';
export type PedagogicalIncidentStatus = 'none' | 'verified' | 'pending_verification';
export type ParentMessageTone = 'trang_trong' | 'gan_gui' | 'nhe_nhang' | 'phoi_hop';
export type ParentMessagePurposeId =
  | 'khen_ngoi_dong_vien'
  | 'thong_bao_tien_bo'
  | 'nhac_nho_chuyen_can'
  | 'nhac_nho_ne_nep'
  | 'trao_doi_hoc_tap_giam'
  | 'phoi_hop_su_viec_da_xac_minh'
  | 'xac_minh_thong_tin_chua_xac_nhan'
  | 'thong_bao_ke_hoach_hop_ph'
  | 'dinh_huong_thi_tot_nghiep_12'
  | 'dong_vien_tam_ly_hoan_canh';

export interface PedagogicalVersionEntry {
  versionId: string;
  text: string;
  source: 'ai' | 'teacher' | 'restore';
  actionLabel: string;
  actorEmail: string;
  savedAtMs: number;
}

export interface PedagogicalObservationRecord {
  id: string;
  studentId: string;
  studentCode: string;
  moetCode?: string;
  semester: PedagogicalSemester;
  officialConduct: OfficialTt22Level;
  officialAcademic: OfficialTt22Level;
  verifiedStrengths?: string;
  verifiedImprovements?: string;
  verifiedAchievements?: string;
  verifiedIncidentNote?: string;
  incidentStatus: PedagogicalIncidentStatus;
  sourceLabel: string;
  confirmedByEmail: string;
  confirmedAtMs: number;
}

export interface ReportCardCommentRecord {
  id: string;
  studentId: string;
  studentCode: string;
  moetCode?: string;
  studentName: string;
  rosterOrder?: number;
  semester: PedagogicalSemester;
  schoolYear: string;
  lengthMode: ReportCardLengthMode;
  schoolTemplate?: string;
  maxChars?: number;
  currentDraft: string;
  teacherEdited: boolean;
  status: 'draft' | 'approved_locked';
  approvedByEmail?: string;
  approvedAtMs?: number;
  versions: PedagogicalVersionEntry[];
}

export interface ParentMessageRecord {
  id: string;
  studentId: string;
  studentCode: string;
  moetCode?: string;
  studentName: string;
  recipientName?: string;
  semester: PedagogicalSemester;
  purpose: ParentMessagePurposeId;
  salutation: string;
  tone: ParentMessageTone;
  incidentStatus: PedagogicalIncidentStatus;
  currentDraft: string;
  teacherEdited: boolean;
  status: 'draft' | 'approved_ready';
  approvedByEmail?: string;
  approvedAtMs?: number;
  versions: PedagogicalVersionEntry[];
}

