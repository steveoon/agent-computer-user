/**
 * GET /api/v1/config-schema
 *
 * 返回对外公开的上下文/配置字段说明
 * 仅字段类型和是否必需，不含敏感值
 *
 * ⚠️ WARNING: 此接口的字段描述是手动维护的
 * 如果修改了 types/api.ts 中的 OpenChatRequestSchema，
 * 请同步更新此文件中的字段描述，或考虑使用自动生成方案
 *
 * 建议：运行测试以验证字段是否一致
 * pnpm test -- app/api/v1/config-schema/__tests__/route.test.ts
 */

import { createSuccessResponse } from "@/lib/utils/api-response";
import { OpenChatRequestSchema } from "@/types/api";

/**
 * 字段描述映射
 * 注意：字段名必须与 OpenChatRequestSchema 保持一致
 */
const FIELD_DESCRIPTIONS = {
  context: {
    preferredBrand: {
      type: "string",
      required: false,
      description: "首选品牌名称",
    },
    brandPriorityStrategy: {
      type: "BrandPriorityStrategy",
      required: false,
      description: "品牌冲突处理策略",
    },
    modelConfig: {
      type: "ModelConfig",
      required: false,
      description: "模型配置对象，包含 chatModel, classifyModel, replyModel 等",
    },
    configData: {
      type: "ZhipinData",
      required: "按工具需要",
      description: "业务配置数据，包含城市、门店、品牌信息等",
    },
    systemPrompts: {
      type: "Record<string, string>",
      required: false,
      description: "系统提示词映射，键为 promptType，值为对应的系统提示词",
    },
    replyPolicy: {
      type: "ReplyPolicyConfig",
      required: "按工具需要",
      description: "回复策略配置（阶段目标、人格、行业指纹、红线、事实闸门）",
    },
    industryVoiceId: {
      type: "string",
      required: false,
      description: "可选，显式指定当前对话使用的行业指纹 ID",
    },
    dulidayToken: {
      type: "string | null",
      required: "按工具需要",
      description: "Duliday API 访问令牌",
    },
    defaultWechatId: {
      type: "string | null",
      required: false,
      description: "默认微信号",
    },
  },
  sandboxId: {
    type: "string | null",
    required: "当启用 requiresSandbox 工具时",
    description: "E2B 沙盒 ID，用于计算机使用工具",
  },
  toolContext: {
    type: "Record<string, Record<string, unknown>>",
    required: false,
    description: "工具特定上下文映射，键为工具名，值为该工具的特定配置",
  },
} as const;

export async function GET() {
  // 开发环境下验证字段是否一致
  if (process.env.NODE_ENV === "development") {
    const schemaShape = OpenChatRequestSchema.shape;
    const contextShape = schemaShape.context?.unwrap().shape;

    // 验证 context 字段
    if (contextShape) {
      const schemaFields = Object.keys(contextShape);
      const descriptionFields = Object.keys(FIELD_DESCRIPTIONS.context);

      const missingInDescription = schemaFields.filter(f => !descriptionFields.includes(f));
      const extraInDescription = descriptionFields.filter(f => !schemaFields.includes(f));

      if (missingInDescription.length > 0) {
        console.warn(
          `[config-schema] Missing field descriptions for: ${missingInDescription.join(", ")}`
        );
      }
      if (extraInDescription.length > 0) {
        console.warn(
          `[config-schema] Extra field descriptions (not in schema): ${extraInDescription.join(", ")}`
        );
      }
    }
  }

  return createSuccessResponse(FIELD_DESCRIPTIONS);
}
