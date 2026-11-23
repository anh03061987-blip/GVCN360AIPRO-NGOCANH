import React, { useState } from 'react';
import {
  X,
  Upload,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  ShieldAlert,
  Users,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { ROLES, TICKET_TYPES } from '../constants/gvcnConstants';
import type {
  ClassConfig,
  EmulationRank,
  StudentRecord,
  TicketRecord,
} from '../types/gvcn';
import {
  ROLE_BADGE_CLASSES,
  ROLE_ID_TO_LABEL,
  STUDENT_COLUMN_LABELS,
  formatDobToDmy,
  formatDobToInputDate,
  getTeamNumberFromRole,
  isValidOfficerRoleId,
  type LegacyResolutionAction,
  type StudentColumnMapping,
  type StudentExcelColumnKey,
  type StudentImportAnalysis,
} from '../utils/studentExcelImport';

interface StudentModalProps {
  open: boolean;
  onClose: () => void;
  editingStudent: StudentRecord | null;
  studentForm: {
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
  };
  setStudentForm: React.Dispatch<
    React.SetStateAction<{
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
    }>
  >;
  onSubmit: (e: React.FormEvent) => void;
}

export function StudentModal({
  open,
  onClose,
  editingStudent,
  studentForm,
  setStudentForm,
  onSubmit,
}: StudentModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-bold text-lg text-slate-900">
            {editingStudent ? 'Cập nhật hồ sơ học sinh' : 'Thêm học sinh mới'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3.5 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Mã HS / Mã MOET (10 số)</label>
              <input
                type="text"
                required
                disabled={!!editingStudent}
                value={studentForm.code}
                onChange={(e) => setStudentForm({ ...studentForm, code: e.target.value })}
                placeholder="VD: 1234567890"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Tổ học tập</label>
              <select
                value={studentForm.team}
                onChange={(e) => setStudentForm({ ...studentForm, team: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              >
                <option value={0}>Chưa phân tổ</option>
                <option value={1}>Tổ 1</option>
                <option value={2}>Tổ 2</option>
                <option value={3}>Tổ 3</option>
                <option value={4}>Tổ 4</option>
              </select>
            </div>
          </div>

          {editingStudent && (
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Mã định danh MOET (10 chữ số)</label>
              <input
                type="text"
                value={studentForm.moetCode}
                onChange={(e) => setStudentForm({ ...studentForm, moetCode: e.target.value })}
                placeholder="Nhập mã MOET 10 chữ số (nếu hồ sơ cũ chưa có)"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Họ và tên học sinh</label>
            <input
              type="text"
              required
              value={studentForm.fullName}
              onChange={(e) => setStudentForm({ ...studentForm, fullName: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Giới tính</label>
              <select
                value={studentForm.gender}
                onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value as 'Nam' | 'Nữ' })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              >
                <option value="Nữ">Nữ</option>
                <option value="Nam">Nam</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">
                Ngày sinh {studentForm.dob ? `(${formatDobToDmy(studentForm.dob)})` : '(dd/mm/yyyy)'}
              </label>
              <input
                type="date"
                value={formatDobToInputDate(studentForm.dob)}
                onChange={(e) =>
                  setStudentForm({ ...studentForm, dob: formatDobToDmy(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Chức vụ chính</label>
              <select
                value={studentForm.role}
                onChange={(e) => {
                  const nextPrimary = e.target.value;
                  const nextSecond =
                    studentForm.secondRole === nextPrimary ||
                    (nextPrimary.startsWith('to_truong_') && (studentForm.secondRole || '').startsWith('to_truong_'))
                      ? ''
                      : studentForm.secondRole || '';
                  setStudentForm({ ...studentForm, role: nextPrimary, secondRole: nextSecond });
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              >
                <option value="member">Thành viên lớp</option>
                {ROLES.filter((r) => r.id !== 'gvcn').map((r) => (
                  <option key={r.id} value={r.id}>
                    {ROLE_ID_TO_LABEL[r.id] || r.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Kiêm nhiệm chức vụ 2 (Tối đa 2)</label>
              <select
                value={studentForm.secondRole || ''}
                disabled={studentForm.role === 'member'}
                onChange={(e) => setStudentForm({ ...studentForm, secondRole: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">Không kiêm nhiệm</option>
                {ROLES.filter(
                  (r) =>
                    r.id !== 'gvcn' &&
                    r.id !== studentForm.role &&
                    !(studentForm.role.startsWith('to_truong_') && r.id.startsWith('to_truong_'))
                ).map((r) => (
                  <option key={r.id} value={r.id}>
                    {ROLE_ID_TO_LABEL[r.id] || r.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(() => {
            const roleTeamMismatch = [studentForm.role, studentForm.secondRole || '']
              .filter(isValidOfficerRoleId)
              .map((r) => getTeamNumberFromRole(r))
              .find((t) => t !== null && t !== Number(studentForm.team));
            if (!roleTeamMismatch) return null;
            return (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Lưu ý: Học sinh đang được chọn <strong>Tổ trưởng Tổ {roleTeamMismatch}</strong> nhưng Tổ đang là{' '}
                  <strong>Tổ {studentForm.team}</strong>. Vui lòng đồng bộ lại Tổ trước khi lưu.
                </span>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-amber-50/60 border border-amber-200">
            <div>
              <label className="block text-xs font-bold text-amber-900 mb-1">
                Tên phụ huynh (Bảo mật - Chỉ GVCN)
              </label>
              <input
                type="text"
                value={studentForm.parentName}
                onChange={(e) => setStudentForm({ ...studentForm, parentName: e.target.value })}
                placeholder="VD: Nguyễn Văn A"
                className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-amber-900 mb-1">
                SĐT Phụ huynh (Giữ số 0 đầu)
              </label>
              <input
                type="text"
                value={studentForm.parentPhone}
                onChange={(e) => setStudentForm({ ...studentForm, parentPhone: e.target.value })}
                placeholder="VD: 0912345678"
                className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Ghi chú sư phạm</label>
            <input
              type="text"
              value={studentForm.note}
              onChange={(e) => setStudentForm({ ...studentForm, note: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold"
            >
              Lưu hồ sơ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface Grade12ModalProps {
  student: StudentRecord | null;
  onClose: () => void;
  grade12Form: {
    examBlock: string;
    targetUniversity: string;
    targetMajor: string;
    mockScore1: string;
    mockScore2: string;
    readiness: string;
    teacherNote: string;
  };
  setGrade12Form: React.Dispatch<
    React.SetStateAction<{
      examBlock: string;
      targetUniversity: string;
      targetMajor: string;
      mockScore1: string;
      mockScore2: string;
      readiness: string;
      teacherNote: string;
    }>
  >;
  onSubmit: (e: React.FormEvent) => void;
}

export function Grade12Modal({
  student,
  onClose,
  grade12Form,
  setGrade12Form,
  onSubmit,
}: Grade12ModalProps) {
  if (!student) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-lg text-slate-900">Định hướng Tốt nghiệp & Đại học Lớp 12</h3>
            <p className="text-xs text-slate-500">
              Học sinh: <strong>{student.fullName}</strong> ({student.code})
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3.5 text-sm">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Tổ hợp môn thi / Xét tuyển</label>
            <select
              value={grade12Form.examBlock}
              onChange={(e) => setGrade12Form({ ...grade12Form, examBlock: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            >
              <option value="A00 (Toán - Lý - Hóa)">A00 (Toán - Lý - Hóa)</option>
              <option value="A01 (Toán - Lý - Anh)">A01 (Toán - Lý - Anh)</option>
              <option value="B00 (Toán - Hóa - Sinh)">B00 (Toán - Hóa - Sinh)</option>
              <option value="C00 (Văn - Sử - Địa)">C00 (Văn - Sử - Địa)</option>
              <option value="D01 (Toán - Văn - Anh)">D01 (Toán - Văn - Anh)</option>
              <option value="Đánh giá năng lực / Tư duy">Đánh giá năng lực / Đánh giá tư duy</option>
              <option value="Xét tốt nghiệp & Học nghề">Xét tốt nghiệp & Học nghề</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Ngành nguyện vọng 1</label>
              <input
                type="text"
                placeholder="VD: Sư phạm Toán, CNTT..."
                value={grade12Form.targetMajor}
                onChange={(e) => setGrade12Form({ ...grade12Form, targetMajor: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Trường Đại học / Cao đẳng</label>
              <input
                type="text"
                placeholder="VD: ĐH Bách Khoa, ĐH Sư phạm..."
                value={grade12Form.targetUniversity}
                onChange={(e) => setGrade12Form({ ...grade12Form, targetUniversity: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Điểm thi thử Đợt 1</label>
              <input
                type="text"
                placeholder="VD: 24.5"
                value={grade12Form.mockScore1}
                onChange={(e) => setGrade12Form({ ...grade12Form, mockScore1: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Điểm thi thử Đợt 2</label>
              <input
                type="text"
                placeholder="VD: 25.25"
                value={grade12Form.mockScore2}
                onChange={(e) => setGrade12Form({ ...grade12Form, mockScore2: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Mức độ sẵn sàng xét tuyển</label>
            <select
              value={grade12Form.readiness}
              onChange={(e) => setGrade12Form({ ...grade12Form, readiness: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            >
              <option value="Đạt mục tiêu">Đạt mục tiêu</option>
              <option value="Cần bứt phá">Cần bứt phá</option>
              <option value="Cần phụ đạo tốt nghiệp">Cần phụ đạo tốt nghiệp</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Ghi chú tư vấn của GVCN</label>
            <textarea
              rows={2}
              value={grade12Form.teacherNote}
              onChange={(e) => setGrade12Form({ ...grade12Form, teacherNote: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold"
            >
              Lưu định hướng
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface BatchConfirmModalProps {
  modalData: {
    mode: 'selected' | 'all_eligible';
    eligibleTickets: TicketRecord[];
    excludedTickets: { ticket: TicketRecord; reason: string }[];
    snapshotVersions: Record<string, { status: string; version: number }>;
  } | null;
  classConfig: ClassConfig;
  modFilterType: string;
  modFilterStatus: string;
  isBatchApproving: boolean;
  onClose: () => void;
  onExecute: () => void;
}

export function BatchConfirmModal({
  modalData,
  classConfig,
  modFilterType,
  modFilterStatus,
  isBatchApproving,
  onClose,
  onExecute,
}: BatchConfirmModalProps) {
  if (!modalData) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
          <div>
            <h3 className="font-bold text-lg text-[#102744]">Xác nhận Phê duyệt Phiếu Hàng Loạt</h3>
            <p className="text-xs text-slate-500">
              {classConfig.schoolName} • Lớp {classConfig.className} • Năm học {classConfig.schoolYear}
            </p>
          </div>
          <button
            type="button"
            disabled={isBatchApproving}
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto space-y-4 pr-1 flex-1 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-slate-500 font-semibold">Bộ lọc đang áp dụng</div>
              <div className="font-bold text-slate-900 mt-0.5">
                {modFilterType === 'all'
                  ? 'Tất cả loại phiếu'
                  : TICKET_TYPES[modFilterType as keyof typeof TICKET_TYPES]?.label}{' '}
                ({modFilterStatus})
              </div>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="text-emerald-700 font-semibold">Phiếu đủ điều kiện duyệt</div>
              <div className="text-lg font-extrabold text-emerald-900 mt-0.5">
                {modalData.eligibleTickets.length} phiếu
              </div>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
              <div className="text-amber-800 font-semibold">Phiếu loại ra (Cần xem riêng)</div>
              <div className="text-lg font-extrabold text-amber-950 mt-0.5">
                {modalData.excludedTickets.length} phiếu
              </div>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-3.5 py-2 font-bold text-slate-800">
              Danh sách {modalData.eligibleTickets.length} phiếu sẽ chuyển sang ĐÃ PHÊ DUYỆT:
            </div>
            <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
              {modalData.eligibleTickets.map((tk) => (
                <div key={tk.id} className="px-3.5 py-2 flex items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-900">{tk.studentName}</span>
                    <span className="text-slate-500 ml-1.5">
                      — {tk.typeLabel}: {tk.description}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400 shrink-0">v{tk.version || 1}</span>
                </div>
              ))}
            </div>
          </div>

          {modalData.excludedTickets.length > 0 && (
            <div className="border border-rose-200 rounded-xl overflow-hidden bg-rose-50/40">
              <div className="bg-rose-100/70 px-3.5 py-2 font-bold text-rose-900">
                Các phiếu không duyệt hàng loạt ({modalData.excludedTickets.length} phiếu — Giữ nguyên để GVCN xem riêng):
              </div>
              <div className="max-h-32 overflow-y-auto divide-y divide-rose-100">
                {modalData.excludedTickets.map((item, idx) => (
                  <div key={idx} className="px-3.5 py-2 text-rose-900">
                    <strong>{item.ticket.studentName}:</strong> {item.reason}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950">
            <strong>Cam kết an toàn dữ liệu:</strong> Hệ thống xử lý từng phiếu bằng giao dịch kiểm soát phiên bản (chống duyệt trùng lặp), ghi nhận mã lô <code>batchApprovalId</code> và lưu nhật ký kiểm duyệt bất biến.
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
          <button
            type="button"
            disabled={isBatchApproving}
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={isBatchApproving}
            onClick={onExecute}
            className="px-5 py-2 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs"
          >
            {isBatchApproving
              ? 'Đang phê duyệt an toàn...'
              : `Xác nhận duyệt ${modalData.eligibleTickets.length} phiếu`}
          </button>
        </div>
      </div>
    </div>
  );
}

interface BulkStudentModalProps {
  open: boolean;
  onClose: () => void;
  classConfig: ClassConfig;
  bulkFileName: string;
  bulkSheetNames: string[];
  bulkSelectedSheet: string;
  onSelectSheet: (sheetName: string) => void;
  bulkHeaders: string[];
  bulkColumnMapping: StudentColumnMapping;
  columnMappingWarnings?: string[];
  onChangeMapping: (field: StudentExcelColumnKey, colIndex: number) => void;
  onReconcileAgain: () => void;
  bulkStudentText: string;
  onBulkTextChange: (val: string) => void;
  onBulkExcelUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  analysis: StudentImportAnalysis;
  onToggleAllRoleProposals: (apply: boolean) => void;
  onToggleRowRoleProposal: (excelRowNumber: number, apply: boolean) => void;
  onUpdateRowTeam: (excelRowNumber: number, team: number) => void;
  onSetRowResolution: (excelRowNumber: number, action: LegacyResolutionAction) => void;
  isSavingBulkStudents: boolean;
  onSaveBulkStudents: () => void;
}

const COLUMN_KEYS_ORDER: StudentExcelColumnKey[] = [
  'stt',
  'fullName',
  'gender',
  'dob',
  'parentName',
  'parentPhone',
  'moetCode',
  'team',
  'role',
];

export function BulkStudentModal({
  open,
  onClose,
  classConfig,
  bulkFileName,
  bulkSheetNames,
  bulkSelectedSheet,
  onSelectSheet,
  bulkHeaders,
  bulkColumnMapping,
  columnMappingWarnings = [],
  onChangeMapping,
  onReconcileAgain,
  bulkStudentText,
  onBulkTextChange,
  onBulkExcelUpload,
  analysis,
  onToggleAllRoleProposals,
  onToggleRowRoleProposal,
  onUpdateRowTeam,
  onSetRowResolution,
  isSavingBulkStudents,
  onSaveBulkStudents,
}: BulkStudentModalProps) {
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'errors' | 'warnings' | 'matched' | 'changed' | 'new' | 'needs_verification' | 'roles'
  >('all');
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [mappingOpenManual, setMappingOpenManual] = useState<boolean | null>(null);
  const [expandedRowNumber, setExpandedRowNumber] = useState<number | null>(null);

  if (!open) return null;

  const { items, missingExistingStudents, globalErrors, globalWarnings, summary } = analysis;
  const combinedGlobalWarnings = [...columnMappingWarnings, ...globalWarnings];
  const needsMappingAttention =
    bulkColumnMapping.fullName < 0 ||
    bulkColumnMapping.moetCode < 0 ||
    columnMappingWarnings.length > 0;
  const showColumnMapping = mappingOpenManual !== null ? mappingOpenManual : needsMappingAttention;

  const filteredItems = items.filter((item) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'errors') return item.hasBlockingError;
    if (statusFilter === 'warnings') return item.hasWarning;
    if (statusFilter === 'roles') {
      return (
        item.proposedRoles.length > 0 ||
        item.currentRoles.length > 0 ||
        item.hasAmbiguousRole ||
        Boolean(item.roleRaw.trim())
      );
    }
    return item.status === statusFilter;
  });

  const confirmedRoleProposalCount = items.filter(
    (i) => i.applyRoleProposal && i.proposedRoles.length > 0
  ).length;
  const roleRowCount = items.filter(
    (i) => i.proposedRoles.length > 0 || i.currentRoles.length > 0 || i.hasAmbiguousRole
  ).length;
  const activeImportCount = items.filter((i) => i.resolution.type !== 'skip').length;
  const hasBlockingErrors = summary.blockingErrorCount > 0;

  const statusBadge = (status: 'matched' | 'changed' | 'new' | 'needs_verification') => {
    switch (status) {
      case 'matched':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px]">
            <CheckCircle2 className="w-3 h-3 shrink-0" /> Trùng khớp
          </span>
        );
      case 'changed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200 font-bold text-[11px]">
            Có thay đổi
          </span>
        );
      case 'new':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 font-bold text-[11px]">
            Học sinh mới
          </span>
        );
      case 'needs_verification':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-300 font-bold text-[11px]">
            <ShieldAlert className="w-3 h-3 shrink-0" /> Cần GVCN xử lý
          </span>
        );
    }
  };

  const renderParentCell = (item: StudentImportAnalysis['items'][number]) => {
    if (item.hasParentMissingWarning && !item.parentName && !item.parentPhone) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-300 font-semibold text-[11px]">
          <AlertTriangle className="w-3 h-3 shrink-0 text-amber-600" />
          Chưa cập nhật thông tin phụ huynh
        </span>
      );
    }
    return (
      <div className="space-y-0.5">
        {item.parentName ? (
          <div className="font-semibold text-slate-800">{item.parentName}</div>
        ) : (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-semibold">
            <AlertTriangle className="w-3 h-3 shrink-0 text-amber-600" />
            Chưa có tên PH
          </span>
        )}
        {item.hasParentInvalidWarning && (
          <div className="text-[10px] text-amber-800 font-semibold">
            Cần kiểm tra định dạng PH
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5">
      <div className="bg-white rounded-2xl max-w-7xl w-full p-3.5 sm:p-6 shadow-2xl space-y-3 sm:space-y-4 max-h-[96vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-3 shrink-0 gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-base sm:text-lg text-[#102744] flex items-center gap-2 leading-snug">
              <FileSpreadsheet className="w-5 h-5 text-teal-600 shrink-0" />
              <span className="truncate">
                Nhập &amp; Đối chiếu Excel — Lớp {classConfig.className}
              </span>
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 leading-relaxed">
              Định danh theo Mã MOET (giữ nguyên số 0 đầu), giữ thứ tự STT Excel, không tự gộp theo tên. Thiếu Tên/SĐT phụ huynh hoặc chưa phân tổ chỉ là <strong>cảnh báo nhẹ</strong>, vẫn cho phép nhập.
            </p>
          </div>
          <button
            type="button"
            disabled={isSavingBulkStudents}
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 shrink-0"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto space-y-3 sm:space-y-4 pr-0.5 sm:pr-1 flex-1 min-h-0">
          {/* Upload, Sheet Picker & Reconcile Again */}
          <div className="bg-slate-50 p-3 sm:p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <label className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-xs">
                <Upload className="w-3.5 h-3.5 shrink-0" />
                <span>Chọn file Excel (.xlsx / .xls / .csv)</span>
                <input
                  type="file"
                  accept=".xls,.xlsx,.csv,.txt"
                  onChange={onBulkExcelUpload}
                  className="hidden"
                />
              </label>

              {bulkFileName && (
                <span className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 max-w-full truncate">
                  Tệp: <strong>{bulkFileName}</strong>
                </span>
              )}

              {bulkSheetNames.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-semibold text-slate-600">Sheet:</span>
                  <select
                    value={bulkSelectedSheet}
                    onChange={(e) => onSelectSheet(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800 max-w-[180px]"
                  >
                    {bulkSheetNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {bulkHeaders.length > 0 && (
                <button
                  type="button"
                  onClick={onReconcileAgain}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-xs font-bold text-[#102744] inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-teal-600" />
                  <span>Đối chiếu lại</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowPasteBox((v) => !v)}
                className="text-xs font-semibold text-indigo-700 hover:underline px-1 py-1"
              >
                {showPasteBox ? 'Ẩn ô dán CSV/TSV' : 'Hoặc dán bảng CSV / Excel'}
              </button>
            </div>
          </div>

          {showPasteBox && (
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Dán bảng dữ liệu từ Excel / CSV (dòng đầu là tiêu đề 9 cột)
              </label>
              <textarea
                rows={4}
                value={bulkStudentText}
                onChange={(e) => onBulkTextChange(e.target.value)}
                placeholder={`STT\tHọ tên\tGiới tính\tNgày sinh\tTên phụ huynh\tSĐT phụ huynh\tMã MOET\tTổ\tChức vụ`}
                className="w-full p-3 rounded-xl border border-slate-300 font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
              />
            </div>
          )}

          {/* Collapsible Column Mapping Bar */}
          {bulkHeaders.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setMappingOpenManual(!showColumnMapping)}
                className="w-full px-3.5 py-2.5 bg-slate-50/70 hover:bg-slate-100/70 flex items-center justify-between gap-2 text-left"
              >
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-[#102744]">
                    Ánh xạ 9 cột dữ liệu ({bulkHeaders.length} cột trong sheet)
                  </span>
                  {columnMappingWarnings.length > 0 ? (
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                      {columnMappingWarnings.length} cảnh báo lệch cột
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                      Đã nhận diện tự động — Nhấn để chỉnh tay
                    </span>
                  )}
                </div>
                {showColumnMapping ? (
                  <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                )}
              </button>

              {showColumnMapping && (
                <div className="p-3.5 border-t border-slate-200 space-y-2.5">
                  <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-2">
                    {COLUMN_KEYS_ORDER.map((fieldKey) => (
                      <div key={fieldKey}>
                        <label className="block text-[11px] font-bold text-slate-600 mb-0.5 truncate">
                          {STUDENT_COLUMN_LABELS[fieldKey]}
                          {(fieldKey === 'fullName' || fieldKey === 'moetCode') && (
                            <span className="text-rose-600"> *</span>
                          )}
                        </label>
                        <select
                          value={bulkColumnMapping[fieldKey]}
                          onChange={(e) => onChangeMapping(fieldKey, Number(e.target.value))}
                          className={`w-full px-2 py-1.5 rounded-lg border text-xs bg-white ${
                            bulkColumnMapping[fieldKey] >= 0
                              ? 'border-teal-300 bg-teal-50/40 font-semibold text-slate-800'
                              : fieldKey === 'fullName' || fieldKey === 'moetCode'
                                ? 'border-rose-300 bg-rose-50/40 text-rose-700'
                                : 'border-slate-300 text-slate-500'
                          }`}
                        >
                          <option value={-1}>-- Không có / Bỏ qua --</option>
                          {bulkHeaders.map((h, idx) => (
                            <option key={idx} value={idx}>
                              Cột {String.fromCharCode(65 + idx)}: {h}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Chỉ <strong>Họ tên (*)</strong> và <strong>Mã MOET (*)</strong> là bắt buộc. Các cột Tên phụ huynh, SĐT phụ huynh, Tổ, Chức vụ có thể để trống hoặc bổ sung sau khi nhập.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Global Blocking Errors */}
          {globalErrors.length > 0 && (
            <div className="p-3 sm:p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-rose-950">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Lỗi nghiêm trọng cần xử lý trước khi xác nhận nhập:</span>
              </div>
              {globalErrors.map((err, i) => (
                <div key={i}>• {err}</div>
              ))}
            </div>
          )}

          {/* Global Non-Blocking Warnings */}
          {combinedGlobalWarnings.length > 0 && (
            <div className="p-3 sm:p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Cảnh báo nhẹ (không chặn nhập — GVCN kiểm tra hoặc bổ sung sau):</span>
              </div>
              {combinedGlobalWarnings.map((w, i) => (
                <div key={i}>• {w}</div>
              ))}
            </div>
          )}

          {/* Result Summary Strip + Filter Bar */}
          {items.length > 0 && (
            <>
              {/* 3 Primary Status KPI Cards: Read / Blocking Errors / Warnings */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-emerald-800">Học sinh đọc thành công</div>
                    <div className="text-[11px] text-emerald-700 mt-0.5">
                      {summary.newCount} mới • {summary.changedCount} cập nhật • {summary.matchedCount} trùng khớp
                    </div>
                  </div>
                  <div className="text-xl font-extrabold text-emerald-900 shrink-0">
                    {summary.totalRows} HS
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setStatusFilter(summary.errorRowCount > 0 ? 'errors' : 'all')}
                  className={`p-3 rounded-xl border text-left flex items-center justify-between gap-2 transition ${
                    hasBlockingErrors
                      ? statusFilter === 'errors'
                        ? 'bg-rose-700 text-white border-rose-700'
                        : 'bg-rose-50 border-rose-300 text-rose-950 hover:bg-rose-100'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-bold">Lỗi nghiêm trọng (chặn nhập)</div>
                    <div className="text-[11px] opacity-85 mt-0.5">
                      {hasBlockingErrors
                        ? `${summary.errorRowCount} dòng cần sửa trước khi lưu`
                        : 'Không có lỗi chặn — Sẵn sàng nhập'}
                    </div>
                  </div>
                  <div className="text-xl font-extrabold shrink-0">
                    {summary.blockingErrorCount}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter(summary.warningRowCount > 0 ? 'warnings' : 'all')}
                  className={`p-3 rounded-xl border text-left flex items-center justify-between gap-2 transition ${
                    summary.warningRowCount > 0
                      ? statusFilter === 'warnings'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-amber-50 border-amber-300 text-amber-950 hover:bg-amber-100'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-bold">Cảnh báo (vẫn được nhập)</div>
                    <div className="text-[11px] opacity-85 mt-0.5">
                      {summary.parentMissingWarningCount > 0 && (
                        <span>{summary.parentMissingWarningCount} chưa có PH</span>
                      )}
                      {summary.parentMissingWarningCount > 0 && summary.unassignedTeamCount > 0 && ' • '}
                      {summary.unassignedTeamCount > 0 && (
                        <span>{summary.unassignedTeamCount} chưa phân tổ</span>
                      )}
                      {summary.parentMissingWarningCount === 0 &&
                        summary.unassignedTeamCount === 0 &&
                        (summary.warningRowCount > 0
                          ? `${summary.warningRowCount} dòng có lưu ý nhẹ`
                          : 'Không có cảnh báo')}
                    </div>
                  </div>
                  <div className="text-xl font-extrabold shrink-0">
                    {summary.warningRowCount} HS
                  </div>
                </button>
              </div>

              {/* Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {(
                  [
                    { id: 'all', label: 'Xem tất cả', count: items.length, activeCls: 'bg-slate-900 text-white border-slate-900' },
                    { id: 'errors', label: 'Chỉ xem lỗi', count: summary.errorRowCount, activeCls: 'bg-rose-700 text-white border-rose-700' },
                    { id: 'warnings', label: 'Chỉ xem cảnh báo', count: summary.warningRowCount, activeCls: 'bg-amber-600 text-white border-amber-600' },
                    { id: 'new', label: 'Học sinh mới', count: summary.newCount, activeCls: 'bg-indigo-700 text-white border-indigo-700' },
                    { id: 'changed', label: 'Có thay đổi', count: summary.changedCount, activeCls: 'bg-sky-700 text-white border-sky-700' },
                    { id: 'matched', label: 'Trùng khớp', count: summary.matchedCount, activeCls: 'bg-emerald-700 text-white border-emerald-700' },
                    { id: 'roles', label: 'Có chức vụ lớp', count: roleRowCount, activeCls: 'bg-[#102744] text-white border-[#102744]' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStatusFilter(f.id)}
                    className={`px-2.5 py-1.5 rounded-lg border font-bold transition ${
                      statusFilter === f.id
                        ? f.activeCls
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {f.label} ({f.count})
                  </button>
                ))}
              </div>

              {/* Team distribution + Role proposal confirmation */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-[#102744] flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Phân tổ trong file:</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[1, 2, 3, 4].map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 font-bold text-slate-800"
                      >
                        Tổ {t}: {summary.teamCounts[t as 1 | 2 | 3 | 4]}
                      </span>
                    ))}
                    {summary.unassignedTeamCount > 0 && (
                      <span className="px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-300 font-bold text-amber-900">
                        Chưa phân tổ: {summary.unassignedTeamCount}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-indigo-950 space-y-0.5">
                    <div className="font-bold">
                      Nhận diện Chức vụ từ Excel: {summary.roleProposalCount} HS (áp dụng:{' '}
                      {confirmedRoleProposalCount}/{summary.roleProposalCount})
                      {summary.roleChangedCount > 0 && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px]">
                          {summary.roleChangedCount} khác hiện tại
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-indigo-800">
                      Ô trống không xóa chức vụ cũ; khai báo chức vụ từ Excel không tự cấp tài khoản đăng nhập.
                    </div>
                  </div>
                  {summary.roleProposalCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onToggleAllRoleProposals(true)}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                      >
                        Áp dụng tất cả
                      </button>
                      {confirmedRoleProposalCount > 0 && (
                        <button
                          type="button"
                          onClick={() => onToggleAllRoleProposals(false)}
                          className="px-2.5 py-1.5 rounded-lg bg-white border border-indigo-300 text-indigo-800 font-semibold"
                        >
                          Bỏ chọn
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Preview & Reconciliation Container */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-3 sm:px-3.5 py-2 text-xs font-bold text-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Danh sách xem trước &amp; đối chiếu ({filteredItems.length}/{items.length} học sinh)
                  </span>
                  {summary.parentMissingWarningCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-amber-900 bg-amber-100/80 border border-amber-300 px-2 py-0.5 rounded-md font-semibold text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      {summary.parentMissingWarningCount} hồ sơ cần bổ sung thông tin phụ huynh (vẫn được nhập)
                    </span>
                  )}
                </div>

                {/* MOBILE CARD LIST (visible < md) */}
                <div className="md:hidden divide-y divide-slate-200 max-h-[45vh] overflow-y-auto bg-white">
                  {filteredItems.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      Không có hồ sơ nào phù hợp bộ lọc hiện tại.
                    </div>
                  ) : (
                    filteredItems.map((item) => {
                      const isSkipped = item.resolution.type === 'skip';
                      const isExpanded = expandedRowNumber === item.excelRowNumber;
                      return (
                        <div
                          key={item.excelRowNumber}
                          className={`p-3 space-y-2 text-xs ${
                            isSkipped
                              ? 'bg-slate-100/70 opacity-60'
                              : item.hasBlockingError
                                ? 'bg-rose-50/70'
                                : item.hasWarning
                                  ? 'bg-amber-50/35'
                                  : 'bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[11px] font-bold text-slate-700">
                                  #{item.stt || item.excelRowNumber}
                                </span>
                                <span className="font-bold text-slate-900 text-sm truncate">
                                  {item.fullName || '—'}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                                MOET:{' '}
                                {item.moetCode ? (
                                  <strong className="text-indigo-900">{item.moetCode}</strong>
                                ) : (
                                  <span className="text-rose-600 font-bold">Thiếu</span>
                                )}
                                {' • '}
                                {item.team >= 1 && item.team <= 4 ? `Tổ ${item.team}` : 'Chưa phân tổ'}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedRowNumber(isExpanded ? null : item.excelRowNumber)
                              }
                              className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-[11px] font-semibold text-slate-700 inline-flex items-center gap-1 shrink-0"
                            >
                              <Eye className="w-3 h-3" />
                              {isExpanded ? 'Thu gọn' : 'Chi tiết'}
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {statusBadge(item.status)}
                            {item.hasBlockingError && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold">
                                {item.errors.length} lỗi chặn
                              </span>
                            )}
                            {item.hasParentMissingWarning && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-semibold">
                                Chưa cập nhật thông tin phụ huynh
                              </span>
                            )}
                            {item.hasUnassignedTeamWarning && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-semibold">
                                Chưa phân tổ
                              </span>
                            )}
                          </div>

                          {item.errors.length > 0 && (
                            <div className="space-y-0.5 bg-rose-50 border border-rose-200 rounded-lg p-2">
                              {item.errors.map((err, i) => (
                                <div key={i} className="text-[11px] font-bold text-rose-700">
                                  • Lỗi: {err}
                                </div>
                              ))}
                            </div>
                          )}

                          {isExpanded && (
                            <div className="pt-2 border-t border-slate-200 space-y-2 text-[11px]">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <span className="text-slate-500 block">Giới tính / Ngày sinh</span>
                                  <strong>
                                    {item.gender} • {item.dob || '—'}
                                  </strong>
                                </div>
                                <div>
                                  <span className="text-slate-500 block">Phân tổ</span>
                                  <select
                                    value={item.team}
                                    onChange={(e) =>
                                      onUpdateRowTeam(item.excelRowNumber, Number(e.target.value))
                                    }
                                    className="mt-0.5 w-full px-2 py-1 rounded border border-slate-300 bg-white font-semibold"
                                  >
                                    <option value={0}>Chưa phân tổ</option>
                                    <option value={1}>Tổ 1</option>
                                    <option value={2}>Tổ 2</option>
                                    <option value={3}>Tổ 3</option>
                                    <option value={4}>Tổ 4</option>
                                  </select>
                                </div>
                                <div className="col-span-2">
                                  <span className="text-slate-500 block">Phụ huynh &amp; SĐT</span>
                                  {item.parentName || item.parentPhone ? (
                                    <div>
                                      <strong>{item.parentName || 'Chưa có tên PH'}</strong>
                                      {' • '}
                                      <span className="font-mono">{item.parentPhone || 'Chưa có SĐT'}</span>
                                    </div>
                                  ) : (
                                    <span className="text-amber-800 font-semibold">
                                      Chưa cập nhật thông tin phụ huynh
                                    </span>
                                  )}
                                </div>
                              </div>

                              {item.proposedRoles.length > 0 && (
                                <label className="flex items-center gap-2 p-2 rounded-lg bg-indigo-50 border border-indigo-200">
                                  <input
                                    type="checkbox"
                                    checked={item.applyRoleProposal}
                                    onChange={(e) =>
                                      onToggleRowRoleProposal(item.excelRowNumber, e.target.checked)
                                    }
                                  />
                                  <span>
                                    Áp dụng chức vụ Excel:{' '}
                                    <strong>{item.proposedRoleLabel}</strong>
                                  </span>
                                </label>
                              )}

                              {item.warnings.length > 0 && (
                                <div className="space-y-0.5 bg-amber-50 border border-amber-200 rounded-lg p-2 text-amber-900">
                                  {item.warnings.map((w, i) => (
                                    <div key={i}>• {w}</div>
                                  ))}
                                </div>
                              )}

                              {item.legacyCandidates.length > 0 && !item.matchedExisting && (
                                <div className="p-2 rounded-lg bg-amber-50 border border-amber-300 space-y-1">
                                  <div className="font-bold text-amber-950">
                                    Hồ sơ cũ trùng tên chưa có Mã MOET — Chọn hướng xử lý:
                                  </div>
                                  <select
                                    value={
                                      item.resolution.type === 'link'
                                        ? `link:${item.resolution.existingId}`
                                        : item.resolution.type
                                    }
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val.startsWith('link:')) {
                                        onSetRowResolution(item.excelRowNumber, {
                                          type: 'link',
                                          existingId: val.slice(5),
                                        });
                                      } else if (val === 'create_new' || val === 'skip') {
                                        onSetRowResolution(item.excelRowNumber, { type: val });
                                      } else {
                                        onSetRowResolution(item.excelRowNumber, { type: 'auto' });
                                      }
                                    }}
                                    className="w-full px-2 py-1.5 rounded border border-amber-400 bg-white font-semibold"
                                  >
                                    <option value="auto">-- Chọn hướng xử lý --</option>
                                    {item.legacyCandidates.map((cand) => (
                                      <option key={cand.id} value={`link:${cand.id}`}>
                                        Gắn MOET vào {cand.code} ({cand.fullName})
                                      </option>
                                    ))}
                                    <option value="create_new">
                                      Tạo hồ sơ mới độc lập ({item.moetCode})
                                    </option>
                                    <option value="skip">Bỏ qua dòng này</option>
                                  </select>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* DESKTOP TABLE (visible >= md) */}
                <div className="hidden md:block max-h-80 overflow-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-[11px] text-slate-600 uppercase">
                      <tr>
                        <th className="py-2 px-2.5">STT</th>
                        <th className="py-2 px-2.5">Mã MOET</th>
                        <th className="py-2 px-2.5 min-w-[155px]">Họ tên HS</th>
                        <th className="py-2 px-2.5">Tổ</th>
                        <th className="py-2 px-2.5 min-w-[170px]">Chức vụ Excel</th>
                        <th className="py-2 px-2.5 min-w-[130px]">Chức vụ hiện tại</th>
                        <th className="py-2 px-2.5 min-w-[235px]">Trạng thái &amp; đối chiếu</th>
                        <th className="py-2 px-2.5">Giới tính</th>
                        <th className="py-2 px-2.5">Ngày sinh</th>
                        <th className="py-2 px-2.5 min-w-[175px]">Tên phụ huynh</th>
                        <th className="py-2 px-2.5">SĐT phụ huynh</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="py-8 text-center text-slate-500">
                            Không có hồ sơ nào phù hợp bộ lọc hiện tại.
                          </td>
                        </tr>
                      ) : (
                        filteredItems.map((item) => {
                          const isSkipped = item.resolution.type === 'skip';
                          return (
                            <tr
                              key={item.excelRowNumber}
                              className={
                                isSkipped
                                  ? 'bg-slate-100/70 opacity-60'
                                  : item.hasBlockingError
                                    ? 'bg-rose-50/70'
                                    : item.hasWarning
                                      ? 'bg-amber-50/35'
                                      : ''
                              }
                            >
                              <td className="py-2 px-2.5 font-mono text-slate-500">
                                {item.stt || item.excelRowNumber}
                              </td>
                              <td className="py-2 px-2.5 font-mono font-bold text-indigo-900">
                                {item.moetCode || <span className="text-rose-600">Thiếu</span>}
                              </td>
                              <td className="py-2 px-2.5 font-bold text-slate-900">
                                <div>{item.fullName || '—'}</div>
                                {item.duplicateNameCount > 1 && (
                                  <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-semibold">
                                    Trùng tên ({item.duplicateNameCount} HS) — Tách theo MOET
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-2.5">
                                <select
                                  value={item.team}
                                  onChange={(e) =>
                                    onUpdateRowTeam(item.excelRowNumber, Number(e.target.value))
                                  }
                                  className={`px-1.5 py-1 rounded border bg-white font-semibold ${
                                    item.team >= 1 && item.team <= 4
                                      ? 'border-slate-200 text-slate-800'
                                      : 'border-amber-300 bg-amber-50 text-amber-900'
                                  }`}
                                >
                                  <option value={0}>Chưa phân tổ</option>
                                  <option value={1}>Tổ 1</option>
                                  <option value={2}>Tổ 2</option>
                                  <option value={3}>Tổ 3</option>
                                  <option value={4}>Tổ 4</option>
                                </select>
                              </td>
                              <td className="py-2 px-2.5">
                                {item.proposedRoles.length > 0 ? (
                                  <div className="space-y-1">
                                    <label className="flex items-start gap-1.5 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={item.applyRoleProposal}
                                        onChange={(e) =>
                                          onToggleRowRoleProposal(
                                            item.excelRowNumber,
                                            e.target.checked
                                          )
                                        }
                                        className="mt-0.5 rounded border-indigo-400 text-indigo-600"
                                      />
                                      <div className="flex flex-wrap gap-1">
                                        {item.proposedRoles.map((rId) => (
                                          <span
                                            key={rId}
                                            className={`inline-flex px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                              item.applyRoleProposal
                                                ? ROLE_BADGE_CLASSES[rId] ||
                                                  'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                                : 'bg-slate-100 text-slate-500 border border-slate-200 line-through'
                                            }`}
                                          >
                                            {ROLE_ID_TO_LABEL[rId] || rId}
                                          </span>
                                        ))}
                                      </div>
                                    </label>
                                    {item.roleRaw &&
                                      item.roleRaw.trim().toLowerCase() !==
                                        item.proposedRoleLabel.trim().toLowerCase() && (
                                        <div className="text-[10px] text-slate-500 pl-5">
                                          Gốc trong Excel: &ldquo;{item.roleRaw}&rdquo;
                                        </div>
                                      )}
                                  </div>
                                ) : item.roleRaw ? (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-semibold text-[11px]">
                                      {item.roleRaw}
                                    </span>
                                    {item.hasAmbiguousRole && (
                                      <div className="text-[10px] text-amber-800">
                                        Chưa chuẩn hóa — cảnh báo nhẹ
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400">
                                    {item.currentRoles.length > 0 ? 'Trống (giữ nguyên)' : 'Trống'}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-2.5">
                                {item.currentRoles.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {item.currentRoles.map((rId) => (
                                      <span
                                        key={rId}
                                        className={`inline-flex px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                          ROLE_BADGE_CLASSES[rId] ||
                                          'bg-slate-100 text-slate-700 border border-slate-200'
                                        }`}
                                      >
                                        {ROLE_ID_TO_LABEL[rId] || rId}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="inline-flex px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[11px] font-medium">
                                    {item.matchedExisting ? 'Thành viên' : 'Hồ sơ mới'}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-2.5 space-y-1">
                                <div className="flex flex-wrap items-center gap-1">
                                  {statusBadge(item.status)}
                                  {item.roleReconciliationStatus === 'proposed_new' &&
                                    item.applyRoleProposal && (
                                      <span className="inline-flex px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold">
                                        Sẽ gán chức vụ từ Excel
                                      </span>
                                    )}
                                  {item.roleReconciliationStatus === 'unchanged' && (
                                    <span className="inline-flex px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                      Khớp chức vụ
                                    </span>
                                  )}
                                  {item.roleReconciliationStatus === 'kept_existing' && (
                                    <span className="inline-flex px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
                                      Giữ chức vụ cũ
                                    </span>
                                  )}
                                  {item.roleReconciliationStatus === 'changed' && (
                                    <span className="inline-flex px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                                      {item.applyRoleProposal
                                        ? 'Đã xác nhận đổi chức vụ'
                                        : 'Khác chức vụ cũ'}
                                    </span>
                                  )}
                                </div>

                                {item.diffs.length > 0 && (
                                  <div className="space-y-0.5 text-[11px] bg-sky-50 border border-sky-200 rounded p-1.5">
                                    {item.diffs.map((d) => (
                                      <div key={d.field}>
                                        <strong>{d.label}:</strong>{' '}
                                        <span className="line-through text-slate-400">
                                          {d.oldValue}
                                        </span>{' '}
                                        →{' '}
                                        <span className="font-bold text-sky-900">
                                          {d.newValue}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {item.errors.map((err, i) => (
                                  <div key={i} className="text-[11px] font-bold text-rose-700">
                                    • Lỗi: {err}
                                  </div>
                                ))}

                                {item.warnings.map((w, i) => (
                                  <div key={i} className="text-[11px] text-amber-800">
                                    • Cảnh báo: {w}
                                  </div>
                                ))}

                                {item.legacyCandidates.length > 0 && !item.matchedExisting && (
                                  <div className="p-1.5 rounded bg-amber-50 border border-amber-300 space-y-1">
                                    <div className="text-[11px] font-bold text-amber-950">
                                      Tìm thấy hồ sơ cũ chưa có Mã MOET trùng tên — Cần GVCN xác nhận:
                                    </div>
                                    <select
                                      value={
                                        item.resolution.type === 'link'
                                          ? `link:${item.resolution.existingId}`
                                          : item.resolution.type
                                      }
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val.startsWith('link:')) {
                                          onSetRowResolution(item.excelRowNumber, {
                                            type: 'link',
                                            existingId: val.slice(5),
                                          });
                                        } else if (val === 'create_new' || val === 'skip') {
                                          onSetRowResolution(item.excelRowNumber, { type: val });
                                        } else {
                                          onSetRowResolution(item.excelRowNumber, { type: 'auto' });
                                        }
                                      }}
                                      className="w-full px-2 py-1 rounded border border-amber-400 bg-white text-[11px] font-semibold"
                                    >
                                      <option value="auto">-- Chọn hướng xử lý --</option>
                                      {item.legacyCandidates.map((cand) => (
                                        <option key={cand.id} value={`link:${cand.id}`}>
                                          Gắn MOET vào hồ sơ cũ {cand.code} ({cand.fullName} - Tổ{' '}
                                          {cand.team})
                                        </option>
                                      ))}
                                      <option value="create_new">
                                        Tạo hồ sơ mới độc lập ({item.moetCode})
                                      </option>
                                      <option value="skip">Bỏ qua dòng này</option>
                                    </select>
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-2.5 text-slate-700">{item.gender}</td>
                              <td className="py-2 px-2.5 font-mono text-slate-700">
                                {item.dob || '—'}
                              </td>
                              <td className="py-2 px-2.5">{renderParentCell(item)}</td>
                              <td className="py-2 px-2.5 font-mono text-slate-700">
                                {item.parentPhone || (
                                  <span className="text-slate-400 font-sans">Chưa có</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Missing in File Existing Students */}
          {missingExistingStudents.length > 0 && items.length > 0 && (
            <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 border border-slate-300 space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-slate-900">
                  Hồ sơ cũ không xuất hiện trong file ({missingExistingStudents.length} học sinh)
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
                  Được giữ nguyên an toàn — Không tự động xóa khỏi lớp
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {missingExistingStudents.map((st) => (
                  <span
                    key={st.id}
                    className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700"
                  >
                    {st.fullName} ({st.moetCode || st.code} •{' '}
                    {st.team >= 1 && st.team <= 4 ? `Tổ ${st.team}` : 'Chưa phân tổ'})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-200 shrink-0">
          <div className="text-xs text-slate-600 leading-snug">
            {items.length > 0 ? (
              hasBlockingErrors ? (
                <span className="text-rose-700 font-bold">
                  Còn {summary.blockingErrorCount} lỗi nghiêm trọng cần xử lý trước khi nhập vào Firestore.
                </span>
              ) : summary.warningRowCount > 0 ? (
                <span>
                  Sẵn sàng nhập <strong>{activeImportCount}</strong> học sinh vào lớp{' '}
                  <strong>{classConfig.className}</strong> ({summary.warningRowCount} cảnh báo nhẹ, có thể bổ sung sau).
                </span>
              ) : (
                <span>
                  Sẵn sàng ghi nhận <strong>{activeImportCount}</strong> học sinh (bảo vệ riêng Tên &amp; SĐT phụ huynh trong <code>student_pii</code>).
                </span>
              )
            ) : (
              <span>Vui lòng tải file Excel danh sách lớp để xem trước và đối chiếu.</span>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              disabled={isSavingBulkStudents}
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={isSavingBulkStudents || activeImportCount === 0 || hasBlockingErrors}
              onClick={onSaveBulkStudents}
              className="px-4 sm:px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs"
            >
              {isSavingBulkStudents
                ? 'Đang lưu vào Firestore...'
                : 'XÁC NHẬN NHẬP DANH SÁCH'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface AdjustRankModalProps {
  adjustModalData: {
    studentCode: string;
    studentName: string;
    team: number;
    oldRank: EmulationRank;
  } | null;
  selectedEmulationWeek: string;
  adjustNewRank: EmulationRank;
  setAdjustNewRank: (rank: EmulationRank) => void;
  adjustReason: string;
  setAdjustReason: (reason: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function AdjustRankModal({
  adjustModalData,
  selectedEmulationWeek,
  adjustNewRank,
  setAdjustNewRank,
  adjustReason,
  setAdjustReason,
  onClose,
  onSubmit,
}: AdjustRankModalProps) {
  if (!adjustModalData) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-lg text-[#102744]">Điều chỉnh xếp loại đã chốt</h3>
            <p className="text-xs text-slate-500">
              {selectedEmulationWeek} • {adjustModalData.studentName} ({adjustModalData.studentCode})
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3.5 text-sm">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
            <span className="text-slate-600">Xếp loại hiện tại:</span>
            <span className="font-extrabold text-slate-900">Loại {adjustModalData.oldRank}</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Xếp loại mới</label>
            <select
              value={adjustNewRank}
              onChange={(e) => setAdjustNewRank(e.target.value as EmulationRank)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
            >
              <option value="A">Loại A</option>
              <option value="B">Loại B</option>
              <option value="C">Loại C</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">
              Lý do điều chỉnh (Bắt buộc — Lưu lịch sử vĩnh viễn)
            </label>
            <textarea
              required
              rows={3}
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="VD: Bổ sung minh chứng đã khắc phục vi phạm và tham gia trực nhật tốt..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 text-white font-semibold"
            >
              Xác nhận điều chỉnh
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ConfirmDeleteAllStudentsModalProps {
  open: boolean;
  totalStudents: number;
  classNameLabel: string;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteAllStudentsModal({
  open,
  totalStudents,
  classNameLabel,
  isDeleting,
  onClose,
  onConfirm,
}: ConfirmDeleteAllStudentsModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-bold text-lg text-rose-700">Xác nhận xóa tất cả học sinh</h3>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-sm text-slate-700 space-y-2">
          <p>
            Bạn có chắc chắn muốn xóa toàn bộ <strong>{totalStudents} học sinh</strong> trong danh sách Lớp{' '}
            <strong>{classNameLabel}</strong> không?
          </p>
          <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
            Thao tác này sẽ xóa toàn bộ hồ sơ học sinh và SĐT phụ huynh bảo mật của lớp hiện tại trên Cloud Firestore và không thể hoàn tác.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold"
          >
            {isDeleting ? 'Đang xóa danh sách...' : `Xóa tất cả (${totalStudents} HS)`}
          </button>
        </div>
      </div>
    </div>
  );
}
