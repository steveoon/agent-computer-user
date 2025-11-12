import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} from "@/lib/constants";

let supabaseAdmin: SupabaseClient | null = null;

export const getSupabaseAdminClient = (): SupabaseClient => {
  if (supabaseAdmin) {
    return supabaseAdmin;
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "[SUPABASE ADMIN] 缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 环境变量，无法初始化管理客户端"
    );
  }

  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseAdmin;
};
