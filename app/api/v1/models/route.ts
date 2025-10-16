/**
 * GET /api/v1/models
 *
 * 返回对外开放的模型列表
 *
 * 注意：鉴权由 Next.js middleware 处理，此路由接收的请求已通过验证
 */

import { getOpenApiModels } from "@/lib/config/models";
import {
  createSuccessResponse,
  createErrorResponse,
  generateCorrelationId,
  ApiErrorType,
} from "@/lib/utils/api-response";
import type { ModelsResponseBody } from "@/types/api";

export async function GET() {
  const correlationId = generateCorrelationId();

  try {
    // 获取所有对外开放的模型
    const models = getOpenApiModels();

    // 转换为API响应格式
    const responseData: ModelsResponseBody = {
      models: models.map(model => ({
        id: model.id,
        name: model.name,
        categories: model.categories,
      })),
    };

    // 返回成功响应，设置缓存头
    return createSuccessResponse(responseData, {
      correlationId,
      headers: {
        "Cache-Control": "public, max-age=3600", // 缓存1小时
      },
    });
  } catch (error) {
    console.error(`[${correlationId}] Failed to get model list:`, error);

    // 返回标准化的错误响应
    return createErrorResponse(ApiErrorType.InternalServerError, {
      message: "Failed to retrieve model list",
      details: error instanceof Error ? error.message : "Unknown error",
      correlationId,
    });
  }
}