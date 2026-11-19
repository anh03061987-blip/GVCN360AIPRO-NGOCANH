import React from 'react';
import {
  ListChecks,
  Plus,
  Trash2,
  FilePlus2,
  Send,
  Award,
  Trophy,
  Scale,
  History,
  Lock,
  CheckCircle2,
  Edit3,
  AlertTriangle,
  Save,
} from 'lucide-react';
import {
  MONTH_OPTIONS,
  TICKET_TYPES,
  WEEK_OPTIONS,
} from '../../constants/gvcnConstants';
import type {
  ClassConfig,
  EmulationAdjustmentLog,
  EmulationRank,
  EmulationStandards,
  RoleDefinition,
  StudentRecord,
  TicketRecord,
  TicketType,
  WeeklyEmulationDraftEntry,
  WeeklySnapshot,
  WeeklyTeamStat,
} from '../../types/gvcn';

// 1. TIÊU CHUẨN THI ĐUA
interface EmulationStandardsTabProps {
  activeRoleId: string;
  emulationStandards: EmulationStandards;
  setEmulationStandards: React.Dispatch<React.SetStateAction<EmulationStandards>>;
  teamBonusRule: { enabled: boolean; ruleNote: string };
  setTeamBonusRule: React.Dispatch<React.SetStateAction<{ enabled: boolean; ruleNote: string }>>;
  newCriterionText: string;
  setNewCriterionText: (v: string) => void;
  newCriterionGroup: 'gradeB' | 'gradeC' | 'severeSemesterFail';
  setNewCriterionGroup: (v: 'gradeB' | 'gradeC' | 'severeSemesterFail') => void;
  onSaveStandards: (updated: EmulationStandards, bonusRule?: { enabled: boolean; ruleNote: string }) => void;
}

