// files 與 memory 共用：在記憶體中套用查詢條件（與 supabase 的 incidents_query 函式行為一致）
import { MAX_LIMIT, type IncidentQuery, type IncidentRecord } from './types.ts';

const key = (r: IncidentRecord) => `${r.date} ${r.time ?? ''} ${r.id}`;

export const sortRecords = (list: IncidentRecord[]) => list.sort((a, b) => key(a).localeCompare(key(b)));

export function applyQuery(sorted: IncidentRecord[], q: IncidentQuery = {}): { records: IncidentRecord[]; total: number } {
  const types = q.types ? new Set(q.types) : null;
  const hit = sorted.filter((r) => {
    if (q.from && r.date < q.from) return false;
    if (q.to && r.date > q.to) return false;
    if (types && !types.has(r.type)) return false;
    if (q.bbox) {
      const [s, w, n, e] = q.bbox;
      if (r.lat < s || r.lat > n || r.lng < w || r.lng > e) return false;
    }
    return true;
  });
  const limit = Math.min(q.limit ?? MAX_LIMIT, MAX_LIMIT);
  return { records: hit.length > limit ? hit.slice(hit.length - limit) : hit, total: hit.length };
}

export function rangeOf(sorted: IncidentRecord[]): string[] {
  return sorted.length ? [sorted[0].date, sorted.at(-1)!.date] : [];
}
