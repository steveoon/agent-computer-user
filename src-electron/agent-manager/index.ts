import fs from "fs";
import path from "path";
import { EventEmitter } from "events";
import type {
  AgentConfig,
  AgentInfo,
  AgentManagerOptions,
  AgentRuntimeStatus,
  AgentStatus,
  AgentTemplate,
  AddAgentOptions,
  ConfigFile,
  Settings,
  TemplatesFile,
} from "./types";
import {
  AgentConfigSchema,
  ConfigFileSchema,
  createDefaultConfig,
  DEFAULT_TEMPLATES,
  TemplatesFileSchema,
  TIMEOUTS,
} from "./types";
import { ChromeLauncher } from "./chrome-launcher";
import { AppLauncher } from "./app-launcher";
import { RuntimeManager, getRuntimeManager } from "./runtime-manager";
import { portManager } from "./port-manager";

/**
 * Agent Manager - Core orchestration class
 * Manages agent lifecycle, configuration, and runtime status
 */
export class AgentManager extends EventEmitter {
  private configPath: string;
  private logsPath: string;
  private pidsPath: string;
  private templatesPath?: string;

  private config: ConfigFile | null = null;
  private templates: TemplatesFile = DEFAULT_TEMPLATES;
  private chromeLauncher: ChromeLauncher | null = null;
  private appLauncher: AppLauncher | null = null;
  private runtimeManager: RuntimeManager;

  // Runtime status tracking
  private runtimeStatus: Map<string, AgentRuntimeStatus> = new Map();
  private operationLocks: Set<string> = new Set();
  // 过渡状态单独管理，避免与 runtimeStatus 中的健康检查状态冲突
  private transitionStates: Map<string, "starting" | "stopping"> = new Map();

  constructor(options: AgentManagerOptions) {
    super();
    this.configPath = options.configPath;
    this.logsPath = options.logsPath;
    this.pidsPath = options.pidsPath;
    this.templatesPath = options.templatesPath;
    this.runtimeManager = getRuntimeManager();
  }

  /**
   * Initialize the agent manager
   * Loads configuration and templates
   */
  async initialize(): Promise<void> {
    // Ensure directories exist
    this.ensureDirectories();

    // Load or create configuration
    await this.loadConfig();

    // Load templates
    await this.loadTemplates();

    // Initialize Chrome launcher and App launcher
    if (this.config) {
      this.chromeLauncher = new ChromeLauncher(this.config.settings, this.logsPath);
      this.appLauncher = new AppLauncher(this.logsPath);
    }

    // Probe existing agents for runtime status
    await this.probeAllAgents();
  }

