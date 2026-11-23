import {
  Grade12Profile,
  OfficialTt22Level,
  ParentMessagePurposeId,
  ParentMessageTone,
  PedagogicalIncidentStatus,
  PedagogicalObservationRecord,
  PedagogicalSemester,
  ReportCardCommentRecord,
  ReportCardLengthMode,
  StudentRecord as Student,
  SubjectScoreRecord as SubjectScore,
  TicketRecord as Ticket,
  WeeklySnapshot,
} from '../types/gvcn';
import { getVneduScoreDocId } from './vneduScoreImport';

export const INSUFFICIENT_EVIDENCE_MESSAGE =
  'Chưa đủ căn cứ để tạo nhận xét đầy đủ. GVCN cần bổ sung hoặc xác nhận thông tin.';

export const AUTO_CHECK_DISCLAIMER =
  'Kiểm tra tự động chỉ hỗ trợ rà soát kỹ thuật và ngôn ngữ sư phạm; GVCN là người đọc, đối chiếu minh chứng và quyết định cuối cùng.';

export type PedagogicalRefineAction =
  | 'generate'
  | 'regenerate'
  | 'shorten'
  | 'more_formal'
  | 'gentler'
  | 'more_specific'
  | 'rephrase_keep_meaning';

export const PEDAGOGICAL_SEMESTERS: PedagogicalSemester[] = [
  'Học kỳ I',
  'Học kỳ II',
  'Cả năm',
];

export const OFFICIAL_TT22_LEVELS: { value: OfficialTt22Level; label: string }[] = [
  { value: '', label: 'Chưa xác nhận xếp loại TT22' },
  { value: 'Tốt', label: 'Tốt' },
  { value: 'Khá', label: 'Khá' },
  { value: 'Đạt', label: 'Đạt' },
  { value: 'Chưa đạt', label: 'Chưa đạt' },
];

export const REPORT_CARD_LENGTH_CONFIG: Record<
  ReportCardLengthMode,
  {
    label: string;
    shortLabel: string;
    minWords: number;
    maxWords: number;
    description: string;
  }
> = {
  short: {
    label: 'Ngắn (25–40 từ)',
    shortLabel: 'Ngắn',
    minWords: 25,
    maxWords: 40,
    description: 'Cô đọng, phù hợp ô nhận xét ngắn trên học bạ điện tử.',
  },
  standard: {
    label: 'Tiêu chuẩn (40–65 từ)',
    shortLabel: 'Tiêu chuẩn',
    minWords: 40,
    maxWords: 65,
    description: 'Cân bằng ưu điểm, điểm cần cải thiện (nếu có) và định hướng.',
  },
  detailed: {
    label: 'Chi tiết (65–90 từ)',
    shortLabel: 'Chi tiết',
    minWords: 65,
    maxWords: 90,
    description: 'Nêu rõ minh chứng học tập, rèn luyện, tiến bộ và định hướng cụ thể.',
  },
};

export const PARENT_MESSAGE_PURPOSES: {
  id: ParentMessagePurposeId;
  label: string;
  description: string;
  defaultTone: ParentMessageTone;
  requiresUnverifiedGuard?: boolean;
}[] = [
  {
    id: 'khen_ngoi_dong_vien',
    label: '1. Khen ngợi, động viên học sinh',
    description: 'Ghi nhận nỗ lực, điểm sáng đã có minh chứng để gia đình cùng khích lệ.',
    defaultTone: 'gan_gui',
  },
  {
    id: 'thong_bao_tien_bo',
    label: '2. Thông báo tiến bộ',
    description: 'Chia sẻ sự chuyển biến tích cực về học tập hoặc nề nếp so với giai đoạn trước.',
    defaultTone: 'gan_gui',
  },
  {
    id: 'nhac_nho_chuyen_can',
    label: '3. Nhắc nhở chuyên cần (đi muộn / nghỉ học)',
    description: 'Phối hợp gia đình nắm tình hình đi học đúng giờ, nghỉ có phép và đảm bảo chuyên cần.',
    defaultTone: 'phoi_hop',
  },
  {
    id: 'nhac_nho_ne_nep',
    label: '4. Nhắc nhở nề nếp, tác phong',
    description: 'Trao đổi nhẹ nhàng, xây dựng để cùng uốn nắn thói quen và nội quy lớp học.',
    defaultTone: 'nhe_nhang',
  },
  {
    id: 'trao_doi_hoc_tap_giam',
    label: '5. Trao đổi về kết quả học tập giảm sút',
    description: 'Cảnh báo sớm trên tinh thần đồng hành, tìm nguyên nhân và lộ trình hỗ trợ.',
    defaultTone: 'phoi_hop',
  },
  {
    id: 'phoi_hop_su_viec_da_xac_minh',
    label: '6. Phối hợp xử lý sự việc đã được GVCN xác minh',
    description: 'Trình bày khách quan sự việc đã xác minh, ưu tiên giải pháp giáo dục và phối hợp.',
    defaultTone: 'trang_trong',
  },
  {
    id: 'xac_minh_thong_tin_chua_xac_nhan',
    label: '7. Hẹn trao đổi / xác minh thông tin chưa xác nhận',
    description: 'Trung lập, tuyệt đối không kết luận hay quy chụp khi GVCN chưa xác minh đủ.',
    defaultTone: 'nhe_nhang',
    requiresUnverifiedGuard: true,
  },
  {
    id: 'thong_bao_ke_hoach_hop_ph',
    label: '8. Thông báo kế hoạch học tập / họp phụ huynh',
    description: 'Thông tin rõ lịch họp, kế hoạch học kỳ hoặc các mốc phối hợp quan trọng.',
    defaultTone: 'trang_trong',
  },
  {
    id: 'dinh_huong_thi_tot_nghiep_12',
    label: '9. Định hướng ôn tập, thi tốt nghiệp lớp 12',
    description: 'Trao đổi tổ hợp xét tuyển, nhịp ôn tập và giữ sức khỏe tâm lý giai đoạn lớp 12.',
    defaultTone: 'phoi_hop',
  },
  {
    id: 'dong_vien_tam_ly_hoan_canh',
    label: '10. Động viên tâm lý / hỗ trợ học sinh có hoàn cảnh khó khăn',
    description: 'Thể hiện sự thấu cảm, tôn trọng sự riêng tư và đồng hành tích cực cùng gia đình.',
    defaultTone: 'nhe_nhang',
  },
];

export const PARENT_MESSAGE_TONES: { value: ParentMessageTone; label: string }[] = [
  { value: 'trang_trong', label: 'Trang trọng, chuẩn mực' },
  { value: 'gan_gui', label: 'Gần gũi, ấm áp' },
  { value: 'nhe_nhang', label: 'Nhẹ nhàng, tế nhị' },
  { value: 'phoi_hop', label: 'Khách quan, phối hợp' },
];

export const PEDAGOGICAL_REFINE_ACTIONS: {
  id: PedagogicalRefineAction;
  label: string;
  shortLabel: string;
}[] = [
  { id: 'generate', label: 'Tạo nhận xét / bản nháp', shortLabel: 'Tạo mới' },
  { id: 'regenerate', label: 'Tạo lại phương án khác', shortLabel: 'Phương án khác' },
  { id: 'shorten', label: 'Rút gọn', shortLabel: 'Rút gọn' },
  { id: 'more_formal', label: 'Trang trọng hơn', shortLabel: 'Trang trọng hơn' },
  { id: 'gentler', label: 'Nhẹ nhàng hơn', shortLabel: 'Nhẹ nhàng hơn' },
  { id: 'more_specific', label: 'Cụ thể hơn theo minh chứng', shortLabel: 'Cụ thể hơn' },
  { id: 'rephrase_keep_meaning', label: 'Giữ nguyên ý, sửa diễn đạt', shortLabel: 'Sửa diễn đạt' },
];

export function getPedagogicalSemesterSlug(semester: PedagogicalSemester): string {
  if (semester === 'Học kỳ II') return 'hk2';
  if (semester === 'Cả năm') return 'cn';
  return 'hk1';
}

