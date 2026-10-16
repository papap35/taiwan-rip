// 依環境選擇資料來源：DATA_BACKEND（files / memory / supabase）優先，否則有 Supabase 設定就用資料庫，沒有就讀檔案。
import { supabaseAdmin } from '../supabase.ts';
import { FileRepo } from './files.ts';
import { MemoryRepo } from './memory.ts';
import { SupabaseRepo } from './supabase.ts';
import type { Repo } from './types.ts';

export * from './types.ts';

// Next.js 把 API 與頁面分開打包，模組層級的變數各有一份；放在 globalThis 才能在同一個程序內共用（memory 模式需要）
const g = globalThis as typeof globalThis & { __taiwanRipRepo?: Repo };

export function getRepo(): Repo {
  if (g.__taiwanRipRepo) return g.__taiwanRipRepo;
  let repo: Repo;
  const backend = process.env.DATA_BACKEND || (supabaseAdmin() ? 'supabase' : 'files');
  if (backend === 'memory') repo = new MemoryRepo();
  else if (backend === 'supabase') {
    const db = supabaseAdmin();
    if (!db) throw new Error('DATA_BACKEND=supabase 但沒有設定 SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY');
    repo = new SupabaseRepo(db);
  } else repo = new FileRepo();
  return (g.__taiwanRipRepo = repo);
}
