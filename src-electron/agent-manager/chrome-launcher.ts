import { spawn, ChildProcess, execSync } from "child_process";
import path from "path";
import fs from "fs";
import type { AgentConfig, Settings, ChromeLaunchResult } from "./types";
import { TIMEOUTS } from "./types";
import { portManager } from "./port-manager";

export interface ProfileLockCleanupResult {
  cleaned: number;
  removedFiles: string[];
  skipped: boolean;
  message: string;
}

/**
 * Chrome process launcher and manager
 * Handles Chrome lifecycle including graceful shutdown for IndexedDB protection
 */
export class ChromeLauncher {
  private processes: Map<string, ChildProcess> = new Map();
  private settings: Settings;
  private logsPath: string;

  constructor(settings: Settings, logsPath: string) {
    this.settings = settings;
    this.logsPath = logsPath;
  }

  /**
   * Launch Chrome for an agent
   */
  async launch(agent: AgentConfig): Promise<ChromeLaunchResult> {
    const { chromePort, userDataDir, id } = agent;

    // Step 1: Check if port is already in use
    if (await portManager.isPortInUse(chromePort)) {
      const existingPid = portManager.getPidByPort(chromePort);
      return {
        success: false,
        error: `Chrome port ${chromePort} is already in use${existingPid ? ` (PID: ${existingPid})` : ""}`,
      };
    }

    // Step 2: Check if user data directory is in use by another Chrome
    if (await this.isProfileInUse(userDataDir)) {
      return {
        success: false,
        error: `Chrome profile ${userDataDir} is already in use by another process`,
      };
    }

    // Step 3: Verify Chrome executable
    const chromePath = await this.getChromePath();
    if (!chromePath) {
      return {
        success: false,
        error: `Chrome executable not found. Please install Chrome or set chromeExecutable in settings.`,
      };
    }

    // Step 4: Ensure user data directory exists
    try {
      fs.mkdirSync(userDataDir, { recursive: true });
    } catch (err) {
      return {
        success: false,
        error: `Failed to create user data directory: ${err}`,
      };
    }

    // Step 5: Build Chrome arguments
    const chromeArgs = this.buildChromeArgs(agent);

    // Step 6: Launch Chrome process
    try {
      // Ensure logs directory exists
      fs.mkdirSync(this.logsPath, { recursive: true });

      const logPath = path.join(this.logsPath, `${id}-chrome.log`);
      const logFd = fs.openSync(logPath, "a");
      let chromeProcess: ChildProcess;

      try {
        chromeProcess = spawn(chromePath, chromeArgs, {
          detached: true,
          stdio: ["ignore", logFd, logFd],
        });
      } finally {
        try {
          fs.closeSync(logFd);
        } catch {
          // Ignore
        }
      }

      // Don't wait for the process (detached)
      chromeProcess.unref();

      // Step 7: Wait for Chrome to be ready
      const ready = await this.waitForChromeReady(chromePort, TIMEOUTS.CHROME_STARTUP);

      if (!ready) {
        // Kill the process if it didn't become ready
        try {
          chromeProcess.kill("SIGKILL");
        } catch {
          // Ignore errors
        }
        return {
          success: false,
          error: `Chrome failed to start within ${TIMEOUTS.CHROME_STARTUP / 1000} seconds`,
        };
      }

      // Step 8: Get the actual PID (might differ from spawn PID)
      const actualPid = portManager.getPidByPort(chromePort) || chromeProcess.pid;

      // Store process reference
      this.processes.set(id, chromeProcess);

      return {
        success: true,
        pid: actualPid,
      };
    } catch (err) {
      return {
        success: false,
        error: `Failed to launch Chrome: ${err}`,
      };
    }
  }

