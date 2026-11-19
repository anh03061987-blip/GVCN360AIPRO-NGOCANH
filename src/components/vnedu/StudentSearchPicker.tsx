import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Check, ChevronDown, Search, UserCheck, X } from 'lucide-react';
import type { StudentRecord } from '../../types/gvcn';
import { stripVietnameseAccents } from '../../utils/studentExcelImport';

interface StudentSearchPickerProps {
  students: StudentRecord[];
  classNameLabel: string;
  selectedStudentId: string;
  candidates: StudentRecord[];
  recommendedCandidate: StudentRecord | null;
  isManualSelection: boolean;
  isSkipped: boolean;
  disabled?: boolean;
  placeholder?: string;
  onSelectStudent: (studentId: string) => void;
  onSkipRow: () => void;
  onResetAuto: () => void;
}

export function StudentSearchPicker({
  students,
  classNameLabel,
  selectedStudentId,
  candidates,
  recommendedCandidate,
  isManualSelection,
  isSkipped,
  disabled = false,
  placeholder = 'Chọn HS trong lớp...',
  onSelectStudent,
  onSkipRow,
  onResetAuto,
}: StudentSearchPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; openUp: boolean }>({
    top: 0,
    left: 0,
    width: 340,
    openUp: false,
  });

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId || s.code === selectedStudentId) || null,
    [students, selectedStudentId]
  );

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 320 && rect.top > 320;
    const width = Math.min(Math.max(rect.width, 340), window.innerWidth - 24);
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
    setCoords({
      top: openUp ? rect.top - 6 : rect.bottom + 6,
      left,
      width,
      openUp,
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 10);

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const handleScrollOrResize = () => updatePosition();

    window.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [open]);

  const candidateIds = useMemo(() => new Set(candidates.map((c) => c.id)), [candidates]);

  const filteredList = useMemo(() => {
    const sorted = [...students].sort(
      (a, b) => a.team - b.team || a.fullName.localeCompare(b.fullName, 'vi')
    );
    const qRaw = query.trim().toLowerCase();
    const qNoAccent = stripVietnameseAccents(query);

    const matches = qRaw
      ? sorted.filter((st) => {
          const nameLow = st.fullName.toLowerCase();
          const nameNoAccent = stripVietnameseAccents(st.fullName);
          const moet = (st.moetCode || '').toLowerCase();
          const code = (st.code || '').toLowerCase();
          const dob = (st.dob || '').toLowerCase();
          const teamText = `tổ ${st.team} to ${st.team}`;
          return (
            nameLow.includes(qRaw) ||
            nameNoAccent.includes(qNoAccent) ||
            moet.includes(qRaw) ||
            code.includes(qRaw) ||
            dob.includes(qRaw) ||
            teamText.includes(qRaw)
          );
        })
      : sorted;

    const cands: StudentRecord[] = [];
    const others: StudentRecord[] = [];
    matches.forEach((st) => {
      if (candidateIds.has(st.id)) cands.push(st);
      else others.push(st);
    });
    if (recommendedCandidate) {
      cands.sort((a, b) =>
        a.id === recommendedCandidate.id ? -1 : b.id === recommendedCandidate.id ? 1 : 0
      );
    }
    return { cands, others };
  }, [students, query, candidateIds, recommendedCandidate]);

  if (students.length === 0) {
    return (
      <div className="px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-semibold flex items-center gap-1.5">
        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
        <span>Chưa tải được danh sách HS Lớp {classNameLabel}</span>
      </div>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          setQuery('');
          setOpen((v) => !v);
        }}
        className={`w-full px-2.5 py-1.5 rounded-lg border text-left text-[11px] flex items-center justify-between gap-2 transition-colors ${
          isSkipped
            ? 'bg-slate-100 border-slate-300 text-slate-500'
            : selectedStudent
            ? 'bg-white border-teal-300 text-slate-900 hover:border-[#0C9BA6]'
            : 'bg-amber-50/70 border-amber-300 text-amber-950 hover:border-amber-500'
        } disabled:opacity-60`}
      >
        <div className="min-w-0 truncate">
          {isSkipped ? (
            <span className="italic text-slate-500">Đã chọn bỏ qua dòng này</span>
          ) : selectedStudent ? (
            <span className="font-bold text-[#102744]">
              {selectedStudent.fullName}{' '}
              <span className="text-[#0C9BA6] font-semibold">(Tổ {selectedStudent.team})</span>
            </span>
          ) : recommendedCandidate ? (
            <span className="font-semibold text-amber-900">
              Gợi ý: {recommendedCandidate.fullName} (bấm xác nhận)
            </span>
          ) : (
            <span className="font-semibold">{placeholder}</span>
          )}
        </div>
        <ChevronDown className="w-3.5 h-3.5 shrink-0 text-slate-500" />
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: coords.openUp ? undefined : coords.top,
              bottom: coords.openUp ? window.innerHeight - coords.top : undefined,
              left: coords.left,
              width: coords.width,
              zIndex: 9999,
            }}
            className="bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[340px]"
          >
            <div className="p-2.5 border-b border-slate-100 bg-slate-50 space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Tìm theo họ tên, Mã MOET, ngày sinh (Lớp ${classNameLabel})...`}
                  className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-slate-300 bg-white text-xs focus:outline-none focus:border-[#0C9BA6]"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-slate-500 font-semibold">
                  Danh sách thực tế: {students.length} HS
                </span>
                <div className="flex items-center gap-1.5">
                  {isManualSelection && (
                    <button
                      type="button"
                      onClick={() => {
                        onResetAuto();
                        setOpen(false);
                      }}
                      className="px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold"
                    >
                      Đặt lại
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onSkipRow();
                      setOpen(false);
                    }}
                    className="px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold"
                  >
                    Bỏ qua dòng
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-y-auto divide-y divide-slate-100 text-xs">
              {filteredList.cands.length === 0 && filteredList.others.length === 0 ? (
                <div className="p-4 text-center text-slate-500">
                  Không tìm thấy học sinh nào khớp &ldquo;{query}&rdquo; trong Lớp {classNameLabel}.
                </div>
              ) : (
                <>
                  {filteredList.cands.length > 0 && (
                    <div>
                      <div className="px-3 py-1 bg-amber-50 text-[10px] font-bold uppercase text-amber-800">
                        Ứng viên đề xuất ({filteredList.cands.length})
                      </div>
                      {filteredList.cands.map((st) => {
                        const isSelected = st.id === selectedStudentId;
                        const isRec = recommendedCandidate?.id === st.id;
                        return (
                          <button
                            key={`cand_${st.id}`}
                            type="button"
                            onClick={() => {
                              onSelectStudent(st.id);
                              setOpen(false);
                            }}
                            className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 hover:bg-teal-50/70 ${
                              isSelected ? 'bg-teal-50 font-bold' : ''
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-[#102744] flex items-center gap-1.5">
                                <UserCheck className="w-3.5 h-3.5 text-[#0C9BA6] shrink-0" />
                                <span className="truncate">{st.fullName}</span>
                                {isRec && (
                                  <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 text-[10px] font-bold">
                                    Gợi ý tốt nhất
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                Tổ {st.team} • MOET: {st.moetCode || st.code} • NS: {st.dob || 'Chưa có'}
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-[#0C9BA6] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {filteredList.others.length > 0 && (
                    <div>
                      <div className="px-3 py-1 bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                        Toàn bộ Lớp {classNameLabel} ({filteredList.others.length})
                      </div>
                      {filteredList.others.map((st) => {
                        const isSelected = st.id === selectedStudentId;
                        return (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => {
                              onSelectStudent(st.id);
                              setOpen(false);
                            }}
                            className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 hover:bg-slate-50 ${
                              isSelected ? 'bg-teal-50 font-bold' : ''
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 truncate">{st.fullName}</div>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                Tổ {st.team} • MOET: {st.moetCode || st.code} • NS: {st.dob || 'Chưa có'}
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-[#0C9BA6] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
