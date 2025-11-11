/**
 * 配置同步 API
 *
 * POST /api/internal/config/sync - 接收并存储配置数据到服务器
 *
 * 该接口用于将前端 IndexedDB 的配置数据同步到服务器端存储，
 * 供第三方服务通过 /api/v1/config/export 接口获取
 */

import { NextRequest } from "next/server";
import { writeFileSync, mkdirSync, existsSync, renameSync } from "fs";
import { join } from "path";
import {
  createSuccessResponse,
  createErrorResponse,
  handleUnknownError,
  ApiErrorType,
} from "@/lib/utils/api-response";
import {
  ConfigSyncPayloadSchema,
  type ConfigSyncPayload,
} from "@/lib/utils/config-sync-schema";

// 配置文件存储路径
const CONFIG_DIR = join(process.cwd(), "data");
const CONFIG_FILE = join(CONFIG_DIR, "synced-config.json");

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsedResult = ConfigSyncPayloadSchema.safeParse(body);

    if (!parsedResult.success) {
      return createErrorResponse(ApiErrorType.UnprocessableEntity, {
        message: "配置数据格式不符合要求",
        details: parsedResult.error.flatten(),
      });
    }

    const payload: ConfigSyncPayload = parsedResult.data;

    // 确保目录存在
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }

    // 添加服务器端时间戳
    const configData = {
      ...payload,
      synced: true,
      serverSyncedAt: new Date().toISOString(),
    };

    // 写入临时文件后原子替换，避免并发导致写入损坏
    const tempFile = `${CONFIG_FILE}.${Date.now()}.tmp`;
    writeFileSync(tempFile, JSON.stringify(configData, null, 2), "utf-8");
    renameSync(tempFile, CONFIG_FILE);

    console.log("✅ 配置数据已同步到服务器:", {
      brandCount: Object.keys(payload.brandData?.brands || {}).length,
      storeCount: payload.brandData?.stores?.length || 0,
      replyPromptsCount: Object.keys(payload.replyPrompts || {}).length,
      version: payload.metadata?.version,
    });

    // 返回成功响应（使用公共方法）
    return createSuccessResponse(
      {
        synced: true,
        serverSyncedAt: configData.serverSyncedAt,
      },
      {
        message: "配置数据已成功同步到服务器",
      }
    );
  } catch (error) {
    console.error("❌ 配置同步失败:", error);
    return handleUnknownError(error);
  }
}
