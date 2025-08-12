import { tool } from "ai";
import { z } from "zod";
import { generateSmartReplyWithLLM } from "@/lib/loaders/zhipin-data.loader";
import { loadZhipinData } from "@/lib/loaders/zhipin-data.loader";
import type { ZhipinData } from "@/types/zhipin";
import type { ReplyPromptsConfig } from "@/types/config";
import type { ModelConfig } from "@/lib/config/models";
import { DEFAULT_MODEL_CONFIG } from "@/lib/config/models";
import { CandidateInfoSchema } from "@/lib/tools/zhipin/types";

/**
 * 智能回复工具的执行结果类型
 */
type ZhipinReplyToolResult = {
  reply: string;
  replyType: string;
  reasoningText: string;
  candidateMessage: string;
  historyCount: number;
  stats?: {
    totalStores: number;
    totalPositions: number;
    brand: string;
  };
};

/**
 * Boss直聘智能回复工具
 *
 * 功能特性：
 * - 🤖 根据候选人消息生成智能回复
 * - 📝 支持对话历史上下文
 * - 🏢 多品牌支持
 * - 🎯 16种回复场景分类
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
  replyPrompts?: ReplyPromptsConfig
) =>
  tool({
    description: `
      Boss直聘智能回复生成工具，根据候选人消息自动生成招聘回复。
      
      主要功能：
      - 根据候选人消息内容智能生成回复
      - 支持多轮对话历史上下文
      - 自动识别16种回复场景（招聘类10种+考勤类6种）
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

      brand: z.string().optional().describe("指定品牌名称，如果不指定则使用默认品牌"),

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

        // 使用传入的品牌或默认品牌
        const effectiveBrand = brand || preferredBrand;

        // 使用传入的模型配置或默认配置
        const effectiveModelConfig = modelConfig || DEFAULT_MODEL_CONFIG;

        // 生成智能回复
        const replyResult = await generateSmartReplyWithLLM(
          candidate_message,
          processedHistory,
          effectiveBrand,
          effectiveModelConfig,
          configData,
          replyPrompts,
          candidate_info
        );

        console.log(`✅ 回复生成成功`);
        console.log(`📝 回复内容: ${replyResult.text}`);
        console.log(`🎯 回复类型: ${replyResult.replyType}`);
        console.log(`📊 分类依据: ${replyResult.reasoningText}`);

        // 构建响应
        const response: ZhipinReplyToolResult = {
          reply: replyResult.text,
          replyType: replyResult.replyType,
          reasoningText: replyResult.reasoningText || "未提供分类依据",
          candidateMessage: candidate_message,
          historyCount: processedHistory.length,
        };

        // 如果需要包含统计信息
        if (include_stats) {
          const storeDatabase = configData || (await loadZhipinData(effectiveBrand));
          const totalPositions = storeDatabase.stores.reduce(
            (sum, store) => sum + store.positions.length,
            0
          );

          response.stats = {
            totalStores: storeDatabase.stores.length,
            totalPositions: totalPositions,
            brand: effectiveBrand || storeDatabase.defaultBrand || "未知品牌",
          };
        }

        return response;
      } catch (error) {
        console.error("❌ 智能回复生成失败:", error);
        throw new Error(`智能回复生成失败: ${error instanceof Error ? error.message : "未知错误"}`);
      }
    },

    toModelOutput(result: ZhipinReplyToolResult) {
      // 格式化输出结果
      let content = `✅ 智能回复已生成\n\n`;
      content += `📝 回复内容:\n"${result.reply}"\n\n`;
      content += `🎯 回复类型: ${result.replyType}\n`;
      content += `💬 候选人消息: "${result.candidateMessage}"\n`;
      content += `📋 历史记录: ${result.historyCount}条\n`;

      if (result.stats) {
        content += `\n📊 数据统计:\n`;
        content += `• 品牌: ${result.stats.brand}\n`;
        content += `• 门店数: ${result.stats.totalStores}家\n`;
        content += `• 岗位数: ${result.stats.totalPositions}个`;
      }

      // AI SDK v5 格式
      return {
        type: "content" as const,
        value: [{ type: "text" as const, text: content }],
      };
    },
  });

/**
 * 创建智能回复工具的快捷函数
 * @param preferredBrand 优先使用的品牌
 * @param modelConfig 模型配置
 * @param configData 配置数据
 * @param replyPrompts 回复提示词
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
