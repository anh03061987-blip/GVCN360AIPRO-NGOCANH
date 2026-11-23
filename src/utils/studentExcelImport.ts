import * as XLSX from 'xlsx';
import type { OfficerAccountRecord, OfficerRoleId, StudentPiiRecord, StudentRecord } from '../types/gvcn';

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

export type RoleReconciliationStatus =
  | 'none'
  | 'unchanged'
  | 'proposed_new'
  | 'changed'
  | 'kept_existing'
  | 'ambiguous';

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
  parentNameRaw: string;
  parentPhone: string;
  parentPhoneRaw: string;
  moetCode: string;
  team: number;
  teamRaw: string;
  roleRaw: string;
  proposedRoles: OfficerRoleId[];
  proposedRoleId: string;
  proposedRoleLabel: string;
  hasAmbiguousRole: boolean;
  applyRoleProposal: boolean;
  roleProposalOverride?: boolean;
  warnings: string[];
  errors: string[];
  hasParentNameMissing: boolean;
  hasParentPhoneMissing: boolean;
  hasParentMissingWarning: boolean;
  hasParentInvalidWarning: boolean;
  hasUnassignedTeamWarning: boolean;
}

export interface ReconciledStudentImportItem extends ParsedStudentRow {
  status: Exclude<ImportReconciliationStatus, 'missing_in_file'>;
  hasBlockingError: boolean;
  hasWarning: boolean;
  matchedExisting: StudentRecord | null;
  legacyCandidates: StudentRecord[];
  resolution: LegacyResolutionAction;
  diffs: FieldDiff[];
  duplicateNameCount: number;
  currentRoles: OfficerRoleId[];
  currentRolesLabel: string;
  roleReconciliationStatus: RoleReconciliationStatus;
  finalRolesToSave: OfficerRoleId[];
}

export interface StudentImportSummary {
  totalRows: number;
  matchedCount: number;
  changedCount: number;
  newCount: number;
  needsVerificationCount: number;
  missingInFileCount: number;
  blockingErrorCount: number;
  errorRowCount: number;
  warningRowCount: number;
  duplicateNameCount: number;
  parentMissingWarningCount: number;
  parentInvalidWarningCount: number;
  unassignedTeamCount: number;
  teamCounts: Record<1 | 2 | 3 | 4, number>;
  roleProposalCount: number;
  roleChangedCount: number;
  roleAmbiguousCount: number;
}

export interface StudentImportAnalysis {
  items: ReconciledStudentImportItem[];
  missingExistingStudents: StudentRecord[];
  globalErrors: string[];
  globalWarnings: string[];
  summary: StudentImportSummary;
}

export const VALID_CLASS_OFFICER_ROLES: OfficerRoleId[] = [
  'lop_truong',
  'to_truong_1',
  'to_truong_2',
  'to_truong_3',
  'to_truong_4',
  'thu_quy',
  'bi_thu',
];

const VALID_OFFICER_ROLE_SET = new Set<string>(VALID_CLASS_OFFICER_ROLES);

export function isValidOfficerRoleId(val: unknown): val is OfficerRoleId {
  return typeof val === 'string' && VALID_OFFICER_ROLE_SET.has(val);
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
  to_truong_1: 'Tổ trưởng Tổ 1',
  to_truong_2: 'Tổ trưởng Tổ 2',
  to_truong_3: 'Tổ trưởng Tổ 3',
  to_truong_4: 'Tổ trưởng Tổ 4',
  thu_quy: 'Thủ quỹ',
  bi_thu: 'Bí thư Chi đoàn',
};

export const ROLE_BADGE_CLASSES: Record<string, string> = {
  lop_truong: 'bg-[#102744]/10 text-[#102744] border border-[#102744]/25',
  to_truong_1: 'bg-teal-50 text-teal-800 border border-teal-200',
  to_truong_2: 'bg-sky-50 text-sky-800 border border-sky-200',
  to_truong_3: 'bg-cyan-50 text-cyan-800 border border-cyan-200',
  to_truong_4: 'bg-blue-50 text-blue-800 border border-blue-200',
  thu_quy: 'bg-amber-50 text-amber-800 border border-amber-200',
  bi_thu: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
  member: 'bg-slate-100 text-slate-600 border border-slate-200',
};

export function getTeamNumberFromRole(roleId: OfficerRoleId): number | null {
  if (roleId === 'to_truong_1') return 1;
  if (roleId === 'to_truong_2') return 2;
  if (roleId === 'to_truong_3') return 3;
  if (roleId === 'to_truong_4') return 4;
  return null;
}

export function normalizeOfficerRolesList(roles: unknown[]): OfficerRoleId[] {
  const unique: OfficerRoleId[] = [];
  for (const item of roles) {
    if (isValidOfficerRoleId(item) && !unique.includes(item)) {
      unique.push(item);
      if (unique.length >= 2) break;
    }
  }
  return unique;
}

export function getStudentRoles(
  st?: Pick<StudentRecord, 'role' | 'secondRole' | 'roles' | 'team'> | null
): OfficerRoleId[] {
  if (!st) return [];
  if (Array.isArray(st.roles) && st.roles.length > 0) {
    return normalizeOfficerRolesList(st.roles);
  }
  const collected: OfficerRoleId[] = [];
  const candidates = [st.role, st.secondRole];
  for (const raw of candidates) {
    if (!raw || raw === 'member' || raw === 'gvcn') continue;
    if (isValidOfficerRoleId(raw)) {
      if (!collected.includes(raw)) collected.push(raw);
    } else {
      const parsed = parseExcelStudentRoles(raw, Number(st.team) || 0);
      for (const r of parsed.proposedRoles) {
        if (!collected.includes(r)) collected.push(r);
      }
    }
    if (collected.length >= 2) break;
  }
  return collected.slice(0, 2);
}

export function studentRolesToLegacyFields(roles: OfficerRoleId[]): {
  role: string;
  secondRole: string;
  roles: OfficerRoleId[];
} {
  const clean = normalizeOfficerRolesList(roles);
  return {
    role: clean[0] || 'member',
    secondRole: clean[1] || '',
    roles: clean,
  };
}

export function formatStudentRolesLabel(roles: OfficerRoleId[]): string {
  const clean = normalizeOfficerRolesList(roles);
  if (clean.length === 0) return 'Thành viên';
  return clean.map((r) => ROLE_ID_TO_LABEL[r] || r).join(' + ');
}

