import React from 'react';
import {
  CheckCircle2,
  Check,
  Edit3,
  X,
  Lock,
  History,
} from 'lucide-react';
import { TICKET_TYPES } from '../../constants/gvcnConstants';
import type {
  AuditLogRecord,
  ClassConfig,
  RoleDefinition,
  TicketRecord,
} from '../../types/gvcn';

interface BatchApprovalReport {
  batchId: string;
  successCount: number;
  totalScopeCount: number;
  needReviewCount: number;
  failedItems: { ticket: TicketRecord; reason: string }[];
  excludedTickets: { ticket: TicketRecord; reason: string }[];
  timestamp: string;
}

interface ModerationTabProps {
  activeRoleId: string;
  currentRole: RoleDefinition;
  classConfig: ClassConfig;
  tickets: TicketRecord[];
  filteredModerationTickets: TicketRecord[];
  eligibleFilteredTickets: TicketRecord[];
  pendingCount: number;
  modFilterStatus: string;
  setModFilterStatus: (v: string) => void;
  modFilterType: string;
  setModFilterType: (v: string) => void;
  selectedTicketIds: string[];
  setSelectedTicketIds: React.Dispatch<React.SetStateAction<string[]>>;
  batchApprovalReport: BatchApprovalReport | null;
  setBatchApprovalReport: React.Dispatch<React.SetStateAction<BatchApprovalReport | null>>;
  processingTicketId: string | null;
  auditLogs: AuditLogRecord[];
  evaluateTicketBatchEligibility: (ticket: TicketRecord) => { eligible: boolean; reason: string };
  onOpenBatchConfirmModal: (mode: 'selected' | 'all_eligible') => void;
  onModerateTicket: (ticket: TicketRecord, decision: 'approved' | 'needs_revision' | 'rejected') => void;
}

