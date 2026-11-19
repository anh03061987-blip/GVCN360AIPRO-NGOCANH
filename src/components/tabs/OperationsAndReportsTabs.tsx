import React from 'react';
import {
  DollarSign,
  TrendingUp,
  Calendar,
  Flag,
  CheckSquare,
  Plus,
  FileSpreadsheet,
  Upload,
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  Edit3,
  Bot,
  Sparkles,
  RefreshCw,
  MessageSquareHeart,
  Copy,
  FileBarChart2,
  Download,
  Printer,
  Layers,
  Lock,
  Link2,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  Trash2,
  XCircle,
  Search,
  Wand2,
  ClipboardCheck,
  Eye,
  RotateCcw,
  Users,
  X,
} from 'lucide-react';
import { ROLES, VNEDU_SUBJECTS, WEEK_OPTIONS, normalizeSlug } from '../../constants/gvcnConstants';
import {
  VNEDU_SEMESTERS,
  extractExtraTxFromNote,
  extractVerifiedLinkEntry,
  getRoleDisplayLabel,
  getTxOrderFromRole,
  getVneduScoreDocId,
  type VneduAssessmentMode,
  type VneduColumnDescriptor,
  type VneduColumnRole,
  type VneduImportAnalysis,
  type VneduMatchStatus,
  type VneduRowResolution,
  type VneduSemester,
  type VneduVerifiedLinkStore,
} from '../../utils/vneduScoreImport';
import { StudentSearchPicker } from '../vnedu/StudentSearchPicker';
import type {
  ClassConfig,
  ClassPlanRecord,
  Grade12Profile,
  SavedWorkspace,
  StudentRecord,
  SubjectScoreRecord,
  TicketRecord,
  VneduImportLog,
  WeeklySnapshot,
  YouthActivityRecord,
} from '../../types/gvcn';

// 1. SỔ QUỸ LỚP
interface FundTabProps {
  classConfig: ClassConfig;
  fundBalance: number;
  totalIncome: number;
  totalExpense: number;
  approvedFundTickets: TicketRecord[];
  onNavigateToTicket: () => void;
}

