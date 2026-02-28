/**
 * 工具注册表系统
 * 集中管理所有AI工具的创建、注册和过滤
 */

import { z } from "zod/v3";
import { bashTool, computerTool } from "@/lib/e2b/tool";
import { feishuBotTool } from "./feishu-bot-tool";
import { puppeteerTool } from "./puppeteer-tool";
import { analyzeScreenshotTool } from "./analyze-screenshot.tool";
import { screenshotTool } from "./screenshot.tool";
import { weChatBotTool } from "./wechat-bot-tool";
import { jobPostingGeneratorTool } from "./job-posting-generator-tool";
import { zhipinReplyTool } from "./zhipin-reply-tool";
import { zhipinTools } from "./zhipin";
import { yupaoTools } from "./yupao";
import { dulidayJobListTool } from "./duliday/duliday-job-list-tool";
import { dulidayJobDetailsTool } from "./duliday/duliday-job-details-tool";
import { dulidayInterviewBookingTool } from "./duliday/duliday-interview-booking-tool";
import { dulidayBiReportTool } from "./duliday/bi-report-tool";
import { dulidayBiRefreshTool } from "./duliday/bi-refresh-tool";
import { dulidayJobListForLlmTool } from "./duliday-job-list-for-llm.tool";
import { createWeworkPlanTurnTool } from "./wework/plan_turn.tool";
import { createWeworkExtractFactsTool } from "./wework/extract_facts.tool";
import { DEFAULT_MODEL_CONFIG } from "@/lib/config/models";
import { ZhipinDataSchema } from "@/types/zhipin";
import { ReplyPolicyConfigSchema, StageGoalsSchema } from "@/types/reply-policy";

// Import types from centralized location
import type {
  ToolCreationContext,
  ToolDefinition,
  ToolCategory,
  SystemPromptType,
  ToolSet,
} from "@/types/tool-common";
import { safeCreateTool, createToolDefinition } from "@/types/tool-common";

// ========== 工具注册表 ==========

/**
 * 工具注册表
 * 所有工具的定义都在这里，使用类型安全的定义
 * Note: 使用 ToolDefinition 而不指定泛型，允许工具有各自的输入输出类型
 */
