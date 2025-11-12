/**
 * 配置同步 API
 *
 * POST /api/internal/config/sync - 接收并存储配置数据到服务器
 *
 * 该接口用于将前端 IndexedDB 的配置数据同步到服务器端存储，
 * 供第三方服务通过 /api/v1/config/export 接口获取
 */

import { NextRequest } from "next/server";
import {
  createSuccessResponse,
  createErrorResponse,
  handleUnknownError,
  ApiErrorType,
} from "@/lib/utils/api-response";
import {
  ConfigSyncPayloadSchema,
  type ConfigSyncPayload,
  type StoredConfigSync,
} from "@/lib/utils/config-sync-schema";
import { saveSyncedConfigSnapshot } from "@/lib/services/config-sync-repository";

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

    // 添加服务器端时间戳
    const configData: StoredConfigSync = {
      ...payload,
      synced: true,
      serverSyncedAt: new Date().toISOString(),
    };

    await saveSyncedConfigSnapshot(configData);

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
