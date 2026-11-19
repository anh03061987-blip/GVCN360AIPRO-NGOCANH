import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Layers,
  ClipboardCheck,
  AlertTriangle,
  Sliders,
  TrendingUp,
  Award,
  Bot,
  Plus,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Edit3,
  Trash2,
} from 'lucide-react';
import { DEFAULT_ERROR_CATEGORIES } from '../../constants/gvcnConstants';
import {
  VNEDU_SEMESTERS,
  extractExtraTxFromNote,
  getVneduScoreDocId,
  type VneduSemester,
} from '../../utils/vneduScoreImport';
import type {
  ClassConfig,
  ErrorLogRecord,
  KnowledgeTopic,
  QuickCheckLevel,
  QuickCheckRecord,
  StudentRecord,
  SubjectScoreRecord,
} from '../../types/gvcn';
import { getAuthBearerHeaders } from '../../firebase';

export type SubjectSubTab =
  | 'overview'
  | 'knowledge_map'
  | 'quick_check'
  | 'error_log'
  | 'support_plan'
  | 'progress'
  | 'praise'
  | 'subject_ai';

interface MySubjectTabProps {
  activeRoleId: string;
  classConfig: ClassConfig;
  students: StudentRecord[];
  subjectScores: Record<string, SubjectScoreRecord>;
  subjectKey: string;
  subjectSubTab: SubjectSubTab;
  setSubjectSubTab: (t: SubjectSubTab) => void;
  knowledgeTopics: KnowledgeTopic[];
  quickChecks: QuickCheckRecord[];
  errorLogs: ErrorLogRecord[];
  kmFilterTeam: string;
  setKmFilterTeam: (v: string) => void;
  kmFilterStudent: string;
  setKmFilterStudent: (v: string) => void;
  kmFilterTopic: string;
  setKmFilterTopic: (v: string) => void;
  kmFilterSemester: string;
  setKmFilterSemester: (v: string) => void;
  kmFilterDateFrom: string;
  setKmFilterDateFrom: (v: string) => void;
  kmFilterDateTo: string;
  setKmFilterDateTo: (v: string) => void;
  newTopicForm: { semester: string; topicName: string; skillName: string; requirement: string };
  setNewTopicForm: React.Dispatch<
    React.SetStateAction<{ semester: string; topicName: string; skillName: string; requirement: string }>
  >;
  onAddKnowledgeTopic: (e: React.FormEvent) => void;
  onUpdateKnowledgeTopic: (
    topicId: string,
    updated: { semester: string; topicName: string; skillName: string; requirement: string }
  ) => Promise<boolean>;
  onDeleteKnowledgeTopic: (topicId: string, skillName: string) => void;
  qcDate: string;
  setQcDate: (v: string) => void;
  qcTopicId: string;
  setQcTopicId: (v: string) => void;
  qcEvidenceType: string;
  setQcEvidenceType: (v: string) => void;
  qcFilterTeam: string;
  setQcFilterTeam: (v: string) => void;
  qcSearch: string;
  setQcSearch: (v: string) => void;
  qcSelectedIds: string[];
  setQcSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  qcDraftMap: Record<string, { level?: QuickCheckLevel | 'unassessed'; note?: string }>;
  setQcDraftMap: React.Dispatch<
    React.SetStateAction<Record<string, { level?: QuickCheckLevel | 'unassessed'; note?: string }>>
  >;
  isSavingQuickCheck: boolean;
  onApplyBatchQuickCheckLevel: (level: QuickCheckLevel) => void;
  onSaveQuickChecks: () => void;
  errDate: string;
  setErrDate: (v: string) => void;
  errTopicId: string;
  setErrTopicId: (v: string) => void;
  errCategory: string;
  setErrCategory: (v: string) => void;
  errCustomCategory: string;
  setErrCustomCategory: (v: string) => void;
  errNote: string;
  setErrNote: (v: string) => void;
  errRemedy: string;
  setErrRemedy: (v: string) => void;
  errSelectedStudentCodes: string[];
  setErrSelectedStudentCodes: React.Dispatch<React.SetStateAction<string[]>>;
  errFilterStudent: string;
  setErrFilterStudent: (v: string) => void;
  errFilterStatus: string;
  setErrFilterStatus: (v: string) => void;
  isSavingErrorLog: boolean;
  onSaveErrorLogs: (e: React.FormEvent) => void;
  onToggleErrorFixedStatus: (errItem: ErrorLogRecord) => void;
  onNavigateToParentComm: (studentId: string) => void;
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
}

