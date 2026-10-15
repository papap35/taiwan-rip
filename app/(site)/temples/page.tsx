import type { Metadata } from 'next';
import { loadTemples } from '@/lib/server/dataset.ts';
import TempleDirectory from '@/components/temples/TempleDirectory';
import { PageTitle } from '@/components/ui';

export const metadata: Metadata = {
  title: '宮廟與收驚',
  description: '台灣各地可收驚、祈福的宮廟目錄，可依縣市篩選，並提供導航連結。',
};

export default async function TemplesPage() {
  const temples = await loadTemples();
  return (
    <>
      <PageTitle title="宮廟與收驚" sub="精選宮廟目錄。座標為概略位置；收驚時段、是否需預約請以各宮廟公告為準。" />
      <TempleDirectory temples={temples} />
      <p className="mt-6 text-[13px] text-muted">
        想找更多宮廟？在地圖上放大到鄉鎮範圍，按「搜尋目前畫面附近宮廟」可即時查詢 OpenStreetMap 上的宮廟與寺院。
      </p>
    </>
  );
}
