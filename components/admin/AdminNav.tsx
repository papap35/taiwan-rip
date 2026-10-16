import Link from 'next/link';
import { LogoutButton } from './AdminActions';

export default function AdminNav() {
  return (
    <nav aria-label="後台選單" className="mb-5 flex flex-wrap items-center gap-4 border-b border-line pb-3 text-sm">
      <Link className="font-semibold underline" href="/admin">匯入紀錄</Link>
      <Link className="font-semibold underline" href="/admin/temples">宮廟資料</Link>
      <span className="ml-auto"><LogoutButton /></span>
    </nav>
  );
}
