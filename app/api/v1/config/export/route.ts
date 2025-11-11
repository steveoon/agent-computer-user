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

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { CONFIG_VERSION } from "@/types/config";
import type { ReplyPromptsConfig } from "@/types";
import { createSuccessResponse, handleUnknownError } from "@/lib/utils/api-response";
import {
  StoredConfigSyncSchema,
  type StoredConfigSync,
} from "@/lib/utils/config-sync-schema";

// 配置文件存储路径
const CONFIG_DIR = join(process.cwd(), "data");
const CONFIG_FILE = join(CONFIG_DIR, "synced-config.json");

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
  },
});

export async function GET() {
  try {
    if (existsSync(CONFIG_FILE)) {
      const fileContent = readFileSync(CONFIG_FILE, "utf-8");
      const parsed = StoredConfigSyncSchema.safeParse(JSON.parse(fileContent));

      if (!parsed.success) {
        console.error("⚠️ 配置文件格式异常，返回空配置以防止脏数据泄露", parsed.error.flatten());
        return createSuccessResponse(buildEmptyConfig(), {
          message: "配置文件已损坏，请重新在前端触发同步",
        });
      }

      const configData = parsed.data;
      console.log("✅ 从服务器存储读取同步的配置数据");
      // 返回配置数据（使用公共方法）
      // CORS 头由 middleware.ts 自动处理
      return createSuccessResponse(configData);
    }

    console.log("⚠️ 未找到同步数据，返回空配置");
    return createSuccessResponse(buildEmptyConfig(), {
      message: "配置尚未通过前端同步",
    });
  } catch (error) {
    console.error("❌ 配置导出 API 错误:", error);
    return handleUnknownError(error);
  }
}
