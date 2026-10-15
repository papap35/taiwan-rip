'use client';

import { useState } from 'react';

interface Point {
  month: string;
  count: number;
  fatal: number;
}

const W = 720;
const H = 220;
const PAD = { top: 22, right: 8, bottom: 26, left: 34 };
const BAR_MAX = 20;

/** 取「好看」的刻度上限與間距：1、2、5 × 10^n */
function niceTicks(max: number) {
  if (max <= 0) return { top: 1, step: 1 };
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  return { top: Math.ceil(max / step) * step, step };
}

/** 上方 4px 圓角、底部方角的柱子 */
function columnPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export default function MonthlyChart({ data, title }: { data: Point[]; title: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(0, ...data.map((d) => d.count));
  const { top, step } = niceTicks(max);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / data.length;
  const bw = Math.min(BAR_MAX, slot - 2); // 至少留 2px 間隔
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const peak = data.reduce((best, d, i) => (d.count > data[best].count ? i : best), 0);
  const labelled = new Set([peak, data.length - 1]); // 只標最高與最新一個月
  const a = active !== null ? data[active] : null;

  return (
    <figure className="relative">
      <figcaption className="mb-2 text-sm font-semibold">{title}</figcaption>
      {/* 窄螢幕保留最小寬度、在卡片內左右捲動，文字才不會縮到看不清楚 */}
      <div className="-mx-1 overflow-x-auto px-1">
      <div className="relative min-w-[560px]">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="group" aria-label={title}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--color-muted)" className="tabular-nums">
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = PAD.left + i * slot + (slot - bw) / 2;
          const h = Math.max(0, y(0) - y(d.count));
          return (
            <g key={d.month}>
              {d.count > 0 && (
                <path
                  d={columnPath(x, y(d.count), bw, h)}
                  fill="var(--color-chart)"
                  opacity={active === null || active === i ? 1 : 0.55}
                />
              )}
              {labelled.has(i) && d.count > 0 && (
                <text x={x + bw / 2} y={y(d.count) - 6} textAnchor="middle" fontSize={11} fill="var(--color-ink)" className="tabular-nums">
                  {d.count}
                </text>
              )}
              {i % 6 === 0 || i === data.length - 1 ? (
                <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--color-muted)">
                  {d.month.slice(2).replace('-', '/')}
                </text>
              ) : null}
              {/* 命中區域涵蓋整個欄位，比柱子大 */}
              <rect
                x={PAD.left + i * slot}
                y={PAD.top}
                width={slot}
                height={plotH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${d.month}：${d.count} 起，死亡／重大 ${d.fatal} 起`}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="outline-none focus-visible:stroke-[var(--color-ink)]"
              />
            </g>
          );
        })}
      </svg>
      {a && active !== null && (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-xs whitespace-nowrap shadow-float"
          style={{ left: `${Math.min(88, Math.max(12, ((PAD.left + (active + 0.5) * slot) / W) * 100))}%` }}
        >
          <div className="text-base font-semibold tabular-nums">{a.count} 起</div>
          <div className="text-muted">{a.month}・死亡／重大 {a.fatal} 起</div>
        </div>
      )}
      </div>
      </div>
      <details className="mt-2 text-xs text-muted">
        <summary className="cursor-pointer">以表格檢視</summary>
        <table className="mt-2 w-full max-w-sm tabular-nums">
          <thead>
            <tr className="text-left"><th className="py-1 font-medium">月份</th><th className="font-medium">事件</th><th className="font-medium">死亡／重大</th></tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.month} className="border-t border-line"><td className="py-1">{d.month}</td><td>{d.count}</td><td>{d.fatal}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
