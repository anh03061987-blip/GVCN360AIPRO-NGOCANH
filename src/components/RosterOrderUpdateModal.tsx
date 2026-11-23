import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ArrowUpDown,
  Lock,
} from 'lucide-react';
import type { ClassConfig, StudentRecord } from '../types/gvcn';
import {
  buildRosterOrderReconciliation,
  detectStudentHeaderAndMapping,
  extractSheetMatrix,
  parseDelimitedTextToMatrix,
  readStudentWorkbook,
  type RosterOrderColumnMapping,
  type RosterOrderReconciliationAnalysis,
  type RosterOrderRowStatus,
} from '../utils/studentExcelImport';

interface RosterOrderUpdateModalProps {
  open: boolean;
  onClose: () => void;
  classConfig: ClassConfig;
  students: StudentRecord[];
  isApplying: boolean;
  onApplyRosterOrder: (
    analysis: RosterOrderReconciliationAnalysis,
    fileName: string
  ) => Promise<boolean>;
}

export function RosterOrderUpdateModal({
  open,
  onClose,
  classConfig,
  students,
  isApplying,
  onApplyRosterOrder,
}: RosterOrderUpdateModalProps) {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [fileName, setFileName] = useState('');
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [headerRowIndex, setHeaderRowIndex] = useState(-1);
  const [mapping, setMapping] = useState<RosterOrderColumnMapping>({
    stt: -1,
    moetCode: -1,
    fullName: -1,
  });
  const [readError, setReadError] = useState('');
  const [applyError, setApplyError] = useState('');
  const [rowFilter, setRowFilter] = useState<'all' | 'ready_update' | 'unchanged' | 'error'>('all');

  const applyMatrix = (matrix: string[][]) => {
    const detected = detectStudentHeaderAndMapping(matrix);
    setHeaderRowIndex(detected.headerRowIndex);
    setHeaders(detected.headers);
    setDataRows(detected.dataRows);
    setMapping({
      stt: detected.mapping.stt,
      moetCode: detected.mapping.moetCode,
      fullName: detected.mapping.fullName,
    });
    setRowFilter('all');
    setApplyError('');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReadError('');
    setApplyError('');
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const result = readStudentWorkbook(buffer);
        setWorkbook(result.workbook);
        setFileName(file.name);
        setSheetNames(result.sheetNames);
        setSelectedSheet(result.selectedSheet);
        applyMatrix(result.matrix);
      } else {
        const text = await file.text();
        setWorkbook(null);
        setFileName(file.name);
        setSheetNames([]);
        setSelectedSheet('');
        applyMatrix(parseDelimitedTextToMatrix(text));
      }
    } catch (err) {
      setReadError(
        err instanceof Error ? err.message : 'Không đọc được tệp Excel. Vui lòng kiểm tra lại định dạng tệp.'
      );
    } finally {
      e.target.value = '';
    }
  };

  const handleSelectSheet = (sheet: string) => {
    if (!workbook) return;
    setSelectedSheet(sheet);
    const matrix = extractSheetMatrix(workbook, sheet);
    applyMatrix(matrix);
  };

  const analysis = useMemo<RosterOrderReconciliationAnalysis | null>(() => {
    if (dataRows.length === 0 && !fileName) return null;
    return buildRosterOrderReconciliation(dataRows, mapping, headerRowIndex, students);
  }, [dataRows, mapping, headerRowIndex, students, fileName]);

  const filteredRows = useMemo(() => {
    if (!analysis) return [];
    return analysis.rows.filter((r) => {
      if (rowFilter === 'all') return true;
      if (rowFilter === 'ready_update') return r.status === 'ready_update';
      if (rowFilter === 'unchanged') return r.status === 'unchanged';
      return r.errors.length > 0;
    });
  }, [analysis, rowFilter]);

  if (!open) return null;

  const statusBadge = (status: RosterOrderRowStatus) => {
    switch (status) {
      case 'ready_update':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 font-bold text-[11px]">
            <CheckCircle2 className="w-3 h-3" /> Khớp MOET — Sẽ cập nhật STT
          </span>
        );
      case 'unchanged':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px]">
            <CheckCircle2 className="w-3 h-3" /> Đã đúng STT
          </span>
        );
      case 'missing_moet':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 font-bold text-[11px]">
            <AlertTriangle className="w-3 h-3" /> Thiếu Mã MOET
          </span>
        );
      case 'duplicate_moet':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 font-bold text-[11px]">
            <AlertTriangle className="w-3 h-3" /> Trùng Mã MOET
          </span>
        );
      case 'not_found_in_class':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 font-bold text-[11px]">
            <AlertTriangle className="w-3 h-3" /> Không có trong lớp (HS lạ)
          </span>
        );
      case 'invalid_stt':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px]">
            <AlertTriangle className="w-3 h-3" /> STT không hợp lệ
          </span>
        );
      case 'duplicate_stt':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 font-bold text-[11px]">
            <AlertTriangle className="w-3 h-3" /> Trùng STT
          </span>
        );
    }
  };

  const handleConfirm = async () => {
    if (!analysis || !analysis.canConfirmApply || isApplying) return;
    setApplyError('');
    try {
      const ok = await onApplyRosterOrder(analysis, fileName || 'excel-stt');
      if (ok) {
        onClose();
      }
    } catch (err) {
      setApplyError(
        err instanceof Error
          ? err.message
          : 'Không thể hoàn tất cập nhật STT vào Firestore. Dữ liệu chưa được xác nhận hoàn thành.'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl max-w-6xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-3 shrink-0 gap-4">
          <div>
            <h3 className="font-bold text-lg text-[#102744] flex items-center gap-2">
              <ArrowUpDown className="w-5 h-5 text-[#0C9BA6]" />
              <span>Cập nhật STT theo Excel — Lớp {classConfig.className}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Giữ nguyên toàn bộ {students.length} hồ sơ học sinh đã lưu (studentId, Mã MOET, họ tên, tổ, chức vụ, phụ huynh, tài khoản, điểm danh, thi đua, điểm vnEdu). Chỉ đối chiếu chính xác theo Mã MOET để cập nhật trường <code className="font-mono font-bold text-[#102744]">rosterOrder</code>.
            </p>
          </div>
          <button
            type="button"
            disabled={isApplying}
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 space-y-4 pr-1">
          {/* File upload bar */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-[#102744] flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-[#0C9BA6]" />
                <span>Chọn file Excel danh sách lớp chính thức (.xlsx, .xls, .csv)</span>
              </div>
              <div className="text-[11px] text-slate-500">
                {fileName ? (
                  <span>
                    Đã chọn: <strong className="text-slate-800">{fileName}</strong>
                    {selectedSheet ? ` • Sheet: "${selectedSheet}"` : ''}
                  </span>
                ) : (
                  <span>Hệ thống sẽ đọc 3 cột: STT, Mã MOET và Họ tên để đối chiếu an toàn.</span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {sheetNames.length > 1 && (
                <select
                  value={selectedSheet}
                  onChange={(e) => handleSelectSheet(e.target.value)}
                  className="px-2.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800"
                >
                  {sheetNames.map((s) => (
                    <option key={s} value={s}>
                      Sheet: {s}
                    </option>
                  ))}
                </select>
              )}
              <label className="px-3.5 py-2 rounded-xl bg-[#102744] hover:bg-slate-800 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                <span>{fileName ? 'Chọn file Excel khác' : 'Chọn file Excel chính thức'}</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.tsv,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {readError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-800 font-semibold">
              {readError}
            </div>
          )}

          {applyError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-900 font-bold flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{applyError}</span>
            </div>
          )}

          {/* Column mapping for the 3 required columns */}
          {headers.length > 0 && (
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2">
              <div className="text-xs font-bold text-[#102744]">
                Ánh xạ cột đối chiếu (chỉ đọc STT, Mã MOET và Họ tên — không sửa thông tin khác)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Cột STT trong Excel <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={mapping.stt}
                    onChange={(e) => setMapping((prev) => ({ ...prev, stt: Number(e.target.value) }))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-semibold"
                  >
                    <option value={-1}>-- Chọn cột STT --</option>
                    {headers.map((h, idx) => (
                      <option key={idx} value={idx}>
                        Cột {String.fromCharCode(65 + idx)}: {h}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Cột Mã MOET <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={mapping.moetCode}
                    onChange={(e) =>
                      setMapping((prev) => ({ ...prev, moetCode: Number(e.target.value) }))
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-semibold"
                  >
                    <option value={-1}>-- Chọn cột Mã MOET --</option>
                    {headers.map((h, idx) => (
                      <option key={idx} value={idx}>
                        Cột {String.fromCharCode(65 + idx)}: {h}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Cột Họ tên (chỉ để kiểm tra mắt)
                  </label>
                  <select
                    value={mapping.fullName}
                    onChange={(e) =>
                      setMapping((prev) => ({ ...prev, fullName: Number(e.target.value) }))
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-semibold"
                  >
                    <option value={-1}>-- Không chọn --</option>
                    {headers.map((h, idx) => (
                      <option key={idx} value={idx}>
                        Cột {String.fromCharCode(65 + idx)}: {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Analysis Results */}
          {analysis && (
            <>
              {/* Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                <button
                  type="button"
                  onClick={() => setRowFilter('all')}
                  className={`p-3 rounded-xl border text-left transition ${
                    rowFilter === 'all'
                      ? 'bg-[#102744] text-white border-[#102744]'
                      : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <div className="font-semibold opacity-80">Dòng đọc được / Sĩ số</div>
                  <div className="text-lg font-extrabold mt-0.5">
                    {analysis.fileRowCount} / {analysis.expectedClassSize}
                  </div>
                </button>
                <div className="p-3 rounded-xl border bg-indigo-50 border-indigo-200 text-indigo-950">
                  <div className="font-semibold">Khớp duy nhất MOET</div>
                  <div className="text-lg font-extrabold mt-0.5">
                    {analysis.matchedUniqueCount} / {analysis.expectedClassSize}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRowFilter('ready_update')}
                  className={`p-3 rounded-xl border text-left transition ${
                    rowFilter === 'ready_update'
                      ? 'bg-[#0C9BA6] text-white border-[#0C9BA6]'
                      : 'bg-teal-50 border-teal-200 text-teal-900 hover:bg-teal-100'
                  }`}
                >
                  <div className="font-semibold">Sẽ cập nhật STT</div>
                  <div className="text-lg font-extrabold mt-0.5">{analysis.changedCount}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRowFilter('unchanged')}
                  className={`p-3 rounded-xl border text-left transition ${
                    rowFilter === 'unchanged'
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100'
                  }`}
                >
                  <div className="font-semibold">Đã đúng STT</div>
                  <div className="text-lg font-extrabold mt-0.5">{analysis.unchangedCount}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRowFilter('error')}
                  className={`p-3 rounded-xl border text-left transition ${
                    rowFilter === 'error'
                      ? 'bg-rose-700 text-white border-rose-700'
                      : 'bg-rose-50 border-rose-200 text-rose-900 hover:bg-rose-100'
                  }`}
                >
                  <div className="font-semibold">Dòng lỗi / Không khớp</div>
                  <div className="text-lg font-extrabold mt-0.5">{analysis.errorRowCount}</div>
                </button>
              </div>

              {/* Global Blocking Errors */}
              {analysis.globalErrors.length > 0 && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-950 space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-rose-900">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      Chưa đủ điều kiện áp dụng toàn bộ danh sách — Vui lòng kiểm tra và xử lý trước:
                    </span>
                  </div>
                  {analysis.globalErrors.map((err, idx) => (
                    <div key={idx}>• {err}</div>
                  ))}
                </div>
              )}

              {/* Missing class students */}
              {analysis.missingClassStudents.length > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Hồ sơ đang thuộc lớp {classConfig.className} nhưng KHÔNG có trong file Excel (
                      {analysis.missingClassStudents.length} HS):
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {analysis.missingClassStudents.map((st) => (
                      <span
                        key={st.id}
                        className="px-2 py-0.5 rounded bg-white border border-amber-300 font-semibold"
                      >
                        {st.fullName} ({st.moetCode || st.code} • Tổ {st.team})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Non-blocking Warnings */}
              {analysis.globalWarnings.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-1">
                  {analysis.globalWarnings.map((w, idx) => (
                    <div key={idx}>• {w}</div>
                  ))}
                </div>
              )}

              {/* Ready Banner */}
              {analysis.canConfirmApply && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">
                      Đối chiếu hợp lệ 100%: Đủ {analysis.expectedClassSize}/{analysis.expectedClassSize} Mã MOET khớp duy nhất, STT liên tục từ 1 đến {analysis.expectedClassSize}, không học sinh lạ.
                    </div>
                    <div className="text-emerald-800 mt-0.5">
                      {analysis.changedCount > 0
                        ? `Sẵn sàng cập nhật duy nhất trường rosterOrder cho ${analysis.changedCount} học sinh (giữ nguyên ${analysis.unchangedCount} học sinh đã đúng STT) bằng giao dịch batch nguyên tử.`
                        : `Toàn bộ ${analysis.expectedClassSize} học sinh hiện đã có đúng STT theo file Excel.`}
                    </div>
                  </div>
                </div>
              )}

              {/* 6-Column Reconciliation Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>
                    Bảng đối chiếu STT Excel trước khi cập nhật ({filteredRows.length}/{analysis.rows.length} dòng)
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">
                    Khớp tuyệt đối theo Mã MOET — Không tự ghép theo tên hoặc STT
                  </span>
                </div>
                <div className="max-h-80 overflow-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-[11px] uppercase text-slate-600">
                      <tr>
                        <th className="py-2.5 px-3">STT Excel</th>
                        <th className="py-2.5 px-3">Mã MOET</th>
                        <th className="py-2.5 px-3 min-w-[180px]">Họ tên</th>
                        <th className="py-2.5 px-3">STT hiện tại</th>
                        <th className="py-2.5 px-3">STT mới</th>
                        <th className="py-2.5 px-3 min-w-[230px]">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRows.map((row) => (
                        <tr
                          key={row.excelRowNumber}
                          className={
                            row.errors.length > 0
                              ? 'bg-rose-50/70'
                              : row.warnings.length > 0
                                ? 'bg-amber-50/40'
                                : ''
                          }
                        >
                          <td className="py-2 px-3 font-mono font-bold text-slate-800">
                            {row.sttRaw || <span className="text-rose-600">Trống</span>}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-indigo-900">
                            {row.moetCode || <span className="text-rose-600">Thiếu</span>}
                          </td>
                          <td className="py-2 px-3">
                            <div className="font-bold text-slate-900">
                              {row.matchedStudent?.fullName || row.excelFullName || '—'}
                            </div>
                            {row.matchedStudent && (
                              <div className="text-[10px] text-slate-500">
                                ID giữ nguyên: <span className="font-mono">{row.matchedStudent.id}</span> • Tổ{' '}
                                {row.matchedStudent.team}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600">
                            {row.currentRosterOrder !== null ? row.currentRosterOrder : 'Chưa lưu'}
                          </td>
                          <td className="py-2 px-3 font-mono font-extrabold text-[#102744]">
                            {row.newRosterOrder !== null ? row.newRosterOrder : '—'}
                          </td>
                          <td className="py-2 px-3 space-y-1">
                            <div>{statusBadge(row.status)}</div>
                            {row.errors.map((err, i) => (
                              <div key={i} className="text-[11px] font-semibold text-rose-700">
                                • {err}
                              </div>
                            ))}
                            {row.warnings.map((w, i) => (
                              <div key={i} className="text-[11px] text-amber-800">
                                • {w}
                              </div>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[#0C9BA6] shrink-0" />
            <span>
              Chỉ GVCN được thực hiện • Chỉ cập nhật <code>rosterOrder</code>, giữ nguyên 100% dữ liệu nghiệp vụ.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isApplying}
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
            >
              Đóng
            </button>
            <button
              type="button"
              disabled={!analysis || !analysis.canConfirmApply || isApplying}
              onClick={handleConfirm}
              className="px-4 py-2 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold"
            >
              {isApplying ? 'Đang cập nhật & xác minh...' : 'XÁC NHẬN CẬP NHẬT STT'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
