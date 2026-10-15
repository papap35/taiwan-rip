import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { COUNTIES, countyBySlug } from '@/lib/counties.ts';
import { countyStats, riskCellsByCounty, MAP_DEFAULT_WINDOW } from '@/lib/county-stats.ts';
import { LEVELS } from '@/lib/risk.ts';
import { nearestTemples } from '@/lib/temples.ts';
import { loadIncidents, loadTemples } from '@/lib/server/dataset.ts';
import { riskReasons } from '@/components/map/Popups';
import MonthlyChart from '@/components/charts/MonthlyChart';
import TypeBars from '@/components/charts/TypeBars';
import { DemoNotice, LevelBadge, PageTitle, Section, StatTile } from '@/components/ui';

const fmt = (t: number) => new Date(t).toISOString().slice(0, 10);
const mapLink = (lat: number, lng: number, z: number) => `/?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}&z=${z}`;

export const dynamicParams = false;
export function generateStaticParams() {
  return COUNTIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const county = countyBySlug((await params).slug);
  if (!county) return {};
  const { list, meta } = await loadIncidents();
  const s = countyStats(list, county.name);
  const w = s.windows.find((x) => x.days === MAP_DEFAULT_WINDOW)!;
  const demo = meta.demo !== false ? '（示範資料）' : '';
  return {
    title: `${county.name}事件統計`,
    description: `${county.name}近 ${MAP_DEFAULT_WINDOW} 天 ${w.count} 起事件、${w.fatal} 起死亡或重大事件${demo}。含每月趨勢、類別分布、風險較高區域與附近收驚宮廟。資料截至 ${fmt(s.latest)}。`,
  };
}

export default async function CountyPage({ params }: { params: Promise<{ slug: string }> }) {
  const county = countyBySlug((await params).slug);
  if (!county) notFound();
  const [{ list, meta }, temples] = await Promise.all([loadIncidents(), loadTemples()]);
  const s = countyStats(list, county.name);
  const cells = (riskCellsByCounty(list).get(county.name) ?? []).filter((c) => c.level >= 1).slice(0, 5);
  const local = temples.filter((t) => t.county === county.name).sort((a, b) => Number(b.shoujing) - Number(a.shoujing));
  const nearbyShoujing = local.some((t) => t.shoujing) ? [] : nearestTemples(county, temples.filter((t) => t.shoujing), 3);

  return (
    <>
      <PageTitle
        title={`${county.name}事件統計`}
        sub={<>資料截至 {fmt(s.latest)}・<Link className="underline" href={mapLink(county.lat, county.lng, county.zoom)}>在地圖上查看{county.name}</Link></>}
      />
      {meta.demo !== false && <DemoNotice />}

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {s.windows.map((w) => (
          <StatTile key={w.days} label={`近 ${w.days} 天事件`} value={w.count} sub={`死亡／重大 ${w.fatal} 起`} prev={w.prevCount} />
        ))}
      </div>

      <Section title="每月趨勢">
        <MonthlyChart data={s.monthly} title={`${county.name}每月事件數（近 24 個月）`} />
      </Section>

      <div className="grid gap-x-5 md:grid-cols-2">
        <Section title="事件類別">
          <TypeBars data={s.types} title="近 365 天各類別件數" />
        </Section>

        <Section title="風險較高的區域">
          {cells.length === 0 ? (
            <p className="text-sm text-muted">近 {MAP_DEFAULT_WINDOW} 天沒有分級為「中」以上的網格。</p>
          ) : (
            <ol className="space-y-3 text-[13px]">
              {cells.map((c) => (
                <li key={c.key} className="leading-relaxed">
                  <div className="flex items-center gap-2">
                    <LevelBadge level={c.level} />
                    <span className="text-muted">約 4 公里網格・中心 {c.lat.toFixed(3)}, {c.lng.toFixed(3)}</span>
                  </div>
                  <div className="mt-0.5">{riskReasons(c).join('；')}。{LEVELS[c.level].advice}</div>
                  <Link className="text-accent underline" href={mapLink(c.lat, c.lng, 13)}>在地圖上查看這一區</Link>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-xs text-muted">依首頁地圖預設畫面（最新日期往前 {MAP_DEFAULT_WINDOW} 天、全部類別）的全國分級，取落在{county.name}的網格。</p>
        </Section>
      </div>

      <Section title="收驚／祈福宮廟">
        {local.length > 0 && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {local.map((t) => (
              <li key={t.id}>
                <Link className="font-medium text-accent underline" href={`/temples/${t.id}`}>{t.name}</Link>
                <span className="text-[13px] text-muted">{t.deity ? `・主祀${t.deity}` : ''}{t.shoujing ? '・可收驚' : ''}</span>
              </li>
            ))}
          </ul>
        )}
        {nearbyShoujing.length > 0 && (
          <>
            <p className="mb-2 text-[13px] text-muted">{local.length ? '' : `精選清單中${county.name}暫無宮廟，`}最近的可收驚宮廟：</p>
            <ul className="space-y-1 text-[13px]">
              {nearbyShoujing.map((t) => (
                <li key={t.id}>
                  <Link className="text-accent underline" href={`/temples/${t.id}`}>{t.name}</Link>（{t.county}，約 {t.km.toFixed(0)} 公里）
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-3 text-xs text-muted">在地圖上用「搜尋目前畫面附近宮廟」可找到更多 OpenStreetMap 上的宮廟。</p>
      </Section>
    </>
  );
}
