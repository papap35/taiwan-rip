import { PageTitle } from '@/components/ui';
import LoginForm from '@/components/admin/LoginForm';
import { adminConfigured } from '@/lib/server/admin/session.ts';

export const dynamic = 'force-dynamic';

export default function AdminLoginPage() {
  return (
    <>
      <PageTitle title="管理後台登入" />
      {adminConfigured() ? (
        <LoginForm />
      ) : (
        <p className="text-sm text-muted">後台尚未啟用：請在伺服器環境變數設定 <code>ADMIN_PASSWORD</code>（至少 12 個字元）。</p>
      )}
    </>
  );
}
