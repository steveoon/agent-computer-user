import { contextBridge, ipcRenderer } from "electron";

/**
 * Preload 脚本类型定义
 *
 * 注意：类型的 canonical source 在 types/agent.ts
 * 此处仅定义 IPC 通信所需的内部类型，不导出以避免重复定义
 *
 * @see types/agent.ts - AgentInfo, AgentStatus, AgentStatusUpdate, AgentTemplate 等
 */

// ============================================================================
// Internal Types (与 types/agent.ts 保持一致，仅供 preload 内部使用)
// ============================================================================

type AgentStatus = "running" | "stopped" | "starting" | "stopping" | "error";

interface AgentInfo {
  id: string;
  type: string;
  name: string;
  description: string;
  appPort: number;
  chromePort: number;
  userDataDir: string;
  status: AgentStatus;
  createdAt: string;
}

interface AgentStatusUpdate {
  agentId: string;
  status: AgentStatus;
  error?: string;
}

interface AgentTemplate {
  name: string;
  description: string;
  chromeArgs: string[];
  env: Record<string, string>;
}

interface Settings {
  chromeExecutable: string;
  userDataDirBase: string;
  logsDir: string;
  pidsDir: string;
  healthCheckTimeout: number;
  healthCheckInterval: number;
  startPort: number;
  startChromePort: number;
}

interface AppPaths {
  userData: string;
  configs: string;
  logs: string;
  pids: string;
}

interface PlatformInfo {
  platform: NodeJS.Platform;
  arch: string;
  version: string;
}

interface IpcResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// IPC Helpers
// ============================================================================

async function handleIpcResponse<T>(
  channel: string,
  ...args: unknown[]
): Promise<T> {
  const response: IpcResponse<T> = await ipcRenderer.invoke(channel, ...args);
  if (!response.success) {
    throw new Error(response.error ?? "Unknown error");
  }
  return response.data as T;
}

// Agent management API
const agentApi = {
  // List all agents
  list: (): Promise<AgentInfo[]> => handleIpcResponse("agent:list"),

  // Add new agent
  add: (
    type: string,
    options?: { id?: string; count?: number }
  ): Promise<AgentInfo[]> => handleIpcResponse("agent:add", type, options),

  // Start agent(s)
  start: (agentId?: string): Promise<void> =>
    handleIpcResponse("agent:start", agentId),

  // Stop agent(s)
  stop: (agentId?: string): Promise<void> =>
    handleIpcResponse("agent:stop", agentId),

  // Restart agent(s)
  restart: (agentId?: string): Promise<void> =>
    handleIpcResponse("agent:restart", agentId),

  // Remove agent
  remove: (agentId: string): Promise<void> =>
    handleIpcResponse("agent:remove", agentId),

  // Cleanup agent ports (kill processes occupying the ports)
  cleanup: (agentId: string): Promise<{ message: string; cleaned: number }> =>
    handleIpcResponse("agent:cleanup", agentId),

  // Get single agent
  get: (agentId: string): Promise<AgentInfo> =>
    handleIpcResponse("agent:get", agentId),

  // Get agent templates
  getTemplates: (): Promise<Record<string, AgentTemplate>> =>
    handleIpcResponse("agent:templates"),

  // Get settings
  getSettings: (): Promise<Settings> =>
    handleIpcResponse("agent:settings:get"),

  // Update settings
  updateSettings: (settings: Partial<Settings>): Promise<void> =>
    handleIpcResponse("agent:settings:update", settings),

  // Open Agent UI in a new window
  openUI: (agentId: string): Promise<{ url: string; port: number; reused?: boolean }> =>
    handleIpcResponse("agent:openUI", agentId),

  // Close Agent UI window
  closeUI: (agentId: string): Promise<{ closed: boolean }> =>
    handleIpcResponse("agent:closeUI", agentId),

  // Subscribe to agent status updates
  onStatusChange: (callback: (data: AgentStatusUpdate) => void) => {
    const subscription = (
      _event: Electron.IpcRendererEvent,
      data: AgentStatusUpdate
    ) => callback(data);
    ipcRenderer.on("agent:status-update", subscription);
    return () =>
      ipcRenderer.removeListener("agent:status-update", subscription);
  },

  // Subscribe to agents added event
  onAgentsAdded: (callback: (agents: AgentInfo[]) => void) => {
    const subscription = (
      _event: Electron.IpcRendererEvent,
      agents: AgentInfo[]
    ) => callback(agents);
    ipcRenderer.on("agents:added", subscription);
    return () => ipcRenderer.removeListener("agents:added", subscription);
  },

  // Subscribe to agent removed event
  onAgentRemoved: (callback: (agentId: string) => void) => {
    const subscription = (
      _event: Electron.IpcRendererEvent,
      agentId: string
    ) => callback(agentId);
    ipcRenderer.on("agent:removed", subscription);
    return () => ipcRenderer.removeListener("agent:removed", subscription);
  },

  // Subscribe to agent started event
  onAgentStarted: (callback: (agentId: string) => void) => {
    const subscription = (
      _event: Electron.IpcRendererEvent,
      agentId: string
    ) => callback(agentId);
    ipcRenderer.on("agent:started", subscription);
    return () => ipcRenderer.removeListener("agent:started", subscription);
  },

  // Subscribe to agent stopped event
  onAgentStopped: (callback: (agentId: string) => void) => {
    const subscription = (
      _event: Electron.IpcRendererEvent,
      agentId: string
    ) => callback(agentId);
    ipcRenderer.on("agent:stopped", subscription);
    return () => ipcRenderer.removeListener("agent:stopped", subscription);
  },
};

// Chrome management API
const chromeApi = {
  // Get Chrome path
  getChromePath: (): Promise<string> => ipcRenderer.invoke("chrome:get-path"),

  // Set Chrome path
  setChromePath: (chromePath: string): Promise<void> =>
    ipcRenderer.invoke("chrome:set-path", chromePath),

  // Check if Chrome is available
  isAvailable: (): Promise<boolean> => ipcRenderer.invoke("chrome:is-available"),
};

// System API
const systemApi = {
  // Get app paths
  getPaths: (): Promise<AppPaths> => ipcRenderer.invoke("system:get-paths"),

  // Get platform info
  getPlatform: (): Promise<PlatformInfo> =>
    ipcRenderer.invoke("system:get-platform"),

  // Open external URL
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke("system:open-external", url),

  // Show file in folder
  showItemInFolder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke("system:show-in-folder", filePath),
};

// Expose APIs to renderer
contextBridge.exposeInMainWorld("electronApi", {
  agent: agentApi,
  chrome: chromeApi,
  system: systemApi,
  isElectron: true,
});

// Type definitions for the exposed API
export type ElectronApi = {
  agent: typeof agentApi;
  chrome: typeof chromeApi;
  system: typeof systemApi;
  isElectron: boolean;
};

// Also expose on window for TypeScript
declare global {
  interface Window {
    electronApi?: ElectronApi;
  }
}
