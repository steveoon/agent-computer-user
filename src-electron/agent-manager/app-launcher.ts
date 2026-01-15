import { spawn, ChildProcess, execSync } from "child_process";
import fs from "fs";
import path from "path";
import type { AgentConfig, AppLaunchResult } from "./types";
import { TIMEOUTS } from "./types";

/**
 * AppLauncher - Launches and manages Next.js standalone processes for each Agent
 *
 * Each Agent gets:
 * - Its own Node.js process running `node server.js`
 * - Isolated environment variables (PORT, AGENT_ID, CHROME_REMOTE_DEBUGGING_PORT)
 * - Separate log file (${agentId}-app.log)
 *
 * This solves the singleton isolation problem:
 * - MCPClientManager singleton per process
 * - AsyncLocalStorage per process
 * - Environment variables per process
 */
export class AppLauncher {
  private processes: Map<string, ChildProcess> = new Map();
  private logsPath: string;

  constructor(logsPath: string) {
    this.logsPath = logsPath;
  }

  /**
   * Launch Next.js application for an Agent
   *
   * @param agent - Agent configuration
   * @param runtimeDir - Path to the runtime directory (from RuntimeManager)
   */
  async launch(agent: AgentConfig, runtimeDir: string): Promise<AppLaunchResult> {
    const { id, appPort, chromePort } = agent;

    // Step 1: Check if port is already in use
    if (await this.isPortInUse(appPort)) {
      return {
        success: false,
        error: `应用端口 ${appPort} 已被占用`,
      };
    }

    // Step 2: Check if server.js exists
    const serverJsPath = path.join(runtimeDir, "server.js");
    if (!fs.existsSync(serverJsPath)) {
      return {
        success: false,
        error: `server.js 不存在: ${serverJsPath}`,
      };
    }

    // Step 3: Load environment variables from .env files
    const envVars = this.loadEnvFiles(runtimeDir);

    // Step 4: Build process environment
    const processEnv: NodeJS.ProcessEnv = {
      ...process.env,
      ...envVars,
      // Override with agent-specific values
      PORT: String(appPort),
      HOSTNAME: "0.0.0.0",
      CHROME_REMOTE_DEBUGGING_PORT: String(chromePort),
      AGENT_ID: id,
      // Add any custom env from agent config
      ...agent.env,
    };

    // Step 5: Setup logging
    fs.mkdirSync(this.logsPath, { recursive: true });
    const logPath = path.join(this.logsPath, `${id}-app.log`);

    // Create log file with header
    const header = `=== Agent ${id} Application Log - ${new Date().toISOString()} ===\n`;
    fs.writeFileSync(logPath, header);

    const logFd = fs.openSync(logPath, "a");

    // Step 6: Launch Node.js process
    try {
      // Find Node.js executable
      const nodePath = this.getNodePath();

      const appProcess = spawn(nodePath, ["server.js"], {
        cwd: runtimeDir,
        env: processEnv,
        detached: true,
        stdio: ["ignore", logFd, logFd],
      });

      // Don't wait for the process (detached)
      appProcess.unref();

      // Store process reference
      this.processes.set(id, appProcess);

      // Step 7: Wait for application to be ready
      const ready = await this.waitForAppReady(appPort, TIMEOUTS.APP_STARTUP);

      if (!ready) {
        // Kill the process if it didn't become ready
        this.killProcess(appProcess.pid);
        this.processes.delete(id);

        // Read last few lines of log for error details
        const logContent = this.readLastLines(logPath, 20);

        return {
          success: false,
          error: `应用启动超时 (${TIMEOUTS.APP_STARTUP / 1000}秒)。\n最后日志:\n${logContent}`,
        };
      }

      // Step 8: Get actual PID (might differ on some systems)
      const actualPid = this.getPidByPort(appPort) || appProcess.pid;

      return {
        success: true,
        pid: actualPid,
      };
    } catch (err) {
      return {
        success: false,
        error: `启动应用失败: ${err}`,
      };
    } finally {
      // Close log file descriptor
      try {
        fs.closeSync(logFd);
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Stop Next.js application for an Agent
   * Kills the process and all its children (important for detached processes)
   */
  async stop(agentId: string, appPort: number): Promise<void> {
    // Get PID by port first
    let appPid = this.getPidByPort(appPort);

    // Try stored process reference
    const storedProcess = this.processes.get(agentId);
    if (!appPid && storedProcess?.pid) {
      appPid = storedProcess.pid;
    }

    if (!appPid) {
      // Application not running, clean up
      this.processes.delete(agentId);
      return;
    }

    console.log(`[AppLauncher] Stopping agent ${agentId} (PID: ${appPid})...`);

    // Step 1: Kill all child processes first
    this.killChildProcesses(appPid);

    // Step 2: Send SIGTERM for graceful shutdown
    try {
      process.kill(appPid, "SIGTERM");
    } catch {
      // Process might already be dead
    }

    // Wait for graceful shutdown
    const exited = await this.waitForProcessExit(appPid, 5000);

    // Step 3: Force kill if still running
    if (!exited) {
      console.log(`[AppLauncher] Agent ${agentId} did not exit gracefully, force killing...`);
      this.killProcess(appPid);
    }

    // Step 4: Kill any remaining processes on the port
    await this.killProcessesByPort(appPort);

    // Clean up
    this.processes.delete(agentId);
    console.log(`[AppLauncher] Agent ${agentId} stopped`);
  }

  /**
   * Check if application is healthy
   */
  async isHealthy(appPort: number): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:${appPort}/api/health`, {
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get log file path for an Agent
   */
  getLogPath(agentId: string): string {
    return path.join(this.logsPath, `${agentId}-app.log`);
  }

  /**
   * Load environment variables from .env files
   * Mimics bash `set -a; source .env; set +a` behavior
   */
  private loadEnvFiles(runtimeDir: string): Record<string, string> {
    const env: Record<string, string> = {};
    const envFiles = [".env", ".env.local", ".env.production"];

    for (const envFile of envFiles) {
      const envPath = path.join(runtimeDir, envFile);
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        const lines = content.split("\n");

        for (const line of lines) {
          // Skip comments and empty lines
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) {
            continue;
          }

          // Parse KEY=VALUE
          const match = trimmed.match(/^([^=]+)=(.*)$/);
          if (match) {
            const key = match[1].trim();
            let value = match[2].trim();

            // Remove surrounding quotes
            if (
              (value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))
            ) {
              value = value.slice(1, -1);
            }

            env[key] = value;
          }
        }
      }
    }

    return env;
  }

  /**
   * Get Node.js executable path
   */
  private getNodePath(): string {
    // Check if we're running inside Electron
    // process.execPath might be Electron, not Node
    if (process.platform === "win32") {
      // On Windows, try to find node.exe
      const possiblePaths = [
        "node.exe",
        path.join(process.env.PROGRAMFILES || "", "nodejs", "node.exe"),
        path.join(process.env.APPDATA || "", "npm", "node.exe"),
      ];

      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          return p;
        }
      }

      // Fall back to assuming node is in PATH
      return "node";
    } else {
      // On Unix, try common locations
      const possiblePaths = [
        "/usr/local/bin/node",
        "/usr/bin/node",
        "/opt/homebrew/bin/node",
        // NVM installed node
        path.join(process.env.HOME || "", ".nvm", "current", "bin", "node"),
      ];

      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          return p;
        }
      }

      // Fall back to assuming node is in PATH
      return "node";
    }
  }

  /**
   * Wait for application to be ready
   */
  private async waitForAppReady(port: number, timeout: number): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = TIMEOUTS.APP_CHECK_INTERVAL;

    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(`http://localhost:${port}/api/health`, {
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok) {
          return true;
        }
      } catch {
        // Not ready yet
      }

      await this.delay(checkInterval);
    }

