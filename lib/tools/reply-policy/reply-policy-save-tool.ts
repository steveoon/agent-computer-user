import { tool } from "ai";
import { z } from "zod/v3";
import { ReplyPolicyConfigSchema } from "@/types/reply-policy";
import type { ReplyPolicyDraftRuntimeContext } from "@/types/tool-common";

/**
 * 策略配置保存工具
 *
 * 服务端：解析 JSON + Zod 校验
 * 客户端：tool message component 调用 configService.updateReplyPolicy() 写入 IndexedDB
 */
export const replyPolicySaveTool = (draftContext?: ReplyPolicyDraftRuntimeContext) =>
  tool({
    description: `保存当前会话中的策略草稿到本地存储。在引导用户完成所有配置模块后调用。
推荐做法：只传 summary，由服务端直接校验并保存草稿，避免在上下文中反复传整份 JSON。
兼容做法：仍可传 policy_json 覆盖草稿。保存成功后用户可以前往 /test-llm-reply 页面测试效果。`,
    inputSchema: z.object({
      summary: z
        .string()
        .describe("用中文简要总结本次配置了哪些内容（1-2 句话）"),
      policy_json: z
        .string()
        .optional()
        .describe("可选：完整的 ReplyPolicyConfig JSON 字符串（仅兼容旧流程）"),
    }),
    execute: async ({ policy_json, summary }) => {
      try {
        let candidate: unknown;

        if (policy_json) {
          candidate = JSON.parse(policy_json);
        } else {
          candidate = draftContext?.getDraftPolicy() ?? draftContext?.getCurrentPolicy();
        }

        if (!candidate) {
          return {
            success: false as const,
            error: "当前没有可保存的策略草稿，请先调用 reply_policy_read 并完成至少一项配置",
            policy: null,
            summary,
          };
        }

        const validated = ReplyPolicyConfigSchema.parse(candidate);
        draftContext?.commitPolicy(validated);

        return {
          success: true as const,
          policy: validated,
          summary,
          revision: draftContext?.getRevision() ?? 0,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "未知错误";
        return {
          success: false as const,
          error: `策略配置验证失败: ${message}`,
          policy: null,
          summary,
          revision: draftContext?.getRevision() ?? 0,
        };
      }
    },
    // 避免完整 policy JSON 回传到 LLM 上下文，只返回摘要
    toModelOutput({ output }) {
      if (!output.success) {
        return {
          type: "content" as const,
          value: [{ type: "text" as const, text: `保存失败: ${output.error}` }],
        };
      }
      return {
        type: "content" as const,
        value: [
          {
            type: "text" as const,
            text: `策略配置已验证通过并保存成功（当前修订号: r${output.revision}）。摘要: ${output.summary}\n请引导用户前往 /test-llm-reply 页面测试效果。`,
          },
        ],
      };
    },
  });
