/**
 * 统一的工具类型定义
 * 用于标准化所有 AI SDK 工具的输入输出类型
 */

import { z } from "zod";
import type { UIMessagePart, UIDataTypes, UITools, Tool } from "ai";
import type { ModelConfig } from "@/lib/config/models";
import type { ZhipinData } from "./zhipin";
import type { SystemPromptsConfig, ReplyPromptsConfig } from "./config"

// ========== 工具注册表类型定义 ==========

/**
 * 工具创建上下文
 * 包含创建工具所需的所有参数
 */
export interface ToolCreationContext {
  sandboxId: string | null;
  preferredBrand?: string;
  modelConfig?: ModelConfig;
  configData?: ZhipinData;
  replyPrompts?: ReplyPromptsConfig;
  dulidayToken?: string;
}

/**
 * 工具类别
 * 用于组织和管理工具
 */
export type ToolCategory = 
  | "universal"       // 通用工具
  | "sandbox"         // 沙盒工具（需要 E2B）
  | "automation"      // 自动化工具（Puppeteer等）
  | "business"        // 业务工具（招聘相关）
  | "communication";  // 通信工具（飞书、微信等）

/**
 * 工具定义
 * 描述工具的元信息和创建函数
 */
export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  requiresSandbox: boolean;
  create: (context: ToolCreationContext) => Tool<any, any> | null;
}

/**
 * AI SDK ToolSet 类型
 * 工具名称到工具实例的映射
 */
export type ToolSet = Record<string, Tool<any, any>>;

/**
 * 系统提示词类型
 * 从 SystemPromptsConfig 的键派生，确保类型安全
 */
export type SystemPromptType = keyof SystemPromptsConfig | string;

// ========== 工具输出类型定义 ==========

/**
 * 文本输出类型
 * 用于返回纯文本结果
 */
export const TextOutputSchema = z.object({
  type: z.literal("text"),
  text: z.string().describe("文本内容"),
});

export type TextOutput = z.infer<typeof TextOutputSchema>;

/**
 * 图片输出类型
 * 用于返回图片数据（Base64编码）
 */
export const ImageOutputSchema = z.object({
  type: z.literal("image"),
  data: z.string().describe("Base64编码的图片数据"),
});

export type ImageOutput = z.infer<typeof ImageOutputSchema>;

/**
 * 统一的工具输出类型
 * 所有工具都应该返回这个类型
 */
export const ToolOutputSchema = z.discriminatedUnion("type", [
  TextOutputSchema,
  ImageOutputSchema,
]);

export type ToolOutput = z.infer<typeof ToolOutputSchema>;

/**
 * 扩展的工具输出类型（支持更多格式）
 * 用于未来可能的扩展
 */
export const ExtendedToolOutputSchema = z.discriminatedUnion("type", [
  TextOutputSchema,
  ImageOutputSchema,
  // 可以在这里添加更多输出类型，例如：
  // z.object({ type: z.literal("video"), data: z.string() }),
  // z.object({ type: z.literal("file"), path: z.string(), name: z.string() }),
  // z.object({ type: z.literal("json"), data: z.unknown() }),
]);

export type ExtendedToolOutput = z.infer<typeof ExtendedToolOutputSchema>;

// ========== 工具类型守卫 ==========

/**
 * 检查是否为文本输出
 */
export function isTextOutput(output: ToolOutput): output is TextOutput {
  return output.type === "text";
}

/**
 * 检查是否为图片输出
 */
export function isImageOutput(output: ToolOutput): output is ImageOutput {
  return output.type === "image";
}

// ========== AI SDK v5 工具部分类型定义 ==========

/**
 * 从 UIMessagePart 中提取工具部分
 * AI SDK v5 中工具部分的 type 是 `tool-${string}` 格式
 */
export type ToolPart = Extract<
  UIMessagePart<UIDataTypes, UITools>,
  { type: `tool-${string}` }
>;

/**
 * 工具部分的状态联合类型
 * 根据 AI SDK v5 文档定义
 */
export type ToolPartState = 
  | "input-streaming"  // 正在流式传输输入
  | "input-available"  // 输入已就绪
  | "output-available" // 输出已就绪
  | "output-error";    // 输出错误

