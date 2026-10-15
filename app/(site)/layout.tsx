import Link from 'next/link';
import SiteNav from '@/components/SiteNav';

// 內容頁（縣市、宮廟、說明）共用版型：可捲動，頂部選單，底部求助資訊
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
          <Link href="/" className="text-base font-bold tracking-wide md:text-lg">台灣事件風險地圖</Link>
          <SiteNav className="-mx-2 overflow-x-auto" />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-12">{children}</main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-6 text-[13px] leading-relaxed text-muted">
          <p>
            緊急狀況 <a className="font-semibold text-accent" href="tel:110">110</a> 報案、
            <a className="font-semibold text-accent" href="tel:119">119</a> 救護；心情低落可撥{' '}
            <a className="font-semibold text-accent" href="tel:1925">1925</a> 安心專線（24 小時）。
          </p>
          <p className="mt-1">
            分級為統計參考，非官方警示。<Link className="underline" href="/about/disclaimer">免責與隱私</Link>・
            <Link className="underline" href="/about/data">資料來源</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
