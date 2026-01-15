import { app } from "electron";
import fs from "fs";
import path from "path";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LoggerConfig {
  debugMode: boolean;
  logDir: string;
}

// Log level priority (higher = more severe)
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Singleton logger instance
let loggerInstance: Logger | null = null;

/**
 * Logger class with level-based filtering and file output
 * - Production: only errors go to file, minimal console output
 * - Debug mode: all logs go to file and console
 */
class Logger {
  private config: LoggerConfig;
  private appLogPath: string;
  private debugLogPath: string;
  private minLevel: LogLevel;

  constructor(config: LoggerConfig) {
    this.config = config;
    this.minLevel = config.debugMode ? "debug" : "error";

    // Ensure log directory exists
    if (!fs.existsSync(config.logDir)) {
      fs.mkdirSync(config.logDir, { recursive: true });
    }

    this.appLogPath = path.join(config.logDir, "app.log");
    this.debugLogPath = path.join(config.logDir, "debug.log");

    // Clear debug log on startup (only in debug mode)
    if (config.debugMode) {
      this.initLogFile(this.debugLogPath, "Debug Log");
    }

    // Always maintain app.log for critical events
    this.initLogFile(this.appLogPath, "Application Log");
  }

  private initLogFile(filePath: string, title: string): void {
    const header = `=== ${title} - ${new Date().toISOString()} ===\n`;
    try {
      fs.writeFileSync(filePath, header);
    } catch {
      // Silently fail if we can't write
    }
  }

  private formatMessage(level: LogLevel, args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase().padEnd(5);
    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
      )
      .join(" ");
    return `[${timestamp}] [${levelStr}] ${message}`;
  }

  private writeToFile(filePath: string, message: string): void {
    try {
      fs.appendFileSync(filePath, message + "\n");
    } catch {
      // Silently fail
    }
  }

  private log(level: LogLevel, ...args: unknown[]): void {
    const levelPriority = LOG_LEVELS[level];
    const minPriority = LOG_LEVELS[this.minLevel];

    // Skip if below minimum level (unless it's an error, always log errors)
    if (levelPriority < minPriority && level !== "error") {
      return;
    }

    const formattedMessage = this.formatMessage(level, args);

    // Console output
    if (this.config.debugMode || level === "error") {
      const consoleMethod = level === "error" ? console.error : console.log;
      consoleMethod(...args);
    }

    // File output
    if (this.config.debugMode) {
      // Debug mode: write everything to debug.log
      this.writeToFile(this.debugLogPath, formattedMessage);
    }

    // Always write errors and important info to app.log
    if (level === "error" || level === "warn") {
      this.writeToFile(this.appLogPath, formattedMessage);
    }
  }

  debug(...args: unknown[]): void {
    this.log("debug", ...args);
  }

  info(...args: unknown[]): void {
    this.log("info", ...args);
  }

  warn(...args: unknown[]): void {
    this.log("warn", ...args);
  }

  error(...args: unknown[]): void {
    this.log("error", ...args);
  }

  /**
   * Get the path to the debug log file
   */
  getDebugLogPath(): string {
    return this.debugLogPath;
  }

  /**
   * Get the path to the app log file
   */
  getAppLogPath(): string {
    return this.appLogPath;
  }

  /**
   * Check if debug mode is enabled
   */
  isDebugMode(): boolean {
    return this.config.debugMode;
  }
}

/**
 * Detect if debug/verbose mode was requested
 * Checked via environment variable or command line argument
 */
export function isDebugModeRequested(): boolean {
  // Check environment variable
  if (process.env.DEBUG_MODE === "true") {
    return true;
  }

  // Check command line arguments (--verbose or -v)
  // Note: --debug is reserved by Node.js/Electron
  if (process.argv.includes("--verbose") || process.argv.includes("-v")) {
    return true;
  }

  return false;
}

/**
 * Initialize the logger singleton
 * Must be called after app is ready (to access userData path)
 */
export function initializeLogger(debugMode?: boolean): Logger {
  if (loggerInstance) {
    return loggerInstance;
  }

  // Determine log directory
  let logDir: string;
  try {
    logDir = path.join(app.getPath("userData"), "logs");
  } catch {
    // Fallback if app not ready
    logDir = path.join(
      process.env.HOME || process.env.USERPROFILE || "/tmp",
      ".ai-recruitment-assistant",
      "logs"
    );
  }

  const isDebug = debugMode ?? isDebugModeRequested();

  loggerInstance = new Logger({
    debugMode: isDebug,
    logDir,
  });

  // Log initial state
  loggerInstance.info(`Logger initialized (debug mode: ${isDebug})`);
  loggerInstance.info(`Log directory: ${logDir}`);

  return loggerInstance;
}

/**
 * Get the logger instance
 * Returns a no-op logger if not initialized
 */
export function getLogger(): Logger {
  if (!loggerInstance) {
    // Return a temporary console-only logger
    return {
      debug: console.log,
      info: console.log,
      warn: console.warn,
      error: console.error,
      getDebugLogPath: () => "",
      getAppLogPath: () => "",
      isDebugMode: () => false,
    } as Logger;
  }
  return loggerInstance;
}

/**
 * Early logging function for use before app is ready
 * Writes to a fixed location in home directory
 */
const earlyLogPath = path.join(
  process.env.HOME || process.env.USERPROFILE || "/tmp",
  "electron-early.log"
);

export function earlyLog(message: string): void {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try {
    fs.appendFileSync(earlyLogPath, line);
  } catch {
    // Silently fail
  }
}

export function clearEarlyLog(): void {
  try {
    fs.writeFileSync(earlyLogPath, `=== Electron Early Log ===\n`);
  } catch {
    // Silently fail
  }
}
