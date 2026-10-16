import { PageTitle } from '@/components/ui';
import AdminNav from '@/components/admin/AdminNav';
import TempleForm from '@/components/admin/TempleForm';
import { requireAdminPage } from '@/lib/server/admin/guard.ts';
import { getRepo, ReadOnlyError } from '@/lib/server/repo/index.ts';

export const dynamic = 'force-dynamic';

export default async function NewTemplePage() {
  await requireAdminPage();
  const repo = getRepo();
  return (
    <>
      <PageTitle title="新增宮廟" />
      <AdminNav />
      {!repo.writable && <p className="mb-4 text-sm text-muted">{new ReadOnlyError().message}。</p>}
      <TempleForm create readOnly={!repo.writable} />
    </>
  );
}
