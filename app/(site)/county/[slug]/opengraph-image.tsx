import { COUNTIES, countyBySlug, normalizeCounty } from '@/lib/counties.ts';
import { countyStats, MAP_DEFAULT_WINDOW } from '@/lib/county-stats.ts';
import { OG_TEXT } from '@/lib/og-text.ts';
import { loadIncidents } from '@/lib/server/dataset.ts';
import { OG_SIZE, renderOg } from '@/lib/server/og';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = '縣市事件統計';
export const dynamicParams = false;

export function generateStaticParams() {
  return COUNTIES.map((c) => ({ slug: c.slug }));
}

const DAY = 86400000;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const county = countyBySlug((await params).slug)!;
  const { list, meta } = await loadIncidents();
  const s = countyStats(list, county.name);
  const w = s.windows.find((x) => x.days === MAP_DEFAULT_WINDOW)!;
  const points = list.filter((d) => normalizeCounty(d.county) === county.name && d.t > s.latest - MAP_DEFAULT_WINDOW * DAY);
  return renderOg({
    eyebrow: `${OG_TEXT.site}・${OG_TEXT.stats}`,
    title: county.name,
    figure: { value: String(w.count), label: OG_TEXT.recent(MAP_DEFAULT_WINDOW) },
    lines: [OG_TEXT.fatal(w.fatal)],
    footer: OG_TEXT.asOf(new Date(s.latest).toISOString().slice(0, 10)),
    demo: meta.demo !== false ? OG_TEXT.demo : undefined,
    points,
  });
}