const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  // ===== 沙盒工具 =====
  computer: createToolDefinition({
    name: "computer",
    description: "E2B沙盒中的计算机控制工具",
    category: "sandbox",
    requiresSandbox: true,
    requiredContext: ["sandboxId"],
    create: ctx => {
      // 只有当 sandboxId 存在时才创建
      if (!ctx.sandboxId) return null;
      return computerTool(
        ctx.sandboxId,
        ctx.preferredBrand || "",
        ctx.modelConfig || DEFAULT_MODEL_CONFIG,
        ctx.configData,
        ctx.replyPolicy,
        ctx.defaultWechatId
      );
    },
  }),

  // ===== 通用工具 =====
  bash: createToolDefinition({
    name: "bash",
    description: "Bash命令执行工具",
    category: "universal",
    requiresSandbox: false,
    create: ctx => bashTool(ctx.sandboxId || undefined),
  }),

  // ===== 通信工具 =====
  feishu: createToolDefinition({
    name: "feishu",
    description: "飞书机器人消息工具",
    category: "communication",
    requiresSandbox: false,
    create: () => feishuBotTool(),
  }),

  wechat: createToolDefinition({
    name: "wechat",
    description: "微信机器人消息工具",
    category: "communication",
    requiresSandbox: false,
    create: () => weChatBotTool(),
  }),

  // ===== 业务工具 =====
  job_posting_generator: createToolDefinition({
    name: "job_posting_generator",
    description: "职位发布生成器",
    category: "business",
    requiresSandbox: false,
    create: ctx => jobPostingGeneratorTool(ctx.preferredBrand, ctx.configData),
  }),

  zhipin_reply_generator: createToolDefinition({
    name: "zhipin_reply_generator",
    description: "智聘智能回复生成器",
    category: "business",
    requiresSandbox: false,
    requiredContext: ["configData", "replyPolicy"],
    contextSchemas: {
      configData: ZhipinDataSchema,
      replyPolicy: ReplyPolicyConfigSchema,
    },
    create: ctx =>
      zhipinReplyTool(
        ctx.preferredBrand,
        ctx.modelConfig || DEFAULT_MODEL_CONFIG,
        ctx.configData,
        ctx.replyPolicy,
        ctx.defaultWechatId,
        ctx.brandPriorityStrategy,
        ctx.industryVoiceId
      ),
  }),

  // ===== 自动化工具 =====
  puppeteer: createToolDefinition({
    name: "puppeteer",
    description: "Puppeteer浏览器自动化工具",
    category: "automation",
    requiresSandbox: false,
    create: () => puppeteerTool(),
  }),

  analyze_screenshot: createToolDefinition({
    name: "analyze_screenshot",
    description: "截图分析工具，使用AI分析截图内容",
    category: "automation",
    requiresSandbox: false,
    create: () => analyzeScreenshotTool(),
  }),

  screenshot: createToolDefinition({
    name: "screenshot",
    description: "统一截图工具，支持Puppeteer和Playwright双后端",
    category: "automation",
    requiresSandbox: false,
    create: () => screenshotTool(),
  }),

  // ===== Zhipin 自动化工具 =====
  zhipin_get_unread_candidates_improved: createToolDefinition({
    name: "zhipin_get_unread_candidates_improved",
    description: "获取智聘未读候选人",
    category: "automation",
    requiresSandbox: false,
    create: () => zhipinTools.getUnreadCandidatesImproved,
  }),

  zhipin_open_candidate_chat_improved: createToolDefinition({
    name: "zhipin_open_candidate_chat_improved",
    description: "打开智聘候选人聊天",
    category: "automation",
    requiresSandbox: false,
    create: () => zhipinTools.openCandidateChatImproved,
  }),

  zhipin_send_message: createToolDefinition({
    name: "zhipin_send_message",
    description: "发送智聘消息",
    category: "automation",
    requiresSandbox: false,
    create: () => zhipinTools.sendMessage(),
  }),

  zhipin_get_chat_details: createToolDefinition({
    name: "zhipin_get_chat_details",
    description: "获取智聘聊天详情",
    category: "automation",
    requiresSandbox: false,
    create: () => zhipinTools.getChatDetails(),
  }),

  zhipin_exchange_wechat: createToolDefinition({
    name: "zhipin_exchange_wechat",
    description: "交换微信",
    category: "automation",
    requiresSandbox: false,
    create: () => zhipinTools.exchangeWechat(),
  }),

  zhipin_get_username: createToolDefinition({
    name: "zhipin_get_username",
    description: "获取智聘用户名",
    category: "automation",
    requiresSandbox: false,
    create: () => zhipinTools.getUsername,
  }),

  zhipin_say_hello: createToolDefinition({
    name: "zhipin_say_hello",
    description: "Boss直聘批量打招呼",
    category: "automation",
    requiresSandbox: false,
    create: () => zhipinTools.sayHelloSimple(),
  }),

  zhipin_get_candidate_list: createToolDefinition({
    name: "zhipin_get_candidate_list",
    description: "获取Boss直聘候选人列表",
    category: "automation",
    requiresSandbox: false,
    create: () => zhipinTools.getCandidateList(),
  }),

  zhipin_open_resume: createToolDefinition({
    name: "zhipin_open_resume",
    description: "打开Boss直聘候选人简历",
    category: "automation",
    requiresSandbox: false,
    create: () => zhipinTools.openResume(),
  }),

  zhipin_locate_resume_canvas: createToolDefinition({
    name: "zhipin_locate_resume_canvas",
    description: "定位Boss直聘简历Canvas位置",
    category: "automation",
    requiresSandbox: false,
    create: () => zhipinTools.locateResumeCanvas(),
  }),

  zhipin_close_resume_detail: createToolDefinition({
    name: "zhipin_close_resume_detail",
    description: "关闭Boss直聘简历详情弹窗",
    category: "automation",
    requiresSandbox: false,
    create: () => zhipinTools.closeResumeDetail(),
  }),

  // ===== Yupao 自动化工具 =====
  yupao_get_unread_messages: createToolDefinition({
    name: "yupao_get_unread_messages",
    description: "获取约聘未读消息",
    category: "automation",
    requiresSandbox: false,
    create: () => yupaoTools.getUnreadMessages,
  }),

  yupao_open_candidate_chat: createToolDefinition({
    name: "yupao_open_candidate_chat",
    description: "打开约聘候选人聊天",
    category: "automation",
    requiresSandbox: false,
    create: () => yupaoTools.openCandidateChat,
  }),

  yupao_get_chat_details: createToolDefinition({
    name: "yupao_get_chat_details",
    description: "获取约聘聊天详情",
    category: "automation",
    requiresSandbox: false,
    create: () => yupaoTools.getChatDetails,
  }),

  yupao_send_message: createToolDefinition({
    name: "yupao_send_message",
    description: "发送约聘消息",
    category: "automation",
    requiresSandbox: false,
    create: () => yupaoTools.sendMessage,
  }),

  yupao_exchange_wechat: createToolDefinition({
    name: "yupao_exchange_wechat",
    description: "约聘交换微信",
    category: "automation",
    requiresSandbox: false,
    create: () => yupaoTools.exchangeWechat,
  }),

  yupao_get_username: createToolDefinition({
    name: "yupao_get_username",
    description: "获取约聘用户名",
    category: "automation",
    requiresSandbox: false,
    create: () => yupaoTools.getUsername,
  }),

  yupao_get_candidate_list: createToolDefinition({
    name: "yupao_get_candidate_list",
    description: "获取约聘候选人列表",
    category: "automation",
    requiresSandbox: false,
    create: () => yupaoTools.getCandidateList,
  }),

  yupao_say_hello: createToolDefinition({
    name: "yupao_say_hello",
    description: "约聘批量打招呼",
    category: "automation",
    requiresSandbox: false,
    create: () => yupaoTools.sayHello,
  }),

  // ===== Duliday 业务工具 =====
  duliday_job_list: createToolDefinition({
    name: "duliday_job_list",
    description: "Duliday职位列表",
    category: "business",
    requiresSandbox: false,
    requiredContext: ["dulidayToken"],
    create: ctx => dulidayJobListTool(ctx.dulidayToken, ctx.preferredBrand),
  }),

  duliday_job_details: createToolDefinition({
    name: "duliday_job_details",
    description: "Duliday职位详情",
    category: "business",
    requiresSandbox: false,
    requiredContext: ["dulidayToken"],
    create: ctx => dulidayJobDetailsTool(ctx.dulidayToken),
  }),

  duliday_interview_booking: createToolDefinition({
    name: "duliday_interview_booking",
    description: "Duliday面试预约",
    category: "business",
    requiresSandbox: false,
    requiredContext: ["dulidayToken"],
    create: ctx => dulidayInterviewBookingTool(ctx.dulidayToken),
  }),

  duliday_bi_report: createToolDefinition({
    name: "duliday_bi_report",
    description: "Duliday BI报表",
    category: "business",
    requiresSandbox: false,
    create: () => dulidayBiReportTool(),
  }),

  duliday_bi_refresh: createToolDefinition({
    name: "duliday_bi_refresh",
    description: "Duliday BI刷新",
    category: "business",
    requiresSandbox: false,
    create: () => dulidayBiRefreshTool(),
  }),

  duliday_job_list_for_llm: createToolDefinition({
    name: "duliday_job_list_for_llm",
    description: "查询在招岗位列表（LLM优化格式），返回 Markdown 格式化的岗位信息，包含薪资、招聘要求、工作时间、面试安排等完整信息，适用于自动回复求职者场景",
    category: "business",
    requiresSandbox: false,
    requiredContext: ["dulidayToken"],
    create: ctx => dulidayJobListForLlmTool(ctx.dulidayToken),
  }),

  wework_plan_turn: createToolDefinition({
    name: "wework_plan_turn",
    description: "企微智能化：识别当前对话阶段、检测回复需求、标记风险因子，并返回当前阶段的运营目标配置",
    category: "business",
    requiresSandbox: false,
    requiredContext: ["stageGoals"],
    contextSchemas: {
      stageGoals: StageGoalsSchema,
    },
    create: ctx => ctx.stageGoals ? createWeworkPlanTurnTool(ctx.stageGoals, ctx.modelConfig?.classifyModel, ctx.processedMessages) : null,
  }),

  wework_extract_facts: createToolDefinition({
    name: "wework_extract_facts",
    description: "企微智能化：从对话历史中累积提取候选人事实信息（面试信息 + 意向信息），与对话阶段无关，全面客观",
    category: "business",
    requiresSandbox: false,
    requiredContext: ["userId", "sessionId"],
    contextSchemas: {
      userId: z.string(),
      sessionId: z.string(),
    },
    create: ctx => createWeworkExtractFactsTool(ctx.modelConfig?.extractModel, ctx.processedMessages, ctx.userId, ctx.sessionId),
  }),
};

