import type { StudentRecord } from '../types/gvcn';

export type WheelScopeMode = 'all' | 'team_1' | 'team_2' | 'team_3' | 'team_4' | 'manual';
export type WheelRepeatMode = 'no_repeat' | 'allow_repeat';

export interface SafeWheelStudent {
  id: string;
  code: string;
  fullName: string;
  team: number;
}

export interface WheelSpinHistoryItem {
  id: string;
  turnNumber: number;
  studentCode: string;
  studentName: string;
  team: number;
  timestampMs: number;
  scopeLabel: string;
}

export interface WheelColorToken {
  bg: string;
  text: string;
  name: string;
}

/**
 * Bảng màu rực rỡ hài hòa với giao diện sáng navy-teal của GVCN 360 AI PRO:
 * xanh ngọc, xanh dương, vàng, cam, hồng, tím nhạt, ngọc lam sáng, san hô.
 */
export const WHEEL_PALETTE: WheelColorToken[] = [
  { bg: '#0D9488', text: '#FFFFFF', name: 'Xanh ngọc' },
  { bg: '#0284C7', text: '#FFFFFF', name: 'Xanh dương' },
  { bg: '#FACC15', text: '#0F172A', name: 'Vàng' },
  { bg: '#F97316', text: '#FFFFFF', name: 'Cam' },
  { bg: '#EC4899', text: '#FFFFFF', name: 'Hồng' },
  { bg: '#A78BFA', text: '#0F172A', name: 'Tím nhạt' },
  { bg: '#06B6D4', text: '#0F172A', name: 'Ngọc lam' },
  { bg: '#FB7185', text: '#0F172A', name: 'San hô' },
];

/**
 * Chọn màu cho ô thứ `index` sao cho không trùng với ô liền kề
 * (kể cả ô cuối cùng tiếp giáp với ô đầu tiên).
 */
export function getWheelSliceColor(index: number, total: number): WheelColorToken {
  const len = WHEEL_PALETTE.length;
  let colorIdx = index % len;
  if (total > 1 && index === total - 1 && colorIdx === 0) {
    colorIdx = 1;
  }
  return WHEEL_PALETTE[colorIdx];
}

/**
 * Loại bỏ toàn bộ thông tin nhạy cảm (SĐT phụ huynh, điểm số, ghi chú, ngày sinh...)
 * trước khi đưa danh sách học sinh vào vòng quay trình chiếu trên lớp.
 */
export function sanitizeStudentsForWheel(students: StudentRecord[]): SafeWheelStudent[] {
  const seenCodes = new Set<string>();
  const result: SafeWheelStudent[] = [];

  for (const st of students) {
    const uniqueCode = (st.code || st.id || '').trim();
    if (!uniqueCode || seenCodes.has(uniqueCode)) continue;
    seenCodes.add(uniqueCode);
    result.push({
      id: st.id,
      code: uniqueCode,
      fullName: (st.fullName || uniqueCode).trim(),
      team: Number(st.team) || 1,
    });
  }

  return result;
}

/**
 * Lọc danh sách học sinh đủ điều kiện cho lượt quay hiện tại theo phạm vi,
 * danh sách báo vắng và chế độ lặp/không lặp.
 */
export function getEligibleWheelStudents(params: {
  students: SafeWheelStudent[];
  scopeMode: WheelScopeMode;
  manualSelectedCodes: string[];
  absentCodes: string[];
  repeatMode: WheelRepeatMode;
  calledInCycleCodes: string[];
}): {
  scopeStudents: SafeWheelStudent[];
  presentScopeStudents: SafeWheelStudent[];
  eligibleStudents: SafeWheelStudent[];
} {
  const {
    students,
    scopeMode,
    manualSelectedCodes,
    absentCodes,
    repeatMode,
    calledInCycleCodes,
  } = params;

  const manualSet = new Set(manualSelectedCodes);
  const absentSet = new Set(absentCodes);
  const calledSet = new Set(calledInCycleCodes);

  let scopeStudents: SafeWheelStudent[];
  if (scopeMode === 'all') {
    scopeStudents = students;
  } else if (scopeMode === 'manual') {
    scopeStudents = students.filter((s) => manualSet.has(s.code));
  } else {
    const teamNum = Number(scopeMode.replace('team_', ''));
    scopeStudents = students.filter((s) => s.team === teamNum);
  }

  const presentScopeStudents = scopeStudents.filter((s) => !absentSet.has(s.code));

  const eligibleStudents =
    repeatMode === 'no_repeat'
      ? presentScopeStudents.filter((s) => !calledSet.has(s.code))
      : presentScopeStudents;

  return { scopeStudents, presentScopeStudents, eligibleStudents };
}

export function getScopeDisplayLabel(scopeMode: WheelScopeMode): string {
  switch (scopeMode) {
    case 'all':
      return 'Toàn lớp';
    case 'team_1':
      return 'Tổ 1';
    case 'team_2':
      return 'Tổ 2';
    case 'team_3':
      return 'Tổ 3';
    case 'team_4':
      return 'Tổ 4';
    case 'manual':
      return 'Chọn thủ công';
    default:
      return 'Toàn lớp';
  }
}

/**
 * Sinh số nguyên ngẫu nhiên công bằng trong khoảng [0, maxExclusive)
 * bằng Web Crypto API (rejection sampling tránh sai lệch modulo).
 */
