import React, { useState, useEffect, useMemo, useRef } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  runTransaction,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  FilePlus2,
  CheckCircle2,
  Settings,
  Sparkles,
  AlertCircle,
  LogOut,
  Menu,
  X,
  Award,
  BookOpen,
  DollarSign,
  Calendar,
  History,
  FileSpreadsheet,
  ClipboardCheck,
  GraduationCap,
  MessageSquareHeart,
  FileBarChart2,
  Bot,
  Trophy,
  Scale,
  ListChecks,
  Aperture,
  KeyRound,
  FileText,
  Send,
  UserCircle,
} from 'lucide-react';
import {
  auth,
  db,
  testConnection,
  handleFirestoreError,
  OperationType,
  signOutUser,
  PRIMARY_ADMIN_EMAIL,
  getAuthBearerHeaders,
  getTeamFromOfficerRoles,
  isOfficerAuthEmail,
  nicknameToDocId,
  normalizeOfficerNickname,
  provisionOfficerAuthCredential,
  verifyOfficerActivationOnBackend,
} from './firebase';
import {
  DEFAULT_EMULATION_STANDARDS,
  INITIAL_SAMPLE_STUDENTS,
  ROLES,
  TICKET_TYPES,
  normalizeSlug,
} from './constants/gvcnConstants';
import type {
  AttendanceRecord,
  AuditLogRecord,
  ClassConfig,
  ClassPlanRecord,
  EmulationAdjustmentLog,
  EmulationRank,
  EmulationStandards,
  ErrorLogRecord,
  Grade12Profile,
  KnowledgeTopic,
  OfficerAccountRecord,
  OfficerMembershipRecord,
  OfficerRoleId,
  ParentMessageRecord,
  PedagogicalObservationRecord,
  PermissionAuditLogRecord,
  QuickCheckLevel,
  QuickCheckRecord,
  ReportCardCommentRecord,
  RoleAssignmentHistoryRecord,
  RoleAssignmentRecord,
  SavedWorkspace,
  StudentPiiRecord,
  StudentRecord,
  SubjectScoreRecord,
  TeacherAccessRequest,
  TeacherAccessStatus,
  TicketRecord,
  TicketType,
  VneduImportLog,
  WeeklyEmulationDraftEntry,
  WeeklySnapshot,
  YouthActivityRecord,
} from './types/gvcn';
import {
  AuthGate,
  PendingTeacherGate,
  NewTeacherSetupGate,
  OfficerChangePasswordModal,
} from './components/AuthGate';
import {
  AdjustRankModal,
  BatchConfirmModal,
  BulkStudentModal,
  ConfirmDeleteAllStudentsModal,
  Grade12Modal,
  StudentModal,
} from './components/Modals';
import { RosterOrderUpdateModal } from './components/RosterOrderUpdateModal';
import {
  OfficerReconciliationModal,
  type BatchActivationPositionResult,
} from './components/OfficerReconciliationModal';
import {
  AttendanceTab,
  DashboardTab,
  RolesTab,
  StudentsTab,
} from './components/tabs/DashboardAndRosterTabs';
import {
  DisciplineTab,
  EmulationHistoryTab,
  EmulationStandardsTab,
  SemesterEmulationTab,
  TeamEmulationTab,
  TicketsTab,
} from './components/tabs/EmulationTabs';
import { ModerationTab } from './components/tabs/ModerationTab';
import {
  AiAnalysisTab,
  ConfigTab,
  FundTab,
  Grade12Tab,
  ParentCommTab,
  PlansAndYouthTab,
  ReportsTab,
  VneduImportTab,
} from './components/tabs/OperationsAndReportsTabs';
import { MySubjectTab, type SubjectSubTab } from './components/tabs/MySubjectTab';
import { PedagogicalAssistantTab } from './components/tabs/PedagogicalAssistantTab';
import { LuckyWheelTab } from './components/tabs/LuckyWheelTab';
import {
  MonitorOverviewTab,
  MonitorAttendanceTab,
  MonitorClassReportTab,
  MonitorSentTicketsTab,
  MonitorAccountTab,
} from './components/tabs/MonitorWorkspaceTabs';
import {
  GeminiKeySetupPanel,
  INITIAL_GEMINI_KEY_STATUS,
  type TeacherGeminiKeyStatus,
} from './components/GeminiKeySetupPanel';
import {
  ROLE_ID_TO_LABEL,
  VALID_CLASS_OFFICER_ROLES,
  areRoleListsEqual,
  buildParsedStudentRows,
  compareStudentsByRosterOrder,
  detectColumnMappingWarnings,
  detectStudentHeaderAndMapping,
  extractSheetMatrix,
  formatDobToDmy,
  formatStudentRolesLabel,
  getStudentMoetCode,
  getStudentRoles,
  isMissingPlaceholderValue,
  isValidOfficerRoleId,
  normalizeNameKey,
  parseDelimitedTextToMatrix,
  parseExcelStudentRoles,
  parsePositiveIntStt,
  readStudentWorkbook,
  reconcileStudentImportRows,
  studentRolesToLegacyFields,
  type LegacyResolutionAction,
  type ParsedStudentRow,
  type RosterOrderReconciliationAnalysis,
  type StudentColumnMapping,
  type StudentExcelColumnKey,
} from './utils/studentExcelImport';
import {
  analyzeOfficerPositionsAndAccounts,
  evaluateEightPointActivationCheck,
  validateOfficerReconciliationDraft,
  type OfficerLiveMembershipStatus,
} from './utils/officerReconciliation';
import {
  autoDetectVneduHeaderAndMapping,
  buildAutoReconcileBatch,
  buildParsedVneduRows,
  buildVneduColumnDescriptors,
  extractVneduSheetMatrix,
  getVneduScoreDocId,
  getVneduSubjectLabel,
  parseVneduDelimitedText,
  readVneduWorkbook,
  reconcileVneduRows,
  sliceStudentTableRows,
  type VneduAssessmentMode,
  type VneduColumnDescriptor,
  type VneduColumnRole,
  type VneduMergeSpan,
  type VneduRowResolution,
  type VneduSemester,
  type VneduVerifiedLink,
  type VneduVerifiedLinkStore,
} from './utils/vneduScoreImport';

const EMPTY_CLASS_CONFIG: ClassConfig = {
  teacherName: '',
  subject: '',
  schoolName: '',
  className: '',
  schoolYear: '2026–2027',
  fundBalance: 0,
  updatedAt: null,
};

