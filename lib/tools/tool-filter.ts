// CoreTool is deprecated, use any for now since we're just filtering
// The actual tool types are properly typed in the consuming code

/**
 * 工具过滤适配器
 * 根据系统提示词动态过滤可用的工具集
 */

// 定义系统提示词类型
export type SystemPromptType = 
  | "bossZhipinSystemPrompt"        // Boss直聘E2B版
  | "bossZhipinLocalSystemPrompt"   // Boss直聘本地Puppeteer版
  | "generalComputerSystemPrompt"   // 通用计算机使用
  | string;                         // 其他自定义提示词

// 定义工具分组
const TOOL_GROUPS = {
  // 通用工具 - 所有场景都可用
  // bash: 在 E2B 模式下执行沙箱命令，在本地模式下执行本地命令（开发环境下会显示警告）
  universal: ["bash", "feishu", "wechat"],
  
  // E2B桌面自动化工具
  e2b: ["computer"],
  
  // Boss直聘业务工具
  zhipinBusiness: [
    "job_posting_generator", 
    "zhipin_reply_generator",
    "duliday_job_list",
    "duliday_job_details",
    "duliday_interview_booking",
    "duliday_bi_report",
    "duliday_bi_refresh"
  ],
  
  // Puppeteer本地自动化工具
  puppeteer: ["puppeteer"],
  
  // Zhipin Puppeteer自动化工具集
  zhipinPuppeteer: [
    "zhipin_get_unread_candidates_improved",
    "zhipin_open_candidate_chat_improved",
    "zhipin_send_message",
    "zhipin_get_chat_details",
    "zhipin_exchange_wechat",
    "zhipin_get_username"
  ],
  
  // Yupao Puppeteer自动化工具集
  yupaoPuppeteer: [
    "yupao_get_unread_messages",
    "yupao_open_candidate_chat",
    "yupao_get_chat_details",
    "yupao_send_message",
    "yupao_exchange_wechat",
    "yupao_get_username"
  ]
} as const;

// 定义每种系统提示词对应的工具集
const PROMPT_TOOL_MAPPING: Record<string, string[]> = {
  // Boss直聘E2B版 - 使用E2B桌面自动化
  bossZhipinSystemPrompt: [
    ...TOOL_GROUPS.universal,
    ...TOOL_GROUPS.e2b,
    ...TOOL_GROUPS.zhipinBusiness
  ],
  
  // Boss直聘本地版 - 使用Puppeteer自动化
  bossZhipinLocalSystemPrompt: [
    ...TOOL_GROUPS.universal,
    ...TOOL_GROUPS.puppeteer,
    ...TOOL_GROUPS.zhipinBusiness,
    ...TOOL_GROUPS.zhipinPuppeteer,
    ...TOOL_GROUPS.yupaoPuppeteer
  ],
  
  // 通用计算机使用 - 包含E2B和Puppeteer，但不包含Boss直聘业务工具
  generalComputerSystemPrompt: [
    ...TOOL_GROUPS.universal,
    ...TOOL_GROUPS.e2b,
    ...TOOL_GROUPS.puppeteer
  ]
};

/**
 * 根据系统提示词过滤工具集
 * @param allTools 所有可用的工具
 * @param activeSystemPrompt 当前激活的系统提示词
 * @returns 过滤后的工具集
 */
export function filterToolsBySystemPrompt<T extends Record<string, unknown>>(
  allTools: T,
  activeSystemPrompt: SystemPromptType
): Partial<T> {
  // 获取允许的工具列表
  const allowedTools = PROMPT_TOOL_MAPPING[activeSystemPrompt];
  
  // 如果没有找到对应的映射，返回所有工具（兼容性处理）
  if (!allowedTools) {
    console.warn(`⚠️ 未找到系统提示词 "${activeSystemPrompt}" 的工具映射，返回所有工具`);
    return allTools;
  }
  
  // 过滤工具
  const filteredTools: Partial<T> = {};
  
  for (const [toolName, tool] of Object.entries(allTools)) {
    if (allowedTools.includes(toolName)) {
      filteredTools[toolName as keyof T] = tool as T[keyof T];
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
 * 获取系统提示词对应的工具列表（用于调试和文档）
 */
export function getToolsForPrompt(promptType: SystemPromptType): string[] {
  return PROMPT_TOOL_MAPPING[promptType] || [];
}

/**
 * 检查某个工具是否在指定提示词下可用
 */
export function isToolAllowed(
  toolName: string,
  activeSystemPrompt: SystemPromptType
): boolean {
  const allowedTools = PROMPT_TOOL_MAPPING[activeSystemPrompt];
  return allowedTools ? allowedTools.includes(toolName) : true;
}