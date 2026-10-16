'use client';
// 宮廟新增／編輯表單。驗證在伺服器端（與 public/data/temples.json 同一套規則）。
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { COUNTIES } from '@/lib/counties.ts';
import type { TempleRecord } from '@/lib/temple-schema.ts';

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });

export default function TempleForm({ temple, create, readOnly }: { temple?: TempleRecord; create?: boolean; readOnly?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<{ busy: boolean; error: string; saved: boolean }>({ busy: false, error: '', saved: false });

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? '');
    const booking = get('needsBooking');
    const body = {
      create,
      temple: {
        id: get('id'), name: get('name'), county: get('county'), lat: get('lat'), lng: get('lng'),
        shoujing: f.get('shoujing') === 'on',
        deity: get('deity'), note: get('note'), address: get('address'), phone: get('phone'), website: get('website'),
        shoujingHours: get('shoujingHours'),
        needsBooking: booking === '' ? undefined : booking === 'yes',
        verifiedOn: get('verifiedOn'),
      },
    };
    setState({ busy: true, error: '', saved: false });
    const r = await fetch('/api/admin/temples', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setState({ busy: false, error: j.error ?? `HTTP ${r.status}`, saved: false });
    setState({ busy: false, error: '', saved: true });
    if (create) router.replace(`/admin/temples/${j.temple.id}`);
    else router.refresh();
  }

  const t = temple;
  const input = 'mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 disabled:opacity-70';
  const text = (name: keyof TempleRecord, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block text-sm">
      {label}
      <input name={name} defaultValue={t?.[name] === undefined ? '' : String(t[name])} className={input} {...extra} />
    </label>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset disabled={readOnly || state.busy} className="grid gap-4 sm:grid-cols-2">
        {text('name', '名稱 *', { required: true })}
        {text('id', '網址代稱 *（小寫英數與連字號，建立後不可改）', { required: true, readOnly: !create, pattern: '[a-z0-9]+(-[a-z0-9]+)*' })}
        <label className="block text-sm">
          縣市 *
          <select name="county" defaultValue={t?.county ?? ''} required className={input}>
            <option value="" disabled>請選擇</option>
            {COUNTIES.map((c) => <option key={c.slug}>{c.name}</option>)}
          </select>
        </label>
        {text('deity', '主祀')}
        {text('lat', '緯度 *', { required: true, inputMode: 'decimal' })}
        {text('lng', '經度 *', { required: true, inputMode: 'decimal' })}
        {text('address', '地址')}
        {text('phone', '電話')}
        {text('website', '網站（https://）', { type: 'url' })}
        {text('shoujingHours', '收驚時段')}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="shoujing" defaultChecked={t?.shoujing ?? false} /> 提供收驚
        </label>
        <label className="block text-sm">
          需要預約
          <select name="needsBooking" defaultValue={t?.needsBooking === undefined ? '' : t.needsBooking ? 'yes' : 'no'} className={input}>
            <option value="">尚未確認</option>
            <option value="yes">需要</option>
            <option value="no">不需要</option>
          </select>
        </label>
        <label className="block text-sm sm:col-span-2">
          備註
          <textarea name="note" defaultValue={t?.note ?? ''} rows={2} className={input} />
        </label>
        <label className="block text-sm">
          最後確認日期（實際向宮廟查證地址、電話、收驚時段的日期）
          <input type="date" name="verifiedOn" defaultValue={t?.verifiedOn ?? ''} max={today()} className={input} />
        </label>
      </fieldset>
      {state.error && <p role="alert" className="text-sm text-accent">{state.error}</p>}
      {state.saved && <p role="status" className="text-sm">已儲存，公開頁面會在下次瀏覽時更新。</p>}
      {!readOnly && (
        <button type="submit" disabled={state.busy} className="rounded-lg bg-accent px-4 py-2 font-semibold text-white disabled:opacity-60">
          {state.busy ? '儲存中…' : create ? '新增宮廟' : '儲存'}
        </button>
      )}
    </form>
  );
}
