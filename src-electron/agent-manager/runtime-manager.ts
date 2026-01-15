import fs from "fs";
import path from "path";
import { execSync, spawnSync } from "child_process";
import { app } from "electron";

/**
 * RuntimeManager - Manages runtime directories for each Agent
 *
 * Problem solved:
 * - MCPClientManager is a singleton, sharing MCP connections across agents
 * - Environment variables (AGENT_ID, CHROME_REMOTE_DEBUGGING_PORT) are process-level
 * - Each Agent needs its own Next.js process with isolated environment
 *
 * Solution:
 * - Copy .next/standalone to /tmp/agent-runtime/${agentId}/
 * - Each Agent runs its own `node server.js` process
 * - Use hardlinks (cp -al) for fast copying when available
 */
export class RuntimeManager {
  private baseRuntimeDir: string;
  private standalonePath: string | null = null;

  constructor() {
    // Use /tmp on Unix, %TEMP% on Windows
    this.baseRuntimeDir =
      process.platform === "win32"
        ? path.join(process.env.TEMP || "C:\\Temp", "agent-runtime")
        : "/tmp/agent-runtime";
  }

  /**
   * Get the standalone build directory path
   * In packaged app, it's inside Resources/app/.next/standalone
   */
  getStandalonePath(): string | null {
    if (this.standalonePath) {
      return this.standalonePath;
    }

    let possiblePaths: string[];

    if (app.isPackaged) {
      // Packaged app: look in Resources/app/.next/standalone
      const resourcesPath = process.resourcesPath;
      possiblePaths = [
        path.join(resourcesPath, "app", ".next", "standalone"),
        path.join(resourcesPath, ".next", "standalone"),
      ];
    } else {
      // Development mode: look in project root
      const appPath = app.getAppPath();
      possiblePaths = [
        path.join(appPath, ".next", "standalone"),
        path.join(process.cwd(), ".next", "standalone"),
      ];
    }

    for (const p of possiblePaths) {
      if (fs.existsSync(p) && fs.existsSync(path.join(p, "server.js"))) {
        this.standalonePath = p;
        return p;
      }
    }

    return null;
  }

  /**
   * Prepare runtime directory for an Agent
   * Copies standalone build to /tmp/agent-runtime/${agentId}/
   *
   * @param agentId - Unique agent identifier
   * @returns Path to the runtime directory
   */
  async prepareRuntime(agentId: string): Promise<string> {
    const standalonePath = this.getStandalonePath();

    if (!standalonePath) {
      throw new Error(
        "standalone 构建不存在。请先运行 pnpm electron:build 或确保打包包含 .next/standalone"
      );
    }

    const runtimeDir = this.getRuntimeDir(agentId);

    // Clean up existing runtime directory
    await this.cleanupRuntime(agentId);

    // Create runtime directory
    fs.mkdirSync(runtimeDir, { recursive: true });

    // Copy standalone build using hardlinks if possible
    await this.copyWithHardlinks(standalonePath, runtimeDir);

    // Copy environment files if they exist (for development)
    await this.copyEnvFiles(runtimeDir);

    return runtimeDir;
  }

  /**
   * Get runtime directory path for an Agent
   */
  getRuntimeDir(agentId: string): string {
    return path.join(this.baseRuntimeDir, agentId);
  }

  /**
   * Clean up runtime directory for an Agent
   */
  async cleanupRuntime(agentId: string): Promise<void> {
    const runtimeDir = this.getRuntimeDir(agentId);

    if (fs.existsSync(runtimeDir)) {
      // Use rm -rf on Unix, rmdir /s /q on Windows
      if (process.platform === "win32") {
        spawnSync("cmd", ["/c", "rmdir", "/s", "/q", runtimeDir], {
          stdio: "ignore",
        });
      } else {
        spawnSync("rm", ["-rf", runtimeDir], { stdio: "ignore" });
      }
    }
  }

