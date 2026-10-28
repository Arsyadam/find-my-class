"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = {
  earliest: string; // "HH:MM"
  latest: string;
  onChange: (next: { earliest: string; latest: string }) => void;
  className?: string;
};

const SIZE = 260;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 98;
const TRACK = 14;

function minutesFromHHMM(v: string): number {
  const [h, m] = v.split(":").map(Number);
  return (h % 24) * 60 + (m || 0);
}

function hhmmFromMinutes(total: number): string {
  const t = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(t / 60);
  const m = Math.round((t % 60) / 5) * 5;
  const mm = m === 60 ? 0 : m;
  const hh = m === 60 ? (h + 1) % 24 : h;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function angleFromMinutes(mins: number): number {
  // 0 at top (midnight), clockwise
  return (mins / (24 * 60)) * 360;
}

function minutesFromAngle(angle: number): number {
  const a = ((angle % 360) + 360) % 360;
  return Math.round((a / 360) * 24 * 60);
}

function polar(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

function describeArc(startMin: number, endMin: number): string {
  const start = startMin;
  let end = endMin;
  if (end <= start) end += 24 * 60;
  const startA = angleFromMinutes(start);
  const span = end - start;
  const large = span > 12 * 60 ? 1 : 0;
  const p0 = polar(startA, R);
  // When wrapping past midnight, end angle for drawing uses full span
  const endAngle = startA + (span / (24 * 60)) * 360;
  const pEnd = polar(endAngle, R);
  return `M ${p0.x} ${p0.y} A ${R} ${R} 0 ${large} 1 ${pEnd.x} ${pEnd.y}`;
}

function formatDuration(earliest: string, latest: string): string {
  let mins = minutesFromHHMM(latest) - minutesFromHHMM(earliest);
  if (mins <= 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

function formatClock(v: string): string {
  const [hs, ms] = v.split(":");
  const h = Number(hs);
  const m = ms;
  const am = h < 12;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${am ? "AM" : "PM"}`;
}

export function TimeRangeDial({ earliest, latest, onChange, className }: Props) {
  const reduce = useReducedMotion();
  const svgRef = React.useRef<SVGSVGElement>(null);
  const drag = React.useRef<"start" | "end" | null>(null);
  const [displayDuration, setDisplayDuration] = React.useState(
    formatDuration(earliest, latest),
  );

  React.useEffect(() => {
    setDisplayDuration(formatDuration(earliest, latest));
  }, [earliest, latest]);

  const startMin = minutesFromHHMM(earliest);
  const endMin = minutesFromHHMM(latest);
  const startPos = polar(angleFromMinutes(startMin), R);
  const endPos = polar(angleFromMinutes(endMin), R);
  const arc = describeArc(startMin, endMin);

  function pointerToMinutes(clientX: number, clientY: number): number {
    const svg = svgRef.current;
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    const x = clientX - rect.left - rect.width / 2;
    const y = clientY - rect.top - rect.height / 2;
    let deg = (Math.atan2(y, x) * 180) / Math.PI + 90;
    if (deg < 0) deg += 360;
    const raw = minutesFromAngle(deg);
    return Math.round(raw / 5) * 5;
  }

  function onPointerDown(which: "start" | "end") {
    return (e: React.PointerEvent) => {
      e.preventDefault();
      drag.current = which;
      (e.target as Element).setPointerCapture?.(e.pointerId);
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const mins = pointerToMinutes(e.clientX, e.clientY);
    if (drag.current === "start") {
      onChange({ earliest: hhmmFromMinutes(mins), latest });
    } else {
      onChange({ earliest, latest: hhmmFromMinutes(mins) });
    }
  }

  function onPointerUp() {
    drag.current = null;
  }

  const labels = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22].map((h) => {
    const p = polar(angleFromMinutes(h * 60), R + 28);
    const text =
      h === 0 ? "12a" : h === 12 ? "12p" : h < 12 ? `${h}` : `${h - 12}`;
    return { h, p, text };
  });

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <svg
        ref={svgRef}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="touch-none select-none"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        role="group"
        aria-label="Class time window dial"
      >
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={TRACK}
        />
        <motion.path
          d={arc}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={TRACK}
          strokeLinecap="round"
          animate={{ d: arc }}
          transition={reduce ? { duration: 0 } : { duration: 0.15 }}
        />

        {/* noon / midnight markers */}
        <circle cx={CX} cy={CY - R - 40} r={3} fill="var(--ring)" opacity={0.5} />
        <circle cx={CX} cy={CY + R + 40} r={3} fill="var(--foreground)" opacity={0.25} />

        {labels.map(({ h, p, text }) => (
          <text
            key={h}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-[var(--muted-foreground)] text-[10px]"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {text}
          </text>
        ))}

        <Handle
          cx={startPos.x}
          cy={startPos.y}
          label={`Earliest ${formatClock(earliest)}`}
          onPointerDown={onPointerDown("start")}
          reduce={!!reduce}
        />
        <Handle
          cx={endPos.x}
          cy={endPos.y}
          label={`Latest ${formatClock(latest)}`}
          onPointerDown={onPointerDown("end")}
          reduce={!!reduce}
        />

        <text
          x={CX}
          y={CY - 8}
          textAnchor="middle"
          className="fill-[var(--foreground)] text-sm font-semibold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {displayDuration}
        </text>
        <text
          x={CX}
          y={CY + 14}
          textAnchor="middle"
          className="fill-[var(--muted-foreground)] text-[11px]"
        >
          {formatClock(earliest)} – {formatClock(latest)}
        </text>
      </svg>
      <p className="text-center text-sm text-muted-foreground">
        Drag handles to set earliest start and latest end.
      </p>
    </div>
  );
}

function Handle({
  cx,
  cy,
  label,
  onPointerDown,
  reduce,
}: {
  cx: number;
  cy: number;
  label: string;
  onPointerDown: (e: React.PointerEvent) => void;
  reduce: boolean;
}) {
  return (
    <motion.circle
      cx={cx}
      cy={cy}
      r={12}
      fill="var(--card)"
      stroke="var(--primary)"
      strokeWidth={3}
      style={{ cursor: "grab" }}
      aria-label={label}
      onPointerDown={onPointerDown}
      whileTap={reduce ? undefined : { scale: 1.15 }}
      animate={{ cx, cy }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 28 }}
    />
  );
}