export function getPedagogicalObservationDocId(
  studentId: string,
  semester: PedagogicalSemester,
): string {
  const safeId = String(studentId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `obs_${safeId}_${getPedagogicalSemesterSlug(semester)}`;
}

export function getReportCardCommentDocId(
  studentId: string,
  semester: PedagogicalSemester,
): string {
  const safeId = String(studentId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `rc_${safeId}_${getPedagogicalSemesterSlug(semester)}`;
}

export function getParentMessageDocId(
  studentId: string,
  semester: PedagogicalSemester,
  purpose: ParentMessagePurposeId,
): string {
  const safeId = String(studentId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `pm_${safeId}_${getPedagogicalSemesterSlug(semester)}_${purpose}`;
}

export function isTestRecordText(text?: string | null): boolean {
  const raw = String(text || '').trim();
  if (!raw) return false;
  return /(\[TEST\]|TEST_|\bDEMO_TEST\b|DỮ LIỆU TEST|DU LIEU TEST|MÔ PHỎNG TEST|SAMPLE_TEST)/i.test(
    raw,
  );
}

export function normalizeVietnameseText(text: string): string {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function countWords(text: string): number {
  const cleaned = String(text || '').trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

export function stripSensitiveIdentifiers(text: string): string {
  return String(text || '')
    .replace(/(?:\+84|0)(?:[\s.\-]*\d){8,10}/g, '[đã ẩn SĐT]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[đã ẩn email]')
    .trim();
}

export interface StudentSemesterScoreSummary {
  semester: PedagogicalSemester;
  subjectName: string;
  tx1: number | null;
  tx2: number | null;
  gk: number | null;
  ck: number | null;
  avg: number | null;
  note: string;
}

export interface StudentEmulationSummary {
  totalLockedWeeks: number;
  countA: number;
  countB: number;
  countC: number;
  weekDetails: string[];
  disclaimer: string;
}

export interface VerifiedStudentEvidence {
  studentId: string;
  studentCode: string;
  moetCode: string;
  rosterOrder: number | null;
  studentName: string;
  gender: string;
  team: number;
  roles: string[];
  semester: PedagogicalSemester;
  schoolYear: string;
  officialConduct: OfficialTt22Level;
  officialAcademic: OfficialTt22Level;
  semesterScore: StudentSemesterScoreSummary | null;
  hk1ScoreAvg: number | null;
  hk2ScoreAvg: number | null;
  scoreProgressionNote: string;
  attendancePresent: number;
  attendanceAbsent: number;
  internalEmulation: StudentEmulationSummary;
  verifiedTickets: { id: string; date: string; category: string; description: string }[];
  pendingTickets: { id: string; date: string; category: string; description: string }[];
  grade12Summary: {
    examBlock: string;
    targetUniversity: string;
    targetMajor: string;
    readiness: string;
    teacherNote: string;
  } | null;
  teacherObservation: {
    verifiedStrengths: string;
    verifiedImprovements: string;
    verifiedAchievements: string;
    verifiedIncidentNote: string;
    incidentStatus: PedagogicalIncidentStatus;
    sourceLabel: string;
    confirmedByEmail: string;
    confirmedAtMs: number | null;
  };
  effectiveIncidentStatus: PedagogicalIncidentStatus;
  studentProfileNote: string;
  evidenceItems: string[];
  missingEvidenceHints: string[];
  hasEnoughEvidence: boolean;
  insufficientEvidenceWarning: string | null;
  excludedTestCount: number;
}

export interface BuildEvidenceParams {
  student: Student;
  semester: PedagogicalSemester;
  schoolYear: string;
  activeSubjectSlug: string;
  activeSubjectName: string;
  subjectScores: Record<string, SubjectScore>;
  weeklySnapshots: WeeklySnapshot[];
  tickets: Ticket[];
  grade12Profiles: Record<string, Grade12Profile>;
  observation?: PedagogicalObservationRecord | null;
}

function matchesSemesterLabel(snapshotSemester: string | undefined, target: PedagogicalSemester): boolean {
  const norm = normalizeVietnameseText(snapshotSemester || '');
  if (target === 'Cả năm') return true;
  if (target === 'Học kỳ I') {
    return !norm || norm.includes('hoc ky 1') || norm.includes('hoc ky i') || norm === 'hk1' || norm === 'hk i';
  }
  return norm.includes('hoc ky 2') || norm.includes('hoc ky ii') || norm === 'hk2' || norm === 'hk ii';
}

function ticketBelongsToStudent(ticket: Ticket, student: Student): boolean {
  const desc = String(ticket.description || '');
  if (isTestRecordText(desc) || isTestRecordText(ticket.category)) return false;

  if (ticket.studentId && (ticket.studentId === student.id || ticket.studentId === student.code)) {
    return true;
  }
  if (!desc) return false;

  const normDesc = normalizeVietnameseText(desc);
  const normName = normalizeVietnameseText(student.fullName);
  const normCode = normalizeVietnameseText(student.code);
  const normMoet = normalizeVietnameseText(student.moetCode || '');

  if (normMoet && normMoet.length >= 6 && normDesc.includes(normMoet)) return true;
  if (normCode && normCode.length >= 3 && new RegExp(`\\b${normCode}\\b`, 'i').test(normDesc)) {
    return true;
  }
  if (normName && normName.split(' ').length >= 2 && normDesc.includes(normName)) {
    return true;
  }
  return false;
}

export function buildVerifiedStudentEvidence(params: BuildEvidenceParams): VerifiedStudentEvidence {
  const {
    student,
    semester,
    schoolYear,
    activeSubjectSlug,
    activeSubjectName,
    subjectScores,
    weeklySnapshots,
    tickets,
    grade12Profiles,
    observation,
  } = params;

  const studentId = student.id || student.code;
  const studentCode = student.code;
  const moetCode = String(student.moetCode || '').trim();
  const rosterOrder =
    typeof student.rosterOrder === 'number' && Number.isFinite(student.rosterOrder)
      ? student.rosterOrder
      : null;

  let excludedTestCount = 0;

  // 1. Subject scores strictly separated by semester via getVneduScoreDocId
  const hk1Doc = subjectScores[getVneduScoreDocId(studentCode, activeSubjectSlug, 'Học kỳ I')];
  const hk2Doc = subjectScores[getVneduScoreDocId(studentCode, activeSubjectSlug, 'Học kỳ II')];
  const cnDoc = subjectScores[getVneduScoreDocId(studentCode, activeSubjectSlug, 'Cả năm')];
  const currentScoreDoc =
    semester === 'Học kỳ I' ? hk1Doc : semester === 'Học kỳ II' ? hk2Doc : cnDoc || hk2Doc || hk1Doc;

  let semesterScore: StudentSemesterScoreSummary | null = null;
  if (currentScoreDoc) {
    const scoreNoteClean = isTestRecordText(currentScoreDoc.note)
      ? ''
      : stripSensitiveIdentifiers(currentScoreDoc.note || '');
    if (isTestRecordText(currentScoreDoc.note)) excludedTestCount += 1;

    const hasAnyScore =
      currentScoreDoc.avg !== null ||
      currentScoreDoc.gk !== null ||
      currentScoreDoc.ck !== null ||
      currentScoreDoc.tx1 !== null ||
      currentScoreDoc.tx2 !== null;

    if (hasAnyScore) {
      semesterScore = {
        semester,
        subjectName: currentScoreDoc.subject || activeSubjectName,
        tx1: currentScoreDoc.tx1 ?? null,
        tx2: currentScoreDoc.tx2 ?? null,
        gk: currentScoreDoc.gk ?? null,
        ck: currentScoreDoc.ck ?? null,
        avg: currentScoreDoc.avg ?? null,
        note: scoreNoteClean,
      };
    }
  }

  const hk1ScoreAvg = hk1Doc && typeof hk1Doc.avg === 'number' ? hk1Doc.avg : null;
  const hk2ScoreAvg = hk2Doc && typeof hk2Doc.avg === 'number' ? hk2Doc.avg : null;

  let scoreProgressionNote = '';
  if (
    (semester === 'Học kỳ II' || semester === 'Cả năm') &&
    hk1ScoreAvg !== null &&
    hk2ScoreAvg !== null
  ) {
    const diff = Number((hk2ScoreAvg - hk1ScoreAvg).toFixed(1));
    if (diff >= 0.4) {
      scoreProgressionNote = `Điểm môn ${activeSubjectName} tiến bộ rõ từ ${hk1ScoreAvg.toFixed(1)} (HK I) lên ${hk2ScoreAvg.toFixed(1)} (HK II, tăng +${diff.toFixed(1)}).`;
    } else if (diff <= -0.4) {
      scoreProgressionNote = `Điểm môn ${activeSubjectName} giảm từ ${hk1ScoreAvg.toFixed(1)} (HK I) xuống ${hk2ScoreAvg.toFixed(1)} (HK II, giảm ${Math.abs(diff).toFixed(1)}).`;
    } else {
      scoreProgressionNote = `Điểm môn ${activeSubjectName} giữ ổn định giữa HK I (${hk1ScoreAvg.toFixed(1)}) và HK II (${hk2ScoreAvg.toFixed(1)}).`;
    }
  }

  // 2. Internal weekly emulation (strictly filtered by semester & excluding TEST)
  let countA = 0;
  let countB = 0;
  let countC = 0;
  const weekDetails: string[] = [];
  for (const snap of weeklySnapshots) {
    if (isTestRecordText(snap.weekLabel) || isTestRecordText(snap.semesterLabel)) {
      excludedTestCount += 1;
      continue;
    }
    if (!matchesSemesterLabel(snap.semesterLabel, semester)) continue;
    const rec = snap.records?.[studentCode];
    if (!rec) continue;
    if (isTestRecordText(rec.note)) {
      excludedTestCount += 1;
      continue;
    }
    if (rec.rank === 'A') countA += 1;
    else if (rec.rank === 'B') countB += 1;
    else if (rec.rank === 'C') countC += 1;
    weekDetails.push(
      `${snap.weekLabel}: ${rec.rank}${rec.note ? ` (${stripSensitiveIdentifiers(rec.note)})` : ''}`,
    );
  }
  const totalLockedWeeks = countA + countB + countC;

  // 3. Tickets separated into verified (approved) vs pending_verification
  const verifiedTickets: { id: string; date: string; category: string; description: string }[] = [];
  const pendingTickets: { id: string; date: string; category: string; description: string }[] = [];

  for (const tk of tickets) {
    if (isTestRecordText(tk.description) || isTestRecordText(tk.category)) {
      excludedTestCount += 1;
      continue;
    }
    if (!ticketBelongsToStudent(tk, student)) continue;
    const cleanEntry = {
      id: tk.id,
      date: tk.date,
      category: tk.category,
      description: stripSensitiveIdentifiers(tk.description),
    };
    if (tk.status === 'approved') {
      verifiedTickets.push(cleanEntry);
    } else if (tk.status === 'pending' || tk.status === 'needs_revision') {
      pendingTickets.push(cleanEntry);
    }
  }

  // 4. Grade 12 orientation profile (only if non-test and meaningful)
  const rawG12 = grade12Profiles[studentCode];
  let grade12Summary: VerifiedStudentEvidence['grade12Summary'] = null;
  if (rawG12 && !isTestRecordText(rawG12.teacherNote) && !isTestRecordText(rawG12.targetMajor)) {
    const hasG12Content = Boolean(
      rawG12.examBlock || rawG12.targetUniversity || rawG12.targetMajor || rawG12.teacherNote,
    );
    if (hasG12Content) {
      grade12Summary = {
        examBlock: rawG12.examBlock || '',
        targetUniversity: rawG12.targetUniversity || '',
        targetMajor: rawG12.targetMajor || '',
        readiness: rawG12.readiness || '',
        teacherNote: stripSensitiveIdentifiers(rawG12.teacherNote || ''),
      };
    }
  }

  // 5. GVCN confirmed observation record
  const cleanObsStrengths =
    observation?.verifiedStrengths && !isTestRecordText(observation.verifiedStrengths)
      ? stripSensitiveIdentifiers(observation.verifiedStrengths)
      : '';
  const cleanObsImprovements =
    observation?.verifiedImprovements && !isTestRecordText(observation.verifiedImprovements)
      ? stripSensitiveIdentifiers(observation.verifiedImprovements)
      : '';
  const cleanObsAchievements =
    observation?.verifiedAchievements && !isTestRecordText(observation.verifiedAchievements)
      ? stripSensitiveIdentifiers(observation.verifiedAchievements)
      : '';
  const cleanObsIncident =
    observation?.verifiedIncidentNote && !isTestRecordText(observation.verifiedIncidentNote)
      ? stripSensitiveIdentifiers(observation.verifiedIncidentNote)
      : '';

  const officialConduct: OfficialTt22Level = observation?.officialConduct || '';
  const officialAcademic: OfficialTt22Level = observation?.officialAcademic || '';

  let effectiveIncidentStatus: PedagogicalIncidentStatus = observation?.incidentStatus || 'none';
  if (effectiveIncidentStatus === 'none' && pendingTickets.length > 0) {
    effectiveIncidentStatus = 'pending_verification';
  }

  const studentProfileNote =
    student.note && !isTestRecordText(student.note)
      ? stripSensitiveIdentifiers(student.note)
      : '';

  const ROLE_SLUG_LABELS: Record<string, string> = {
    lop_truong: 'Lớp trưởng',
    to_truong_1: 'Tổ trưởng Tổ 1',
    to_truong_2: 'Tổ trưởng Tổ 2',
    to_truong_3: 'Tổ trưởng Tổ 3',
    to_truong_4: 'Tổ trưởng Tổ 4',
    thu_quy: 'Thủ quỹ',
    bi_thu: 'Bí thư',
  };
  const roles = Array.from(
    new Set(
      [...(student.roles || []), student.role, student.secondRole]
        .map((r) => {
          const raw = String(r || '').trim();
          return ROLE_SLUG_LABELS[raw] || raw;
        })
        .filter((r) => r && r !== 'Thành viên'),
    ),
  );

  // 6. Compile concrete evidence items
  const evidenceItems: string[] = [];
  if (officialAcademic) {
    evidenceItems.push(`Kết quả học tập chính thức (TT22 - ${semester}): ${officialAcademic}`);
  }
  if (officialConduct) {
    evidenceItems.push(`Kết quả rèn luyện chính thức (TT22 - ${semester}): ${officialConduct}`);
  }
  if (semesterScore) {
    const scoreParts = [
      semesterScore.tx1 !== null ? `TX1 ${semesterScore.tx1}` : null,
      semesterScore.tx2 !== null ? `TX2 ${semesterScore.tx2}` : null,
      semesterScore.gk !== null ? `GK ${semesterScore.gk}` : null,
      semesterScore.ck !== null ? `CK ${semesterScore.ck}` : null,
      semesterScore.avg !== null ? `ĐTB ${semesterScore.avg.toFixed(1)}` : null,
    ].filter(Boolean);
    evidenceItems.push(`Điểm ${semesterScore.subjectName} (${semester}): ${scoreParts.join(', ')}`);
  }
  if (scoreProgressionNote) {
    evidenceItems.push(scoreProgressionNote);
  }
  const attendancePresent = student.attendancePresent ?? 0;
  const attendanceAbsent = student.attendanceAbsent ?? 0;

  if (attendancePresent > 0 || attendanceAbsent > 0) {
    evidenceItems.push(
      `Chuyên cần đã ghi nhận: có mặt ${attendancePresent} buổi, vắng ${attendanceAbsent} buổi.`,
    );
  }
  if (totalLockedWeeks > 0) {
    evidenceItems.push(
      `Thi đua tuần nội bộ (${semester}, chỉ tham khảo – không thay thế xếp loại TT22): ${totalLockedWeeks} tuần đã chốt (${countA}A, ${countB}B, ${countC}C).`,
    );
  }
  if (roles.length > 0) {
    evidenceItems.push(`Nhiệm vụ lớp được giao: ${roles.join(', ')}.`);
  }
  if (cleanObsStrengths) {
    evidenceItems.push(`Ưu điểm GVCN xác nhận: ${cleanObsStrengths}`);
  }
  if (cleanObsImprovements) {
    evidenceItems.push(`Nội dung cần cải thiện GVCN xác nhận: ${cleanObsImprovements}`);
  }
  if (cleanObsAchievements) {
    evidenceItems.push(`Thành tích đã xác minh: ${cleanObsAchievements}`);
  }
  if (cleanObsIncident) {
    evidenceItems.push(
      effectiveIncidentStatus === 'pending_verification'
        ? `Thông tin cần xác minh thêm (CHƯA kết luận): ${cleanObsIncident}`
        : `Sự việc đã GVCN xác minh: ${cleanObsIncident}`,
    );
  }
  if (verifiedTickets.length > 0) {
    evidenceItems.push(
      `Ghi nhận phiếu đã được GVCN duyệt (${verifiedTickets.length}): ${verifiedTickets
        .slice(0, 3)
        .map((t) => `${t.date} - ${t.category}: ${t.description}`)
        .join('; ')}`,
    );
  }
  if (studentProfileNote) {
    evidenceItems.push(`Ghi chú hồ sơ lớp: ${studentProfileNote}`);
  }
  if (grade12Summary) {
    evidenceItems.push(
      `Định hướng lớp 12: Khối ${grade12Summary.examBlock || 'chưa chọn'}${
        grade12Summary.targetMajor ? `, ngành ${grade12Summary.targetMajor}` : ''
      }${grade12Summary.teacherNote ? ` (${grade12Summary.teacherNote})` : ''}.`,
    );
  }

  // Determine whether there is enough concrete evidence
  const missingEvidenceHints: string[] = [];
  if (!officialAcademic && !semesterScore) {
    missingEvidenceHints.push(`Chưa có xếp loại Học tập TT22 hoặc điểm ${semester}.`);
  }
  if (!officialConduct) {
    missingEvidenceHints.push(`Chưa có xác nhận xếp loại Rèn luyện chính thức (TT22) cho ${semester}.`);
  }
  if (!cleanObsStrengths && !cleanObsImprovements && verifiedTickets.length === 0 && totalLockedWeeks === 0) {
    missingEvidenceHints.push('Chưa có ghi nhận thực tế của GVCN hoặc dữ liệu theo dõi nề nếp/hoạt động.');
  }

  // Substantive evidence count (excluding mere class role or zero attendance)
  const substantiveSignals = [
    Boolean(officialAcademic),
    Boolean(officialConduct),
    Boolean(semesterScore),
    totalLockedWeeks > 0,
    attendanceAbsent > 0 || attendancePresent >= 5,
    verifiedTickets.length > 0,
    Boolean(cleanObsStrengths),
    Boolean(cleanObsImprovements),
    Boolean(cleanObsAchievements),
    Boolean(cleanObsIncident),
    Boolean(studentProfileNote),
  ].filter(Boolean).length;

  const hasEnoughEvidence = substantiveSignals >= 2 || Boolean(cleanObsStrengths && (officialConduct || officialAcademic || semesterScore));

  return {
    studentId,
    studentCode,
    moetCode,
    rosterOrder,
    studentName: student.fullName,
    gender: student.gender || '',
    team: student.team,
    roles,
    semester,
    schoolYear,
    officialConduct,
    officialAcademic,
    semesterScore,
    hk1ScoreAvg,
    hk2ScoreAvg,
    scoreProgressionNote,
    attendancePresent: student.attendancePresent || 0,
    attendanceAbsent: student.attendanceAbsent || 0,
    internalEmulation: {
      totalLockedWeeks,
      countA,
      countB,
      countC,
      weekDetails: weekDetails.slice(-6),
      disclaimer:
        'Thi đua tuần A/B/C chỉ là dữ liệu theo dõi nội bộ của lớp, KHÔNG phải xếp loại Rèn luyện chính thức (Tốt/Khá/Đạt/Chưa đạt) theo Thông tư 22/2021/TT-BGDĐT.',
    },
    verifiedTickets,
    pendingTickets,
    grade12Summary,
    teacherObservation: {
      verifiedStrengths: cleanObsStrengths,
      verifiedImprovements: cleanObsImprovements,
      verifiedAchievements: cleanObsAchievements,
      verifiedIncidentNote: cleanObsIncident,
      incidentStatus: observation?.incidentStatus || 'none',
      sourceLabel: observation?.sourceLabel || 'GVCN xác nhận trực tiếp',
      confirmedByEmail: observation?.confirmedByEmail || '',
      confirmedAtMs: observation?.confirmedAtMs || null,
    },
    effectiveIncidentStatus,
    studentProfileNote,
    evidenceItems,
    missingEvidenceHints,
    hasEnoughEvidence,
    insufficientEvidenceWarning: hasEnoughEvidence ? null : INSUFFICIENT_EVIDENCE_MESSAGE,
    excludedTestCount,
  };
}

// ============================================================================
// 10-POINT PEDAGOGICAL QUALITY CHECKER (SECTION VIII)
// ============================================================================

export interface QualityCheckItem {
  id: number;
  title: string;
  passed: boolean;
  severity: 'ok' | 'warning' | 'error';
  detail: string;
}

export interface PedagogicalQualityReport {
  mode: 'report_card' | 'parent_message';
  wordCount: number;
  charCount: number;
  passedCount: number;
  warningCount: number;
  errorCount: number;
  checks: QualityCheckItem[];
  disclaimer: string;
}

const NON_PEDAGOGICAL_TERMS = [
  'lười biếng',
  'luoi bieng',
  'cá biệt',
  'ca biet',
  'vô kỷ luật',
  'vo ky luat',
  'hư hỏng',
  'hu hong',
  'dốt',
  'ngu dốt',
  'vô ý thức',
  'vo y thuc',
  'chây lười',
  'chay luoi',
  'bố mẹ không quan tâm',
  'bo me khong quan tam',
  'phụ huynh không quan tâm',
  'gia đình buông lỏng',
  'gia dinh buong long',
  'gia đình thiếu trách nhiệm',
  'phụ huynh thiếu trách nhiệm',
  'không chịu dạy con',
  'bỏ bê con',
  'hỏng hẳn',
  'bất trị',
  'cứng đầu',
  'ngang bướng',
  'khó bảo',
  'lì lợm',
];

const UNVERIFIED_AWARD_TERMS = [
  'giải nhất',
  'giải nhì',
  'giải ba',
  'giải khuyến khích',
  'học sinh giỏi cấp tỉnh',
  'học sinh giỏi cấp quốc gia',
  'huy chương',
  'bằng khen',
  'đội tuyển cấp tỉnh',
  'thủ khoa',
  'xuất sắc nhất lớp',
];

const UNVERIFIED_DISCIPLINE_TERMS = [
  'hội đồng kỷ luật',
  'đình chỉ học',
  'cảnh cáo toàn trường',
  'khiển trách trước cờ',
  'hạ hạnh kiểm',
];

const DEFINITIVE_ACCUSATION_TERMS = [
  'em đã vi phạm nghiêm trọng',
  'chắc chắn em đã',
  'em cố tình',
  'em thường xuyên phá rối',
  'khẳng định em đã',
  'em tái phạm nhiều lần',
];

const NEUTRAL_VERIFICATION_MARKERS = [
  'trao đổi',
  'xác minh',
  'tìm hiểu',
  'nắm thêm',
  'phối hợp',
  'lắng nghe',
  'làm rõ',
];

function buildWordNgrams(text: string, n = 5): Set<string> {
  const words = normalizeVietnameseText(text).split(' ').filter(Boolean);
  const out = new Set<string>();
  if (words.length < n) {
    if (words.length > 0) out.add(words.join(' '));
    return out;
  }
  for (let i = 0; i <= words.length - n; i++) {
    out.add(words.slice(i, i + n).join(' '));
  }
  return out;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const item of a) {
    if (b.has(item)) inter += 1;
  }
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export interface EvaluateQualityParams {
  mode: 'report_card' | 'parent_message';
  text: string;
  evidence: VerifiedStudentEvidence;
  lengthMode?: ReportCardLengthMode;
  maxChars?: number;
  salutation?: string;
  otherStudentsNames?: string[];
  otherClassComments?: { studentId: string; studentName: string; text: string }[];
}

export function evaluatePedagogicalQuality(
  params: EvaluateQualityParams,
): PedagogicalQualityReport {
  const {
    mode,
    text,
    evidence,
    lengthMode = 'standard',
    maxChars = 0,
    salutation = '',
    otherStudentsNames = [],
    otherClassComments = [],
  } = params;

  const trimmed = String(text || '').trim();
  const lower = trimmed.toLowerCase();
  const normText = normalizeVietnameseText(trimmed);
  const wordCount = countWords(trimmed);
  const charCount = trimmed.length;
  const checks: QualityCheckItem[] = [];

  // Evidence corpus for checking unverified claims
  const evidenceCorpus = normalizeVietnameseText(
    [
      ...evidence.evidenceItems,
      evidence.teacherObservation.verifiedStrengths,
      evidence.teacherObservation.verifiedImprovements,
      evidence.teacherObservation.verifiedAchievements,
      evidence.teacherObservation.verifiedIncidentNote,
      evidence.studentProfileNote,
      ...evidence.verifiedTickets.map((t) => `${t.category} ${t.description}`),
    ].join(' '),
  );

  // CHECK 1: Ngôn ngữ sư phạm chuẩn mực, không dán nhãn / đổ lỗi
  const hitForbidden = NON_PEDAGOGICAL_TERMS.filter((term) => lower.includes(term));
  checks.push({
    id: 1,
    title: 'Ngôn ngữ sư phạm, không dán nhãn hoặc đổ lỗi',
    passed: hitForbidden.length === 0,
    severity: hitForbidden.length === 0 ? 'ok' : 'error',
    detail:
      hitForbidden.length === 0
        ? 'Không phát hiện từ ngữ miệt thị, dán nhãn học sinh hoặc đổ lỗi cho phụ huynh.'
        : `Phát hiện cụm từ chưa chuẩn mực sư phạm: "${hitForbidden.join('", "')}". Cần diễn đạt khách quan, xây dựng hơn.`,
  });

  // CHECK 2: Phù hợp & không mâu thuẫn xếp loại chính thức Thông tư 22
  let tt22Conflict = '';
  if (evidence.officialConduct === 'Chưa đạt' || evidence.officialAcademic === 'Chưa đạt') {
    if (/(xuất sắc toàn diện|học lực giỏi|rèn luyện xuất sắc|kết quả học tập tốt)/i.test(trimmed)) {
      tt22Conflict = 'Xếp loại chính thức TT22 có mức Chưa đạt nhưng nội dung lại khen ở mức xuất sắc/tốt.';
    }
  } else if (evidence.officialConduct === 'Tốt' && /(chưa chấp hành nội quy|vi phạm nhiều lần|rèn luyện yếu)/i.test(trimmed)) {
    tt22Conflict = 'Xếp loại Rèn luyện TT22 là Tốt nhưng nội dung nhận xét lại mâu thuẫn theo hướng tiêu cực.';
  } else if (evidence.officialAcademic === 'Đạt' && /(học lực tốt|học tập xuất sắc)/i.test(trimmed)) {
    tt22Conflict = 'Xếp loại Học tập TT22 là Đạt nhưng nội dung nêu mức Tốt/Xuất sắc.';
  }
  checks.push({
    id: 2,
    title: 'Không mâu thuẫn xếp loại chính thức Thông tư 22',
    passed: !tt22Conflict,
    severity: !tt22Conflict ? 'ok' : 'error',
    detail:
      !tt22Conflict
        ? evidence.officialConduct || evidence.officialAcademic
          ? `Phù hợp với kết quả TT22 đã xác nhận (Học tập: ${evidence.officialAcademic || 'chưa chọn'}, Rèn luyện: ${evidence.officialConduct || 'chưa chọn'}).`
          : 'Không có mâu thuẫn với xếp loại chính thức TT22.'
        : tt22Conflict,
  });

  // CHECK 3: Không quy đổi thi đua tuần A/B/C thành xếp loại Rèn luyện chính thức
  const abcAsOfficial =
    /(rèn luyện\s*(đạt\s*)?loại\s*[abc]|hạnh kiểm\s*(loại\s*)?[abc]|xếp loại\s*rèn luyện\s*[abc]|thi đua\s*[abc]\s*nên\s*rèn luyện)/i.test(
      trimmed,
    );
  const claimsOfficialWithoutConfirmation =
    !evidence.officialConduct &&
    /(xếp loại rèn luyện\s*(tốt|khá|đạt|chưa đạt)|đạt rèn luyện loại\s*(tốt|khá|đạt|chưa đạt))/i.test(
      trimmed,
    );
  const check3Pass = !abcAsOfficial && !claimsOfficialWithoutConfirmation;
  checks.push({
    id: 3,
    title: 'Tách bạch thi đua tuần A/B/C và Rèn luyện Thông tư 22',
    passed: check3Pass,
    severity: check3Pass ? 'ok' : 'error',
    detail: check3Pass
      ? 'Không quy đổi sai thi đua tuần nội bộ (A/B/C) thành xếp loại Rèn luyện chính thức.'
      : abcAsOfficial
        ? 'Phát hiện cách diễn đạt gộp thi đua A/B/C thành xếp loại Rèn luyện/Hạnh kiểm chính thức.'
        : 'Nội dung khẳng định xếp loại Rèn luyện TT22 trong khi GVCN chưa xác nhận mức chính thức.',
  });

  // CHECK 4: Không bịa giải thưởng, thành tích hoặc kỷ luật ngoài minh chứng
  const inventedAwards = UNVERIFIED_AWARD_TERMS.filter(
    (term) => lower.includes(term) && !evidenceCorpus.includes(normalizeVietnameseText(term)),
  );
  const inventedDiscipline = UNVERIFIED_DISCIPLINE_TERMS.filter(
    (term) => lower.includes(term) && !evidenceCorpus.includes(normalizeVietnameseText(term)),
  );
  const inventedAll = [...inventedAwards, ...inventedDiscipline];
  checks.push({
    id: 4,
    title: 'Không suy diễn thành tích hoặc kỷ luật thiếu minh chứng',
    passed: inventedAll.length === 0,
    severity: inventedAll.length === 0 ? 'ok' : 'error',
    detail:
      inventedAll.length === 0
        ? 'Không phát hiện giải thưởng hay hình thức kỷ luật ngoài dữ liệu minh chứng.'
        : `Các chi tiết sau chưa thấy trong minh chứng đã xác nhận: "${inventedAll.join('", "')}".`,
  });

  // CHECK 5: Bảo vệ thông tin chưa xác minh (pending_verification)
  let check5Pass = true;
  let check5Detail = 'Không có sự việc chờ xác minh hoặc nội dung đã diễn đạt đúng mức độ xác thực.';
  if (evidence.effectiveIncidentStatus === 'pending_verification') {
    const hasAccusation = DEFINITIVE_ACCUSATION_TERMS.some((term) => lower.includes(term));
    const hasNeutralCue = NEUTRAL_VERIFICATION_MARKERS.some((term) => lower.includes(term));
    if (mode === 'parent_message' && (hasAccusation || !hasNeutralCue)) {
      check5Pass = false;
      check5Detail =
        'Hồ sơ đang có thông tin CHƯA XÁC MINH. Tin nhắn cần giữ giọng trung lập, mời phụ huynh trao đổi/làm rõ thay vì khẳng định lỗi.';
    } else if (mode === 'report_card' && hasAccusation) {
      check5Pass = false;
      check5Detail =
        'Không đưa phản ánh chưa được GVCN xác minh làm kết luận chính thức trong nhận xét học bạ.';
    }
  }
  checks.push({
    id: 5,
    title: 'Xử lý thận trọng thông tin chưa được GVCN xác minh',
    passed: check5Pass,
    severity: check5Pass ? 'ok' : 'error',
    detail: check5Detail,
  });

  // CHECK 6: Không rò rỉ SĐT, mã kỹ thuật, dấu hiệu AI hoặc tên học sinh khác
  const leakedPhone = /(?:\+84|0)(?:[\s.\-]*\d){8,10}/.test(trimmed);
  const leakedTechLabel = /\b(AI|Gemini|ChatGPT|Prompt|MOET|studentId|Firestore|\[TEST\])\b/i.test(
    trimmed,
  );
  const ownNormName = normalizeVietnameseText(evidence.studentName);
  const leakedOtherStudent = otherStudentsNames.find((otherName) => {
    const normOther = normalizeVietnameseText(otherName);
    if (!normOther || normOther === ownNormName || normOther.split(' ').length < 2) return false;
    return normText.includes(normOther);
  });
  const check6Pass = !leakedPhone && !leakedTechLabel && !leakedOtherStudent;
  checks.push({
    id: 6,
    title: 'An toàn riêng tư: không lộ SĐT, mã kỹ thuật hay học sinh khác',
    passed: check6Pass,
    severity: check6Pass ? 'ok' : 'error',
    detail: check6Pass
      ? 'Không có số điện thoại, nhãn AI/mã hệ thống hoặc thông tin của học sinh khác.'
      : [
          leakedPhone ? 'Có chứa chuỗi giống số điện thoại.' : '',
          leakedTechLabel ? 'Có chứa nhãn kỹ thuật (AI/MOET/TEST...).' : '',
          leakedOtherStudent ? `Phát hiện nhắc tới tên học sinh khác: "${leakedOtherStudent}".` : '',
        ]
          .filter(Boolean)
          .join(' '),
  });

  // CHECK 7: Độ dài và giới hạn ký tự
  let check7Pass = true;
  let check7Severity: 'ok' | 'warning' | 'error' = 'ok';
  let check7Detail = '';
  if (!trimmed) {
    check7Pass = false;
    check7Severity = 'error';
    check7Detail = 'Nội dung đang trống.';
  } else if (mode === 'report_card') {
    const cfg = REPORT_CARD_LENGTH_CONFIG[lengthMode];
    const inWordRange = wordCount >= cfg.minWords - 4 && wordCount <= cfg.maxWords + 8;
    const withinMaxChars = !maxChars || charCount <= maxChars;
    if (!withinMaxChars) {
      check7Pass = false;
      check7Severity = 'error';
      check7Detail = `Vượt giới hạn ký tự quy định của trường (${charCount}/${maxChars} ký tự).`;
    } else if (!inWordRange) {
      check7Pass = false;
      check7Severity = 'warning';
      check7Detail = `Độ dài hiện tại ${wordCount} từ (mức ${cfg.label} khuyến nghị ${cfg.minWords}–${cfg.maxWords} từ).`;
    } else {
      check7Detail = `Độ dài phù hợp: ${wordCount} từ (${charCount} ký tự)${
        maxChars ? ` / tối đa ${maxChars} ký tự` : ''
      }.`;
    }
  } else {
    if (wordCount < 25) {
      check7Pass = false;
      check7Severity = 'warning';
      check7Detail = `Tin nhắn khá ngắn (${wordCount} từ), nên bổ sung lời chào và hướng phối hợp rõ ràng.`;
    } else if (wordCount > 240) {
      check7Pass = false;
      check7Severity = 'warning';
      check7Detail = `Tin nhắn khá dài (${wordCount} từ), có thể rút gọn để phụ huynh dễ đọc trên Zalo/SMS.`;
    } else {
      check7Detail = `Độ dài tin nhắn hợp lý: ${wordCount} từ (${charCount} ký tự).`;
    }
  }
  checks.push({
    id: 7,
    title: 'Độ dài phù hợp mẫu học bạ / tin nhắn',
    passed: check7Pass,
    severity: check7Severity,
    detail: check7Detail,
  });

  // CHECK 8: Bố cục & lời mở đầu chuẩn mực
  let check8Pass = true;
  let check8Severity: 'ok' | 'warning' = 'ok';
  let check8Detail = '';
  if (mode === 'report_card') {
    const startsWithEm = /^Em\b/.test(trimmed);
    const hasDirection = /(cần|tiếp tục|phát huy|cố gắng|duy trì|rèn luyện|nâng cao|chủ động|tập trung|định hướng)/i.test(
      trimmed,
    );
    if (!startsWithEm) {
      check8Pass = false;
      check8Severity = 'warning';
      check8Detail = 'Nhận xét học bạ nên mở đầu chuẩn bằng "Em..." (trừ khi trường có mẫu riêng).';
    } else if (!hasDirection) {
      check8Pass = false;
      check8Severity = 'warning';
      check8Detail = 'Nên bổ sung câu định hướng tích cực ở cuối nhận xét.';
    } else {
      check8Detail = 'Mở đầu bằng "Em..." đúng chuẩn học bạ và có câu định hướng phù hợp.';
    }
  } else {
    const hasSalutation =
      /^(kính gửi|kính chào|chào\s+(phụ huynh|gia đình|anh|chị))/i.test(trimmed) ||
      (salutation && trimmed.toLowerCase().includes(salutation.toLowerCase().slice(0, 12)));
    const hasClosing = /(trân trọng|cảm ơn|phối hợp|đồng hành|chúc|gvcn|giáo viên chủ nhiệm)/i.test(
      trimmed,
    );
    if (!hasSalutation || !hasClosing) {
      check8Pass = false;
      check8Severity = 'warning';
      check8Detail = !hasSalutation
        ? 'Thiếu lời chào tôn trọng phụ huynh ở đầu tin nhắn.'
        : 'Nên có lời cảm ơn hoặc đề nghị phối hợp lịch sự ở cuối tin nhắn.';
    } else {
      check8Detail = 'Đầy đủ lời chào lịch sự và kết thúc mang tính phối hợp.';
    }
  }
  checks.push({
    id: 8,
    title: mode === 'report_card' ? 'Chuẩn mở đầu "Em..." & bố cục học bạ' : 'Đủ lời chào tôn trọng & kết thúc phối hợp',
    passed: check8Pass,
    severity: check8Severity,
    detail: check8Detail,
  });

  // CHECK 9: Tránh lặp nguyên văn với học sinh khác trong lớp
  let maxSim = 0;
  let mostSimilarName = '';
  if (trimmed && otherClassComments.length > 0) {
    const curNgrams = buildWordNgrams(trimmed, 5);
    for (const item of otherClassComments) {
      if (item.studentId === evidence.studentId || !item.text.trim()) continue;
      const sim = jaccardSimilarity(curNgrams, buildWordNgrams(item.text, 5));
      if (sim > maxSim) {
        maxSim = sim;
        mostSimilarName = item.studentName;
      }
    }
  }
  const check9Pass = maxSim < 0.72;
  checks.push({
    id: 9,
    title: 'Đa dạng diễn đạt, không lặp nguyên văn với học sinh khác',
    passed: check9Pass,
    severity: check9Pass ? 'ok' : 'warning',
    detail: check9Pass
      ? otherClassComments.length > 0
        ? 'Diễn đạt riêng biệt, không trùng lặp nguyên văn với các nhận xét đã lưu trong lớp.'
        : 'Chưa có nhận xét khác cùng học kỳ để so sánh trùng lặp.'
      : `Mức tương đồng cao (${Math.round(maxSim * 100)}%) với nhận xét của "${mostSimilarName}". Nên bấm "Tạo lại phương án khác" hoặc cá nhân hóa theo minh chứng.`,
  });

  // CHECK 10: Độ đầy đủ căn cứ dữ liệu đầu vào
  checks.push({
    id: 10,
    title: 'Đủ căn cứ minh chứng đầu vào',
    passed: evidence.hasEnoughEvidence,
    severity: evidence.hasEnoughEvidence ? 'ok' : 'warning',
    detail: evidence.hasEnoughEvidence
      ? `Đã có ${evidence.evidenceItems.length} căn cứ xác thực cho học sinh trong ${evidence.semester}.`
      : INSUFFICIENT_EVIDENCE_MESSAGE,
  });

  const passedCount = checks.filter((c) => c.passed).length;
  const warningCount = checks.filter((c) => !c.passed && c.severity === 'warning').length;
  const errorCount = checks.filter((c) => !c.passed && c.severity === 'error').length;

  return {
    mode,
    wordCount,
    charCount,
    passedCount,
    warningCount,
    errorCount,
    checks,
    disclaimer: AUTO_CHECK_DISCLAIMER,
  };
}

// ============================================================================
// EXPORT BY ROSTER ORDER (STT EXCEL) & MOET CODE (NEVER AUTO-WRITES TO VNEDU)
// ============================================================================

export interface ReportCardExportRow {
  stt: number;
  moetCode: string;
  studentCode: string;
  fullName: string;
  team: string;
  role: string;
  semester: PedagogicalSemester;
  schoolYear: string;
  officialAcademic: string;
  officialConduct: string;
  statusLabel: string;
  comment: string;
  approvedBy: string;
}

export function buildReportCardExportRows(params: {
  students: Student[];
  semester: PedagogicalSemester;
  schoolYear: string;
  commentsById: Record<string, ReportCardCommentRecord>;
  observationsById: Record<string, PedagogicalObservationRecord>;
}): ReportCardExportRow[] {
  const { students, semester, schoolYear, commentsById, observationsById } = params;

  const sortedStudents = [...students].sort((a, b) => {
    const orderA = typeof a.rosterOrder === 'number' ? a.rosterOrder : Number.MAX_SAFE_INTEGER;
    const orderB = typeof b.rosterOrder === 'number' ? b.rosterOrder : Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.code.localeCompare(b.code, 'vi');
  });

  return sortedStudents.map((st, idx) => {
    const studentId = st.id || st.code;
    const commentDoc = commentsById[getReportCardCommentDocId(studentId, semester)];
    const obsDoc = observationsById[getPedagogicalObservationDocId(studentId, semester)];
    const stt = typeof st.rosterOrder === 'number' ? st.rosterOrder : idx + 1;
    const roleStr =
      st.roles && st.roles.length > 0
        ? st.roles.join(', ')
        : [st.role, st.secondRole].filter((r) => r && r !== 'Thành viên').join(', ') || 'Thành viên';

    return {
      stt,
      moetCode: st.moetCode || '',
      studentCode: st.code,
      fullName: st.fullName,
      team: `Tổ ${st.team}`,
      role: roleStr,
      semester,
      schoolYear,
      officialAcademic: obsDoc?.officialAcademic || '',
      officialConduct: obsDoc?.officialConduct || '',
      statusLabel:
        commentDoc?.status === 'approved_locked'
          ? 'Đã duyệt & khóa'
          : commentDoc?.currentDraft
            ? 'Bản nháp'
            : 'Chưa soạn',
      comment: commentDoc?.currentDraft || '',
      approvedBy: commentDoc?.approvedByEmail || '',
    };
  });
}

// ============================================================================
// ISOLATED 10-SCENARIO TEST SIMULATION SUITE (SECTION X)
// NEVER WRITES TO FIRESTORE OR REAL 12D6 DATA
// ============================================================================

export interface PedagogicalTestScenario {
  id: string;
  number: number;
  title: string;
  category: 'report_card' | 'parent_message' | 'both';
  recommendedPurpose: ParentMessagePurposeId;
  expectedBehavior: string;
  student: Student;
  semester: PedagogicalSemester;
  subjectScores: Record<string, SubjectScore>;
  weeklySnapshots: WeeklySnapshot[];
  tickets: Ticket[];
  observation: PedagogicalObservationRecord | null;
  referenceDraftReportCard: string;
  referenceDraftParentMessage: string;
  pairedStudentForDuplicateCheck?: {
    student: Student;
    observation: PedagogicalObservationRecord;
    subjectScores: Record<string, SubjectScore>;
  };
}

export const PEDAGOGICAL_TEST_SCENARIOS: PedagogicalTestScenario[] = [
  {
    id: 'scenario_1_excellent_active',
    number: 1,
    title: 'Học sinh học tốt, rèn luyện tốt, tích cực hoạt động lớp',
    category: 'both',
    recommendedPurpose: 'khen_ngoi_dong_vien',
    expectedBehavior:
      'Ghi nhận cụ thể ưu điểm học tập, ý thức rèn luyện và đóng góp tập thể đúng minh chứng; động viên phát huy.',
    student: {
      id: 'SIM_HS01',
      code: 'SIM_HS01',
      moetCode: 'SIM_MOET_001',
      rosterOrder: 1,
      fullName: 'Nguyễn Minh An (Mô phỏng)',
      gender: 'Nữ',
      team: 1,
      role: 'Lớp trưởng',
      roles: ['lop_truong'],
      meritPoints: 98,
      attendancePresent: 85,
      attendanceAbsent: 0,
    },
    semester: 'Học kỳ I',
    subjectScores: {
      SIM_HS01_ngu_van: {
        id: 'SIM_HS01_ngu_van',
        code: 'SIM_HS01',
        fullName: 'Nguyễn Minh An (Mô phỏng)',
        team: 1,
        subject: 'Ngữ văn',
        tx1: 9.0,
        tx2: 9.5,
        gk: 9.0,
        ck: 9.2,
        avg: 9.2,
        updatedBy: 'GVCN',
      },
    },
    weeklySnapshots: [
      {
        id: 'sim_w1',
        weekNumber: 1,
        weekLabel: 'Tuần 1',
        monthLabel: 'Tháng 9',
        semesterLabel: 'Học kỳ I',
        totalLockedStudents: 46,
        records: {
          SIM_HS01: { studentCode: 'SIM_HS01', studentName: 'Nguyễn Minh An (Mô phỏng)', team: 1, rank: 'A' },
        },
        teamStats: [],
        lockedBy: 'GVCN',
        lockedAtMs: 1730000000000,
      },
    ],
    tickets: [],
    observation: {
      id: 'sim_obs_1',
      studentId: 'SIM_HS01',
      studentCode: 'SIM_HS01',
      moetCode: 'SIM_MOET_001',
      semester: 'Học kỳ I',
      officialConduct: 'Tốt',
      officialAcademic: 'Tốt',
      verifiedStrengths: 'Chăm chỉ, tự giác học tập, gương mẫu trong điều hành tập thể lớp và tích cực tham gia các phong trào Đoàn.',
      verifiedImprovements: '',
      verifiedAchievements: 'Hoàn thành tốt vai trò Lớp trưởng trong Học kỳ I.',
      verifiedIncidentNote: '',
      incidentStatus: 'none',
      sourceLabel: 'GVCN xác nhận trực tiếp',
      confirmedByEmail: 'gvcn@sim.local',
      confirmedAtMs: 1730000000000,
    },
    referenceDraftReportCard:
      'Em có ý thức học tập tự giác, đạt kết quả Học tập và Rèn luyện mức Tốt trong Học kỳ I. Em lễ phép, hòa đồng và gương mẫu hoàn thành trách nhiệm Lớp trưởng, tích cực trong các hoạt động chung của tập thể. Em tiếp tục phát huy tinh thần chủ động và giữ vững phong độ trong học kỳ tới.',
    referenceDraftParentMessage:
      'Kính gửi quý phụ huynh em Nguyễn Minh An (Mô phỏng), trong Học kỳ I vừa qua, em đạt kết quả học tập và rèn luyện mức Tốt, đi học đầy đủ và rất gương mẫu, trách nhiệm trong các hoạt động chung của lớp. Xin gửi lời chúc mừng và cảm ơn sự đồng hành của gia đình; rất mong gia đình tiếp tục động viên để em giữ vững phong độ học tập trong thời gian tới. Trân trọng, GVCN.',
  },
  {
    id: 'scenario_2_good_shy',
    number: 2,
    title: 'Học sinh học khá nhưng còn rụt rè, ít phát biểu',
    category: 'both',
    recommendedPurpose: 'khen_ngoi_dong_vien',
    expectedBehavior:
      'Ghi nhận thái độ nghiêm túc, học lực Khá; khích lệ tự tin trao đổi và phát biểu xây dựng bài, tuyệt đối không chê bai.',
    student: {
      id: 'SIM_HS02',
      code: 'SIM_HS02',
      moetCode: 'SIM_MOET_002',
      rosterOrder: 2,
      fullName: 'Trần Gia Bảo (Mô phỏng)',
      gender: 'Nam',
      team: 2,
      role: 'Thành viên',
      meritPoints: 86,
      attendancePresent: 84,
      attendanceAbsent: 1,
    },
    semester: 'Học kỳ I',
    subjectScores: {
      SIM_HS02_ngu_van: {
        id: 'SIM_HS02_ngu_van',
        code: 'SIM_HS02',
        fullName: 'Trần Gia Bảo (Mô phỏng)',
        team: 2,
        subject: 'Ngữ văn',
        tx1: 7.5,
        tx2: 8.0,
        gk: 7.5,
        ck: 7.8,
        avg: 7.7,
        updatedBy: 'GVCN',
      },
    },
    weeklySnapshots: [],
    tickets: [],
    observation: {
      id: 'sim_obs_2',
      studentId: 'SIM_HS02',
      studentCode: 'SIM_HS02',
      moetCode: 'SIM_MOET_002',
      semester: 'Học kỳ I',
      officialConduct: 'Tốt',
      officialAcademic: 'Khá',
      verifiedStrengths: 'Ngoan hiền, chấp hành tốt nội quy, làm bài tập đầy đủ.',
      verifiedImprovements: 'Còn rụt rè trong giao tiếp nhóm và ít giơ tay phát biểu trên lớp.',
      verifiedAchievements: '',
      verifiedIncidentNote: '',
      incidentStatus: 'none',
      sourceLabel: 'GVCN xác nhận trực tiếp',
      confirmedByEmail: 'gvcn@sim.local',
      confirmedAtMs: 1730000000000,
    },
    referenceDraftReportCard:
      'Em ngoan hiền, chấp hành tốt nội quy lớp học và chuẩn bị bài tập đầy đủ, đạt kết quả học tập khá trong Học kỳ I. Tuy nhiên, em còn hơi rụt rè và ít phát biểu ý kiến trên lớp. Em nên mạnh dạn trao đổi hơn trong giờ học và hoạt động nhóm để phát huy tốt năng lực của bản thân.',
    referenceDraftParentMessage:
      'Kính gửi quý phụ huynh em Trần Gia Bảo (Mô phỏng), trong Học kỳ I, em chấp hành tốt nội quy, chăm chỉ làm bài và đạt kết quả học tập mức Khá. Ở lớp em còn hơi rụt rè, ít chủ động phát biểu dù nắm bài khá tốt. Rất mong gia đình cùng động viên, khích lệ để em tự tin chia sẻ ý kiến hơn trong các tiết học tới. Trân trọng, GVCN.',
  },
  {
    id: 'scenario_3_average_clear_progress',
    number: 3,
    title: 'Học sinh mức Đạt nhưng tiến bộ rõ rệt từ HK I sang HK II',
    category: 'both',
    recommendedPurpose: 'thong_bao_tien_bo',
    expectedBehavior:
      'Phân biệt đúng HK I và HK II, ghi nhận bước tiến rõ rệt theo số liệu thực tế và khích lệ duy trì đà tiến bộ.',
    student: {
      id: 'SIM_HS03',
      code: 'SIM_HS03',
      moetCode: 'SIM_MOET_003',
      rosterOrder: 3,
      fullName: 'Lê Hoàng Nam (Mô phỏng)',
      gender: 'Nam',
      team: 3,
      role: 'Thành viên',
      meritPoints: 82,
      attendancePresent: 83,
      attendanceAbsent: 1,
    },
    semester: 'Học kỳ II',
    subjectScores: {
      SIM_HS03_ngu_van: {
        id: 'SIM_HS03_ngu_van',
        code: 'SIM_HS03',
        fullName: 'Lê Hoàng Nam (Mô phỏng)',
        team: 3,
        subject: 'Ngữ văn',
        tx1: 5.5,
        tx2: 5.8,
        gk: 5.5,
        ck: 5.6,
        avg: 5.6,
        updatedBy: 'GVCN',
      },
      SIM_HS03_ngu_van_hk2: {
        id: 'SIM_HS03_ngu_van_hk2',
        code: 'SIM_HS03',
        fullName: 'Lê Hoàng Nam (Mô phỏng)',
        team: 3,
        subject: 'Ngữ văn',
        tx1: 7.0,
        tx2: 7.2,
        gk: 7.0,
        ck: 7.5,
        avg: 7.2,
        updatedBy: 'GVCN',
      },
    },
    weeklySnapshots: [],
    tickets: [],
    observation: {
      id: 'sim_obs_3',
      studentId: 'SIM_HS03',
      studentCode: 'SIM_HS03',
      moetCode: 'SIM_MOET_003',
      semester: 'Học kỳ II',
      officialConduct: 'Khá',
      officialAcademic: 'Đạt',
      verifiedStrengths: 'Có cố gắng rõ rệt trong Học kỳ II, chăm ghi chép và hỏi bài thầy cô nhiều hơn.',
      verifiedImprovements: 'Cần tiếp tục củng cố kiến thức nền để nâng cao độ ổn định ở các bài kiểm tra.',
      verifiedAchievements: '',
      verifiedIncidentNote: '',
      incidentStatus: 'none',
      sourceLabel: 'GVCN xác nhận trực tiếp',
      confirmedByEmail: 'gvcn@sim.local',
      confirmedAtMs: 1730000000000,
    },
    referenceDraftReportCard:
      'Em chấp hành tốt nội quy và có sự tiến bộ rõ rệt trong Học kỳ II, thể hiện qua thái độ học tập tích cực hơn và điểm môn Ngữ văn tăng từ 5.6 lên 7.2. Em cần tiếp tục duy trì nếp tự học đều đặn và củng cố kiến thức cơ bản để đạt kết quả cao hơn trong giai đoạn tới.',
    referenceDraftParentMessage:
      'Kính gửi quý phụ huynh em Lê Hoàng Nam (Mô phỏng), cô xin vui mừng chia sẻ rằng trong Học kỳ II, em có tiến bộ rất đáng ghi nhận: chăm chú nghe giảng hơn và điểm môn Ngữ văn tăng từ 5.6 (HK I) lên 7.2 (HK II). Rất mong gia đình kịp thời động viên và tiếp tục đồng hành giúp em giữ vững đà cố gắng này. Trân trọng, GVCN.',
  },
  {
    id: 'scenario_4_academic_decline',
    number: 4,
    title: 'Học sinh học lực giảm sút do chưa tập trung',
    category: 'both',
    recommendedPurpose: 'trao_doi_hoc_tap_giam',
    expectedBehavior:
      'Nêu khách quan dấu hiệu giảm điểm theo minh chứng, không chê bai hay đổ lỗi gia đình; đề xuất phối hợp tìm nguyên nhân và kế hoạch ôn tập.',
    student: {
      id: 'SIM_HS04',
      code: 'SIM_HS04',
      moetCode: 'SIM_MOET_004',
      rosterOrder: 4,
      fullName: 'Phạm Quốc Huy (Mô phỏng)',
      gender: 'Nam',
      team: 4,
      role: 'Thành viên',
      meritPoints: 76,
      attendancePresent: 80,
      attendanceAbsent: 2,
    },
    semester: 'Học kỳ II',
    subjectScores: {
      SIM_HS04_ngu_van: {
        id: 'SIM_HS04_ngu_van',
        code: 'SIM_HS04',
        fullName: 'Phạm Quốc Huy (Mô phỏng)',
        team: 4,
        subject: 'Ngữ văn',
        tx1: 7.5,
        tx2: 7.5,
        gk: 7.2,
        ck: 7.4,
        avg: 7.4,
        updatedBy: 'GVCN',
      },
      SIM_HS04_ngu_van_hk2: {
        id: 'SIM_HS04_ngu_van_hk2',
        code: 'SIM_HS04',
        fullName: 'Phạm Quốc Huy (Mô phỏng)',
        team: 4,
        subject: 'Ngữ văn',
        tx1: 6.0,
        tx2: 5.5,
        gk: 5.5,
        ck: 5.8,
        avg: 5.7,
        updatedBy: 'GVCN',
      },
    },
    weeklySnapshots: [],
    tickets: [],
    observation: {
      id: 'sim_obs_4',
      studentId: 'SIM_HS04',
      studentCode: 'SIM_HS04',
      moetCode: 'SIM_MOET_004',
      semester: 'Học kỳ II',
      officialConduct: 'Khá',
      officialAcademic: 'Đạt',
      verifiedStrengths: 'Hòa đồng với bạn bè, tiếp thu tốt khi chú ý nghe giảng.',
      verifiedImprovements: 'Gần đây chưa tập trung trong giờ học, điểm kiểm tra giảm so với Học kỳ I.',
      verifiedAchievements: '',
      verifiedIncidentNote: '',
      incidentStatus: 'none',
      sourceLabel: 'GVCN xác nhận trực tiếp',
      confirmedByEmail: 'gvcn@sim.local',
      confirmedAtMs: 1730000000000,
    },
    referenceDraftReportCard:
      'Em hòa đồng với bạn bè và có khả năng tiếp thu tốt khi tập trung nghe giảng. Tuy nhiên, trong Học kỳ II em còn thiếu tập trung ở một số tiết học khiến kết quả giảm so với Học kỳ I. Em cần xây dựng kế hoạch ôn tập rõ ràng và tập trung hơn để sớm lấy lại phong độ học tập.',
    referenceDraftParentMessage:
      'Kính gửi quý phụ huynh em Phạm Quốc Huy (Mô phỏng), qua theo dõi Học kỳ II, cô nhận thấy em hòa đồng với bạn bè nhưng thời gian gần đây chưa thật sự tập trung trong giờ học, điểm môn Ngữ văn giảm từ 7.4 xuống 5.7. Cô mong được phối hợp cùng gia đình tìm hiểu thêm lịch sinh hoạt, học tập ở nhà để kịp thời hỗ trợ em lấy lại nhịp học tốt hơn. Trân trọng, GVCN.',
  },
  {
    id: 'scenario_5_attendance_issue',
    number: 5,
    title: 'Học sinh đi học muộn hoặc nghỉ không phép cần phối hợp phụ huynh',
    category: 'both',
    recommendedPurpose: 'nhac_nho_chuyen_can',
    expectedBehavior:
      'Nêu số liệu chuyên cần chính xác, giọng tôn trọng, mời gia đình phối hợp nhắc nhở giờ giấc đi học.',
    student: {
      id: 'SIM_HS05',
      code: 'SIM_HS05',
      moetCode: 'SIM_MOET_005',
      rosterOrder: 5,
      fullName: 'Đỗ Khánh Linh (Mô phỏng)',
      gender: 'Nữ',
      team: 1,
      role: 'Thành viên',
      meritPoints: 74,
      attendancePresent: 78,
      attendanceAbsent: 5,
    },
    semester: 'Học kỳ I',
    subjectScores: {},
    weeklySnapshots: [],
    tickets: [],
    observation: {
      id: 'sim_obs_5',
      studentId: 'SIM_HS05',
      studentCode: 'SIM_HS05',
      moetCode: 'SIM_MOET_005',
      semester: 'Học kỳ I',
      officialConduct: 'Đạt',
      officialAcademic: 'Đạt',
      verifiedStrengths: 'Lễ phép với thầy cô, thân thiện với các bạn trong tổ.',
      verifiedImprovements: 'Còn đi học muộn 3 buổi và nghỉ học chưa báo phép đầy đủ.',
      verifiedAchievements: '',
      verifiedIncidentNote: 'GVCN đã đối chiếu sổ điểm danh: nghỉ 5 buổi trong học kỳ (có 2 buổi chưa xin phép trước).',
      incidentStatus: 'verified',
      sourceLabel: 'Sổ điểm danh chính thức GVCN',
      confirmedByEmail: 'gvcn@sim.local',
      confirmedAtMs: 1730000000000,
    },
    referenceDraftReportCard:
      'Em lễ phép với thầy cô và thân thiện với bạn bè trong tập thể. Tuy nhiên, em cần khắc phục tình trạng đi học muộn và thực hiện nghiêm túc việc xin phép khi nghỉ học để đảm bảo chuyên cần. Mong em sắp xếp thời gian sinh hoạt hợp lý hơn trong học kỳ tới.',
    referenceDraftParentMessage:
      'Kính gửi quý phụ huynh em Đỗ Khánh Linh (Mô phỏng), theo sổ điểm danh lớp trong Học kỳ I, em đã nghỉ 5 buổi (trong đó có 2 buổi chưa kịp xin phép trước) và đi học muộn 3 buổi. Để giúp em theo kịp bài học và đảm bảo nề nếp chuyên cần, rất mong gia đình phối hợp theo dõi giờ giấc đi học và trao đổi kịp thời với GVCN khi em có việc cần nghỉ. Trân trọng cảm ơn sự phối hợp của gia đình.',
  },
  {
    id: 'scenario_6_verified_conduct_incident',
    number: 6,
    title: 'Học sinh có vi phạm nề nếp đã được GVCN xác minh',
    category: 'both',
    recommendedPurpose: 'phoi_hop_su_viec_da_xac_minh',
    expectedBehavior:
      'Trình bày khách quan sự việc đã xác minh, không miệt thị hay dán nhãn, hướng đến giải pháp giáo dục phối hợp.',
    student: {
      id: 'SIM_HS06',
      code: 'SIM_HS06',
      moetCode: 'SIM_MOET_006',
      rosterOrder: 6,
      fullName: 'Vũ Đức Mạnh (Mô phỏng)',
      gender: 'Nam',
      team: 2,
      role: 'Thành viên',
      meritPoints: 70,
      attendancePresent: 82,
      attendanceAbsent: 1,
    },
    semester: 'Học kỳ I',
    subjectScores: {},
    weeklySnapshots: [],
    tickets: [],
    observation: {
      id: 'sim_obs_6',
      studentId: 'SIM_HS06',
      studentCode: 'SIM_HS06',
      moetCode: 'SIM_MOET_006',
      semester: 'Học kỳ I',
      officialConduct: 'Đạt',
      officialAcademic: 'Khá',
      verifiedStrengths: 'Nhanh nhẹn, nhiệt tình hỗ trợ trực nhật khi được phân công.',
      verifiedImprovements: 'Cần rèn luyện tính kiềm chế và tuân thủ nghiêm quy định không sử dụng điện thoại trong giờ học.',
      verifiedAchievements: '',
      verifiedIncidentNote: 'Ngày 14/10, em sử dụng điện thoại trong tiết học (GVBM và GVCN đã trực tiếp trao đổi và em đã nhận lỗi).',
      incidentStatus: 'verified',
      sourceLabel: 'Biên bản trao đổi GVBM & GVCN',
      confirmedByEmail: 'gvcn@sim.local',
      confirmedAtMs: 1730000000000,
    },
    referenceDraftReportCard:
      'Em nhanh nhẹn, tích cực hỗ trợ công việc chung của lớp và đạt kết quả học tập khá. Tuy nhiên, em cần rèn luyện thêm ý thức tự giác chấp hành nội quy trong giờ học, tránh sử dụng điện thoại khi đang học bài. Tin rằng với sự điều chỉnh nghiêm túc, em sẽ tiến bộ vững vàng hơn.',
    referenceDraftParentMessage:
      'Kính gửi quý phụ huynh em Vũ Đức Mạnh (Mô phỏng), cô xin trao đổi một nội dung nề nếp đã được GVBM và GVCN xác minh ngày 14/10: em có sử dụng điện thoại trong giờ học và sau khi trao đổi em đã nhận thiếu sót. Nhằm giúp em tập trung tốt hơn vào việc học, rất mong gia đình cùng nhắc nhở, thống nhất quy định sử dụng điện thoại hợp lý với em. Trân trọng cảm ơn sự phối hợp của quý phụ huynh.',
  },
  {
    id: 'scenario_7_unverified_team_leader_report',
    number: 7,
    title: 'Học sinh có phản ánh từ tổ trưởng nhưng GVCN chưa xác minh',
    category: 'parent_message',
    recommendedPurpose: 'xac_minh_thong_tin_chua_xac_nhan',
    expectedBehavior:
      'TUYỆT ĐỐI KHÔNG khẳng định lỗi hay quy chụp; tạo bản nháp trung lập nhắc GVCN xác minh trước khi gửi phụ huynh.',
    student: {
      id: 'SIM_HS07',
      code: 'SIM_HS07',
      moetCode: 'SIM_MOET_007',
      rosterOrder: 7,
      fullName: 'Bùi Thanh Tùng (Mô phỏng)',
      gender: 'Nam',
      team: 3,
      role: 'Thành viên',
      meritPoints: 80,
      attendancePresent: 83,
      attendanceAbsent: 0,
    },
    semester: 'Học kỳ I',
    subjectScores: {},
    weeklySnapshots: [],
    tickets: [
      {
        id: 'sim_tk_pending_7',
        type: 'ne_nep',
        typeLabel: 'Nề nếp',
        studentId: 'SIM_HS07',
        studentName: 'Bùi Thanh Tùng (Mô phỏng)',
        category: 'Phản ánh giờ ra chơi',
        date: '2026-10-18',
        description: 'Tổ trưởng phản ánh em Bùi Thanh Tùng (SIM_HS07) có tranh cãi với bạn ngoài hành lang (chưa xác minh hai chiều).',
        submittedByRole: 'to_truong_3',
        submittedByTitle: 'Tổ trưởng Tổ 3',
        submittedByUid: 'sim_uid_tt3',
        status: 'pending',
        version: 1,
        createdAtMs: 1730000000000,
      },
    ],
    observation: {
      id: 'sim_obs_7',
      studentId: 'SIM_HS07',
      studentCode: 'SIM_HS07',
      moetCode: 'SIM_MOET_007',
      semester: 'Học kỳ I',
      officialConduct: '',
      officialAcademic: '',
      verifiedStrengths: 'Đi học đều, thân thiện với tập thể.',
      verifiedImprovements: '',
      verifiedAchievements: '',
      verifiedIncidentNote: 'Có phản ánh ban đầu từ Tổ trưởng về việc tranh cãi giờ ra chơi; GVCN chưa trao đổi trực tiếp đủ các bên.',
      incidentStatus: 'pending_verification',
      sourceLabel: 'Phản ánh ban đầu chưa xác minh',
      confirmedByEmail: 'gvcn@sim.local',
      confirmedAtMs: 1730000000000,
    },
    referenceDraftReportCard:
      'Em đi học chuyên cần và hòa đồng với tập thể lớp. GVCN cần bổ sung thêm kết quả học tập và rèn luyện chính thức trước khi hoàn thiện nhận xét học bạ.',
    referenceDraftParentMessage:
      'Kính gửi quý phụ huynh em Bùi Thanh Tùng (Mô phỏng), cô vừa ghi nhận một thông tin ban đầu liên quan đến giờ sinh hoạt trên lớp của em và hiện vẫn đang tìm hiểu, trao đổi thêm với em cùng các bạn để nắm rõ sự việc khách quan. Khi thuận tiện, cô rất mong được trao đổi cùng gia đình để phối hợp lắng nghe và hỗ trợ em tốt nhất. Trân trọng, GVCN.',
  },
  {
    id: 'scenario_8_hardship_resilient',
    number: 8,
    title: 'Học sinh có hoàn cảnh khó khăn nhưng nỗ lực vươn lên',
    category: 'both',
    recommendedPurpose: 'dong_vien_tam_ly_hoan_canh',
    expectedBehavior:
      'Tôn trọng sự riêng tư, tránh thương hại hay phơi bày hoàn cảnh nhạy cảm; trân trọng nghị lực và động viên chân thành.',
    student: {
      id: 'SIM_HS08',
      code: 'SIM_HS08',
      moetCode: 'SIM_MOET_008',
      rosterOrder: 8,
      fullName: 'Ngô Thị Mai Hoa (Mô phỏng)',
      gender: 'Nữ',
      team: 4,
      role: 'Thành viên',
      meritPoints: 90,
      attendancePresent: 85,
      attendanceAbsent: 0,
    },
    semester: 'Cả năm',
    subjectScores: {
      SIM_HS08_ngu_van_cn: {
        id: 'SIM_HS08_ngu_van_cn',
        code: 'SIM_HS08',
        fullName: 'Ngô Thị Mai Hoa (Mô phỏng)',
        team: 4,
        subject: 'Ngữ văn',
        tx1: 8.0,
        tx2: 8.5,
        gk: 8.0,
        ck: 8.2,
        avg: 8.2,
        updatedBy: 'GVCN',
      },
    },
    weeklySnapshots: [],
    tickets: [],
    observation: {
      id: 'sim_obs_8',
      studentId: 'SIM_HS08',
      studentCode: 'SIM_HS08',
      moetCode: 'SIM_MOET_008',
      semester: 'Cả năm',
      officialConduct: 'Tốt',
      officialAcademic: 'Khá',
      verifiedStrengths: 'Giàu nghị lực, chăm chỉ tự học, đi học chuyên cần và luôn giữ thái độ lạc quan, lễ phép.',
      verifiedImprovements: '',
      verifiedAchievements: 'Duy trì kết quả học tập ổn định suốt năm học.',
      verifiedIncidentNote: '',
      incidentStatus: 'none',
      sourceLabel: 'GVCN xác nhận trực tiếp',
      confirmedByEmail: 'gvcn@sim.local',
      confirmedAtMs: 1730000000000,
    },
    referenceDraftReportCard:
      'Em giàu nghị lực, chăm chỉ và luôn giữ tinh thần cầu tiến trong suốt năm học. Em đi học chuyên cần, lễ phép, hòa đồng với bạn bè và đạt kết quả Học tập Khá, Rèn luyện Tốt. Em hãy tiếp tục giữ vững niềm tin và nỗ lực để chinh phục những mục tiêu phía trước.',
    referenceDraftParentMessage:
      'Kính gửi quý phụ huynh em Ngô Thị Mai Hoa (Mô phỏng), suốt năm học vừa qua, cô rất trân trọng sự chăm chỉ, kiên trì và tinh thần vươn lên đáng quý của em. Em luôn đi học đầy đủ, lễ phép và đạt kết quả Rèn luyện Tốt, Học tập Khá. Nếu trong quá trình học tập em cần thêm tài liệu hoặc sự hỗ trợ từ lớp và nhà trường, gia đình cứ trao đổi với cô để cùng đồng hành nhé. Trân trọng, GVCN.',
  },
  {
    id: 'scenario_9_sparse_data',
    number: 9,
    title: 'Học sinh thiếu dữ liệu đầu vào (ít điểm, chưa có ghi nhận)',
    category: 'both',
    recommendedPurpose: 'thong_bao_ke_hoach_hop_ph',
    expectedBehavior:
      'Phải cảnh báo rõ: "Chưa đủ căn cứ để tạo nhận xét đầy đủ. GVCN cần bổ sung hoặc xác nhận thông tin." và tuyệt đối không bịa dữ liệu.',
    student: {
      id: 'SIM_HS09',
      code: 'SIM_HS09',
      moetCode: 'SIM_MOET_009',
      rosterOrder: 9,
      fullName: 'Phan Thanh Sơn (Mô phỏng)',
      gender: 'Nam',
      team: 1,
      role: 'Thành viên',
      meritPoints: 0,
      attendancePresent: 0,
      attendanceAbsent: 0,
    },
    semester: 'Học kỳ I',
    subjectScores: {},
    weeklySnapshots: [],
    tickets: [],
    observation: null,
    referenceDraftReportCard: '',
    referenceDraftParentMessage:
      'Kính gửi quý phụ huynh em Phan Thanh Sơn (Mô phỏng), cô xin thông báo kế hoạch họp phụ huynh sắp tới của lớp để cùng trao đổi về tình hình học tập và rèn luyện của em. Rất mong nhận được sự tham dự và phối hợp của gia đình. Trân trọng, GVCN.',
  },
  {
    id: 'scenario_10_duplicate_name_distinct_moet',
    number: 10,
    title: 'Hai học sinh trùng họ tên nhưng khác mã MOET và khác STT',
    category: 'both',
    recommendedPurpose: 'khen_ngoi_dong_vien',
    expectedBehavior:
      'Phân tách tuyệt đối bằng studentId + mã MOET + STT Excel; không bao giờ trộn điểm, nhận xét hay ghi nhận giữa hai học sinh trùng tên.',
    student: {
      id: 'SIM_HS10A',
      code: 'SIM_HS10A',
      moetCode: 'MOET_79000101',
      rosterOrder: 10,
      fullName: 'Nguyễn Thị Thảo (Mô phỏng)',
      gender: 'Nữ',
      team: 1,
      role: 'Thủ quỹ',
      roles: ['thu_quy'],
      meritPoints: 95,
      attendancePresent: 85,
      attendanceAbsent: 0,
    },
    semester: 'Học kỳ I',
    subjectScores: {
      SIM_HS10A_ngu_van: {
        id: 'SIM_HS10A_ngu_van',
        code: 'SIM_HS10A',
        fullName: 'Nguyễn Thị Thảo (Mô phỏng)',
        team: 1,
        subject: 'Ngữ văn',
        tx1: 9.0,
        tx2: 9.0,
        gk: 8.8,
        ck: 9.0,
        avg: 9.0,
        updatedBy: 'GVCN',
      },
    },
    weeklySnapshots: [],
    tickets: [],
    observation: {
      id: 'sim_obs_10a',
      studentId: 'SIM_HS10A',
      studentCode: 'SIM_HS10A',
      moetCode: 'MOET_79000101',
      semester: 'Học kỳ I',
      officialConduct: 'Tốt',
      officialAcademic: 'Tốt',
      verifiedStrengths: 'Cẩn thận, minh bạch trong vai trò Thủ quỹ, học tập xuất sắc môn Ngữ văn (9.0).',
      verifiedImprovements: '',
      verifiedAchievements: '',
      verifiedIncidentNote: '',
      incidentStatus: 'none',
      sourceLabel: 'GVCN xác nhận trực tiếp',
      confirmedByEmail: 'gvcn@sim.local',
      confirmedAtMs: 1730000000000,
    },
    referenceDraftReportCard:
      'Em chăm chỉ, cẩn thận và đạt kết quả Học tập, Rèn luyện mức Tốt trong Học kỳ I. Em hoàn thành chu đáo nhiệm vụ Thủ quỹ của lớp và luôn hòa đồng với tập thể. Em tiếp tục phát huy tinh thần trách nhiệm trong học kỳ tiếp theo.',
    referenceDraftParentMessage:
      'Kính gửi quý phụ huynh em Nguyễn Thị Thảo (Mô phỏng), trong Học kỳ I, em đạt kết quả Học tập và Rèn luyện mức Tốt, hoàn thành rất cẩn thận nhiệm vụ Thủ quỹ của lớp. Cảm ơn gia đình luôn quan tâm và đồng hành cùng em. Trân trọng, GVCN.',
    pairedStudentForDuplicateCheck: {
      student: {
        id: 'SIM_HS10B',
        code: 'SIM_HS10B',
        moetCode: 'MOET_79000202',
        rosterOrder: 31,
        fullName: 'Nguyễn Thị Thảo (Mô phỏng)',
        gender: 'Nữ',
        team: 4,
        role: 'Thành viên',
        meritPoints: 78,
        attendancePresent: 81,
        attendanceAbsent: 3,
      },
      observation: {
        id: 'sim_obs_10b',
        studentId: 'SIM_HS10B',
        studentCode: 'SIM_HS10B',
        moetCode: 'MOET_79000202',
        semester: 'Học kỳ I',
        officialConduct: 'Khá',
        officialAcademic: 'Đạt',
        verifiedStrengths: 'Hòa nhã, lễ phép với thầy cô.',
        verifiedImprovements: 'Cần sắp xếp thời gian ôn bài đều đặn hơn và chú ý chuyên cần.',
        verifiedAchievements: '',
        verifiedIncidentNote: '',
        incidentStatus: 'none',
        sourceLabel: 'GVCN xác nhận trực tiếp',
        confirmedByEmail: 'gvcn@sim.local',
        confirmedAtMs: 1730000000000,
      },
      subjectScores: {
        SIM_HS10B_ngu_van: {
          id: 'SIM_HS10B_ngu_van',
          code: 'SIM_HS10B',
          fullName: 'Nguyễn Thị Thảo (Mô phỏng)',
          team: 4,
          subject: 'Ngữ văn',
          tx1: 6.0,
          tx2: 6.2,
          gk: 6.0,
          ck: 6.3,
          avg: 6.2,
          updatedBy: 'GVCN',
        },
      },
    },
  },
];
