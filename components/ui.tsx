// 內容頁共用的小元件（伺服器元件）
import type { ReactNode } from 'react';
import { LEVELS } from '@/lib/risk.ts';

export function PageTitle({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-bold">{title}</h1>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  );
}

export function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="mb-5 rounded-xl border border-line bg-surface p-4 md:p-5">
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function DemoNotice() {
  return (
    <div className="mb-5 rounded-xl border border-notice-line bg-notice px-4 py-3 text-[13px] leading-relaxed">
      <strong>目前為示範資料：</strong>以下數字由程式隨機產生，<b>不是真實事件</b>，只用來展示頁面功能。
    </div>
  );
}

export function LevelBadge({ level }: { level: number }) {
  const l = LEVELS[level];
  return (
    <span className="inline-block rounded-md px-2 py-0.5 text-xs font-bold text-white [text-shadow:0_1px_1px_rgba(0,0,0,.35)]" style={{ background: l.color }}>
      {l.label}
    </span>
  );
}

/** 統計卡：標籤、數值、補充、與去年同期比較（增加以文字＋箭頭表示，不只靠顏色） */
export function StatTile({ label, value, sub, prev }: { label: string; value: number; sub?: string; prev?: number }) {
  let delta: string | null = null;
  if (prev !== undefined) {
    if (prev === 0) delta = value === 0 ? '與去年同期相同' : '去年同期無事件';
    else {
      const diff = value - prev;
      const pct = Math.round((diff / prev) * 100);
      delta = diff === 0 ? '與去年同期相同' : `${diff > 0 ? '▲ 增加' : '▼ 減少'} ${Math.abs(diff)} 起（${diff > 0 ? '+' : '−'}${Math.abs(pct)}%）較去年同期`;
    }
  }
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="mt-1 text-3xl font-semibold">{value.toLocaleString('zh-TW')}</div>
      {sub && <div className="mt-1 text-[13px]">{sub}</div>}
      {delta && <div className="mt-1 text-xs text-muted">{delta}</div>}
    </div>
  );
}
