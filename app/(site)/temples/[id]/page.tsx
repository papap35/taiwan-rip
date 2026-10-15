import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadTemples } from '@/lib/server/dataset.ts';
import { gmapLink } from '@/lib/temples.ts';
import { countyByName } from '@/lib/counties.ts';
import { templeReportUrl } from '@/lib/site.ts';
import { PageTitle, Section } from '@/components/ui';

const UNKNOWN = <span className="text-muted">尚未確認，請以宮廟公告為準</span>;

export const dynamicParams = false;
export async function generateStaticParams() {
  return (await loadTemples()).map((t) => ({ id: t.id }));
}

async function getTemple(id: string) {
  return (await loadTemples()).find((t) => t.id === id);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const t = await getTemple((await params).id);
  if (!t) return {};
  return {
    title: `${t.name}｜${t.county}`,
    description: `${t.name}（${t.county}）${t.deity ? `主祀${t.deity}。` : ''}${t.shoujing ? '提供收驚。' : ''}地圖位置、導航與宮廟資訊。`,
  };
}

export default async function TemplePage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTemple((await params).id);
  if (!t) notFound();
  const county = countyByName(t.county);
  const rows: [string, React.ReactNode][] = [
    ['縣市', county ? <Link className="text-accent underline" href={`/county/${county.slug}`}>{t.county}</Link> : t.county],
    ['主祀', t.deity || UNKNOWN],
    ['收驚', t.shoujing ? '提供' : '未標示提供（可電話詢問）'],
    ['收驚時段', t.shoujingHours || UNKNOWN],
    ['需預約', t.needsBooking === undefined ? UNKNOWN : t.needsBooking ? '需要' : '不需要'],
    ['地址', t.address || UNKNOWN],
    ['電話', t.phone ? <a className="text-accent underline" href={`tel:${t.phone.replace(/[^\d+]/g, '')}`}>{t.phone}</a> : UNKNOWN],
    ['官方網站', t.website ? <a className="text-accent underline break-all" href={t.website} target="_blank" rel="noopener">{t.website}</a> : UNKNOWN],
    ['備註', t.note || '—'],
    ['資訊確認日期', t.verifiedOn || '尚未確認'],
  ];

  return (
    <>
      <PageTitle title={t.name} sub={<Link className="underline" href="/temples">← 宮廟目錄</Link>} />
      <Section title="宮廟資訊">
        <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-2 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <div className="flex flex-wrap gap-2 text-sm">
        <a className="rounded-lg bg-accent px-4 py-2 text-white" href={gmapLink(t)} target="_blank" rel="noopener">導航前往</a>
        <Link className="rounded-lg border border-line bg-surface px-4 py-2" href={`/?lat=${t.lat}&lng=${t.lng}&z=14`}>在地圖上查看附近事件</Link>
        <a className="rounded-lg border border-line bg-surface px-4 py-2" href={templeReportUrl(t.name, t.id)} target="_blank" rel="noopener">資訊有誤？回報更正</a>
      </div>
      <p className="mt-4 text-xs text-muted">座標為概略位置。前往收驚前，建議先電話確認服務時段。</p>
    </>
  );
}