/**
 * 检查消息部分是否为工具调用
 * 检查 type 是否以 "tool-" 开头
 */
export function isToolPart(
  part: UIMessagePart<UIDataTypes, UITools>
): part is ToolPart {
  return typeof part.type === "string" && part.type.startsWith("tool-");
}

/**
 * 从工具部分类型中提取工具名称
 * 移除 "tool-" 前缀获取实际工具名
 */
export function extractToolName(part: ToolPart): string {
  return part.type.substring(5); // 使用 substring 替代 replace 更高效
}

/**
 * 安全获取工具部分的状态
 * 所有工具部分都应该有 state 属性
 */
export function getToolPartState(part: ToolPart): ToolPartState | undefined {
  if ("state" in part && typeof part.state === "string") {
    return part.state as ToolPartState;
  }
  return undefined;
}

/**
 * 安全获取工具部分的输入
 * 所有状态都应该有 input 属性
 */
export function getToolPartInput(part: ToolPart): unknown | undefined {
  if ("input" in part) {
    return part.input;
  }
  return undefined;
}

/**
 * 安全获取工具部分的输出
 * 只有 output-available 状态才有 output
 */
export function getToolPartOutput(part: ToolPart): unknown | undefined {
  if ("state" in part && part.state === "output-available" && "output" in part) {
    return part.output;
  }
  return undefined;
}

/**
 * 安全获取工具部分的错误文本
 * 只有 output-error 状态才有 errorText
 */
export function getToolPartErrorText(part: ToolPart): string | undefined {
  if ("state" in part && part.state === "output-error" && "errorText" in part) {
    return part.errorText as string;
  }
  return undefined;
}

/**
 * 检查工具部分是否有输出
 */
export function hasToolOutput(part: ToolPart): boolean {
  return "state" in part && part.state === "output-available" && "output" in part;
}

/**
 * 检查工具部分是否有错误
 */
export function hasToolError(part: ToolPart): boolean {
  return "state" in part && part.state === "output-error";
}

/**
 * 获取工具调用 ID
 */
export function getToolCallId(part: ToolPart): string | undefined {
  if ("toolCallId" in part) {
    return part.toolCallId;
  }
  return undefined;
}

// ========== 工具输出处理辅助函数 ==========

/**
 * 用于解析工具输出的结构化数据
 * 处理可能包含 type 和 data 字段的输出对象
 */
export interface StructuredToolOutput {
  type?: string;
  data?: unknown;
  text?: string;
  [key: string]: unknown;
}

/**
 * 安全解析工具输出为结构化格式
 */
export function parseToolOutput(output: unknown): StructuredToolOutput | null {
  if (!output || typeof output !== "object") {
    return null;
  }
  
  return output as StructuredToolOutput;
}

/**
 * 将任意输出转换为标准 ToolOutput 格式
 */
export function normalizeToolOutput(output: unknown): ToolOutput {
  // 如果已经是标准格式，直接返回
  const parsed = ToolOutputSchema.safeParse(output);
  if (parsed.success) {
    return parsed.data;
  }

  // 尝试解析为结构化输出
  const structured = parseToolOutput(output);
  if (structured) {
    // 处理图片类型
    if (structured.type === "image" && structured.data) {
      return {
        type: "image",
        data: String(structured.data),
      };
    }
    
    // 处理文本类型
    if (structured.type === "text" && (structured.text || structured.data)) {
      return {
        type: "text",
        text: String(structured.text || structured.data),
      };
    }
  }

  // 默认转换为文本输出
  return {
    type: "text",
    text: typeof output === "string" ? output : JSON.stringify(output, null, 2),
  };
}

// ========== 导出常用的创建函数 ==========

/**
 * 创建文本输出
 */
export function createTextOutput(text: string): TextOutput {
  return {
    type: "text",
    text,
  };
}

/**
 * 创建图片输出
 */
export function createImageOutput(data: string): ImageOutput {
  return {
    type: "image",
    data,
  };
}

/**
 * 创建错误输出（作为文本）
 */
export function createErrorOutput(error: unknown): TextOutput {
  const errorMessage = error instanceof Error 
    ? error.message 
    : String(error);
  
  return {
    type: "text",
    text: `❌ 错误: ${errorMessage}`,
  };
}