import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  FileSpreadsheet,
  FlaskConical,
  History,
  Info,
  Lock,
  MessageSquareHeart,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Unlock,
  UserCheck,
  X,
} from 'lucide-react';
import {
  ClassConfig,
  Grade12Profile,
  OfficialTt22Level,
  ParentMessagePurposeId,
  ParentMessageRecord,
  ParentMessageTone,
  PedagogicalIncidentStatus,
  PedagogicalObservationRecord,
  PedagogicalSemester,
  PedagogicalVersionEntry,
  ReportCardCommentRecord,
  ReportCardLengthMode,
  StudentRecord as Student,
  StudentPiiRecord,
  SubjectScoreRecord as SubjectScore,
  TicketRecord as Ticket,
  WeeklySnapshot,
} from '../../types/gvcn';
import {
  AUTO_CHECK_DISCLAIMER,
  buildReportCardExportRows,
  buildVerifiedStudentEvidence,
  countWords,
  evaluatePedagogicalQuality,
  getParentMessageDocId,
  getPedagogicalObservationDocId,
  getReportCardCommentDocId,
  OFFICIAL_TT22_LEVELS,
  PARENT_MESSAGE_PURPOSES,
  PARENT_MESSAGE_TONES,
  PEDAGOGICAL_REFINE_ACTIONS,
  PEDAGOGICAL_SEMESTERS,
  PEDAGOGICAL_TEST_SCENARIOS,
  PedagogicalRefineAction,
  REPORT_CARD_LENGTH_CONFIG,
} from '../../utils/pedagogicalAssistant';
import { isMissingPlaceholderValue } from '../../utils/studentExcelImport';

interface PedagogicalAssistantTabProps {
  classConfig: ClassConfig;
  students: Student[];
  studentPii: Record<string, StudentPiiRecord>;
  subjectScores: Record<string, SubjectScore>;
  activeSubjectSlug: string;
  activeSubjectName: string;
  weeklySnapshots: WeeklySnapshot[];
  tickets: Ticket[];
  grade12Profiles: Record<string, Grade12Profile>;
  observationsById: Record<string, PedagogicalObservationRecord>;
  reportCardCommentsById: Record<string, ReportCardCommentRecord>;
  parentMessagesById: Record<string, ParentMessageRecord>;
  teacherEmail: string;
  getAuthHeader: () => Promise<Record<string, string>>;
  onSaveObservation: (record: PedagogicalObservationRecord) => Promise<void>;
  onSaveReportCardComment: (record: ReportCardCommentRecord) => Promise<void>;
  onSaveParentMessage: (record: ParentMessageRecord) => Promise<void>;
  onToast: (message: string) => void;
  geminiKeyConnected?: boolean;
  onOpenGeminiKeySetup?: () => void;
}

const MAX_VERSION_HISTORY = 15;

