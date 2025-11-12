// 服务端使用 NEXT_PUBLIC_ 前缀的环境变量
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_URL_CLIENT = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_PUBLIC_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const SUPABASE_PUBLIC_ANON_KEY_CLIENT = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const SUPABASE_CONFIG_SYNC_TABLE =
  process.env.SUPABASE_CONFIG_SYNC_TABLE || "config_sync_snapshots";
export const SUPABASE_CONFIG_SYNC_ROW_ID =
  process.env.SUPABASE_CONFIG_SYNC_ROW_ID || "latest";
