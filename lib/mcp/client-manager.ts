/* eslint-disable @typescript-eslint/no-explicit-any */
import { EventEmitter } from "events";
import { createMCPClient } from "@ai-sdk/mcp";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  MCPClientConfig,
  MCPManagerStatus,
  MCPClientStatus,
  MCPTools,
  MCPClient,
  validateMCPClientConfig,
} from "@/types/mcp";

// 增加最大监听器数量，避免警告
EventEmitter.defaultMaxListeners = 20;

/**
 * 通用MCP客户端管理器
 *
 * 功能特性：
 * - 🔄 单例模式 - 避免重复连接，优化资源使用
 * - 🧹 自动清理 - 进程退出时自动关闭所有连接
 * - 🔧 统一管理 - 集中管理多种MCP和API客户端
 * - ⚡ 按需连接 - 客户端懒加载，提升启动性能
 * - 🛡️ 错误恢复 - 完善的错误处理和重连机制
 */
class MCPClientManager {
  private static instance: MCPClientManager;
  private readonly mcpClients = new Map<string, any>();
  private readonly clientConfigs = new Map<string, MCPClientConfig>();

  private constructor() {
    // 私有构造函数，防止外部直接实例化
    this.initializeClientConfigs();

    // 添加进程退出时的资源清理
    process.on("beforeExit", async () => {
      await this.cleanupAllResources();
    });

    process.on("SIGINT", async () => {
      await this.cleanupAllResources();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      await this.cleanupAllResources();
      process.exit(0);
    });
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): MCPClientManager {
    if (!MCPClientManager.instance) {
      MCPClientManager.instance = new MCPClientManager();
    }
    return MCPClientManager.instance;
  }

  /**
   * 初始化客户端配置
   */
  private initializeClientConfigs(): void {
    // Playwright MCP 配置（默认）
    //
    // 支持两种连接模式：
    // 1. CDP 模式 (多 Agent 场景) - 当 CHROME_REMOTE_DEBUGGING_PORT 设置时自动启用
    //    - 参数: --cdp-endpoint http://localhost:PORT
    //    - 适用: multi-agent.sh 启动的多 Agent 实例
    //    - 优势: 每个 Agent 连接独立的 Chrome 实例，无冲突，无需安装浏览器插件
    //
    // 2. Extension 模式 (单 Agent 开发) - 当 CHROME_REMOTE_DEBUGGING_PORT 未设置时
    //    - 参数: --extension
    //    - 适用: 本地开发，手动选择要控制的 Tab
    //    - 限制: 同一浏览器只能有一个 MCP 连接，需要安装 Playwright MCP Bridge 插件
    //
    // 如需使用 Puppeteer MCP，设置 USE_PUPPETEER_MCP=true
    //
    // Playwright MCP 配置使用动态参数生成器
    // 实际参数在 getMCPClient 时根据当时的环境变量决定
    // 这样支持运行时动态切换 CDP/Extension 模式
    const playwrightConfig = validateMCPClientConfig({
      name: "playwright",
      command: "npx",
      args: [], // 占位，实际参数在 getMCPClient 中动态生成
      env: {
        NODE_ENV: process.env.NODE_ENV || "production",
      },
      description: "Playwright 浏览器自动化服务",
      enabled: true,
    });
    this.clientConfigs.set("playwright", playwrightConfig);

    // 保留原有的 Puppeteer MCP 配置（用于兼容性）
    const puppeteerConfig = validateMCPClientConfig({
      name: "puppeteer",
      command: "npx",
      args: ["-y", "puppeteer-mcp-server"],
      env: {
        NODE_ENV: process.env.NODE_ENV || "production",
        LOG_LEVEL: "error",
        // 尝试禁用文件日志记录
        NO_FILE_LOGGING: "true",
      },
      description: "Puppeteer浏览器自动化服务",
      enabled: true,
    });
    this.clientConfigs.set("puppeteer", puppeteerConfig);

    // 高德地图 MCP 配置 - 用于地理编码和距离计算
    const amapConfig = validateMCPClientConfig({
      name: "amap",
      command: "npx",
      args: ["-y", "@amap/amap-maps-mcp-server"],
      env: {
        AMAP_MAPS_API_KEY: process.env.AMAP_MAPS_API_KEY || "",
      },
      description: "高德地图 MCP 服务",
      enabled: true,
    });
    this.clientConfigs.set("amap", amapConfig);
  }

