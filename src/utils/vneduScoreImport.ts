import * as XLSX from 'xlsx';
import type { StudentRecord, SubjectScoreRecord } from '../types/gvcn';
import { formatDobToDmy, stripVietnameseAccents } from './studentExcelImport';

export type VneduSemester = 'Học kỳ I' | 'Học kỳ II' | 'Cả năm';

export type VneduAssessmentMode = 'auto' | 'numeric' | 'comment';

export type VneduColumnRole =
  | 'ignore'
  | 'needs_selection'
  | 'stt'
  | 'code'
  | 'lastName'
  | 'firstName'
  | 'fullName'
  | 'dob'
  | `tx:${number}`
  | 'gk'
  | 'ck'
  | 'avg_hk'
  | 'avg_cn'
  | 'note';

export interface VneduMergeSpan {
  sr: number;
  sc: number;
  er: number;
  ec: number;
  text: string;
}

export interface VneduColumnDescriptor {
  index: number;
  colLetter: string;
  rawLabel: string;
  parentLabel: string;
  mergedLabel: string;
  sampleValues: string[];
  autoDetectedRole: VneduColumnRole;
}

export interface VneduTxSlotValue {
  order: number;
  label: string;
  value: number | null;
  qualitative: string;
}

export type VneduMatchStatus =
  | 'matched_by_code'
  | 'matched_auto'
  | 'matched_by_gvcn'
  | 'name_match_dob_mismatch'
  | 'needs_verification'
  | 'not_found'
  | 'duplicate_or_invalid';

export type VneduRowResolution =
  | { type: 'auto' }
  | {
      type: 'confirm';
      studentId: string;
      saveLink: boolean;
      source?: 'manual' | 'auto_batch' | 'dob_mismatch_batch';
    }
  | { type: 'skip' };

export interface VneduVerifiedLink {
  vneduCode: string;
  studentId: string;
  studentName: string;
  schoolName: string;
  className: string;
  schoolYear: string;
  verifiedAt: number;
}

export type VneduVerifiedLinkStore = Record<string, string | VneduVerifiedLink>;

export interface VneduDobComparison {
  fileDob: string;
  rosterDob: string;
  kind: 'exact' | 'swapped_day_month' | 'different' | 'missing';
}

export interface VneduScoreDiff {
  field: string;
  label: string;
  kind: 'added' | 'updated';
  oldValue: string;
  newValue: string;
}

export interface ParsedVneduScoreRow {
  rowIndex: number;
  excelRowNumber: number;
  stt: string;
  vneduCode: string;
  lastNamePart: string;
  firstNamePart: string;
  singleFullNamePart: string;
  resolvedFullName: string;
  dob: string;
  txValues: Record<number, { value: number | null; qualitative: string }>;
  gk: { value: number | null; qualitative: string };
  ck: { value: number | null; qualitative: string };
  avgHk: { value: number | null; qualitative: string };
  avgCn: { value: number | null; qualitative: string };
  note: string;
  qualitativeValues: string[];
  scoreErrors: string[];
  nameErrors: string[];
}

export interface MergedSubjectScorePayload {
  tx1: number | null;
  tx2: number | null;
  gk: number | null;
  ck: number | null;
  avg: number | null;
  txMap: Record<number, number>;
  qualitativeBadge: string;
  cleanNote: string;
  compiledNote: string;
}

export interface ReconciledVneduRow extends ParsedVneduScoreRow {
  status: VneduMatchStatus;
  statusReason: string;
  matchedStudent: StudentRecord | null;
  candidates: StudentRecord[];
  recommendedCandidate: StudentRecord | null;
  resolution: VneduRowResolution;
  isSameMoetCandidate: boolean;
  isDuplicateNameInClass: boolean;
  dobComparison: VneduDobComparison | null;
  existingScore: SubjectScoreRecord | null;
  mergedPayload: MergedSubjectScorePayload | null;
  scoreDiffs: VneduScoreDiff[];
  hasExistingScore: boolean;
  canSave: boolean;
}

export interface VneduImportAnalysis {
  items: ReconciledVneduRow[];
  txOrders: number[];
  hasGkMapped: boolean;
  hasCkMapped: boolean;
  hasAvgHkMapped: boolean;
  hasAvgCnMapped: boolean;
  hasNoteMapped: boolean;
  moetOverlapCount: number;
  moetConflictCount: number;
  autoNameDobCandidateCount: number;
  autoUniqueNameCandidateCount: number;
  dobMismatchCount: number;
  duplicateNameCount: number;
  mappingConflicts: string[];
  unclassifiedColumns: VneduColumnDescriptor[];
  globalErrors: string[];
  globalWarnings: string[];
  summary: {
    totalRows: number;
    matchedByCodeCount: number;
    matchedAutoCount: number;
    matchedByGvcnCount: number;
    dobMismatchCount: number;
    needsVerificationCount: number;
    notFoundCount: number;
    duplicateOrInvalidCount: number;
    readyToSaveCount: number;
    changedExistingCount: number;
    newScoreCount: number;
    unchangedCount: number;
    totalNewScoreCells: number;
    totalUpdatedScoreCells: number;
  };
}

export const VNEDU_SEMESTERS: VneduSemester[] = ['Học kỳ I', 'Học kỳ II', 'Cả năm'];

const QUALITATIVE_ALIASES: Record<string, string> = {
  d: 'Đạt',
  dat: 'Đạt',
  'dat yeu cau': 'Đạt',
  cd: 'Chưa đạt',
  'chua dat': 'Chưa đạt',
  ht: 'Hoàn thành',
  htt: 'Hoàn thành tốt',
  cht: 'Chưa hoàn thành',
};

export function isCommentSubject(subject: string): boolean {
  const norm = stripVietnameseAccents(subject || '');
  return (
    norm.includes('the duc') ||
    norm.includes('giao duc the chat') ||
    norm.includes('hoat dong trai nghiem') ||
    norm.includes('huong nghiep') ||
    norm.includes('quoc phong') ||
    norm.includes('am nhac') ||
    norm.includes('my thuat') ||
    norm.includes('noi dung giao duc dia phuong')
  );
}

export function getVneduScoreDocId(
  studentCode: string,
  subjectSlug: string,
  semester: VneduSemester = 'Học kỳ I'
): string {
  const suffix =
    semester === 'Học kỳ II' ? '_hk2' : semester === 'Cả năm' ? '_cn' : '';
  return `${studentCode}_${subjectSlug}${suffix}`.slice(0, 120);
}

export function getVneduSubjectLabel(
  subject: string,
  semester: VneduSemester = 'Học kỳ I'
): string {
  if (semester === 'Học kỳ II') return `${subject} (HK II)`;
  if (semester === 'Cả năm') return `${subject} (Cả năm)`;
  return subject;
}

