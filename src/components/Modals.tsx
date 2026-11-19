import React, { useState } from 'react';
import {
  X,
  Upload,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { ROLES, TICKET_TYPES } from '../constants/gvcnConstants';
import type {
  ClassConfig,
  EmulationRank,
  StudentRecord,
  TicketRecord,
} from '../types/gvcn';
import {
  STUDENT_COLUMN_LABELS,
  formatDobToDmy,
  formatDobToInputDate,
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
                onChange={(e) => setStudentForm({ ...studentForm, role: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              >
                <option value="member">Thành viên lớp</option>
                {ROLES.filter((r) => r.id !== 'gvcn').map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Kiêm nhiệm chức vụ 2 (Tối đa 2)</label>
              <select
                value={studentForm.secondRole || ''}
                onChange={(e) => setStudentForm({ ...studentForm, secondRole: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              >
                <option value="">Không kiêm nhiệm</option>
                {ROLES.filter((r) => r.id !== 'gvcn' && r.id !== studentForm.role).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

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
  onChangeMapping: (field: StudentExcelColumnKey, colIndex: number) => void;
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
  onChangeMapping,
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'matched' | 'changed' | 'new' | 'needs_verification'>('all');
  const [showPasteBox, setShowPasteBox] = useState(false);

  if (!open) return null;

  const { items, missingExistingStudents, globalErrors, globalWarnings, summary } = analysis;
  const filteredItems = items.filter((item) => statusFilter === 'all' || item.status === statusFilter);
  const confirmedRoleProposalCount = items.filter((i) => i.applyRoleProposal && i.proposedRoleId).length;
  const activeImportCount = items.filter((i) => i.resolution.type !== 'skip').length;
  const hasBlockingErrors = summary.blockingErrorCount > 0;

  const statusBadge = (status: 'matched' | 'changed' | 'new' | 'needs_verification') => {
    switch (status) {
      case 'matched':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px]">
            <CheckCircle2 className="w-3 h-3" /> Hồ sơ trùng khớp
          </span>
        );
      case 'changed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200 font-bold text-[11px]">
            Hồ sơ có thông tin thay đổi
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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-300 font-bold text-[11px]">
            <AlertTriangle className="w-3 h-3" /> Hồ sơ cần GVCN xác minh
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl max-w-7xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-3 shrink-0 gap-4">
          <div>
            <h3 className="font-bold text-lg text-[#102744] flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-teal-600" />
              <span>Nhập & Đối chiếu Danh sách Học sinh từ Excel — Lớp {classConfig.className}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Hỗ trợ chuẩn 9 cột (STT, Họ tên, Giới tính, Ngày sinh dd/mm/yyyy, Tên phụ huynh, SĐT phụ huynh, Mã MOET 10 số, Tổ, Chức vụ). Định danh theo Mã MOET, không tự gộp theo tên.
            </p>
          </div>
          <button
            type="button"
            disabled={isSavingBulkStudents}
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto space-y-4 pr-1 flex-1">
          {/* Upload & Sheet Picker */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <label className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-xs">
                <Upload className="w-3.5 h-3.5" />
                <span>Chọn file Excel (.xlsx / .xls / .csv)</span>
                <input
                  type="file"
                  accept=".xls,.xlsx,.csv,.txt"
                  onChange={onBulkExcelUpload}
                  className="hidden"
                />
              </label>

              {bulkFileName && (
                <span className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700">
                  Tệp: <strong>{bulkFileName}</strong>
                </span>
              )}

              {bulkSheetNames.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-semibold text-slate-600">Sheet:</span>
                  <select
                    value={bulkSelectedSheet}
                    onChange={(e) => onSelectSheet(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
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

            <button
              type="button"
              onClick={() => setShowPasteBox((v) => !v)}
              className="text-xs font-semibold text-indigo-700 hover:underline"
            >
              {showPasteBox ? 'Ẩn ô dán CSV/TSV' : 'Hoặc dán trực tiếp bảng CSV / Excel'}
            </button>
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

          {/* Column Mapping Bar */}
          {bulkHeaders.length > 0 && (
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#102744]">
                  Ánh xạ 9 cột dữ liệu (GVCN có thể chỉnh nếu file lớp khác có thứ tự cột khác)
                </span>
                <span className="text-[11px] text-slate-500">
                  Tìm thấy {bulkHeaders.length} cột trong sheet
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-2">
                {COLUMN_KEYS_ORDER.map((fieldKey) => (
                  <div key={fieldKey}>
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5 truncate">
                      {STUDENT_COLUMN_LABELS[fieldKey]}
                      {(fieldKey === 'fullName' || fieldKey === 'moetCode' || fieldKey === 'team') && (
                        <span className="text-rose-600"> *</span>
                      )}
                    </label>
                    <select
                      value={bulkColumnMapping[fieldKey]}
                      onChange={(e) => onChangeMapping(fieldKey, Number(e.target.value))}
                      className={`w-full px-2 py-1.5 rounded-lg border text-xs bg-white ${
                        bulkColumnMapping[fieldKey] >= 0
                          ? 'border-teal-300 bg-teal-50/40 font-semibold text-slate-800'
                          : 'border-slate-300 text-slate-500'
                      }`}
                    >
                      <option value={-1}>-- Không chọn --</option>
                      {bulkHeaders.map((h, idx) => (
                        <option key={idx} value={idx}>
                          Cột {String.fromCharCode(65 + idx)}: {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Global Errors & Warnings */}
          {globalErrors.length > 0 && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-rose-950">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>Lỗi nghiêm trọng cần xử lý trước khi xác nhận nhập:</span>
              </div>
              {globalErrors.map((err, i) => (
                <div key={i}>• {err}</div>
              ))}
            </div>
          )}

          {globalWarnings.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Lưu ý kiểm tra từ hệ thống:</span>
              </div>
              {globalWarnings.map((w, i) => (
                <div key={i}>• {w}</div>
              ))}
            </div>
          )}

          {/* Summary Cards + Team Count + Role Proposal Confirmation */}
          {items.length > 0 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`p-3 rounded-xl border text-left transition ${
                    statusFilter === 'all'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <div className="font-semibold opacity-80">Tổng dòng đọc được</div>
                  <div className="text-lg font-extrabold mt-0.5">{summary.totalRows} HS</div>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('matched')}
                  className={`p-3 rounded-xl border text-left transition ${
                    statusFilter === 'matched'
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100'
                  }`}
                >
                  <div className="font-semibold">Hồ sơ trùng khớp</div>
                  <div className="text-lg font-extrabold mt-0.5">{summary.matchedCount}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('changed')}
                  className={`p-3 rounded-xl border text-left transition ${
                    statusFilter === 'changed'
                      ? 'bg-sky-700 text-white border-sky-700'
                      : 'bg-sky-50 border-sky-200 text-sky-900 hover:bg-sky-100'
                  }`}
                >
                  <div className="font-semibold">Có thông tin thay đổi</div>
                  <div className="text-lg font-extrabold mt-0.5">{summary.changedCount}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('new')}
                  className={`p-3 rounded-xl border text-left transition ${
                    statusFilter === 'new'
                      ? 'bg-indigo-700 text-white border-indigo-700'
                      : 'bg-indigo-50 border-indigo-200 text-indigo-900 hover:bg-indigo-100'
                  }`}
                >
                  <div className="font-semibold">Học sinh mới</div>
                  <div className="text-lg font-extrabold mt-0.5">{summary.newCount}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('needs_verification')}
                  className={`p-3 rounded-xl border text-left transition ${
                    statusFilter === 'needs_verification'
                      ? 'bg-amber-700 text-white border-amber-700'
                      : 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
                  }`}
                >
                  <div className="font-semibold">Cần GVCN xác minh</div>
                  <div className="text-lg font-extrabold mt-0.5">{summary.needsVerificationCount}</div>
                </button>
              </div>

              {/* Team distribution + Role proposal confirmation */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-[#102744] flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-teal-600" />
                    <span>Sĩ số theo 4 Tổ trong file:</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[1, 2, 3, 4].map((t) => (
                      <span
                        key={t}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-bold text-slate-800"
                      >
                        Tổ {t}: {summary.teamCounts[t as 1 | 2 | 3 | 4]} HS
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-indigo-950">
                    <div className="font-bold">
                      Đề xuất Chức vụ từ Excel: {summary.roleProposalCount} vị trí (đã chọn áp dụng:{' '}
                      {confirmedRoleProposalCount}/{summary.roleProposalCount})
                    </div>
                    <div className="text-[11px] text-indigo-800">
                      Chức vụ trong file là đề xuất ban đầu; ô trống KHÔNG xóa quyền đã phân công trước đó.
                    </div>
                  </div>
                  {summary.roleProposalCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onToggleAllRoleProposals(true)}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                      >
                        Xác nhận áp dụng tất cả ({summary.roleProposalCount})
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

              {/* 9-column Preview & Reconciliation Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>
                    Bảng xem trước & đối chiếu chi tiết ({filteredItems.length}/{items.length} học sinh)
                  </span>
                  {summary.parentMissingWarningCount > 0 && (
                    <span className="text-amber-800 font-semibold">
                      {summary.parentMissingWarningCount} hồ sơ cần kiểm tra thông tin phụ huynh (&ldquo;Không có&rdquo;)
                    </span>
                  )}
                </div>
                <div className="max-h-80 overflow-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-[11px] text-slate-600 uppercase">
                      <tr>
                        <th className="py-2 px-2.5">STT</th>
                        <th className="py-2 px-2.5 min-w-[155px]">Họ tên HS</th>
                        <th className="py-2 px-2.5">Giới tính</th>
                        <th className="py-2 px-2.5">Ngày sinh</th>
                        <th className="py-2 px-2.5 min-w-[140px]">Tên phụ huynh</th>
                        <th className="py-2 px-2.5">SĐT phụ huynh</th>
                        <th className="py-2 px-2.5">Mã MOET</th>
                        <th className="py-2 px-2.5">Tổ</th>
                        <th className="py-2 px-2.5 min-w-[140px]">Chức vụ (Đề xuất)</th>
                        <th className="py-2 px-2.5 min-w-[240px]">Trạng thái đối chiếu & Lưu ý</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredItems.map((item) => {
                        const isSkipped = item.resolution.type === 'skip';
                        return (
                          <tr
                            key={item.excelRowNumber}
                            className={
                              isSkipped
                                ? 'bg-slate-100/70 opacity-60'
                                : item.errors.length > 0
                                  ? 'bg-rose-50/70'
                                  : item.warnings.length > 0
                                    ? 'bg-amber-50/40'
                                    : ''
                            }
                          >
                            <td className="py-2 px-2.5 font-mono text-slate-500">
                              {item.stt || item.excelRowNumber}
                            </td>
                            <td className="py-2 px-2.5 font-bold text-slate-900">
                              <div>{item.fullName || '—'}</div>
                              {item.duplicateNameCount > 1 && (
                                <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-semibold">
                                  Trùng tên ({item.duplicateNameCount} HS) — Tách theo MOET
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2.5 text-slate-700">{item.gender}</td>
                            <td className="py-2 px-2.5 font-mono text-slate-700">{item.dob || '—'}</td>
                            <td className="py-2 px-2.5">
                              {item.hasParentMissingWarning ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-semibold">
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  {item.parentName || 'Trống'}
                                </span>
                              ) : (
                                <span className="text-slate-800">{item.parentName}</span>
                              )}
                            </td>
                            <td className="py-2 px-2.5 font-mono text-slate-700">
                              {item.parentPhone || '—'}
                            </td>
                            <td className="py-2 px-2.5 font-mono font-bold text-indigo-900">
                              {item.moetCode || <span className="text-rose-600">Thiếu</span>}
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
                                    : 'border-rose-400 text-rose-700'
                                }`}
                              >
                                {item.team === 0 && <option value={0}>Chọn Tổ</option>}
                                <option value={1}>Tổ 1</option>
                                <option value={2}>Tổ 2</option>
                                <option value={3}>Tổ 3</option>
                                <option value={4}>Tổ 4</option>
                              </select>
                            </td>
                            <td className="py-2 px-2.5">
                              {item.proposedRoleId ? (
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={item.applyRoleProposal}
                                    onChange={(e) =>
                                      onToggleRowRoleProposal(item.excelRowNumber, e.target.checked)
                                    }
                                    className="rounded border-indigo-400 text-indigo-600"
                                  />
                                  <span
                                    className={`font-semibold ${
                                      item.applyRoleProposal ? 'text-indigo-800' : 'text-slate-600'
                                    }`}
                                  >
                                    {item.proposedRoleLabel}
                                  </span>
                                </label>
                              ) : (
                                <span className="text-slate-400">
                                  {item.roleRaw ? item.roleRaw : 'Trống (giữ nguyên)'}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2.5 space-y-1">
                              <div>{statusBadge(item.status)}</div>

                              {item.diffs.length > 0 && (
                                <div className="space-y-0.5 text-[11px] bg-sky-50 border border-sky-200 rounded p-1.5">
                                  {item.diffs.map((d) => (
                                    <div key={d.field}>
                                      <strong>{d.label}:</strong>{' '}
                                      <span className="line-through text-slate-400">{d.oldValue}</span>{' '}
                                      → <span className="font-bold text-sky-900">{d.newValue}</span>
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
                                  • {w}
                                </div>
                              ))}

                              {item.legacyCandidates.length > 0 &&
                                !item.matchedExisting && (
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
                                          Gắn MOET vào hồ sơ cũ {cand.code} ({cand.fullName} - Tổ {cand.team})
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
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Missing in File Existing Students */}
          {missingExistingStudents.length > 0 && items.length > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-300 space-y-2 text-xs">
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
                    {st.fullName} ({st.moetCode || st.code} • Tổ {st.team})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 shrink-0">
          <div className="text-xs text-slate-600">
            {items.length > 0 ? (
              hasBlockingErrors ? (
                <span className="text-rose-700 font-bold">
                  Còn {summary.blockingErrorCount} lỗi cần xử lý trước khi nhập vào Firestore.
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSavingBulkStudents}
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={isSavingBulkStudents || activeImportCount === 0 || hasBlockingErrors}
              onClick={onSaveBulkStudents}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs"
            >
              {isSavingBulkStudents
                ? 'Đang lưu danh sách vào Firestore...'
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
