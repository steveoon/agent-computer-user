/**
 * Agent ID 验证常量（与 Electron agent-manager 共享）
 */

/**
 * Agent ID 验证正则
 * - 必须以字母或数字开头
 * - 只能包含字母、数字、下划线或连字符
 */
export const AGENT_ID_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

/**
 * 验证 Agent ID 是否有效
 */
export function isValidAgentId(id: string): boolean {
  return AGENT_ID_REGEX.test(id);
}

/**
 * 默认 Agent ID
 */
export const DEFAULT_AGENT_ID = "default";
