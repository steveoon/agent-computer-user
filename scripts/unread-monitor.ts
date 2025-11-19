#!/usr/bin/env tsx

/**
 * 未读消息监听服务
 *
 * 功能：
 * 1. 使用 Puppeteer 控制浏览器
 * 2. 定期检测 Boss直聘/鱼泡的未读消息
 * 3. 发现未读后自动在 Huajune 聊天界面填入处理指令
 * 4. 触发 Agent 自动处理未读消息
 *
 * 运行方式：
 * 方式 1（推荐）: 从 configs/agents.json 自动读取配置
 *   AGENT_ID=zhipin-1 pnpm monitor:start
 *
 * 方式 2: 手动指定参数
 *   BROWSER_URL=http://localhost:9222 \
 *   AGENT_URL=http://localhost:3000 \
 *   ENABLED_BRANDS=boss-zhipin \
 *   pnpm monitor:start
 */

import puppeteer, { Browser, Page } from "puppeteer";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

type BrandKey = "boss-zhipin" | "yupao";

// ==================== 配置定义 ====================

/**
 * Agent 配置 Schema（来自 configs/agents.json）
 */
const AgentConfigSchema = z.object({
  id: z.string(),
  type: z.string(), // "zhipin" | "yupao"
  name: z.string(),
  description: z.string(),
  appPort: z.number(),
  chromePort: z.number(),
  userDataDir: z.string(),
  chromeArgs: z.array(z.string()),
  env: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});

const AgentsConfigFileSchema = z.object({
  agents: z.array(AgentConfigSchema),
  settings: z.object({
    chromeExecutable: z.string(),
    userDataDirBase: z.string(),
    logsDir: z.string(),
    pidsDir: z.string(),
    healthCheckTimeout: z.number(),
    healthCheckInterval: z.number(),
    startPort: z.number(),
    startChromePort: z.number(),
  }),
});

type AgentConfig = z.infer<typeof AgentConfigSchema>;

/**
 * Agent type 到品牌名称的映射
 */
const AGENT_TYPE_TO_BRAND: Record<string, BrandKey> = {
  zhipin: "boss-zhipin",
  yupao: "yupao",
};

const MonitorConfigSchema = z.object({
  /** 轮询间隔（毫秒） */
  pollingInterval: z.number().min(10000).default(30000), // 默认 30 秒
  /** Huajune 聊天页面 URL */
  chatPageUrl: z.string().url().default("http://localhost:3000"),
  /** 启用的品牌 */
  enabledBrands: z.array(z.enum(["boss-zhipin", "yupao"])).default(["boss-zhipin"]),
  /** 是否自动提交（false 则只填充不提交） */
  autoSubmit: z.boolean().default(false),
  /** 工作时间限制 */
  workingHours: z
    .object({
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
    })
    .optional(),
  /** 浏览器 WebSocket 端点（连接到已有浏览器） */
  browserWSEndpoint: z.string().optional(),
  /** 浏览器 CDP URL（连接到已有浏览器，优先级低于 browserWSEndpoint） */
  browserURL: z.string().optional().default("http://localhost:9222"),
  /** 兜底检查间隔（毫秒），用于检查未回复的消息 */
  fallbackCheckInterval: z.number().min(60000).default(600000), // 默认 10 分钟
  /** 兜底检查指令 */
  fallbackPrompt: z
    .string()
    .default("检查对话列表，找出对方发送了消息但我们还没有回复的候选人，并逐个回复"),
});

type MonitorConfig = z.infer<typeof MonitorConfigSchema>;

// 默认配置
const DEFAULT_CONFIG: MonitorConfig = {
  pollingInterval: 30000, // 默认30秒轮询一次
  chatPageUrl: "http://localhost:3000",
  enabledBrands: ["boss-zhipin"],
  autoSubmit: false, // 默认只填充，不自动提交
  browserURL: "http://localhost:9222", // 默认连接到 multi-agent.sh 启动的 Chrome
  fallbackCheckInterval: 600000, // 默认 10 分钟
  fallbackPrompt: "检查对话列表，找出对方发送了消息但我们还没有回复的候选人，并逐个回复",
};

const BROWSER_VIEWPORT = { width: 1920, height: 1080 } as const;
const LOGIN_WAIT_DURATION_MS = 30000; // 间隔30秒后开始监听
const AGENT_PROCESS_WAIT_MS = 60000; // 等待1分钟让Agent处理完成

const WAIT_UNTIL_OPTIONS = { waitUntil: "networkidle2" as const };

