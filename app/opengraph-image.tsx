import { OG_TEXT } from '@/lib/og-text.ts';
import { loadIncidents } from '@/lib/server/dataset.ts';
import { OG_SIZE, renderOg } from '@/lib/server/og';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = '台灣事件風險地圖';

const DAY = 86400000;

export default async function Image() {
  const { list, meta } = await loadIncidents();
  const latest = list.at(-1)?.t ?? 0;
  // 只畫臺灣本島周邊，離島會把比例尺拉得太小
  const points = list.filter((d) => d.t > latest - 365 * DAY && d.lng > 119.9 && d.lng < 122.1 && d.lat > 21.8 && d.lat < 25.4);
  return renderOg({
    title: OG_TEXT.site,
    lines: [OG_TEXT.tagline],
    footer: OG_TEXT.asOf(new Date(latest).toISOString().slice(0, 10)),
    demo: meta.demo !== false ? OG_TEXT.demo : undefined,
    points,
  });
}
