'use client';
// 「AI 解說」按鈕與結果。按下才呼叫（不自動產生），結果一律標示「AI 生成，僅供參考」。
import { useEffect, useState } from 'react';
import type { ExplainRequest, ExplainResponse } from '@/lib/explain/schema.ts';

let status: Promise<boolean> | undefined;
const aiEnabled = () =>
  (status ??= fetch('/api/explain')
    .then((r) => (r.ok ? r.json() : { enabled: false }))
    .then((j) => Boolean(j.enabled))
    .catch(() => false));

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; res: ExplainResponse }
  | { kind: 'error'; message: string };

export default function AiExplain({ request, compact = false }: { request: ExplainRequest; compact?: boolean }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const reqKey = JSON.stringify(request);

  useEffect(() => {
    aiEnabled().then(setEnabled);
  }, []);
  useEffect(() => setState({ kind: 'idle' }), [reqKey]);

  async function run() {
    setState({ kind: 'loading' });
    try {
      const r = await fetch('/api/explain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: reqKey });
      const j = await r.json();
      setState(r.ok ? { kind: 'done', res: j } : { kind: 'error', message: j.error ?? '暫時無法產生解說' });
    } catch {
      setState({ kind: 'error', message: '連線失敗，請稍後再試' });
    }
  }

  const text = compact ? 'text-[13px]' : 'text-sm';
  if (state.kind === 'done') return <Result res={state.res} compact={compact} />;

  return (
    <div className={`${compact ? 'mt-2' : ''} ${text}`} data-testid="ai-explain">
      <button
        type="button"
        onClick={run}
        disabled={enabled !== true || state.kind === 'loading'}
        className="inline-flex items-center gap-1.5 rounded-lg border border-accent px-3 py-1.5 font-semibold text-accent hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:border-line disabled:bg-transparent disabled:text-muted"
      >
        <span aria-hidden>✦</span>
        {state.kind === 'loading' ? 'AI 解說產生中…' : enabled === false ? 'AI 解說（尚未啟用）' : 'AI 解說'}
      </button>
      {state.kind === 'loading' && <span role="status" className="sr-only">AI 解說產生中</span>}
      {state.kind === 'error' && (
        <p role="alert" className="mt-1.5 text-muted">{state.message}</p>
      )}
      {!compact && (
        <p className="mt-1.5 text-xs text-muted">由 AI 依本頁統計數字寫成白話說明，內容僅供參考，不是官方警示。</p>
      )}
    </div>
  );
}

function Result({ res, compact }: { res: ExplainResponse; compact: boolean }) {
  const e = res.explanation;
  const ai = res.source !== 'template';
  return (
    <div
      data-testid="ai-explain-result"
      className={`${compact ? 'mt-2 max-h-56 overflow-y-auto text-[13px]' : 'text-sm'} rounded-lg border border-line bg-bg p-3 leading-relaxed`}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-ink px-1.5 py-0.5 font-semibold text-surface">{ai ? 'AI 生成，僅供參考' : '統計摘要（非 AI）'}</span>
        {!ai && <span className="text-muted">AI 暫時無法使用，改顯示統計摘要</span>}
      </div>
      <p>{e.summary}</p>
      <ul className="mt-1.5 list-disc pl-4">
        {e.factors.map((f) => <li key={f}>{f}</li>)}
      </ul>
      <p className="mt-1.5 font-semibold">建議</p>
      <ul className="list-disc pl-4">
        {e.advice.map((a) => <li key={a}>{a}</li>)}
      </ul>
      {e.caveats && <p className="mt-1.5 text-xs text-muted">{e.caveats}</p>}
      <p className="mt-1 text-xs text-muted">範圍：{res.scope}</p>
    </div>
  );
}
