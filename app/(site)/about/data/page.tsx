import type { Metadata } from 'next';
import { loadIncidents, loadTemples } from '@/lib/server/dataset.ts';
import { DemoNotice, PageTitle, Section } from '@/components/ui';
import AboutNav from '../AboutNav';

export const metadata: Metadata = {
  title: '資料來源',
  description: '事件資料、宮廟資料、地圖底圖的來源與更新方式，以及目前資料的涵蓋範圍。',
};

export default async function DataPage() {
  const [{ meta, list }, temples] = await Promise.all([loadIncidents(), loadTemples()]);
  const isDemo = meta.demo !== false;
  const range = list.length ? `${new Date(list[0].t).toISOString().slice(0, 10)} ～ ${new Date(list.at(-1)!.t).toISOString().slice(0, 10)}` : '—';
  const sources: string[] = Array.isArray(meta.sources) ? meta.sources : meta.source ? [meta.source] : [];
  return (
    <>
      <PageTitle title="資料來源" sub="網站上每一個數字從哪裡來、多久更新一次。" />
      <AboutNav />
      {isDemo && <DemoNotice />}
      <Section title="目前的事件資料">
        <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted">資料集</dt><dd>{meta.name ?? '—'}</dd>
          <dt className="text-muted">筆數</dt><dd>{list.length.toLocaleString('zh-TW')} 起</dd>
          <dt className="text-muted">期間</dt><dd>{range}</dd>
          <dt className="text-muted">最後更新</dt><dd>{meta.updated ?? meta.converted ?? '—'}</dd>
          {sources.length > 0 && (
            <>
              <dt className="text-muted">來源網址</dt>
              <dd className="space-y-1">{sources.map((s) => <div key={s} className="break-all"><a className="text-accent underline" href={s} target="_blank" rel="noopener">{s}</a></div>)}</dd>
            </>
          )}
        </dl>
        {meta.note && <p className="mt-3 text-[13px] text-muted">{meta.note}</p>}
      </Section>
      <Section title="資料來源與更新方式">
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
          <li>
            <b>交通死亡事故</b>：內政部警政署「即時交通事故資料（A1 類）」（
            <a className="text-accent underline" href="https://data.gov.tw/dataset/12818" target="_blank" rel="noopener">政府資料開放平臺</a>
            ），A1 指當場或 24 小時內死亡的事故。開啟自動更新後每天檢查一次，有新資料才更新網站。
          </li>
          <li><b>其他案件類別</b>（命案、強盜、竊盜等）：目前沒有含座標的開放資料，尚未納入；示範資料中的這些類別為隨機產生。</li>
          <li><b>宮廟</b>：精選 {temples.length} 間，座標為概略位置、收驚資訊需再確認；地圖上的「搜尋附近宮廟」即時查詢 <a className="text-accent underline" href="https://www.openstreetmap.org/" target="_blank" rel="noopener">OpenStreetMap</a>。</li>
          <li><b>地圖底圖</b>：<a className="text-accent underline" href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a>，地圖資料 © OpenStreetMap 貢獻者。</li>
        </ul>
      </Section>
    </>
  );
}