    return false;
  }

  /**
   * Check if port is in use
   */
  private async isPortInUse(port: number): Promise<boolean> {
    try {
      await fetch(`http://localhost:${port}`, {
        signal: AbortSignal.timeout(1000),
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get PID of process using a port
   */
  private getPidByPort(port: number): number | null {
    try {
      if (process.platform === "win32") {
        const output = execSync(`netstat -ano | findstr :${port}`, {
          encoding: "utf-8",
        }).trim();
        const lines = output.split("\n");
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5) {
            const pid = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(pid)) {
              return pid;
            }
          }
        }
      } else {
        const output = execSync(`lsof -ti:${port} 2>/dev/null`, {
          encoding: "utf-8",
        }).trim();
        if (output) {
          const pid = parseInt(output.split("\n")[0], 10);
          return isNaN(pid) ? null : pid;
        }
      }
    } catch {
      // Port not in use or command failed
    }
    return null;
  }

  /**
   * Kill a process by PID
   */
  private killProcess(pid: number | undefined): void {
    if (!pid) return;

    try {
      if (process.platform === "win32") {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      } else {
        process.kill(pid, "SIGKILL");
      }
    } catch {
      // Process might already be dead
    }
  }

  /**
   * Kill all child processes of a parent
   * Important for detached processes that spawn subprocesses
   */
  private killChildProcesses(parentPid: number): void {
    try {
      if (process.platform === "win32") {
        // On Windows, use taskkill with /T flag to kill tree
        execSync(`taskkill /PID ${parentPid} /T /F`, { stdio: "ignore" });
      } else {
        // On Unix, find and kill all children
        const output = execSync(`pgrep -P ${parentPid} 2>/dev/null`, {
          encoding: "utf-8",
        }).trim();

        if (output) {
          const childPids = output.split("\n").map((p) => parseInt(p, 10));
          for (const childPid of childPids) {
            if (!isNaN(childPid)) {
              // Recursively kill grandchildren
              this.killChildProcesses(childPid);
              try {
                process.kill(childPid, "SIGKILL");
              } catch {
                // Ignore errors
              }
            }
          }
        }
      }
    } catch {
      // No children found or command failed
    }
  }

  /**
   * Kill all processes using a specific port
   * Ensures complete cleanup even if PID tracking failed
   */
  private async killProcessesByPort(port: number): Promise<void> {
    try {
      if (process.platform === "win32") {
        // On Windows, find PIDs using netstat and kill them
        const output = execSync(`netstat -ano | findstr :${port}`, {
          encoding: "utf-8",
        }).trim();

        const pids = new Set<number>();
        for (const line of output.split("\n")) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5) {
            const pid = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(pid) && pid > 0) {
              pids.add(pid);
            }
          }
        }

        for (const pid of pids) {
          execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
        }
      } else {
        // On Unix, use lsof to find all PIDs on the port
        const output = execSync(`lsof -ti:${port} 2>/dev/null`, {
          encoding: "utf-8",
        }).trim();

        if (output) {
          const pids = output.split("\n").map((p) => parseInt(p, 10));
          for (const pid of pids) {
            if (!isNaN(pid) && pid > 0) {
              try {
                process.kill(pid, "SIGKILL");
              } catch {
                // Process already dead
              }
            }
          }
        }
      }
    } catch {
      // No processes found on port
    }
  }

  /**
   * Wait for a process to exit
   */
  private async waitForProcessExit(pid: number, timeout: number): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        process.kill(pid, 0);
        // Process still running
        await this.delay(500);
      } catch {
        // Process is dead
        return true;
      }
    }

    return false;
  }

  /**
   * Read last N lines from a file
   */
  private readLastLines(filePath: string, n: number): string {
    try {
      if (!fs.existsSync(filePath)) {
        return "(日志文件不存在)";
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");
      return lines.slice(-n).join("\n");
    } catch {
      return "(无法读取日志)";
    }
  }

  /**
   * Helper to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clean up all running processes
   */
  async shutdown(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [, childProcess] of this.processes) {
      if (childProcess.pid) {
        promises.push(
          (async () => {
            try {
              this.killProcess(childProcess.pid);
            } catch {
              // Ignore
            }
          })()
        );
      }
    }

    await Promise.all(promises);
    this.processes.clear();
  }
}
