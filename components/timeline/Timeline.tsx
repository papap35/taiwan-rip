'use client';

import { useEffect, useRef } from 'react';
import { WINDOW_OPTIONS } from '@/lib/url-state.ts';

const DAY = 86400000;
const fmt = (t: number) => new Date(t).toISOString().slice(0, 10);
const WINDOW_LABELS: Record<number, string> = { 7: '近 7 天', 30: '近 30 天', 90: '近 90 天', 180: '近半年', 365: '近 1 年', 0: '全部' };

interface Props {
  minT: number;
  maxT: number;
  endT: number;
  windowDays: number;
  /** 依類別篩選後、不分時間窗的全部事件時間（畫長條圖用） */
  times: number[];
  count: number;
  fatal: number;
  playing: boolean;
  onEnd(t: number): void;
  onWindow(days: number): void;
  onTogglePlay(): void;
}

export default function Timeline({ minT, maxT, endT, windowDays, times, count, fatal, playing, onEnd, onWindow, onTogglePlay }: Props) {
  const start = windowDays ? Math.max(endT - (windowDays - 1) * DAY, minT) : minT;
  return (
    <div className="absolute inset-x-2 bottom-[calc(8px+env(safe-area-inset-bottom))] z-10 mx-auto max-w-[760px] rounded-xl border border-line bg-surface px-2.5 pt-2 pb-1 text-ink shadow-float md:inset-x-3 md:bottom-4 md:px-3 md:pt-2.5">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={playing ? '暫停' : '播放'}
          className="size-[38px] flex-none rounded-lg border border-line bg-surface text-base"
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <div className="min-w-0 flex-1 text-[13px] tabular-nums md:text-sm">
          <span data-testid="range-label">{fmt(start)} ～ {fmt(endT)}</span>
          <span className="block text-xs text-muted" data-testid="count-label">
            {count} 起事件，其中 {fatal} 起死亡／重大
          </span>
        </div>
        <select
          aria-label="時間窗長度"
          value={windowDays}
          onChange={(e) => onWindow(+e.target.value)}
          className="rounded-lg border border-line bg-surface p-1.5 text-[13px] text-ink"
        >
          {WINDOW_OPTIONS.map((w) => <option key={w} value={w}>{WINDOW_LABELS[w]}</option>)}
        </select>
      </div>
      <Histogram minT={minT} maxT={maxT} start={start} endT={endT} times={times} />
      <input
        type="range"
        aria-label="結束日期"
        min={0}
        max={Math.round((maxT - minT) / DAY)}
        value={Math.round((endT - minT) / DAY)}
        onChange={(e) => onEnd(minT + +e.target.value * DAY)}
        className="w-full accent-accent"
      />
    </div>
  );
}

function Histogram({ minT, maxT, start, endT, times }: { minT: number; maxT: number; start: number; endT: number; times: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      if (!w) return;
      cv.width = w * dpr;
      cv.height = h * dpr;
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      const weeks = Math.max(1, Math.ceil((maxT - minT + DAY) / (7 * DAY)));
      const bins = new Array<number>(weeks).fill(0);
      for (const t of times) bins[Math.floor((t - minT) / (7 * DAY))]++;
      const max = Math.max(1, ...bins);
      const bw = w / weeks;
      const styles = getComputedStyle(document.documentElement);
      const accent = styles.getPropertyValue('--color-accent').trim();
      const muted = styles.getPropertyValue('--color-line').trim();
      bins.forEach((n, i) => {
        const t0 = minT + i * 7 * DAY;
        ctx.fillStyle = t0 + 7 * DAY > start && t0 <= endT ? accent : muted;
        const bh = Math.max(1, (n / max) * (h - 2));
        ctx.fillRect(i * bw, h - bh, Math.max(1, bw - 1), bh);
      });
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(cv);
    return () => ro.disconnect();
  }, [minT, maxT, start, endT, times]);

  return <canvas ref={ref} className="mt-2 block h-9 w-full" aria-hidden="true" />;
}
