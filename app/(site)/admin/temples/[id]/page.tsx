import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageTitle } from '@/components/ui';
import AdminNav from '@/components/admin/AdminNav';
import TempleForm from '@/components/admin/TempleForm';
import { requireAdminPage } from '@/lib/server/admin/guard.ts';
import { getRepo, ReadOnlyError } from '@/lib/server/repo/index.ts';

export const dynamic = 'force-dynamic';

export default async function AdminTemplePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const repo = getRepo();
  const temple = (await repo.temples()).find((t) => t.id === id);
  if (!temple) notFound();
  return (
    <>
      <PageTitle title={`編輯：${temple.name}`} sub={<Link className="underline" href={`/temples/${temple.id}`}>查看公開頁面</Link>} />
      <AdminNav />
      {!repo.writable && <p className="mb-4 text-sm text-muted">{new ReadOnlyError().message}。</p>}
      <TempleForm temple={temple} readOnly={!repo.writable} />
    </>
  );
}