  /**
   * Clean up all runtime directories
   */
  async cleanupAllRuntimes(): Promise<void> {
    if (fs.existsSync(this.baseRuntimeDir)) {
      if (process.platform === "win32") {
        spawnSync("cmd", ["/c", "rmdir", "/s", "/q", this.baseRuntimeDir], {
          stdio: "ignore",
        });
      } else {
        spawnSync("rm", ["-rf", this.baseRuntimeDir], { stdio: "ignore" });
      }
    }
  }

  /**
   * Copy directory using hardlinks when available
   * Falls back to regular copy if hardlinks fail
   */
  private async copyWithHardlinks(src: string, dest: string): Promise<void> {
    if (process.platform === "win32") {
      // Windows: use robocopy (no hardlinks, but fast)
      spawnSync("robocopy", [src, dest, "/E", "/NFL", "/NDL", "/NJH", "/NJS"], {
        stdio: "ignore",
      });
    } else {
      // Unix: try cp -al (hardlinks), fallback to cp -a
      const result = spawnSync("cp", ["-al", `${src}/.`, dest], {
        stdio: "ignore",
      });

      if (result.status !== 0) {
        // Hardlinks failed (maybe cross-filesystem), use regular copy
        spawnSync("cp", ["-a", `${src}/.`, dest], { stdio: "ignore" });
      }
    }

    // Verify copy succeeded
    const serverJsPath = path.join(dest, "server.js");
    if (!fs.existsSync(serverJsPath)) {
      throw new Error(`复制 standalone 失败: ${serverJsPath} 不存在`);
    }
  }

  /**
   * Copy .env files to runtime directory
   * In development, these come from project root
   * In packaged app, they might be in extraResources
   */
  private async copyEnvFiles(runtimeDir: string): Promise<void> {
    const envFileNames = [".env", ".env.local", ".env.production"];
    const searchPaths: string[] = [];

    if (app.isPackaged) {
      // Packaged: look in resources
      searchPaths.push(process.resourcesPath);
      searchPaths.push(path.join(process.resourcesPath, "app"));
    } else {
      // Development: look in project root
      searchPaths.push(app.getAppPath());
      searchPaths.push(process.cwd());
    }

    for (const envFileName of envFileNames) {
      for (const searchPath of searchPaths) {
        const envFilePath = path.join(searchPath, envFileName);
        if (fs.existsSync(envFilePath)) {
          const destPath = path.join(runtimeDir, envFileName);
          // Don't overwrite if already exists (from standalone copy)
          if (!fs.existsSync(destPath)) {
            fs.copyFileSync(envFilePath, destPath);
          }
          break;
        }
      }
    }
  }

  /**
   * Check if a runtime directory exists and has a valid server.js
   */
  isRuntimeReady(agentId: string): boolean {
    const runtimeDir = this.getRuntimeDir(agentId);
    const serverJsPath = path.join(runtimeDir, "server.js");
    return fs.existsSync(serverJsPath);
  }

  /**
   * Get disk space used by an agent's runtime directory
   * Returns size in MB
   */
  getRuntimeSize(agentId: string): number {
    const runtimeDir = this.getRuntimeDir(agentId);

    if (!fs.existsSync(runtimeDir)) {
      return 0;
    }

    try {
      if (process.platform === "win32") {
        // Windows: use PowerShell
        const result = execSync(
          `powershell -Command "(Get-ChildItem -Recurse '${runtimeDir}' | Measure-Object -Property Length -Sum).Sum"`,
          { encoding: "utf-8" }
        ).trim();
        return Math.round(parseInt(result, 10) / (1024 * 1024));
      } else {
        // Unix: use du
        const result = execSync(`du -sm "${runtimeDir}" | cut -f1`, {
          encoding: "utf-8",
        }).trim();
        return parseInt(result, 10) || 0;
      }
    } catch {
      return 0;
    }
  }
}

// Singleton instance
let runtimeManagerInstance: RuntimeManager | null = null;

export function getRuntimeManager(): RuntimeManager {
  if (!runtimeManagerInstance) {
    runtimeManagerInstance = new RuntimeManager();
  }
  return runtimeManagerInstance;
}
