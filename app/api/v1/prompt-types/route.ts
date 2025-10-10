/**
 * GET /api/v1/prompt-types
 *
 * 返回所有可用的 promptType 枚举值
 * 供第三方调用者发现和使用
 */

import { OPEN_API_PROMPT_TYPES } from "@/lib/tools/tool-registry";
import { createSuccessResponse } from "@/lib/utils/api-response";

export async function GET() {
  return createSuccessResponse({
    promptTypes: OPEN_API_PROMPT_TYPES.map(type => ({
      id: type,
      description: getPromptTypeDescription(type),
    })),
  });
}

/**
 * 获取 promptType 的描述信息
 */
function getPromptTypeDescription(type: string): string {
  const descriptions: Record<string, string> = {
    bossZhipinSystemPrompt: "BOSS直聘招聘助手系统提示词",
    bossZhipinLocalSystemPrompt: "BOSS直聘本地招聘助手系统提示词",
    generalComputerSystemPrompt: "通用计算机助手系统提示词",
  };

  return descriptions[type] || "未知类型";
}