export function getFairRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;

  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const maxUint32 = 0xffffffff;
    const limit = maxUint32 - (maxUint32 % maxExclusive);
    const buffer = new Uint32Array(1);
    let rand = 0;
    do {
      window.crypto.getRandomValues(buffer);
      rand = buffer[0];
    } while (rand >= limit);
    return rand % maxExclusive;
  }

  return Math.floor(Math.random() * maxExclusive);
}

/**
 * Sinh số thực ngẫu nhiên công bằng trong khoảng [min, max).
 */
function getFairRandomFloat(min: number, max: number): number {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const buffer = new Uint32Array(1);
    window.crypto.getRandomValues(buffer);
    const unit = buffer[0] / 0x100000000;
    return min + unit * (max - min);
  }
  return min + Math.random() * (max - min);
}

/**
 * Quy ước góc vòng quay:
 * - Góc 0 độ ở vị trí 12 giờ (kim chỉ đứng yên ở đỉnh trên).
 * - Ô thứ i (0 <= i < N) chiếm cung [i * sliceAngle, (i + 1) * sliceAngle) theo chiều kim đồng hồ.
 * - Khi bánh xe quay theo chiều kim đồng hồ một góc `rotationDeg`,
 *   điểm trên bánh xe nằm dưới kim 12 giờ là `theta = ((-rotationDeg % 360) + 360) % 360`.
 */
export function getSliceIndexAtRotation(rotationDeg: number, sliceCount: number): number {
  if (sliceCount <= 1) return 0;
  const sliceAngle = 360 / sliceCount;
  const normalizedRot = ((rotationDeg % 360) + 360) % 360;
  const pointerTheta = (360 - normalizedRot) % 360;
  const index = Math.floor(pointerTheta / sliceAngle);
  return Math.max(0, Math.min(sliceCount - 1, index));
}

/**
 * Tính góc đích `targetRotationDeg` sao cho kim chỉ 12 giờ chắc chắn dừng bên trong ô `winnerIndex`
 * (tránh sát mép vạch chia ô) và quay thuận chiều kim đồng hồ thêm `extraSpins` vòng.
 */
export function computeSpinTarget(
  currentRotationDeg: number,
  winnerIndex: number,
  sliceCount: number,
  extraSpins = 7
): number {
  if (sliceCount <= 0) return currentRotationDeg;
  const safeWinner = Math.max(0, Math.min(sliceCount - 1, winnerIndex));
  const sliceAngle = 360 / sliceCount;

  // Chọn điểm dừng ngẫu nhiên trong vùng an toàn [18%, 82%] của ô thắng
  const offsetFraction = sliceCount === 1 ? 0.5 : getFairRandomFloat(0.18, 0.82);
  const targetPointerTheta = (safeWinner + offsetFraction) * sliceAngle;
  const desiredMod = (360 - (targetPointerTheta % 360) + 360) % 360;

  const currentMod = ((currentRotationDeg % 360) + 360) % 360;
  const deltaMod = (desiredMod - currentMod + 360) % 360;

  const targetRotation = currentRotationDeg + extraSpins * 360 + deltaMod;

  // Kiểm tra chéo đảm bảo kết quả góc khớp 100% với winnerIndex
  const verifiedIndex = getSliceIndexAtRotation(targetRotation, sliceCount);
  if (verifiedIndex !== safeWinner) {
    const centerTheta = (safeWinner + 0.5) * sliceAngle;
    const centerDesiredMod = (360 - (centerTheta % 360) + 360) % 360;
    const centerDelta = (centerDesiredMod - currentMod + 360) % 360;
    return currentRotationDeg + extraSpins * 360 + centerDelta;
  }

  return targetRotation;
}

/**
 * Đường cong vận tốc mượt: tăng tốc nhanh trong 12% đầu rồi giảm dần đều đến 0
 * để tạo cảm giác hồi hộp tự nhiên ở cuối lượt quay (thời gian 4.5 - 5.5 giây).
 */
export function spinEaseCurve(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  const split = 0.12;
  // C1 liên tục tại split=0.12: 2*A/split = 4*(1-A)/(1-split) => A = 6/28 ≈ 0.2142857
  const a = 0.2142857;
  if (clamped < split) {
    const p = clamped / split;
    return a * p * p;
  }
  const u = (clamped - split) / (1 - split);
  return a + (1 - a) * (1 - Math.pow(1 - u, 4));
}

/**
 * Rút gọn hiển thị tên trên nan quạt khi lớp đông học sinh để tránh chồng chữ.
 */
export function formatWheelStudentLabel(fullName: string, totalSlices: number): string {
  const clean = fullName.trim().replace(/\s+/g, ' ');
  if (!clean) return '';

  const words = clean.split(' ');
  if (totalSlices <= 10) {
    return clean.length > 20 ? `${clean.slice(0, 18)}…` : clean;
  }
  if (totalSlices <= 24) {
    if (words.length >= 3) {
      const compact = `${words[0][0]}. ${words.slice(-2).join(' ')}`;
      return compact.length > 16 ? `${compact.slice(0, 15)}…` : compact;
    }
    return clean.length > 16 ? `${clean.slice(0, 15)}…` : clean;
  }
  // Lớp 25 - 50+ HS: ưu tiên Tên đệm + Tên hoặc Họ viết tắt + Tên
  if (words.length >= 2) {
    const compact = `${words[0][0]}.${words[words.length - 1]}`;
    if (totalSlices > 36 && compact.length > 11) {
      return words[words.length - 1].slice(0, 10);
    }
    return compact.length > 13 ? `${compact.slice(0, 12)}…` : compact;
  }
  return clean.slice(0, 11);
}
