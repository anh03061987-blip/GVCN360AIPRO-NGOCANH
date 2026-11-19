import * as XLSX from 'xlsx';
import type { StudentPiiRecord, StudentRecord } from '../types/gvcn';

export type StudentExcelColumnKey =
  | 'stt'
  | 'fullName'
  | 'gender'
  | 'dob'
  | 'parentName'
  | 'parentPhone'
  | 'moetCode'
  | 'team'
  | 'role';

export type StudentColumnMapping = Record<StudentExcelColumnKey, number>;

export type ImportReconciliationStatus =
  | 'matched'
  | 'changed'
  | 'new'
  | 'needs_verification'
  | 'missing_in_file';

export type LegacyResolutionAction =
  | { type: 'auto' }
  | { type: 'link'; existingId: string }
  | { type: 'create_new' }
  | { type: 'skip' };

export interface FieldDiff {
  field: string;
  label: string;
  oldValue: string;
  newValue: string;
}

export interface ParsedStudentRow {
  rowIndex: number;
  excelRowNumber: number;
  stt: string;
  fullName: string;
  gender: 'Nam' | 'Nữ';
  genderRaw: string;
  dob: string;
  dobRaw: string;
  parentName: string;
  parentPhone: string;
  moetCode: string;
  team: number;
  teamRaw: string;
  roleRaw: string;
  proposedRoleId: string;
  proposedRoleLabel: string;
  applyRoleProposal: boolean;
  warnings: string[];
  errors: string[];
  hasParentMissingWarning: boolean;
}

export interface ReconciledStudentImportItem extends ParsedStudentRow {
  status: Exclude<ImportReconciliationStatus, 'missing_in_file'>;
  matchedExisting: StudentRecord | null;
  legacyCandidates: StudentRecord[];
  resolution: LegacyResolutionAction;
  diffs: FieldDiff[];
  duplicateNameCount: number;
}

export interface StudentImportSummary {
  totalRows: number;
  matchedCount: number;
  changedCount: number;
  newCount: number;
  needsVerificationCount: number;
  missingInFileCount: number;
  blockingErrorCount: number;
  warningRowCount: number;
  duplicateNameCount: number;
  parentMissingWarningCount: number;
  teamCounts: Record<1 | 2 | 3 | 4, number>;
  roleProposalCount: number;
}

export interface StudentImportAnalysis {
  items: ReconciledStudentImportItem[];
  missingExistingStudents: StudentRecord[];
  globalErrors: string[];
  globalWarnings: string[];
  summary: StudentImportSummary;
}

export const STUDENT_COLUMN_LABELS: Record<StudentExcelColumnKey, string> = {
  stt: 'STT',
  fullName: 'Họ tên',
  gender: 'Giới tính',
  dob: 'Ngày sinh',
  parentName: 'Tên phụ huynh',
  parentPhone: 'SĐT phụ huynh',
  moetCode: 'Mã MOET',
  team: 'Tổ',
  role: 'Chức vụ',
};

export const ROLE_ID_TO_LABEL: Record<string, string> = {
  member: 'Thành viên',
  lop_truong: 'Lớp trưởng',
  bi_thu: 'Bí thư Chi đoàn',
  thu_quy: 'Thủ quỹ lớp',
  to_truong_1: 'Tổ trưởng Tổ 1',
  to_truong_2: 'Tổ trưởng Tổ 2',
  to_truong_3: 'Tổ trưởng Tổ 3',
  to_truong_4: 'Tổ trưởng Tổ 4',
};

