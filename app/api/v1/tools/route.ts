/**
 * GET /api/v1/tools
 *
 * 返回对外可用的工具清单
 *
 * 注意：鉴权由 Next.js middleware 处理，此路由接收的请求已通过验证
 */

import {
  getToolMetadataList,
  getToolsForPrompt,
  OPEN_API_PROMPT_TYPES
} from "@/lib/tools/tool-registry";
import {
  createSuccessResponse,
  createErrorResponse,
  generateCorrelationId,
  ApiErrorType,
} from "@/lib/utils/api-response";

// 获取对外开放的工具白名单
function getOpenApiToolWhitelist(): Set<string> {
  const whitelist = new Set<string>();

  // 从对外公开的 promptType 收集所有工具
  for (const promptType of OPEN_API_PROMPT_TYPES) {
    const tools = getToolsForPrompt(promptType);
    tools.forEach(tool => whitelist.add(tool));
  }

  return whitelist;
}

export async function GET() {
  const correlationId = generateCorrelationId();

  try {
    // 获取所有工具元数据
    const allTools = getToolMetadataList();

    // 获取白名单
    const whitelist = getOpenApiToolWhitelist();

    // 过滤出对外开放的工具
    const publicTools = allTools.filter(tool => whitelist.has(tool.name));

    // 返回成功响应，设置缓存头
    return createSuccessResponse(
      { tools: publicTools },
      {
        correlationId,
        headers: {
          "Cache-Control": "public, max-age=3600", // 缓存1小时
        },
      }
    );
  } catch (error) {
    console.error(`[${correlationId}] Failed to get tool metadata:`, error);

    // 返回标准化的错误响应
    return createErrorResponse(ApiErrorType.InternalServerError, {
      message: "Failed to retrieve tool metadata",
      details: error instanceof Error ? error.message : "Unknown error",
      correlationId,
    });
  }
}