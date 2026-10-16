import Link from 'next/link';
import { PageTitle, Section } from '@/components/ui';
import AdminNav from '@/components/admin/AdminNav';
import { requireAdminPage } from '@/lib/server/admin/guard.ts';
import { getRepo } from '@/lib/server/repo/index.ts';

export const dynamic = 'force-dynamic';

export default async function AdminTemplesPage() {
  await requireAdminPage();
  const repo = getRepo();
  const temples = (await repo.temples()).sort((a, b) => a.county.localeCompare(b.county, 'zh-TW') || a.name.localeCompare(b.name, 'zh-TW'));
  return (
    <>
      <PageTitle title="宮廟資料" sub={`共 ${temples.length} 間；「最後確認」為實際查證地址、電話、收驚時段的日期。`} />
      <AdminNav />
      {repo.writable && (
        <p className="mb-4"><Link className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white" href="/admin/temples/new">新增宮廟</Link></p>
      )}
      <Section title="清單">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[13px]">
            <thead className="text-muted">
              <tr><th className="py-1 pr-3 font-normal">名稱</th><th className="pr-3 font-normal">縣市</th><th className="pr-3 font-normal">收驚</th><th className="font-normal">最後確認</th></tr>
            </thead>
            <tbody>
              {temples.map((t) => (
                <tr key={t.id} className="border-t border-line">
                  <td className="py-1.5 pr-3"><Link className="text-accent underline" href={`/admin/temples/${t.id}`}>{t.name}</Link></td>
                  <td className="pr-3">{t.county}</td>
                  <td className="pr-3">{t.shoujing ? '是' : '—'}</td>
                  <td>{t.verifiedOn ?? <span className="text-muted">尚未確認</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