export function ModerationTab({
  activeRoleId,
  currentRole,
  classConfig,
  tickets,
  filteredModerationTickets,
  eligibleFilteredTickets,
  pendingCount,
  modFilterStatus,
  setModFilterStatus,
  modFilterType,
  setModFilterType,
  selectedTicketIds,
  setSelectedTicketIds,
  batchApprovalReport,
  setBatchApprovalReport,
  processingTicketId,
  auditLogs,
  evaluateTicketBatchEligibility,
  onOpenBatchConfirmModal,
  onModerateTicket,
}: ModerationTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#102744]">Trung tâm Kiểm duyệt Phiếu Đề Xuất</h2>
          <p className="text-sm text-slate-500">
            {activeRoleId === 'gvcn'
              ? 'Bạn đang đăng nhập với quyền GVCN. Có thể duyệt từng phiếu hoặc duyệt hàng loạt các phiếu đủ điều kiện theo bộ lọc.'
              : 'Chế độ chỉ xem: Chỉ Giáo viên chủ nhiệm mới có quyền phê duyệt (cán bộ lớp kiêm nhiệm 2 chức vụ cũng không có quyền duyệt).'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-800 text-xs font-bold">
            Chờ duyệt toàn lớp: {pendingCount} phiếu
          </span>
        </div>
      </div>

      {/* Báo cáo kết quả sau đợt duyệt hàng loạt */}
      {batchApprovalReport && (
        <div className="p-4 rounded-2xl bg-teal-50 border border-teal-300 text-xs text-teal-950 space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-bold text-sm text-[#102744]">
              Kết quả đợt duyệt hàng loạt ({batchApprovalReport.timestamp}): Đã duyệt{' '}
              {batchApprovalReport.successCount}/{batchApprovalReport.totalScopeCount} phiếu.{' '}
              {batchApprovalReport.needReviewCount} phiếu cần xem lại.
            </div>
            <button
              type="button"
              onClick={() => setBatchApprovalReport(null)}
              className="text-slate-500 hover:text-slate-800 font-bold"
            >
              Đóng
            </button>
          </div>
          <div className="text-slate-600">
            Mã lô kiểm duyệt (Batch ID):{' '}
            <code className="font-mono font-bold">{batchApprovalReport.batchId}</code>
          </div>
          {batchApprovalReport.failedItems.length > 0 && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-1">
              <div className="font-bold">Các phiếu không duyệt được do xung đột phiên bản / trạng thái:</div>
              {batchApprovalReport.failedItems.map((f, idx) => (
                <div key={idx}>
                  • {f.ticket.studentName}: {f.reason}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Thanh Bộ lọc Phạm vi & Công cụ Duyệt Hàng Loạt */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={modFilterStatus}
              onChange={(e) => {
                setModFilterStatus(e.target.value);
                setSelectedTicketIds([]);
              }}
              className="px-3 py-2 rounded-xl border border-slate-300 font-bold bg-slate-50"
            >
              <option value="pending">
                Trạng thái: Chờ duyệt ({tickets.filter((t) => t.status === 'pending').length})
              </option>
              <option value="needs_revision">
                Cần sửa / Tranh chấp ({tickets.filter((t) => t.status === 'needs_revision').length})
              </option>
              <option value="approved">
                Đã phê duyệt ({tickets.filter((t) => t.status === 'approved').length})
              </option>
              <option value="rejected">
                Đã từ chối ({tickets.filter((t) => t.status === 'rejected').length})
              </option>
              <option value="all">Tất cả trạng thái ({tickets.length})</option>
            </select>

            <select
              value={modFilterType}
              onChange={(e) => {
                setModFilterType(e.target.value);
                setSelectedTicketIds([]);
              }}
              className="px-3 py-2 rounded-xl border border-slate-300 font-semibold bg-slate-50"
            >
              <option value="all">Tất cả loại phiếu</option>
              {Object.entries(TICKET_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          {activeRoleId === 'gvcn' && currentRole.canApprove && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  const allEligibleIds = eligibleFilteredTickets.map((t) => t.id);
                  const isAllSelected =
                    allEligibleIds.length > 0 && allEligibleIds.every((id) => selectedTicketIds.includes(id));
                  setSelectedTicketIds(isAllSelected ? [] : allEligibleIds);
                }}
                disabled={eligibleFilteredTickets.length === 0}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-bold"
              >
                {eligibleFilteredTickets.length > 0 &&
                eligibleFilteredTickets.every((t) => selectedTicketIds.includes(t.id))
                  ? 'Bỏ chọn tất cả'
                  : `Chọn tất cả phiếu đủ điều kiện ở bộ lọc hiện tại (${eligibleFilteredTickets.length})`}
              </button>

              <button
                type="button"
                onClick={() => onOpenBatchConfirmModal('selected')}
                disabled={selectedTicketIds.length === 0}
                className="px-3.5 py-2 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 disabled:opacity-50 text-white font-bold shadow-xs"
              >
                Duyệt các phiếu đã chọn ({selectedTicketIds.length})
              </button>

              <button
                type="button"
                onClick={() => onOpenBatchConfirmModal('all_eligible')}
                disabled={eligibleFilteredTickets.length === 0}
                className="px-3.5 py-2 rounded-xl bg-[#102744] hover:bg-slate-800 disabled:opacity-50 text-white font-bold shadow-xs"
              >
                Duyệt tất cả phiếu đủ điều kiện ({eligibleFilteredTickets.length})
              </button>
            </div>
          )}
        </div>

        <div className="text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <span>
            Phạm vi áp dụng:{' '}
            <strong>
              {classConfig.schoolName} • Lớp {classConfig.className} • {classConfig.schoolYear}
            </strong>
            . Không duyệt ngầm phiếu ngoài lớp hoặc ngoài bộ lọc.
          </span>
          <span>
            Đủ điều kiện duyệt lô: <strong className="text-emerald-700">{eligibleFilteredTickets.length}</strong> • Cần
            xem riêng:{' '}
            <strong className="text-amber-700">
              {filteredModerationTickets.length - eligibleFilteredTickets.length}
            </strong>
          </span>
        </div>
      </div>

      {filteredModerationTickets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-700">Không có phiếu nào trong bộ lọc hiện tại</h3>
          <p className="text-sm text-slate-500 mt-1">
            Hãy thay đổi bộ lọc trạng thái/loại phiếu hoặc lập phiếu mới ở mục &quot;2. Báo cáo và đề xuất&quot;.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredModerationTickets.map((ticket) => {
            const typeMeta = TICKET_TYPES[ticket.type] || TICKET_TYPES.ne_nep;
            const Icon = typeMeta.icon;
            const isPending = ticket.status === 'pending';
            const eligibility = evaluateTicketBatchEligibility(ticket);
            const isChecked = selectedTicketIds.includes(ticket.id);

            return (
              <div
                key={ticket.id}
                className={`bg-white p-5 rounded-2xl border shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                  isChecked ? 'border-[#0C9BA6] ring-2 ring-[#0C9BA6]/15' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  {activeRoleId === 'gvcn' && currentRole.canApprove && (
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        disabled={!eligibility.eligible}
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedTicketIds((prev) => [...prev, ticket.id]);
                          else setSelectedTicketIds((prev) => prev.filter((id) => id !== ticket.id));
                        }}
                        title={eligibility.eligible ? 'Chọn phiếu này để duyệt hàng loạt' : eligibility.reason}
                        className="w-4 h-4 rounded border-slate-300 text-[#0C9BA6] focus:ring-[#0C9BA6] disabled:opacity-40"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${typeMeta.color}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{ticket.typeLabel}</span>
                      </span>

                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                          ticket.status === 'pending'
                            ? 'bg-amber-100 text-amber-800'
                            : ticket.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : ticket.status === 'needs_revision'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {ticket.status === 'pending'
                          ? 'Chờ duyệt'
                          : ticket.status === 'approved'
                            ? 'Đã phê duyệt'
                            : ticket.status === 'needs_revision'
                              ? 'Yêu cầu chỉnh sửa'
                              : 'Đã từ chối'}
                      </span>

                      {isPending &&
                        (eligibility.eligible ? (
                          <span className="px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold">
                            ✓ Đủ điều kiện duyệt lô
                          </span>
                        ) : (
                          <span
                            className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold"
                            title={eligibility.reason}
                          >
                            ⚠ Cần xem riêng: {eligibility.reason}
                          </span>
                        ))}

                      <span className="text-xs text-slate-400">
                        Ngày: {ticket.date} • v{ticket.version || 1}
                      </span>
                    </div>

                    <div className="font-bold text-slate-900 text-base">
                      {ticket.studentName}
                      {ticket.type === 'ne_nep' && (
                        <span className="ml-2 text-xs font-bold text-[#0C9BA6]">
                          ({ticket.weekLabel || 'Tuần 1'} • {ticket.category})
                        </span>
                      )}
                      {ticket.type === 'thu_chi' && (
                        <span
                          className={`ml-2 text-xs font-bold ${
                            ticket.category === 'Chi quỹ' ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          ({ticket.category}: {Number(ticket.amount || 0).toLocaleString('vi-VN')} đ)
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-slate-600">{ticket.description}</p>
                    {ticket.evidence && (
                      <p className="text-xs text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/80">
                        <strong>Minh chứng:</strong> {ticket.evidence}
                      </p>
                    )}
                    <div className="text-xs text-slate-400">
                      Người gửi: <strong className="text-slate-600">{ticket.submittedByTitle}</strong>
                      {ticket.reviewedByTeacher && ` • Người duyệt: GVCN ${ticket.reviewedByTeacher}`}
                      {ticket.approvalId && ` • Mã duyệt: ${ticket.approvalId}`}
                    </div>
                  </div>
                </div>

                {(isPending || ticket.status === 'needs_revision') && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {activeRoleId === 'gvcn' && currentRole.canApprove ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onModerateTicket(ticket, 'approved')}
                          disabled={processingTicketId === ticket.id}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                        >
                          <Check className="w-4 h-4" />
                          <span>Duyệt</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onModerateTicket(ticket, 'needs_revision')}
                          disabled={processingTicketId === ticket.id}
                          className="px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 disabled:opacity-50 text-amber-900 text-xs font-bold flex items-center gap-1.5"
                        >
                          <Edit3 className="w-4 h-4" />
                          <span>Yêu cầu sửa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onModerateTicket(ticket, 'rejected')}
                          disabled={processingTicketId === ticket.id}
                          className="px-3.5 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 disabled:opacity-50 text-rose-800 text-xs font-bold flex items-center gap-1.5"
                        >
                          <X className="w-4 h-4" />
                          <span>Từ chối</span>
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-100 px-3 py-2 rounded-xl">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Đợi GVCN duyệt</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Nhật ký kiểm duyệt không thể xóa */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#102744] flex items-center gap-2">
            <History className="w-4 h-4 text-[#0C9BA6]" />
            <span>Nhật ký Kiểm duyệt & Lưu vết Phê duyệt ({auditLogs.length} bản ghi)</span>
          </h3>
          <span className="text-[11px] text-slate-400">
            Lưu vết bất biến — Không hỗ trợ hoàn tác xóa lịch sử
          </span>
        </div>
        {auditLogs.length === 0 ? (
          <p className="text-xs text-slate-500">Chưa có lịch sử kiểm duyệt nào.</p>
        ) : (
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs">
            {auditLogs.slice(0, 20).map((log) => (
              <div key={log.id} className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <span className="font-bold text-[#102744]">[{log.action}]</span>{' '}
                  <span className="text-slate-800">{log.summary}</span>
                  {log.approvalId && (
                    <span className="ml-2 font-mono text-[11px] text-teal-700">({log.approvalId})</span>
                  )}
                </div>
                <span className="text-slate-400 shrink-0">{log.approvedBy}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