export function MySubjectTab({
  activeRoleId,
  classConfig,
  students,
  subjectScores,
  subjectKey,
  subjectSubTab,
  setSubjectSubTab,
  knowledgeTopics,
  quickChecks,
  errorLogs,
  kmFilterTeam,
  setKmFilterTeam,
  kmFilterStudent,
  setKmFilterStudent,
  kmFilterTopic,
  setKmFilterTopic,
  kmFilterSemester,
  setKmFilterSemester,
  kmFilterDateFrom,
  setKmFilterDateFrom,
  kmFilterDateTo,
  setKmFilterDateTo,
  newTopicForm,
  setNewTopicForm,
  onAddKnowledgeTopic,
  onUpdateKnowledgeTopic,
  onDeleteKnowledgeTopic,
  qcDate,
  setQcDate,
  qcTopicId,
  setQcTopicId,
  qcEvidenceType,
  setQcEvidenceType,
  qcFilterTeam,
  setQcFilterTeam,
  qcSearch,
  setQcSearch,
  qcSelectedIds,
  setQcSelectedIds,
  qcDraftMap,
  setQcDraftMap,
  isSavingQuickCheck,
  onApplyBatchQuickCheckLevel,
  onSaveQuickChecks,
  errDate,
  setErrDate,
  errTopicId,
  setErrTopicId,
  errCategory,
  setErrCategory,
  errCustomCategory,
  setErrCustomCategory,
  errNote,
  setErrNote,
  errRemedy,
  setErrRemedy,
  errSelectedStudentCodes,
  setErrSelectedStudentCodes,
  errFilterStudent,
  setErrFilterStudent,
  errFilterStatus,
  setErrFilterStatus,
  isSavingErrorLog,
  onSaveErrorLogs,
  onToggleErrorFixedStatus,
  onNavigateToParentComm,
  onShowToast,
}: MySubjectTabProps) {
  const [selectedSemester, setSelectedSemester] = useState<VneduSemester>('Học kỳ I');
  const [subjectAiResult, setSubjectAiResult] = useState('');
  const [isRunningSubjectAi, setIsRunningSubjectAi] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editTopicForm, setEditTopicForm] = useState({
    semester: 'Học kỳ I',
    topicName: '',
    skillName: '',
    requirement: '',
  });
  const [confirmDeleteTopicId, setConfirmDeleteTopicId] = useState<string | null>(null);

  const subTabs: { id: SubjectSubTab; label: string; icon: typeof BookOpen }[] = [
    { id: 'overview', label: 'Bảng điểm & Tổng quan', icon: BookOpen },
    { id: 'knowledge_map', label: 'Bản đồ kiến thức', icon: Layers },
    { id: 'quick_check', label: 'Kiểm tra nhanh', icon: ClipboardCheck },
    { id: 'error_log', label: 'Sổ tay lỗi sai', icon: AlertTriangle },
    { id: 'support_plan', label: 'Kế hoạch phụ đạo', icon: Sliders },
    { id: 'progress', label: 'Tiến bộ học sinh', icon: TrendingUp },
    { id: 'praise', label: 'Động viên & Khen ngợi', icon: Award },
    { id: 'subject_ai', label: 'AI Gợi ý bài tập', icon: Bot },
  ];

  // Thống kê cho Bản đồ kiến thức
  const filteredQuickChecks = useMemo(() => {
    return quickChecks.filter((q) => {
      if (kmFilterTeam !== 'all' && String(q.team) !== kmFilterTeam) return false;
      if (kmFilterStudent !== 'all' && q.studentCode !== kmFilterStudent) return false;
      if (kmFilterTopic !== 'all' && q.topicId !== kmFilterTopic) return false;
      if (kmFilterSemester !== 'all' && q.semester !== kmFilterSemester) return false;
      if (kmFilterDateFrom && q.date < kmFilterDateFrom) return false;
      if (kmFilterDateTo && q.date > kmFilterDateTo) return false;
      return true;
    });
  }, [quickChecks, kmFilterTeam, kmFilterStudent, kmFilterTopic, kmFilterSemester, kmFilterDateFrom, kmFilterDateTo]);

  // Danh sách học sinh lọc cho Kiểm tra nhanh
  const qcFilteredStudents = useMemo(() => {
    return students.filter((st) => {
      if (qcFilterTeam !== 'all' && String(st.team) !== qcFilterTeam) return false;
      if (
        qcSearch.trim() &&
        !st.fullName.toLowerCase().includes(qcSearch.toLowerCase()) &&
        !st.code.toLowerCase().includes(qcSearch.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [students, qcFilterTeam, qcSearch]);

  // Danh sách lỗi sai lọc
  const filteredErrorLogs = useMemo(() => {
    return errorLogs.filter((err) => {
      if (errFilterStudent !== 'all' && err.studentCode !== errFilterStudent) return false;
      if (errFilterStatus !== 'all' && err.status !== errFilterStatus) return false;
      return true;
    });
  }, [errorLogs, errFilterStudent, errFilterStatus]);

  // Tổng hợp nhóm cần phụ đạo & học sinh tiến bộ
  const supportStudents = useMemo(() => {
    return students
      .map((st) => {
        const sc =
          subjectScores[getVneduScoreDocId(st.code, subjectKey, selectedSemester)] ||
          subjectScores[`${st.code}_${subjectKey}`];
        const needSupportCount = quickChecks.filter(
          (q) => q.studentCode === st.code && q.level === 'need_support'
        ).length;
        const unfixedErrors = errorLogs.filter(
          (e) => e.studentCode === st.code && e.status === 'unfixed'
        ).length;
        return {
          student: st,
          avg: sc?.avg ?? null,
          needSupportCount,
          unfixedErrors,
        };
      })
      .filter((item) => (item.avg !== null && item.avg < 6.5) || item.needSupportCount > 0 || item.unfixedErrors > 0);
  }, [students, subjectScores, subjectKey, selectedSemester, quickChecks, errorLogs]);

  const praiseStudents = useMemo(() => {
    return students
      .map((st) => {
        const sc =
          subjectScores[getVneduScoreDocId(st.code, subjectKey, selectedSemester)] ||
          subjectScores[`${st.code}_${subjectKey}`];
        const masteredCount = quickChecks.filter(
          (q) => q.studentCode === st.code && q.level === 'mastered'
        ).length;
        const fixedCount = errorLogs.filter((e) => e.studentCode === st.code && e.status === 'fixed').length;
        return { student: st, avg: sc?.avg ?? null, masteredCount, fixedCount };
      })
      .filter((item) => (item.avg !== null && item.avg >= 8.0) || item.masteredCount > 0 || item.fixedCount > 0);
  }, [students, subjectScores, subjectKey, selectedSemester, quickChecks, errorLogs]);

  const dynamicOverviewTxOrders = useMemo(() => {
    const orders = new Set<number>([1, 2, 3, 4]);
    students.forEach((st) => {
      const sc = subjectScores[getVneduScoreDocId(st.code, subjectKey, selectedSemester)];
      if (!sc?.note) return;
      const meta = extractExtraTxFromNote(sc.note);
      Object.keys(meta.txMap).forEach((ordStr) => {
        const ord = Number(ordStr);
        if (Number.isInteger(ord) && ord >= 1) orders.add(ord);
      });
    });
    return Array.from(orders).sort((a, b) => a - b);
  }, [students, subjectScores, subjectKey, selectedSemester]);

  const handleRunSubjectAi = async () => {
    setIsRunningSubjectAi(true);
    try {
      const topicSummary = knowledgeTopics
        .map((t) => `- [${t.semester}] ${t.topicName}: ${t.skillName}`)
        .join('\n');
      const weakSummary = supportStudents
        .map(
          (s) =>
            `- ${s.student.fullName}: ĐTB=${s.avg ?? 'Chưa có'}, Kỹ năng cần hỗ trợ=${s.needSupportCount}, Lỗi chưa sửa=${s.unfixedErrors}`
        )
        .join('\n');

      const prompt = `Tôi là giáo viên môn ${classConfig.subject}, lớp ${classConfig.className} (${classConfig.schoolName}).
Danh sách chủ đề kiến thức hiện tại:
${topicSummary || 'Chưa có chủ đề.'}

Danh sách học sinh đang cần hỗ trợ:
${weakSummary || 'Chưa có học sinh nào nằm trong nhóm yếu hoặc mắc lỗi chưa khắc phục.'}

Hãy đề xuất:
1. Cách phân nhóm bài tập phụ đạo (cơ bản / củng cố / nâng cao) theo đúng kỹ năng còn hổng.
2. 3 dạng câu hỏi kiểm tra nhanh đầu giờ (5 phút) phù hợp thực tế lớp.`;

      const headers = await getAuthBearerHeaders();
      const res = await fetch('/api/gemini/subject-analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không gọi được dịch vụ Gemini AI trên máy chủ.');
      }
      setSubjectAiResult(data.text || '');
      onShowToast(`AI đã hoàn tất gợi ý giảng dạy môn ${classConfig.subject}!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối Gemini AI.';
      onShowToast(msg, 'error');
    } finally {
      setIsRunningSubjectAi(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#102744]">
          Trung tâm Hỗ trợ Học tập Môn {classConfig.subject} — Lớp {classConfig.className}
        </h2>
        <p className="text-sm text-slate-500">
          Theo dõi bảng điểm vnEdu, bản đồ kiến thức từng kỹ năng, kiểm tra nhanh trên lớp và sổ tay khắc phục lỗi sai.
        </p>
      </div>

      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs">
        {subTabs.map((t) => {
          const Icon = t.icon;
          const active = subjectSubTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubjectSubTab(t.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                active ? 'bg-[#0C9BA6] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. OVERVIEW */}
      {subjectSubTab === 'overview' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-[#102744]">
                Bảng điểm Môn {classConfig.subject} — {selectedSemester} ({students.length} HS)
              </h3>
              <span className="text-xs text-slate-500">
                Đồng bộ tự động từ Nhập điểm vnEdu (bao gồm TX1..TX{dynamicOverviewTxOrders[dynamicOverviewTxOrders.length - 1] || 4} & nhận xét)
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <label className="font-bold text-slate-600">Học kỳ:</label>
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value as VneduSemester)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 font-bold text-[#102744] bg-white"
              >
                {VNEDU_SEMESTERS.map((sem) => (
                  <option key={sem} value={sem}>
                    {sem}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase">
                  <th className="py-3 px-4">Mã HS</th>
                  <th className="py-3 px-4">Họ và tên</th>
                  <th className="py-3 px-4">Tổ</th>
                  {dynamicOverviewTxOrders.map((ord) => (
                    <th key={ord} className="py-3 px-3 text-center">
                      TX{ord}
                    </th>
                  ))}
                  <th className="py-3 px-3 text-center">GK</th>
                  <th className="py-3 px-3 text-center">CK</th>
                  <th className="py-3 px-3 text-center">ĐTB / ĐG</th>
                  <th className="py-3 px-4">Ghi chú / Nhận xét</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((st) => {
                  const sc = subjectScores[getVneduScoreDocId(st.code, subjectKey, selectedSemester)];
                  const meta = extractExtraTxFromNote(sc?.note);
                  return (
                    <tr key={st.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-700">{st.code}</td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">{st.fullName}</td>
                      <td className="py-2.5 px-4">Tổ {st.team}</td>
                      {dynamicOverviewTxOrders.map((ord) => {
                        const val =
                          ord === 1 ? sc?.tx1 : ord === 2 ? sc?.tx2 : meta.txMap[ord];
                        return (
                          <td key={ord} className="py-2.5 px-3 text-center">
                            {val ?? '—'}
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-3 text-center">{sc?.gk ?? '—'}</td>
                      <td className="py-2.5 px-3 text-center">{sc?.ck ?? '—'}</td>
                      <td className="py-2.5 px-3 text-center font-extrabold text-[#0C9BA6]">
                        {sc?.avg ?? (meta.qualitativeBadge || '—')}
                        {meta.avgCn !== null && (
                          <div className="text-[10px] font-bold text-indigo-600">CN: {meta.avgCn}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {meta.qualitativeBadge && sc?.avg !== null && sc?.avg !== undefined && (
                          <span className="inline-block px-1.5 py-0.5 mr-1.5 rounded bg-teal-50 text-teal-800 font-bold text-[10px] border border-teal-200">
                            {meta.qualitativeBadge}
                          </span>
                        )}
                        {meta.cleanNote || (!meta.qualitativeBadge ? '—' : '')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. KNOWLEDGE MAP */}
      {subjectSubTab === 'knowledge_map' && (
        <div className="space-y-4">
          {activeRoleId === 'gvcn' && (
            <form
              onSubmit={onAddKnowledgeTopic}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 text-xs"
            >
              <div className="font-bold text-sm text-[#102744]">
                Thêm Chủ đề & Kỹ năng vào Bản đồ Kiến thức ({classConfig.subject})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <select
                  value={newTopicForm.semester}
                  onChange={(e) => setNewTopicForm({ ...newTopicForm, semester: e.target.value })}
                  className="px-3 py-2 rounded-xl border border-slate-300 font-bold"
                >
                  <option value="Học kỳ I">Học kỳ I</option>
                  <option value="Học kỳ II">Học kỳ II</option>
                </select>
                <input
                  type="text"
                  required
                  value={newTopicForm.topicName}
                  onChange={(e) => setNewTopicForm({ ...newTopicForm, topicName: e.target.value })}
                  placeholder="Tên chủ đề / Chương..."
                  className="px-3 py-2 rounded-xl border border-slate-300"
                />
                <input
                  type="text"
                  required
                  value={newTopicForm.skillName}
                  onChange={(e) => setNewTopicForm({ ...newTopicForm, skillName: e.target.value })}
                  placeholder="Dạng bài / Kỹ năng cụ thể..."
                  className="px-3 py-2 rounded-xl border border-slate-300"
                />
                <input
                  type="text"
                  value={newTopicForm.requirement}
                  onChange={(e) => setNewTopicForm({ ...newTopicForm, requirement: e.target.value })}
                  placeholder="Yêu cầu cần đạt..."
                  className="px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 text-white font-bold inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Lưu chủ đề kiến thức</span>
              </button>
            </form>
          )}

          {/* Bộ lọc */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
            <select
              value={kmFilterSemester}
              onChange={(e) => setKmFilterSemester(e.target.value)}
              className="px-2.5 py-2 rounded-xl border border-slate-300"
            >
              <option value="all">Tất cả Học kỳ</option>
              <option value="Học kỳ I">Học kỳ I</option>
              <option value="Học kỳ II">Học kỳ II</option>
            </select>
            <select
              value={kmFilterTopic}
              onChange={(e) => setKmFilterTopic(e.target.value)}
              className="px-2.5 py-2 rounded-xl border border-slate-300"
            >
              <option value="all">Tất cả Chủ đề</option>
              {knowledgeTopics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.skillName}
                </option>
              ))}
            </select>
            <select
              value={kmFilterTeam}
              onChange={(e) => setKmFilterTeam(e.target.value)}
              className="px-2.5 py-2 rounded-xl border border-slate-300"
            >
              <option value="all">Tất cả 4 Tổ</option>
              <option value="1">Tổ 1</option>
              <option value="2">Tổ 2</option>
              <option value="3">Tổ 3</option>
              <option value="4">Tổ 4</option>
            </select>
            <select
              value={kmFilterStudent}
              onChange={(e) => setKmFilterStudent(e.target.value)}
              className="px-2.5 py-2 rounded-xl border border-slate-300"
            >
              <option value="all">Tất cả Học sinh</option>
              {students.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.fullName}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={kmFilterDateFrom}
              onChange={(e) => setKmFilterDateFrom(e.target.value)}
              className="px-2.5 py-2 rounded-xl border border-slate-300"
            />
            <input
              type="date"
              value={kmFilterDateTo}
              onChange={(e) => setKmFilterDateTo(e.target.value)}
              className="px-2.5 py-2 rounded-xl border border-slate-300"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {knowledgeTopics.filter(
              (t) => (kmFilterSemester === 'all' || t.semester === kmFilterSemester) && (kmFilterTopic === 'all' || t.id === kmFilterTopic)
            ).length === 0 ? (
              <div className="md:col-span-2 bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
                Chưa có chủ đề kiến thức nào phù hợp bộ lọc. Hãy thêm chủ đề / kỹ năng mới ở khung phía trên.
              </div>
            ) : (
              knowledgeTopics
                .filter((t) => (kmFilterSemester === 'all' || t.semester === kmFilterSemester) && (kmFilterTopic === 'all' || t.id === kmFilterTopic))
                .map((topic) => {
                  const checks = filteredQuickChecks.filter((c) => c.topicId === topic.id);
                  const mastered = checks.filter((c) => c.level === 'mastered').length;
                  const consolidating = checks.filter((c) => c.level === 'consolidating').length;
                  const needSupport = checks.filter((c) => c.level === 'need_support').length;
                  const isEditingThis = editingTopicId === topic.id;
                  const isConfirmingDelete = confirmDeleteTopicId === topic.id;

                  return (
                    <div key={topic.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5 text-xs">
                      {isEditingThis ? (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const ok = await onUpdateKnowledgeTopic(topic.id, editTopicForm);
                            if (ok) setEditingTopicId(null);
                          }}
                          className="space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-[#102744]">Chỉnh sửa Chủ đề / Kỹ năng</span>
                            <span className="text-slate-400 font-mono">{topic.id}</span>
                          </div>
                          <select
                            value={editTopicForm.semester}
                            onChange={(e) => setEditTopicForm((p) => ({ ...p, semester: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                          >
                            <option value="Học kỳ I">Học kỳ I</option>
                            <option value="Học kỳ II">Học kỳ II</option>
                          </select>
                          <input
                            type="text"
                            required
                            value={editTopicForm.topicName}
                            onChange={(e) => setEditTopicForm((p) => ({ ...p, topicName: e.target.value }))}
                            placeholder="Tên chủ đề / Chương..."
                            className="w-full px-3 py-2 rounded-xl border border-slate-300"
                          />
                          <input
                            type="text"
                            required
                            value={editTopicForm.skillName}
                            onChange={(e) => setEditTopicForm((p) => ({ ...p, skillName: e.target.value }))}
                            placeholder="Dạng bài / Kỹ năng cụ thể..."
                            className="w-full px-3 py-2 rounded-xl border border-slate-300"
                          />
                          <input
                            type="text"
                            value={editTopicForm.requirement}
                            onChange={(e) => setEditTopicForm((p) => ({ ...p, requirement: e.target.value }))}
                            placeholder="Yêu cầu cần đạt..."
                            className="w-full px-3 py-2 rounded-xl border border-slate-300"
                          />
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingTopicId(null)}
                              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                            >
                              Hủy
                            </button>
                            <button
                              type="submit"
                              className="px-3.5 py-1.5 rounded-lg bg-[#0C9BA6] hover:bg-teal-700 text-white font-bold"
                            >
                              Lưu thay đổi
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 font-bold">{topic.semester}</span>
                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                              <span className="text-slate-400 font-mono mr-1">{topic.id}</span>
                              {activeRoleId === 'gvcn' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setConfirmDeleteTopicId(null);
                                      setEditingTopicId(topic.id);
                                      setEditTopicForm({
                                        semester: topic.semester || 'Học kỳ I',
                                        topicName: topic.topicName || '',
                                        skillName: topic.skillName || '',
                                        requirement: topic.requirement || '',
                                      });
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold inline-flex items-center gap-1"
                                    title="Chỉnh sửa chủ đề / kỹ năng"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Sửa</span>
                                  </button>
                                  {isConfirmingDelete ? (
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onDeleteKnowledgeTopic(topic.id, topic.skillName);
                                          setConfirmDeleteTopicId(null);
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold"
                                      >
                                        Xác nhận xóa
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteTopicId(null)}
                                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                                      >
                                        Hủy
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteTopicId(topic.id)}
                                      className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold inline-flex items-center gap-1"
                                      title="Xóa chủ đề / kỹ năng"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>Xóa</span>
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          <div className="font-bold text-sm text-[#102744]">{topic.skillName}</div>
                          <div className="text-slate-500">Chủ đề: {topic.topicName}</div>
                          {topic.requirement && <div className="text-slate-600">{topic.requirement}</div>}
                          <div className="pt-2 border-t border-slate-100 flex items-center gap-3 font-bold">
                            <span className="text-emerald-700">Vững: {mastered}</span>
                            <span className="text-amber-700">Cần củng cố: {consolidating}</span>
                            <span className="text-rose-700">Cần hỗ trợ: {needSupport}</span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* 3. QUICK CHECK */}
      {subjectSubTab === 'quick_check' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-bold text-slate-500 mb-1">Ngày kiểm tra</label>
                <input
                  type="date"
                  value={qcDate}
                  onChange={(e) => setQcDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-500 mb-1">Chủ đề / Kỹ năng đánh giá</label>
                <select
                  value={qcTopicId}
                  onChange={(e) => setQcTopicId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                >
                  <option value="">-- Chọn kỹ năng --</option>
                  {knowledgeTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      [{t.semester}] {t.skillName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1">Hình thức minh chứng</label>
                <select
                  value={qcEvidenceType}
                  onChange={(e) => setQcEvidenceType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                >
                  <option value="Bài tập ngắn">Bài tập ngắn</option>
                  <option value="Kiểm tra 5 phút">Kiểm tra 5 phút</option>
                  <option value="Vấn đáp tại lớp">Vấn đáp tại lớp</option>
                  <option value="Chữa bài bảng">Chữa bài bảng</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={qcFilterTeam}
                  onChange={(e) => setQcFilterTeam(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 font-semibold"
                >
                  <option value="all">Tất cả 4 Tổ</option>
                  <option value="1">Tổ 1</option>
                  <option value="2">Tổ 2</option>
                  <option value="3">Tổ 3</option>
                  <option value="4">Tổ 4</option>
                </select>
                <input
                  type="text"
                  value={qcSearch}
                  onChange={(e) => setQcSearch(e.target.value)}
                  placeholder="Tìm học sinh..."
                  className="px-3 py-1.5 rounded-xl border border-slate-300"
                />
              </div>

              {activeRoleId === 'gvcn' && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onApplyBatchQuickCheckLevel('mastered')}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 font-bold"
                  >
                    Gán Đã vững ({qcSelectedIds.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => onApplyBatchQuickCheckLevel('consolidating')}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-800 font-bold"
                  >
                    Gán Cần củng cố
                  </button>
                  <button
                    type="button"
                    onClick={() => onApplyBatchQuickCheckLevel('need_support')}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-100 text-rose-800 font-bold"
                  >
                    Gán Cần hỗ trợ
                  </button>
                  <button
                    type="button"
                    disabled={isSavingQuickCheck}
                    onClick={onSaveQuickChecks}
                    className="px-4 py-1.5 rounded-lg bg-[#0C9BA6] hover:bg-teal-700 disabled:opacity-50 text-white font-bold"
                  >
                    {isSavingQuickCheck ? 'Đang lưu...' : 'Lưu kết quả kiểm tra'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase">
                  <th className="py-2.5 px-3 w-10">
                    <input
                      type="checkbox"
                      checked={
                        qcFilteredStudents.length > 0 &&
                        qcFilteredStudents.every((s) => qcSelectedIds.includes(s.code))
                      }
                      onChange={(e) => {
                        if (e.target.checked) setQcSelectedIds(qcFilteredStudents.map((s) => s.code));
                        else setQcSelectedIds([]);
                      }}
                    />
                  </th>
                  <th className="py-2.5 px-3">Học sinh</th>
                  <th className="py-2.5 px-3">Mức độ hiểu bài</th>
                  <th className="py-2.5 px-3">Ghi chú nhận xét</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {qcFilteredStudents.map((st) => {
                  const draft = qcDraftMap[st.code] || { level: 'unassessed', note: '' };
                  return (
                    <tr key={st.code}>
                      <td className="py-2.5 px-3">
                        <input
                          type="checkbox"
                          checked={qcSelectedIds.includes(st.code)}
                          onChange={(e) => {
                            if (e.target.checked) setQcSelectedIds((p) => [...p, st.code]);
                            else setQcSelectedIds((p) => p.filter((c) => c !== st.code));
                          }}
                        />
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {st.fullName} <span className="text-slate-400 font-mono">({st.code} - Tổ {st.team})</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {(
                            [
                              { id: 'mastered', label: 'Đã vững', cls: 'bg-emerald-600 text-white' },
                              { id: 'consolidating', label: 'Cần củng cố', cls: 'bg-amber-500 text-white' },
                              { id: 'need_support', label: 'Cần hỗ trợ', cls: 'bg-rose-600 text-white' },
                            ] as const
                          ).map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              disabled={activeRoleId !== 'gvcn'}
                              onClick={() =>
                                setQcDraftMap((p) => ({
                                  ...p,
                                  [st.code]: { ...(p[st.code] || {}), level: opt.id },
                                }))
                              }
                              className={`px-2.5 py-1 rounded-lg font-bold ${
                                draft.level === opt.id ? opt.cls : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          disabled={activeRoleId !== 'gvcn'}
                          value={draft.note || ''}
                          onChange={(e) =>
                            setQcDraftMap((p) => ({
                              ...p,
                              [st.code]: { ...(p[st.code] || {}), note: e.target.value },
                            }))
                          }
                          placeholder="Ghi chú nhanh..."
                          className="w-full px-2.5 py-1 rounded-lg border border-slate-200"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. ERROR LOG */}
      {subjectSubTab === 'error_log' && (
        <div className="space-y-4">
          {activeRoleId === 'gvcn' && (
            <form
              onSubmit={onSaveErrorLogs}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 text-xs"
            >
              <div className="font-bold text-sm text-[#102744]">Ghi nhận Sổ tay Lỗi sai Cần khắc phục</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="date"
                  value={errDate}
                  onChange={(e) => setErrDate(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-300"
                />
                <select
                  value={errTopicId}
                  onChange={(e) => setErrTopicId(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                >
                  <option value="">-- Chọn chủ đề liên quan --</option>
                  {knowledgeTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.skillName}
                    </option>
                  ))}
                </select>
                <select
                  value={errCategory}
                  onChange={(e) => setErrCategory(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                >
                  {DEFAULT_ERROR_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {errCategory === 'Lỗi khác do giáo viên nhập' && (
                <input
                  type="text"
                  value={errCustomCategory}
                  onChange={(e) => setErrCustomCategory(e.target.value)}
                  placeholder="Nhập tên loại lỗi cụ thể..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={errNote}
                  onChange={(e) => setErrNote(e.target.value)}
                  placeholder="Chi tiết lỗi thường gặp..."
                  className="px-3 py-2 rounded-xl border border-slate-300"
                />
                <input
                  type="text"
                  value={errRemedy}
                  onChange={(e) => setErrRemedy(e.target.value)}
                  placeholder="Hướng dẫn / Bài tập khắc phục..."
                  className="px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <div className="font-bold text-slate-600 mb-1.5">
                  Chọn học sinh mắc lỗi ({errSelectedStudentCodes.length} đã chọn):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {students.map((st) => {
                    const selected = errSelectedStudentCodes.includes(st.code);
                    return (
                      <button
                        key={st.code}
                        type="button"
                        onClick={() =>
                          setErrSelectedStudentCodes((prev) =>
                            selected ? prev.filter((c) => c !== st.code) : [...prev, st.code]
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg font-semibold border ${
                          selected
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {st.fullName}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingErrorLog}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold"
              >
                {isSavingErrorLog ? 'Đang lưu...' : 'Ghi nhận lỗi vào Sổ tay'}
              </button>
            </form>
          )}

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-2 text-xs">
            <select
              value={errFilterStudent}
              onChange={(e) => setErrFilterStudent(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300"
            >
              <option value="all">Tất cả học sinh</option>
              {students.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.fullName}
                </option>
              ))}
            </select>
            <select
              value={errFilterStatus}
              onChange={(e) => setErrFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="unfixed">Chưa sửa</option>
              <option value="fixed">Đã khắc phục</option>
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 text-xs">
            {filteredErrorLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-500">Chưa có lỗi sai nào được ghi nhận.</div>
            ) : (
              filteredErrorLogs.map((item) => (
                <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{item.studentName}</span>
                      <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 font-bold">
                        {item.errorCategory}
                      </span>
                      <span className="text-slate-400">{item.date}</span>
                    </div>
                    <div className="text-slate-600">
                      Kỹ năng: <strong>{item.skillName}</strong>
                      {item.note ? ` — ${item.note}` : ''}
                    </div>
                    {item.remedy && <div className="text-teal-700">Hướng khắc phục: {item.remedy}</div>}
                  </div>
                  <button
                    type="button"
                    disabled={activeRoleId !== 'gvcn'}
                    onClick={() => onToggleErrorFixedStatus(item)}
                    className={`px-3 py-1.5 rounded-xl font-bold shrink-0 flex items-center gap-1 ${
                      item.status === 'fixed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{item.status === 'fixed' ? `Đã sửa (${item.fixedAt || ''})` : 'Đánh dấu đã sửa'}</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 5. SUPPORT PLAN */}
      {subjectSubTab === 'support_plan' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-[#102744]">
            Nhóm Học sinh Cần Lập Kế hoạch Phụ đạo ({supportStudents.length})
          </h3>
          {supportStudents.length === 0 ? (
            <p className="text-xs text-slate-500">
              Hiện chưa có học sinh nào có ĐTB dưới 6.5, mức kiểm tra nhanh cần hỗ trợ hoặc lỗi chưa khắc phục.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {supportStudents.map((s) => (
                <div key={s.student.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-900">
                      {s.student.fullName} (Tổ {s.student.team})
                    </div>
                    <div className="text-slate-600">
                      ĐTB {classConfig.subject}: <strong>{s.avg ?? 'Chưa có'}</strong> • Cần hỗ trợ KT nhanh:{' '}
                      <strong>{s.needSupportCount}</strong> • Lỗi chưa sửa: <strong>{s.unfixedErrors}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateToParentComm(s.student.id)}
                    className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold"
                  >
                    Trao đổi Phụ huynh
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. PROGRESS */}
      {subjectSubTab === 'progress' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-[#102744]">Theo dõi Tiến bộ Qua Kiểm tra nhanh & Sửa lỗi</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase">
                  <th className="py-2.5 px-3">Học sinh</th>
                  <th className="py-2.5 px-3">Số lượt Đã vững</th>
                  <th className="py-2.5 px-3">Số lượt Cần củng cố</th>
                  <th className="py-2.5 px-3">Lỗi đã khắc phục / Tổng lỗi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((st) => {
                  const stChecks = quickChecks.filter((q) => q.studentCode === st.code);
                  const stErrs = errorLogs.filter((e) => e.studentCode === st.code);
                  const fixed = stErrs.filter((e) => e.status === 'fixed').length;
                  return (
                    <tr key={st.id}>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{st.fullName}</td>
                      <td className="py-2.5 px-3 font-bold text-emerald-700">
                        {stChecks.filter((c) => c.level === 'mastered').length}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-amber-700">
                        {stChecks.filter((c) => c.level === 'consolidating').length}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {fixed} / {stErrs.length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. PRAISE */}
      {subjectSubTab === 'praise' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-[#102744]">
            Danh sách Học sinh Tiêu biểu & Khắc phục lỗi tốt ({praiseStudents.length})
          </h3>
          {praiseStudents.length === 0 ? (
            <p className="text-xs text-slate-500">Chưa có dữ liệu học sinh nổi bật trong môn {classConfig.subject}.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {praiseStudents.map((item) => (
                <div
                  key={item.student.id}
                  className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-bold text-emerald-950">{item.student.fullName}</div>
                    <div className="text-emerald-800">
                      ĐTB: {item.avg ?? '—'} • Đã vững: {item.masteredCount} • Đã sửa lỗi: {item.fixedCount}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateToParentComm(item.student.id)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  >
                    Gửi lời khen PH
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 8. SUBJECT AI */}
      {subjectSubTab === 'subject_ai' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-[#102744]">
                Trợ lý AI Gợi ý Phân nhóm Bài tập & Phụ đạo Môn {classConfig.subject}
              </h3>
              <p className="text-xs text-slate-500">
                Tổng hợp từ Bản đồ kiến thức, kết quả kiểm tra nhanh và Sổ tay lỗi sai thực tế.
              </p>
            </div>
            <button
              type="button"
              disabled={isRunningSubjectAi}
              onClick={handleRunSubjectAi}
              className="px-4 py-2 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
            >
              {isRunningSubjectAi ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{isRunningSubjectAi ? 'Đang tạo gợi ý...' : 'Tạo gợi ý bài tập bằng AI'}</span>
            </button>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 min-h-[160px] whitespace-pre-wrap text-sm text-slate-800">
            {subjectAiResult || 'Bấm nút "Tạo gợi ý bài tập bằng AI" để nhận phương án phụ đạo cá nhân hóa.'}
          </div>
        </div>
      )}
    </div>
  );
}
