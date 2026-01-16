import { ipcMain, shell, app } from "electron";
import fs from "fs";
import { getAgentManagerSafe } from "../agent-manager";
import { getDefaultChromePath } from "../agent-manager/types";

/**
 * Register system-related IPC handlers
 * Handles chrome path, platform info, and shell operations
 */
export function registerSystemHandlers(): void {
  // ============================================================================
  // Chrome Path Management
  // ============================================================================

  /**
   * Get Chrome executable path
   * Falls back to platform default if AgentManager not initialized
   */
  ipcMain.handle("chrome:get-path", async () => {
    const agentManager = getAgentManagerSafe();
    const chromePath = agentManager?.getSettings()?.chromeExecutable;
    return chromePath ?? getDefaultChromePath();
  });

  /**
   * Set Chrome executable path (updates settings)
   * Persists the path to AgentManager configuration
   */
  ipcMain.handle("chrome:set-path", async (_event, chromePath: string) => {
    // Validate path exists
    if (!fs.existsSync(chromePath)) {
      return {
        success: false,
        error: `Chrome executable not found at: ${chromePath}`,
      };
    }

    // Check if AgentManager is initialized
    const agentManager = getAgentManagerSafe();
    if (!agentManager) {
      return {
        success: false,
        error: "AgentManager not initialized yet",
      };
    }

    try {
      await agentManager.updateSettings({ chromeExecutable: chromePath });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Check if Chrome is available
   * Falls back to platform default if AgentManager not initialized
   */
  ipcMain.handle("chrome:is-available", async () => {
    const agentManager = getAgentManagerSafe();
    const chromePath = agentManager?.getSettings()?.chromeExecutable ?? getDefaultChromePath();
    return fs.existsSync(chromePath);
  });

  // ============================================================================
  // System Information
  // ============================================================================

  /**
   * Get application paths
   */
  ipcMain.handle("system:get-paths", async () => {
    try {
      return {
        userData: app.getPath("userData"),
        configs: app.getPath("userData"),
        logs: app.getPath("logs"),
        pids: app.getPath("userData"),
      };
    } catch (error) {
      console.error("Failed to get paths:", error);
      return null;
    }
  });

  /**
   * Get platform information
   */
  ipcMain.handle("system:get-platform", async () => {
    return {
      platform: process.platform,
      arch: process.arch,
      version: app.getVersion(),
    };
  });

  // ============================================================================
  // Shell Operations
  // ============================================================================

  /**
   * Open external URL in default browser
   */
  ipcMain.handle("system:open-external", async (_event, url: string) => {
    try {
      // Validate URL to prevent security issues
      const parsedUrl = new URL(url);
      if (!["http:", "https:", "mailto:"].includes(parsedUrl.protocol)) {
        throw new Error(`Invalid URL protocol: ${parsedUrl.protocol}`);
      }
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Show file in system file manager
   */
  ipcMain.handle("system:show-in-folder", async (_event, filePath: string) => {
    try {
      // Validate path exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`Path not found: ${filePath}`);
      }
      shell.showItemInFolder(filePath);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

/**
 * Remove system-related IPC handlers
 */
export function unregisterSystemHandlers(): void {
  const channels = [
    "chrome:get-path",
    "chrome:set-path",
    "chrome:is-available",
    "system:get-paths",
    "system:get-platform",
    "system:open-external",
    "system:show-in-folder",
  ];

  for (const channel of channels) {
    ipcMain.removeHandler(channel);
  }
}