export function areRoleListsEqual(a: OfficerRoleId[], b: OfficerRoleId[]): boolean {
  const cleanA = [...normalizeOfficerRolesList(a)].sort();
  const cleanB = [...normalizeOfficerRolesList(b)].sort();
  if (cleanA.length !== cleanB.length) return false;
  return cleanA.every((val, idx) => val === cleanB[idx]);
}

export interface StudentPermissionStatusInfo {
  accountStatusLabel: string;
  permissionStatusLabel: string;
  subNote?: string;
  tone: 'slate' | 'amber' | 'sky' | 'emerald' | 'rose';
  isSyncedWithProfile: boolean;
}

export function getStudentPermissionStatus(
  studentRoles: OfficerRoleId[],
  officerAccount?: OfficerAccountRecord | null,
  loginStatus?: { active?: boolean; mustChangePassword?: boolean; lastLoginAtMs?: number } | null
): StudentPermissionStatusInfo {
  const hasProfileRole = studentRoles.length > 0;

  if (!officerAccount) {
    if (!hasProfileRole) {
      return {
        accountStatusLabel: 'Không phân quyền',
        permissionStatusLabel: 'Thành viên lớp',
        tone: 'slate',
        isSyncedWithProfile: true,
      };
    }
    return {
      accountStatusLabel: 'Chưa tạo tài khoản',
      permissionStatusLabel: 'Chưa tạo tài khoản',
      subNote: 'Chỉ khai báo chức vụ lớp',
      tone: 'amber',
      isSyncedWithProfile: false,
    };
  }

  const isActive = officerAccount.active && loginStatus?.active !== false;
  const isSynced = areRoleListsEqual(studentRoles, officerAccount.roles || []);

  if (!isActive) {
    return {
      accountStatusLabel: `Đã khóa (${officerAccount.nickname})`,
      permissionStatusLabel: 'Đã khóa hoặc thu hồi',
      tone: 'rose',
      isSyncedWithProfile: isSynced,
    };
  }

  if (!officerAccount.officerUid) {
    return {
      accountStatusLabel: `Chưa liên kết Auth (${officerAccount.nickname})`,
      permissionStatusLabel: 'Chờ GVCN kích hoạt',
      tone: 'sky',
      isSyncedWithProfile: isSynced,
    };
  }

  if (!hasProfileRole) {
    return {
      accountStatusLabel: `Có TK (${officerAccount.nickname})`,
      permissionStatusLabel: 'Đã khóa hoặc thu hồi',
      subNote: 'Đã thu hồi chức vụ lớp — cần rà soát tài khoản',
      tone: 'rose',
      isSyncedWithProfile: false,
    };
  }

  const pendingFirstChange =
    (loginStatus?.mustChangePassword ?? officerAccount.mustChangePassword) &&
    !loginStatus?.lastLoginAtMs;

  return {
    accountStatusLabel: `Đã tạo (${officerAccount.nickname})`,
    permissionStatusLabel: 'Đã kích hoạt',
    subNote: !isSynced
      ? 'Lệch vai trò giữa hồ sơ & tài khoản'
      : pendingFirstChange
        ? 'Chờ đăng nhập đổi MK lần đầu'
        : undefined,
    tone: !isSynced ? 'sky' : 'emerald',
    isSyncedWithProfile: isSynced,
  };
}

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

