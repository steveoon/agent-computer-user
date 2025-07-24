import { z } from "zod";

// ========== Puppeteer MCP 操作类型定义 ==========

/**
 * Puppeteer支持的操作类型
 */
export const PuppeteerActionSchema = z.enum([
  "connect_active_tab",
  "navigate",
  "screenshot",
  "click",
  "fill",
  "select",
  "hover",
  "evaluate",
]);

export type PuppeteerAction = z.infer<typeof PuppeteerActionSchema>;

/**
 * Puppeteer连接参数
 */
export const PuppeteerConnectParamsSchema = z.object({
  targetUrl: z.string().optional().describe("目标标签页URL"),
  debugPort: z.number().optional().default(9222).describe("Chrome远程调试端口"),
});

export type PuppeteerConnectParams = z.infer<typeof PuppeteerConnectParamsSchema>;

/**
 * Puppeteer导航参数
 */
export const PuppeteerNavigateParamsSchema = z.object({
  url: z.string().describe("要导航到的URL"),
});

export type PuppeteerNavigateParams = z.infer<typeof PuppeteerNavigateParamsSchema>;

/**
 * Puppeteer截图参数
 */
export const PuppeteerScreenshotParamsSchema = z.object({
  name: z.string().describe("截图名称"),
  selector: z.string().optional().describe("CSS选择器"),
  width: z.number().optional().default(800).describe("视口宽度"),
  height: z.number().optional().default(600).describe("视口高度"),
});

export type PuppeteerScreenshotParams = z.infer<typeof PuppeteerScreenshotParamsSchema>;

/**
 * Puppeteer交互参数
 */
export const PuppeteerInteractionParamsSchema = z.object({
  selector: z.string().describe("CSS选择器"),
  value: z.string().optional().describe("输入值或选择值"),
});

export type PuppeteerInteractionParams = z.infer<typeof PuppeteerInteractionParamsSchema>;

/**
 * Puppeteer脚本执行参数
 */
export const PuppeteerEvaluateParamsSchema = z.object({
  script: z.string().describe("要执行的JavaScript代码"),
});

export type PuppeteerEvaluateParams = z.infer<typeof PuppeteerEvaluateParamsSchema>;

/**
 * Puppeteer统一参数（用于AI SDK工具）
 */
export const PuppeteerParamsSchema = z.object({
  action: PuppeteerActionSchema,
  targetUrl: z.string().optional().describe("目标标签页URL"),
  debugPort: z.number().optional().describe("Chrome远程调试端口"),
  url: z.string().optional().describe("要导航到的URL"),
  name: z.string().optional().describe("截图名称"),
  selector: z.string().optional().describe("CSS选择器"),
  width: z.number().optional().describe("视口宽度"),
  height: z.number().optional().describe("视口高度"),
  value: z.string().optional().describe("输入值"),
  script: z.string().optional().describe("JavaScript代码"),
});

export type PuppeteerParams = z.infer<typeof PuppeteerParamsSchema>;

/**
 * Puppeteer结果类型
 */
export const PuppeteerResultSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("image"),
    data: z.string().describe("Base64编码的图片数据"),
  }),
]);

export type PuppeteerResult = z.infer<typeof PuppeteerResultSchema>;

// ========== MCP 客户端管理器类型定义 ==========

/**
 * MCP客户端配置
 */
export const MCPClientConfigSchema = z.object({
  name: z.string().describe("客户端名称"),
  description: z.string().describe("客户端描述"),
  command: z.string().describe("启动命令"),
  args: z.array(z.string()).optional().default([]).describe("命令参数"),
  env: z.record(z.string()).optional().describe("环境变量"),
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
 * MCP工具定义
 */
export const MCPToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: z.record(z.any()).optional(),
  execute: z.function().args(z.any()).returns(z.promise(z.any())),
});

export type MCPTool = z.infer<typeof MCPToolSchema>;

/**
 * MCP工具集合
 */
export const MCPToolsSchema = z.record(MCPToolSchema);

export type MCPTools = z.infer<typeof MCPToolsSchema>;

/**
 * MCP客户端接口定义
 * 用于与MCP服务交互的客户端类型
 */
export interface MCPClient {
  /**
   * 获取客户端可用的工具集合
   * @returns 包含工具名称和执行方法的对象
   */
  tools(): Promise<{
    puppeteer_evaluate?: {
      execute(params: { script: string }): Promise<unknown>;
    };
    puppeteer_click?: {
      execute(params: { selector: string }): Promise<unknown>;
    };
    puppeteer_fill?: {
      execute(params: { selector: string; value: string }): Promise<unknown>;
    };
    puppeteer_key?: {
      execute(params: { key: string }): Promise<unknown>;
    };
    [key: string]: unknown;
  }>;
}

// ========== Puppeteer MCP 服务接口类型 ==========

/**
 * Puppeteer MCP服务提供的工具名称
 */
export const PuppeteerMCPToolNamesSchema = z.enum([
  "puppeteer_connect_active_tab",
  "puppeteer_navigate",
  "puppeteer_screenshot",
  "puppeteer_click",
  "puppeteer_fill",
  "puppeteer_select",
  "puppeteer_hover",
  "puppeteer_evaluate",
]);

export type PuppeteerMCPToolNames = z.infer<typeof PuppeteerMCPToolNamesSchema>;

/**
 * Puppeteer MCP工具执行结果
 */
export const PuppeteerMCPResultSchema = z.object({
  content: z.array(
    z.discriminatedUnion("type", [
      z.object({
        type: z.literal("text"),
        text: z.string(),
      }),
      z.object({
        type: z.literal("image"),
        data: z.string(),
        mimeType: z.string().optional(),
      }),
    ])
  ),
});

export type PuppeteerMCPResult = z.infer<typeof PuppeteerMCPResultSchema>;

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
 * Puppeteer工具完整参数（用于AI SDK tool） - 与PuppeteerParamsSchema相同
 */
export const PuppeteerToolParamsSchema = PuppeteerParamsSchema;

export type PuppeteerToolParams = PuppeteerParams;

// ========== 类型守卫 ==========

/**
 * 检查是否为Puppeteer文本结果
 */
export function isPuppeteerTextResult(result: unknown): result is { type: "text"; text: string } {
  return PuppeteerResultSchema.safeParse(result).success && (result as any).type === "text";
}

/**
 * 检查是否为Puppeteer图片结果
 */
export function isPuppeteerImageResult(result: unknown): result is { type: "image"; data: string } {
  return PuppeteerResultSchema.safeParse(result).success && (result as any).type === "image";
}

/**
 * 验证Puppeteer参数
 */
export function validatePuppeteerParams(params: unknown): PuppeteerParams {
  return PuppeteerParamsSchema.parse(params);
}

/**
 * 验证MCP客户端配置
 */
export function validateMCPClientConfig(config: unknown): MCPClientConfig {
  return MCPClientConfigSchema.parse(config);
}
