import {
  UserCheck,
  Award,
  DollarSign,
  Activity,
  BookOpen,
} from 'lucide-react';
import type { EmulationStandards, RoleDefinition, TicketType } from '../types/gvcn';

export const VNEDU_SUBJECTS = [
  'Toán',
  'Ngữ văn',
  'Ngoại ngữ',
  'Lịch sử',
  'Giáo dục quốc phòng và an ninh',
  'Giáo dục kinh tế và pháp luật',
  'Địa lí',
  'Vật lí',
  'Hóa học',
  'Sinh học',
  'Công nghệ',
  'Tin học',
] as const;

export const ROLES: RoleDefinition[] = [
  {
    id: 'gvcn',
    title: 'Giáo viên chủ nhiệm',
    badgeColor: 'bg-indigo-900 text-white',
    scope: 'Toàn quyền quản trị lớp, phê duyệt phiếu, cấu hình năm học & AI',
    canApprove: true,
    allowedTicketTypes: ['diem_danh', 'ne_nep', 'thu_chi', 'chi_doan', 'hoc_tap'],
  },
  {
    id: 'lop_truong',
    title: 'Lớp trưởng',
    badgeColor: 'bg-teal-700 text-white',
    scope: 'Chỉ lập phiếu điểm danh cả lớp, theo dõi sĩ số hằng ngày',
    canApprove: false,
    allowedTicketTypes: ['diem_danh'],
  },
  {
    id: 'to_truong_1',
    title: 'Tổ trưởng Tổ 1',
    badgeColor: 'bg-sky-700 text-white',
    scope: 'Ghi nhận điểm danh, thi đua & chỉnh sửa xếp loại A/B/C Tổ 1 (GVCN kiểm tra & chốt sổ)',
    team: 1,
    canApprove: false,
    allowedTicketTypes: ['diem_danh', 'ne_nep'],
  },
  {
    id: 'to_truong_2',
    title: 'Tổ trưởng Tổ 2',
    badgeColor: 'bg-sky-700 text-white',
    scope: 'Ghi nhận điểm danh, thi đua & chỉnh sửa xếp loại A/B/C Tổ 2 (GVCN kiểm tra & chốt sổ)',
    team: 2,
    canApprove: false,
    allowedTicketTypes: ['diem_danh', 'ne_nep'],
  },
  {
    id: 'to_truong_3',
    title: 'Tổ trưởng Tổ 3',
    badgeColor: 'bg-sky-700 text-white',
    scope: 'Ghi nhận điểm danh, thi đua & chỉnh sửa xếp loại A/B/C Tổ 3 (GVCN kiểm tra & chốt sổ)',
    team: 3,
    canApprove: false,
    allowedTicketTypes: ['diem_danh', 'ne_nep'],
  },
  {
    id: 'to_truong_4',
    title: 'Tổ trưởng Tổ 4',
    badgeColor: 'bg-sky-700 text-white',
    scope: 'Ghi nhận điểm danh, thi đua & chỉnh sửa xếp loại A/B/C Tổ 4 (GVCN kiểm tra & chốt sổ)',
    team: 4,
    canApprove: false,
    allowedTicketTypes: ['diem_danh', 'ne_nep'],
  },
  {
    id: 'thu_quy',
    title: 'Thủ quỹ lớp',
    badgeColor: 'bg-amber-700 text-white',
    scope: 'Chỉ lập phiếu thu/chi quỹ lớp, đề xuất quyết toán minh bạch',
    canApprove: false,
    allowedTicketTypes: ['thu_chi'],
  },
  {
    id: 'bi_thu',
    title: 'Bí thư Chi đoàn',
    badgeColor: 'bg-rose-700 text-white',
    scope: 'Chỉ báo cáo và đề xuất hoạt động Chi đoàn, phong trào thanh niên',
    canApprove: false,
    allowedTicketTypes: ['chi_doan'],
  },
];

export const TICKET_TYPES: Record<
  TicketType,
  { label: string; icon: typeof UserCheck; color: string }
