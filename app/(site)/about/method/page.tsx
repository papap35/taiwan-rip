import type { Metadata } from 'next';
import Link from 'next/link';
import { LEVELS } from '@/lib/risk.ts';
import { TYPES, TYPE_KEYS } from '@/lib/data.ts';
import { PageTitle, Section, LevelBadge } from '@/components/ui';
import AboutNav from '../AboutNav';

export const metadata: Metadata = {
  title: '分級方法',
  description: 'AI 危險分級怎麼算：4 公里網格、時間加權嚴重度、致死件數、近期升溫趨勢與 K-means 分群，以及這個方法的限制。',
};

export default function MethodPage() {
  return (
    <>
      <PageTitle title="分級方法" sub="地圖上的「AI 危險分級」是怎麼算出來的，以及它不能告訴你什麼。" />
      <AboutNav />
      <Section title="怎麼算">
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
          <li>把台灣切成約 4 公里見方的網格（經緯度各 0.04 度），只看時間軸目前選的時間窗與事件類別。</li>
          <li>
            每起事件依嚴重度給分：
            {TYPE_KEYS.filter((k) => k !== 'other').map((k) => `${TYPES[k].label} ${TYPES[k].severity}`).join('、')}
            ；越近期權重越高（半衰期為時間窗的 1/3）。
          </li>
          <li>每個網格算三個特徵：時間加權嚴重度、死亡或重大事件件數、近期 1/3 時段的事件占比（升溫趨勢；件數少時往中性值收斂）。</li>
          <li>用 K-means 非監督式分群把網格分成四群，再依群中心的綜合分數排成：
            <span className="ml-1 inline-flex gap-1">{LEVELS.map((_, i) => <LevelBadge key={i} level={i} />)}</span>
          </li>
          <li>證據不足時封頂：只有 1 起事件的網格最多「低」，2 起最多「中」，避免偶發事件把一個地區標成危險。</li>
        </ol>
        <p className="mt-3 text-[13px] text-muted">
          「AI」指的是上述統計分群演算法，不是大型語言模型；同一份資料每次算出的結果完全相同。
        </p>
      </Section>
      <Section title="限制">
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
          <li><b>相對分級</b>：每個等級是和同一時間窗內其他網格比較的結果，不代表絕對安全或危險。</li>
          <li><b>沒有依人口或人流校正</b>：人多的地方事件自然多，分級高不等於每個人遇到事件的機率高。</li>
          <li><b>資料有範圍與延遲</b>：目前只納入公開資料涵蓋的事件類型（見<Link className="underline" href="/about/data">資料來源</Link>），未納入的事件不會出現在地圖上。</li>
          <li><b>網格是方塊</b>：4 公里網格不會對齊行政區或街道，邊界附近的事件可能被分到相鄰網格。</li>
          <li>請把分級當作參考，實際狀況以警方與官方公告為準。</li>
        </ul>
      </Section>
    </>
  );
}
