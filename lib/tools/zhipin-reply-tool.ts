import { tool } from "ai";
import { z } from 'zod/v3';
import { loadZhipinData } from "@/lib/loaders/zhipin-data.loader";
import { generateSmartReply } from "@/lib/agents";
import type { StoreWithDistance } from "@/types/geocoding";
import type { ZhipinData, MessageClassification } from "@/types/zhipin";
import type { ReplyPolicyConfig, BrandPriorityStrategy } from "@/types/config";
import type { ModelConfig } from "@/lib/config/models";
import { DEFAULT_MODEL_CONFIG, DEFAULT_PROVIDER_CONFIGS } from "@/lib/config/models";
import { CandidateInfoSchema } from "@/lib/tools/zhipin/types";
import type { SafeGenerateTextUsage } from "@/lib/ai";
import type { TurnPlan } from "@/types/reply-policy";
import type {
  AgeEligibilityAppliedStrategy,
  AgeEligibilityStatus,
  AgeEligibilitySummary,
} from "@/lib/services/eligibility/age-eligibility";

/**
 * 调试信息类型
 */
type ReplyDebugInfo = {
  relevantStores: StoreWithDistance[];
  storeCount: number;
  detailLevel: string;
  turnPlan: TurnPlan;
  classification: MessageClassification;
  gateStatus: AgeEligibilityStatus;
  appliedStrategy: AgeEligibilityAppliedStrategy;
  ageRangeSummary: AgeEligibilitySummary;
};

/**
 * 智能回复工具的执行结果类型
 */
type ZhipinReplyToolResult = {
  reply: string;
  stage: TurnPlan["stage"];
  subGoals: string[];
  needs: TurnPlan["needs"];
  riskFlags: TurnPlan["riskFlags"];
  reasoningText: string;
  candidateMessage: string;
  historyCount: number;
  debugInfo?: ReplyDebugInfo;
  contextInfo?: string;
  stats?: {
    totalStores: number;
    totalPositions: number;
    brand: string;
  };
  /** LLM 使用统计 */
  usage?: SafeGenerateTextUsage;
  /** 生成耗时（毫秒） */
  latencyMs?: number;
  /** 错误信息（如果生成失败） */
  error?: {
    code: string;
    message: string;
    userMessage: string;
  };
};

/**
 * Boss直聘智能回复工具
 *
 * 功能特性：
 * - 🤖 根据候选人消息生成智能回复
 * - 📝 支持对话历史上下文
 * - 🏢 多品牌支持
 * - 🎯 FunnelStage 阶段规划 + Needs 按需取事实
 * - 💬 自然语言生成
 *
 * 使用场景：
 * - 招聘自动化回复
 * - 批量处理候选人咨询
 * - 本地浏览器自动化辅助
 * - 聊天机器人集成
 */
