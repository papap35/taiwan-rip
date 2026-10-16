-- AI 區域解說的快取與用量計數。只由伺服器以 service role 存取：開啟 RLS 且不建立任何 policy。

create table if not exists public.ai_explanations (
  cache_key text primary key,
  body jsonb not null,
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);
alter table public.ai_explanations enable row level security;

create table if not exists public.ai_rate_limits (
  bucket text primary key,
  count integer not null,
  reset_at timestamptz not null
);
alter table public.ai_rate_limits enable row level security;

-- 計數 +1（原子操作），回傳是否仍在上限內。視窗過期就重新起算。
create or replace function public.ai_rate_limit_hit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into ai_rate_limits as r (bucket, count, reset_at)
  values (p_bucket, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (bucket) do update
    set count = case when r.reset_at <= now() then 1 else r.count + 1 end,
        reset_at = case when r.reset_at <= now() then excluded.reset_at else r.reset_at end
  returning count into v_count;
  return v_count <= p_limit;
end;
$$;

revoke all on function public.ai_rate_limit_hit(text, integer, integer) from public, anon, authenticated;

-- 清理過期計數與 90 天前的快取（可用 pg_cron 每天執行）
create or replace function public.ai_explain_cleanup()
returns void
language sql
security definer
set search_path = public
as $$
  delete from ai_rate_limits where reset_at < now() - interval '1 day';
  delete from ai_explanations where created_at < now() - interval '90 days';
$$;
revoke all on function public.ai_explain_cleanup() from public, anon, authenticated;