  /**
   * 动态生成 Playwright MCP 参数
   * 根据运行时环境变量决定使用 CDP 或 Extension 模式
   */
  private getPlaywrightArgs(): { args: string[]; mode: string } {
    const chromePort = process.env.CHROME_REMOTE_DEBUGGING_PORT;

    if (chromePort) {
      return {
        args: ["-y", "@playwright/mcp@latest", "--cdp-endpoint", `http://localhost:${chromePort}`, "--image-responses=allow"],
        mode: `CDP (port: ${chromePort})`,
      };
    }

    return {
      args: ["-y", "@playwright/mcp@latest", "--extension", "--image-responses=allow"],
      mode: "Extension",
    };
  }

  /**
   * 获取MCP客户端
   * @param clientName 客户端名称
   * @returns MCP客户端实例
   */
  public async getMCPClient(clientName: string): Promise<any> {
    // 如果客户端已存在，直接返回
    if (this.mcpClients.has(clientName)) {
      return this.mcpClients.get(clientName);
    }

    // 获取客户端配置
    const config = this.clientConfigs.get(clientName);
    if (!config) {
      throw new Error(`未知的MCP客户端: ${clientName}`);
    }

    // Playwright 使用动态参数
    let args = config.args;
    let description = config.description;

    if (clientName === "playwright") {
      const playwrightConfig = this.getPlaywrightArgs();
      args = playwrightConfig.args;
      description = `Playwright 浏览器自动化服务（${playwrightConfig.mode} 模式）`;
      console.log(`🎭 Playwright MCP 模式: ${playwrightConfig.mode}`);
    }

    console.log(`🚀 正在初始化 ${description} (${clientName})...`);

    try {
      // 过滤掉空的环境变量
      const filteredEnv = config.env
        ? Object.entries(config.env).reduce(
            (acc, [key, value]) => {
              if (value) {
                acc[key] = value;
              }
              return acc;
            },
            {} as Record<string, string>
          )
        : {};

      // 创建传输层
      const transport = new StdioClientTransport({
        command: config.command,
        args: args,
        env: filteredEnv,
      });

      // 创建MCP客户端
      const client = await createMCPClient({
        transport,
      });

      // 缓存客户端
      this.mcpClients.set(clientName, client);
      console.log(`✅ ${description} 初始化成功`);

      return client;
    } catch (error) {
      console.error(`❌ ${description} 初始化失败:`, error);
      throw error;
    }
  }

  /**
   * 获取MCP客户端工具
   * @param clientName 客户端名称
   * @param schemas 可选的schema配置
   * @returns 工具对象
   */
  public async getMCPTools(clientName: string, schemas?: Record<string, any>): Promise<MCPTools> {
    const client = await this.getMCPClient(clientName);

    try {
      const tools = schemas ? await client.tools({ schemas }) : await client.tools();
      const config = this.clientConfigs.get(clientName);
      console.log(`🔧 已获取 ${config?.description} 工具: ${Object.keys(tools).join(", ")}`);
      return tools;
    } catch (error) {
      console.error(`❌ 获取 ${clientName} 工具失败:`, error);
      return {};
    }
  }

  /**
   * Puppeteer MCP 客户端
   */
  public async getPuppeteerMCPClient(): Promise<MCPClient> {
    return this.getMCPClient("puppeteer") as Promise<MCPClient>;
  }

  /**
   * Puppeteer MCP 工具
   */
  public async getPuppeteerMCPTools(): Promise<MCPTools> {
    return this.getMCPTools("puppeteer");
  }

  /**
   * Playwright MCP 客户端
   */
  public async getPlaywrightMCPClient(): Promise<any> {
    return this.getMCPClient("playwright");
  }

