import React, { useEffect, useMemo, useRef } from 'react';
import {
  formatWheelStudentLabel,
  getWheelSliceColor,
  type SafeWheelStudent,
} from '../../utils/luckyWheelLogic';

interface LuckyWheelCanvasProps {
  students: SafeWheelStudent[];
  wheelRef: React.RefObject<SVGGElement | null>;
  pointerRef: React.RefObject<SVGGElement | null>;
  initialRotation: number;
  isSpinning: boolean;
  onCenterSpinClick?: () => void;
  sizeClassName?: string;
}

function polarToCartesian(cx: number, cy: number, r: number, angleClockDeg: number) {
  const rad = ((angleClockDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function buildWedgePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`;
}

export function LuckyWheelCanvas({
  students,
  wheelRef,
  pointerRef,
  initialRotation,
  isSpinning,
  onCenterSpinClick,
  sizeClassName = 'w-full max-w-[460px] xl:max-w-[520px]',
}: LuckyWheelCanvasProps) {
  const count = students.length;
  const cx = 300;
  const cy = 300;
  const outerRadius = 264;

  // Phát hiện học sinh trùng họ tên trong cùng danh sách quay để hiển thị thêm mã HS trên lát cắt
  const duplicateNameSet = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of students) {
      const key = s.fullName.trim().toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const dups = new Set<string>();
    counts.forEach((v, k) => {
      if (v > 1) dups.add(k);
    });
    return dups;
  }, [students]);

  const rimPins = useMemo(() => {
    const totalPins = 24;
    return Array.from({ length: totalPins }, (_, i) => {
      const pos = polarToCartesian(cx, cy, 281, (i * 360) / totalPins);
      return { i, ...pos };
    });
  }, []);

  const labelFontSize = useMemo(() => {
    if (count <= 6) return 17;
    if (count <= 10) return 14.5;
    if (count <= 16) return 12.5;
    if (count <= 26) return 11;
    if (count <= 38) return 9.5;
    return 8.5;
  }, [count]);

  return (
    <div className={`relative mx-auto aspect-square select-none ${sizeClassName}`}>
      {/* Đổ bóng mềm phía sau bánh xe */}
      <div
        className="absolute inset-6 rounded-full bg-teal-900/10 blur-2xl pointer-events-none"
        aria-hidden="true"
      />

      <svg
        viewBox="0 0 600 600"
        className="w-full h-full drop-shadow-xl overflow-visible"
        role="img"
        aria-label="Vòng quay may mắn gọi tên học sinh"
      >
        <defs>
          <radialGradient id="wheelBezelGrad" cx="50%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#1e3a5f" />
            <stop offset="100%" stopColor="#0f172a" />
          </radialGradient>
          <radialGradient id="wheelHubGrad" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#0f766e" />
          </radialGradient>
          <filter id="pointerShadow" x="-30%" y="-20%" width="160%" height="160%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.35" />
          </filter>
        </defs>

        {/* Vành ngoài Navy */}
        <circle cx={cx} cy={cy} r={294} fill="url(#wheelBezelGrad)" />
        <circle
          cx={cx}
          cy={cy}
          r={269}
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.22"
          strokeWidth="2"
        />

        {/* 24 đinh trang trí quanh vành */}
        {rimPins.map((pin) => (
          <circle
            key={pin.i}
            cx={pin.x}
            cy={pin.y}
            r={4.2}
            fill={pin.i % 2 === 0 ? '#facc15' : '#5eead4'}
            stroke="#0f172a"
            strokeWidth="1"
          />
        ))}

        {/* Nhóm xoay 60fps được điều khiển trực tiếp qua wheelRef */}
        <g
          ref={wheelRef}
          style={{
            transform: `rotate(${initialRotation}deg)`,
            transformOrigin: '300px 300px',
            willChange: 'transform',
          }}
        >
          {count === 0 ? (
            <g>
              <circle cx={cx} cy={cy} r={outerRadius} fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="2" />
              <text
                x={cx}
                y={cy - 12}
                textAnchor="middle"
                fill="#475569"
                fontSize="17"
                fontWeight="700"
              >
                Chưa có học sinh khả dụng
              </text>
              <text
                x={cx}
                y={cy + 16}
                textAnchor="middle"
                fill="#64748b"
                fontSize="13"
                fontWeight="500"
              >
                Vui lòng kiểm tra phạm vi hoặc danh sách lớp
              </text>
            </g>
          ) : count === 1 ? (
            <g>
              <circle
                cx={cx}
                cy={cy}
                r={outerRadius}
                fill={getWheelSliceColor(0, 1).bg}
                stroke="#ffffff"
                strokeWidth="3"
              />
              <text
                x={cx}
                y={170}
                textAnchor="middle"
                fill={getWheelSliceColor(0, 1).text}
                fontSize="24"
                fontWeight="800"
              >
                {students[0].fullName}
              </text>
              <text
                x={cx}
                y={202}
                textAnchor="middle"
                fill={getWheelSliceColor(0, 1).text}
                fillOpacity="0.9"
                fontSize="14"
                fontWeight="600"
              >
                {students[0].code} • Tổ {students[0].team}
              </text>
            </g>
          ) : (
            students.map((st, idx) => {
              const sliceAngle = 360 / count;
              const startAngle = idx * sliceAngle;
              const endAngle = (idx + 1) * sliceAngle;
              const midAngle = startAngle + sliceAngle / 2;
              const color = getWheelSliceColor(idx, count);
              const isDup = duplicateNameSet.has(st.fullName.trim().toLowerCase());
              const baseLabel = formatWheelStudentLabel(st.fullName, count);
              const displayLabel = isDup ? `${baseLabel} (${st.code})` : baseLabel;

              return (
                <g key={st.code}>
                  <path
                    d={buildWedgePath(cx, cy, outerRadius, startAngle, endAngle)}
                    fill={color.bg}
                    stroke="#ffffff"
                    strokeWidth={count > 30 ? 1.4 : 2.2}
                  />
                  <g transform={`rotate(${midAngle - 90} ${cx} ${cy})`}>
                    <text
                      x={cx + outerRadius - 18}
                      y={cy}
                      textAnchor="end"
                      dominantBaseline="central"
                      fill={color.text}
                      fontSize={labelFontSize}
                      fontWeight="700"
                      style={{ letterSpacing: '-0.01em' }}
                    >
                      {displayLabel}
                    </text>
                    {count <= 14 && !isDup && (
                      <text
                        x={cx + 72}
                        y={cy}
                        textAnchor="start"
                        dominantBaseline="central"
                        fill={color.text}
                        fillOpacity="0.82"
                        fontSize={Math.max(9.5, labelFontSize - 4)}
                        fontWeight="600"
                      >
                        {st.code}
                      </text>
                    )}
                  </g>
                </g>
              );
            })
          )}
        </g>

        {/* Tâm vòng quay có thể bấm để quay */}
        <g
          onClick={() => {
            if (!isSpinning && count > 0 && onCenterSpinClick) {
              onCenterSpinClick();
            }
          }}
          className={!isSpinning && count > 0 ? 'cursor-pointer' : 'cursor-default'}
        >
          <circle cx={cx} cy={cy} r={46} fill="#ffffff" stroke="#0f172a" strokeWidth="4" />
          <circle cx={cx} cy={cy} r={37} fill="url(#wheelHubGrad)" />
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#ffffff"
            fontSize="13"
            fontWeight="800"
            letterSpacing="0.06em"
          >
            {isSpinning ? 'ĐANG' : 'QUAY'}
          </text>
          <text
            x={cx}
            y={cy + 12}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#ccfbf1"
            fontSize="10"
            fontWeight="700"
          >
            {isSpinning ? 'QUAY...' : 'NGAY'}
          </text>
        </g>

        {/* Kim chỉ cố định tại vị trí 12 giờ */}
        <g
          ref={pointerRef}
          filter="url(#pointerShadow)"
          style={{
            transformOrigin: '300px 14px',
            transition: 'transform 80ms ease-out',
          }}
        >
          <path
            d="M 278 6 L 322 6 L 322 24 L 300 62 L 278 24 Z"
            fill="#102744"
            stroke="#ffffff"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <circle cx={300} cy={22} r={8.5} fill="#facc15" stroke="#ffffff" strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}

interface CelebrationConfettiProps {
  active: boolean;
}

const CONFETTI_COLORS = ['#0D9488', '#0284C7', '#FACC15', '#F97316', '#EC4899', '#A78BFA'];

export function CelebrationConfetti({ active }: CelebrationConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(300, rect.width);
    const height = Math.max(200, rect.height);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const particles = Array.from({ length: 64 }, () => ({
      x: width * (0.2 + Math.random() * 0.6),
      y: height * 0.25 + (Math.random() - 0.5) * 40,
      vx: (Math.random() - 0.5) * 9,
      vy: -3 - Math.random() * 6.5,
      size: 6 + Math.random() * 6,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.24,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      alpha: 1,
    }));

    const start = performance.now();
    const duration = 2600;

    const tick = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, width, height);

      let anyVisible = false;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.22;
        p.vx *= 0.99;
        p.rot += p.vRot;
        p.alpha = Math.max(0, 1 - Math.max(0, elapsed - 1200) / (duration - 1200));

        if (p.alpha > 0.02 && p.y < height + 30) {
          anyVisible = true;
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.62);
          ctx.restore();
        }
      }

      if (anyVisible && elapsed < duration) {
        rafId = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 w-full h-full z-20"
      aria-hidden="true"
    />
  );
}
