// 資料存取介面。三種實作：files（讀 public/data，唯讀）、supabase（正式資料庫）、memory（測試用，可寫）。
import type { TempleRecord } from '../../temple-schema.ts';

/** incidents.json 與資料庫共用的事件格式（未正規化） */
export interface IncidentRecord {
  id: string;
  date: string;
  time?: string;
  lat: number;
  lng: number;
  type: string;
  severity: number;
  title: string;
  county?: string;
  place?: string;
  deaths?: number;
  injuries?: number;
  cause?: string;
  vehicles?: string[] | string;
  source: string;
}

export interface DataMeta {
  name: string;
  demo: boolean;
  source?: string;
  /** 實際下載的檔案網址 */
  sources?: string[];
  range: string[];
  /** 最後一次成功匯入（或轉檔）的日期 */
  updated?: string;
  note?: string;
}

export interface IncidentQuery {
  from?: string;
  to?: string;
  /** [south, west, north, east] */
  bbox?: [number, number, number, number];
  types?: string[];
  limit?: number;
}

export interface IncidentResult {
  meta: DataMeta;
  /** 依時間由舊到新 */
  records: IncidentRecord[];
  /** 符合條件的總筆數；大於 records.length 代表超過上限只回傳最新的部分 */
  total: number;
}

export interface ImportRun {
  id: string;
  source: string;
  trigger: 'cron' | 'admin' | 'cli';
  startedAt: string;
  finishedAt?: string;
  fetched?: number;
  added?: number;
  skipped?: number;
  error?: string;
}

export type ImportResult = Pick<ImportRun, 'fetched' | 'added' | 'skipped' | 'error'>;

export interface Repo {
  readonly kind: 'files' | 'memory' | 'supabase';
  /** files 是唯讀的（Vercel 上無法寫檔），匯入與後台編輯需要資料庫 */
  readonly writable: boolean;
  incidents(q?: IncidentQuery): Promise<IncidentResult>;
  /** 依 id 去重新增，回傳實際新增筆數 */
  addIncidents(records: IncidentRecord[]): Promise<number>;
  temples(): Promise<TempleRecord[]>;
  saveTemple(t: TempleRecord): Promise<void>;
  importRuns(limit?: number): Promise<ImportRun[]>;
  /** 已有匯入在進行時丟出 ImportBusyError */
  startImport(source: string, trigger: ImportRun['trigger']): Promise<ImportRun>;
  finishImport(id: string, result: ImportResult): Promise<ImportRun>;
}

export const MAX_LIMIT = 20000;

export class ReadOnlyError extends Error {
  constructor() {
    super('目前讀取 public/data 檔案（唯讀）；匯入與編輯需要設定資料庫（SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY）');
  }
}

export class ImportBusyError extends Error {
  constructor() {
    super('已有匯入正在執行，請稍後再試');
  }
}

export const DEMO_NAME = '示範資料（隨機產生，非真實事件）';
export const A1_NAME = 'A1 類道路交通事故（警政署開放資料）';
