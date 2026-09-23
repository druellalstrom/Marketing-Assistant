"use client";

import { useEffect, useRef, useState } from "react";
import type { WeekBucket } from "@/lib/dashboard/stats";

/**
 * Single-series bar chart: marketing items created per week (real counts).
 * Thin rounded bars on a recessive grid, hover/focus tooltip, and a table for
 * screen readers. One series, so the card title names it (no legend box).
 */
export function WeeklyChart({ data }: { data: WeekBucket[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // Draw at the container's real width so text stays ~13px on every screen.
  const [W, setW] = useState(560);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = W < 480 ? 190 : 230;
  const pad = { top: 16, right: 8, bottom: 30, left: 30 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = Math.max(1, ...data.map((d) => d.count));
  const niceMax = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const ticks = [0, niceMax / 2, niceMax];
  const slot = innerW / data.length;
  const barW = Math.min(32, slot * 0.5);
  // Thin out x labels when they would collide (each needs ~52px).
  const labelEvery = slot < 52 ? 2 : 1;
  const y = (v: number) => pad.top + innerH - (v / niceMax) * innerH;
  const h = hover !== null ? data[hover] : null;

  return (
    <div ref={boxRef} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="img" aria-label="Marketing items created per week for the last 8 weeks">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="#E2E8F0" strokeWidth="1" />
            <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" fontSize="13" fill="#475569">{t}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.left + slot * i + slot / 2;
          const top = y(d.count);
          const bh = pad.top + innerH - top;
          const r = Math.min(4, bh / 2);
          return (
            <g key={d.weekStart}>
              {d.count > 0 && (
                <path
                  d={`M${cx - barW / 2} ${pad.top + innerH} V${top + r} a${r} ${r} 0 0 1 ${r} -${r} H${cx + barW / 2 - r} a${r} ${r} 0 0 1 ${r} ${r} V${pad.top + innerH} Z`}
                  fill={hover === i ? "#BE185D" : "#EC4899"}
                />
              )}
              {(data.length - 1 - i) % labelEvery === 0 && (
                <text x={cx} y={H - 10} textAnchor="middle" fontSize="13" fill="#475569">{d.label}</text>
              )}
              {/* hit target larger than the mark */}
              <rect
                x={pad.left + slot * i}
                y={pad.top}
                width={slot}
                height={innerH}
                fill="transparent"
                tabIndex={0}
                aria-label={`Week of ${d.label}: ${d.count} item${d.count === 1 ? "" : "s"}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="cursor-default outline-none"
              />
            </g>
          );
        })}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-xl bg-navy px-3 py-2 text-sm text-white shadow-lg"
          style={{ left: `${((pad.left + slot * hover + slot / 2) / W) * 100}%`, top: 0 }}
          role="status"
        >
          <span className="block text-slate-300">Week of {h.label}</span>
          <strong>{h.count}</strong> item{h.count === 1 ? "" : "s"} created
        </div>
      )}
      <table className="sr-only">
        <caption>Marketing items created per week</caption>
        <thead><tr><th>Week starting</th><th>Items</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.weekStart}><td>{d.label}</td><td>{d.count}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
