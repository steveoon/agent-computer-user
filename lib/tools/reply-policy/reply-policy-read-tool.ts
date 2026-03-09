import { tool } from "ai";
import { z } from "zod/v3";
import type { ReplyPolicyConfig } from "@/types/reply-policy";
import type { ReplyPolicyDraftRuntimeContext } from "@/types/tool-common";

export const replyPolicyReadTool = (
  draftContext?: ReplyPolicyDraftRuntimeContext,
  fallbackPolicy?: ReplyPolicyConfig
) =>
  tool({
    description:
      "读取当前的回复策略配置（ReplyPolicyConfig）。当用户要求配置、修改或查看回复策略时，首先调用此工具获取当前配置作为基础。首次读取会返回完整 JSON；后续重复读取返回轻量确认消息，避免上下文重复膨胀。用户说「跳过」时你需要保留对应字段的原始值。",
    inputSchema: z.object({}),
    execute: async () => {
      const currentPolicy = draftContext?.getCurrentPolicy() ?? fallbackPolicy ?? null;

      if (!currentPolicy) {
        return {
          success: false as const,
          error: "当前没有加载回复策略配置，请先在管理后台初始化配置",
          currentPolicy: null,
        };
      }

      const alreadyServed = draftContext?.hasServedFullPolicy() ?? false;
      if (!alreadyServed) {
        draftContext?.markFullPolicyServed();
        return {
          success: true as const,
          mode: "full" as const,
          revision: draftContext?.getRevision() ?? 0,
          currentPolicy,
        };
      }

      return {
        success: true as const,
        mode: "cached" as const,
        revision: draftContext?.getRevision() ?? 0,
        currentPolicy: null,
      };
    },
    toModelOutput({ output }) {
      if (!output.success) {
        return {
          type: "content" as const,
          value: [{ type: "text" as const, text: output.error }],
        };
      }

      if (output.mode === "full" && output.currentPolicy) {
        return {
          type: "content" as const,
          value: [
            {
              type: "text" as const,
              text: `CURRENT_REPLY_POLICY_JSON=${JSON.stringify(output.currentPolicy)}\n请以此 JSON 作为唯一基线；后续按模块增量修改，用户说“跳过/默认”时保持原值。`,
            },
          ],
        };
      }

      return {
        type: "content" as const,
        value: [
          {
            type: "text" as const,
            text: `当前策略草稿已在会话中加载，无需再次注入完整 JSON。当前修订号: r${output.revision}。`,
          },
        ],
      };
    },
  });
