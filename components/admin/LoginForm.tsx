'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const password = new FormData(e.currentTarget).get('password');
    const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    setBusy(false);
    if (r.ok) router.replace('/admin');
    else setError((await r.json().catch(() => ({}))).error ?? '登入失敗');
  }

  return (
    <form onSubmit={submit} className="max-w-sm space-y-3">
      <label className="block text-sm">
        管理員密碼
        <input name="password" type="password" required autoComplete="current-password" className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2" />
      </label>
      {error && <p role="alert" className="text-sm text-accent">{error}</p>}
      <button type="submit" disabled={busy} className="rounded-lg bg-accent px-4 py-2 font-semibold text-white disabled:opacity-60">
        {busy ? '登入中…' : '登入'}
      </button>
    </form>
  );
}