// ========== 工具分组配置 ==========

/**
 * 对外公开的系统提示词（用于 Open API）
 */
export const OPEN_API_PROMPT_TYPES = [
  "bossZhipinSystemPrompt",
  "bossZhipinLocalSystemPrompt",
  "generalComputerSystemPrompt",
  "weworkSystemPrompt",
] as const;

export type OpenApiPromptType = typeof OPEN_API_PROMPT_TYPES[number];

/**
 * 根据系统提示词定义可用的工具
 */
const PROMPT_TOOL_MAPPING: Record<string, string[]> = {
  // Boss直聘E2B版 - 使用E2B桌面自动化
  bossZhipinSystemPrompt: [
    // 通用工具
    "bash",
    "feishu",
    "wechat",
    // 沙盒工具
    "computer",
    // 业务工具
    "job_posting_generator",
    "zhipin_reply_generator",
    "duliday_job_list",
    "duliday_job_details",
    "duliday_interview_booking",
    "duliday_bi_report",
    "duliday_bi_refresh",
  ],

  // Boss直聘本地版 - 使用Puppeteer自动化
  bossZhipinLocalSystemPrompt: [
    // 通用工具
    "bash",
    "feishu",
    "wechat",
    // 自动化工具
    "puppeteer",
    "screenshot",
    "analyze_screenshot",
    // 业务工具
    "job_posting_generator",
    "zhipin_reply_generator",
    "duliday_job_list",
    "duliday_job_details",
    "duliday_interview_booking",
    "duliday_bi_report",
    "duliday_bi_refresh",
    // Zhipin自动化
    "zhipin_get_unread_candidates_improved",
    "zhipin_open_candidate_chat_improved",
    "zhipin_send_message",
    "zhipin_get_chat_details",
    "zhipin_exchange_wechat",
    "zhipin_get_username",
    "zhipin_say_hello",
    "zhipin_get_candidate_list",
    "zhipin_open_resume",
    "zhipin_locate_resume_canvas",
    "zhipin_close_resume_detail",
    // Yupao自动化
    "yupao_get_unread_messages",
    "yupao_open_candidate_chat",
    "yupao_get_chat_details",
    "yupao_send_message",
    "yupao_exchange_wechat",
    "yupao_get_username",
    "yupao_get_candidate_list",
    "yupao_say_hello",
  ],

  // 企微智能化 - 对话阶段规划 + 事实提取 + 岗位信息
  weworkSystemPrompt: [
    "wework_plan_turn",
    "wework_extract_facts",
    "duliday_job_list_for_llm",
  ],

  // 通用计算机使用 - 包含E2B和Puppeteer，但不包含Boss直聘业务工具
  generalComputerSystemPrompt: [
    // 通用工具
    "bash",
    "feishu",
    "wechat",
    // 沙盒工具
    "computer",
    // 自动化工具
    "puppeteer",
    "screenshot",
    "analyze_screenshot",
  ],
};

