import Link from 'next/link';

const ITEMS = [
  { href: '/about/method', label: '分級方法' },
  { href: '/about/data', label: '資料來源' },
  { href: '/about/disclaimer', label: '免責與隱私' },
];

export default function AboutNav() {
  return (
    <nav aria-label="說明頁" className="mb-5 flex flex-wrap gap-2 text-[13px]">
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} className="rounded-full border border-line bg-surface px-3 py-1 hover:border-accent">
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