  /**
   * Playwright MCP 工具
   */
  public async getPlaywrightMCPTools(): Promise<MCPTools> {
    return this.getMCPTools("playwright");
  }

  /**
   * 高德地图 MCP 客户端
   */
  public async getAmapMCPClient(): Promise<MCPClient> {
    return this.getMCPClient("amap") as Promise<MCPClient>;
  }

  /**
   * 高德地图 MCP 工具
   */
  public async getAmapMCPTools(): Promise<MCPTools> {
    return this.getMCPTools("amap");
  }

  /**
   * 关闭指定的MCP客户端
   * @param clientName 客户端名称
   */
  public async closeMCPClient(clientName: string): Promise<void> {
    if (this.mcpClients.has(clientName)) {
      const client = this.mcpClients.get(clientName);
      const config = this.clientConfigs.get(clientName);

      try {
        if (client.close) {
          await client.close();
        }
        this.mcpClients.delete(clientName);
        console.log(`🔒 ${config?.description} 客户端已关闭`);
      } catch (error) {
        console.error(`❌ 关闭 ${config?.description} 客户端出错:`, error);
      }
    }
  }

  /**
   * 检查客户端是否已连接
   * @param clientName 客户端名称
   * @returns 是否已连接
   */
  public isClientConnected(clientName: string): boolean {
    return this.mcpClients.has(clientName);
  }

  /**
   * 获取所有已连接的客户端列表
   * @returns 客户端名称列表
   */
  public getConnectedClients(): string[] {
    return Array.from(this.mcpClients.keys());
  }

  /**
   * 获取所有可用的客户端配置
   * @returns 配置映射
   */
  public getAvailableClients(): ReadonlyMap<string, MCPClientConfig> {
    return this.clientConfigs;
  }

  /**
   * 清理所有资源
   */
  private async cleanupAllResources(): Promise<void> {
    console.log("🧹 开始清理MCP客户端资源...");

    const closePromises = Array.from(this.mcpClients.keys()).map(clientName =>
      this.closeMCPClient(clientName)
    );

    await Promise.allSettled(closePromises);
    console.log("✅ MCP客户端资源清理完成");
  }

  /**
   * 重连指定客户端
   * @param clientName 客户端名称
   */
  public async reconnectClient(clientName: string): Promise<any> {
    console.log(`🔄 重连 ${clientName} 客户端...`);
    await this.closeMCPClient(clientName);
    return this.getMCPClient(clientName);
  }

  /**
   * 获取客户端状态信息
   * @returns 状态信息对象
   */
  public getStatus(): MCPManagerStatus {
    const connectedClients = this.getConnectedClients();
    const availableClients = Array.from(this.clientConfigs.keys());

    // 构建客户端状态列表
    const clients: MCPClientStatus[] = availableClients.map(name => ({
      name,
      connected: connectedClients.includes(name),
      lastConnected: null, // TODO: 添加实际的连接时间追踪
      error: null, // TODO: 添加实际的错误状态追踪
    }));

    return {
      availableClients,
      connectedClients,
      clients,
    };
  }
}

// 导出单例实例和快捷访问函数
const mcpClientManager = MCPClientManager.getInstance();

export default mcpClientManager;

// 快捷访问函数
export const getPuppeteerMCPClient = () => mcpClientManager.getPuppeteerMCPClient();
export const getPuppeteerMCPTools = () => mcpClientManager.getPuppeteerMCPTools();

export const getPlaywrightMCPClient = () => mcpClientManager.getPlaywrightMCPClient();
export const getPlaywrightMCPTools = () => mcpClientManager.getPlaywrightMCPTools();

export const getAmapMCPClient = () => mcpClientManager.getAmapMCPClient();
export const getAmapMCPTools = () => mcpClientManager.getAmapMCPTools();

// 客户端管理函数
export const closeMCPClient = (clientName: string) => mcpClientManager.closeMCPClient(clientName);
export const reconnectMCPClient = (clientName: string) =>
  mcpClientManager.reconnectClient(clientName);
export const getMCPStatus = () => mcpClientManager.getStatus();