  /**
   * Ensure required directories exist
   */
  private ensureDirectories(): void {
    const dirs = [
      path.dirname(this.configPath),
      this.logsPath,
      this.pidsPath,
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Load configuration from file or create default
   */
  private async loadConfig(): Promise<void> {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, "utf-8");
        const parsed = JSON.parse(content);
        this.config = ConfigFileSchema.parse(parsed);
      } else {
        // Create default config
        const basePath = path.dirname(this.configPath);
        this.config = createDefaultConfig(basePath);
        await this.saveConfig();
      }
    } catch (error) {
      console.error("Failed to load config:", error);
      // Create default config on error
      const basePath = path.dirname(this.configPath);
      this.config = createDefaultConfig(basePath);
      await this.saveConfig();
    }
  }

  /**
   * Save configuration to file
   */
  private async saveConfig(): Promise<void> {
    if (!this.config) return;

    try {
      const content = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configPath, content, "utf-8");
    } catch (error) {
      console.error("Failed to save config:", error);
      throw error;
    }
  }

  /**
   * Load agent templates
   */
  private async loadTemplates(): Promise<void> {
    if (!this.templatesPath || !fs.existsSync(this.templatesPath)) {
      this.templates = DEFAULT_TEMPLATES;
      return;
    }

    try {
      const content = fs.readFileSync(this.templatesPath, "utf-8");
      const parsed = JSON.parse(content);
      this.templates = TemplatesFileSchema.parse(parsed);
    } catch (error) {
      console.error("Failed to load templates:", error);
      this.templates = DEFAULT_TEMPLATES;
    }
  }

  /**
   * Get all agent templates
   */
  getTemplates(): Record<string, AgentTemplate> {
    return this.templates.templates;
  }

  /**
   * Get current settings
   */
  getSettings(): Settings | null {
    return this.config?.settings ?? null;
  }

  /**
   * Update settings
   */
  async updateSettings(settings: Partial<Settings>): Promise<void> {
    if (!this.config) return;

    this.config.settings = { ...this.config.settings, ...settings };
    await this.saveConfig();

    // Reinitialize Chrome launcher with new settings
    this.chromeLauncher = new ChromeLauncher(this.config.settings, this.logsPath);
  }

  /**
   * List all agents with their status
   */
  async listAgents(): Promise<AgentInfo[]> {
    if (!this.config) return [];

    const agents: AgentInfo[] = [];

    for (const agent of this.config.agents) {
      const status = await this.getAgentStatus(agent.id);
      agents.push({
        ...agent,
        status,
      });
    }

    return agents;
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): AgentConfig | null {
    return this.config?.agents.find((a) => a.id === agentId) ?? null;
  }

  /**
   * Clean up stale Chrome profile lock files for an agent
   */
  async cleanupProfileLocks(agentId: string) {
    if (!this.config || !this.chromeLauncher) {
      throw new Error("Agent manager not initialized");
    }

    const agent = this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    return this.chromeLauncher.cleanupProfileLocks(agent.userDataDir);
  }

  /**
   * Add new agent(s)
   */
  async addAgents(type: string, options: AddAgentOptions = {}): Promise<AgentInfo[]> {
    if (!this.config) {
      throw new Error("Agent manager not initialized");
    }

    const template = this.templates.templates[type];
    if (!template) {
      throw new Error(`Unknown agent type: ${type}. Available types: ${Object.keys(this.templates.templates).join(", ")}`);
    }

    const count = options.count ?? 1;
    const addedAgents: AgentInfo[] = [];

    for (let i = 0; i < count; i++) {
      // Generate unique ID
      const agentId = options.id && count === 1
        ? options.id
        : this.generateAgentId(type);

      // Check if ID already exists
      if (this.config.agents.some((a) => a.id === agentId)) {
        throw new Error(`Agent ID already exists: ${agentId}`);
      }

      // Allocate ports
      const { appPort, chromePort } = await portManager.allocatePorts(
        this.config.agents,
        this.config.settings
      );

      // Create user data directory path
      const userDataDir = path.join(
        this.config.settings.userDataDirBase,
        agentId
      );

      // Create agent config
      const agentConfig: AgentConfig = {
        id: agentId,
        type,
        name: `${template.name} #${this.getNextAgentNumber(type)}`,
        description: template.description,
        appPort,
        chromePort,
        userDataDir,
        chromeArgs: template.chromeArgs,
        env: template.env,
        createdAt: new Date().toISOString(),
      };

      // Validate
      AgentConfigSchema.parse(agentConfig);

      // Add to config
      this.config.agents.push(agentConfig);

      // Initialize runtime status
      this.runtimeStatus.set(agentId, {
        id: agentId,
        isRunning: false,
        appHealthy: false,
        chromeHealthy: false,
      });

      addedAgents.push({
        ...agentConfig,
        status: "stopped",
      });
    }

    // Save configuration
    await this.saveConfig();

    // Emit event
    this.emit("agents:added", addedAgents);

    return addedAgents;
  }

  /**
   * Remove an agent
   */
  async removeAgent(agentId: string): Promise<void> {
    if (!this.config) {
      throw new Error("Agent manager not initialized");
    }

    const agent = this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // Stop agent if running
    const status = await this.getAgentStatus(agentId);
    if (status === "running" || status === "starting") {
      await this.stopAgent(agentId);
    }

    // Remove from config
    this.config.agents = this.config.agents.filter((a) => a.id !== agentId);

    // Clean up runtime status
    this.runtimeStatus.delete(agentId);

    // Save configuration
    await this.saveConfig();

    // Emit event
    this.emit("agent:removed", agentId);
  }

  /**
   * Start an agent (or all agents)
   */
  async startAgent(agentId?: string): Promise<void> {
    if (!this.config || !this.chromeLauncher) {
      throw new Error("Agent manager not initialized");
    }

    const agentsToStart = agentId
      ? [this.getAgent(agentId)].filter(Boolean) as AgentConfig[]
      : this.config.agents;

    if (agentsToStart.length === 0) {
      throw new Error(agentId ? `Agent not found: ${agentId}` : "No agents configured");
    }

    for (const agent of agentsToStart) {
      await this.startSingleAgent(agent);
    }
  }

  /**
   * Start a single agent
   * Launches both Chrome and Next.js application processes
   */
  private async startSingleAgent(agent: AgentConfig): Promise<void> {
    const { id } = agent;

    // Check if operation is in progress
    if (this.operationLocks.has(id)) {
      throw new Error(`Operation in progress for agent: ${id}`);
    }

    // Check current status
    const currentStatus = await this.getAgentStatus(id);
    if (currentStatus === "running") {
      return; // Already running
    }

    this.operationLocks.add(id);
    this.updateStatus(id, "starting");

    let chromePid: number | undefined;
    let appPid: number | undefined;

    try {
      // Step 1: Prepare runtime directory for the agent
      console.log(`[AgentManager] Preparing runtime for agent ${id}...`);
      const runtimeDir = await this.runtimeManager.prepareRuntime(id);
      console.log(`[AgentManager] Runtime prepared at: ${runtimeDir}`);

      // Step 2: Launch Chrome
      console.log(`[AgentManager] Launching Chrome for agent ${id}...`);
      const chromeResult = await this.chromeLauncher!.launch(agent);

      if (!chromeResult.success) {
        throw new Error(`Chrome 启动失败: ${chromeResult.error}`);
      }
      chromePid = chromeResult.pid;
      console.log(`[AgentManager] Chrome launched (PID: ${chromePid})`);

      // Save Chrome PID file
      if (chromePid) {
        this.savePidFile(id, "chrome", chromePid);
      }

      // Step 3: Launch Next.js application
      console.log(`[AgentManager] Launching app for agent ${id}...`);
      const appResult = await this.appLauncher!.launch(agent, runtimeDir);

      if (!appResult.success) {
        // Chrome launched but app failed - need to stop Chrome
        console.error(`[AgentManager] App launch failed, stopping Chrome...`);
        await this.chromeLauncher!.stop(id, agent.chromePort, agent.userDataDir);
        throw new Error(`应用启动失败: ${appResult.error}`);
      }
      appPid = appResult.pid;
      console.log(`[AgentManager] App launched (PID: ${appPid})`);

      // Save App PID file
      if (appPid) {
        this.savePidFile(id, "app", appPid);
      }

      // Step 4: Update runtime status
      this.runtimeStatus.set(id, {
        id,
        isRunning: true,
        chromePid,
        appPid,
        appHealthy: true,
        chromeHealthy: true,
      });

      this.updateStatus(id, "running");
      this.emit("agent:started", id);

      console.log(`[AgentManager] Agent ${id} started successfully`);
    } catch (error) {
      // Clean up on failure
      if (chromePid) {
        try {
          await this.chromeLauncher!.stop(id, agent.chromePort, agent.userDataDir);
        } catch {
          // Ignore cleanup errors
        }
      }
      if (appPid) {
        try {
          await this.appLauncher!.stop(id, agent.appPort);
        } catch {
          // Ignore cleanup errors
        }
      }

      this.updateStatus(id, "error", error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      this.operationLocks.delete(id);
    }
  }

  /**
   * Stop an agent (or all agents)
   */
  async stopAgent(agentId?: string): Promise<void> {
    if (!this.config || !this.chromeLauncher) {
      throw new Error("Agent manager not initialized");
    }

    const agentsToStop = agentId
      ? [this.getAgent(agentId)].filter(Boolean) as AgentConfig[]
      : this.config.agents;

    if (agentsToStop.length === 0) {
      throw new Error(agentId ? `Agent not found: ${agentId}` : "No agents configured");
    }

    for (const agent of agentsToStop) {
      await this.stopSingleAgent(agent);
    }
  }

  /**
   * Stop a single agent
   * Stops both Next.js application and Chrome processes
   */
  private async stopSingleAgent(agent: AgentConfig): Promise<void> {
    const { id, appPort, chromePort, userDataDir } = agent;

    // Check if operation is in progress
    if (this.operationLocks.has(id)) {
      throw new Error(`Operation in progress for agent: ${id}`);
    }

    // Check current status
    const currentStatus = await this.getAgentStatus(id);
    if (currentStatus === "stopped") {
      return; // Already stopped
    }

    this.operationLocks.add(id);
    this.updateStatus(id, "stopping");

    try {
      // Step 1: Stop Next.js application first (allows graceful shutdown)
      console.log(`[AgentManager] Stopping app for agent ${id}...`);
      try {
        await this.appLauncher!.stop(id, appPort);
        console.log(`[AgentManager] App stopped`);
      } catch (error) {
        console.warn(`[AgentManager] Failed to stop app: ${error}`);
      }

      // Step 2: Stop Chrome gracefully (protects IndexedDB)
      console.log(`[AgentManager] Stopping Chrome for agent ${id}...`);
      await this.chromeLauncher!.stop(id, chromePort, userDataDir);
      console.log(`[AgentManager] Chrome stopped`);

      // Step 3: Clean up runtime directory (optional - saves disk space)
      // Note: We don't clean up immediately to allow log inspection
      // Runtime directories will be cleaned up on next start

      // Update runtime status
      this.runtimeStatus.set(id, {
        id,
        isRunning: false,
        appHealthy: false,
        chromeHealthy: false,
      });

      // Remove PID files
      this.removePidFile(id, "chrome");
      this.removePidFile(id, "app");

      this.updateStatus(id, "stopped");
      this.emit("agent:stopped", id);

      console.log(`[AgentManager] Agent ${id} stopped successfully`);
    } catch (error) {
      this.updateStatus(id, "error", error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      this.operationLocks.delete(id);
    }
  }

  /**
   * Restart an agent (or all agents)
   */
  async restartAgent(agentId?: string): Promise<void> {
    await this.stopAgent(agentId);
    await this.delay(TIMEOUTS.AGENT_RESTART_WAIT);
    await this.startAgent(agentId);
  }

  /**
   * Get agent status
   * 优先检查过渡状态，然后检查实际运行状态
   */
  private async getAgentStatus(agentId: string): Promise<AgentStatus> {
    // 1. 优先检查过渡状态 (starting/stopping)
    const transition = this.transitionStates.get(agentId);
    if (transition) {
      return transition;
    }

    // 2. 检查运行时状态
    const runtime = this.runtimeStatus.get(agentId);
    if (!runtime) {
      return "stopped";
    }

    // 3. 检查错误状态
    if (runtime.error) {
      return "error";
    }

    // 4. 根据健康检查判断运行状态
    // Both services must be running for agent to be considered fully running
    if (runtime.isRunning && runtime.chromeHealthy && runtime.appHealthy) {
      return "running";
    }

    return "stopped";
  }

  /**
   * Probe all agents for current status
   * Checks both Chrome and Next.js app health
   */
  private async probeAllAgents(): Promise<void> {
    if (!this.config || !this.chromeLauncher || !this.appLauncher) return;

    for (const agent of this.config.agents) {
      const chromeHealthy = await this.chromeLauncher.isHealthy(agent.chromePort);
      const appHealthy = await this.appLauncher.isHealthy(agent.appPort);

      // Both Chrome and app must be healthy for agent to be considered running
      const isRunning = chromeHealthy && appHealthy;

      this.runtimeStatus.set(agent.id, {
        id: agent.id,
        isRunning,
        chromePid: chromeHealthy ? portManager.getPidByPort(agent.chromePort) ?? undefined : undefined,
        appPid: appHealthy ? portManager.getPidByPort(agent.appPort) ?? undefined : undefined,
        appHealthy,
        chromeHealthy,
      });
    }
  }

  /**
   * Update agent status and emit event
   * 过渡状态通过 transitionStates 管理，最终状态通过 runtimeStatus 管理
   */
  private updateStatus(agentId: string, status: AgentStatus, error?: string): void {
    // 管理过渡状态
    if (status === "starting" || status === "stopping") {
      this.transitionStates.set(agentId, status);
    } else {
      this.transitionStates.delete(agentId);
    }

    // 更新运行时状态
    const runtime = this.runtimeStatus.get(agentId);
    if (runtime) {
      runtime.error = error;
      // 根据状态更新健康检查字段
      if (status === "running") {
        runtime.isRunning = true;
        runtime.appHealthy = true;
        runtime.chromeHealthy = true;
      } else if (status === "stopped" || status === "error") {
        runtime.isRunning = false;
        runtime.appHealthy = false;
        runtime.chromeHealthy = false;
      }
    } else if (status !== "starting" && status !== "stopping") {
      // 只有非过渡状态才创建新的 runtime 记录
      this.runtimeStatus.set(agentId, {
        id: agentId,
        isRunning: status === "running",
        appHealthy: status === "running",
        chromeHealthy: status === "running",
        error,
      });
    }

    this.emit("agent:status", { agentId, status, error });
  }

  /**
   * Generate unique agent ID
   */
  private generateAgentId(type: string): string {
    const existingIds = this.config?.agents
      .filter((a) => a.type === type)
      .map((a) => a.id) ?? [];

    let counter = 1;
    let id = `${type}-${counter}`;

    while (existingIds.includes(id)) {
      counter++;
      id = `${type}-${counter}`;
    }

    return id;
  }

  /**
   * Get next agent number for naming
   */
  private getNextAgentNumber(type: string): number {
    const existingCount = this.config?.agents.filter((a) => a.type === type).length ?? 0;
    return existingCount + 1;
  }

  /**
   * Save PID to file
   */
  private savePidFile(agentId: string, type: "chrome" | "app", pid: number): void {
    const pidPath = path.join(this.pidsPath, `${agentId}-${type}.pid`);
    fs.writeFileSync(pidPath, String(pid), "utf-8");
  }

  /**
   * Remove PID file
   */
  private removePidFile(agentId: string, type: "chrome" | "app"): void {
    const pidPath = path.join(this.pidsPath, `${agentId}-${type}.pid`);
    try {
      if (fs.existsSync(pidPath)) {
        fs.unlinkSync(pidPath);
      }
    } catch {
      // Ignore errors
    }
  }

  /**
   * Helper to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clean up resources on shutdown
   */
  async shutdown(): Promise<void> {
    console.log("[AgentManager] Shutting down...");

    // Stop all running agents
    if (this.config) {
      for (const agent of this.config.agents) {
        const status = await this.getAgentStatus(agent.id);
        if (status === "running" || status === "starting") {
          try {
            await this.stopSingleAgent(agent);
          } catch (error) {
            console.error(`Failed to stop agent ${agent.id}:`, error);
          }
        }
      }
    }

    // Clean up app launcher processes
    if (this.appLauncher) {
      await this.appLauncher.shutdown();
    }

    // Optionally clean up all runtime directories
    // Uncomment if you want to clean up on shutdown
    // await this.runtimeManager.cleanupAllRuntimes();

    this.removeAllListeners();
    console.log("[AgentManager] Shutdown complete");
  }

  /**
   * Get RuntimeManager instance for external access (e.g., checking standalone path)
   */
  getRuntimeManager(): RuntimeManager {
    return this.runtimeManager;
  }

  /**
   * Get AppLauncher instance for external access (e.g., reading logs)
   */
  getAppLauncher(): AppLauncher | null {
    return this.appLauncher;
  }
}

// Export singleton factory
let instance: AgentManager | null = null;

export function getAgentManager(options?: AgentManagerOptions): AgentManager {
  if (!instance && options) {
    instance = new AgentManager(options);
  }

  if (!instance) {
    throw new Error("AgentManager not initialized. Call with options first.");
  }

  return instance;
}

/**
 * Safe version of getAgentManager that returns null instead of throwing
 * Useful for IPC handlers where AgentManager might not be initialized yet
 */
export function getAgentManagerSafe(): AgentManager | null {
  return instance;
}

export async function initializeAgentManager(options: AgentManagerOptions): Promise<AgentManager> {
  instance = new AgentManager(options);
  await instance.initialize();
  return instance;
}