export function FundTab({
  classConfig,
  fundBalance,
  totalIncome,
  totalExpense,
  approvedFundTickets,
  onNavigateToTicket,
}: FundTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#102744]">Sổ Quỹ Lớp {classConfig.className}</h2>
          <p className="text-sm text-slate-500">
            Thu/chi được Thủ quỹ lập phiếu đề xuất và chỉ cộng/trừ vào số dư sau khi GVCN phê duyệt chính thức.
          </p>
        </div>
        <button
          type="button"
          onClick={onNavigateToTicket}
          className="px-4 py-2 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Lập phiếu Thu / Chi mới</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold uppercase text-slate-500 flex items-center justify-between">
            <span>Số dư Quỹ hiện tại</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-2">
            {fundBalance.toLocaleString('vi-VN')} đ
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold uppercase text-slate-500 flex items-center justify-between">
            <span>Tổng Thu đã duyệt</span>
            <TrendingUp className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-extrabold text-teal-700 mt-2">
            +{totalIncome.toLocaleString('vi-VN')} đ
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold uppercase text-slate-500 flex items-center justify-between">
            <span>Tổng Chi đã duyệt</span>
            <TrendingUp className="w-4 h-4 text-rose-500 rotate-180" />
          </div>
          <div className="text-2xl font-extrabold text-rose-700 mt-2">
            -{totalExpense.toLocaleString('vi-VN')} đ
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 font-bold text-sm text-[#102744]">
          Lịch sử Giao dịch Quỹ lớp Đã được GVCN Phê duyệt ({approvedFundTickets.length})
        </div>
        {approvedFundTickets.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Chưa có giao dịch thu/chi quỹ lớp nào được phê duyệt.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-3 px-4">Ngày</th>
                  <th className="py-3 px-4">Phân loại</th>
                  <th className="py-3 px-4">Nội dung / Chứng từ</th>
                  <th className="py-3 px-4">Số tiền</th>
                  <th className="py-3 px-4">Người lập & Người duyệt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {approvedFundTickets.map((t) => {
                  const isExpense = t.category === 'Chi quỹ';
                  const isSettlement = t.category === 'Đề xuất quyết toán';
                  return (
                    <tr key={t.id}>
                      <td className="py-3 px-4 font-mono text-slate-600">{t.date}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-lg font-bold ${
                            isSettlement
                              ? 'bg-indigo-100 text-indigo-800'
                              : isExpense
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {t.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-800">{t.description}</td>
                      <td
                        className={`py-3 px-4 font-extrabold ${
                          isSettlement
                            ? 'text-indigo-700'
                            : isExpense
                              ? 'text-rose-700'
                              : 'text-emerald-700'
                        }`}
                      >
                        {isSettlement ? 'Đối soát: ' : isExpense ? '-' : '+'}
                        {Number(t.amount || 0).toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        Lập: {t.submittedByTitle} • Duyệt: {t.reviewedByTeacher || classConfig.teacherName}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// 2. KẾ HOẠCH CHỦ NHIỆM & HOẠT ĐỘNG CHI ĐOÀN
interface PlansAndYouthTabProps {
  activeRoleId: string;
  classConfig: ClassConfig;
  plans: ClassPlanRecord[];
  planForm: {
    week: string;
    title: string;
    targetDate: string;
    content: string;
    status: 'Đang thực hiện' | 'Hoàn thành';
  };
  setPlanForm: React.Dispatch<
    React.SetStateAction<{
      week: string;
      title: string;
      targetDate: string;
      content: string;
      status: 'Đang thực hiện' | 'Hoàn thành';
    }>
  >;
  onAddPlan: (e: React.FormEvent) => void;
  onTogglePlanStatus: (plan: ClassPlanRecord) => void;
  youthActivities: YouthActivityRecord[];
  youthForm: {
    title: string;
    date: string;
    participantCount: number;
    description: string;
    status: string;
  };
  setYouthForm: React.Dispatch<
    React.SetStateAction<{
      title: string;
      date: string;
      participantCount: number;
      description: string;
      status: string;
    }>
  >;
  onAddYouthActivity: (e: React.FormEvent) => void;
  onToggleYouthStatus: (activity: YouthActivityRecord) => void;
}

export function PlansAndYouthTab({
  activeRoleId,
  classConfig,
  plans,
  planForm,
  setPlanForm,
  onAddPlan,
  onTogglePlanStatus,
  youthActivities,
  youthForm,
  setYouthForm,
  onAddYouthActivity,
  onToggleYouthStatus,
}: PlansAndYouthTabProps) {
  const canSubmitYouth = activeRoleId === 'gvcn' || activeRoleId === 'bi_thu';
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#102744]">Kế hoạch Chủ nhiệm & Phong trào Chi đoàn</h2>
        <p className="text-sm text-slate-500">
          Quản lý lịch công tác tuần của GVCN và các hoạt động phong trào của Chi đoàn lớp {classConfig.className}.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cột 1: Kế hoạch chủ nhiệm */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-[#102744] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#0C9BA6]" />
              <span>Kế hoạch Công tác Chủ nhiệm ({plans.length})</span>
            </h3>
          </div>

          {activeRoleId === 'gvcn' && (
            <form onSubmit={onAddPlan} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <select
                  value={planForm.week}
                  onChange={(e) => setPlanForm({ ...planForm, week: e.target.value })}
                  className="px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                >
                  {WEEK_OPTIONS.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={planForm.targetDate}
                  onChange={(e) => setPlanForm({ ...planForm, targetDate: e.target.value })}
                  className="px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>
              <input
                type="text"
                required
                value={planForm.title}
                onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })}
                placeholder="Tiêu đề đầu việc chủ nhiệm tuần..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
              <textarea
                rows={2}
                value={planForm.content}
                onChange={(e) => setPlanForm({ ...planForm, content: e.target.value })}
                placeholder="Nội dung triển khai chi tiết..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 text-white font-bold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm kế hoạch tuần</span>
              </button>
            </form>
          )}

          <div className="space-y-2.5 max-h-96 overflow-y-auto">
            {plans.length === 0 ? (
              <p className="text-xs text-slate-500">Chưa có kế hoạch chủ nhiệm nào được lưu.</p>
            ) : (
              plans.map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 rounded-xl border border-slate-200 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 font-bold">{p.week}</span>
                      <span className="text-slate-400">{p.targetDate}</span>
                    </div>
                    <div className="font-bold text-sm text-slate-900">{p.title}</div>
                    {p.content && <p className="text-slate-600">{p.content}</p>}
                  </div>
                  <button
                    type="button"
                    disabled={activeRoleId !== 'gvcn'}
                    onClick={() => onTogglePlanStatus(p)}
                    className={`px-2.5 py-1 rounded-lg font-bold shrink-0 flex items-center gap-1 ${
                      p.status === 'Hoàn thành'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>{p.status}</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Cột 2: Hoạt động Chi đoàn */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-[#102744] flex items-center gap-2">
              <Flag className="w-4 h-4 text-rose-600" />
              <span>Phong trào & Hoạt động Chi đoàn ({youthActivities.length})</span>
            </h3>
          </div>

          {canSubmitYouth ? (
            <form onSubmit={onAddYouthActivity} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <input
                type="text"
                required
                value={youthForm.title}
                onChange={(e) => setYouthForm({ ...youthForm, title: e.target.value })}
                placeholder="Tên hoạt động / phong trào Chi đoàn..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="date"
                  value={youthForm.date}
                  onChange={(e) => setYouthForm({ ...youthForm, date: e.target.value })}
                  className="px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
                <input
                  type="number"
                  min={0}
                  value={youthForm.participantCount || ''}
                  onChange={(e) => setYouthForm({ ...youthForm, participantCount: Number(e.target.value) })}
                  placeholder="Số ĐVTN tham gia"
                  className="px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
                <select
                  value={youthForm.status}
                  onChange={(e) => setYouthForm({ ...youthForm, status: e.target.value })}
                  className="px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                >
                  <option value="Sắp diễn ra">Sắp diễn ra</option>
                  <option value="Đang thực hiện">Đang thực hiện</option>
                  <option value="Hoàn thành">Hoàn thành</option>
                </select>
              </div>
              <textarea
                rows={2}
                value={youthForm.description}
                onChange={(e) => setYouthForm({ ...youthForm, description: e.target.value })}
                placeholder="Mô tả kế hoạch, phân công ĐVTN..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>
                  {activeRoleId === 'gvcn' ? 'Lưu hoạt động Chi đoàn' : 'Gửi báo cáo / đề xuất hoạt động Chi đoàn'}
                </span>
              </button>
            </form>
          ) : (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Chỉ GVCN hoặc Bí thư Chi đoàn mới có quyền thêm/báo cáo hoạt động Chi đoàn.</span>
            </div>
          )}

          <div className="space-y-2.5 max-h-96 overflow-y-auto">
            {youthActivities.length === 0 ? (
              <p className="text-xs text-slate-500">Chưa có hoạt động Chi đoàn nào được ghi nhận.</p>
            ) : (
              youthActivities.map((y) => (
                <div key={y.id} className="p-3.5 rounded-xl border border-slate-200 flex items-start justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="font-bold text-sm text-slate-900">{y.title}</div>
                    <div className="text-slate-500">
                      Ngày: {y.date} • Tham gia: <strong>{y.participantCount}</strong> ĐVTN
                    </div>
                    {y.description && <p className="text-slate-600">{y.description}</p>}
                  </div>
                  <button
                    type="button"
                    disabled={activeRoleId !== 'gvcn' && activeRoleId !== 'bi_thu'}
                    onClick={() => onToggleYouthStatus(y)}
                    title="Bấm để chuyển trạng thái: Sắp diễn ra → Đang thực hiện → Hoàn thành"
                    className={`px-2.5 py-1 rounded-lg font-bold shrink-0 flex items-center gap-1 transition-all ${
                      y.status === 'Hoàn thành'
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        : y.status === 'Đang thực hiện'
                          ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                          : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>{y.status}</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 3. NHẬP ĐIỂM EXCEL VNEDU
interface VneduImportTabProps {
  activeRoleId: string;
  classConfig: ClassConfig;
  students: StudentRecord[];
  subjectScores: Record<string, SubjectScoreRecord>;
  selectedVneduSubject: string;
  setSelectedVneduSubject: (subject: string) => void;
  selectedVneduSemester: VneduSemester;
  setSelectedVneduSemester: (semester: VneduSemester) => void;
  vneduAssessmentMode: VneduAssessmentMode;
  setVneduAssessmentMode: (mode: VneduAssessmentMode) => void;
  preserveExistingWhenBlank: boolean;
  setPreserveExistingWhenBlank: (v: boolean) => void;
  vneduFileName: string;
  vneduSheetNames: string[];
  vneduSelectedSheet: string;
  onSelectVneduSheet: (sheetName: string) => void;
  vneduRawText: string;
  onPasteRawText: (v: string) => void;
  vneduMatrix: string[][];
  vneduHeaderRowIndex: number;
  vneduMergeParentHeader: boolean;
  onChangeHeaderRow: (rowIdx: number, mergeParent: boolean) => void;
  vneduColumns: VneduColumnDescriptor[];
  vneduRoleMap: Record<number, VneduColumnRole>;
  onChangeColumnRole: (colIndex: number, role: VneduColumnRole) => void;
  vneduAnalysis: VneduImportAnalysis;
  vneduConfirmedIdLinks: VneduVerifiedLinkStore;
  onRemoveIdLink: (vneduCodeUpper: string) => void;
  onClearAllIdLinks: () => void;
  vneduCodeSystemVerifiedSameAsMoet: boolean;
  setVneduCodeSystemVerifiedSameAsMoet: (v: boolean) => void;
  vneduAutoConfirmExactNameAndDob: boolean;
  setVneduAutoConfirmExactNameAndDob: (v: boolean) => void;
  vneduRowResolutions: Record<number, VneduRowResolution>;
  onSetRowResolution: (excelRowNumber: number, resolution: VneduRowResolution) => void;
  vneduDeselectedRows: Record<number, boolean>;
  onToggleRowSelection: (excelRowNumber: number) => void;
  onSelectAllEligible: () => void;
  onClearSelections: () => void;
  onConfirmDobMismatchGroup: (
    entries: { excelRowNumber: number; studentId: string; saveLink: boolean }[]
  ) => void;
  onAutoReconcileAll: () => void;
  isRefreshingRoster: boolean;
  rosterRefreshedAtMs: number | null;
  onRefreshRosterAndReconcile: () => void;
  onCancelImport: () => void;
  vneduImportHistory: VneduImportLog[];
  isReadingExcel: boolean;
  isImportingVnedu: boolean;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onConfirmImport: () => void;
}

const MATCH_STATUS_META: Record<
  VneduMatchStatus,
  { label: string; badgeClass: string; rowClass: string }
> = {
  matched_by_code: {
    label: 'Khớp theo mã',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    rowClass: 'bg-white',
  },
  matched_auto: {
    label: 'Tự động khớp (Tên + NS)',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    rowClass: 'bg-emerald-50/25',
  },
  matched_by_gvcn: {
    label: 'GVCN đã xác nhận',
    badgeClass: 'bg-teal-100 text-teal-800 border-teal-200',
    rowClass: 'bg-teal-50/20',
  },
  name_match_dob_mismatch: {
    label: 'Tên khớp – cần xác minh ngày sinh',
    badgeClass: 'bg-orange-100 text-orange-900 border-orange-300',
    rowClass: 'bg-orange-50/45',
  },
  needs_verification: {
    label: 'Cần kiểm tra',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    rowClass: 'bg-amber-50/45',
  },
  not_found: {
    label: 'Không tìm thấy',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
    rowClass: 'bg-rose-50/40',
  },
  duplicate_or_invalid: {
    label: 'Trùng / Lỗi',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
    rowClass: 'bg-purple-50/40',
  },
};

export function VneduImportTab({
  activeRoleId,
  classConfig,
  students,
  subjectScores,
  selectedVneduSubject,
  setSelectedVneduSubject,
  selectedVneduSemester,
  setSelectedVneduSemester,
  vneduAssessmentMode,
  setVneduAssessmentMode,
  preserveExistingWhenBlank,
  setPreserveExistingWhenBlank,
  vneduFileName,
  vneduSheetNames,
  vneduSelectedSheet,
  onSelectVneduSheet,
  vneduRawText,
  onPasteRawText,
  vneduMatrix,
  vneduHeaderRowIndex,
  vneduMergeParentHeader,
  onChangeHeaderRow,
  vneduColumns,
  vneduRoleMap,
  onChangeColumnRole,
  vneduAnalysis,
  vneduConfirmedIdLinks,
  onRemoveIdLink,
  onClearAllIdLinks,
  vneduCodeSystemVerifiedSameAsMoet,
  setVneduCodeSystemVerifiedSameAsMoet,
  vneduAutoConfirmExactNameAndDob,
  setVneduAutoConfirmExactNameAndDob,
  vneduRowResolutions,
  onSetRowResolution,
  vneduDeselectedRows,
  onToggleRowSelection,
  onSelectAllEligible,
  onClearSelections,
  onConfirmDobMismatchGroup,
  onAutoReconcileAll,
  isRefreshingRoster,
  rosterRefreshedAtMs,
  onRefreshRosterAndReconcile,
  onCancelImport,
  vneduImportHistory,
  isReadingExcel,
  isImportingVnedu,
  onFileUpload,
  onConfirmImport,
}: VneduImportTabProps) {
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'changed' | VneduMatchStatus>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showIdLinkDrawer, setShowIdLinkDrawer] = React.useState(false);
  const [showEmptyIgnoredCols, setShowEmptyIgnoredCols] = React.useState(false);
  const [showDobGroupModal, setShowDobGroupModal] = React.useState(false);
  const [dobGroupChecked, setDobGroupChecked] = React.useState<Record<number, boolean>>({});
  const [dobGroupSaveLink, setDobGroupSaveLink] = React.useState(true);
  const [showConfirmSaveModal, setShowConfirmSaveModal] = React.useState(false);
  const [columnCheckBanner, setColumnCheckBanner] = React.useState<string | null>(null);
  const columnMapperRef = React.useRef<HTMLDivElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const headerCheckboxRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (vneduMatrix.length === 0 && !vneduRawText) {
      setStatusFilter('all');
      setSearchQuery('');
      setColumnCheckBanner(null);
      setShowDobGroupModal(false);
      setShowConfirmSaveModal(false);
      setShowEmptyIgnoredCols(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [vneduMatrix.length, vneduRawText]);

  const allSubjects = React.useMemo(() => {
    const list: string[] = [...VNEDU_SUBJECTS];
    if (classConfig.subject && !list.includes(classConfig.subject)) {
      list.unshift(classConfig.subject);
    }
    return list;
  }, [classConfig.subject]);

  const activeSubjectSlug = normalizeSlug(selectedVneduSubject, 'toan').slice(0, 60);

  // Build available role options dynamically including TX1..TX8 (and beyond if present)
  const roleOptions = React.useMemo(() => {
    const maxTxInMap = Math.max(
      6,
      ...Object.values(vneduRoleMap).map((r) => getTxOrderFromRole(r) || 0)
    );
    const txItems: { value: VneduColumnRole; label: string }[] = [];
    for (let i = 1; i <= Math.min(maxTxInMap + 1, 12); i++) {
      txItems.push({ value: `tx:${i}`, label: `Điểm TX${i}` });
    }
    return [
      { value: 'ignore' as VneduColumnRole, label: '— Bỏ qua (không nhập) —' },
      { value: 'needs_selection' as VneduColumnRole, label: '⚠ Cần GVCN chọn loại điểm' },
      { value: 'stt' as VneduColumnRole, label: 'STT (chỉ hiển thị)' },
      { value: 'code' as VneduColumnRole, label: 'Mã học sinh (vnEdu)' },
      { value: 'lastName' as VneduColumnRole, label: 'Họ và đệm' },
      { value: 'firstName' as VneduColumnRole, label: 'Tên' },
      { value: 'fullName' as VneduColumnRole, label: 'Họ và tên đầy đủ' },
      { value: 'dob' as VneduColumnRole, label: 'Ngày sinh' },
      ...txItems,
      { value: 'gk' as VneduColumnRole, label: 'Điểm Giữa kỳ (GK)' },
      { value: 'ck' as VneduColumnRole, label: 'Điểm Cuối kỳ (CK)' },
      { value: 'avg_hk' as VneduColumnRole, label: 'ĐTB môn Học kỳ (ĐTB HK)' },
      { value: 'avg_cn' as VneduColumnRole, label: 'ĐTB môn Cả năm (ĐTB CN)' },
      { value: 'note' as VneduColumnRole, label: 'Nhận xét / Đánh giá' },
    ];
  }, [vneduRoleMap]);

  const nameMode: 'split' | 'single' = React.useMemo(() => {
    const roles = Object.values(vneduRoleMap);
    return roles.includes('lastName') || roles.includes('firstName') ? 'split' : 'single';
  }, [vneduRoleMap]);

  const hasActiveDraftInput = Boolean(
    vneduFileName || vneduRawText.trim() || vneduMatrix.length > 0
  );

  const handleCancelClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setStatusFilter('all');
    setSearchQuery('');
    setColumnCheckBanner(null);
    onCancelImport();
  };

  const handlePasteChange = (val: string) => {
    setColumnCheckBanner(null);
    onPasteRawText(val);
  };

  const handleCheckColumns = () => {
    columnMapperRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (vneduColumns.length === 0) {
      setColumnCheckBanner('Chưa có bảng dữ liệu Excel/CSV nào được tải lên.');
      return;
    }
    const issues: string[] = [];
    if (vneduAnalysis.mappingConflicts.length > 0) {
      issues.push(...vneduAnalysis.mappingConflicts);
    }
    if (vneduAnalysis.unclassifiedColumns.length > 0) {
      issues.push(
        `Có ${vneduAnalysis.unclassifiedColumns.length} cột chưa chọn loại điểm (${vneduAnalysis.unclassifiedColumns
          .map((c) => `${c.colLetter}: ${c.mergedLabel}`)
          .join(', ')}). Hãy chọn loại điểm hoặc "Bỏ qua".`
      );
    }
    const mappedScoreCount =
      vneduAnalysis.txOrders.length +
      (vneduAnalysis.hasGkMapped ? 1 : 0) +
      (vneduAnalysis.hasCkMapped ? 1 : 0) +
      (vneduAnalysis.hasAvgHkMapped ? 1 : 0) +
      (vneduAnalysis.hasAvgCnMapped ? 1 : 0) +
      (vneduAnalysis.hasNoteMapped ? 1 : 0);

    if (mappedScoreCount === 0) {
      issues.push('Chưa có cột điểm/nhận xét nào được ánh xạ để lưu.');
    }

    if (issues.length > 0) {
      setColumnCheckBanner(`⚠ ${issues.join(' • ')}`);
    } else {
      const mappedLabels = [
        ...vneduAnalysis.txOrders.map((o) => `TX${o}`),
        vneduAnalysis.hasGkMapped ? 'GK' : '',
        vneduAnalysis.hasCkMapped ? 'CK' : '',
        vneduAnalysis.hasAvgHkMapped ? 'ĐTB HK' : '',
        vneduAnalysis.hasAvgCnMapped ? 'ĐTB CN' : '',
        vneduAnalysis.hasNoteMapped ? 'Nhận xét' : '',
      ].filter(Boolean);
      setColumnCheckBanner(
        `✓ Hợp lệ: Đã nhận diện ${mappedLabels.join(', ')}. Không có xung đột cột điểm.`
      );
    }
  };

  const filteredItems = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return vneduAnalysis.items.filter((item) => {
      if (statusFilter === 'changed') {
        if (!(item.scoreDiffs.length > 0 || !item.hasExistingScore)) return false;
      } else if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.resolvedFullName.toLowerCase().includes(q) ||
        item.vneduCode.toLowerCase().includes(q) ||
        (item.matchedStudent?.fullName || '').toLowerCase().includes(q) ||
        (item.matchedStudent?.moetCode || '').toLowerCase().includes(q)
      );
    });
  }, [vneduAnalysis.items, statusFilter, searchQuery]);

  const savedLinksList = React.useMemo(() => {
    return Object.entries(vneduConfirmedIdLinks).map(([vneduCode, rawEntry]) => {
      const parsed = extractVerifiedLinkEntry(rawEntry);
      const studentId = parsed?.studentId || '';
      const st = students.find((s) => s.id === studentId || s.code === studentId);
      const meta = typeof rawEntry === 'object' && rawEntry !== null ? rawEntry : null;
      return {
        vneduCode,
        studentId,
        student: st || null,
        meta,
      };
    });
  }, [vneduConfirmedIdLinks, students]);

  const { summary } = vneduAnalysis;
  const hasBlockingMappingError =
    vneduAnalysis.mappingConflicts.length > 0 || vneduAnalysis.unclassifiedColumns.length > 0;

  const eligibleItems = React.useMemo(
    () => vneduAnalysis.items.filter((i) => i.canSave && i.matchedStudent),
    [vneduAnalysis.items]
  );

  const selectedItems = React.useMemo(
    () => eligibleItems.filter((i) => !vneduDeselectedRows[i.excelRowNumber]),
    [eligibleItems, vneduDeselectedRows]
  );

  const selectedCount = selectedItems.length;
  const unselectedCount = summary.totalRows - selectedCount;
  const allEligibleSelected = eligibleItems.length > 0 && selectedCount === eligibleItems.length;
  const someEligibleSelected = selectedCount > 0 && selectedCount < eligibleItems.length;

  React.useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someEligibleSelected;
    }
  }, [someEligibleSelected]);

  const preSaveSummary = React.useMemo(() => {
    let newStudents = 0;
    let changedStudents = 0;
    let newScoreCells = 0;
    let updatedScoreCells = 0;
    let linksToRemember = 0;

    selectedItems.forEach((it) => {
      if (!it.hasExistingScore) {
        newStudents++;
      } else if (it.scoreDiffs.length > 0) {
        changedStudents++;
      }
      it.scoreDiffs.forEach((d) => {
        if (d.kind === 'added') newScoreCells++;
        else updatedScoreCells++;
      });
      if (it.vneduCode) {
        linksToRemember++;
      }
    });

    return {
      selectedCount: selectedItems.length,
      unselectedCount: summary.totalRows - selectedItems.length,
      newStudents,
      changedStudents,
      newScoreCells,
      updatedScoreCells,
      linksToRemember,
    };
  }, [selectedItems, summary.totalRows]);

  const dobMismatchItems = React.useMemo(
    () =>
      vneduAnalysis.items.filter(
        (i) => i.status === 'name_match_dob_mismatch' && i.recommendedCandidate
      ),
    [vneduAnalysis.items]
  );

  const openDobGroupModal = () => {
    const initialChecked: Record<number, boolean> = {};
    dobMismatchItems.forEach((it) => {
      initialChecked[it.excelRowNumber] = true;
    });
    setDobGroupChecked(initialChecked);
    setDobGroupSaveLink(true);
    setShowDobGroupModal(true);
  };

  const checkedDobMismatchItems = React.useMemo(
    () => dobMismatchItems.filter((it) => dobGroupChecked[it.excelRowNumber]),
    [dobMismatchItems, dobGroupChecked]
  );

  const handleConfirmDobModalSubmit = () => {
    const entries = checkedDobMismatchItems
      .filter((it) => it.recommendedCandidate)
      .map((it) => ({
        excelRowNumber: it.excelRowNumber,
        studentId: it.recommendedCandidate!.id,
        saveLink: dobGroupSaveLink && Boolean(it.vneduCode),
      }));
    if (entries.length > 0) {
      onConfirmDobMismatchGroup(entries);
    }
    setShowDobGroupModal(false);
  };

  const { visibleMapperColumns, hiddenEmptyColumnsCount } = React.useMemo(() => {
    const emptyIgnored = vneduColumns.filter((c) => {
      const role = vneduRoleMap[c.index] || 'ignore';
      return role === 'ignore' && c.sampleValues.length === 0;
    });
    if (showEmptyIgnoredCols) {
      return { visibleMapperColumns: vneduColumns, hiddenEmptyColumnsCount: emptyIgnored.length };
    }
    const visible = vneduColumns.filter((c) => {
      const role = vneduRoleMap[c.index] || 'ignore';
      return !(role === 'ignore' && c.sampleValues.length === 0);
    });
    return {
      visibleMapperColumns: visible.length > 0 ? visible : vneduColumns,
      hiddenEmptyColumnsCount: visible.length > 0 ? emptyIgnored.length : 0,
    };
  }, [vneduColumns, vneduRoleMap, showEmptyIgnoredCols]);

  const savedScoresMeta = React.useMemo(() => {
    const extraTxOrders = new Set<number>([3, 4]);
    let count = 0;
    const byCode: Record<string, { score: SubjectScoreRecord | null; meta: ReturnType<typeof extractExtraTxFromNote> }> = {};
    students.forEach((st) => {
      const sc = subjectScores[getVneduScoreDocId(st.code, activeSubjectSlug, selectedVneduSemester)] || null;
      if (sc) count++;
      const meta = extractExtraTxFromNote(sc?.note);
      Object.keys(meta.txMap).forEach((k) => extraTxOrders.add(Number(k)));
      byCode[st.code] = { score: sc, meta };
    });
    const extraOrdersSorted = Array.from(extraTxOrders)
      .filter((o) => o >= 3)
      .sort((a, b) => a - b);
    return { count, byCode, extraOrdersSorted };
  }, [students, subjectScores, activeSubjectSlug, selectedVneduSemester]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#102744]">
            Nhập Bảng điểm các Môn học từ vnEdu (.xlsx / .xls / .csv)
          </h2>
          <p className="text-sm text-slate-500">
            Hỗ trợ file tách cột <strong>Họ và đệm + Tên</strong> hoặc gộp <strong>Họ và tên</strong>, ánh xạ động cột điểm TX1..TXn, GK, CK, ĐTB &amp; Nhận xét cho Lớp {classConfig.className}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            disabled={isRefreshingRoster}
            onClick={onRefreshRosterAndReconcile}
            title="Tải lại danh sách học sinh mới nhất từ Firestore và tính lại trạng thái khớp mà không làm mất bảng điểm đang xem"
            className="px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-900 disabled:opacity-60 font-bold flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-sky-700 ${isRefreshingRoster ? 'animate-spin' : ''}`} />
            <span>
              {isRefreshingRoster ? 'Đang tải hồ sơ mới...' : 'Làm mới hồ sơ và đối chiếu lại'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setShowIdLinkDrawer((v) => !v)}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center gap-1.5"
          >
            <Link2 className="w-3.5 h-3.5 text-[#0C9BA6]" />
            <span>Liên kết mã vnEdu ({savedLinksList.length})</span>
          </button>
          {hasActiveDraftInput && (
            <button
              type="button"
              onClick={handleCancelClick}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 font-bold flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Hủy nhập</span>
            </button>
          )}
          <label className="px-4 py-2 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 text-white font-bold cursor-pointer flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5" />
            <span>{isReadingExcel ? 'Đang đọc tệp...' : 'Tải lên tệp Excel / CSV'}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsx,.csv,.tsv,.txt"
              onChange={onFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Cảnh báo rõ nếu chưa tải được danh sách học sinh của lớp */}
      {students.length === 0 && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">
              Chưa tải được danh sách học sinh thực tế của Lớp {classConfig.className} (0 học sinh).
            </div>
            <div>
              Hệ thống không tự tạo học sinh mẫu khi nhập điểm. Vui lòng kiểm tra mục <strong>Hồ sơ học sinh</strong> để đảm bảo danh sách 46 học sinh đã được nạp trước khi đối chiếu bảng điểm.
            </div>
          </div>
        </div>
      )}

      {/* Bảng quản lý liên kết mã vnEdu đã xác nhận */}
      {showIdLinkDrawer && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-[#102744] flex items-center gap-1.5">
                <Link2 className="w-4 h-4 text-[#0C9BA6]" />
                <span>Bảng liên kết Mã HS vnEdu ↔ Hồ sơ lớp {classConfig.className}</span>
              </h3>
              <p className="text-xs text-slate-500">
                Các liên kết được lưu theo đúng tài khoản &amp; lớp học hiện tại để tự động nhận diện ở những lần nhập điểm bổ sung sau.
              </p>
            </div>
            {savedLinksList.length > 0 && (
              <button
                type="button"
                onClick={onClearAllIdLinks}
                className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa toàn bộ liên kết</span>
              </button>
            )}
          </div>
          {savedLinksList.length === 0 ? (
            <p className="text-xs text-slate-500">
              Chưa có liên kết Mã vnEdu nào được lưu. Khi đối chiếu thủ công hoặc tự động, mã vnEdu sẽ được ghi nhớ nếu bạn tích chọn &ldquo;Lưu liên kết mã&rdquo;.
            </p>
          ) : (
            <div className="max-h-56 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {savedLinksList.map((link) => (
                <div
                  key={link.vneduCode}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                >
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-[#0C9BA6] truncate">vnEdu: {link.vneduCode}</div>
                      <div className="font-bold text-slate-800 truncate">
                        {link.student
                          ? `${link.student.fullName} (Tổ ${link.student.team})`
                          : link.meta?.studentName || `ID: ${link.studentId}`}
                      </div>
                      {link.meta && (
                        <div className="text-[10px] text-slate-500 truncate">
                          {link.meta.className} • {link.meta.schoolYear}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveIdLink(link.vneduCode)}
                      title="Gỡ liên kết này"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
          )}
        </div>
      )}

      {/* Chọn môn học, học kỳ & phương thức đánh giá */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase text-slate-500">
              Môn học, Học kỳ &amp; Phương thức đánh giá
            </div>
            <div className="text-base font-extrabold text-[#102744] mt-0.5">
              Môn {selectedVneduSubject} — {selectedVneduSemester}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={selectedVneduSemester}
              onChange={(e) => setSelectedVneduSemester(e.target.value as VneduSemester)}
              className="px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-xs font-bold text-[#102744]"
            >
              {VNEDU_SEMESTERS.map((sem) => (
                <option key={sem} value={sem}>
                  {sem}
                </option>
              ))}
            </select>
            <select
              value={selectedVneduSubject}
              onChange={(e) => setSelectedVneduSubject(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-xs font-bold text-[#102744]"
            >
              {allSubjects.map((sub) => (
                <option key={sub} value={sub}>
                  Môn {sub}
                </option>
              ))}
            </select>
            <select
              value={vneduAssessmentMode}
              onChange={(e) => setVneduAssessmentMode(e.target.value as VneduAssessmentMode)}
              className="px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-xs font-bold text-[#102744]"
            >
              <option value="auto">Tự động (Điểm số / Đạt-CĐ)</option>
              <option value="numeric">Đánh giá bằng Điểm số (0–10)</option>
              <option value="comment">Đánh giá bằng Nhận xét (Đạt / Chưa đạt)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {allSubjects.map((sub) => {
            const isSelected = selectedVneduSubject === sub;
            return (
              <button
                key={sub}
                type="button"
                onClick={() => setSelectedVneduSubject(sub)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#0C9BA6] text-white border-[#0C9BA6] shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span>{sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Vùng tải / dán dữ liệu và ánh xạ cột động */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className="block text-xs font-bold text-slate-600">
            Dán trực tiếp dữ liệu bảng điểm Môn {selectedVneduSubject} từ Excel / vnEdu (tách chuẩn theo ký tự Tab, giữ nguyên ô trống):
          </label>
          {vneduFileName && (
            <span className="text-xs font-bold text-[#0C9BA6] bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
              Tệp: {vneduFileName}
            </span>
          )}
        </div>
        <textarea
          rows={3}
          value={vneduRawText}
          onChange={(e) => handlePasteChange(e.target.value)}
          placeholder="Dán dữ liệu bảng điểm từ Excel hoặc vnEdu (hỗ trợ cả cột tách 'Họ và đệm' + 'Tên' lẫn cột gộp 'Họ và tên')..."
          className="w-full p-3 rounded-xl border border-slate-300 font-mono text-xs"
        />

        {/* Cấu hình Sheet, Dòng tiêu đề & Bảng ánh xạ động từng cột */}
        {vneduMatrix.length > 0 && (
          <div ref={columnMapperRef} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="font-bold text-xs text-[#102744] flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-teal-600" />
                <span>Ánh xạ động toàn bộ cột từ Excel / vnEdu ({vneduColumns.length} cột)</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {vneduSheetNames.length > 1 && (
                  <select
                    value={vneduSelectedSheet}
                    onChange={(e) => onSelectVneduSheet(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold"
                  >
                    {vneduSheetNames.map((s) => (
                      <option key={s} value={s}>
                        Sheet: {s}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  value={vneduHeaderRowIndex}
                  onChange={(e) => onChangeHeaderRow(Number(e.target.value), vneduMergeParentHeader)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold max-w-xs"
                >
                  {vneduMatrix.slice(0, 12).map((row, idx) => (
                    <option key={idx} value={idx}>
                      Dòng tiêu đề {idx + 1}: {row.filter(Boolean).slice(0, 4).join(' | ').slice(0, 45) || '(Trống)'}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white cursor-pointer font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={vneduMergeParentHeader}
                    onChange={(e) => onChangeHeaderRow(vneduHeaderRowIndex, e.target.checked)}
                    className="rounded text-[#0C9BA6]"
                  />
                  <span>Gộp tiêu đề dòng trên</span>
                </label>
              </div>
            </div>

            {columnCheckBanner && (
              <div
                className={`p-3 rounded-xl border text-xs font-semibold ${
                  columnCheckBanner.startsWith('⚠')
                    ? 'bg-amber-50 border-amber-300 text-amber-950'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                {columnCheckBanner}
              </div>
            )}

            {/* Từng cột trong file Excel với dữ liệu mẫu & loại điểm cần chọn */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 text-xs">
              {visibleMapperColumns.map((col) => {
                const role = vneduRoleMap[col.index] || 'ignore';
                const isNeedsSelection = role === 'needs_selection';
                const isActive = role !== 'ignore' && !isNeedsSelection;
                return (
                  <div
                    key={col.index}
                    className={`p-2.5 rounded-xl border space-y-1.5 ${
                      isNeedsSelection
                        ? 'bg-amber-50 border-amber-300'
                        : isActive
                        ? 'bg-white border-teal-200 shadow-2xs'
                        : 'bg-slate-100/70 border-slate-200 opacity-75'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-[10px] font-bold mr-1.5">
                          Cột {col.colLetter}
                        </span>
                        <span className="font-bold text-[#102744] truncate">
                          {col.mergedLabel}
                        </span>
                      </div>
                      {isNeedsSelection && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-950 text-[10px] font-bold shrink-0">
                          Cần chọn
                        </span>
                      )}
                    </div>
                    {col.sampleValues.length > 0 && (
                      <div className="text-[10px] text-slate-500 truncate font-mono">
                        Mẫu: {col.sampleValues.join(' • ')}
                      </div>
                    )}
                    <select
                      value={role}
                      onChange={(e) => onChangeColumnRole(col.index, e.target.value as VneduColumnRole)}
                      className={`w-full px-2 py-1.5 rounded-lg border text-xs font-semibold ${
                        isNeedsSelection
                          ? 'border-amber-400 bg-white text-amber-950'
                          : isActive
                          ? 'border-teal-300 bg-teal-50/40 text-[#102744]'
                          : 'border-slate-300 bg-white text-slate-500'
                      }`}
                    >
                      {roleOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>

            {hiddenEmptyColumnsCount > 0 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowEmptyIgnoredCols((v) => !v)}
                  className="text-xs font-semibold text-slate-600 hover:text-[#0C9BA6] underline"
                >
                  {showEmptyIgnoredCols
                    ? `Ẩn ${hiddenEmptyColumnsCount} cột trống / thống kê không chứa điểm học sinh`
                    : `Hiện thêm ${hiddenEmptyColumnsCount} cột trống đã tự động bỏ qua`}
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-white border border-slate-200 text-xs">
              <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preserveExistingWhenBlank}
                  onChange={(e) => setPreserveExistingWhenBlank(e.target.checked)}
                  className="rounded text-[#0C9BA6]"
                />
                <span>
                  Giữ nguyên điểm cũ đã lưu nếu ô trong file mới để trống (khuyên dùng khi nhập bổ sung TX3, TX4)
                </span>
              </label>
              <div className="text-[11px] text-slate-500">
                Kiểu ghép tên: <strong>{nameMode === 'split' ? 'Tách 2 cột (Họ và đệm + Tên)' : '1 cột (Họ và tên đầy đủ)'}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Cảnh báo lỗi ánh xạ, xung đột, lệch ngày sinh hoặc xác minh hệ mã */}
        {(vneduAnalysis.globalErrors.length > 0 ||
          vneduAnalysis.globalWarnings.length > 0 ||
          vneduAnalysis.moetOverlapCount > 0 ||
          vneduAnalysis.autoNameDobCandidateCount > 0 ||
          dobMismatchItems.length > 0) && (
          <div className="space-y-2.5">
            {vneduAnalysis.globalErrors.map((err, i) => (
              <div key={i} className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-semibold">{err}</span>
              </div>
            ))}

            {vneduAnalysis.globalWarnings.map((warn, i) => (
              <div key={i} className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="font-semibold">{warn}</span>
              </div>
            ))}

            {vneduAnalysis.moetOverlapCount > 0 && (
              <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">
                      Phát hiện {vneduAnalysis.moetOverlapCount} dòng có Mã HS trùng khớp với Mã MOET trong danh sách lớp.
                    </div>
                    <div className="text-sky-800">
                      Không tự coi mã vnEdu là Mã MOET nếu chưa xác nhận hệ mã giống nhau.
                    </div>
                  </div>
                </div>
                <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-sky-300 font-bold text-sky-900 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={vneduCodeSystemVerifiedSameAsMoet}
                    onChange={(e) => setVneduCodeSystemVerifiedSameAsMoet(e.target.checked)}
                    className="rounded text-[#0C9BA6]"
                  />
                  <span>Xác nhận Mã file = Mã MOET</span>
                </label>
              </div>
            )}

            {vneduAnalysis.autoNameDobCandidateCount > 0 && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">
                      Có {vneduAnalysis.autoNameDobCandidateCount} học sinh khớp duy nhất cả Họ tên lẫn Ngày sinh.
                    </div>
                    <div className="text-emerald-800">
                      Hệ thống tự động đối chiếu và tích chọn sẵn các học sinh này. Học sinh trùng tên hoặc khác ngày sinh vẫn yêu cầu GVCN xác minh riêng.
                    </div>
                  </div>
                </div>
                <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-emerald-300 font-bold text-emerald-900 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={vneduAutoConfirmExactNameAndDob}
                    onChange={(e) => setVneduAutoConfirmExactNameAndDob(e.target.checked)}
                    className="rounded text-[#0C9BA6]"
                  />
                  <span>Tự động khớp Tên + Ngày sinh</span>
                </label>
              </div>
            )}

            {dobMismatchItems.length > 0 && activeRoleId === 'gvcn' && (
              <div className="p-3.5 rounded-xl bg-orange-50 border border-orange-300 text-xs text-orange-950 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-orange-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">
                      Phát hiện {dobMismatchItems.length} học sinh có Họ tên duy nhất trong lớp nhưng Ngày sinh trong file khác với danh sách lớp.
                    </div>
                    <div className="text-orange-900">
                      Nhiều trường hợp do đảo ngày/tháng giữa vnEdu và danh sách lớp. Hệ thống <strong>không tự ý sửa ngày sinh</strong> ở danh sách lớp hay file Excel — GVCN có thể xem đối chiếu toàn bộ và xác nhận theo nhóm.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openDobGroupModal}
                  className="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold flex items-center gap-1.5 shrink-0 shadow-xs"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>
                    Xác nhận hàng loạt các trường hợp tên duy nhất nhưng khác ngày sinh ({dobMismatchItems.length})
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Trạng thái trống mặc định khi chưa tải file / chưa dán dữ liệu */}
        {summary.totalRows === 0 && (
          <div className="p-6 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-[#102744]">
              <FileSpreadsheet className="w-4 h-4 text-[#0C9BA6]" />
              <span>Số học sinh trong file hiện tại: 0</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500">Đã chọn lưu: 0/0</span>
            </div>
            <p className="text-xs text-slate-600 max-w-2xl mx-auto">
              Chưa có tệp bảng điểm nào được tải lên cho <strong>Lớp {classConfig.className}</strong> ({selectedVneduSubject} — {selectedVneduSemester}). Hãy nhấn <strong>&ldquo;Tải lên tệp Excel / CSV&rdquo;</strong> hoặc dán bảng điểm vnEdu vào ô phía trên để đối chiếu với danh sách chính thức ({students.length} học sinh).
            </p>
          </div>
        )}

        {/* Thanh hành động + thống kê trạng thái đối chiếu */}
        {summary.totalRows > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  statusFilter === 'all' ? 'bg-[#102744] text-white border-[#102744]' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="text-[10px] opacity-80 font-semibold">Tổng HS trong file</div>
                <div className="text-lg font-extrabold">{summary.totalRows}</div>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('matched_by_code')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  statusFilter === 'matched_by_code'
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                <div className="text-[10px] opacity-80 font-semibold">Khớp theo mã</div>
                <div className="text-lg font-extrabold">{summary.matchedByCodeCount}</div>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('matched_auto')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  statusFilter === 'matched_auto'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-emerald-50/70 border-emerald-300 text-emerald-900'
                }`}
              >
                <div className="text-[10px] opacity-80 font-semibold">Tự động khớp</div>
                <div className="text-lg font-extrabold">{summary.matchedAutoCount}</div>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('matched_by_gvcn')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  statusFilter === 'matched_by_gvcn'
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'bg-teal-50 border-teal-200 text-teal-900'
                }`}
              >
                <div className="text-[10px] opacity-80 font-semibold">GVCN xác nhận</div>
                <div className="text-lg font-extrabold">{summary.matchedByGvcnCount}</div>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('name_match_dob_mismatch')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  statusFilter === 'name_match_dob_mismatch'
                    ? 'bg-orange-600 text-white border-orange-600'
                    : 'bg-orange-50 border-orange-300 text-orange-950'
                }`}
              >
                <div className="text-[10px] opacity-80 font-semibold">Khớp tên – lệch NS</div>
                <div className="text-lg font-extrabold">{summary.dobMismatchCount}</div>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('needs_verification')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  statusFilter === 'needs_verification'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="text-[10px] opacity-80 font-semibold">Trùng tên / Kiểm tra</div>
                <div className="text-lg font-extrabold">{summary.needsVerificationCount}</div>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('not_found')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  statusFilter === 'not_found'
                    ? 'bg-rose-700 text-white border-rose-700'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <div className="text-[10px] opacity-80 font-semibold">Không tìm thấy</div>
                <div className="text-lg font-extrabold">{summary.notFoundCount}</div>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('duplicate_or_invalid')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  statusFilter === 'duplicate_or_invalid'
                    ? 'bg-purple-700 text-white border-purple-700'
                    : 'bg-purple-50 border-purple-200 text-purple-900'
                }`}
              >
                <div className="text-[10px] opacity-80 font-semibold">Trùng / Lỗi</div>
                <div className="text-lg font-extrabold">{summary.duplicateOrInvalidCount}</div>
              </button>
            </div>

            {/* Thanh công cụ thao tác nhanh */}
            <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2 text-xs">
                <div className="space-y-1">
                  <div className="font-bold text-[#102744] flex flex-wrap items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>
                      Đã chọn lưu ({selectedVneduSubject} — {selectedVneduSemester}):{' '}
                      <strong className="text-emerald-700">
                        {selectedCount}/{summary.totalRows} học sinh
                      </strong>
                      {eligibleItems.length !== selectedCount && (
                        <span className="text-slate-500 font-semibold">
                          {' '}
                          (đủ điều kiện: {eligibleItems.length})
                        </span>
                      )}
                    </span>
                    {preSaveSummary.newScoreCells > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold">
                        +{preSaveSummary.newScoreCells} điểm mới
                      </span>
                    )}
                    {preSaveSummary.updatedScoreCells > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold">
                        {preSaveSummary.updatedScoreCells} điểm thay đổi
                      </span>
                    )}
                  </div>
                  {unselectedCount > 0 && (
                    <div className="text-amber-800 font-semibold">
                      Còn {unselectedCount} dòng chưa được chọn hoặc chưa xác minh sẽ chưa lưu vào Firestore (không ghi nhầm, không tạo HS mới).
                    </div>
                  )}
                </div>

                <div className="relative shrink-0">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm tên / mã HS..."
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs w-48"
                  />
                </div>
              </div>

              {rosterRefreshedAtMs && (
                <div className="text-[11px] text-sky-800 font-medium">
                  Hồ sơ lớp {classConfig.className} ({students.length} HS) vừa được làm mới từ Firestore lúc{' '}
                  <strong>{new Date(rosterRefreshedAtMs).toLocaleTimeString('vi-VN')}</strong>.
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isRefreshingRoster}
                  onClick={onRefreshRosterAndReconcile}
                  className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingRoster ? 'animate-spin' : ''}`} />
                  <span>
                    {isRefreshingRoster ? 'Đang làm mới...' : 'Làm mới hồ sơ và đối chiếu lại'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onAutoReconcileAll}
                  disabled={students.length === 0}
                  className="px-3 py-2 rounded-xl bg-[#102744] hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Tự động đối chiếu</span>
                </button>
                <button
                  type="button"
                  onClick={onSelectAllEligible}
                  disabled={eligibleItems.length === 0}
                  className="px-3 py-2 rounded-xl bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-800 disabled:opacity-50 text-xs font-bold flex items-center gap-1.5"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Chọn tất cả đủ điều kiện ({eligibleItems.length})</span>
                </button>
                <button
                  type="button"
                  onClick={onClearSelections}
                  disabled={selectedCount === 0}
                  className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 disabled:opacity-50 text-xs font-bold"
                >
                  Bỏ chọn
                </button>
                {activeRoleId === 'gvcn' && (dobMismatchItems.length > 0 || summary.needsVerificationCount > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (dobMismatchItems.length > 0) {
                        openDobGroupModal();
                      } else {
                        setStatusFilter('needs_verification');
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>
                      Xác nhận các trường hợp cần kiểm tra (
                      {dobMismatchItems.length + summary.needsVerificationCount})
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCheckColumns}
                  className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold flex items-center gap-1.5"
                >
                  <ClipboardCheck className="w-3.5 h-3.5 text-[#0C9BA6]" />
                  <span>Kiểm tra cột điểm</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter((f) => (f === 'changed' ? 'all' : 'changed'))}
                  className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
                    statusFilter === 'changed'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Xem điểm thay đổi</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancelClick}
                  className="px-3 py-2 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Hủy nhập</span>
                </button>
                {activeRoleId === 'gvcn' && (
                  <button
                    type="button"
                    disabled={isImportingVnedu || selectedCount === 0 || hasBlockingMappingError}
                    onClick={() => setShowConfirmSaveModal(true)}
                    className="ml-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs"
                  >
                    {isImportingVnedu
                      ? 'Đang lưu điểm...'
                      : `XÁC NHẬN LƯU ĐIỂM CÁC HỌC SINH ĐÃ CHỌN (${selectedCount}/${summary.totalRows})`}
                  </button>
                )}
              </div>
            </div>

            {/* Bảng xem trước đối chiếu chi tiết — có checkbox từng dòng & header Chọn tất cả đủ điều kiện */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl relative">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase whitespace-nowrap">
                    <th className="py-2.5 px-3 text-center w-10">
                      <input
                        ref={headerCheckboxRef}
                        type="checkbox"
                        checked={allEligibleSelected}
                        disabled={eligibleItems.length === 0}
                        onChange={() => {
                          if (allEligibleSelected) onClearSelections();
                          else onSelectAllEligible();
                        }}
                        title="Chọn tất cả đủ điều kiện"
                        aria-label="Chọn tất cả đủ điều kiện"
                        className="rounded text-[#0C9BA6] cursor-pointer disabled:opacity-40"
                      />
                    </th>
                    <th className="py-2.5 px-3">STT</th>
                    <th className="py-2.5 px-3">Mã vnEdu</th>
                    <th className="py-2.5 px-3 md:sticky md:left-0 md:z-10 bg-slate-50 border-r border-slate-200 min-w-[170px]">
                      Họ và tên đầy đủ
                    </th>
                    <th className="py-2.5 px-3 min-w-[155px]">Ngày sinh (File / Lớp)</th>
                    <th className="py-2.5 px-3 min-w-[235px]">HS tương ứng trong lớp</th>
                    <th className="py-2.5 px-3">Tổ</th>
                    <th className="py-2.5 px-3 min-w-[195px]">Trạng thái đối chiếu</th>
                    {vneduAnalysis.txOrders.map((ord) => (
                      <th key={`th_tx_${ord}`} className="py-2.5 px-3 text-center">
                        TX{ord}
                      </th>
                    ))}
                    {vneduAnalysis.hasGkMapped && <th className="py-2.5 px-3 text-center">GK</th>}
                    {vneduAnalysis.hasCkMapped && <th className="py-2.5 px-3 text-center">CK</th>}
                    {vneduAnalysis.hasAvgHkMapped && <th className="py-2.5 px-3 text-center">ĐTB HK</th>}
                    {vneduAnalysis.hasAvgCnMapped && <th className="py-2.5 px-3 text-center">ĐTB CN</th>}
                    <th className="py-2.5 px-3 min-w-[180px]">Ghi chú &amp; Điểm thay đổi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => {
                    const meta = MATCH_STATUS_META[item.status];
                    const currentResolution = vneduRowResolutions[item.excelRowNumber] || { type: 'auto' };
                    const selectedStudentId =
                      currentResolution.type === 'confirm'
                        ? currentResolution.studentId
                        : item.matchedStudent?.id || '';
                    const saveLinkFlag =
                      currentResolution.type === 'confirm' ? currentResolution.saveLink : Boolean(item.vneduCode);
                    const isRowChecked = Boolean(item.canSave && !vneduDeselectedRows[item.excelRowNumber]);
                    const isDobDifferent =
                      item.dobComparison &&
                      (item.dobComparison.kind === 'swapped_day_month' ||
                        item.dobComparison.kind === 'different');

                    return (
                      <tr key={`${item.excelRowNumber}_${item.rowIndex}`} className={meta.rowClass}>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isRowChecked}
                            disabled={!item.canSave}
                            onChange={() => onToggleRowSelection(item.excelRowNumber)}
                            title={
                              item.canSave
                                ? isRowChecked
                                  ? 'Bỏ chọn dòng này khỏi danh sách lưu'
                                  : 'Chọn dòng này để lưu điểm'
                                : 'Chưa đủ điều kiện lưu — cần xác minh học sinh trước'
                            }
                            className="rounded text-[#0C9BA6] cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                          <div className="font-bold text-slate-700">{item.stt || item.rowIndex + 1}</div>
                          <div className="text-[10px] text-slate-400">Dòng {item.excelRowNumber}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700 whitespace-nowrap">
                          {item.vneduCode || '—'}
                        </td>
                        <td className="py-2.5 px-3 md:sticky md:left-0 md:z-10 bg-white border-r border-slate-100 min-w-[170px]">
                          <div className="font-bold text-slate-900">{item.resolvedFullName || '—'}</div>
                          {nameMode === 'split' && (item.lastNamePart || item.firstNamePart) && (
                            <div className="text-[10px] text-slate-500">
                              [{item.lastNamePart}] + [{item.firstNamePart}]
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 min-w-[155px]">
                          {isDobDifferent && item.dobComparison ? (
                            <div className="space-y-0.5 text-[11px]">
                              <div>
                                <span className="text-slate-400">File:</span>{' '}
                                <span className="font-mono font-bold text-orange-800">
                                  {item.dobComparison.fileDob}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400">Lớp:</span>{' '}
                                <span className="font-mono font-bold text-[#102744]">
                                  {item.dobComparison.rosterDob}
                                </span>
                              </div>
                              {item.dobComparison.kind === 'swapped_day_month' && (
                                <span className="inline-block px-1.5 py-0.5 rounded bg-orange-100 text-orange-900 text-[10px] font-bold">
                                  Đảo ngày/tháng
                                </span>
                              )}
                            </div>
                          ) : (
                            <span>{item.dob || item.matchedStudent?.dob || '—'}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 min-w-[235px]">
                          {activeRoleId === 'gvcn' && item.status !== 'duplicate_or_invalid' ? (
                            <div className="space-y-1">
                              <StudentSearchPicker
                                students={students}
                                classNameLabel={classConfig.className}
                                selectedStudentId={selectedStudentId}
                                candidates={item.candidates}
                                recommendedCandidate={item.recommendedCandidate}
                                isManualSelection={currentResolution.type !== 'auto'}
                                isSkipped={currentResolution.type === 'skip'}
                                onSelectStudent={(sid) =>
                                  onSetRowResolution(item.excelRowNumber, {
                                    type: 'confirm',
                                    studentId: sid,
                                    saveLink: Boolean(item.vneduCode),
                                    source: 'manual',
                                  })
                                }
                                onSkipRow={() =>
                                  onSetRowResolution(item.excelRowNumber, { type: 'skip' })
                                }
                                onResetAuto={() =>
                                  onSetRowResolution(item.excelRowNumber, { type: 'auto' })
                                }
                              />
                              {item.matchedStudent && (
                                <div className="text-[10px] font-mono text-slate-500 flex flex-wrap items-center gap-x-2">
                                  <span>MOET: {item.matchedStudent.moetCode || item.matchedStudent.code}</span>
                                  {item.matchedStudent.dob && <span>NS: {item.matchedStudent.dob}</span>}
                                </div>
                              )}
                              {item.vneduCode && currentResolution.type === 'confirm' && (
                                <label className="flex items-center gap-1.5 text-[10px] font-semibold text-teal-800 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={saveLinkFlag}
                                    onChange={(e) =>
                                      onSetRowResolution(item.excelRowNumber, {
                                        type: 'confirm',
                                        studentId: currentResolution.studentId,
                                        saveLink: e.target.checked,
                                        source: currentResolution.source || 'manual',
                                      })
                                    }
                                    className="rounded text-[#0C9BA6]"
                                  />
                                  <span>Lưu liên kết mã {item.vneduCode}</span>
                                </label>
                              )}
                            </div>
                          ) : item.matchedStudent ? (
                            <div>
                              <div className="font-bold text-[#102744]">{item.matchedStudent.fullName}</div>
                              <div className="text-[10px] font-mono text-slate-500">
                                MOET: {item.matchedStudent.moetCode || item.matchedStudent.code}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Chưa liên kết</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap font-bold text-[#0C9BA6]">
                          {item.matchedStudent ? `Tổ ${item.matchedStudent.team}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 min-w-[195px]">
                          <div className="flex flex-wrap items-center gap-1">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md border text-[11px] font-bold ${meta.badgeClass}`}
                            >
                              {meta.label}
                            </span>
                            {item.isDuplicateNameInClass && (
                              <span className="inline-block px-1.5 py-0.5 rounded bg-amber-200 text-amber-950 text-[10px] font-bold">
                                Trùng tên trong lớp
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-600 mt-1">{item.statusReason}</div>
                          {activeRoleId === 'gvcn' &&
                            item.status === 'name_match_dob_mismatch' &&
                            item.recommendedCandidate && (
                              <button
                                type="button"
                                onClick={() =>
                                  onSetRowResolution(item.excelRowNumber, {
                                    type: 'confirm',
                                    studentId: item.recommendedCandidate!.id,
                                    saveLink: Boolean(item.vneduCode),
                                    source: 'manual',
                                  })
                                }
                                className="mt-1.5 px-2 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-bold"
                              >
                                Xác nhận đúng {item.recommendedCandidate.fullName}
                              </button>
                            )}
                        </td>
                        {vneduAnalysis.txOrders.map((ord) => {
                          const cell = item.txValues[ord];
                          return (
                            <td key={`cell_tx_${ord}`} className="py-2.5 px-3 text-center font-semibold">
                              {cell?.qualitative || (cell?.value !== null && cell?.value !== undefined ? cell.value : '—')}
                            </td>
                          );
                        })}
                        {vneduAnalysis.hasGkMapped && (
                          <td className="py-2.5 px-3 text-center font-semibold">
                            {item.gk.qualitative || (item.gk.value !== null ? item.gk.value : '—')}
                          </td>
                        )}
                        {vneduAnalysis.hasCkMapped && (
                          <td className="py-2.5 px-3 text-center font-semibold">
                            {item.ck.qualitative || (item.ck.value !== null ? item.ck.value : '—')}
                          </td>
                        )}
                        {vneduAnalysis.hasAvgHkMapped && (
                          <td className="py-2.5 px-3 text-center font-extrabold text-[#0C9BA6]">
                            {item.avgHk.qualitative || (item.avgHk.value !== null ? item.avgHk.value : '—')}
                          </td>
                        )}
                        {vneduAnalysis.hasAvgCnMapped && (
                          <td className="py-2.5 px-3 text-center font-extrabold text-indigo-700">
                            {item.avgCn.qualitative || (item.avgCn.value !== null ? item.avgCn.value : '—')}
                          </td>
                        )}
                        <td className="py-2.5 px-3 min-w-[180px]">
                          <div className="text-slate-600">{item.note || '—'}</div>
                          {item.qualitativeValues.length > 0 && (
                            <div className="text-[10px] text-teal-800 font-semibold mt-0.5">
                              {item.qualitativeValues.join(' • ')}
                            </div>
                          )}
                          {item.scoreDiffs.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {item.scoreDiffs.map((d) => (
                                <span
                                  key={d.field}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    d.kind === 'added'
                                      ? 'bg-emerald-100 text-emerald-900'
                                      : 'bg-amber-100 text-amber-900'
                                  }`}
                                >
                                  {d.kind === 'added'
                                    ? `+ ${d.label}: ${d.newValue}`
                                    : `${d.label}: ${d.oldValue} → ${d.newValue}`}
                                </span>
                              ))}
                            </div>
                          )}
                          {item.hasExistingScore && item.scoreDiffs.length === 0 && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]">
                              Giữ nguyên điểm đã lưu
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Bảng điểm đã lưu cho môn & học kỳ đang chọn */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-sm text-[#102744]">
            Bảng điểm Môn {selectedVneduSubject} ({selectedVneduSemester}) đã lưu ({savedScoresMeta.count}/{students.length} HS)
          </h3>
          <span className="text-xs text-slate-500">
            Hỗ trợ mở rộng TX1..TX{Math.max(4, ...savedScoresMeta.extraOrdersSorted)} và đánh giá Đạt / Chưa đạt
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase whitespace-nowrap">
                <th className="py-2.5 px-3">Mã MOET / HS</th>
                <th className="py-2.5 px-3">Họ và tên</th>
                <th className="py-2.5 px-3">Tổ</th>
                <th className="py-2.5 px-3">TX1</th>
                <th className="py-2.5 px-3">TX2</th>
                {savedScoresMeta.extraOrdersSorted.map((ord) => (
                  <th key={`saved_th_tx_${ord}`} className="py-2.5 px-3">
                    TX{ord}
                  </th>
                ))}
                <th className="py-2.5 px-3">GK</th>
                <th className="py-2.5 px-3">CK</th>
                <th className="py-2.5 px-3">ĐTB</th>
                <th className="py-2.5 px-3">Đánh giá / Nhận xét</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={9 + savedScoresMeta.extraOrdersSorted.length} className="py-8 text-center text-slate-500">
                    Chưa có danh sách học sinh trong lớp.
                  </td>
                </tr>
              ) : (
                students.map((st) => {
                  const rec = savedScoresMeta.byCode[st.code];
                  const sc = rec?.score;
                  const meta = rec?.meta;
                  return (
                    <tr key={st.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{st.moetCode || st.code}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{st.fullName}</td>
                      <td className="py-2.5 px-3">Tổ {st.team}</td>
                      <td className="py-2.5 px-3">{sc?.tx1 ?? '—'}</td>
                      <td className="py-2.5 px-3">{sc?.tx2 ?? '—'}</td>
                      {savedScoresMeta.extraOrdersSorted.map((ord) => (
                        <td key={`saved_tx_${st.id}_${ord}`} className="py-2.5 px-3">
                          {meta?.txMap[ord] ?? '—'}
                        </td>
                      ))}
                      <td className="py-2.5 px-3">{sc?.gk ?? '—'}</td>
                      <td className="py-2.5 px-3">{sc?.ck ?? '—'}</td>
                      <td className="py-2.5 px-3 font-extrabold text-[#0C9BA6]">
                        {sc?.avg ?? (meta?.qualitativeBadge || '—')}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {meta?.qualitativeBadge && sc?.avg !== null && (
                          <span className="mr-1.5 px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 font-semibold">
                            {meta.qualitativeBadge}
                          </span>
                        )}
                        {meta?.cleanNote || (meta?.qualitativeBadge ? '' : '—')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lịch sử nhập bảng điểm */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
        <h3 className="font-bold text-sm text-[#102744]">Lịch sử Nhập bảng điểm vnEdu ({vneduImportHistory.length})</h3>
        {vneduImportHistory.length === 0 ? (
          <p className="text-xs text-slate-500">Chưa có lượt nhập điểm vnEdu nào.</p>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {vneduImportHistory.map((h) => (
              <div key={h.id} className="py-2 flex items-center justify-between">
                <span>
                  Môn <strong>{h.subject}</strong> — Đã lưu <strong>{h.studentCount}</strong> học sinh
                </span>
                <span className="text-slate-400">
                  {h.importedBy} • {new Date(h.importedAtMs).toLocaleString('vi-VN')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal xác nhận hàng loạt nhóm tên duy nhất nhưng khác ngày sinh */}
      {showDobGroupModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3 bg-orange-50/70">
              <div>
                <h3 className="font-extrabold text-base text-[#102744] flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-orange-600" />
                  <span>
                    Xác nhận hàng loạt trường hợp tên duy nhất nhưng khác ngày sinh ({dobMismatchItems.length} HS)
                  </span>
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Kiểm tra đối chiếu Ngày sinh trong lớp và Ngày sinh trong file vnEdu trước khi xác nhận theo nhóm. Hệ thống <strong>không tự ý sửa ngày sinh</strong> trong hồ sơ lớp hay file Excel.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDobGroupModal(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/70"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 flex-1">
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase whitespace-nowrap">
                      <th className="py-2.5 px-3 text-center w-10">
                        <input
                          type="checkbox"
                          checked={
                            dobMismatchItems.length > 0 &&
                            checkedDobMismatchItems.length === dobMismatchItems.length
                          }
                          onChange={(e) => {
                            const next: Record<number, boolean> = {};
                            dobMismatchItems.forEach((it) => {
                              next[it.excelRowNumber] = e.target.checked;
                            });
                            setDobGroupChecked(next);
                          }}
                          className="rounded text-[#0C9BA6]"
                        />
                      </th>
                      <th className="py-2.5 px-3">STT</th>
                      <th className="py-2.5 px-3">Mã vnEdu</th>
                      <th className="py-2.5 px-3">Họ và tên (duy nhất trong lớp)</th>
                      <th className="py-2.5 px-3">Tổ</th>
                      <th className="py-2.5 px-3">Ngày sinh trong lớp</th>
                      <th className="py-2.5 px-3">Ngày sinh trong file</th>
                      <th className="py-2.5 px-3">Chênh lệch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dobMismatchItems.map((it) => {
                      const cand = it.recommendedCandidate!;
                      const isSwapped = it.dobComparison?.kind === 'swapped_day_month';
                      return (
                        <tr key={it.excelRowNumber} className="hover:bg-orange-50/30">
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={Boolean(dobGroupChecked[it.excelRowNumber])}
                              onChange={(e) =>
                                setDobGroupChecked((prev) => ({
                                  ...prev,
                                  [it.excelRowNumber]: e.target.checked,
                                }))
                              }
                              className="rounded text-[#0C9BA6]"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-700">
                            {it.stt || it.rowIndex + 1}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                            {it.vneduCode || '—'}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-[#102744]">{cand.fullName}</div>
                            <div className="text-[10px] font-mono text-slate-500">
                              MOET: {cand.moetCode || cand.code}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-[#0C9BA6]">Tổ {cand.team}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-[#102744]">
                            {it.dobComparison?.rosterDob || cand.dob || '—'}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-orange-800">
                            {it.dobComparison?.fileDob || it.dob || '—'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                isSwapped
                                  ? 'bg-orange-100 text-orange-900 border border-orange-300'
                                  : 'bg-amber-100 text-amber-900 border border-amber-300'
                              }`}
                            >
                              {isSwapped ? 'Đảo ngày/tháng' : 'Khác ngày sinh'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dobGroupSaveLink}
                  onChange={(e) => setDobGroupSaveLink(e.target.checked)}
                  className="rounded text-[#0C9BA6]"
                />
                <span>
                  Ghi nhớ liên kết Mã HS vnEdu cho các học sinh này (tự nhận diện ở các lần nhập điểm sau)
                </span>
              </label>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowDobGroupModal(false)}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled={checkedDobMismatchItems.length === 0}
                  onClick={handleConfirmDobModalSubmit}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold"
                >
                  Xác nhận &amp; tích chọn {checkedDobMismatchItems.length} học sinh
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal tổng hợp an toàn trước khi lưu điểm vào Firestore */}
      {showConfirmSaveModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-emerald-50/70 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-base text-[#102744] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Xác nhận lưu bảng điểm vào hệ thống</span>
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Lớp <strong>{classConfig.className}</strong> • Môn <strong>{selectedVneduSubject}</strong> •{' '}
                  <strong>{selectedVneduSemester}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmSaveModal(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/70"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="text-emerald-800 font-semibold">Số học sinh được lưu</div>
                  <div className="text-2xl font-extrabold text-emerald-700 mt-0.5">
                    {preSaveSummary.selectedCount}
                  </div>
                  <div className="text-[11px] text-emerald-700/80 mt-0.5">
                    ({preSaveSummary.newStudents} HS nhập mới • {preSaveSummary.changedStudents} HS cập nhật)
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-600 font-semibold">Số học sinh chưa được lưu</div>
                  <div className="text-2xl font-extrabold text-slate-800 mt-0.5">
                    {preSaveSummary.unselectedCount}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Bỏ qua an toàn, không tạo HS mới
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200">
                  <div className="text-teal-800 font-semibold">Số điểm mới</div>
                  <div className="text-2xl font-extrabold text-teal-700 mt-0.5">
                    {preSaveSummary.newScoreCells}
                  </div>
                  <div className="text-[11px] text-teal-700/80 mt-0.5">
                    Ô điểm trống giữ nguyên (null), giữ đúng điểm 0
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="text-amber-800 font-semibold">Số điểm có thay đổi so với dữ liệu cũ</div>
                  <div className="text-2xl font-extrabold text-amber-700 mt-0.5">
                    {preSaveSummary.updatedScoreCells}
                  </div>
                  <div className="text-[11px] text-amber-700/80 mt-0.5">
                    {preserveExistingWhenBlank
                      ? 'Điểm cũ được giữ nguyên nếu ô mới để trống'
                      : 'Ghi đè theo bảng điểm mới'}
                  </div>
                </div>
              </div>

              {preSaveSummary.linksToRemember > 0 && (
                <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-900">
                  Hệ thống sẽ đồng thời ghi nhớ <strong>{preSaveSummary.linksToRemember}</strong> liên kết Mã HS vnEdu cho Lớp {classConfig.className} ({classConfig.schoolYear}) để tự động đối chiếu ở các lần nhập điểm sau.
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowConfirmSaveModal(false)}
                className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold"
              >
                Quay lại kiểm tra
              </button>
              <button
                type="button"
                disabled={isImportingVnedu || preSaveSummary.selectedCount === 0}
                onClick={() => {
                  setShowConfirmSaveModal(false);
                  onConfirmImport();
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold shadow-xs"
              >
                Lưu các dòng đã duyệt ({preSaveSummary.selectedCount} HS)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 4. THEO DÕI HỌC TẬP LỚP 12
interface Grade12TabProps {
  activeRoleId: string;
  classConfig: ClassConfig;
  students: StudentRecord[];
  grade12Profiles: Record<string, Grade12Profile>;
  subjectScores: Record<string, SubjectScoreRecord>;
  subjectKey: string;
  onEditStudent: (st: StudentRecord) => void;
}

export function Grade12Tab({
  activeRoleId,
  classConfig,
  students,
  grade12Profiles,
  subjectScores,
  subjectKey,
  onEditStudent,
}: Grade12TabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#102744] flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-[#0C9BA6]" />
          <span>Theo dõi Học tập & Hướng nghiệp Lớp 12 ({classConfig.className})</span>
        </h2>
        <p className="text-sm text-slate-500">
          Quản lý tổ hợp xét tuyển, nguyện vọng Đại học/Cao đẳng, kết quả thi thử và mức độ sẵn sàng tốt nghiệp.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-3 px-4">Học sinh</th>
                <th className="py-3 px-4">ĐTB {classConfig.subject}</th>
                <th className="py-3 px-4">Tổ hợp xét tuyển</th>
                <th className="py-3 px-4">Ngành / Trường mục tiêu</th>
                <th className="py-3 px-4">Thi thử Đ1 / Đ2</th>
                <th className="py-3 px-4">Sẵn sàng</th>
                {activeRoleId === 'gvcn' && <th className="py-3 px-4 text-right">Cập nhật</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={activeRoleId === 'gvcn' ? 7 : 6} className="py-10 text-center text-slate-500">
                    Chưa có danh sách học sinh trong lớp.
                  </td>
                </tr>
              ) : (
                students.map((st) => {
                  const prof = grade12Profiles[st.code];
                  const sc = subjectScores[`${st.code}_${subjectKey}`];
                  return (
                    <tr key={st.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {st.fullName} <span className="font-mono text-slate-400">({st.code})</span>
                      </td>
                      <td className="py-3 px-4 font-extrabold text-[#0C9BA6]">{sc?.avg ?? '—'}</td>
                      <td className="py-3 px-4 font-semibold text-slate-700">{prof?.examBlock || 'Chưa chọn'}</td>
                      <td className="py-3 px-4 text-slate-700">
                        {prof?.targetMajor || prof?.targetUniversity
                          ? `${prof?.targetMajor || ''} — ${prof?.targetUniversity || ''}`
                          : 'Chưa cập nhật'}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {prof?.mockScore1 || '—'} / {prof?.mockScore2 || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-lg font-bold ${
                            prof?.readiness === 'Đạt mục tiêu'
                              ? 'bg-emerald-100 text-emerald-800'
                              : prof?.readiness === 'Cần phụ đạo tốt nghiệp'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {prof?.readiness || 'Chưa đánh giá'}
                        </span>
                      </td>
                      {activeRoleId === 'gvcn' && (
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => onEditStudent(st)}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold inline-flex items-center gap-1"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Cập nhật</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// 5. PHÂN TÍCH HỌC TẬP AI
interface AiAnalysisTabProps {
  classConfig: ClassConfig;
  aiAnalysisScope: string;
  setAiAnalysisScope: (v: string) => void;
  aiAnalysisResult: string;
  isGeneratingAiAnalysis: boolean;
  onRunAnalysis: () => void;
}

export function AiAnalysisTab({
  classConfig,
  aiAnalysisScope,
  setAiAnalysisScope,
  aiAnalysisResult,
  isGeneratingAiAnalysis,
  onRunAnalysis,
}: AiAnalysisTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#102744] flex items-center gap-2">
            <Bot className="w-6 h-6 text-[#0C9BA6]" />
            <span>Trợ lý Gemini AI Phân tích Học tập & Nề nếp</span>
          </h2>
          <p className="text-sm text-slate-500">
            AI chỉ tổng hợp từ dữ liệu đã xác nhận trên Cloud Firestore (Lớp {classConfig.className}), không tự bịa thêm số liệu.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={aiAnalysisScope}
            onChange={(e) => setAiAnalysisScope(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
          >
            <option value="all">Toàn diện Lớp {classConfig.className}</option>
            <option value="subject">Trọng tâm Môn {classConfig.subject}</option>
            <option value="grade12">Ôn thi Tốt nghiệp Lớp 12</option>
          </select>
          <button
            type="button"
            disabled={isGeneratingAiAnalysis}
            onClick={onRunAnalysis}
            className="px-4 py-2 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-sm"
          >
            {isGeneratingAiAnalysis ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{isGeneratingAiAnalysis ? 'Đang phân tích...' : 'Chạy phân tích AI'}</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs min-h-[260px]">
        {aiAnalysisResult ? (
          <div className="whitespace-pre-wrap text-sm text-slate-800 leading-relaxed">{aiAnalysisResult}</div>
        ) : (
          <div className="h-48 flex flex-col items-center justify-center text-center text-slate-400 text-sm">
            <Bot className="w-10 h-10 mb-2 text-slate-300" />
            <p>Bấm &quot;Chạy phân tích AI&quot; để Gemini tổng hợp tình hình lớp học từ dữ liệu thật.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// 6. NHẬN XÉT & TIN NHẮN PHỤ HUYNH
interface ParentCommTabProps {
  classConfig: ClassConfig;
  students: StudentRecord[];
  selectedCommStudentId: string;
  setSelectedCommStudentId: (v: string) => void;
  commPurpose: string;
  setCommPurpose: (v: string) => void;
  commTone: string;
  setCommTone: (v: string) => void;
  commExtraContext: string;
  setCommExtraContext: (v: string) => void;
  generatedMessage: string;
  generatedReportCardDraft: string;
  isGeneratingComm: boolean;
  onGenerateComm: () => void;
  onCopyText: (text: string, label: string) => void;
}

export function ParentCommTab({
  classConfig,
  students,
  selectedCommStudentId,
  setSelectedCommStudentId,
  commPurpose,
  setCommPurpose,
  commTone,
  setCommTone,
  commExtraContext,
  setCommExtraContext,
  generatedMessage,
  generatedReportCardDraft,
  isGeneratingComm,
  onGenerateComm,
  onCopyText,
}: ParentCommTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#102744] flex items-center gap-2">
          <MessageSquareHeart className="w-6 h-6 text-[#0C9BA6]" />
          <span>Soạn Nhận xét Học bạ & Tin nhắn Phụ huynh (AI)</span>
        </h2>
        <p className="text-sm text-slate-500">
          Chuẩn hóa văn phong sư phạm, cá nhân hóa theo điểm số môn {classConfig.subject} và kết quả thi đua thực tế của từng em.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-sm">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Chọn học sinh</label>
            <select
              value={selectedCommStudentId}
              onChange={(e) => setSelectedCommStudentId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            >
              <option value="">-- Chọn học sinh --</option>
              {students.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.fullName} ({st.code} - Tổ {st.team})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Mục đích trao đổi</label>
            <select
              value={commPurpose}
              onChange={(e) => setCommPurpose(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            >
              <option value="praise">Khen ngợi tiến bộ & ý thức tốt</option>
              <option value="grade12_consult">Tư vấn ôn thi TN THPT Lớp 12</option>
              <option value="study_support">Phối hợp hỗ trợ học tập</option>
              <option value="attendance_remind">Nhắc nhở tế nhị chuyên cần / nề nếp</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Giọng văn</label>
            <select
              value={commTone}
              onChange={(e) => setCommTone(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            >
              <option value="warm">Gần gũi, động viên phụ huynh</option>
              <option value="formal">Trang trọng, chuẩn mực hành chính</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Ghi chú thêm của GVCN</label>
            <textarea
              rows={3}
              value={commExtraContext}
              onChange={(e) => setCommExtraContext(e.target.value)}
              placeholder="VD: Gần đây em rất chịu khó giơ tay phát biểu tiết Toán..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>

          <button
            type="button"
            disabled={!selectedCommStudentId || isGeneratingComm}
            onClick={onGenerateComm}
            className="w-full py-2.5 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2"
          >
            {isGeneratingComm ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{isGeneratingComm ? 'Đang soạn thảo...' : 'Soạn tin nhắn & học bạ bằng AI'}</span>
          </button>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#102744]">Tin nhắn gửi Phụ huynh</h3>
              {generatedMessage && (
                <button
                  type="button"
                  onClick={() => onCopyText(generatedMessage, 'tin nhắn phụ huynh')}
                  className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Sao chép</span>
                </button>
              )}
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 min-h-[120px] whitespace-pre-wrap text-sm text-slate-800">
              {generatedMessage || 'Chọn học sinh và bấm nút soạn thảo để tạo nội dung.'}
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#102744]">Nhận xét Học bạ cuối kỳ</h3>
              {generatedReportCardDraft && (
                <button
                  type="button"
                  onClick={() => onCopyText(generatedReportCardDraft, 'nhận xét học bạ')}
                  className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Sao chép</span>
                </button>
              )}
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 min-h-[100px] whitespace-pre-wrap text-sm text-slate-800">
              {generatedReportCardDraft || 'Nhận xét học bạ gợi ý sẽ hiển thị tại đây.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 7. BÁO CÁO & XUẤT DỮ LIỆU
interface ReportsTabProps {
  classConfig: ClassConfig;
  students: StudentRecord[];
  tickets: TicketRecord[];
  weeklySnapshots: WeeklySnapshot[];
  subjectScores: Record<string, SubjectScoreRecord>;
  onExportCsv: (filename: string, headers: string[], rows: (string | number)[][]) => void;
}

export function ReportsTab({
  classConfig,
  students,
  tickets,
  weeklySnapshots,
  subjectScores,
  onExportCsv,
}: ReportsTabProps) {
  const [selectedReportSemester, setSelectedReportSemester] = React.useState<VneduSemester>('Học kỳ I');

  const exportSubjects = React.useMemo(() => {
    const list: string[] = [...VNEDU_SUBJECTS];
    if (classConfig.subject && !list.includes(classConfig.subject)) {
      list.unshift(classConfig.subject);
    }
    Object.values(subjectScores).forEach((sc) => {
      const baseSub = (sc.subject || '').replace(/\s*\((?:HK II|Cả năm)\)$/i, '').trim();
      if (baseSub && !list.includes(baseSub)) {
        list.push(baseSub);
      }
    });
    return list;
  }, [classConfig.subject, subjectScores]);

  const getStudentSubjectDisplay = (stCode: string, sub: string): string | number => {
    const slug = normalizeSlug(sub, 'toan').slice(0, 60);
    const rec = subjectScores[getVneduScoreDocId(stCode, slug, selectedReportSemester)];
    if (!rec) return '';
    if (rec.avg !== null && rec.avg !== undefined) return rec.avg;
    const meta = extractExtraTxFromNote(rec.note);
    return meta.qualitativeBadge || '';
  };

  const handleExportStudents = () => {
    const getRoleLabel = (roleId: string) => {
      if (!roleId || roleId === 'member') return 'Thành viên';
      return ROLES.find((r) => r.id === roleId)?.title || roleId;
    };

    onExportCsv(
      `DanhSachHocSinh_DiemCacMon_${classConfig.className}_${selectedReportSemester}_${classConfig.schoolYear}.csv`,
      [
        'Mã HS / MOET',
        'Họ và tên',
        'Giới tính',
        'Ngày sinh',
        'Tổ',
        'Chức vụ',
        ...exportSubjects.map((sub) => `ĐTB ${sub} (${selectedReportSemester})`),
      ],
      students.map((s) => [
        s.moetCode || s.code,
        s.fullName,
        s.gender,
        s.dob || '',
        `Tổ ${s.team}`,
        getRoleLabel(s.role),
        ...exportSubjects.map((sub) => getStudentSubjectDisplay(s.code, sub)),
      ])
    );
  };

  const handleExportEmulation = () => {
    const headers = ['Mã HS', 'Họ và tên', 'Tổ', ...weeklySnapshots.map((w) => w.weekLabel)];
    const rows = students.map((s) => [
      s.code,
      s.fullName,
      `Tổ ${s.team}`,
      ...weeklySnapshots.map((w) => w.records?.[s.code]?.rank || '—'),
    ]);
    onExportCsv(`ThiDuaTuan_${classConfig.className}_${classConfig.schoolYear}.csv`, headers, rows);
  };

  const handleExportFund = () => {
    const fundRows = tickets
      .filter((t) => t.type === 'thu_chi' && t.status === 'approved')
      .map((t) => [t.date, t.category, t.description, Number(t.amount || 0), t.submittedByTitle, t.reviewedByTeacher || '']);
    onExportCsv(
      `SoQuyLop_${classConfig.className}_${classConfig.schoolYear}.csv`,
      ['Ngày', 'Loại', 'Nội dung', 'Số tiền (VNĐ)', 'Người lập', 'Người duyệt'],
      fundRows
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#102744] flex items-center gap-2">
            <FileBarChart2 className="w-6 h-6 text-[#0C9BA6]" />
            <span>Tổng hợp Học kỳ, Báo cáo &amp; Xuất dữ liệu CSV / In ấn</span>
          </h2>
          <p className="text-sm text-slate-500">
            Đồng bộ điểm đã xác nhận từ tất cả môn học của Lớp {classConfig.className} theo từng học kỳ.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedReportSemester}
            onChange={(e) => setSelectedReportSemester(e.target.value as VneduSemester)}
            className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-[#102744]"
          >
            {VNEDU_SEMESTERS.map((sem) => (
              <option key={sem} value={sem}>
                {sem}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>In trang báo cáo hiện tại</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="font-bold text-slate-900">1. Danh sách Học sinh &amp; Điểm các môn ({selectedReportSemester})</div>
          <p className="text-xs text-slate-500">
            Xuất đầy đủ thông tin {students.length} học sinh kèm ĐTB của tất cả {exportSubjects.length} môn học đã xác nhận.
          </p>
          <button
            type="button"
            onClick={handleExportStudents}
            className="w-full py-2.5 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>Xuất CSV Tổng hợp học kỳ</span>
          </button>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="font-bold text-slate-900">2. Bảng Thi đua A/B/C các Tuần</div>
          <p className="text-xs text-slate-500">
            Tổng hợp kết quả {weeklySnapshots.length} tuần thi đua đã được GVCN chốt sổ.
          </p>
          <button
            type="button"
            onClick={handleExportEmulation}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>Xuất CSV Thi đua A/B/C</span>
          </button>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="font-bold text-slate-900">3. Sao kê Sổ Quỹ Lớp đã duyệt</div>
          <p className="text-xs text-slate-500">
            Xuất minh bạch toàn bộ các phiếu thu/chi đã phê duyệt, phục vụ họp phụ huynh.
          </p>
          <button
            type="button"
            onClick={handleExportFund}
            className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>Xuất CSV Sổ quỹ lớp</span>
          </button>
        </div>
      </div>

      {/* Bảng Tổng hợp điểm các môn theo Học kỳ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-sm text-[#102744]">
            Bảng Tổng hợp Điểm các Môn — {selectedReportSemester} ({students.length} HS)
          </h3>
          <span className="text-xs text-slate-500">Tự động cập nhật khi GVCN xác nhận lưu bảng điểm vnEdu</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase whitespace-nowrap">
                <th className="py-2.5 px-3">Mã MOET</th>
                <th className="py-2.5 px-3 md:sticky md:left-0 bg-slate-50 border-r border-slate-200">Họ và tên</th>
                <th className="py-2.5 px-3">Tổ</th>
                {exportSubjects.map((sub) => (
                  <th key={`rep_th_${sub}`} className="py-2.5 px-3 text-center">
                    {sub}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={3 + exportSubjects.length} className="py-8 text-center text-slate-500">
                    Chưa có danh sách học sinh trong lớp.
                  </td>
                </tr>
              ) : (
                students.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50/70">
                    <td className="py-2 px-3 font-mono font-bold text-slate-600">{st.moetCode || st.code}</td>
                    <td className="py-2 px-3 font-bold text-slate-900 md:sticky md:left-0 bg-white border-r border-slate-100 whitespace-nowrap">
                      {st.fullName}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">Tổ {st.team}</td>
                    {exportSubjects.map((sub) => {
                      const val = getStudentSubjectDisplay(st.code, sub);
                      return (
                        <td key={`rep_${st.id}_${sub}`} className="py-2 px-3 text-center font-semibold">
                          {val !== '' ? val : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// 8. CẤU HÌNH LỚP & NĂM HỌC
interface ConfigTabProps {
  activeRoleId: string;
  currentRoleTitle: string;
  classConfig: ClassConfig;
  configForm: ClassConfig;
  setConfigForm: React.Dispatch<React.SetStateAction<ClassConfig>>;
  savedWorkspaces: SavedWorkspace[];
  classWorkspaceId: string;
  onSaveConfig: (e: React.FormEvent) => void;
  onSwitchWorkspace: (ws: SavedWorkspace) => void;
}

export function ConfigTab({
  activeRoleId,
  currentRoleTitle,
  classConfig,
  configForm,
  setConfigForm,
  savedWorkspaces,
  classWorkspaceId,
  onSaveConfig,
  onSwitchWorkspace,
}: ConfigTabProps) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Cấu hình Không gian Lớp học & Năm học</h2>
        <p className="text-sm text-slate-500">
          Hỗ trợ đa giáo viên, đa trường, đa lớp và đa năm học. Dữ liệu từng lớp được phân tách độc lập trên Firestore.
        </p>
      </div>

      {savedWorkspaces.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
            <Layers className="w-4 h-4 text-teal-600" />
            <span>Chuyển đổi nhanh giữa các Lớp / Năm học đã lưu ({savedWorkspaces.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {savedWorkspaces.map((ws) => {
              const isCurrentWs =
                ws.schoolName === classConfig.schoolName &&
                ws.className === classConfig.className &&
                ws.schoolYear === classConfig.schoolYear;
              return (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => onSwitchWorkspace(ws)}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                    isCurrentWs
                      ? 'bg-teal-50 border-teal-500 text-teal-950'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-bold text-xs">
                      {ws.schoolName} • Lớp {ws.className}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Năm học {ws.schoolYear} • GV: {ws.teacherName} ({ws.subject})
                    </div>
                  </div>
                  {isCurrentWs && (
                    <span className="px-2 py-0.5 rounded bg-teal-600 text-white text-[10px] font-bold">Đang mở</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <form onSubmit={onSaveConfig} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Giáo viên chủ nhiệm</label>
            <input
              type="text"
              required
              disabled={activeRoleId !== 'gvcn'}
              value={configForm.teacherName}
              onChange={(e) => setConfigForm({ ...configForm, teacherName: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm disabled:bg-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Môn giảng dạy (Tùy biến)</label>
            <input
              type="text"
              required
              disabled={activeRoleId !== 'gvcn'}
              value={configForm.subject}
              onChange={(e) => setConfigForm({ ...configForm, subject: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm disabled:bg-slate-100"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Tên Trường THPT</label>
          <input
            type="text"
            required
            disabled={activeRoleId !== 'gvcn'}
            value={configForm.schoolName}
            onChange={(e) => setConfigForm({ ...configForm, schoolName: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm disabled:bg-slate-100"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Tên Lớp</label>
            <input
              type="text"
              required
              disabled={activeRoleId !== 'gvcn'}
              value={configForm.className}
              onChange={(e) => setConfigForm({ ...configForm, className: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm disabled:bg-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Năm học</label>
            <input
              type="text"
              required
              disabled={activeRoleId !== 'gvcn'}
              value={configForm.schoolYear}
              onChange={(e) => setConfigForm({ ...configForm, schoolYear: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm disabled:bg-slate-100"
            />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
          <strong>Mã định danh Workspace độc lập trên Firestore:</strong>{' '}
          <code className="text-teal-700 font-mono">{classWorkspaceId}</code>
        </div>

        {activeRoleId === 'gvcn' ? (
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md transition-all"
          >
            Lưu cấu hình lớp học vào Cloud Firestore
          </button>
        ) : (
          <div className="text-center text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200">
            Bạn đang ở vai trò {currentRoleTitle}. Chuyển sang vai trò Giáo viên chủ nhiệm để chỉnh sửa cấu hình.
          </div>
        )}
      </form>
    </div>
  );
}