// ========== 工具管理器核心功能 ==========

/**
 * 创建并获取所有工具
 * 这是主要的入口函数，使用类型安全的工具创建
 */
export function createTools(context: ToolCreationContext): ToolSet {
  const tools: ToolSet = {};

  // 遍历注册表，创建所有工具
  for (const [toolName, definition] of Object.entries(TOOL_REGISTRY)) {
    // 使用类型安全的创建包装器
    const tool = safeCreateTool(definition, context);
    if (tool !== null) {
      tools[toolName] = tool;
    }
  }

  console.log(`🔧 创建了 ${Object.keys(tools).length} 个工具`);
  return tools;
}

/**
 * 根据系统提示词过滤工具
 */
export function filterToolsBySystemPrompt(
  allTools: ToolSet,
  activeSystemPrompt: SystemPromptType
): ToolSet {
  // 获取允许的工具列表
  const allowedTools = PROMPT_TOOL_MAPPING[activeSystemPrompt];

  // 如果没有找到对应的映射，返回所有工具（兼容性处理）
  if (!allowedTools) {
    console.warn(`⚠️ 未找到系统提示词 "${activeSystemPrompt}" 的工具映射，返回所有工具`);
    return allTools;
  }

  // 过滤工具
  const filteredTools: ToolSet = {};

  for (const [toolName, tool] of Object.entries(allTools)) {
    if (allowedTools.includes(toolName)) {
      filteredTools[toolName] = tool;
    }
  }

  // 记录过滤结果
  const originalCount = Object.keys(allTools).length;
  const filteredCount = Object.keys(filteredTools).length;
  console.log(
    `🔧 工具过滤: ${activeSystemPrompt} - 从 ${originalCount} 个工具过滤为 ${filteredCount} 个工具`
  );
  console.log(`✅ 可用工具: ${Object.keys(filteredTools).join(", ")}`);

  return filteredTools;
}

