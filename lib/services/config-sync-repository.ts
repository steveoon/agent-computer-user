import type { StoredConfigSync } from "@/lib/utils/config-sync-schema";
import {
  SUPABASE_CONFIG_SYNC_ROW_ID,
  SUPABASE_CONFIG_SYNC_TABLE,
} from "@/lib/constants";
import { getSupabaseAdminClient } from "@/lib/utils/supabase/admin";

const TABLE_NAME = SUPABASE_CONFIG_SYNC_TABLE;
const ROW_ID = SUPABASE_CONFIG_SYNC_ROW_ID;

interface ConfigSyncRow {
  id: string;
  payload: StoredConfigSync;
  updated_at?: string;
}

export async function saveSyncedConfigSnapshot(data: StoredConfigSync): Promise<void> {
  const client = getSupabaseAdminClient();
  const { error } = await client.from<ConfigSyncRow>(TABLE_NAME).upsert(
    {
      id: ROW_ID,
      payload: data,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "id",
    }
  );

  if (error) {
    throw new Error(`[CONFIG_SYNC_REPOSITORY] 保存配置失败: ${error.message}`);
  }
}

export async function loadSyncedConfigSnapshot(): Promise<StoredConfigSync | null> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from<ConfigSyncRow>(TABLE_NAME)
    .select("payload")
    .eq("id", ROW_ID)
    .maybeSingle();

  if (error) {
    throw new Error(`[CONFIG_SYNC_REPOSITORY] 读取配置失败: ${error.message}`);
  }

  return data?.payload ?? null;
}
