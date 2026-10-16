// 讀 public/data 的 JSON 檔（唯讀）。沒有設定資料庫時使用，也是 memory 的初始資料。
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateTemples, type TempleRecord } from '../../temple-schema.ts';
import { applyQuery, rangeOf, sortRecords } from './query.ts';
import { ReadOnlyError, DEMO_NAME, type DataMeta, type ImportRun, type IncidentQuery, type IncidentRecord, type Repo } from './types.ts';

/** 資料目錄：預設 public/data；端對端測試用 DATA_DIR 指向固定的測試資料（tests/fixtures/data） */
export const dataDir = () => (process.env.DATA_DIR ? join(process.cwd(), process.env.DATA_DIR) : join(process.cwd(), 'public', 'data'));

export async function readIncidentFile(dir = dataDir()): Promise<{ meta: DataMeta; records: IncidentRecord[] }> {
  const json = JSON.parse(await readFile(join(dir, 'incidents.json'), 'utf8'));
  const m = json.meta ?? {};
  const records = sortRecords((json.incidents ?? []) as IncidentRecord[]);
  return {
    meta: {
      name: m.name ?? DEMO_NAME,
      demo: m.demo !== false,
      source: m.source,
      sources: Array.isArray(m.sources) ? m.sources : undefined,
      range: rangeOf(records),
      updated: m.updated ?? m.converted,
      note: m.note,
    },
    records,
  };
}

/** 宮廟資料格式錯誤時直接丟出錯誤，讓建置與測試失敗 */
export async function readTempleFile(dir = dataDir()): Promise<TempleRecord[]> {
  const { temples, errors } = validateTemples(JSON.parse(await readFile(join(dir, 'temples.json'), 'utf8')));
  if (errors.length) throw new Error(`${join(dir, 'temples.json')} 格式錯誤：\n${errors.join('\n')}`);
  return temples;
}

export class FileRepo implements Repo {
  readonly kind = 'files' as const;
  readonly writable = false;
  private data?: Promise<{ meta: DataMeta; records: IncidentRecord[] }>;
  private templeList?: Promise<TempleRecord[]>;
  private dir: string;

  constructor(dir = dataDir()) {
    this.dir = dir;
  }

  async incidents(q?: IncidentQuery) {
    const { meta, records } = await (this.data ??= readIncidentFile(this.dir));
    return { meta, ...applyQuery(records, q) };
  }
  temples() {
    return (this.templeList ??= readTempleFile(this.dir));
  }
  async importRuns(): Promise<ImportRun[]> {
    return [];
  }
  addIncidents(): Promise<number> {
    throw new ReadOnlyError();
  }
  saveTemple(): Promise<void> {
    throw new ReadOnlyError();
  }
  startImport(): Promise<ImportRun> {
    throw new ReadOnlyError();
  }
  finishImport(): Promise<ImportRun> {
    throw new ReadOnlyError();
  }
}