export default function App() {
  // 1. Trạng thái xác thực Firebase & Kiểm soát quyền Giáo viên
  const [user, setUser] = useState<User | null>(null);
  const [userRootReady, setUserRootReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [teacherAccessState, setTeacherAccessState] = useState<
    'checking' | 'approved' | 'unregistered' | 'pending' | 'rejected' | 'revoked'
  >('checking');
  const [teacherAccessRequest, setTeacherAccessRequest] = useState<TeacherAccessRequest | null>(null);
  const [isSubmittingAccessRequest, setIsSubmittingAccessRequest] = useState(false);
  const [classConfigLoaded, setClassConfigLoaded] = useState(false);
  const [needsFirstWorkspaceSetup, setNeedsFirstWorkspaceSetup] = useState(false);
  const [isCreatingFirstWorkspace, setIsCreatingFirstWorkspace] = useState(false);
  const [adminTeacherRequests, setAdminTeacherRequests] = useState<TeacherAccessRequest[]>([]);
  const [processingTeacherUid, setProcessingTeacherUid] = useState<string | null>(null);
  const [sessionKind, setSessionKind] = useState<'none' | 'teacher' | 'officer'>('none');
  const [officerMembership, setOfficerMembership] = useState<OfficerMembershipRecord | null>(null);
  const [officerMembershipLoading, setOfficerMembershipLoading] = useState(false);
  const [showOfficerChangePasswordModal, setShowOfficerChangePasswordModal] = useState(false);
  const [officerAccounts, setOfficerAccounts] = useState<OfficerAccountRecord[]>([]);
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignmentRecord[]>([]);
  const [roleAssignmentHistory, setRoleAssignmentHistory] = useState<RoleAssignmentHistoryRecord[]>([]);
  const [showOfficerReconciliationModal, setShowOfficerReconciliationModal] = useState(false);
  const [officerLoginStatusMap, setOfficerLoginStatusMap] = useState<
    Record<string, OfficerLiveMembershipStatus>
  >({});
  const [permissionAuditLogs, setPermissionAuditLogs] = useState<PermissionAuditLogRecord[]>([]);
  const [geminiKeyStatus, setGeminiKeyStatus] = useState<TeacherGeminiKeyStatus>(INITIAL_GEMINI_KEY_STATUS);
  const [showGeminiKeyModal, setShowGeminiKeyModal] = useState(false);
  const [geminiStep2DismissedUid, setGeminiStep2DismissedUid] = useState<string | null>(null);
  const previousAuthUidRef = useRef<string | null>(null);
  const recordedOfficerLoginUidRef = useRef<string | null>(null);

  const isPrimaryAdmin = useMemo(
    () =>
      Boolean(
        sessionKind === 'teacher' &&
          user?.email &&
          user.email.toLowerCase() === PRIMARY_ADMIN_EMAIL &&
          user.emailVerified
      ),
    [sessionKind, user?.email, user?.emailVerified]
  );

  const isRealOfficer = sessionKind === 'officer' && Boolean(officerMembership?.active);
  const isRealMonitor = isRealOfficer && Boolean(officerMembership?.roles?.includes('lop_truong'));

  const officerAllowedTabs = useMemo(() => {
    if (sessionKind !== 'officer' || !officerMembership?.active) return null;
    const roles = officerMembership.roles || [];
    const hasMonitor = roles.includes('lop_truong');
    const hasTeamLeader = roles.some((r) => r.startsWith('to_truong_'));
    const hasTreasurer = roles.includes('thu_quy');
    const hasSecretary = roles.includes('bi_thu');

    const allowed = new Set<string>();
    if (hasMonitor) {
      // Không gian làm việc riêng của Lớp trưởng: đúng 5 menu được phép
      allowed.add('monitor_overview');
      allowed.add('monitor_attendance');
      allowed.add('monitor_report');
      allowed.add('monitor_tickets');
      allowed.add('monitor_account');
    } else {
      allowed.add('tickets');
    }

    if (hasTeamLeader) {
      allowed.add('students');
      allowed.add('attendance');
      allowed.add('emulation_standards');
      allowed.add('tickets');
    }
    if (hasTreasurer) {
      allowed.add('fund');
      allowed.add('tickets');
    }
    if (hasSecretary) {
      allowed.add('plans');
      allowed.add('tickets');
    }
    return allowed;
  }, [sessionKind, officerMembership]);

  // 2. Điều hướng & thông báo
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [activeRoleId, setActiveRoleId] = useState('gvcn');

  // 3. Cấu hình lớp học & danh sách workspace đã lưu (khởi tạo trung tính, không gán cứng 12D6)
  const [classConfig, setClassConfig] = useState<ClassConfig>(EMPTY_CLASS_CONFIG);
  const [savedWorkspaces, setSavedWorkspaces] = useState<SavedWorkspace[]>([]);
  const [configForm, setConfigForm] = useState<ClassConfig>(EMPTY_CLASS_CONFIG);

  // 4. Dữ liệu thời gian thực từ Cloud Firestore
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [studentPiiMap, setStudentPiiMap] = useState<Record<string, StudentPiiRecord>>({});
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [plans, setPlans] = useState<ClassPlanRecord[]>([]);
  const [youthActivities, setYouthActivities] = useState<YouthActivityRecord[]>([]);
  const [subjectScores, setSubjectScores] = useState<Record<string, SubjectScoreRecord>>({});
  const [vneduImportHistory, setVneduImportHistory] = useState<VneduImportLog[]>([]);
  const [grade12Profiles, setGrade12Profiles] = useState<Record<string, Grade12Profile>>({});
  const [pedagogicalObservationsMap, setPedagogicalObservationsMap] = useState<
    Record<string, PedagogicalObservationRecord>
  >({});
  const [reportCardCommentsMap, setReportCardCommentsMap] = useState<
    Record<string, ReportCardCommentRecord>
  >({});
  const [parentMessagesMap, setParentMessagesMap] = useState<Record<string, ParentMessageRecord>>({});

  // 5. Phân hệ Thi đua A/B/C
  const [emulationStandards, setEmulationStandards] = useState<EmulationStandards>(DEFAULT_EMULATION_STANDARDS);
  const [selectedEmulationWeek, setSelectedEmulationWeek] = useState('Tuần 1');
  const [selectedEmulationMonth, setSelectedEmulationMonth] = useState('Tháng 9');
  const [selectedEmulationSemester, setSelectedEmulationSemester] = useState('Học kỳ I');
  const [emulationDraftsByWeek, setEmulationDraftsByWeek] = useState<
    Record<string, Record<string, WeeklyEmulationDraftEntry>>
  >({});
  const [disciplineTeamFilter, setDisciplineTeamFilter] = useState('all');
  const [isSavingDrafts, setIsSavingDrafts] = useState(false);
  const [weeklySnapshots, setWeeklySnapshots] = useState<WeeklySnapshot[]>([]);
  const [emulationAdjustLogs, setEmulationAdjustLogs] = useState<EmulationAdjustmentLog[]>([]);
  const [isLockingWeek, setIsLockingWeek] = useState(false);
  const [adjustModalData, setAdjustModalData] = useState<{
    studentCode: string;
    studentName: string;
    team: number;
    oldRank: EmulationRank;
  } | null>(null);
  const [adjustNewRank, setAdjustNewRank] = useState<EmulationRank>('A');
  const [adjustReason, setAdjustReason] = useState('');
  const [newCriterionText, setNewCriterionText] = useState('');
  const [newCriterionGroup, setNewCriterionGroup] = useState<'gradeB' | 'gradeC' | 'severeSemesterFail'>('gradeB');
  const [teamBonusRule, setTeamBonusRule] = useState({
    enabled: false,
    ruleNote: 'GVCN chưa ban hành thang điểm quy đổi riêng cho tổ — chỉ thống kê tỷ lệ đạt A, B, C theo văn bản chuẩn.',
  });

  // 6. Hồ sơ học sinh & Modals
  const [searchStudent, setSearchStudent] = useState('');
  const [filterTeam, setFilterTeam] = useState('all');
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [studentForm, setStudentForm] = useState<{
    code: string;
    moetCode: string;
    fullName: string;
    gender: 'Nam' | 'Nữ';
    dob: string;
    team: number;
    role: string;
    secondRole?: string;
    parentName: string;
    parentPhone: string;
    note: string;
  }>({
    code: '',
    moetCode: '',
    fullName: '',
    gender: 'Nữ',
    dob: '',
    team: 1,
    role: 'member',
    secondRole: '',
    parentName: '',
    parentPhone: '',
    note: '',
  });
  const [showBulkStudentModal, setShowBulkStudentModal] = useState(false);
  const [showRosterOrderModal, setShowRosterOrderModal] = useState(false);
  const [isApplyingRosterOrder, setIsApplyingRosterOrder] = useState(false);
  const [bulkWorkbook, setBulkWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [bulkFileName, setBulkFileName] = useState('');
  const [bulkSheetNames, setBulkSheetNames] = useState<string[]>([]);
  const [bulkSelectedSheet, setBulkSelectedSheet] = useState('');
  const [bulkHeaders, setBulkHeaders] = useState<string[]>([]);
  const [bulkDataRows, setBulkDataRows] = useState<string[][]>([]);
  const [bulkHeaderRowIndex, setBulkHeaderRowIndex] = useState(-1);
  const [bulkColumnMapping, setBulkColumnMapping] = useState<StudentColumnMapping>({
    stt: -1,
    fullName: -1,
    gender: -1,
    dob: -1,
    parentName: -1,
    parentPhone: -1,
    moetCode: -1,
    team: -1,
    role: -1,
  });
  const [bulkStudentText, setBulkStudentText] = useState('');
  const [bulkParsedRows, setBulkParsedRows] = useState<ParsedStudentRow[]>([]);
  const [bulkResolutions, setBulkResolutions] = useState<Record<number, LegacyResolutionAction>>({});
  const [isSavingBulkStudents, setIsSavingBulkStudents] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isDeletingAllStudents, setIsDeletingAllStudents] = useState(false);
  const [autoRankAEnabled, setAutoRankAEnabled] = useState(true);

  // 7. Ghi nhận & Trung tâm kiểm duyệt
  const [ticketForm, setTicketForm] = useState<{
    type: TicketType;
    studentId: string;
    category: string;
    emulationGroup: string;
    criterionId: string;
    secondCriterionId: string;
    isSimultaneousB: boolean;
    remindedBefore: boolean;
    evidence: string;
    weekLabel: string;
    points: number;
    amount: number;
    date: string;
    description: string;
  }>({
    type: 'ne_nep',
    studentId: '',
    category: 'Tuyên dương',
    emulationGroup: 'gradeA',
    criterionId: 'A1',
    secondCriterionId: '',
    isSimultaneousB: false,
    remindedBefore: false,
    evidence: '',
    weekLabel: 'Tuần 1',
    points: 0,
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    description: '',
  });
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [processingTicketId, setProcessingTicketId] = useState<string | null>(null);
  const [modFilterType, setModFilterType] = useState('all');
  const [modFilterStatus, setModFilterStatus] = useState('pending');
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [batchConfirmModal, setBatchConfirmModal] = useState<{
    mode: 'selected' | 'all_eligible';
    eligibleTickets: TicketRecord[];
    excludedTickets: { ticket: TicketRecord; reason: string }[];
    snapshotVersions: Record<string, { status: string; version: number }>;
  } | null>(null);
  const [isBatchApproving, setIsBatchApproving] = useState(false);
  const [batchApprovalReport, setBatchApprovalReport] = useState<{
    batchId: string;
    successCount: number;
    totalScopeCount: number;
    needReviewCount: number;
    failedItems: { ticket: TicketRecord; reason: string }[];
    excludedTickets: { ticket: TicketRecord; reason: string }[];
    timestamp: string;
  } | null>(null);

  // 8. Điểm danh, Kế hoạch, Chi đoàn
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceSession, setAttendanceSession] = useState<'Sáng' | 'Chiều'>('Sáng');
  const [dailyAttendanceDraft, setDailyAttendanceDraft] = useState<
    Record<string, { status: 'present' | 'excused' | 'unexcused' | 'late'; note: string }>
  >({});
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);

  const [planForm, setPlanForm] = useState<{
    week: string;
    title: string;
    targetDate: string;
    content: string;
    status: 'Đang thực hiện' | 'Hoàn thành';
  }>({
    week: 'Tuần 12',
    title: '',
    targetDate: new Date().toISOString().split('T')[0],
    content: '',
    status: 'Đang thực hiện',
  });
  const [youthForm, setYouthForm] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    participantCount: 0,
    description: '',
    status: 'Sắp diễn ra',
  });

  // 9. Nhập điểm vnEdu
  const [selectedVneduSubject, setSelectedVneduSubject] = useState('Toán');
  const [selectedVneduSemester, setSelectedVneduSemester] = useState<VneduSemester>('Học kỳ I');
  const [vneduAssessmentMode, setVneduAssessmentMode] = useState<VneduAssessmentMode>('auto');
  const [preserveExistingWhenBlank, setPreserveExistingWhenBlank] = useState(true);
  const [vneduWorkbook, setVneduWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [vneduFileName, setVneduFileName] = useState('');
  const [vneduSheetNames, setVneduSheetNames] = useState<string[]>([]);
  const [vneduSelectedSheet, setVneduSelectedSheet] = useState('');
  const [vneduRawText, setVneduRawText] = useState('');
  const [vneduMatrix, setVneduMatrix] = useState<string[][]>([]);
  const [vneduMerges, setVneduMerges] = useState<VneduMergeSpan[]>([]);
  const [vneduHeaderRowIndex, setVneduHeaderRowIndex] = useState(-1);
  const [vneduMergeParentHeader, setVneduMergeParentHeader] = useState(true);
  const [vneduColumns, setVneduColumns] = useState<VneduColumnDescriptor[]>([]);
  const [vneduRoleMap, setVneduRoleMap] = useState<Record<number, VneduColumnRole>>({});
  const [vneduConfirmedIdLinks, setVneduConfirmedIdLinks] = useState<VneduVerifiedLinkStore>({});
  const [vneduCodeSystemVerifiedSameAsMoet, setVneduCodeSystemVerifiedSameAsMoet] = useState(false);
  const [vneduAutoConfirmExactNameAndDob, setVneduAutoConfirmExactNameAndDob] = useState(true);
  const [vneduRowResolutions, setVneduRowResolutions] = useState<Record<number, VneduRowResolution>>({});
  const [vneduDeselectedRows, setVneduDeselectedRows] = useState<Record<number, boolean>>({});
  const [isImportingVnedu, setIsImportingVnedu] = useState(false);
  const [isReadingExcel, setIsReadingExcel] = useState(false);
  const [isRefreshingVneduRoster, setIsRefreshingVneduRoster] = useState(false);
  const [vneduRosterRefreshedAtMs, setVneduRosterRefreshedAtMs] = useState<number | null>(null);
  const seededTopicsRef = useRef<Record<string, boolean>>({});

  // 10. Lớp 12, AI & Tin nhắn PH
  const [editingGrade12Student, setEditingGrade12Student] = useState<StudentRecord | null>(null);
  const [grade12Form, setGrade12Form] = useState({
    examBlock: 'A00 (Toán - Lý - Hóa)',
    targetUniversity: '',
    targetMajor: '',
    mockScore1: '',
    mockScore2: '',
    readiness: 'Đạt mục tiêu',
    teacherNote: '',
  });
  const [aiAnalysisResult, setAiAnalysisResult] = useState('');
  const [isGeneratingAiAnalysis, setIsGeneratingAiAnalysis] = useState(false);
  const [aiAnalysisScope, setAiAnalysisScope] = useState('all');
  const [selectedCommStudentId, setSelectedCommStudentId] = useState('');
  const [commPurpose, setCommPurpose] = useState('praise');
  const [commTone, setCommTone] = useState('warm');
  const [commExtraContext, setCommExtraContext] = useState('');
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [generatedReportCardDraft, setGeneratedReportCardDraft] = useState('');
  const [isGeneratingComm, setIsGeneratingComm] = useState(false);

  // 11. Trung tâm hỗ trợ học tập bộ môn
  const [subjectSubTab, setSubjectSubTab] = useState<SubjectSubTab>('overview');
  const [knowledgeTopics, setKnowledgeTopics] = useState<KnowledgeTopic[]>([]);
  const [quickChecks, setQuickChecks] = useState<QuickCheckRecord[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLogRecord[]>([]);
  const [kmFilterTeam, setKmFilterTeam] = useState('all');
  const [kmFilterStudent, setKmFilterStudent] = useState('all');
  const [kmFilterTopic, setKmFilterTopic] = useState('all');
  const [kmFilterSemester, setKmFilterSemester] = useState('all');
  const [kmFilterDateFrom, setKmFilterDateFrom] = useState('');
  const [kmFilterDateTo, setKmFilterDateTo] = useState('');
  const [newTopicForm, setNewTopicForm] = useState({
    semester: 'Học kỳ I',
    topicName: '',
    skillName: '',
    requirement: '',
  });
  const [qcDate, setQcDate] = useState(new Date().toISOString().split('T')[0]);
  const [qcTopicId, setQcTopicId] = useState('');
  const [qcEvidenceType, setQcEvidenceType] = useState('Bài tập ngắn');
  const [qcFilterTeam, setQcFilterTeam] = useState('all');
  const [qcSearch, setQcSearch] = useState('');
  const [qcSelectedIds, setQcSelectedIds] = useState<string[]>([]);
  const [qcDraftMap, setQcDraftMap] = useState<
    Record<string, { level?: QuickCheckLevel | 'unassessed'; note?: string }>
  >({});
  const [isSavingQuickCheck, setIsSavingQuickCheck] = useState(false);
  const [errDate, setErrDate] = useState(new Date().toISOString().split('T')[0]);
  const [errTopicId, setErrTopicId] = useState('');
  const [errCategory, setErrCategory] = useState('Chưa hiểu khái niệm');
  const [errCustomCategory, setErrCustomCategory] = useState('');
  const [errNote, setErrNote] = useState('');
  const [errRemedy, setErrRemedy] = useState('');
  const [errSelectedStudentCodes, setErrSelectedStudentCodes] = useState<string[]>([]);
  const [errFilterStudent, setErrFilterStudent] = useState('all');
  const [errFilterStatus, setErrFilterStatus] = useState('all');
  const [isSavingErrorLog, setIsSavingErrorLog] = useState(false);
  const [luckyWheelAllowedRoles, setLuckyWheelAllowedRoles] = useState<string[]>(['gvcn']);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Xóa sạch toàn bộ dữ liệu nhạy cảm khỏi bộ nhớ ứng dụng khi đăng xuất hoặc đổi tài khoản
  const resetSensitiveSessionState = () => {
    setClassConfig(EMPTY_CLASS_CONFIG);
    setConfigForm(EMPTY_CLASS_CONFIG);
    setClassConfigLoaded(false);
    setNeedsFirstWorkspaceSetup(false);
    setSavedWorkspaces([]);
    setStudents([]);
    setStudentPiiMap({});
    setTickets([]);
    setAuditLogs([]);
    setAttendanceRecords([]);
    setPlans([]);
    setYouthActivities([]);
    setSubjectScores({});
    setVneduImportHistory([]);
    setGrade12Profiles({});
    setWeeklySnapshots([]);
    setEmulationDraftsByWeek({});
    setEmulationAdjustLogs([]);
    setKnowledgeTopics([]);
    setQuickChecks([]);
    setErrorLogs([]);
    setLuckyWheelAllowedRoles(['gvcn']);
    setVneduWorkbook(null);
    setVneduFileName('');
    setVneduSheetNames([]);
    setVneduSelectedSheet('');
    setVneduRawText('');
    setVneduMatrix([]);
    setVneduMerges([]);
    setVneduHeaderRowIndex(-1);
    setVneduColumns([]);
    setVneduRoleMap({});
    setVneduRowResolutions({});
    setVneduConfirmedIdLinks({});
    setAiAnalysisResult('');
    setGeneratedMessage('');
    setGeneratedReportCardDraft('');
    setPedagogicalObservationsMap({});
    setReportCardCommentsMap({});
    setParentMessagesMap({});
    setActiveRoleId('gvcn');
    setActiveTab('dashboard');
    setAdminTeacherRequests([]);
    setOfficerMembership(null);
    setOfficerMembershipLoading(false);
    setShowOfficerChangePasswordModal(false);
    setOfficerAccounts([]);
    setRoleAssignments([]);
    setRoleAssignmentHistory([]);
    setShowOfficerReconciliationModal(false);
    setOfficerLoginStatusMap({});
    setPermissionAuditLogs([]);
    setGeminiKeyStatus(INITIAL_GEMINI_KEY_STATUS);
    setShowGeminiKeyModal(false);
    setGeminiStep2DismissedUid(null);
    setShowBulkStudentModal(false);
    setBulkWorkbook(null);
    setBulkFileName('');
    setBulkSheetNames([]);
    setBulkSelectedSheet('');
    setBulkHeaders([]);
    setBulkDataRows([]);
    setBulkStudentText('');
    setVneduDeselectedRows({});
    setEditingStudent(null);
    setToast(null);
    recordedOfficerLoginUidRef.current = null;
    seededTopicsRef.current = {};
  };

  // Đăng xuất an toàn: xóa sạch 100% dữ liệu lớp học & phiên cũ khỏi bộ nhớ trình duyệt
  const handleSignOut = async () => {
    resetSensitiveSessionState();
    try {
      sessionStorage.clear();
    } catch {
      // Bỏ qua nếu môi trường iframe giới hạn sessionStorage
    }
    await signOutUser();
  };

  // Kiểm tra kết nối Firestore & lắng nghe đăng nhập Firebase Auth (Giáo viên Google & Cán bộ lớp)
  useEffect(() => {
    testConnection();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        previousAuthUidRef.current = null;
        resetSensitiveSessionState();
        setSessionKind('none');
        setUser(null);
        setUserRootReady(false);
        setTeacherAccessState('checking');
        setTeacherAccessRequest(null);
        setAuthLoading(false);
        return;
      }

      // Nếu đổi sang tài khoản khác trên cùng trình duyệt -> xóa sạch state phiên cũ ngay lập tức
      if (previousAuthUidRef.current && previousAuthUidRef.current !== currentUser.uid) {
        resetSensitiveSessionState();
      }
      previousAuthUidRef.current = currentUser.uid;

      // Nhánh 1: Tài khoản Cán bộ lớp thật (Firebase Auth Email/Password nội bộ)
      if (isOfficerAuthEmail(currentUser.email)) {
        setAuthError('');
        setUser(currentUser);
        setSessionKind('officer');
        setOfficerMembershipLoading(true);
        setUserRootReady(false);
        setTeacherAccessState('checking');
        setTeacherAccessRequest(null);
        setAuthLoading(false);
        return;
      }

      // Nhánh 2: Tài khoản Giáo viên (Google Authentication đã xác minh email)
      if (!currentUser.emailVerified) {
        resetSensitiveSessionState();
        setSessionKind('none');
        setAuthError('Tài khoản Google chưa xác minh email. Vui lòng sử dụng tài khoản đã xác minh.');
        setUser(null);
        setUserRootReady(false);
        setTeacherAccessState('checking');
        setTeacherAccessRequest(null);
        setAuthLoading(false);
        return;
      }

      setAuthError('');
      setUser(currentUser);
      setSessionKind('teacher');
      setOfficerMembership(null);
      setOfficerMembershipLoading(false);

      const isOwnerAdmin = (currentUser.email || '').toLowerCase() === PRIMARY_ADMIN_EMAIL;
      if (isOwnerAdmin) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            await setDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || 'Giáo viên chủ nhiệm',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          setTeacherAccessState('approved');
          setUserRootReady(true);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}`);
        } finally {
          setAuthLoading(false);
        }
      } else {
        // Tài khoản Gmail khác: kiểm tra trạng thái phê duyệt thực tế trên Firestore trước khi cấp quyền
        setTeacherAccessState('checking');
        setUserRootReady(false);
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Bước 2: Kiểm tra trạng thái Gemini API key cá nhân (CHỈ dành cho Giáo viên đã duyệt, TUYỆT ĐỐI không chạy cho Cán bộ lớp)
  useEffect(() => {
    if (!user || sessionKind !== 'teacher' || teacherAccessState !== 'approved' || !userRootReady) {
      setGeminiKeyStatus(INITIAL_GEMINI_KEY_STATUS);
      return;
    }

    let cancelled = false;
    setGeminiKeyStatus((prev) => ({ ...prev, loading: true }));

    (async () => {
      try {
        const headers = await getAuthBearerHeaders();
        const resp = await fetch('/api/teacher/gemini-key/status', {
          method: 'GET',
          headers,
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const data = (await resp.json()) as {
          connected?: boolean;
          status?: 'connected' | 'not_connected' | 'needs_reconnect';
          maskedHint?: string;
          lastVerifiedAtMs?: number | null;
          updatedAtMs?: number | null;
          usingDedicatedVaultSecret?: boolean;
          encryptionKeyVersion?: 'v1-env' | 'v1-fallback' | null;
          isProduction?: boolean;
          message?: string;
        };
        if (cancelled) return;
        setGeminiKeyStatus({
          loading: false,
          loaded: true,
          connected: Boolean(data.connected),
          status: data.status || (data.connected ? 'connected' : 'not_connected'),
          maskedHint: data.maskedHint || '',
          lastVerifiedAtMs: data.lastVerifiedAtMs ?? null,
          updatedAtMs: data.updatedAtMs ?? null,
          usingDedicatedVaultSecret: Boolean(data.usingDedicatedVaultSecret),
          encryptionKeyVersion: data.encryptionKeyVersion ?? null,
          isProduction: Boolean(data.isProduction),
          message: data.message,
        });
      } catch {
        if (cancelled) return;
        setGeminiKeyStatus({
          loading: false,
          loaded: true,
          connected: false,
          status: 'not_connected',
          maskedHint: '',
          lastVerifiedAtMs: null,
          updatedAtMs: null,
          usingDedicatedVaultSecret: false,
          message: 'Không thể tải trạng thái Gemini AI cá nhân. Bạn vẫn có thể quản lý lớp học bình thường.',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, sessionKind, teacherAccessState, userRootReady]);

  // Lắng nghe hồ sơ quyền thực tế của Cán bộ lớp từ officer_memberships/{uid}
  useEffect(() => {
    if (!user || sessionKind !== 'officer') return;

    const memRef = doc(db, 'officer_memberships', user.uid);
    const unsubMem = onSnapshot(
      memRef,
      (snap) => {
        if (!snap.exists()) {
          resetSensitiveSessionState();
          setSessionKind('none');
          setAuthError(
            'Tài khoản Cán bộ lớp này đã bị thu hồi hoặc mật khẩu vừa được GVCN cấp lại. Vui lòng đăng nhập lại bằng mật khẩu mới nhất.'
          );
          signOutUser().catch(() => {});
          return;
        }
        const data = snap.data() as OfficerMembershipRecord;
        if (!data.active || !Array.isArray(data.roles) || data.roles.length === 0) {
          resetSensitiveSessionState();
          setSessionKind('none');
          setAuthError(
            'Tài khoản Cán bộ lớp đang bị khóa hoặc phiên mật khẩu cũ đã hết hiệu lực. Vui lòng liên hệ GVCN.'
          );
          signOutUser().catch(() => {});
          return;
        }

        setOfficerMembership(data);
        setOfficerMembershipLoading(false);
        if (recordedOfficerLoginUidRef.current !== user.uid) {
          recordedOfficerLoginUidRef.current = user.uid;
          updateDoc(doc(db, 'officer_memberships', user.uid), {
            lastLoginAtMs: Date.now(),
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }
        setClassConfig({
          teacherName: data.teacherName || 'GVCN',
          subject: 'Cán bộ lớp',
          schoolName: data.schoolName || '',
          className: data.className || '',
          schoolYear: data.schoolYear || '',
          fundBalance: 0,
          updatedAt: null,
        });
        setClassConfigLoaded(true);
        setNeedsFirstWorkspaceSetup(false);

        setActiveRoleId((prev) => {
          if (data.roles.includes(prev as OfficerRoleId)) return prev;
          const primary = data.roles[0];
          const primaryRoleDef = ROLES.find((r) => r.id === primary);
          if (primaryRoleDef) {
            setDisciplineTeamFilter(primaryRoleDef.team ? String(primaryRoleDef.team) : 'all');
            const firstType = primaryRoleDef.allowedTicketTypes[0] || 'ne_nep';
            setTicketForm((tf) => ({
              ...tf,
              type: firstType,
              studentId: '',
              category:
                firstType === 'thu_chi'
                  ? 'Thu quỹ'
                  : firstType === 'chi_doan'
                    ? 'Báo cáo hoạt động Chi đoàn'
                    : firstType === 'diem_danh'
                      ? primaryRoleDef.team
                        ? 'Ghi nhận HS vắng / đi muộn'
                        : 'Điểm danh cả lớp'
                      : 'Tuyên dương',
            }));
          }
          return primary;
        });
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `officer_memberships/${user.uid}`);
        setOfficerMembershipLoading(false);
      }
    );

    return () => unsubMem();
  }, [user, sessionKind]);

  // GVCN tải trạng thái thực tế từ officer_memberships/{uid} (chỉ đọc, không tự sửa dữ liệu)
  useEffect(() => {
    if (!user || sessionKind !== 'teacher' || officerAccounts.length === 0) {
      setOfficerLoginStatusMap({});
      return;
    }
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        officerAccounts.map(async (acc) => {
          try {
            const snap = await getDoc(doc(db, 'officer_memberships', acc.officerUid));
            if (snap.exists()) {
              const d = snap.data() as OfficerMembershipRecord;
              return [
                acc.officerUid,
                {
                  exists: true,
                  active: Boolean(d.active),
                  studentCode: d.studentCode,
                  studentId: d.studentId,
                  moetCode: d.moetCode,
                  roles: Array.isArray(d.roles) ? d.roles : [],
                  assignedTeam: typeof d.assignedTeam === 'number' ? d.assignedTeam : 0,
                  permissionStatus: d.permissionStatus,
                  securityLockReason: d.securityLockReason || '',
                  lastLoginAtMs: typeof d.lastLoginAtMs === 'number' ? d.lastLoginAtMs : undefined,
                  mustChangePassword: Boolean(d.mustChangePassword),
                } satisfies OfficerLiveMembershipStatus,
              ] as const;
            }
            return [acc.officerUid, { exists: false } satisfies OfficerLiveMembershipStatus] as const;
          } catch {
            // Bỏ qua nếu membership không thể đọc
            return [acc.officerUid, { exists: false } satisfies OfficerLiveMembershipStatus] as const;
          }
        })
      );
      if (!cancelled) {
        setOfficerLoginStatusMap(Object.fromEntries(entries));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, sessionKind, officerAccounts]);

  const officerGovernance = useMemo(
    () =>
      analyzeOfficerPositionsAndAccounts({
        students,
        officerAccounts,
        roleAssignments,
        officerLoginStatusMap,
      }),
    [students, officerAccounts, roleAssignments, officerLoginStatusMap]
  );

  // Tự động đưa Cán bộ lớp về tab hợp lệ được cấp quyền
  useEffect(() => {
    if (!officerAllowedTabs) return;
    if (!officerAllowedTabs.has(activeTab)) {
      if (officerAllowedTabs.has('monitor_overview')) setActiveTab('monitor_overview');
      else if (officerAllowedTabs.has('attendance')) setActiveTab('attendance');
      else if (officerAllowedTabs.has('fund')) setActiveTab('fund');
      else if (officerAllowedTabs.has('plans')) setActiveTab('plans');
      else setActiveTab('tickets');
    }
  }, [officerAllowedTabs, activeTab]);

  // Đồng bộ dữ liệu ĐÚNG PHẠM VI PHÂN QUYỀN cho Cán bộ lớp (tuyệt đối không đọc PII/điểm số/hồ sơ nhạy cảm)
  useEffect(() => {
    if (!user || sessionKind !== 'officer' || !officerMembership?.active) return;

    const tUid = officerMembership.teacherUid;
    const wsId = officerMembership.workspaceId;
    const roles = officerMembership.roles || [];
    const assignedTeam = Number(officerMembership.assignedTeam || 0);
    const wsPath = `users/${tUid}/workspaces/${wsId}`;
    const unsubs: Array<() => void> = [];

    // 1. Học sinh cơ bản: Lớp trưởng xem toàn lớp; Tổ trưởng chỉ truy vấn đúng tổ được gán
    const studentsRef = collection(db, 'users', tUid, 'workspaces', wsId, 'students');
    if (roles.includes('lop_truong')) {
      unsubs.push(
        onSnapshot(
          studentsRef,
          (snapshot) => {
            const list = snapshot.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<StudentRecord, 'id'>),
            }));
            list.sort(compareStudentsByRosterOrder);
            setStudents(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, `${wsPath}/students`)
        )
      );
    } else if (assignedTeam >= 1 && assignedTeam <= 4) {
      unsubs.push(
        onSnapshot(
          query(studentsRef, where('team', '==', assignedTeam)),
          (snapshot) => {
            const list = snapshot.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<StudentRecord, 'id'>),
            }));
            list.sort(compareStudentsByRosterOrder);
            setStudents(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, `${wsPath}/students`)
        )
      );
    } else {
      setStudents([]);
    }

    // 2. Sổ điểm danh chính thức (chỉ Lớp trưởng được xem)
    if (roles.includes('lop_truong')) {
      const attRef = collection(db, 'users', tUid, 'workspaces', wsId, 'attendance');
      unsubs.push(
        onSnapshot(
          attRef,
          (snapshot) => {
            const list = snapshot.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<AttendanceRecord, 'id'>),
            }));
            list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
            setAttendanceRecords(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, `${wsPath}/attendance`)
        )
      );
    } else {
      setAttendanceRecords([]);
    }

    // 3. Kế hoạch & Hoạt động Chi đoàn (chỉ Bí thư được xem)
    if (roles.includes('bi_thu')) {
      const plansRef = collection(db, 'users', tUid, 'workspaces', wsId, 'plans');
      unsubs.push(
        onSnapshot(
          plansRef,
          (snapshot) => {
            const list = snapshot.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<ClassPlanRecord, 'id'>),
            }));
            list.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
            setPlans(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, `${wsPath}/plans`)
        )
      );

      const youthRef = collection(db, 'users', tUid, 'workspaces', wsId, 'youth');
      unsubs.push(
        onSnapshot(
          youthRef,
          (snapshot) => {
            const list = snapshot.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<YouthActivityRecord, 'id'>),
            }));
            list.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
            setYouthActivities(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, `${wsPath}/youth`)
        )
      );
    } else {
      setPlans([]);
      setYouthActivities([]);
    }

    // 4. Bộ tiêu chuẩn thi đua (chỉ Tổ trưởng cần tra cứu khi lập phiếu nề nếp)
    if (roles.some((r) => r.startsWith('to_truong_'))) {
      const stdRef = doc(db, 'users', tUid, 'workspaces', wsId, 'emulation_standards', 'rules');
      unsubs.push(
        onSnapshot(
          stdRef,
          (snap) => {
            if (snap.exists()) {
              setEmulationStandards({
                ...DEFAULT_EMULATION_STANDARDS,
                ...(snap.data() as Partial<EmulationStandards>),
              });
            }
          },
          (err) => handleFirestoreError(err, OperationType.GET, `${wsPath}/emulation_standards/rules`)
        )
      );
    }

    // 5. Phiếu đề xuất theo đúng phạm vi vai trò (hợp nhất khi kiêm nhiệm 2 vai trò)
    const ticketsRef = collection(db, 'users', tUid, 'workspaces', wsId, 'tickets');
    const ticketBuckets: Record<string, TicketRecord[]> = {};
    const syncMergedTickets = () => {
      const mergedMap = new Map<string, TicketRecord>();
      Object.values(ticketBuckets).forEach((arr) => {
        arr.forEach((t) => mergedMap.set(t.id, t));
      });
      const merged = Array.from(mergedMap.values());
      merged.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
      setTickets(merged);
    };

    const subscribeTicketQuery = (bucketKey: string, q: ReturnType<typeof query>) => {
      unsubs.push(
        onSnapshot(
          q,
          (snapshot) => {
            ticketBuckets[bucketKey] = snapshot.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<TicketRecord, 'id'>),
            }));
            syncMergedTickets();
          },
          (err) => handleFirestoreError(err, OperationType.LIST, `${wsPath}/tickets`)
        )
      );
    };

    subscribeTicketQuery('own', query(ticketsRef, where('submittedByUid', '==', user.uid)));
    if (roles.includes('lop_truong')) {
      subscribeTicketQuery('diem_danh', query(ticketsRef, where('type', '==', 'diem_danh')));
    }
    if (roles.includes('thu_quy')) {
      subscribeTicketQuery('thu_chi', query(ticketsRef, where('type', '==', 'thu_chi')));
    }
    if (roles.includes('bi_thu')) {
      subscribeTicketQuery('chi_doan', query(ticketsRef, where('type', '==', 'chi_doan')));
    }

    // Bảo đảm dữ liệu nhạy cảm luôn rỗng ở phiên Cán bộ lớp
    setStudentPiiMap({});
    setSubjectScores({});
    setGrade12Profiles({});
    setAuditLogs([]);

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [user, sessionKind, officerMembership]);

  // Lắng nghe trạng thái phê duyệt quyền Giáo viên cho các tài khoản Google khác chủ ứng dụng
  useEffect(() => {
    if (!user || sessionKind !== 'teacher' || isPrimaryAdmin) return;

    const reqRef = doc(db, 'teacher_access_requests', user.uid);
    const unsubAccess = onSnapshot(
      reqRef,
      async (snap) => {
        if (!snap.exists()) {
          resetSensitiveSessionState();
          setTeacherAccessRequest(null);
          setTeacherAccessState('unregistered');
          setUserRootReady(false);
          return;
        }

        const data = snap.data() as TeacherAccessRequest;
        setTeacherAccessRequest(data);

        if (data.status === 'approved') {
          try {
            const userRef = doc(db, 'users', user.uid);
            const rootSnap = await getDoc(userRef);
            if (!rootSnap.exists()) {
              await setDoc(userRef, {
                uid: user.uid,
                email: user.email || '',
                displayName: data.displayName || user.displayName || 'Giáo viên chủ nhiệm',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
            setTeacherAccessState('approved');
            setUserRootReady(true);
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
          }
        } else {
          resetSensitiveSessionState();
          setTeacherAccessState(data.status || 'pending');
          setUserRootReady(false);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `teacher_access_requests/${user.uid}`)
    );

    return () => unsubAccess();
  }, [user, sessionKind, isPrimaryAdmin]);

  // Chủ ứng dụng lắng nghe danh sách yêu cầu cấp quyền Giáo viên mới
  useEffect(() => {
    if (!user || sessionKind !== 'teacher' || !isPrimaryAdmin) {
      setAdminTeacherRequests([]);
      return;
    }

    const colRef = collection(db, 'teacher_access_requests');
    const unsubReqs = onSnapshot(
      colRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          ...(d.data() as TeacherAccessRequest),
          uid: d.data().uid || d.id,
        }));
        const rank: Record<TeacherAccessStatus, number> = {
          pending: 0,
          approved: 1,
          rejected: 2,
          revoked: 3,
        };
        list.sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9));
        setAdminTeacherRequests(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'teacher_access_requests')
    );

    return () => unsubReqs();
  }, [user, sessionKind, isPrimaryAdmin]);

  const handleSubmitTeacherAccessRequest = async (payload: {
    displayName: string;
    requestedSchool: string;
    requestedClass: string;
    requestedSubject: string;
    requestedYear: string;
    note: string;
  }) => {
    if (!user) return;
    setIsSubmittingAccessRequest(true);
    try {
      const reqRef = doc(db, 'teacher_access_requests', user.uid);
      await setDoc(reqRef, {
        uid: user.uid,
        email: user.email || '',
        displayName: payload.displayName.slice(0, 150),
        requestedSchool: payload.requestedSchool.slice(0, 200),
        requestedClass: payload.requestedClass.slice(0, 50),
        requestedSubject: payload.requestedSubject.slice(0, 100),
        requestedYear: payload.requestedYear.slice(0, 50),
        note: payload.note.slice(0, 500),
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `teacher_access_requests/${user.uid}`);
    } finally {
      setIsSubmittingAccessRequest(false);
    }
  };

  const handleRefreshTeacherAccessStatus = async () => {
    if (!user || isPrimaryAdmin) return;
    try {
      const reqRef = doc(db, 'teacher_access_requests', user.uid);
      const snap = await getDoc(reqRef);
      if (!snap.exists()) {
        setTeacherAccessRequest(null);
        setTeacherAccessState('unregistered');
        setUserRootReady(false);
        return;
      }
      const data = snap.data() as TeacherAccessRequest;
      setTeacherAccessRequest(data);
      if (data.status === 'approved') {
        setTeacherAccessState('approved');
        setUserRootReady(true);
      } else {
        setTeacherAccessState(data.status || 'pending');
        setUserRootReady(false);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `teacher_access_requests/${user.uid}`);
    }
  };

  const handleUpdateTeacherRequestStatus = async (
    req: TeacherAccessRequest,
    nextStatus: TeacherAccessStatus
  ) => {
    if (!user || !isPrimaryAdmin) return;
    setProcessingTeacherUid(req.uid);
    try {
      const reqRef = doc(db, 'teacher_access_requests', req.uid);
      await updateDoc(reqRef, {
        status: nextStatus,
        approvedBy: user.email || user.uid,
        reviewNote:
          nextStatus === 'approved'
            ? 'Đã được chủ ứng dụng phê duyệt quyền Giáo viên.'
            : nextStatus === 'rejected'
            ? 'Yêu cầu chưa được phê duyệt.'
            : 'Quyền truy cập đã được tạm thu hồi bởi quản trị viên.',
        updatedAt: serverTimestamp(),
      });
      showToast(
        nextStatus === 'approved'
          ? `Đã phê duyệt tài khoản giáo viên ${req.displayName} (${req.email}).`
          : nextStatus === 'rejected'
          ? `Đã từ chối yêu cầu của ${req.email}.`
          : `Đã thu hồi quyền truy cập của ${req.email}.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `teacher_access_requests/${req.uid}`);
    } finally {
      setProcessingTeacherUid(null);
    }
  };

  const handleCreateFirstTeacherWorkspace = async (payload: {
    teacherName: string;
    schoolName: string;
    className: string;
    subject: string;
    schoolYear: string;
  }) => {
    if (!user || teacherAccessState !== 'approved') return;
    setIsCreatingFirstWorkspace(true);
    try {
      const configDocRef = doc(db, 'users', user.uid, 'class_configs', 'active_workspace');
      await setDoc(configDocRef, {
        ownerUid: user.uid,
        teacherName: payload.teacherName.slice(0, 120),
        subject: payload.subject.slice(0, 100),
        schoolName: payload.schoolName.slice(0, 200),
        className: payload.className.slice(0, 50),
        schoolYear: payload.schoolYear.slice(0, 50),
        fundBalance: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await upsertSavedWorkspace(payload);
      setNeedsFirstWorkspaceSetup(false);
      setClassConfigLoaded(true);
      showToast(`Đã khởi tạo không gian lớp ${payload.className} (${payload.schoolName})!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/class_configs/active_workspace`);
    } finally {
      setIsCreatingFirstWorkspace(false);
    }
  };

  // Định danh lớp học an toàn cho Firestore doc ID (chỉ hợp lệ khi đã có thông tin lớp thật)
  const classWorkspaceId = useMemo(() => {
    if (!classConfig.schoolName.trim() || !classConfig.className.trim() || !classConfig.schoolYear.trim()) {
      return '';
    }
    const safeSchool = normalizeSlug(classConfig.schoolName, 'school');
    const safeClass = normalizeSlug(classConfig.className, 'class');
    const safeYear = normalizeSlug(classConfig.schoolYear, 'year');
    return `${safeSchool}_${safeClass}_${safeYear}`.slice(0, 120);
  }, [classConfig.schoolName, classConfig.className, classConfig.schoolYear]);

  const activeSubjectSlug = useMemo(
    () => normalizeSlug(classConfig.subject, 'mon_hoc'),
    [classConfig.subject]
  );

  const activeSubjectWorkspaceKey = useMemo(
    () => `${classWorkspaceId}_${activeSubjectSlug}`.slice(0, 100),
    [classWorkspaceId, activeSubjectSlug]
  );

  // Nạp quyền sử dụng Vòng quay may mắn theo đúng tài khoản và lớp học hiện tại
  useEffect(() => {
    if (!user?.uid || !classWorkspaceId) {
      setLuckyWheelAllowedRoles(['gvcn']);
      return;
    }
    try {
      const storageKey = `gvcn360_lucky_wheel_roles_${user.uid}_${classWorkspaceId}`;
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const validIds = new Set(ROLES.map((r) => r.id));
          const cleaned = parsed.filter((id): id is string => typeof id === 'string' && validIds.has(id));
          setLuckyWheelAllowedRoles(cleaned.includes('gvcn') ? cleaned : ['gvcn', ...cleaned]);
          return;
        }
      }
    } catch {
      // Bỏ qua lỗi đọc localStorage
    }
    setLuckyWheelAllowedRoles(['gvcn']);
  }, [user?.uid, classWorkspaceId]);

  // Xóa sạch phiên nhập điểm tạm thời và nạp bảng liên kết Mã vnEdu theo đúng tài khoản & lớp hiện tại
  useEffect(() => {
    setVneduWorkbook(null);
    setVneduFileName('');
    setVneduSheetNames([]);
    setVneduSelectedSheet('');
    setVneduRawText('');
    setVneduMatrix([]);
    setVneduMerges([]);
    setVneduHeaderRowIndex(-1);
    setVneduColumns([]);
    setVneduRoleMap({});
    setVneduRowResolutions({});
    setVneduDeselectedRows({});
    setVneduCodeSystemVerifiedSameAsMoet(false);
    setVneduAutoConfirmExactNameAndDob(true);
    if (!user?.uid || !classWorkspaceId) {
      setVneduConfirmedIdLinks({});
      return;
    }
    try {
      const storageKey = `gvcn360_vnedu_id_links_${user.uid}_${classWorkspaceId}`;
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const cleanLinks: VneduVerifiedLinkStore = {};
          Object.entries(parsed).forEach(([k, v]) => {
            const codeKey = typeof k === 'string' ? k.trim().toUpperCase() : '';
            if (!codeKey) return;
            if (typeof v === 'string' && v.trim()) {
              cleanLinks[codeKey] = v.trim();
            } else if (v && typeof v === 'object' && typeof (v as VneduVerifiedLink).studentId === 'string') {
              const obj = v as VneduVerifiedLink;
              if (obj.studentId.trim()) {
                cleanLinks[codeKey] = {
                  vneduCode: codeKey,
                  studentId: obj.studentId.trim(),
                  studentName: typeof obj.studentName === 'string' ? obj.studentName : '',
                  schoolName: typeof obj.schoolName === 'string' ? obj.schoolName : classConfig.schoolName,
                  className: typeof obj.className === 'string' ? obj.className : classConfig.className,
                  schoolYear: typeof obj.schoolYear === 'string' ? obj.schoolYear : classConfig.schoolYear,
                  verifiedAt: typeof obj.verifiedAt === 'number' ? obj.verifiedAt : Date.now(),
                };
              }
            }
          });
          setVneduConfirmedIdLinks(cleanLinks);
          return;
        }
      }
    } catch {
      // Bỏ qua lỗi đọc localStorage
    }
    setVneduConfirmedIdLinks({});
  }, [user?.uid, classWorkspaceId]);

  const handleToggleLuckyWheelRolePermission = (roleId: string) => {
    if (activeRoleId !== 'gvcn' || roleId === 'gvcn' || !user?.uid || !classWorkspaceId) return;
    setLuckyWheelAllowedRoles((prev) => {
      const exists = prev.includes(roleId);
      const next = exists ? prev.filter((id) => id !== roleId) : [...prev, roleId];
      try {
        const storageKey = `gvcn360_lucky_wheel_roles_${user.uid}_${classWorkspaceId}`;
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Bỏ qua lỗi ghi localStorage
      }
      const roleTitle = ROLES.find((r) => r.id === roleId)?.title || roleId;
      showToast(
        exists
          ? `Đã thu hồi quyền dùng Vòng quay may mắn của ${roleTitle}.`
          : `Đã cấp quyền dùng Vòng quay may mắn cho ${roleTitle}.`
      );
      return next;
    });
  };

  // Bước 1: Đồng bộ cấu hình lớp đang mở & danh sách lớp đã lưu của giáo viên đã được phê duyệt
  useEffect(() => {
    if (!user || sessionKind !== 'teacher' || !userRootReady || teacherAccessState !== 'approved') return;

    const userRoot = `users/${user.uid}`;
    const configDocRef = doc(db, 'users', user.uid, 'class_configs', 'active_workspace');
    const unsubConfig = onSnapshot(
      configDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<ClassConfig>;
          setClassConfig((prev) => ({ ...prev, ...data }));
          setConfigForm((prev) => ({ ...prev, ...data }));
          setNeedsFirstWorkspaceSetup(false);
          setClassConfigLoaded(true);
        } else if (isPrimaryAdmin) {
          // Chỉ chủ ứng dụng (GVCN Ngọc Ánh) mới có cấu hình khởi tạo lớp 12D6 THPT Hòa Đa
          setDoc(configDocRef, {
            ownerUid: user.uid,
            teacherName: 'Ngọc Ánh',
            subject: 'Toán',
            schoolName: 'THPT Hòa Đa',
            className: '12D6',
            schoolYear: '2026–2027',
            fundBalance: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }).catch((e) =>
            handleFirestoreError(e, OperationType.CREATE, `${userRoot}/class_configs/active_workspace`)
          );
        } else {
          // Giáo viên mới đã được duyệt: không gán mặc định 12D6 / Ngọc Ánh, yêu cầu tự khởi tạo lớp riêng
          setClassConfig(EMPTY_CLASS_CONFIG);
          setConfigForm(EMPTY_CLASS_CONFIG);
          setNeedsFirstWorkspaceSetup(true);
          setClassConfigLoaded(false);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `${userRoot}/class_configs/active_workspace`)
    );

    const workspacesColRef = collection(db, 'users', user.uid, 'saved_workspaces');
    const unsubWorkspaces = onSnapshot(
      workspacesColRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SavedWorkspace, 'id'>) }));
        list.sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0));
        setSavedWorkspaces(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${userRoot}/saved_workspaces`)
    );

    return () => {
      unsubConfig();
      unsubWorkspaces();
    };
  }, [user, sessionKind, userRootReady, teacherAccessState, isPrimaryAdmin]);

  // Bước 2: Đồng bộ toàn bộ dữ liệu nghiệp vụ của lớp đang chọn từ Cloud Firestore
  useEffect(() => {
    if (
      !user ||
      sessionKind !== 'teacher' ||
      !userRootReady ||
      teacherAccessState !== 'approved' ||
      !classConfigLoaded ||
      needsFirstWorkspaceSetup ||
      !classWorkspaceId
    ) {
      return;
    }

    const userRoot = `users/${user.uid}`;
    const wsPath = `${userRoot}/workspaces/${classWorkspaceId}`;

    // 3. Học sinh & SĐT phụ huynh bảo mật
    const studentsColRef = collection(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'students');
    const unsubStudents = onSnapshot(
      studentsColRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StudentRecord, 'id'>) }));
        list.sort(compareStudentsByRosterOrder);
        setStudents(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${wsPath}/students`)
    );

    // 4. Phiếu đề xuất
    const ticketsColRef = collection(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'tickets');
    const unsubTickets = onSnapshot(
      ticketsColRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TicketRecord, 'id'>) }));
        list.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
        setTickets(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${wsPath}/tickets`)
    );

    // 5. Nhật ký kiểm duyệt bất biến
    const logsColRef = collection(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'audit_logs');
    const unsubLogs = onSnapshot(
      logsColRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLogRecord, 'id'>) }));
        list.sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0));
        setAuditLogs(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${wsPath}/audit_logs`)
    );

    // 6. Điểm danh chính thức
    const attColRef = collection(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'attendance');
    const unsubAttendance = onSnapshot(
      attColRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceRecord, 'id'>) }));
        list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        setAttendanceRecords(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${wsPath}/attendance`)
    );

    // 7. Kế hoạch chủ nhiệm & Hoạt động Chi đoàn
    const plansColRef = collection(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'plans');
    const unsubPlans = onSnapshot(
      plansColRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ClassPlanRecord, 'id'>) }));
        list.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
        setPlans(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${wsPath}/plans`)
    );

    const youthColRef = collection(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'youth');
    const unsubYouth = onSnapshot(
      youthColRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<YouthActivityRecord, 'id'>) }));
        list.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
        setYouthActivities(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${wsPath}/youth`)
    );

    // 8. Bảng điểm môn & Lịch sử nhập vnEdu
    const scoresColRef = collection(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'scores');
    const unsubScores = onSnapshot(
      scoresColRef,
      (snapshot) => {
        const map: Record<string, SubjectScoreRecord> = {};
        snapshot.docs.forEach((d) => {
          map[d.id] = { id: d.id, ...(d.data() as Omit<SubjectScoreRecord, 'id'>) };
        });
        setSubjectScores(map);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${wsPath}/scores`)
    );

    const importsColRef = collection(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'vnedu_imports');
    const unsubImports = onSnapshot(
      importsColRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VneduImportLog, 'id'>) }));
        list.sort((a, b) => (b.importedAtMs || 0) - (a.importedAtMs || 0));
        setVneduImportHistory(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${wsPath}/vnedu_imports`)
    );

    // 9. Theo dõi Lớp 12
    const grade12ColRef = collection(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'grade12');
    const unsubGrade12 = onSnapshot(
      grade12ColRef,
      (snapshot) => {
        const map: Record<string, Grade12Profile> = {};
        snapshot.docs.forEach((d) => {
          map[d.id] = { id: d.id, ...(d.data() as Omit<Grade12Profile, 'id'>) };
        });
        setGrade12Profiles(map);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${wsPath}/grade12`)
    );

    // 10. Bộ tiêu chuẩn thi đua, Tuần đã chốt & Lịch sử điều chỉnh
    const standardsDocRef = doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'emulation_standards', 'rules');
    const unsubStandards = onSnapshot(
      standardsDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<EmulationStandards> & {
            teamBonusRule?: { enabled: boolean; ruleNote: string };
          };
          setEmulationStandards({
            ...DEFAULT_EMULATION_STANDARDS,
            ...data,
          });
          if (data.teamBonusRule) setTeamBonusRule(data.teamBonusRule);
        } else {
          setDoc(standardsDocRef, {
            ownerUid: user.uid,
            ...DEFAULT_EMULATION_STANDARDS,
            teamBonusRule: {
              enabled: false,
              ruleNote: 'GVCN chưa ban hành thang điểm quy đổi riêng cho tổ — chỉ thống kê tỷ lệ đạt A, B, C theo văn bản chuẩn.',
            },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }).catch((e) =>
            handleFirestoreError(e, OperationType.CREATE, `${wsPath}/emulation_standards/rules`)
          );
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `${wsPath}/emulation_standards/rules`)
    );

    const snapshotsColRef = collection(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'emulation_weeks');
    const unsubSnapshots = onSnapshot(
      snapshotsColRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WeeklySnapshot, 'id'>) }));
        list.sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
        setWeeklySnapshots(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${wsPath}/emulation_weeks`)
    );

    const draftsColRef = collection(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'emulation_drafts');
    const unsubDrafts = onSnapshot(
      draftsColRef,
      (snapshot) => {
        const map: Record<string, Record<string, WeeklyEmulationDraftEntry>> = {};
        snapshot.docs.forEach((d) => {
          const data = d.data() as { drafts?: Record<string, WeeklyEmulationDraftEntry> };
          map[d.id] = data.drafts || {};
        });
        setEmulationDraftsByWeek(map);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${wsPath}/emulation_drafts`)
    );

    const adjColRef = collection(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'emulation_adjustments');
    const unsubAdjustments = onSnapshot(
      adjColRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EmulationAdjustmentLog, 'id'>) }));
        list.sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0));
        setEmulationAdjustLogs(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${wsPath}/emulation_adjustments`)
    );

    // 11. Trung tâm hỗ trợ học tập bộ môn (lọc theo activeSubjectWorkspaceKey)
    const topicsColRef = collection(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'subject_topics');
    const unsubTopics = onSnapshot(
      topicsColRef,
      (snapshot) => {
        const allTopics = snapshot.docs.map((d) => ({ ...(d.data() as KnowledgeTopic), id: d.data().id || d.id }));
        const matched = allTopics.filter((t) => t.subjectKey === activeSubjectWorkspaceKey);
        if (
          matched.length === 0 &&
          !seededTopicsRef.current[activeSubjectWorkspaceKey] &&
          isPrimaryAdmin &&
          (classConfig.subject || '').toLowerCase().includes('toán')
        ) {
          seededTopicsRef.current[activeSubjectWorkspaceKey] = true;
          const defaultMathTopics = [
            {
              id: `${activeSubjectSlug}_T12_01`.slice(0, 60),
              semester: 'Học kỳ I',
              topicName: 'Ứng dụng đạo hàm để khảo sát hàm số',
              skillName: 'Tính đơn điệu và cực trị của hàm số',
              requirement: 'Xét được chiều biến thiên, tìm cực trị hàm đa thức và phân thức',
            },
            {
              id: `${activeSubjectSlug}_T12_02`.slice(0, 60),
              semester: 'Học kỳ I',
              topicName: 'Ứng dụng đạo hàm để khảo sát hàm số',
              skillName: 'Giá trị lớn nhất, giá trị nhỏ nhất & Tiệm cận',
              requirement: 'Tìm GTLN-GTNN trên đoạn và xác định đúng điều kiện tiệm cận',
            },
            {
              id: `${activeSubjectSlug}_T12_03`.slice(0, 60),
              semester: 'Học kỳ I',
              topicName: 'Vectơ và hệ tọa độ trong không gian Oxyz',
              skillName: 'Tọa độ vectơ và biểu thức tọa độ các phép toán',
              requirement: 'Tính đúng tích vô hướng, góc giữa hai vectơ trong Oxyz',
            },
            {
              id: `${activeSubjectSlug}_T12_04`.slice(0, 60),
              semester: 'Học kỳ II',
              topicName: 'Nguyên hàm và Tích phân',
              skillName: 'Tính nguyên hàm, tích phân bằng phương pháp đổi biến & từng phần',
              requirement: 'Áp dụng đúng công thức nguyên hàm cơ bản và đổi cận chính xác',
            },
          ];
          defaultMathTopics.forEach((item) => {
            setDoc(doc(topicsColRef, item.id), {
              ownerUid: user.uid,
              subjectKey: activeSubjectWorkspaceKey,
              ...item,
              createdBy: classConfig.teacherName || 'GVCN',
              createdAtMs: Date.now(),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }).catch((e) =>
              handleFirestoreError(e, OperationType.CREATE, `${wsPath}/subject_topics/${item.id}`)
            );
          });
        } else {
          if (matched.length > 0) {
            seededTopicsRef.current[activeSubjectWorkspaceKey] = true;
          }
          matched.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
          setKnowledgeTopics(matched);
          setQcTopicId((prev) => (matched.some((m) => m.id === prev) ? prev : matched[0]?.id || ''));
          setErrTopicId((prev) => (matched.some((m) => m.id === prev) ? prev : matched[0]?.id || ''));
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${wsPath}/subject_topics`)
    );

    const qcColRef = collection(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'subject_quick_checks');
    const unsubQuickChecks = onSnapshot(
      qcColRef,
      (snapshot) => {
        const list = snapshot.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<QuickCheckRecord, 'id'>) }))
          .filter((item) => item.subjectKey === activeSubjectWorkspaceKey);
        list.sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0));
        setQuickChecks(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${wsPath}/subject_quick_checks`)
    );

    const errColRef = collection(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'subject_error_logs');
    const unsubErrorLogs = onSnapshot(
      errColRef,
      (snapshot) => {
        const list = snapshot.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<ErrorLogRecord, 'id'>) }))
          .filter((item) => item.subjectKey === activeSubjectWorkspaceKey);
        list.sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0));
        setErrorLogs(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${wsPath}/subject_error_logs`)
    );

    // 12. Tài khoản Cán bộ lớp thật & Nhật ký phân quyền (chỉ GVCN)
    const officerAccountsColRef = collection(
      db,
      'users',
      user.uid,
      'workspaces',
      classWorkspaceId,
      'officer_accounts'
    );
    const unsubOfficerAccounts = onSnapshot(
      officerAccountsColRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<OfficerAccountRecord, 'id'>),
        }));
        list.sort((a, b) => (a.nickname || '').localeCompare(b.nickname || ''));
        setOfficerAccounts(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${wsPath}/officer_accounts`)
    );

    const permAuditColRef = collection(
      db,
      'users',
      user.uid,
      'workspaces',
      classWorkspaceId,
      'permission_audit_logs'
    );
    const unsubPermAuditLogs = onSnapshot(
      permAuditColRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<PermissionAuditLogRecord, 'id'>),
        }));
        list.sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0));
        setPermissionAuditLogs(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${wsPath}/permission_audit_logs`)
    );

    // 13. Bảng phân công 7 vị trí chính thức (role_assignments) & Lịch sử bất biến (role_assignment_history)
    const roleAssignmentsColRef = collection(
      db,
      'users',
      user.uid,
      'workspaces',
      classWorkspaceId,
      'role_assignments'
    );
    const unsubRoleAssignments = onSnapshot(
      roleAssignmentsColRef,
      (snapshot) => {
        const list = snapshot.docs
          .filter((d) => isValidOfficerRoleId(d.id))
          .map((d) => ({
            ...(d.data() as Omit<RoleAssignmentRecord, 'id'>),
            id: d.id as OfficerRoleId,
          }));
        setRoleAssignments(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${wsPath}/role_assignments`)
    );

    const roleHistoryColRef = collection(
      db,
      'users',
      user.uid,
      'workspaces',
      classWorkspaceId,
      'role_assignment_history'
    );
    const unsubRoleHistory = onSnapshot(
      roleHistoryColRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<RoleAssignmentHistoryRecord, 'id'>),
        }));
        list.sort((a, b) => (b.changedAtMs || 0) - (a.changedAtMs || 0));
        setRoleAssignmentHistory(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${wsPath}/role_assignment_history`)
    );

    // Trợ lý Nhận xét Sư phạm AI (chỉ GVCN)
    const pedObsColRef = collection(
      db,
      'users',
      user.uid,
      'workspaces',
      classWorkspaceId,
      'pedagogical_observations'
    );
    const unsubPedObs = onSnapshot(
      pedObsColRef,
      (snapshot) => {
        const map: Record<string, PedagogicalObservationRecord> = {};
        snapshot.docs.forEach((d) => {
          map[d.id] = { id: d.id, ...(d.data() as Omit<PedagogicalObservationRecord, 'id'>) };
        });
        setPedagogicalObservationsMap(map);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${wsPath}/pedagogical_observations`)
    );

    const rcCommentsColRef = collection(
      db,
      'users',
      user.uid,
      'workspaces',
      classWorkspaceId,
      'report_card_comments'
    );
    const unsubRcComments = onSnapshot(
      rcCommentsColRef,
      (snapshot) => {
        const map: Record<string, ReportCardCommentRecord> = {};
        snapshot.docs.forEach((d) => {
          map[d.id] = { id: d.id, ...(d.data() as Omit<ReportCardCommentRecord, 'id'>) };
        });
        setReportCardCommentsMap(map);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${wsPath}/report_card_comments`)
    );

    const parentMsgColRef = collection(
      db,
      'users',
      user.uid,
      'workspaces',
      classWorkspaceId,
      'parent_messages'
    );
    const unsubParentMsgs = onSnapshot(
      parentMsgColRef,
      (snapshot) => {
        const map: Record<string, ParentMessageRecord> = {};
        snapshot.docs.forEach((d) => {
          map[d.id] = { id: d.id, ...(d.data() as Omit<ParentMessageRecord, 'id'>) };
        });
        setParentMessagesMap(map);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${wsPath}/parent_messages`)
    );

    return () => {
      unsubStudents();
      unsubTickets();
      unsubLogs();
      unsubAttendance();
      unsubPlans();
      unsubYouth();
      unsubScores();
      unsubImports();
      unsubGrade12();
      unsubStandards();
      unsubSnapshots();
      unsubDrafts();
      unsubAdjustments();
      unsubTopics();
      unsubQuickChecks();
      unsubErrorLogs();
      unsubOfficerAccounts();
      unsubPermAuditLogs();
      unsubRoleAssignments();
      unsubRoleHistory();
      unsubPedObs();
      unsubRcComments();
      unsubParentMsgs();
    };
  }, [
    user,
    sessionKind,
    userRootReady,
    teacherAccessState,
    classConfigLoaded,
    needsFirstWorkspaceSetup,
    classWorkspaceId,
    activeSubjectWorkspaceKey,
    activeSubjectSlug,
    classConfig.subject,
    classConfig.teacherName,
    isPrimaryAdmin,
  ]);

  // Chỉ tải thông tin phụ huynh (student_pii) khi đang ở vai trò GVCN đã được phê duyệt; tự động xóa khỏi bộ nhớ khi chuyển sang vai trò khác
  useEffect(() => {
    if (
      !user ||
      sessionKind !== 'teacher' ||
      !userRootReady ||
      teacherAccessState !== 'approved' ||
      !classConfigLoaded ||
      !classWorkspaceId ||
      activeRoleId !== 'gvcn'
    ) {
      setStudentPiiMap({});
      return;
    }

    const wsPath = `users/${user.uid}/workspaces/${classWorkspaceId}`;
    const piiColRef = collection(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'student_pii');
    const unsubPii = onSnapshot(
      piiColRef,
      (snapshot) => {
        const map: Record<string, StudentPiiRecord> = {};
        snapshot.docs.forEach((d) => {
          const data = d.data() as { studentCode?: string; parentName?: string; parentPhone?: string };
          const codeKey = data.studentCode || d.id;
          map[codeKey] = {
            studentCode: codeKey,
            parentName: data.parentName || '',
            parentPhone: data.parentPhone || '',
          };
        });
        setStudentPiiMap(map);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${wsPath}/student_pii`)
    );

    return () => {
      unsubPii();
    };
  }, [user, sessionKind, userRootReady, teacherAccessState, classConfigLoaded, classWorkspaceId, activeRoleId]);

  const currentRole = useMemo(
    () => ROLES.find((r) => r.id === activeRoleId) || ROLES[0],
    [activeRoleId]
  );

  const selectedWeekNumber = useMemo(
    () => parseInt(selectedEmulationWeek.replace(/\D/g, ''), 10) || 1,
    [selectedEmulationWeek]
  );
  const selectedWeekDocId = `week_${selectedWeekNumber}`;

  const currentWeekDrafts = useMemo(
    () => emulationDraftsByWeek[selectedWeekDocId] || {},
    [emulationDraftsByWeek, selectedWeekDocId]
  );

  const currentLockedSnapshot = useMemo(
    () => weeklySnapshots.find((w) => w.weekLabel === selectedEmulationWeek) || null,
    [weeklySnapshots, selectedEmulationWeek]
  );

  // ============================================================================
  // HANDLERS TUÂN THỦ 100% FIRESTORE RULES
  // ============================================================================
  const upsertSavedWorkspace = async (payload: {
    teacherName: string;
    subject: string;
    schoolName: string;
    className: string;
    schoolYear: string;
  }) => {
    if (!user) return;
    const wsKey = normalizeSlug(
      `${payload.schoolName}_${payload.className}_${payload.schoolYear}`,
      'workspace'
    ).slice(0, 120);
    const wsRef = doc(db, 'users', user.uid, 'saved_workspaces', wsKey);
    const wsSnap = await getDoc(wsRef);
    if (wsSnap.exists()) {
      await updateDoc(wsRef, {
        ...payload,
        updatedAtMs: Date.now(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(wsRef, {
        ownerUid: user.uid,
        ...payload,
        updatedAtMs: Date.now(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || activeRoleId !== 'gvcn') {
      showToast('Chỉ GVCN mới có quyền cập nhật cấu hình lớp học.', 'error');
      return;
    }
    try {
      const configDocRef = doc(db, 'users', user.uid, 'class_configs', 'active_workspace');
      const existingCfg = await getDoc(configDocRef);
      const nextPayload = {
        teacherName: configForm.teacherName.trim(),
        subject: configForm.subject.trim(),
        schoolName: configForm.schoolName.trim(),
        className: configForm.className.trim(),
        schoolYear: configForm.schoolYear.trim(),
      };
      if (existingCfg.exists()) {
        await updateDoc(configDocRef, {
          ...nextPayload,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(configDocRef, {
          ownerUid: user.uid,
          ...nextPayload,
          fundBalance: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await upsertSavedWorkspace(nextPayload);
      showToast('Đã lưu cấu hình lớp học & năm học vào Cloud Firestore!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/class_configs/active_workspace`);
    }
  };

  const handleSwitchWorkspace = async (ws: SavedWorkspace) => {
    if (!user || activeRoleId !== 'gvcn') {
      showToast('Chỉ GVCN mới có quyền chuyển đổi không gian lớp học.', 'error');
      return;
    }
    try {
      const configDocRef = doc(db, 'users', user.uid, 'class_configs', 'active_workspace');
      await updateDoc(configDocRef, {
        teacherName: ws.teacherName,
        subject: ws.subject,
        schoolName: ws.schoolName,
        className: ws.className,
        schoolYear: ws.schoolYear,
        updatedAt: serverTimestamp(),
      });
      showToast(`Đã chuyển sang không gian Lớp ${ws.className} (${ws.schoolYear})!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/class_configs/active_workspace`);
    }
  };

  const handleSeedSampleStudents = async () => {
    if (!user || activeRoleId !== 'gvcn') {
      showToast('Chỉ GVCN mới có quyền khởi tạo hồ sơ học sinh.', 'error');
      return;
    }
    try {
      for (const st of INITIAL_SAMPLE_STUDENTS) {
        const stRef = doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'students', st.code);
        const piiRef = doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'student_pii', st.code);
        const stSnap = await getDoc(stRef);
        if (!stSnap.exists()) {
          await setDoc(stRef, {
            ownerUid: user.uid,
            code: st.code,
            fullName: st.fullName,
            gender: st.gender,
            dob: formatDobToDmy(st.dob || ''),
            team: Number(st.team),
            role: st.role,
            secondRole: '',
            note: st.note || '',
            meritPoints: 100,
            attendancePresent: 0,
            attendanceAbsent: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        const piiSnap = await getDoc(piiRef);
        if (!piiSnap.exists()) {
          await setDoc(piiRef, {
            ownerUid: user.uid,
            studentCode: st.code,
            parentName: '',
            parentPhone: st.parentPhone || '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
      showToast('Đã khởi tạo 8 hồ sơ học sinh tiêu biểu (đủ 4 tổ & Ban cán sự) vào Firestore!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/workspaces/${classWorkspaceId}/students`);
    }
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || activeRoleId !== 'gvcn') {
      showToast('Chỉ GVCN mới được phép chỉnh sửa hồ sơ gốc của học sinh.', 'error');
      return;
    }
    if (!studentForm.code.trim() || !studentForm.fullName.trim()) {
      showToast('Vui lòng nhập đầy đủ Mã học sinh và Họ tên.', 'error');
      return;
    }

    const cleanCode = studentForm.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleanCode) {
      showToast('Mã học sinh chỉ được chứa chữ cái không dấu, số, gạch ngang hoặc gạch dưới.', 'error');
      return;
    }

    const cleanMoet = (studentForm.moetCode || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    const normalizedDob = formatDobToDmy(studentForm.dob);
    const nextRoles = [studentForm.role, studentForm.secondRole || ''].filter(isValidOfficerRoleId);
    const roleFields = studentRolesToLegacyFields(nextRoles);

    try {
      const stRef = doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'students', cleanCode);
      const piiRef = doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'student_pii', cleanCode);
      const existingSt = await getDoc(stRef);

      if (existingSt.exists()) {
        const oldRoles = getStudentRoles(existingSt.data() as StudentRecord);
        await updateDoc(stRef, {
          moetCode: cleanMoet || (/^\d{10}$/.test(cleanCode) ? cleanCode : ''),
          fullName: studentForm.fullName.trim(),
          gender: studentForm.gender,
          dob: normalizedDob,
          team: Number(studentForm.team),
          role: roleFields.role,
          secondRole: roleFields.secondRole,
          roles: roleFields.roles,
          note: studentForm.note || '',
          meritPoints: editingStudent?.meritPoints ?? 100,
          updatedAt: serverTimestamp(),
        });
        if (!areRoleListsEqual(oldRoles, roleFields.roles)) {
          await appendPermissionAuditLog({
            action: 'Cập nhật chức vụ học sinh',
            nickname: 'profile',
            studentCode: cleanCode,
            studentName: studentForm.fullName.trim(),
            details: `Cập nhật chức vụ trong lớp từ "${formatStudentRolesLabel(oldRoles)}" thành "${formatStudentRolesLabel(roleFields.roles)}".`,
          }).catch(() => {});
        }
      } else {
        await setDoc(stRef, {
          ownerUid: user.uid,
          code: cleanCode,
          moetCode: cleanMoet || (/^\d{10}$/.test(cleanCode) ? cleanCode : ''),
          fullName: studentForm.fullName.trim(),
          gender: studentForm.gender,
          dob: normalizedDob,
          team: Number(studentForm.team),
          role: roleFields.role,
          secondRole: roleFields.secondRole,
          roles: roleFields.roles,
          note: studentForm.note || '',
          meritPoints: 100,
          attendancePresent: 0,
          attendanceAbsent: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      const sanitizedParentName = isMissingPlaceholderValue(studentForm.parentName)
        ? ''
        : studentForm.parentName.trim();
      const sanitizedParentPhone = isMissingPlaceholderValue(studentForm.parentPhone)
        ? ''
        : studentForm.parentPhone.trim();

      const existingPii = await getDoc(piiRef);
      if (existingPii.exists()) {
        await updateDoc(piiRef, {
          parentName: sanitizedParentName,
          parentPhone: sanitizedParentPhone,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(piiRef, {
          ownerUid: user.uid,
          studentCode: cleanCode,
          parentName: sanitizedParentName,
          parentPhone: sanitizedParentPhone,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      setShowStudentModal(false);
      setEditingStudent(null);
      showToast(editingStudent ? 'Đã cập nhật hồ sơ học sinh!' : 'Đã thêm học sinh mới vào lớp!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/workspaces/${classWorkspaceId}/students/${cleanCode}`);
    }
  };

  const handleQuickUpdateStudentRoles = async (payload: {
    student: StudentRecord;
    nextTeam: number;
    nextRoles: OfficerRoleId[];
    replaceHolders?: { student: StudentRecord; roleToRemove: OfficerRoleId }[];
  }) => {
    if (!user || sessionKind !== 'teacher' || activeRoleId !== 'gvcn' || !classWorkspaceId) {
      showToast('Chỉ Giáo viên chủ nhiệm mới có quyền chỉnh sửa chức vụ học sinh.', 'error');
      return;
    }

    const oldRoles = getStudentRoles(payload.student);
    const oldTeam = Number(payload.student.team) || 1;
    const roleFields = studentRolesToLegacyFields(payload.nextRoles);

    try {
      const targetRef = doc(
        db,
        'users',
        user.uid,
        'workspaces',
        classWorkspaceId,
        'students',
        payload.student.id
      );

      await updateDoc(targetRef, {
        team: Number(payload.nextTeam),
        role: roleFields.role,
        secondRole: roleFields.secondRole,
        roles: roleFields.roles,
        updatedAt: serverTimestamp(),
      });

      const oldDesc = `${formatStudentRolesLabel(oldRoles)} (Tổ ${oldTeam})`;
      const newDesc = `${formatStudentRolesLabel(roleFields.roles)} (Tổ ${payload.nextTeam})`;
      await appendPermissionAuditLog({
        action:
          roleFields.roles.length === 0
            ? 'Thu hồi chức vụ trong lớp'
            : oldRoles.length === 0
              ? 'Giao chức vụ trong lớp'
              : 'Cập nhật chức vụ trong lớp',
        nickname: 'profile',
        studentCode: payload.student.code || payload.student.id,
        studentName: payload.student.fullName,
        details: `GVCN điều chỉnh chức vụ cho ${payload.student.fullName}: ${oldDesc} → ${newDesc}.`,
      }).catch(() => {});

      // Chỉ chuyển chức vụ của học sinh cũ khi GVCN chủ động tick xác nhận thay thế
      if (payload.replaceHolders && payload.replaceHolders.length > 0) {
        const removalsByStudentId = new Map<string, { student: StudentRecord; rolesToRemove: Set<OfficerRoleId> }>();
        for (const item of payload.replaceHolders) {
          const entry = removalsByStudentId.get(item.student.id) || {
            student: item.student,
            rolesToRemove: new Set<OfficerRoleId>(),
          };
          entry.rolesToRemove.add(item.roleToRemove);
          removalsByStudentId.set(item.student.id, entry);
        }

        for (const { student: holder, rolesToRemove } of removalsByStudentId.values()) {
          const holderOldRoles = getStudentRoles(holder);
          const holderNextRoles = holderOldRoles.filter((r) => !rolesToRemove.has(r));
          const holderFields = studentRolesToLegacyFields(holderNextRoles);
          const holderRef = doc(
            db,
            'users',
            user.uid,
            'workspaces',
            classWorkspaceId,
            'students',
            holder.id
          );
          await updateDoc(holderRef, {
            role: holderFields.role,
            secondRole: holderFields.secondRole,
            roles: holderFields.roles,
            updatedAt: serverTimestamp(),
          });
          await appendPermissionAuditLog({
            action: 'Chuyển giao chức vụ trong lớp',
            nickname: 'profile',
            studentCode: holder.code || holder.id,
            studentName: holder.fullName,
            details: `Chuyển giao chức vụ sang ${payload.student.fullName}: ${holder.fullName} đổi từ "${formatStudentRolesLabel(holderOldRoles)}" thành "${formatStudentRolesLabel(holderFields.roles)}".`,
          }).catch(() => {});
        }
      }

      showToast(
        `Đã cập nhật chức vụ cho ${payload.student.fullName}: ${formatStudentRolesLabel(roleFields.roles)}.`
      );
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `users/${user.uid}/workspaces/${classWorkspaceId}/students/${payload.student.id}`
      );
    }
  };

  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    if (!user || activeRoleId !== 'gvcn') return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'students', studentId));
      await deleteDoc(doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'student_pii', studentId)).catch(() => {});
      showToast(`Đã xóa hồ sơ học sinh ${studentName}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/workspaces/${classWorkspaceId}/students/${studentId}`);
    }
  };

  const handleDeleteAllStudents = async () => {
    if (!user || activeRoleId !== 'gvcn' || students.length === 0) return;
    setIsDeletingAllStudents(true);
    try {
      const snapshotList = [...students];
      for (const st of snapshotList) {
        await deleteDoc(doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'students', st.id));
        await deleteDoc(
          doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'student_pii', st.code || st.id)
        ).catch(() => {});
      }
      setShowDeleteAllModal(false);
      showToast(`Đã xóa toàn bộ ${snapshotList.length} học sinh khỏi danh sách lớp.`);
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.DELETE,
        `users/${user.uid}/workspaces/${classWorkspaceId}/students`
      );
    } finally {
      setIsDeletingAllStudents(false);
    }
  };

  const handleSelectRole = (nextId: string) => {
    if (sessionKind === 'officer') {
      if (!officerMembership?.roles.includes(nextId as OfficerRoleId)) {
        return;
      }
    }
    setActiveRoleId(nextId);
    const nextRole = ROLES.find((r) => r.id === nextId);
    if (!nextRole) return;
    setDisciplineTeamFilter(nextRole.team ? String(nextRole.team) : 'all');
    const nextType =
      nextRole.id === 'gvcn' && nextRole.allowedTicketTypes.includes(ticketForm.type)
        ? ticketForm.type
        : nextRole.allowedTicketTypes[0];
    const defaultCategory =
      nextType === 'thu_chi'
        ? 'Thu quỹ'
        : nextType === 'chi_doan'
          ? 'Báo cáo hoạt động Chi đoàn'
          : nextType === 'diem_danh'
            ? nextRole.team
              ? 'Ghi nhận HS vắng / đi muộn'
              : 'Điểm danh cả lớp'
            : 'Tuyên dương';
    setTicketForm((prev) => ({
      ...prev,
      type: nextType,
      studentId: '',
      category: defaultCategory,
    }));
    showToast(`Đã chuyển sang vai trò: ${nextRole.title}`);
  };

  // ============================================================================
  // QUẢN LÝ TÀI KHOẢN CÁN BỘ LỚP THẬT (CHỈ GVCN) & ĐỔI MẬT KHẨU CÁN BỘ LỚP
  // ============================================================================
  const appendPermissionAuditLog = async (payload: {
    action: string;
    nickname: string;
    studentCode: string;
    studentName: string;
    details: string;
  }) => {
    if (!user || sessionKind !== 'teacher' || !classWorkspaceId) return;
    try {
      await addDoc(
        collection(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'permission_audit_logs'),
        {
          ownerUid: user.uid,
          action: payload.action.slice(0, 80),
          nickname: payload.nickname.slice(0, 40),
          studentCode: payload.studentCode.slice(0, 40),
          studentName: payload.studentName.slice(0, 150),
          details: payload.details.slice(0, 600),
          actorEmail: (user.email || user.uid).slice(0, 200),
          timestampMs: Date.now(),
          createdAt: serverTimestamp(),
        }
      );
    } catch {
      // Không chặn thao tác chính nếu ghi log phụ gặp lỗi mạng tạm thời
    }
  };

  const handleCreateOfficerAccount = async (payload: {
    student: StudentRecord;
    nickname: string;
    roles: OfficerRoleId[];
    initialPassword: string;
    mustChangePassword: boolean;
    allowDirectClassAttendance?: boolean;
  }): Promise<{ nickname: string; password: string }> => {
    if (!user || sessionKind !== 'teacher' || activeRoleId !== 'gvcn' || !classWorkspaceId) {
      throw new Error('Chỉ Giáo viên chủ nhiệm mới có quyền tạo tài khoản Cán bộ lớp.');
    }

    const cleanNickname = normalizeOfficerNickname(payload.nickname);
    if (cleanNickname.length < 3) {
      throw new Error('Nickname phải có ít nhất 3 ký tự (chữ thường, số, dấu chấm hoặc gạch dưới).');
    }
    if (payload.initialPassword.length < 8) {
      throw new Error('Mật khẩu khởi tạo phải có tối thiểu 8 ký tự.');
    }

    const uniqueRoles = Array.from(new Set(payload.roles)).slice(0, 2);
    if (uniqueRoles.length === 0) {
      throw new Error('Vui lòng chọn ít nhất 1 vị trí cán bộ lớp.');
    }

    if (officerAccounts.some((a) => a.studentCode === payload.student.code)) {
      throw new Error(
        `Học sinh ${payload.student.fullName} đã có tài khoản Cán bộ lớp. Hãy sửa vai trò trên tài khoản hiện có (hỗ trợ tối đa 2 vai trò trên 1 tài khoản).`
      );
    }

    const nickId = nicknameToDocId(cleanNickname);
    const dirRef = doc(db, 'officer_directory', nickId);
    const existingDir = await getDoc(dirRef);
    if (existingDir.exists()) {
      throw new Error(
        `Nickname "${cleanNickname}" đã tồn tại trên hệ thống. Vui lòng chọn một Nickname khác (duy nhất toàn hệ thống).`
      );
    }

    // Cấp tài khoản Firebase Auth thật qua backend bảo vệ (không đụng phiên Google của GVCN)
    const provisioned = await provisionOfficerAuthCredential(cleanNickname, payload.initialPassword, {
      mode: 'create',
      credentialVersion: 1,
    });
    const officerUid = provisioned.officerUid;
    const authEmail = provisioned.authEmail;
    const assignedTeam = getTeamFromOfficerRoles(uniqueRoles);
    const allowDirectAttendance =
      uniqueRoles.includes('lop_truong') && Boolean(payload.allowDirectClassAttendance);

    await setDoc(dirRef, {
      nickname: cleanNickname,
      nicknameId: nickId,
      authEmail,
      teacherUid: user.uid,
      workspaceId: classWorkspaceId,
      active: true,
      credentialVersion: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const studentMoet = getStudentMoetCode(payload.student);

    await setDoc(doc(db, 'officer_memberships', officerUid), {
      officerUid,
      teacherUid: user.uid,
      workspaceId: classWorkspaceId,
      schoolName: (classConfig.schoolName || 'Trường THPT').slice(0, 200),
      className: (classConfig.className || 'Lớp').slice(0, 50),
      schoolYear: (classConfig.schoolYear || '2026–2027').slice(0, 50),
      teacherName: (classConfig.teacherName || user.displayName || 'GVCN').slice(0, 120),
      studentCode: payload.student.code.slice(0, 40),
      studentId: payload.student.id.slice(0, 40),
      moetCode: studentMoet.slice(0, 40),
      studentName: payload.student.fullName.slice(0, 150),
      nickname: cleanNickname,
      nicknameId: nickId,
      roles: uniqueRoles,
      assignedTeam,
      allowDirectClassAttendance: allowDirectAttendance,
      active: true,
      permissionStatus: 'active',
      securityLockReason: '',
      mustChangePassword: Boolean(payload.mustChangePassword),
      credentialVersion: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(
      doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'officer_accounts', payload.student.code),
      {
        ownerUid: user.uid,
        studentCode: payload.student.code.slice(0, 40),
        studentId: payload.student.id.slice(0, 40),
        moetCode: studentMoet.slice(0, 40),
        studentName: payload.student.fullName.slice(0, 150),
        team: Number(payload.student.team) || 1,
        nickname: cleanNickname,
        nicknameId: nickId,
        officerUid,
        authEmail,
        roles: uniqueRoles,
        assignedTeam,
        allowDirectClassAttendance: allowDirectAttendance,
        active: true,
        permissionStatus: 'active',
        securityLockReason: '',
        mustChangePassword: Boolean(payload.mustChangePassword),
        credentialVersion: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );

    // Nếu học sinh đã được chốt ở bảng role_assignments chính thức, gắn officerUid & nickname tương ứng
    for (const r of uniqueRoles) {
      const existingRa = roleAssignments.find(
        (ra) => ra.roleId === r && ra.studentId === payload.student.id
      );
      if (existingRa) {
        await updateDoc(
          doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'role_assignments', r),
          {
            officerUid,
            nickname: cleanNickname,
            status: 'active',
            updatedAt: serverTimestamp(),
          }
        ).catch(() => {});
      }
    }

    // Đồng bộ chức vụ tương ứng lên hồ sơ học sinh trong Danh sách lớp
    const syncedProfileFields = studentRolesToLegacyFields(uniqueRoles);
    const stProfileRef = doc(
      db,
      'users',
      user.uid,
      'workspaces',
      classWorkspaceId,
      'students',
      payload.student.id
    );
    await updateDoc(stProfileRef, {
      role: syncedProfileFields.role,
      secondRole: syncedProfileFields.secondRole,
      roles: syncedProfileFields.roles,
      updatedAt: serverTimestamp(),
    }).catch(() => {});

    const roleTitles = uniqueRoles.map((r) => ROLES.find((x) => x.id === r)?.title || r).join(' + ');
    await appendPermissionAuditLog({
      action: 'Tạo tài khoản Cán bộ lớp',
      nickname: cleanNickname,
      studentCode: payload.student.code,
      studentName: payload.student.fullName,
      details: `Cấp tài khoản thật cho ${payload.student.fullName} với vai trò: ${roleTitles}${
        uniqueRoles.includes('lop_truong')
          ? allowDirectAttendance
            ? ' (cho phép điểm danh trực tiếp toàn lớp)'
            : ' (chế độ tổng hợp chuyên cần mặc định)'
          : ''
      }.`,
    });

    showToast(`Đã tạo tài khoản thật ${cleanNickname} cho ${payload.student.fullName}!`);
    return { nickname: cleanNickname, password: payload.initialPassword };
  };

  const handleUpdateOfficerRoles = async (
    account: OfficerAccountRecord,
    nextRoles: OfficerRoleId[]
  ) => {
    if (!user || sessionKind !== 'teacher' || activeRoleId !== 'gvcn' || !classWorkspaceId) {
      throw new Error('Chỉ GVCN mới có quyền cập nhật vai trò Cán bộ lớp.');
    }
    const uniqueRoles = Array.from(new Set(nextRoles)).slice(0, 2);
    if (uniqueRoles.length === 0) {
      throw new Error('Tài khoản phải giữ ít nhất 1 vai trò. Nếu muốn thu hồi toàn bộ, hãy khóa hoặc xóa tài khoản.');
    }

    const nextAssignedTeam = getTeamFromOfficerRoles(uniqueRoles);
    const nextAllowDirect = uniqueRoles.includes('lop_truong')
      ? Boolean(account.allowDirectClassAttendance)
      : false;
    await updateDoc(doc(db, 'officer_memberships', account.officerUid), {
      roles: uniqueRoles,
      assignedTeam: nextAssignedTeam,
      allowDirectClassAttendance: nextAllowDirect,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(
      doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'officer_accounts', account.studentCode),
      {
        roles: uniqueRoles,
        assignedTeam: nextAssignedTeam,
        allowDirectClassAttendance: nextAllowDirect,
        updatedAt: serverTimestamp(),
      }
    );

    // Đồng bộ chức vụ mới lên hồ sơ học sinh trong Danh sách lớp
    const matchedStudentDoc = students.find(
      (s) => s.code === account.studentCode || s.id === account.studentCode
    );
    if (matchedStudentDoc) {
      const syncedProfileFields = studentRolesToLegacyFields(uniqueRoles);
      await updateDoc(
        doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'students', matchedStudentDoc.id),
        {
          role: syncedProfileFields.role,
          secondRole: syncedProfileFields.secondRole,
          roles: syncedProfileFields.roles,
          updatedAt: serverTimestamp(),
        }
      ).catch(() => {});
    }

    const roleTitles = uniqueRoles.map((r) => ROLES.find((x) => x.id === r)?.title || r).join(' + ');
    await appendPermissionAuditLog({
      action: 'Cập nhật vai trò',
      nickname: account.nickname,
      studentCode: account.studentCode,
      studentName: account.studentName,
      details: `Cập nhật vai trò thành: ${roleTitles}.`,
    });
    showToast(`Đã cập nhật vai trò cho ${account.nickname}: ${roleTitles}.`);
  };

  const handleToggleMonitorDirectAttendance = async (account: OfficerAccountRecord) => {
    if (!user || sessionKind !== 'teacher' || activeRoleId !== 'gvcn' || !classWorkspaceId) {
      throw new Error('Chỉ GVCN mới có quyền bật/tắt điểm danh trực tiếp toàn lớp.');
    }
    if (!account.roles.includes('lop_truong')) return;
    const nextAllow = !Boolean(account.allowDirectClassAttendance);
    await updateDoc(doc(db, 'officer_memberships', account.officerUid), {
      allowDirectClassAttendance: nextAllow,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(
      doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'officer_accounts', account.studentCode),
      {
        allowDirectClassAttendance: nextAllow,
        updatedAt: serverTimestamp(),
      }
    );
    await appendPermissionAuditLog({
      action: nextAllow ? 'Bật điểm danh trực tiếp toàn lớp' : 'Tắt điểm danh trực tiếp toàn lớp',
      nickname: account.nickname,
      studentCode: account.studentCode,
      studentName: account.studentName,
      details: nextAllow
        ? `GVCN cho phép Lớp trưởng (${account.nickname}) lập phiếu điểm danh trực tiếp toàn lớp.`
        : `GVCN đưa Lớp trưởng (${account.nickname}) về chế độ mặc định (chỉ tổng hợp chuyên cần từ 4 Tổ trưởng).`,
    });
    showToast(
      nextAllow
        ? `Đã bật quyền điểm danh trực tiếp toàn lớp cho ${account.nickname}.`
        : `Đã tắt quyền điểm danh trực tiếp toàn lớp cho ${account.nickname}.`
    );
  };

  const handleToggleOfficerLock = async (account: OfficerAccountRecord) => {
    if (!user || sessionKind !== 'teacher' || activeRoleId !== 'gvcn' || !classWorkspaceId) return;
    const nextActive = !account.active;
    const liveMem = officerLoginStatusMap[account.officerUid];
    const lockReason = (liveMem?.securityLockReason || account.securityLockReason || '').trim();
    if (nextActive && lockReason) {
      throw new Error(
        `Tài khoản ${account.nickname} đang bị khóa vì lý do bảo mật ("${lockReason}"). Vui lòng mở màn hình "RÀ SOÁT VÀ ĐỒNG BỘ CÁN BỘ LỚP" để GVCN xác minh trực tiếp trước khi kích hoạt lại.`
      );
    }
    const nextPermStatus = nextActive ? 'active' : 'locked';
    await updateDoc(doc(db, 'officer_directory', account.nicknameId), {
      active: nextActive,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'officer_memberships', account.officerUid), {
      active: nextActive,
      permissionStatus: nextPermStatus,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(
      doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'officer_accounts', account.studentCode),
      {
        active: nextActive,
        permissionStatus: nextPermStatus,
        updatedAt: serverTimestamp(),
      }
    );

    await appendPermissionAuditLog({
      action: nextActive ? 'Mở khóa tài khoản' : 'Khóa tài khoản',
      nickname: account.nickname,
      studentCode: account.studentCode,
      studentName: account.studentName,
      details: nextActive
        ? `Khôi phục quyền đăng nhập cho ${account.nickname}.`
        : `Tạm khóa tài khoản ${account.nickname} (ngắt quyền truy cập ngay lập tức).`,
    });
    showToast(
      nextActive
        ? `Đã mở khóa tài khoản ${account.nickname}.`
        : `Đã khóa tài khoản ${account.nickname} ngay lập tức.`
    );
  };

  const handleResetOfficerPassword = async (
    account: OfficerAccountRecord,
    newPassword: string,
    mustChangePassword: boolean
  ): Promise<{ nickname: string; password: string }> => {
    if (!user || sessionKind !== 'teacher' || activeRoleId !== 'gvcn' || !classWorkspaceId) {
      throw new Error('Chỉ GVCN mới có quyền đặt lại mật khẩu Cán bộ lớp.');
    }
    if (newPassword.length < 8) {
      throw new Error('Mật khẩu mới phải có ít nhất 8 ký tự.');
    }

    const nextVersion = (account.credentialVersion || 1) + 1;
    if (nextVersion > 100) {
      throw new Error('Đã vượt quá giới hạn 100 lần xoay phiên mật khẩu. Hãy xóa và tạo lại tài khoản.');
    }
    const provisioned = await provisionOfficerAuthCredential(account.nickname, newPassword, {
      mode: 'reset',
      credentialVersion: nextVersion,
    });
    const newOfficerUid = provisioned.officerUid;
    const nextAuthEmail = provisioned.authEmail;

    const matchedStForReset = students.find(
      (s) =>
        s.id === account.studentId ||
        s.code === account.studentCode ||
        s.id === account.studentCode
    );
    const resolvedStudentId = (account.studentId || matchedStForReset?.id || '').slice(0, 40);
    const resolvedMoetCode = (
      account.moetCode ||
      (matchedStForReset ? getStudentMoetCode(matchedStForReset) : '')
    ).slice(0, 40);

    await setDoc(doc(db, 'officer_memberships', newOfficerUid), {
      officerUid: newOfficerUid,
      teacherUid: user.uid,
      workspaceId: classWorkspaceId,
      schoolName: (classConfig.schoolName || 'Trường THPT').slice(0, 200),
      className: (classConfig.className || 'Lớp').slice(0, 50),
      schoolYear: (classConfig.schoolYear || '2026–2027').slice(0, 50),
      teacherName: (classConfig.teacherName || user.displayName || 'GVCN').slice(0, 120),
      studentCode: account.studentCode,
      ...(resolvedStudentId ? { studentId: resolvedStudentId } : {}),
      ...(resolvedMoetCode ? { moetCode: resolvedMoetCode } : {}),
      studentName: account.studentName,
      nickname: account.nickname,
      nicknameId: account.nicknameId,
      roles: account.roles,
      assignedTeam: account.assignedTeam,
      allowDirectClassAttendance: Boolean(account.allowDirectClassAttendance),
      active: account.active,
      permissionStatus: account.permissionStatus || (account.active ? 'active' : 'locked'),
      securityLockReason: account.securityLockReason || '',
      mustChangePassword: Boolean(mustChangePassword),
      credentialVersion: nextVersion,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await updateDoc(doc(db, 'officer_directory', account.nicknameId), {
      authEmail: nextAuthEmail,
      active: account.active,
      credentialVersion: nextVersion,
      updatedAt: serverTimestamp(),
    });

    await updateDoc(
      doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'officer_accounts', account.studentCode),
      {
        officerUid: newOfficerUid,
        authEmail: nextAuthEmail,
        mustChangePassword: Boolean(mustChangePassword),
        credentialVersion: nextVersion,
        updatedAt: serverTimestamp(),
      }
    );

    // Cập nhật officerUid mới trên bảng role_assignments nếu tài khoản này đang giữ vị trí chính thức
    for (const ra of roleAssignments) {
      if (ra.officerUid === account.officerUid || (resolvedStudentId && ra.studentId === resolvedStudentId)) {
        await updateDoc(
          doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'role_assignments', ra.roleId),
          {
            officerUid: newOfficerUid,
            nickname: account.nickname,
            updatedAt: serverTimestamp(),
          }
        ).catch(() => {});
      }
    }

    if (account.officerUid && account.officerUid !== newOfficerUid) {
      await updateDoc(doc(db, 'officer_memberships', account.officerUid), {
        active: false,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }

    await appendPermissionAuditLog({
      action: 'Đặt lại mật khẩu',
      nickname: account.nickname,
      studentCode: account.studentCode,
      studentName: account.studentName,
      details: `GVCN cấp lại mật khẩu mới (phiên v${nextVersion}, vô hiệu hóa mật khẩu cũ).`,
    });

    showToast(`Đã đặt lại mật khẩu mới cho ${account.nickname} (phiên v${nextVersion})!`);
    return { nickname: account.nickname, password: newPassword };
  };

  const handleBatchResetPasswords = async (
    accounts: OfficerAccountRecord[],
    newPassword: string,
    mustChangePassword: boolean
  ): Promise<{ succeeded: string[]; failed: { nickname: string; error: string }[] }> => {
    const succeeded: string[] = [];
    const failed: { nickname: string; error: string }[] = [];
    for (const acc of accounts) {
      try {
        await handleResetOfficerPassword(acc, newPassword, mustChangePassword);
        succeeded.push(acc.nickname);
      } catch (err) {
        failed.push({
          nickname: acc.nickname,
          error: err instanceof Error ? err.message : 'Lỗi không xác định',
        });
      }
    }
    return { succeeded, failed };
  };

  const handleDeleteOfficerAccount = async (account: OfficerAccountRecord) => {
    if (!user || sessionKind !== 'teacher' || activeRoleId !== 'gvcn' || !classWorkspaceId) return;
    await deleteDoc(doc(db, 'officer_directory', account.nicknameId)).catch(() => {});
    await deleteDoc(doc(db, 'officer_memberships', account.officerUid)).catch(() => {});
    await deleteDoc(
      doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'officer_accounts', account.studentCode)
    );
    await appendPermissionAuditLog({
      action: 'Thu hồi & xóa tài khoản',
      nickname: account.nickname,
      studentCode: account.studentCode,
      studentName: account.studentName,
      details: `Thu hồi toàn bộ quyền và xóa tài khoản ${account.nickname} của ${account.studentName}.`,
    });
    showToast(`Đã thu hồi và xóa tài khoản ${account.nickname}.`);
  };

  // Tạm khóa quyền có ghi lý do (bảo mật hoặc tạm nghỉ) — không xóa tài khoản hay hồ sơ học sinh
  const handleLockOfficerWithReason = async (account: OfficerAccountRecord, reason: string) => {
    if (!user || sessionKind !== 'teacher' || activeRoleId !== 'gvcn' || !classWorkspaceId) {
      throw new Error('Chỉ GVCN mới có quyền tạm khóa tài khoản cán bộ lớp.');
    }
    const cleanReason = reason.trim().slice(0, 300);
    await updateDoc(doc(db, 'officer_directory', account.nicknameId), {
      active: false,
      updatedAt: serverTimestamp(),
    }).catch(() => {});
    await updateDoc(doc(db, 'officer_memberships', account.officerUid), {
      active: false,
      permissionStatus: 'locked',
      securityLockReason: cleanReason,
      updatedAt: serverTimestamp(),
    }).catch(() => {});
    await updateDoc(
      doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'officer_accounts', account.studentCode),
      {
        active: false,
        permissionStatus: 'locked',
        securityLockReason: cleanReason,
        updatedAt: serverTimestamp(),
      }
    );
    for (const ra of roleAssignments) {
      if (
        ra.officerUid === account.officerUid ||
        (account.studentId && ra.studentId === account.studentId)
      ) {
        await updateDoc(
          doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'role_assignments', ra.roleId),
          {
            status: 'locked',
            updatedAt: serverTimestamp(),
          }
        ).catch(() => {});
      }
    }
    await appendPermissionAuditLog({
      action: cleanReason ? 'Khóa bảo mật tài khoản' : 'Tạm khóa quyền tài khoản',
      nickname: account.nickname,
      studentCode: account.studentCode,
      studentName: account.studentName,
      details: cleanReason
        ? `GVCN tạm khóa quyền ${account.nickname} với lý do bảo mật: ${cleanReason}.`
        : `GVCN tạm khóa quyền đăng nhập của ${account.nickname}.`,
    });
    showToast(`Đã tạm khóa quyền tài khoản ${account.nickname}.`);
  };

  // Thu hồi chức vụ (ngắt quyền ngay, lưu role_assignment_history bất biến, không xóa hồ sơ HS)
  const handleRevokeOfficerPosition = async (account: OfficerAccountRecord, reason?: string) => {
    if (!user || sessionKind !== 'teacher' || activeRoleId !== 'gvcn' || !classWorkspaceId) {
      throw new Error('Chỉ GVCN mới có quyền thu hồi chức vụ cán bộ lớp.');
    }
    const cleanReason = (reason || 'GVCN thu hồi chức vụ cán bộ lớp').slice(0, 300);
    await updateDoc(doc(db, 'officer_directory', account.nicknameId), {
      active: false,
      updatedAt: serverTimestamp(),
    }).catch(() => {});
    await updateDoc(doc(db, 'officer_memberships', account.officerUid), {
      active: false,
      permissionStatus: 'revoked',
      updatedAt: serverTimestamp(),
    }).catch(() => {});
    await updateDoc(
      doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'officer_accounts', account.studentCode),
      {
        active: false,
        permissionStatus: 'revoked',
        updatedAt: serverTimestamp(),
      }
    );

    const nowMs = Date.now();
    for (const ra of roleAssignments) {
      if (
        ra.officerUid === account.officerUid ||
        (account.studentId && ra.studentId === account.studentId) ||
        ra.studentCode === account.studentCode
      ) {
        await updateDoc(
          doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'role_assignments', ra.roleId),
          {
            status: 'revoked',
            updatedAt: serverTimestamp(),
          }
        ).catch(() => {});
        await addDoc(
          collection(
            db,
            'users',
            user.uid,
            'workspaces',
            classWorkspaceId,
            'role_assignment_history'
          ),
          {
            ownerUid: user.uid,
            roleId: ra.roleId,
            previousStudentId: ra.studentId.slice(0, 40),
            previousStudentName: ra.studentName.slice(0, 150),
            newStudentId: '',
            newStudentName: '',
            reason: cleanReason.slice(0, 400),
            changedByEmail: (user.email || 'gvcn@local').slice(0, 200),
            changedAtMs: nowMs,
            createdAt: serverTimestamp(),
          }
        ).catch(() => {});
      }
    }

    await appendPermissionAuditLog({
      action: 'Thu hồi chức vụ',
      nickname: account.nickname,
      studentCode: account.studentCode,
      studentName: account.studentName,
      details: `${cleanReason}. Đã ngắt quyền tức thì trên officer_directory và officer_memberships.`,
    });
    showToast(`Đã thu hồi chức vụ & ngắt quyền tức thì của ${account.nickname}.`);
  };

  // Liên kết lại tài khoản hiện có (mã cũ HSxxx → hồ sơ MOET mới) CHO CÙNG 1 HỌC SINH — giữ nguyên Firebase UID
  const handleRelinkExistingOfficerAccount = async (
    account: OfficerAccountRecord,
    targetStudent: StudentRecord,
    roles: OfficerRoleId[]
  ) => {
    if (!user || sessionKind !== 'teacher' || activeRoleId !== 'gvcn' || !classWorkspaceId) {
      throw new Error('Chỉ GVCN mới có quyền liên kết lại tài khoản cán bộ lớp.');
    }
    if (normalizeNameKey(account.studentName) !== normalizeNameKey(targetStudent.fullName)) {
      throw new Error(
        `Từ chối liên kết: Tài khoản ${account.nickname} thuộc về "${account.studentName}", KHÔNG được phép chuyển UID sang học sinh khác "${targetStudent.fullName}".`
      );
    }
    const validRoles = Array.from(new Set(roles.filter((r) => isValidOfficerRoleId(r)))).slice(0, 2);
    const nextRoles = validRoles.length > 0 ? validRoles : account.roles;
    const assignedTeam = getTeamFromOfficerRoles(nextRoles);
    const studentMoet = getStudentMoetCode(targetStudent);

    await updateDoc(
      doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'officer_accounts', account.studentCode),
      {
        studentId: targetStudent.id.slice(0, 40),
        moetCode: studentMoet.slice(0, 40),
        studentName: targetStudent.fullName.slice(0, 150),
        team: Number(targetStudent.team) || 1,
        roles: nextRoles,
        assignedTeam,
        updatedAt: serverTimestamp(),
      }
    );
    await updateDoc(doc(db, 'officer_memberships', account.officerUid), {
      studentId: targetStudent.id.slice(0, 40),
      moetCode: studentMoet.slice(0, 40),
      studentName: targetStudent.fullName.slice(0, 150),
      roles: nextRoles,
      assignedTeam,
      updatedAt: serverTimestamp(),
    }).catch(() => {});

    for (const r of nextRoles) {
      const ra = roleAssignments.find((x) => x.roleId === r && x.studentId === targetStudent.id);
      if (ra) {
        await updateDoc(
          doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'role_assignments', r),
          {
            officerUid: account.officerUid,
            nickname: account.nickname,
            updatedAt: serverTimestamp(),
          }
        ).catch(() => {});
      }
    }

    await appendPermissionAuditLog({
      action: 'Liên kết lại tài khoản hiện có (giữ UID)',
      nickname: account.nickname,
      studentCode: targetStudent.code,
      studentName: targetStudent.fullName,
      details: `Liên kết tài khoản ${account.nickname} (UID ${account.officerUid.slice(0, 8)}..., mã cũ ${account.studentCode}) với học sinh ${targetStudent.fullName} (Mã MOET: ${studentMoet || targetStudent.code}).`,
    });
    showToast(`Đã liên kết tài khoản ${account.nickname} với ${targetStudent.fullName} (giữ nguyên UID)!`);
  };

  // GIAI ĐOẠN 2 (chỉ chạy khi GVCN bấm xác nhận trong OfficerReconciliationModal):
  // Chốt giao dịch duy nhất 7 vị trí chính thức vào role_assignments/{roleId} + lưu role_assignment_history + đồng bộ students.roles (KHÔNG đụng rosterOrder, moetCode, team, PII, điểm)
  const handleConfirmOfficialRoleAssignments = async (payload: {
    selections: Record<OfficerRoleId, string>;
    acknowledgedTeamMismatches: Partial<Record<OfficerRoleId, boolean>>;
    revokeStaleAccountIds: string[];
  }) => {
    if (!user || sessionKind !== 'teacher' || activeRoleId !== 'gvcn' || !classWorkspaceId) {
      throw new Error('Chỉ GVCN mới có quyền chốt phân công chính thức 7 vị trí cán bộ lớp.');
    }

    const validation = validateOfficerReconciliationDraft({
      selections: payload.selections,
      acknowledgedTeamMismatches: payload.acknowledgedTeamMismatches,
      students,
      analyzedAccounts: officerGovernance.analyzedAccounts,
    });
    if (!validation.valid) {
      throw new Error(validation.blockingErrors.join(' '));
    }

    const nowMs = Date.now();
    const actorEmail = (user.email || 'gvcn@local').slice(0, 200);
    const wsRefSegments = ['users', user.uid, 'workspaces', classWorkspaceId] as const;

    // 1. Atomic Firestore transaction bảo đảm mỗi chức vụ chỉ có ĐÚNG 1 role_assignments/{roleId}
    const historyPayloads: Array<Omit<RoleAssignmentHistoryRecord, 'id' | 'createdAt'>> = [];

    await runTransaction(db, async (tx) => {
      const existingByRole = new Map<OfficerRoleId, RoleAssignmentRecord | null>();
      for (const roleId of VALID_CLASS_OFFICER_ROLES) {
        const raRef = doc(db, ...wsRefSegments, 'role_assignments', roleId);
        const snap = await tx.get(raRef);
        existingByRole.set(
          roleId,
          snap.exists()
            ? ({
                ...(snap.data() as Omit<RoleAssignmentRecord, 'id'>),
                id: roleId,
              } satisfies RoleAssignmentRecord)
            : null
        );
      }

      for (const roleId of VALID_CLASS_OFFICER_ROLES) {
        const studentId = payload.selections[roleId];
        const st = students.find((s) => s.id === studentId);
        if (!st) {
          throw new Error(`Không tìm thấy học sinh cho vị trí ${ROLE_ID_TO_LABEL[roleId]}.`);
        }
        const previewRow = validation.previewRows.find((r) => r.roleId === roleId);
        const matchedAcc = previewRow?.matchedAccount?.account || null;
        const matchedAnalyzed = previewRow?.matchedAccount || null;
        const prev = existingByRole.get(roleId) || null;
        const studentMoet = getStudentMoetCode(st);

        let nextStatus: RoleAssignmentRecord['status'] = 'assigned_no_account';
        if (matchedAcc && matchedAnalyzed) {
          if (matchedAnalyzed.securityLockReason) nextStatus = 'locked';
          else if (matchedAcc.active && matchedAnalyzed.liveMembership?.active !== false) nextStatus = 'active';
          else nextStatus = 'has_account_pending_activation';
        }

        const raRef = doc(db, ...wsRefSegments, 'role_assignments', roleId);
        tx.set(raRef, {
          ownerUid: user.uid,
          roleId,
          studentId: st.id.slice(0, 40),
          studentCode: st.code.slice(0, 40),
          moetCode: studentMoet.slice(0, 40),
          studentName: st.fullName.slice(0, 150),
          team: Number(st.team) || 1,
          officerUid: matchedAcc ? matchedAcc.officerUid.slice(0, 128) : '',
          nickname: matchedAcc ? matchedAcc.nickname.slice(0, 40) : '',
          status: nextStatus,
          teamMismatchAcknowledged: Boolean(payload.acknowledgedTeamMismatches[roleId]),
          confirmedByEmail: actorEmail,
          confirmedAtMs: nowMs,
          createdAt: prev?.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const changedHolder = !prev || prev.studentId !== st.id;
        if (changedHolder) {
          historyPayloads.push({
            ownerUid: user.uid,
            roleId,
            previousStudentId: (prev?.studentId || '').slice(0, 40),
            previousStudentName: (prev?.studentName || '').slice(0, 150),
            newStudentId: st.id.slice(0, 40),
            newStudentName: st.fullName.slice(0, 150),
            reason: (
              prev
                ? `GVCN rà soát & đồng bộ xử lý phân công trùng (${prev.studentName} → ${st.fullName})`
                : `GVCN xác nhận phân công chính thức vị trí ${ROLE_ID_TO_LABEL[roleId]}`
            ).slice(0, 400),
            changedByEmail: actorEmail,
            changedAtMs: nowMs,
          });
        }
      }
    });

    // 2. Ghi bản ghi lịch sử bất biến (role_assignment_history)
    for (const h of historyPayloads) {
      await addDoc(collection(db, ...wsRefSegments, 'role_assignment_history'), {
        ...h,
        createdAt: serverTimestamp(),
      }).catch(() => {});
    }

    // 3. Đồng bộ CHỈ các trường chức vụ (role, secondRole, roles) trên students/{id} — TUYỆT ĐỐI KHÔNG đụng rosterOrder, moetCode, code, team, PII, điểm
    const studentBatch = writeBatch(db);
    let updatedStudentsCount = 0;
    for (const diff of validation.studentRoleDiffs) {
      const legacy = studentRolesToLegacyFields(diff.newRoles);
      const stRef = doc(db, ...wsRefSegments, 'students', diff.student.id);
      studentBatch.update(stRef, {
        role: legacy.role,
        secondRole: legacy.secondRole,
        roles: legacy.roles,
        updatedAt: serverTimestamp(),
      });
      updatedStudentsCount += 1;
    }
    if (updatedStudentsCount > 0) {
      await studentBatch.commit();
    }

    // 4. Cập nhật vai trò trên các tài khoản ĐÚNG HỌC SINH (KHÔNG đổi UID, KHÔNG tự mở tài khoản bị khóa)
    const syncedAccountCodes = new Set<string>();
    for (const row of validation.previewRows) {
      const matched = row.matchedAccount;
      const st = row.selectedStudent;
      if (!matched || !st || syncedAccountCodes.has(matched.account.studentCode)) continue;
      syncedAccountCodes.add(matched.account.studentCode);

      const officialRolesForStudent = validation.rolesByStudentId[st.id] || [];
      if (officialRolesForStudent.length === 0) continue;
      const assignedTeam = getTeamFromOfficerRoles(officialRolesForStudent);
      const studentMoet = getStudentMoetCode(st);
      const allowDirect = officialRolesForStudent.includes('lop_truong')
        ? Boolean(matched.account.allowDirectClassAttendance)
        : false;

      await updateDoc(
        doc(db, ...wsRefSegments, 'officer_accounts', matched.account.studentCode),
        {
          studentId: st.id.slice(0, 40),
          moetCode: studentMoet.slice(0, 40),
          studentName: st.fullName.slice(0, 150),
          team: Number(st.team) || 1,
          roles: officialRolesForStudent,
          assignedTeam,
          allowDirectClassAttendance: allowDirect,
          updatedAt: serverTimestamp(),
        }
      ).catch(() => {});

      await updateDoc(doc(db, 'officer_memberships', matched.account.officerUid), {
        studentId: st.id.slice(0, 40),
        moetCode: studentMoet.slice(0, 40),
        studentName: st.fullName.slice(0, 150),
        roles: officialRolesForStudent,
        assignedTeam,
        allowDirectClassAttendance: allowDirect,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }

    // 5. Chỉ thu hồi các tài khoản cũ/lệch mà GVCN ĐÃ TÍCH CHỌN rõ ràng
    let revokedStaleCount = 0;
    for (const staleCode of payload.revokeStaleAccountIds) {
      const acc = officerAccounts.find((a) => a.studentCode === staleCode);
      if (!acc) continue;
      await handleRevokeOfficerPosition(
        acc,
        'GVCN xác nhận thu hồi tài khoản cũ không còn giữ chức vụ khi rà soát 7 vị trí'
      );
      revokedStaleCount += 1;
    }

    await appendPermissionAuditLog({
      action: 'Chốt phân công chính thức 7 vị trí cán bộ',
      nickname: '7-vi-tri',
      studentCode: classConfig.className || 'class',
      studentName: `${updatedStudentsCount} hồ sơ cập nhật chức vụ`,
      details: `GVCN xác nhận 7 vị trí duy nhất qua giao dịch Firestore (role_assignments), giữ nguyên STT/Mã MOET/Tổ/PII/điểm số. Thu hồi ${revokedStaleCount} tài khoản cũ được chọn.`,
    });

    showToast(
      `Đã chốt chính thức 7/7 vị trí cán bộ lớp (${updatedStudentsCount} hồ sơ đồng bộ chức vụ, giữ nguyên 100% STT & Mã MOET)!`
    );
  };

  // Kiểm tra 8 bước (client + backend /api/officer/verify-activation + server Firestore read) rồi kích hoạt quyền cho 1 vị trí
  const handleActivateOfficerPosition = async (payload: {
    roleId: OfficerRoleId;
    securityLockVerifiedByGvcn?: boolean;
  }): Promise<{ ok: boolean; message: string }> => {
    if (!user || sessionKind !== 'teacher' || activeRoleId !== 'gvcn' || !classWorkspaceId) {
      return { ok: false, message: 'Chỉ GVCN mới có quyền kích hoạt tài khoản cán bộ lớp.' };
    }

    const pos = officerGovernance.positions.find((p) => p.roleId === payload.roleId);
    const assignment = pos?.confirmedAssignment || null;
    const student = pos?.officialStudent || null;
    const analyzedAcc = pos?.officialAccount || null;
    const account = analyzedAcc?.account || null;

    const clientCheck = evaluateEightPointActivationCheck({
      roleId: payload.roleId,
      assignment,
      student,
      account,
      liveMembership: analyzedAcc?.liveMembership || null,
      allStudents: students,
      securityLockVerifiedByGvcn: Boolean(payload.securityLockVerifiedByGvcn),
    });

    if (!clientCheck.eligible || !student || !account || !assignment) {
      return {
        ok: false,
        message: clientCheck.blockingReason || 'Chưa đạt đủ 8 điều kiện kích hoạt quyền.',
      };
    }

    // Xác minh phía backend (Zero-IAM sử dụng Bearer ID token thật của GVCN + Firestore REST)
    const backendVerification = await verifyOfficerActivationOnBackend({
      workspaceId: classWorkspaceId,
      roleId: payload.roleId,
      studentId: student.id,
      accountDocId: account.studentCode,
      officerUid: account.officerUid,
      nicknameId: account.nicknameId,
      securityLockVerifiedByGvcn: Boolean(payload.securityLockVerifiedByGvcn),
    });

    if (!backendVerification.ok || !backendVerification.eligible) {
      return {
        ok: false,
        message:
          backendVerification.blockingReason ||
          'Xác minh máy chủ không đạt điều kiện kích hoạt.',
      };
    }

    // Đọc trực tiếp từ server Firestore để xác nhận officer_memberships/{uid} tồn tại thật
    const liveMemSnap = await getDocFromServer(doc(db, 'officer_memberships', account.officerUid));
    if (!liveMemSnap.exists()) {
      return {
        ok: false,
        message: `Không tìm thấy hồ sơ officer_memberships/${account.officerUid} trên Firestore. Hãy tạo lại hoặc đặt lại mật khẩu cho ${account.nickname}.`,
      };
    }

    // Tổng hợp tất cả vai trò chính thức của học sinh này (hỗ trợ kiêm nhiệm tối đa 2 vị trí)
    const confirmedRolesForStudent = Array.from(
      new Set(
        roleAssignments
          .filter((ra) => ra.studentId === student.id && ra.status !== 'revoked')
          .map((ra) => ra.roleId)
      )
    );
    if (!confirmedRolesForStudent.includes(payload.roleId)) {
      confirmedRolesForStudent.push(payload.roleId);
    }
    const finalRoles = confirmedRolesForStudent.slice(0, 2);
    const assignedTeam = getTeamFromOfficerRoles(finalRoles);
    const studentMoet = getStudentMoetCode(student);
    const allowDirect = finalRoles.includes('lop_truong')
      ? Boolean(account.allowDirectClassAttendance)
      : false;

    await updateDoc(doc(db, 'officer_directory', account.nicknameId), {
      active: true,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'officer_memberships', account.officerUid), {
      active: true,
      permissionStatus: 'active',
      securityLockReason: '',
      studentId: student.id.slice(0, 40),
      moetCode: studentMoet.slice(0, 40),
      studentName: student.fullName.slice(0, 150),
      roles: finalRoles,
      assignedTeam,
      allowDirectClassAttendance: allowDirect,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(
      doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'officer_accounts', account.studentCode),
      {
        active: true,
        permissionStatus: 'active',
        securityLockReason: '',
        studentId: student.id.slice(0, 40),
        moetCode: studentMoet.slice(0, 40),
        studentName: student.fullName.slice(0, 150),
        team: Number(student.team) || 1,
        roles: finalRoles,
        assignedTeam,
        allowDirectClassAttendance: allowDirect,
        updatedAt: serverTimestamp(),
      }
    );

    for (const r of finalRoles) {
      await updateDoc(
        doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'role_assignments', r),
        {
          officerUid: account.officerUid,
          nickname: account.nickname,
          status: 'active',
          updatedAt: serverTimestamp(),
        }
      ).catch(() => {});
    }

    await appendPermissionAuditLog({
      action: 'Kích hoạt quyền cán bộ lớp (đạt 8/8 kiểm tra)',
      nickname: account.nickname,
      studentCode: student.code,
      studentName: student.fullName,
      details: `Kích hoạt quyền ${finalRoles.map((r) => ROLE_ID_TO_LABEL[r]).join(' + ')} cho ${student.fullName} (Mã MOET: ${studentMoet || student.code}) sau khi xác minh client + máy chủ.${
        payload.securityLockVerifiedByGvcn ? ' (GVCN đã xác minh mở khóa bảo mật).' : ''
      }`,
    });

    showToast(`Đã kích hoạt quyền thành công cho ${ROLE_ID_TO_LABEL[payload.roleId]} (${account.nickname})!`);
    return {
      ok: true,
      message: `Đã kích hoạt quyền ${ROLE_ID_TO_LABEL[payload.roleId]} cho ${student.fullName} (${account.nickname}).`,
    };
  };

  // Kích hoạt lần lượt 7 vị trí chính thức (chỉ mở khi đủ 7/7 đã xác nhận và 0 vị trí trùng)
  const handleActivateAllSevenPositions = async (payload: {
    verifiedSecurityLockAccountIds: string[];
  }): Promise<BatchActivationPositionResult[]> => {
    if (
      officerGovernance.confirmedPositionsCount < 7 ||
      officerGovernance.duplicatePositionsCount > 0
    ) {
      throw new Error(
        'Chỉ được kích hoạt 7 vị trí khi đã xác nhận đủ 7/7 chức vụ chính thức và còn 0 vị trí trùng.'
      );
    }

    const verifiedSet = new Set(payload.verifiedSecurityLockAccountIds);
    const results: BatchActivationPositionResult[] = [];

    for (const pos of officerGovernance.positions) {
      const stName = pos.officialStudent?.fullName || 'Chưa xác định';
      const nick = pos.officialAccount?.account.nickname || '—';

      if (pos.permissionStatus === 'active' && pos.officialAccount?.account.active) {
        results.push({
          roleId: pos.roleId,
          roleLabel: pos.label,
          studentName: stName,
          nickname: nick,
          status: 'already_active',
          message: 'Đã đang hoạt động chuẩn xác.',
        });
        continue;
      }

      const accId = pos.officialAccount?.account.studentCode || '';
      const res = await handleActivateOfficerPosition({
        roleId: pos.roleId,
        securityLockVerifiedByGvcn: verifiedSet.has(accId),
      });
      results.push({
        roleId: pos.roleId,
        roleLabel: pos.label,
        studentName: stName,
        nickname: nick,
        status: res.ok ? 'activated' : 'blocked',
        message: res.message,
      });
    }

    return results;
  };

  const handleOfficerPasswordChanged = async () => {
    if (!user || sessionKind !== 'officer') return;
    if (officerMembership?.mustChangePassword) {
      await updateDoc(doc(db, 'officer_memberships', user.uid), {
        mustChangePassword: false,
        updatedAt: serverTimestamp(),
      });
    }
    showToast('Đã đổi mật khẩu Cán bộ lớp thành công!');
  };

  // Lớp trưởng gửi báo cáo tổng hợp chuyên cần trong ngày (luôn ở trạng thái chờ GVCN duyệt)
  const handleSubmitMonitorAttendanceSummary = async (payload: {
    date: string;
    session: 'Sáng' | 'Chiều';
    totalStudents: number;
    presentCount: number;
    excusedCount: number;
    unexcusedCount: number;
    lateCount: number;
    unverifiedCount: number;
    issuesForTeacher: string;
  }) => {
    if (!user || !isRealMonitor || !officerMembership) {
      throw new Error('Chỉ tài khoản Lớp trưởng đã xác thực mới có thể gửi báo cáo tổng hợp chuyên cần.');
    }
    const targetOwnerUid = officerMembership.teacherUid;
    const targetWsId = officerMembership.workspaceId;
    const submitterTitle =
      `Lớp trưởng (${officerMembership.studentName} - ${officerMembership.nickname})`.slice(0, 100);
    const summaryParts = [
      `Buổi ${payload.session} — Sĩ số: ${payload.presentCount}/${payload.totalStudents}`,
      `Vắng CP: ${payload.excusedCount}`,
      `Vắng KP: ${payload.unexcusedCount}`,
      `Đi muộn: ${payload.lateCount}`,
      `Chưa xác minh: ${payload.unverifiedCount}`,
    ];
    if (payload.issuesForTeacher.trim()) {
      summaryParts.push(`Đề xuất / Lưu ý GVCN: ${payload.issuesForTeacher.trim()}`);
    }
    await addDoc(collection(db, 'users', targetOwnerUid, 'workspaces', targetWsId, 'tickets'), {
      ownerUid: targetOwnerUid,
      type: 'diem_danh',
      typeLabel: TICKET_TYPES.diem_danh.label,
      studentId: null,
      studentName: `Tổng hợp chuyên cần lớp ${classConfig.className}`.slice(0, 150),
      category: `Báo cáo tổng hợp chuyên cần (${payload.session})`.slice(0, 100),
      date: payload.date,
      description: summaryParts.join(' | ').slice(0, 2000),
      submittedByRole: 'lop_truong',
      submittedByTitle: submitterTitle,
      submittedByUid: user.uid,
      status: 'pending',
      version: 1,
      createdAtMs: Date.now(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    showToast('Đã gửi báo cáo tổng hợp chuyên cần vào Trung tâm kiểm duyệt của GVCN!');
  };

  // Lớp trưởng gửi báo cáo tình hình lớp (nề nếp / học tập tập thể / đề xuất GVCN)
  const handleSubmitMonitorClassReport = async (payload: {
    date: string;
    weekLabel: string;
    generalSituation: string;
    studyAndDiscipline: string;
    upcomingTasks: string;
    positiveHighlights: string;
    teacherSupportProposals: string;
  }) => {
    if (!user || !isRealMonitor || !officerMembership) {
      throw new Error('Chỉ tài khoản Lớp trưởng đã xác thực mới có thể gửi báo cáo tình hình lớp.');
    }
    const targetOwnerUid = officerMembership.teacherUid;
    const targetWsId = officerMembership.workspaceId;
    const submitterTitle =
      `Lớp trưởng (${officerMembership.studentName} - ${officerMembership.nickname})`.slice(0, 100);

    const sections: string[] = [];
    if (payload.weekLabel.trim()) sections.push(`[${payload.weekLabel.trim()}]`);
    sections.push(`1. Tình hình chung: ${payload.generalSituation}`);
    if (payload.studyAndDiscipline) sections.push(`2. Học tập & nề nếp tập thể: ${payload.studyAndDiscipline}`);
    if (payload.upcomingTasks) sections.push(`3. Công việc lớp cần làm: ${payload.upcomingTasks}`);
    if (payload.positiveHighlights) sections.push(`4. Việc tích cực: ${payload.positiveHighlights}`);
    if (payload.teacherSupportProposals) sections.push(`5. Đề xuất GVCN hỗ trợ: ${payload.teacherSupportProposals}`);

    await addDoc(collection(db, 'users', targetOwnerUid, 'workspaces', targetWsId, 'tickets'), {
      ownerUid: targetOwnerUid,
      type: 'ne_nep',
      typeLabel: 'Báo cáo tình hình lớp (Lớp trưởng)',
      studentId: null,
      studentName: `Tập thể lớp ${classConfig.className}`.slice(0, 150),
      category: `Báo cáo tình hình lớp${payload.weekLabel ? ` (${payload.weekLabel})` : ''}`.slice(0, 100),
      date: payload.date,
      description: sections.join('\n').slice(0, 2000),
      submittedByRole: 'lop_truong',
      submittedByTitle: submitterTitle,
      submittedByUid: user.uid,
      status: 'pending',
      version: 1,
      createdAtMs: Date.now(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    showToast('Đã gửi báo cáo tình hình lớp vào Trung tâm kiểm duyệt của GVCN!');
  };

  // Cán bộ lớp chỉnh sửa & gửi lại phiếu đang ở trạng thái GVCN yêu cầu sửa (needs_revision -> pending)
  const handleResubmitRevisedTicket = async (
    ticket: TicketRecord,
    updates: { category: string; date: string; description: string }
  ) => {
    if (!user || sessionKind !== 'officer' || !officerMembership?.active) {
      throw new Error('Phiên đăng nhập Cán bộ lớp không hợp lệ.');
    }
    if (ticket.submittedByUid !== user.uid || ticket.status !== 'needs_revision') {
      throw new Error('Chỉ được chỉnh sửa phiếu do chính bạn gửi khi GVCN yêu cầu bổ sung.');
    }
    const ticketRef = doc(
      db,
      'users',
      officerMembership.teacherUid,
      'workspaces',
      officerMembership.workspaceId,
      'tickets',
      ticket.id
    );
    await updateDoc(ticketRef, {
      category: updates.category.slice(0, 150),
      date: updates.date.slice(0, 30),
      description: updates.description.slice(0, 2000),
      status: 'pending',
      version: (Number(ticket.version) || 1) + 1,
      updatedAt: serverTimestamp(),
    });
    showToast('Đã cập nhật nội dung bổ sung và gửi lại phiếu cho GVCN duyệt!');
  };

  const bulkImportAnalysis = useMemo(
    () => reconcileStudentImportRows(bulkParsedRows, students, studentPiiMap, bulkResolutions),
    [bulkParsedRows, students, studentPiiMap, bulkResolutions]
  );

  const bulkColumnMappingWarnings = useMemo(
    () => detectColumnMappingWarnings(bulkDataRows, bulkColumnMapping, bulkHeaders),
    [bulkDataRows, bulkColumnMapping, bulkHeaders]
  );

  const applyBulkMatrix = (matrix: string[][]) => {
    const detected = detectStudentHeaderAndMapping(matrix);
    setBulkHeaderRowIndex(detected.headerRowIndex);
    setBulkHeaders(detected.headers);
    setBulkDataRows(detected.dataRows);
    setBulkColumnMapping(detected.mapping);
    setBulkResolutions({});
    const parsed = buildParsedStudentRows(detected.dataRows, detected.mapping, detected.headerRowIndex);
    setBulkParsedRows(parsed);
  };

  const handleBulkTextChange = (text: string) => {
    setBulkStudentText(text);
    setBulkWorkbook(null);
    setBulkFileName('');
    setBulkSheetNames([]);
    setBulkSelectedSheet('');
    const matrix = parseDelimitedTextToMatrix(text);
    if (matrix.length === 0) {
      setBulkHeaders([]);
      setBulkDataRows([]);
      setBulkParsedRows([]);
      setBulkResolutions({});
      return;
    }
    applyBulkMatrix(matrix);
  };

  const handleSelectBulkSheet = (sheetName: string) => {
    if (!bulkWorkbook) return;
    setBulkSelectedSheet(sheetName);
    const matrix = extractSheetMatrix(bulkWorkbook, sheetName);
    const textView = matrix.map((r) => r.join('\t')).join('\n');
    setBulkStudentText(textView);
    applyBulkMatrix(matrix);
  };

  const handleChangeBulkMapping = (field: StudentExcelColumnKey, colIndex: number) => {
    const nextMapping: StudentColumnMapping = { ...bulkColumnMapping, [field]: colIndex };
    setBulkColumnMapping(nextMapping);
    const parsed = buildParsedStudentRows(bulkDataRows, nextMapping, bulkHeaderRowIndex);
    setBulkParsedRows(parsed);
  };

  const handleReconcileBulkAgain = () => {
    if (bulkDataRows.length === 0) return;
    const parsed = buildParsedStudentRows(bulkDataRows, bulkColumnMapping, bulkHeaderRowIndex);
    setBulkParsedRows(parsed);
    showToast(`Đã đối chiếu lại ${parsed.length} dòng học sinh theo cấu hình cột hiện tại.`);
  };

  const handleToggleAllRoleProposals = (apply: boolean) => {
    setBulkParsedRows((prev) =>
      prev.map((row) => ({
        ...row,
        applyRoleProposal: row.proposedRoles.length > 0 ? apply : false,
        roleProposalOverride: row.proposedRoles.length > 0 ? apply : undefined,
      }))
    );
  };

  const handleToggleRowRoleProposal = (excelRowNumber: number, apply: boolean) => {
    setBulkParsedRows((prev) =>
      prev.map((row) =>
        row.excelRowNumber === excelRowNumber
          ? { ...row, applyRoleProposal: apply, roleProposalOverride: apply }
          : row
      )
    );
  };

  const handleUpdateRowTeam = (excelRowNumber: number, team: number) => {
    setBulkParsedRows((prev) =>
      prev.map((row) => {
        if (row.excelRowNumber !== excelRowNumber) return row;
        const normalizedTeam = team >= 1 && team <= 4 ? team : 0;
        const nextErrors = row.errors.filter((e) => !e.startsWith('Tổ không hợp lệ'));
        const reparsedRole = parseExcelStudentRoles(row.roleRaw, normalizedTeam);
        const nonTeamRoleWarnings = row.warnings.filter(
          (w) =>
            !w.includes('Chưa phân tổ') &&
            !w.includes('Chức vụ') &&
            !w.includes('Không xác định được số Tổ') &&
            !w.includes('Tổ trưởng') &&
            !w.includes('Ô chức vụ')
        );
        const teamWarnings =
          normalizedTeam === 0
            ? ['Chưa phân tổ (vẫn được nhập, có thể phân tổ sau)']
            : [];
        const nextWarnings = [...nonTeamRoleWarnings, ...teamWarnings, ...reparsedRole.warnings];
        return {
          ...row,
          team: normalizedTeam,
          hasUnassignedTeamWarning: normalizedTeam === 0,
          errors: nextErrors,
          warnings: nextWarnings,
          proposedRoles: reparsedRole.proposedRoles,
          proposedRoleId: reparsedRole.proposedRoleId,
          proposedRoleLabel: reparsedRole.proposedRoleLabel,
          hasAmbiguousRole: reparsedRole.hasAmbiguousValue,
          applyRoleProposal:
            row.roleProposalOverride !== undefined
              ? row.roleProposalOverride
              : reparsedRole.proposedRoles.length > 0 && !reparsedRole.hasAmbiguousValue,
        };
      })
    );
  };

  const handleSetRowResolution = (excelRowNumber: number, action: LegacyResolutionAction) => {
    setBulkResolutions((prev) => ({
      ...prev,
      [excelRowNumber]: action,
    }));
  };

  const handleBulkExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) {
        const buffer = await file.arrayBuffer();
        const { workbook, sheetNames, selectedSheet, matrix } = readStudentWorkbook(buffer);
        setBulkWorkbook(workbook);
        setBulkFileName(file.name);
        setBulkSheetNames(sheetNames);
        setBulkSelectedSheet(selectedSheet);
        setBulkStudentText(matrix.map((r) => r.join('\t')).join('\n'));
        applyBulkMatrix(matrix);
        showToast(
          `Đã đọc sheet "${selectedSheet}" từ tệp "${file.name}". Vui lòng đối chiếu trước khi xác nhận!`
        );
      } else {
        const text = await file.text();
        setBulkWorkbook(null);
        setBulkFileName(file.name);
        setBulkSheetNames([]);
        setBulkSelectedSheet('');
        setBulkStudentText(text);
        const matrix = parseDelimitedTextToMatrix(text);
        applyBulkMatrix(matrix);
        showToast(`Đã đọc tệp "${file.name}". Vui lòng kiểm tra bản đối chiếu!`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không đọc được tệp.';
      showToast('Lỗi đọc tệp danh sách học sinh: ' + msg, 'error');
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveBulkStudents = async () => {
    if (!user || sessionKind !== 'teacher' || activeRoleId !== 'gvcn' || !classWorkspaceId) {
      showToast('Chỉ Giáo viên chủ nhiệm của lớp mới được phép nhập danh sách học sinh.', 'error');
      return;
    }
    if (bulkImportAnalysis.summary.blockingErrorCount > 0) {
      showToast('Vẫn còn lỗi nghiêm trọng cần xử lý trước khi xác nhận nhập.', 'error');
      return;
    }

    const itemsToProcess = bulkImportAnalysis.items.filter((i) => i.resolution.type !== 'skip');
    if (itemsToProcess.length === 0) {
      showToast('Chưa có học sinh nào được chọn để nhập.', 'error');
      return;
    }

    setIsSavingBulkStudents(true);
    let createdCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;

    try {
      for (const item of itemsToProcess) {
        const targetCode = item.matchedExisting ? item.matchedExisting.id : item.moetCode;
        if (!targetCode) continue;

        const stRef = doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'students', targetCode);
        const piiRef = doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'student_pii', targetCode);

        // Chức vụ chuẩn sau đối chiếu: ô trống trong Excel tuyệt đối không xóa chức vụ đã có, và không tự cấp tài khoản đăng nhập
        const roleFields = studentRolesToLegacyFields(item.finalRolesToSave);
        const parsedStt = parsePositiveIntStt(item.stt);
        const normalizedTeam = Number(item.team) >= 1 && Number(item.team) <= 4 ? Number(item.team) : 0;

        // Tuyệt đối không lưu chuỗi giữ chỗ ("Không có", "Chưa có", "N/A") làm tên phụ huynh thật
        const incomingParentName = isMissingPlaceholderValue(item.parentName) ? '' : item.parentName.trim();
        const incomingParentPhone = isMissingPlaceholderValue(item.parentPhone) ? '' : item.parentPhone.trim();

        const stSnap = await getDoc(stRef);
        if (stSnap.exists()) {
          const oldData = stSnap.data() as StudentRecord;
          const oldRoles = getStudentRoles(oldData);
          if (item.status === 'matched') {
            unchangedCount++;
          } else {
            updatedCount++;
          }
          // Giữ nguyên Tổ cũ nếu file nhập lại không có cột Tổ (normalizedTeam === 0) nhưng hồ sơ cũ đã phân tổ
          const teamToSave =
            normalizedTeam >= 1 && normalizedTeam <= 4
              ? normalizedTeam
              : Number(oldData.team) >= 1 && Number(oldData.team) <= 4
                ? Number(oldData.team)
                : 0;

          await updateDoc(stRef, {
            moetCode: item.moetCode,
            fullName: item.fullName,
            gender: item.gender,
            dob: item.dob || oldData.dob || '',
            team: teamToSave,
            role: roleFields.role,
            secondRole: roleFields.secondRole,
            roles: roleFields.roles,
            note: item.matchedExisting?.note || oldData.note || '',
            ...(parsedStt !== null ? { rosterOrder: parsedStt } : {}),
            updatedAt: serverTimestamp(),
          });
          if (!areRoleListsEqual(oldRoles, roleFields.roles)) {
            await appendPermissionAuditLog({
              action: 'Đối chiếu chức vụ từ Excel',
              nickname: 'excel-import',
              studentCode: targetCode,
              studentName: item.fullName,
              details: `Cập nhật chức vụ trong lớp từ "${formatStudentRolesLabel(oldRoles)}" thành "${formatStudentRolesLabel(roleFields.roles)}" (tài khoản đăng nhập không tự động thay đổi).`,
            }).catch(() => {});
          }
        } else {
          createdCount++;
          const initialRosterOrder = parsedStt !== null ? parsedStt : item.rowIndex + 1;
          await setDoc(stRef, {
            ownerUid: user.uid,
            code: targetCode,
            moetCode: item.moetCode,
            fullName: item.fullName,
            gender: item.gender,
            dob: item.dob,
            team: normalizedTeam,
            role: roleFields.role,
            secondRole: roleFields.secondRole,
            roles: roleFields.roles,
            note: '',
            meritPoints: 100,
            attendancePresent: 0,
            attendanceAbsent: 0,
            rosterOrder: initialRosterOrder,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          if (roleFields.roles.length > 0) {
            await appendPermissionAuditLog({
              action: 'Nhập chức vụ học sinh từ Excel',
              nickname: 'excel-import',
              studentCode: targetCode,
              studentName: item.fullName,
              details: `Ghi nhận chức vụ trong lớp từ file Excel: ${formatStudentRolesLabel(roleFields.roles)} (chưa tự tạo tài khoản đăng nhập).`,
            }).catch(() => {});
          }
        }

        // Bảo vệ thông tin phụ huynh đã lưu trước đó: nếu file nhập lại không có tên/SĐT PH thì KHÔNG ghi đè xóa dữ liệu đã có
        const piiSnap = await getDoc(piiRef);
        if (piiSnap.exists()) {
          const existingPii = piiSnap.data() as { parentName?: string; parentPhone?: string };
          const existingCleanName = isMissingPlaceholderValue(existingPii.parentName || '')
            ? ''
            : String(existingPii.parentName || '').trim();
          const existingCleanPhone = isMissingPlaceholderValue(existingPii.parentPhone || '')
            ? ''
            : String(existingPii.parentPhone || '').trim();
          await updateDoc(piiRef, {
            parentName: incomingParentName || existingCleanName,
            parentPhone: incomingParentPhone || existingCleanPhone,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(piiRef, {
            ownerUid: user.uid,
            studentCode: targetCode,
            parentName: incomingParentName,
            parentPhone: incomingParentPhone,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      showToast(
        `Đã xác nhận nhập ${itemsToProcess.length} học sinh vào lớp ${classConfig.className} (${createdCount} mới, ${updatedCount} cập nhật, ${unchangedCount} trùng khớp).`
      );
      setShowBulkStudentModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/workspaces/${classWorkspaceId}/students`);
    } finally {
      setIsSavingBulkStudents(false);
    }
  };

  // Cập nhật an toàn DUY NHẤT trường rosterOrder theo STT Excel (khớp 100% theo Mã MOET, không tạo/xóa HS)
  const handleApplyRosterOrderFromExcel = async (
    analysis: RosterOrderReconciliationAnalysis,
    fileName: string
  ): Promise<boolean> => {
    if (!user || sessionKind !== 'teacher' || activeRoleId !== 'gvcn' || !classWorkspaceId) {
      throw new Error('Chỉ Giáo viên chủ nhiệm của lớp mới được phép cập nhật STT học sinh.');
    }
    if (
      !analysis.canConfirmApply ||
      analysis.expectedClassSize === 0 ||
      analysis.matchedUniqueCount !== students.length ||
      analysis.rows.length !== students.length
    ) {
      throw new Error(
        'Bảng đối chiếu STT chưa đạt điều kiện khớp 100% theo Mã MOET cho toàn bộ học sinh trong lớp.'
      );
    }

    const currentStudentIdSet = new Set(students.map((s) => s.id));
    const seenTargetIds = new Set<string>();
    const validatedRows: Array<{
      studentId: string;
      moetCode: string;
      fullName: string;
      oldRosterOrder: number | null;
      newRosterOrder: number;
    }> = [];

    for (const row of analysis.rows) {
      if (
        !row.matchedStudent ||
        row.newRosterOrder === null ||
        !Number.isInteger(row.newRosterOrder) ||
        row.newRosterOrder < 1 ||
        row.newRosterOrder > students.length
      ) {
        throw new Error(`Dòng ${row.excelRowNumber} có dữ liệu STT hoặc liên kết học sinh không hợp lệ.`);
      }
      if (!currentStudentIdSet.has(row.matchedStudent.id) || seenTargetIds.has(row.matchedStudent.id)) {
        throw new Error(`Phát hiện bất đồng bộ studentId (${row.matchedStudent.id}) trước khi ghi.`);
      }
      seenTargetIds.add(row.matchedStudent.id);
      validatedRows.push({
        studentId: row.matchedStudent.id,
        moetCode: row.moetCode,
        fullName: row.matchedStudent.fullName || row.excelFullName,
        oldRosterOrder: row.currentRosterOrder,
        newRosterOrder: row.newRosterOrder,
      });
    }

    if (seenTargetIds.size !== students.length) {
      throw new Error(
        `Số lượng học sinh đối chiếu (${seenTargetIds.size}) không khớp sĩ số lớp hiện tại (${students.length}).`
      );
    }

    const changedRows = validatedRows.filter((r) => r.oldRosterOrder !== r.newRosterOrder);
    if (changedRows.length === 0) {
      showToast(
        `Thứ tự STT hiện tại của ${students.length} học sinh đã khớp 100% với file Excel — không cần ghi lại.`
      );
      return true;
    }

    setIsApplyingRosterOrder(true);
    try {
      // Ghi nguyên tử bằng writeBatch + batch.update (TUYỆT ĐỐI không dùng setDoc, không sửa bất kỳ trường nào khác)
      const CHUNK_SIZE = 400;
      for (let i = 0; i < changedRows.length; i += CHUNK_SIZE) {
        const chunk = changedRows.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        for (const item of chunk) {
          const stRef = doc(
            db,
            'users',
            user.uid,
            'workspaces',
            classWorkspaceId,
            'students',
            item.studentId
          );
          batch.update(stRef, {
            rosterOrder: item.newRosterOrder,
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      }

      // Xác minh trực tiếp từ Cloud Firestore server sau khi commit — không bao giờ báo thành công nếu lệch dữ liệu
      const studentsColRef = collection(
        db,
        'users',
        user.uid,
        'workspaces',
        classWorkspaceId,
        'students'
      );
      const verifySnap = await getDocsFromServer(studentsColRef);
      if (verifySnap.size !== students.length) {
        throw new Error(
          `Xác minh sau khi lưu phát hiện sĩ số trên máy chủ (${verifySnap.size}) khác sĩ số ban đầu (${students.length}).`
        );
      }

      const serverMap = new Map<string, StudentRecord>();
      verifySnap.docs.forEach((d) => {
        serverMap.set(d.id, {
          id: d.id,
          ...(d.data() as Omit<StudentRecord, 'id'>),
        });
      });

      const mismatchedIds: string[] = [];
      for (const expected of validatedRows) {
        const saved = serverMap.get(expected.studentId);
        if (!saved || Number(saved.rosterOrder) !== expected.newRosterOrder) {
          mismatchedIds.push(expected.moetCode || expected.studentId);
        }
      }
      if (mismatchedIds.length > 0) {
        throw new Error(
          `Xác minh trên Firestore sau khi ghi thất bại tại ${mismatchedIds.length} học sinh (${mismatchedIds.slice(0, 5).join(', ')}). Vui lòng thử lại.`
        );
      }

      const verifiedList = Array.from(serverMap.values()).sort(compareStudentsByRosterOrder);
      setStudents(verifiedList);

      // Ghi nhật ký thay đổi (thời gian, tài khoản GVCN, tổng quan & chi tiết STT cũ -> STT mới)
      const nowStr = new Date().toLocaleString('vi-VN');
      const actorLabel = user.email || user.uid;
      await appendPermissionAuditLog({
        action: 'Cập nhật STT theo Excel',
        nickname: 'roster-order',
        studentCode: 'ALL',
        studentName: `Lớp ${classConfig.className} (${students.length} HS)`,
        details: `GVCN ${actorLabel} cập nhật thành công STT (rosterOrder) cho ${changedRows.length}/${students.length} HS lúc ${nowStr} từ tệp "${fileName || 'Excel'}". Đã xác minh trực tiếp trên Firestore (0 tạo mới, 0 xóa, giữ nguyên toàn bộ hồ sơ).`,
      });

      // Lưu chi tiết từng học sinh thay đổi (STT cũ -> STT mới) thành từng nhóm nhỏ <= 590 ký tự
      const LOG_CHUNK = 12;
      for (let i = 0; i < changedRows.length; i += LOG_CHUNK) {
        const slice = changedRows.slice(i, i + LOG_CHUNK);
        const mappingText = slice
          .map(
            (r) =>
              `${r.moetCode}: ${r.oldRosterOrder === null ? '—' : r.oldRosterOrder}→${r.newRosterOrder}`
          )
          .join('; ');
        await appendPermissionAuditLog({
          action: 'Chi tiết cập nhật STT Excel',
          nickname: 'roster-order',
          studentCode: `${i + 1}-${i + slice.length}`,
          studentName: `Nhóm ${Math.floor(i / LOG_CHUNK) + 1} (${slice.length} HS)`,
          details: `STT cũ→mới: ${mappingText}`.slice(0, 595),
        });
      }

      showToast(
        `Đã cập nhật & xác minh thành công STT theo Excel cho ${changedRows.length}/${students.length} học sinh (giữ nguyên toàn bộ ${students.length} hồ sơ).`
      );
      return true;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể cập nhật STT học sinh lên Firestore. Vui lòng kiểm tra kết nối và quyền GVCN.';
      showToast('Lỗi cập nhật STT theo Excel: ' + msg, 'error');
      throw err instanceof Error ? err : new Error(msg);
    } finally {
      setIsApplyingRosterOrder(false);
    }
  };

  const handleSaveEmulationStandards = async (
    updatedStandards: EmulationStandards,
    updatedBonusRule = teamBonusRule
  ) => {
    if (!user || activeRoleId !== 'gvcn') return;
    try {
      const standardsDocRef = doc(
        db,
        'users',
        user.uid,
        'workspaces',
        classWorkspaceId,
        'emulation_standards',
        'rules'
      );
      const snap = await getDoc(standardsDocRef);
      if (snap.exists()) {
        await updateDoc(standardsDocRef, {
          gradeA: updatedStandards.gradeA,
          gradeB: updatedStandards.gradeB,
          gradeC: updatedStandards.gradeC,
          severeSemesterFail: updatedStandards.severeSemesterFail,
          semesterRules: updatedStandards.semesterRules,
          teamBonusRule: updatedBonusRule,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(standardsDocRef, {
          ownerUid: user.uid,
          ...updatedStandards,
          teamBonusRule: updatedBonusRule,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      showToast('Đã cập nhật Bộ Tiêu chuẩn Thi đua lên Cloud Firestore!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/workspaces/${classWorkspaceId}/emulation_standards/rules`);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!currentRole.allowedTicketTypes.includes(ticketForm.type)) {
      showToast(`Vai trò ${currentRole.title} không có quyền lập loại phiếu này.`, 'error');
      return;
    }

    const isWholeClassAttendance =
      ticketForm.type === 'diem_danh' && !currentRole.team && ticketForm.category !== 'Ghi nhận HS vắng / đi muộn';

    let targetStudent: StudentRecord | null = null;
    if (ticketForm.type !== 'thu_chi' && ticketForm.type !== 'chi_doan' && !isWholeClassAttendance) {
      targetStudent = students.find((s) => s.id === ticketForm.studentId) || null;
      if (!targetStudent) {
        showToast('Vui lòng chọn học sinh liên quan.', 'error');
        return;
      }
      if (currentRole.team && Number(targetStudent.team) !== currentRole.team) {
        showToast(`Tổ trưởng Tổ ${currentRole.team} chỉ được ghi nhận học sinh thuộc Tổ ${currentRole.team}.`, 'error');
        return;
      }
    }

    if (ticketForm.type === 'thu_chi') {
      const cat = ticketForm.category;
      if (cat !== 'Đề xuất quyết toán' && (!ticketForm.amount || Number(ticketForm.amount) <= 0)) {
        showToast('Vui lòng nhập số tiền thu/chi hợp lệ lớn hơn 0.', 'error');
        return;
      }
      if (!ticketForm.description.trim()) {
        showToast('Vui lòng nhập mô tả chứng từ / nội dung thu chi.', 'error');
        return;
      }
    }

    if ((ticketForm.type === 'chi_doan' || isWholeClassAttendance) && !ticketForm.description.trim()) {
      showToast('Vui lòng nhập mô tả chi tiết báo cáo trước khi gửi.', 'error');
      return;
    }

    let categoryLabel = ticketForm.category;
    let criterionText = '';
    let suggestedGrade = '';

    if (ticketForm.type === 'ne_nep') {
      if (!ticketForm.evidence.trim()) {
        showToast('Bắt buộc nhập minh chứng / thời điểm tiết học cụ thể.', 'error');
        return;
      }
      if (ticketForm.emulationGroup === 'gradeA') {
        const c = emulationStandards.gradeA.find((x) => x.id === ticketForm.criterionId);
        criterionText = c ? c.title : '';
        categoryLabel = 'Minh chứng Xếp loại A';
        suggestedGrade = 'A';
      } else if (ticketForm.emulationGroup === 'gradeB') {
        const c1 = emulationStandards.gradeB.find((x) => x.id === ticketForm.criterionId);
        if (c1?.conditional && !ticketForm.remindedBefore) {
          showToast('Tiêu chí này yêu cầu xác nhận đã nhắc nhở 1 lần trước đó.', 'error');
          return;
        }
        if (ticketForm.isSimultaneousB) {
          const c2 = emulationStandards.gradeB.find((x) => x.id === ticketForm.secondCriterionId);
          if (!c2 || c2.id === c1?.id) {
            showToast('Vui lòng chọn tiêu chí nhóm B thứ hai khác với tiêu chí thứ nhất.', 'error');
            return;
          }
          criterionText = `Đồng thời 2 tiêu chí B: (1) ${c1?.text} + (2) ${c2.text}`;
          categoryLabel = 'Gợi ý Xếp loại C (Đồng thời 2 tiêu chí B)';
          suggestedGrade = 'C';
        } else {
          criterionText = c1 ? c1.text : '';
          categoryLabel = 'Vi phạm Tiêu chí B';
          suggestedGrade = 'B';
        }
      } else if (ticketForm.emulationGroup === 'gradeC') {
        const c = emulationStandards.gradeC.find((x) => x.id === ticketForm.criterionId);
        criterionText = c ? c.text : '';
        categoryLabel = 'Vi phạm Tiêu chí C';
        suggestedGrade = 'C';
      } else if (ticketForm.emulationGroup === 'severe') {
        const c = emulationStandards.severeSemesterFail.find((x) => x.id === ticketForm.criterionId);
        criterionText = c ? c.text : '';
        categoryLabel = 'Lỗi nặng Học kỳ (Xem xét Chưa đạt HK)';
        suggestedGrade = 'C';
      }
    }

    const targetOwnerUid =
      sessionKind === 'officer' && officerMembership ? officerMembership.teacherUid : user.uid;
    const targetWsId =
      sessionKind === 'officer' && officerMembership ? officerMembership.workspaceId : classWorkspaceId;
    const submitterTitle =
      sessionKind === 'officer' && officerMembership
        ? `${currentRole.title} (${officerMembership.studentName} - ${officerMembership.nickname})`.slice(0, 100)
        : currentRole.title;

    setIsSubmittingTicket(true);
    try {
      await addDoc(collection(db, 'users', targetOwnerUid, 'workspaces', targetWsId, 'tickets'), {
        ownerUid: targetOwnerUid,
        type: ticketForm.type,
        typeLabel: TICKET_TYPES[ticketForm.type]?.label || 'Phiếu đề xuất',
        studentId: targetStudent ? targetStudent.id : null,
        studentName: targetStudent
          ? `${targetStudent.fullName} (${targetStudent.code} - Tổ ${targetStudent.team})`
          : ticketForm.type === 'thu_chi'
            ? `Quỹ lớp ${classConfig.className}`
            : ticketForm.type === 'diem_danh'
              ? `Toàn lớp ${classConfig.className}`
              : `Chi đoàn ${classConfig.className}`,
        category: categoryLabel,
        emulationGroup: ticketForm.emulationGroup,
        criterionId: ticketForm.criterionId,
        criterionText,
        suggestedGrade,
        evidence: ticketForm.evidence.trim(),
        weekLabel: ticketForm.weekLabel,
        amount: ticketForm.type === 'thu_chi' ? Number(ticketForm.amount || 0) : 0,
        date: ticketForm.date,
        description: ticketForm.description.trim() || criterionText || categoryLabel,
        submittedByRole: currentRole.id,
        submittedByTitle: submitterTitle,
        submittedByUid: user.uid,
        status: 'pending',
        version: 1,
        createdAtMs: Date.now(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setTicketForm((prev) => ({ ...prev, description: '', evidence: '', amount: 0 }));
      showToast('Đã gửi phiếu đề xuất vào Trung tâm kiểm duyệt của GVCN!');
      if (sessionKind === 'teacher') {
        setActiveTab('moderation');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${targetOwnerUid}/workspaces/${targetWsId}/tickets`);
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const handleModerateTicket = async (
    ticket: TicketRecord,
    decision: 'approved' | 'needs_revision' | 'rejected'
  ) => {
    if (!user || activeRoleId !== 'gvcn' || !currentRole.canApprove) {
      showToast('Chỉ Giáo viên chủ nhiệm mới có quyền kiểm duyệt phiếu.', 'error');
      return;
    }

    setProcessingTicketId(ticket.id);
    try {
      const ticketRef = doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'tickets', ticket.id);
      const approvalId = `APR_${Date.now()}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      let appliedFundDelta = 0;

      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ticketRef);
        if (!snap.exists()) {
          throw new Error('Phiếu không còn tồn tại trên hệ thống.');
        }
        const currentData = snap.data() as TicketRecord;
        if (currentData.status === 'approved' || currentData.status === 'rejected') {
          throw new Error('Phiếu này đã được xử lý trước đó (chống duyệt trùng lặp).');
        }
        if (ticket.version && currentData.version && currentData.version !== ticket.version) {
          throw new Error('Phiên bản phiếu đã thay đổi bởi thao tác khác. Vui lòng tải lại.');
        }

        const nextVersion = (Number(currentData.version) || 1) + 1;
        transaction.update(ticketRef, {
          status: decision,
          version: nextVersion,
          approvalId: decision === 'approved' ? approvalId : null,
          reviewedByTeacher: classConfig.teacherName,
          reviewedByUid: user.uid,
          reviewedAtMs: Date.now(),
          updatedAt: serverTimestamp(),
        });

        if (decision === 'approved' && currentData.type === 'thu_chi') {
          if (currentData.category === 'Đề xuất quyết toán') {
            appliedFundDelta = 0;
          } else {
            appliedFundDelta =
              currentData.category === 'Chi quỹ'
                ? -Number(currentData.amount || 0)
                : Number(currentData.amount || 0);
          }
        }
      });

      if (decision === 'approved' && ticket.type === 'thu_chi' && appliedFundDelta !== 0) {
        const configRef = doc(db, 'users', user.uid, 'class_configs', 'active_workspace');
        await runTransaction(db, async (transaction) => {
          const cfgSnap = await transaction.get(configRef);
          const curBal = cfgSnap.exists() ? Number(cfgSnap.data().fundBalance || 0) : 0;
          transaction.update(configRef, {
            fundBalance: curBal + appliedFundDelta,
            updatedAt: serverTimestamp(),
          });
        });
      }

      if (decision === 'approved' && ticket.type === 'chi_doan') {
        await addDoc(collection(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'youth'), {
          ownerUid: user.uid,
          title: ticket.category || 'Hoạt động Chi đoàn',
          date: ticket.date || new Date().toISOString().split('T')[0],
          participantCount: 0,
          description: ticket.description || '',
          status: 'Sắp diễn ra',
          createdAtMs: Date.now(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch((e) =>
          handleFirestoreError(e, OperationType.CREATE, `users/${user.uid}/workspaces/${classWorkspaceId}/youth`)
        );
      }

      const actionLabel =
        decision === 'approved' ? 'PHÊ DUYỆT' : decision === 'needs_revision' ? 'YÊU CẦU SỬA' : 'TỪ CHỐI';
      await addDoc(collection(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'audit_logs'), {
        ownerUid: user.uid,
        action: actionLabel,
        approvalId: decision === 'approved' ? approvalId : null,
        ticketId: ticket.id,
        ticketType: ticket.typeLabel,
        summary: `${ticket.studentName}: ${ticket.description}`,
        submittedBy: ticket.submittedByTitle,
        approvedBy: `GVCN ${classConfig.teacherName} (${user.uid})`,
        timestampMs: Date.now(),
        createdAt: serverTimestamp(),
      });

      setSelectedTicketIds((prev) => prev.filter((id) => id !== ticket.id));
      showToast(`Đã cập nhật trạng thái phiếu: ${actionLabel}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi kiểm duyệt phiếu.';
      showToast(msg, 'error');
    } finally {
      setProcessingTicketId(null);
    }
  };

  const evaluateTicketBatchEligibility = (ticket: TicketRecord) => {
    if (ticket.status === 'approved') return { eligible: false, reason: 'Phiếu đã được phê duyệt trước đó' };
    if (ticket.status === 'rejected') return { eligible: false, reason: 'Phiếu đã bị từ chối' };
    if (ticket.status === 'needs_revision')
      return { eligible: false, reason: 'Phiếu đang yêu cầu chỉnh sửa / có tranh chấp' };
    if (ticket.status !== 'pending') return { eligible: false, reason: 'Trạng thái phiếu không ở dạng Chờ duyệt' };
    if (!ticket.description || !String(ticket.description).trim())
      return { eligible: false, reason: 'Thiếu nội dung mô tả sự việc' };

    if (ticket.type === 'ne_nep') {
      if (ticket.emulationGroup === 'severe' || ticket.suggestedGrade === 'C' || ticket.emulationGroup === 'gradeC') {
        return { eligible: false, reason: 'Phiếu vi phạm mức C / lỗi nặng học kỳ (cần GVCN xem xét riêng)' };
      }
      if (!ticket.evidence || !String(ticket.evidence).trim()) {
        return { eligible: false, reason: 'Thiếu minh chứng / thời điểm xác minh' };
      }
      if (!ticket.studentId) {
        return { eligible: false, reason: 'Thiếu thông tin định danh học sinh' };
      }
    }
    if (ticket.type === 'thu_chi') {
      if (ticket.category !== 'Đề xuất quyết toán' && (!ticket.amount || Number(ticket.amount) <= 0)) {
        return { eligible: false, reason: 'Phiếu thu/chi thiếu số tiền hợp lệ' };
      }
      if (ticket.category === 'Đề xuất quyết toán' && Number(ticket.amount || 0) < 0) {
        return { eligible: false, reason: 'Số tiền quyết toán không hợp lệ' };
      }
      if (String(ticket.description).trim().length < 8) {
        return { eligible: false, reason: 'Phiếu thu/chi thiếu thông tin chứng từ / lý do chi tiết' };
      }
    }
    return { eligible: true, reason: 'Đủ điều kiện duyệt hàng loạt' };
  };

  const filteredModerationTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchType = modFilterType === 'all' || t.type === modFilterType;
      const matchStatus = modFilterStatus === 'all' || t.status === modFilterStatus;
      return matchType && matchStatus;
    });
  }, [tickets, modFilterType, modFilterStatus]);

  const eligibleFilteredTickets = useMemo(
    () => filteredModerationTickets.filter((t) => evaluateTicketBatchEligibility(t).eligible),
    [filteredModerationTickets]
  );

  const handleOpenBatchConfirmModal = (mode: 'selected' | 'all_eligible') => {
    if (activeRoleId !== 'gvcn' || !currentRole.canApprove) {
      showToast('Chỉ GVCN có quyền phê duyệt mới được phép duyệt hàng loạt.', 'error');
      return;
    }

    const scopeTickets =
      mode === 'selected'
        ? filteredModerationTickets.filter((t) => selectedTicketIds.includes(t.id))
        : filteredModerationTickets;

    const eligibleTickets: TicketRecord[] = [];
    const excludedTickets: { ticket: TicketRecord; reason: string }[] = [];
    const snapshotVersions: Record<string, { status: string; version: number }> = {};

    scopeTickets.forEach((tk) => {
      const check = evaluateTicketBatchEligibility(tk);
      if (check.eligible) {
        eligibleTickets.push(tk);
        snapshotVersions[tk.id] = {
          status: tk.status,
          version: Number(tk.version) || 1,
        };
      } else {
        excludedTickets.push({ ticket: tk, reason: check.reason });
      }
    });

    if (eligibleTickets.length === 0) {
      showToast('Không có phiếu nào đủ điều kiện duyệt hàng loạt trong phạm vi đã chọn.', 'error');
      return;
    }

    setBatchConfirmModal({
      mode,
      eligibleTickets,
      excludedTickets,
      snapshotVersions,
    });
  };

  const handleExecuteBatchApproval = async () => {
    if (!user || activeRoleId !== 'gvcn' || !currentRole.canApprove || !batchConfirmModal) {
      showToast('Không đủ thẩm quyền phê duyệt hàng loạt.', 'error');
      return;
    }
    if (isBatchApproving) return;

    setIsBatchApproving(true);
    const { eligibleTickets, excludedTickets, snapshotVersions } = batchConfirmModal;
    const batchId = `BATCH_${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    let successCount = 0;
    let totalFundDelta = 0;
    const failedItems: { ticket: TicketRecord; reason: string }[] = [];

    try {
      for (const tk of eligibleTickets) {
        const ticketRef = doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'tickets', tk.id);
        const expectedSnap = snapshotVersions[tk.id];
        const approvalId = `${batchId}_${tk.id.slice(0, 6)}`;

        try {
          let itemFundDelta = 0;
          await runTransaction(db, async (transaction) => {
            const freshSnap = await transaction.get(ticketRef);
            if (!freshSnap.exists()) throw new Error('Phiếu đã bị xóa.');
            const freshData = freshSnap.data() as TicketRecord;
            const currentVer = Number(freshData.version) || 1;

            if (freshData.status !== 'pending' || currentVer !== expectedSnap.version) {
              throw new Error(
                `Phiếu đã đổi trạng thái (${freshData.status}) hoặc phiên bản cũ (v${expectedSnap.version} -> v${currentVer}).`
              );
            }

            transaction.update(ticketRef, {
              status: 'approved',
              version: currentVer + 1,
              approvalId,
              batchApprovalId: batchId,
              reviewedByTeacher: classConfig.teacherName,
              reviewedByUid: user.uid,
              reviewedAtMs: Date.now(),
              updatedAt: serverTimestamp(),
            });

            if (freshData.type === 'thu_chi') {
              if (freshData.category === 'Đề xuất quyết toán') {
                itemFundDelta = 0;
              } else {
                itemFundDelta =
                  freshData.category === 'Chi quỹ'
                    ? -Number(freshData.amount || 0)
                    : Number(freshData.amount || 0);
              }
            }
          });

          if (tk.type === 'chi_doan') {
            await addDoc(collection(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'youth'), {
              ownerUid: user.uid,
              title: tk.category || 'Hoạt động Chi đoàn',
              date: tk.date || new Date().toISOString().split('T')[0],
              participantCount: 0,
              description: tk.description || '',
              status: 'Sắp diễn ra',
              createdAtMs: Date.now(),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          }

          successCount++;
          totalFundDelta += itemFundDelta;

          await addDoc(collection(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'audit_logs'), {
            ownerUid: user.uid,
            action: 'PHÊ DUYỆT HÀNG LOẠT',
            approvalId,
            batchApprovalId: batchId,
            ticketId: tk.id,
            ticketType: tk.typeLabel,
            summary: `${tk.studentName}: ${tk.description}`,
            submittedBy: tk.submittedByTitle,
            approvedBy: `GVCN ${classConfig.teacherName} (${user.uid})`,
            timestampMs: Date.now(),
            createdAt: serverTimestamp(),
          });
        } catch (itemErr) {
          failedItems.push({
            ticket: tk,
            reason: itemErr instanceof Error ? itemErr.message : 'Lỗi xung đột dữ liệu',
          });
        }
      }

      if (totalFundDelta !== 0) {
        const configRef = doc(db, 'users', user.uid, 'class_configs', 'active_workspace');
        await runTransaction(db, async (transaction) => {
          const cfgSnap = await transaction.get(configRef);
          const curBal = cfgSnap.exists() ? Number(cfgSnap.data().fundBalance || 0) : 0;
          transaction.update(configRef, {
            fundBalance: curBal + totalFundDelta,
            updatedAt: serverTimestamp(),
          });
        });
      }

      const needReviewCount = excludedTickets.length + failedItems.length;
      const totalScopeCount = eligibleTickets.length + excludedTickets.length;

      setBatchApprovalReport({
        batchId,
        successCount,
        totalScopeCount,
        needReviewCount,
        failedItems,
        excludedTickets,
        timestamp: new Date().toLocaleTimeString('vi-VN'),
      });

      setSelectedTicketIds([]);
      setBatchConfirmModal(null);
      showToast(`Đã duyệt ${successCount}/${totalScopeCount} phiếu. ${needReviewCount} phiếu cần xem lại.`);
    } finally {
      setIsBatchApproving(false);
    }
  };

  const sanitizeDraftEntry = (entry: WeeklyEmulationDraftEntry): WeeklyEmulationDraftEntry => {
    const clean: WeeklyEmulationDraftEntry = {};
    if (entry.rank === 'A' || entry.rank === 'B' || entry.rank === 'C') clean.rank = entry.rank;
    if (typeof entry.note === 'string') clean.note = entry.note.slice(0, 500);
    if (typeof entry.spoken === 'boolean') clean.spoken = entry.spoken;
    if (typeof entry.updatedByRole === 'string') clean.updatedByRole = entry.updatedByRole;
    if (typeof entry.updatedByTitle === 'string') clean.updatedByTitle = entry.updatedByTitle;
    if (typeof entry.updatedAtMs === 'number') clean.updatedAtMs = entry.updatedAtMs;
    return clean;
  };

  const persistWeekDraftUpdates = async (updates: Record<string, WeeklyEmulationDraftEntry>) => {
    if (!user) return;
    const draftRef = doc(
      db,
      'users',
      user.uid,
      'workspaces',
      classWorkspaceId,
      'emulation_drafts',
      selectedWeekDocId
    );
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(draftRef);
        const existingDrafts: Record<string, WeeklyEmulationDraftEntry> = snap.exists()
          ? ((snap.data().drafts as Record<string, WeeklyEmulationDraftEntry>) || {})
          : {};
        const mergedDrafts: Record<string, WeeklyEmulationDraftEntry> = { ...existingDrafts };
        Object.entries(updates).forEach(([code, entry]) => {
          mergedDrafts[code] = sanitizeDraftEntry({
            ...(existingDrafts[code] || {}),
            ...entry,
          });
        });

        if (snap.exists()) {
          transaction.update(draftRef, {
            weekLabel: selectedEmulationWeek,
            drafts: mergedDrafts,
            updatedAt: serverTimestamp(),
          });
        } else {
          transaction.set(draftRef, {
            ownerUid: user.uid,
            weekNumber: selectedWeekNumber,
            weekLabel: selectedEmulationWeek,
            drafts: mergedDrafts,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      });
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.WRITE,
        `users/${user.uid}/workspaces/${classWorkspaceId}/emulation_drafts/${selectedWeekDocId}`
      );
    }
  };

  const handleUpdateStudentDraft = (
    student: StudentRecord,
    patch: Partial<WeeklyEmulationDraftEntry>,
    immediatePersist = false
  ) => {
    const canEdit =
      !currentLockedSnapshot &&
      (activeRoleId === 'gvcn' || (currentRole.team && Number(student.team) === Number(currentRole.team)));
    if (!canEdit) return;

    const existingEntry = currentWeekDrafts[student.code] || {};
    const nextEntry = sanitizeDraftEntry({
      ...existingEntry,
      ...patch,
      updatedByRole: currentRole.id,
      updatedByTitle: currentRole.title,
      updatedAtMs: Date.now(),
    });

    setEmulationDraftsByWeek((prev) => ({
      ...prev,
      [selectedWeekDocId]: {
        ...(prev[selectedWeekDocId] || {}),
        [student.code]: nextEntry,
      },
    }));

    if (immediatePersist) {
      void persistWeekDraftUpdates({ [student.code]: nextEntry });
    }
  };

  const handleMarkScopeSpeaking = async (targetStudents: StudentRecord[]) => {
    if (targetStudents.length === 0 || currentLockedSnapshot) return;
    const updates: Record<string, WeeklyEmulationDraftEntry> = {};
    targetStudents.forEach((st) => {
      updates[st.code] = sanitizeDraftEntry({
        ...(currentWeekDrafts[st.code] || {}),
        spoken: true,
        updatedByRole: currentRole.id,
        updatedByTitle: currentRole.title,
        updatedAtMs: Date.now(),
      });
    });

    setEmulationDraftsByWeek((prev) => ({
      ...prev,
      [selectedWeekDocId]: {
        ...(prev[selectedWeekDocId] || {}),
        ...updates,
      },
    }));

    setIsSavingDrafts(true);
    try {
      await persistWeekDraftUpdates(updates);
      showToast(
        currentRole.team
          ? `Đã đánh dấu toàn bộ Tổ ${currentRole.team} có phát biểu trong ${selectedEmulationWeek}!`
          : `Đã đánh dấu cả lớp có phát biểu trong ${selectedEmulationWeek}!`
      );
    } finally {
      setIsSavingDrafts(false);
    }
  };

  const handleSaveWeekDrafts = async () => {
    if (!user || currentLockedSnapshot) return;
    const isGvcn = activeRoleId === 'gvcn';
    const allowedTeam = !isGvcn && currentRole.team ? Number(currentRole.team) : null;
    if (!isGvcn && allowedTeam === null) return;

    const updates: Record<string, WeeklyEmulationDraftEntry> = {};
    students.forEach((st) => {
      if (isGvcn || Number(st.team) === allowedTeam) {
        const existing = currentWeekDrafts[st.code];
        if (existing) {
          updates[st.code] = sanitizeDraftEntry({
            ...existing,
            updatedByRole: existing.updatedByRole || currentRole.id,
            updatedByTitle: existing.updatedByTitle || currentRole.title,
            updatedAtMs: existing.updatedAtMs || Date.now(),
          });
        }
      }
    });

    if (Object.keys(updates).length === 0) {
      showToast('Chưa có thay đổi mới nào cần lưu.');
      return;
    }

    setIsSavingDrafts(true);
    try {
      await persistWeekDraftUpdates(updates);
      showToast(
        allowedTeam !== null
          ? `Đã lưu xếp loại Tổ ${allowedTeam} (${selectedEmulationWeek}) để GVCN kiểm tra & chốt sổ!`
          : `Đã lưu bản nháp xếp loại ${selectedEmulationWeek} lên Cloud Firestore!`
      );
    } finally {
      setIsSavingDrafts(false);
    }
  };

  const getStudentWeekEvidenceSummary = (studentId: string, weekLabel: string, studentCode?: string) => {
    const weekTickets = tickets.filter(
      (t) =>
        t.type === 'ne_nep' &&
        t.studentId === studentId &&
        (t.weekLabel || 'Tuần 1') === weekLabel &&
        t.status !== 'rejected'
    );
    const approvedInWeek = weekTickets.filter((t) => t.status === 'approved');

    if (weekTickets.length === 0) {
      const code = studentCode || students.find((s) => s.id === studentId)?.code || '';
      const wkNum = parseInt(weekLabel.replace(/\D/g, ''), 10) || 1;
      const wkDocId = `week_${wkNum}`;
      const draftSpoken = code ? emulationDraftsByWeek[wkDocId]?.[code]?.spoken : undefined;
      const hasSpoken = draftSpoken !== undefined ? draftSpoken : true;
      if (autoRankAEnabled && hasSpoken) {
        return {
          approvedInWeek: [] as TicketRecord[],
          suggestedRank: 'A' as EmulationRank,
          suggestionReason: 'Tự động xếp A (Không vi phạm, có phát biểu, tổ trưởng không lập phiếu)',
          isAutoA: true,
        };
      }
      return {
        approvedInWeek: [] as TicketRecord[],
        suggestedRank: null as EmulationRank | null,
        suggestionReason: 'Chưa có minh chứng phát biểu trong tuần (Không mặc định loại A)',
        isAutoA: false,
      };
    }

    if (approvedInWeek.length === 0) {
      return {
        approvedInWeek: [] as TicketRecord[],
        suggestedRank: null as EmulationRank | null,
        suggestionReason: 'Có phiếu tổ trưởng lập đang chờ GVCN duyệt',
        isAutoA: false,
      };
    }

    const hasC = approvedInWeek.some(
      (t) => t.suggestedGrade === 'C' || t.emulationGroup === 'gradeC' || t.emulationGroup === 'severe'
    );
    const hasB = approvedInWeek.some((t) => t.suggestedGrade === 'B' || t.emulationGroup === 'gradeB');
    const hasA = approvedInWeek.some((t) => t.suggestedGrade === 'A' || t.emulationGroup === 'gradeA');

    if (hasC)
      return {
        approvedInWeek,
        suggestedRank: 'C' as EmulationRank,
        suggestionReason: 'Có vi phạm mức C đã được GVCN duyệt',
        isAutoA: false,
      };
    if (hasB && !hasA)
      return {
        approvedInWeek,
        suggestedRank: 'B' as EmulationRank,
        suggestionReason: 'Có vi phạm mức B đã được GVCN duyệt',
        isAutoA: false,
      };
    if (hasA)
      return {
        approvedInWeek,
        suggestedRank: 'A' as EmulationRank,
        suggestionReason: 'Có minh chứng đạt chuẩn mức A được GVCN duyệt',
        isAutoA: false,
      };
    return {
      approvedInWeek,
      suggestedRank: null as EmulationRank | null,
      suggestionReason: 'Chờ GVCN quyết định',
      isAutoA: false,
    };
  };

  const handleLockWeeklyEmulation = async () => {
    if (!user || activeRoleId !== 'gvcn') return;
    if (students.length === 0) {
      showToast('Chưa có danh sách học sinh để chốt tuần.', 'error');
      return;
    }

    const records: WeeklySnapshot['records'] = {};
    const unfinalized: string[] = [];

    students.forEach((st) => {
      const autoInfo = getStudentWeekEvidenceSummary(st.id, selectedEmulationWeek, st.code);
      const draft = currentWeekDrafts[st.code];
      const rank = draft?.rank ?? autoInfo.suggestedRank;
      if (!rank) {
        unfinalized.push(st.fullName);
      } else {
        records[st.code] = {
          studentCode: st.code,
          studentName: st.fullName,
          team: Number(st.team),
          rank,
          note: draft?.note || autoInfo.suggestionReason,
        };
      }
    });

    if (unfinalized.length > 0) {
      showToast(
        `Còn ${unfinalized.length} học sinh chưa được chọn xếp loại A/B/C (${unfinalized.slice(0, 3).join(', ')}...). Vui lòng xác nhận đủ trước khi chốt tuần!`,
        'error'
      );
      return;
    }

    setIsLockingWeek(true);
    try {
      const teamStats = [1, 2, 3, 4].map((teamNum) => {
        const members = students.filter((s) => Number(s.team) === teamNum);
        let countA = 0,
          countB = 0,
          countC = 0;
        members.forEach((m) => {
          const r = records[m.code]?.rank;
          if (r === 'A') countA++;
          else if (r === 'B') countB++;
          else if (r === 'C') countC++;
        });
        const rateA = members.length > 0 ? Math.round((countA / members.length) * 1000) / 10 : 0;
        return {
          team: teamNum,
          lockedSize: members.length,
          countA,
          countB,
          countC,
          unfinalizedCount: 0,
          rateA,
        };
      });

      const weekNumber = parseInt(selectedEmulationWeek.replace(/\D/g, ''), 10) || 1;
      const weekDocId = `week_${weekNumber}`;

      await setDoc(doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'emulation_weeks', weekDocId), {
        ownerUid: user.uid,
        weekNumber,
        weekLabel: selectedEmulationWeek,
        monthLabel: selectedEmulationMonth,
        semesterLabel: selectedEmulationSemester,
        totalLockedStudents: students.length,
        records,
        teamStats,
        lockedBy: `GVCN ${classConfig.teacherName}`,
        lockedAtMs: Date.now(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      showToast(`Đã chốt sổ thi đua ${selectedEmulationWeek} thành công!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/workspaces/${classWorkspaceId}/emulation_weeks`);
    } finally {
      setIsLockingWeek(false);
    }
  };

  const handleAdjustLockedStudentRank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || activeRoleId !== 'gvcn' || !currentLockedSnapshot || !adjustModalData) return;
    if (!adjustReason.trim()) {
      showToast('Bắt buộc nhập lý do điều chỉnh.', 'error');
      return;
    }

    try {
      const updatedRecords = {
        ...currentLockedSnapshot.records,
        [adjustModalData.studentCode]: {
          ...currentLockedSnapshot.records[adjustModalData.studentCode],
          rank: adjustNewRank,
          note: `Điều chỉnh: ${adjustReason.trim()}`,
        },
      };

      const updatedTeamStats = [1, 2, 3, 4].map((teamNum) => {
        const oldTeam = currentLockedSnapshot.teamStats?.find((t) => t.team === teamNum) || { lockedSize: 0 };
        const teamRecs = Object.values(updatedRecords).filter((r) => Number(r.team) === teamNum);
        const countA = teamRecs.filter((r) => r.rank === 'A').length;
        const countB = teamRecs.filter((r) => r.rank === 'B').length;
        const countC = teamRecs.filter((r) => r.rank === 'C').length;
        const size = oldTeam.lockedSize || teamRecs.length;
        const rateA = size > 0 ? Math.round((countA / size) * 1000) / 10 : 0;
        return {
          team: teamNum,
          lockedSize: size,
          countA,
          countB,
          countC,
          unfinalizedCount: 0,
          rateA,
        };
      });

      await updateDoc(
        doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'emulation_weeks', currentLockedSnapshot.id),
        {
          records: updatedRecords,
          teamStats: updatedTeamStats,
          updatedAt: serverTimestamp(),
        }
      );

      await addDoc(
        collection(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'emulation_adjustments'),
        {
          ownerUid: user.uid,
          weekLabel: selectedEmulationWeek,
          studentCode: adjustModalData.studentCode,
          studentName: adjustModalData.studentName,
          team: adjustModalData.team,
          oldRank: adjustModalData.oldRank,
          newRank: adjustNewRank,
          reason: adjustReason.trim(),
          adjustedBy: `GVCN ${classConfig.teacherName}`,
          timestampMs: Date.now(),
          createdAt: serverTimestamp(),
        }
      );

      setAdjustModalData(null);
      showToast('Đã điều chỉnh xếp loại và ghi vào Lịch sử điều chỉnh!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/workspaces/${classWorkspaceId}/emulation_weeks/${currentLockedSnapshot.id}`);
    }
  };

  const handleSaveAttendance = async () => {
    if (!user) return;
    if (!currentRole.allowedTicketTypes.includes('diem_danh')) {
      showToast(`Vai trò ${currentRole.title} không có quyền lập phiếu điểm danh.`, 'error');
      return;
    }
    const targetStudents = students.filter((s) => !currentRole.team || Number(s.team) === currentRole.team);
    if (targetStudents.length === 0) {
      showToast('Không có học sinh thuộc phạm vi điểm danh.', 'error');
      return;
    }

    setIsSavingAttendance(true);
    try {
      let presentCount = 0;
      let excusedCount = 0;
      let unexcusedCount = 0;
      let lateCount = 0;
      const absentDetails: string[] = [];

      targetStudents.forEach((st) => {
        const entry = dailyAttendanceDraft[st.id] || { status: 'present', note: '' };
        if (entry.status === 'present') presentCount++;
        else if (entry.status === 'excused') {
          excusedCount++;
          absentDetails.push(`${st.fullName} (Vắng CP${entry.note ? `: ${entry.note}` : ''})`);
        } else if (entry.status === 'unexcused') {
          unexcusedCount++;
          absentDetails.push(`${st.fullName} (Vắng KP${entry.note ? `: ${entry.note}` : ''})`);
        } else if (entry.status === 'late') {
          lateCount++;
          absentDetails.push(`${st.fullName} (Đi muộn${entry.note ? `: ${entry.note}` : ''})`);
        }
      });

      const absentSummary = absentDetails.length > 0 ? absentDetails.join('; ') : 'Đủ sĩ số, không có vắng/muộn';

      if (sessionKind === 'teacher' && activeRoleId === 'gvcn') {
        const docId = `${attendanceDate}_${attendanceSession === 'Sáng' ? 'sang' : 'chieu'}`;
        const attRef = doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'attendance', docId);
        const existingAtt = await getDoc(attRef);
        if (existingAtt.exists()) {
          await updateDoc(attRef, {
            totalStudents: targetStudents.length,
            presentCount,
            excusedCount,
            unexcusedCount,
            lateCount,
            absentSummary,
            recordedBy: `GVCN ${classConfig.teacherName}`,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(attRef, {
            ownerUid: user.uid,
            date: attendanceDate,
            session: attendanceSession,
            totalStudents: targetStudents.length,
            presentCount,
            excusedCount,
            unexcusedCount,
            lateCount,
            absentSummary,
            recordedBy: `GVCN ${classConfig.teacherName}`,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        showToast(`Đã lưu sổ điểm danh chính thức ngày ${attendanceDate} (${attendanceSession})!`);
      } else {
        const targetOwnerUid =
          sessionKind === 'officer' && officerMembership ? officerMembership.teacherUid : user.uid;
        const targetWsId =
          sessionKind === 'officer' && officerMembership ? officerMembership.workspaceId : classWorkspaceId;
        const submitterTitle =
          sessionKind === 'officer' && officerMembership
            ? `${currentRole.title} (${officerMembership.studentName} - ${officerMembership.nickname})`.slice(0, 100)
            : currentRole.title;
        await addDoc(collection(db, 'users', targetOwnerUid, 'workspaces', targetWsId, 'tickets'), {
          ownerUid: targetOwnerUid,
          type: 'diem_danh',
          typeLabel: TICKET_TYPES.diem_danh.label,
          studentId: null,
          studentName: currentRole.team ? `Tổ ${currentRole.team}` : `Toàn lớp ${classConfig.className}`,
          category: `Điểm danh ${attendanceSession}`,
          date: attendanceDate,
          description: `Có mặt ${presentCount}/${targetStudents.length}. ${absentSummary}`,
          submittedByRole: currentRole.id,
          submittedByTitle: submitterTitle,
          submittedByUid: user.uid,
          status: 'pending',
          version: 1,
          createdAtMs: Date.now(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast('Đã gửi phiếu điểm danh vào Trung tâm kiểm duyệt của GVCN!');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/workspaces/${classWorkspaceId}/attendance`);
    } finally {
      setIsSavingAttendance(false);
    }
  };

  const handleAddPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || activeRoleId !== 'gvcn' || !planForm.title.trim()) return;
    try {
      await addDoc(collection(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'plans'), {
        ownerUid: user.uid,
        week: planForm.week,
        title: planForm.title.trim(),
        targetDate: planForm.targetDate,
        content: planForm.content.trim(),
        status: planForm.status,
        createdAtMs: Date.now(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setPlanForm({ ...planForm, title: '', content: '' });
      showToast('Đã thêm kế hoạch chủ nhiệm mới!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/workspaces/${classWorkspaceId}/plans`);
    }
  };

  const handleTogglePlanStatus = async (plan: ClassPlanRecord) => {
    if (!user || activeRoleId !== 'gvcn') return;
    try {
      const nextStatus = plan.status === 'Hoàn thành' ? 'Đang thực hiện' : 'Hoàn thành';
      await updateDoc(doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'plans', plan.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/workspaces/${classWorkspaceId}/plans/${plan.id}`);
    }
  };

  const handleAddYouthActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !youthForm.title.trim()) return;
    if (activeRoleId !== 'gvcn' && activeRoleId !== 'bi_thu') {
      showToast(`Vai trò ${currentRole.title} không có quyền báo cáo/thêm hoạt động Chi đoàn.`, 'error');
      return;
    }
    try {
      if (sessionKind === 'teacher' && activeRoleId === 'gvcn') {
        await addDoc(collection(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'youth'), {
          ownerUid: user.uid,
          title: youthForm.title.trim(),
          date: youthForm.date,
          participantCount: Number(youthForm.participantCount || 0),
          description: youthForm.description.trim(),
          status: youthForm.status || 'Sắp diễn ra',
          createdAtMs: Date.now(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast('Đã ghi nhận hoạt động Chi đoàn lên Firestore!');
      } else {
        const targetOwnerUid =
          sessionKind === 'officer' && officerMembership ? officerMembership.teacherUid : user.uid;
        const targetWsId =
          sessionKind === 'officer' && officerMembership ? officerMembership.workspaceId : classWorkspaceId;
        const submitterTitle =
          sessionKind === 'officer' && officerMembership
            ? `${currentRole.title} (${officerMembership.studentName} - ${officerMembership.nickname})`.slice(0, 100)
            : currentRole.title;
        await addDoc(collection(db, 'users', targetOwnerUid, 'workspaces', targetWsId, 'tickets'), {
          ownerUid: targetOwnerUid,
          type: 'chi_doan',
          typeLabel: TICKET_TYPES.chi_doan.label,
          studentId: null,
          studentName: `Chi đoàn ${classConfig.className}`,
          category: 'Đề xuất phong trào',
          date: youthForm.date,
          description: `${youthForm.title.trim()} (${youthForm.participantCount || 0} ĐVTN) — ${youthForm.description}`,
          submittedByRole: currentRole.id,
          submittedByTitle: submitterTitle,
          submittedByUid: user.uid,
          status: 'pending',
          version: 1,
          createdAtMs: Date.now(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast('Đã gửi đề xuất hoạt động Chi đoàn chờ GVCN duyệt!');
      }
      setYouthForm({
        title: '',
        date: new Date().toISOString().split('T')[0],
        participantCount: 0,
        description: '',
        status: 'Sắp diễn ra',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/workspaces/${classWorkspaceId}/youth`);
    }
  };

  const handleToggleYouthStatus = async (activity: YouthActivityRecord) => {
    if (!user) return;
    if (sessionKind !== 'teacher' || activeRoleId !== 'gvcn') {
      showToast('Chỉ GVCN mới có quyền cập nhật trực tiếp trạng thái hoạt động Chi đoàn. Bí thư hãy gửi phiếu đề xuất để GVCN duyệt.', 'error');
      return;
    }
    const nextStatus =
      activity.status === 'Sắp diễn ra'
        ? 'Đang thực hiện'
        : activity.status === 'Đang thực hiện'
          ? 'Hoàn thành'
          : 'Đang thực hiện';
    try {
      await updateDoc(doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'youth', activity.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      showToast(`Đã chuyển trạng thái "${activity.title}" sang ${nextStatus}.`);
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `users/${user.uid}/workspaces/${classWorkspaceId}/youth/${activity.id}`
      );
    }
  };

  const persistVneduIdLinks = (nextLinks: VneduVerifiedLinkStore) => {
    setVneduConfirmedIdLinks(nextLinks);
    if (!user?.uid) return;
    try {
      const storageKey = `gvcn360_vnedu_id_links_${user.uid}_${classWorkspaceId}`;
      window.localStorage.setItem(storageKey, JSON.stringify(nextLinks));
    } catch {
      // Bỏ qua lỗi ghi localStorage
    }
  };

  const handleRemoveVneduIdLink = (vneduCodeUpper: string) => {
    const next = { ...vneduConfirmedIdLinks };
    delete next[vneduCodeUpper];
    persistVneduIdLinks(next);
    showToast(`Đã gỡ liên kết mã vnEdu ${vneduCodeUpper}.`);
  };

  const handleClearAllVneduIdLinks = () => {
    persistVneduIdLinks({});
    showToast('Đã xóa toàn bộ bảng liên kết mã vnEdu của lớp hiện tại.');
  };

  const parseVneduMatrix = (matrix: string[][], merges: VneduMergeSpan[] = []) => {
    if (matrix.length === 0) {
      setVneduMatrix([]);
      setVneduMerges([]);
      setVneduHeaderRowIndex(-1);
      setVneduColumns([]);
      setVneduRoleMap({});
      setVneduRowResolutions({});
      return;
    }

    if (matrix.length < 2) {
      setVneduMatrix(matrix);
      setVneduMerges(merges);
      setVneduHeaderRowIndex(-1);
      setVneduColumns([]);
      setVneduRoleMap({});
      setVneduRowResolutions({});
      showToast('Dữ liệu bảng điểm chưa đủ dòng tiêu đề và dữ liệu học sinh.', 'error');
      return;
    }

    const detected = autoDetectVneduHeaderAndMapping(matrix, undefined, true, merges);
    setVneduMatrix(matrix);
    setVneduMerges(merges);
    setVneduHeaderRowIndex(detected.headerRowIndex);
    setVneduMergeParentHeader(true);
    setVneduColumns(detected.columns);
    setVneduRoleMap(detected.roleMap);
    setVneduRowResolutions({});
  };

  const handlePasteVneduRawText = (text: string) => {
    setVneduWorkbook(null);
    setVneduFileName('');
    setVneduSheetNames([]);
    setVneduSelectedSheet('');
    setVneduRawText(text);
    if (!text.trim()) {
      parseVneduMatrix([], []);
      return;
    }
    parseVneduMatrix(parseVneduDelimitedText(text), []);
  };

  const handleSelectVneduSheet = (sheetName: string) => {
    if (!vneduWorkbook || !sheetName) return;
    setVneduSelectedSheet(sheetName);
    const { matrix, merges } = extractVneduSheetMatrix(vneduWorkbook, sheetName);
    setVneduRawText(matrix.map((r) => r.join('\t')).join('\n'));
    parseVneduMatrix(matrix, merges);
  };

  const handleChangeVneduHeaderRow = (rowIdx: number, mergeParent: boolean) => {
    if (vneduMatrix.length === 0) return;
    const { descriptors, roleMap } = buildVneduColumnDescriptors(
      vneduMatrix,
      rowIdx,
      mergeParent,
      vneduMerges
    );
    setVneduHeaderRowIndex(rowIdx);
    setVneduMergeParentHeader(mergeParent);
    setVneduColumns(descriptors);
    setVneduRoleMap(roleMap);
    setVneduRowResolutions({});
    setVneduDeselectedRows({});
  };

  const handleChangeVneduColumnRole = (colIndex: number, role: VneduColumnRole) => {
    setVneduRoleMap((prev) => ({
      ...prev,
      [colIndex]: role,
    }));
  };

  const handleSetVneduRowResolution = (
    excelRowNumber: number,
    resolution: VneduRowResolution
  ) => {
    setVneduRowResolutions((prev) => ({
      ...prev,
      [excelRowNumber]: resolution,
    }));
    // Khi GVCN xác nhận 1 dòng thủ công, tự động tích chọn dòng đó vào danh sách lưu
    if (resolution.type === 'confirm') {
      setVneduDeselectedRows((prev) => {
        if (!prev[excelRowNumber]) return prev;
        const next = { ...prev };
        delete next[excelRowNumber];
        return next;
      });
    }
  };

  const handleToggleVneduRowSelection = (excelRowNumber: number) => {
    setVneduDeselectedRows((prev) => {
      const next = { ...prev };
      if (next[excelRowNumber]) {
        delete next[excelRowNumber];
      } else {
        next[excelRowNumber] = true;
      }
      return next;
    });
  };

  const handleSelectAllEligibleVneduRows = () => {
    setVneduDeselectedRows({});
  };

  const handleClearVneduRowSelections = () => {
    const next: Record<number, boolean> = {};
    vneduAnalysis.items.forEach((item) => {
      if (item.canSave) {
        next[item.excelRowNumber] = true;
      }
    });
    setVneduDeselectedRows(next);
  };

  const handleConfirmDobMismatchGroup = (
    entries: { excelRowNumber: number; studentId: string; saveLink: boolean }[]
  ) => {
    if (entries.length === 0) return;
    setVneduRowResolutions((prev) => {
      const next = { ...prev };
      entries.forEach((e) => {
        next[e.excelRowNumber] = {
          type: 'confirm',
          studentId: e.studentId,
          saveLink: e.saveLink,
          source: 'dob_mismatch_batch',
        };
      });
      return next;
    });
    setVneduDeselectedRows((prev) => {
      const next = { ...prev };
      entries.forEach((e) => {
        delete next[e.excelRowNumber];
      });
      return next;
    });
    showToast(
      `Đã xác nhận theo nhóm ${entries.length} học sinh (tên duy nhất, khác ngày sinh) và tự động tích chọn vào danh sách lưu điểm!`
    );
  };

  const handleCancelVneduImport = () => {
    setVneduWorkbook(null);
    setVneduFileName('');
    setVneduSheetNames([]);
    setVneduSelectedSheet('');
    setVneduRawText('');
    setVneduMatrix([]);
    setVneduMerges([]);
    setVneduHeaderRowIndex(-1);
    setVneduColumns([]);
    setVneduRoleMap({});
    setVneduRowResolutions({});
    setVneduDeselectedRows({});
    setVneduCodeSystemVerifiedSameAsMoet(false);
    setVneduAutoConfirmExactNameAndDob(true);
    showToast('Đã hủy bản nhập điểm tạm thời. Dữ liệu điểm đã lưu trên hệ thống vẫn được giữ nguyên.');
  };

  const parsedVneduRows = useMemo(() => {
    if (vneduMatrix.length === 0 || vneduHeaderRowIndex < 0) return [];
    const dataRows = sliceStudentTableRows(vneduMatrix, vneduHeaderRowIndex);
    return buildParsedVneduRows(
      dataRows,
      vneduRoleMap,
      vneduColumns,
      vneduHeaderRowIndex,
      vneduAssessmentMode
    );
  }, [vneduMatrix, vneduHeaderRowIndex, vneduRoleMap, vneduColumns, vneduAssessmentMode]);

  const activeVneduSubjectSlug = useMemo(
    () => normalizeSlug(selectedVneduSubject || classConfig.subject || 'Toán', 'toan').slice(0, 60),
    [selectedVneduSubject, classConfig.subject]
  );

  const vneduAnalysis = useMemo(() => {
    return reconcileVneduRows(
      parsedVneduRows,
      students,
      subjectScores,
      activeVneduSubjectSlug,
      selectedVneduSemester,
      vneduColumns,
      vneduRoleMap,
      {
        confirmedIdLinks: vneduConfirmedIdLinks,
        codeSystemVerifiedSameAsMoet: vneduCodeSystemVerifiedSameAsMoet,
        autoConfirmExactNameAndDob: vneduAutoConfirmExactNameAndDob,
        preserveExistingWhenBlank,
        resolutions: vneduRowResolutions,
      }
    );
  }, [
    parsedVneduRows,
    students,
    subjectScores,
    activeVneduSubjectSlug,
    selectedVneduSemester,
    vneduColumns,
    vneduRoleMap,
    vneduConfirmedIdLinks,
    vneduCodeSystemVerifiedSameAsMoet,
    vneduAutoConfirmExactNameAndDob,
    preserveExistingWhenBlank,
    vneduRowResolutions,
  ]);

  const handleAutoReconcileAll = () => {
    if (students.length === 0) {
      showToast(
        'Chưa tải được danh sách học sinh thực tế của lớp. Vui lòng kiểm tra mục Hồ sơ học sinh trước.',
        'error'
      );
      return;
    }
    if (parsedVneduRows.length === 0) {
      showToast('Chưa có dữ liệu dòng điểm để tự động đối chiếu.', 'error');
      return;
    }

    const batch = buildAutoReconcileBatch(parsedVneduRows, students, vneduConfirmedIdLinks);
    if (batch.verifySameMoet) {
      setVneduCodeSystemVerifiedSameAsMoet(true);
    }
    setVneduAutoConfirmExactNameAndDob(true);
    if (Object.keys(batch.resolutions).length > 0) {
      setVneduRowResolutions((prev) => ({
        ...prev,
        ...batch.resolutions,
      }));
    }
    // Tự động tích chọn toàn bộ các dòng đủ điều kiện sau đối chiếu
    setVneduDeselectedRows({});

    const details: string[] = [];
    if (batch.dobMismatchCount > 0) {
      details.push(`${batch.dobMismatchCount} HS tên khớp nhưng khác ngày sinh`);
    }
    if (batch.duplicateNameCount > 0) {
      details.push(`${batch.duplicateNameCount} HS trùng họ tên`);
    }

    if (batch.remainingManualCount > 0) {
      showToast(
        `Đã tự động đối chiếu & tích chọn ${batch.autoMatchedCount}/${parsedVneduRows.length} HS. Còn ${batch.remainingManualCount} HS (${details.join(', ') || 'cần xác minh'}) chờ GVCN kiểm tra.`
      );
    } else {
      showToast(
        `Đã đối chiếu & tích chọn hoàn tất ${batch.autoMatchedCount}/${parsedVneduRows.length} học sinh! Nhấn "XÁC NHẬN LƯU ĐIỂM CÁC HỌC SINH ĐÃ CHỌN" để lưu.`
      );
    }
  };

  const fetchLatestRosterAndScoresFromFirestore = async (): Promise<{
    freshStudents: StudentRecord[];
    freshScoresMap: Record<string, SubjectScoreRecord>;
  } | null> => {
    if (!user || !classWorkspaceId) return null;
    const studentsColRef = collection(
      db,
      'users',
      user.uid,
      'workspaces',
      classWorkspaceId,
      'students'
    );
    const scoresColRef = collection(
      db,
      'users',
      user.uid,
      'workspaces',
      classWorkspaceId,
      'scores'
    );

    let studentSnap;
    let scoreSnap;
    try {
      [studentSnap, scoreSnap] = await Promise.all([
        getDocsFromServer(studentsColRef),
        getDocsFromServer(scoresColRef),
      ]);
    } catch {
      // Fallback to default Firestore read only when offline / server unreachable
      [studentSnap, scoreSnap] = await Promise.all([
        getDocs(studentsColRef),
        getDocs(scoresColRef),
      ]);
    }

    const freshStudents = studentSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<StudentRecord, 'id'>),
    }));
    freshStudents.sort(compareStudentsByRosterOrder);

    const freshScoresMap: Record<string, SubjectScoreRecord> = {};
    scoreSnap.docs.forEach((d) => {
      freshScoresMap[d.id] = {
        id: d.id,
        ...(d.data() as Omit<SubjectScoreRecord, 'id'>),
      };
    });

    setStudents(freshStudents);
    setSubjectScores(freshScoresMap);
    setVneduRosterRefreshedAtMs(Date.now());
    return { freshStudents, freshScoresMap };
  };

  const handleRefreshVneduRosterAndReconcile = async () => {
    if (!user || !classWorkspaceId) {
      showToast('Vui lòng đăng nhập để tải lại hồ sơ học sinh mới nhất từ Firestore.', 'error');
      return;
    }
    setIsRefreshingVneduRoster(true);
    try {
      const refreshed = await fetchLatestRosterAndScoresFromFirestore();
      if (!refreshed) return;
      const { freshStudents, freshScoresMap } = refreshed;

      // Xóa kết quả đối chiếu cũ đã hết hiệu lực, giữ nguyên bảng điểm đang xem trước
      setVneduRowResolutions({});
      setVneduDeselectedRows({});
      setVneduAutoConfirmExactNameAndDob(true);

      if (parsedVneduRows.length > 0) {
        const freshAnalysis = reconcileVneduRows(
          parsedVneduRows,
          freshStudents,
          freshScoresMap,
          activeVneduSubjectSlug,
          selectedVneduSemester,
          vneduColumns,
          vneduRoleMap,
          {
            confirmedIdLinks: vneduConfirmedIdLinks,
            codeSystemVerifiedSameAsMoet: vneduCodeSystemVerifiedSameAsMoet,
            autoConfirmExactNameAndDob: true,
            preserveExistingWhenBlank,
            resolutions: {},
          }
        );
        const s = freshAnalysis.summary;
        const remainParts: string[] = [];
        if (s.dobMismatchCount > 0) remainParts.push(`${s.dobMismatchCount} HS lệch ngày sinh`);
        if (s.needsVerificationCount > 0) remainParts.push(`${s.needsVerificationCount} HS cần kiểm tra`);
        if (s.notFoundCount > 0) remainParts.push(`${s.notFoundCount} HS chưa tìm thấy`);

        showToast(
          `Đã làm mới hồ sơ Lớp ${classConfig.className} (${freshStudents.length} HS từ Firestore) và đối chiếu lại: ${s.readyToSaveCount}/${s.totalRows} HS khớp chắc chắn đã tự động tích chọn${
            remainParts.length > 0 ? ` (${remainParts.join(', ')})` : ''
          }.`
        );
      } else {
        showToast(
          `Đã tải lại hồ sơ mới nhất từ Firestore cho Lớp ${classConfig.className} (${freshStudents.length} học sinh).`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể làm mới hồ sơ.';
      showToast('Lỗi tải lại hồ sơ từ Firestore: ' + msg, 'error');
    } finally {
      setIsRefreshingVneduRoster(false);
    }
  };

  const handleVneduFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsReadingExcel(true);
    try {
      // Đảm bảo đọc hồ sơ học sinh mới nhất từ Firestore trước khi đối chiếu file mới
      if (user && classWorkspaceId) {
        try {
          await fetchLatestRosterAndScoresFromFirestore();
        } catch {
          // Tiếp tục với danh sách realtime hiện có nếu mất kết nối tạm thời
        }
      }

      const lower = file.name.toLowerCase();
      if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) {
        const buffer = await file.arrayBuffer();
        const { workbook, sheetNames, selectedSheet, matrix, merges } = readVneduWorkbook(buffer);
        setVneduFileName(file.name);
        setVneduWorkbook(workbook);
        setVneduSheetNames(sheetNames);
        setVneduSelectedSheet(selectedSheet);
        setVneduRawText(matrix.map((r) => r.join('\t')).join('\n'));
        setVneduCodeSystemVerifiedSameAsMoet(false);
        setVneduAutoConfirmExactNameAndDob(true);
        setVneduDeselectedRows({});
        parseVneduMatrix(matrix, merges);
      } else {
        const text = await file.text();
        setVneduFileName(file.name);
        setVneduWorkbook(null);
        setVneduSheetNames([]);
        setVneduSelectedSheet('');
        setVneduRawText(text);
        setVneduCodeSystemVerifiedSameAsMoet(false);
        setVneduAutoConfirmExactNameAndDob(true);
        setVneduDeselectedRows({});
        parseVneduMatrix(parseVneduDelimitedText(text), []);
      }
      showToast(
        `Đã đọc tệp "${file.name}" và đối chiếu với hồ sơ mới nhất. Các học sinh khớp chắc chắn đã được tự động tích chọn!`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi đọc tệp.';
      showToast('Lỗi đọc tệp Excel vnEdu: ' + msg, 'error');
    } finally {
      setIsReadingExcel(false);
      e.target.value = '';
    }
  };

  const handleConfirmVneduImport = async () => {
    if (!user || activeRoleId !== 'gvcn') {
      showToast('Chỉ GVCN mới có quyền xác nhận nhập bảng điểm chính thức.', 'error');
      return;
    }

    if (vneduAnalysis.mappingConflicts.length > 0 || vneduAnalysis.unclassifiedColumns.length > 0) {
      showToast(
        'Vui lòng xử lý xong các cột bị trùng ánh xạ hoặc cột chưa chọn loại điểm trước khi lưu.',
        'error'
      );
      return;
    }

    const readyRows = vneduAnalysis.items.filter(
      (item) =>
        item.canSave &&
        !vneduDeselectedRows[item.excelRowNumber] &&
        item.matchedStudent &&
        item.mergedPayload
    );
    if (readyRows.length === 0) {
      showToast('Chưa có học sinh nào được tích chọn hợp lệ để lưu điểm.', 'error');
      return;
    }

    const importSubject = selectedVneduSubject || classConfig.subject || 'Toán';
    const importSubjectSlug = normalizeSlug(importSubject, 'toan').slice(0, 60);
    const subjectLabelWithSemester = getVneduSubjectLabel(importSubject, selectedVneduSemester);

    setIsImportingVnedu(true);
    try {
      const nextLinks: VneduVerifiedLinkStore = { ...vneduConfirmedIdLinks };
      let linksUpdated = false;
      const savedExcelRows = new Set<number>();
      const nowMs = Date.now();

      for (const item of readyRows) {
        const target = item.matchedStudent!;
        const payload = item.mergedPayload!;
        const scoreDocId = getVneduScoreDocId(target.code, importSubjectSlug, selectedVneduSemester);
        const scoreRef = doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'scores', scoreDocId);
        const existingScore = await getDoc(scoreRef);

        if (existingScore.exists()) {
          await updateDoc(scoreRef, {
            fullName: target.fullName,
            team: Number(target.team),
            tx1: payload.tx1,
            tx2: payload.tx2,
            gk: payload.gk,
            ck: payload.ck,
            avg: payload.avg,
            note: payload.compiledNote,
            updatedBy: classConfig.teacherName,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(scoreRef, {
            ownerUid: user.uid,
            code: target.code,
            fullName: target.fullName,
            team: Number(target.team),
            subject: subjectLabelWithSemester,
            tx1: payload.tx1,
            tx2: payload.tx2,
            gk: payload.gk,
            ck: payload.ck,
            avg: payload.avg,
            note: payload.compiledNote,
            updatedBy: classConfig.teacherName,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        // Ghi nhớ liên kết Mã vnEdu <-> studentId theo lớp/trường/năm học cho các lần nhập sau
        const shouldSaveLink =
          Boolean(item.vneduCode) &&
          (item.resolution.type === 'confirm'
            ? item.resolution.saveLink
            : item.status === 'matched_auto' || item.status === 'matched_by_code');

        if (shouldSaveLink) {
          const codeKey = item.vneduCode.toUpperCase();
          nextLinks[codeKey] = {
            vneduCode: codeKey,
            studentId: target.id,
            studentName: target.fullName,
            schoolName: classConfig.schoolName,
            className: classConfig.className,
            schoolYear: classConfig.schoolYear,
            verifiedAt: nowMs,
          };
          linksUpdated = true;
          savedExcelRows.add(item.excelRowNumber);
        }
      }

      if (linksUpdated) {
        persistVneduIdLinks(nextLinks);
        setVneduRowResolutions((prev) => {
          const next = { ...prev };
          savedExcelRows.forEach((rowNum) => {
            delete next[rowNum];
          });
          return next;
        });
      }

      const importedColsSummary = [
        ...vneduAnalysis.txOrders.map((o) => `TX${o}`),
        ...(vneduAnalysis.hasGkMapped ? ['GK'] : []),
        ...(vneduAnalysis.hasCkMapped ? ['CK'] : []),
        ...(vneduAnalysis.hasAvgHkMapped ? ['ĐTB HK'] : []),
        ...(vneduAnalysis.hasAvgCnMapped ? ['ĐTB CN'] : []),
      ]
        .slice(0, 6)
        .join(', ');
      const logSubjectLabel = importedColsSummary
        ? `${subjectLabelWithSemester} [${importedColsSummary}]`.slice(0, 100)
        : subjectLabelWithSemester.slice(0, 100);

      await addDoc(collection(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'vnedu_imports'), {
        ownerUid: user.uid,
        subject: logSubjectLabel,
        studentCount: readyRows.length,
        importedBy: `GVCN ${classConfig.teacherName}`,
        importedAtMs: Date.now(),
        createdAt: serverTimestamp(),
      });

      const skipped = vneduAnalysis.summary.totalRows - readyRows.length;
      showToast(
        skipped > 0
          ? `Đã lưu bảng điểm ${subjectLabelWithSemester} cho ${readyRows.length} HS đã khớp (${skipped} dòng chưa khớp/lỗi đã được bỏ qua)!`
          : `Đã lưu chính thức bảng điểm ${subjectLabelWithSemester} cho ${readyRows.length}/${vneduAnalysis.summary.totalRows} học sinh!`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/workspaces/${classWorkspaceId}/scores`);
    } finally {
      setIsImportingVnedu(false);
    }
  };

  const handleSaveGrade12Profile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || activeRoleId !== 'gvcn' || !editingGrade12Student) return;
    try {
      const g12Ref = doc(
        db,
        'users',
        user.uid,
        'workspaces',
        classWorkspaceId,
        'grade12',
        editingGrade12Student.code
      );
      const existing = await getDoc(g12Ref);
      if (existing.exists()) {
        await updateDoc(g12Ref, {
          studentName: editingGrade12Student.fullName,
          examBlock: grade12Form.examBlock,
          targetUniversity: grade12Form.targetUniversity,
          targetMajor: grade12Form.targetMajor,
          mockScore1: grade12Form.mockScore1,
          mockScore2: grade12Form.mockScore2,
          readiness: grade12Form.readiness,
          teacherNote: grade12Form.teacherNote,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(g12Ref, {
          ownerUid: user.uid,
          studentCode: editingGrade12Student.code,
          studentName: editingGrade12Student.fullName,
          examBlock: grade12Form.examBlock,
          targetUniversity: grade12Form.targetUniversity,
          targetMajor: grade12Form.targetMajor,
          mockScore1: grade12Form.mockScore1,
          mockScore2: grade12Form.mockScore2,
          readiness: grade12Form.readiness,
          teacherNote: grade12Form.teacherNote,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setEditingGrade12Student(null);
      showToast(`Đã cập nhật hồ sơ định hướng lớp 12 cho em ${editingGrade12Student.fullName}!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/workspaces/${classWorkspaceId}/grade12/${editingGrade12Student.code}`);
    }
  };

  const handleRunGeminiAnalysis = async () => {
    if (students.length === 0) {
      showToast('Cần có dữ liệu học sinh đã xác nhận trước khi phân tích.', 'error');
      return;
    }
    setIsGeneratingAiAnalysis(true);
    try {
      const summaryLines = students
        .map((st) => {
          const sc = subjectScores[`${st.code}_${activeSubjectSlug}`];
          const g12 = grade12Profiles[st.code];
          const lockedWeeks = weeklySnapshots.map((w) => w.records?.[st.code]?.rank).filter(Boolean);
          return `- ${st.fullName} (Tổ ${st.team}): ĐTB ${classConfig.subject}=${sc?.avg ?? 'Chưa có'}, Thi đua tuần đã chốt=[${lockedWeeks.join(',') || 'Chưa chốt'}], Nguyện vọng=${g12?.examBlock || 'Chưa cập nhật'}`;
        })
        .join('\n');

      const prompt = `Bạn là trợ lý sư phạm cho GVCN ${classConfig.teacherName}, lớp ${classConfig.className}, trường ${classConfig.schoolName}.
Phạm vi yêu cầu: ${aiAnalysisScope}.
Dưới đây là DỮ LIỆU ĐÃ XÁC NHẬN (tuyệt đối không tự bịa thêm số liệu, không tự kết luận mức rèn luyện cuối kỳ thay giáo viên):
- Sĩ số: ${stats.totalStudents} học sinh.
- ĐTB môn ${classConfig.subject}: ${stats.avgSubjectScore ?? 'Chưa có'}.
- Số tuần thi đua đã chốt: ${weeklySnapshots.length} tuần.
Chi tiết từng học sinh:
${summaryLines}

Hãy viết báo cáo phân tích ngắn gọn, nhân văn bằng tiếng Việt gồm 3 mục:
1. Điểm sáng và sự tiến bộ nổi bật của tập thể lớp.
2. Nhóm học sinh cần quan tâm hỗ trợ học tập bộ môn hoặc ôn thi tốt nghiệp THPT (chỉ nêu đúng theo số liệu trên).
3. Gợi ý 3 hoạt động sinh hoạt chủ nhiệm / phụ đạo thiết thực cho tuần tới.`;

      const headers = await getAuthBearerHeaders();
      const res = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'GEMINI_KEY_NOT_CONNECTED' || data.code === 'GEMINI_KEY_RECONNECT_REQUIRED') {
          setShowGeminiKeyModal(true);
        }
        throw new Error(data.error || 'Không nhận được phản hồi từ máy chủ AI.');
      }
      setAiAnalysisResult(data.text || '');
      showToast('Gemini AI đã hoàn tất phân tích dữ liệu thật!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi phân tích AI.';
      showToast(msg, 'error');
    } finally {
      setIsGeneratingAiAnalysis(false);
    }
  };

  const handleGenerateParentComm = async () => {
    const st = students.find((s) => s.id === selectedCommStudentId);
    if (!st) return;
    setIsGeneratingComm(true);
    try {
      const sc = subjectScores[`${st.code}_${activeSubjectSlug}`];
      const lockedWeeks = weeklySnapshots.map((w) => `${w.weekLabel}:${w.records?.[st.code]?.rank || '?'}`);
      const purposeMap: Record<string, string> = {
        praise: 'Khen ngợi sự tiến bộ và ý thức tích cực',
        grade12_consult: 'Trao đổi phối hợp ôn thi tốt nghiệp THPT lớp 12',
        study_support: 'Phối hợp động viên, hỗ trợ phương pháp học tập',
        attendance_remind: 'Nhắc nhở tế nhị về chuyên cần và nề nếp',
      };
      const toneMap: Record<string, string> = {
        warm: 'Gần gũi, chân thành, khích lệ phụ huynh',
        formal: 'Trang trọng, chuẩn mực hành chính nhà trường',
      };

      const prompt = `GVCN: ${classConfig.teacherName}, Lớp ${classConfig.className}, Trường ${classConfig.schoolName}.
Học sinh: ${st.fullName} (Mã ${st.code}, Tổ ${st.team}).
Mục đích: ${purposeMap[commPurpose] || commPurpose}.
Giọng văn: ${toneMap[commTone] || commTone}.
Điểm môn ${classConfig.subject}: ${sc?.avg ?? 'Chưa nhập'}.
Thi đua tuần: ${lockedWeeks.join(', ') || 'Chưa chốt tuần'}.
Ghi chú thêm của GVCN: ${commExtraContext || 'Không có'}.`;

      const headers = await getAuthBearerHeaders();
      const res = await fetch('/api/gemini/parent-comm', {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'GEMINI_KEY_NOT_CONNECTED' || data.code === 'GEMINI_KEY_RECONNECT_REQUIRED') {
          setShowGeminiKeyModal(true);
        }
        throw new Error(data.error || 'Không gọi được trợ lý AI soạn tin nhắn.');
      }
      setGeneratedMessage(data.message || '');
      setGeneratedReportCardDraft(data.reportCardDraft || '');
      showToast('Gemini AI đã soạn xong tin nhắn phụ huynh & nhận xét học bạ!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi soạn thảo AI.';
      showToast(msg, 'error');
    } finally {
      setIsGeneratingComm(false);
    }
  };

  // Trợ lý Nhận xét Sư phạm AI — Lưu minh chứng GVCN, Nhận xét học bạ và Bản nháp tin nhắn PH (chỉ GVCN)
  const handleSavePedagogicalObservation = async (record: PedagogicalObservationRecord) => {
    if (!user || sessionKind !== 'teacher' || activeRoleId !== 'gvcn') {
      showToast('Chỉ GVCN mới được xác nhận minh chứng sư phạm.', 'error');
      return;
    }
    const docRef = doc(
      db,
      'users',
      user.uid,
      'workspaces',
      classWorkspaceId,
      'pedagogical_observations',
      record.id
    );
    try {
      const existingSnap = await getDoc(docRef);
      const mutablePayload: Record<string, unknown> = {
        moetCode: (record.moetCode || '').slice(0, 60),
        officialConduct: record.officialConduct || '',
        officialAcademic: record.officialAcademic || '',
        verifiedStrengths: (record.verifiedStrengths || '').slice(0, 1200),
        verifiedImprovements: (record.verifiedImprovements || '').slice(0, 1200),
        verifiedAchievements: (record.verifiedAchievements || '').slice(0, 1000),
        verifiedIncidentNote: (record.verifiedIncidentNote || '').slice(0, 1200),
        incidentStatus: record.incidentStatus || 'none',
        sourceLabel: (record.sourceLabel || 'GVCN xác nhận trực tiếp').slice(0, 200),
        confirmedByEmail: (record.confirmedByEmail || user.email || 'gvcn').slice(0, 200),
        confirmedAtMs: record.confirmedAtMs || Date.now(),
        updatedAt: serverTimestamp(),
      };
      if (existingSnap.exists()) {
        await updateDoc(docRef, mutablePayload);
      } else {
        await setDoc(docRef, {
          ownerUid: user.uid,
          studentId: record.studentId.slice(0, 60),
          studentCode: record.studentCode.slice(0, 40),
          semester: record.semester,
          ...mutablePayload,
          createdAt: serverTimestamp(),
        });
      }
      showToast('Đã lưu & xác nhận minh chứng sư phạm của GVCN.');
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.WRITE,
        `users/${user.uid}/workspaces/${classWorkspaceId}/pedagogical_observations/${record.id}`
      );
      showToast('Không thể lưu minh chứng sư phạm. Vui lòng thử lại.', 'error');
    }
  };

  const handleSaveReportCardComment = async (record: ReportCardCommentRecord) => {
    if (!user || sessionKind !== 'teacher' || activeRoleId !== 'gvcn') {
      showToast('Chỉ GVCN mới được lưu hoặc duyệt nhận xét học bạ.', 'error');
      return;
    }
    const docRef = doc(
      db,
      'users',
      user.uid,
      'workspaces',
      classWorkspaceId,
      'report_card_comments',
      record.id
    );
    try {
      const existingSnap = await getDoc(docRef);
      const mutablePayload: Record<string, unknown> = {
        moetCode: (record.moetCode || '').slice(0, 60),
        studentName: record.studentName.slice(0, 150),
        ...(typeof record.rosterOrder === 'number' ? { rosterOrder: record.rosterOrder } : {}),
        schoolYear: (record.schoolYear || classConfig.schoolYear).slice(0, 40),
        lengthMode: record.lengthMode,
        schoolTemplate: (record.schoolTemplate || '').slice(0, 400),
        maxChars: typeof record.maxChars === 'number' ? Math.max(0, Math.min(2000, record.maxChars)) : 0,
        currentDraft: record.currentDraft.slice(0, 2000),
        teacherEdited: Boolean(record.teacherEdited),
        status: record.status,
        ...(record.approvedByEmail ? { approvedByEmail: record.approvedByEmail.slice(0, 200) } : {}),
        ...(typeof record.approvedAtMs === 'number' ? { approvedAtMs: record.approvedAtMs } : {}),
        versions: (record.versions || []).slice(0, 15),
        updatedAt: serverTimestamp(),
      };
      if (existingSnap.exists()) {
        await updateDoc(docRef, mutablePayload);
      } else {
        await setDoc(docRef, {
          ownerUid: user.uid,
          studentId: record.studentId.slice(0, 60),
          studentCode: record.studentCode.slice(0, 40),
          semester: record.semester,
          ...mutablePayload,
          createdAt: serverTimestamp(),
        });
      }
      showToast(
        record.status === 'approved_locked'
          ? `Đã duyệt & khóa nhận xét học bạ chính thức cho ${record.studentName}!`
          : `Đã lưu bản nháp nhận xét học bạ cho ${record.studentName}.`
      );
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.WRITE,
        `users/${user.uid}/workspaces/${classWorkspaceId}/report_card_comments/${record.id}`
      );
      showToast('Không thể lưu nhận xét học bạ. Vui lòng thử lại.', 'error');
    }
  };

  const handleSaveParentMessage = async (record: ParentMessageRecord) => {
    if (!user || sessionKind !== 'teacher' || activeRoleId !== 'gvcn') {
      showToast('Chỉ GVCN mới được lưu bản nháp tin nhắn phụ huynh.', 'error');
      return;
    }
    const docRef = doc(
      db,
      'users',
      user.uid,
      'workspaces',
      classWorkspaceId,
      'parent_messages',
      record.id
    );
    try {
      const existingSnap = await getDoc(docRef);
      const mutablePayload: Record<string, unknown> = {
        moetCode: (record.moetCode || '').slice(0, 60),
        studentName: record.studentName.slice(0, 150),
        recipientName: (record.recipientName || '').slice(0, 150),
        purpose: record.purpose,
        salutation: (record.salutation || 'Kính gửi quý phụ huynh,').slice(0, 180),
        tone: record.tone,
        incidentStatus: record.incidentStatus || 'none',
        currentDraft: record.currentDraft.slice(0, 3000),
        teacherEdited: Boolean(record.teacherEdited),
        status: record.status,
        ...(record.approvedByEmail ? { approvedByEmail: record.approvedByEmail.slice(0, 200) } : {}),
        ...(typeof record.approvedAtMs === 'number' ? { approvedAtMs: record.approvedAtMs } : {}),
        versions: (record.versions || []).slice(0, 15),
        updatedAt: serverTimestamp(),
      };
      if (existingSnap.exists()) {
        await updateDoc(docRef, mutablePayload);
      } else {
        await setDoc(docRef, {
          ownerUid: user.uid,
          studentId: record.studentId.slice(0, 60),
          studentCode: record.studentCode.slice(0, 40),
          semester: record.semester,
          ...mutablePayload,
          createdAt: serverTimestamp(),
        });
      }
      showToast(
        record.status === 'approved_ready'
          ? `Đã đánh dấu bản tin nhắn sẵn sàng sao chép cho phụ huynh em ${record.studentName}.`
          : `Đã lưu bản nháp tin nhắn phụ huynh cho em ${record.studentName}.`
      );
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.WRITE,
        `users/${user.uid}/workspaces/${classWorkspaceId}/parent_messages/${record.id}`
      );
      showToast('Không thể lưu bản nháp tin nhắn phụ huynh. Vui lòng thử lại.', 'error');
    }
  };

  // Trung tâm hỗ trợ học tập bộ môn handlers
  const handleAddKnowledgeTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || activeRoleId !== 'gvcn') return;
    if (!newTopicForm.topicName.trim() || !newTopicForm.skillName.trim()) {
      showToast('Vui lòng nhập Tên chủ đề và Dạng bài / Kỹ năng cần đạt.', 'error');
      return;
    }
    try {
      const topicId = `${activeSubjectSlug.slice(0, 16)}_TOP_${Date.now()}`.slice(0, 60);
      await setDoc(doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'subject_topics', topicId), {
        ownerUid: user.uid,
        subjectKey: activeSubjectWorkspaceKey,
        id: topicId,
        semester: newTopicForm.semester,
        topicName: newTopicForm.topicName.trim(),
        skillName: newTopicForm.skillName.trim(),
        requirement: newTopicForm.requirement.trim(),
        createdBy: classConfig.teacherName,
        createdAtMs: Date.now(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewTopicForm((prev) => ({ ...prev, skillName: '', requirement: '' }));
      showToast(`Đã thêm nội dung kiến thức vào môn ${classConfig.subject}!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/workspaces/${classWorkspaceId}/subject_topics`);
    }
  };

  const handleUpdateKnowledgeTopic = async (
    topicId: string,
    updated: { semester: string; topicName: string; skillName: string; requirement: string }
  ): Promise<boolean> => {
    if (!user || activeRoleId !== 'gvcn') return false;
    if (!updated.topicName.trim() || !updated.skillName.trim()) {
      showToast('Vui lòng nhập đầy đủ Tên chủ đề và Kỹ năng cần đạt.', 'error');
      return false;
    }
    try {
      await updateDoc(
        doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'subject_topics', topicId),
        {
          semester: updated.semester,
          topicName: updated.topicName.trim(),
          skillName: updated.skillName.trim(),
          requirement: updated.requirement.trim(),
          updatedAt: serverTimestamp(),
        }
      );
      showToast('Đã cập nhật chủ đề kiến thức!');
      return true;
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `users/${user.uid}/workspaces/${classWorkspaceId}/subject_topics/${topicId}`
      );
      return false;
    }
  };

  const handleDeleteKnowledgeTopic = async (topicId: string, skillName: string) => {
    if (!user || activeRoleId !== 'gvcn') return;
    try {
      await deleteDoc(
        doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'subject_topics', topicId)
      );
      showToast(`Đã xóa chủ đề / kỹ năng "${skillName}".`);
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.DELETE,
        `users/${user.uid}/workspaces/${classWorkspaceId}/subject_topics/${topicId}`
      );
    }
  };

  const handleApplyBatchQuickCheckLevel = (level: QuickCheckLevel) => {
    if (qcSelectedIds.length === 0) {
      showToast('Hãy chọn ít nhất 1 học sinh để cập nhật hàng loạt.', 'error');
      return;
    }
    setQcDraftMap((prev) => {
      const next = { ...prev };
      qcSelectedIds.forEach((code) => {
        next[code] = { ...(next[code] || {}), level };
      });
      return next;
    });
    showToast(`Đã gán mức đánh giá cho ${qcSelectedIds.length} học sinh được chọn.`);
  };

  const handleSaveQuickChecks = async () => {
    if (!user || activeRoleId !== 'gvcn') {
      showToast('Chỉ giáo viên bộ môn / GVCN mới có quyền xác nhận đánh giá hiểu bài.', 'error');
      return;
    }
    const topicObj = knowledgeTopics.find((t) => t.id === qcTopicId);
    if (!topicObj) {
      showToast('Vui lòng chọn Chủ đề & Nội dung kiến thức trước khi lưu.', 'error');
      return;
    }

    const entriesToSave = students.filter((st) => {
      const d = qcDraftMap[st.code];
      return d && d.level && d.level !== 'unassessed';
    });

    if (entriesToSave.length === 0) {
      showToast('Chưa có học sinh nào được đánh giá.', 'error');
      return;
    }

    setIsSavingQuickCheck(true);
    try {
      for (const st of entriesToSave) {
        const draft = qcDraftMap[st.code];
        const recordId = `${activeSubjectSlug.slice(0, 14)}_${qcDate}_${topicObj.id.slice(0, 28)}_${st.code}`.slice(0, 120);
        const qcRef = doc(
          db,
          'users',
          user.uid,
          'workspaces',
          classWorkspaceId,
          'subject_quick_checks',
          recordId
        );
        const existingQc = await getDoc(qcRef);
        if (existingQc.exists()) {
          await updateDoc(qcRef, {
            evidenceType: qcEvidenceType,
            level: draft.level,
            note: (draft.note || '').trim(),
            confirmedBy: classConfig.teacherName,
            timestampMs: Date.now(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(qcRef, {
            ownerUid: user.uid,
            subjectKey: activeSubjectWorkspaceKey,
            date: qcDate,
            topicId: topicObj.id,
            topicName: topicObj.topicName,
            skillName: topicObj.skillName,
            semester: topicObj.semester,
            studentCode: st.code,
            studentName: st.fullName,
            team: Number(st.team),
            evidenceType: qcEvidenceType,
            level: draft.level,
            note: (draft.note || '').trim(),
            confirmedBy: classConfig.teacherName,
            timestampMs: Date.now(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
      showToast(`Đã xác nhận đánh giá hiểu bài cho ${entriesToSave.length} học sinh!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/workspaces/${classWorkspaceId}/subject_quick_checks`);
    } finally {
      setIsSavingQuickCheck(false);
    }
  };

  const handleSaveErrorLogs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || activeRoleId !== 'gvcn') {
      showToast('Chỉ giáo viên giảng dạy mới có quyền ghi nhận sổ tay lỗi sai.', 'error');
      return;
    }
    if (errSelectedStudentCodes.length === 0) {
      showToast('Vui lòng chọn ít nhất 1 học sinh mắc lỗi cần ghi nhận.', 'error');
      return;
    }
    const topicObj = knowledgeTopics.find((t) => t.id === errTopicId);
    if (!topicObj) {
      showToast('Vui lòng chọn nội dung kiến thức liên quan.', 'error');
      return;
    }
    const finalCategory =
      errCategory === 'Lỗi khác do giáo viên nhập'
        ? errCustomCategory.trim() || 'Lỗi khác'
        : errCategory;

    setIsSavingErrorLog(true);
    try {
      for (const code of errSelectedStudentCodes) {
        const st = students.find((s) => s.code === code);
        if (!st) continue;
        await addDoc(
          collection(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'subject_error_logs'),
          {
            ownerUid: user.uid,
            subjectKey: activeSubjectWorkspaceKey,
            date: errDate,
            topicId: topicObj.id,
            topicName: topicObj.topicName,
            skillName: topicObj.skillName,
            semester: topicObj.semester,
            studentCode: st.code,
            studentName: st.fullName,
            team: Number(st.team),
            errorCategory: finalCategory,
            note: errNote.trim(),
            remedy: errRemedy.trim(),
            status: 'unfixed',
            recordedBy: classConfig.teacherName,
            timestampMs: Date.now(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }
        );
      }
      setErrNote('');
      setErrRemedy('');
      setErrSelectedStudentCodes([]);
      showToast(`Đã ghi nhận lỗi "${finalCategory}" cho ${errSelectedStudentCodes.length} học sinh!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/workspaces/${classWorkspaceId}/subject_error_logs`);
    } finally {
      setIsSavingErrorLog(false);
    }
  };

  const handleToggleErrorFixedStatus = async (errItem: ErrorLogRecord) => {
    if (!user || activeRoleId !== 'gvcn') return;
    try {
      const nextStatus = errItem.status === 'fixed' ? 'unfixed' : 'fixed';
      await updateDoc(
        doc(db, 'users', user.uid, 'workspaces', classWorkspaceId, 'subject_error_logs', errItem.id),
        {
          status: nextStatus,
          fixedAt: nextStatus === 'fixed' ? new Date().toISOString().split('T')[0] : null,
          updatedAt: serverTimestamp(),
        }
      );
      showToast(
        nextStatus === 'fixed'
          ? 'Đã đánh dấu học sinh khắc phục xong lỗi!'
          : 'Đã chuyển lại trạng thái Chưa sửa.'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/workspaces/${classWorkspaceId}/subject_error_logs/${errItem.id}`);
    }
  };

  const exportCsvFile = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const escapeCell = (val: string | number) => {
      const str = val === null || val === undefined ? '' : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };
    const csvContent =
      '\uFEFF' + [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Đã xuất tệp ${filename}!`);
  };

  // Thống kê tổng hợp
  const stats = useMemo(() => {
    const totalStudents = students.length;
    const pendingTickets = tickets.filter((t) => t.status === 'pending');
    const approvedTickets = tickets.filter((t) => t.status === 'approved');
    const approvedFundTickets = approvedTickets.filter((t) => t.type === 'thu_chi');
    const totalIncome = approvedFundTickets
      .filter((t) => t.category === 'Thu quỹ')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const totalExpense = approvedFundTickets
      .filter((t) => t.category === 'Chi quỹ')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const currentSubjectScores = Object.values(subjectScores).filter(
      (s) => s.id && s.id.endsWith(`_${activeSubjectSlug}`) && typeof s.avg === 'number'
    );
    const avgSubjectScore =
      currentSubjectScores.length > 0
        ? (
            currentSubjectScores.reduce((sum, s) => sum + Number(s.avg || 0), 0) /
            currentSubjectScores.length
          ).toFixed(2)
        : null;

    const latestLocked = weeklySnapshots.length > 0 ? weeklySnapshots[weeklySnapshots.length - 1] : null;
    const teamStandings = [1, 2, 3, 4]
      .map((teamNum) => {
        const members = students.filter((s) => Number(s.team) === teamNum);
        const lockedTeamInfo = latestLocked?.teamStats?.find((t) => t.team === teamNum);
        return {
          team: teamNum,
          memberCount: lockedTeamInfo ? lockedTeamInfo.lockedSize : members.length,
          countA: lockedTeamInfo ? lockedTeamInfo.countA : 0,
          countB: lockedTeamInfo ? lockedTeamInfo.countB : 0,
          countC: lockedTeamInfo ? lockedTeamInfo.countC : 0,
          rateA: lockedTeamInfo ? lockedTeamInfo.rateA : 0,
        };
      })
      .sort((a, b) => b.rateA - a.rateA);

    const scoreDistribution = {
      gioi: currentSubjectScores.filter((s) => (s.avg ?? 0) >= 8.0).length,
      kha: currentSubjectScores.filter((s) => (s.avg ?? 0) >= 6.5 && (s.avg ?? 0) < 8.0).length,
      trungBinh: currentSubjectScores.filter((s) => (s.avg ?? 0) >= 5.0 && (s.avg ?? 0) < 6.5).length,
      canHoTro: currentSubjectScores.filter((s) => (s.avg ?? 0) < 5.0).length,
    };

    const earlyWarnings = students
      .filter((st) => {
        const sc = subjectScores[`${st.code}_${activeSubjectSlug}`];
        const lowMerit = Number(st.meritPoints ?? 100) < 95;
        const lowScore = sc && typeof sc.avg === 'number' && sc.avg < 5.5;
        return lowMerit || lowScore;
      })
      .map((st) => {
        const sc = subjectScores[`${st.code}_${activeSubjectSlug}`];
        const reasons: string[] = [];
        if (Number(st.meritPoints ?? 100) < 95) reasons.push(`Điểm rèn luyện ${st.meritPoints}đ`);
        if (sc && typeof sc.avg === 'number' && sc.avg < 5.5) reasons.push(`ĐTB ${classConfig.subject}: ${sc.avg}`);
        return { ...st, reasons };
      });

    return {
      totalStudents,
      pendingCount: pendingTickets.length,
      approvedCount: approvedTickets.length,
      fundBalance: Number(classConfig.fundBalance || 0),
      totalIncome,
      totalExpense,
      approvedFundTickets,
      avgSubjectScore,
      scoredStudentsCount: currentSubjectScores.length,
      teamStandings,
      scoreDistribution,
      earlyWarnings,
    };
  }, [students, tickets, classConfig.fundBalance, classConfig.subject, subjectScores, activeSubjectSlug, weeklySnapshots]);

  const filteredStudents = useMemo(() => {
    const q = searchStudent.toLowerCase().trim();
    return students.filter((s) => {
      const matchSearch =
        !q ||
        (s.fullName || '').toLowerCase().includes(q) ||
        (s.code || '').toLowerCase().includes(q) ||
        (s.moetCode || '').toLowerCase().includes(q);
      const matchTeam = filterTeam === 'all' || String(s.team) === String(filterTeam);
      return matchSearch && matchTeam;
    });
  }, [students, searchStudent, filterTeam]);

  // Màn hình chờ kết nối Firebase Auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-bold text-slate-800">Đang kết nối Firebase Authentication & Firestore...</h2>
        <p className="text-sm text-slate-500 mt-1">GVCN 360 AI PRO – Trợ lý chủ nhiệm thông minh</p>
      </div>
    );
  }

  // Trang chào công khai & cổng đăng nhập 2 lựa chọn khi chưa đăng nhập
  if (!user) {
    return <AuthGate authError={authError} />;
  }

  // Nhánh Cán bộ lớp thật: xác minh officer_memberships/{uid} và bắt buộc đổi mật khẩu lần đầu nếu được yêu cầu
  if (sessionKind === 'officer') {
    if (officerMembershipLoading || !officerMembership) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
          <div className="w-12 h-12 border-4 border-[#0C9BA6] border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="text-lg font-bold text-[#102744]">Đang xác minh quyền Cán bộ lớp...</h2>
          <p className="text-sm text-slate-500 mt-1">Kiểm tra phân quyền lớp học thực tế trên Cloud Firestore</p>
        </div>
      );
    }

    if (officerMembership.mustChangePassword) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/40 to-slate-100">
          <OfficerChangePasswordModal
            open
            forced
            nickname={officerMembership.nickname}
            studentName={officerMembership.studentName}
            onSuccess={handleOfficerPasswordChanged}
          />
        </div>
      );
    }
  } else {
    // Kiểm tra quyền giáo viên thực tế từ Firestore
    if (teacherAccessState === 'checking') {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
          <div className="w-12 h-12 border-4 border-[#0C9BA6] border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="text-lg font-bold text-[#102744]">Đang xác minh quyền truy cập Giáo viên...</h2>
          <p className="text-sm text-slate-500 mt-1">Kiểm tra hồ sơ phê duyệt theo tài khoản Google của bạn</p>
        </div>
      );
    }

    // Chặn hoàn toàn Gmail chưa được phê duyệt (hiển thị màn hình Chờ cấp quyền)
    if (teacherAccessState !== 'approved') {
      return (
        <PendingTeacherGate
          userEmail={user.email || ''}
          userDisplayName={user.displayName || ''}
          accessState={teacherAccessState}
          existingRequest={teacherAccessRequest}
          onSubmitRequest={handleSubmitTeacherAccessRequest}
          onRefreshStatus={handleRefreshTeacherAccessStatus}
          isSubmitting={isSubmittingAccessRequest}
        />
      );
    }

    // Giáo viên mới đã được duyệt nhưng chưa khởi tạo lớp đầu tiên
    if (needsFirstWorkspaceSetup) {
      return (
        <NewTeacherSetupGate
          userEmail={user.email || ''}
          defaultTeacherName={teacherAccessRequest?.displayName || user.displayName || ''}
          defaultSchool={teacherAccessRequest?.requestedSchool || ''}
          defaultClass={teacherAccessRequest?.requestedClass || ''}
          defaultSubject={teacherAccessRequest?.requestedSubject || ''}
          defaultYear={teacherAccessRequest?.requestedYear || '2026–2027'}
          onCreateFirstWorkspace={handleCreateFirstTeacherWorkspace}
          isSaving={isCreatingFirstWorkspace}
        />
      );
    }

    // Chờ tải cấu hình lớp học chính thức của giáo viên trước khi mở Dashboard
    if (!classConfigLoaded || !classWorkspaceId) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
          <div className="w-12 h-12 border-4 border-[#0C9BA6] border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="text-lg font-bold text-[#102744]">Đang tải không gian lớp học của bạn...</h2>
          <p className="text-sm text-slate-500 mt-1">GVCN 360 AI PRO – Trợ lý chủ nhiệm thông minh</p>
        </div>
      );
    }

    // Bước 2: Sau khi đăng nhập Google thành công, nếu giáo viên chưa kết nối Gemini API key cá nhân
    if (geminiKeyStatus.loading && !geminiKeyStatus.loaded) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
          <div className="w-12 h-12 border-4 border-[#0C9BA6] border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="text-lg font-bold text-[#102744]">Đang kiểm tra kết nối Gemini AI cá nhân...</h2>
          <p className="text-sm text-slate-500 mt-1">Bảo mật riêng theo tài khoản giáo viên</p>
        </div>
      );
    }

    if (geminiKeyStatus.loaded && !geminiKeyStatus.connected && geminiStep2DismissedUid !== user.uid) {
      return (
        <GeminiKeySetupPanel
          mode="step2_screen"
          teacherEmail={user.email || ''}
          teacherName={classConfig.teacherName || user.displayName || 'GVCN'}
          classLabel={classConfig.className ? `Lớp ${classConfig.className}` : undefined}
          keyStatus={geminiKeyStatus}
          onStatusUpdated={(next) => {
            setGeminiKeyStatus(next);
            if (next.connected) {
              setGeminiStep2DismissedUid(user.uid);
            }
          }}
          onContinueWithoutAi={() => setGeminiStep2DismissedUid(user.uid)}
          onSignOut={() => void handleSignOut()}
          onToast={showToast}
        />
      );
    }
  }

  const navItems: {
    id: string;
    label: string;
    icon: typeof LayoutDashboard;
    group: string;
    count?: number;
    badge?: number;
  }[] = [
    // Không gian làm việc riêng cho Lớp trưởng (đúng 5 menu khi chỉ giữ vai trò Lớp trưởng)
    { id: 'monitor_overview', label: 'Tổng quan lớp trưởng', icon: LayoutDashboard, group: 'Không gian Lớp trưởng' },
    { id: 'monitor_attendance', label: 'Theo dõi chuyên cần', icon: ClipboardCheck, group: 'Không gian Lớp trưởng' },
    { id: 'monitor_report', label: 'Báo cáo tình hình lớp', icon: FileText, group: 'Không gian Lớp trưởng' },
    { id: 'monitor_tickets', label: 'Phiếu đã gửi', icon: Send, group: 'Không gian Lớp trưởng' },
    { id: 'monitor_account', label: 'Tài khoản', icon: UserCircle, group: 'Không gian Lớp trưởng' },
    { id: 'dashboard', label: 'Dashboard điều hành', icon: LayoutDashboard, group: 'Quán xuyến lớp học' },
    { id: 'students', label: 'Hồ sơ học sinh', icon: Users, count: stats.totalStudents, group: 'Quán xuyến lớp học' },
    { id: 'attendance', label: 'Điểm danh hằng ngày', icon: ClipboardCheck, group: 'Quán xuyến lớp học' },
    { id: 'emulation_standards', label: '1. Tiêu chuẩn thi đua', icon: ListChecks, group: 'Thi đua & Kiểm duyệt' },
    { id: 'tickets', label: '2. Báo cáo và đề xuất', icon: FilePlus2, group: 'Thi đua & Kiểm duyệt' },
    { id: 'moderation', label: '3. Trung tâm kiểm duyệt', icon: CheckCircle2, badge: stats.pendingCount, group: 'Thi đua & Kiểm duyệt' },
    { id: 'discipline', label: '4. Thi đua cá nhân A/B/C', icon: Award, group: 'Thi đua & Kiểm duyệt' },
    { id: 'team_emulation', label: '5. Thi đua 4 tổ', icon: Trophy, group: 'Thi đua & Kiểm duyệt' },
    { id: 'semester_emulation', label: '6. Tổng hợp học kỳ', icon: Scale, group: 'Thi đua & Kiểm duyệt' },
    { id: 'emulation_history', label: '7. Lịch sử điều chỉnh', icon: History, group: 'Thi đua & Kiểm duyệt' },
    { id: 'fund', label: 'Sổ quỹ lớp', icon: DollarSign, group: 'Thi đua & Kiểm duyệt' },
    { id: 'plans', label: 'Kế hoạch & Chi đoàn', icon: Calendar, group: 'Thi đua & Kiểm duyệt' },
    { id: 'my_subject', label: `Môn tôi dạy (${classConfig.subject})`, icon: BookOpen, group: 'Công cụ giáo viên' },
    { id: 'lucky_wheel', label: 'Vòng quay may mắn – Gọi tên học sinh', icon: Aperture, group: 'Công cụ giáo viên' },
    { id: 'vnedu_import', label: 'Nhập điểm Excel vnEdu', icon: FileSpreadsheet, group: 'Công cụ giáo viên' },
    { id: 'grade12', label: 'Theo dõi học tập lớp 12', icon: GraduationCap, group: 'Công cụ giáo viên' },
    { id: 'ai_analysis', label: 'Phân tích học tập AI', icon: Bot, group: 'Công cụ giáo viên' },
    { id: 'parent_comm', label: 'Trợ lý Nhận xét Sư phạm AI', icon: MessageSquareHeart, group: 'Công cụ giáo viên' },
    { id: 'reports', label: 'Báo cáo & Xuất dữ liệu', icon: FileBarChart2, group: 'Công cụ giáo viên' },
    { id: 'roles', label: 'Phân quyền 8 vị trí', icon: ShieldCheck, group: 'Hệ thống' },
    { id: 'gemini_key', label: 'Kết nối Gemini AI cá nhân', icon: KeyRound, group: 'Hệ thống' },
    { id: 'config', label: 'Cấu hình Lớp & Năm học', icon: Settings, group: 'Hệ thống' },
  ];

  const visibleNavItems = officerAllowedTabs
    ? navItems.filter((item) => officerAllowedTabs.has(item.id))
    : navItems.filter((item) => !item.id.startsWith('monitor_'));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row font-sans">
      {/* Toast thông báo nổi */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium transition-all ${
            toast.type === 'error'
              ? 'bg-rose-950 text-white border-rose-700'
              : 'bg-slate-900 text-white border-teal-500'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Sidebar Desktop */}
      <aside className="hidden md:flex md:w-72 bg-gradient-to-b from-[#0f172a] via-[#102744] to-[#0C9BA6] text-slate-100 flex-col shrink-0 border-r border-white/10 shadow-xl">
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center shadow-lg ring-1 ring-white/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight text-white">GVCN 360 AI PRO</h1>
              <p className="text-xs text-teal-300 font-medium">
                {isRealMonitor ? 'Không gian Lớp trưởng' : 'Phiên bản Hoàn thiện • 4.2'}
              </p>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-white/10 border border-white/15 backdrop-blur-xs text-xs space-y-1">
            <div className="flex items-center justify-between text-slate-200/80">
              <span>{classConfig.schoolName}</span>
              <span className="text-teal-300 font-semibold">{classConfig.schoolYear}</span>
            </div>
            <div className="font-bold text-sm text-white flex items-center justify-between">
              <span>Lớp {classConfig.className}</span>
              <span className="text-xs font-normal px-2 py-0.5 rounded bg-white/15 text-white border border-white/15">
                {isRealMonitor ? 'Lớp trưởng' : `Môn ${classConfig.subject}`}
              </span>
            </div>
            <div className="text-slate-200 pt-0.5">
              GVCN: <strong className="text-white">{classConfig.teacherName}</strong>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item, idx) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            const showGroupHeader = idx === 0 || visibleNavItems[idx - 1].group !== item.group;
            return (
              <React.Fragment key={item.id}>
                {showGroupHeader && (
                  <div className="px-3.5 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-teal-200/95">
                    {item.group}
                  </div>
                )}
                <button
                  type="button"
                  title={item.label}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                    active
                      ? 'bg-white/20 text-white font-semibold border border-white/30 shadow-md backdrop-blur-xs'
                      : 'text-slate-100/90 hover:bg-white/10 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className={item.id === 'lucky_wheel' ? 'leading-snug' : 'truncate'}>
                      {item.label}
                    </span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-400 text-slate-950 shrink-0 shadow-xs">
                      {item.badge}
                    </span>
                  )}
                  {item.count !== undefined && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                        active
                          ? 'bg-[#0f172a]/45 text-white font-semibold'
                          : 'bg-[#0f172a]/35 text-slate-100'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/15 text-xs space-y-2 bg-[#0f172a]/20">
          {isRealOfficer && officerMembership ? (
            <div className="space-y-0.5">
              <div className="text-white font-bold truncate">{officerMembership.studentName}</div>
              <div className="text-teal-200/90 truncate">Nickname: {officerMembership.nickname}</div>
            </div>
          ) : (
            <div className="text-white/90 truncate font-medium" title={user.email || user.uid}>
              {user.displayName || user.email}
            </div>
          )}
          {isRealOfficer && (
            <button
              type="button"
              onClick={() => setShowOfficerChangePasswordModal(true)}
              className="w-full py-2 px-3 rounded-xl bg-teal-500/25 hover:bg-teal-500/35 border border-teal-300/30 text-white font-semibold flex items-center justify-center gap-2 transition-all"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Đổi mật khẩu</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="w-full py-2 px-3 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white font-semibold flex items-center justify-center gap-2 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Header Mobile */}
      <header className="md:hidden bg-gradient-to-r from-[#0f172a] via-[#102744] to-[#0C9BA6] text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center ring-1 ring-white/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm">GVCN 360 AI PRO</div>
            <div className="text-[11px] text-teal-200">
              Lớp {classConfig.className} • {classConfig.schoolName}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 text-white"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-72 bg-gradient-to-b from-[#0f172a] via-[#102744] to-[#0C9BA6] h-full p-4 space-y-1.5 text-white overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pb-3 mb-3 border-b border-white/15 font-bold text-teal-200">
              Menu Điều Hành Lớp {classConfig.className}
            </div>
            {visibleNavItems.map((item, idx) => {
              const Icon = item.icon;
              const showGroupHeader = idx === 0 || visibleNavItems[idx - 1].group !== item.group;
              return (
                <React.Fragment key={item.id}>
                  {showGroupHeader && (
                    <div className="px-3 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-teal-200/95">
                      {item.group}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm text-left transition-all ${
                      activeTab === item.id
                        ? 'bg-white/20 text-white font-semibold border border-white/30 shadow-md'
                        : 'text-slate-100/90 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className={item.id === 'lucky_wheel' ? 'leading-snug' : 'truncate'}>
                        {item.label}
                      </span>
                    </div>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-400 text-slate-950 shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </button>
                </React.Fragment>
              );
            })}
            {isRealOfficer && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShowOfficerChangePasswordModal(true);
                }}
                className="w-full mt-3 py-2 px-3 rounded-xl bg-teal-500/25 hover:bg-teal-500/35 border border-teal-300/30 text-white text-xs font-bold flex items-center justify-center gap-2"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Đổi mật khẩu</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="w-full mt-2 py-2 px-3 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold flex items-center justify-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      )}

      {/* Khu vực nội dung chính */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Thanh trạng thái vai trò phiên làm việc */}
        <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 md:static z-20">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {isRealOfficer ? 'Phiên Cán bộ lớp đã xác thực:' : 'Vai trò phiên làm việc:'}
            </span>
            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${currentRole.badgeColor}`}>
              {currentRole.title}
            </span>
            {isRealOfficer && officerMembership && (
              <span className="text-xs text-slate-600 font-medium">
                {officerMembership.studentName} • <code className="text-[#0C9BA6] font-bold">{officerMembership.nickname}</code>
              </span>
            )}
          </div>

          {isRealOfficer && officerMembership ? (
            <div className="flex items-center gap-2 flex-wrap">
              {officerMembership.roles.length > 1 && (
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  {officerMembership.roles.map((roleId) => {
                    const roleDef = ROLES.find((r) => r.id === roleId);
                    const isSelected = activeRoleId === roleId;
                    return (
                      <button
                        key={roleId}
                        type="button"
                        onClick={() => handleSelectRole(roleId)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-[#102744] text-white shadow-xs'
                            : 'text-slate-600 hover:text-[#102744]'
                        }`}
                      >
                        {roleDef?.title || roleId}
                      </button>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowOfficerChangePasswordModal(true)}
                className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Đổi mật khẩu</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => setShowGeminiKeyModal(true)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                  geminiKeyStatus.connected
                    ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900'
                }`}
                title="Quản lý Gemini API key cá nhân của giáo viên"
              >
                <KeyRound className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {geminiKeyStatus.connected
                    ? `Gemini AI cá nhân: Đã kết nối (${geminiKeyStatus.maskedHint})`
                    : 'Gemini AI cá nhân: Chưa kết nối'}
                </span>
              </button>
              <label htmlFor="role-select" className="text-xs text-slate-500 hidden sm:inline">
                Xem trước giao diện vị trí (GVCN):
              </label>
              <select
                id="role-select"
                value={activeRoleId}
                onChange={(e) => handleSelectRole(e.target.value)}
                className="text-xs sm:text-sm font-medium bg-slate-100 border border-slate-300 rounded-xl px-3 py-1.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-600"
              >
                {ROLES.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.title} {role.id === 'gvcn' ? `(${classConfig.teacherName})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Nội dung phân hệ */}
        <div className="p-4 md:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Không gian làm việc chuyên biệt dành riêng cho Lớp trưởng */}
          {isRealMonitor && officerMembership && activeTab === 'monitor_overview' && (
            <MonitorOverviewTab
              classConfig={classConfig}
              membership={officerMembership}
              currentUserUid={user.uid}
              students={students}
              tickets={tickets}
              attendanceRecords={attendanceRecords}
              onNavigate={setActiveTab}
            />
          )}

          {isRealMonitor && officerMembership && activeTab === 'monitor_attendance' && (
            <MonitorAttendanceTab
              classConfig={classConfig}
              allowDirectClassAttendance={Boolean(officerMembership.allowDirectClassAttendance)}
              students={students}
              tickets={tickets}
              attendanceRecords={attendanceRecords}
              attendanceDate={attendanceDate}
              setAttendanceDate={setAttendanceDate}
              attendanceSession={attendanceSession}
              setAttendanceSession={setAttendanceSession}
              dailyAttendanceDraft={dailyAttendanceDraft}
              setDailyAttendanceDraft={setDailyAttendanceDraft}
              isSavingAttendance={isSavingAttendance}
              onSaveDirectClassAttendanceTicket={handleSaveAttendance}
              onSubmitAttendanceSummary={handleSubmitMonitorAttendanceSummary}
            />
          )}

          {isRealMonitor && officerMembership && activeTab === 'monitor_report' && (
            <MonitorClassReportTab
              classConfig={classConfig}
              onSubmitClassReport={handleSubmitMonitorClassReport}
            />
          )}

          {isRealMonitor && officerMembership && activeTab === 'monitor_tickets' && (
            <MonitorSentTicketsTab
              currentUserUid={user.uid}
              tickets={tickets}
              onResubmitRevisedTicket={handleResubmitRevisedTicket}
            />
          )}

          {isRealMonitor && officerMembership && activeTab === 'monitor_account' && (
            <MonitorAccountTab
              classConfig={classConfig}
              membership={officerMembership}
              onOpenChangePassword={() => setShowOfficerChangePasswordModal(true)}
              onSignOut={() => void handleSignOut()}
            />
          )}

          {!isRealOfficer && activeTab === 'dashboard' && (
            <DashboardTab
              classConfig={classConfig}
              activeRoleId={activeRoleId}
              students={students}
              stats={stats}
              weeklySnapshotsCount={weeklySnapshots.length}
              auditLogs={auditLogs}
              onNavigate={setActiveTab}
              onSeedSampleStudents={handleSeedSampleStudents}
            />
          )}

          {(!officerAllowedTabs || officerAllowedTabs.has('students')) && activeTab === 'students' && (
            <StudentsTab
              activeRoleId={activeRoleId}
              isRealOfficer={isRealOfficer}
              classConfig={classConfig}
              students={students}
              filteredStudents={filteredStudents}
              studentPiiMap={studentPiiMap}
              officerAccounts={officerAccounts}
              officerLoginStatusMap={officerLoginStatusMap}
              permissionAuditLogs={permissionAuditLogs}
              searchStudent={searchStudent}
              setSearchStudent={setSearchStudent}
              filterTeam={filterTeam}
              setFilterTeam={setFilterTeam}
              onSeedSampleStudents={handleSeedSampleStudents}
              onOpenRosterOrderModal={
                !isRealOfficer && activeRoleId === 'gvcn'
                  ? () => setShowRosterOrderModal(true)
                  : undefined
              }
              onOpenBulkModal={() => {
                setBulkWorkbook(null);
                setBulkFileName('');
                setBulkSheetNames([]);
                setBulkSelectedSheet('');
                setBulkHeaders([]);
                setBulkDataRows([]);
                setBulkHeaderRowIndex(-1);
                setBulkColumnMapping({
                  stt: -1,
                  fullName: -1,
                  gender: -1,
                  dob: -1,
                  parentName: -1,
                  parentPhone: -1,
                  moetCode: -1,
                  team: -1,
                  role: -1,
                });
                setBulkStudentText('');
                setBulkParsedRows([]);
                setBulkResolutions({});
                setShowBulkStudentModal(true);
              }}
              onOpenAddModal={() => {
                setEditingStudent(null);
                setStudentForm({
                  code: `HS${String(students.length + 1).padStart(3, '0')}`,
                  moetCode: '',
                  fullName: '',
                  gender: 'Nữ',
                  dob: '',
                  team: 1,
                  role: 'member',
                  secondRole: '',
                  parentName: '',
                  parentPhone: '',
                  note: '',
                });
                setShowStudentModal(true);
              }}
              onOpenEditModal={(st) => {
                const pii = studentPiiMap[st.code] || studentPiiMap[st.id];
                const stRoles = getStudentRoles(st);
                setEditingStudent(st);
                setStudentForm({
                  code: st.code,
                  moetCode: getStudentMoetCode(st),
                  fullName: st.fullName,
                  gender: st.gender,
                  dob: formatDobToDmy(st.dob || ''),
                  team: Number(st.team) || 1,
                  role: stRoles[0] || 'member',
                  secondRole: stRoles[1] || '',
                  parentName: pii?.parentName || '',
                  parentPhone: pii?.parentPhone || '',
                  note: st.note || '',
                });
                setShowStudentModal(true);
              }}
              onDeleteStudent={handleDeleteStudent}
              onOpenDeleteAllModal={() => setShowDeleteAllModal(true)}
              onQuickUpdateStudentRoles={handleQuickUpdateStudentRoles}
              onNavigateToRoles={() => setActiveTab('roles')}
            />
          )}

          {(!officerAllowedTabs || officerAllowedTabs.has('attendance')) && activeTab === 'attendance' && (
            <AttendanceTab
              activeRoleId={activeRoleId}
              currentRole={currentRole}
              students={students}
              attendanceDate={attendanceDate}
              setAttendanceDate={setAttendanceDate}
              attendanceSession={attendanceSession}
              setAttendanceSession={setAttendanceSession}
              dailyAttendanceDraft={dailyAttendanceDraft}
              setDailyAttendanceDraft={setDailyAttendanceDraft}
              isSavingAttendance={isSavingAttendance}
              onSaveAttendance={handleSaveAttendance}
              attendanceRecords={attendanceRecords}
            />
          )}

          {(!officerAllowedTabs || officerAllowedTabs.has('emulation_standards')) && activeTab === 'emulation_standards' && (
            <EmulationStandardsTab
              activeRoleId={activeRoleId}
              emulationStandards={emulationStandards}
              setEmulationStandards={setEmulationStandards}
              teamBonusRule={teamBonusRule}
              setTeamBonusRule={setTeamBonusRule}
              newCriterionText={newCriterionText}
              setNewCriterionText={setNewCriterionText}
              newCriterionGroup={newCriterionGroup}
              setNewCriterionGroup={setNewCriterionGroup}
              onSaveStandards={handleSaveEmulationStandards}
            />
          )}

          {activeTab === 'tickets' && (
            <TicketsTab
              currentRole={currentRole}
              students={students}
              emulationStandards={emulationStandards}
              ticketForm={ticketForm}
              setTicketForm={setTicketForm}
              isSubmittingTicket={isSubmittingTicket}
              onSubmitTicket={handleCreateTicket}
              onOpenAttendanceTab={() => setActiveTab('attendance')}
              tickets={tickets}
            />
          )}

          {!isRealOfficer && activeTab === 'moderation' && (
            <ModerationTab
              activeRoleId={activeRoleId}
              currentRole={currentRole}
              classConfig={classConfig}
              tickets={tickets}
              filteredModerationTickets={filteredModerationTickets}
              eligibleFilteredTickets={eligibleFilteredTickets}
              pendingCount={stats.pendingCount}
              modFilterStatus={modFilterStatus}
              setModFilterStatus={setModFilterStatus}
              modFilterType={modFilterType}
              setModFilterType={setModFilterType}
              selectedTicketIds={selectedTicketIds}
              setSelectedTicketIds={setSelectedTicketIds}
              batchApprovalReport={batchApprovalReport}
              setBatchApprovalReport={setBatchApprovalReport}
              processingTicketId={processingTicketId}
              auditLogs={auditLogs}
              evaluateTicketBatchEligibility={evaluateTicketBatchEligibility}
              onOpenBatchConfirmModal={handleOpenBatchConfirmModal}
              onModerateTicket={handleModerateTicket}
            />
          )}

          {!isRealOfficer && activeTab === 'discipline' && (
            <DisciplineTab
              activeRoleId={activeRoleId}
              currentRole={currentRole}
              students={students}
              selectedEmulationWeek={selectedEmulationWeek}
              setSelectedEmulationWeek={setSelectedEmulationWeek}
              selectedEmulationMonth={selectedEmulationMonth}
              setSelectedEmulationMonth={setSelectedEmulationMonth}
              selectedEmulationSemester={selectedEmulationSemester}
              setSelectedEmulationSemester={setSelectedEmulationSemester}
              disciplineTeamFilter={disciplineTeamFilter}
              setDisciplineTeamFilter={setDisciplineTeamFilter}
              autoRankAEnabled={autoRankAEnabled}
              setAutoRankAEnabled={setAutoRankAEnabled}
              currentLockedSnapshot={currentLockedSnapshot}
              currentWeekDrafts={currentWeekDrafts}
              onUpdateStudentDraft={handleUpdateStudentDraft}
              onMarkScopeSpeaking={handleMarkScopeSpeaking}
              onSaveWeekDrafts={handleSaveWeekDrafts}
              isSavingDrafts={isSavingDrafts}
              getStudentWeekEvidenceSummary={getStudentWeekEvidenceSummary}
              isLockingWeek={isLockingWeek}
              onLockWeek={handleLockWeeklyEmulation}
              onOpenAdjustModal={(data) => {
                setAdjustModalData(data);
                setAdjustNewRank(data.oldRank);
                setAdjustReason('');
              }}
            />
          )}

          {!isRealOfficer && activeTab === 'team_emulation' && (
            <TeamEmulationTab
              selectedEmulationWeek={selectedEmulationWeek}
              setSelectedEmulationWeek={setSelectedEmulationWeek}
              currentLockedSnapshot={currentLockedSnapshot}
              weeklySnapshots={weeklySnapshots}
              teamBonusRule={teamBonusRule}
            />
          )}

          {!isRealOfficer && activeTab === 'semester_emulation' && (
            <SemesterEmulationTab
              students={students}
              tickets={tickets}
              weeklySnapshots={weeklySnapshots}
              emulationStandards={emulationStandards}
              selectedEmulationSemester={selectedEmulationSemester}
              setSelectedEmulationSemester={setSelectedEmulationSemester}
            />
          )}

          {!isRealOfficer && activeTab === 'emulation_history' && <EmulationHistoryTab logs={emulationAdjustLogs} />}

          {(!officerAllowedTabs || officerAllowedTabs.has('fund')) && activeTab === 'fund' && (
            <FundTab
              classConfig={classConfig}
              fundBalance={stats.fundBalance}
              totalIncome={stats.totalIncome}
              totalExpense={stats.totalExpense}
              approvedFundTickets={stats.approvedFundTickets}
              onNavigateToTicket={() => {
                if (!currentRole.allowedTicketTypes.includes('thu_chi')) {
                  showToast(`Vai trò ${currentRole.title} không có quyền lập phiếu Thu / Chi Quỹ lớp.`, 'error');
                  return;
                }
                setTicketForm((prev) => ({ ...prev, type: 'thu_chi', category: 'Thu quỹ' }));
                setActiveTab('tickets');
              }}
            />
          )}

          {(!officerAllowedTabs || officerAllowedTabs.has('plans')) && activeTab === 'plans' && (
            <PlansAndYouthTab
              activeRoleId={activeRoleId}
              classConfig={classConfig}
              plans={plans}
              planForm={planForm}
              setPlanForm={setPlanForm}
              onAddPlan={handleAddPlan}
              onTogglePlanStatus={handleTogglePlanStatus}
              youthActivities={youthActivities}
              youthForm={youthForm}
              setYouthForm={setYouthForm}
              onAddYouthActivity={handleAddYouthActivity}
              onToggleYouthStatus={handleToggleYouthStatus}
            />
          )}

          {!isRealOfficer && activeTab === 'my_subject' && (
            <MySubjectTab
              activeRoleId={activeRoleId}
              classConfig={classConfig}
              students={students}
              subjectScores={subjectScores}
              subjectKey={activeSubjectSlug}
              subjectSubTab={subjectSubTab}
              setSubjectSubTab={setSubjectSubTab}
              knowledgeTopics={knowledgeTopics}
              quickChecks={quickChecks}
              errorLogs={errorLogs}
              kmFilterTeam={kmFilterTeam}
              setKmFilterTeam={setKmFilterTeam}
              kmFilterStudent={kmFilterStudent}
              setKmFilterStudent={setKmFilterStudent}
              kmFilterTopic={kmFilterTopic}
              setKmFilterTopic={setKmFilterTopic}
              kmFilterSemester={kmFilterSemester}
              setKmFilterSemester={setKmFilterSemester}
              kmFilterDateFrom={kmFilterDateFrom}
              setKmFilterDateFrom={setKmFilterDateFrom}
              kmFilterDateTo={kmFilterDateTo}
              setKmFilterDateTo={setKmFilterDateTo}
              newTopicForm={newTopicForm}
              setNewTopicForm={setNewTopicForm}
              onAddKnowledgeTopic={handleAddKnowledgeTopic}
              onUpdateKnowledgeTopic={handleUpdateKnowledgeTopic}
              onDeleteKnowledgeTopic={handleDeleteKnowledgeTopic}
              qcDate={qcDate}
              setQcDate={setQcDate}
              qcTopicId={qcTopicId}
              setQcTopicId={setQcTopicId}
              qcEvidenceType={qcEvidenceType}
              setQcEvidenceType={setQcEvidenceType}
              qcFilterTeam={qcFilterTeam}
              setQcFilterTeam={setQcFilterTeam}
              qcSearch={qcSearch}
              setQcSearch={setQcSearch}
              qcSelectedIds={qcSelectedIds}
              setQcSelectedIds={setQcSelectedIds}
              qcDraftMap={qcDraftMap}
              setQcDraftMap={setQcDraftMap}
              isSavingQuickCheck={isSavingQuickCheck}
              onApplyBatchQuickCheckLevel={handleApplyBatchQuickCheckLevel}
              onSaveQuickChecks={handleSaveQuickChecks}
              errDate={errDate}
              setErrDate={setErrDate}
              errTopicId={errTopicId}
              setErrTopicId={setErrTopicId}
              errCategory={errCategory}
              setErrCategory={setErrCategory}
              errCustomCategory={errCustomCategory}
              setErrCustomCategory={setErrCustomCategory}
              errNote={errNote}
              setErrNote={setErrNote}
              errRemedy={errRemedy}
              setErrRemedy={setErrRemedy}
              errSelectedStudentCodes={errSelectedStudentCodes}
              setErrSelectedStudentCodes={setErrSelectedStudentCodes}
              errFilterStudent={errFilterStudent}
              setErrFilterStudent={setErrFilterStudent}
              errFilterStatus={errFilterStatus}
              setErrFilterStatus={setErrFilterStatus}
              isSavingErrorLog={isSavingErrorLog}
              onSaveErrorLogs={handleSaveErrorLogs}
              onToggleErrorFixedStatus={handleToggleErrorFixedStatus}
              onNavigateToParentComm={(studentId) => {
                setSelectedCommStudentId(studentId);
                setActiveTab('parent_comm');
              }}
              onShowToast={showToast}
              geminiKeyConnected={geminiKeyStatus.connected}
              onOpenGeminiKeySetup={() => setShowGeminiKeyModal(true)}
            />
          )}

          {!isRealOfficer && activeTab === 'lucky_wheel' && (
            <LuckyWheelTab
              key={`${user.uid}_${classWorkspaceId}`}
              userId={user.uid}
              classWorkspaceId={classWorkspaceId}
              classConfig={{
                schoolName: classConfig.schoolName,
                className: classConfig.className,
                schoolYear: classConfig.schoolYear,
                teacherName: classConfig.teacherName,
                subject: classConfig.subject,
              }}
              students={students}
              activeRoleId={activeRoleId}
              currentRole={currentRole}
              allowedRoleIds={luckyWheelAllowedRoles}
              onToggleRolePermission={handleToggleLuckyWheelRolePermission}
              onShowToast={showToast}
            />
          )}

          {!isRealOfficer && activeTab === 'vnedu_import' && (
            <VneduImportTab
              activeRoleId={activeRoleId}
              classConfig={classConfig}
              students={students}
              subjectScores={subjectScores}
              selectedVneduSubject={selectedVneduSubject}
              setSelectedVneduSubject={setSelectedVneduSubject}
              selectedVneduSemester={selectedVneduSemester}
              setSelectedVneduSemester={setSelectedVneduSemester}
              vneduAssessmentMode={vneduAssessmentMode}
              setVneduAssessmentMode={setVneduAssessmentMode}
              preserveExistingWhenBlank={preserveExistingWhenBlank}
              setPreserveExistingWhenBlank={setPreserveExistingWhenBlank}
              vneduFileName={vneduFileName}
              vneduSheetNames={vneduSheetNames}
              vneduSelectedSheet={vneduSelectedSheet}
              onSelectVneduSheet={handleSelectVneduSheet}
              vneduRawText={vneduRawText}
              onPasteRawText={handlePasteVneduRawText}
              vneduMatrix={vneduMatrix}
              vneduHeaderRowIndex={vneduHeaderRowIndex}
              vneduMergeParentHeader={vneduMergeParentHeader}
              onChangeHeaderRow={handleChangeVneduHeaderRow}
              vneduColumns={vneduColumns}
              vneduRoleMap={vneduRoleMap}
              onChangeColumnRole={handleChangeVneduColumnRole}
              vneduAnalysis={vneduAnalysis}
              vneduConfirmedIdLinks={vneduConfirmedIdLinks}
              onRemoveIdLink={handleRemoveVneduIdLink}
              onClearAllIdLinks={handleClearAllVneduIdLinks}
              vneduCodeSystemVerifiedSameAsMoet={vneduCodeSystemVerifiedSameAsMoet}
              setVneduCodeSystemVerifiedSameAsMoet={setVneduCodeSystemVerifiedSameAsMoet}
              vneduAutoConfirmExactNameAndDob={vneduAutoConfirmExactNameAndDob}
              setVneduAutoConfirmExactNameAndDob={setVneduAutoConfirmExactNameAndDob}
              vneduRowResolutions={vneduRowResolutions}
              onSetRowResolution={handleSetVneduRowResolution}
              vneduDeselectedRows={vneduDeselectedRows}
              onToggleRowSelection={handleToggleVneduRowSelection}
              onSelectAllEligible={handleSelectAllEligibleVneduRows}
              onClearSelections={handleClearVneduRowSelections}
              onConfirmDobMismatchGroup={handleConfirmDobMismatchGroup}
              onAutoReconcileAll={handleAutoReconcileAll}
              isRefreshingRoster={isRefreshingVneduRoster}
              rosterRefreshedAtMs={vneduRosterRefreshedAtMs}
              onRefreshRosterAndReconcile={handleRefreshVneduRosterAndReconcile}
              onCancelImport={handleCancelVneduImport}
              vneduImportHistory={vneduImportHistory}
              isReadingExcel={isReadingExcel}
              isImportingVnedu={isImportingVnedu}
              onFileUpload={handleVneduFileUpload}
              onConfirmImport={handleConfirmVneduImport}
            />
          )}

          {!isRealOfficer && activeTab === 'grade12' && (
            <Grade12Tab
              activeRoleId={activeRoleId}
              classConfig={classConfig}
              students={students}
              grade12Profiles={grade12Profiles}
              subjectScores={subjectScores}
              subjectKey={activeSubjectSlug}
              onEditStudent={(st) => {
                const prof = grade12Profiles[st.code];
                setEditingGrade12Student(st);
                setGrade12Form({
                  examBlock: prof?.examBlock || 'A00 (Toán - Lý - Hóa)',
                  targetUniversity: prof?.targetUniversity || '',
                  targetMajor: prof?.targetMajor || '',
                  mockScore1: prof?.mockScore1 || '',
                  mockScore2: prof?.mockScore2 || '',
                  readiness: prof?.readiness || 'Đạt mục tiêu',
                  teacherNote: prof?.teacherNote || '',
                });
              }}
            />
          )}

          {!isRealOfficer && activeTab === 'ai_analysis' && (
            <AiAnalysisTab
              classConfig={classConfig}
              aiAnalysisScope={aiAnalysisScope}
              setAiAnalysisScope={setAiAnalysisScope}
              aiAnalysisResult={aiAnalysisResult}
              isGeneratingAiAnalysis={isGeneratingAiAnalysis}
              onRunAnalysis={handleRunGeminiAnalysis}
              geminiKeyConnected={geminiKeyStatus.connected}
              onOpenGeminiKeySetup={() => setShowGeminiKeyModal(true)}
            />
          )}

          {!isRealOfficer && activeTab === 'parent_comm' && (
            <PedagogicalAssistantTab
              classConfig={classConfig}
              students={students}
              studentPii={studentPiiMap}
              subjectScores={subjectScores}
              activeSubjectSlug={activeSubjectSlug}
              activeSubjectName={classConfig.subject || 'Ngữ văn'}
              weeklySnapshots={weeklySnapshots}
              tickets={tickets}
              grade12Profiles={grade12Profiles}
              observationsById={pedagogicalObservationsMap}
              reportCardCommentsById={reportCardCommentsMap}
              parentMessagesById={parentMessagesMap}
              teacherEmail={user?.email || ''}
              getAuthHeader={getAuthBearerHeaders}
              onSaveObservation={handleSavePedagogicalObservation}
              onSaveReportCardComment={handleSaveReportCardComment}
              onSaveParentMessage={handleSaveParentMessage}
              onToast={(msg) => showToast(msg)}
              geminiKeyConnected={geminiKeyStatus.connected}
              onOpenGeminiKeySetup={() => setShowGeminiKeyModal(true)}
            />
          )}

          {!isRealOfficer && activeTab === 'reports' && (
            <ReportsTab
              classConfig={classConfig}
              students={students}
              tickets={tickets}
              weeklySnapshots={weeklySnapshots}
              subjectScores={subjectScores}
              onExportCsv={exportCsvFile}
            />
          )}

          {!isRealOfficer && activeTab === 'roles' && (
            <RolesTab
              activeRoleId={activeRoleId}
              onSelectRole={handleSelectRole}
              isPrimaryAdmin={isPrimaryAdmin}
              teacherRequests={adminTeacherRequests}
              onUpdateTeacherRequestStatus={handleUpdateTeacherRequestStatus}
              processingTeacherUid={processingTeacherUid}
              classConfig={classConfig}
              students={students}
              officerAccounts={officerAccounts}
              roleAssignments={roleAssignments}
              roleAssignmentHistory={roleAssignmentHistory}
              governance={officerGovernance}
              officerLoginStatusMap={officerLoginStatusMap}
              permissionAuditLogs={permissionAuditLogs}
              onOpenReconciliationModal={() => setShowOfficerReconciliationModal(true)}
              onCreateOfficerAccount={handleCreateOfficerAccount}
              onUpdateOfficerRoles={handleUpdateOfficerRoles}
              onToggleMonitorDirectAttendance={handleToggleMonitorDirectAttendance}
              onToggleOfficerLock={handleToggleOfficerLock}
              onLockOfficerWithReason={handleLockOfficerWithReason}
              onRelinkExistingOfficerAccount={handleRelinkExistingOfficerAccount}
              onActivateOfficerPosition={handleActivateOfficerPosition}
              onRevokeOfficerPosition={handleRevokeOfficerPosition}
              onResetOfficerPassword={handleResetOfficerPassword}
              onBatchResetPasswords={handleBatchResetPasswords}
              onDeleteOfficerAccount={handleDeleteOfficerAccount}
            />
          )}

          {!isRealOfficer && activeTab === 'gemini_key' && (
            <GeminiKeySetupPanel
              mode="tab"
              teacherEmail={user.email || ''}
              teacherName={classConfig.teacherName || user.displayName || 'GVCN'}
              classLabel={classConfig.className ? `Lớp ${classConfig.className}` : undefined}
              keyStatus={geminiKeyStatus}
              onStatusUpdated={setGeminiKeyStatus}
              onToast={showToast}
            />
          )}

          {!isRealOfficer && activeTab === 'config' && (
            <ConfigTab
              activeRoleId={activeRoleId}
              currentRoleTitle={currentRole.title}
              classConfig={classConfig}
              configForm={configForm}
              setConfigForm={setConfigForm}
              savedWorkspaces={savedWorkspaces}
              classWorkspaceId={classWorkspaceId}
              onSaveConfig={handleSaveConfig}
              onSwitchWorkspace={handleSwitchWorkspace}
            />
          )}
        </div>
      </main>

      {/* Các hộp thoại Modal */}
      <StudentModal
        open={showStudentModal}
        onClose={() => setShowStudentModal(false)}
        editingStudent={editingStudent}
        studentForm={studentForm}
        setStudentForm={setStudentForm}
        onSubmit={handleSaveStudent}
      />

      <Grade12Modal
        student={editingGrade12Student}
        onClose={() => setEditingGrade12Student(null)}
        grade12Form={grade12Form}
        setGrade12Form={setGrade12Form}
        onSubmit={handleSaveGrade12Profile}
      />

      <BatchConfirmModal
        modalData={batchConfirmModal}
        classConfig={classConfig}
        modFilterType={modFilterType}
        modFilterStatus={modFilterStatus}
        isBatchApproving={isBatchApproving}
        onClose={() => setBatchConfirmModal(null)}
        onExecute={handleExecuteBatchApproval}
      />

      <BulkStudentModal
        open={showBulkStudentModal}
        onClose={() => setShowBulkStudentModal(false)}
        classConfig={classConfig}
        bulkFileName={bulkFileName}
        bulkSheetNames={bulkSheetNames}
        bulkSelectedSheet={bulkSelectedSheet}
        onSelectSheet={handleSelectBulkSheet}
        bulkHeaders={bulkHeaders}
        bulkColumnMapping={bulkColumnMapping}
        columnMappingWarnings={bulkColumnMappingWarnings}
        onChangeMapping={handleChangeBulkMapping}
        onReconcileAgain={handleReconcileBulkAgain}
        bulkStudentText={bulkStudentText}
        onBulkTextChange={handleBulkTextChange}
        onBulkExcelUpload={handleBulkExcelUpload}
        analysis={bulkImportAnalysis}
        onToggleAllRoleProposals={handleToggleAllRoleProposals}
        onToggleRowRoleProposal={handleToggleRowRoleProposal}
        onUpdateRowTeam={handleUpdateRowTeam}
        onSetRowResolution={handleSetRowResolution}
        isSavingBulkStudents={isSavingBulkStudents}
        onSaveBulkStudents={handleSaveBulkStudents}
      />

      {!isRealOfficer && activeRoleId === 'gvcn' && (
        <RosterOrderUpdateModal
          open={showRosterOrderModal}
          onClose={() => setShowRosterOrderModal(false)}
          classConfig={classConfig}
          students={students}
          isApplying={isApplyingRosterOrder}
          onApplyRosterOrder={handleApplyRosterOrderFromExcel}
        />
      )}

      {!isRealOfficer && activeRoleId === 'gvcn' && (
        <OfficerReconciliationModal
          open={showOfficerReconciliationModal}
          onClose={() => setShowOfficerReconciliationModal(false)}
          classConfig={classConfig}
          workspaceId={classWorkspaceId}
          teacherEmail={user?.email || ''}
          students={students}
          officerAccounts={officerAccounts}
          roleAssignments={roleAssignments}
          officerLoginStatusMap={officerLoginStatusMap}
          governance={officerGovernance}
          onConfirmOfficialAssignments={handleConfirmOfficialRoleAssignments}
          onRelinkExistingOfficerAccount={handleRelinkExistingOfficerAccount}
          onActivateOfficerPosition={handleActivateOfficerPosition}
          onActivateAllSevenPositions={handleActivateAllSevenPositions}
          onRevokeOfficerAccount={handleRevokeOfficerPosition}
        />
      )}

      <AdjustRankModal
        adjustModalData={adjustModalData}
        selectedEmulationWeek={selectedEmulationWeek}
        adjustNewRank={adjustNewRank}
        setAdjustNewRank={setAdjustNewRank}
        adjustReason={adjustReason}
        setAdjustReason={setAdjustReason}
        onClose={() => setAdjustModalData(null)}
        onSubmit={handleAdjustLockedStudentRank}
      />

      <ConfirmDeleteAllStudentsModal
        open={showDeleteAllModal}
        totalStudents={students.length}
        classNameLabel={classConfig.className}
        isDeleting={isDeletingAllStudents}
        onClose={() => setShowDeleteAllModal(false)}
        onConfirm={handleDeleteAllStudents}
      />

      {!isRealOfficer && showGeminiKeyModal && (
        <GeminiKeySetupPanel
          mode="modal"
          teacherEmail={user.email || ''}
          teacherName={classConfig.teacherName || user.displayName || 'GVCN'}
          classLabel={classConfig.className ? `Lớp ${classConfig.className}` : undefined}
          keyStatus={geminiKeyStatus}
          onStatusUpdated={setGeminiKeyStatus}
          onClose={() => setShowGeminiKeyModal(false)}
          onToast={showToast}
        />
      )}

      {isRealOfficer && officerMembership && (
        <OfficerChangePasswordModal
          open={showOfficerChangePasswordModal}
          forced={false}
          nickname={officerMembership.nickname}
          studentName={officerMembership.studentName}
          onSuccess={handleOfficerPasswordChanged}
          onClose={() => setShowOfficerChangePasswordModal(false)}
        />
      )}
    </div>
  );
}
