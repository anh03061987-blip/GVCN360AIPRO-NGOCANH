import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithCustomToken, 
  signInAnonymously, 
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  serverTimestamp,
  getDoc,
  runTransaction
} from 'firebase/firestore';
import { 
  LayoutDashboard, 
  Users, 
  ShieldCheck, 
  FilePlus2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Settings, 
  School, 
  UserCheck, 
  Sparkles, 
  AlertCircle, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  LogOut, 
  Menu, 
  X, 
  ChevronRight,
  Award,
  BookOpen,
  DollarSign,
  Calendar,
  Activity,
  Lock,
  Check,
  History,
  Upload,
  FileSpreadsheet,
  ClipboardCheck,
  Flag,
  CheckSquare,
  AlertTriangle,
  ArrowRight,
  Download,
  GraduationCap,
  MessageSquareHeart,
  FileBarChart2,
  Copy,
  Send,
  Bot,
  RefreshCw,
  Trophy,
  Printer,
  Layers,
  TrendingUp,
  Sliders,
  FileCheck2,
  RotateCcw,
  EyeOff,
  Scale,
  ListChecks
} from 'lucide-react';

// ============================================================================
// 1. KHỞI TẠO FIREBASE AN TOÀN & TUÂN THỦ QUY TẮC MÔI TRƯỜNG
// ============================================================================
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'gvcn-360-ai-pro-default';

let app = null;
let auth = null;
let db = null;

if (firebaseConfig) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

// ============================================================================
// 2. ĐỊNH NGHĨA VAI TRÒ & PHÂN QUYỀN (8 VỊ TRÍ VẬN HÀNH CHUẨN)
// ============================================================================
const ROLES = [
  { 
    id: 'gvcn', 
    title: 'Giáo viên chủ nhiệm', 
    badgeColor: 'bg-indigo-900 text-white',
    scope: 'Toàn quyền quản trị lớp, phê duyệt phiếu, cấu hình năm học & AI',
    canApprove: true,
    allowedTicketTypes: ['diem_danh', 'ne_nep', 'thu_chi', 'chi_doan', 'hoc_tap']
  },
  { 
    id: 'lop_truong', 
    title: 'Lớp trưởng', 
    badgeColor: 'bg-teal-700 text-white',
    scope: 'Điểm danh toàn lớp, theo dõi sĩ số, tổng hợp nề nếp chung',
    canApprove: false,
    allowedTicketTypes: ['diem_danh', 'ne_nep']
  },
  { 
    id: 'to_truong_1', 
    title: 'Tổ trưởng Tổ 1', 
    badgeColor: 'bg-sky-700 text-white',
    scope: 'Ghi nhận điểm danh, thi đua, vi phạm/tuyên dương của Tổ 1',
    team: 1,
    canApprove: false,
    allowedTicketTypes: ['diem_danh', 'ne_nep']
  },
  { 
    id: 'to_truong_2', 
    title: 'Tổ trưởng Tổ 2', 
    badgeColor: 'bg-sky-700 text-white',
    scope: 'Ghi nhận điểm danh, thi đua, vi phạm/tuyên dương của Tổ 2',
    team: 2,
    canApprove: false,
    allowedTicketTypes: ['diem_danh', 'ne_nep']
  },
  { 
    id: 'to_truong_3', 
    title: 'Tổ trưởng Tổ 3', 
    badgeColor: 'bg-sky-700 text-white',
    scope: 'Ghi nhận điểm danh, thi đua, vi phạm/tuyên dương của Tổ 3',
    team: 3,
    canApprove: false,
    allowedTicketTypes: ['diem_danh', 'ne_nep']
  },
  { 
    id: 'to_truong_4', 
    title: 'Tổ trưởng Tổ 4', 
    badgeColor: 'bg-sky-700 text-white',
    scope: 'Ghi nhận điểm danh, thi đua, vi phạm/tuyên dương của Tổ 4',
    team: 4,
    canApprove: false,
    allowedTicketTypes: ['diem_danh', 'ne_nep']
  },
  { 
    id: 'thu_quy', 
    title: 'Thủ quỹ lớp', 
    badgeColor: 'bg-amber-700 text-white',
    scope: 'Lập phiếu thu/chi quỹ lớp, đề xuất quyết toán minh bạch',
    canApprove: false,
    allowedTicketTypes: ['thu_chi']
  },
  { 
    id: 'bi_thu', 
    title: 'Bí thư Chi đoàn', 
    badgeColor: 'bg-rose-700 text-white',
    scope: 'Đề xuất phong trào Đoàn, hoạt động ngoại khóa, rèn luyện đoàn viên',
    canApprove: false,
    allowedTicketTypes: ['chi_doan', 'ne_nep']
  }
];

