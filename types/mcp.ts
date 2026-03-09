import { z } from 'zod/v3';

// ========== MCP 客户端管理器类型定义 ==========

/**
 * MCP客户端配置
 */
export const MCPClientConfigSchema = z.object({
  name: z.string().describe("客户端名称"),
  description: z.string().describe("客户端描述"),
  command: z.string().describe("启动命令"),
  args: z.array(z.string()).optional().default([]).describe("命令参数"),
  env: z.record(z.string(), z.string()).optional().describe("环境变量"),
  enabled: z.boolean().default(true).describe("是否启用"),
});

export type MCPClientConfig = z.infer<typeof MCPClientConfigSchema>;

/**
 * MCP客户端状态
 */
export const MCPClientStatusSchema = z.object({
  name: z.string(),
  connected: z.boolean(),
  lastConnected: z.date().nullable(),
  error: z.string().nullable(),
});

export type MCPClientStatus = z.infer<typeof MCPClientStatusSchema>;

/**
 * MCP管理器整体状态
 */
export const MCPManagerStatusSchema = z.object({
  availableClients: z.array(z.string()),
  connectedClients: z.array(z.string()),
  clients: z.array(MCPClientStatusSchema),
});

export type MCPManagerStatus = z.infer<typeof MCPManagerStatusSchema>;

/**
 * AbortSignal 自定义 Schema
 */
const AbortSignalSchema = z.custom<AbortSignal>(
  (v): v is AbortSignal => typeof v === "object" && v !== null && "aborted" in (v as object),
  "Invalid AbortSignal"
);

/**
 * MCP工具执行选项（参考AI SDK的ToolExecutionOptions）
 */
export const MCPToolExecutionOptionsSchema = z.object({
  toolCallId: z.string().optional().describe("工具调用ID"),
  messages: z.array(z.unknown()).optional().describe("消息历史"),
  abortSignal: AbortSignalSchema.optional().describe("中断信号"),
});

export type MCPToolExecutionOptions = z.infer<typeof MCPToolExecutionOptionsSchema>;

/**
 * MCP工具基础Schema
 * 注意：由于Zod v4限制，execute字段使用z.any()，通过TypeScript类型系统提供类型安全
 */
export const MCPToolBaseSchema = z.object({
  name: z.string().describe("工具名称"),
  description: z.string().describe("工具描述"),
  inputSchema: z.record(z.string(), z.unknown()).optional().describe("输入参数schema"),
  outputSchema: z.record(z.string(), z.unknown()).optional().describe("输出结果schema"),
});

/**
 * MCP工具完整Schema
 * execute字段使用自定义验证确保是函数类型
 */
export const MCPToolSchema = MCPToolBaseSchema.extend({
  execute: z
    .unknown()
    .refine((v): v is Function => typeof v === "function", {
      message: "execute必须是一个函数",
    })
    .describe("工具执行函数"),
});

/**
 * MCP工具类型定义
 * 提供精确的TypeScript类型，遵循AI SDK v5的模式
 */
export type MCPTool<TInput = unknown, TOutput = unknown> = z.infer<typeof MCPToolBaseSchema> & {
  execute: (input: TInput, options?: MCPToolExecutionOptions) => Promise<TOutput>;
};

/**
 * 通用MCP工具类型（输入输出类型未知）
 */
export type GenericMCPTool = MCPTool<unknown, unknown>;

/**
 * MCP工具集合
 */
export const MCPToolsSchema = z.record(z.string(), MCPToolSchema);

export type MCPTools = Record<string, GenericMCPTool>;

/**
 * 创建类型安全的MCP工具辅助函数
 * 类似AI SDK的tool()辅助函数，提供更好的类型推导
 */
export function createMCPTool<TInput = unknown, TOutput = unknown>(tool: {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  execute: (input: TInput, options?: MCPToolExecutionOptions) => Promise<TOutput>;
}): MCPTool<TInput, TOutput> {
  // 运行时验证，确保是有效的MCP工具
  MCPToolSchema.parse(tool);
  return tool as MCPTool<TInput, TOutput>;
}

/**
 * 创建动态MCP工具（运行时类型未知）
 * 参考AI SDK的dynamicTool模式
 */
export function createDynamicMCPTool(tool: {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  execute: (input: unknown, options?: MCPToolExecutionOptions) => Promise<unknown>;
}): GenericMCPTool {
  return createMCPTool<unknown, unknown>(tool);
}

/**
 * 类型守卫：检查是否为有效的MCP工具
 */
export function isMCPTool(value: unknown): value is GenericMCPTool {
  return MCPToolSchema.safeParse(value).success;
}

// ========== MCPClientManager 方法参数类型 ==========

/**
 * getMCPClient方法参数
 */
export const GetMCPClientParamsSchema = z.object({
  clientName: z.string(),
});

