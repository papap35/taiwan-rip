'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const NAV = [
  { href: '/', label: '地圖' },
  { href: '/county', label: '縣市統計' },
  { href: '/temples', label: '宮廟／收驚' },
  { href: '/about/method', label: '說明' },
] as const;

const isActive = (path: string, href: string) => (href === '/' ? path === '/' : path.startsWith(href.replace(/\/method$/, '')));

export default function SiteNav({ className = '' }: { className?: string }) {
  const path = usePathname();
  return (
    <nav aria-label="主選單" className={`flex gap-1 text-sm ${className}`}>
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          aria-current={isActive(path, n.href) ? 'page' : undefined}
          className="rounded-md px-2.5 py-1.5 whitespace-nowrap text-muted hover:bg-bg hover:text-ink aria-[current=page]:font-semibold aria-[current=page]:text-ink"
        >
          {n.label}
        </Link>
      ))}
    </nav>
  );
}