const TICKET_TYPES = {
  diem_danh: { label: 'Phiếu Điểm danh', icon: UserCheck, color: 'text-blue-700 bg-blue-50 border-blue-200' },
  ne_nep: { label: 'Phiếu Thi đua / Vi phạm (A/B/C)', icon: Award, color: 'text-teal-700 bg-teal-50 border-teal-200' },
  thu_chi: { label: 'Phiếu Thu / Chi Quỹ lớp', icon: DollarSign, color: 'text-amber-700 bg-amber-50 border-amber-200' },
  chi_doan: { label: 'Hoạt động Chi đoàn', icon: Activity, color: 'text-rose-700 bg-rose-50 border-rose-200' },
  hoc_tap: { label: 'Ghi nhận Học tập', icon: BookOpen, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' }
};

// ============================================================================
// BỘ TIÊU CHUẨN ĐÁNH GIÁ THI ĐUA CHUẨN THEO TÀI LIỆU "TIÊU CHUẨN THI ĐUA.DOCX"
// ============================================================================
const DEFAULT_EMULATION_STANDARDS = {
  gradeA: [
    {
      id: 'A1',
      title: 'Không vi phạm nội quy, có phát biểu ít nhất 1 lần / có tham gia đầy đủ, tích cực các hoạt động nhóm.',
      requiresEvidence: true
    },
    {
      id: 'A2',
      title: 'Có vi phạm ở mức xếp loại B nhưng đã kịp thời khắc phục, đồng thời cũng có hoạt động đóng góp, xây dựng tập thể lớp, trường.',
      requiresEvidence: true
    }
  ],
  gradeB: [
    { id: 'B01', text: 'Nói chuyện, làm việc riêng, mất trật tự đã được nhắc nhở 1 lần vẫn tiếp tục vi phạm', conditional: true, conditionNote: 'Cần xác minh đã nhắc nhở 1 lần trước đó' },
    { id: 'B02', text: 'Không thuộc bài', conditional: false },
    { id: 'B03', text: 'Không làm bài', conditional: false },
    { id: 'B04', text: 'Không chép bài', conditional: false },
    { id: 'B05', text: 'Đi trễ', conditional: false },
    { id: 'B06', text: 'Đổi chỗ ngồi', conditional: false },
    { id: 'B07', text: 'Không nghiêm túc khi sinh hoạt dưới cờ', conditional: false },
    { id: 'B08', text: 'Đầu tóc không đúng quy định', conditional: false },
    { id: 'B09', text: 'Sinh hoạt 15 phút đầu giờ ồn', conditional: false },
    { id: 'B10', text: 'Trực nhật lớp không sạch', conditional: false },
    { id: 'B11', text: 'Xả rác, bỏ rác trong hộc bàn', conditional: false },
    { id: 'B12', text: 'Không lấy ghế, cất ghế khi sinh hoạt dưới cờ', conditional: false },
    { id: 'B13', text: 'Không tắt điện, quạt khi rời khỏi phòng', conditional: false },
    { id: 'B14', text: 'Tập trung ngoài nhà xe', conditional: false },
    { id: 'B15', text: 'Đồng phục không đúng quy định', conditional: false },
    { id: 'B16', text: 'Không dây nịt, không bảng tên, mang bảng tên không đúng, không huy hiệu', conditional: false },
    { id: 'B17', text: 'Mang dép lê, Cross', conditional: false },
    { id: 'B18', text: 'Trang điểm, son môi, làm móng tay, móng chân', conditional: false },
    { id: 'B19', text: 'Đeo khoen tai đối với nam, đeo nhiều khoen tai đối với nữ', conditional: false },
    { id: 'B20', text: 'Tùy tiện đổi nhiệm vụ giáo viên đã giao', conditional: false }
  ],
  gradeC: [
    { id: 'C01', text: 'Vắng không phép', conditional: false },
    { id: 'C02', text: 'Đi trễ không trình diện quản sinh', conditional: false },
    { id: 'C03', text: 'Mang điện thoại vào trường', conditional: false },
    { id: 'C04', text: 'Không thực hiện nhiệm vụ Thầy, Cô, Ban cán sự lớp giao', conditional: false },
    { id: 'C05', text: 'Nói tục, chửi thề', conditional: false },
    { id: 'C06', text: 'Mang đồ ăn, thức uống lên phòng học', conditional: false },
    { id: 'C07', text: 'Lừa dối giáo viên', conditional: false }
  ],
  severeSemesterFail: [
    { id: 'S01', text: 'Đánh nhau', repeatRequired: false },
    { id: 'S02', text: 'Vi phạm an toàn giao thông', repeatRequired: false },
    { id: 'S03', text: 'Quay tài liệu', repeatRequired: false },
    { id: 'S04', text: 'Sử dụng điện thoại trong giờ học, giờ sinh hoạt chung lần 2', repeatRequired: true, conditionNote: 'Kiểm tra lịch sử lần 1 đã xác nhận' },
    { id: 'S05', text: 'Trốn tiết lần 2', repeatRequired: true, conditionNote: 'Kiểm tra lịch sử lần 1 đã xác nhận' },
    { id: 'S06', text: 'Mang vật dụng trái phép vào trường', repeatRequired: false },
    { id: 'S07', text: 'Phá hoại tài sản nhà trường', repeatRequired: false },
    { id: 'S08', text: 'Vô lễ với Thầy, Cô', repeatRequired: false },
    { id: 'S09', text: 'Phát ngôn sai trên mạng xã hội, sử dụng mạng xã hội gây ảnh hưởng xấu đến người khác', repeatRequired: false }
  ],
  semesterRules: {
    cToBWeight: 2,
    totMaxB: 4,
    khaMinB: 5,
    khaMaxB: 8,
    datMinB: 9,
    datMaxB: 12,
    minWeeksRequired: 12
  }
};

// Dữ liệu học sinh mẫu ban đầu để GVCN khởi tạo nhanh 1 chạm vào Firestore
const INITIAL_SAMPLE_STUDENTS = [
  { code: 'HS001', fullName: 'Nguyễn Minh Anh', gender: 'Nữ', dob: '2009-03-15', team: 1, role: 'lop_truong', parentPhone: '0912345601', note: 'Gương mẫu, học giỏi Toán' },
  { code: 'HS002', fullName: 'Trần Hoàng Bảo', gender: 'Nam', dob: '2009-07-22', team: 1, role: 'to_truong_1', parentPhone: '0912345602', note: 'Nhiệt tình, năng nổ' },
  { code: 'HS003', fullName: 'Lê Thị Thu Hà', gender: 'Nữ', dob: '2009-11-08', team: 2, role: 'to_truong_2', parentPhone: '0912345603', note: 'Cẩn thận, trách nhiệm cao' },
  { code: 'HS004', fullName: 'Phạm Quốc Khánh', gender: 'Nam', dob: '2009-09-02', team: 2, role: 'bi_thu', parentPhone: '0912345604', note: 'Năng khiếu văn nghệ, phong trào' },
  { code: 'HS005', fullName: 'Võ Ngọc Lan', gender: 'Nữ', dob: '2009-05-19', team: 3, role: 'thu_quy', parentPhone: '0912345605', note: 'Trung thực, tính toán chính xác' },
  { code: 'HS006', fullName: 'Đặng Tuấn Kiệt', gender: 'Nam', dob: '2009-01-30', team: 3, role: 'to_truong_3', parentPhone: '0912345606', note: 'Hòa đồng, hay giúp đỡ bạn' },
  { code: 'HS007', fullName: 'Huỳnh Thảo Vy', gender: 'Nữ', dob: '2009-12-12', team: 4, role: 'to_truong_4', parentPhone: '0912345607', note: 'Chăm chỉ, chữ viết đẹp' },
  { code: 'HS008', fullName: 'Bùi Đức Trọng', gender: 'Nam', dob: '2009-04-10', team: 4, role: 'member', parentPhone: '0912345608', note: 'Cần lưu ý đi học đúng giờ' }
];

// Dữ liệu CSV mẫu chuẩn vnEdu để kiểm thử nhanh tính năng ánh xạ cột & nhập điểm
const SAMPLE_VNEDU_CSV = `STT,Ma_HS,Ho_Va_Ten,Diem_TX1,Diem_TX2,Diem_GK,Diem_CK,Ghi_Chu
1,HS001,Nguyễn Minh Anh,9.0,9.5,9.0,9.5,Tư duy tốt
2,HS002,Trần Hoàng Bảo,8.0,8.5,8.0,8.5,Tiến bộ rõ rệt
3,HS003,Lê Thị Thu Hà,8.5,9.0,8.5,9.0,Chăm chỉ
4,HS004,Phạm Quốc Khánh,7.0,7.5,7.0,7.5,Cần luyện thêm hình học
5,HS005,Võ Ngọc Lan,8.5,8.0,8.5,9.0,Nắm chắc kiến thức
6,HS006,Đặng Tuấn Kiệt,6.5,7.0,6.5,7.0,Cần tập trung hơn
7,HS007,Huỳnh Thảo Vy,9.0,9.0,8.5,9.0,Xuất sắc
8,HS008,Bùi Đức Trọng,5.5,6.0,5.0,6.0,Cần phụ đạo thêm`;

// ============================================================================
// 3. COMPONENT CHÍNH CỦA ỨNG DỤNG
// ============================================================================
export default function App() {
  // Trạng thái xác thực Firebase
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  // Trạng thái điều hướng & giao diện
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // Vai trò vận hành hiện tại của người dùng trong phiên (để kiểm thử 8 vị trí hoặc gắn với tài khoản)
  const [activeRoleId, setActiveRoleId] = useState('gvcn');

  // Dữ liệu cấu hình lớp học (lưu trên Firestore)
  const [classConfig, setClassConfig] = useState({
    teacherName: 'Ngọc Ánh',
    subject: 'Toán',
    schoolName: 'THPT Hòa Đa',
    className: '12D6',
    schoolYear: '2026–2027',
    fundBalance: 0,
    updatedAt: null
  });
  const [savedWorkspaces, setSavedWorkspaces] = useState([]);
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [configForm, setConfigForm] = useState(classConfig);

  // Dữ liệu thời gian thực từ Firestore
  const [students, setStudents] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [plans, setPlans] = useState([]);
  const [youthActivities, setYouthActivities] = useState([]);
  const [subjectScores, setSubjectScores] = useState({});
  const [vneduImportHistory, setVneduImportHistory] = useState([]);
  const [grade12Profiles, setGrade12Profiles] = useState({});

  // State Nâng Cấp Phân Hệ Thi Đua A/B/C (Tuân thủ 100% Tiêu chuẩn thi đua.docx)
  const [emulationStandards, setEmulationStandards] = useState(DEFAULT_EMULATION_STANDARDS);
  const [selectedEmulationWeek, setSelectedEmulationWeek] = useState('Tuần 1');
  const [selectedEmulationMonth, setSelectedEmulationMonth] = useState('Tháng 9');
  const [selectedEmulationSemester, setSelectedEmulationSemester] = useState('Học kỳ I');
  const [weeklyEmulationDrafts, setWeeklyEmulationDrafts] = useState({});
  const [weeklySnapshots, setWeeklySnapshots] = useState([]);
  const [emulationAdjustLogs, setEmulationAdjustLogs] = useState([]);
  const [isLockingWeek, setIsLockingWeek] = useState(false);
  const [adjustModalData, setAdjustModalData] = useState(null);
  const [adjustNewRank, setAdjustNewRank] = useState('A');
  const [adjustReason, setAdjustReason] = useState('');
  const [newCriterionText, setNewCriterionText] = useState('');
  const [newCriterionGroup, setNewCriterionGroup] = useState('gradeB');
  const [teamBonusRule, setTeamBonusRule] = useState({ enabled: false, ruleNote: 'GVCN chưa ban hành thang điểm quy đổi riêng cho tổ — chỉ thống kê tỷ lệ đạt A, B, C theo văn bản chuẩn.' });

  // Trạng thái bộ lọc & Form
  const [searchStudent, setSearchStudent] = useState('');
  const [filterTeam, setFilterTeam] = useState('all');
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [studentForm, setStudentForm] = useState({
    code: '', fullName: '', gender: 'Nữ', dob: '', team: 1, role: 'member', parentPhone: '', note: ''
  });
  const [showBulkStudentModal, setShowBulkStudentModal] = useState(false);
  const [bulkStudentText, setBulkStudentText] = useState('');
  const [bulkPreviewList, setBulkPreviewList] = useState([]);
  const [isSavingBulkStudents, setIsSavingBulkStudents] = useState(false);

  // Form gửi phiếu đề xuất (Cán bộ lớp / GVCN)
  const [ticketForm, setTicketForm] = useState({
    type: 'ne_nep',
    studentId: '',
    category: 'Tuyên dương',
    emulationGroup: 'gradeA',
    criterionId: 'A1',
    secondCriterionId: '',
    isSimultaneousB: false,
    remindedBefore: false,
    evidence: '',
    weekLabel: 'Tuần 1',
    points: 0,
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    description: ''
  });
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [processingTicketId, setProcessingTicketId] = useState(null);

  // State Phần A: Duyệt phiếu hàng loạt an toàn & idempotent tại Trung tâm kiểm duyệt
  const [modFilterType, setModFilterType] = useState('all');
  const [modFilterStatus, setModFilterStatus] = useState('pending');
  const [selectedTicketIds, setSelectedTicketIds] = useState([]);
  const [batchConfirmModal, setBatchConfirmModal] = useState(null); // { mode: 'selected' | 'all_eligible', eligibleTickets: [], excludedTickets: [], snapshotVersions: {} }
  const [isBatchApproving, setIsBatchApproving] = useState(false);
  const [batchApprovalReport, setBatchApprovalReport] = useState(null);

  // State Giai đoạn 2: Điểm danh hằng ngày
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceSession, setAttendanceSession] = useState('Sáng');
  const [dailyAttendanceDraft, setDailyAttendanceDraft] = useState({});
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);

  // State Giai đoạn 2: Kế hoạch chủ nhiệm & Hoạt động Chi đoàn
  const [planForm, setPlanForm] = useState({ week: 'Tuần 12', title: '', targetDate: new Date().toISOString().split('T')[0], content: '', status: 'Đang thực hiện' });
  const [youthForm, setYouthForm] = useState({ title: '', date: new Date().toISOString().split('T')[0], participantCount: 0, description: '', status: 'Sắp diễn ra' });

  // State Giai đoạn 2: Nhập bảng điểm vnEdu (Xem trước, Ánh xạ cột, Kiểm tra lỗi)
  const [vneduRawText, setVneduRawText] = useState('');
  const [vneduHeaders, setVneduHeaders] = useState([]);
  const [vneduRows, setVneduRows] = useState([]);
  const [columnMapping, setColumnMapping] = useState({
    code: '',
    fullName: '',
    tx1: '',
    tx2: '',
    gk: '',
    ck: '',
    note: ''
  });
  const [vneduPreviewData, setVneduPreviewData] = useState([]);
  const [vneduErrors, setVneduErrors] = useState([]);
  const [isImportingVnedu, setIsImportingVnedu] = useState(false);
  const [isReadingExcel, setIsReadingExcel] = useState(false);

  // State Giai đoạn 3: Theo dõi học tập lớp 12
  const [editingGrade12Student, setEditingGrade12Student] = useState(null);
  const [grade12Form, setGrade12Form] = useState({
    examBlock: 'A00 (Toán - Lý - Hóa)',
    targetUniversity: '',
    targetMajor: '',
    mockScore1: '',
    mockScore2: '',
    readiness: 'Đạt mục tiêu',
    teacherNote: ''
  });

  // State Giai đoạn 3: Phân tích học tập bằng Gemini AI (chỉ dùng dữ liệu đã xác nhận)
  const [aiAnalysisResult, setAiAnalysisResult] = useState('');
  const [isGeneratingAiAnalysis, setIsGeneratingAiAnalysis] = useState(false);
  const [aiAnalysisScope, setAiAnalysisScope] = useState('all');

  // State Giai đoạn 3: Soạn nhận xét & Tin nhắn phụ huynh
  const [selectedCommStudentId, setSelectedCommStudentId] = useState('');
  const [commPurpose, setCommPurpose] = useState('praise');
  const [commTone, setCommTone] = useState('warm');
  const [commExtraContext, setCommExtraContext] = useState('');
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [generatedReportCardDraft, setGeneratedReportCardDraft] = useState('');
  const [isGeneratingComm, setIsGeneratingComm] = useState(false);

  // ==========================================================================
  // STATE NÂNG CẤP TRANG "MÔN TÔI GIẢNG DẠY" (TRUNG TÂM HỖ TRỢ HỌC TẬP)
  // ==========================================================================
  const [subjectSubTab, setSubjectSubTab] = useState('overview'); // overview | knowledge_map | quick_check | error_log | support_plan | progress | praise | subject_ai
  const [knowledgeTopics, setKnowledgeTopics] = useState([]);
  const [quickChecks, setQuickChecks] = useState([]);
  const [errorLogs, setErrorLogs] = useState([]);

  // Bộ lọc Bản đồ kiến thức
  const [kmFilterTeam, setKmFilterTeam] = useState('all');
  const [kmFilterStudent, setKmFilterStudent] = useState('all');
  const [kmFilterTopic, setKmFilterTopic] = useState('all');
  const [kmFilterSemester, setKmFilterSemester] = useState('all');
  const [kmFilterDateFrom, setKmFilterDateFrom] = useState('');
  const [kmFilterDateTo, setKmFilterDateTo] = useState('');

  // Form cấu hình Chủ đề / Dạng bài mới
  const [newTopicForm, setNewTopicForm] = useState({
    semester: 'Học kỳ I',
    topicName: '',
    skillName: '',
    requirement: ''
  });

  // State Kiểm tra nhanh mức độ hiểu bài (Tối ưu thao tác hàng loạt)
  const [qcDate, setQcDate] = useState(new Date().toISOString().split('T')[0]);
  const [qcTopicId, setQcTopicId] = useState('');
  const [qcEvidenceType, setQcEvidenceType] = useState('Bài tập ngắn');
  const [qcFilterTeam, setQcFilterTeam] = useState('all');
  const [qcSearch, setQcSearch] = useState('');
  const [qcSelectedIds, setQcSelectedIds] = useState([]);
  const [qcDraftMap, setQcDraftMap] = useState({}); // { [studentCode]: { level: 'mastered' | 'consolidating' | 'need_support' | 'unassessed', note: '' } }
  const [isSavingQuickCheck, setIsSavingQuickCheck] = useState(false);

  // State Sổ tay lỗi sai (Ghi nhận 1 lỗi cho nhiều học sinh hoặc nhiều lỗi cho 1 HS)
  const DEFAULT_ERROR_CATEGORIES = [
    'Chưa hiểu khái niệm',
    'Nhầm công thức',
    'Sai điều kiện áp dụng',
    'Sai biến đổi hoặc tính toán',
    'Chưa chọn được phương pháp',
    'Đọc thiếu dữ kiện',
    'Lập luận hoặc trình bày chưa chính xác',
    'Lỗi khác do giáo viên nhập'
  ];
  const [errDate, setErrDate] = useState(new Date().toISOString().split('T')[0]);
  const [errTopicId, setErrTopicId] = useState('');
  const [errCategory, setErrCategory] = useState('Chưa hiểu khái niệm');
  const [errCustomCategory, setErrCustomCategory] = useState('');
  const [errNote, setErrNote] = useState('');
  const [errRemedy, setErrRemedy] = useState('');
  const [errSelectedStudentCodes, setErrSelectedStudentCodes] = useState([]);
  const [errFilterStudent, setErrFilterStudent] = useState('all');
  const [errFilterStatus, setErrFilterStatus] = useState('all');
  const [isSavingErrorLog, setIsSavingErrorLog] = useState(false);

  // Hiển thị thông báo nhanh (thay thế hoàn toàn alert/confirm)
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ==========================================================================
  // 4. KẾT NỐI FIREBASE AUTHENTICATION THỰC TẾ
  // ==========================================================================
  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      setAuthError('Chưa phát hiện cấu hình Firebase trong môi trường.');
      return;
    }

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error('Lỗi xác thực Firebase:', err);
        setAuthError(err.message || 'Không thể kết nối Firebase Authentication.');
      }
    };

    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ==========================================================================
  // 5. ĐỒNG BỘ DỮ LIỆU THỜI GIAN THỰC TỪ CLOUD FIRESTORE
  // ==========================================================================
  // Định danh lớp học độc lập theo cấu trúc đa trường / đa lớp / đa năm học
  const classWorkspaceId = useMemo(() => {
    const safeSchool = (classConfig.schoolName || 'thpt_hoa_da').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const safeClass = (classConfig.className || '12d6').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const safeYear = (classConfig.schoolYear || '2026_2027').replace(/[^0-9]/g, '_');
    return `${safeSchool}_${safeClass}_${safeYear}`;
  }, [classConfig.schoolName, classConfig.className, classConfig.schoolYear]);

  useEffect(() => {
    if (!db || !user) return;

    // 5.1 Lắng nghe cấu hình lớp học chính
    const configDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'class_configs', 'active_workspace');
    const unsubConfig = onSnapshot(
      configDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setClassConfig(prev => ({ ...prev, ...data }));
          setConfigForm(prev => ({ ...prev, ...data }));
        } else {
          // Khởi tạo cấu hình mặc định lần đầu vào Firestore
          setDoc(configDocRef, {
            teacherName: 'Ngọc Ánh',
            subject: 'Toán',
            schoolName: 'THPT Hòa Đa',
            className: '12D6',
            schoolYear: '2026–2027',
            fundBalance: 0,
            ownerUid: user.uid,
            updatedAt: serverTimestamp()
          }).catch(() => {});
        }
      },
      (err) => console.error('Lỗi tải cấu hình lớp:', err)
    );

    // 5.2 Lắng nghe danh sách học sinh của lớp hiện tại
    const studentsColRef = collection(db, 'artifacts', appId, 'public', 'data', `students_${classWorkspaceId}`);
    const unsubStudents = onSnapshot(
      studentsColRef,
      (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
        setStudents(list);
      },
      (err) => console.error('Lỗi tải danh sách học sinh:', err)
    );

    // 5.3 Lắng nghe danh sách phiếu đề xuất (Chờ duyệt / Đã duyệt / Từ chối)
    const ticketsColRef = collection(db, 'artifacts', appId, 'public', 'data', `tickets_${classWorkspaceId}`);
    const unsubTickets = onSnapshot(
      ticketsColRef,
      (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
        setTickets(list);
      },
      (err) => console.error('Lỗi tải phiếu đề xuất:', err)
    );

    // 5.4 Lắng nghe lịch sử kiểm duyệt & biến động dữ liệu
    const logsColRef = collection(db, 'artifacts', appId, 'public', 'data', `audit_logs_${classWorkspaceId}`);
    const unsubLogs = onSnapshot(
      logsColRef,
      (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0));
        setAuditLogs(list);
      },
      (err) => console.error('Lỗi tải nhật ký hệ thống:', err)
    );

    // 5.5 Lắng nghe dữ liệu Điểm danh chính thức
    const attColRef = collection(db, 'artifacts', appId, 'public', 'data', `attendance_${classWorkspaceId}`);
    const unsubAttendance = onSnapshot(
      attColRef,
      (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        setAttendanceRecords(list);
      },
      (err) => console.error('Lỗi tải dữ liệu điểm danh:', err)
    );

    // 5.6 Lắng nghe Kế hoạch chủ nhiệm
    const plansColRef = collection(db, 'artifacts', appId, 'public', 'data', `plans_${classWorkspaceId}`);
    const unsubPlans = onSnapshot(
      plansColRef,
      (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
        setPlans(list);
      },
      (err) => console.error('Lỗi tải kế hoạch chủ nhiệm:', err)
    );

    // 5.7 Lắng nghe Hoạt động Chi đoàn
    const youthColRef = collection(db, 'artifacts', appId, 'public', 'data', `youth_${classWorkspaceId}`);
    const unsubYouth = onSnapshot(
      youthColRef,
      (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
        setYouthActivities(list);
      },
      (err) => console.error('Lỗi tải hoạt động Chi đoàn:', err)
    );

    // 5.8 Lắng nghe Bảng điểm môn giáo viên giảng dạy & Lịch sử nhập vnEdu
    const scoresColRef = collection(db, 'artifacts', appId, 'public', 'data', `scores_${classWorkspaceId}`);
    const unsubScores = onSnapshot(
      scoresColRef,
      (snapshot) => {
        const map = {};
        snapshot.docs.forEach(d => {
          map[d.id] = { id: d.id, ...d.data() };
        });
        setSubjectScores(map);
      },
      (err) => console.error('Lỗi tải điểm môn học:', err)
    );

    const importsColRef = collection(db, 'artifacts', appId, 'public', 'data', `vnedu_imports_${classWorkspaceId}`);
    const unsubImports = onSnapshot(
      importsColRef,
      (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.importedAtMs || 0) - (a.importedAtMs || 0));
        setVneduImportHistory(list);
      },
      (err) => console.error('Lỗi tải lịch sử vnEdu:', err)
    );

    // 5.9 Lắng nghe dữ liệu Theo dõi học tập & Hướng nghiệp Lớp 12
    const grade12ColRef = collection(db, 'artifacts', appId, 'public', 'data', `grade12_${classWorkspaceId}`);
    const unsubGrade12 = onSnapshot(
      grade12ColRef,
      (snapshot) => {
        const map = {};
        snapshot.docs.forEach(d => {
          map[d.id] = { id: d.id, ...d.data() };
        });
        setGrade12Profiles(map);
      },
      (err) => console.error('Lỗi tải hồ sơ lớp 12:', err)
    );

    // 5.10 Lắng nghe danh sách các không gian lớp học / năm học đã lưu
    const workspacesColRef = collection(db, 'artifacts', appId, 'public', 'data', 'saved_workspaces');
    const unsubWorkspaces = onSnapshot(
      workspacesColRef,
      (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0));
        setSavedWorkspaces(list);
      },
      (err) => console.error('Lỗi tải danh sách lớp học:', err)
    );

    // 5.11 Lắng nghe Bộ Tiêu chuẩn Thi đua tùy biến của lớp
    const standardsDocRef = doc(db, 'artifacts', appId, 'public', 'data', `emulation_standards_${classWorkspaceId}`, 'rules');
    const unsubStandards = onSnapshot(
      standardsDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setEmulationStandards(prev => ({
            ...DEFAULT_EMULATION_STANDARDS,
            ...data
          }));
          if (data.teamBonusRule) setTeamBonusRule(data.teamBonusRule);
        } else {
          setDoc(standardsDocRef, {
            ...DEFAULT_EMULATION_STANDARDS,
            teamBonusRule: { enabled: false, ruleNote: 'GVCN chưa ban hành thang điểm quy đổi riêng cho tổ — chỉ thống kê tỷ lệ đạt A, B, C theo văn bản chuẩn.' },
            updatedAt: serverTimestamp()
          }).catch(() => {});
        }
      },
      (err) => console.error('Lỗi tải tiêu chuẩn thi đua:', err)
    );

    // 5.12 Lắng nghe các tuần thi đua đã được GVCN chốt chính thức (bất biến theo sĩ số tại thời điểm chốt)
    const snapshotsColRef = collection(db, 'artifacts', appId, 'public', 'data', `emulation_weeks_${classWorkspaceId}`);
    const unsubSnapshots = onSnapshot(
      snapshotsColRef,
      (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
        setWeeklySnapshots(list);
      },
      (err) => console.error('Lỗi tải dữ liệu tuần thi đua:', err)
    );

    // 5.13 Lắng nghe Lịch sử điều chỉnh kết quả thi đua
    const adjColRef = collection(db, 'artifacts', appId, 'public', 'data', `emulation_adjustments_${classWorkspaceId}`);
    const unsubAdjustments = onSnapshot(
      adjColRef,
      (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0));
        setEmulationAdjustLogs(list);
      },
      (err) => console.error('Lỗi tải lịch sử điều chỉnh thi đua:', err)
    );

    // 5.14 Lắng nghe dữ liệu Trung tâm Hỗ trợ Học tập (tách độc lập theo Lớp + Môn học)
    const activeSubSlug = (classConfig.subject || 'toan').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const subjectWorkspaceKey = `${classWorkspaceId}_${activeSubSlug}`;

    const topicsColRef = collection(db, 'artifacts', appId, 'public', 'data', `subject_topics_${subjectWorkspaceKey}`);
    const unsubTopics = onSnapshot(
      topicsColRef,
      (snapshot) => {
        if (snapshot.empty) {
          // Khởi tạo mẫu chương trình Toán 12 ban đầu nếu môn đang là Toán và chưa có dữ liệu
          if ((classConfig.subject || '').toLowerCase().includes('toán')) {
            const defaultMathTopics = [
              { id: 'T12_01', semester: 'Học kỳ I', topicName: 'Ứng dụng đạo hàm để khảo sát hàm số', skillName: 'Tính đơn điệu và cực trị của hàm số', requirement: 'Xét được chiều biến thiên, tìm cực trị hàm đa thức và phân thức' },
              { id: 'T12_02', semester: 'Học kỳ I', topicName: 'Ứng dụng đạo hàm để khảo sát hàm số', skillName: 'Giá trị lớn nhất, giá trị nhỏ nhất & Tiệm cận', requirement: 'Tìm GTLN-GTNN trên đoạn và xác định đúng điều kiện tiệm cận' },
              { id: 'T12_03', semester: 'Học kỳ I', topicName: 'Vectơ và hệ tọa độ trong không gian Oxyz', skillName: 'Tọa độ vectơ và biểu thức tọa độ các phép toán', requirement: 'Tính đúng tích vô hướng, góc giữa hai vectơ trong Oxyz' },
              { id: 'T12_04', semester: 'Học kỳ II', topicName: 'Nguyên hàm và Tích phân', skillName: 'Tính nguyên hàm, tích phân bằng phương pháp đổi biến & từng phần', requirement: 'Áp dụng đúng công thức nguyên hàm cơ bản và đổi cận chính xác' }
            ];
            defaultMathTopics.forEach(item => {
              setDoc(doc(topicsColRef, item.id), { ...item, createdAtMs: Date.now() }).catch(() => {});
            });
          } else {
            setKnowledgeTopics([]);
          }
        } else {
          const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          list.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
          setKnowledgeTopics(list);
          setQcTopicId(prev => prev || list[0]?.id || '');
          setErrTopicId(prev => prev || list[0]?.id || '');
        }
      },
      (err) => console.error('Lỗi tải bản đồ kiến thức:', err)
    );

    const qcColRef = collection(db, 'artifacts', appId, 'public', 'data', `subject_quick_checks_${subjectWorkspaceKey}`);
    const unsubQuickChecks = onSnapshot(
      qcColRef,
      (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0));
        setQuickChecks(list);
      },
      (err) => console.error('Lỗi tải kiểm tra nhanh:', err)
    );

    const errColRef = collection(db, 'artifacts', appId, 'public', 'data', `subject_error_logs_${subjectWorkspaceKey}`);
    const unsubErrorLogs = onSnapshot(
      errColRef,
      (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0));
        setErrorLogs(list);
      },
      (err) => console.error('Lỗi tải sổ tay lỗi sai:', err)
    );

    return () => {
      unsubConfig();
      unsubStudents();
      unsubTickets();
      unsubLogs();
      unsubAttendance();
      unsubPlans();
      unsubYouth();
      unsubScores();
      unsubImports();
      unsubGrade12();
      unsubWorkspaces();
      unsubStandards();
      unsubSnapshots();
      unsubAdjustments();
      unsubTopics();
      unsubQuickChecks();
      unsubErrorLogs();
    };
  }, [user, classWorkspaceId, classConfig.subject]);

  const currentRole = useMemo(
    () => ROLES.find(r => r.id === activeRoleId) || ROLES[0],
    [activeRoleId]
  );

  // 6.1 Lưu cấu hình Trường / Lớp / Năm học / Môn giảng dạy
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (!db || !user || activeRoleId !== 'gvcn') {
      showToast('Chỉ GVCN mới có quyền cập nhật cấu hình lớp học.', 'error');
      return;
    }
    try {
      const configDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'class_configs', 'active_workspace');
      await setDoc(configDocRef, {
        ...configForm,
        updatedBy: user.uid,
        updatedAt: serverTimestamp()
      }, { merge: true });

      const wsKey = `${configForm.schoolName}_${configForm.className}_${configForm.schoolYear}`
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_');
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'saved_workspaces', wsKey), {
        teacherName: configForm.teacherName,
        subject: configForm.subject,
        schoolName: configForm.schoolName,
        className: configForm.className,
        schoolYear: configForm.schoolYear,
        updatedAtMs: Date.now()
      }, { merge: true });

      setIsEditingConfig(false);
      showToast('Đã lưu cấu hình lớp học & năm học vào Cloud Firestore!');
    } catch (err) {
      showToast('Lỗi lưu cấu hình: ' + err.message, 'error');
    }
  };

  const handleSwitchWorkspace = async (ws) => {
    if (!db || !user || activeRoleId !== 'gvcn') {
      showToast('Chỉ GVCN mới có quyền chuyển đổi không gian lớp học.', 'error');
      return;
    }
    try {
      const configDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'class_configs', 'active_workspace');
      await setDoc(configDocRef, {
        teacherName: ws.teacherName,
        subject: ws.subject,
        schoolName: ws.schoolName,
        className: ws.className,
        schoolYear: ws.schoolYear,
        updatedBy: user.uid,
        updatedAt: serverTimestamp()
      }, { merge: true });
      showToast(`Đã chuyển sang không gian Lớp ${ws.className} (${ws.schoolYear})!`);
    } catch (err) {
      showToast('Lỗi chuyển không gian lớp: ' + err.message, 'error');
    }
  };

  // 6.2 Khởi tạo nhanh danh sách 8 học sinh mẫu (đại diện 4 tổ & ban cán sự)
  const handleSeedSampleStudents = async () => {
    if (!db || !user) return;
    if (activeRoleId !== 'gvcn') {
      showToast('Chỉ GVCN mới có quyền khởi tạo hồ sơ học sinh.', 'error');
      return;
    }

    try {
      const studentsColRef = collection(db, 'artifacts', appId, 'public', 'data', `students_${classWorkspaceId}`);
      for (const st of INITIAL_SAMPLE_STUDENTS) {
        // Dùng mã học sinh làm document ID để chống trùng lặp tuyệt đối
        const stDocRef = doc(studentsColRef, st.code);
        await setDoc(stDocRef, {
          ...st,
          meritPoints: 100,
          attendancePresent: 0,
          attendanceAbsent: 0,
          createdAt: serverTimestamp(),
          createdBy: user.uid
        }, { merge: true });
      }
      showToast('Đã khởi tạo 8 hồ sơ học sinh tiêu biểu (đủ 4 tổ & Ban cán sự) vào Firestore!');
    } catch (err) {
      showToast('Lỗi khởi tạo hồ sơ: ' + err.message, 'error');
    }
  };

  // 6.3 Thêm hoặc Cập nhật Hồ sơ Học sinh
  const handleSaveStudent = async (e) => {
    e.preventDefault();
    if (!db || !user) return;
    if (activeRoleId !== 'gvcn') {
      showToast('Chỉ GVCN mới được phép chỉnh sửa hồ sơ gốc của học sinh.', 'error');
      return;
    }

    if (!studentForm.code.trim() || !studentForm.fullName.trim()) {
      showToast('Vui lòng nhập đầy đủ Mã học sinh và Họ tên.', 'error');
      return;
    }

    try {
      const cleanCode = studentForm.code.trim().toUpperCase();
      const stDocRef = doc(db, 'artifacts', appId, 'public', 'data', `students_${classWorkspaceId}`, cleanCode);
      
      await setDoc(stDocRef, {
        ...studentForm,
        code: cleanCode,
        team: Number(studentForm.team),
        secondRole: studentForm.secondRole || '',
        meritPoints: editingStudent?.meritPoints ?? 100,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
      }, { merge: true });

      setShowStudentModal(false);
      setEditingStudent(null);
      showToast(editingStudent ? 'Đã cập nhật hồ sơ học sinh!' : 'Đã thêm học sinh mới vào lớp!');
    } catch (err) {
      showToast('Lỗi lưu hồ sơ học sinh: ' + err.message, 'error');
    }
  };

  // 6.4 Xóa hồ sơ học sinh
  const handleDeleteStudent = async (studentId, studentName) => {
    if (!db || !user || activeRoleId !== 'gvcn') return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', `students_${classWorkspaceId}`, studentId));
      showToast(`Đã xóa hồ sơ học sinh ${studentName}.`);
    } catch (err) {
      showToast('Lỗi khi xóa hồ sơ: ' + err.message, 'error');
    }
  };

  // 6.4B Phân tích danh sách học sinh hàng loạt (từ file Excel .xls/.xlsx/.csv hoặc dán từ Excel)
  const parseBulkStudentMatrix = (matrix) => {
    const cleanRows = matrix
      .map(row => row.map(c => (c === null || c === undefined ? '' : String(c).trim())))
      .filter(row => row.some(c => c !== ''));

    if (cleanRows.length === 0) {
      setBulkPreviewList([]);
      return;
    }

    // Dò tìm dòng tiêu đề nếu có
    let startIdx = 0;
    let colIdx = { code: -1, fullName: -1, gender: -1, dob: -1, team: -1, parentPhone: -1, note: -1 };

    for (let i = 0; i < Math.min(cleanRows.length, 15); i++) {
      const joined = cleanRows[i].join(' ').toLowerCase();
      if ((joined.includes('họ') && joined.includes('tên')) || joined.includes('ho_va_ten') || joined.includes('họ tên')) {
        startIdx = i + 1;
        cleanRows[i].forEach((h, idx) => {
          const low = h.toLowerCase();
          if (low.includes('mã') || low.includes('ma_') || low.includes('định danh')) colIdx.code = idx;
          else if (low.includes('họ') || low.includes('tên')) colIdx.fullName = idx;
          else if (low.includes('giới') || low.includes('nữ') || low.includes('nam')) colIdx.gender = idx;
          else if (low.includes('sinh') || low.includes('dob')) colIdx.dob = idx;
          else if (low.includes('tổ') || low.includes('nhóm')) colIdx.team = idx;
          else if (low.includes('điện thoại') || low.includes('sđt') || low.includes('sdt') || low.includes('phụ huynh')) colIdx.parentPhone = idx;
          else if (low.includes('chú') || low.includes('nhận xét')) colIdx.note = idx;
        });
        break;
      }
    }

    const parsed = [];
    let autoCounter = students.length + 1;

    for (let i = startIdx; i < cleanRows.length; i++) {
      const row = cleanRows[i];
      const firstTwo = `${row[0] || ''} ${row[1] || ''}`.toLowerCase();
      if (firstTwo.includes('tổng') || firstTwo.includes('giáo viên') || firstTwo.includes('ngày')) continue;

      let fullName = '';
      let rawCode = '';
      let gender = 'Nữ';
      let dob = '';
      let team = ((parsed.length) % 4) + 1;
      let parentPhone = '';
      let note = '';

      if (colIdx.fullName >= 0) {
        fullName = row[colIdx.fullName] || '';
        rawCode = colIdx.code >= 0 ? (row[colIdx.code] || '') : '';
        if (colIdx.gender >= 0 && row[colIdx.gender]) {
          gender = row[colIdx.gender].toLowerCase().includes('nam') ? 'Nam' : 'Nữ';
        }
        if (colIdx.dob >= 0) dob = row[colIdx.dob] || '';
        if (colIdx.team >= 0 && row[colIdx.team]) {
          const tNum = parseInt(row[colIdx.team].replace(/\D/g, ''), 10);
          if (tNum >= 1 && tNum <= 4) team = tNum;
        }
        if (colIdx.parentPhone >= 0) parentPhone = row[colIdx.parentPhone] || '';
        if (colIdx.note >= 0) note = row[colIdx.note] || '';
      } else {
        // Trường hợp người dùng dán danh sách không có dòng tiêu đề (VD: STT | Họ tên | Giới tính | Tổ | SĐT hoặc chỉ mỗi cột Họ tên)
        const nonEmpty = row.filter(Boolean);
        if (nonEmpty.length === 1) {
          fullName = nonEmpty[0];
        } else if (/^\d+$/.test(nonEmpty[0])) {
          // Cột đầu là STT
          if (nonEmpty[1] && /^hs/i.test(nonEmpty[1])) {
            rawCode = nonEmpty[1];
            fullName = nonEmpty[2] || '';
          } else {
            fullName = nonEmpty[1] || '';
            if (nonEmpty[2] && (nonEmpty[2].toLowerCase() === 'nam' || nonEmpty[2].toLowerCase() === 'nữ')) {
              gender = nonEmpty[2].toLowerCase() === 'nam' ? 'Nam' : 'Nữ';
            }
          }
        } else {
          fullName = nonEmpty[0];
        }
      }

      if (!fullName || fullName.length < 2) continue;

      // Giữ nguyên mã cũ nếu trùng tên học sinh đã có trong lớp, ngược lại sinh mã chuẩn HS001...
      const existingByName = students.find(
        s => (s.fullName || '').toLowerCase().replace(/\s+/g, ' ').trim() === fullName.toLowerCase().replace(/\s+/g, ' ').trim()
      );
      const finalCode = existingByName
        ? existingByName.code
        : (rawCode ? rawCode.toUpperCase().replace(/[^A-Z0-9_-]/g, '') : `HS${String(autoCounter++).padStart(3, '0')}`);

      parsed.push({
        code: finalCode,
        fullName: fullName.replace(/\s+/g, ' ').trim(),
        gender,
        dob,
        team,
        role: existingByName?.role || 'member',
        parentPhone,
        note,
        isUpdate: Boolean(existingByName)
      });
    }

    setBulkPreviewList(parsed);
  };

  const handleBulkTextChange = (text) => {
    setBulkStudentText(text);
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length === 0) {
      setBulkPreviewList([]);
      return;
    }
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const matrix = lines.map(line => line.split(delimiter).map(c => c.replace(/^"|"$/g, '')));
    parseBulkStudentMatrix(matrix);
  };

  const handleBulkExcelUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) {
        const XLSX = await ensureSheetJsLoaded();
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const textView = matrix.filter(r => r.some(c => String(c).trim() !== '')).map(r => r.join('\t')).join('\n');
        setBulkStudentText(textView);
        parseBulkStudentMatrix(matrix);
        showToast(`Đã đọc danh sách từ tệp "${file.name}". Kiểm tra bản xem trước và bấm Lưu!`);
      } else {
        const reader = new FileReader();
        reader.onload = (evt) => {
          if (typeof evt.target?.result === 'string') {
            handleBulkTextChange(evt.target.result);
          }
        };
        reader.readAsText(file, 'UTF-8');
      }
    } catch (err) {
      showToast('Lỗi đọc tệp danh sách học sinh: ' + err.message, 'error');
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveBulkStudents = async () => {
    if (!db || !user || activeRoleId !== 'gvcn' || bulkPreviewList.length === 0) return;
    setIsSavingBulkStudents(true);
    try {
      const studentsColRef = collection(db, 'artifacts', appId, 'public', 'data', `students_${classWorkspaceId}`);
      for (const st of bulkPreviewList) {
        await setDoc(doc(studentsColRef, st.code), {
          code: st.code,
          fullName: st.fullName,
          gender: st.gender,
          dob: st.dob || '',
          team: Number(st.team),
          role: st.role || 'member',
          parentPhone: st.parentPhone || '',
          note: st.note || '',
          meritPoints: 100,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid
        }, { merge: true });
      }
      showToast(`Đã lưu thành công ${bulkPreviewList.length} học sinh vào Firestore!`);
      setShowBulkStudentModal(false);
    } catch (err) {
      showToast('Lỗi lưu danh sách học sinh: ' + err.message, 'error');
    } finally {
      setIsSavingBulkStudents(false);
    }
  };

  // Hằng số tuần & tháng phục vụ phân hệ Thi đua A/B/C
  const WEEK_OPTIONS = useMemo(() => Array.from({ length: 35 }, (_, i) => `Tuần ${i + 1}`), []);
  const MONTH_OPTIONS = ['Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5'];

  const currentLockedSnapshot = useMemo(
    () => weeklySnapshots.find(w => w.weekLabel === selectedEmulationWeek) || null,
    [weeklySnapshots, selectedEmulationWeek]
  );

  // Lưu tùy chỉnh Bộ tiêu chuẩn thi đua
  const handleSaveEmulationStandards = async (updatedStandards, updatedBonusRule = teamBonusRule) => {
    if (!db || !user || activeRoleId !== 'gvcn') return;
    try {
      const standardsDocRef = doc(db, 'artifacts', appId, 'public', 'data', `emulation_standards_${classWorkspaceId}`, 'rules');
      await setDoc(standardsDocRef, {
        ...updatedStandards,
        teamBonusRule: updatedBonusRule,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
      }, { merge: true });
      showToast('Đã cập nhật Bộ Tiêu chuẩn Thi đua lên Cloud Firestore!');
    } catch (err) {
      showToast('Lỗi lưu tiêu chuẩn: ' + err.message, 'error');
    }
  };

  // Gửi phiếu ghi nhận & đề xuất
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!db || !user) return;
    if (!currentRole.allowedTicketTypes.includes(ticketForm.type)) {
      showToast(`Vai trò ${currentRole.title} không có quyền lập loại phiếu này.`, 'error');
      return;
    }

    let targetStudent = null;
    if (ticketForm.type !== 'thu_chi' && ticketForm.type !== 'chi_doan') {
      targetStudent = students.find(s => s.id === ticketForm.studentId);
      if (!targetStudent) {
        showToast('Vui lòng chọn học sinh liên quan.', 'error');
        return;
      }
      if (currentRole.team && Number(targetStudent.team) !== currentRole.team) {
        showToast(`Tổ trưởng Tổ ${currentRole.team} chỉ được ghi nhận học sinh thuộc Tổ ${currentRole.team}.`, 'error');
        return;
      }
    }

    let categoryLabel = ticketForm.category;
    let criterionText = '';
    let suggestedGrade = '';

    if (ticketForm.type === 'ne_nep') {
      if (!ticketForm.evidence.trim()) {
        showToast('Bắt buộc nhập minh chứng / thời điểm tiết học cụ thể.', 'error');
        return;
      }
      if (ticketForm.emulationGroup === 'gradeA') {
        const c = emulationStandards.gradeA.find(x => x.id === ticketForm.criterionId);
        criterionText = c ? c.title : '';
        categoryLabel = 'Minh chứng Xếp loại A';
        suggestedGrade = 'A';
      } else if (ticketForm.emulationGroup === 'gradeB') {
        const c1 = emulationStandards.gradeB.find(x => x.id === ticketForm.criterionId);
        if (c1?.conditional && !ticketForm.remindedBefore) {
          showToast('Tiêu chí này yêu cầu xác nhận đã nhắc nhở 1 lần trước đó.', 'error');
          return;
        }
        if (ticketForm.isSimultaneousB) {
          const c2 = emulationStandards.gradeB.find(x => x.id === ticketForm.secondCriterionId);
          if (!c2 || c2.id === c1?.id) {
            showToast('Vui lòng chọn tiêu chí nhóm B thứ hai khác với tiêu chí thứ nhất.', 'error');
            return;
          }
          criterionText = `Đồng thời 2 tiêu chí B: (1) ${c1?.text} + (2) ${c2.text}`;
          categoryLabel = 'Gợi ý Xếp loại C (Đồng thời 2 tiêu chí B)';
          suggestedGrade = 'C';
        } else {
          criterionText = c1 ? c1.text : '';
          categoryLabel = 'Vi phạm Tiêu chí B';
          suggestedGrade = 'B';
        }
      } else if (ticketForm.emulationGroup === 'gradeC') {
        const c = emulationStandards.gradeC.find(x => x.id === ticketForm.criterionId);
        criterionText = c ? c.text : '';
        categoryLabel = 'Vi phạm Tiêu chí C';
        suggestedGrade = 'C';
      } else if (ticketForm.emulationGroup === 'severe') {
        const c = emulationStandards.severeSemesterFail.find(x => x.id === ticketForm.criterionId);
        criterionText = c ? c.text : '';
        categoryLabel = 'Lỗi nặng Học kỳ (Xem xét Chưa đạt HK)';
        suggestedGrade = 'C';
      }
    }

    setIsSubmittingTicket(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', `tickets_${classWorkspaceId}`), {
        type: ticketForm.type,
        typeLabel: TICKET_TYPES[ticketForm.type]?.label || 'Phiếu đề xuất',
        studentId: targetStudent ? targetStudent.id : null,
        studentName: targetStudent
          ? `${targetStudent.fullName} (${targetStudent.code} - Tổ ${targetStudent.team})`
          : ticketForm.type === 'thu_chi'
            ? `Quỹ lớp ${classConfig.className}`
            : `Chi đoàn ${classConfig.className}`,
        category: categoryLabel,
        emulationGroup: ticketForm.emulationGroup,
        criterionId: ticketForm.criterionId,
        criterionText,
        suggestedGrade,
        evidence: ticketForm.evidence.trim(),
        weekLabel: ticketForm.weekLabel,
        amount: ticketForm.type === 'thu_chi' ? Number(ticketForm.amount || 0) : 0,
        date: ticketForm.date,
        description: ticketForm.description.trim() || criterionText,
        submittedByRole: currentRole.id,
        submittedByTitle: currentRole.title,
        submittedByUid: user.uid,
        status: 'pending',
        createdAt: serverTimestamp(),
        createdAtMs: Date.now()
      });

      setTicketForm(prev => ({ ...prev, description: '', evidence: '', amount: 0 }));
      showToast('Đã gửi phiếu đề xuất vào Trung tâm kiểm duyệt của GVCN!');
      setActiveTab('moderation');
    } catch (err) {
      showToast('Lỗi gửi phiếu: ' + err.message, 'error');
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  // GVCN Kiểm duyệt phiếu (Chống trùng lặp & Cập nhật quỹ lớp)
  const handleModerateTicket = async (ticket, decision) => {
    if (!db || !user || activeRoleId !== 'gvcn' || !currentRole.canApprove) {
      showToast('Chỉ Giáo viên chủ nhiệm mới có quyền kiểm duyệt phiếu.', 'error');
      return;
    }

    setProcessingTicketId(ticket.id);
    try {
      const ticketRef = doc(db, 'artifacts', appId, 'public', 'data', `tickets_${classWorkspaceId}`, ticket.id);
      const approvalId = `APR_${Date.now()}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      let appliedFundDelta = 0;

      // Sử dụng Firestore Transaction để đảm bảo idempotent và chống xung đột phiên bản
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ticketRef);
        if (!snap.exists()) {
          throw new Error('Phiếu không còn tồn tại trên hệ thống.');
        }
        const currentData = snap.data();
        if (currentData.status === 'approved' || currentData.status === 'rejected') {
          throw new Error('Phiếu này đã được xử lý trước đó (chống duyệt trùng lặp).');
        }
        if (ticket.version && currentData.version && currentData.version !== ticket.version) {
          throw new Error('Phiên bản phiếu đã thay đổi bởi thao tác khác. Vui lòng tải lại.');
        }

        const nextVersion = (Number(currentData.version) || 1) + 1;
        transaction.update(ticketRef, {
          status: decision,
          version: nextVersion,
          approvalId: decision === 'approved' ? approvalId : null,
          reviewedByTeacher: classConfig.teacherName,
          reviewedByUid: user.uid,
          reviewedAt: serverTimestamp(),
          reviewedAtMs: Date.now()
        });

        if (decision === 'approved' && currentData.type === 'thu_chi') {
          appliedFundDelta = currentData.category === 'Chi quỹ'
            ? -Number(currentData.amount || 0)
            : Number(currentData.amount || 0);
        }
      });

      if (decision === 'approved' && ticket.type === 'thu_chi' && appliedFundDelta !== 0) {
        const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'class_configs', 'active_workspace');
        await runTransaction(db, async (transaction) => {
          const cfgSnap = await transaction.get(configRef);
          const curBal = cfgSnap.exists() ? Number(cfgSnap.data().fundBalance || 0) : 0;
          transaction.set(configRef, {
            fundBalance: curBal + appliedFundDelta,
            updatedAt: serverTimestamp()
          }, { merge: true });
        });
      }

      const actionLabel = decision === 'approved' ? 'PHÊ DUYỆT' : decision === 'needs_revision' ? 'YÊU CẦU SỬA' : 'TỪ CHỐI';
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', `audit_logs_${classWorkspaceId}`), {
        action: actionLabel,
        approvalId: decision === 'approved' ? approvalId : null,
        ticketId: ticket.id,
        ticketType: ticket.typeLabel,
        summary: `${ticket.studentName}: ${ticket.description}`,
        submittedBy: ticket.submittedByTitle,
        approvedBy: `GVCN ${classConfig.teacherName} (${user.uid})`,
        timestampMs: Date.now(),
        timestamp: serverTimestamp()
      });

      setSelectedTicketIds(prev => prev.filter(id => id !== ticket.id));
      showToast(`Đã cập nhật trạng thái phiếu: ${actionLabel}.`);
    } catch (err) {
      showToast(err.message || 'Lỗi kiểm duyệt phiếu.', 'error');
    } finally {
      setProcessingTicketId(null);
    }
  };

  // ==========================================================================
  // PHẦN A: KIỂM TRA ĐIỀU KIỆN DUYỆT HÀNG LOẠT & THỰC THI THEO LÔ AN TOÀN
  // ==========================================================================
  const evaluateTicketBatchEligibility = (ticket) => {
    if (ticket.status === 'approved') {
      return { eligible: false, reason: 'Phiếu đã được phê duyệt trước đó' };
    }
    if (ticket.status === 'rejected') {
      return { eligible: false, reason: 'Phiếu đã bị từ chối' };
    }
    if (ticket.status === 'needs_revision') {
      return { eligible: false, reason: 'Phiếu đang yêu cầu chỉnh sửa / có tranh chấp' };
    }
    if (ticket.status !== 'pending') {
      return { eligible: false, reason: 'Trạng thái phiếu không ở dạng Chờ duyệt' };
    }
    if (!ticket.description || !String(ticket.description).trim()) {
      return { eligible: false, reason: 'Thiếu nội dung mô tả sự việc' };
    }
    if (ticket.type === 'ne_nep') {
      if (ticket.emulationGroup === 'severe' || ticket.suggestedGrade === 'C' || ticket.emulationGroup === 'gradeC') {
        return { eligible: false, reason: 'Phiếu vi phạm mức C / lỗi nặng học kỳ (cần GVCN xem xét riêng)' };
      }
      if (!ticket.evidence || !String(ticket.evidence).trim()) {
        return { eligible: false, reason: 'Thiếu minh chứng / thời điểm xác minh' };
      }
      if (!ticket.studentId) {
        return { eligible: false, reason: 'Thiếu thông tin định danh học sinh' };
      }
    }
    if (ticket.type === 'thu_chi') {
      if (!ticket.amount || Number(ticket.amount) <= 0) {
        return { eligible: false, reason: 'Phiếu thu/chi thiếu số tiền hợp lệ' };
      }
      if (String(ticket.description).trim().length < 8) {
        return { eligible: false, reason: 'Phiếu thu/chi thiếu thông tin chứng từ / lý do chi tiết' };
      }
    }
    return { eligible: true, reason: 'Đủ điều kiện duyệt hàng loạt' };
  };

  // Danh sách phiếu sau khi áp dụng bộ lọc hiện tại tại Trung tâm kiểm duyệt
  const filteredModerationTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchType = modFilterType === 'all' || t.type === modFilterType;
      const matchStatus = modFilterStatus === 'all' || t.status === modFilterStatus;
      return matchType && matchStatus;
    });
  }, [tickets, modFilterType, modFilterStatus]);

  const eligibleFilteredTickets = useMemo(() => {
    return filteredModerationTickets.filter(t => evaluateTicketBatchEligibility(t).eligible);
  }, [filteredModerationTickets]);

  // Mở hộp thoại tóm tắt xác nhận lần 2 trước khi duyệt hàng loạt
  const handleOpenBatchConfirmModal = (mode) => {
    if (activeRoleId !== 'gvcn' || !currentRole.canApprove) {
      showToast('Chỉ GVCN có quyền phê duyệt mới được phép duyệt hàng loạt.', 'error');
      return;
    }

    const scopeTickets = mode === 'selected'
      ? filteredModerationTickets.filter(t => selectedTicketIds.includes(t.id))
      : filteredModerationTickets;

    const eligibleTickets = [];
    const excludedTickets = [];
    const snapshotVersions = {};

    scopeTickets.forEach(tk => {
      const check = evaluateTicketBatchEligibility(tk);
      if (check.eligible) {
        eligibleTickets.push(tk);
        snapshotVersions[tk.id] = {
          status: tk.status,
          version: Number(tk.version) || 1
        };
      } else {
        excludedTickets.push({ ticket: tk, reason: check.reason });
      }
    });

    if (eligibleTickets.length === 0) {
      showToast('Không có phiếu nào đủ điều kiện duyệt hàng loạt trong phạm vi đã chọn.', 'error');
      return;
    }

    setBatchConfirmModal({
      mode,
      eligibleTickets,
      excludedTickets,
      snapshotVersions
    });
  };

  // Thực thi duyệt hàng loạt an toàn (chia lô, kiểm tra version/trạng thái từng phiếu)
  const handleExecuteBatchApproval = async () => {
    if (!db || !user || activeRoleId !== 'gvcn' || !currentRole.canApprove || !batchConfirmModal) {
      showToast('Không đủ thẩm quyền phê duyệt hàng loạt.', 'error');
      return;
    }
    if (isBatchApproving) return;

    setIsBatchApproving(true);
    const { eligibleTickets, excludedTickets, snapshotVersions } = batchConfirmModal;
    const batchId = `BATCH_${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    let successCount = 0;
    let totalFundDelta = 0;
    const failedItems = [];

    try {
      // Xử lý từng phiếu qua transaction độc lập để bảo đảm idempotent & phát hiện xung đột phiên bản
      for (const tk of eligibleTickets) {
        const ticketRef = doc(db, 'artifacts', appId, 'public', 'data', `tickets_${classWorkspaceId}`, tk.id);
        const expectedSnap = snapshotVersions[tk.id];
        const approvalId = `${batchId}_${tk.id.slice(0, 6)}`;

        try {
          let itemFundDelta = 0;
          await runTransaction(db, async (transaction) => {
            const freshSnap = await transaction.get(ticketRef);
            if (!freshSnap.exists()) {
              throw new Error('Phiếu đã bị xóa.');
            }
            const freshData = freshSnap.data();
            const currentVer = Number(freshData.version) || 1;

            // Từ chối nếu trạng thái hoặc phiên bản đã thay đổi trong lúc GVCN mở hộp thoại xác nhận
            if (freshData.status !== 'pending' || currentVer !== expectedSnap.version) {
              throw new Error(`Phiếu đã đổi trạng thái (${freshData.status}) hoặc phiên bản cũ (v${expectedSnap.version} -> v${currentVer}).`);
            }

            transaction.update(ticketRef, {
              status: 'approved',
              version: currentVer + 1,
              approvalId,
              batchApprovalId: batchId,
              reviewedByTeacher: classConfig.teacherName,
              reviewedByUid: user.uid,
              reviewedAt: serverTimestamp(),
              reviewedAtMs: Date.now()
            });

            if (freshData.type === 'thu_chi') {
              itemFundDelta = freshData.category === 'Chi quỹ'
                ? -Number(freshData.amount || 0)
                : Number(freshData.amount || 0);
            }
          });

          successCount++;
          totalFundDelta += itemFundDelta;

          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', `audit_logs_${classWorkspaceId}`), {
            action: 'PHÊ DUYỆT HÀNG LOẠT',
            approvalId,
            batchApprovalId: batchId,
            ticketId: tk.id,
            ticketType: tk.typeLabel,
            summary: `${tk.studentName}: ${tk.description}`,
            submittedBy: tk.submittedByTitle,
            approvedBy: `GVCN ${classConfig.teacherName} (${user.uid})`,
            timestampMs: Date.now(),
            timestamp: serverTimestamp()
          });
        } catch (itemErr) {
          failedItems.push({
            ticket: tk,
            reason: itemErr.message || 'Lỗi xung đột dữ liệu'
          });
        }
      }

      // Cập nhật số dư quỹ lớp một lần duy nhất theo tổng biến động thực tế của các phiếu thu/chi thành công
      if (totalFundDelta !== 0) {
        const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'class_configs', 'active_workspace');
        await runTransaction(db, async (transaction) => {
          const cfgSnap = await transaction.get(configRef);
          const curBal = cfgSnap.exists() ? Number(cfgSnap.data().fundBalance || 0) : 0;
          transaction.set(configRef, {
            fundBalance: curBal + totalFundDelta,
            updatedAt: serverTimestamp()
          }, { merge: true });
        });
      }

      const needReviewCount = excludedTickets.length + failedItems.length;
      const totalScopeCount = eligibleTickets.length + excludedTickets.length;

      setBatchApprovalReport({
        batchId,
        successCount,
        totalScopeCount,
        needReviewCount,
        failedItems,
        excludedTickets,
        timestamp: new Date().toLocaleTimeString('vi-VN')
      });

      setSelectedTicketIds([]);
      setBatchConfirmModal(null);
      showToast(`Đã duyệt ${successCount}/${totalScopeCount} phiếu. ${needReviewCount} phiếu cần xem lại.`);
    } finally {
      setIsBatchApproving(false);
    }
  };

  // Tổng hợp minh chứng đã duyệt của 1 học sinh trong tuần (Không mặc định xếp A)
  const getStudentWeekEvidenceSummary = (studentId, weekLabel) => {
    const approvedInWeek = tickets.filter(
      t => t.status === 'approved' && t.type === 'ne_nep' && t.studentId === studentId && (t.weekLabel || 'Tuần 1') === weekLabel
    );
    if (approvedInWeek.length === 0) {
      return {
        approvedInWeek: [],
        suggestedRank: null,
        suggestionReason: 'Chưa có minh chứng được duyệt (Không mặc định loại A)'
      };
    }

    const hasC = approvedInWeek.some(t => t.suggestedGrade === 'C' || t.emulationGroup === 'gradeC' || t.emulationGroup === 'severe');
    const hasB = approvedInWeek.some(t => t.suggestedGrade === 'B' || t.emulationGroup === 'gradeB');
    const hasA = approvedInWeek.some(t => t.suggestedGrade === 'A' || t.emulationGroup === 'gradeA');

    if (hasC) {
      return { approvedInWeek, suggestedRank: 'C', suggestionReason: 'Có vi phạm mức C đã được GVCN duyệt' };
    }
    if (hasB && !hasA) {
      return { approvedInWeek, suggestedRank: 'B', suggestionReason: 'Có vi phạm mức B đã được GVCN duyệt' };
    }
    if (hasA) {
      return { approvedInWeek, suggestedRank: 'A', suggestionReason: 'Có minh chứng đạt chuẩn mức A được GVCN duyệt' };
    }
    return { approvedInWeek, suggestedRank: null, suggestionReason: 'Chờ GVCN quyết định' };
  };

  // GVCN Chốt thi đua tuần (Khóa sĩ số tại thời điểm chốt)
  const handleLockWeeklyEmulation = async () => {
    if (!db || !user || activeRoleId !== 'gvcn') return;
    if (students.length === 0) {
      showToast('Chưa có danh sách học sinh để chốt tuần.', 'error');
      return;
    }

    const records = {};
    const unfinalized = [];

    students.forEach(st => {
      const autoInfo = getStudentWeekEvidenceSummary(st.id, selectedEmulationWeek);
      const rank = weeklyEmulationDrafts[st.code]?.rank ?? autoInfo.suggestedRank;
      if (!rank) {
        unfinalized.push(st.fullName);
      } else {
        records[st.code] = {
          studentCode: st.code,
          studentName: st.fullName,
          team: Number(st.team),
          rank,
          note: weeklyEmulationDrafts[st.code]?.note || autoInfo.suggestionReason
        };
      }
    });

    if (unfinalized.length > 0) {
      showToast(`Còn ${unfinalized.length} học sinh chưa được chọn xếp loại A/B/C (${unfinalized.slice(0, 3).join(', ')}...). Vui lòng xác nhận đủ trước khi chốt tuần!`, 'error');
      return;
    }

    setIsLockingWeek(true);
    try {
      const teamStats = [1, 2, 3, 4].map(teamNum => {
        const members = students.filter(s => Number(s.team) === teamNum);
        let countA = 0, countB = 0, countC = 0;
        members.forEach(m => {
          const r = records[m.code]?.rank;
          if (r === 'A') countA++;
          else if (r === 'B') countB++;
          else if (r === 'C') countC++;
        });
        const rateA = members.length > 0 ? Math.round((countA / members.length) * 1000) / 10 : 0;
        return {
          team: teamNum,
          lockedSize: members.length,
          countA,
          countB,
          countC,
          unfinalizedCount: 0,
          rateA
        };
      });

      const weekNumber = parseInt(selectedEmulationWeek.replace(/\D/g, ''), 10) || 1;
      const weekDocId = `week_${weekNumber}`;

      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', `emulation_weeks_${classWorkspaceId}`, weekDocId), {
        weekNumber,
        weekLabel: selectedEmulationWeek,
        monthLabel: selectedEmulationMonth,
        semesterLabel: selectedEmulationSemester,
        totalLockedStudents: students.length,
        records,
        teamStats,
        lockedBy: `GVCN ${classConfig.teacherName}`,
        lockedAtMs: Date.now(),
        lockedAt: serverTimestamp()
      });

      showToast(`Đã chốt sổ thi đua ${selectedEmulationWeek} thành công!`);
    } catch (err) {
      showToast('Lỗi chốt tuần thi đua: ' + err.message, 'error');
    } finally {
      setIsLockingWeek(false);
    }
  };

  // Điều chỉnh kết quả tuần đã chốt (Bắt buộc ghi lý do & lưu lịch sử)
  const handleAdjustLockedStudentRank = async (e) => {
    e.preventDefault();
    if (!db || !user || activeRoleId !== 'gvcn' || !currentLockedSnapshot || !adjustModalData) return;
    if (!adjustReason.trim()) {
      showToast('Bắt buộc nhập lý do điều chỉnh.', 'error');
      return;
    }

    try {
      const updatedRecords = {
        ...currentLockedSnapshot.records,
        [adjustModalData.studentCode]: {
          ...currentLockedSnapshot.records[adjustModalData.studentCode],
          rank: adjustNewRank,
          note: `Điều chỉnh: ${adjustReason.trim()}`
        }
      };

      const updatedTeamStats = [1, 2, 3, 4].map(teamNum => {
        const oldTeam = currentLockedSnapshot.teamStats?.find(t => t.team === teamNum) || { lockedSize: 0 };
        const teamRecs = Object.values(updatedRecords).filter(r => Number(r.team) === teamNum);
        const countA = teamRecs.filter(r => r.rank === 'A').length;
        const countB = teamRecs.filter(r => r.rank === 'B').length;
        const countC = teamRecs.filter(r => r.rank === 'C').length;
        const size = oldTeam.lockedSize || teamRecs.length;
        const rateA = size > 0 ? Math.round((countA / size) * 1000) / 10 : 0;
        return {
          team: teamNum,
          lockedSize: size,
          countA,
          countB,
          countC,
          unfinalizedCount: 0,
          rateA
        };
      });

      await updateDoc(
        doc(db, 'artifacts', appId, 'public', 'data', `emulation_weeks_${classWorkspaceId}`, currentLockedSnapshot.id),
        {
          records: updatedRecords,
          teamStats: updatedTeamStats
        }
      );

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', `emulation_adjustments_${classWorkspaceId}`), {
        weekLabel: selectedEmulationWeek,
        studentCode: adjustModalData.studentCode,
        studentName: adjustModalData.studentName,
        team: adjustModalData.team,
        oldRank: adjustModalData.oldRank,
        newRank: adjustNewRank,
        reason: adjustReason.trim(),
        adjustedBy: `GVCN ${classConfig.teacherName}`,
        timestampMs: Date.now(),
        timestamp: serverTimestamp()
      });

      setAdjustModalData(null);
      showToast('Đã điều chỉnh xếp loại và ghi vào Lịch sử điều chỉnh!');
    } catch (err) {
      showToast('Lỗi điều chỉnh: ' + err.message, 'error');
    }
  };

  // ==========================================================================
  // 6E. CÁC HÀM XỬ LÝ ĐIỂM DANH, KẾ HOẠCH, VNEDU, LỚP 12, GEMINI AI & XUẤT CSV
  // ==========================================================================
  const ensureSheetJsLoaded = () => {
    return new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && window.XLSX) {
        resolve(window.XLSX);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      script.onload = () => resolve(window.XLSX);
      script.onerror = () => reject(new Error('Không thể tải thư viện đọc Excel SheetJS.'));
      document.head.appendChild(script);
    });
  };

  const handleSaveAttendance = async () => {
    if (!db || !user) return;
    const targetStudents = students.filter(s => !currentRole.team || Number(s.team) === currentRole.team);
    if (targetStudents.length === 0) {
      showToast('Không có học sinh thuộc phạm vi điểm danh.', 'error');
      return;
    }

    setIsSavingAttendance(true);
    try {
      let presentCount = 0;
      let excusedCount = 0;
      let unexcusedCount = 0;
      let lateCount = 0;
      const absentDetails = [];

      targetStudents.forEach(st => {
        const entry = dailyAttendanceDraft[st.id] || { status: 'present', note: '' };
        if (entry.status === 'present') presentCount++;
        else if (entry.status === 'excused') {
          excusedCount++;
          absentDetails.push(`${st.fullName} (Vắng CP${entry.note ? `: ${entry.note}` : ''})`);
        } else if (entry.status === 'unexcused') {
          unexcusedCount++;
          absentDetails.push(`${st.fullName} (Vắng KP${entry.note ? `: ${entry.note}` : ''})`);
        } else if (entry.status === 'late') {
          lateCount++;
          absentDetails.push(`${st.fullName} (Đi muộn${entry.note ? `: ${entry.note}` : ''})`);
        }
      });

      const absentSummary = absentDetails.length > 0 ? absentDetails.join('; ') : 'Đủ sĩ số, không có vắng/muộn';

      if (activeRoleId === 'gvcn') {
        const docId = `${attendanceDate}_${attendanceSession === 'Sáng' ? 'sang' : 'chieu'}`;
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', `attendance_${classWorkspaceId}`, docId), {
          date: attendanceDate,
          session: attendanceSession,
          totalStudents: targetStudents.length,
          presentCount,
          excusedCount,
          unexcusedCount,
          lateCount,
          absentSummary,
          recordedBy: `GVCN ${classConfig.teacherName}`,
          updatedAt: serverTimestamp()
        }, { merge: true });
        showToast(`Đã lưu sổ điểm danh chính thức ngày ${attendanceDate} (${attendanceSession})!`);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', `tickets_${classWorkspaceId}`), {
          type: 'diem_danh',
          typeLabel: TICKET_TYPES.diem_danh.label,
          studentId: null,
          studentName: currentRole.team ? `Tổ ${currentRole.team}` : `Toàn lớp ${classConfig.className}`,
          category: `Điểm danh ${attendanceSession}`,
          date: attendanceDate,
          description: `Có mặt ${presentCount}/${targetStudents.length}. ${absentSummary}`,
          submittedByRole: currentRole.id,
          submittedByTitle: currentRole.title,
          submittedByUid: user.uid,
          status: 'pending',
          createdAt: serverTimestamp(),
          createdAtMs: Date.now()
        });
        showToast('Đã gửi phiếu điểm danh vào Trung tâm kiểm duyệt của GVCN!');
      }
    } catch (err) {
      showToast('Lỗi lưu điểm danh: ' + err.message, 'error');
    } finally {
      setIsSavingAttendance(false);
    }
  };

  const handleAddPlan = async (e) => {
    e.preventDefault();
    if (!db || !user || activeRoleId !== 'gvcn' || !planForm.title.trim()) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', `plans_${classWorkspaceId}`), {
        ...planForm,
        title: planForm.title.trim(),
        createdAtMs: Date.now(),
        createdAt: serverTimestamp()
      });
      setPlanForm({ ...planForm, title: '', content: '' });
      showToast('Đã thêm kế hoạch chủ nhiệm mới!');
    } catch (err) {
      showToast('Lỗi thêm kế hoạch: ' + err.message, 'error');
    }
  };

  const handleTogglePlanStatus = async (plan) => {
    if (!db || !user || activeRoleId !== 'gvcn') return;
    try {
      const nextStatus = plan.status === 'Hoàn thành' ? 'Đang thực hiện' : 'Hoàn thành';
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', `plans_${classWorkspaceId}`, plan.id), {
        status: nextStatus
      });
    } catch (err) {
      showToast('Lỗi cập nhật trạng thái: ' + err.message, 'error');
    }
  };

  const handleAddYouthActivity = async (e) => {
    e.preventDefault();
    if (!db || !user || !youthForm.title.trim()) return;
    try {
      if (activeRoleId === 'gvcn') {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', `youth_${classWorkspaceId}`), {
          ...youthForm,
          participantCount: Number(youthForm.participantCount || 0),
          createdAtMs: Date.now(),
          createdAt: serverTimestamp()
        });
        showToast('Đã ghi nhận hoạt động Chi đoàn lên Firestore!');
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', `tickets_${classWorkspaceId}`), {
          type: 'chi_doan',
          typeLabel: TICKET_TYPES.chi_doan.label,
          studentId: null,
          studentName: `Chi đoàn ${classConfig.className}`,
          category: 'Đề xuất phong trào',
          date: youthForm.date,
          description: `${youthForm.title.trim()} (${youthForm.participantCount || 0} ĐVTN) — ${youthForm.description}`,
          submittedByRole: currentRole.id,
          submittedByTitle: currentRole.title,
          submittedByUid: user.uid,
          status: 'pending',
          createdAt: serverTimestamp(),
          createdAtMs: Date.now()
        });
        showToast('Đã gửi đề xuất hoạt động Chi đoàn chờ GVCN duyệt!');
      }
      setYouthForm({ title: '', date: new Date().toISOString().split('T')[0], participantCount: 0, description: '', status: 'Sắp diễn ra' });
    } catch (err) {
      showToast('Lỗi xử lý hoạt động Chi đoàn: ' + err.message, 'error');
    }
  };

  // Phân tích & ánh xạ cột bảng điểm vnEdu
  const parseVneduMatrix = (matrix) => {
    const cleanRows = matrix
      .map(r => r.map(c => (c === null || c === undefined ? '' : String(c).trim())))
      .filter(r => r.some(c => c !== ''));
    if (cleanRows.length < 2) {
      setVneduErrors(['Dữ liệu bảng điểm chưa đủ dòng tiêu đề và dữ liệu học sinh.']);
      return;
    }

    let headerIdx = 0;
    for (let i = 0; i < Math.min(cleanRows.length, 15); i++) {
      const lineLow = cleanRows[i].join(' ').toLowerCase();
      if ((lineLow.includes('họ') && lineLow.includes('tên')) || lineLow.includes('ho_va_ten') || lineLow.includes('mã hs')) {
        headerIdx = i;
        break;
      }
    }

    const headers = cleanRows[headerIdx];
    const dataRows = cleanRows.slice(headerIdx + 1).filter(r => {
      const f = `${r[0] || ''} ${r[1] || ''}`.toLowerCase();
      return !f.includes('giáo viên') && !f.includes('ký tên') && !f.includes('tổng kết');
    });

    setVneduHeaders(headers);
    setVneduRows(dataRows);

    const autoMap = { code: '', fullName: '', tx1: '', tx2: '', gk: '', ck: '', note: '' };
    headers.forEach(h => {
      const low = h.toLowerCase();
      if (!autoMap.code && (low.includes('mã') || low.includes('ma_hs'))) autoMap.code = h;
      else if (!autoMap.fullName && (low.includes('họ') || low.includes('tên'))) autoMap.fullName = h;
      else if (!autoMap.tx1 && (low.includes('tx1') || low.includes('thường xuyên 1') || low.includes('đgtx 1'))) autoMap.tx1 = h;
      else if (!autoMap.tx2 && (low.includes('tx2') || low.includes('thường xuyên 2') || low.includes('đgtx 2'))) autoMap.tx2 = h;
      else if (!autoMap.gk && (low.includes('gk') || low.includes('giữa kỳ') || low.includes('đđggk'))) autoMap.gk = h;
      else if (!autoMap.ck && (low.includes('ck') || low.includes('cuối kỳ') || low.includes('đđgck'))) autoMap.ck = h;
      else if (!autoMap.note && (low.includes('chú') || low.includes('nhận xét'))) autoMap.note = h;
    });
    setColumnMapping(autoMap);
    buildVneduPreview(dataRows, headers, autoMap);
  };

  const buildVneduPreview = (rows, headers, mapping) => {
    const idxOf = (colName) => headers.indexOf(colName);
    const cCode = idxOf(mapping.code);
    const cName = idxOf(mapping.fullName);
    const cTx1 = idxOf(mapping.tx1);
    const cTx2 = idxOf(mapping.tx2);
    const cGk = idxOf(mapping.gk);
    const cCk = idxOf(mapping.ck);
    const cNote = idxOf(mapping.note);

    const errors = [];
    const preview = [];

    const parseScore = (val) => {
      if (val === '' || val === undefined || val === null) return null;
      const num = parseFloat(String(val).replace(',', '.'));
      if (isNaN(num)) return null;
      return num;
    };

    rows.forEach((r, rowIdx) => {
      const rawCode = cCode >= 0 ? r[cCode] : '';
      const rawName = cName >= 0 ? r[cName] : '';
      if (!rawCode && !rawName) return;

      const matchedStudent = students.find(
        s => (rawCode && s.code.toLowerCase() === rawCode.toLowerCase()) ||
             (rawName && s.fullName.toLowerCase().replace(/\s+/g, ' ').trim() === rawName.toLowerCase().replace(/\s+/g, ' ').trim())
      );

      if (!matchedStudent) {
        errors.push(`Dòng ${rowIdx + 1}: Không tìm thấy học sinh "${rawName || rawCode}" trong hồ sơ lớp ${classConfig.className}.`);
        return;
      }

      const tx1 = parseScore(cTx1 >= 0 ? r[cTx1] : '');
      const tx2 = parseScore(cTx2 >= 0 ? r[cTx2] : '');
      const gk = parseScore(cGk >= 0 ? r[cGk] : '');
      const ck = parseScore(cCk >= 0 ? r[cCk] : '');

      [tx1, tx2, gk, ck].forEach(sc => {
        if (sc !== null && (sc < 0 || sc > 10)) {
          errors.push(`Học sinh ${matchedStudent.fullName}: Có điểm nằm ngoài thang 0–10 (${sc}).`);
        }
      });

      let weightedSum = 0;
      let totalWeight = 0;
      if (tx1 !== null) { weightedSum += tx1 * 1; totalWeight += 1; }
      if (tx2 !== null) { weightedSum += tx2 * 1; totalWeight += 1; }
      if (gk !== null) { weightedSum += gk * 2; totalWeight += 2; }
      if (ck !== null) { weightedSum += ck * 3; totalWeight += 3; }

      const avg = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : null;

      preview.push({
        code: matchedStudent.code,
        fullName: matchedStudent.fullName,
        team: matchedStudent.team,
        tx1,
        tx2,
        gk,
        ck,
        avg,
        note: cNote >= 0 ? (r[cNote] || '') : ''
      });
    });

    setVneduErrors(errors);
    setVneduPreviewData(preview);
  };

  const handleVneduFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsReadingExcel(true);
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) {
        const XLSX = await ensureSheetJsLoaded();
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        setVneduRawText(matrix.filter(r => r.some(c => String(c).trim() !== '')).map(r => r.join('\t')).join('\n'));
        parseVneduMatrix(matrix);
      } else {
        const text = await file.text();
        setVneduRawText(text);
        const delimiter = text.includes('\t') ? '\t' : ',';
        const matrix = text.split(/\r?\n/).map(line => line.split(delimiter));
        parseVneduMatrix(matrix);
      }
      showToast(`Đã đọc tệp bảng điểm "${file.name}". Vui lòng kiểm tra ánh xạ cột trước khi xác nhận!`);
    } catch (err) {
      showToast('Lỗi đọc tệp Excel vnEdu: ' + err.message, 'error');
    } finally {
      setIsReadingExcel(false);
      e.target.value = '';
    }
  };

  const handleConfirmVneduImport = async () => {
    if (!db || !user || activeRoleId !== 'gvcn') {
      showToast('Chỉ GVCN mới có quyền xác nhận nhập bảng điểm chính thức.', 'error');
      return;
    }
    if (vneduPreviewData.length === 0) {
      showToast('Chưa có dữ liệu điểm hợp lệ để nhập.', 'error');
      return;
    }

    setIsImportingVnedu(true);
    try {
      const subKey = classConfig.subject.toLowerCase().replace(/[^a-z0-9]/g, '_');
      for (const item of vneduPreviewData) {
        const scoreDocId = `${item.code}_${subKey}`;
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', `scores_${classWorkspaceId}`, scoreDocId), {
          ...item,
          subject: classConfig.subject,
          updatedBy: classConfig.teacherName,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', `vnedu_imports_${classWorkspaceId}`), {
        subject: classConfig.subject,
        studentCount: vneduPreviewData.length,
        importedBy: `GVCN ${classConfig.teacherName}`,
        importedAtMs: Date.now(),
        importedAt: serverTimestamp()
      });

      showToast(`Đã lưu chính thức bảng điểm Môn ${classConfig.subject} cho ${vneduPreviewData.length} học sinh!`);
      setActiveTab('my_subject');
    } catch (err) {
      showToast('Lỗi lưu bảng điểm: ' + err.message, 'error');
    } finally {
      setIsImportingVnedu(false);
    }
  };

  const handleSaveGrade12Profile = async (e) => {
    e.preventDefault();
    if (!db || !user || activeRoleId !== 'gvcn' || !editingGrade12Student) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', `grade12_${classWorkspaceId}`, editingGrade12Student.code), {
        ...grade12Form,
        studentCode: editingGrade12Student.code,
        studentName: editingGrade12Student.fullName,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setEditingGrade12Student(null);
      showToast(`Đã cập nhật hồ sơ định hướng lớp 12 cho em ${editingGrade12Student.fullName}!`);
    } catch (err) {
      showToast('Lỗi lưu thông tin lớp 12: ' + err.message, 'error');
    }
  };

  const handleRunGeminiAnalysis = async () => {
    if (students.length === 0) {
      showToast('Cần có dữ liệu học sinh đã xác nhận trước khi phân tích.', 'error');
      return;
    }
    setIsGeneratingAiAnalysis(true);
    try {
      const apiKey = typeof __gemini_api_key !== 'undefined' ? __gemini_api_key : '';
      const subKey = classConfig.subject.toLowerCase().replace(/[^a-z0-9]/g, '_');

      const summaryLines = students.map(st => {
        const sc = subjectScores[`${st.code}_${subKey}`];
        const g12 = grade12Profiles[st.code];
        const lockedWeeks = weeklySnapshots.map(w => w.records?.[st.code]?.rank).filter(Boolean);
        return `- ${st.fullName} (Tổ ${st.team}): ĐTB ${classConfig.subject}=${sc?.avg ?? 'Chưa có'}, Thi đua tuần đã chốt=[${lockedWeeks.join(',') || 'Chưa chốt'}], Nguyện vọng=${g12?.examBlock || 'Chưa cập nhật'}`;
      }).join('\n');

      const prompt = `Bạn là trợ lý sư phạm cho GVCN ${classConfig.teacherName}, lớp ${classConfig.className}, trường ${classConfig.schoolName}.
Dưới đây là DỮ LIỆU ĐÃ XÁC NHẬN (tuyệt đối không tự bịa thêm số liệu, không tự kết luận mức rèn luyện cuối kỳ thay giáo viên):
- Sĩ số: ${stats.totalStudents} học sinh.
- ĐTB môn ${classConfig.subject}: ${stats.avgSubjectScore ?? 'Chưa có'}.
- Số tuần thi đua đã chốt: ${weeklySnapshots.length} tuần.
Chi tiết từng học sinh:
${summaryLines}

Hãy viết báo cáo phân tích ngắn gọn, nhân văn bằng tiếng Việt gồm 3 mục:
1. Điểm sáng và sự tiến bộ nổi bật của tập thể lớp.
2. Nhóm học sinh cần quan tâm hỗ trợ học tập bộ môn hoặc ôn thi tốt nghiệp THPT (chỉ nêu đúng theo số liệu trên).
3. Gợi ý 3 hoạt động sinh hoạt chủ nhiệm / phụ đạo thiết thực cho tuần tới.`;

      if (!apiKey) {
        const localSummary = [
          `1. ĐIỂM SÁNG TẬP THỂ LỚP ${classConfig.className}:`,
          `- Lớp hiện có ${stats.totalStudents} học sinh đã cập nhật hồ sơ, trong đó ${stats.scoredStudentsCount} em đã có điểm môn ${classConfig.subject} (ĐTB toàn lớp: ${stats.avgSubjectScore ?? 'Chưa có'}).`,
          `- Đã hoàn tất chốt sổ thi đua ${weeklySnapshots.length} tuần trên hệ thống.`,
          `\n2. NHÓM HỌC SINH CẦN QUAN TÂM HỖ TRỢ:`,
          stats.earlyWarnings.length > 0
            ? stats.earlyWarnings.map(w => `- Em ${w.fullName} (Tổ ${w.team}): ${w.reasons.join(', ')}.`).join('\n')
            : `- Chưa ghi nhận học sinh nào có cảnh báo điểm bộ môn dưới 5.5 trong dữ liệu đã xác nhận.`,
          `\n3. GỢI Ý HOẠT ĐỘNG SƯ PHẠM CHO GVCN ${classConfig.teacherName.toUpperCase()}:`,
          `- Tổ chức nhóm đôi bạn cùng tiến theo 4 tổ để hỗ trợ ôn tập môn ${classConfig.subject}.`,
          `- Rà soát minh chứng thi đua hằng tuần trước khi chốt sổ để kịp thời động viên các em tích cực phát biểu.`,
          `- Trao đổi định hướng tổ hợp xét tuyển Đại học/Cao đẳng cho học sinh khối 12.`
        ].join('\n');
        setAiAnalysisResult(localSummary);
        showToast('Đã tổng hợp báo cáo phân tích từ dữ liệu thật của lớp!');
        return;
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      );
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        setAiAnalysisResult(text);
        showToast('Gemini AI đã hoàn tất phân tích dữ liệu thật!');
      } else {
        throw new Error('Không nhận được phản hồi từ Gemini AI.');
      }
    } catch (err) {
      showToast('Lỗi phân tích AI: ' + err.message, 'error');
    } finally {
      setIsGeneratingAiAnalysis(false);
    }
  };

  const handleGenerateParentComm = async () => {
    const st = students.find(s => s.id === selectedCommStudentId);
    if (!st) return;
    setIsGeneratingComm(true);
    try {
      const subKey = classConfig.subject.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const sc = subjectScores[`${st.code}_${subKey}`];
      const purposeMap = {
        praise: 'khen ngợi sự tiến bộ và ý thức tích cực',
        grade12_consult: 'trao đổi phối hợp ôn thi tốt nghiệp THPT lớp 12',
        study_support: 'phối hợp động viên, hỗ trợ phương pháp học tập',
        attendance_remind: 'nhắc nhở tế nhị về chuyên cần và nề nếp'
      };
      const salutation = commTone === 'formal' ? 'Kính gửi Quý Phụ huynh em' : 'Chào anh/chị phụ huynh em';

      const msgDraft = `${salutation} ${st.fullName} (Lớp ${classConfig.className} - ${classConfig.schoolName}),\n` +
        `Cô/Thầy ${classConfig.teacherName} – GVCN lớp ${classConfig.className} xin trao đổi cùng gia đình về tình hình học tập và rèn luyện của em nhằm ${purposeMap[commPurpose] || 'phối hợp giáo dục'}.\n` +
        `${sc?.avg ? `Hiện tại điểm trung bình môn ${classConfig.subject} của em đạt ${sc.avg} điểm. ` : ''}` +
        `${commExtraContext ? `${commExtraContext.trim()} ` : ''}` +
        `Rất mong gia đình tiếp tục đồng hành, động viên để em giữ vững tinh thần học tập tốt nhất. Trân trọng cảm ơn Quý Phụ huynh!`;

      const reportDraft = `Em ${st.fullName} có ý thức chấp hành nội quy lớp học, tích cực tham gia các hoạt động tập thể của Tổ ${st.team} và Chi đoàn ${classConfig.className}. ` +
        `${sc?.avg >= 8 ? `Học lực môn ${classConfig.subject} đạt kết quả tốt (${sc.avg} điểm), có tinh thần tự giác cao.` : `Cần tiếp tục phát huy tính chủ động và rèn luyện kỹ năng làm bài để nâng cao kết quả học tập.`}`;

      setGeneratedMessage(msgDraft);
      setGeneratedReportCardDraft(reportDraft);
      showToast('Đã tạo bản nháp tin nhắn phụ huynh & nhận xét học bạ!');
    } finally {
      setIsGeneratingComm(false);
    }
  };

  // ==========================================================================
  // 6F. CÁC HÀM XỬ LÝ TRUNG TÂM HỖ TRỢ HỌC TẬP BỘ MÔN (NHÓM 1: 3 CHỨC NĂNG ĐẦU)
  // ==========================================================================
  const activeSubjectWorkspaceKey = useMemo(() => {
    const activeSubSlug = (classConfig.subject || 'toan').toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `${classWorkspaceId}_${activeSubSlug}`;
  }, [classWorkspaceId, classConfig.subject]);

  // Thêm chủ đề / kỹ năng kiến thức mới cho môn học hiện tại
  const handleAddKnowledgeTopic = async (e) => {
    e.preventDefault();
    if (!db || !user || activeRoleId !== 'gvcn') return;
    if (!newTopicForm.topicName.trim() || !newTopicForm.skillName.trim()) {
      showToast('Vui lòng nhập Tên chủ đề và Dạng bài / Kỹ năng cần đạt.', 'error');
      return;
    }
    try {
      const topicId = `TOP_${Date.now()}`;
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', `subject_topics_${activeSubjectWorkspaceKey}`, topicId), {
        id: topicId,
        semester: newTopicForm.semester,
        topicName: newTopicForm.topicName.trim(),
        skillName: newTopicForm.skillName.trim(),
        requirement: newTopicForm.requirement.trim(),
        createdBy: classConfig.teacherName,
        createdAtMs: Date.now()
      });
      setNewTopicForm(prev => ({ ...prev, skillName: '', requirement: '' }));
      showToast(`Đã thêm nội dung kiến thức vào môn ${classConfig.subject}!`);
    } catch (err) {
      showToast('Lỗi thêm nội dung kiến thức: ' + err.message, 'error');
    }
  };

  // Áp dụng mức độ hiểu bài hàng loạt cho các học sinh đã chọn
  const handleApplyBatchQuickCheckLevel = (level) => {
    if (qcSelectedIds.length === 0) {
      showToast('Hãy chọn ít nhất 1 học sinh để cập nhật hàng loạt.', 'error');
      return;
    }
    setQcDraftMap(prev => {
      const next = { ...prev };
      qcSelectedIds.forEach(code => {
        next[code] = { ...(next[code] || {}), level };
      });
      return next;
    });
    showToast(`Đã gán mức đánh giá cho ${qcSelectedIds.length} học sinh được chọn.`);
  };

  // Lưu kết quả kiểm tra nhanh mức độ hiểu bài lên Firestore (chỉ lưu các học sinh thực sự được đánh giá)
  const handleSaveQuickChecks = async () => {
    if (!db || !user || activeRoleId !== 'gvcn') {
      showToast('Chỉ giáo viên bộ môn / GVCN mới có quyền xác nhận đánh giá hiểu bài.', 'error');
      return;
    }
    const topicObj = knowledgeTopics.find(t => t.id === qcTopicId);
    if (!topicObj) {
      showToast('Vui lòng chọn Chủ đề & Nội dung kiến thức trước khi lưu.', 'error');
      return;
    }

    const entriesToSave = students.filter(st => {
      const d = qcDraftMap[st.code];
      return d && d.level && d.level !== 'unassessed';
    });

    if (entriesToSave.length === 0) {
      showToast('Chưa có học sinh nào được đánh giá (các em chưa đánh giá sẽ giữ nguyên trạng thái Chưa có dữ liệu).', 'error');
      return;
    }

    setIsSavingQuickCheck(true);
    try {
      for (const st of entriesToSave) {
        const draft = qcDraftMap[st.code];
        const recordId = `${qcDate}_${topicObj.id}_${st.code}`;
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', `subject_quick_checks_${activeSubjectWorkspaceKey}`, recordId), {
          date: qcDate,
          topicId: topicObj.id,
          topicName: topicObj.topicName,
          skillName: topicObj.skillName,
          semester: topicObj.semester,
          studentCode: st.code,
          studentName: st.fullName,
          team: Number(st.team),
          evidenceType: qcEvidenceType,
          level: draft.level, // mastered | consolidating | need_support
          note: (draft.note || '').trim(),
          confirmedBy: classConfig.teacherName,
          timestampMs: Date.now()
        }, { merge: true });
      }
      showToast(`Đã xác nhận đánh giá hiểu bài cho ${entriesToSave.length} học sinh!`);
    } catch (err) {
      showToast('Lỗi lưu kiểm tra nhanh: ' + err.message, 'error');
    } finally {
      setIsSavingQuickCheck(false);
    }
  };

  // Ghi nhận lỗi sai (hỗ trợ chọn nhiều học sinh cùng lúc cho 1 loại lỗi)
  const handleSaveErrorLogs = async (e) => {
    e.preventDefault();
    if (!db || !user || activeRoleId !== 'gvcn') {
      showToast('Chỉ giáo viên giảng dạy mới có quyền ghi nhận sổ tay lỗi sai.', 'error');
      return;
    }
    if (errSelectedStudentCodes.length === 0) {
      showToast('Vui lòng chọn ít nhất 1 học sinh mắc lỗi cần ghi nhận.', 'error');
      return;
    }
    const topicObj = knowledgeTopics.find(t => t.id === errTopicId);
    if (!topicObj) {
      showToast('Vui lòng chọn nội dung kiến thức liên quan.', 'error');
      return;
    }
    const finalCategory = errCategory === 'Lỗi khác do giáo viên nhập'
      ? (errCustomCategory.trim() || 'Lỗi khác')
      : errCategory;

    setIsSavingErrorLog(true);
    try {
      for (const code of errSelectedStudentCodes) {
        const st = students.find(s => s.code === code);
        if (!st) continue;
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', `subject_error_logs_${activeSubjectWorkspaceKey}`), {
          date: errDate,
          topicId: topicObj.id,
          topicName: topicObj.topicName,
          skillName: topicObj.skillName,
          semester: topicObj.semester,
          studentCode: st.code,
          studentName: st.fullName,
          team: Number(st.team),
          errorCategory: finalCategory,
          note: errNote.trim(),
          remedy: errRemedy.trim(),
          status: 'unfixed', // unfixed | fixed
          recordedBy: classConfig.teacherName,
          timestampMs: Date.now()
        });
      }
      setErrNote('');
      setErrRemedy('');
      setErrSelectedStudentCodes([]);
      showToast(`Đã ghi nhận lỗi "${finalCategory}" cho ${errSelectedStudentCodes.length} học sinh!`);
    } catch (err) {
      showToast('Lỗi lưu sổ tay lỗi sai: ' + err.message, 'error');
    } finally {
      setIsSavingErrorLog(false);
    }
  };

  // Chuyển đổi trạng thái Đã sửa / Chưa sửa trong Sổ tay lỗi sai
  const handleToggleErrorFixedStatus = async (errItem) => {
    if (!db || !user || activeRoleId !== 'gvcn') return;
    try {
      const nextStatus = errItem.status === 'fixed' ? 'unfixed' : 'fixed';
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', `subject_error_logs_${activeSubjectWorkspaceKey}`, errItem.id), {
        status: nextStatus,
        fixedAt: nextStatus === 'fixed' ? new Date().toISOString().split('T')[0] : null
      });
      showToast(nextStatus === 'fixed' ? 'Đã đánh dấu học sinh khắc phục xong lỗi!' : 'Đã chuyển lại trạng thái Chưa sửa.');
    } catch (err) {
      showToast('Lỗi cập nhật trạng thái lỗi: ' + err.message, 'error');
    }
  };

  const exportCsvFile = (filename, headers, rows) => {
    const escapeCell = (val) => {
      const str = val === null || val === undefined ? '' : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };
    const csvContent = '\uFEFF' + [headers.map(escapeCell).join(','), ...rows.map(r => r.map(escapeCell).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Đã xuất tệp ${filename}!`);
  };

  // ==========================================================================
  // 7. THỐNG KÊ CHÍNH XÁC BẰNG CHƯƠNG TRÌNH (KHÔNG DÙNG SỐ LIỆU GIẢ)
  // ==========================================================================
  const stats = useMemo(() => {
    const totalStudents = students.length;
    const pendingTickets = tickets.filter(t => t.status === 'pending');
    const approvedTickets = tickets.filter(t => t.status === 'approved');
    const rejectedTickets = tickets.filter(t => t.status === 'rejected');
    
    const avgMeritPoints = totalStudents > 0 
      ? Math.round(students.reduce((acc, s) => acc + Number(s.meritPoints ?? 100), 0) / totalStudents)
      : 0;

    // Tính tổng thu / tổng chi từ phiếu quỹ đã duyệt
    const approvedFundTickets = approvedTickets.filter(t => t.type === 'thu_chi');
    const totalIncome = approvedFundTickets
      .filter(t => t.category !== 'Chi quỹ')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const totalExpense = approvedFundTickets
      .filter(t => t.category === 'Chi quỹ')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    // Tính điểm trung bình môn giảng dạy hiện tại
    const currentSubjectKey = classConfig.subject.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const currentSubjectScores = Object.values(subjectScores).filter(
      s => s.id && s.id.endsWith(`_${currentSubjectKey}`) && typeof s.avg === 'number'
    );
    const avgSubjectScore = currentSubjectScores.length > 0
      ? (currentSubjectScores.reduce((sum, s) => sum + s.avg, 0) / currentSubjectScores.length).toFixed(2)
      : null;

    // Thống kê thi đua 4 Tổ theo thời gian thực (Kết hợp tuần đã chốt & dữ liệu hiện tại)
    const teamStandings = [1, 2, 3, 4].map(teamNum => {
      const members = students.filter(s => Number(s.team) === teamNum);
      const latestLocked = weeklySnapshots.length > 0 ? weeklySnapshots[weeklySnapshots.length - 1] : null;
      const lockedTeamInfo = latestLocked?.teamStats?.find(t => t.team === teamNum);
      return {
        team: teamNum,
        memberCount: lockedTeamInfo ? lockedTeamInfo.lockedSize : members.length,
        countA: lockedTeamInfo ? lockedTeamInfo.countA : 0,
        countB: lockedTeamInfo ? lockedTeamInfo.countB : 0,
        countC: lockedTeamInfo ? lockedTeamInfo.countC : 0,
        rateA: lockedTeamInfo ? lockedTeamInfo.rateA : 0
      };
    }).sort((a, b) => b.rateA - a.rateA);

    // Phổ điểm môn giảng dạy hiện tại
    const scoreDistribution = {
      gioi: currentSubjectScores.filter(s => s.avg >= 8.0).length,
      kha: currentSubjectScores.filter(s => s.avg >= 6.5 && s.avg < 8.0).length,
      trungBinh: currentSubjectScores.filter(s => s.avg >= 5.0 && s.avg < 6.5).length,
      canHoTro: currentSubjectScores.filter(s => s.avg < 5.0).length
    };

    // Danh sách cảnh báo sớm học sinh cần quan tâm (rèn luyện < 95 hoặc ĐTB môn < 5.5)
    const earlyWarnings = students.filter(st => {
      const sc = subjectScores[`${st.code}_${currentSubjectKey}`];
      const lowMerit = Number(st.meritPoints ?? 100) < 95;
      const lowScore = sc && typeof sc.avg === 'number' && sc.avg < 5.5;
      return lowMerit || lowScore;
    }).map(st => {
      const sc = subjectScores[`${st.code}_${currentSubjectKey}`];
      const reasons = [];
      if (Number(st.meritPoints ?? 100) < 95) reasons.push(`Điểm rèn luyện ${st.meritPoints}đ`);
      if (sc && typeof sc.avg === 'number' && sc.avg < 5.5) reasons.push(`ĐTB ${classConfig.subject}: ${sc.avg}`);
      return { ...st, reasons };
    });

    return {
      totalStudents,
      pendingCount: pendingTickets.length,
      approvedCount: approvedTickets.length,
      rejectedCount: rejectedTickets.length,
      avgMeritPoints,
      fundBalance: Number(classConfig.fundBalance || 0),
      totalIncome,
      totalExpense,
      approvedFundTickets,
      avgSubjectScore,
      scoredStudentsCount: currentSubjectScores.length,
      teamStandings,
      scoreDistribution,
      earlyWarnings
    };
  }, [students, tickets, classConfig.fundBalance, classConfig.subject, subjectScores]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchSearch = 
        (s.fullName || '').toLowerCase().includes(searchStudent.toLowerCase()) ||
        (s.code || '').toLowerCase().includes(searchStudent.toLowerCase());
      const matchTeam = filterTeam === 'all' || String(s.team) === String(filterTeam);
      return matchSearch && matchTeam;
    });
  }, [students, searchStudent, filterTeam]);

  // ==========================================================================
  // 8. GIAO DIỆN CHỜ KẾT NỐI FIREBASE
  // ==========================================================================
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-lg font-bold text-slate-800">Đang kết nối Firebase Authentication & Firestore...</h2>
        <p className="text-sm text-slate-500 mt-1">GVCN 360 AI PRO – Trợ lý chủ nhiệm thông minh</p>
      </div>
    );
  }

  // ==========================================================================
  // 9. GIAO DIỆN CHÍNH CỦA ỨNG DỤNG
  // ==========================================================================
  const navItems = [
    { id: 'dashboard', label: 'Dashboard điều hành', icon: LayoutDashboard },
    { id: 'students', label: 'Hồ sơ học sinh', icon: Users, count: stats.totalStudents },
    { id: 'attendance', label: 'Điểm danh hằng ngày', icon: ClipboardCheck },
    { id: 'emulation_standards', label: '1. Tiêu chuẩn thi đua', icon: ListChecks },
    { id: 'tickets', label: '2. Ghi nhận và đề xuất', icon: FilePlus2 },
    { id: 'moderation', label: '3. Trung tâm kiểm duyệt', icon: CheckCircle2, badge: stats.pendingCount },
    { id: 'discipline', label: '4. Thi đua cá nhân A/B/C', icon: Award },
    { id: 'team_emulation', label: '5. Thi đua 4 tổ', icon: Trophy },
    { id: 'semester_emulation', label: '6. Tổng hợp học kỳ', icon: Scale },
    { id: 'emulation_history', label: '7. Lịch sử điều chỉnh', icon: History },
    { id: 'fund', label: 'Sổ quỹ lớp', icon: DollarSign },
    { id: 'plans', label: 'Kế hoạch & Chi đoàn', icon: Calendar },
    { id: 'my_subject', label: `Môn tôi dạy (${classConfig.subject})`, icon: BookOpen },
    { id: 'vnedu_import', label: 'Nhập điểm Excel vnEdu', icon: FileSpreadsheet },
    { id: 'grade12', label: 'Theo dõi học tập lớp 12', icon: GraduationCap },
    { id: 'ai_analysis', label: 'Phân tích học tập AI', icon: Bot },
    { id: 'parent_comm', label: 'Nhận xét & Tin nhắn PH', icon: MessageSquareHeart },
    { id: 'reports', label: 'Báo cáo & Xuất dữ liệu', icon: FileBarChart2 },
    { id: 'roles', label: 'Phân quyền 8 vị trí', icon: ShieldCheck },
    { id: 'config', label: 'Cấu hình Lớp & Năm học', icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row font-sans">
      {/* Thông báo Toast nổi */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium transition-all ${
          toast.type === 'error' 
            ? 'bg-rose-950 text-white border-rose-700' 
            : 'bg-slate-900 text-white border-teal-500'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" /> : <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Sidebar điều hướng (Desktop) */}
      <aside className="hidden md:flex md:w-72 bg-[#0f172a] text-slate-100 flex-col shrink-0 border-r border-slate-800">
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight text-white">GVCN 360 AI PRO</h1>
              <p className="text-xs text-teal-400 font-medium">Phiên bản Hoàn thiện • 4.2</p>
            </div>
          </div>

          {/* Thẻ thông tin lớp đang quản lý */}
          <div className="mt-4 p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span>{classConfig.schoolName}</span>
              <span className="text-teal-400 font-semibold">{classConfig.schoolYear}</span>
            </div>
            <div className="font-bold text-sm text-white flex items-center justify-between">
              <span>Lớp {classConfig.className}</span>
              <span className="text-xs font-normal px-2 py-0.5 rounded bg-slate-700 text-slate-200">
                Môn {classConfig.subject}
              </span>
            </div>
            <div className="text-slate-300 pt-0.5">
              GVCN: <strong className="text-white">{classConfig.teacherName}</strong>
            </div>
          </div>
        </div>

        {/* Menu điều hướng */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active 
                    ? 'bg-teal-600 text-white shadow-md' 
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500 text-slate-950">
                    {item.badge}
                  </span>
                )}
                {item.count !== undefined && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Trạng thái kết nối Firebase Auth */}
        <div className="p-4 border-t border-slate-800 text-xs space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Firebase Firestore: Đã kết nối</span>
          </div>
          {user && (
            <div className="text-slate-400 truncate" title={user.uid}>
              UID: <span className="font-mono text-[11px] text-slate-300">{user.uid}</span>
            </div>
          )}
        </div>
      </aside>

      {/* Header Mobile */}
      <header className="md:hidden bg-[#0f172a] text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm">GVCN 360 AI PRO</div>
            <div className="text-[11px] text-teal-400">Lớp {classConfig.className} • {classConfig.schoolName}</div>
          </div>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-slate-800 text-slate-200"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs" onClick={() => setMobileMenuOpen(false)}>
          <div className="w-72 bg-[#0f172a] h-full p-4 space-y-2 text-white" onClick={e => e.stopPropagation()}>
            <div className="pb-3 mb-3 border-b border-slate-800 font-bold text-teal-400">
              Menu Điều Hành Lớp {classConfig.className}
            </div>
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm ${
                    activeTab === item.id ? 'bg-teal-600 text-white font-semibold' : 'text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge > 0 && (
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500 text-slate-950">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Khu vực nội dung chính */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Thanh chuyển đổi Vai trò vận hành (Role Switcher phục vụ phân quyền & kiểm thử thực tế) */}
        <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 md:static z-20">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Vai trò phiên làm việc:</span>
            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${currentRole.badgeColor}`}>
              {currentRole.title}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="role-select" className="text-xs text-slate-500 hidden sm:inline">Chuyển đổi vị trí kiểm thử:</label>
            <select
              id="role-select"
              value={activeRoleId}
              onChange={(e) => setActiveRoleId(e.target.value)}
              className="text-xs sm:text-sm font-medium bg-slate-100 border border-slate-300 rounded-xl px-3 py-1.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-600"
            >
              {ROLES.map(role => (
                <option key={role.id} value={role.id}>
                  {role.title} {role.id === 'gvcn' ? `(${classConfig.teacherName})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Nội dung từng phân hệ */}
        <div className="p-4 md:p-8 max-w-7xl w-full mx-auto space-y-6">
          
          {/* ================================================================
              TAB 5: TRUNG TÂM KIỂM DUYỆT (CHỐNG TRÙNG, DUYỆT HÀNG LOẠT & LỊCH SỬ)
             ================================================================ */}
          {activeTab === 'moderation' && (
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
                    Chờ duyệt toàn lớp: {stats.pendingCount} phiếu
                  </span>
                </div>
              </div>

              {/* Báo cáo kết quả sau đợt duyệt hàng loạt */}
              {batchApprovalReport && (
                <div className="p-4 rounded-2xl bg-teal-50 border border-teal-300 text-xs text-teal-950 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-sm text-[#102744]">
                      Kết quả đợt duyệt hàng loạt ({batchApprovalReport.timestamp}): Đã duyệt {batchApprovalReport.successCount}/{batchApprovalReport.totalScopeCount} phiếu. {batchApprovalReport.needReviewCount} phiếu cần xem lại.
                    </div>
                    <button onClick={() => setBatchApprovalReport(null)} className="text-slate-500 hover:text-slate-800 font-bold">Đóng</button>
                  </div>
                  <div className="text-slate-600">Mã lô kiểm duyệt (Batch ID): <code className="font-mono font-bold">{batchApprovalReport.batchId}</code></div>
                  {batchApprovalReport.failedItems.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-1">
                      <div className="font-bold">Các phiếu không duyệt được do xung đột phiên bản / trạng thái:</div>
                      {batchApprovalReport.failedItems.map((f, idx) => (
                        <div key={idx}>• {f.ticket.studentName}: {f.reason}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Thanh Bộ lọc Phạm vi & Công cụ Duyệt Hàng Loạt (Chỉ GVCN mới thấy nút duyệt) */}
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
                      <option value="pending">Trạng thái: Chờ duyệt ({tickets.filter(t => t.status === 'pending').length})</option>
                      <option value="needs_revision">Cần sửa / Tranh chấp ({tickets.filter(t => t.status === 'needs_revision').length})</option>
                      <option value="approved">Đã phê duyệt ({tickets.filter(t => t.status === 'approved').length})</option>
                      <option value="rejected">Đã từ chối ({tickets.filter(t => t.status === 'rejected').length})</option>
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
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>

                  {activeRoleId === 'gvcn' && currentRole.canApprove && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          const allEligibleIds = eligibleFilteredTickets.map(t => t.id);
                          const isAllSelected = allEligibleIds.length > 0 && allEligibleIds.every(id => selectedTicketIds.includes(id));
                          setSelectedTicketIds(isAllSelected ? [] : allEligibleIds);
                        }}
                        disabled={eligibleFilteredTickets.length === 0}
                        className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-bold"
                      >
                        {eligibleFilteredTickets.length > 0 && eligibleFilteredTickets.every(t => selectedTicketIds.includes(t.id))
                          ? 'Bỏ chọn tất cả'
                          : `Chọn tất cả phiếu đủ điều kiện ở bộ lọc hiện tại (${eligibleFilteredTickets.length})`}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenBatchConfirmModal('selected')}
                        disabled={selectedTicketIds.length === 0}
                        className="px-3.5 py-2 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 disabled:opacity-50 text-white font-bold shadow-xs"
                      >
                        Duyệt các phiếu đã chọn ({selectedTicketIds.length})
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenBatchConfirmModal('all_eligible')}
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
                    Phạm vi áp dụng: <strong>{classConfig.schoolName} • Lớp {classConfig.className} • {classConfig.schoolYear}</strong>. Không duyệt ngầm phiếu ngoài lớp hoặc ngoài bộ lọc.
                  </span>
                  <span>
                    Đủ điều kiện duyệt lô: <strong className="text-emerald-700">{eligibleFilteredTickets.length}</strong> • Cần xem riêng: <strong className="text-amber-700">{filteredModerationTickets.length - eligibleFilteredTickets.length}</strong>
                  </span>
                </div>
              </div>

              {filteredModerationTickets.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                  <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="font-bold text-slate-700">Không có phiếu nào trong bộ lọc hiện tại</h3>
                  <p className="text-sm text-slate-500 mt-1">Hãy thay đổi bộ lọc trạng thái/loại phiếu hoặc lập phiếu mới ở mục "2. Ghi nhận và đề xuất".</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredModerationTickets.map(ticket => {
                    const typeMeta = TICKET_TYPES[ticket.type] || TICKET_TYPES.ne_nep;
                    const Icon = typeMeta.icon;
                    const isPending = ticket.status === 'pending';
                    const eligibility = evaluateTicketBatchEligibility(ticket);
                    const isChecked = selectedTicketIds.includes(ticket.id);

                    return (
                      <div key={ticket.id} className={`bg-white p-5 rounded-2xl border shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                        isChecked ? 'border-[#0C9BA6] ring-2 ring-[#0C9BA6]/15' : 'border-slate-200'
                      }`}>
                        <div className="flex items-start gap-3.5">
                          {/* Checkbox chọn từng phiếu (chỉ khả dụng với phiếu đủ điều kiện & GVCN) */}
                          {activeRoleId === 'gvcn' && currentRole.canApprove && (
                            <div className="pt-1">
                              <input
                                type="checkbox"
                                disabled={!eligibility.eligible}
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedTicketIds(prev => [...prev, ticket.id]);
                                  else setSelectedTicketIds(prev => prev.filter(id => id !== ticket.id));
                                }}
                                title={eligibility.eligible ? 'Chọn phiếu này để duyệt hàng loạt' : eligibility.reason}
                                className="w-4 h-4 rounded border-slate-300 text-[#0C9BA6] focus:ring-[#0C9BA6] disabled:opacity-40"
                              />
                            </div>
                          )}

                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${typeMeta.color}`}>
                                <Icon className="w-3.5 h-3.5" />
                                <span>{ticket.typeLabel}</span>
                              </span>

                              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                ticket.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                                ticket.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                                ticket.status === 'needs_revision' ? 'bg-orange-100 text-orange-800' :
                                'bg-rose-100 text-rose-800'
                              }`}>
                                {ticket.status === 'pending' ? 'Chờ duyệt' :
                                 ticket.status === 'approved' ? 'Đã phê duyệt' :
                                 ticket.status === 'needs_revision' ? 'Yêu cầu chỉnh sửa' : 'Đã từ chối'}
                              </span>

                              {/* Nhãn phân loại rõ ràng: Đủ điều kiện duyệt lô hoặc Cần xem riêng */}
                              {isPending && (
                                eligibility.eligible ? (
                                  <span className="px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold">
                                    ✓ Đủ điều kiện duyệt lô
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold" title={eligibility.reason}>
                                    ⚠ Cần xem riêng: {eligibility.reason}
                                  </span>
                                )
                              )}

                              <span className="text-xs text-slate-400">Ngày: {ticket.date} • v{ticket.version || 1}</span>
                            </div>

                            <div className="font-bold text-slate-900 text-base">
                              {ticket.studentName}
                              {ticket.type === 'ne_nep' && (
                                <span className="ml-2 text-xs font-bold text-[#0C9BA6]">
                                  ({ticket.weekLabel || 'Tuần 1'} • {ticket.category})
                                </span>
                              )}
                              {ticket.type === 'thu_chi' && (
                                <span className={`ml-2 text-xs font-bold ${ticket.category === 'Chi quỹ' ? 'text-rose-600' : 'text-emerald-600'}`}>
                                  ({ticket.category}: {Number(ticket.amount).toLocaleString('vi-VN')} đ)
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

                        {/* Nút hành động từng phiếu (vẫn cho phép GVCN duyệt riêng các phiếu "Cần xem riêng") */}
                        {(isPending || ticket.status === 'needs_revision') && (
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {activeRoleId === 'gvcn' && currentRole.canApprove ? (
                              <>
                                <button
                                  onClick={() => handleModerateTicket(ticket, 'approved')}
                                  disabled={processingTicketId === ticket.id}
                                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                                >
                                  <Check className="w-4 h-4" />
                                  <span>Duyệt</span>
                                </button>
                                <button
                                  onClick={() => handleModerateTicket(ticket, 'needs_revision')}
                                  disabled={processingTicketId === ticket.id}
                                  className="px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 disabled:opacity-50 text-amber-900 text-xs font-bold flex items-center gap-1.5"
                                >
                                  <Edit3 className="w-4 h-4" />
                                  <span>Yêu cầu sửa</span>
                                </button>
                                <button
                                  onClick={() => handleModerateTicket(ticket, 'rejected')}
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

              {/* Nhật ký kiểm duyệt không thể xóa (Audit Log) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-[#102744] flex items-center gap-2">
                    <History className="w-4 h-4 text-[#0C9BA6]" />
                    <span>Nhật ký Kiểm duyệt & Lưu vết Phê duyệt ({auditLogs.length} bản ghi)</span>
                  </h3>
                  <span className="text-[11px] text-slate-400">Lưu vết bất biến — Không hỗ trợ hoàn tác xóa lịch sử</span>
                </div>
                {auditLogs.length === 0 ? (
                  <p className="text-xs text-slate-500">Chưa có lịch sử kiểm duyệt nào.</p>
                ) : (
                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs">
                    {auditLogs.slice(0, 20).map(log => (
                      <div key={log.id} className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div>
                          <span className="font-bold text-[#102744]">[{log.action}]</span>{' '}
                          <span className="text-slate-800">{log.summary}</span>
                          {log.approvalId && <span className="ml-2 font-mono text-[11px] text-teal-700">({log.approvalId})</span>}
                        </div>
                        <span className="text-slate-400 shrink-0">{log.approvedBy}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================
              TAB 6: CẤU HÌNH TRƯỜNG / LỚP / NĂM HỌC / MÔN DẠY
             ================================================================ */}
          {activeTab === 'config' && (
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
                    {savedWorkspaces.map(ws => {
                      const isCurrentWs = ws.schoolName === classConfig.schoolName && ws.className === classConfig.className && ws.schoolYear === classConfig.schoolYear;
                      return (
                        <button
                          key={ws.id}
                          type="button"
                          onClick={() => handleSwitchWorkspace(ws)}
                          className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                            isCurrentWs
                              ? 'bg-teal-50 border-teal-500 text-teal-950'
                              : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                          }`}
                        >
                          <div>
                            <div className="font-bold text-xs">{ws.schoolName} • Lớp {ws.className}</div>
                            <div className="text-[11px] text-slate-500">Năm học {ws.schoolYear} • GV: {ws.teacherName} ({ws.subject})</div>
                          </div>
                          {isCurrentWs && <span className="px-2 py-0.5 rounded bg-teal-600 text-white text-[10px] font-bold">Đang mở</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <form onSubmit={handleSaveConfig} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
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
                    Bạn đang ở vai trò {currentRole.title}. Chuyển sang vai trò Giáo viên chủ nhiệm để chỉnh sửa cấu hình.
                  </div>
                )}
              </form>
            </div>
          )}

        </div>
      </main>

      {/* Modal Thêm / Sửa Hồ Sơ Học Sinh */}
      {showStudentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-lg text-slate-900">
                {editingStudent ? 'Cập nhật hồ sơ học sinh' : 'Thêm học sinh mới'}
              </h3>
              <button onClick={() => setShowStudentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-3.5 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Mã học sinh</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingStudent}
                    value={studentForm.code}
                    onChange={(e) => setStudentForm({ ...studentForm, code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 disabled:bg-slate-100"
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
                    onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  >
                    <option value="Nữ">Nữ</option>
                    <option value="Nam">Nam</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Ngày sinh</label>
                  <input
                    type="date"
                    value={studentForm.dob}
                    onChange={(e) => setStudentForm({ ...studentForm, dob: e.target.value })}
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
                    {ROLES.filter(r => r.id !== 'gvcn').map(r => (
                      <option key={r.id} value={r.id}>{r.title}</option>
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
                    {ROLES.filter(r => r.id !== 'gvcn' && r.id !== studentForm.role).map(r => (
                      <option key={r.id} value={r.id}>{r.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">SĐT Phụ huynh (Bảo mật - Chỉ GVCN truy cập)</label>
                <input
                  type="text"
                  value={studentForm.parentPhone}
                  onChange={(e) => setStudentForm({ ...studentForm, parentPhone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowStudentModal(false)}
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
      )}

      {/* Modal Cập Nhật Định Hướng Thi & Học Tập Lớp 12 */}
      {editingGrade12Student && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Định hướng Tốt nghiệp & Đại học Lớp 12</h3>
                <p className="text-xs text-slate-500">Học sinh: <strong>{editingGrade12Student.fullName}</strong> ({editingGrade12Student.code})</p>
              </div>
              <button onClick={() => setEditingGrade12Student(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGrade12Profile} className="space-y-3.5 text-sm">
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
                  onClick={() => setEditingGrade12Student(null)}
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
      )}

      {/* Modal Xác Nhận Lần 2 Trước Khi Duyệt Hàng Loạt (Phần A) */}
      {batchConfirmModal && (
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
                onClick={() => setBatchConfirmModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 pr-1 flex-1 text-xs">
              {/* Tóm tắt phạm vi & thống kê số lượng */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-500 font-semibold">Bộ lọc đang áp dụng</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {modFilterType === 'all' ? 'Tất cả loại phiếu' : TICKET_TYPES[modFilterType]?.label} ({modFilterStatus})
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="text-emerald-700 font-semibold">Phiếu đủ điều kiện duyệt</div>
                  <div className="text-lg font-extrabold text-emerald-900 mt-0.5">{batchConfirmModal.eligibleTickets.length} phiếu</div>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="text-amber-800 font-semibold">Phiếu loại ra (Cần xem riêng)</div>
                  <div className="text-lg font-extrabold text-amber-950 mt-0.5">{batchConfirmModal.excludedTickets.length} phiếu</div>
                </div>
              </div>

              {/* Danh sách phiếu sẽ được duyệt */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-3.5 py-2 font-bold text-slate-800">
                  Danh sách {batchConfirmModal.eligibleTickets.length} phiếu sẽ chuyển sang ĐÃ PHÊ DUYỆT:
                </div>
                <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
                  {batchConfirmModal.eligibleTickets.map(tk => (
                    <div key={tk.id} className="px-3.5 py-2 flex items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-900">{tk.studentName}</span>
                        <span className="text-slate-500 ml-1.5">— {tk.typeLabel}: {tk.description}</span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-400 shrink-0">v{tk.version || 1}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Danh sách phiếu bị loại khỏi đợt duyệt lô kèm lý do */}
              {batchConfirmModal.excludedTickets.length > 0 && (
                <div className="border border-rose-200 rounded-xl overflow-hidden bg-rose-50/40">
                  <div className="bg-rose-100/70 px-3.5 py-2 font-bold text-rose-900">
                    Các phiếu không duyệt hàng loạt ({batchConfirmModal.excludedTickets.length} phiếu — Giữ nguyên để GVCN xem riêng):
                  </div>
                  <div className="max-h-32 overflow-y-auto divide-y divide-rose-100">
                    {batchConfirmModal.excludedTickets.map((item, idx) => (
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
                onClick={() => setBatchConfirmModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isBatchApproving}
                onClick={handleExecuteBatchApproval}
                className="px-5 py-2 rounded-xl bg-[#0C9BA6] hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs"
              >
                {isBatchApproving ? 'Đang phê duyệt an toàn...' : `Xác nhận duyệt ${batchConfirmModal.eligibleTickets.length} phiếu`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nhập Danh Sách Học Sinh Hàng Loạt (Excel / Dán nhanh) */}
      {showBulkStudentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Nhập Danh Sách Học Sinh Mới Hàng Loạt</h3>
                <p className="text-xs text-slate-500">Tải lên tệp Excel (.xls / .xlsx / .csv) từ vnEdu hoặc dán trực tiếp danh sách họ tên học sinh.</p>
              </div>
              <button onClick={() => setShowBulkStudentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 pr-1 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-xs font-medium text-slate-600">Cách 1: Chọn tệp Excel danh sách lớp (.xls, .xlsx, .csv)</span>
                <label className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Tải tệp Excel danh sách HS</span>
                  <input type="file" accept=".xls,.xlsx,.csv,.txt" onChange={handleBulkExcelUpload} className="hidden" />
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Cách 2: Dán trực tiếp từ Excel hoặc nhập mỗi học sinh 1 dòng (Hỗ trợ tự nhận diện cột Họ tên, Giới tính, Tổ, SĐT)
                </label>
                <textarea
                  rows={5}
                  value={bulkStudentText}
                  onChange={(e) => handleBulkTextChange(e.target.value)}
                  placeholder={`Ví dụ:\nSTT\tHọ và tên\tGiới tính\tTổ\tSĐT\n1\tNguyễn Văn An\tNam\t1\t0901234567\n2\tTrần Thị Bình\tNữ\t2\t0907654321`}
                  className="w-full p-3 rounded-xl border border-slate-300 font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              {bulkPreviewList.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-900 flex items-center justify-between">
                    <span>Xem trước danh sách nhận diện được: {bulkPreviewList.length} học sinh</span>
                    <span className="font-normal text-indigo-700">Có thể chỉnh trực tiếp Tổ (1–4) bên dưới</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase">
                          <th className="py-2 px-3">Mã HS</th>
                          <th className="py-2 px-3">Họ và tên</th>
                          <th className="py-2 px-3">Giới tính</th>
                          <th className="py-2 px-3">Tổ</th>
                          <th className="py-2 px-3">SĐT Phụ huynh</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bulkPreviewList.map((st, idx) => (
                          <tr key={idx}>
                            <td className="py-2 px-3 font-mono font-bold text-slate-600">{st.code}</td>
                            <td className="py-2 px-3 font-semibold text-slate-900">{st.fullName}</td>
                            <td className="py-2 px-3">
                              <select
                                value={st.gender}
                                onChange={(e) => {
                                  const next = [...bulkPreviewList];
                                  next[idx].gender = e.target.value;
                                  setBulkPreviewList(next);
                                }}
                                className="px-2 py-1 rounded border border-slate-200 bg-white"
                              >
                                <option value="Nữ">Nữ</option>
                                <option value="Nam">Nam</option>
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <select
                                value={st.team}
                                onChange={(e) => {
                                  const next = [...bulkPreviewList];
                                  next[idx].team = Number(e.target.value);
                                  setBulkPreviewList(next);
                                }}
                                className="px-2 py-1 rounded border border-slate-200 bg-white"
                              >
                                <option value={1}>Tổ 1</option>
                                <option value={2}>Tổ 2</option>
                                <option value={3}>Tổ 3</option>
                                <option value={4}>Tổ 4</option>
                              </select>
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-600">{st.parentPhone || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setShowBulkStudentModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isSavingBulkStudents || bulkPreviewList.length === 0}
                onClick={handleSaveBulkStudents}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs"
              >
                {isSavingBulkStudents ? 'Đang lưu vào Firestore...' : `Lưu tất cả (${bulkPreviewList.length} học sinh)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}