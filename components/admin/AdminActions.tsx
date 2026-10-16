'use client';
// 後台的「立即匯入」與「登出」按鈕
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ImportButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<{ busy: boolean; message: string }>({ busy: false, message: '' });

  async function run() {
    setState({ busy: true, message: '' });
    const r = await fetch('/api/admin/import', { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    const message = r.ok ? `完成：新增 ${j.added} 起，已存在 ${(j.fetched ?? 0) - (j.added ?? 0)} 起` : `失敗：${j.error ?? `HTTP ${r.status}`}`;
    setState({ busy: false, message });
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={run} disabled={disabled || state.busy} className="rounded-lg bg-accent px-4 py-2 font-semibold text-white disabled:opacity-60">
        {state.busy ? '匯入中…（約需 1 分鐘）' : '立即匯入 A1 資料'}
      </button>
      {state.message && <span role="status" className="text-sm">{state.message}</span>}
    </div>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-sm underline"
      onClick={async () => {
        await fetch('/api/admin/logout', { method: 'POST' });
        router.replace('/admin/login');
      }}
    >
      登出
    </button>
  );
}