export const zhipinReplyTool = (
  preferredBrand?: string,
  modelConfig?: ModelConfig,
  configData?: ZhipinData,
  replyPolicy?: ReplyPolicyConfig,
  defaultWechatId?: string,
  brandPriorityStrategy?: BrandPriorityStrategy,
  industryVoiceId?: string,
  channelType?: "public" | "private"
) => {
  // 注意：configData 的验证在工具创建时完成（通过 contextSchemas）
  // 执行时只关注业务逻辑验证

  return tool({
    description: `
      Boss直聘智能回复生成工具，根据候选人消息自动生成招聘回复。
      
      主要功能：
      - 根据候选人消息内容智能生成回复
      - 支持多轮对话历史上下文
      - 自动输出回合规划（stage/subGoals/needs/riskFlags）
      - 支持多品牌门店数据
      - 自然语言生成，符合人工回复风格
      
      适用场景：
      - 本地浏览器自动化（puppeteer等）需要生成回复内容时
      - 批量处理候选人咨询
      - 招聘聊天机器人
    `,
    inputSchema: z.object({
      candidate_message: z.string().describe("候选人发送的消息内容"),

      conversation_history: z
        .union([z.array(z.string()), z.string()])
        .optional()
        .describe("对话历史记录，用于提供上下文。可以是字符串数组或JSON字符串"),

      candidate_info: CandidateInfoSchema.optional().describe(
        "候选人基本信息，包括姓名、求职职位、年龄、经验、学历等"
      ),

      brand: z
        .string()
        .optional()
        .describe(
          "从聊天详情中获取品牌名称，Boss直聘和鱼泡直聘可以根据招聘或应聘的岗位内容来获取，如果不指定则使用默认品牌"
        ),

      include_stats: z
        .boolean()
        .optional()
        .default(false)
        .describe("是否在响应中包含统计信息（门店数量、岗位数量等）"),
    }),

    execute: async (params, _context) => {
      const {
        candidate_message,
        conversation_history,
        candidate_info,
        brand,
        include_stats = false,
      } = params;

      try {
        console.log("🤖 开始生成Boss直聘智能回复...");

        // 处理对话历史参数
        let processedHistory: string[] = [];
        if (conversation_history) {
          if (typeof conversation_history === "string") {
            try {
              processedHistory = JSON.parse(conversation_history);
              console.log("📋 解析了JSON格式的对话历史");
            } catch (_e) {
              processedHistory = [conversation_history];
              console.log("📋 将字符串作为单条历史记录");
            }
          } else if (Array.isArray(conversation_history)) {
            processedHistory = conversation_history;
          }
        }

        // 使用传入的模型配置或默认配置
        const effectiveModelConfig = modelConfig || DEFAULT_MODEL_CONFIG;

        // 确保有配置数据
        const effectiveConfigData = configData || (await loadZhipinData(preferredBrand));

        // 生成智能回复（使用新的 Agent-based API）
        // preferredBrand: UI 选择的品牌
        // toolBrand (brand): 工具调用时从职位详情识别的品牌
        // brandPriorityStrategy: 品牌优先级策略（决定哪个品牌优先）
        // 使用传入的 providerConfigs，保持与主循环一致，避免创建新的 registry
        const effectiveProviderConfigs = modelConfig?.providerConfigs || DEFAULT_PROVIDER_CONFIGS;

        const replyResult = await generateSmartReply({
          candidateMessage: candidate_message,
          conversationHistory: processedHistory,
          preferredBrand, // UI 选择的品牌
          toolBrand: brand, // 工具识别的品牌（职位详情）
          brandPriorityStrategy,
          modelConfig: {
            ...effectiveModelConfig,
            providerConfigs: effectiveProviderConfigs,
          },
          configData: effectiveConfigData,
          replyPolicy,
          candidateInfo: candidate_info,
          defaultWechatId,
          industryVoiceId,
          channelType,
        });

        // 检查是否有错误
        if (replyResult.error) {
          console.error(`❌ 回复生成失败: ${replyResult.error.userMessage}`);
          return {
            reply: "",
            stage: replyResult.turnPlan.stage,
            subGoals: replyResult.turnPlan.subGoals,
            needs: replyResult.turnPlan.needs,
            riskFlags: replyResult.turnPlan.riskFlags,
            reasoningText: replyResult.turnPlan.reasoningText || "生成失败",
            candidateMessage: candidate_message,
            historyCount: processedHistory.length,
            debugInfo: replyResult.debugInfo,
            contextInfo: replyResult.contextInfo,
            error: {
              code: replyResult.error.code,
              message: replyResult.error.message,
              userMessage: replyResult.error.userMessage,
            },
          };
        }

        console.log(`✅ 回复生成成功`);
        console.log(`📝 回复内容: ${replyResult.suggestedReply}`);
        console.log(`🎯 阶段: ${replyResult.turnPlan.stage}`);
        console.log(`📊 规划依据: ${replyResult.turnPlan.reasoningText}`);

        // 构建响应
        const response: ZhipinReplyToolResult = {
          reply: replyResult.suggestedReply,
          stage: replyResult.turnPlan.stage,
          subGoals: replyResult.turnPlan.subGoals,
          needs: replyResult.turnPlan.needs,
          riskFlags: replyResult.turnPlan.riskFlags,
          reasoningText: replyResult.turnPlan.reasoningText || "未提供规划依据",
          candidateMessage: candidate_message,
          historyCount: processedHistory.length,
          debugInfo: replyResult.debugInfo,
          contextInfo: replyResult.contextInfo,
          usage: replyResult.usage,
          latencyMs: replyResult.latencyMs,
        };

        // 如果需要包含统计信息
        if (include_stats) {
          const storeDatabase = configData || (await loadZhipinData(preferredBrand));
          const totalPositions = storeDatabase.stores.reduce(
            (sum, store) => sum + store.positions.length,
            0
          );

          response.stats = {
            totalStores: storeDatabase.stores.length,
            totalPositions: totalPositions,
            brand: brand || preferredBrand || storeDatabase.defaultBrand || "未知品牌",
          };
        }

        return response;
      } catch (error) {
        console.error("❌ 智能回复生成失败:", error);
        throw new Error(`智能回复生成失败: ${error instanceof Error ? error.message : "未知错误"}`);
      }
    },

    toModelOutput(
      {
        output
      }
    ) {
      // 检查是否有错误
      if (output.error) {
        const content = `❌ 智能回复生成失败\n\n` +
          `🔴 错误: ${output.error.userMessage}\n` +
          `🎯 阶段: ${output.stage}\n` +
          `💬 候选人消息: "${output.candidateMessage}"`;
        return {
          type: "content" as const,
          value: [{ type: "text" as const, text: content }],
        };
      }

      // 格式化成功输出结果
      let content = `✅ 智能回复已生成\n\n`;
      content += `📝 回复内容:\n"${output.reply}"\n\n`;
      content += `🎯 阶段: ${output.stage}\n`;
      content += `🧭 子目标: ${output.subGoals?.join("、") || "无"}\n`;
      content += `📌 Needs: ${output.needs?.join("、") || "none"}\n`;
      content += `⚠️ 风险标记: ${output.riskFlags?.join("、") || "无"}\n`;
      content += `💬 候选人消息: "${output.candidateMessage}"\n`;
      content += `📋 历史记录: ${output.historyCount}条\n`;

      // 显示 LLM 统计信息
      if (output.latencyMs !== undefined || output.usage) {
        content += `\n⚡ LLM 统计:\n`;
        if (output.latencyMs !== undefined) {
          content += `• 耗时: ${output.latencyMs}ms\n`;
        }
        if (output.usage?.totalTokens !== undefined) {
          content += `• Tokens: ${output.usage.totalTokens} (输入: ${output.usage.inputTokens ?? "?"}, 输出: ${output.usage.outputTokens ?? "?"})`;
        }
      }

      if (output.stats) {
        content += `\n📊 数据统计:\n`;
        content += `• 品牌: ${output.stats.brand}\n`;
        content += `• 门店数: ${output.stats.totalStores}家\n`;
        content += `• 岗位数: ${output.stats.totalPositions}个`;
      }

      // AI SDK v5 格式
      return {
        type: "content" as const,
        value: [{ type: "text" as const, text: content }],
      };
    },
  });
};

