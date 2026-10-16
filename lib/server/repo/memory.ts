// 記憶體資料（以 public/data 為初始內容）。只給測試與端對端測試用（DATA_BACKEND=memory），重啟就清空。
import type { TempleRecord } from '../../temple-schema.ts';
import { readIncidentFile, readTempleFile } from './files.ts';
import { applyQuery, rangeOf, sortRecords } from './query.ts';
import {
  A1_NAME, DEMO_NAME, ImportBusyError,
  type DataMeta, type ImportResult, type ImportRun, type IncidentQuery, type IncidentRecord, type Repo,
} from './types.ts';

interface State {
  meta: DataMeta;
  records: IncidentRecord[];
  temples: TempleRecord[];
  runs: ImportRun[];
}

export class MemoryRepo implements Repo {
  readonly kind = 'memory' as const;
  readonly writable = true;
  private state?: Promise<State>;
  private seed: () => Promise<Omit<State, 'runs'>>;
  private now: () => Date;

  constructor(seed?: () => Promise<Omit<State, 'runs'>>, now = () => new Date()) {
    this.seed = seed ?? (async () => ({ ...(await readIncidentFile()), temples: await readTempleFile() }));
    this.now = now;
  }

  private load() {
    return (this.state ??= this.seed().then((s) => ({ ...s, records: sortRecords([...s.records]), temples: [...s.temples], runs: [] })));
  }

  async incidents(q?: IncidentQuery) {
    const s = await this.load();
    const demo = s.records.some((r) => r.source === 'demo');
    const meta = { ...s.meta, demo, name: demo ? DEMO_NAME : A1_NAME, range: rangeOf(s.records) };
    return { meta, ...applyQuery(s.records, q) };
  }

  async addIncidents(records: IncidentRecord[]) {
    const s = await this.load();
    const ids = new Set(s.records.map((r) => r.id));
    const fresh = records.filter((r) => !ids.has(r.id) && ids.add(r.id));
    s.records = sortRecords([...s.records, ...fresh]);
    return fresh.length;
  }

  async temples() {
    return [...(await this.load()).temples];
  }

  async saveTemple(t: TempleRecord) {
    const s = await this.load();
    const i = s.temples.findIndex((x) => x.id === t.id);
    if (i >= 0) s.temples[i] = t;
    else s.temples.push(t);
  }

  async importRuns(limit = 30) {
    return (await this.load()).runs.slice(0, limit);
  }

  async startImport(source: string, trigger: ImportRun['trigger']) {
    const s = await this.load();
    const cutoff = this.now().getTime() - 15 * 60000;
    if (s.runs.some((r) => !r.finishedAt && Date.parse(r.startedAt) > cutoff)) throw new ImportBusyError();
    const run: ImportRun = { id: String(s.runs.length + 1), source, trigger, startedAt: this.now().toISOString() };
    s.runs.unshift(run);
    return { ...run };
  }

  async finishImport(id: string, result: ImportResult) {
    const s = await this.load();
    const run = s.runs.find((r) => r.id === id);
    if (!run) throw new Error(`找不到匯入紀錄 ${id}`);
    Object.assign(run, result, { finishedAt: this.now().toISOString() });
    if (!result.error) s.meta = { ...s.meta, updated: run.finishedAt!.slice(0, 10) };
    return { ...run };
  }
}
