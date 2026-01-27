import http from "http";
import { createConnection } from "@playwright/mcp";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "crypto";

/**
 * Embedded MCP Server for Electron packaged environments
 *
 * In packaged Electron apps (Windows/macOS/Linux), `npx` commands are not available
 * because users may not have Node.js installed. This module provides an embedded
 * MCP server using Streamable HTTP transport instead of Stdio transport.
 *
 * Architecture:
 * - Electron main process starts this embedded server
 * - Next.js process connects via HTTP (Streamable HTTP transport)
 * - Each Agent gets its own MCP server instance on a unique port
 *
 * Key features:
 * - Programmatic Playwright MCP creation (no npx dependency)
 * - Streamable HTTP transport for cross-process communication
 * - CDP endpoint connection to existing Chrome instances
 * - Dynamic port allocation for multi-agent support
 */

export interface EmbeddedMCPServerOptions {
  /** Chrome CDP port to connect to */
  chromePort: number;
  /** Chrome host (default: localhost) */
  chromeHost?: string;
  /** Preferred MCP server port (will find available if occupied) */
  preferredPort?: number;
}

export interface EmbeddedMCPServerInfo {
  /** Actual port the server is listening on */
  port: number;
  /** Server URL for HTTP connection */
  url: string;
}

/**
 * Embedded MCP Server instance
 *
 * Wraps Playwright MCP with Streamable HTTP transport for use in Electron packaged apps.
 */
export class EmbeddedMCPServer {
  private httpServer: http.Server | null = null;
  private connection: Awaited<ReturnType<typeof createConnection>> | null = null;
  private transport: StreamableHTTPServerTransport | null = null;
  private port: number = 0;
  private isRunning: boolean = false;

  private chromePort: number;
  private chromeHost: string;

  constructor(options: EmbeddedMCPServerOptions) {
    this.chromePort = options.chromePort;
    this.chromeHost = options.chromeHost || "localhost";
  }

