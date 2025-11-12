/**
 * 配置导出 API
 *
 * GET /api/v1/config/export - 返回应用配置数据
 *
 * 该接口返回从前端同步过来的配置数据，包括：
 * - brandData: 品牌和门店数据
 * - replyPrompts: 智能回复指令
 * - metadata: 配置元信息
 */

import { CONFIG_VERSION } from "@/types/config";
import type { ReplyPromptsConfig } from "@/types";
import { createSuccessResponse, handleUnknownError } from "@/lib/utils/api-response";
import {
  StoredConfigSyncSchema,
  type StoredConfigSync,
} from "@/lib/utils/config-sync-schema";
import { loadSyncedConfigSnapshot } from "@/lib/services/config-sync-repository";

const buildEmptyConfig = (): StoredConfigSync => ({
  synced: false,
  brandData: {
    city: "",
    defaultBrand: "",
    brands: {},
    stores: [],
  },
  replyPrompts: {} as ReplyPromptsConfig,
  metadata: {
    version: CONFIG_VERSION,
    lastUpdated: "",
    migratedAt: "",
    upgradedAt: "",
    repairedAt: "",
  },
});

export async function GET() {
  try {
    const stored = await loadSyncedConfigSnapshot();

    if (!stored) {
      console.log("⚠️ 未找到同步数据，返回空配置");
      return createSuccessResponse(buildEmptyConfig(), {
        message: "配置尚未通过前端同步",
      });
    }

    const parsed = StoredConfigSyncSchema.safeParse(stored);

    if (!parsed.success) {
      console.error("⚠️ 配置文件格式异常，返回空配置以防止脏数据泄露", parsed.error.flatten());
      return createSuccessResponse(buildEmptyConfig(), {
        message: "配置文件已损坏，请重新在前端触发同步",
      });
    }

    const configData = parsed.data;
    console.log("✅ 从服务器存储读取同步的配置数据");
    return createSuccessResponse(configData);

  } catch (error) {
    console.error("❌ 配置导出 API 错误:", error);
    return handleUnknownError(error);
  }
}