/**
 * 创建并过滤工具（一步到位）
 * 这是最简洁的API，用于替代route.ts中的复杂逻辑
 */
export function createAndFilterTools(
  context: ToolCreationContext,
  promptType: SystemPromptType
): ToolSet {
  const allTools = createTools(context);
  return filterToolsBySystemPrompt(allTools, promptType);
}

// ========== 工具信息和调试功能 ==========

/**
 * 获取所有注册的工具名称
 */
export function getAllToolNames(): string[] {
  return Object.keys(TOOL_REGISTRY);
}

/**
 * 获取指定类别的工具
 */
export function getToolsByCategory(category: ToolCategory): string[] {
  return Object.entries(TOOL_REGISTRY)
    .filter(([_, def]) => def.category === category)
    .map(([name]) => name);
}

/**
 * 获取需要沙盒的工具
 */
export function getSandboxRequiredTools(): string[] {
  return Object.entries(TOOL_REGISTRY)
    .filter(([_, def]) => def.requiresSandbox)
    .map(([name]) => name);
}

/**
 * 检查某个工具是否在指定提示词下可用
 */
export function isToolAllowed(toolName: string, activeSystemPrompt: SystemPromptType): boolean {
  const allowedTools = PROMPT_TOOL_MAPPING[activeSystemPrompt];
  return allowedTools ? allowedTools.includes(toolName) : true;
}

/**
 * 获取系统提示词对应的工具列表
 */
export function getToolsForPrompt(promptType: SystemPromptType): string[] {
  return PROMPT_TOOL_MAPPING[promptType] || [];
}

/**
 * 获取导出工具注册表（只读）
 * 用于支持直接访问工具定义元数据
 */
export function getToolRegistry(): Readonly<Record<string, ToolDefinition>> {
  return TOOL_REGISTRY;
}

// ========== 工具元数据访问功能 ==========

/**
 * 获取工具元数据列表（用于 /api/v1/tools 接口）
 * 返回工具名称、描述、分类、是否需要沙盒、必需的上下文字段
 */
export function getToolMetadataList(): Array<{
  name: string;
  description: string;
  category: string;
  requiresSandbox: boolean;
  requiredContext: string[];
}> {
  return Object.entries(TOOL_REGISTRY).map(([name, definition]) => ({
    name,
    description: definition.description,
    category: definition.category,
    requiresSandbox: definition.requiresSandbox || false,
    requiredContext: definition.requiredContext || [],
  }));
}

/**
 * 获取单个工具的元数据
 */
export function getToolMetadata(toolName: string): {
  name: string;
  requiresSandbox: boolean;
  requiredContext: string[];
  description?: string;
} | null {
  const definition = TOOL_REGISTRY[toolName];
  if (!definition) return null;

  return {
    name: toolName,
    requiresSandbox: definition.requiresSandbox || false,
    requiredContext: definition.requiredContext || [],
    description: definition.description,
  };
}

// ========== 导出其他功能函数 ==========

// 为了向后兼容，重新导出类型
export type {
  ToolCreationContext,
  ToolDefinition,
  ToolCategory,
  SystemPromptType,
  ToolSet,
} from "@/types/tool-common";
