import type { Metadata } from 'next';
import Link from 'next/link';
import { COUNTIES } from '@/lib/counties.ts';
import { countyStats, MAP_DEFAULT_WINDOW } from '@/lib/county-stats.ts';
import { loadIncidents } from '@/lib/server/dataset.ts';
import { DemoNotice, PageTitle } from '@/components/ui';

export const metadata: Metadata = {
  title: '縣市事件統計',
  description: `台灣 22 縣市近 ${MAP_DEFAULT_WINDOW} 天事件與死亡事故數、每月趨勢與風險較高區域。`,
};

export default async function CountyIndex() {
  const { list, meta } = await loadIncidents();
  const rows = COUNTIES.map((c) => ({ c, w: countyStats(list, c.name).windows.find((x) => x.days === MAP_DEFAULT_WINDOW)! }));
  const latest = list.at(-1)?.t ?? 0;
  return (
    <>
      <PageTitle title="縣市事件統計" sub={`近 ${MAP_DEFAULT_WINDOW} 天（資料截至 ${new Date(latest).toISOString().slice(0, 10)}）。點縣市看每月趨勢與風險較高區域。`} />
      {meta.demo !== false && <DemoNotice />}
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ c, w }) => (
          <li key={c.slug}>
            <Link href={`/county/${c.slug}`} className="flex items-baseline justify-between rounded-xl border border-line bg-surface px-4 py-3 hover:border-accent">
              <span className="font-medium">{c.name}</span>
              <span className="text-[13px] text-muted">
                <b className="text-base text-ink">{w.count}</b> 起・死亡／重大 {w.fatal}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