export function EmulationStandardsTab({
  activeRoleId,
  emulationStandards,
  setEmulationStandards,
  teamBonusRule,
  setTeamBonusRule,
  newCriterionText,
  setNewCriterionText,
  newCriterionGroup,
  setNewCriterionGroup,
  onSaveStandards,
}: EmulationStandardsTabProps) {
  const handleAddCriterion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCriterionText.trim() || activeRoleId !== 'gvcn') return;
    const prefix = newCriterionGroup === 'gradeB' ? 'B' : newCriterionGroup === 'gradeC' ? 'C' : 'S';
    const newItem = {
      id: `${prefix}_${Date.now().toString().slice(-4)}`,
      text: newCriterionText.trim(),
      conditional: false,
      repeatRequired: false,
    };
    const updated: EmulationStandards = {
      ...emulationStandards,
      [newCriterionGroup]: [...emulationStandards[newCriterionGroup], newItem],
    };
    setEmulationStandards(updated);
    setNewCriterionText('');
    onSaveStandards(updated, teamBonusRule);
  };

  const handleRemoveCriterion = (group: 'gradeB' | 'gradeC' | 'severeSemesterFail', id: string) => {
    if (activeRoleId !== 'gvcn') return;
    const updated: EmulationStandards = {
      ...emulationStandards,
      [group]: emulationStandards[group].filter((item) => item.id !== id),
    };
    setEmulationStandards(updated);
    onSaveStandards(updated, teamBonusRule);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#102744]">Bộ Tiêu chuẩn Thi đua Chuẩn (A / B / C & Học kỳ)</h2>
        <p className="text-sm text-slate-500">
          Tuân thủ văn bản tiêu chuẩn thi đua của nhà trường: không mặc định xếp loại A khi chưa có minh chứng; 2 tiêu chí B đồng thời gợi ý loại C; quy đổi học kỳ 1 C = 2 B.
        </p>
      </div>

      {/* Quy tắc học kỳ */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
          <div className="font-bold text-emerald-900">Xếp loại Tốt (HK)</div>
          <div className="text-emerald-700 mt-0.5">
            Tối đa {emulationStandards.semesterRules.totMaxB} lần quy đổi B
          </div>
        </div>
        <div className="p-3 rounded-xl bg-sky-50 border border-sky-200">
          <div className="font-bold text-sky-900">Xếp loại Khá (HK)</div>
          <div className="text-sky-700 mt-0.5">
            Từ {emulationStandards.semesterRules.khaMinB} đến {emulationStandards.semesterRules.khaMaxB} lần quy đổi B
          </div>
        </div>
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
          <div className="font-bold text-amber-900">Xếp loại Đạt (HK)</div>
          <div className="text-amber-700 mt-0.5">
            Từ {emulationStandards.semesterRules.datMinB} đến {emulationStandards.semesterRules.datMaxB} lần quy đổi B
          </div>
        </div>
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
          <div className="font-bold text-rose-900">Quy đổi & Ngưỡng tuần</div>
          <div className="text-rose-700 mt-0.5">
            1 tuần C = {emulationStandards.semesterRules.cToBWeight} B • Tối thiểu {emulationStandards.semesterRules.minWeeksRequired} tuần
          </div>
        </div>
      </div>

      {/* Nhóm A */}
      <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs space-y-3">
        <h3 className="font-bold text-sm text-emerald-900 flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-emerald-600" />
          <span>Điều kiện Xếp loại A (Bắt buộc có minh chứng xác nhận)</span>
        </h3>
        <div className="space-y-2 text-xs">
          {emulationStandards.gradeA.map((item) => (
            <div key={item.id} className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 text-emerald-950">
              <strong>{item.id}:</strong> {item.title}
            </div>
          ))}
        </div>
      </div>

      {/* Bổ sung tiêu chí */}
      {activeRoleId === 'gvcn' && (
        <form onSubmit={handleAddCriterion} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3 text-xs">
          <select
            value={newCriterionGroup}
            onChange={(e) => setNewCriterionGroup(e.target.value as 'gradeB' | 'gradeC' | 'severeSemesterFail')}
            className="px-3 py-2 rounded-xl border border-slate-300 font-bold bg-slate-50"
          >
            <option value="gradeB">Thêm vào Nhóm B</option>
            <option value="gradeC">Thêm vào Nhóm C</option>
            <option value="severeSemesterFail">Thêm vào Lỗi nặng Học kỳ</option>
          </select>
          <input
            type="text"
            value={newCriterionText}
            onChange={(e) => setNewCriterionText(e.target.value)}
            placeholder="Nhập nội dung tiêu chí bổ sung của lớp..."
            className="flex-1 min-w-[240px] px-3 py-2 rounded-xl border border-slate-300"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 text-white font-bold flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm & Lưu</span>
          </button>
        </form>
      )}

      {/* Nhóm B, C, Lỗi nặng */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-amber-900">Nhóm Vi phạm Mức B ({emulationStandards.gradeB.length})</h3>
          <div className="max-h-96 overflow-y-auto space-y-2 text-xs">
            {emulationStandards.gradeB.map((b) => (
              <div key={b.id} className="p-2.5 rounded-xl bg-amber-50/50 border border-amber-100 flex items-start justify-between gap-2">
                <div>
                  <strong className="text-amber-900">{b.id}:</strong> {b.text}
                  {b.conditional && <div className="text-[11px] text-amber-700 mt-0.5">({b.conditionNote})</div>}
                </div>
                {activeRoleId === 'gvcn' && (
                  <button
                    type="button"
                    onClick={() => handleRemoveCriterion('gradeB', b.id)}
                    className="text-rose-500 hover:text-rose-700 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-orange-200 shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-orange-900">Nhóm Vi phạm Mức C ({emulationStandards.gradeC.length})</h3>
          <div className="max-h-96 overflow-y-auto space-y-2 text-xs">
            {emulationStandards.gradeC.map((c) => (
              <div key={c.id} className="p-2.5 rounded-xl bg-orange-50/60 border border-orange-100 flex items-start justify-between gap-2">
                <div>
                  <strong className="text-orange-900">{c.id}:</strong> {c.text}
                </div>
                {activeRoleId === 'gvcn' && (
                  <button
                    type="button"
                    onClick={() => handleRemoveCriterion('gradeC', c.id)}
                    className="text-rose-500 hover:text-rose-700 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-rose-900">Lỗi nặng Chưa đạt Học kỳ ({emulationStandards.severeSemesterFail.length})</h3>
          <div className="max-h-96 overflow-y-auto space-y-2 text-xs">
            {emulationStandards.severeSemesterFail.map((s) => (
              <div key={s.id} className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-100 flex items-start justify-between gap-2">
                <div>
                  <strong className="text-rose-900">{s.id}:</strong> {s.text}
                  {s.repeatRequired && <div className="text-[11px] text-rose-700 mt-0.5">({s.conditionNote})</div>}
                </div>
                {activeRoleId === 'gvcn' && (
                  <button
                    type="button"
                    onClick={() => handleRemoveCriterion('severeSemesterFail', s.id)}
                    className="text-rose-500 hover:text-rose-700 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quy ước Tổ */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 text-xs">
        <div className="font-bold text-sm text-[#102744]">Quy ước thống kê Thi đua 4 Tổ</div>
        <p className="text-slate-600">{teamBonusRule.ruleNote}</p>
        {activeRoleId === 'gvcn' && (
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={teamBonusRule.ruleNote}
              onChange={(e) => setTeamBonusRule({ ...teamBonusRule, ruleNote: e.target.value })}
              className="flex-1 min-w-[260px] px-3 py-2 rounded-xl border border-slate-300"
            />
            <button
              type="button"
              onClick={() => onSaveStandards(emulationStandards, teamBonusRule)}
              className="px-4 py-2 rounded-xl bg-[#102744] text-white font-bold"
            >
              Lưu quy ước
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// 2. BÁO CÁO VÀ ĐỀ XUẤT
interface TicketsTabProps {
  currentRole: RoleDefinition;
  students: StudentRecord[];
  emulationStandards: EmulationStandards;
  ticketForm: {
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
  };
  setTicketForm: React.Dispatch<
    React.SetStateAction<{
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
    }>
  >;
  isSubmittingTicket: boolean;
  onSubmitTicket: (e: React.FormEvent) => void;
  onOpenAttendanceTab: () => void;
  tickets: TicketRecord[];
}

export function TicketsTab({
  currentRole,
  students,
  emulationStandards,
  ticketForm,
  setTicketForm,
  isSubmittingTicket,
  onSubmitTicket,
  onOpenAttendanceTab,
  tickets,
}: TicketsTabProps) {
  const scopedStudents = students.filter((s) => !currentRole.team || Number(s.team) === currentRole.team);
  const selectedB1 = emulationStandards.gradeB.find((b) => b.id === ticketForm.criterionId);
  const isWholeClassAttendance =
    ticketForm.type === 'diem_danh' && !currentRole.team && ticketForm.category !== 'Ghi nhận HS vắng / đi muộn';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#102744]">2. Báo cáo và đề xuất</h2>
        <p className="text-sm text-slate-500">
          Vai trò hiện tại: <strong className="text-[#0C9BA6]">{currentRole.title}</strong> ({currentRole.scope}).
        </p>
      </div>

      <form onSubmit={onSubmitTicket} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Loại phiếu</label>
            <select
              value={ticketForm.type}
              onChange={(e) => {
                const nextType = e.target.value as TicketType;
                setTicketForm({
                  ...ticketForm,
                  type: nextType,
                  studentId: '',
                  category:
                    nextType === 'thu_chi'
                      ? 'Thu quỹ'
                      : nextType === 'chi_doan'
                        ? 'Báo cáo hoạt động Chi đoàn'
                        : nextType === 'diem_danh'
                          ? currentRole.team
                            ? 'Ghi nhận HS vắng / đi muộn'
                            : 'Điểm danh cả lớp'
                          : 'Tuyên dương',
                });
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
            >
              {currentRole.allowedTicketTypes.map((t) => (
                <option key={t} value={t}>
                  {TICKET_TYPES[t].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Ngày ghi nhận</label>
            <input
              type="date"
              value={ticketForm.date}
              onChange={(e) => setTicketForm({ ...ticketForm, date: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>

          {ticketForm.type === 'ne_nep' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Tuần thi đua</label>
              <select
                value={ticketForm.weekLabel}
                onChange={(e) => setTicketForm({ ...ticketForm, weekLabel: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
              >
                {WEEK_OPTIONS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
          )}

          {ticketForm.type === 'diem_danh' && !currentRole.team && (
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Phạm vi điểm danh</label>
              <select
                value={
                  ticketForm.category === 'Ghi nhận HS vắng / đi muộn'
                    ? 'Ghi nhận HS vắng / đi muộn'
                    : 'Điểm danh cả lớp'
                }
                onChange={(e) =>
                  setTicketForm({
                    ...ticketForm,
                    category: e.target.value,
                    studentId: e.target.value === 'Điểm danh cả lớp' ? '' : ticketForm.studentId,
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
              >
                <option value="Điểm danh cả lớp">Điểm danh cả lớp</option>
                <option value="Ghi nhận HS vắng / đi muộn">Ghi nhận HS vắng / đi muộn</option>
              </select>
            </div>
          )}

          {ticketForm.type === 'chi_doan' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Phân loại hoạt động Chi đoàn</label>
              <select
                value={
                  ['Báo cáo hoạt động Chi đoàn', 'Đề xuất phong trào thanh niên', 'Sinh hoạt Chi đoàn'].includes(
                    ticketForm.category
                  )
                    ? ticketForm.category
                    : 'Báo cáo hoạt động Chi đoàn'
                }
                onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
              >
                <option value="Báo cáo hoạt động Chi đoàn">Báo cáo hoạt động Chi đoàn</option>
                <option value="Đề xuất phong trào thanh niên">Đề xuất phong trào thanh niên</option>
                <option value="Sinh hoạt Chi đoàn">Sinh hoạt Chi đoàn</option>
              </select>
            </div>
          )}
        </div>

        {isWholeClassAttendance && (
          <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex flex-wrap items-center justify-between gap-2">
            <span>
              Bạn đang lập <strong>Phiếu điểm danh cả lớp</strong>. Bạn có thể nhập nhanh sĩ số ở ô mô tả bên dưới hoặc mở bảng điểm danh chi tiết từng học sinh.
            </span>
            <button
              type="button"
              onClick={onOpenAttendanceTab}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shrink-0"
            >
              Mở bảng Điểm danh chi tiết
            </button>
          </div>
        )}

        {ticketForm.type !== 'thu_chi' && ticketForm.type !== 'chi_doan' && !isWholeClassAttendance && (
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">
              Chọn học sinh {currentRole.team ? `(Chỉ Tổ ${currentRole.team})` : ''}
            </label>
            <select
              required
              value={ticketForm.studentId}
              onChange={(e) => setTicketForm({ ...ticketForm, studentId: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            >
              <option value="">-- Chọn học sinh --</option>
              {scopedStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.code} - Tổ {s.team})
                </option>
              ))}
            </select>
          </div>
        )}

        {ticketForm.type === 'ne_nep' && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nhóm Tiêu chuẩn Thi đua</label>
                <select
                  value={ticketForm.emulationGroup}
                  onChange={(e) => {
                    const g = e.target.value;
                    const firstId =
                      g === 'gradeA'
                        ? emulationStandards.gradeA[0]?.id || ''
                        : g === 'gradeB'
                          ? emulationStandards.gradeB[0]?.id || ''
                          : g === 'gradeC'
                            ? emulationStandards.gradeC[0]?.id || ''
                            : emulationStandards.severeSemesterFail[0]?.id || '';
                    setTicketForm({
                      ...ticketForm,
                      emulationGroup: g,
                      criterionId: firstId,
                      isSimultaneousB: false,
                      remindedBefore: false,
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                >
                  <option value="gradeA">Minh chứng Xếp loại A</option>
                  <option value="gradeB">Vi phạm Tiêu chí B</option>
                  <option value="gradeC">Vi phạm Tiêu chí C</option>
                  <option value="severe">Lỗi nặng Học kỳ (Xem xét Chưa đạt HK)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Chi tiết tiêu chí</label>
                <select
                  value={ticketForm.criterionId}
                  onChange={(e) => setTicketForm({ ...ticketForm, criterionId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  {ticketForm.emulationGroup === 'gradeA' &&
                    emulationStandards.gradeA.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.id}: {a.title}
                      </option>
                    ))}
                  {ticketForm.emulationGroup === 'gradeB' &&
                    emulationStandards.gradeB.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.id}: {b.text}
                      </option>
                    ))}
                  {ticketForm.emulationGroup === 'gradeC' &&
                    emulationStandards.gradeC.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.id}: {c.text}
                      </option>
                    ))}
                  {ticketForm.emulationGroup === 'severe' &&
                    emulationStandards.severeSemesterFail.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.id}: {s.text}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {ticketForm.emulationGroup === 'gradeB' && selectedB1?.conditional && (
              <label className="flex items-center gap-2 text-xs font-semibold text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                <input
                  type="checkbox"
                  checked={ticketForm.remindedBefore}
                  onChange={(e) => setTicketForm({ ...ticketForm, remindedBefore: e.target.checked })}
                />
                <span>Xác nhận: Học sinh đã được nhắc nhở 1 lần trước đó nhưng vẫn tiếp tục vi phạm</span>
              </label>
            )}

            {ticketForm.emulationGroup === 'gradeB' && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={ticketForm.isSimultaneousB}
                    onChange={(e) => setTicketForm({ ...ticketForm, isSimultaneousB: e.target.checked })}
                  />
                  <span>Vi phạm đồng thời 2 tiêu chí nhóm B (Hệ thống tự gợi ý xếp loại C)</span>
                </label>

                {ticketForm.isSimultaneousB && (
                  <select
                    value={ticketForm.secondCriterionId}
                    onChange={(e) => setTicketForm({ ...ticketForm, secondCriterionId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                  >
                    <option value="">-- Chọn tiêu chí nhóm B thứ 2 --</option>
                    {emulationStandards.gradeB
                      .filter((b) => b.id !== ticketForm.criterionId)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.id}: {b.text}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Minh chứng / Thời điểm tiết học cụ thể (Bắt buộc)
              </label>
              <input
                type="text"
                required
                value={ticketForm.evidence}
                onChange={(e) => setTicketForm({ ...ticketForm, evidence: e.target.value })}
                placeholder="VD: Tiết 2 môn Toán sáng thứ 3, phát biểu xây dựng bài..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
            </div>
          </div>
        )}

        {ticketForm.type === 'thu_chi' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Phân loại Thu / Chi / Quyết toán</label>
              <select
                value={
                  ['Thu quỹ', 'Chi quỹ', 'Đề xuất quyết toán'].includes(ticketForm.category)
                    ? ticketForm.category
                    : 'Thu quỹ'
                }
                onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
              >
                <option value="Thu quỹ">Thu quỹ</option>
                <option value="Chi quỹ">Chi quỹ</option>
                <option value="Đề xuất quyết toán">Đề xuất quyết toán</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">
                {ticketForm.category === 'Đề xuất quyết toán'
                  ? 'Tổng số tiền quyết toán (VNĐ)'
                  : 'Số tiền (VNĐ)'}
              </label>
              <input
                type="number"
                min={ticketForm.category === 'Đề xuất quyết toán' ? 0 : 1000}
                step={1000}
                required={ticketForm.category !== 'Đề xuất quyết toán'}
                value={ticketForm.amount || ''}
                onChange={(e) => setTicketForm({ ...ticketForm, amount: Number(e.target.value) })}
                placeholder={
                  ticketForm.category === 'Đề xuất quyết toán'
                    ? 'Nhập tổng số tiền đối soát quyết toán...'
                    : 'VD: 50000'
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Mô tả chi tiết / Chứng từ</label>
          <textarea
            rows={2}
            required={ticketForm.type === 'thu_chi' || ticketForm.type === 'chi_doan' || isWholeClassAttendance}
            value={ticketForm.description}
            onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
            placeholder={
              ticketForm.type === 'thu_chi'
                ? 'VD: Thu quỹ lớp đợt 1 / Chi mua phấn viết bảng / Đề xuất quyết toán quỹ tháng...'
                : ticketForm.type === 'chi_doan'
                  ? 'VD: Báo cáo phong trào 26/3, số ĐVTN tham gia, kết quả thực hiện...'
                  : isWholeClassAttendance
                    ? 'VD: Sĩ số cả lớp có mặt 40/42, vắng có phép 2 em (Nguyễn Văn A, Trần Thị B)...'
                    : 'Nhập mô tả chi tiết (nếu bỏ trống ở phiếu nề nếp, hệ thống dùng nguyên văn tiêu chí đã chọn)...'
            }
            className="w-full px-3 py-2 rounded-xl border border-slate-300"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmittingTicket}
          className="px-5 py-2.5 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 disabled:opacity-50 text-white font-bold flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          <span>{isSubmittingTicket ? 'Đang gửi...' : 'Gửi phiếu vào Trung tâm Kiểm duyệt'}</span>
        </button>
      </form>

      {/* Danh sách phiếu gần đây */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <h3 className="font-bold text-sm text-[#102744] flex items-center gap-2">
          <FilePlus2 className="w-4 h-4 text-[#0C9BA6]" />
          <span>Phiếu đã gửi gần đây ({tickets.length})</span>
        </h3>
        <div className="divide-y divide-slate-100 text-xs">
          {tickets.slice(0, 10).map((tk) => (
            <div key={tk.id} className="py-2.5 flex items-center justify-between gap-3">
              <div>
                <span className="font-bold text-slate-900">{tk.studentName}</span>
                <span className="text-slate-500 ml-2">
                  [{tk.typeLabel}] {tk.description}
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded font-bold shrink-0 ${
                  tk.status === 'approved'
                    ? 'bg-emerald-100 text-emerald-800'
                    : tk.status === 'rejected'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                }`}
              >
                {tk.status === 'approved'
                  ? 'Đã duyệt'
                  : tk.status === 'rejected'
                    ? 'Từ chối'
                    : tk.status === 'needs_revision'
                      ? 'Cần sửa'
                      : 'Chờ duyệt'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 4. THI ĐUA CÁ NHÂN A/B/C
interface DisciplineTabProps {
  activeRoleId: string;
  currentRole: RoleDefinition;
  students: StudentRecord[];
  selectedEmulationWeek: string;
  setSelectedEmulationWeek: (w: string) => void;
  selectedEmulationMonth: string;
  setSelectedEmulationMonth: (m: string) => void;
  selectedEmulationSemester: string;
  setSelectedEmulationSemester: (s: string) => void;
  disciplineTeamFilter: string;
  setDisciplineTeamFilter: (v: string) => void;
  autoRankAEnabled: boolean;
  setAutoRankAEnabled: (v: boolean) => void;
  currentLockedSnapshot: WeeklySnapshot | null;
  currentWeekDrafts: Record<string, WeeklyEmulationDraftEntry>;
  onUpdateStudentDraft: (
    student: StudentRecord,
    patch: Partial<WeeklyEmulationDraftEntry>,
    immediatePersist?: boolean
  ) => void;
  onMarkScopeSpeaking: (targetStudents: StudentRecord[]) => void;
  onSaveWeekDrafts: () => void;
  isSavingDrafts: boolean;
  getStudentWeekEvidenceSummary: (
    studentId: string,
    weekLabel: string,
    studentCode?: string
  ) => {
    approvedInWeek: TicketRecord[];
    suggestedRank: EmulationRank | null;
    suggestionReason: string;
    isAutoA?: boolean;
  };
  isLockingWeek: boolean;
  onLockWeek: () => void;
  onOpenAdjustModal: (data: {
    studentCode: string;
    studentName: string;
    team: number;
    oldRank: EmulationRank;
  }) => void;
}

export function DisciplineTab({
  activeRoleId,
  currentRole,
  students,
  selectedEmulationWeek,
  setSelectedEmulationWeek,
  selectedEmulationMonth,
  setSelectedEmulationMonth,
  selectedEmulationSemester,
  setSelectedEmulationSemester,
  disciplineTeamFilter,
  setDisciplineTeamFilter,
  autoRankAEnabled,
  setAutoRankAEnabled,
  currentLockedSnapshot,
  currentWeekDrafts,
  onUpdateStudentDraft,
  onMarkScopeSpeaking,
  onSaveWeekDrafts,
  isSavingDrafts,
  getStudentWeekEvidenceSummary,
  isLockingWeek,
  onLockWeek,
  onOpenAdjustModal,
}: DisciplineTabProps) {
  const isGvcn = activeRoleId === 'gvcn';
  const teamLeaderTeam = !isGvcn && currentRole.team ? Number(currentRole.team) : null;
  const canEditStudent = (st: StudentRecord) =>
    !currentLockedSnapshot && (isGvcn || (teamLeaderTeam !== null && Number(st.team) === teamLeaderTeam));

  const editableStudents = students.filter((st) => canEditStudent(st));
  const displayedStudents = students.filter(
    (st) => disciplineTeamFilter === 'all' || String(st.team) === disciplineTeamFilter
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#102744]">Xếp loại Thi đua Cá nhân Tuần (A / B / C)</h2>
          <p className="text-sm text-slate-500">
            Tổ trưởng có thể chỉnh sửa xếp loại A/B/C cho thành viên tổ mình; GVCN kiểm tra toàn lớp và chốt sổ chính thức.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={selectedEmulationSemester}
            onChange={(e) => setSelectedEmulationSemester(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
          >
            <option value="Học kỳ I">Học kỳ I</option>
            <option value="Học kỳ II">Học kỳ II</option>
          </select>
          <select
            value={selectedEmulationMonth}
            onChange={(e) => setSelectedEmulationMonth(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
          >
            {MONTH_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={selectedEmulationWeek}
            onChange={(e) => setSelectedEmulationWeek(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
          >
            {WEEK_OPTIONS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>

          {!currentLockedSnapshot && (isGvcn || teamLeaderTeam !== null) && (
            <button
              type="button"
              disabled={isSavingDrafts || editableStudents.length === 0}
              onClick={onSaveWeekDrafts}
              className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>
                {isSavingDrafts
                  ? 'Đang lưu...'
                  : teamLeaderTeam !== null
                    ? `Lưu xếp loại Tổ ${teamLeaderTeam}`
                    : 'Lưu bản nháp tuần'}
              </span>
            </button>
          )}

          {isGvcn && !currentLockedSnapshot && (
            <button
              type="button"
              disabled={isLockingWeek || students.length === 0}
              onClick={onLockWeek}
              className="px-4 py-2 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 disabled:opacity-50 text-white font-bold flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isLockingWeek ? 'Đang chốt sổ...' : `Chốt sổ ${selectedEmulationWeek}`}</span>
            </button>
          )}
        </div>
      </div>

      {/* Bộ lọc theo Tổ */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-bold text-slate-500 mr-1">Lọc theo Tổ:</span>
          {[
            { id: 'all', label: `Tất cả lớp (${students.length})` },
            ...[1, 2, 3, 4].map((t) => ({
              id: String(t),
              label: `Tổ ${t} (${students.filter((s) => Number(s.team) === t).length})`,
            })),
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setDisciplineTeamFilter(opt.id)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                disciplineTeamFilter === opt.id
                  ? 'bg-[#102744] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {teamLeaderTeam !== null && !currentLockedSnapshot && (
          <span className="px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 font-bold">
            Quyền Tổ trưởng Tổ {teamLeaderTeam}: Chỉ sửa thành viên Tổ {teamLeaderTeam}
          </span>
        )}
      </div>

      {!currentLockedSnapshot && (
        <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-xs text-teal-950 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2.5 font-bold cursor-pointer">
            <input
              type="checkbox"
              disabled={!isGvcn}
              checked={autoRankAEnabled}
              onChange={(e) => setAutoRankAEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-teal-400 text-[#0C9BA6] focus:ring-[#0C9BA6]"
            />
            <span>
              Tự động xếp Loại A cho thành viên tổ không vi phạm, có phát biểu và tổ trưởng không lập phiếu trong {selectedEmulationWeek}
            </span>
          </label>
          {(isGvcn || teamLeaderTeam !== null) && editableStudents.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onMarkScopeSpeaking(editableStudents)}
                className="px-2.5 py-1 rounded-lg bg-white border border-teal-300 text-teal-800 font-bold hover:bg-teal-100"
              >
                {teamLeaderTeam !== null
                  ? `Đánh dấu Tổ ${teamLeaderTeam} có phát biểu`
                  : 'Đánh dấu tất cả có phát biểu'}
              </button>
            </div>
          )}
        </div>
      )}

      {currentLockedSnapshot ? (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              {selectedEmulationWeek} ({currentLockedSnapshot.monthLabel} • {currentLockedSnapshot.semesterLabel}) ĐÃ CHỐT SỔ bởi {currentLockedSnapshot.lockedBy} — Sĩ số khóa: {currentLockedSnapshot.totalLockedStudents} HS.
            </span>
          </div>
          <span className="text-emerald-700">Mọi chỉnh sửa sau khi chốt đều phải ghi lý do và lưu vào Lịch sử điều chỉnh.</span>
        </div>
      ) : teamLeaderTeam !== null ? (
        <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-xs text-sky-950 flex items-center gap-2">
          <Award className="w-4 h-4 text-sky-600 shrink-0" />
          <span>
            Bạn đang ở vai trò <strong>{currentRole.title}</strong>. Hãy rà soát và chỉnh sửa xếp loại A/B/C cho các thành viên <strong>Tổ {teamLeaderTeam}</strong>, sau đó bấm <strong>Lưu xếp loại Tổ {teamLeaderTeam}</strong> để GVCN kiểm tra và chốt sổ cả lớp.
          </span>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            {selectedEmulationWeek} chưa chốt sổ. GVCN kiểm tra minh chứng, đối chiếu đề xuất của 4 Tổ trưởng và hoàn thiện xếp loại A/B/C trước khi bấm Chốt sổ.
          </span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-3 px-4">Học sinh</th>
                <th className="py-3 px-4">Tổ</th>
                <th className="py-3 px-4">Có phát biểu</th>
                <th className="py-3 px-4">Minh chứng & Trạng thái tuần</th>
                <th className="py-3 px-4">Xếp loại {selectedEmulationWeek}</th>
                <th className="py-3 px-4">Ghi chú / Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    Chưa có danh sách học sinh phù hợp bộ lọc.
                  </td>
                </tr>
              ) : (
                displayedStudents.map((st) => {
                  const lockedRec = currentLockedSnapshot?.records?.[st.code];
                  const autoInfo = getStudentWeekEvidenceSummary(st.id, selectedEmulationWeek, st.code);
                  const draft = currentWeekDrafts[st.code];
                  const draftRank = draft?.rank ?? autoInfo.suggestedRank;
                  const draftNote = draft?.note ?? '';
                  const hasSpoken = draft?.spoken !== undefined ? draft.spoken : true;
                  const rowEditable = canEditStudent(st);

                  return (
                    <tr
                      key={st.id}
                      className={`hover:bg-slate-50/70 ${
                        teamLeaderTeam !== null && Number(st.team) === teamLeaderTeam ? 'bg-sky-50/20' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div>
                          {st.fullName} <span className="text-xs font-mono text-slate-400">({st.code})</span>
                        </div>
                        {draft?.updatedByTitle && !lockedRec && (
                          <div className="text-[11px] font-semibold text-sky-700 mt-0.5">
                            {draft.updatedByTitle} đã cập nhật
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs font-bold text-sky-700">Tổ {st.team}</td>
                      <td className="py-3 px-4 text-xs">
                        <label
                          className={`inline-flex items-center gap-1.5 font-semibold text-slate-700 ${
                            rowEditable ? 'cursor-pointer' : 'opacity-65 cursor-not-allowed'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={!rowEditable}
                            checked={hasSpoken}
                            onChange={(e) => onUpdateStudentDraft(st, { spoken: e.target.checked }, true)}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                          />
                          <span>{hasSpoken ? 'Có' : 'Chưa'}</span>
                        </label>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {autoInfo.approvedInWeek.length === 0 ? (
                          <span
                            className={
                              autoInfo.isAutoA
                                ? 'inline-block px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200'
                                : 'text-slate-400'
                            }
                          >
                            {autoInfo.suggestionReason}
                          </span>
                        ) : (
                          <div className="space-y-1">
                            {autoInfo.approvedInWeek.map((t) => (
                              <div key={t.id} className="text-slate-700">
                                • <strong>{t.category}:</strong> {t.description}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {lockedRec ? (
                          <span
                            className={`px-3 py-1 rounded-lg text-xs font-extrabold ${
                              lockedRec.rank === 'A'
                                ? 'bg-emerald-100 text-emerald-800'
                                : lockedRec.rank === 'B'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            Loại {lockedRec.rank}
                          </span>
                        ) : rowEditable ? (
                          <div className="flex items-center gap-1.5">
                            {(['A', 'B', 'C'] as const).map((r) => (
                              <button
                                key={r}
                                type="button"
                                onClick={() => onUpdateStudentDraft(st, { rank: r }, true)}
                                className={`w-8 h-8 rounded-lg text-xs font-extrabold transition-all ${
                                  draftRank === r
                                    ? r === 'A'
                                      ? 'bg-emerald-600 text-white'
                                      : r === 'B'
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-rose-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold ${
                                draftRank === 'A'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : draftRank === 'B'
                                    ? 'bg-amber-50 text-amber-700'
                                    : draftRank === 'C'
                                      ? 'bg-rose-50 text-rose-700'
                                      : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {draftRank ? `Loại ${draftRank}` : 'Chờ xếp loại'}
                            </span>
                            <div className="text-[10px] text-slate-400">Chỉ Tổ {st.team} / GVCN sửa</div>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {lockedRec ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-600">{lockedRec.note || '—'}</span>
                            {isGvcn && (
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenAdjustModal({
                                    studentCode: st.code,
                                    studentName: st.fullName,
                                    team: Number(st.team),
                                    oldRank: lockedRec.rank,
                                  })
                                }
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center gap-1 shrink-0"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Điều chỉnh</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <input
                            type="text"
                            disabled={!rowEditable}
                            value={draftNote}
                            onChange={(e) => onUpdateStudentDraft(st, { note: e.target.value }, false)}
                            onBlur={() => {
                              if (rowEditable) onSaveWeekDrafts();
                            }}
                            placeholder={
                              rowEditable
                                ? autoInfo.suggestionReason
                                : `Ghi chú thuộc Tổ ${st.team}`
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs disabled:bg-slate-50"
                          />
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
    </div>
  );
}

// 5. THI ĐUA 4 TỔ
interface TeamEmulationTabProps {
  selectedEmulationWeek: string;
  setSelectedEmulationWeek: (w: string) => void;
  currentLockedSnapshot: WeeklySnapshot | null;
  weeklySnapshots: WeeklySnapshot[];
  teamBonusRule: { enabled: boolean; ruleNote: string };
}

export function TeamEmulationTab({
  selectedEmulationWeek,
  setSelectedEmulationWeek,
  currentLockedSnapshot,
  weeklySnapshots,
  teamBonusRule,
}: TeamEmulationTabProps) {
  const activeStats: WeeklyTeamStat[] = currentLockedSnapshot?.teamStats || [];
  const cumulativeStats = [1, 2, 3, 4].map((teamNum) => {
    let totalA = 0;
    let totalB = 0;
    let totalC = 0;
    let totalSlots = 0;
    weeklySnapshots.forEach((snap) => {
      const ts = snap.teamStats?.find((t) => t.team === teamNum);
      if (ts) {
        totalA += ts.countA;
        totalB += ts.countB;
        totalC += ts.countC;
        totalSlots += ts.lockedSize;
      }
    });
    const rateA = totalSlots > 0 ? Math.round((totalA / totalSlots) * 1000) / 10 : 0;
    return { team: teamNum, totalA, totalB, totalC, totalSlots, rateA };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#102744]">Thi đua 4 Tổ Học tập</h2>
          <p className="text-sm text-slate-500">{teamBonusRule.ruleNote}</p>
        </div>
        <select
          value={selectedEmulationWeek}
          onChange={(e) => setSelectedEmulationWeek(e.target.value)}
          className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white font-bold"
        >
          {WEEK_OPTIONS.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((teamNum) => {
          const ts = activeStats.find((t) => t.team === teamNum);
          return (
            <div key={teamNum} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-base text-[#102744]">Tổ {teamNum}</span>
                <Trophy className="w-4 h-4 text-amber-500" />
              </div>
              {ts ? (
                <>
                  <div className="text-2xl font-extrabold text-[#0C9BA6]">{ts.rateA}% Loại A</div>
                  <div className="text-xs text-slate-600">
                    Sĩ số chốt: {ts.lockedSize} HS • A: {ts.countA} • B: {ts.countB} • C: {ts.countC}
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-400 py-2">
                  {selectedEmulationWeek} chưa được chốt sổ.
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <h3 className="font-bold text-sm text-[#102744]">
          Lũy kế tỷ lệ Thi đua 4 Tổ ({weeklySnapshots.length} tuần đã chốt)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-2.5 px-4">Tổ</th>
                <th className="py-2.5 px-4">Tổng lượt Loại A</th>
                <th className="py-2.5 px-4">Tổng lượt Loại B</th>
                <th className="py-2.5 px-4">Tổng lượt Loại C</th>
                <th className="py-2.5 px-4">Tỷ lệ đạt A lũy kế</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cumulativeStats
                .sort((a, b) => b.rateA - a.rateA)
                .map((c) => (
                  <tr key={c.team}>
                    <td className="py-2.5 px-4 font-bold text-slate-900">Tổ {c.team}</td>
                    <td className="py-2.5 px-4 font-bold text-emerald-700">{c.totalA}</td>
                    <td className="py-2.5 px-4 font-bold text-amber-700">{c.totalB}</td>
                    <td className="py-2.5 px-4 font-bold text-rose-700">{c.totalC}</td>
                    <td className="py-2.5 px-4 font-extrabold text-[#0C9BA6]">{c.rateA}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// 6. TỔNG HỢP HỌC KỲ
interface SemesterEmulationTabProps {
  students: StudentRecord[];
  tickets: TicketRecord[];
  weeklySnapshots: WeeklySnapshot[];
  emulationStandards: EmulationStandards;
  selectedEmulationSemester: string;
  setSelectedEmulationSemester: (s: string) => void;
}

export function SemesterEmulationTab({
  students,
  tickets,
  weeklySnapshots,
  emulationStandards,
  selectedEmulationSemester,
  setSelectedEmulationSemester,
}: SemesterEmulationTabProps) {
  const semesterSnaps = weeklySnapshots.filter((w) => w.semesterLabel === selectedEmulationSemester);
  const rules = emulationStandards.semesterRules;

  const rows = students.map((st) => {
    let countA = 0;
    let countB = 0;
    let countC = 0;
    semesterSnaps.forEach((snap) => {
      const rank = snap.records?.[st.code]?.rank;
      if (rank === 'A') countA++;
      else if (rank === 'B') countB++;
      else if (rank === 'C') countC++;
    });

    const totalWeeks = countA + countB + countC;
    const equivalentB = countB + countC * rules.cToBWeight;
    const severeApproved = tickets.some(
      (t) => t.status === 'approved' && t.studentId === st.id && t.emulationGroup === 'severe'
    );

    let resultLabel = 'Chưa đủ tuần';
    let badgeCls = 'bg-slate-100 text-slate-700';

    if (severeApproved) {
      resultLabel = 'Chưa đạt (Lỗi nặng HK)';
      badgeCls = 'bg-rose-100 text-rose-800';
    } else if (totalWeeks >= rules.minWeeksRequired) {
      if (equivalentB <= rules.totMaxB) {
        resultLabel = 'Tốt';
        badgeCls = 'bg-emerald-100 text-emerald-800';
      } else if (equivalentB <= rules.khaMaxB) {
        resultLabel = 'Khá';
        badgeCls = 'bg-sky-100 text-sky-800';
      } else if (equivalentB <= rules.datMaxB) {
        resultLabel = 'Đạt';
        badgeCls = 'bg-amber-100 text-amber-800';
      } else {
        resultLabel = 'Chưa đạt';
        badgeCls = 'bg-rose-100 text-rose-800';
      }
    }

    return { st, countA, countB, countC, totalWeeks, equivalentB, severeApproved, resultLabel, badgeCls };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#102744]">Tổng hợp Rèn luyện {selectedEmulationSemester}</h2>
          <p className="text-sm text-slate-500">
            Quy đổi: 1 tuần C = {rules.cToBWeight} B • Tốt (≤{rules.totMaxB} B) • Khá ({rules.khaMinB}–{rules.khaMaxB} B) • Đạt ({rules.datMinB}–{rules.datMaxB} B) • Yêu cầu tối thiểu {rules.minWeeksRequired} tuần đã chốt.
          </p>
        </div>

        <select
          value={selectedEmulationSemester}
          onChange={(e) => setSelectedEmulationSemester(e.target.value)}
          className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white font-bold"
        >
          <option value="Học kỳ I">Học kỳ I</option>
          <option value="Học kỳ II">Học kỳ II</option>
        </select>
      </div>

      <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-950 flex items-center gap-2">
        <Scale className="w-4 h-4 text-indigo-600 shrink-0" />
        <span>
          Số tuần đã chốt trong {selectedEmulationSemester}: <strong>{semesterSnaps.length}</strong> tuần. Số liệu mang tính tổng hợp hỗ trợ GVCN đối chiếu trước khi chốt học bạ.
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-3 px-4">Học sinh</th>
                <th className="py-3 px-4">Tổ</th>
                <th className="py-3 px-4">Tuần A / B / C</th>
                <th className="py-3 px-4">Số tuần đã chốt</th>
                <th className="py-3 px-4">Tổng quy đổi B</th>
                <th className="py-3 px-4">Gợi ý xếp loại HK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.st.id}>
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {r.st.fullName} <span className="text-xs font-mono text-slate-400">({r.st.code})</span>
                  </td>
                  <td className="py-3 px-4 text-xs font-bold text-sky-700">Tổ {r.st.team}</td>
                  <td className="py-3 px-4 text-xs font-mono">
                    <span className="text-emerald-700 font-bold">{r.countA}A</span> •{' '}
                    <span className="text-amber-700 font-bold">{r.countB}B</span> •{' '}
                    <span className="text-rose-700 font-bold">{r.countC}C</span>
                  </td>
                  <td className="py-3 px-4 text-xs font-bold">
                    {r.totalWeeks}/{rules.minWeeksRequired}
                  </td>
                  <td className="py-3 px-4 font-extrabold text-slate-900">{r.equivalentB}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${r.badgeCls}`}>
                      {r.resultLabel}
                    </span>
                    {r.severeApproved && (
                      <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-rose-700">
                        <AlertTriangle className="w-3 h-3" /> Có lỗi nặng
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// 7. LỊCH SỬ ĐIỀU CHỈNH
export function EmulationHistoryTab({ logs }: { logs: EmulationAdjustmentLog[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#102744]">Lịch sử Điều chỉnh Kết quả Thi đua</h2>
        <p className="text-sm text-slate-500">
          Lưu vết bất biến mọi thay đổi xếp loại A/B/C sau khi tuần thi đua đã chốt sổ.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            Chưa có điều chỉnh nào sau khi chốt sổ tuần.
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-3 px-4">Tuần</th>
                <th className="py-3 px-4">Học sinh</th>
                <th className="py-3 px-4">Thay đổi</th>
                <th className="py-3 px-4">Lý do điều chỉnh</th>
                <th className="py-3 px-4">Người thực hiện</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="py-3 px-4 font-bold text-[#102744]">{l.weekLabel}</td>
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {l.studentName} ({l.studentCode})
                  </td>
                  <td className="py-3 px-4 font-extrabold">
                    <span className="text-slate-500">{l.oldRank}</span> →{' '}
                    <span className="text-[#0C9BA6]">{l.newRank}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-700">{l.reason}</td>
                  <td className="py-3 px-4 text-slate-500">{l.adjustedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