  /**
   * Stop Chrome gracefully
   * Important: This process protects IndexedDB data
   */
  async stop(agentId: string, chromePort: number, userDataDir: string): Promise<void> {
    // Get Chrome PID
    let chromePid = portManager.getPidByPort(chromePort);

    if (!chromePid) {
      // Try to find by user data dir
      chromePid = this.findPidByUserDataDir(userDataDir);
    }

    if (!chromePid) {
      // Chrome not running, clean up
      this.processes.delete(agentId);
      return;
    }

    // Step 1: Close all tabs via CDP to trigger IndexedDB flush
    try {
      await this.closeAllTabs(chromePort);
      await this.delay(2000); // Wait for IndexedDB flush
    } catch {
      // Chrome might already be dead
    }

    // Step 2: Send SIGTERM for graceful shutdown
    try {
      process.kill(chromePid, "SIGTERM");
    } catch {
      // Process might already be dead
    }

    // Step 3: Wait for graceful shutdown
    const gracefulShutdown = await this.waitForProcessExit(chromePid, TIMEOUTS.CHROME_GRACEFUL_WAIT);

    // Step 4: Force kill if still running
    if (!gracefulShutdown) {
      console.log(`Chrome ${agentId} did not exit gracefully, force killing...`);

      // Kill child processes first
      this.killChildProcesses(chromePid);

      // Force kill main process
      try {
        process.kill(chromePid, "SIGKILL");
      } catch {
        // Ignore errors
      }
    }

    // Step 5: Clean up any orphaned processes
    await this.cleanupOrphanedProcesses(userDataDir);

    // Step 6: Wait for file locks to be released
    await this.delay(TIMEOUTS.CHROME_FORCE_WAIT);

    // Clean up process reference
    this.processes.delete(agentId);
  }

  /**
   * Build Chrome command line arguments
   */
  private buildChromeArgs(agent: AgentConfig): string[] {
    const baseArgs = [
      `--remote-debugging-port=${agent.chromePort}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-default-apps",
      `--user-data-dir=${agent.userDataDir}`,
    ];

    // Add custom args with template substitution
    const customArgs: string[] = [];
    if (agent.chromeArgs) {
      for (const arg of agent.chromeArgs) {
        const processed = arg
          .replace(/\{\{chromePort\}\}/g, String(agent.chromePort))
          .replace(/\{\{userDataDir\}\}/g, agent.userDataDir);

        // Skip args we've already added
        const argKey = processed.split("=")[0];
        if (!baseArgs.some((a) => a.startsWith(argKey))) {
          customArgs.push(processed);
        }
      }
    }

    return [...baseArgs, ...customArgs];
  }

  /**
   * Get Chrome executable path
   */
  private async getChromePath(): Promise<string | null> {
    const { chromeExecutable } = this.settings;

    // Check configured path
    if (chromeExecutable && fs.existsSync(chromeExecutable)) {
      return chromeExecutable;
    }

    // Platform-specific default paths
    const defaultPaths =
      process.platform === "darwin"
        ? [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
          ]
        : process.platform === "win32"
          ? [
              "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
              "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
              `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
            ]
          : ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];

    for (const p of defaultPaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return null;
  }

  /**
   * Check if a Chrome profile directory is in use
   */
  private async isProfileInUse(userDataDir: string): Promise<boolean> {
    if (!fs.existsSync(userDataDir)) {
      return false;
    }

    // Check for Chrome lock file
    const lockFile = path.join(userDataDir, "SingletonLock");
    try {
      if (process.platform !== "win32") {
        // On Unix, SingletonLock is a symlink
        const stat = fs.lstatSync(lockFile);
        if (stat.isSymbolicLink()) {
          return true;
        }
      }
    } catch {
      // Lock file doesn't exist
    }

    // Also check for processes using this directory
    const pid = this.findPidByUserDataDir(userDataDir);
    return pid !== null;
  }

  /**
   * Clean up stale Chrome profile lock files when no process is using the profile
   */
  async cleanupProfileLocks(userDataDir: string): Promise<ProfileLockCleanupResult> {
    if (!fs.existsSync(userDataDir)) {
      return {
        cleaned: 0,
        removedFiles: [],
        skipped: false,
        message: "Profile 目录不存在",
      };
    }

    const pid = this.findPidByUserDataDir(userDataDir);
    if (pid) {
      return {
        cleaned: 0,
        removedFiles: [],
        skipped: true,
        message: `Chrome 正在运行 (PID: ${pid})，未清理锁文件`,
      };
    }

    const lockFiles = this.getProfileLockFiles(userDataDir);
    const removedFiles: string[] = [];

    for (const filePath of lockFiles) {
      if (!this.pathExistsNoFollow(filePath)) {
        continue;
      }

      try {
        fs.unlinkSync(filePath);
        removedFiles.push(path.basename(filePath));
      } catch {
        // Ignore errors for individual lock files
      }
    }

    if (removedFiles.length === 0) {
      return {
        cleaned: 0,
        removedFiles: [],
        skipped: false,
        message: "未发现 Chrome 锁文件",
      };
    }

    return {
      cleaned: removedFiles.length,
      removedFiles,
      skipped: false,
      message: `已移除 ${removedFiles.length} 个 Chrome 锁文件`,
    };
  }

