-- M3：事件、宮廟與匯入紀錄。網站只由伺服器以 service role 存取：開啟 RLS 且不建立任何 policy。
-- 座標先用 lat/lng 欄位（範圍查詢用一般索引即可）；需要距離查詢時再加 PostGIS。

create table if not exists public.incidents (
  id text primary key,                         -- 例：a1-20230105-073000-25.03321-121.54321
  occurred_on date not null,
  occurred_at time,
  lat double precision not null check (lat between 21.8 and 26.5),
  lng double precision not null check (lng between 118 and 122.2),
  type text not null,
  severity smallint not null check (severity between 1 and 5),
  title text not null,
  county text,
  place text,
  deaths smallint,
  injuries smallint,
  cause text,
  vehicles text[],
  source text not null,                        -- 資料集網址，或 'demo'
  imported_at timestamptz not null default now()
);
create index if not exists incidents_occurred_on on public.incidents (occurred_on);
create index if not exists incidents_lat_lng on public.incidents (lat, lng);
alter table public.incidents enable row level security;

create table if not exists public.temples (
  id text primary key,
  name text not null,
  county text not null,
  lat double precision not null,
  lng double precision not null,
  shoujing boolean not null default false,
  deity text,
  note text,
  address text,
  phone text,
  website text,
  shoujing_hours text,
  needs_booking boolean,
  verified_on date,                            -- 最後確認日期
  updated_at timestamptz not null default now()
);
alter table public.temples enable row level security;

create table if not exists public.import_runs (
  id bigserial primary key,
  source text not null,
  trigger text not null,                       -- cron / admin / cli
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  fetched integer,
  added integer,
  skipped integer,
  error text
);
create index if not exists import_runs_started_at on public.import_runs (started_at desc);
alter table public.import_runs enable row level security;

-- 依條件取事件，回傳單一 JSON（避開 REST API 每次 1,000 列的上限）。超過上限時取最新的 p_limit 筆。
create or replace function public.incidents_query(
  p_from date default null,
  p_to date default null,
  p_south double precision default null,
  p_west double precision default null,
  p_north double precision default null,
  p_east double precision default null,
  p_types text[] default null,
  p_limit integer default 20000
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with f as (
    select * from incidents
    where (p_from is null or occurred_on >= p_from)
      and (p_to is null or occurred_on <= p_to)
      and (p_south is null or (lat between p_south and p_north and lng between p_west and p_east))
      and (p_types is null or type = any (p_types))
  ),
  picked as (
    select * from f order by occurred_on desc, occurred_at desc nulls last, id desc limit greatest(p_limit, 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from f),
    'has_demo', exists (select 1 from incidents where source = 'demo'),
    'range', (select jsonb_build_array(min(occurred_on), max(occurred_on)) from incidents),
    'records', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', id, 'date', occurred_on, 'time', occurred_at, 'lat', lat, 'lng', lng,
        'type', type, 'severity', severity, 'title', title, 'county', county, 'place', place,
        'deaths', deaths, 'injuries', injuries, 'cause', cause, 'vehicles', vehicles, 'source', source
      )) order by occurred_on, occurred_at nulls first, id)
      from picked
    ), '[]'::jsonb)
  );
$$;

-- 新增事件，已存在的 id 略過（依 id 去重）。回傳實際新增的筆數。
create or replace function public.incidents_add(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_added integer;
begin
  insert into incidents (id, occurred_on, occurred_at, lat, lng, type, severity, title, county, place, deaths, injuries, cause, vehicles, source)
  select r.id, r.date, nullif(r.time, '')::time, r.lat, r.lng, r.type, r.severity, r.title, r.county, r.place,
         r.deaths, r.injuries, r.cause, r.vehicles, r.source
  from jsonb_to_recordset(p_rows) as r(
    id text, date date, time text, lat double precision, lng double precision, type text, severity smallint,
    title text, county text, place text, deaths smallint, injuries smallint, cause text, vehicles text[], source text
  )
  on conflict (id) do nothing;
  get diagnostics v_added = row_count;
  return v_added;
end;
$$;

-- 開始一次匯入。15 分鐘內有尚未結束的匯入就拒絕（避免排程與手動同時執行）。
create or replace function public.import_run_start(p_source text, p_trigger text)
returns public.import_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run import_runs;
begin
  perform pg_advisory_xact_lock(hashtext('import_runs'));
  if exists (select 1 from import_runs where finished_at is null and started_at > now() - interval '15 minutes') then
    raise exception 'import already running' using errcode = 'P0001';
  end if;
  insert into import_runs (source, trigger) values (p_source, p_trigger) returning * into v_run;
  return v_run;
end;
$$;

revoke all on function public.incidents_query(date, date, double precision, double precision, double precision, double precision, text[], integer) from public, anon, authenticated;
revoke all on function public.incidents_add(jsonb) from public, anon, authenticated;
revoke all on function public.import_run_start(text, text) from public, anon, authenticated;