export type GetMCPClientParams = z.infer<typeof GetMCPClientParamsSchema>;

/**
 * getMCPTools方法参数
 */
export const GetMCPToolsParamsSchema = z.object({
  clientName: z.string(),
  schemas: z.array(z.string()).optional(),
});

export type GetMCPToolsParams = z.infer<typeof GetMCPToolsParamsSchema>;

/**
 * closeMCPClient方法参数
 */
export const CloseMCPClientParamsSchema = z.object({
  clientName: z.string(),
});

export type CloseMCPClientParams = z.infer<typeof CloseMCPClientParamsSchema>;

/**
 * reconnectClient方法参数
 */
export const ReconnectClientParamsSchema = z.object({
  clientName: z.string(),
});

export type ReconnectClientParams = z.infer<typeof ReconnectClientParamsSchema>;

/**
 * isClientConnected方法参数
 */
export const IsClientConnectedParamsSchema = z.object({
  clientName: z.string(),
});

export type IsClientConnectedParams = z.infer<typeof IsClientConnectedParamsSchema>;

// ========== AI SDK Tool 相关类型 ==========

/**
 * AI SDK工具结果内容
 */
export const ToolResultContentSchema = z.array(
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("text"),
      text: z.string(),
    }),
    z.object({
      type: z.literal("image"),
      data: z.string(),
      mimeType: z.string(),
    }),
  ])
);

export type ToolResultContent = z.infer<typeof ToolResultContentSchema>;

/**
 * 验证MCP客户端配置
 */
export function validateMCPClientConfig(config: unknown): MCPClientConfig {
  return MCPClientConfigSchema.parse(config);
}

// ========== Playwright MCP 类型定义 ==========

/**
 * Playwright Tab 信息
 */
export const PlaywrightTabInfoSchema = z.object({
  index: z.number().describe("标签页索引"),
  url: z.string().describe("标签页 URL"),
  title: z.string().describe("标签页标题"),
  active: z.boolean().optional().describe("是否为当前激活的标签页"),
});

export type PlaywrightTabInfo = z.infer<typeof PlaywrightTabInfoSchema>;

/**
 * Playwright MCP 工具名称
 */
export const PlaywrightMCPToolNamesSchema = z.enum([
  "browser_tabs",
  "browser_navigate",
  "browser_click",
  "browser_type",
  "browser_evaluate",
  "browser_snapshot",
  "browser_take_screenshot",
  "browser_select_option",
  "browser_hover",
  "browser_press_key",
  "browser_handle_dialog",
  "browser_file_upload",
  "browser_navigate_back",
  "browser_navigate_forward",
  "browser_wait_for",
]);

export type PlaywrightMCPToolNames = z.infer<typeof PlaywrightMCPToolNamesSchema>;

/**
 * Playwright MCP 客户端接口定义
 */
export interface PlaywrightMCPClient {
  /**
   * 获取客户端可用的工具集合
   */
  tools(): Promise<{
    // Tab 管理
    browser_tabs?: {
      execute(params: {
        action: "list" | "select" | "close" | "new";
        index?: number;
        url?: string;
      }): Promise<unknown>;
    };

    // 脚本执行 (注意: Playwright MCP 使用 "function" 参数名)
    browser_evaluate?: {
      execute(params: { function: string }): Promise<unknown>;
    };

    // 导航
    browser_navigate?: {
      execute(params: { url: string }): Promise<unknown>;
    };

    // 点击（基于 accessibility ref）
    browser_click?: {
      execute(params: {
        element: string;
        ref: string;
        doubleClick?: boolean;
      }): Promise<unknown>;
    };

    // 输入文本
    browser_type?: {
      execute(params: {
        element: string;
        ref: string;
        text: string;
        submit?: boolean;
        slowly?: boolean;
      }): Promise<unknown>;
    };

    // 截图
    browser_take_screenshot?: {
      execute(params?: { filename?: string }): Promise<unknown>;
    };

    // 页面快照（accessibility tree）
    browser_snapshot?: {
      execute(params?: Record<string, never>): Promise<unknown>;
    };

    // 选择下拉选项
    browser_select_option?: {
      execute(params: {
        element: string;
        ref: string;
        value?: string;
        label?: string;
      }): Promise<unknown>;
    };

    // 悬停
    browser_hover?: {
      execute(params: { element: string; ref: string }): Promise<unknown>;
    };

    // 按键
    browser_press_key?: {
      execute(params: { key: string }): Promise<unknown>;
    };

    // 处理对话框
    browser_handle_dialog?: {
      execute(params: { accept: boolean; text?: string }): Promise<unknown>;
    };

    // 等待
    browser_wait_for?: {
      execute(params: {
        selector?: string;
        url?: string;
        timeout?: number;
      }): Promise<unknown>;
    };

    [key: string]: unknown;
  }>;
}