// ==================== 工具函数 ====================

/**
 * 检查当前是否在工作时间内
 */
function isWithinWorkingHours(config: MonitorConfig): boolean {
  if (!config.workingHours) return true;

  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  return currentTime >= config.workingHours.start && currentTime <= config.workingHours.end;
}

/**
 * 格式化日志时间
 */
function formatTime(): string {
  return new Date().toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * 日志函数
 */
const logger = {
  info: (msg: string) => console.log(`[${formatTime()}] ℹ️  ${msg}`),
  success: (msg: string) => console.log(`[${formatTime()}] ✅ ${msg}`),
  warn: (msg: string) => console.warn(`[${formatTime()}] ⚠️  ${msg}`),
  error: (msg: string) => console.error(`[${formatTime()}] ❌ ${msg}`),
};

const parsePollInterval = (input: string | undefined): number => {
  if (!input) return DEFAULT_CONFIG.pollingInterval;

  const parsed = parseInt(input, 10);
  if (!Number.isFinite(parsed) || parsed < 10000) {
    logger.warn(
      `⚠️  POLL_INTERVAL 配置无效: "${input}"（需要 >= 10000 的数字，如 "30000" 表示 30 秒）`
    );
    logger.warn(`⚠️  使用默认值: ${DEFAULT_CONFIG.pollingInterval}ms`);
    return DEFAULT_CONFIG.pollingInterval;
  }

  return parsed;
};

const parseFallbackInterval = (input: string | undefined): number => {
  if (!input) return DEFAULT_CONFIG.fallbackCheckInterval;

  const parsed = parseInt(input, 10);
  if (!Number.isFinite(parsed) || parsed < 60000) {
    logger.warn(
      `⚠️  FALLBACK_CHECK_INTERVAL 配置无效: "${input}"（需要 >= 60000 的数字，如 "600000" 表示 10 分钟）`
    );
    logger.warn(`⚠️  使用默认值: ${DEFAULT_CONFIG.fallbackCheckInterval}ms`);
    return DEFAULT_CONFIG.fallbackCheckInterval;
  }

  return parsed;
};

const parseEnabledBrands = (input: string | undefined): BrandKey[] => {
  if (!input) return DEFAULT_CONFIG.enabledBrands;

  const brands = input
    .split(",")
    .map(brand => brand.trim())
    .filter((brand): brand is BrandKey => brand === "boss-zhipin" || brand === "yupao");

  if (brands.length === 0) {
    logger.warn(`⚠️  ENABLED_BRANDS 配置无效: "${input}"（支持: boss-zhipin, yupao）`);
    logger.warn(`⚠️  使用默认值: ${DEFAULT_CONFIG.enabledBrands.join(", ")}`);
    return DEFAULT_CONFIG.enabledBrands;
  }

  return brands;
};

const warnUnsupportedConnectArgs = (): void => {
  if (process.env.HEADLESS) {
    logger.warn("⚠️  HEADLESS 参数在 connect 模式下无效");
    logger.warn("💡 请在启动 Chrome 时使用 --headless 参数");
  }
  if (process.env.USER_DATA_DIR) {
    logger.warn("⚠️  USER_DATA_DIR 参数在 connect 模式下无效");
    logger.warn("💡 请在启动 Chrome 时使用 --user-data-dir 参数");
  }
};

/**
 * 从 configs/agents.json 读取 Agent 配置
 */
function loadAgentConfig(agentId: string): AgentConfig | null {
  try {
    // 获取项目根目录（scripts 的上级目录）
    const projectRoot = path.resolve(__dirname, "..");
    const configPath = path.join(projectRoot, "configs", "agents.json");

    // 检查文件是否存在
    if (!fs.existsSync(configPath)) {
      logger.error(`配置文件不存在: ${configPath}`);
      logger.info("请先使用 multi-agent.sh 创建 Agent");
      return null;
    }

    // 读取并解析配置文件
    const configContent = fs.readFileSync(configPath, "utf-8");
    const configData = JSON.parse(configContent);

    // 验证配置格式
    const validatedConfig = AgentsConfigFileSchema.parse(configData);

    // 查找指定的 Agent
    const agent = validatedConfig.agents.find(a => a.id === agentId);

    if (!agent) {
      logger.error(`未找到 Agent: ${agentId}`);
      logger.info("可用的 Agent ID:");
      validatedConfig.agents.forEach(a => {
        logger.info(`  - ${a.id} (${a.name})`);
      });
      return null;
    }

    logger.success(`成功加载 Agent 配置: ${agent.name}`);
    return agent;
  } catch (error) {
    logger.error(`读取 Agent 配置失败: ${error}`);
    return null;
  }
}

/**
 * 根据 Agent 配置构建监听配置
 */
function buildMonitorConfigFromAgent(agent: AgentConfig): Partial<MonitorConfig> {
  const brand = AGENT_TYPE_TO_BRAND[agent.type];

  if (!brand) {
    logger.warn(`未知的 Agent 类型: ${agent.type}，将使用默认品牌配置`);
  }

  return {
    browserURL: `http://localhost:${agent.chromePort}`,
    chatPageUrl: `http://localhost:${agent.appPort}`,
    enabledBrands: brand ? [brand] : DEFAULT_CONFIG.enabledBrands,
  };
}

// ==================== 未读消息检测 ====================

/**
 * Boss直聘选择器（来自 lib/tools/zhipin/constants.ts）
 */
const BOSS_ZHIPIN_SELECTORS = {
  unreadBadge: ".badge-count", // 未读徽章
  geekItem: ".geek-item", // 候选人列表项
  container: ".chat-list-wrap", // 聊天列表容器
} as const;

/**
 * 鱼泡动态选择器工具
 * 使用自适应选择器处理 CSS 模块哈希变化
 */
function createDynamicClassSelector(baseClassName: string): string {
  return `[class*="${baseClassName}_"]`;
}

function getYupaoAdaptiveSelectors(elementType: string): string[] {
  const selectors: Record<string, string[]> = {
    convItem: [createDynamicClassSelector("_convItem"), 'div[style*="padding: 0px 12px"] > div'],
    unreadNum: [
      `${createDynamicClassSelector("_imageBox")} ${createDynamicClassSelector("_unreadNum")}`,
      createDynamicClassSelector("_unreadNum"),
      'div:has(img[width="40"]) > span:not([class*="name"])',
    ],
  };
  return selectors[elementType] || [];
}

interface UnreadMessage {
  brand: BrandKey;
  count: number;
  candidates?: string[]; // 候选人名称列表（可选）
}

/**
 * 检测 Boss直聘 未读消息
 * 使用经过验证的选择器（与 get-unread-candidates-improved.tool.ts 一致）
 */
async function checkBossZhipinUnread(page: Page): Promise<UnreadMessage | null> {
  try {
    // 1. 先找到所有候选人项（聊天列表项）
    const geekItems = await page.$$(BOSS_ZHIPIN_SELECTORS.geekItem);

    let totalUnread = 0;
    let candidatesWithUnread = 0;

    // 2. 遍历每个候选人项，在其内部查找未读徽章
    for (const item of geekItems) {
      // 在当前候选人项内部查找未读徽章
      const badge = await item.$(BOSS_ZHIPIN_SELECTORS.unreadBadge);

      if (badge) {
        candidatesWithUnread++;

        // 获取未读数量
        const countText = await badge.evaluate(el => el.textContent?.trim());

        if (countText) {
          const match = countText.match(/\d+/);
          const count = match ? parseInt(match[0]) : 1;
          totalUnread += count;
        } else {
          totalUnread += 1; // 红点但没数字，算 1 条
        }
      }
    }

    if (totalUnread > 0) {
      logger.info(`Boss直聘发现 ${totalUnread} 条未读消息（${candidatesWithUnread} 个候选人）`);
      return { brand: "boss-zhipin", count: totalUnread };
    }

    return null;
  } catch (error) {
    logger.error(`检测 Boss直聘 未读消息失败: ${error}`);
    return null;
  }
}

/**
 * 检测鱼泡未读消息
 * 使用动态选择器处理 CSS 模块哈希变化（与 get-unread-messages.tool.ts 一致）
 * 注意：使用字符串脚本而非函数传递，避免 tsx/esbuild 的 __name 序列化问题
 */
async function checkYupaoUnread(page: Page): Promise<UnreadMessage | null> {
  try {
    // 预先计算选择器数组（在 Node.js 端）
    const convItemSelectors = getYupaoAdaptiveSelectors("convItem");
    const unreadNumSelectors = getYupaoAdaptiveSelectors("unreadNum");

    // 使用字符串脚本在浏览器端执行，避免函数序列化问题
    const script = `
      (function() {
        // 定义查找元素的函数
        function findElement(element, patterns) {
          for (const pattern of patterns) {
            try {
              const found = element.querySelector(pattern);
              if (found) return found;
            } catch (e) {
              // 某些选择器可能不被支持，继续尝试下一个
            }
          }
          return null;
        }

        // 选择器配置
        const convItemSelectors = ${JSON.stringify(convItemSelectors)};
        const unreadNumSelectors = ${JSON.stringify(unreadNumSelectors)};

        // 查找所有对话项
        let convItems = [];
        for (const selector of convItemSelectors) {
          try {
            const items = document.querySelectorAll(selector);
            if (items.length > 0) {
              convItems = Array.from(items);
              break;
            }
          } catch (e) {
            // 继续尝试下一个选择器
          }
        }

        if (convItems.length === 0) {
          return { totalUnread: 0, candidateCount: 0 };
        }

        // 统计未读消息
        let totalUnread = 0;
        let candidateCount = 0;

        for (const item of convItems) {
          const unreadElement = findElement(item, unreadNumSelectors);
          if (unreadElement) {
            const countText = unreadElement.textContent ? unreadElement.textContent.trim() : '';
            if (countText && /^\\d+$/.test(countText)) {
              totalUnread += parseInt(countText, 10);
              candidateCount++;
            }
          }
        }

        return { totalUnread: totalUnread, candidateCount: candidateCount };
      })()
    `;

    const result = await page.evaluate(script) as { totalUnread: number; candidateCount: number };

    if (result.totalUnread > 0) {
      logger.info(`鱼泡发现 ${result.totalUnread} 条未读消息（${result.candidateCount} 个候选人）`);
      return { brand: "yupao", count: result.totalUnread };
    }

    return null;
  } catch (error) {
    logger.error(`检测鱼泡未读消息失败: ${error}`);
    return null;
  }
}

// ==================== Huajune 界面操作 ====================

interface BrandHandler {
  key: BrandKey;
  displayName: string;
  startUrl: string;
  loginMessage: string;
  checkUnread: (page: Page) => Promise<UnreadMessage | null>;
}

const BRAND_HANDLERS: Record<BrandKey, BrandHandler> = {
  "boss-zhipin": {
    key: "boss-zhipin",
    displayName: "Boss直聘",
    startUrl: "https://www.zhipin.com/web/geek/chat",
    loginMessage: "已打开 Boss直聘 聊天页面，请手动登录",
    checkUnread: checkBossZhipinUnread,
  },
  yupao: {
    key: "yupao",
    displayName: "鱼泡",
    startUrl: "https://www.yupao.com/message",
    loginMessage: "已打开鱼泡消息页面，请手动登录",
    checkUnread: checkYupaoUnread,
  },
};

/**
 * 在 Huajune 聊天界面填充处理指令
 * @param customPrompt 可选的自定义提示词，如果提供则忽略 unread 参数
 */
async function fillChatInput(
  page: Page,
  unread: UnreadMessage | null,
  autoSubmit: boolean,
  customPrompt?: string
): Promise<boolean> {
  try {
    // 等待页面加载
    await page.waitForSelector('textarea[aria-label="聊天输入框"]', { timeout: 5000 });

    // 构建提示词
    let prompt: string;
    if (customPrompt) {
      prompt = customPrompt;
    } else if (unread) {
      const brandName = BRAND_HANDLERS[unread.brand]?.displayName || unread.brand;
      prompt = `处理 ${brandName} 的 ${unread.count} 条未读消息`;
    } else {
      logger.error("fillChatInput: 需要 unread 或 customPrompt 参数");
      return false;
    }

    // 定位输入框
    const textarea = await page.$('textarea[aria-label="聊天输入框"]');
    if (!textarea) {
      logger.error("未找到聊天输入框");
      return false;
    }

    // 清空并填入新内容
    await textarea.click({ clickCount: 3 }); // 三击全选
    await textarea.type(prompt, { delay: 50 }); // 模拟真人输入速度

    logger.success(`已填充提示词: "${prompt}"`);

    // 如果启用自动提交
    if (autoSubmit) {
      // 方案1: 点击发送按钮
      const submitButton = await page.$('button[aria-label="发送消息"]');
      if (submitButton) {
        await submitButton.click();
        logger.success("已自动提交消息");
      } else {
        // 方案2: 模拟 Enter 键
        await textarea.press("Enter");
        logger.success("已通过 Enter 键提交消息");
      }
    } else {
      logger.info("已填充提示词，等待用户手动确认");
    }

    return true; // 成功
  } catch (error) {
    logger.error(`填充聊天输入框失败: ${error}`);
    return false; // 失败
  }
}

// ==================== 主监听逻辑 ====================

/**
 * 已处理状态记录
 */
interface ProcessedState {
  brand: BrandKey;
  unreadCount: number;
  lastTriggeredAt: number;
}

class UnreadMonitor {
  private browser: Browser | null = null;
  private chatPage: Page | null = null;
  private brandPages: Map<BrandKey, Page> = new Map();
  private config: MonitorConfig;
  private isRunning = false;
  private pollTimer: NodeJS.Timeout | null = null;
  /** 记录每个品牌上次触发时的未读数，避免重复触发 */
  private processedStates: Map<BrandKey, ProcessedState> = new Map();
  /** 暂停状态 */
  private isPaused = false;
  /** 下次检测的时间戳 */
  private nextPollTime: number = 0;
  /** 是否有待处理的立即检测请求 */
  private immediateCheckRequested = false;
  /** 上次兜底检查的时间戳 */
  private lastFallbackCheckTime: number = 0;

  constructor(config: MonitorConfig) {
    this.config = MonitorConfigSchema.parse(config);
  }

  /**
   * 设置键盘快捷键监听
   */
  private setupKeyboardControls(): void {
    // 检查是否在 TTY 环境
    if (!process.stdin.isTTY) {
      logger.warn("非 TTY 环境，键盘快捷键不可用");
      return;
    }

    // 启用按键事件
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);

    process.stdin.on("keypress", (_str, key) => {
      // Ctrl+C 退出
      if (key.ctrl && key.name === "c") {
        this.stop().then(() => process.exit(0));
        return;
      }

      // 空格：暂停/恢复
      if (key.name === "space") {
        this.togglePause();
        return;
      }

      // i：显示状态
      if (key.name === "i") {
        this.showStatus();
        return;
      }

      // r：立即检测
      if (key.name === "r") {
        this.triggerImmediateCheck();
        return;
      }
    });
  }

  /**
   * 切换暂停状态
   */
  private togglePause(): void {
    this.isPaused = !this.isPaused;

    if (this.isPaused) {
      logger.info("⏸️  已暂停监听（按空格恢复）");
    } else {
      logger.info("▶️  已恢复监听");
      // 恢复时立即执行一次检测
      this.triggerImmediateCheck();
    }
  }

  /**
   * 显示当前状态
   */
  private showStatus(): void {
    logger.info("");
    logger.info("📊 当前状态：");
    logger.info(`  - 监听状态：${this.isPaused ? "⏸️ 已暂停" : "▶️ 运行中"}`);

    // 显示各品牌状态
    for (const brand of this.config.enabledBrands) {
      const state = this.processedStates.get(brand);
      if (state) {
        const timeAgo = Math.round((Date.now() - state.lastTriggeredAt) / 1000);
        logger.info(`  - ${brand}: ${state.unreadCount} 条未读（${timeAgo}秒前触发）`);
      } else {
        logger.info(`  - ${brand}: 无未读记录`);
      }
    }

    // 显示下次检测时间
    if (!this.isPaused && this.nextPollTime > 0) {
      const secondsLeft = Math.max(0, Math.round((this.nextPollTime - Date.now()) / 1000));
      logger.info(`  - 下次检测：${secondsLeft} 秒后`);
    }

    // 显示下次兜底检查时间
    if (!this.isPaused && this.lastFallbackCheckTime > 0) {
      const nextFallbackTime = this.lastFallbackCheckTime + this.config.fallbackCheckInterval;
      const secondsToFallback = Math.max(0, Math.round((nextFallbackTime - Date.now()) / 1000));
      const minutesToFallback = Math.round(secondsToFallback / 60);
      logger.info(`  - 下次兜底检查：${minutesToFallback} 分钟后`);
    } else if (!this.isPaused) {
      logger.info(`  - 下次兜底检查：即将执行`);
    }

    logger.info("");
  }

  /**
   * 触发立即检测
   */
  private triggerImmediateCheck(): void {
    if (this.isPaused) {
      logger.warn("监听已暂停，请先按空格恢复");
      return;
    }

    logger.info("🔄 收到立即检测请求...");
    this.immediateCheckRequested = true;

    // 如果有等待中的定时器，取消它
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    // 立即执行轮询
    this.poll();
  }

  /**
   * 判断是否应该触发处理
   * 只有在未读数增加时才返回 true
   */
  private shouldTrigger(unread: UnreadMessage): boolean {
    const lastState = this.processedStates.get(unread.brand);

    // 首次检测到未读，触发
    if (!lastState) {
      logger.info(`${unread.brand}: 首次检测到 ${unread.count} 条未读，准备触发处理`);
      return true;
    }

    // 未读数增加了，触发
    if (unread.count > lastState.unreadCount) {
      logger.info(
        `${unread.brand}: 未读数从 ${lastState.unreadCount} 增加到 ${unread.count}，准备触发处理`
      );
      return true;
    }

    // 未读数减少或不变，不触发（可能是人工或 Agent 正在处理）
    if (unread.count < lastState.unreadCount) {
      logger.info(
        `${unread.brand}: 未读数从 ${lastState.unreadCount} 减少到 ${unread.count}，更新状态`
      );
      // 更新状态，但不触发
      this.processedStates.set(unread.brand, {
        brand: unread.brand,
        unreadCount: unread.count,
        lastTriggeredAt: lastState.lastTriggeredAt,
      });
      return false;
    }

    // 未读数不变，不触发
    logger.info(`${unread.brand}: 未读数保持 ${unread.count} 条，跳过处理`);
    return false;
  }

  /**
   * 记录触发状态
   */
  private recordTrigger(unread: UnreadMessage): void {
    this.processedStates.set(unread.brand, {
      brand: unread.brand,
      unreadCount: unread.count,
      lastTriggeredAt: Date.now(),
    });
    logger.success(`${unread.brand}: 已记录触发状态（未读数 ${unread.count}）`);
  }

  /**
   * 检查页面是否仍然有效（未被关闭）
   */
  private async isPageValid(page: Page): Promise<boolean> {
    try {
      // 尝试执行一个简单的操作来检查页面是否有效
      await page.evaluate(() => true);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 确保 chatPage 可用，如果被关闭则重新打开
   */
  private async ensureChatPageAvailable(): Promise<boolean> {
    if (!this.browser) {
      logger.error("浏览器连接已断开");
      return false;
    }

    // 检查 chatPage 是否存在且有效
    if (this.chatPage && (await this.isPageValid(this.chatPage))) {
      return true;
    }

    // chatPage 被关闭了，重新打开
    logger.warn("⚠️  聊天页面已被关闭，正在重新打开...");
    try {
      this.chatPage = await this.browser.newPage();
      await this.chatPage.setViewport(BROWSER_VIEWPORT);
      await this.chatPage.goto(this.config.chatPageUrl, WAIT_UNTIL_OPTIONS);
      logger.success(`已重新打开聊天页面: ${this.config.chatPageUrl}`);
      return true;
    } catch (error) {
      logger.error(`重新打开聊天页面失败: ${error}`);
      return false;
    }
  }

  /**
   * 启动监听服务
   */
  async start(): Promise<void> {
    logger.info("🚀 启动未读消息监听服务...");

    // 连接到已有浏览器（multi-agent.sh 或手动启动的 Chrome）
    const endpoint = this.config.browserWSEndpoint;
    const browserURL = this.config.browserURL;

    try {
      if (endpoint) {
        logger.info(`连接到浏览器 WebSocket: ${endpoint}`);
        this.browser = await puppeteer.connect({ browserWSEndpoint: endpoint });
      } else if (browserURL) {
        logger.info(`连接到浏览器 CDP: ${browserURL}`);
        this.browser = await puppeteer.connect({ browserURL });
      } else {
        throw new Error("未配置浏览器连接地址");
      }
      logger.success("已连接到共享浏览器实例");
    } catch (error) {
      logger.error(`连接浏览器失败: ${error}`);
      logger.warn("请确保浏览器已启动并开启远程调试");
      logger.info("");
      logger.info("📋 启动浏览器的方式：");
      logger.info("");
      logger.info("  方式1: 使用 multi-agent.sh 启动（推荐）");
      logger.info("    pnpm agent:start zhipin-1");
      logger.info("    # Chrome 端口在配置文件中定义");
      logger.info("");
      logger.info("  方式2: 手动启动 Chrome");
      logger.info("    macOS:");
      logger.info("      /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\");
      logger.info("        --remote-debugging-port=9222 \\");
      logger.info("        --user-data-dir=/tmp/chrome-monitor");
      logger.info("");
      logger.info("  然后设置环境变量:");
      logger.info("    export BROWSER_URL=http://localhost:9222");
      logger.info("    pnpm monitor:start");
      logger.info("");
      throw error;
    }

    // 打开 Huajune 聊天页面
    this.chatPage = await this.browser.newPage();
    await this.chatPage.setViewport(BROWSER_VIEWPORT); // 设置视口大小
    await this.chatPage.goto(this.config.chatPageUrl, WAIT_UNTIL_OPTIONS);
    logger.success(`已打开聊天页面: ${this.config.chatPageUrl}`);

    // 为每个品牌创建标签页（需要用户手动登录）
    for (const brand of this.config.enabledBrands) {
      const handler = BRAND_HANDLERS[brand];
      if (!handler) continue;
      const brandPage = await this.browser.newPage();
      await brandPage.setViewport(BROWSER_VIEWPORT); // 设置视口大小
      this.brandPages.set(brand, brandPage);

      await brandPage.goto(handler.startUrl, WAIT_UNTIL_OPTIONS);
      logger.info(handler.loginMessage);
    }

    // 等待用户登录
    logger.warn("⏳ 请在浏览器中完成登录，30 秒后开始监听...");
    logger.info("");
    logger.info("📋 重要提示：请勿关闭以下标签页");
    logger.info(`  - ${this.config.chatPageUrl}（Agent 聊天页面）`);
    for (const brand of this.config.enabledBrands) {
      const handler = BRAND_HANDLERS[brand];
      if (!handler) continue;
      logger.info(`  - ${handler.startUrl}（${handler.displayName}）`);
    }
    logger.info("");
    await new Promise(resolve => setTimeout(resolve, LOGIN_WAIT_DURATION_MS));

    // 设置键盘快捷键
    this.setupKeyboardControls();

    // 显示快捷键提示
    logger.info("");
    logger.info("⌨️  快捷键：");
    logger.info("  空格 - 暂停/恢复监听");
    logger.info("  i - 显示当前状态");
    logger.info("  r - 立即检测一次");
    logger.info("  Ctrl+C - 退出");
    logger.info("");

    // 开始轮询
    this.isRunning = true;
    await this.poll();
  }

  /**
   * 轮询检测未读消息
   */
  private async poll(): Promise<void> {
    if (!this.isRunning) return;

    // 检查暂停状态
    if (this.isPaused) {
      this.scheduleNextPoll();
      return;
    }

    // 记录是否是立即检测（在处理完成后再重置）
    const isImmediateCheck = this.immediateCheckRequested;
    this.immediateCheckRequested = false;

    try {
      // 检查工作时间
      if (!isWithinWorkingHours(this.config)) {
        logger.info("当前不在工作时间，跳过检测");
        this.scheduleNextPoll();
        return;
      }

      logger.info("🔍 开始检测未读消息...");

      let hasTriggered = false; // 标记本轮是否有触发处理

      // 检测每个品牌的未读消息
      for (const brand of this.config.enabledBrands) {
        const handler = BRAND_HANDLERS[brand];
        const page = this.brandPages.get(brand);
        if (!handler || !page) continue;

        const unread = await handler.checkUnread(page);

        // 如果发现未读，检查是否需要触发
        if (unread) {
          if (this.shouldTrigger(unread)) {
            // 确保 chatPage 可用（如果被关闭则重新打开）
            if (await this.ensureChatPageAvailable()) {
              logger.success(`触发处理流程...`);
              await this.chatPage!.bringToFront(); // 切换到聊天页面
              const success = await fillChatInput(this.chatPage!, unread, this.config.autoSubmit);

              // 只有成功填充后才记录触发状态
              if (success) {
                this.recordTrigger(unread);
                hasTriggered = true;
              } else {
                logger.warn(`${unread.brand}: 填充失败，下次检测将重试`);
              }
            } else {
              logger.error("无法确保聊天页面可用，跳过本次触发");
            }
          }
        } else {
          // 没有未读消息，清除该品牌的状态记录
          if (this.processedStates.has(brand)) {
            this.processedStates.delete(brand);
            logger.info(`${brand}: 未读消息已清空，重置状态`);
          }
        }
      }

      logger.info("本轮检测完成");

      // 如果有触发处理，重置兜底检查计时器
      if (hasTriggered) {
        this.lastFallbackCheckTime = Date.now();
      } else {
        // 没有检测到未读，检查是否需要执行兜底检查
        const now = Date.now();
        const timeSinceLastFallback = now - this.lastFallbackCheckTime;

        if (timeSinceLastFallback >= this.config.fallbackCheckInterval) {
          logger.info("⏰ 执行兜底检查（检查未回复的消息）...");

          if (await this.ensureChatPageAvailable()) {
            await this.chatPage!.bringToFront();
            const success = await fillChatInput(
              this.chatPage!,
              null,
              this.config.autoSubmit,
              this.config.fallbackPrompt
            );

            if (success) {
              this.lastFallbackCheckTime = now;
              logger.success("兜底检查指令已发送");
              hasTriggered = true; // 标记为已触发，后面会等待 Agent 处理
            } else {
              logger.warn("兜底检查指令发送失败");
            }
          }
        }
      }

      // 如果有触发处理且启用了自动提交，等待 Agent 处理完成
      // 但如果是立即检测请求，跳过等待
      if (hasTriggered && this.config.autoSubmit && !isImmediateCheck) {
        logger.info("等待 60 秒，让 Agent 处理完成...");
        await new Promise(resolve => setTimeout(resolve, AGENT_PROCESS_WAIT_MS)); // 等待 1 分钟
      }
    } catch (error) {
      logger.error(`轮询过程出错: ${error}`);
    }

    this.scheduleNextPoll();
  }

  /**
   * 调度下一次轮询
   */
  private scheduleNextPoll(): void {
    // 记录下次检测时间
    this.nextPollTime = Date.now() + this.config.pollingInterval;

    this.pollTimer = setTimeout(() => {
      this.poll();
    }, this.config.pollingInterval);
  }

  /**
   * 停止监听服务
   */
  async stop(): Promise<void> {
    logger.info("🛑 停止监听服务...");
    this.isRunning = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
    }

    // 恢复终端模式
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    if (this.browser) {
      await this.browser.disconnect();
      logger.success("已断开浏览器连接（浏览器继续运行）");
    }
  }
}

// ==================== 启动入口 ====================

async function main() {
  warnUnsupportedConnectArgs();

  const baseOverrides: Partial<MonitorConfig> = {
    pollingInterval: parsePollInterval(process.env.POLL_INTERVAL),
    autoSubmit: process.env.AUTO_SUBMIT === "true",
    fallbackCheckInterval: parseFallbackInterval(process.env.FALLBACK_CHECK_INTERVAL),
    fallbackPrompt: process.env.FALLBACK_PROMPT || DEFAULT_CONFIG.fallbackPrompt,
  };

  // 优先从 AGENT_ID 读取配置，否则使用环境变量
  let config: MonitorConfig;
  const agentId = process.env.AGENT_ID;

  if (agentId) {
    logger.info(`🔧 从 configs/agents.json 加载 Agent 配置: ${agentId}`);
    const agentConfig = loadAgentConfig(agentId);

    if (!agentConfig) {
      logger.error("无法加载 Agent 配置，退出");
      process.exit(1);
    }

    const agentMonitorConfig = buildMonitorConfigFromAgent(agentConfig);

    config = {
      ...DEFAULT_CONFIG,
      ...agentMonitorConfig,
      ...baseOverrides,
      // Agent 配置可以被环境变量覆盖（高级用户）
      browserURL: process.env.BROWSER_URL || agentMonitorConfig.browserURL!,
      browserWSEndpoint: process.env.BROWSER_WS_ENDPOINT,
    };

    logger.info(`📍 监听配置:`);
    logger.info(`  - 浏览器端口: ${agentConfig.chromePort}`);
    logger.info(`  - Agent 端口: ${agentConfig.appPort}`);
    logger.info(`  - 监听品牌: ${config.enabledBrands.join(", ")}`);
    logger.info(`  - 兜底检查间隔: ${Math.round(config.fallbackCheckInterval / 60000)} 分钟`);
  } else {
    logger.info("🔧 使用环境变量配置");
    config = {
      ...DEFAULT_CONFIG,
      ...baseOverrides,
      enabledBrands: parseEnabledBrands(process.env.ENABLED_BRANDS),
      chatPageUrl: process.env.AGENT_URL || DEFAULT_CONFIG.chatPageUrl,
      browserURL: process.env.BROWSER_URL || DEFAULT_CONFIG.browserURL,
      browserWSEndpoint: process.env.BROWSER_WS_ENDPOINT,
    };
  }

  const monitor = new UnreadMonitor(config);

  // 优雅退出
  process.on("SIGINT", async () => {
    logger.info("\n收到退出信号...");
    await monitor.stop();
    process.exit(0);
  });

  await monitor.start();
}

// 运行
if (require.main === module) {
  main().catch(error => {
    logger.error(`启动失败: ${error}`);
    process.exit(1);
  });
}

export { UnreadMonitor };
export type { MonitorConfig };
