// 區域危險程度分析：網格化 + 特徵工程 + K-means 非監督式分群。
// 純函式、無 DOM 依賴，可在瀏覽器、Web Worker 與 Node 中執行。

export const LEVELS = [
  { key: 'low', label: '低', color: '#4caf50', advice: '風險低，正常前往即可。' },
  { key: 'medium', label: '中', color: '#ffc107', advice: '留意周遭狀況，夜間結伴同行。' },
  { key: 'high', label: '高', color: '#ff7043', advice: '近期事件偏多，非必要可延後前往。' },
  { key: 'severe', label: '極高', color: '#d32f2f', advice: '近期事件密集且有升溫趨勢，建議暫時避免前往。' },
] as const;

const DAY = 86400000;

export interface RiskInput {
  t: number;
  lat: number;
  lng: number;
  severity: number;
  type: string;
}

export interface RiskCell {
  key: string;
  south: number;
  west: number;
  north: number;
  east: number;
  /** 0 = 低 … 3 = 極高（LEVELS 的索引） */
  level: number;
  score: number;
  count: number;
  fatal: number;
  trend: number;
  types: Record<string, number>;
}

interface CellAcc {
  key: string;
  i: number;
  j: number;
  weighted: number;
  count: number;
  fatal: number;
  recent: number;
  types: Record<string, number>;
  trend: number;
  features: number[];
}

/** @param incidents 已依時間窗與類別篩選的事件 */
export function analyzeRisk(
  incidents: RiskInput[],
  { endT, windowDays, cellDeg = 0.04 }: { endT: number; windowDays: number; cellDeg?: number },
): RiskCell[] {
  const cells = new Map<string, CellAcc>();
  const halfLife = Math.max(7, windowDays / 3); // 時間衰減：越近期權重越高
  const recentCut = endT - (windowDays / 3) * DAY;

  for (const d of incidents) {
    const i = Math.floor(d.lat / cellDeg);
    const j = Math.floor(d.lng / cellDeg);
    const key = `${i}:${j}`;
    let c = cells.get(key);
    if (!c) {
      c = { key, i, j, weighted: 0, count: 0, fatal: 0, recent: 0, types: {}, trend: 0, features: [] };
      cells.set(key, c);
    }
    const ageDays = Math.max(0, (endT - d.t) / DAY);
    c.weighted += d.severity * Math.pow(0.5, ageDays / halfLife);
    c.count++;
    if (d.severity >= 4) c.fatal++;
    if (d.t >= recentCut) c.recent++;
    c.types[d.type] = (c.types[d.type] || 0) + 1;
  }

  const list = [...cells.values()];
  if (!list.length) return [];

  // 特徵：時間加權嚴重度、致死件數、近期占比（升溫趨勢，> 1/3 代表升溫）
  for (const c of list) {
    c.trend = c.recent / c.count;
    c.features = [
      Math.log1p(c.weighted),
      Math.log1p(c.fatal),
      // 件數太少時趨勢不可靠，向中性值收斂
      (c.trend - 1 / 3) * (c.count / (c.count + 3)),
    ];
  }
  const norm = standardize(list.map((c) => c.features));
  const k = Math.min(LEVELS.length, list.length);
  const { assign, centroids } = kmeans(norm, k);

  // 依群中心的綜合分數排序，對應到 低→極高
  const score = (v: number[]) => v[0] + 0.6 * v[1] + 0.4 * v[2];
  const order = centroids.map((c, idx) => ({ idx, s: score(c) })).sort((a, b) => a.s - b.s);
  const rank = new Array<number>(k);
  order.forEach((o, r) => (rank[o.idx] = k === LEVELS.length ? r : Math.round((r * (LEVELS.length - 1)) / Math.max(1, k - 1))));

  return list.map((c, n) => ({
    key: c.key,
    south: c.i * cellDeg,
    west: c.j * cellDeg,
    north: (c.i + 1) * cellDeg,
    east: (c.j + 1) * cellDeg,
    // 證據不足時封頂：單一事件最多「低」，兩起最多「中」，避免偶發事件被標成危險區
    level: Math.min(rank[assign[n]], c.count <= 1 ? 0 : c.count === 2 ? 1 : LEVELS.length - 1),
    score: score(norm[n]),
    count: c.count,
    fatal: c.fatal,
    trend: c.trend,
    types: c.types,
  }));
}

function standardize(rows: number[][]): number[][] {
  const dim = rows[0].length;
  const mean = new Array<number>(dim).fill(0);
  const sd = new Array<number>(dim).fill(0);
  for (const r of rows) r.forEach((v, d) => (mean[d] += v / rows.length));
  for (const r of rows) r.forEach((v, d) => (sd[d] += (v - mean[d]) ** 2 / rows.length));
  return rows.map((r) => r.map((v, d) => (sd[d] > 1e-9 ? (v - mean[d]) / Math.sqrt(sd[d]) : 0)));
}

// 決定性的 K-means：以綜合分數的分位數初始化，結果穩定不會每次重畫都跳動
export function kmeans(points: number[][], k: number, iters = 30) {
  const dist = (a: number[], b: number[]) => a.reduce((s, v, d) => s + (v - b[d]) ** 2, 0);
  const sorted = points.map((p, i) => ({ i, s: p[0] + 0.6 * p[1] + 0.4 * p[2] })).sort((a, b) => a.s - b.s);
  let centroids = Array.from({ length: k }, (_, c) => {
    const q = sorted[Math.min(sorted.length - 1, Math.floor(((c + 0.5) / k) * sorted.length))];
    return [...points[q.i]];
  });
  const assign = new Array<number>(points.length).fill(0);

  for (let it = 0; it < iters; it++) {
    let changed = false;
    points.forEach((p, n) => {
      let best = 0;
      let bd = Infinity;
      centroids.forEach((c, ci) => {
        const dd = dist(p, c);
        if (dd < bd) { bd = dd; best = ci; }
      });
      if (assign[n] !== best) { assign[n] = best; changed = true; }
    });
    const sums = centroids.map((c) => ({ v: new Array<number>(c.length).fill(0), n: 0 }));
    points.forEach((p, n) => {
      const s = sums[assign[n]];
      p.forEach((v, d) => (s.v[d] += v));
      s.n++;
    });
    centroids = centroids.map((c, ci) => (sums[ci].n ? sums[ci].v.map((v) => v / sums[ci].n) : c));
    if (!changed && it > 0) break;
  }
  return { assign, centroids };
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
