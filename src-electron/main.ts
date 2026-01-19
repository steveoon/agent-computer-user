import { app, BrowserWindow, protocol, dialog } from "electron";
import { createHandler } from "next-electron-rsc";
import path from "path";
import fs from "fs";
import { fixPath } from "./fix-path";
import { initializeAgentManager, getAgentManager } from "./agent-manager";
import { registerAgentHandlers, unregisterAgentHandlers } from "./ipc/agent-handlers";
import { registerSystemHandlers, unregisterSystemHandlers } from "./ipc/system-handlers";
import {
  earlyLog,
  clearEarlyLog,
  initializeLogger,
  getLogger,
  isDebugModeRequested,
} from "./logger";

// Fix PATH before any other code runs (for macOS/Linux GUI apps)
fixPath();

// Clear early log and record startup
clearEarlyLog();
earlyLog("All imports completed successfully");

// Environment detection
const isDev = process.env.NODE_ENV === "development";
const isDebugMode = isDebugModeRequested();
earlyLog(`isDev: ${isDev}, debugMode: ${isDebugMode}`);

// Global references
let mainWindow: BrowserWindow | null = null;
let stopIntercept: (() => void) | null = null;

// Create Next.js handler (only used in production)
// IMPORTANT: createHandler must be called BEFORE app.whenReady() to register custom schemes
let nextHandler: ReturnType<typeof createHandler> | null = null;

// Paths are initialized lazily after app is ready
let paths: {
  appPath: string;
  userDataPath: string;
  nextDir: string;
  agentConfigPath: string;
  agentLogsPath: string;
  agentPidsPath: string;
  agentTemplatesPath: string;
} | null = null;

// Initialize Next.js handler BEFORE app is ready (required for protocol registration)
// Use earlyLog here since logger isn't initialized yet
earlyLog("[Main] Starting Electron app...");
earlyLog(`[Main] NODE_ENV: ${process.env.NODE_ENV}`);
earlyLog(`[Main] app.isPackaged: ${app.isPackaged}`);

if (!isDev) {
  try {
    const appPath = app.getAppPath();
    const nextDir = path.join(appPath, ".next", "standalone");

    earlyLog(`[Main] appPath: ${appPath}`);
    earlyLog(`[Main] nextDir: ${nextDir}`);

    const nextDirExists = fs.existsSync(nextDir);
    earlyLog(`[Main] nextDir exists: ${nextDirExists}`);

    if (nextDirExists) {
      const files = fs.readdirSync(nextDir);
      earlyLog(`[Main] nextDir contents: ${files.slice(0, 5).join(", ")}...`);
    }

    nextHandler = createHandler({
      protocol,
      dev: false,
      dir: nextDir,
      debug: isDebugMode, // Only enable debug output in debug mode
    });
    earlyLog("[Main] Next.js handler initialized for production mode");
  } catch (error) {
    earlyLog(`[Main] Failed to create Next.js handler: ${error}`);
  }
}

/**
 * Initialize paths after app is ready
 */
function initPaths(): void {
  const appPath = app.getAppPath();
  const userDataPath = app.getPath("userData");

  paths = {
    appPath,
    userDataPath,
    nextDir: path.join(appPath, ".next", "standalone"),
    agentConfigPath: path.join(userDataPath, "agents.json"),
    agentLogsPath: path.join(userDataPath, "logs"),
    agentPidsPath: path.join(userDataPath, "pids"),
    agentTemplatesPath: path.join(appPath, "configs", "agent-templates.json"),
  };
}

