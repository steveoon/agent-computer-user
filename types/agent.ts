/**
 * Agent 管理相关类型定义
 * 与 src-electron/preload.ts 中的类型保持同步
 */

/**
 * Agent 运行状态
 */
export type AgentStatus = "running" | "stopped" | "starting" | "stopping" | "error";

/**
 * Agent 信息
 */
export interface AgentInfo {
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

/**
 * Agent 模板
 */
export interface AgentTemplate {
  name: string;
  description: string;
  chromeArgs: string[];
  env: Record<string, string>;
}

/**
 * Agent 清理结果
 */
export interface AgentCleanupResult {
  message: string;
  cleaned: number;
  lockCleaned?: number;
  lockFiles?: string[];
}

/**
 * 添加 Agent 选项
 */
export interface AddAgentOptions {
  id?: string;
  count?: number;
}

/**
 * Agent 状态更新
 * 与后端 AgentManager.emit("agent:status", { agentId, status, error }) 保持一致
 */
export interface AgentStatusUpdate {
  agentId: string;
  status: AgentStatus;  // 直接使用状态字符串
  error?: string;
}

/**
 * Electron API 类型（用于类型安全的访问）
 */
export interface ElectronAgentApi {
  list: () => Promise<AgentInfo[]>;
  add: (type: string, options?: AddAgentOptions) => Promise<AgentInfo[]>;
  start: (agentId?: string) => Promise<void>;
  stop: (agentId?: string) => Promise<void>;
  restart: (agentId?: string) => Promise<void>;
  remove: (agentId: string) => Promise<void>;
  cleanup: (agentId: string) => Promise<AgentCleanupResult>;
  get: (agentId: string) => Promise<AgentInfo>;
  getTemplates: () => Promise<Record<string, AgentTemplate>>;
  openUI: (agentId: string) => Promise<{ url: string; port: number; reused?: boolean }>;
  closeUI: (agentId: string) => Promise<{ closed: boolean }>;
  onStatusChange: (callback: (data: AgentStatusUpdate) => void) => () => void;
  onAgentsAdded: (callback: (agents: AgentInfo[]) => void) => () => void;
  onAgentRemoved: (callback: (agentId: string) => void) => () => void;
  onAgentStarted: (callback: (agentId: string) => void) => () => void;
  onAgentStopped: (callback: (agentId: string) => void) => () => void;
}

/**
 * 检测是否在 Electron 环境
 */
export function isElectronEnv(): boolean {
  return typeof window !== "undefined" && window.electronApi?.isElectron === true;
}

/**
 * 获取 Electron Agent API（带类型安全）
 */
export function getElectronAgentApi(): ElectronAgentApi | null {
  if (!isElectronEnv()) {
    return null;
  }
  return window.electronApi?.agent as ElectronAgentApi;
}

/**
 * 平台信息
 */
export interface PlatformInfo {
  platform: NodeJS.Platform;
  arch: string;
  version: string;
}

/**
 * 应用路径信息
 */
export interface AppPaths {
  userData: string;
  configs: string;
  logs: string;
  pids: string;
}

/**
 * IPC 操作结果
 */
export interface IpcResult {
  success: boolean;
  error?: string;
}

/**
 * Electron System API 类型
 */
export interface ElectronSystemApi {
  getPaths: () => Promise<AppPaths>;
  getPlatform: () => Promise<PlatformInfo>;
  openExternal: (url: string) => Promise<IpcResult>;
  showItemInFolder: (filePath: string) => Promise<IpcResult>;
}

// 扩展 Window 类型以支持 Electron API
declare global {
  interface Window {
    electronApi?: {
      isElectron: boolean;
      agent: ElectronAgentApi;
      chrome: unknown;
      system: ElectronSystemApi;
    };
  }
}
