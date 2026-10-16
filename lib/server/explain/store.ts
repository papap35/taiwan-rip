// 解說快取與用量限制。有設定 Supabase 就用資料庫（跨伺服器實例共用），否則退回單一實例的記憶體。
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ExplainResponse } from '../../explain/schema.ts';

export interface ExplainStore {
  readonly kind: 'supabase' | 'memory';
  get(key: string): Promise<ExplainResponse | null>;
  put(key: string, value: ExplainResponse, meta: { model?: string; inputTokens?: number; outputTokens?: number }): Promise<void>;
  /** 計數 +1，回傳是否仍在上限內 */
  hit(bucket: string, limit: number, windowSeconds: number): Promise<boolean>;
}

export class MemoryStore implements ExplainStore {
  readonly kind = 'memory' as const;
  private cache = new Map<string, ExplainResponse>();
  private counters = new Map<string, { count: number; resetAt: number }>();
  private maxEntries: number;
  private now: () => number;
  constructor(maxEntries = 500, now = () => Date.now()) {
    this.maxEntries = maxEntries;
    this.now = now;
  }

  async get(key: string) {
    const v = this.cache.get(key);
    if (!v) return null;
    this.cache.delete(key); // 重新插入，維持「最近使用」順序
    this.cache.set(key, v);
    return v;
  }
  async put(key: string, value: ExplainResponse) {
    this.cache.set(key, value);
    while (this.cache.size > this.maxEntries) this.cache.delete(this.cache.keys().next().value!);
  }
  async hit(bucket: string, limit: number, windowSeconds: number) {
    const now = this.now();
    const c = this.counters.get(bucket);
    if (!c || c.resetAt <= now) {
      this.counters.set(bucket, { count: 1, resetAt: now + windowSeconds * 1000 });
      return limit >= 1;
    }
    c.count++;
    return c.count <= limit;
  }
}

export class SupabaseStore implements ExplainStore {
  readonly kind = 'supabase' as const;
  private db: SupabaseClient;
  constructor(db: SupabaseClient) {
    this.db = db;
  }

  async get(key: string) {
    const { data, error } = await this.db.from('ai_explanations').select('body').eq('cache_key', key).maybeSingle();
    if (error) throw new Error(`讀取快取失敗：${error.message}`);
    return (data?.body as ExplainResponse | undefined) ?? null;
  }
  async put(key: string, value: ExplainResponse, meta: { model?: string; inputTokens?: number; outputTokens?: number }) {
    const { error } = await this.db.from('ai_explanations').upsert({
      cache_key: key,
      body: value,
      model: meta.model ?? null,
      input_tokens: meta.inputTokens ?? null,
      output_tokens: meta.outputTokens ?? null,
    });
    if (error) throw new Error(`寫入快取失敗：${error.message}`);
  }
  async hit(bucket: string, limit: number, windowSeconds: number) {
    const { data, error } = await this.db.rpc('ai_rate_limit_hit', { p_bucket: bucket, p_limit: limit, p_window_seconds: windowSeconds });
    if (error) throw new Error(`用量計數失敗：${error.message}`);
    return data === true;
  }
}

let shared: ExplainStore | undefined;

export function defaultStore(): ExplainStore {
  if (shared) return shared;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  shared = url && key
    ? new SupabaseStore(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }))
    : new MemoryStore();
  return shared;
}