async function createWindow(): Promise<void> {
  const log = getLogger();

  // Only allow DevTools in development mode or debug mode
  const allowDevTools = isDev || isDebugMode;

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      devTools: allowDevTools, // Disable DevTools in production (unless debug mode)
    },
    show: false,
  });

  log.debug(`[Main] DevTools enabled: ${allowDevTools}`);

  // IMPORTANT: Register event listeners BEFORE loading URL to avoid race conditions
  mainWindow.once("ready-to-show", () => {
    log.info("[Main] ready-to-show event fired, showing window");
    mainWindow?.show();

    // Show debug mode notification
    if (isDebugMode && !isDev) {
      dialog.showMessageBox(mainWindow!, {
        type: "info",
        title: "调试模式",
        message: "应用正在以调试模式运行",
        detail: `日志文件位置:\n${log.getDebugLogPath()}`,
        buttons: ["确定"],
      });
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Load the app
  if (isDev) {
    log.info("Development mode: connecting to http://localhost:3000");
    await mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools();
  } else {
    if (!nextHandler) {
      log.error("[Main] ERROR: Next.js handler not initialized!");
      throw new Error("Next.js handler not initialized");
    }

    log.debug("[Main] Creating interceptor...");
    stopIntercept = await nextHandler.createInterceptor({
      session: mainWindow.webContents.session,
    });

    log.info("Production mode: loading via protocol interception");
    log.debug("Localhost URL:", nextHandler.localhostUrl);
    await mainWindow.loadURL(nextHandler.localhostUrl);
    log.info("[Main] URL loaded successfully");

    // Open DevTools in debug mode for production builds
    if (isDebugMode) {
      log.info("[Main] Debug mode: opening DevTools");
      mainWindow.webContents.openDevTools();
    }
  }
}

/**
 * Initialize Agent Manager
 */
async function initAgentManager(): Promise<void> {
  const log = getLogger();

  if (!paths) {
    throw new Error("Paths not initialized");
  }

  try {
    const agentManager = await initializeAgentManager({
      configPath: paths.agentConfigPath,
      logsPath: paths.agentLogsPath,
      pidsPath: paths.agentPidsPath,
      templatesPath: paths.agentTemplatesPath,
    });

    registerAgentHandlers(agentManager);
    log.info("Agent manager initialized successfully");
  } catch (error) {
    log.error("Failed to initialize agent manager:", error);
  }
}

// App lifecycle
app.whenReady().then(async () => {
  // Initialize paths first
  initPaths();

  // Initialize logger (now we have access to userData)
  const log = initializeLogger(isDebugMode);
  log.info("[Main] App ready, logger initialized");
  log.info(`[Main] Debug mode: ${isDebugMode}`);
  log.info(`[Main] User data path: ${paths?.userDataPath}`);

  // Register system IPC handlers
  registerSystemHandlers();

  await initAgentManager();
  await createWindow();
});

app.on("window-all-closed", async () => {
  const log = getLogger();

  // Clean up agent manager
  try {
    const agentManager = getAgentManager();
    await agentManager.shutdown();
    unregisterAgentHandlers();
    unregisterSystemHandlers();
    log.info("Cleanup completed");
  } catch {
    // Manager might not be initialized
  }

  if (stopIntercept) {
    stopIntercept();
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  const log = getLogger();
  log.error("Uncaught exception:", error);
  log.error("Stack:", error.stack);
});

process.on("unhandledRejection", (reason, promise) => {
  const log = getLogger();
  log.error("Unhandled rejection at:", promise, "reason:", reason);
});

/**
 * Development mode: Test multi-agent functionality
 * Run this by setting TEST_MULTI_AGENT=true
 */
async function runMultiAgentTest(): Promise<void> {
  if (!isDev || process.env.TEST_MULTI_AGENT !== "true") {
    return;
  }

  const log = getLogger();
  log.info("\n========== Multi-Agent Test Starting ==========\n");

  try {
    const agentManager = getAgentManager();

    log.info("[Test 1] Getting templates...");
    const templates = agentManager.getTemplates();
    log.info("Available templates:", Object.keys(templates));

    log.info("\n[Test 2] Listing agents...");
    const initialAgents = await agentManager.listAgents();
    log.info(`Initial agent count: ${initialAgents.length}`);

    log.info("\n[Test 3] Adding 3 zhipin agents...");
    const addedAgents = await agentManager.addAgents("zhipin", { count: 3 });
    log.info(`Added ${addedAgents.length} agents`);

    log.info("\n[Test 4] Starting all agents...");
    await agentManager.startAgent();
    log.info("Start command completed");

    await new Promise((resolve) => setTimeout(resolve, 5000));

    log.info("\n[Test 5] Checking agent status...");
    const runningAgents = await agentManager.listAgents();
    for (const agent of runningAgents) {
      log.info(`  - ${agent.id}: status=${agent.status}`);
    }

    log.info("\n[Test 6] Stopping all agents...");
    await agentManager.stopAgent();
    log.info("Stop command completed");

    await new Promise((resolve) => setTimeout(resolve, 3000));

    log.info("\n[Test 7] Removing test agents...");
    for (const agent of addedAgents) {
      await agentManager.removeAgent(agent.id);
      log.info(`  Removed: ${agent.id}`);
    }

    log.info("\n========== Multi-Agent Test Completed ==========\n");
  } catch (error) {
    const log = getLogger();
    log.error("\n========== Multi-Agent Test Failed ==========");
    log.error(String(error));
  }
}

// Run test if requested (must be called after app is ready)
app.whenReady().then(async () => {
  setTimeout(() => {
    runMultiAgentTest().catch((e) => getLogger().error(e));
  }, 3000);
});
