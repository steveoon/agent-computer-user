/* eslint-disable @typescript-eslint/no-explicit-any */
import { EventEmitter } from "events";
import { experimental_createMCPClient as createMCPClient } from "@ai-sdk/mcp";
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

  // 工具缓存 - 减少 client.tools() 调用频率
  private readonly toolsCache = new Map<
    string,
    {
      tools: MCPTools;
      timestamp: number;
    }
  >();

  // 缓存和重连配置
  private static readonly TOOLS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟
  private static readonly MAX_RECONNECT_ATTEMPTS = 2;
  private static readonly RECONNECT_DELAY_MS = 1000;

  private constructor() {
    // 私有构造函数，防止外部直接实例化
    this.initializeClientConfigs();

    // 添加进程退出时的资源清理
    // 注意：不使用 beforeExit 事件，因为它在 standalone 模式下可能会在事件循环
    // 暂时空闲时被错误触发，导致 MCP 客户端被过早清理
    // 只在收到明确的终止信号时清理资源

    process.on("SIGINT", async () => {
      await this.cleanupAllResources();
      // 不要调用 process.exit()，让 Node.js 自然退出以确保清理完成
    });

    process.on("SIGTERM", async () => {
      await this.cleanupAllResources();
      // 不要调用 process.exit()，让 Node.js 自然退出以确保清理完成
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
   *
   * 环境变量：
   * - CHROME_REMOTE_DEBUGGING_PORT: Chrome 远程调试端口（设置后启用 CDP 模式）
   * - CHROME_HOST: Chrome 所在主机（默认 localhost，Docker 部署时设为 host.docker.internal）
   */
  private getPlaywrightArgs(): { args: string[]; mode: string } {
    const chromePort = process.env.CHROME_REMOTE_DEBUGGING_PORT;
    const chromeHost = process.env.CHROME_HOST || "localhost";

    if (chromePort) {
      const cdpEndpoint = `http://${chromeHost}:${chromePort}`;
      return {
        args: [
          "-y",
          "@playwright/mcp@latest",
          "--cdp-endpoint",
          cdpEndpoint,
          "--image-responses=allow",
        ],
        mode: `CDP (${cdpEndpoint})`,
      };
    }

    return {
      args: ["-y", "@playwright/mcp@latest", "--extension", "--image-responses=allow"],
      mode: "Extension",
    };
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 检查工具缓存是否有效
   */
  private isCacheValid(clientName: string): boolean {
    const cached = this.toolsCache.get(clientName);
    if (!cached) return false;

    const now = Date.now();
    const isExpired = now - cached.timestamp > MCPClientManager.TOOLS_CACHE_TTL_MS;
    return !isExpired;
  }

  /**
   * 清除指定客户端的工具缓存
   */
  private invalidateToolsCache(clientName: string): void {
    if (this.toolsCache.has(clientName)) {
      this.toolsCache.delete(clientName);
      console.log(`🗑️ 已清除 ${clientName} 工具缓存`);
    }
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
   *
   * 功能特性：
   * - 🗃️ 工具缓存 - 减少 client.tools() 调用频率
   * - 🔄 自动重连 - 检测 "closed client" 错误并自动重连
   *
   * @param clientName 客户端名称
   * @param schemas 可选的schema配置
   * @returns 工具对象
   */
  public async getMCPTools(clientName: string, schemas?: Record<string, any>): Promise<MCPTools> {
    // 检查缓存（仅在无 schemas 参数时使用缓存）
    if (!schemas && this.isCacheValid(clientName)) {
      const cached = this.toolsCache.get(clientName);
      if (cached) {
        console.log(`📦 使用缓存的 ${clientName} 工具 (${Object.keys(cached.tools).length} 个)`);
        return cached.tools;
      }
    }

    let attempts = 0;

    while (attempts <= MCPClientManager.MAX_RECONNECT_ATTEMPTS) {
      try {
        const client = await this.getMCPClient(clientName);
        const tools = schemas ? await client.tools({ schemas }) : await client.tools();
        const config = this.clientConfigs.get(clientName);
        console.log(`🔧 已获取 ${config?.description} 工具: ${Object.keys(tools).join(", ")}`);

        // 更新缓存（仅在无 schemas 参数时缓存）
        if (!schemas) {
          this.toolsCache.set(clientName, {
            tools,
            timestamp: Date.now(),
          });
        }

        return tools;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isClosedClientError =
          errorMessage.includes("closed client") || errorMessage.includes("MCPClientError");

        if (isClosedClientError && attempts < MCPClientManager.MAX_RECONNECT_ATTEMPTS) {
          attempts++;
          console.warn(
            `⚠️ MCP 客户端已断开，正在重连 (${attempts}/${MCPClientManager.MAX_RECONNECT_ATTEMPTS})...`
          );

          // 清除缓存
          this.invalidateToolsCache(clientName);

          // 等待后重连
          await this.delay(MCPClientManager.RECONNECT_DELAY_MS);
          try {
            await this.reconnectClient(clientName);
          } catch (reconnectError) {
            console.warn(`⚠️ ${clientName} 重连失败:`, reconnectError);
          }
          continue;
        }

        const config = this.clientConfigs.get(clientName);
        console.error(
          `❌ 获取 ${config?.description} 工具失败 (尝试 ${attempts + 1} 次后):`,
          error
        );
        return {};
      }
    }

    return {};
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
        // 确保关闭时不再使用过期工具缓存
        this.invalidateToolsCache(clientName);
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

    // 重连前清除工具缓存
    this.invalidateToolsCache(clientName);

    await this.closeMCPClient(clientName);
    return this.getMCPClient(clientName);
  }

  /**
   * 强制刷新工具缓存
   * @param clientName 客户端名称
   * @param schemas 可选的 schema 配置
   */
  public async refreshToolsCache(
    clientName: string,
    schemas?: Record<string, any>
  ): Promise<MCPTools> {
    this.invalidateToolsCache(clientName);
    return this.getMCPTools(clientName, schemas);
  }

  /**
   * 清除所有工具缓存
   */
  public clearAllToolsCache(): void {
    this.toolsCache.clear();
    console.log("🗑️ 已清除所有工具缓存");
  }

  /**
   * 获取缓存统计信息（用于调试）
   */
  public getToolsCacheStats(): Record<string, { age: number; toolCount: number }> {
    const now = Date.now();
    const stats: Record<string, { age: number; toolCount: number }> = {};

    this.toolsCache.forEach((value, key) => {
      stats[key] = {
        age: Math.round((now - value.timestamp) / 1000), // 秒
        toolCount: Object.keys(value.tools).length,
      };
    });

    return stats;
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

// 缓存管理函数
export const refreshToolsCache = (clientName: string, schemas?: Record<string, any>) =>
  mcpClientManager.refreshToolsCache(clientName, schemas);
export const clearAllToolsCache = () => mcpClientManager.clearAllToolsCache();
export const getToolsCacheStats = () => mcpClientManager.getToolsCacheStats();
