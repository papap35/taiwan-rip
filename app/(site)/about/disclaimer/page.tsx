import type { Metadata } from 'next';
import { PageTitle, Section } from '@/components/ui';
import AboutNav from '../AboutNav';

export const metadata: Metadata = {
  title: '免責與隱私',
  description: '使用本網站前請先閱讀：分級僅供參考、資料限制、隱私說明與緊急求助資訊。',
};

export default function DisclaimerPage() {
  return (
    <>
      <PageTitle title="免責與隱私" />
      <AboutNav />
      <Section title="需要協助">
        <ul className="space-y-1 text-sm">
          <li>緊急狀況：<a className="font-semibold text-accent" href="tel:110">110</a> 報案、<a className="font-semibold text-accent" href="tel:119">119</a> 救護</li>
          <li>心情低落、需要有人聊聊：<a className="font-semibold text-accent" href="tel:1925">1925</a> 安心專線（24 小時、免付費）</li>
        </ul>
      </Section>
      <Section title="免責聲明">
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
          <li>本網站的危險分級是統計參考，<b>不是官方警示</b>，也不保證任何地區的安全或危險。</li>
          <li>資料可能有延遲、遺漏或錯誤，事件位置可能經過模糊化；實際狀況請以警方與官方公告為準。</li>
          <li>本網站不顯示當事人姓名或可識別個人的資訊，也不接受對特定個人的指控或回報。</li>
          <li>宮廟資訊（收驚時段、電話等）可能變動，前往前請先與宮廟確認。</li>
        </ul>
      </Section>
      <Section title="隱私">
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
          <li>本網站不需要登入、不使用 Cookie、不放廣告或追蹤程式。</li>
          <li>「我的位置」只在你的瀏覽器裡用來移動地圖與找最近的宮廟，<b>不會傳到本網站的伺服器</b>。</li>
          <li>為了顯示地圖，你的瀏覽器會向 OpenFreeMap 下載目前畫面的地圖圖磚；使用「搜尋附近宮廟」時，會把目前畫面的範圍送到 OpenStreetMap 的 Overpass 服務查詢。</li>
          <li>你匯入的 CSV／JSON 檔只在瀏覽器內處理，不會上傳。</li>
          <li>網站由 Vercel 託管，Vercel 可能保留一般的連線紀錄（例如 IP 位址）。</li>
        </ul>
      </Section>
    </>
  );
}