> = {
  diem_danh: { label: 'Phiếu Điểm danh', icon: UserCheck, color: 'text-blue-700 bg-blue-50 border-blue-200' },
  ne_nep: { label: 'Phiếu Thi đua / Vi phạm (A/B/C)', icon: Award, color: 'text-teal-700 bg-teal-50 border-teal-200' },
  thu_chi: { label: 'Phiếu Thu / Chi Quỹ lớp', icon: DollarSign, color: 'text-amber-700 bg-amber-50 border-amber-200' },
  chi_doan: { label: 'Hoạt động Chi đoàn', icon: Activity, color: 'text-rose-700 bg-rose-50 border-rose-200' },
  hoc_tap: { label: 'Ghi nhận Học tập', icon: BookOpen, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
};

export const DEFAULT_EMULATION_STANDARDS: EmulationStandards = {
  gradeA: [
    {
      id: 'A1',
      title: 'Không vi phạm nội quy, có phát biểu ít nhất 1 lần / có tham gia đầy đủ, tích cực các hoạt động nhóm.',
      requiresEvidence: true,
    },
    {
      id: 'A2',
      title: 'Có vi phạm ở mức xếp loại B nhưng đã kịp thời khắc phục, đồng thời cũng có hoạt động đóng góp, xây dựng tập thể lớp, trường.',
      requiresEvidence: true,
    },
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
    { id: 'B20', text: 'Tùy tiện đổi nhiệm vụ giáo viên đã giao', conditional: false },
  ],
  gradeC: [
    { id: 'C01', text: 'Vắng không phép', conditional: false },
    { id: 'C02', text: 'Đi trễ không trình diện quản sinh', conditional: false },
    { id: 'C03', text: 'Mang điện thoại vào trường', conditional: false },
    { id: 'C04', text: 'Không thực hiện nhiệm vụ Thầy, Cô, Ban cán sự lớp giao', conditional: false },
    { id: 'C05', text: 'Nói tục, chửi thề', conditional: false },
    { id: 'C06', text: 'Mang đồ ăn, thức uống lên phòng học', conditional: false },
    { id: 'C07', text: 'Lừa dối giáo viên', conditional: false },
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
    { id: 'S09', text: 'Phát ngôn sai trên mạng xã hội, sử dụng mạng xã hội gây ảnh hưởng xấu đến người khác', repeatRequired: false },
  ],
  semesterRules: {
    cToBWeight: 2,
    totMaxB: 4,
    khaMinB: 5,
    khaMaxB: 8,
    datMinB: 9,
    datMaxB: 12,
    minWeeksRequired: 12,
  },
};

export const INITIAL_SAMPLE_STUDENTS = [
  { code: 'HS001', fullName: 'Nguyễn Minh Anh', gender: 'Nữ' as const, dob: '2009-03-15', team: 1, role: 'lop_truong', parentPhone: '0912345601', note: 'Gương mẫu, học giỏi Toán' },
  { code: 'HS002', fullName: 'Trần Hoàng Bảo', gender: 'Nam' as const, dob: '2009-07-22', team: 1, role: 'to_truong_1', parentPhone: '0912345602', note: 'Nhiệt tình, năng nổ' },
  { code: 'HS003', fullName: 'Lê Thị Thu Hà', gender: 'Nữ' as const, dob: '2009-11-08', team: 2, role: 'to_truong_2', parentPhone: '0912345603', note: 'Cẩn thận, trách nhiệm cao' },
  { code: 'HS004', fullName: 'Phạm Quốc Khánh', gender: 'Nam' as const, dob: '2009-09-02', team: 2, role: 'bi_thu', parentPhone: '0912345604', note: 'Năng khiếu văn nghệ, phong trào' },
  { code: 'HS005', fullName: 'Võ Ngọc Lan', gender: 'Nữ' as const, dob: '2009-05-19', team: 3, role: 'thu_quy', parentPhone: '0912345605', note: 'Trung thực, tính toán chính xác' },
  { code: 'HS006', fullName: 'Đặng Tuấn Kiệt', gender: 'Nam' as const, dob: '2009-01-30', team: 3, role: 'to_truong_3', parentPhone: '0912345606', note: 'Hòa đồng, hay giúp đỡ bạn' },
  { code: 'HS007', fullName: 'Huỳnh Thảo Vy', gender: 'Nữ' as const, dob: '2009-12-12', team: 4, role: 'to_truong_4', parentPhone: '0912345607', note: 'Chăm chỉ, chữ viết đẹp' },
  { code: 'HS008', fullName: 'Bùi Đức Trọng', gender: 'Nam' as const, dob: '2009-04-10', team: 4, role: 'member', parentPhone: '0912345608', note: 'Cần lưu ý đi học đúng giờ' },
];

export const SAMPLE_VNEDU_CSV = `STT,Ma_HS,Ho_Va_Ten,Diem_TX1,Diem_TX2,Diem_GK,Diem_CK,Ghi_Chu
1,HS001,Nguyễn Minh Anh,9.0,9.5,9.0,9.5,Tư duy tốt
2,HS002,Trần Hoàng Bảo,8.0,8.5,8.0,8.5,Tiến bộ rõ rệt
3,HS003,Lê Thị Thu Hà,8.5,9.0,8.5,9.0,Chăm chỉ
4,HS004,Phạm Quốc Khánh,7.0,7.5,7.0,7.5,Cần luyện thêm hình học
5,HS005,Võ Ngọc Lan,8.5,8.0,8.5,9.0,Nắm chắc kiến thức
6,HS006,Đặng Tuấn Kiệt,6.5,7.0,6.5,7.0,Cần tập trung hơn
7,HS007,Huỳnh Thảo Vy,9.0,9.0,8.5,9.0,Xuất sắc
8,HS008,Bùi Đức Trọng,5.5,6.0,5.0,6.0,Cần phụ đạo thêm`;

export const DEFAULT_ERROR_CATEGORIES = [
  'Chưa hiểu khái niệm',
  'Nhầm công thức',
  'Sai điều kiện áp dụng',
  'Sai biến đổi hoặc tính toán',
  'Chưa chọn được phương pháp',
  'Đọc thiếu dữ kiện',
  'Lập luận hoặc trình bày chưa chính xác',
  'Lỗi khác do giáo viên nhập',
];

export const WEEK_OPTIONS = Array.from({ length: 35 }, (_, i) => `Tuần ${i + 1}`);
export const MONTH_OPTIONS = ['Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5'];

export function normalizeSlug(value: string, fallback = 'default'): string {
  const cleaned = (value || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return cleaned || fallback;
}
