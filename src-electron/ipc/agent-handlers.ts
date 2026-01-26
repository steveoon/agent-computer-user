import { ipcMain, BrowserWindow } from "electron";
import fs from "fs";
import { execSync } from "child_process";
import type { AgentManager } from "../agent-manager";
import type { AddAgentOptions } from "../agent-manager/types";
import { portManager } from "../agent-manager/port-manager";

/**
 * Track Agent UI windows by agentId
 * Used to auto-close windows when agent is stopped
 */
const agentWindows = new Map<string, BrowserWindow>();

/**
 * Close Agent UI window if it exists
 */
function closeAgentWindow(agentId: string): boolean {
  const win = agentWindows.get(agentId);
  if (win && !win.isDestroyed()) {
    win.close();
    agentWindows.delete(agentId);
    return true;
  }
  agentWindows.delete(agentId);
  return false;
}

/**
 * Register all agent-related IPC handlers
 */
export function registerAgentHandlers(agentManager: AgentManager): void {
  // ============================================================================
  // Agent CRUD Operations
  // ============================================================================

  /**
   * List all agents with status
   */
  ipcMain.handle("agent:list", async () => {
    try {
      const agents = await agentManager.listAgents();
      return { success: true, data: agents };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Add new agent(s)
   */
  ipcMain.handle(
    "agent:add",
    async (_event, type: string, options?: AddAgentOptions) => {
      try {
        const agents = await agentManager.addAgents(type, options);
        return { success: true, data: agents };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  /**
   * Remove an agent
   */
  ipcMain.handle("agent:remove", async (_event, agentId: string) => {
    try {
      await agentManager.removeAgent(agentId);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Get single agent info
   */
  ipcMain.handle("agent:get", async (_event, agentId: string) => {
    try {
      const agent = agentManager.getAgent(agentId);
      if (!agent) {
        return { success: false, error: `Agent not found: ${agentId}` };
      }
      return { success: true, data: agent };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // ============================================================================
  // Agent Lifecycle Operations
  // ============================================================================

  /**
   * Start agent(s)
   */
  ipcMain.handle("agent:start", async (_event, agentId?: string) => {
    try {
      await agentManager.startAgent(agentId);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Stop agent(s)
   */
  ipcMain.handle("agent:stop", async (_event, agentId?: string) => {
    try {
      await agentManager.stopAgent(agentId);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Restart agent(s)
   */
  ipcMain.handle("agent:restart", async (_event, agentId?: string) => {
    try {
      await agentManager.restartAgent(agentId);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // ============================================================================
  // Templates & Settings
  // ============================================================================

  /**
   * Get available agent templates
   */
  ipcMain.handle("agent:templates", async () => {
    try {
      const templates = agentManager.getTemplates();
      return { success: true, data: templates };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Get current settings
   */
  ipcMain.handle("agent:settings:get", async () => {
    try {
      const settings = agentManager.getSettings();
      return { success: true, data: settings };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Update settings
   */
  ipcMain.handle(
    "agent:settings:update",
    async (_event, settings: Record<string, unknown>) => {
      try {
        await agentManager.updateSettings(settings);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  // ============================================================================
  // Port Cleanup
  // ============================================================================

  /**
   * Kill process occupying a specific port
   * Used when agent fails to start due to port conflict
   */
  ipcMain.handle("agent:cleanup", async (_event, agentId: string) => {
    try {
      const agent = agentManager.getAgent(agentId);
      if (!agent) {
        return { success: false, error: `Agent not found: ${agentId}` };
      }

      const results: { port: number; pid: number | null; killed: boolean }[] = [];

      // Check and kill process on app port
      const appPid = portManager.getPidByPort(agent.appPort);
      if (appPid) {
        try {
          if (process.platform !== "win32") {
            execSync(`kill -9 ${appPid}`);
          } else {
            execSync(`taskkill /F /PID ${appPid}`);
          }
          results.push({ port: agent.appPort, pid: appPid, killed: true });
        } catch {
          results.push({ port: agent.appPort, pid: appPid, killed: false });
        }
      }

      // Check and kill process on Chrome port
      const chromePid = portManager.getPidByPort(agent.chromePort);
      if (chromePid) {
        try {
          if (process.platform !== "win32") {
            execSync(`kill -9 ${chromePid}`);
          } else {
            execSync(`taskkill /F /PID ${chromePid}`);
          }
          results.push({ port: agent.chromePort, pid: chromePid, killed: true });
        } catch {
          results.push({ port: agent.chromePort, pid: chromePid, killed: false });
        }
      }

      const cleanedCount = results.filter(r => r.killed).length;
      const lockCleanup = await agentManager.cleanupProfileLocks(agentId);
      const lockCleaned = lockCleanup.cleaned;

      const messageParts: string[] = [];
      if (cleanedCount > 0) {
        messageParts.push(`已清理 ${cleanedCount} 个端口进程`);
      }
      if (lockCleaned > 0) {
        messageParts.push(`已移除 ${lockCleaned} 个 Chrome 锁文件`);
      }
      if (messageParts.length === 0) {
        messageParts.push(lockCleanup.message || "没有发现占用端口的进程");
      }

      return {
        success: true,
        data: {
          message: messageParts.join("，"),
          cleaned: cleanedCount,
          lockCleaned,
          lockFiles: lockCleanup.removedFiles,
          details: results
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // ============================================================================
  // Logs & Diagnostics
  // ============================================================================

  /**
   * Get app log path for an agent
   */
  ipcMain.handle("agent:logs:path", async (_event, agentId: string) => {
    try {
      const appLauncher = agentManager.getAppLauncher();
      if (!appLauncher) {
        return { success: false, error: "App launcher not initialized" };
      }
      const logPath = appLauncher.getLogPath(agentId);
      return { success: true, data: logPath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Read app log content for an agent (last N lines)
   */
  ipcMain.handle(
    "agent:logs:read",
    async (_event, agentId: string, lines: number = 100) => {
      try {
        const appLauncher = agentManager.getAppLauncher();
        if (!appLauncher) {
          return { success: false, error: "App launcher not initialized" };
        }
        const logPath = appLauncher.getLogPath(agentId);

        if (!fs.existsSync(logPath)) {
          return { success: true, data: "(日志文件不存在)" };
        }

        const content = fs.readFileSync(logPath, "utf-8");
        const logLines = content.split("\n");
        const lastLines = logLines.slice(-lines).join("\n");

        return { success: true, data: lastLines };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  /**
   * Check if standalone build is available
   */
  ipcMain.handle("agent:runtime:check", async () => {
    try {
      const runtimeManager = agentManager.getRuntimeManager();
      const standalonePath = runtimeManager.getStandalonePath();
      return {
        success: true,
        data: {
          available: standalonePath !== null,
          path: standalonePath,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // ============================================================================
  // Agent UI
  // ============================================================================

  /**
   * Open Agent UI in a new window
   * Each Agent has its own Next.js process running on a different port
   *
   * IMPORTANT: We use a separate session partition for Agent windows to bypass
   * the main window's HTTP protocol interceptor (from next-electron-rsc).
   * The interceptor only allows http://localhost:3000, blocking other ports.
   */
  ipcMain.handle("agent:openUI", async (_event, agentId: string) => {
    try {
      const agent = agentManager.getAgent(agentId);
      if (!agent) {
        return { success: false, error: `Agent not found: ${agentId}` };
      }

      // Check if agent is running
      const agents = await agentManager.listAgents();
      const agentInfo = agents.find((a) => a.id === agentId);
      if (!agentInfo || agentInfo.status !== "running") {
        return {
          success: false,
          error: `Agent ${agentId} is not running. Please start it first.`,
        };
      }

      // Check if window already exists for this agent
      const existingWindow = agentWindows.get(agentId);
      if (existingWindow && !existingWindow.isDestroyed()) {
        // Focus existing window instead of creating a new one
        existingWindow.focus();
        return {
          success: true,
          data: { url: `http://localhost:${agent.appPort}`, port: agent.appPort, reused: true },
        };
      }

      // Create new window for the Agent UI
      // Use a separate session partition to bypass the main window's HTTP interceptor
      const agentWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        title: `${agent.name} - ${agent.id}`,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          // Use isolated session to bypass next-electron-rsc protocol interceptor
          partition: `persist:agent-${agentId}`,
        },
      });

      // Track the window
      agentWindows.set(agentId, agentWindow);

      // Remove from tracking when window is closed
      agentWindow.on("closed", () => {
        agentWindows.delete(agentId);
      });

      // Load the Agent's URL
      const agentUrl = `http://localhost:${agent.appPort}`;
      await agentWindow.loadURL(agentUrl);

      return { success: true, data: { url: agentUrl, port: agent.appPort } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Close Agent UI window
   */
  ipcMain.handle("agent:closeUI", async (_event, agentId: string) => {
    try {
      const closed = closeAgentWindow(agentId);
      return { success: true, data: { closed } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // ============================================================================
  // Status Events (Push to Renderer)
  // ============================================================================

  // Forward status events to all renderer windows
  agentManager.on("agent:status", (data) => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send("agent:status-update", data);
    }
  });

  agentManager.on("agents:added", (data) => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send("agents:added", data);
    }
  });

  agentManager.on("agent:removed", (agentId) => {
    // Auto-close the Agent UI window when agent is removed
    closeAgentWindow(agentId);

    // Notify all renderer windows
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send("agent:removed", agentId);
    }
  });

  agentManager.on("agent:started", (agentId) => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send("agent:started", agentId);
    }
  });

  agentManager.on("agent:stopped", (agentId) => {
    // Auto-close the Agent UI window when agent is stopped
    closeAgentWindow(agentId);

    // Notify all renderer windows
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send("agent:stopped", agentId);
    }
  });
}

/**
 * Remove all agent-related IPC handlers
 */
export function unregisterAgentHandlers(): void {
  const channels = [
    "agent:list",
    "agent:add",
    "agent:remove",
    "agent:get",
    "agent:start",
    "agent:stop",
    "agent:restart",
    "agent:cleanup",
    "agent:templates",
    "agent:settings:get",
    "agent:settings:update",
    "agent:logs:path",
    "agent:logs:read",
    "agent:runtime:check",
    "agent:openUI",
    "agent:closeUI",
  ];

  for (const channel of channels) {
    ipcMain.removeHandler(channel);
  }
}