export function stripVietnameseAccents(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeNameKey(name: string): string {
  return (name || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function isTenDigitMoetCode(code?: string): boolean {
  return /^\d{10}$/.test((code || '').trim());
}

export function getStudentMoetCode(st: StudentRecord): string {
  if (st.moetCode && st.moetCode.trim()) return st.moetCode.trim();
  if (isTenDigitMoetCode(st.code)) return st.code.trim();
  return '';
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

export function formatDmy(day: number, month: number, year: number): string {
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${String(year).padStart(4, '0')}`;
}

export function formatDobToDmy(raw?: string): string {
  const s = (raw || '').trim();
  if (!s) return '';

  // yyyy-mm-dd -> dd/mm/yyyy
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (isValidCalendarDate(day, month, year)) return formatDmy(day, month, year);
  }

  // dd/mm/yyyy or d/m/yyyy or dd-mm-yyyy
  const dmyMatch = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    if (isValidCalendarDate(day, month, year)) return formatDmy(day, month, year);
  }

  return s;
}

export function formatDobToInputDate(raw?: string): string {
  const s = (raw || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10);
    const year = parseInt(dmy[3], 10);
    if (isValidCalendarDate(day, month, year)) {
      return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return '';
}

function normalizeDobFromRaw(raw: string): { value: string; warning?: string } {
  const s = (raw || '').trim();
  if (!s) {
    return { value: '', warning: 'Thiếu ngày sinh' };
  }

  // dd/mm/yyyy or d/m/yyyy or dd-mm-yyyy
  const dmyMatch = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += year >= 50 ? 1900 : 2000;
    if (isValidCalendarDate(day, month, year)) {
      return { value: formatDmy(day, month, year) };
    }
    return { value: s, warning: `Ngày sinh không hợp lệ (${s})` };
  }

  // yyyy-mm-dd
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (isValidCalendarDate(day, month, year)) {
      return { value: formatDmy(day, month, year) };
    }
    return { value: s, warning: `Ngày sinh không hợp lệ (${s})` };
  }

  // Excel serial number (e.g. 39887)
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = parseFloat(s);
    if (serial > 25000 && serial < 60000) {
      const parsed = XLSX.SSF.parse_date_code(serial);
      if (parsed && isValidCalendarDate(parsed.d, parsed.m, parsed.y)) {
        return { value: formatDmy(parsed.d, parsed.m, parsed.y) };
      }
    }
  }

  return { value: s, warning: `Ngày sinh chưa đúng chuẩn dd/mm/yyyy (${s})` };
}

function extractExcelCellValue(cell: XLSX.CellObject | undefined): string {
  if (!cell) return '';

  if (cell.t === 'd' && cell.v instanceof Date) {
    const d = cell.v;
    return formatDmy(d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear());
  }

  if (cell.t === 's') {
    return String(cell.v ?? cell.w ?? '').trim();
  }

  if (cell.t === 'n' && typeof cell.v === 'number') {
    const fmt = typeof cell.z === 'string' ? cell.z : '';
    const formatted = typeof cell.w === 'string' ? cell.w.trim() : '';
    const looksLikeDateText = /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(formatted);
    if ((fmt && fmt !== 'General' && fmt !== '@' && XLSX.SSF.is_date(fmt)) || looksLikeDateText) {
      const parsed = XLSX.SSF.parse_date_code(cell.v);
      if (parsed && isValidCalendarDate(parsed.d, parsed.m, parsed.y)) {
        return formatDmy(parsed.d, parsed.m, parsed.y);
      }
    }

    // Preserve formatted text when it keeps leading zeroes (e.g. "0000000000" format) without scientific notation or commas
    if (formatted && /^0\d+$/.test(formatted)) {
      return formatted;
    }

    if (Number.isInteger(cell.v)) {
      return String(cell.v);
    }

    return formatted || String(cell.v);
  }

  return String(cell.w ?? cell.v ?? '').trim();
}

export function extractSheetMatrix(wb: XLSX.WorkBook, sheetName: string): string[][] {
  const ws = wb.Sheets[sheetName];
  if (!ws || !ws['!ref']) return [];
  const range = XLSX.utils.decode_range(ws['!ref']);
  const matrix: string[][] = [];

  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: string[] = [];
    let hasValue = false;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const val = extractExcelCellValue(ws[addr] as XLSX.CellObject | undefined);
      if (val !== '') hasValue = true;
      row.push(val);
    }
    if (hasValue) {
      matrix.push(row);
    }
  }

  return matrix;
}

export function readStudentWorkbook(
  buffer: ArrayBuffer,
  preferredSheetName?: string
): { workbook: XLSX.WorkBook; sheetNames: string[]; selectedSheet: string; matrix: string[][] } {
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: false,
    cellText: true,
    cellNF: true,
    codepage: 65001,
  });
  const sheetNames = workbook.SheetNames || [];
  let selectedSheet = sheetNames[0] || '';
  if (preferredSheetName && sheetNames.includes(preferredSheetName)) {
    selectedSheet = preferredSheetName;
  } else {
    const danhSachSheet = sheetNames.find((name) => /^danh\s*sach/i.test(stripVietnameseAccents(name)));
    if (danhSachSheet) selectedSheet = danhSachSheet;
  }
  const matrix = selectedSheet ? extractSheetMatrix(workbook, selectedSheet) : [];
  return { workbook, sheetNames, selectedSheet, matrix };
}

export function parseDelimitedTextToMatrix(text: string): string[][] {
  const lines = (text || '').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];
  const delimiter = lines[0].includes('\t') ? '\t' : ',';

  return lines.map((line) => {
    if (delimiter === '\t') {
      return line.split('\t').map((c) => c.trim().replace(/^"|"$/g, ''));
    }
    // Simple RFC-4180 CSV line parser
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
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  });
}

function classifyHeaderCell(rawHeader: string): StudentExcelColumnKey | null {
  const norm = stripVietnameseAccents(rawHeader).replace(/[._:/\\-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!norm) return null;

  // Parent phone must be checked before parentName & fullName
  if (
    norm.includes('sdt') ||
    norm.includes('so dt') ||
    norm.includes('dien thoai') ||
    norm.includes('phone') ||
    norm.includes('dt phu huynh') ||
    norm.includes('tel')
  ) {
    return 'parentPhone';
  }

  // Parent name MUST be checked before student fullName!
  if (
    norm.includes('phu huynh') ||
    norm.includes('cha me') ||
    norm.includes('bo me') ||
    norm.includes('giam ho') ||
    norm.includes('parent')
  ) {
    return 'parentName';
  }

  // MOET / Student ID
  if (
    norm.includes('moet') ||
    norm === 'ma hs' ||
    norm === 'ma hoc sinh' ||
    norm.includes('ma dinh danh') ||
    norm === 'code' ||
    (norm.startsWith('ma ') && !norm.includes('lop'))
  ) {
    return 'moetCode';
  }

  // STT
  if (norm === 'stt' || norm === 'so tt' || norm === 'so thu tu' || norm === 'tt') {
    return 'stt';
  }

  // Gender
  if (norm.includes('gioi tinh') || norm === 'gioi' || norm === 'gender' || norm === 'sex') {
    return 'gender';
  }

  // Date of birth
  if (norm.includes('ngay sinh') || norm.includes('sinh nhat') || norm === 'dob' || norm === 'nam sinh') {
    return 'dob';
  }

  // Role
  if (norm.includes('chuc vu') || norm.includes('chuc danh') || norm.includes('vai tro') || norm === 'role') {
    return 'role';
  }

  // Team (avoid matching "tổng", "toán", "tốt")
  if (norm === 'to' || norm === 'to hoc tap' || norm === 'nhom' || norm === 'team' || /^to\s*\d*$/.test(norm)) {
    return 'team';
  }

  // Student Full Name (never matches parent headers because parent was handled above)
  if (
    norm === 'ho ten' ||
    norm === 'ho va ten' ||
    norm === 'ten hoc sinh' ||
    norm === 'ho ten hoc sinh' ||
    norm === 'fullname' ||
    norm === 'student name' ||
    (norm.includes('ho') && norm.includes('ten'))
  ) {
    return 'fullName';
  }

  return null;
}

export function detectStudentHeaderAndMapping(matrix: string[][]): {
  headerRowIndex: number;
  headers: string[];
  dataRows: string[][];
  mapping: StudentColumnMapping;
} {
  const emptyMapping: StudentColumnMapping = {
    stt: -1,
    fullName: -1,
    gender: -1,
    dob: -1,
    parentName: -1,
    parentPhone: -1,
    moetCode: -1,
    team: -1,
    role: -1,
  };

  const cleanMatrix = matrix.filter((r) => r.some((c) => (c || '').trim() !== ''));
  if (cleanMatrix.length === 0) {
    return { headerRowIndex: -1, headers: [], dataRows: [], mapping: emptyMapping };
  }

  let bestIdx = -1;
  let bestScore = 0;
  let bestMapping: StudentColumnMapping = { ...emptyMapping };

  const scanLimit = Math.min(cleanMatrix.length, 15);
  for (let i = 0; i < scanLimit; i++) {
    const row = cleanMatrix[i];
    const candidate: StudentColumnMapping = { ...emptyMapping };
    let score = 0;

    row.forEach((cell, colIdx) => {
      const key = classifyHeaderCell(cell);
      if (key && candidate[key] === -1) {
        candidate[key] = colIdx;
        score += key === 'fullName' || key === 'moetCode' ? 3 : 2;
      }
    });

    if ((candidate.fullName >= 0 || candidate.moetCode >= 0) && score > bestScore) {
      bestScore = score;
      bestIdx = i;
      bestMapping = candidate;
    }
  }

  if (bestIdx === -1) {
    const maxCols = Math.max(...cleanMatrix.map((r) => r.length), 0);
    const syntheticHeaders = Array.from({ length: maxCols }, (_, i) => `Cột ${i + 1}`);
    return {
      headerRowIndex: -1,
      headers: syntheticHeaders,
      dataRows: cleanMatrix,
      mapping: emptyMapping,
    };
  }

  const headerRow = cleanMatrix[bestIdx];
  const maxCols = Math.max(headerRow.length, ...cleanMatrix.slice(bestIdx + 1).map((r) => r.length));
  const headers = Array.from({ length: maxCols }, (_, i) => headerRow[i]?.trim() || `Cột ${i + 1}`);
  const dataRows = cleanMatrix.slice(bestIdx + 1);

  return {
    headerRowIndex: bestIdx,
    headers,
    dataRows,
    mapping: bestMapping,
  };
}

function mapExcelRoleProposal(rawRole: string, team: number): {
  roleId: string;
  roleLabel: string;
  warning?: string;
} {
  const cleaned = (rawRole || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return { roleId: '', roleLabel: '' };
  }

  const norm = stripVietnameseAccents(cleaned);
  if (norm === 'thanh vien' || norm === 'hoc sinh' || norm === 'member' || norm === 'khong' || norm === 'khong co') {
    return { roleId: '', roleLabel: '' };
  }

  if (norm.includes('lop truong')) {
    return { roleId: 'lop_truong', roleLabel: 'Lớp trưởng' };
  }
  if (norm.includes('bi thu')) {
    return { roleId: 'bi_thu', roleLabel: 'Bí thư Chi đoàn' };
  }
  if (norm.includes('thu quy')) {
    return { roleId: 'thu_quy', roleLabel: 'Thủ quỹ lớp' };
  }
  if (norm.includes('to truong')) {
    const explicitNum = norm.match(/\b([1-4])\b/);
    const teamNum = explicitNum ? parseInt(explicitNum[1], 10) : team >= 1 && team <= 4 ? team : 0;
    if (teamNum >= 1 && teamNum <= 4) {
      return {
        roleId: `to_truong_${teamNum}`,
        roleLabel: `Tổ trưởng Tổ ${teamNum}`,
      };
    }
    return {
      roleId: '',
      roleLabel: cleaned,
      warning: `Không xác định được số Tổ cho chức vụ "${cleaned}"`,
    };
  }

  return {
    roleId: '',
    roleLabel: cleaned,
    warning: `Chức vụ "${cleaned}" chưa thuộc danh mục phân quyền hệ thống`,
  };
}

export function buildParsedStudentRows(
  dataRows: string[][],
  mapping: StudentColumnMapping,
  headerRowIndex: number
): ParsedStudentRow[] {
  const parsed: ParsedStudentRow[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const getCol = (key: StudentExcelColumnKey) => {
      const idx = mapping[key];
      return idx >= 0 && idx < row.length ? (row[idx] || '').trim() : '';
    };

    const stt = getCol('stt');
    const rawName = getCol('fullName');
    const rawGender = getCol('gender');
    const rawDob = getCol('dob');
    const rawParentName = getCol('parentName');
    const rawParentPhone = getCol('parentPhone');
    const rawMoet = getCol('moetCode');
    const rawTeam = getCol('team');
    const rawRole = getCol('role');

    // Skip completely empty rows
    if (!rawName && !rawMoet && !rawParentName && !rawParentPhone) continue;

    // Skip footer/signature rows commonly appearing below tables
    const checkFooter = stripVietnameseAccents(`${stt} ${rawName}`);
    if (
      !rawMoet &&
      (checkFooter.startsWith('tong cong') ||
        checkFooter.startsWith('tong so') ||
        checkFooter.includes('giao vien chu nhiem') ||
        checkFooter.includes('hieu truong') ||
        checkFooter.includes('ky ten'))
    ) {
      continue;
    }

    const warnings: string[] = [];
    const errors: string[] = [];

    const fullName = rawName.replace(/\s+/g, ' ').trim();
    if (!fullName) {
      errors.push('Thiếu họ tên học sinh');
    }

    const genderNorm = stripVietnameseAccents(rawGender);
    let gender: 'Nam' | 'Nữ' = 'Nữ';
    if (genderNorm === 'nam' || genderNorm === 'male' || genderNorm === 'm') {
      gender = 'Nam';
    } else if (genderNorm === 'nu' || genderNorm === 'female' || genderNorm === 'f') {
      gender = 'Nữ';
    } else if (!rawGender) {
      warnings.push('Thiếu giới tính');
    } else {
      warnings.push(`Giới tính không chuẩn (${rawGender})`);
    }

    const dobResult = normalizeDobFromRaw(rawDob);
    if (dobResult.warning) warnings.push(dobResult.warning);

    const parentName = rawParentName.replace(/\s+/g, ' ').trim();
    const parentNorm = stripVietnameseAccents(parentName);
    const hasParentMissingWarning = parentNorm === 'khong co' || parentName === '';
    if (parentNorm === 'khong co') {
      warnings.push('Tên phụ huynh ghi "Không có" — GVCN kiểm tra xác minh lại');
    } else if (parentName === '') {
      warnings.push('Thiếu tên phụ huynh');
    }

    // Preserve exact string and leading zeroes for parentPhone
    const parentPhone = rawParentPhone.replace(/\s+/g, '').trim();
    if (!parentPhone || stripVietnameseAccents(parentPhone) === 'khong co') {
      warnings.push('Chưa có SĐT phụ huynh');
    } else if (/^\d{9}$/.test(parentPhone) && /^[35789]/.test(parentPhone)) {
      warnings.push(`SĐT "${parentPhone}" chỉ có 9 chữ số (có thể bị Excel mất số 0 đầu) — cần GVCN kiểm tra`);
    } else if (!/^0\d{8,10}$/.test(parentPhone)) {
      warnings.push(`SĐT phụ huynh cần kiểm tra lại (${parentPhone})`);
    }

    // Preserve MOET code as exact string (trim spaces, disallow invalid doc ID characters)
    const cleanedMoet = rawMoet.replace(/\s+/g, '').trim().toUpperCase();
    if (!cleanedMoet) {
      errors.push('Thiếu Mã MOET');
    } else if (!/^[A-Z0-9_-]+$/.test(cleanedMoet)) {
      errors.push(`Mã MOET chứa ký tự không hợp lệ (${cleanedMoet})`);
    } else if (!/^\d{10}$/.test(cleanedMoet)) {
      warnings.push(`Mã MOET không phải chuỗi 10 chữ số (${cleanedMoet})`);
    }

    // Parse team 1..4 without fabricating defaults silently
    let team = 0;
    const teamDigits = rawTeam.replace(/\D/g, '');
    if (teamDigits) {
      const tNum = parseInt(teamDigits, 10);
      if (tNum >= 1 && tNum <= 4) {
        team = tNum;
      }
    }
    if (team === 0) {
      errors.push(`Tổ không hợp lệ ("${rawTeam || 'Trống'}" — phải từ Tổ 1 đến Tổ 4)`);
    }

    const roleMapped = mapExcelRoleProposal(rawRole, team);
    if (roleMapped.warning) warnings.push(roleMapped.warning);

    parsed.push({
      rowIndex: i,
      excelRowNumber: (headerRowIndex >= 0 ? headerRowIndex + 1 : 0) + i + 1,
      stt,
      fullName,
      gender,
      genderRaw: rawGender,
      dob: dobResult.value,
      dobRaw: rawDob,
      parentName,
      parentPhone,
      moetCode: cleanedMoet,
      team,
      teamRaw: rawTeam,
      roleRaw: rawRole,
      proposedRoleId: roleMapped.roleId,
      proposedRoleLabel: roleMapped.roleLabel,
      applyRoleProposal: false, // Always wait for explicit GVCN confirmation before applying role privileges
      warnings,
      errors,
      hasParentMissingWarning,
    });
  }

  return parsed;
}

export function reconcileStudentImportRows(
  rows: ParsedStudentRow[],
  existingStudents: StudentRecord[],
  studentPiiMap: Record<string, StudentPiiRecord>,
  resolutions: Record<number, LegacyResolutionAction> = {}
): StudentImportAnalysis {
  const globalErrors: string[] = [];
  const globalWarnings: string[] = [];

  // Count duplicate MOET codes and duplicate fullNames inside file
  const moetCounts = new Map<string, number>();
  const nameCounts = new Map<string, number>();
  for (const r of rows) {
    if (r.moetCode) {
      moetCounts.set(r.moetCode, (moetCounts.get(r.moetCode) || 0) + 1);
    }
    if (r.fullName) {
      const k = normalizeNameKey(r.fullName);
      nameCounts.set(k, (nameCounts.get(k) || 0) + 1);
    }
  }

  const duplicatedMoetList: string[] = [];
  moetCounts.forEach((cnt, code) => {
    if (cnt > 1) duplicatedMoetList.push(`${code} (${cnt} dòng)`);
  });
  if (duplicatedMoetList.length > 0) {
    globalErrors.push(
      `Phát hiện Mã MOET bị trùng trong file Excel: ${duplicatedMoetList.join(', ')}. Vui lòng xử lý trước khi nhập.`
    );
  }

  const duplicatedNamesInFile: string[] = [];
  nameCounts.forEach((cnt, normName) => {
    if (cnt > 1) {
      const display = rows.find((r) => normalizeNameKey(r.fullName) === normName)?.fullName || normName;
      duplicatedNamesInFile.push(`${display} (${cnt} HS)`);
    }
  });
  if (duplicatedNamesInFile.length > 0) {
    globalWarnings.push(
      `Có học sinh trùng họ tên trong file (${duplicatedNamesInFile.join(', ')}), nhưng khác Mã MOET — hệ thống giữ nguyên các hồ sơ độc lập, tuyệt đối không gộp theo tên.`
    );
  }

  // Check singleton role conflicts if confirmed
  const proposedSingletonCounts = new Map<string, number>();
  for (const r of rows) {
    if (r.applyRoleProposal && r.proposedRoleId) {
      proposedSingletonCounts.set(
        r.proposedRoleId,
        (proposedSingletonCounts.get(r.proposedRoleId) || 0) + 1
      );
    }
  }
  proposedSingletonCounts.forEach((cnt, roleId) => {
    if (cnt > 1) {
      globalWarnings.push(
        `Có ${cnt} học sinh được xác nhận cùng chức vụ "${ROLE_ID_TO_LABEL[roleId] || roleId}". GVCN kiểm tra lại trước khi lưu.`
      );
    }
  });

  // Index existing students by MOET code (and by code when code is 10-digit MOET)
  const existingByMoet = new Map<string, StudentRecord>();
  const legacyWithoutMoet: StudentRecord[] = [];
  for (const st of existingStudents) {
    const existingMoet = getStudentMoetCode(st);
    if (existingMoet) {
      existingByMoet.set(existingMoet, st);
    } else {
      legacyWithoutMoet.push(st);
    }
  }

  const matchedExistingIds = new Set<string>();
  const linkedTargetCounts = new Map<string, number>();
  Object.values(resolutions).forEach((res) => {
    if (res && res.type === 'link') {
      linkedTargetCounts.set(res.existingId, (linkedTargetCounts.get(res.existingId) || 0) + 1);
    }
  });
  const teamCounts: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

  const items: ReconciledStudentImportItem[] = rows.map((row) => {
    const rowErrors = [...row.errors];
    const rowWarnings = [...row.warnings];

    if (row.moetCode && (moetCounts.get(row.moetCode) || 0) > 1) {
      rowErrors.push(`Trùng Mã MOET ${row.moetCode} trong danh sách nhập`);
    }

    if (row.team >= 1 && row.team <= 4) {
      teamCounts[row.team as 1 | 2 | 3 | 4] += 1;
    }

    const dupNameCnt = row.fullName ? nameCounts.get(normalizeNameKey(row.fullName)) || 1 : 1;
    const resolution = resolutions[row.excelRowNumber] || { type: 'auto' };
    if (resolution.type === 'link' && (linkedTargetCounts.get(resolution.existingId) || 0) > 1) {
      rowErrors.push('Không thể gán trùng cùng 1 hồ sơ cũ cho nhiều học sinh khác nhau');
    }

    let matchedExisting: StudentRecord | null = null;
    let legacyCandidates: StudentRecord[] = [];

    // 1. Primary strict lookup: strictly by MOET code! Never auto-merge by name!
    if (row.moetCode && existingByMoet.has(row.moetCode)) {
      matchedExisting = existingByMoet.get(row.moetCode) || null;
    } else if (row.fullName) {
      // Look for unlinked legacy records (no MOET yet) with matching normalized name -> require explicit GVCN confirmation
      const key = normalizeNameKey(row.fullName);
      legacyCandidates = legacyWithoutMoet.filter((st) => normalizeNameKey(st.fullName) === key);
      if (resolution.type === 'link') {
        matchedExisting = legacyCandidates.find((c) => c.id === resolution.existingId) || null;
      }
    }

    if (matchedExisting) {
      matchedExistingIds.add(matchedExisting.id);
    }

    // Compute field diffs against matchedExisting + existing PII
    const diffs: FieldDiff[] = [];
    if (matchedExisting) {
      const existingPii = studentPiiMap[matchedExisting.code] || studentPiiMap[matchedExisting.id];
      const existingMoet = getStudentMoetCode(matchedExisting);
      if (row.moetCode && existingMoet !== row.moetCode) {
        diffs.push({
          field: 'moetCode',
          label: 'Mã MOET',
          oldValue: existingMoet || 'Chưa có',
          newValue: row.moetCode,
        });
      }
      if ((matchedExisting.fullName || '').trim() !== row.fullName) {
        diffs.push({
          field: 'fullName',
          label: 'Họ tên',
          oldValue: matchedExisting.fullName || '',
          newValue: row.fullName,
        });
      }
      if (matchedExisting.gender !== row.gender) {
        diffs.push({
          field: 'gender',
          label: 'Giới tính',
          oldValue: matchedExisting.gender,
          newValue: row.gender,
        });
      }
      const existingDobDmy = formatDobToDmy(matchedExisting.dob);
      if (existingDobDmy !== row.dob) {
        diffs.push({
          field: 'dob',
          label: 'Ngày sinh',
          oldValue: existingDobDmy || 'Trống',
          newValue: row.dob || 'Trống',
        });
      }
      if (Number(matchedExisting.team) !== row.team && row.team >= 1 && row.team <= 4) {
        diffs.push({
          field: 'team',
          label: 'Tổ',
          oldValue: `Tổ ${matchedExisting.team}`,
          newValue: `Tổ ${row.team}`,
        });
      }
      const oldParentName = (existingPii?.parentName || '').trim();
      if (oldParentName !== row.parentName) {
        diffs.push({
          field: 'parentName',
          label: 'Tên phụ huynh',
          oldValue: oldParentName || 'Trống',
          newValue: row.parentName || 'Trống',
        });
      }
      const oldParentPhone = (existingPii?.parentPhone || matchedExisting.parentPhone || '').trim();
      if (oldParentPhone !== row.parentPhone) {
        diffs.push({
          field: 'parentPhone',
          label: 'SĐT phụ huynh',
          oldValue: oldParentPhone || 'Trống',
          newValue: row.parentPhone || 'Trống',
        });
      }
      if (
        row.applyRoleProposal &&
        row.proposedRoleId &&
        matchedExisting.role !== row.proposedRoleId
      ) {
        diffs.push({
          field: 'role',
          label: 'Chức vụ',
          oldValue: ROLE_ID_TO_LABEL[matchedExisting.role] || matchedExisting.role,
          newValue: row.proposedRoleLabel || row.proposedRoleId,
        });
      }
    }

    // Determine exact reconciliation status
    let status: Exclude<ImportReconciliationStatus, 'missing_in_file'>;
    const hasLegacyUnresolved =
      !matchedExisting && legacyCandidates.length > 0 && resolution.type === 'auto';

    if (rowErrors.length > 0 || rowWarnings.length > 0 || hasLegacyUnresolved) {
      status = 'needs_verification';
    } else if (matchedExisting) {
      status = diffs.length > 0 ? 'changed' : 'matched';
    } else {
      status = 'new';
    }

    return {
      ...row,
      errors: rowErrors,
      warnings: rowWarnings,
      status,
      matchedExisting,
      legacyCandidates,
      resolution,
      diffs,
      duplicateNameCount: dupNameCnt,
    };
  });

  const missingExistingStudents = existingStudents.filter((st) => !matchedExistingIds.has(st.id));

  const summary: StudentImportSummary = {
    totalRows: items.length,
    matchedCount: items.filter((i) => i.status === 'matched').length,
    changedCount: items.filter((i) => i.status === 'changed').length,
    newCount: items.filter((i) => i.status === 'new').length,
    needsVerificationCount: items.filter((i) => i.status === 'needs_verification').length,
    missingInFileCount: missingExistingStudents.length,
    blockingErrorCount:
      globalErrors.length + items.filter((i) => i.errors.length > 0 && i.resolution.type !== 'skip').length,
    warningRowCount: items.filter((i) => i.warnings.length > 0).length,
    duplicateNameCount: duplicatedNamesInFile.length,
    parentMissingWarningCount: items.filter((i) => i.hasParentMissingWarning).length,
    teamCounts,
    roleProposalCount: items.filter((i) => Boolean(i.proposedRoleId)).length,
  };

  return {
    items,
    missingExistingStudents,
    globalErrors,
    globalWarnings,
    summary,
  };
}
