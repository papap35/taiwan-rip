// 正式資料庫。schema 與函式見 supabase/migrations/0002_data.sql。
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TempleRecord } from '../../temple-schema.ts';
import { SOURCE_URL } from '../../a1/convert.ts';
import {
  A1_NAME, DEMO_NAME, ImportBusyError, MAX_LIMIT,
  type ImportResult, type ImportRun, type IncidentQuery, type IncidentRecord, type Repo,
} from './types.ts';

const BATCH = 1000;

type TempleRow = {
  id: string; name: string; county: string; lat: number; lng: number; shoujing: boolean;
  deity: string | null; note: string | null; address: string | null; phone: string | null; website: string | null;
  shoujing_hours: string | null; needs_booking: boolean | null; verified_on: string | null;
};
type RunRow = {
  id: number; source: string; trigger: ImportRun['trigger']; started_at: string; finished_at: string | null;
  fetched: number | null; added: number | null; skipped: number | null; error: string | null;
};

const opt = <T,>(v: T | null | undefined) => (v === null ? undefined : v);

export function templeFromRow(r: TempleRow): TempleRecord {
  const t: TempleRecord = { id: r.id, name: r.name, county: r.county, lat: r.lat, lng: r.lng, shoujing: r.shoujing };
  const extra = {
    deity: opt(r.deity), note: opt(r.note), address: opt(r.address), phone: opt(r.phone), website: opt(r.website),
    shoujingHours: opt(r.shoujing_hours), needsBooking: opt(r.needs_booking), verifiedOn: opt(r.verified_on),
  };
  for (const [k, v] of Object.entries(extra)) if (v !== undefined) (t as unknown as Record<string, unknown>)[k] = v;
  return t;
}

export function templeToRow(t: TempleRecord): TempleRow & { updated_at: string } {
  return {
    id: t.id, name: t.name, county: t.county, lat: t.lat, lng: t.lng, shoujing: t.shoujing,
    deity: t.deity ?? null, note: t.note ?? null, address: t.address ?? null, phone: t.phone ?? null, website: t.website ?? null,
    shoujing_hours: t.shoujingHours ?? null, needs_booking: t.needsBooking ?? null, verified_on: t.verifiedOn ?? null,
    updated_at: new Date().toISOString(),
  };
}

const runFromRow = (r: RunRow): ImportRun => ({
  id: String(r.id), source: r.source, trigger: r.trigger, startedAt: r.started_at,
  finishedAt: opt(r.finished_at), fetched: opt(r.fetched), added: opt(r.added), skipped: opt(r.skipped), error: opt(r.error),
});

const fail = (what: string, error: { message: string }) => new Error(`${what}失敗：${error.message}`);

export class SupabaseRepo implements Repo {
  readonly kind = 'supabase' as const;
  readonly writable = true;
  private db: SupabaseClient;

  constructor(db: SupabaseClient) {
    this.db = db;
  }

  async incidents(q: IncidentQuery = {}) {
    const [s, w, n, e] = q.bbox ?? [];
    const [res, last] = await Promise.all([
      this.db.rpc('incidents_query', {
        p_from: q.from ?? null, p_to: q.to ?? null,
        p_south: s ?? null, p_west: w ?? null, p_north: n ?? null, p_east: e ?? null,
        p_types: q.types ?? null, p_limit: Math.min(q.limit ?? MAX_LIMIT, MAX_LIMIT),
      }),
      this.db.from('import_runs').select('finished_at').is('error', null).not('finished_at', 'is', null)
        .order('finished_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (res.error) throw fail('讀取事件', res.error);
    const body = res.data as { total: number; has_demo: boolean; range: (string | null)[]; records: IncidentRecord[] };
    return {
      meta: {
        name: body.has_demo ? DEMO_NAME : A1_NAME,
        demo: body.has_demo,
        source: SOURCE_URL,
        range: body.range.filter((d): d is string => Boolean(d)),
        updated: (last.data?.finished_at as string | undefined)?.slice(0, 10),
        note: 'A1 為當場或 24 小時內死亡之交通事故；當事者順位與肇因為警方初步研判，非鑑定結果。',
      },
      records: body.records,
      total: body.total,
    };
  }

  async addIncidents(records: IncidentRecord[]) {
    let added = 0;
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH).map((r) => ({
        ...r,
        vehicles: typeof r.vehicles === 'string' ? r.vehicles.split('、') : r.vehicles,
      }));
      const { data, error } = await this.db.rpc('incidents_add', { p_rows: batch });
      if (error) throw fail('寫入事件', error);
      added += data as number;
    }
    return added;
  }

  async temples() {
    const out: TempleRecord[] = [];
    for (let from = 0; ; from += BATCH) {
      const { data, error } = await this.db.from('temples').select('*').order('id').range(from, from + BATCH - 1);
      if (error) throw fail('讀取宮廟', error);
      out.push(...(data as TempleRow[]).map(templeFromRow));
      if (data.length < BATCH) return out;
    }
  }

  async saveTemple(t: TempleRecord) {
    const { error } = await this.db.from('temples').upsert(templeToRow(t));
    if (error) throw fail('儲存宮廟', error);
  }

  async importRuns(limit = 30) {
    const { data, error } = await this.db.from('import_runs').select('*').order('started_at', { ascending: false }).limit(limit);
    if (error) throw fail('讀取匯入紀錄', error);
    return (data as RunRow[]).map(runFromRow);
  }

  async startImport(source: string, trigger: ImportRun['trigger']) {
    const { data, error } = await this.db.rpc('import_run_start', { p_source: source, p_trigger: trigger });
    if (error) throw /already running/.test(error.message) ? new ImportBusyError() : fail('建立匯入紀錄', error);
    return runFromRow(data as RunRow);
  }

  async finishImport(id: string, result: ImportResult) {
    const { data, error } = await this.db.from('import_runs')
      .update({ ...result, finished_at: new Date().toISOString() })
      .eq('id', Number(id)).select('*').single();
    if (error) throw fail('更新匯入紀錄', error);
    return runFromRow(data as RunRow);
  }
}