function pushVersion(
  existing: PedagogicalVersionEntry[],
  text: string,
  source: PedagogicalVersionEntry['source'],
  actionLabel: string,
  actorEmail: string,
): PedagogicalVersionEntry[] {
  const cleaned = text.trim();
  if (!cleaned) return existing.slice(0, MAX_VERSION_HISTORY);
  if (existing.length > 0 && existing[0].text.trim() === cleaned && existing[0].actionLabel === actionLabel) {
    return existing.slice(0, MAX_VERSION_HISTORY);
  }
  const entry: PedagogicalVersionEntry = {
    versionId: `v_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    text: cleaned,
    source,
    actionLabel,
    actorEmail: actorEmail || 'gvcn',
    savedAtMs: Date.now(),
  };
  return [entry, ...existing].slice(0, MAX_VERSION_HISTORY);
}

function formatDateTime(ms?: number | null): string {
  if (!ms) return '';
  try {
    return new Date(ms).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export const PedagogicalAssistantTab: React.FC<PedagogicalAssistantTabProps> = ({
  classConfig,
  students,
  studentPii,
  subjectScores,
  activeSubjectSlug,
  activeSubjectName,
  weeklySnapshots,
  tickets,
  grade12Profiles,
  observationsById,
  reportCardCommentsById,
  parentMessagesById,
  teacherEmail,
  getAuthHeader,
  onSaveObservation,
  onSaveReportCardComment,
  onSaveParentMessage,
  onToast,
  geminiKeyConnected = true,
  onOpenGeminiKeySetup,
}) => {
  // Sort students strictly by STT Excel (rosterOrder)
  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      const orderA = typeof a.rosterOrder === 'number' ? a.rosterOrder : Number.MAX_SAFE_INTEGER;
      const orderB = typeof b.rosterOrder === 'number' ? b.rosterOrder : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.code.localeCompare(b.code, 'vi');
    });
  }, [students]);

  const [activeSubTab, setActiveSubTab] = useState<'report_card' | 'parent_message'>('report_card');
  const [semester, setSemester] = useState<PedagogicalSemester>('Học kỳ I');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentCode, setSelectedStudentCode] = useState<string>(
    sortedStudents[0]?.code || '',
  );

  useEffect(() => {
    if (!selectedStudentCode && sortedStudents[0]?.code) {
      setSelectedStudentCode(sortedStudents[0].code);
    } else if (
      selectedStudentCode &&
      sortedStudents.length > 0 &&
      !sortedStudents.some((s) => s.code === selectedStudentCode)
    ) {
      setSelectedStudentCode(sortedStudents[0].code);
    }
  }, [selectedStudentCode, sortedStudents]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return sortedStudents;
    return sortedStudents.filter((s) => {
      const stt = typeof s.rosterOrder === 'number' ? String(s.rosterOrder) : '';
      return (
        s.fullName.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.moetCode || '').toLowerCase().includes(q) ||
        stt === q
      );
    });
  }, [sortedStudents, studentSearch]);

  const selectedStudent = useMemo(
    () => sortedStudents.find((s) => s.code === selectedStudentCode) || sortedStudents[0] || null,
    [sortedStudents, selectedStudentCode],
  );

  const selectedStudentId = selectedStudent ? selectedStudent.id || selectedStudent.code : '';
  const selectedPii = selectedStudent ? studentPii[selectedStudent.code] : undefined;
  const cleanParentName =
    selectedPii?.parentName && !isMissingPlaceholderValue(selectedPii.parentName)
      ? selectedPii.parentName.trim()
      : '';
  const cleanParentPhone =
    selectedPii?.parentPhone && !isMissingPlaceholderValue(selectedPii.parentPhone)
      ? selectedPii.parentPhone.trim()
      : '';
  const hasVerifiedParentRecipient = Boolean(cleanParentName || cleanParentPhone);

  // Duplicate name detector in current class
  const hasDuplicateNameInClass = useMemo(() => {
    if (!selectedStudent) return false;
    const norm = selectedStudent.fullName.trim().toLowerCase();
    return sortedStudents.filter((s) => s.fullName.trim().toLowerCase() === norm).length > 1;
  }, [selectedStudent, sortedStudents]);

  const observationDocId = selectedStudentId
    ? getPedagogicalObservationDocId(selectedStudentId, semester)
    : '';
  const existingObservation = observationDocId ? observationsById[observationDocId] || null : null;

  // Evidence strictly for 1 student & 1 semester
  const evidence = useMemo(() => {
    if (!selectedStudent) return null;
    return buildVerifiedStudentEvidence({
      student: selectedStudent,
      semester,
      schoolYear: classConfig.schoolYear,
      activeSubjectSlug,
      activeSubjectName,
      subjectScores,
      weeklySnapshots,
      tickets,
      grade12Profiles,
      observation: existingObservation,
    });
  }, [
    selectedStudent,
    semester,
    classConfig.schoolYear,
    activeSubjectSlug,
    activeSubjectName,
    subjectScores,
    weeklySnapshots,
    tickets,
    grade12Profiles,
    existingObservation,
  ]);

  // ========================================================================
  // GVCN OBSERVATION FORM STATE
  // ========================================================================
  const [showObsForm, setShowObsForm] = useState(false);
  const [obsConduct, setObsConduct] = useState<OfficialTt22Level>('');
  const [obsAcademic, setObsAcademic] = useState<OfficialTt22Level>('');
  const [obsStrengths, setObsStrengths] = useState('');
  const [obsImprovements, setObsImprovements] = useState('');
  const [obsAchievements, setObsAchievements] = useState('');
  const [obsIncidentNote, setObsIncidentNote] = useState('');
  const [obsIncidentStatus, setObsIncidentStatus] = useState<PedagogicalIncidentStatus>('none');
  const [obsSourceLabel, setObsSourceLabel] = useState('GVCN xác nhận trực tiếp');
  const [savingObs, setSavingObs] = useState(false);

  useEffect(() => {
    setObsConduct(existingObservation?.officialConduct || '');
    setObsAcademic(existingObservation?.officialAcademic || '');
    setObsStrengths(existingObservation?.verifiedStrengths || '');
    setObsImprovements(existingObservation?.verifiedImprovements || '');
    setObsAchievements(existingObservation?.verifiedAchievements || '');
    setObsIncidentNote(existingObservation?.verifiedIncidentNote || '');
    setObsIncidentStatus(existingObservation?.incidentStatus || 'none');
    setObsSourceLabel(existingObservation?.sourceLabel || 'GVCN xác nhận trực tiếp');
  }, [observationDocId, existingObservation]);

  const handleSaveObsSubmit = async () => {
    if (!selectedStudent || !selectedStudentId) return;
    setSavingObs(true);
    try {
      await onSaveObservation({
        id: observationDocId,
        studentId: selectedStudentId,
        studentCode: selectedStudent.code,
        moetCode: selectedStudent.moetCode || '',
        semester,
        officialConduct: obsConduct,
        officialAcademic: obsAcademic,
        verifiedStrengths: obsStrengths.trim(),
        verifiedImprovements: obsImprovements.trim(),
        verifiedAchievements: obsAchievements.trim(),
        verifiedIncidentNote: obsIncidentNote.trim(),
        incidentStatus: obsIncidentStatus,
        sourceLabel: obsSourceLabel.trim() || 'GVCN xác nhận trực tiếp',
        confirmedByEmail: teacherEmail || 'gvcn',
        confirmedAtMs: Date.now(),
      });
      setShowObsForm(false);
    } finally {
      setSavingObs(false);
    }
  };

  // ========================================================================
  // TAB 1: REPORT CARD COMMENT STATE
  // ========================================================================
  const reportCardDocId = selectedStudentId
    ? getReportCardCommentDocId(selectedStudentId, semester)
    : '';
  const savedReportCard = reportCardDocId ? reportCardCommentsById[reportCardDocId] || null : null;

  const [rcLengthMode, setRcLengthMode] = useState<ReportCardLengthMode>('standard');
  const [rcSchoolTemplate, setRcSchoolTemplate] = useState('');
  const [rcMaxChars, setRcMaxChars] = useState<number>(0);
  const [rcDraft, setRcDraft] = useState('');
  const [rcTeacherEdited, setRcTeacherEdited] = useState(false);
  const [rcExtraInstruction, setRcExtraInstruction] = useState('');
  const [rcAiLoading, setRcAiLoading] = useState<PedagogicalRefineAction | null>(null);
  const [rcAiNotes, setRcAiNotes] = useState('');
  const [rcAiProposal, setRcAiProposal] = useState<{
    text: string;
    actionLabel: string;
    notes: string;
  } | null>(null);
  const [rcSaving, setRcSaving] = useState(false);
  const [showRcHistory, setShowRcHistory] = useState(false);

  useEffect(() => {
    setRcLengthMode(savedReportCard?.lengthMode || 'standard');
    setRcSchoolTemplate(savedReportCard?.schoolTemplate || '');
    setRcMaxChars(savedReportCard?.maxChars || 0);
    setRcDraft(savedReportCard?.currentDraft || '');
    setRcTeacherEdited(Boolean(savedReportCard?.teacherEdited));
    setRcAiProposal(null);
    setRcAiNotes('');
    setShowRcHistory(false);
  }, [reportCardDocId, savedReportCard?.id, savedReportCard?.status, savedReportCard?.versions?.length]);

  // ========================================================================
  // TAB 2: PARENT MESSAGE STATE
  // ========================================================================
  const [pmPurpose, setPmPurpose] = useState<ParentMessagePurposeId>('khen_ngoi_dong_vien');
  const [pmTone, setPmTone] = useState<ParentMessageTone>('gan_gui');
  const [pmSalutation, setPmSalutation] = useState('');
  const [pmDraft, setPmDraft] = useState('');
  const [pmTeacherEdited, setPmTeacherEdited] = useState(false);
  const [pmExtraInstruction, setPmExtraInstruction] = useState('');
  const [pmAiLoading, setPmAiLoading] = useState<PedagogicalRefineAction | null>(null);
  const [pmAiNotes, setPmAiNotes] = useState('');
  const [pmAiProposal, setPmAiProposal] = useState<{
    text: string;
    actionLabel: string;
    notes: string;
  } | null>(null);
  const [pmSaving, setPmSaving] = useState(false);
  const [showPmHistory, setShowPmHistory] = useState(false);

  const parentMessageDocId = selectedStudentId
    ? getParentMessageDocId(selectedStudentId, semester, pmPurpose)
    : '';
  const savedParentMessage = parentMessageDocId ? parentMessagesById[parentMessageDocId] || null : null;

  useEffect(() => {
    const defaultSal = selectedStudent
      ? `Kính gửi quý phụ huynh em ${selectedStudent.fullName},`
      : 'Kính gửi quý phụ huynh,';
    const purposeMeta = PARENT_MESSAGE_PURPOSES.find((p) => p.id === pmPurpose);
    setPmSalutation(savedParentMessage?.salutation || defaultSal);
    setPmTone(savedParentMessage?.tone || purposeMeta?.defaultTone || 'phoi_hop');
    setPmDraft(savedParentMessage?.currentDraft || '');
    setPmTeacherEdited(Boolean(savedParentMessage?.teacherEdited));
    setPmAiProposal(null);
    setPmAiNotes('');
    setShowPmHistory(false);
  }, [parentMessageDocId, selectedStudent?.code, savedParentMessage?.id]);

  // ========================================================================
  // CLASS PROGRESS & REPETITION CONTEXT
  // ========================================================================
  const classSemesterReportCards = useMemo(() => {
    return Object.values(reportCardCommentsById).filter((c) => c.semester === semester);
  }, [reportCardCommentsById, semester]);

  const approvedCountInSemester = useMemo(
    () => classSemesterReportCards.filter((c) => c.status === 'approved_locked').length,
    [classSemesterReportCards],
  );

  const draftedCountInSemester = useMemo(
    () => classSemesterReportCards.filter((c) => Boolean(c.currentDraft.trim())).length,
    [classSemesterReportCards],
  );

  const otherStudentsNames = useMemo(
    () => sortedStudents.filter((s) => s.code !== selectedStudent?.code).map((s) => s.fullName),
    [sortedStudents, selectedStudent?.code],
  );

  const otherClassComments = useMemo(
    () =>
      classSemesterReportCards
        .filter((c) => c.studentId !== selectedStudentId && c.currentDraft.trim())
        .map((c) => ({
          studentId: c.studentId,
          studentName: c.studentName,
          text: c.currentDraft,
        })),
    [classSemesterReportCards, selectedStudentId],
  );

  const recentOpenings = useMemo(
    () =>
      otherClassComments
        .slice(0, 10)
        .map((c) => c.text.split(/\s+/).slice(0, 10).join(' '))
        .filter(Boolean),
    [otherClassComments],
  );

  // ========================================================================
  // 10-POINT QUALITY REPORTS (LIVE)
  // ========================================================================
  const rcQualityReport = useMemo(() => {
    if (!evidence) return null;
    return evaluatePedagogicalQuality({
      mode: 'report_card',
      text: rcDraft,
      evidence,
      lengthMode: rcLengthMode,
      maxChars: rcMaxChars,
      otherStudentsNames,
      otherClassComments,
    });
  }, [evidence, rcDraft, rcLengthMode, rcMaxChars, otherStudentsNames, otherClassComments]);

  const pmQualityReport = useMemo(() => {
    if (!evidence) return null;
    return evaluatePedagogicalQuality({
      mode: 'parent_message',
      text: pmDraft,
      evidence,
      salutation: pmSalutation,
      otherStudentsNames,
    });
  }, [evidence, pmDraft, pmSalutation, otherStudentsNames]);

  // ========================================================================
  // AI CALL HANDLERS (STRICTLY SEPARATE ENDPOINTS + ANTI-OVERWRITE GUARD)
  // ========================================================================
  const handleRunReportCardAi = async (action: PedagogicalRefineAction) => {
    if (!selectedStudent || !evidence) return;
    if (savedReportCard?.status === 'approved_locked') {
      onToast('Nhận xét đã được duyệt & khóa. Vui lòng bấm "Mở khóa để chỉnh sửa" trước khi dùng AI.');
      return;
    }
    if (action !== 'generate' && !rcDraft.trim()) {
      onToast('Chưa có bản nháp để điều chỉnh. Hãy bấm "Tạo nhận xét" trước.');
      return;
    }

    setRcAiLoading(action);
    try {
      const headers = await getAuthHeader();
      const resp = await fetch('/api/gemini/pedagogical/report-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          action,
          studentName: selectedStudent.fullName,
          gender: selectedStudent.gender || '',
          className: classConfig.className,
          schoolName: classConfig.schoolName,
          schoolYear: classConfig.schoolYear,
          semester,
          lengthMode: rcLengthMode,
          schoolTemplate: rcSchoolTemplate,
          maxChars: rcMaxChars,
          officialAcademic: evidence.officialAcademic,
          officialConduct: evidence.officialConduct,
          evidenceItems: evidence.evidenceItems,
          hasEnoughEvidence: evidence.hasEnoughEvidence,
          currentDraft: rcDraft,
          recentOpenings,
          extraInstruction: rcExtraInstruction,
        }),
      });
      const rawBody = await resp.text();
      let data: {
        text?: string;
        notesForTeacher?: string;
        error?: string;
        code?: string;
      } = {};
      try {
        data = rawBody ? (JSON.parse(rawBody) as typeof data) : {};
      } catch {
        data = {};
      }
      if (!resp.ok) {
        if (data.code === 'GEMINI_KEY_NOT_CONNECTED' || data.code === 'GEMINI_KEY_RECONNECT_REQUIRED') {
          onOpenGeminiKeySetup?.();
        }
        throw new Error(data.error || `Không thể tạo nhận xét (HTTP ${resp.status}). Vui lòng thử lại.`);
      }

      const aiText = (data.text || '').trim();
      const actionMeta = PEDAGOGICAL_REFINE_ACTIONS.find((a) => a.id === action);
      const actionLabel = actionMeta?.label || 'AI tạo nhận xét';

      // ANTI-OVERWRITE GUARD: Never overwrite GVCN's manual edits directly
      if (rcTeacherEdited && rcDraft.trim()) {
        setRcAiProposal({
          text: aiText,
          actionLabel,
          notes: data.notesForTeacher || '',
        });
        onToast('Đã tạo đề xuất AI bên dưới — giữ nguyên bản GVCN đang chỉnh sửa.');
      } else {
        setRcDraft(aiText);
        setRcAiNotes(data.notesForTeacher || '');
        setRcAiProposal(null);
        onToast(`Đã hoàn thành: ${actionLabel}. Vui lòng rà soát trước khi lưu/duyệt.`);
      }
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Lỗi kết nối Trợ lý Sư phạm AI.');
    } finally {
      setRcAiLoading(null);
    }
  };

  const handleApplyRcProposal = async () => {
    if (!rcAiProposal || !selectedStudent || !selectedStudentId) return;
    const prevVersions = savedReportCard?.versions || [];
    const updatedVersions = pushVersion(
      prevVersions,
      rcDraft,
      'teacher',
      'Bản GVCN trước khi áp dụng đề xuất AI',
      teacherEmail,
    );
    const nextVersions = pushVersion(
      updatedVersions,
      rcAiProposal.text,
      'ai',
      rcAiProposal.actionLabel,
      teacherEmail,
    );
    setRcDraft(rcAiProposal.text);
    setRcAiNotes(rcAiProposal.notes);
    setRcTeacherEdited(false);
    setRcAiProposal(null);

    setRcSaving(true);
    try {
      await onSaveReportCardComment({
        id: reportCardDocId,
        studentId: selectedStudentId,
        studentCode: selectedStudent.code,
        moetCode: selectedStudent.moetCode || '',
        studentName: selectedStudent.fullName,
        rosterOrder: selectedStudent.rosterOrder,
        semester,
        schoolYear: classConfig.schoolYear,
        lengthMode: rcLengthMode,
        schoolTemplate: rcSchoolTemplate.trim(),
        maxChars: rcMaxChars || 0,
        currentDraft: rcAiProposal.text,
        teacherEdited: false,
        status: 'draft',
        versions: nextVersions,
      });
    } finally {
      setRcSaving(false);
    }
  };

  const handlePersistReportCard = async (
    targetStatus: 'draft' | 'approved_locked',
    actionLabel: string,
    overrideText?: string,
    overrideSource?: PedagogicalVersionEntry['source'],
  ) => {
    if (!selectedStudent || !selectedStudentId) return;
    const textToSave = (overrideText !== undefined ? overrideText : rcDraft).trim();
    if (!textToSave) {
      onToast('Chưa có nội dung nhận xét để lưu.');
      return;
    }
    if (targetStatus === 'approved_locked' && rcQualityReport && rcQualityReport.errorCount > 0) {
      onToast(
        `Phát hiện ${rcQualityReport.errorCount} lỗi nghiêm trọng trong kiểm tra chất lượng. Vui lòng xử lý trước khi duyệt & khóa.`,
      );
      return;
    }

    setRcSaving(true);
    try {
      const nextVersions = pushVersion(
        savedReportCard?.versions || [],
        textToSave,
        overrideSource || (rcTeacherEdited ? 'teacher' : 'ai'),
        actionLabel,
        teacherEmail,
      );
      await onSaveReportCardComment({
        id: reportCardDocId,
        studentId: selectedStudentId,
        studentCode: selectedStudent.code,
        moetCode: selectedStudent.moetCode || '',
        studentName: selectedStudent.fullName,
        rosterOrder: selectedStudent.rosterOrder,
        semester,
        schoolYear: classConfig.schoolYear,
        lengthMode: rcLengthMode,
        schoolTemplate: rcSchoolTemplate.trim(),
        maxChars: rcMaxChars || 0,
        currentDraft: textToSave,
        teacherEdited: rcTeacherEdited,
        status: targetStatus,
        approvedByEmail: targetStatus === 'approved_locked' ? teacherEmail || 'gvcn' : undefined,
        approvedAtMs: targetStatus === 'approved_locked' ? Date.now() : undefined,
        versions: nextVersions,
      });
    } finally {
      setRcSaving(false);
    }
  };

  const handleRunParentMessageAi = async (action: PedagogicalRefineAction) => {
    if (!selectedStudent || !evidence) return;
    if (action !== 'generate' && !pmDraft.trim()) {
      onToast('Chưa có bản nháp tin nhắn để điều chỉnh. Hãy bấm "Tạo bản nháp" trước.');
      return;
    }

    const purposeMeta = PARENT_MESSAGE_PURPOSES.find((p) => p.id === pmPurpose);
    const toneMeta = PARENT_MESSAGE_TONES.find((t) => t.value === pmTone);
    const effectiveStatus: PedagogicalIncidentStatus =
      pmPurpose === 'xac_minh_thong_tin_chua_xac_nhan'
        ? 'pending_verification'
        : evidence.effectiveIncidentStatus;

    setPmAiLoading(action);
    try {
      const headers = await getAuthHeader();
      const resp = await fetch('/api/gemini/pedagogical/parent-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          action,
          studentName: selectedStudent.fullName,
          recipientName: selectedPii?.parentName || '',
          teacherName: classConfig.teacherName,
          className: classConfig.className,
          schoolName: classConfig.schoolName,
          schoolYear: classConfig.schoolYear,
          semester,
          purposeId: pmPurpose,
          purposeLabel: purposeMeta?.label || pmPurpose,
          salutation: pmSalutation,
          toneLabel: toneMeta?.label || pmTone,
          incidentStatus: effectiveStatus,
          evidenceItems: evidence.evidenceItems,
          pendingNote:
            evidence.pendingTickets.length > 0
              ? evidence.pendingTickets.map((t) => `${t.date}: ${t.description}`).join('; ')
              : evidence.effectiveIncidentStatus === 'pending_verification'
                ? evidence.teacherObservation.verifiedIncidentNote
                : '',
          currentDraft: pmDraft,
          extraInstruction: pmExtraInstruction,
        }),
      });
      const rawBody = await resp.text();
      let data: {
        text?: string;
        notesForTeacher?: string;
        error?: string;
        code?: string;
      } = {};
      try {
        data = rawBody ? (JSON.parse(rawBody) as typeof data) : {};
      } catch {
        data = {};
      }
      if (!resp.ok) {
        if (data.code === 'GEMINI_KEY_NOT_CONNECTED' || data.code === 'GEMINI_KEY_RECONNECT_REQUIRED') {
          onOpenGeminiKeySetup?.();
        }
        throw new Error(data.error || `Không thể tạo bản nháp tin nhắn (HTTP ${resp.status}). Vui lòng thử lại.`);
      }

      const aiText = (data.text || '').trim();
      const actionMeta = PEDAGOGICAL_REFINE_ACTIONS.find((a) => a.id === action);
      const actionLabel = actionMeta?.label || 'AI soạn tin nhắn';

      if (pmTeacherEdited && pmDraft.trim()) {
        setPmAiProposal({
          text: aiText,
          actionLabel,
          notes: data.notesForTeacher || '',
        });
        onToast('Đã tạo đề xuất AI bên dưới — giữ nguyên bản nháp GVCN đang chỉnh sửa.');
      } else {
        setPmDraft(aiText);
        setPmAiNotes(data.notesForTeacher || '');
        setPmAiProposal(null);
        onToast(`Đã soạn bản nháp (${actionLabel}). GVCN kiểm tra kỹ trước khi tự sao chép gửi.`);
      }
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Lỗi kết nối Trợ lý Sư phạm AI.');
    } finally {
      setPmAiLoading(null);
    }
  };

  const handleApplyPmProposal = async () => {
    if (!pmAiProposal || !selectedStudent || !selectedStudentId || !evidence) return;
    const prevVersions = savedParentMessage?.versions || [];
    const withTeacher = pushVersion(
      prevVersions,
      pmDraft,
      'teacher',
      'Bản GVCN trước khi áp dụng đề xuất AI',
      teacherEmail,
    );
    const nextVersions = pushVersion(
      withTeacher,
      pmAiProposal.text,
      'ai',
      pmAiProposal.actionLabel,
      teacherEmail,
    );
    setPmDraft(pmAiProposal.text);
    setPmAiNotes(pmAiProposal.notes);
    setPmTeacherEdited(false);
    setPmAiProposal(null);

    setPmSaving(true);
    try {
      await onSaveParentMessage({
        id: parentMessageDocId,
        studentId: selectedStudentId,
        studentCode: selectedStudent.code,
        moetCode: selectedStudent.moetCode || '',
        studentName: selectedStudent.fullName,
        recipientName: selectedPii?.parentName || '',
        semester,
        purpose: pmPurpose,
        salutation: pmSalutation.trim() || `Kính gửi quý phụ huynh em ${selectedStudent.fullName},`,
        tone: pmTone,
        incidentStatus:
          pmPurpose === 'xac_minh_thong_tin_chua_xac_nhan'
            ? 'pending_verification'
            : evidence.effectiveIncidentStatus,
        currentDraft: pmAiProposal.text,
        teacherEdited: false,
        status: 'draft',
        versions: nextVersions,
      });
    } finally {
      setPmSaving(false);
    }
  };

  const handlePersistParentMessage = async (
    targetStatus: 'draft' | 'approved_ready',
    actionLabel: string,
    overrideText?: string,
    overrideSource?: PedagogicalVersionEntry['source'],
  ) => {
    if (!selectedStudent || !selectedStudentId || !evidence) return;
    const textToSave = (overrideText !== undefined ? overrideText : pmDraft).trim();
    if (!textToSave) {
      onToast('Chưa có nội dung tin nhắn để lưu.');
      return;
    }
    if (targetStatus === 'approved_ready' && !hasVerifiedParentRecipient) {
      onToast(
        'Chưa cập nhật thông tin phụ huynh cho học sinh này. Không cho phép duyệt gửi tin nhắn khi chưa xác minh thông tin người nhận.',
      );
      return;
    }
    if (targetStatus === 'approved_ready' && pmQualityReport && pmQualityReport.errorCount > 0) {
      onToast(
        `Phát hiện ${pmQualityReport.errorCount} cảnh báo quan trọng trong kiểm tra chất lượng. Vui lòng chỉnh sửa trước khi đánh dấu sẵn sàng.`,
      );
      return;
    }

    setPmSaving(true);
    try {
      const nextVersions = pushVersion(
        savedParentMessage?.versions || [],
        textToSave,
        overrideSource || (pmTeacherEdited ? 'teacher' : 'ai'),
        actionLabel,
        teacherEmail,
      );
      await onSaveParentMessage({
        id: parentMessageDocId,
        studentId: selectedStudentId,
        studentCode: selectedStudent.code,
        moetCode: selectedStudent.moetCode || '',
        studentName: selectedStudent.fullName,
        recipientName: selectedPii?.parentName || '',
        semester,
        purpose: pmPurpose,
        salutation: pmSalutation.trim() || `Kính gửi quý phụ huynh em ${selectedStudent.fullName},`,
        tone: pmTone,
        incidentStatus:
          pmPurpose === 'xac_minh_thong_tin_chua_xac_nhan'
            ? 'pending_verification'
            : evidence.effectiveIncidentStatus,
        currentDraft: textToSave,
        teacherEdited: pmTeacherEdited,
        status: targetStatus,
        approvedByEmail: targetStatus === 'approved_ready' ? teacherEmail || 'gvcn' : undefined,
        approvedAtMs: targetStatus === 'approved_ready' ? Date.now() : undefined,
        versions: nextVersions,
      });
    } finally {
      setPmSaving(false);
    }
  };

  const handleCopyText = async (text: string, label: string) => {
    if (!text.trim()) {
      onToast('Chưa có nội dung để sao chép.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      onToast(`Đã sao chép ${label} vào bộ nhớ tạm.`);
    } catch {
      onToast('Trình duyệt chặn sao chép tự động; GVCN vui lòng chọn văn bản và nhấn Ctrl+C.');
    }
  };

  // ========================================================================
  // EXPORT REPORT CARD COMMENTS BY ROSTER ORDER (STT EXCEL) & MOET CODE
  // ========================================================================
  const handleExportReportCards = (format: 'xlsx' | 'csv') => {
    const rows = buildReportCardExportRows({
      students: sortedStudents,
      semester,
      schoolYear: classConfig.schoolYear,
      commentsById: reportCardCommentsById,
      observationsById,
    });

    const sheetData = rows.map((r) => ({
      'STT Excel': r.stt,
      'Mã MOET': r.moetCode,
      'Mã HS': r.studentCode,
      'Họ và tên': r.fullName,
      Tổ: r.team,
      'Chức vụ': r.role,
      'Học kỳ': r.semester,
      'Năm học': r.schoolYear,
      'Học tập (TT22)': r.officialAcademic,
      'Rèn luyện (TT22)': r.officialConduct,
      'Trạng thái': r.statusLabel,
      'Nhận xét học bạ': r.comment,
      'Người duyệt': r.approvedBy,
    }));

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'NhanXetHocBa');
    const safeClass = (classConfig.className || '12D6').replace(/[^a-zA-Z0-9]/g, '');
    const semSlug = semester === 'Học kỳ II' ? 'HK2' : semester === 'Cả năm' ? 'CaNam' : 'HK1';
    const fileName = `NhanXetHocBa_${safeClass}_${semSlug}_TheoSTT.${format}`;
    XLSX.writeFile(wb, fileName, { bookType: format === 'csv' ? 'csv' : 'xlsx' });
    onToast(`Đã xuất ${rows.length} dòng nhận xét theo đúng STT Excel & Mã MOET (${fileName}).`);
  };

  // ========================================================================
  // ISOLATED 10-SCENARIO TEST SIMULATION MODAL (SECTION X)
  // ========================================================================
  const [showTestModal, setShowTestModal] = useState(false);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(
    PEDAGOGICAL_TEST_SCENARIOS[0].id,
  );
  const [testAiOutput, setTestAiOutput] = useState<Record<string, { rc?: string; pm?: string }>>({});
  const [testAiBusy, setTestAiBusy] = useState(false);

  const activeScenario = useMemo(
    () =>
      PEDAGOGICAL_TEST_SCENARIOS.find((s) => s.id === selectedScenarioId) ||
      PEDAGOGICAL_TEST_SCENARIOS[0],
    [selectedScenarioId],
  );

  const activeScenarioEvidence = useMemo(() => {
    return buildVerifiedStudentEvidence({
      student: activeScenario.student,
      semester: activeScenario.semester,
      schoolYear: classConfig.schoolYear,
      activeSubjectSlug: 'ngu_van',
      activeSubjectName: 'Ngữ văn',
      subjectScores: activeScenario.subjectScores,
      weeklySnapshots: activeScenario.weeklySnapshots,
      tickets: activeScenario.tickets,
      grade12Profiles: {},
      observation: activeScenario.observation,
    });
  }, [activeScenario, classConfig.schoolYear]);

  const pairedScenarioEvidence = useMemo(() => {
    if (!activeScenario.pairedStudentForDuplicateCheck) return null;
    const p = activeScenario.pairedStudentForDuplicateCheck;
    return buildVerifiedStudentEvidence({
      student: p.student,
      semester: activeScenario.semester,
      schoolYear: classConfig.schoolYear,
      activeSubjectSlug: 'ngu_van',
      activeSubjectName: 'Ngữ văn',
      subjectScores: p.subjectScores,
      weeklySnapshots: [],
      tickets: [],
      grade12Profiles: {},
      observation: p.observation,
    });
  }, [activeScenario, classConfig.schoolYear]);

  const scenarioRcText =
    testAiOutput[activeScenario.id]?.rc ?? activeScenario.referenceDraftReportCard;
  const scenarioPmText =
    testAiOutput[activeScenario.id]?.pm ?? activeScenario.referenceDraftParentMessage;

  const scenarioRcQuality = useMemo(
    () =>
      evaluatePedagogicalQuality({
        mode: 'report_card',
        text: scenarioRcText,
        evidence: activeScenarioEvidence,
        lengthMode: 'standard',
      }),
    [scenarioRcText, activeScenarioEvidence],
  );

  const scenarioPmQuality = useMemo(
    () =>
      evaluatePedagogicalQuality({
        mode: 'parent_message',
        text: scenarioPmText,
        evidence: activeScenarioEvidence,
        salutation: `Kính gửi quý phụ huynh em ${activeScenario.student.fullName},`,
      }),
    [scenarioPmText, activeScenarioEvidence, activeScenario.student.fullName],
  );

  const handleRunIsolatedScenarioAi = async (mode: 'report_card' | 'parent_message') => {
    setTestAiBusy(true);
    try {
      const headers = await getAuthHeader();
      const endpoint =
        mode === 'report_card'
          ? '/api/gemini/pedagogical/report-card'
          : '/api/gemini/pedagogical/parent-message';
      const purposeMeta = PARENT_MESSAGE_PURPOSES.find(
        (p) => p.id === activeScenario.recommendedPurpose,
      );
      const payload =
        mode === 'report_card'
          ? {
              action: 'generate',
              studentName: activeScenario.student.fullName,
              gender: activeScenario.student.gender || '',
              className: '12D6 (MÔ PHỎNG)',
              schoolName: classConfig.schoolName,
              schoolYear: classConfig.schoolYear,
              semester: activeScenario.semester,
              lengthMode: 'standard',
              officialAcademic: activeScenarioEvidence.officialAcademic,
              officialConduct: activeScenarioEvidence.officialConduct,
              evidenceItems: activeScenarioEvidence.evidenceItems,
              hasEnoughEvidence: activeScenarioEvidence.hasEnoughEvidence,
            }
          : {
              action: 'generate',
              studentName: activeScenario.student.fullName,
              teacherName: classConfig.teacherName,
              className: '12D6 (MÔ PHỎNG)',
              schoolName: classConfig.schoolName,
              schoolYear: classConfig.schoolYear,
              semester: activeScenario.semester,
              purposeId: activeScenario.recommendedPurpose,
              purposeLabel: purposeMeta?.label || activeScenario.recommendedPurpose,
              salutation: `Kính gửi quý phụ huynh em ${activeScenario.student.fullName},`,
              toneLabel: 'Nhẹ nhàng, phối hợp',
              incidentStatus: activeScenarioEvidence.effectiveIncidentStatus,
              evidenceItems: activeScenarioEvidence.evidenceItems,
              pendingNote:
                activeScenarioEvidence.pendingTickets.map((t) => t.description).join('; ') ||
                activeScenarioEvidence.teacherObservation.verifiedIncidentNote,
            };

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(payload),
      });
      const rawBody = await resp.text();
      let data: { text?: string; error?: string; code?: string } = {};
      try {
        data = rawBody ? (JSON.parse(rawBody) as typeof data) : {};
      } catch {
        data = {};
      }
      if (!resp.ok) {
        if (data.code === 'GEMINI_KEY_NOT_CONNECTED' || data.code === 'GEMINI_KEY_RECONNECT_REQUIRED') {
          onOpenGeminiKeySetup?.();
        }
        throw new Error(data.error || `Không thể chạy thử AI (HTTP ${resp.status}). Vui lòng thử lại.`);
      }

      setTestAiOutput((prev) => ({
        ...prev,
        [activeScenario.id]: {
          ...prev[activeScenario.id],
          [mode === 'report_card' ? 'rc' : 'pm']: (data.text || '').trim(),
        },
      }));
      onToast(`Đã chạy thử AI trong môi trường TEST tách biệt cho tình huống #${activeScenario.number}.`);
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Lỗi chạy thử AI trong môi trường TEST.');
    } finally {
      setTestAiBusy(false);
    }
  };

  const renderQualityPanel = (
    report: ReturnType<typeof evaluatePedagogicalQuality> | null,
  ) => {
    if (!report) return null;
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#0C9BA6]" />
            <h4 className="text-sm font-bold text-[#102744]">
              Kiểm tra chất lượng sư phạm tự động (10 tiêu chí)
            </h4>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              {report.passedCount}/10 đạt
            </span>
            {report.warningCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                {report.warningCount} lưu ý
              </span>
            )}
            {report.errorCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                {report.errorCount} lỗi cần sửa
              </span>
            )}
            <span className="text-slate-500">
              {report.wordCount} từ • {report.charCount} ký tự
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {report.checks.map((chk) => (
            <div
              key={chk.id}
              className={`rounded-lg border px-2.5 py-2 text-xs ${
                chk.passed
                  ? 'border-emerald-200 bg-white text-slate-700'
                  : chk.severity === 'error'
                    ? 'border-rose-300 bg-rose-50 text-rose-900'
                    : 'border-amber-300 bg-amber-50 text-amber-900'
              }`}
            >
              <div className="flex items-start gap-1.5">
                {chk.passed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                ) : chk.severity === 'error' ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold">
                    {chk.id}. {chk.title}
                  </div>
                  <div className="text-[11px] opacity-90 mt-0.5 leading-snug">{chk.detail}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1 border-t border-slate-200">
          <Info className="w-3.5 h-3.5 text-[#0C9BA6] shrink-0" />
          <span>{AUTO_CHECK_DISCLAIMER}</span>
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {geminiKeyConnected === false && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-amber-950 space-y-0.5">
            <div className="font-bold">Chưa kết nối Gemini API key cá nhân</div>
            <p className="text-amber-800">
              Bạn vẫn có thể tự nhập, chỉnh sửa, lưu nháp, duyệt và xuất Excel/CSV nhận xét học bạ bình thường. Để dùng nút AI hỗ trợ soạn/chỉnh sửa bằng Gemini, hãy kết nối API key cá nhân của bạn.
            </p>
          </div>
          {onOpenGeminiKeySetup && (
            <button
              type="button"
              onClick={onOpenGeminiKeySetup}
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0"
            >
              Kết nối Gemini AI cá nhân
            </button>
          )}
        </div>
      )}

      {/* HEADER BAR */}
      <div className="rounded-2xl bg-gradient-to-r from-[#102744] via-[#15365C] to-[#0C7D87] text-white p-5 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                <BookOpenCheck className="w-5 h-5 text-teal-200" />
              </div>
              <div>
                <h2 className="text-lg md:text-xl font-bold tracking-tight">
                  TRỢ LÝ NHẬN XÉT SƯ PHẠM AI
                </h2>
                <p className="text-xs text-teal-100/90">
                  Chuẩn Thông tư 22/2021/TT-BGDĐT • Đọc dữ liệu đơn lẻ theo mã MOET &amp; học kỳ • Chỉ dành riêng cho GVCN
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleExportReportCards('xlsx')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-semibold transition border border-white/20"
            >
              <FileSpreadsheet className="w-4 h-4 text-teal-200" />
              Xuất Học bạ STT Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={() => handleExportReportCards('csv')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold transition border border-white/15"
            >
              <Download className="w-4 h-4 text-teal-200" />
              Xuất CSV
            </button>
            <button
              type="button"
              onClick={() => setShowTestModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 text-amber-100 text-xs font-semibold transition border border-amber-300/40"
            >
              <FlaskConical className="w-4 h-4" />
              Kiểm thử 10 tình huống (TEST)
            </button>
          </div>
        </div>

        {/* PROGRESS SUMMARY + 2 SEPARATE FUNCTIONAL TABS */}
        <div className="mt-4 pt-4 border-t border-white/15 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="inline-flex rounded-xl bg-slate-950/30 p-1 gap-1 self-start">
            <button
              type="button"
              onClick={() => setActiveSubTab('report_card')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
                activeSubTab === 'report_card'
                  ? 'bg-white text-[#102744] shadow-sm'
                  : 'text-teal-100 hover:bg-white/10'
              }`}
            >
              <ClipboardCheck className="w-4 h-4" />
              Tab 1: Nhận xét học bạ (TT22)
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('parent_message')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
                activeSubTab === 'parent_message'
                  ? 'bg-white text-[#102744] shadow-sm'
                  : 'text-teal-100 hover:bg-white/10'
              }`}
            >
              <MessageSquareHeart className="w-4 h-4" />
              Tab 2: Tin nhắn phụ huynh
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-teal-100">
            <span>
              Lớp <strong className="text-white">{classConfig.className}</strong> ({sortedStudents.length} HS)
            </span>
            <span>•</span>
            <span>
              {semester}: <strong className="text-white">{draftedCountInSemester}</strong> có bản nháp /{' '}
              <strong className="text-emerald-300">{approvedCountInSemester}</strong> đã duyệt khóa
            </span>
          </div>
        </div>
      </div>

      {/* STUDENT & SEMESTER SELECTION BAR */}
      <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Kỳ đánh giá (tách bạch dữ liệu)
            </label>
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
              {PEDAGOGICAL_SEMESTERS.map((sem) => (
                <button
                  key={sem}
                  type="button"
                  onClick={() => setSemester(sem)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition ${
                    semester === sem
                      ? 'bg-[#102744] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {sem}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Tìm theo STT / Họ tên / Mã MOET
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="VD: 12, Ngọc, 790..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#0C9BA6]"
              />
            </div>
          </div>

          <div className="md:col-span-6">
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Chọn 01 học sinh theo đúng STT Excel &amp; Mã MOET
            </label>
            <select
              value={selectedStudent?.code || ''}
              onChange={(e) => setSelectedStudentCode(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#102744] bg-white focus:outline-none focus:ring-2 focus:ring-[#0C9BA6]"
            >
              {filteredStudents.map((st, idx) => {
                const stt = typeof st.rosterOrder === 'number' ? st.rosterOrder : idx + 1;
                const doc =
                  reportCardCommentsById[getReportCardCommentDocId(st.id || st.code, semester)];
                const statusTag =
                  doc?.status === 'approved_locked'
                    ? ' [Đã duyệt]'
                    : doc?.currentDraft
                      ? ' [Nháp]'
                      : '';
                return (
                  <option key={st.code} value={st.code}>
                    #{String(stt).padStart(2, '0')} • {st.fullName} • MOET: {st.moetCode || 'Chưa có'} • Tổ {st.team}
                    {statusTag}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* SINGLE-STUDENT IDENTITY BANNER */}
        {selectedStudent && evidence && (
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-[#102744] text-white font-bold">
                STT #{evidence.rosterOrder ?? '—'}
              </span>
              <span className="font-bold text-[#102744] text-sm">{selectedStudent.fullName}</span>
              <span className="px-2 py-0.5 rounded bg-teal-50 text-[#0C7D87] border border-teal-200 font-mono">
                MOET: {evidence.moetCode || 'Chưa cập nhật'}
              </span>
              <span className="text-slate-500">
                Mã HS: <strong className="text-slate-700">{selectedStudent.code}</strong> • Tổ {selectedStudent.team}
              </span>
              {evidence.roles.length > 0 && (
                <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                  {evidence.roles.join(', ')}
                </span>
              )}
            </div>

            {hasDuplicateNameInClass && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                Lớp có học sinh trùng họ tên — đã khóa định danh theo Mã MOET &amp; STT
              </span>
            )}
          </div>
        )}
      </div>

      {/* MAIN 2-COLUMN WORKSPACE */}
      {selectedStudent && evidence && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          {/* LEFT COLUMN (4 cols): VERIFIED SINGLE-STUDENT EVIDENCE + GVCN OBSERVATION FORM */}
          <div className="xl:col-span-4 space-y-4">
            {/* INSUFFICIENT EVIDENCE WARNING */}
            {evidence.insufficientEvidenceWarning && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950 space-y-2">
                <div className="flex items-start gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>{evidence.insufficientEvidenceWarning}</span>
                </div>
                {evidence.missingEvidenceHints.length > 0 && (
                  <ul className="list-disc pl-5 space-y-0.5 text-amber-900/90">
                    {evidence.missingEvidenceHints.map((hint, idx) => (
                      <li key={idx}>{hint}</li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => setShowObsForm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold transition"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Bổ sung / Xác nhận minh chứng ngay
                </button>
              </div>
            )}

            {/* VERIFIED EVIDENCE SUMMARY CARD */}
            <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[#102744]">
                    Hồ sơ minh chứng xác thực ({semester})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Chỉ đọc dữ liệu đã xác thực của riêng học sinh này, đã loại trừ dữ liệu TEST.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowObsForm((v) => !v)}
                  className="px-2.5 py-1.5 rounded-lg border border-[#0C9BA6] text-[#0C7D87] hover:bg-teal-50 text-xs font-semibold shrink-0"
                >
                  {showObsForm ? 'Đóng mẫu nhập' : 'Cập nhật minh chứng'}
                </button>
              </div>

              {/* OFFICIAL TT22 RATINGS BOX */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                  <div className="text-[11px] text-slate-500 font-medium">Học tập chính thức (TT22)</div>
                  <div className="text-sm font-bold text-[#102744] mt-0.5">
                    {evidence.officialAcademic || 'Chưa xác nhận'}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                  <div className="text-[11px] text-slate-500 font-medium">Rèn luyện chính thức (TT22)</div>
                  <div className="text-sm font-bold text-[#102744] mt-0.5">
                    {evidence.officialConduct || 'Chưa xác nhận'}
                  </div>
                </div>
              </div>

              {/* SUBJECT SCORE & PROGRESSION */}
              <div className="rounded-xl border border-slate-200 p-3 space-y-1 text-xs">
                <div className="font-bold text-[#102744]">
                  Kết quả môn {activeSubjectName} ({semester})
                </div>
                {evidence.semesterScore ? (
                  <div className="text-slate-700">
                    ĐTB:{' '}
                    <strong>
                      {evidence.semesterScore.avg !== null
                        ? evidence.semesterScore.avg.toFixed(1)
                        : '—'}
                    </strong>{' '}
                    | GK: {evidence.semesterScore.gk ?? '—'} | CK: {evidence.semesterScore.ck ?? '—'} | TX:{' '}
                    {evidence.semesterScore.tx1 ?? '—'}, {evidence.semesterScore.tx2 ?? '—'}
                  </div>
                ) : (
                  <div className="text-slate-400 italic">Chưa có bảng điểm {semester} cho môn này.</div>
                )}
                {evidence.scoreProgressionNote && (
                  <div className="text-[11px] text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-2 py-1 mt-1">
                    {evidence.scoreProgressionNote}
                  </div>
                )}
              </div>

              {/* INTERNAL EMULATION SEPARATION BOX */}
              <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sky-950">Thi đua tuần nội bộ ({semester})</span>
                  <span className="text-[11px] font-semibold text-sky-800">
                    {evidence.internalEmulation.totalLockedWeeks} tuần đã chốt
                  </span>
                </div>
                {evidence.internalEmulation.totalLockedWeeks > 0 ? (
                  <div className="text-sky-900 font-semibold">
                    Loại A: {evidence.internalEmulation.countA} • Loại B: {evidence.internalEmulation.countB} • Loại C:{' '}
                    {evidence.internalEmulation.countC}
                  </div>
                ) : (
                  <div className="text-sky-800/70 italic">Chưa có tuần thi đua đã chốt trong {semester}.</div>
                )}
                <p className="text-[11px] text-sky-900/80 leading-snug pt-0.5">
                  Lưu ý: Thi đua A/B/C là theo dõi nội bộ, <strong>KHÔNG</strong> tự quy đổi thành xếp loại Rèn luyện TT22.
                </p>
              </div>

              {/* ATTENDANCE & TICKETS */}
              <div className="rounded-xl border border-slate-200 p-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#102744]">Chuyên cần &amp; Ghi nhận lớp</span>
                  <span className="text-slate-600">
                    Có mặt <strong>{evidence.attendancePresent}</strong> • Vắng{' '}
                    <strong className={evidence.attendanceAbsent > 0 ? 'text-amber-700' : ''}>
                      {evidence.attendanceAbsent}
                    </strong>
                  </span>
                </div>
                {evidence.verifiedTickets.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <div className="text-[11px] font-semibold text-emerald-700">
                      Phiếu đã được GVCN duyệt ({evidence.verifiedTickets.length}):
                    </div>
                    {evidence.verifiedTickets.slice(0, 3).map((t) => (
                      <div key={t.id} className="text-[11px] text-slate-700 bg-emerald-50/70 rounded px-2 py-1">
                        [{t.date}] {t.category}: {t.description}
                      </div>
                    ))}
                  </div>
                )}
                {evidence.pendingTickets.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <div className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Phản ánh CHƯA XÁC MINH ({evidence.pendingTickets.length}) — Không đưa vào học bạ:
                    </div>
                    {evidence.pendingTickets.slice(0, 2).map((t) => (
                      <div key={t.id} className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                        [{t.date}] {t.description}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* GVCN CONFIRMED OBSERVATION PREVIEW */}
              {(evidence.teacherObservation.verifiedStrengths ||
                evidence.teacherObservation.verifiedImprovements ||
                evidence.teacherObservation.verifiedAchievements ||
                evidence.teacherObservation.verifiedIncidentNote) && (
                <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#102744]">Ghi nhận thực tế GVCN đã xác nhận</span>
                    <span className="text-[10px] text-teal-800">{evidence.teacherObservation.sourceLabel}</span>
                  </div>
                  {evidence.teacherObservation.verifiedStrengths && (
                    <p className="text-slate-700">
                      <strong>Ưu điểm:</strong> {evidence.teacherObservation.verifiedStrengths}
                    </p>
                  )}
                  {evidence.teacherObservation.verifiedImprovements && (
                    <p className="text-slate-700">
                      <strong>Cần cải thiện:</strong> {evidence.teacherObservation.verifiedImprovements}
                    </p>
                  )}
                  {evidence.teacherObservation.verifiedAchievements && (
                    <p className="text-slate-700">
                      <strong>Thành tích:</strong> {evidence.teacherObservation.verifiedAchievements}
                    </p>
                  )}
                  {evidence.teacherObservation.verifiedIncidentNote && (
                    <p
                      className={
                        evidence.effectiveIncidentStatus === 'pending_verification'
                          ? 'text-amber-900 font-medium'
                          : 'text-slate-700'
                      }
                    >
                      <strong>
                        {evidence.effectiveIncidentStatus === 'pending_verification'
                          ? 'Sự việc CHƯA xác minh:'
                          : 'Sự việc đã xác minh:'}
                      </strong>{' '}
                      {evidence.teacherObservation.verifiedIncidentNote}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* GVCN FACTUAL OBSERVATION FORM */}
            {showObsForm && (
              <div className="rounded-2xl bg-white border-2 border-[#0C9BA6] p-4 shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-[#102744]">
                    Bổ sung &amp; Xác nhận minh chứng GVCN ({semester})
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowObsForm(false)}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Học tập (Thông tư 22)
                    </label>
                    <select
                      value={obsAcademic}
                      onChange={(e) => setObsAcademic(e.target.value as OfficialTt22Level)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                    >
                      {OFFICIAL_TT22_LEVELS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Rèn luyện (Thông tư 22)
                    </label>
                    <select
                      value={obsConduct}
                      onChange={(e) => setObsConduct(e.target.value as OfficialTt22Level)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                    >
                      {OFFICIAL_TT22_LEVELS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Ưu điểm có căn cứ
                  </label>
                  <textarea
                    rows={2}
                    value={obsStrengths}
                    onChange={(e) => setObsStrengths(e.target.value)}
                    placeholder="VD: Chăm chỉ làm bài, lễ phép, tích cực hỗ trợ tập thể..."
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#0C9BA6]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Nội dung cần cải thiện (chỉ nhập nếu có thực tế)
                  </label>
                  <textarea
                    rows={2}
                    value={obsImprovements}
                    onChange={(e) => setObsImprovements(e.target.value)}
                    placeholder="VD: Còn rụt rè khi phát biểu, cần phân bổ thời gian tự học..."
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#0C9BA6]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Thành tích / đóng góp đã xác minh (nếu có)
                  </label>
                  <input
                    type="text"
                    value={obsAchievements}
                    onChange={(e) => setObsAchievements(e.target.value)}
                    placeholder="VD: Tham gia đội văn nghệ chào mừng 20/11..."
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#0C9BA6]"
                  />
                </div>

                <div className="grid grid-cols-1 gap-2 rounded-xl bg-slate-50 border border-slate-200 p-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Trạng thái xác minh sự việc (nếu có sự việc cần trao đổi)
                    </label>
                    <select
                      value={obsIncidentStatus}
                      onChange={(e) =>
                        setObsIncidentStatus(e.target.value as PedagogicalIncidentStatus)
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                    >
                      <option value="none">Không có sự việc phát sinh</option>
                      <option value="verified">Sự việc đã được GVCN xác minh rõ</option>
                      <option value="pending_verification">
                        Phản ánh CHƯA xác minh (chỉ tạo bản nháp trung lập)
                      </option>
                    </select>
                  </div>
                  {obsIncidentStatus !== 'none' && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Mô tả khách quan sự việc / thông tin cần xác minh
                      </label>
                      <textarea
                        rows={2}
                        value={obsIncidentNote}
                        onChange={(e) => setObsIncidentNote(e.target.value)}
                        placeholder="Ghi ngắn gọn, khách quan ngày/sự việc hoặc nội dung cần trao đổi..."
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Nguồn xác nhận minh chứng
                  </label>
                  <input
                    type="text"
                    value={obsSourceLabel}
                    onChange={(e) => setObsSourceLabel(e.target.value)}
                    placeholder="GVCN xác nhận trực tiếp / Sổ điểm danh / Trao đổi GVBM"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                  />
                </div>

                <button
                  type="button"
                  disabled={savingObs}
                  onClick={handleSaveObsSubmit}
                  className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-xl bg-[#0C9BA6] hover:bg-[#09828B] text-white text-xs font-bold transition disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  {savingObs ? 'Đang lưu minh chứng...' : 'Lưu & Xác nhận minh chứng GVCN'}
                </button>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN (8 cols): SEPARATE EDITOR FOR TAB 1 OR TAB 2 */}
          <div className="xl:col-span-8 space-y-4">
            {activeSubTab === 'report_card' ? (
              /* ============================================================
                 TAB 1: NHẬN XÉT HỌC BẠ (THÔNG TƯ 22/2021/TT-BGDĐT)
                 ============================================================ */
              <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-[#102744] flex items-center gap-2">
                      <ClipboardCheck className="w-5 h-5 text-[#0C9BA6]" />
                      Soạn Nhận xét học bạ — {selectedStudent.fullName} ({semester})
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Cấu trúc sư phạm: Ưu điểm có căn cứ → Nội dung cần cải thiện (nếu có) → Định hướng phù hợp.
                    </p>
                  </div>
                  <div>
                    {savedReportCard?.status === 'approved_locked' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-bold">
                        <Lock className="w-3.5 h-3.5" />
                        Đã duyệt &amp; khóa chính thức
                      </span>
                    ) : savedReportCard?.currentDraft ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-100 text-amber-900 text-xs font-bold">
                        Bản nháp đã lưu
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold">
                        Chưa lưu bản nháp
                      </span>
                    )}
                  </div>
                </div>

                {/* LENGTH MODE + SCHOOL TEMPLATE CONTROLS */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-5">
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Độ dài nhận xét học bạ
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
                      {(['short', 'standard', 'detailed'] as ReportCardLengthMode[]).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          disabled={savedReportCard?.status === 'approved_locked'}
                          onClick={() => setRcLengthMode(mode)}
                          className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition ${
                            rcLengthMode === mode
                              ? 'bg-[#0C9BA6] text-white shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title={REPORT_CARD_LENGTH_CONFIG[mode].description}
                        >
                          {REPORT_CARD_LENGTH_CONFIG[mode].shortLabel}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {REPORT_CARD_LENGTH_CONFIG[rcLengthMode].label}
                    </p>
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Giới hạn ký tự (nếu trường yêu cầu)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={1500}
                      disabled={savedReportCard?.status === 'approved_locked'}
                      value={rcMaxChars || ''}
                      onChange={(e) => setRcMaxChars(Math.max(0, Number(e.target.value) || 0))}
                      placeholder="VD: 350 (0 = không giới hạn)"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                  </div>

                  <div className="md:col-span-4">
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Mẫu / lưu ý riêng của trường (tùy chọn)
                    </label>
                    <input
                      type="text"
                      disabled={savedReportCard?.status === 'approved_locked'}
                      value={rcSchoolTemplate}
                      onChange={(e) => setRcSchoolTemplate(e.target.value)}
                      placeholder="VD: Không viết tắt, kết bằng câu khích lệ..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                  </div>
                </div>

                {/* OPTIONAL EXTRA INSTRUCTION */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Yêu cầu bổ sung nhanh cho lần soạn này (tùy chọn)
                  </label>
                  <input
                    type="text"
                    disabled={savedReportCard?.status === 'approved_locked'}
                    value={rcExtraInstruction}
                    onChange={(e) => setRcExtraInstruction(e.target.value)}
                    placeholder="VD: Nhấn mạnh sự tiến bộ ở môn Ngữ văn từ HK I lên HK II..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>

                {/* 7 AI ACTIONS TOOLBAR */}
                <div className="flex flex-wrap gap-2">
                  {PEDAGOGICAL_REFINE_ACTIONS.map((act) => {
                    const isPrimary = act.id === 'generate';
                    const isLoading = rcAiLoading === act.id;
                    return (
                      <button
                        key={act.id}
                        type="button"
                        disabled={
                          Boolean(rcAiLoading) || savedReportCard?.status === 'approved_locked'
                        }
                        onClick={() => handleRunReportCardAi(act.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition disabled:opacity-50 ${
                          isPrimary
                            ? 'bg-[#102744] hover:bg-[#193A63] text-white shadow-sm'
                            : 'bg-slate-100 hover:bg-teal-50 text-[#102744] border border-slate-200 hover:border-[#0C9BA6]'
                        }`}
                      >
                        {isLoading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-[#0C9BA6]" />
                        )}
                        {act.id === 'generate' ? 'Tạo nhận xét học bạ' : act.label}
                      </button>
                    );
                  })}
                </div>

                {/* ANTI-OVERWRITE PROPOSAL BOX */}
                {rcAiProposal && (
                  <div className="rounded-xl border-2 border-[#0C9BA6] bg-teal-50/70 p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#102744]">
                        Đề xuất mới từ AI ({rcAiProposal.actionLabel}) — Chưa ghi đè bản GVCN đã sửa
                      </span>
                      <span className="text-[11px] text-teal-800 font-semibold">
                        {countWords(rcAiProposal.text)} từ • {rcAiProposal.text.length} ký tự
                      </span>
                    </div>
                    <p className="text-sm text-slate-800 bg-white rounded-lg border border-teal-200 p-3 leading-relaxed">
                      {rcAiProposal.text}
                    </p>
                    {rcAiProposal.notes && (
                      <p className="text-xs text-teal-900">
                        <strong>Ghi chú cho GVCN:</strong> {rcAiProposal.notes}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleApplyRcProposal}
                        className="px-3 py-1.5 rounded-lg bg-[#0C9BA6] hover:bg-[#09828B] text-white text-xs font-bold"
                      >
                        Áp dụng đề xuất (lưu bản cũ vào lịch sử)
                      </button>
                      <button
                        type="button"
                        onClick={() => setRcAiProposal(null)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                      >
                        Giữ nguyên bản GVCN &amp; đóng
                      </button>
                    </div>
                  </div>
                )}

                {/* DIRECT EDITABLE TEXTAREA */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-bold text-[#102744]">
                      Nội dung nhận xét học bạ (GVCN có thể chỉnh sửa trực tiếp)
                    </label>
                    <div className="flex items-center gap-2 text-slate-500">
                      {rcTeacherEdited && (
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">
                          GVCN đã chỉnh sửa tay (được bảo vệ khỏi ghi đè)
                        </span>
                      )}
                      <span>
                        {countWords(rcDraft)} từ • {rcDraft.length} ký tự
                      </span>
                    </div>
                  </div>
                  <textarea
                    rows={5}
                    disabled={savedReportCard?.status === 'approved_locked'}
                    value={rcDraft}
                    onChange={(e) => {
                      setRcDraft(e.target.value);
                      setRcTeacherEdited(true);
                    }}
                    placeholder='Nhấn "Tạo nhận xét học bạ" hoặc trực tiếp nhập nhận xét mở đầu bằng "Em..."'
                    className="w-full px-3.5 py-3 rounded-xl border border-slate-300 text-sm text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#0C9BA6] disabled:bg-slate-100 disabled:text-slate-700"
                  />
                  {rcAiNotes && (
                    <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                      <strong className="text-[#102744]">Ghi chú riêng cho GVCN:</strong> {rcAiNotes}
                    </div>
                  )}
                </div>

                {/* ACTION BAR: COPY, SAVE DRAFT, APPROVE & LOCK, HISTORY */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyText(rcDraft, 'nhận xét học bạ')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Sao chép
                    </button>
                    {savedReportCard?.status !== 'approved_locked' ? (
                      <>
                        <button
                          type="button"
                          disabled={rcSaving || !rcDraft.trim()}
                          onClick={() => handlePersistReportCard('draft', 'GVCN lưu bản nháp')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold disabled:opacity-50"
                        >
                          <Save className="w-3.5 h-3.5" />
                          {rcSaving ? 'Đang lưu...' : 'Lưu bản nháp'}
                        </button>
                        <button
                          type="button"
                          disabled={rcSaving || !rcDraft.trim()}
                          onClick={() =>
                            handlePersistReportCard(
                              'approved_locked',
                              'GVCN duyệt & khóa bản chính thức',
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          Duyệt &amp; Khóa bản chính thức
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={rcSaving}
                        onClick={() =>
                          handlePersistReportCard(
                            'draft',
                            'Mở khóa từ bản chính thức để điều chỉnh',
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        Mở khóa để chỉnh sửa
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowRcHistory((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700"
                  >
                    <History className="w-3.5 h-3.5 text-[#0C9BA6]" />
                    Lịch sử phiên bản ({savedReportCard?.versions?.length || 0})
                  </button>
                </div>

                {/* VERSION HISTORY DRAWER */}
                {showRcHistory && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                    <div className="text-xs font-bold text-[#102744]">
                      Lịch sử phiên bản nhận xét học bạ (tối đa 15 phiên bản gần nhất)
                    </div>
                    {!savedReportCard?.versions?.length ? (
                      <p className="text-xs text-slate-500 italic">Chưa có phiên bản đã lưu.</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {savedReportCard.versions.map((ver) => (
                          <div
                            key={ver.versionId}
                            className="rounded-lg bg-white border border-slate-200 p-2.5 text-xs space-y-1.5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                              <span className="font-bold text-[#102744]">{ver.actionLabel}</span>
                              <span>
                                {ver.actorEmail} • {formatDateTime(ver.savedAtMs)}
                              </span>
                            </div>
                            <p className="text-slate-700 leading-relaxed">{ver.text}</p>
                            {savedReportCard.status !== 'approved_locked' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRcDraft(ver.text);
                                  setRcTeacherEdited(true);
                                  handlePersistReportCard(
                                    'draft',
                                    `Khôi phục từ phiên bản (${ver.actionLabel})`,
                                    ver.text,
                                    'restore',
                                  );
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0C7D87] hover:underline"
                              >
                                <RotateCcw className="w-3 h-3" />
                                Khôi phục phiên bản này
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 10-POINT QUALITY CHECKER */}
                {renderQualityPanel(rcQualityReport)}
              </div>
            ) : (
              /* ============================================================
                 TAB 2: TIN NHẮN PHỐI HỢP PHỤ HUYNH (10 MỤC ĐÍCH)
                 ============================================================ */
              <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-[#102744] flex items-center gap-2">
                      <MessageSquareHeart className="w-5 h-5 text-[#0C9BA6]" />
                      Soạn Tin nhắn phối hợp phụ huynh — {selectedStudent.fullName}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Ngôn ngữ tôn trọng, đồng hành, không đổ lỗi phụ huynh, không rò rỉ thông tin học sinh khác.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-900 text-xs font-bold">
                    Chế độ bản nháp — Không tự động gửi
                  </span>
                </div>

                {/* RECIPIENT + PENDING VERIFICATION GUARD */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div
                    className={`rounded-xl border p-3 ${
                      hasVerifiedParentRecipient
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-amber-50 border-amber-300'
                    }`}
                  >
                    <div className="text-[11px] text-slate-500">Phụ huynh học sinh (chỉ hiển thị cho GVCN)</div>
                    {hasVerifiedParentRecipient ? (
                      <>
                        <div className="font-bold text-[#102744] mt-0.5">
                          {cleanParentName || 'Chưa cập nhật tên phụ huynh'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          SĐT: {cleanParentPhone || 'Chưa lưu'} (không gửi SĐT sang AI)
                        </div>
                      </>
                    ) : (
                      <div className="mt-1 space-y-1">
                        <div className="font-bold text-amber-950 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          Chưa cập nhật thông tin phụ huynh
                        </div>
                        <p className="text-[11px] text-amber-900 leading-snug">
                          Không cho phép duyệt gửi hoặc sao chép gửi tin nhắn khi chưa xác minh Tên hoặc SĐT phụ huynh. GVCN vẫn có thể lưu bản nháp và cập nhật thông tin phụ huynh trong mục Danh sách lớp.
                        </p>
                      </div>
                    )}
                  </div>
                  <div
                    className={`rounded-xl border p-3 ${
                      evidence.effectiveIncidentStatus === 'pending_verification' ||
                      pmPurpose === 'xac_minh_thong_tin_chua_xac_nhan'
                        ? 'bg-amber-50 border-amber-300 text-amber-950'
                        : 'bg-teal-50/60 border-teal-200 text-teal-950'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      {evidence.effectiveIncidentStatus === 'pending_verification' ||
                      pmPurpose === 'xac_minh_thong_tin_chua_xac_nhan' ? (
                        <>
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          Chế độ bảo vệ thông tin CHƯA XÁC MINH
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4 text-[#0C9BA6]" />
                          Trạng thái dữ liệu: Đã xác thực đơn lẻ
                        </>
                      )}
                    </div>
                    <p className="text-[11px] mt-1 leading-snug">
                      {evidence.effectiveIncidentStatus === 'pending_verification' ||
                      pmPurpose === 'xac_minh_thong_tin_chua_xac_nhan'
                        ? 'AI chỉ tạo bản nháp trung lập để hẹn trao đổi/tìm hiểu. GVCN cần trực tiếp xác minh trước khi gửi phụ huynh.'
                        : 'Tin nhắn chỉ sử dụng minh chứng của riêng học sinh đang chọn và không tự động gửi đi.'}
                    </p>
                  </div>
                </div>

                {/* 10 PURPOSES + TONE + SALUTATION */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-7">
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Mục đích trao đổi phụ huynh (10 tình huống chuẩn)
                    </label>
                    <select
                      value={pmPurpose}
                      onChange={(e) => setPmPurpose(e.target.value as ParentMessagePurposeId)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#102744]"
                    >
                      {PARENT_MESSAGE_PURPOSES.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {PARENT_MESSAGE_PURPOSES.find((p) => p.id === pmPurpose)?.description}
                    </p>
                  </div>

                  <div className="md:col-span-5">
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Giọng điệu giao tiếp
                    </label>
                    <select
                      value={pmTone}
                      onChange={(e) => setPmTone(e.target.value as ParentMessageTone)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-[#102744]"
                    >
                      {PARENT_MESSAGE_TONES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-6">
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Cách xưng hô mở đầu (tùy chỉnh)
                    </label>
                    <input
                      type="text"
                      value={pmSalutation}
                      onChange={(e) => setPmSalutation(e.target.value)}
                      placeholder={`Kính gửi quý phụ huynh em ${selectedStudent.fullName},`}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                  </div>

                  <div className="md:col-span-6">
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Ghi chú thêm cho tin nhắn (lịch họp, giờ hẹn, lưu ý riêng...)
                    </label>
                    <input
                      type="text"
                      value={pmExtraInstruction}
                      onChange={(e) => setPmExtraInstruction(e.target.value)}
                      placeholder="VD: Mời phụ huynh họp lúc 7h30 Chủ nhật tại phòng 12D6..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                  </div>
                </div>

                {/* 7 AI ACTIONS TOOLBAR */}
                <div className="flex flex-wrap gap-2">
                  {PEDAGOGICAL_REFINE_ACTIONS.map((act) => {
                    const isPrimary = act.id === 'generate';
                    const isLoading = pmAiLoading === act.id;
                    return (
                      <button
                        key={act.id}
                        type="button"
                        disabled={Boolean(pmAiLoading)}
                        onClick={() => handleRunParentMessageAi(act.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition disabled:opacity-50 ${
                          isPrimary
                            ? 'bg-[#102744] hover:bg-[#193A63] text-white shadow-sm'
                            : 'bg-slate-100 hover:bg-teal-50 text-[#102744] border border-slate-200 hover:border-[#0C9BA6]'
                        }`}
                      >
                        {isLoading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-[#0C9BA6]" />
                        )}
                        {act.id === 'generate' ? 'Tạo bản nháp tin nhắn' : act.label}
                      </button>
                    );
                  })}
                </div>

                {/* ANTI-OVERWRITE PROPOSAL BOX */}
                {pmAiProposal && (
                  <div className="rounded-xl border-2 border-[#0C9BA6] bg-teal-50/70 p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#102744]">
                        Đề xuất mới từ AI ({pmAiProposal.actionLabel}) — Chưa ghi đè bản nháp GVCN
                      </span>
                      <span className="text-[11px] text-teal-800 font-semibold">
                        {countWords(pmAiProposal.text)} từ
                      </span>
                    </div>
                    <p className="text-sm text-slate-800 bg-white rounded-lg border border-teal-200 p-3 leading-relaxed whitespace-pre-line">
                      {pmAiProposal.text}
                    </p>
                    {pmAiProposal.notes && (
                      <p className="text-xs text-teal-900">
                        <strong>Lưu ý cho GVCN:</strong> {pmAiProposal.notes}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleApplyPmProposal}
                        className="px-3 py-1.5 rounded-lg bg-[#0C9BA6] hover:bg-[#09828B] text-white text-xs font-bold"
                      >
                        Áp dụng đề xuất (lưu bản cũ vào lịch sử)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPmAiProposal(null)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                      >
                        Giữ nguyên bản GVCN &amp; đóng
                      </button>
                    </div>
                  </div>
                )}

                {/* DIRECT EDITABLE TEXTAREA */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-bold text-[#102744]">
                      Bản nháp tin nhắn gửi phụ huynh (GVCN chỉnh sửa trực tiếp)
                    </label>
                    <div className="flex items-center gap-2 text-slate-500">
                      {pmTeacherEdited && (
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">
                          GVCN đã chỉnh sửa tay (được bảo vệ)
                        </span>
                      )}
                      <span>
                        {countWords(pmDraft)} từ • {pmDraft.length} ký tự
                      </span>
                    </div>
                  </div>
                  <textarea
                    rows={6}
                    value={pmDraft}
                    onChange={(e) => {
                      setPmDraft(e.target.value);
                      setPmTeacherEdited(true);
                    }}
                    placeholder='Nhấn "Tạo bản nháp tin nhắn" hoặc tự soạn nội dung trao đổi với phụ huynh...'
                    className="w-full px-3.5 py-3 rounded-xl border border-slate-300 text-sm text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#0C9BA6]"
                  />
                  {pmAiNotes && (
                    <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <strong>Lưu ý dành riêng cho GVCN trước khi gửi:</strong> {pmAiNotes}
                    </div>
                  )}
                </div>

                {/* ACTION BAR */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={!hasVerifiedParentRecipient || !pmDraft.trim()}
                      title={
                        hasVerifiedParentRecipient
                          ? 'Sao chép để GVCN tự gửi cho phụ huynh'
                          : 'Chưa cập nhật thông tin phụ huynh — không cho phép gửi khi chưa xác minh người nhận'
                      }
                      onClick={() => handleCopyText(pmDraft, 'bản nháp tin nhắn phụ huynh')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Sao chép để GVCN tự gửi
                    </button>
                    <button
                      type="button"
                      disabled={pmSaving || !pmDraft.trim()}
                      onClick={() => handlePersistParentMessage('draft', 'GVCN lưu bản nháp tin nhắn')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {pmSaving ? 'Đang lưu...' : 'Lưu bản nháp'}
                    </button>
                    <button
                      type="button"
                      disabled={pmSaving || !pmDraft.trim() || !hasVerifiedParentRecipient}
                      title={
                        hasVerifiedParentRecipient
                          ? 'Đánh dấu bản tin nhắn đã duyệt sẵn sàng gửi'
                          : 'Chưa cập nhật thông tin phụ huynh — vui lòng bổ sung trước khi duyệt gửi'
                      }
                      onClick={() =>
                        handlePersistParentMessage('approved_ready', 'GVCN duyệt bản sẵn sàng sao chép')
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Đánh dấu bản đã duyệt
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowPmHistory((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700"
                  >
                    <History className="w-3.5 h-3.5 text-[#0C9BA6]" />
                    Lịch sử phiên bản ({savedParentMessage?.versions?.length || 0})
                  </button>
                </div>

                {/* PARENT MESSAGE HISTORY */}
                {showPmHistory && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                    <div className="text-xs font-bold text-[#102744]">
                      Lịch sử phiên bản tin nhắn phụ huynh
                    </div>
                    {!savedParentMessage?.versions?.length ? (
                      <p className="text-xs text-slate-500 italic">Chưa có phiên bản đã lưu.</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {savedParentMessage.versions.map((ver) => (
                          <div
                            key={ver.versionId}
                            className="rounded-lg bg-white border border-slate-200 p-2.5 text-xs space-y-1.5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                              <span className="font-bold text-[#102744]">{ver.actionLabel}</span>
                              <span>
                                {ver.actorEmail} • {formatDateTime(ver.savedAtMs)}
                              </span>
                            </div>
                            <p className="text-slate-700 leading-relaxed whitespace-pre-line">{ver.text}</p>
                            <button
                              type="button"
                              onClick={() => {
                                setPmDraft(ver.text);
                                setPmTeacherEdited(true);
                                handlePersistParentMessage(
                                  'draft',
                                  `Khôi phục từ phiên bản (${ver.actionLabel})`,
                                  ver.text,
                                  'restore',
                                );
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0C7D87] hover:underline"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Khôi phục phiên bản này
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 10-POINT QUALITY CHECKER */}
                {renderQualityPanel(pmQualityReport)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====================================================================
          ISOLATED 10-SCENARIO TEST SIMULATION MODAL (SECTION X)
          ==================================================================== */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-[#102744] text-white px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <FlaskConical className="w-5 h-5 text-amber-300" />
                  Môi trường Kiểm thử 10 Tình huống Sư phạm (TEST tách biệt)
                </h3>
                <p className="text-xs text-teal-100 mt-0.5">
                  Chạy hoàn toàn trên bộ nhớ mô phỏng độc lập — KHÔNG ghi vào Firestore và KHÔNG ảnh hưởng dữ liệu thật lớp {classConfig.className}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12">
              {/* Scenario list */}
              <div className="lg:col-span-4 border-r border-slate-200 bg-slate-50 p-3 space-y-1.5">
                {PEDAGOGICAL_TEST_SCENARIOS.map((sc) => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => setSelectedScenarioId(sc.id)}
                    className={`w-full text-left p-2.5 rounded-xl border text-xs transition ${
                      sc.id === activeScenario.id
                        ? 'bg-[#102744] text-white border-[#102744] shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-[#0C9BA6]'
                    }`}
                  >
                    <div className="font-bold">
                      Tình huống #{sc.number}: {sc.title}
                    </div>
                    <div
                      className={`text-[11px] mt-0.5 ${
                        sc.id === activeScenario.id ? 'text-teal-200' : 'text-slate-500'
                      }`}
                    >
                      {sc.student.fullName} • {sc.semester} • MOET: {sc.student.moetCode}
                    </div>
                  </button>
                ))}
              </div>

              {/* Scenario detail & verification */}
              <div className="lg:col-span-8 p-5 space-y-4">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs space-y-1.5">
                  <div className="font-bold text-[#102744] text-sm">
                    #{activeScenario.number}. {activeScenario.title}
                  </div>
                  <p className="text-slate-600">
                    <strong>Tiêu chí kỳ vọng:</strong> {activeScenario.expectedBehavior}
                  </p>
                  <div className="pt-1 flex flex-wrap gap-2">
                    <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono">
                      STT #{activeScenario.student.rosterOrder} • {activeScenario.student.moetCode}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-white border border-slate-200">
                      Học tập TT22: {activeScenarioEvidence.officialAcademic || 'Chưa xác nhận'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-white border border-slate-200">
                      Rèn luyện TT22: {activeScenarioEvidence.officialConduct || 'Chưa xác nhận'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-white border border-slate-200">
                      Trạng thái sự việc: {activeScenarioEvidence.effectiveIncidentStatus}
                    </span>
                  </div>
                  {activeScenarioEvidence.insufficientEvidenceWarning && (
                    <div className="mt-2 rounded-lg bg-amber-100 border border-amber-300 text-amber-950 px-3 py-2 font-bold">
                      Cảnh báo thiếu dữ liệu kích hoạt chuẩn xác: &ldquo;
                      {activeScenarioEvidence.insufficientEvidenceWarning}&rdquo;
                    </div>
                  )}
                </div>

                {/* Duplicate name pairing proof for Scenario 10 */}
                {pairedScenarioEvidence && activeScenario.pairedStudentForDuplicateCheck && (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 text-xs space-y-1.5">
                    <div className="font-bold text-indigo-950">
                      Đối chiếu chống nhầm học sinh trùng họ tên (Tình huống #10)
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="bg-white rounded-lg p-2.5 border border-indigo-200">
                        <div className="font-bold text-[#102744]">
                          HS A: {activeScenarioEvidence.studentName}
                        </div>
                        <div>
                          STT #{activeScenarioEvidence.rosterOrder} • MOET:{' '}
                          <strong>{activeScenarioEvidence.moetCode}</strong> • Tổ {activeScenarioEvidence.team}
                        </div>
                        <div>
                          ĐTB: <strong>{activeScenarioEvidence.semesterScore?.avg}</strong> • TT22:{' '}
                          {activeScenarioEvidence.officialAcademic}/{activeScenarioEvidence.officialConduct}
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-2.5 border border-indigo-200">
                        <div className="font-bold text-[#102744]">
                          HS B: {pairedScenarioEvidence.studentName}
                        </div>
                        <div>
                          STT #{pairedScenarioEvidence.rosterOrder} • MOET:{' '}
                          <strong>{pairedScenarioEvidence.moetCode}</strong> • Tổ {pairedScenarioEvidence.team}
                        </div>
                        <div>
                          ĐTB: <strong>{pairedScenarioEvidence.semesterScore?.avg}</strong> • TT22:{' '}
                          {pairedScenarioEvidence.officialAcademic}/{pairedScenarioEvidence.officialConduct}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Report card test result */}
                <div className="rounded-xl border border-slate-200 p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#102744]">
                      Kiểm thử Nhận xét học bạ (Thông tư 22)
                    </span>
                    <button
                      type="button"
                      disabled={testAiBusy}
                      onClick={() => handleRunIsolatedScenarioAi('report_card')}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#102744] text-white text-[11px] font-semibold disabled:opacity-50"
                    >
                      <Sparkles className="w-3 h-3 text-teal-300" />
                      Chạy thử AI thật (không lưu)
                    </button>
                  </div>
                  <p className="text-xs text-slate-800 bg-slate-50 rounded-lg p-3 leading-relaxed">
                    {scenarioRcText ||
                      '(Không tự bịa nhận xét khi thiếu dữ liệu đầu vào — hệ thống yêu cầu GVCN bổ sung minh chứng.)'}
                  </p>
                  <div className="text-[11px] text-slate-600">
                    Kết quả kiểm tra tự động:{' '}
                    <strong className="text-emerald-700">{scenarioRcQuality.passedCount}/10 đạt</strong> •{' '}
                    {scenarioRcQuality.warningCount} lưu ý • {scenarioRcQuality.errorCount} lỗi nghiêm trọng
                  </div>
                </div>

                {/* Parent message test result */}
                <div className="rounded-xl border border-slate-200 p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#102744]">
                      Kiểm thử Tin nhắn phụ huynh
                    </span>
                    <button
                      type="button"
                      disabled={testAiBusy}
                      onClick={() => handleRunIsolatedScenarioAi('parent_message')}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0C9BA6] text-white text-[11px] font-semibold disabled:opacity-50"
                    >
                      <Sparkles className="w-3 h-3" />
                      Chạy thử AI thật (không lưu)
                    </button>
                  </div>
                  <p className="text-xs text-slate-800 bg-slate-50 rounded-lg p-3 leading-relaxed whitespace-pre-line">
                    {scenarioPmText}
                  </p>
                  <div className="text-[11px] text-slate-600">
                    Kết quả kiểm tra tự động:{' '}
                    <strong className="text-emerald-700">{scenarioPmQuality.passedCount}/10 đạt</strong> •{' '}
                    {scenarioPmQuality.warningCount} lưu ý • {scenarioPmQuality.errorCount} lỗi nghiêm trọng
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
