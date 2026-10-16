import { PageTitle, Section } from '@/components/ui';
import AdminNav from '@/components/admin/AdminNav';
import { ImportButton } from '@/components/admin/AdminActions';
import { requireAdminPage } from '@/lib/server/admin/guard.ts';
import { getRepo, ReadOnlyError } from '@/lib/server/repo/index.ts';

export const dynamic = 'force-dynamic';

const BACKEND = { files: '檔案（public/data，唯讀）', memory: '記憶體（測試用）', supabase: 'Supabase 資料庫' };
const TRIGGER = { cron: '每日排程', admin: '後台手動', cli: '命令列' };
const fmtTime = (s?: string) => (s ? new Date(s).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) : '—');

export default async function AdminPage() {
  await requireAdminPage();
  const repo = getRepo();
  const [{ meta, total }, runs] = await Promise.all([repo.incidents({ limit: 1 }), repo.importRuns(30)]);
  const lastFinished = runs.find((r) => r.finishedAt);

  return (
    <>
      <PageTitle title="管理後台" />
      <AdminNav />
      <Section title="資料狀態">
        <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted">資料來源</dt><dd data-testid="backend">{BACKEND[repo.kind]}</dd>
          <dt className="text-muted">事件筆數</dt><dd data-testid="incident-total">{total.toLocaleString('zh-TW')} 起{meta.demo ? '（含示範資料）' : ''}</dd>
          <dt className="text-muted">期間</dt><dd>{meta.range.join(' ～ ') || '—'}</dd>
          <dt className="text-muted">最後成功匯入</dt><dd>{meta.updated ?? '—'}</dd>
        </dl>
        {lastFinished?.error && (
          <p role="alert" className="mt-3 rounded-lg border border-notice-line bg-notice px-3 py-2 text-sm">最近一次匯入失敗：{lastFinished.error}</p>
        )}
      </Section>
      <Section title="A1 交通事故匯入">
        {repo.writable ? (
          <p className="mb-3 text-sm text-muted">每天 09:17（台灣時間）自動匯入；已存在的事件會略過，不會重複。</p>
        ) : (
          <p className="mb-3 text-sm text-muted">{new ReadOnlyError().message}。目前由 GitHub Actions「Update A1 data」更新檔案。</p>
        )}
        <ImportButton disabled={!repo.writable} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]" data-testid="import-runs">
            <thead className="text-muted">
              <tr><th className="py-1 pr-3 font-normal">開始時間</th><th className="pr-3 font-normal">觸發</th><th className="pr-3 font-normal">結果</th><th className="pr-3 font-normal">下載</th><th className="pr-3 font-normal">新增</th><th className="font-normal">略過列</th></tr>
            </thead>
            <tbody>
              {runs.length === 0 && <tr><td colSpan={6} className="py-2 text-muted">尚無匯入紀錄</td></tr>}
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="py-1.5 pr-3 whitespace-nowrap">{fmtTime(r.startedAt)}</td>
                  <td className="pr-3">{TRIGGER[r.trigger] ?? r.trigger}</td>
                  <td className="pr-3">{!r.finishedAt ? '進行中' : r.error ? <span className="text-accent">失敗：{r.error}</span> : '成功'}</td>
                  <td className="pr-3">{r.fetched ?? '—'}</td>
                  <td className="pr-3">{r.added ?? '—'}</td>
                  <td>{r.skipped ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
