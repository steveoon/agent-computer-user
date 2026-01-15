import { z } from "zod";

// ============================================================================
// Agent Configuration Schemas (migrated from agents.json structure)
// ============================================================================

/**
 * Agent configuration schema
 * Defines the structure of a single agent instance
 */
export const AgentConfigSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/, {
    error: "Agent ID must start with alphanumeric and contain only alphanumeric, underscore, or hyphen",
  }),
  type: z.string(),
  name: z.string(),
  description: z.string(),
  appPort: z.number().int().min(1024).max(65535),
  chromePort: z.number().int().min(1024).max(65535),
  userDataDir: z.string(),
  chromeArgs: z.array(z.string()).optional().default([]),
  env: z.record(z.string(), z.string()).optional().default({}),
  createdAt: z.string().datetime(),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

/**
 * Settings schema for agent manager
 */
export const SettingsSchema = z.object({
  chromeExecutable: z.string(),
  userDataDirBase: z.string(),
  logsDir: z.string(),
  pidsDir: z.string(),
  healthCheckTimeout: z.number().default(30),
  healthCheckInterval: z.number().default(2),
  startPort: z.number().default(3001),  // Start from 3001, as 3000 is reserved for Electron main window
  startChromePort: z.number().default(9222),
});

export type Settings = z.infer<typeof SettingsSchema>;

/**
 * Full configuration file schema
 */
export const ConfigFileSchema = z.object({
  agents: z.array(AgentConfigSchema),
  settings: SettingsSchema,
});

export type ConfigFile = z.infer<typeof ConfigFileSchema>;

/**
 * Agent template schema (from agent-templates.json)
 */
export const AgentTemplateSchema = z.object({
  name: z.string(),
  description: z.string(),
  chromeArgs: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional().default({}),
});

export type AgentTemplate = z.infer<typeof AgentTemplateSchema>;

/**
 * Templates file schema
 */
export const TemplatesFileSchema = z.object({
  templates: z.record(z.string(), AgentTemplateSchema),
});

export type TemplatesFile = z.infer<typeof TemplatesFileSchema>;

// ============================================================================
// Runtime Types
// ============================================================================

/**
 * Runtime status of an agent
 */
export interface AgentRuntimeStatus {
  id: string;
  isRunning: boolean;
  appPid?: number;
  chromePid?: number;
  appHealthy: boolean;
  chromeHealthy: boolean;
  error?: string;
}

/**
 * Agent status for UI display
 */
export type AgentStatus = "running" | "stopped" | "starting" | "stopping" | "error";

/**
 * Agent info combining config and runtime status
 */
export interface AgentInfo extends AgentConfig {
  status: AgentStatus;
}

/**
 * Result of Chrome launch operation
 */
export interface ChromeLaunchResult {
  success: boolean;
  pid?: number;
  error?: string;
}

/**
 * Result of app launch operation
 */
export interface AppLaunchResult {
  success: boolean;
  pid?: number;
  error?: string;
}

/**
 * Agent manager initialization options
 */
export interface AgentManagerOptions {
  configPath: string;
  logsPath: string;
  pidsPath: string;
  templatesPath?: string;
}

/**
 * Options for adding a new agent
 */
export interface AddAgentOptions {
  id?: string;
  count?: number;
}

// ============================================================================
// Constants (migrated from multi-agent.sh)
// ============================================================================

export const TIMEOUTS = {
  /** Chrome startup timeout in milliseconds */
  CHROME_STARTUP: 10000,
  /** Chrome process check interval in milliseconds */
  CHROME_CHECK_INTERVAL: 500,
  /** App startup timeout in milliseconds */
  APP_STARTUP: 30000,
  /** App health check interval in milliseconds */
  APP_CHECK_INTERVAL: 1000,
  /** Agent stop wait time in milliseconds */
  AGENT_STOP_WAIT: 2000,
  /** Chrome graceful shutdown wait time in milliseconds */
  CHROME_GRACEFUL_WAIT: 10000,
  /** Chrome force kill wait time in milliseconds */
  CHROME_FORCE_WAIT: 3000,
  /** Agent restart wait time in milliseconds */
  AGENT_RESTART_WAIT: 2000,
  /** Port release wait time in milliseconds */
  PORT_RELEASE_WAIT: 2000,
} as const;

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Get default Chrome executable path based on platform
 */
export function getDefaultChromePath(): string {
  switch (process.platform) {
    case "darwin":
      return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    case "win32":
      return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    default:
      return "/usr/bin/google-chrome";
  }
}

/**
 * Create default settings
 */
export function createDefaultSettings(basePath: string): Settings {
  return {
    chromeExecutable: getDefaultChromePath(),
    userDataDirBase: `${basePath}/chrome-profiles`,
    logsDir: `${basePath}/logs`,
    pidsDir: `${basePath}/pids`,
    healthCheckTimeout: 30,
    healthCheckInterval: 2,
    startPort: 3001,  // 3000 is reserved for Electron main window
    startChromePort: 9222,
  };
}

/**
 * Create default config file
 */
export function createDefaultConfig(basePath: string): ConfigFile {
  return {
    agents: [],
    settings: createDefaultSettings(basePath),
  };
}

/**
 * Default agent templates
 */
export const DEFAULT_TEMPLATES: TemplatesFile = {
  templates: {
    zhipin: {
      name: "BOSS直聘代理",
      description: "用于操作BOSS直聘平台的自动化Agent",
      chromeArgs: [],
      env: {},
    },
    yupao: {
      name: "鱼泡网代理",
      description: "用于操作鱼泡网平台的自动化Agent",
      chromeArgs: [],
      env: {},
    },
  },
};