/**
 * 创建智能回复工具的快捷函数
 * @param preferredBrand 优先使用的品牌
 * @param modelConfig 模型配置
 * @param configData 配置数据
 * @param replyPolicy 回复策略
 * @returns 智能回复工具实例
 */
export const createZhipinReplyTool = zhipinReplyTool;

/**
 * 智能回复工具使用示例
 *
 * ```typescript
 * // 1. 基础使用
 * const result = await zhipinReplyTool.execute({
 *   candidate_message: "你们还招人吗？"
 * });
 *
 * // 2. 带对话历史
 * const result = await zhipinReplyTool.execute({
 *   candidate_message: "工资多少？",
 *   conversation_history: ["你好，请问贵公司还在招聘吗？", "是的，我们正在招聘前厅服务员"]
 * });
 *
 * // 3. 指定品牌
 * const result = await zhipinReplyTool.execute({
 *   candidate_message: "有什么要求吗？",
 *   brand: "蜀地源冒菜",
 *   include_stats: true
 * });
 * ```
 */
export const ZHIPIN_REPLY_USAGE_EXAMPLES = {
  basic: {
    candidate_message: "你们还招人吗？",
  },
  withHistory: {
    candidate_message: "工资多少？",
    conversation_history: ["你好，请问贵公司还在招聘吗？", "是的，我们正在招聘前厅服务员"],
  },
  withBrandAndStats: {
    candidate_message: "有什么要求吗？",
    brand: "蜀地源冒菜",
    include_stats: true,
  },
} as const;
