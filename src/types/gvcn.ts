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
  role: string;
  secondRole?: string;
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
