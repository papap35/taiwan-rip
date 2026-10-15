'use client';

import type { ReactNode } from 'react';
import { TYPES, TYPE_KEYS, type IncidentType } from '@/lib/data.ts';
import { LEVELS, type RiskCell } from '@/lib/risk.ts';
import { gmapLink } from '@/lib/temples.ts';

export type Layers = { incidents: boolean; risk: boolean; temples: boolean };

interface Props {
  open: boolean;
  isDemo: boolean;
  layers: Layers;
  onLayers(l: Layers): void;
  types: Set<IncidentType>;
  onToggleType(t: IncidentType): void;
  cells: RiskCell[];
  templeHint: string;
  nearby: { name: string; lat: number; lng: number; km: number; shoujing?: boolean }[];
  searching: boolean;
  onLocate(): void;
  onSearchTemples(): void;
  onImport(file: File): void;
  onReset(): void;
}

function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`mb-2.5 rounded-[10px] border border-line bg-surface px-3.5 py-3 ${className}`}>
      {title && <h2 className="mb-2 text-sm font-semibold text-muted">{title}</h2>}
      {children}
    </section>
  );
}

const hint = 'mt-2 text-xs leading-relaxed text-muted';
const btn = 'mb-1.5 block w-full rounded-lg px-3 py-2 text-sm disabled:cursor-progress disabled:opacity-60';

export default function Panel(p: Props) {
  const counts = LEVELS.map(() => 0);
  for (const c of p.cells) counts[c.level]++;

  const toggle = (k: keyof Layers) => (e: React.ChangeEvent<HTMLInputElement>) => p.onLayers({ ...p.layers, [k]: e.target.checked });

  return (
    <aside
      id="panel"
      aria-label="設定面板"
      className={`fixed inset-x-0 bottom-0 z-30 max-h-[70dvh] overflow-y-auto rounded-t-2xl border-t border-line bg-bg px-4 pt-1.5 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-float transition-transform duration-250 md:static md:z-auto md:max-h-none md:translate-y-0 md:rounded-none md:border-t-0 md:border-r md:p-3 md:shadow-none ${
        p.open ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="mx-auto mt-1 mb-2.5 h-[5px] w-10 rounded-full bg-line md:hidden" aria-hidden="true" />

      {p.isDemo && (
        <Card className="border-notice-line bg-notice text-[13px]">
          <strong>目前為示範資料</strong>
          <p className="mt-1 leading-normal">
            地圖上的事件為程式隨機產生，<b>不是真實事件</b>。可在下方「匯入資料」載入警政署等開放資料。
          </p>
        </Card>
      )}

      <Card title="圖層">
        {([['incidents', '事件點'], ['risk', 'AI 危險分級網格'], ['temples', '宮廟（收驚）']] as const).map(([k, label]) => (
          <label key={k} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
            <input type="checkbox" checked={p.layers[k]} onChange={toggle(k)} className="size-[18px] accent-accent" />
            {label}
          </label>
        ))}
      </Card>

      <Card title="事件類別">
        <div className="flex flex-wrap gap-1.5">
          {TYPE_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={p.types.has(k)}
              onClick={() => p.onToggleType(k)}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[13px] text-ink aria-[pressed=false]:opacity-40"
            >
              <span className="size-2.5 rounded-full" style={{ background: TYPES[k].color }} />
              {TYPES[k].label}
            </button>
          ))}
        </div>
      </Card>

      <Card title="AI 危險分級">
        <ul className="grid grid-cols-4 gap-1">
          {LEVELS.map((l) => (
            <li key={l.key} className="rounded-md py-1 text-center text-xs font-semibold text-white [text-shadow:0_1px_1px_rgba(0,0,0,.35)]" style={{ background: l.color }}>
              {l.label}
            </li>
          ))}
        </ul>
        <p className={hint}>
          依時間窗內事件的「時間加權嚴重度、致死件數、近期升溫趨勢」做 K-means 分群，每格約 4 公里。點擊網格可看原因與附近宮廟。
        </p>
        <div className="mt-1.5 text-xs text-muted" data-testid="risk-stats">
          {p.cells.length
            ? `共 ${p.cells.length} 個有事件的網格：` + LEVELS.map((l, i) => `${l.label} ${counts[i]}`).join('、')
            : '目前時間窗內沒有事件。'}
        </div>
      </Card>

      <Card title="宮廟 / 收驚">
        <button type="button" onClick={p.onLocate} className={`${btn} bg-accent text-white`}>
          📍 我的位置與最近收驚宮廟
        </button>
        <button type="button" onClick={p.onSearchTemples} disabled={p.searching} className={`${btn} border border-line text-ink`}>
          🏮 搜尋目前畫面附近宮廟
        </button>
        <p className={hint} aria-live="polite">{p.templeHint}</p>
        {p.nearby.length > 0 && (
          <ol className="mt-2 list-decimal pl-5 text-[13px] leading-relaxed">
            {p.nearby.map((t) => (
              <li key={`${t.name}-${t.lat}`}>
                <a className="text-accent" href={gmapLink(t)} target="_blank" rel="noopener">{t.name}</a> {t.km.toFixed(1)} km
                {t.shoujing ? '・收驚' : ''}
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card title="匯入資料">
        <input
          type="file"
          aria-label="匯入事件資料檔"
          accept=".json,.csv,application/json,text/csv"
          className="mb-1 max-w-full text-[13px] text-ink"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) p.onImport(f);
            e.target.value = '';
          }}
        />
        <p className={hint}>
          CSV 欄位：<code className="rounded bg-bg px-1 text-[11px] break-all">date,lat,lng,type,severity,title,county</code>（type 可用中文或代碼）。
        </p>
        <button type="button" onClick={p.onReset} className={`${btn} mt-2 border border-line text-ink`}>
          恢復預設資料
        </button>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-muted">需要協助</h2>
        <p className="text-[13px] leading-relaxed">
          緊急狀況 <a className="font-semibold text-accent" href="tel:110">110</a> 報案、
          <a className="font-semibold text-accent" href="tel:119">119</a> 救護。心情低落可撥{' '}
          <a className="font-semibold text-accent" href="tel:1925">1925</a> 安心專線（24 小時）。
        </p>
        <p className={hint}>本站分級為統計參考，非官方警示；事件位置可能經過模糊化處理。</p>
      </Card>
    </aside>
  );
}
