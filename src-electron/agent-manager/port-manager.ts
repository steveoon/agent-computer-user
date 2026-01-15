import net from "net";
import { execSync } from "child_process";
import type { AgentConfig, Settings } from "./types";

/**
 * Port manager for agent instances
 * Handles port allocation and conflict detection
 */
export class PortManager {
  /**
   * Check if a port is currently in use
   */
  async isPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();

      server.once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          resolve(true);
        } else {
          resolve(false);
        }
      });

      server.once("listening", () => {
        server.close();
        resolve(false);
      });

      server.listen(port, "127.0.0.1");
    });
  }

  /**
   * Get the PID of a process listening on a specific port
   * Returns null if no process is listening
   */
  getPidByPort(port: number): number | null {
    try {
      // macOS/Linux: use lsof
      if (process.platform !== "win32") {
        const output = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN 2>/dev/null`, {
          encoding: "utf-8",
        }).trim();

        if (output) {
          const pid = parseInt(output.split("\n")[0], 10);
          return isNaN(pid) ? null : pid;
        }
      } else {
        // Windows: use netstat
        const output = execSync(`netstat -ano | findstr :${port}`, {
          encoding: "utf-8",
        });

        const lines = output.split("\n");
        for (const line of lines) {
          if (line.includes("LISTENING")) {
            const parts = line.trim().split(/\s+/);
            const pid = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(pid)) {
              return pid;
            }
          }
        }
      }
    } catch {
      // Command failed, no process on port
    }

    return null;
  }

  /**
   * Find the next available port starting from a given port
   */
  async getNextAvailablePort(startPort: number): Promise<number> {
    let port = startPort;
    const maxAttempts = 100; // Prevent infinite loop

    for (let i = 0; i < maxAttempts; i++) {
      const inUse = await this.isPortInUse(port);
      if (!inUse) {
        return port;
      }
      port++;
    }

    throw new Error(`Could not find available port after ${maxAttempts} attempts starting from ${startPort}`);
  }

  /**
   * Allocate ports for a new agent
   * Returns both app port and Chrome debugging port
   */
  async allocatePorts(
    existingAgents: AgentConfig[],
    settings: Settings
  ): Promise<{ appPort: number; chromePort: number }> {
    // Collect all used ports
    const usedAppPorts = new Set(existingAgents.map((a) => a.appPort));
    const usedChromePorts = new Set(existingAgents.map((a) => a.chromePort));

    // Find max used ports
    const maxUsedAppPort = existingAgents.length > 0
      ? Math.max(...existingAgents.map((a) => a.appPort))
      : settings.startPort - 1;

    const maxUsedChromePort = existingAgents.length > 0
      ? Math.max(...existingAgents.map((a) => a.chromePort))
      : settings.startChromePort - 1;

    // Start searching from max + 1
    let candidateAppPort = Math.max(settings.startPort, maxUsedAppPort + 1);
    let candidateChromePort = Math.max(settings.startChromePort, maxUsedChromePort + 1);

    // Find available app port
    while (usedAppPorts.has(candidateAppPort) || (await this.isPortInUse(candidateAppPort))) {
      candidateAppPort++;
    }

    // Find available Chrome port
    while (usedChromePorts.has(candidateChromePort) || (await this.isPortInUse(candidateChromePort))) {
      candidateChromePort++;
    }

    return {
      appPort: candidateAppPort,
      chromePort: candidateChromePort,
    };
  }

  /**
   * Wait for a port to become available (process stopped)
   */
  async waitForPortRelease(port: number, timeoutMs: number = 5000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const inUse = await this.isPortInUse(port);
      if (!inUse) {
        return true;
      }
      await this.delay(500);
    }

    return false;
  }

  /**
   * Helper to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const portManager = new PortManager();