  /**
   * Find Chrome PID by user data directory
   */
  private findPidByUserDataDir(userDataDir: string): number | null {
    try {
      if (process.platform === "win32") {
        const psCommand =
          "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; " +
          "$procs = Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | " +
          "Select-Object ProcessId, CommandLine; " +
          "if ($null -eq $procs) { return }; " +
          "$procs | ConvertTo-Json -Compress";
        const output = execSync(`powershell -NoProfile -Command "${psCommand}"`, {
          encoding: "utf-8",
        }).trim();

        if (!output) {
          return null;
        }

        let parsed:
          | Array<{ ProcessId: number; CommandLine?: string }>
          | { ProcessId: number; CommandLine?: string };
        try {
          parsed = JSON.parse(output);
        } catch {
          return null;
        }

        const list = Array.isArray(parsed) ? parsed : [parsed];
        const target = this.normalizeWindowsPath(userDataDir);

        for (const proc of list) {
          const cmd = proc.CommandLine ?? "";
          const match = cmd.match(/--user-data-dir=("[^"]+"|\S+)/);
          if (!match) continue;

          const rawDir = match[1].replace(/^"|"$/g, "");
          const normalized = this.normalizeWindowsPath(rawDir);
          if (normalized === target) {
            const pid = Number(proc.ProcessId);
            return Number.isNaN(pid) ? null : pid;
          }
        }
      } else {
        const output = execSync(`pgrep -f "user-data-dir=${userDataDir}" 2>/dev/null`, {
          encoding: "utf-8",
        }).trim();

        if (output) {
          const pid = parseInt(output.split("\n")[0], 10);
          return isNaN(pid) ? null : pid;
        }
      }
    } catch {
      // No process found
    }

    return null;
  }

  private normalizeWindowsPath(value: string): string {
    try {
      return path.resolve(value).replace(/[\\/]+$/, "").toLowerCase();
    } catch {
      return value.replace(/[\\/]+$/, "").toLowerCase();
    }
  }

  private getProfileLockFiles(userDataDir: string): string[] {
    return [
      path.join(userDataDir, "SingletonLock"),
      path.join(userDataDir, "SingletonCookie"),
      path.join(userDataDir, "SingletonSocket"),
    ];
  }

  private pathExistsNoFollow(filePath: string): boolean {
    try {
      fs.lstatSync(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for Chrome to be ready (CDP endpoint responsive)
   */
  private async waitForChromeReady(port: number, timeout: number): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(`http://localhost:${port}/json/version`);
        if (response.ok) {
          return true;
        }
      } catch {
        // Not ready yet
      }

      await this.delay(TIMEOUTS.CHROME_CHECK_INTERVAL);
    }

    return false;
  }

  /**
   * Close all tabs via CDP to trigger IndexedDB flush
   */
  private async closeAllTabs(port: number): Promise<void> {
    try {
      const response = await fetch(`http://localhost:${port}/json`);
      const tabs = (await response.json()) as Array<{ id: string }>;

      for (const tab of tabs) {
        try {
          await fetch(`http://localhost:${port}/json/close/${tab.id}`);
        } catch {
          // Ignore individual tab close errors
        }
      }
    } catch {
      // Ignore errors, Chrome might be closing
    }
  }

  /**
   * Wait for a process to exit
   */
  private async waitForProcessExit(pid: number, timeout: number): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (!this.isProcessRunning(pid)) {
        return true;
      }
      await this.delay(1000);
    }

    return false;
  }

  /**
   * Check if a process is running
   */
  private isProcessRunning(pid: number): boolean {
    try {
      // Sending signal 0 checks if process exists without killing it
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Kill child processes of a parent
   */
  private killChildProcesses(parentPid: number): void {
    try {
      if (process.platform !== "win32") {
        // Get child PIDs
        const output = execSync(`pgrep -P ${parentPid} 2>/dev/null`, {
          encoding: "utf-8",
        }).trim();

        if (output) {
          const childPids = output.split("\n").map((p) => parseInt(p, 10));
          for (const childPid of childPids) {
            if (!isNaN(childPid)) {
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
      // No children found
    }
  }

  /**
   * Clean up orphaned Chrome processes
   */
  private async cleanupOrphanedProcesses(userDataDir: string): Promise<void> {
    const orphanPid = this.findPidByUserDataDir(userDataDir);
    if (orphanPid) {
      console.log(`Cleaning up orphaned Chrome process: ${orphanPid}`);
      try {
        process.kill(orphanPid, "SIGKILL");
      } catch {
        // Ignore errors
      }
    }
  }

  /**
   * Helper to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if Chrome is healthy (CDP endpoint responsive)
   */
  async isHealthy(chromePort: number): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:${chromePort}/json/version`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