  /**
   * Start the embedded MCP server
   *
   * @param preferredPort - Preferred port to listen on (will find available if occupied)
   * @returns Server info including actual port and URL
   */
  async start(preferredPort: number = 3999): Promise<EmbeddedMCPServerInfo> {
    if (this.isRunning) {
      return {
        port: this.port,
        url: `http://127.0.0.1:${this.port}`,
      };
    }

    // Find available port starting from preferredPort
    this.port = await this.findAvailablePort(preferredPort);

    console.log(`[EmbeddedMCPServer] Starting on port ${this.port}...`);
    console.log(`[EmbeddedMCPServer] Connecting to Chrome CDP at ${this.chromeHost}:${this.chromePort}`);

    // Create Playwright MCP connection with CDP endpoint
    // Retry logic to handle race condition where Chrome may not be fully ready
    const cdpEndpoint = `http://${this.chromeHost}:${this.chromePort}`;
    const maxRetries = 5;
    const retryDelayMs = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // First, verify Chrome CDP is responding
        await this.waitForCDPReady(cdpEndpoint, 5000);

        this.connection = await createConnection({
          browser: {
            cdpEndpoint,
          },
          capabilities: ["core", "core-tabs"],
        });

        // Create Streamable HTTP transport
        this.transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
        });

        // Connect the MCP server to the transport
        await this.connection.connect(this.transport);

        console.log("[EmbeddedMCPServer] MCP connection established");
        break; // Success, exit retry loop
      } catch (error) {
        console.warn(`[EmbeddedMCPServer] Connection attempt ${attempt}/${maxRetries} failed:`, error);

        if (attempt === maxRetries) {
          console.error("[EmbeddedMCPServer] Failed to create MCP connection after all retries");
          throw error;
        }

        // Wait before retrying
        await this.delay(retryDelayMs);
      }
    }

    return new Promise((resolve, reject) => {
      this.httpServer = http.createServer(async (req, res) => {
        // Security: No CORS headers needed since this is local server-to-server communication
        // The MCP client (Next.js server) connects directly, not via browser

        // Health check endpoint
        if (req.url === "/health" && req.method === "GET") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "ok", port: this.port }));
          return;
        }

        // MCP endpoint - handle all MCP requests via Streamable HTTP transport
        if (req.url === "/mcp" || req.url?.startsWith("/mcp?")) {
          try {
            await this.transport!.handleRequest(req, res);
          } catch (error) {
            console.error("[EmbeddedMCPServer] Request handling error:", error);
            if (!res.headersSent) {
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: String(error) }));
            }
          }
          return;
        }

        // Unknown endpoint
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
      });

      this.httpServer.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE") {
          // Port is in use, try next port
          this.httpServer?.close();
          this.findAvailablePort(this.port + 1)
            .then((newPort) => {
              this.port = newPort;
              // Bind to localhost only for security
              // Important: Must provide callback to resolve the Promise
              this.httpServer?.listen(this.port, "127.0.0.1", () => {
                this.isRunning = true;
                console.log(`[EmbeddedMCPServer] Server started on 127.0.0.1:${this.port} (after retry)`);
                resolve({
                  port: this.port,
                  url: `http://127.0.0.1:${this.port}`,
                });
              });
            })
            .catch(reject);
        } else {
          reject(error);
        }
      });

      // Security: Bind to localhost (127.0.0.1) only, not all interfaces
      // This ensures the MCP server is not accessible from LAN/external networks
      this.httpServer.listen(this.port, "127.0.0.1", () => {
        this.isRunning = true;
        console.log(`[EmbeddedMCPServer] Server started on 127.0.0.1:${this.port}`);
        resolve({
          port: this.port,
          url: `http://127.0.0.1:${this.port}`,
        });
      });
    });
  }

  /**
   * Stop the embedded MCP server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log(`[EmbeddedMCPServer] Stopping server on port ${this.port}...`);

    // Close transport first
    if (this.transport) {
      try {
        await this.transport.close();
      } catch (error) {
        console.warn("[EmbeddedMCPServer] Error closing transport:", error);
      }
      this.transport = null;
    }

    // Close connection
    if (this.connection) {
      try {
        await this.connection.close();
      } catch (error) {
        console.warn("[EmbeddedMCPServer] Error closing connection:", error);
      }
      this.connection = null;
    }

    // Close HTTP server
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve());
      });
      this.httpServer = null;
    }

    this.isRunning = false;
    console.log("[EmbeddedMCPServer] Server stopped");
  }

  /**
   * Check if server is running
   */
  getStatus(): { running: boolean; port: number } {
    return {
      running: this.isRunning,
      port: this.port,
    };
  }

  /**
   * Find an available port starting from the given port
   */
  private async findAvailablePort(startPort: number): Promise<number> {
    let port = startPort;
    const maxAttempts = 100;

    for (let i = 0; i < maxAttempts; i++) {
      const isAvailable = await this.isPortAvailable(port);
      if (isAvailable) {
        return port;
      }
      port++;
    }

    throw new Error(`No available port found in range ${startPort}-${startPort + maxAttempts}`);
  }

  /**
   * Check if a port is available
   */
  private isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = http.createServer();

      server.once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          resolve(false);
        } else {
          resolve(false);
        }
      });

      server.once("listening", () => {
        server.close(() => resolve(true));
      });

      server.listen(port);
    });
  }

  /**
   * Wait for Chrome CDP endpoint to be ready
   */
  private async waitForCDPReady(cdpEndpoint: string, timeout: number): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 500;

    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(`${cdpEndpoint}/json/version`, {
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok) {
          return; // CDP is ready
        }
      } catch {
        // Not ready yet, continue waiting
      }
      await this.delay(checkInterval);
    }

    throw new Error(`Chrome CDP endpoint not ready after ${timeout}ms`);
  }

  /**
   * Helper to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create an embedded MCP server
 */
export function createEmbeddedMCPServer(options: EmbeddedMCPServerOptions): EmbeddedMCPServer {
  return new EmbeddedMCPServer(options);
}