export function isMissingPlaceholderValue(raw?: string | null): boolean {
  const trimmed = (raw || '').trim();
  if (!trimmed) return true;
  const norm = stripVietnameseAccents(trimmed).replace(/[._:/\\-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!norm) return true;
  return (
    norm === 'khong co' ||
    norm === 'khong' ||
    norm === 'chua co' ||
    norm === 'chua cap nhat' ||
    norm === 'chua nhap' ||
    norm === 'chua ro' ||
    norm === 'chua biet' ||
    norm === 'chua xac dinh' ||
    norm === 'chua phan to' ||
    norm === 'trong' ||
    norm === 'n a' ||
    norm === 'na' ||
    norm === 'none' ||
    norm === 'null' ||
    norm === 'nil' ||
    norm === 'khong xac dinh'
  );
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

  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (isValidCalendarDate(day, month, year)) return formatDmy(day, month, year);
  }

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
  const norm = stripVietnameseAccents(rawHeader)
    .replace(/[()[\]{}._:/\\,&-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!norm) return null;

  // 1. SĐT phụ huynh (kiểm tra trước Tên phụ huynh và Họ tên để không bao giờ nhận nhầm)
  if (
    norm.includes('sdt') ||
    norm.includes('so dt') ||
    norm.includes('dien thoai') ||
    norm.includes('dt ph') ||
    norm.includes('dt phu huynh') ||
    norm.includes('dt lien he') ||
    norm.includes('so lien he') ||
    norm.includes('lien he ph') ||
    norm.includes('phone') ||
    norm.includes('hotline') ||
    norm.includes('zalo') ||
    /\btel\b/.test(norm)
  ) {
    return 'parentPhone';
  }

  // 2. Tên phụ huynh (hỗ trợ Tên PHHS, Họ tên PH, Phụ huynh, Cha mẹ, Giám hộ...)
  if (
    norm.includes('phu huynh') ||
    norm.includes('phhs') ||
    norm.includes('cha me') ||
    norm.includes('bo me') ||
    norm.includes('giam ho') ||
    norm.includes('parent') ||
    norm === 'ph' ||
    norm === 'ten ph' ||
    norm === 'ho ten ph' ||
    norm === 'ho va ten ph' ||
    norm === 'ho ten bo' ||
    norm === 'ho ten me' ||
    norm === 'ten bo' ||
    norm === 'ten me' ||
    norm === 'nguoi lien he' ||
    /\bph\b$/.test(norm)
  ) {
    return 'parentName';
  }

  // 3. Mã MOET / Mã học sinh / Mã định danh
  if (
    norm.includes('moet') ||
    norm === 'ma hs' ||
    norm === 'ma hoc sinh' ||
    norm === 'ma so hs' ||
    norm === 'ma so hoc sinh' ||
    norm.includes('ma dinh danh') ||
    norm.includes('ma bo gd') ||
    norm === 'id hoc sinh' ||
    norm === 'id hs' ||
    norm === 'code' ||
    (norm.startsWith('ma ') && !norm.includes('lop') && !norm.includes('truong'))
  ) {
    return 'moetCode';
  }

  // 4. STT
  if (norm === 'stt' || norm === 'so tt' || norm === 'so thu tu' || norm === 'tt' || norm === 'thu tu') {
    return 'stt';
  }

  // 5. Giới tính
  if (norm.includes('gioi tinh') || norm === 'gioi' || norm === 'gender' || norm === 'sex' || norm === 'nam nu') {
    return 'gender';
  }

  // 6. Ngày sinh
  if (norm.includes('ngay sinh') || norm.includes('sinh nhat') || norm === 'dob' || norm === 'nam sinh' || norm === 'ngay thang nam sinh') {
    return 'dob';
  }

  // 7. Chức vụ
  if (norm.includes('chuc vu') || norm.includes('chuc danh') || norm.includes('vai tro') || norm === 'role') {
    return 'role';
  }

  // 8. Tổ
  if (norm === 'to' || norm === 'to hoc tap' || norm === 'nhom' || norm === 'team' || /^to\s*\d*$/.test(norm)) {
    return 'team';
  }

  // 9. Họ tên học sinh (loại trừ tuyệt đối mọi tiêu đề liên quan đến phụ huynh / SĐT)
  if (
    !norm.includes('phu huynh') &&
    !norm.includes('phhs') &&
    !norm.includes('sdt') &&
    !norm.includes('dien thoai') &&
    (norm === 'ho ten' ||
      norm === 'ho va ten' ||
      norm === 'ten hoc sinh' ||
      norm === 'ten hs' ||
      norm === 'ho ten hoc sinh' ||
      norm === 'ho ten hs' ||
      norm === 'ho va ten hoc sinh' ||
      norm === 'ho va ten hs' ||
      norm === 'fullname' ||
      norm === 'student name' ||
      (norm.includes('ho') && norm.includes('ten')))
  ) {
    return 'fullName';
  }

  return null;
}

export function detectColumnMappingWarnings(
  dataRows: string[][],
  mapping: StudentColumnMapping,
  headers: string[] = []
): string[] {
  const warnings: string[] = [];
  const sample = dataRows.slice(0, 20);
  if (sample.length === 0) return warnings;

  const getNonEmpty = (colIdx: number) =>
    colIdx < 0
      ? []
      : sample
          .map((r) => (colIdx < r.length ? (r[colIdx] || '').trim() : ''))
          .filter((v) => v !== '' && !isMissingPlaceholderValue(v));

  const looksLikeDate = (v: string) =>
    /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(v) || /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(v);
  const looksLikePhoneOrMoet = (v: string) => /^(?:\+84|0)?\d{8,12}$/.test(v.replace(/[\s.-]/g, ''));

  const parentNameVals = getNonEmpty(mapping.parentName);
  if (parentNameVals.length >= 2) {
    const dateHits = parentNameVals.filter(looksLikeDate).length;
    const digitHits = parentNameVals.filter(looksLikePhoneOrMoet).length;
    const colLabel = headers[mapping.parentName] || `Cột ${mapping.parentName + 1}`;
    if (dateHits / parentNameVals.length >= 0.5) {
      warnings.push(
        `Cảnh báo ánh xạ cột: Cột "Tên phụ huynh" đang chọn "${colLabel}" nhưng dữ liệu giống Ngày sinh — GVCN vui lòng chọn lại đúng cột.`
      );
    } else if (digitHits / parentNameVals.length >= 0.5) {
      warnings.push(
        `Cảnh báo ánh xạ cột: Cột "Tên phụ huynh" đang chọn "${colLabel}" nhưng dữ liệu toàn chữ số (giống SĐT hoặc Mã MOET) — GVCN vui lòng chọn lại đúng cột.`
      );
    }
  }

  const parentPhoneVals = getNonEmpty(mapping.parentPhone);
  if (parentPhoneVals.length >= 2) {
    const dateHits = parentPhoneVals.filter(looksLikeDate).length;
    const letterHits = parentPhoneVals.filter((v) => /[a-zA-ZÀ-ỹ]{3,}/.test(v)).length;
    const colLabel = headers[mapping.parentPhone] || `Cột ${mapping.parentPhone + 1}`;
    if (dateHits / parentPhoneVals.length >= 0.5) {
      warnings.push(
        `Cảnh báo ánh xạ cột: Cột "SĐT phụ huynh" đang chọn "${colLabel}" nhưng dữ liệu giống Ngày sinh — GVCN kiểm tra lại.`
      );
    } else if (letterHits / parentPhoneVals.length >= 0.5) {
      warnings.push(
        `Cảnh báo ánh xạ cột: Cột "SĐT phụ huynh" đang chọn "${colLabel}" nhưng dữ liệu chứa chữ (giống tên người) — GVCN kiểm tra lại.`
      );
    }
  }

  const moetVals = getNonEmpty(mapping.moetCode);
  if (moetVals.length >= 2) {
    const spaceNameHits = moetVals.filter((v) => /[a-zA-ZÀ-ỹ]{2,}\s+[a-zA-ZÀ-ỹ]{2,}/.test(v)).length;
    if (spaceNameHits / moetVals.length >= 0.5) {
      const colLabel = headers[mapping.moetCode] || `Cột ${mapping.moetCode + 1}`;
      warnings.push(
        `Cảnh báo ánh xạ cột: Cột "Mã MOET" đang chọn "${colLabel}" nhưng dữ liệu giống Họ tên — GVCN vui lòng chọn lại đúng cột Mã MOET.`
      );
    }
  }

  return warnings;
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

export interface ParsedExcelRoleResult {
  proposedRoles: OfficerRoleId[];
  proposedRoleId: string;
  proposedRoleLabel: string;
  hasAmbiguousValue: boolean;
  warnings: string[];
}

function parseSingleExcelRoleSegment(
  rawSegment: string,
  team: number
): { roleId?: OfficerRoleId; warning?: string; ambiguous?: boolean } {
  const cleaned = (rawSegment || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return {};

  const norm = stripVietnameseAccents(cleaned)
    .replace(/[()[\]{}.:–—-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (
    !norm ||
    norm === 'thanh vien' ||
    norm === 'thanh vien lop' ||
    norm === 'hoc sinh' ||
    norm === 'member' ||
    norm === 'khong' ||
    norm === 'khong co' ||
    norm === 'hs'
  ) {
    return {};
  }

  // Direct canonical IDs
  if (isValidOfficerRoleId(norm)) {
    const roleTeam = getTeamNumberFromRole(norm);
    if (roleTeam && team >= 1 && team <= 4 && roleTeam !== team) {
      return {
        roleId: norm,
        warning: `Chức vụ trong Excel là "Tổ trưởng Tổ ${roleTeam}" nhưng cột Tổ là Tổ ${team} — GVCN kiểm tra lại.`,
        ambiguous: true,
      };
    }
    return { roleId: norm };
  }

  // Lớp trưởng
  if (
    norm === 'lt' ||
    norm === 'lop truong' ||
    norm === 'lop tr' ||
    norm === 'lp truong' ||
    norm === 'l truong' ||
    (norm.includes('lop truong') && !norm.includes('pho'))
  ) {
    return { roleId: 'lop_truong' };
  }

  // Thủ quỹ (bao gồm biến thể lỗi chính tả như "Thũ quỹ", "Thu qui", "TQ")
  if (
    norm === 'tq' ||
    norm === 'thu quy' ||
    norm === 'thu qui' ||
    norm === 'thu quy lop' ||
    norm === 'thu qui lop' ||
    norm.includes('thu quy') ||
    norm.includes('thu qui')
  ) {
    return { roleId: 'thu_quy' };
  }

  // Bí thư Chi đoàn (tránh nhầm "Phó bí thư")
  if (
    !norm.includes('pho') &&
    (norm === 'bt' ||
      norm === 'btcd' ||
      norm === 'bi thu' ||
      norm === 'bi thu cd' ||
      norm === 'bi thu chi doan' ||
      norm === 'bi thu doan' ||
      norm.includes('bi thu'))
  ) {
    return { roleId: 'bi_thu' };
  }

  // Tổ trưởng Tổ 1..4 (TT1..TT4, TT 1..4, Tổ trưởng 1..4, Tổ trưởng Tổ 1..4, Tổ trưởng, TT)
  const ttCodeMatch = norm.match(/^(?:tt|to truong|to tr|truong to)\s*(?:to\s*)?([1-4])$/);
  if (ttCodeMatch) {
    const explicitNum = parseInt(ttCodeMatch[1], 10);
    const roleId = `to_truong_${explicitNum}` as OfficerRoleId;
    if (team >= 1 && team <= 4 && explicitNum !== team) {
      return {
        roleId,
        warning: `Chức vụ trong Excel là "Tổ trưởng Tổ ${explicitNum}" nhưng cột Tổ là Tổ ${team} — GVCN kiểm tra lại.`,
        ambiguous: true,
      };
    }
    return { roleId };
  }

  if (
    !norm.includes('pho') &&
    (norm === 'tt' ||
      norm === 'to truong' ||
      norm === 'to tr' ||
      norm === 'truong to' ||
      norm.includes('to truong') ||
      norm.includes('truong to'))
  ) {
    const explicitNum = norm.match(/\b([1-4])\b/);
    if (explicitNum) {
      const explicitTeam = parseInt(explicitNum[1], 10);
      const roleId = `to_truong_${explicitTeam}` as OfficerRoleId;
      if (team >= 1 && team <= 4 && explicitTeam !== team) {
        return {
          roleId,
          warning: `Chức vụ trong Excel là "Tổ trưởng Tổ ${explicitTeam}" nhưng cột Tổ là Tổ ${team} — GVCN kiểm tra lại.`,
          ambiguous: true,
        };
      }
      return { roleId };
    }
    if (team >= 1 && team <= 4) {
      return { roleId: `to_truong_${team}` as OfficerRoleId };
    }
    return {
      warning: `Không xác định được số Tổ cho chức vụ "${cleaned}" (vui lòng kiểm tra cột Tổ)`,
      ambiguous: true,
    };
  }

  return {
    warning: `Chức vụ "${cleaned}" chưa thuộc danh mục chuẩn (Lớp trưởng, Tổ trưởng Tổ 1–4, Thủ quỹ, Bí thư Chi đoàn) — GVCN kiểm tra lại`,
    ambiguous: true,
  };
}

export function parseExcelStudentRoles(rawRole: string, team: number): ParsedExcelRoleResult {
  const cleaned = (rawRole || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return {
      proposedRoles: [],
      proposedRoleId: '',
      proposedRoleLabel: '',
      hasAmbiguousValue: false,
      warnings: [],
    };
  }

  // Split dual-role strings such as "Tổ trưởng Tổ 2 + Thủ quỹ", "Lớp trưởng, Bí thư", "Tổ trưởng kiêm Thủ quỹ", "TT2 / TQ"
  const rawSegments = cleaned
    .split(/[+,;/&\n]+|\s+ki[eê]m(?:\s+nhi[eệ]m)?\s+|\s+v[aà]\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const collected: OfficerRoleId[] = [];
  const warnings: string[] = [];
  let hasAmbiguousValue = false;

  for (const seg of rawSegments) {
    const res = parseSingleExcelRoleSegment(seg, team);
    if (res.warning) warnings.push(res.warning);
    if (res.ambiguous) hasAmbiguousValue = true;
    if (res.roleId && !collected.includes(res.roleId)) {
      collected.push(res.roleId);
    }
  }

  // Validate no 2 different team leader roles simultaneously
  const teamLeaderRoles = collected.filter((r) => r.startsWith('to_truong_'));
  if (teamLeaderRoles.length > 1) {
    hasAmbiguousValue = true;
    warnings.push(
      `Một học sinh không thể đảm nhiệm cùng lúc nhiều vị trí Tổ trưởng (${teamLeaderRoles
        .map((r) => ROLE_ID_TO_LABEL[r])
        .join(', ')}).`
    );
  }

  let finalRoles = collected;
  if (collected.length > 2) {
    hasAmbiguousValue = true;
    warnings.push(
      `Ô chức vụ "${cleaned}" có hơn 2 vị trí — hệ thống chỉ hỗ trợ tối đa 2 chức vụ kiêm nhiệm.`
    );
    finalRoles = collected.slice(0, 2);
  }

  return {
    proposedRoles: finalRoles,
    proposedRoleId: finalRoles[0] || '',
    proposedRoleLabel:
      finalRoles.length > 0
        ? formatStudentRolesLabel(finalRoles)
        : hasAmbiguousValue
          ? cleaned
          : '',
    hasAmbiguousValue,
    warnings,
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

    if (!rawName && !rawMoet && !rawParentName && !rawParentPhone) continue;

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

    const parentNameRaw = rawParentName.replace(/\s+/g, ' ').trim();
    const hasParentNameMissing = isMissingPlaceholderValue(parentNameRaw);
    const parentName = hasParentNameMissing ? '' : parentNameRaw;

    const parentPhoneRaw = rawParentPhone.replace(/\s+/g, ' ').trim();
    const hasParentPhoneMissing = isMissingPlaceholderValue(parentPhoneRaw);
    let parentPhone = '';
    let hasParentInvalidWarning = false;

    if (!hasParentNameMissing) {
      if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(parentName) || /^\d{8,}$/.test(parentName.replace(/\s+/g, ''))) {
        hasParentInvalidWarning = true;
        warnings.push(
          `Tên phụ huynh ("${parentName}") có dấu hiệu sai kiểu dữ liệu — kiểm tra lại ánh xạ cột.`
        );
      }
    }

    if (!hasParentPhoneMissing) {
      let normalizedPhone = parentPhoneRaw.replace(/[\s.-]+/g, '');
      if (normalizedPhone.startsWith('+84')) {
        normalizedPhone = `0${normalizedPhone.slice(3)}`;
      }
      parentPhone = normalizedPhone;
      if (/^\d{9}$/.test(parentPhone) && /^[35789]/.test(parentPhone)) {
        hasParentInvalidWarning = true;
        warnings.push(
          `SĐT "${parentPhone}" chỉ có 9 chữ số (có thể bị Excel mất số 0 đầu) — cần GVCN kiểm tra.`
        );
      } else if (!/^0\d{8,10}$/.test(parentPhone)) {
        hasParentInvalidWarning = true;
        warnings.push(`SĐT phụ huynh sai định dạng ("${parentPhoneRaw}") — cần GVCN kiểm tra lại.`);
      }
    }

    const hasParentMissingWarning = hasParentNameMissing || hasParentPhoneMissing;
    if (hasParentNameMissing && hasParentPhoneMissing) {
      warnings.push('Chưa cập nhật thông tin phụ huynh');
    } else if (hasParentNameMissing) {
      warnings.push('Chưa cập nhật thông tin phụ huynh (chưa có tên phụ huynh)');
    } else if (hasParentPhoneMissing) {
      warnings.push('Chưa cập nhật thông tin phụ huynh (chưa có SĐT phụ huynh)');
    }

    const cleanedMoet = rawMoet.replace(/\s+/g, '').trim().toUpperCase();
    if (!cleanedMoet) {
      errors.push('Thiếu Mã MOET (bắt buộc để định danh học sinh)');
    } else if (!/^[A-Z0-9_-]+$/.test(cleanedMoet)) {
      errors.push(`Mã MOET chứa ký tự không hợp lệ (${cleanedMoet})`);
    } else if (cleanedMoet.length > 40) {
      errors.push(`Mã MOET vượt quá 40 ký tự (${cleanedMoet})`);
    } else if (!/^\d{10}$/.test(cleanedMoet)) {
      warnings.push(`Mã MOET không phải chuỗi 10 chữ số (${cleanedMoet})`);
    }

    let team = 0;
    let hasUnassignedTeamWarning = false;
    if (isMissingPlaceholderValue(rawTeam)) {
      team = 0;
      hasUnassignedTeamWarning = true;
      warnings.push('Chưa phân tổ (vẫn được nhập, có thể phân tổ sau)');
    } else {
      const teamDigits = rawTeam.replace(/\D/g, '');
      if (teamDigits) {
        const tNum = parseInt(teamDigits, 10);
        if (tNum >= 1 && tNum <= 4) {
          team = tNum;
        }
      }
      if (team === 0) {
        hasUnassignedTeamWarning = true;
        warnings.push(`Giá trị Tổ "${rawTeam}" chưa thuộc Tổ 1–4 — tạm đặt Chưa phân tổ`);
      }
    }

    const roleMapped = parseExcelStudentRoles(rawRole, team);
    if (roleMapped.warnings.length > 0) {
      warnings.push(...roleMapped.warnings);
    }

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
      parentNameRaw,
      parentPhone,
      parentPhoneRaw,
      moetCode: cleanedMoet,
      team,
      teamRaw: rawTeam,
      roleRaw: rawRole,
      proposedRoles: roleMapped.proposedRoles,
      proposedRoleId: roleMapped.proposedRoleId,
      proposedRoleLabel: roleMapped.proposedRoleLabel,
      hasAmbiguousRole: roleMapped.hasAmbiguousValue,
      applyRoleProposal: roleMapped.proposedRoles.length > 0 && !roleMapped.hasAmbiguousValue,
      roleProposalOverride: undefined,
      warnings,
      errors,
      hasParentNameMissing,
      hasParentPhoneMissing,
      hasParentMissingWarning,
      hasParentInvalidWarning,
      hasUnassignedTeamWarning,
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

    if (row.moetCode && existingByMoet.has(row.moetCode)) {
      matchedExisting = existingByMoet.get(row.moetCode) || null;
    } else if (row.fullName) {
      const key = normalizeNameKey(row.fullName);
      legacyCandidates = legacyWithoutMoet.filter((st) => normalizeNameKey(st.fullName) === key);
      if (resolution.type === 'link') {
        matchedExisting = legacyCandidates.find((c) => c.id === resolution.existingId) || null;
      }
    }

    if (matchedExisting) {
      matchedExistingIds.add(matchedExisting.id);
    }

    const currentRoles = getStudentRoles(matchedExisting);
    const currentRolesLabel = formatStudentRolesLabel(currentRoles);
    const proposedRoles = row.proposedRoles || [];

    // Reconcile class roles carefully:
    // - Blank Excel cell NEVER erases an existing confirmed role
    // - Unchanged roles stay untouched
    // - Unambiguous valid roles for new students / currently member students default to checked for GVCN confirmation in preview
    // - Changing an existing confirmed role defaults to unchecked (requires explicit GVCN tick!)
    // - Ambiguous roles always require GVCN verification and never auto-apply
    let roleReconciliationStatus: RoleReconciliationStatus = 'none';
    let defaultApply = false;

    if (row.hasAmbiguousRole) {
      roleReconciliationStatus = 'ambiguous';
      defaultApply = false;
    } else if (proposedRoles.length === 0) {
      if (currentRoles.length > 0) {
        roleReconciliationStatus = 'kept_existing';
      } else {
        roleReconciliationStatus = 'none';
      }
      defaultApply = false;
    } else if (currentRoles.length === 0) {
      roleReconciliationStatus = 'proposed_new';
      defaultApply = true;
    } else if (areRoleListsEqual(currentRoles, proposedRoles)) {
      roleReconciliationStatus = 'unchanged';
      defaultApply = false;
    } else {
      roleReconciliationStatus = 'changed';
      defaultApply = false;
    }

    const effectiveApplyRoleProposal =
      proposedRoles.length === 0
        ? false
        : row.roleProposalOverride !== undefined
          ? row.roleProposalOverride
          : defaultApply;

    const finalRolesToSave: OfficerRoleId[] =
      effectiveApplyRoleProposal && proposedRoles.length > 0
        ? proposedRoles
        : currentRoles;

    if (roleReconciliationStatus === 'changed' && !effectiveApplyRoleProposal) {
      rowWarnings.push(
        `Chức vụ trong Excel (${formatStudentRolesLabel(proposedRoles)}) khác chức vụ hiện tại (${currentRolesLabel}) — tick xác nhận nếu muốn thay đổi.`
      );
    }

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
      const oldParentName = isMissingPlaceholderValue(existingPii?.parentName)
        ? ''
        : (existingPii?.parentName || '').trim();
      if (row.parentName && oldParentName !== row.parentName) {
        diffs.push({
          field: 'parentName',
          label: 'Tên phụ huynh',
          oldValue: oldParentName || 'Chưa cập nhật',
          newValue: row.parentName,
        });
      }
      const oldParentPhoneRaw = (existingPii?.parentPhone || matchedExisting.parentPhone || '').trim();
      const oldParentPhone = isMissingPlaceholderValue(oldParentPhoneRaw) ? '' : oldParentPhoneRaw;
      if (row.parentPhone && oldParentPhone !== row.parentPhone) {
        diffs.push({
          field: 'parentPhone',
          label: 'SĐT phụ huynh',
          oldValue: oldParentPhone || 'Chưa cập nhật',
          newValue: row.parentPhone,
        });
      }
      if (!areRoleListsEqual(currentRoles, finalRolesToSave)) {
        diffs.push({
          field: 'roles',
          label: 'Chức vụ trong lớp',
          oldValue: currentRolesLabel,
          newValue: formatStudentRolesLabel(finalRolesToSave),
        });
      }
    }

    let status: Exclude<ImportReconciliationStatus, 'missing_in_file'>;
    const hasLegacyUnresolved =
      !matchedExisting && legacyCandidates.length > 0 && resolution.type === 'auto';
    const hasBlockingError = rowErrors.length > 0;
    const hasWarning = rowWarnings.length > 0 || hasLegacyUnresolved;

    if (hasBlockingError || hasLegacyUnresolved) {
      status = 'needs_verification';
    } else if (matchedExisting) {
      status = diffs.length > 0 ? 'changed' : 'matched';
    } else {
      status = 'new';
    }

    return {
      ...row,
      applyRoleProposal: effectiveApplyRoleProposal,
      errors: rowErrors,
      warnings: rowWarnings,
      hasBlockingError,
      hasWarning,
      status,
      matchedExisting,
      legacyCandidates,
      resolution,
      diffs,
      duplicateNameCount: dupNameCnt,
      currentRoles,
      currentRolesLabel,
      roleReconciliationStatus,
      finalRolesToSave,
    };
  });

  // Check singleton role conflicts across all final roles being saved + unmatched existing students
  const missingExistingStudents = existingStudents.filter((st) => !matchedExistingIds.has(st.id));
  const roleHolderNames = new Map<OfficerRoleId, string[]>();
  for (const item of items) {
    if (item.resolution.type === 'skip') continue;
    for (const r of item.finalRolesToSave) {
      const list = roleHolderNames.get(r) || [];
      list.push(item.fullName || item.moetCode);
      roleHolderNames.set(r, list);
    }
  }
  for (const st of missingExistingStudents) {
    for (const r of getStudentRoles(st)) {
      const list = roleHolderNames.get(r) || [];
      list.push(`${st.fullName} (hồ sơ cũ)`);
      roleHolderNames.set(r, list);
    }
  }
  roleHolderNames.forEach((holders, roleId) => {
    if (holders.length > 1) {
      globalWarnings.push(
        `Chức vụ "${ROLE_ID_TO_LABEL[roleId] || roleId}" đang có ${holders.length} học sinh đảm nhiệm (${holders.join(', ')}). GVCN kiểm tra lại trước khi lưu.`
      );
    }
  });

  const errorRowCount = items.filter((i) => i.hasBlockingError && i.resolution.type !== 'skip').length;
  const warningRowCount = items.filter((i) => i.hasWarning && i.resolution.type !== 'skip').length;

  const summary: StudentImportSummary = {
    totalRows: items.length,
    matchedCount: items.filter((i) => i.status === 'matched').length,
    changedCount: items.filter((i) => i.status === 'changed').length,
    newCount: items.filter((i) => i.status === 'new').length,
    needsVerificationCount: items.filter((i) => i.status === 'needs_verification').length,
    missingInFileCount: missingExistingStudents.length,
    blockingErrorCount: globalErrors.length + errorRowCount,
    errorRowCount,
    warningRowCount,
    duplicateNameCount: duplicatedNamesInFile.length,
    parentMissingWarningCount: items.filter((i) => i.hasParentMissingWarning && i.resolution.type !== 'skip').length,
    parentInvalidWarningCount: items.filter((i) => i.hasParentInvalidWarning && i.resolution.type !== 'skip').length,
    unassignedTeamCount: items.filter((i) => i.hasUnassignedTeamWarning && i.resolution.type !== 'skip').length,
    teamCounts,
    roleProposalCount: items.filter((i) => i.proposedRoles.length > 0).length,
    roleChangedCount: items.filter((i) => i.roleReconciliationStatus === 'changed').length,
    roleAmbiguousCount: items.filter((i) => i.roleReconciliationStatus === 'ambiguous').length,
  };

  return {
    items,
    missingExistingStudents,
    globalErrors,
    globalWarnings,
    summary,
  };
}

// ============================================================================
// CANONICAL ROSTER ORDER (STT EXCEL) SORTING & SAFE RECONCILIATION ENGINE
// ============================================================================

export function isValidRosterOrder(val: unknown): val is number {
  return typeof val === 'number' && Number.isInteger(val) && val >= 1 && val <= 500;
}

export function parsePositiveIntStt(raw: string): number | null {
  const cleaned = (raw || '').trim();
  if (!/^\d+$/.test(cleaned)) return null;
  const num = parseInt(cleaned, 10);
  if (!Number.isInteger(num) || num < 1 || num > 500) return null;
  return num;
}

/**
 * Sắp xếp danh sách học sinh mặc định theo thứ tự STT Excel (rosterOrder tăng dần 1, 2, 3...).
 * Học sinh có rosterOrder hợp lệ luôn đứng trước theo thứ tự tăng dần;
 * hồ sơ cũ chưa có rosterOrder được đặt sau cùng và sắp ổn định theo code/id.
 */
export function compareStudentsByRosterOrder(a: StudentRecord, b: StudentRecord): number {
  const aValid = isValidRosterOrder(a.rosterOrder);
  const bValid = isValidRosterOrder(b.rosterOrder);
  if (aValid && bValid) {
    if (a.rosterOrder! !== b.rosterOrder!) return a.rosterOrder! - b.rosterOrder!;
  } else if (aValid) {
    return -1;
  } else if (bValid) {
    return 1;
  }
  const codeCmp = (a.code || '').localeCompare(b.code || '');
  if (codeCmp !== 0) return codeCmp;
  return (a.id || '').localeCompare(b.id || '');
}

export type RosterOrderRowStatus =
  | 'ready_update'
  | 'unchanged'
  | 'missing_moet'
  | 'duplicate_moet'
  | 'invalid_stt'
  | 'duplicate_stt'
  | 'not_found_in_class';

export interface RosterOrderColumnMapping {
  stt: number;
  moetCode: number;
  fullName: number;
}

export interface RosterOrderReconciliationRow {
  excelRowNumber: number;
  sttRaw: string;
  newRosterOrder: number | null;
  moetCode: string;
  excelFullName: string;
  matchedStudent: StudentRecord | null;
  currentRosterOrder: number | null;
  status: RosterOrderRowStatus;
  errors: string[];
  warnings: string[];
}

export interface RosterOrderReconciliationAnalysis {
  rows: RosterOrderReconciliationRow[];
  missingClassStudents: StudentRecord[];
  globalErrors: string[];
  globalWarnings: string[];
  expectedClassSize: number;
  fileRowCount: number;
  matchedUniqueCount: number;
  changedCount: number;
  unchangedCount: number;
  errorRowCount: number;
  canConfirmApply: boolean;
}

export function buildRosterOrderReconciliation(
  dataRows: string[][],
  mapping: RosterOrderColumnMapping,
  headerRowIndex: number,
  existingStudents: StudentRecord[]
): RosterOrderReconciliationAnalysis {
  const globalErrors: string[] = [];
  const globalWarnings: string[] = [];
  const expectedClassSize = existingStudents.length;

  if (expectedClassSize === 0) {
    globalErrors.push('Lớp hiện chưa có hồ sơ học sinh nào trên Firestore để cập nhật STT.');
  }
  if (mapping.stt < 0) {
    globalErrors.push('Chưa xác định được cột STT trong file Excel. Vui lòng chọn đúng cột STT.');
  }
  if (mapping.moetCode < 0) {
    globalErrors.push('Chưa xác định được cột Mã MOET trong file Excel. Vui lòng chọn đúng cột Mã MOET.');
  }

  // Index existing students strictly by MOET code (and fallback exact normalized code)
  const existingByMoet = new Map<string, StudentRecord>();
  const duplicateExistingMoets = new Set<string>();
  for (const st of existingStudents) {
    const key = (getStudentMoetCode(st) || st.code || '').replace(/\s+/g, '').trim().toUpperCase();
    if (!key) continue;
    if (existingByMoet.has(key)) {
      duplicateExistingMoets.add(key);
    } else {
      existingByMoet.set(key, st);
    }
  }
  if (duplicateExistingMoets.size > 0) {
    globalErrors.push(
      `Dữ liệu lớp hiện tại có Mã MOET bị trùng (${Array.from(duplicateExistingMoets).join(', ')}). Cần xử lý trước khi cập nhật STT.`
    );
  }

  // Extract valid raw rows (skipping blank and footer/signature rows)
  const rawEntries: Array<{
    excelRowNumber: number;
    sttRaw: string;
    newRosterOrder: number | null;
    moetCode: string;
    excelFullName: string;
  }> = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const sttRaw = mapping.stt >= 0 && mapping.stt < row.length ? (row[mapping.stt] || '').trim() : '';
    const moetRaw =
      mapping.moetCode >= 0 && mapping.moetCode < row.length ? (row[mapping.moetCode] || '').trim() : '';
    const nameRaw =
      mapping.fullName >= 0 && mapping.fullName < row.length ? (row[mapping.fullName] || '').trim() : '';

    if (!sttRaw && !moetRaw && !nameRaw) continue;

    const checkFooter = stripVietnameseAccents(`${sttRaw} ${nameRaw}`);
    if (
      !moetRaw &&
      (checkFooter.startsWith('tong cong') ||
        checkFooter.startsWith('tong so') ||
        checkFooter.includes('giao vien chu nhiem') ||
        checkFooter.includes('hieu truong') ||
        checkFooter.includes('ky ten'))
    ) {
      continue;
    }

    const moetCode = moetRaw.replace(/\s+/g, '').trim().toUpperCase();
    const newRosterOrder = parsePositiveIntStt(sttRaw);

    rawEntries.push({
      excelRowNumber: (headerRowIndex >= 0 ? headerRowIndex + 1 : 0) + i + 1,
      sttRaw,
      newRosterOrder,
      moetCode,
      excelFullName: nameRaw.replace(/\s+/g, ' ').trim(),
    });
  }

  if (rawEntries.length === 0) {
    globalErrors.push('Không đọc được dòng dữ liệu học sinh nào trong file Excel.');
  }

  // Count duplicate MOET codes and duplicate STT values within the Excel file
  const moetCounts = new Map<string, number>();
  const sttCounts = new Map<number, number>();
  for (const entry of rawEntries) {
    if (entry.moetCode) {
      moetCounts.set(entry.moetCode, (moetCounts.get(entry.moetCode) || 0) + 1);
    }
    if (entry.newRosterOrder !== null) {
      sttCounts.set(entry.newRosterOrder, (sttCounts.get(entry.newRosterOrder) || 0) + 1);
    }
  }

  const dupMoets: string[] = [];
  moetCounts.forEach((cnt, code) => {
    if (cnt > 1) dupMoets.push(`${code} (${cnt} dòng)`);
  });
  if (dupMoets.length > 0) {
    globalErrors.push(`Phát hiện Mã MOET bị trùng trong file Excel: ${dupMoets.join(', ')}.`);
  }

  const dupStts: string[] = [];
  sttCounts.forEach((cnt, num) => {
    if (cnt > 1) dupStts.push(`STT ${num} (${cnt} dòng)`);
  });
  if (dupStts.length > 0) {
    globalErrors.push(`Phát hiện STT bị trùng trong file Excel: ${dupStts.join(', ')}.`);
  }

  // Reconcile every Excel row strictly by MOET code
  const matchedStudentIds = new Set<string>();
  const rows: RosterOrderReconciliationRow[] = rawEntries.map((entry) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    let status: RosterOrderRowStatus = 'ready_update';

    const hasDupMoet = Boolean(entry.moetCode && (moetCounts.get(entry.moetCode) || 0) > 1);
    const hasDupStt = entry.newRosterOrder !== null && (sttCounts.get(entry.newRosterOrder) || 0) > 1;

    if (!entry.moetCode) {
      errors.push('Thiếu Mã MOET — hệ thống không tự ghép theo tên hoặc STT.');
    } else if (hasDupMoet) {
      errors.push(`Trùng Mã MOET "${entry.moetCode}" trong file Excel.`);
    }

    if (entry.newRosterOrder === null) {
      errors.push(`STT "${entry.sttRaw || 'Trống'}" không phải số nguyên dương hợp lệ.`);
    } else if (expectedClassSize > 0 && entry.newRosterOrder > expectedClassSize) {
      errors.push(`STT ${entry.newRosterOrder} vượt quá sĩ số lớp hiện tại (${expectedClassSize}).`);
    } else if (hasDupStt) {
      errors.push(`STT ${entry.newRosterOrder} bị trùng trong file Excel.`);
    }

    let matchedStudent: StudentRecord | null = null;
    if (entry.moetCode && !duplicateExistingMoets.has(entry.moetCode)) {
      matchedStudent = existingByMoet.get(entry.moetCode) || null;
      if (!matchedStudent) {
        errors.push(`Không tìm thấy hồ sơ lớp có Mã MOET "${entry.moetCode}" (học sinh lạ — không tự tạo mới).`);
      } else {
        matchedStudentIds.add(matchedStudent.id);
        if (
          entry.excelFullName &&
          normalizeNameKey(entry.excelFullName) !== normalizeNameKey(matchedStudent.fullName)
        ) {
          warnings.push(
            `Họ tên trong Excel ("${entry.excelFullName}") khác hồ sơ lớp ("${matchedStudent.fullName}") — chỉ cập nhật STT, giữ nguyên họ tên gốc.`
          );
        }
      }
    }

    const currentRosterOrder =
      matchedStudent && isValidRosterOrder(matchedStudent.rosterOrder)
        ? matchedStudent.rosterOrder
        : null;

    if (!entry.moetCode) {
      status = 'missing_moet';
    } else if (hasDupMoet) {
      status = 'duplicate_moet';
    } else if (!matchedStudent) {
      status = 'not_found_in_class';
    } else if (
      entry.newRosterOrder === null ||
      (expectedClassSize > 0 && entry.newRosterOrder > expectedClassSize)
    ) {
      status = 'invalid_stt';
    } else if (hasDupStt) {
      status = 'duplicate_stt';
    } else if (currentRosterOrder === entry.newRosterOrder) {
      status = 'unchanged';
    } else {
      status = 'ready_update';
    }

    return {
      excelRowNumber: entry.excelRowNumber,
      sttRaw: entry.sttRaw,
      newRosterOrder: entry.newRosterOrder,
      moetCode: entry.moetCode,
      excelFullName: entry.excelFullName,
      matchedStudent,
      currentRosterOrder,
      status,
      errors,
      warnings,
    };
  });

  const missingClassStudents = existingStudents.filter((st) => !matchedStudentIds.has(st.id));

  if (expectedClassSize > 0 && rawEntries.length !== expectedClassSize) {
    globalErrors.push(
      `File Excel có ${rawEntries.length} dòng học sinh, không khớp sĩ số chính thức của lớp hiện tại (${expectedClassSize} học sinh).`
    );
  }

  if (missingClassStudents.length > 0) {
    globalErrors.push(
      `Có ${missingClassStudents.length} học sinh đang thuộc lớp nhưng thiếu trong file Excel (không khớp đủ 100% sĩ số lớp).`
    );
  }

  // Verify contiguous STT 1..expectedClassSize with no gaps and no out-of-range numbers
  if (expectedClassSize > 0 && rawEntries.length > 0) {
    const missingStts: number[] = [];
    const outOfRangeStts: number[] = [];
    for (let n = 1; n <= expectedClassSize; n++) {
      if (!sttCounts.has(n)) missingStts.push(n);
    }
    sttCounts.forEach((_cnt, num) => {
      if (num > expectedClassSize) outOfRangeStts.push(num);
    });
    if (missingStts.length > 0 || outOfRangeStts.length > 0) {
      const parts: string[] = [];
      if (missingStts.length > 0) {
        parts.push(`thiếu STT: ${missingStts.slice(0, 10).join(', ')}${missingStts.length > 10 ? '...' : ''}`);
      }
      if (outOfRangeStts.length > 0) {
        parts.push(
          `vượt quá sĩ số (${expectedClassSize}): ${outOfRangeStts.slice(0, 10).join(', ')}${
            outOfRangeStts.length > 10 ? '...' : ''
          }`
        );
      }
      globalErrors.push(
        `STT trong file Excel phải đầy đủ và liên tục từ 1 đến ${expectedClassSize} (${parts.join('; ')}).`
      );
    }
  }

  const warningCount = rows.filter((r) => r.warnings.length > 0).length;
  if (warningCount > 0) {
    globalWarnings.push(
      `Có ${warningCount} dòng có khác biệt chính tả họ tên giữa file Excel và hồ sơ lớp — hệ thống chỉ cập nhật trường STT (rosterOrder), giữ nguyên toàn bộ thông tin gốc.`
    );
  }

  const errorRowCount = rows.filter((r) => r.errors.length > 0).length;
  const changedCount = rows.filter((r) => r.status === 'ready_update').length;
  const unchangedCount = rows.filter((r) => r.status === 'unchanged').length;
  const canConfirmApply =
    expectedClassSize > 0 &&
    globalErrors.length === 0 &&
    errorRowCount === 0 &&
    rows.length === expectedClassSize &&
    matchedStudentIds.size === expectedClassSize &&
    missingClassStudents.length === 0;

  return {
    rows,
    missingClassStudents,
    globalErrors,
    globalWarnings,
    expectedClassSize,
    fileRowCount: rows.length,
    matchedUniqueCount: matchedStudentIds.size,
    changedCount,
    unchangedCount,
    errorRowCount,
    canConfirmApply,
  };
}

