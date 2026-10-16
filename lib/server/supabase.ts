// 伺服器端用的 Supabase 連線（service role，繞過 RLS）。金鑰只在伺服器端，不會送到瀏覽器。
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null | undefined;

export function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** 未設定時回傳 null */
export function supabaseAdmin(): SupabaseClient | null {
  if (client !== undefined) return client;
  client = supabaseConfigured()
    ? createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
  return client;
}
