'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { COUNTIES } from '@/lib/counties.ts';
import type { TempleRecord } from '@/lib/temple-schema.ts';

export default function TempleDirectory({ temples }: { temples: TempleRecord[] }) {
  const [county, setCounty] = useState('');
  const [onlyShoujing, setOnlyShoujing] = useState(false);
  const counties = COUNTIES.filter((c) => temples.some((t) => t.county === c.name));
  const shown = useMemo(
    () => temples.filter((t) => (!county || t.county === county) && (!onlyShoujing || t.shoujing)),
    [temples, county, onlyShoujing],
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          縣市
          <select value={county} onChange={(e) => setCounty(e.target.value)} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-ink">
            <option value="">全部</option>
            {counties.map((c) => <option key={c.slug} value={c.name}>{c.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={onlyShoujing} onChange={(e) => setOnlyShoujing(e.target.checked)} className="size-[18px] accent-accent" />
          只看可收驚
        </label>
        <span className="text-muted" aria-live="polite">{shown.length} 間</span>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {shown.map((t) => (
          <li key={t.id}>
            <Link href={`/temples/${t.id}`} className="block rounded-xl border border-line bg-surface px-4 py-3 hover:border-accent">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{t.name}</span>
                {t.shoujing && <span className="rounded-full border border-accent px-2 text-xs text-accent">可收驚</span>}
              </div>
              <div className="mt-0.5 text-[13px] text-muted">{t.county}{t.deity ? `・主祀${t.deity}` : ''}</div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