export function normalizeNameForCompare(name: string): string {
  return (name || '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function isTxRole(role: VneduColumnRole): role is `tx:${number}` {
  return role.startsWith('tx:');
}

export function getTxOrderFromRole(role: VneduColumnRole): number | null {
  if (!isTxRole(role)) return null;
  const n = Number(role.slice(3));
  return Number.isInteger(n) && n >= 1 ? n : null;
}

export function getRoleDisplayLabel(role: VneduColumnRole): string {
  if (role === 'ignore') return 'Bỏ qua (không nhập)';
  if (role === 'needs_selection') return 'Cần GVCN chọn loại điểm';
  if (role === 'stt') return 'STT';
  if (role === 'code') return 'Mã học sinh (vnEdu)';
  if (role === 'lastName') return 'Họ và đệm';
  if (role === 'firstName') return 'Tên';
  if (role === 'fullName') return 'Họ và tên đầy đủ';
  if (role === 'dob') return 'Ngày sinh';
  if (isTxRole(role)) return `Điểm TX${getTxOrderFromRole(role)}`;
  if (role === 'gk') return 'Điểm Giữa kỳ (GK)';
  if (role === 'ck') return 'Điểm Cuối kỳ (CK)';
  if (role === 'avg_hk') return 'Điểm TB môn Học kỳ (ĐTB HK)';
  if (role === 'avg_cn') return 'Điểm TB môn Cả năm (ĐTB CN)';
  if (role === 'note') return 'Nhận xét / Đánh giá';
  return role;
}

function isValidCalendarDate(day: number, month: number, year: number): boolean {
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return false;
  if (year < 1985 || year > 2030 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

function formatDmy(day: number, month: number, year: number): string {
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${String(year).padStart(4, '0')}`;
}

export function analyzeDobComparison(fileDobRaw: string, rosterDobRaw: string): VneduDobComparison {
  const fileDob = formatDobToDmy(fileDobRaw || '');
  const rosterDob = formatDobToDmy(rosterDobRaw || '');
  if (!fileDob || !rosterDob) {
    return { fileDob, rosterDob, kind: 'missing' };
  }
  if (fileDob === rosterDob) {
    return { fileDob, rosterDob, kind: 'exact' };
  }
  const fParts = fileDob.split('/').map(Number);
  const rParts = rosterDob.split('/').map(Number);
  if (
    fParts.length === 3 &&
    rParts.length === 3 &&
    fParts[2] === rParts[2] &&
    fParts[0] === rParts[1] &&
    fParts[1] === rParts[0]
  ) {
    return { fileDob, rosterDob, kind: 'swapped_day_month' };
  }
  return { fileDob, rosterDob, kind: 'different' };
}

function extractExcelCellText(cell: XLSX.CellObject | undefined): string {
  if (!cell) return '';

  if (cell.t === 'd' && cell.v instanceof Date) {
    const d = cell.v;
    return formatDmy(d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear());
  }

  if (cell.t === 's') {
    return String(cell.v ?? cell.w ?? '').normalize('NFC').trim();
  }

  if (cell.t === 'n' && typeof cell.v === 'number') {
    const fmt = typeof cell.z === 'string' ? cell.z : '';
    const formatted = typeof cell.w === 'string' ? cell.w.trim() : '';
    const looksLikeDate = /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(formatted);
    if ((fmt && fmt !== 'General' && fmt !== '@' && XLSX.SSF.is_date(fmt)) || looksLikeDate) {
      const parsed = XLSX.SSF.parse_date_code(cell.v);
      if (parsed && isValidCalendarDate(parsed.d, parsed.m, parsed.y)) {
        return formatDmy(parsed.d, parsed.m, parsed.y);
      }
    }
    if (formatted && /^0\d+$/.test(formatted)) {
      return formatted;
    }
    if (Number.isInteger(cell.v)) {
      return String(cell.v);
    }
    return formatted || String(cell.v);
  }

  return String(cell.w ?? cell.v ?? '').normalize('NFC').trim();
}

export function extractVneduSheetMatrix(
  wb: XLSX.WorkBook,
  sheetName: string
): { matrix: string[][]; merges: VneduMergeSpan[] } {
  const ws = wb.Sheets[sheetName];
  if (!ws || !ws['!ref']) return { matrix: [], merges: [] };
  const range = XLSX.utils.decode_range(ws['!ref']);
  const totalCols = Math.max(range.e.c - range.s.c + 1, 0);
  const rawMatrix: string[][] = [];
  const rowIndexMap = new Map<number, number>();

  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: string[] = new Array(totalCols).fill('');
    let hasValue = false;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const val = extractExcelCellText(ws[addr] as XLSX.CellObject | undefined);
      if (val !== '') hasValue = true;
      row[c - range.s.c] = val;
    }
    if (hasValue) {
      rowIndexMap.set(r, rawMatrix.length);
      rawMatrix.push(row);
    }
  }

  const merges: VneduMergeSpan[] = [];
  const wsMerges = Array.isArray(ws['!merges']) ? ws['!merges'] : [];
  for (const m of wsMerges) {
    const sr = rowIndexMap.get(m.s.r);
    const er = rowIndexMap.get(m.e.r);
    if (sr === undefined) continue;
    const sc = m.s.c - range.s.c;
    const ec = m.e.c - range.s.c;
    const topLeftText = (rawMatrix[sr]?.[sc] || '').trim();
    if (topLeftText) {
      merges.push({
        sr,
        sc,
        er: er !== undefined ? er : sr,
        ec,
        text: topLeftText,
      });
    }
  }

  return { matrix: rawMatrix, merges };
}

export function readVneduWorkbook(
  buffer: ArrayBuffer,
  preferredSheetName?: string
): {
  workbook: XLSX.WorkBook;
  sheetNames: string[];
  selectedSheet: string;
  matrix: string[][];
  merges: VneduMergeSpan[];
} {
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: false,
    cellText: true,
    cellNF: true,
    codepage: 65001,
  });
  const sheetNames = workbook.SheetNames || [];
  const selectedSheet =
    preferredSheetName && sheetNames.includes(preferredSheetName)
      ? preferredSheetName
      : sheetNames[0] || '';
  const extracted = selectedSheet
    ? extractVneduSheetMatrix(workbook, selectedSheet)
    : { matrix: [], merges: [] };
  return {
    workbook,
    sheetNames,
    selectedSheet,
    matrix: extracted.matrix,
    merges: extracted.merges,
  };
}

/**
 * Tách dữ liệu dán từ Excel theo ký tự TAB (\t), giữ nguyên các cột rỗng ở giữa bảng.
 * Tuyệt đối không dùng tách theo dấu cách!
 */
export function parseVneduDelimitedText(text: string): string[][] {
  const rawLines = (text || '').split(/\r?\n/);
  const nonEmptyLines = rawLines.filter((l) => l.replace(/\t/g, '').trim() !== '');
  if (nonEmptyLines.length === 0) return [];

  const usesTab = nonEmptyLines.some((l) => l.includes('\t'));
  const rawRows: string[][] = nonEmptyLines.map((line) => {
    if (usesTab) {
      return line.split('\t').map((cell) => cell.normalize('NFC').trim());
    }
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cells.push(current.normalize('NFC').trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.normalize('NFC').trim());
    return cells;
  });

  const maxCols = Math.max(...rawRows.map((r) => r.length), 0);
  return rawRows.map((r) => {
    if (r.length === maxCols) return r;
    return [...r, ...new Array(maxCols - r.length).fill('')];
  });
}

function classifyHeaderTextToRole(label: string): VneduColumnRole | 'tx_generic' | null {
  const norm = stripVietnameseAccents(label)
    .replace(/[._:/\\()[\]-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!norm) return null;

  // STT
  if (norm === 'stt' || norm === 'so tt' || norm === 'tt' || norm === 'so thu tu') {
    return 'stt';
  }

  // Mã học sinh / Mã MOET
  if (
    norm === 'ma hs' ||
    norm === 'ma hoc sinh' ||
    norm === 'mahs' ||
    norm === 'ma dinh danh' ||
    norm.includes('ma moet') ||
    norm.includes('ma dinh danh') ||
    norm.includes('ma vnedu') ||
    norm === 'code' ||
    (norm.startsWith('ma ') && !norm.includes('lop') && !norm.includes('mon'))
  ) {
    return 'code';
  }

  // Tách Họ và đệm vs Tên (check trước Họ và tên!)
  if (
    norm === 'ho va dem' ||
    norm === 'ho dem' ||
    norm === 'ho lot' ||
    norm === 'ho va ten dem' ||
    norm === 'ho' ||
    norm.includes('ho va dem') ||
    norm.includes('ho dem')
  ) {
    return 'lastName';
  }

  if (norm === 'ten' || norm === 'ten hs' || norm === 'ten hoc sinh') {
    return 'firstName';
  }

  // Họ và tên đầy đủ
  if (
    !norm.includes('phu huynh') &&
    (norm === 'ho ten' ||
      norm === 'ho va ten' ||
      norm === 'ho ten hoc sinh' ||
      norm === 'fullname' ||
      norm === 'student name' ||
      (norm.includes('ho') && norm.includes('ten') && !norm.includes('dem')))
  ) {
    return 'fullName';
  }

  // Ngày sinh
  if (norm.includes('ngay sinh') || norm === 'sinh nhat' || norm === 'dob' || norm === 'nam sinh') {
    return 'dob';
  }

  // Giữa kỳ
  if (
    norm === 'gk' ||
    norm === 'gk1' ||
    norm === 'gk2' ||
    norm === 'gki' ||
    norm === 'gkii' ||
    norm === 'ddggk' ||
    norm === 'ddg gk' ||
    norm === 'dggk' ||
    norm === 'dg gk' ||
    norm.includes('ddggk') ||
    norm.includes('ddg gk') ||
    norm.includes('dggk') ||
    norm.includes('giua ky') ||
    norm.includes('giua ki') ||
    norm.includes('diem gk')
  ) {
    return 'gk';
  }

  // Cuối kỳ
  if (
    norm === 'ck' ||
    norm === 'ck1' ||
    norm === 'ck2' ||
    norm === 'cki' ||
    norm === 'ckii' ||
    norm === 'ddgck' ||
    norm === 'ddg ck' ||
    norm === 'dgck' ||
    norm === 'dg ck' ||
    norm.includes('ddgck') ||
    norm.includes('ddg ck') ||
    norm.includes('dgck') ||
    norm.includes('cuoi ky') ||
    norm.includes('cuoi ki') ||
    norm.includes('diem ck') ||
    norm.includes('thi hk')
  ) {
    return 'ck';
  }

  // Điểm trung bình cả năm (check before ĐTB HK!)
  if (
    norm === 'dtb cn' ||
    norm === 'dtbmcn' ||
    norm === 'dtb mcn' ||
    norm === 'tbm cn' ||
    norm === 'tbmcn' ||
    norm === 'cn' ||
    norm.includes('tb ca nam') ||
    norm.includes('trung binh ca nam') ||
    norm.includes('dtb ca nam') ||
    norm.includes('ca nam')
  ) {
    return 'avg_cn';
  }

  // Điểm trung bình môn học kỳ
  if (
    norm === 'dtb' ||
    norm === 'tbm' ||
    norm === 'dtbm' ||
    norm === 'dtbmhk' ||
    norm === 'dtbmhk1' ||
    norm === 'dtbmhk2' ||
    norm === 'dtbmhki' ||
    norm === 'dtbmhkii' ||
    norm === 'dtb mhk' ||
    norm === 'dtb mhk1' ||
    norm === 'dtb mhk2' ||
    norm === 'dtb hk' ||
    norm === 'dtb hk1' ||
    norm === 'dtb hk2' ||
    norm === 'dtb hki' ||
    norm === 'dtb hkii' ||
    norm === 'tbm hk1' ||
    norm === 'tbm hk2' ||
    norm === 'tbmhk1' ||
    norm === 'tbmhk2' ||
    norm === 'tb hk1' ||
    norm === 'tb hk2' ||
    norm === 'tb mon' ||
    norm === 'avg' ||
    norm.includes('trung binh') ||
    norm.includes('dtb mon') ||
    norm.includes('tb mon') ||
    norm.includes('dtbm') ||
    norm.includes('tbmhk')
  ) {
    return 'avg_hk';
  }

  // Điểm thường xuyên TX1..TX12
  const hasTxHint =
    norm.includes('tx') ||
    norm.includes('thuong xuyen') ||
    norm.includes('dgtx') ||
    norm.includes('ddgtx') ||
    norm.includes('ddg tx') ||
    norm.includes('dg tx');

  const txMatch = norm.match(
    /(?:^|\b)(?:diem\s*)?(?:ddg\s*tx|dg\s*tx|ddgtx|dgtx|tx|thuong xuyen|lan|c|cot)\s*(\d{1,2})(?:\b|$)/
  );
  if (txMatch && hasTxHint) {
    const order = Number(txMatch[1]);
    if (order >= 1 && order <= 12) return `tx:${order}`;
  }
  const trailingDigitWithTx = hasTxHint && norm.match(/\b(?:lan\s*)?(\d{1,2})$/);
  if (trailingDigitWithTx) {
    const order = Number(trailingDigitWithTx[1]);
    if (order >= 1 && order <= 12) return `tx:${order}`;
  }

  if (
    norm.startsWith('tx') ||
    norm.startsWith('dgtx') ||
    norm.startsWith('ddgtx') ||
    norm.startsWith('ddg tx') ||
    norm.startsWith('dg tx') ||
    norm.includes('thuong xuyen') ||
    norm.includes('mieng') ||
    norm.includes('15 phut') ||
    norm === '15p'
  ) {
    return 'tx_generic';
  }

  // Nhận xét / Ghi chú / Xếp loại
  if (
    norm.includes('nhan xet') ||
    norm.includes('ghi chu') ||
    norm === 'note' ||
    norm.includes('xep loai') ||
    norm.includes('danh gia')
  ) {
    return 'note';
  }

  return null;
}

function getMergedParentTextForCell(
  rowIdx: number,
  colIdx: number,
  merges: VneduMergeSpan[]
): string {
  for (const m of merges) {
    if (rowIdx >= m.sr && rowIdx <= m.er && colIdx >= m.sc && colIdx <= m.ec) {
      return m.text;
    }
  }
  return '';
}

function isLikelySplitNameAdjacentCol(
  dataRows: string[][],
  leftColIdx: number,
  rightColIdx: number
): boolean {
  const sample = dataRows.slice(0, 15).filter((r) => (r[leftColIdx] || '').trim() || (r[rightColIdx] || '').trim());
  if (sample.length < 2) return false;
  let singleWordAlphaRight = 0;
  let multiWordAlphaLeft = 0;
  for (const r of sample) {
    const left = (r[leftColIdx] || '').trim();
    const right = (r[rightColIdx] || '').trim();
    if (!right || /\d/.test(right)) continue;
    const rightWords = right.split(/\s+/).filter(Boolean);
    if (rightWords.length === 1 && /^[\p{L}]+$/u.test(rightWords[0])) {
      singleWordAlphaRight++;
    }
    if (left && !/\d/.test(left) && left.split(/\s+/).length >= 1) {
      multiWordAlphaLeft++;
    }
  }
  return singleWordAlphaRight >= Math.ceil(sample.length * 0.7) && multiWordAlphaLeft >= Math.ceil(sample.length * 0.7);
}

function hasScoreLikeSampleData(values: string[]): boolean {
  if (values.length === 0) return false;
  let scoreOrEvalCount = 0;
  for (const v of values) {
    const trimmed = v.trim();
    if (!trimmed) continue;
    const numNorm = trimmed.replace(',', '.');
    if (/^\d{1,2}(\.\d+)?$/.test(numNorm)) {
      const n = Number(numNorm);
      if (n >= 0 && n <= 10) {
        scoreOrEvalCount++;
        continue;
      }
    }
    const q = stripVietnameseAccents(trimmed);
    if (QUALITATIVE_ALIASES[q]) {
      scoreOrEvalCount++;
    }
  }
  return scoreOrEvalCount > 0;
}

const SUMMARY_LABEL_SET = new Set([
  'tot',
  'kha',
  'dat',
  'chua dat',
  'gioi',
  'trung binh',
  'yeu',
  'kem',
  'hoan thanh tot',
  'hoan thanh',
  'chua hoan thanh',
  'tong',
  'tong cong',
  'tong so',
  'si so',
  'so luong',
  'sl',
  'ty le',
  'ty le %',
  'phan tram',
  '%',
  'tb',
  'diem tb',
  'trung binh lop',
  'cao nhat',
  'thap nhat',
  'tren tb',
  'duoi tb',
  'muc dat duoc',
  'xep loai',
  'ket qua',
  'ghi chu',
]);

function hasStudentDobValue(row: string[], dobIdx = -1): boolean {
  const isDobText = (v: string) => {
    const t = (v || '').trim();
    return (
      /^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}$/.test(t) ||
      /^\d{4}[/.-]\d{1,2}[/.-]\d{1,2}$/.test(t)
    );
  };
  if (dobIdx >= 0 && isDobText(row[dobIdx] || '')) return true;
  const limit = Math.min(row.length, 8);
  for (let c = 0; c < limit; c++) {
    if (isDobText(row[c] || '')) return true;
  }
  return false;
}

function hasStudentCodeValue(row: string[], codeIdx = -1): boolean {
  const isCodeText = (v: string) => {
    const t = (v || '').trim();
    if (!t || /\s/.test(t)) return false;
    // vnEdu 8-12 digit student codes, MOET codes, or HS001-style alphanumeric codes
    return /^\d{6,}$/.test(t) || /^(?:HS|VN|MOET)[A-Z0-9_-]{2,}$/i.test(t);
  };
  if (codeIdx >= 0 && isCodeText(row[codeIdx] || '')) return true;
  const limit = Math.min(row.length, 4);
  for (let c = 0; c < limit; c++) {
    if (isCodeText(row[c] || '')) return true;
  }
  return false;
}

function extractCombinedLeadingAlphaText(row: string[], nameIndices: number[] = []): string {
  const rawParts =
    nameIndices.length > 0
      ? nameIndices.map((idx) => (row[idx] || '').trim()).filter(Boolean)
      : row
          .slice(0, 6)
          .map((c) => (c || '').trim())
          .filter((c) => c && /[\p{L}]/u.test(c) && !/\d/.test(c));

  return stripVietnameseAccents(rawParts.join(' '))
    .replace(/[._:/\\()[\]-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Phát hiện dòng bắt đầu khu vực thống kê cuối bảng điểm vnEdu
 * (VD: "THỐNG KÊ HỌC KỲ 1", "TỔNG HỢP KẾT QUẢ", "GIÁO VIÊN BỘ MÔN", "HIỆU TRƯỞNG"...).
 * QUAN TRỌNG: Dòng có Ngày sinh học sinh hoặc Mã HS vnEdu KHÔNG BAO GIỜ là dòng tiêu đề thống kê
 * (tránh dừng nhầm khi cột Nhận xét của học sinh có chữ "Kết quả học tập tốt"...).
 */
export function isStatisticsOrFooterSectionStart(row: string[]): boolean {
  const nonEmpty = row.map((c) => (c || '').trim()).filter(Boolean);
  if (nonEmpty.length === 0) return false;

  // Never treat a real student row (carrying DOB or vnEdu/MOET student ID) as a footer header
  if (hasStudentDobValue(row) || hasStudentCodeValue(row)) {
    return false;
  }

  // Only inspect leading/structural columns (avoid random student note text)
  const inspectText = row
    .slice(0, 8)
    .map((c) => (c || '').trim())
    .filter(Boolean)
    .join(' ');
  const joined = stripVietnameseAccents(inspectText || nonEmpty.join(' '))
    .replace(/[._:/\\()[\]-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (
    joined.includes('thong ke') ||
    joined.includes('tong hop ket qua') ||
    joined.includes('bang tong hop') ||
    joined.includes('tong ket hoc ky') ||
    joined.includes('tong ket nam hoc') ||
    joined.includes('ket qua hoc tap') ||
    joined.includes('xep loai hoc luc') ||
    joined.includes('muc do dat duoc') ||
    joined.includes('giao vien bo mon') ||
    joined.includes('giao vien chu nhiem') ||
    joined.includes('hieu truong') ||
    joined.includes('nguoi lap bang') ||
    joined.includes('ky va ghi ro ho ten') ||
    /ngay\s+\d*\s*thang\s+\d*\s*nam/.test(joined)
  ) {
    return true;
  }

  return false;
}

/**
 * Phát hiện dòng thống kê/tổng kết đơn lẻ (Tốt, Khá, Đạt, Chưa đạt, Tổng cộng, Tỷ lệ...)
 * để không bao giờ nhận nhầm thành học sinh, ĐỒNG THỜI tuyệt đối không dừng nhầm vào học sinh
 * có tên trùng từ khóa xếp loại (VD: Nguyễn Thành Đạt, Trần Minh Khá, Lê Trung Bình...).
 */
function isNonStudentSummaryRow(
  row: string[],
  codeIdx = -1,
  sttIdx = -1,
  nameIndices: number[] = [],
  dobIdx = -1
): boolean {
  if (isStatisticsOrFooterSectionStart(row)) return true;

  // Real student rows with a valid DOB or student code are NEVER summary rows!
  if (hasStudentDobValue(row, dobIdx) || hasStudentCodeValue(row, codeIdx)) {
    return false;
  }

  const code = codeIdx >= 0 ? (row[codeIdx] || '').trim() : '';
  const stt = sttIdx >= 0 ? (row[sttIdx] || '').trim() : (row[0] || '').trim();
  const hasNumericStt = /^\d{1,3}$/.test(stt);

  // Combine full name columns together so split name ("Nguyễn Thành" + "Đạt") becomes
  // "nguyen thanh dat" (NOT single cell "dat" which would false-match SUMMARY_LABEL_SET!)
  const combinedNameNorm = extractCombinedLeadingAlphaText(row, nameIndices);

  if (!code) {
    // Only treat as summary label if the ENTIRE combined alphabetic name/label matches a summary keyword
    if (combinedNameNorm && SUMMARY_LABEL_SET.has(combinedNameNorm)) {
      return true;
    }
  }

  // Reject percentage-heavy summary rows that have no student code and no multi-word student name
  if (!code && !hasNumericStt) {
    const pctCells = row.filter((c) => (c || '').includes('%')).length;
    if (pctCells >= 2) return true;
  }

  const firstCols = stripVietnameseAccents(
    [stt, code, row[0] || '', row[1] || '', row[2] || ''].join(' ')
  );
  if (
    !code &&
    (firstCols.includes('giao vien') ||
      firstCols.includes('hieu truong') ||
      firstCols.includes('ky ten') ||
      firstCols.includes('tong cong') ||
      firstCols.includes('tong ket') ||
      firstCols.includes('si so') ||
      firstCols.includes('thong ke'))
  ) {
    return true;
  }

  return false;
}

/**
 * Cắt riêng vùng dòng dữ liệu học sinh ngay sau dòng tiêu đề, dừng sạch trước phần THỐNG KÊ / chữ ký cuối file.
 * Đảm bảo mọi thống kê ở cuối file (VD: Tốt/Khá/Đạt/Chưa đạt hoặc số liệu ở cột Q)
 * không làm sai lệch số lượng học sinh và không làm hỏng nhận diện cột điểm,
 * đồng thời đọc ĐỦ toàn bộ học sinh kể cả học sinh tên Đạt, Khá, Tốt, Giỏi, Trung Bình...
 */
export function sliceStudentTableRows(matrix: string[][], headerRowIndex: number): string[][] {
  if (headerRowIndex < 0 || headerRowIndex >= matrix.length - 1) return [];
  const rawAfterHeader = matrix.slice(headerRowIndex + 1);
  const studentRows: string[][] = [];
  let seenNonEmptyData = false;
  let consecutiveBlankRows = 0;

  for (let i = 0; i < rawAfterHeader.length; i++) {
    const row = rawAfterHeader[i];
    const isBlank = row.every((c) => (c || '').trim() === '');

    if (isBlank) {
      if (seenNonEmptyData) {
        consecutiveBlankRows++;
      }
      continue;
    }

    if (isStatisticsOrFooterSectionStart(row)) {
      break;
    }

    // After student rows + blank separator(s), if we hit summary labels like Tốt / Khá / Đạt / Chưa đạt, stop!
    if (seenNonEmptyData && consecutiveBlankRows >= 1 && isNonStudentSummaryRow(row)) {
      break;
    }

    // Even without a blank line, a pure summary row (no DOB, no code, combined label in SUMMARY_LABEL_SET) ends the student region
    if (seenNonEmptyData && isNonStudentSummaryRow(row)) {
      break;
    }

    consecutiveBlankRows = 0;
    seenNonEmptyData = true;
    studentRows.push(row);
  }

  return studentRows;
}

function isLikelySubHeaderRow(
  row: string[] | undefined,
  rowIndex: number,
  parentRowIndex: number,
  merges: VneduMergeSpan[]
): boolean {
  if (!row) return false;
  const nonEmpty = row.map((c) => (c || '').trim()).filter(Boolean);

  // Check if any vertical merge spans from parentRowIndex into rowIndex (classic 2-row vnEdu header!)
  const hasVerticalMergeFromParent = merges.some(
    (m) => m.sr <= parentRowIndex && m.er >= rowIndex && m.text.trim() !== ''
  );

  // If row contains a date (student DOB) or long 8+ digit student code, it is a student row, NOT a sub-header!
  const hasStudentDob = row.some((c) => /^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test((c || '').trim()));
  const hasLongStudentCode = row.some((c) => /^\d{7,}$/.test((c || '').trim()));
  if (hasStudentDob || hasLongStudentCode) return false;

  if (nonEmpty.length === 0) {
    return hasVerticalMergeFromParent;
  }

  let subHeaderTokens = 0;
  for (const cell of nonEmpty) {
    const norm = stripVietnameseAccents(cell).replace(/[._:/\\()[\]-]+/g, ' ').trim();
    if (
      /^\d{1,2}$/.test(norm) ||
      /^lan\s*\d{1,2}$/.test(norm) ||
      /^tx\s*\d{1,2}$/.test(norm) ||
      /^cot\s*\d{1,2}$/.test(norm) ||
      classifyHeaderTextToRole(cell) !== null
    ) {
      subHeaderTokens++;
    }
  }

  if (hasVerticalMergeFromParent && subHeaderTokens >= 1) return true;
  if (subHeaderTokens >= 2 && subHeaderTokens >= Math.ceil(nonEmpty.length * 0.7)) return true;

  return false;
}

export function buildVneduColumnDescriptors(
  matrix: string[][],
  headerRowIndex: number,
  mergeParentHeaderRow: boolean,
  merges: VneduMergeSpan[] = []
): {
  descriptors: VneduColumnDescriptor[];
  roleMap: Record<number, VneduColumnRole>;
} {
  if (headerRowIndex < 0 || headerRowIndex >= matrix.length) {
    return { descriptors: [], roleMap: {} };
  }

  const maxCols = Math.max(...matrix.map((r) => r.length), 0);
  const currentRow = matrix[headerRowIndex] || [];
  // CRITICAL: Only inspect student rows (before THỐNG KÊ / footer) when sampling column data!
  const studentRows = sliceStudentTableRows(matrix, headerRowIndex);

  const rawDescriptors: VneduColumnDescriptor[] = [];
  let carriedTxParent = '';

  for (let idx = 0; idx < maxCols; idx++) {
    const colLetter = XLSX.utils.encode_col(idx);
    const cur = (currentRow[idx] || '').trim();
    const mergeAtCur = getMergedParentTextForCell(headerRowIndex, idx, merges);
    const above1 = headerRowIndex > 0 ? (matrix[headerRowIndex - 1]?.[idx] || '').trim() : '';
    const aboveMerge =
      headerRowIndex > 0 ? getMergedParentTextForCell(headerRowIndex - 1, idx, merges) : '';

    // Only combine 1 parent header row above (NEVER pull sheet banner text from 2+ rows above!)
    const explicitParent =
      above1 || aboveMerge || (mergeAtCur && mergeAtCur !== cur ? mergeAtCur : '');

    if (explicitParent) {
      const pCls = classifyHeaderTextToRole(explicitParent);
      const pNorm = stripVietnameseAccents(explicitParent);
      if (
        pCls === 'tx_generic' ||
        (pCls && isTxRole(pCls)) ||
        pNorm.includes('thuong xuyen') ||
        pNorm.includes('dgtx') ||
        pNorm.includes('ddgtx') ||
        pNorm.includes('ddg tx')
      ) {
        carriedTxParent = explicitParent;
      } else {
        carriedTxParent = '';
      }
    }

    // Collect sample values strictly from the student rows region (NOT statistics footer!)
    const sampleValues: string[] = [];
    for (let r = 0; r < studentRows.length && sampleValues.length < 3; r++) {
      const val = (studentRows[r]?.[idx] || '').trim();
      if (val !== '') sampleValues.push(val);
    }

    let mergedLabel = cur;
    let effectiveParent = mergeParentHeaderRow ? explicitParent : '';

    if (!cur) {
      if (mergeParentHeaderRow) {
        if (explicitParent) {
          mergedLabel = explicitParent;
        } else if (mergeAtCur) {
          mergedLabel = mergeAtCur;
        } else if (carriedTxParent && hasScoreLikeSampleData(sampleValues)) {
          effectiveParent = carriedTxParent;
          mergedLabel = carriedTxParent;
        }
      }
    } else if (!classifyHeaderTextToRole(cur)) {
      // Sub-header like "1", "2", "3", "4", "5", "Lần 1" under "ĐĐGtx"
      const groupPar = explicitParent || (mergeParentHeaderRow ? carriedTxParent : '');
      const parNorm = stripVietnameseAccents(groupPar);
      if (
        groupPar &&
        (parNorm.includes('thuong xuyen') ||
          parNorm.includes('dgtx') ||
          parNorm.includes('ddgtx') ||
          parNorm.includes('ddg tx') ||
          parNorm.includes('dg tx'))
      ) {
        effectiveParent = groupPar;
        mergedLabel = `${groupPar} - ${cur}`;
      }
    }

    rawDescriptors.push({
      index: idx,
      colLetter,
      rawLabel: cur,
      parentLabel: effectiveParent,
      mergedLabel: mergedLabel || `Cột ${colLetter}`,
      sampleValues,
      autoDetectedRole: 'ignore',
    });
  }

  // Classify each column WITHOUT ever guessing score type from column letters!
  const preliminaryRoles: Record<number, VneduColumnRole> = {};
  const genericTxIndices: number[] = [];

  for (const col of rawDescriptors) {
    const cls =
      classifyHeaderTextToRole(col.mergedLabel) || classifyHeaderTextToRole(col.rawLabel);

    if (cls === 'tx_generic') {
      genericTxIndices.push(col.index);
      preliminaryRoles[col.index] = 'needs_selection';
    } else if (cls) {
      preliminaryRoles[col.index] = cls;
    } else {
      // Auto-ignore columns that have NO data in the student rows region (e.g., Column Q in stats footer)!
      if (col.sampleValues.length === 0) {
        preliminaryRoles[col.index] = 'ignore';
      } else if (hasScoreLikeSampleData(col.sampleValues)) {
        preliminaryRoles[col.index] = 'needs_selection';
      } else if (col.rawLabel && col.sampleValues.length > 0) {
        preliminaryRoles[col.index] = 'needs_selection';
      } else {
        preliminaryRoles[col.index] = 'ignore';
      }
    }
  }

  // Assign generic TX columns sequentially to unused TX1..TX12
  const usedTxOrders = new Set<number>();
  Object.values(preliminaryRoles).forEach((role) => {
    const ord = getTxOrderFromRole(role);
    if (ord !== null) usedTxOrders.add(ord);
  });

  for (const colIdx of genericTxIndices) {
    let nextOrd = 1;
    while (usedTxOrders.has(nextOrd)) nextOrd++;
    usedTxOrders.add(nextOrd);
    preliminaryRoles[colIdx] = `tx:${nextOrd}`;
    const desc = rawDescriptors[colIdx];
    if (desc && !desc.rawLabel && desc.parentLabel) {
      desc.mergedLabel = `${desc.parentLabel} (TX${nextOrd})`;
    }
  }

  // CRITICAL: Handle vnEdu merged 2-column "Họ và tên" (Col C = "Trần Nhã", Col D = "Bằng" with empty/same header)!
  const fullNameColIndices = rawDescriptors
    .filter((c) => preliminaryRoles[c.index] === 'fullName')
    .map((c) => c.index);

  if (fullNameColIndices.length === 1) {
    const fnIdx = fullNameColIndices[0];
    const nextIdx = fnIdx + 1;
    if (nextIdx < rawDescriptors.length) {
      const nextRole = preliminaryRoles[nextIdx];
      const nextIsUnnamedOrSameMerged =
        !rawDescriptors[nextIdx].rawLabel ||
        classifyHeaderTextToRole(rawDescriptors[nextIdx].mergedLabel) === 'fullName';
      if (
        (nextRole === 'ignore' || nextRole === 'needs_selection' || nextRole === 'fullName') &&
        nextIsUnnamedOrSameMerged &&
        isLikelySplitNameAdjacentCol(studentRows, fnIdx, nextIdx)
      ) {
        preliminaryRoles[fnIdx] = 'lastName';
        preliminaryRoles[nextIdx] = 'firstName';
        rawDescriptors[fnIdx].mergedLabel = 'Họ và đệm (tự tách từ Họ và tên)';
        rawDescriptors[nextIdx].mergedLabel = 'Tên (tự tách từ Họ và tên)';
      }
    }
  } else if (fullNameColIndices.length >= 2) {
    // e.g. merged C:D cell propagated "Họ và tên" into both C and D
    const first = fullNameColIndices[0];
    const second = fullNameColIndices[1];
    if (second === first + 1 && isLikelySplitNameAdjacentCol(studentRows, first, second)) {
      preliminaryRoles[first] = 'lastName';
      preliminaryRoles[second] = 'firstName';
      rawDescriptors[first].mergedLabel = 'Họ và đệm';
      rawDescriptors[second].mergedLabel = 'Tên';
    }
  }

  // Enforce ONLY 1 name strategy per file: if both lastName & firstName exist, demote redundant fullName
  const hasSplit =
    Object.values(preliminaryRoles).includes('lastName') &&
    Object.values(preliminaryRoles).includes('firstName');
  if (hasSplit) {
    Object.entries(preliminaryRoles).forEach(([idxStr, r]) => {
      if (r === 'fullName') preliminaryRoles[Number(idxStr)] = 'ignore';
    });
  }

  // Deduplicate single-instance roles if auto-detection hit two identical headers (except tx handled above)
  const seenSingles = new Set<VneduColumnRole>();
  const singleRoles: VneduColumnRole[] = [
    'stt',
    'code',
    'lastName',
    'firstName',
    'fullName',
    'dob',
    'gk',
    'ck',
    'avg_hk',
    'avg_cn',
    'note',
  ];
  for (const col of rawDescriptors) {
    const r = preliminaryRoles[col.index];
    if (singleRoles.includes(r)) {
      if (seenSingles.has(r)) {
        preliminaryRoles[col.index] = 'needs_selection';
      } else {
        seenSingles.add(r);
      }
    }
    col.autoDetectedRole = preliminaryRoles[col.index];
  }

  return { descriptors: rawDescriptors, roleMap: preliminaryRoles };
}

export function autoDetectVneduHeaderAndMapping(
  matrix: string[][],
  explicitHeaderRowIndex?: number,
  mergeParentHeaderRow = true,
  merges: VneduMergeSpan[] = []
): {
  headerRowIndex: number;
  hasMultiHeaderHint: boolean;
  columns: VneduColumnDescriptor[];
  dataRows: string[][];
  roleMap: Record<number, VneduColumnRole>;
} {
  if (matrix.length === 0) {
    return {
      headerRowIndex: -1,
      hasMultiHeaderHint: false,
      columns: [],
      dataRows: [],
      roleMap: {},
    };
  }

  let bestIdx = 0;
  let hasMultiHeaderHint = false;

  if (
    explicitHeaderRowIndex !== undefined &&
    explicitHeaderRowIndex >= 0 &&
    explicitHeaderRowIndex < matrix.length
  ) {
    bestIdx = explicitHeaderRowIndex;
  } else {
    let bestScore = -1;
    const scanLimit = Math.min(matrix.length, 20);
    for (let i = 0; i < scanLimit; i++) {
      const row = matrix[i];
      let score = 0;
      let hasSplitLast = false;
      let hasSplitFirst = false;
      let hasFull = false;
      let hasCode = false;

      row.forEach((cell) => {
        const cls = classifyHeaderTextToRole(cell);
        if (!cls) return;
        if (cls === 'lastName') {
          hasSplitLast = true;
          score += 6;
        } else if (cls === 'firstName') {
          hasSplitFirst = true;
          score += 6;
        } else if (cls === 'fullName') {
          hasFull = true;
          score += 4;
        } else if (cls === 'code') {
          hasCode = true;
          score += 3;
        } else {
          score += 2;
        }
      });

      if (hasSplitLast && hasSplitFirst) score += 8;
      if ((hasFull || (hasSplitLast && hasSplitFirst) || hasCode) && score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    // Check if the row immediately below bestIdx is a 2nd header row (e.g. Row 6-7 in vnEdu!)
    if (
      bestIdx + 1 < matrix.length &&
      isLikelySubHeaderRow(matrix[bestIdx + 1], bestIdx + 1, bestIdx, merges)
    ) {
      bestIdx = bestIdx + 1;
      hasMultiHeaderHint = true;
    }
  }

  if (bestIdx > 0 && !hasMultiHeaderHint) {
    const prevCells = matrix[bestIdx - 1] || [];
    if (prevCells.some((c) => classifyHeaderTextToRole(c) !== null)) {
      hasMultiHeaderHint = true;
    }
  }

  const { descriptors, roleMap } = buildVneduColumnDescriptors(
    matrix,
    bestIdx,
    mergeParentHeaderRow,
    merges
  );
  const dataRows = sliceStudentTableRows(matrix, bestIdx);

  return {
    headerRowIndex: bestIdx,
    hasMultiHeaderHint,
    columns: descriptors,
    dataRows,
    roleMap,
  };
}

function parseVneduScoreOrEvalCell(
  raw: string,
  colLabel: string,
  assessmentMode: VneduAssessmentMode
): { value: number | null; qualitative: string; error?: string } {
  const trimmed = (raw || '').normalize('NFC').trim();
  if (trimmed === '' || trimmed === '-' || trimmed === '—') {
    return { value: null, qualitative: '' };
  }

  const qNorm = stripVietnameseAccents(trimmed);
  const qualMapped = QUALITATIVE_ALIASES[qNorm];

  if (assessmentMode === 'comment') {
    return { value: null, qualitative: qualMapped || trimmed };
  }

  // Check if numeric
  const normalizedNum = trimmed.replace(/\s+/g, '').replace(',', '.');
  if (/^-?\d+(\.\d+)?$/.test(normalizedNum)) {
    const num = Number(normalizedNum);
    if (!Number.isFinite(num)) {
      return {
        value: null,
        qualitative: '',
        error: `Cột ${colLabel} không đọc được thành số ("${trimmed}")`,
      };
    }
    if (num < 0 || num > 10) {
      return {
        value: num,
        qualitative: '',
        error: `Cột ${colLabel} ngoài thang 0–10 (${trimmed})`,
      };
    }
    return { value: num, qualitative: '' };
  }

  // Allow Đạt / Chưa đạt in auto mode without coercing to a number!
  if (assessmentMode === 'auto' && qualMapped) {
    return { value: null, qualitative: qualMapped };
  }

  return {
    value: null,
    qualitative: '',
    error: `Cột ${colLabel} có giá trị không phải điểm hợp lệ ("${trimmed}")`,
  };
}

function isLikelyFooterOrBannerRow(row: string[], codeIdx: number, sttIdx: number): boolean {
  const code = codeIdx >= 0 ? (row[codeIdx] || '').trim() : '';
  const stt = sttIdx >= 0 ? (row[sttIdx] || '').trim() : '';
  const firstCols = stripVietnameseAccents(
    [stt, code, row[0] || '', row[1] || '', row[2] || ''].join(' ')
  );

  if (
    !code &&
    (firstCols.includes('giao vien') ||
      firstCols.includes('hieu truong') ||
      firstCols.includes('ky ten') ||
      firstCols.includes('tong cong') ||
      firstCols.includes('tong ket') ||
      firstCols.includes('si so') ||
      firstCols.includes('ngay ') ||
      firstCols.includes('thang ') ||
      firstCols.includes('nam '))
  ) {
    return true;
  }
  return false;
}

export function analyzeColumnRoleConflicts(
  roleMap: Record<number, VneduColumnRole>,
  columns: VneduColumnDescriptor[]
): {
  conflicts: string[];
  unclassified: VneduColumnDescriptor[];
  txOrders: number[];
} {
  const conflicts: string[] = [];
  const unclassified: VneduColumnDescriptor[] = [];
  const roleOwners = new Map<VneduColumnRole, VneduColumnDescriptor[]>();

  columns.forEach((col) => {
    const role = roleMap[col.index] || 'ignore';
    if (role === 'ignore') return;
    if (role === 'needs_selection') {
      unclassified.push(col);
      return;
    }
    const arr = roleOwners.get(role) || [];
    arr.push(col);
    roleOwners.set(role, arr);
  });

  roleOwners.forEach((cols, role) => {
    if (cols.length > 1) {
      const colNames = cols.map((c) => `${c.colLetter} (${c.mergedLabel})`).join(', ');
      conflicts.push(
        `Có ${cols.length} cột cùng được ánh xạ vào "${getRoleDisplayLabel(role)}": ${colNames}.`
      );
    }
  });

  const hasFull = (roleOwners.get('fullName')?.length || 0) > 0;
  const hasSplit =
    (roleOwners.get('lastName')?.length || 0) > 0 ||
    (roleOwners.get('firstName')?.length || 0) > 0;
  if (hasFull && hasSplit) {
    conflicts.push(
      'Đang ánh xạ đồng thời cả "Họ và tên đầy đủ" lẫn "Họ và đệm / Tên" — chỉ được chọn 1 kiểu ghép họ tên.'
    );
  }

  const txOrders = Array.from(roleOwners.keys())
    .map((r) => getTxOrderFromRole(r))
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);

  return { conflicts, unclassified, txOrders };
}

export function buildParsedVneduRows(
  dataRows: string[][],
  roleMap: Record<number, VneduColumnRole>,
  columns: VneduColumnDescriptor[],
  headerRowIndex: number,
  assessmentMode: VneduAssessmentMode = 'auto'
): ParsedVneduScoreRow[] {
  const parsed: ParsedVneduScoreRow[] = [];
  const labelOf = (idx: number) =>
    columns.find((c) => c.index === idx)?.mergedLabel || `Cột ${idx + 1}`;
  const getCell = (row: string[], idx: number) =>
    idx >= 0 && idx < row.length ? (row[idx] || '').normalize('NFC').trim() : '';

  const findFirstIndex = (target: VneduColumnRole): number => {
    for (const col of columns) {
      if (roleMap[col.index] === target) return col.index;
    }
    return -1;
  };

  const sttIdx = findFirstIndex('stt');
  const codeIdx = findFirstIndex('code');
  const lastNameIdx = findFirstIndex('lastName');
  const firstNameIdx = findFirstIndex('firstName');
  const fullNameIdx = findFirstIndex('fullName');
  const dobIdx = findFirstIndex('dob');
  const gkIdx = findFirstIndex('gk');
  const ckIdx = findFirstIndex('ck');
  const avgHkIdx = findFirstIndex('avg_hk');
  const avgCnIdx = findFirstIndex('avg_cn');
  const noteIdx = findFirstIndex('note');

  const txCols: { order: number; colIdx: number }[] = [];
  columns.forEach((c) => {
    const ord = getTxOrderFromRole(roleMap[c.index] || 'ignore');
    if (ord !== null) txCols.push({ order: ord, colIdx: c.index });
  });
  txCols.sort((a, b) => a.order - b.order);

  const nameIndices = [lastNameIdx, firstNameIdx, fullNameIdx].filter((i) => i >= 0);

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (row.every((c) => (c || '').trim() === '')) continue;
    if (isStatisticsOrFooterSectionStart(row)) break;
    if (isNonStudentSummaryRow(row, codeIdx, sttIdx, nameIndices, dobIdx)) {
      if (parsed.length > 0) break;
      continue;
    }

    const stt = getCell(row, sttIdx);
    const vneduCode = getCell(row, codeIdx).replace(/\s+/g, '');
    const lastNamePart = getCell(row, lastNameIdx).replace(/\s+/g, ' ');
    const firstNamePart = getCell(row, firstNameIdx).replace(/\s+/g, ' ');
    const singleFullNamePart = getCell(row, fullNameIdx).replace(/\s+/g, ' ');
    const dobRaw = getCell(row, dobIdx);
    const dob = formatDobToDmy(dobRaw);

    const nameErrors: string[] = [];
    let resolvedFullName = '';

    const hasSplitMapping = lastNameIdx >= 0 || firstNameIdx >= 0;
    const hasSingleMapping = fullNameIdx >= 0;

    if (hasSplitMapping && hasSingleMapping) {
      resolvedFullName = [lastNamePart, firstNamePart]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!resolvedFullName && singleFullNamePart) {
        resolvedFullName = singleFullNamePart;
      }
      nameErrors.push('Đang chọn cả "Họ và tên đầy đủ" và "Họ và đệm / Tên"');
    } else if (hasSplitMapping) {
      resolvedFullName = [lastNamePart, firstNamePart]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    } else if (hasSingleMapping) {
      resolvedFullName = singleFullNamePart;
    }

    if (!vneduCode && !resolvedFullName) continue;

    const scoreErrors: string[] = [];
    const qualitativeValues: string[] = [];

    const readCell = (
      colIdx: number,
      fallbackLabel: string
    ): { value: number | null; qualitative: string } => {
      if (colIdx < 0) return { value: null, qualitative: '' };
      const res = parseVneduScoreOrEvalCell(
        getCell(row, colIdx),
        labelOf(colIdx) || fallbackLabel,
        assessmentMode
      );
      if (res.error) scoreErrors.push(res.error);
      if (res.qualitative) qualitativeValues.push(`${fallbackLabel}: ${res.qualitative}`);
      return { value: res.value, qualitative: res.qualitative };
    };

    const txValues: Record<number, { value: number | null; qualitative: string }> = {};
    txCols.forEach(({ order, colIdx }) => {
      txValues[order] = readCell(colIdx, `TX${order}`);
    });

    const gk = readCell(gkIdx, 'GK');
    const ck = readCell(ckIdx, 'CK');
    const avgHk = readCell(avgHkIdx, 'ĐTB HK');
    const avgCn = readCell(avgCnIdx, 'ĐTB CN');
    const note = getCell(row, noteIdx);

    parsed.push({
      rowIndex: i,
      excelRowNumber: (headerRowIndex >= 0 ? headerRowIndex + 1 : 0) + i + 1,
      stt,
      vneduCode,
      lastNamePart,
      firstNamePart,
      singleFullNamePart,
      resolvedFullName,
      dob,
      txValues,
      gk,
      ck,
      avgHk,
      avgCn,
      note,
      qualitativeValues,
      scoreErrors,
      nameErrors,
    });
  }

  return parsed;
}

const META_TAG_REGEX = /^\[ĐG_MỞ_RỘNG:\s*([^\]]+)\]\s*/;
const LEGACY_EXTRA_TX_TAG_REGEX = /^\[ĐGTX thêm:\s*([^\]]+)\]\s*/;

export interface ParsedStoredScoreMeta {
  tx3: number | null;
  tx4: number | null;
  txMap: Record<number, number>;
  extraPairs: { label: string; value: number }[];
  qualitativeBadge: string;
  avgCn: number | null;
  cleanNote: string;
}

export function extractExtraTxFromNote(note?: string): ParsedStoredScoreMeta {
  const raw = note || '';
  const txMap: Record<number, number> = {};
  const extraPairs: { label: string; value: number }[] = [];
  let qualitativeBadge = '';
  let avgCn: number | null = null;
  let cleanNote = raw;

  const modernMatch = raw.match(META_TAG_REGEX);
  const legacyMatch = raw.match(LEGACY_EXTRA_TX_TAG_REGEX);
  const tagMatch = modernMatch || legacyMatch;

  if (tagMatch) {
    cleanNote = raw.replace(modernMatch ? META_TAG_REGEX : LEGACY_EXTRA_TX_TAG_REGEX, '').trim();
    tagMatch[1].split(',').forEach((segment) => {
      const eqIdx = segment.indexOf('=');
      if (eqIdx === -1) return;
      const k = segment.slice(0, eqIdx).trim();
      const vStr = segment.slice(eqIdx + 1).trim();
      const kUpper = k.toUpperCase();

      if (kUpper === 'DG' || kUpper === 'ĐG') {
        qualitativeBadge = vStr;
        return;
      }
      if (kUpper === 'DTBCN' || kUpper === 'ĐTBCN') {
        const n = Number(vStr);
        if (Number.isFinite(n)) avgCn = n;
        return;
      }

      const txMatch = kUpper.match(/^TX(\d{1,2})$/);
      const numVal = Number(vStr);
      if (txMatch && Number.isFinite(numVal)) {
        const ord = Number(txMatch[1]);
        txMap[ord] = numVal;
        if (ord >= 5) {
          extraPairs.push({ label: `TX${ord}`, value: numVal });
        }
      } else if (Number.isFinite(numVal)) {
        extraPairs.push({ label: k, value: numVal });
      }
    });
  }

  return {
    tx3: txMap[3] ?? null,
    tx4: txMap[4] ?? null,
    txMap,
    extraPairs,
    qualitativeBadge,
    avgCn,
    cleanNote,
  };
}

export function formatScoreNoteWithMeta(params: {
  txMap: Record<number, number>;
  qualitativeBadge?: string;
  avgCn?: number | null;
  cleanNote: string;
}): string {
  const parts: string[] = [];
  const extraOrders = Object.keys(params.txMap)
    .map(Number)
    .filter((o) => Number.isInteger(o) && o >= 3)
    .sort((a, b) => a - b);

  extraOrders.forEach((ord) => {
    const val = params.txMap[ord];
    if (val !== undefined && val !== null && Number.isFinite(val)) {
      parts.push(`TX${ord}=${val}`);
    }
  });

  if (params.avgCn !== undefined && params.avgCn !== null && Number.isFinite(params.avgCn)) {
    parts.push(`ĐTBCN=${params.avgCn}`);
  }

  if (params.qualitativeBadge && params.qualitativeBadge.trim()) {
    const safeQual = params.qualitativeBadge.replace(/[,\]]/g, ';').trim();
    parts.push(`ĐG=${safeQual}`);
  }

  const sanitizedClean = (params.cleanNote || '')
    .replace(META_TAG_REGEX, '')
    .replace(LEGACY_EXTRA_TX_TAG_REGEX, '')
    .trim();

  if (parts.length === 0) return sanitizedClean.slice(0, 500);
  const tag = `[ĐG_MỞ_RỘNG: ${parts.join(', ')}]`;
  return (sanitizedClean ? `${tag} ${sanitizedClean}` : tag).slice(0, 500);
}

// Legacy compatibility wrapper
export function formatScoreNoteWithExtraTx(
  tx3: number | null,
  tx4: number | null,
  extraTx: { label: string; value: number }[],
  rawNote: string
): string {
  const txMap: Record<number, number> = {};
  if (tx3 !== null) txMap[3] = tx3;
  if (tx4 !== null) txMap[4] = tx4;
  extraTx.forEach((item, idx) => {
    const m = item.label.toUpperCase().match(/TX(\d+)/);
    const ord = m ? Number(m[1]) : 5 + idx;
    txMap[ord] = item.value;
  });
  return formatScoreNoteWithMeta({ txMap, cleanNote: rawNote });
}

function fmtScoreVal(val: number | null | undefined, qual?: string): string {
  if (qual) return qual;
  return val === null || val === undefined ? 'Trống' : String(val);
}

function computeMergedScoreAndDiffs(
  row: ParsedVneduScoreRow,
  existingScore: SubjectScoreRecord | null,
  roleMap: Record<number, VneduColumnRole>,
  semester: VneduSemester,
  preserveExistingWhenBlank: boolean
): { mergedPayload: MergedSubjectScorePayload; scoreDiffs: VneduScoreDiff[] } {
  const activeRoles = new Set(Object.values(roleMap));
  const mappedTxOrders = Array.from(activeRoles)
    .map((r) => getTxOrderFromRole(r))
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);

  const existingMeta = existingScore ? extractExtraTxFromNote(existingScore.note) : null;
  const oldTxMap: Record<number, number | null> = {};
  if (existingScore) {
    if (existingScore.tx1 !== null && existingScore.tx1 !== undefined) oldTxMap[1] = existingScore.tx1;
    if (existingScore.tx2 !== null && existingScore.tx2 !== undefined) oldTxMap[2] = existingScore.tx2;
    if (existingMeta) {
      Object.entries(existingMeta.txMap).forEach(([k, v]) => {
        oldTxMap[Number(k)] = v;
      });
    }
  }

  const diffs: VneduScoreDiff[] = [];
  const nextTxMap: Record<number, number> = {};

  // All TX orders present in either existing saved data or newly mapped file
  const allTxOrders = Array.from(
    new Set([...Object.keys(oldTxMap).map(Number), ...mappedTxOrders])
  ).sort((a, b) => a - b);

  for (const ord of allTxOrders) {
    const oldVal = oldTxMap[ord] ?? null;
    const isMappedInFile = mappedTxOrders.includes(ord);
    const newCell = row.txValues[ord];

    let finalVal: number | null = oldVal;
    if (isMappedInFile) {
      if (newCell && newCell.value !== null) {
        finalVal = newCell.value;
      } else if (!preserveExistingWhenBlank && (!newCell || !newCell.qualitative)) {
        finalVal = null;
      }
    }

    if (finalVal !== null) {
      nextTxMap[ord] = finalVal;
    }

    if (isMappedInFile && oldVal !== finalVal) {
      if (finalVal !== null || !preserveExistingWhenBlank) {
        diffs.push({
          field: `tx${ord}`,
          label: `TX${ord}`,
          kind: oldVal === null ? 'added' : 'updated',
          oldValue: fmtScoreVal(oldVal),
          newValue: fmtScoreVal(finalVal),
        });
      }
    }
  }

  const mergeSingleNum = (
    fieldKey: string,
    label: string,
    isMapped: boolean,
    oldVal: number | null,
    newCell: { value: number | null; qualitative: string }
  ): number | null => {
    let finalVal = oldVal;
    if (isMapped) {
      if (newCell.value !== null) {
        finalVal = newCell.value;
      } else if (!preserveExistingWhenBlank && !newCell.qualitative) {
        finalVal = null;
      }
    }
    if (isMapped && oldVal !== finalVal && (finalVal !== null || !preserveExistingWhenBlank)) {
      diffs.push({
        field: fieldKey,
        label,
        kind: oldVal === null ? 'added' : 'updated',
        oldValue: fmtScoreVal(oldVal),
        newValue: fmtScoreVal(finalVal),
      });
    }
    return finalVal;
  };

  const finalGk = mergeSingleNum(
    'gk',
    'GK',
    activeRoles.has('gk'),
    existingScore?.gk ?? null,
    row.gk
  );
  const finalCk = mergeSingleNum(
    'ck',
    'CK',
    activeRoles.has('ck'),
    existingScore?.ck ?? null,
    row.ck
  );

  // Avg selection based on semester or available ĐTB HK / ĐTB CN
  const preferCn = semester === 'Cả năm' && activeRoles.has('avg_cn');
  const mainAvgCell = preferCn ? row.avgCn : activeRoles.has('avg_hk') ? row.avgHk : row.avgCn;
  const isMainAvgMapped = preferCn
    ? activeRoles.has('avg_cn')
    : activeRoles.has('avg_hk') || activeRoles.has('avg_cn');

  const finalAvg = mergeSingleNum(
    'avg',
    preferCn ? 'ĐTB CN' : 'ĐTB HK',
    isMainAvgMapped,
    existingScore?.avg ?? null,
    mainAvgCell
  );

  let finalAvgCn = existingMeta?.avgCn ?? null;
  if (activeRoles.has('avg_cn') && semester !== 'Cả năm') {
    finalAvgCn = mergeSingleNum(
      'avg_cn',
      'ĐTB CN',
      true,
      existingMeta?.avgCn ?? null,
      row.avgCn
    );
  }

  // Qualitative badge merge
  const newQual = row.qualitativeValues.join('; ');
  let finalQual = existingMeta?.qualitativeBadge || '';
  if (newQual) {
    finalQual = newQual;
  } else if (!preserveExistingWhenBlank && row.qualitativeValues.length === 0) {
    // Keep existing qualitative badge unless explicitly overwritten
  }
  if (newQual && newQual !== (existingMeta?.qualitativeBadge || '')) {
    diffs.push({
      field: 'qual',
      label: 'Đánh giá',
      kind: existingMeta?.qualitativeBadge ? 'updated' : 'added',
      oldValue: existingMeta?.qualitativeBadge || 'Trống',
      newValue: newQual,
    });
  }

  // Note merge
  const oldCleanNote = existingMeta?.cleanNote || '';
  let finalCleanNote = oldCleanNote;
  if (activeRoles.has('note')) {
    if (row.note) {
      finalCleanNote = row.note;
    } else if (!preserveExistingWhenBlank) {
      finalCleanNote = '';
    }
    if (finalCleanNote !== oldCleanNote) {
      diffs.push({
        field: 'note',
        label: 'Nhận xét',
        kind: oldCleanNote ? 'updated' : 'added',
        oldValue: oldCleanNote || 'Trống',
        newValue: finalCleanNote || 'Trống',
      });
    }
  }

  const compiledNote = formatScoreNoteWithMeta({
    txMap: nextTxMap,
    qualitativeBadge: finalQual,
    avgCn: finalAvgCn,
    cleanNote: finalCleanNote,
  });

  return {
    mergedPayload: {
      tx1: nextTxMap[1] ?? null,
      tx2: nextTxMap[2] ?? null,
      gk: finalGk,
      ck: finalCk,
      avg: finalAvg,
      txMap: nextTxMap,
      qualitativeBadge: finalQual,
      cleanNote: finalCleanNote,
      compiledNote,
    },
    scoreDiffs: diffs,
  };
}

export function extractVerifiedLinkEntry(
  entry: string | VneduVerifiedLink | undefined
): { studentId: string; savedStudentName: string } | null {
  if (!entry) return null;
  if (typeof entry === 'string') {
    const trimmed = entry.trim();
    return trimmed ? { studentId: trimmed, savedStudentName: '' } : null;
  }
  if (entry.studentId && entry.studentId.trim()) {
    return {
      studentId: entry.studentId.trim(),
      savedStudentName: (entry.studentName || '').trim(),
    };
  }
  return null;
}

export function reconcileVneduRows(
  rows: ParsedVneduScoreRow[],
  students: StudentRecord[],
  subjectScores: Record<string, SubjectScoreRecord>,
  subjectSlug: string,
  semester: VneduSemester,
  columns: VneduColumnDescriptor[],
  roleMap: Record<number, VneduColumnRole>,
  options: {
    confirmedIdLinks: VneduVerifiedLinkStore;
    codeSystemVerifiedSameAsMoet: boolean;
    autoConfirmExactNameAndDob: boolean;
    preserveExistingWhenBlank: boolean;
    resolutions: Record<number, VneduRowResolution>;
  }
): VneduImportAnalysis {
  const globalErrors: string[] = [];
  const globalWarnings: string[] = [];

  if (students.length === 0) {
    globalErrors.push(
      'Chưa tải được danh sách học sinh thực tế của lớp. Vui lòng kiểm tra mục Hồ sơ học sinh hoặc tải lại dữ liệu trước khi đối chiếu.'
    );
  }

  const roleAnalysis = analyzeColumnRoleConflicts(roleMap, columns);
  if (roleAnalysis.conflicts.length > 0) {
    globalErrors.push(...roleAnalysis.conflicts);
  }
  if (roleAnalysis.unclassified.length > 0) {
    globalWarnings.push(
      `Có ${roleAnalysis.unclassified.length} cột chưa xác định loại điểm (${roleAnalysis.unclassified
        .map((c) => `${c.colLetter}: ${c.mergedLabel}`)
        .join(', ')}) — cần GVCN chọn loại điểm hoặc chọn "Bỏ qua".`
    );
  }

  const studentById = new Map<string, StudentRecord>();
  const studentByMoet = new Map<string, StudentRecord>();
  const studentsByNormName = new Map<string, StudentRecord[]>();

  for (const st of students) {
    studentById.set(st.id, st);
    studentById.set(st.code, st);
    const moet = (st.moetCode || (/^\d{10}$/.test(st.code) ? st.code : '')).trim().toUpperCase();
    if (moet) {
      studentByMoet.set(moet, st);
    }
    const nKey = normalizeNameForCompare(st.fullName);
    if (nKey) {
      const arr = studentsByNormName.get(nKey) || [];
      arr.push(st);
      studentsByNormName.set(nKey, arr);
    }
  }

  // Detect duplicate vnEdu codes OR duplicate fullNames inside the uploaded file
  const vneduCodeCounts = new Map<string, number>();
  const fileNormNameCounts = new Map<string, number>();
  for (const r of rows) {
    if (r.vneduCode) {
      const k = r.vneduCode.toUpperCase();
      vneduCodeCounts.set(k, (vneduCodeCounts.get(k) || 0) + 1);
    }
    const nKey = normalizeNameForCompare(r.resolvedFullName);
    if (nKey) {
      fileNormNameCounts.set(nKey, (fileNormNameCounts.get(nKey) || 0) + 1);
    }
  }

  const dupCodes: string[] = [];
  vneduCodeCounts.forEach((cnt, code) => {
    if (cnt > 1) dupCodes.push(`${code} (${cnt} dòng)`);
  });
  if (dupCodes.length > 0) {
    globalErrors.push(`Phát hiện Mã học sinh vnEdu bị trùng trong bảng điểm: ${dupCodes.join(', ')}.`);
  }

  let moetOverlapCount = 0;
  let moetConflictCount = 0;
  let autoNameDobCandidateCount = 0;
  let autoUniqueNameCandidateCount = 0;
  let dobMismatchCount = 0;
  let duplicateNameCount = 0;

  const preliminary = rows.map((row) => {
    const resolution = options.resolutions[row.excelRowNumber] || { type: 'auto' };
    const vneduCodeUpper = row.vneduCode.toUpperCase();
    const rowNormName = normalizeNameForCompare(row.resolvedFullName);
    const rowDobDmy = formatDobToDmy(row.dob);

    let status: VneduMatchStatus = 'not_found';
    let statusReason = '';
    let matchedStudent: StudentRecord | null = null;
    let candidates: StudentRecord[] = [];
    let recommendedCandidate: StudentRecord | null = null;
    let isSameMoetCandidate = false;
    let isDuplicateNameInClass = false;
    let dobComparison: VneduDobComparison | null = null;

    const nameCandidatesAll = rowNormName ? studentsByNormName.get(rowNormName) || [] : [];
    if (nameCandidatesAll.length > 1) {
      isDuplicateNameInClass = true;
    }

    const hasInvalidData = row.scoreErrors.length > 0 || row.nameErrors.length > 0;
    const isDuplicateVneduCode = Boolean(
      vneduCodeUpper && (vneduCodeCounts.get(vneduCodeUpper) || 0) > 1
    );

    if (hasInvalidData || isDuplicateVneduCode) {
      status = 'duplicate_or_invalid';
      statusReason = [
        isDuplicateVneduCode ? `Trùng Mã HS vnEdu (${row.vneduCode})` : '',
        ...row.nameErrors,
        ...row.scoreErrors,
      ]
        .filter(Boolean)
        .join('; ');
    } else if (!row.vneduCode && !row.resolvedFullName) {
      status = 'duplicate_or_invalid';
      statusReason = 'Thiếu cả Mã học sinh và Họ tên';
    } else if (resolution.type === 'skip') {
      status = 'not_found';
      statusReason = 'GVCN đã chọn bỏ qua dòng này';
    } else if (resolution.type === 'confirm') {
      const explicitTarget = studentById.get(resolution.studentId) || null;
      if (explicitTarget) {
        matchedStudent = explicitTarget;
        dobComparison = analyzeDobComparison(rowDobDmy, explicitTarget.dob || '');
        status = 'matched_by_gvcn';
        if (resolution.source === 'dob_mismatch_batch') {
          statusReason = 'GVCN đã xác nhận theo nhóm (tên duy nhất, khác ngày sinh)';
        } else if (resolution.source === 'auto_batch') {
          statusReason = 'Đối chiếu tự động đề xuất — GVCN kiểm tra lại';
        } else {
          statusReason = 'GVCN đã xác nhận';
        }
      } else {
        status = 'not_found';
        statusReason = 'Hồ sơ được chọn không còn trong danh sách lớp';
      }
    } else {
      // 1. Priority 1: Confirmed vnEduCode -> internal studentId link table
      const linkEntry = vneduCodeUpper
        ? extractVerifiedLinkEntry(options.confirmedIdLinks[vneduCodeUpper])
        : null;
      const linkedStudent = linkEntry ? studentById.get(linkEntry.studentId) || null : null;

      if (linkEntry && !linkedStudent) {
        // Linked profile was removed/changed -> require GVCN verification!
        status = 'needs_verification';
        statusReason = `Mã vnEdu ${row.vneduCode} từng liên kết với hồ sơ không còn trong lớp — cần GVCN kiểm tra lại`;
        candidates = nameCandidatesAll;
      } else if (linkedStudent) {
        const profileNameDrifted =
          Boolean(linkEntry?.savedStudentName) &&
          normalizeNameForCompare(linkEntry!.savedStudentName) !==
            normalizeNameForCompare(linkedStudent.fullName);
        const fileNameConflict =
          Boolean(rowNormName) &&
          normalizeNameForCompare(linkedStudent.fullName) !== rowNormName;

        dobComparison = analyzeDobComparison(rowDobDmy, linkedStudent.dob || '');

        if (fileNameConflict || profileNameDrifted) {
          candidates = [linkedStudent, ...nameCandidatesAll.filter((c) => c.id !== linkedStudent.id)];
          recommendedCandidate = linkedStudent;
          status = 'needs_verification';
          statusReason = fileNameConflict
            ? `Xung đột liên kết: Mã vnEdu đã gắn với "${linkedStudent.fullName}" nhưng file ghi "${row.resolvedFullName}"`
            : `Hồ sơ "${linkedStudent.fullName}" có thay đổi tên so với lúc liên kết trước ("${linkEntry?.savedStudentName}") — cần kiểm tra lại`;
        } else {
          matchedStudent = linkedStudent;
          status = 'matched_by_code';
          statusReason = 'Tự động khớp theo mã vnEdu đã xác minh';
        }
      } else {
        // 2. Check MOET code overlap (when vnEdu code equals 10-digit MOET code)
        const moetCandidate = vneduCodeUpper ? studentByMoet.get(vneduCodeUpper) || null : null;
        if (moetCandidate) {
          const nameMatches =
            !rowNormName || normalizeNameForCompare(moetCandidate.fullName) === rowNormName;
          dobComparison = analyzeDobComparison(rowDobDmy, moetCandidate.dob || '');

          if (nameMatches) {
            moetOverlapCount++;
            isSameMoetCandidate = true;
            recommendedCandidate = moetCandidate;
            if (options.codeSystemVerifiedSameAsMoet) {
              matchedStudent = moetCandidate;
              status = 'matched_by_code';
              statusReason = 'Khớp trực tiếp theo Mã MOET đã xác minh cùng hệ mã';
            } else if (dobComparison.kind === 'exact' && (fileNormNameCounts.get(rowNormName) || 0) === 1 && !isDuplicateNameInClass) {
              // Exact Name + Exact DOB + Unique -> auto-match cleanly!
              autoNameDobCandidateCount++;
              matchedStudent = moetCandidate;
              status = 'matched_auto';
              statusReason = `Tự động khớp chính xác Họ tên + Ngày sinh (${dobComparison.rosterDob})`;
            } else {
              candidates = [moetCandidate];
              status = 'needs_verification';
              statusReason = 'Mã HS trùng Mã MOET — Cần xác nhận dùng chung hệ mã MOET';
            }
          } else {
            moetConflictCount++;
            candidates = [moetCandidate];
            status = 'needs_verification';
            statusReason = `Mã HS trùng Mã MOET của "${moetCandidate.fullName}" nhưng họ tên file là "${row.resolvedFullName}"`;
          }
        } else {
          // 3. Fallback: Name + DOB matching (NEVER by STT, NEVER auto-link duplicate names!)
          if (nameCandidatesAll.length === 0) {
            status = 'not_found';
            statusReason = row.vneduCode
              ? `Không tìm thấy mã "${row.vneduCode}" hoặc họ tên "${row.resolvedFullName}" trong lớp`
              : `Không tìm thấy học sinh "${row.resolvedFullName}" trong lớp`;
          } else if (nameCandidatesAll.length === 1) {
            const single = nameCandidatesAll[0];
            const isUniqueInFile = (fileNormNameCounts.get(rowNormName) || 0) === 1;
            candidates = [single];
            recommendedCandidate = single;
            dobComparison = analyzeDobComparison(rowDobDmy, single.dob || '');

            if (dobComparison.kind === 'exact' && isUniqueInFile) {
              autoNameDobCandidateCount++;
              if (options.autoConfirmExactNameAndDob) {
                matchedStudent = single;
                status = 'matched_auto';
                statusReason = `Tự động khớp duy nhất Họ tên + Ngày sinh (${dobComparison.rosterDob})`;
              } else {
                status = 'needs_verification';
                statusReason = `Đề xuất: "${single.fullName}" (khớp duy nhất Họ tên + Ngày sinh ${dobComparison.rosterDob})`;
              }
            } else if (
              (dobComparison.kind === 'swapped_day_month' || dobComparison.kind === 'different') &&
              isUniqueInFile
            ) {
              dobMismatchCount++;
              status = 'name_match_dob_mismatch';
              statusReason =
                dobComparison.kind === 'swapped_day_month'
                  ? `Tên khớp – cần xác minh ngày sinh (nghi đảo ngày/tháng: File ${dobComparison.fileDob} ↔ Lớp ${dobComparison.rosterDob})`
                  : `Tên khớp – cần xác minh ngày sinh (File ${dobComparison.fileDob} ↔ Lớp ${dobComparison.rosterDob})`;
            } else if (!isUniqueInFile) {
              duplicateNameCount++;
              recommendedCandidate = null;
              status = 'needs_verification';
              statusReason = `Có nhiều dòng cùng tên "${row.resolvedFullName}" trong file — cần GVCN kiểm tra thủ công`;
            } else {
              autoUniqueNameCandidateCount++;
              status = 'needs_verification';
              statusReason = `Đề xuất: "${single.fullName}" (Tổ ${single.team}) — Khớp họ tên duy nhất, thiếu Ngày sinh để xác minh tự động`;
            }
          } else {
            // Duplicate fullName in class! NEVER auto-link.
            duplicateNameCount++;
            const dobMatched = rowDobDmy
              ? nameCandidatesAll.filter((c) => formatDobToDmy(c.dob) === rowDobDmy)
              : [];
            candidates = nameCandidatesAll;
            recommendedCandidate = dobMatched.length === 1 ? dobMatched[0] : null;
            if (recommendedCandidate) {
              dobComparison = analyzeDobComparison(rowDobDmy, recommendedCandidate.dob || '');
            }
            status = 'needs_verification';
            if (dobMatched.length === 1) {
              statusReason = `Lớp có ${nameCandidatesAll.length} HS trùng tên "${row.resolvedFullName}" — Gợi ý theo Ngày sinh ${rowDobDmy}, bắt buộc GVCN chọn đúng hồ sơ`;
            } else {
              statusReason = `Lớp có ${nameCandidatesAll.length} HS trùng tên "${row.resolvedFullName}" — Bắt buộc GVCN phân biệt theo Mã MOET / Ngày sinh`;
            }
          }
        }
      }
    }

    return {
      row,
      resolution,
      status,
      statusReason,
      matchedStudent,
      candidates,
      recommendedCandidate,
      isSameMoetCandidate,
      isDuplicateNameInClass,
      dobComparison,
    };
  });

  // Catch multiple rows targeting the same studentId in a single import!
  const targetCounts = new Map<string, number>();
  preliminary.forEach((p) => {
    if (p.matchedStudent) {
      targetCounts.set(p.matchedStudent.id, (targetCounts.get(p.matchedStudent.id) || 0) + 1);
    }
  });
  const dupTargetNames: string[] = [];
  targetCounts.forEach((cnt, sid) => {
    if (cnt > 1) {
      const st = studentById.get(sid);
      dupTargetNames.push(`${st?.fullName || sid} (${cnt} dòng)`);
    }
  });
  if (dupTargetNames.length > 0) {
    globalErrors.push(
      `Không được liên kết nhiều dòng điểm với cùng 1 học sinh: ${dupTargetNames.join(', ')}.`
    );
  }

  const hasFatalMappingIssue =
    roleAnalysis.conflicts.length > 0 || roleAnalysis.unclassified.length > 0;

  const activeRoles = new Set(Object.values(roleMap));
  const items: ReconciledVneduRow[] = preliminary.map((p) => {
    let { status, statusReason, matchedStudent } = p;
    if (matchedStudent && (targetCounts.get(matchedStudent.id) || 0) > 1) {
      status = 'duplicate_or_invalid';
      statusReason = `Trùng liên kết: nhiều dòng điểm cùng trỏ vào ${matchedStudent.fullName}`;
      matchedStudent = null;
    }

    let existingScore: SubjectScoreRecord | null = null;
    let mergedPayload: MergedSubjectScorePayload | null = null;
    let scoreDiffs: VneduScoreDiff[] = [];

    if (matchedStudent) {
      const docId = getVneduScoreDocId(matchedStudent.code, subjectSlug, semester);
      existingScore =
        subjectScores[docId] ||
        subjectScores[getVneduScoreDocId(matchedStudent.id, subjectSlug, semester)] ||
        null;

      const merged = computeMergedScoreAndDiffs(
        p.row,
        existingScore,
        roleMap,
        semester,
        options.preserveExistingWhenBlank
      );
      mergedPayload = merged.mergedPayload;
      scoreDiffs = merged.scoreDiffs;
    }

    const canSave =
      !hasFatalMappingIssue &&
      Boolean(matchedStudent) &&
      (status === 'matched_by_code' || status === 'matched_auto' || status === 'matched_by_gvcn') &&
      p.row.scoreErrors.length === 0 &&
      p.row.nameErrors.length === 0;

    return {
      ...p.row,
      status,
      statusReason,
      matchedStudent,
      candidates: p.candidates,
      recommendedCandidate: p.recommendedCandidate,
      resolution: p.resolution,
      isSameMoetCandidate: p.isSameMoetCandidate,
      isDuplicateNameInClass: p.isDuplicateNameInClass,
      dobComparison: p.dobComparison,
      existingScore,
      mergedPayload,
      scoreDiffs,
      hasExistingScore: Boolean(existingScore),
      canSave,
    };
  });

  if (moetConflictCount > 0) {
    globalWarnings.push(
      `Có ${moetConflictCount} dòng trùng Mã MOET nhưng khác Họ tên trong lớp — cần GVCN kiểm tra kỹ.`
    );
  }

  const readyItems = items.filter((i) => i.canSave);
  let totalNewScoreCells = 0;
  let totalUpdatedScoreCells = 0;
  readyItems.forEach((item) => {
    item.scoreDiffs.forEach((d) => {
      if (d.kind === 'added') totalNewScoreCells++;
      else totalUpdatedScoreCells++;
    });
  });

  const summary = {
    totalRows: items.length,
    matchedByCodeCount: items.filter((i) => i.status === 'matched_by_code').length,
    matchedAutoCount: items.filter((i) => i.status === 'matched_auto').length,
    matchedByGvcnCount: items.filter((i) => i.status === 'matched_by_gvcn').length,
    dobMismatchCount: items.filter((i) => i.status === 'name_match_dob_mismatch').length,
    needsVerificationCount: items.filter((i) => i.status === 'needs_verification').length,
    notFoundCount: items.filter((i) => i.status === 'not_found').length,
    duplicateOrInvalidCount: items.filter((i) => i.status === 'duplicate_or_invalid').length,
    readyToSaveCount: readyItems.length,
    changedExistingCount: readyItems.filter((i) => i.hasExistingScore && i.scoreDiffs.length > 0).length,
    newScoreCount: readyItems.filter((i) => !i.hasExistingScore).length,
    unchangedCount: readyItems.filter((i) => i.hasExistingScore && i.scoreDiffs.length === 0).length,
    totalNewScoreCells,
    totalUpdatedScoreCells,
  };

  return {
    items,
    txOrders: roleAnalysis.txOrders,
    hasGkMapped: activeRoles.has('gk'),
    hasCkMapped: activeRoles.has('ck'),
    hasAvgHkMapped: activeRoles.has('avg_hk'),
    hasAvgCnMapped: activeRoles.has('avg_cn'),
    hasNoteMapped: activeRoles.has('note'),
    moetOverlapCount,
    moetConflictCount,
    autoNameDobCandidateCount,
    autoUniqueNameCandidateCount,
    dobMismatchCount,
    duplicateNameCount,
    mappingConflicts: roleAnalysis.conflicts,
    unclassifiedColumns: roleAnalysis.unclassified,
    globalErrors,
    globalWarnings,
    summary,
  };
}

/**
 * Thực thi khi GVCN nhấn "Tự động đối chiếu":
 * Chỉ đề xuất/xác nhận các cặp 1-1 rõ ràng (liên kết mã đã xác minh, MOET khớp tên, Họ tên + Ngày sinh khớp 1-1,
 * hoặc họ tên duy nhất khi file thiếu cột ngày sinh).
 * Tuyệt đối KHÔNG tự ghép học sinh trùng tên và KHÔNG tự xác nhận các dòng lệch ngày sinh!
 */
export function buildAutoReconcileBatch(
  rows: ParsedVneduScoreRow[],
  students: StudentRecord[],
  confirmedIdLinks: VneduVerifiedLinkStore
): {
  verifySameMoet: boolean;
  confirmExactNameDob: boolean;
  resolutions: Record<number, VneduRowResolution>;
  autoMatchedCount: number;
  dobMismatchCount: number;
  duplicateNameCount: number;
  remainingManualCount: number;
} {
  const studentByMoet = new Map<string, StudentRecord>();
  const studentsByNormName = new Map<string, StudentRecord[]>();
  const studentById = new Map<string, StudentRecord>();

  students.forEach((st) => {
    studentById.set(st.id, st);
    studentById.set(st.code, st);
    const moet = (st.moetCode || (/^\d{10}$/.test(st.code) ? st.code : '')).trim().toUpperCase();
    if (moet) studentByMoet.set(moet, st);
    const k = normalizeNameForCompare(st.fullName);
    if (k) {
      const arr = studentsByNormName.get(k) || [];
      arr.push(st);
      studentsByNormName.set(k, arr);
    }
  });

  const fileNormCounts = new Map<string, number>();
  rows.forEach((r) => {
    const k = normalizeNameForCompare(r.resolvedFullName);
    if (k) fileNormCounts.set(k, (fileNormCounts.get(k) || 0) + 1);
  });

  const usedStudentIds = new Set<string>();
  const resolutions: Record<number, VneduRowResolution> = {};
  let verifySameMoet = false;
  let confirmExactNameDob = true;
  let autoMatchedCount = 0;
  let dobMismatchCount = 0;
  let duplicateNameCount = 0;

  // Pass 1: reserve already confirmed code links & MOET exact matches
  rows.forEach((r) => {
    if (r.scoreErrors.length > 0 || r.nameErrors.length > 0) return;
    const codeUpper = r.vneduCode.toUpperCase();
    const nKey = normalizeNameForCompare(r.resolvedFullName);
    const linkEntry = codeUpper ? extractVerifiedLinkEntry(confirmedIdLinks[codeUpper]) : null;
    const linkedSt = linkEntry ? studentById.get(linkEntry.studentId) : undefined;
    if (linkedSt && (!nKey || normalizeNameForCompare(linkedSt.fullName) === nKey)) {
      usedStudentIds.add(linkedSt.id);
      autoMatchedCount++;
      return;
    }
    const moetSt = codeUpper ? studentByMoet.get(codeUpper) : undefined;
    if (moetSt && (!nKey || normalizeNameForCompare(moetSt.fullName) === nKey)) {
      verifySameMoet = true;
      usedStudentIds.add(moetSt.id);
      autoMatchedCount++;
    }
  });

  // Pass 2: match unique Name+DOB or unique exact Name when DOB is absent (NEVER duplicate names or DOB mismatches!)
  rows.forEach((r) => {
    if (r.scoreErrors.length > 0 || r.nameErrors.length > 0) return;
    const codeUpper = r.vneduCode.toUpperCase();
    const nKey = normalizeNameForCompare(r.resolvedFullName);
    if (!nKey) return;

    const linkEntry = codeUpper ? extractVerifiedLinkEntry(confirmedIdLinks[codeUpper]) : null;
    if (linkEntry && studentById.get(linkEntry.studentId)) return;
    if (codeUpper && studentByMoet.get(codeUpper)) return;

    const cands = studentsByNormName.get(nKey) || [];
    if (cands.length > 1 || (fileNormCounts.get(nKey) || 0) > 1) {
      duplicateNameCount++;
      return;
    }
    if (cands.length !== 1) return;

    const single = cands[0];
    if (usedStudentIds.has(single.id)) return;

    const dobCmp = analyzeDobComparison(r.dob, single.dob || '');
    if (dobCmp.kind === 'swapped_day_month' || dobCmp.kind === 'different') {
      dobMismatchCount++;
      return; // Leave for GVCN group DOB confirmation!
    }

    if (dobCmp.kind === 'exact') {
      confirmExactNameDob = true;
      usedStudentIds.add(single.id);
      autoMatchedCount++;
      return;
    }

    // Missing DOB in file/roster, strictly 1-to-1 unique fullName in both class & file
    usedStudentIds.add(single.id);
    resolutions[r.excelRowNumber] = {
      type: 'confirm',
      studentId: single.id,
      saveLink: Boolean(r.vneduCode),
      source: 'auto_batch',
    };
    autoMatchedCount++;
  });

  return {
    verifySameMoet,
    confirmExactNameDob,
    resolutions,
    autoMatchedCount,
    dobMismatchCount,
    duplicateNameCount,
    remainingManualCount: Math.max(0, rows.length - autoMatchedCount),
  };
}
