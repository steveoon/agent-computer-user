/**
 * Scheduler Service
 *
 * 定时任务调度器
 * 使用内置 setInterval/setTimeout 实现，无外部依赖
 */

import type {
  SchedulerConfig,
  SchedulerStatus,
  AggregationResult,
} from "./types";
import { aggregationService } from "./aggregation.service";

const LOG_PREFIX = "[RecruitmentStats][Scheduler]";

/**
 * 默认调度器配置
 */
const DEFAULT_CONFIG: SchedulerConfig = {
  /** 脏数据处理间隔：5 分钟 */
  dirtyIntervalMs: 5 * 60 * 1000,
  /** 每日主聚合时间：凌晨 2 点 */
  mainAggregationHour: 2,
  /** 批量处理大小 */
  batchSize: 50,
  /** 默认启用 */
  enabled: true,
};

class SchedulerService {
  private config: SchedulerConfig;
  private dirtyIntervalId: ReturnType<typeof setInterval> | null = null;
  private mainTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private isRunning = false;
  private lastRunResult: AggregationResult | null = null;
  private lastRunTime: Date | null = null;
  private nextMainAggregationTime: Date | null = null;

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 启动调度器
   *
   * - 脏数据处理：每 5 分钟运行一次
   * - 每日主聚合：凌晨 2 点运行
   */
  start(): void {
    if (this.isRunning) {
      console.warn(`${LOG_PREFIX} Scheduler already running`);
      return;
    }

    if (!this.config.enabled) {
      console.log(`${LOG_PREFIX} Scheduler is disabled`);
      return;
    }

    console.log(`${LOG_PREFIX} Starting scheduler...`);
    console.log(`${LOG_PREFIX} Config:`, {
      dirtyIntervalMs: this.config.dirtyIntervalMs,
      mainAggregationHour: this.config.mainAggregationHour,
      batchSize: this.config.batchSize,
    });

    this.isRunning = true;

    // 启动脏数据处理定时器（每 5 分钟）
    this.dirtyIntervalId = setInterval(async () => {
      await this.runDirtyAggregation();
    }, this.config.dirtyIntervalMs);

    // 调度下一次每日主聚合
    this.scheduleMainAggregation();

    // 启动后立即运行一次脏数据处理
    this.runDirtyAggregation().catch(console.error);

    console.log(`${LOG_PREFIX} Scheduler started`);
  }

  /**
   * 停止调度器
   */
  stop(): void {
    if (!this.isRunning) {
      console.warn(`${LOG_PREFIX} Scheduler not running`);
      return;
    }

    console.log(`${LOG_PREFIX} Stopping scheduler...`);

    if (this.dirtyIntervalId) {
      clearInterval(this.dirtyIntervalId);
      this.dirtyIntervalId = null;
    }

    if (this.mainTimeoutId) {
      clearTimeout(this.mainTimeoutId);
      this.mainTimeoutId = null;
    }

    this.isRunning = false;
    this.nextMainAggregationTime = null;

    console.log(`${LOG_PREFIX} Scheduler stopped`);
  }

  /**
   * 调度每日主聚合任务
   *
   * 计算到下一个指定时间点的毫秒数，使用 setTimeout 调度
   */
  private scheduleMainAggregation(): void {
    const now = new Date();
    const nextRun = new Date(now);

    // 设置为今天的主聚合时间
    nextRun.setHours(this.config.mainAggregationHour, 0, 0, 0);

    // 如果今天的时间已过，调度到明天
    if (now >= nextRun) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    this.nextMainAggregationTime = nextRun;
    const msUntilNext = nextRun.getTime() - now.getTime();

    console.log(
      `${LOG_PREFIX} Next main aggregation scheduled at: ${nextRun.toISOString()} (${Math.round(msUntilNext / 1000 / 60)} minutes)`
    );

    this.mainTimeoutId = setTimeout(async () => {
      await this.runScheduledMainAggregation();
      // 重新调度下一天
      this.scheduleMainAggregation();
    }, msUntilNext);
  }

  /**
   * 运行脏数据聚合
   */
  private async runDirtyAggregation(): Promise<void> {
    try {
      console.log(`${LOG_PREFIX} Running dirty aggregation...`);
      this.lastRunResult = await aggregationService.processDirtyRecords(
        this.config.batchSize
      );
      this.lastRunTime = new Date();

      if (this.lastRunResult.processedCount > 0) {
        console.log(
          `${LOG_PREFIX} Dirty aggregation completed: ${this.lastRunResult.processedCount} records processed`
        );
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} Dirty aggregation failed:`, error);
      this.lastRunResult = {
        success: false,
        processedCount: 0,
        failedCount: 1,
        duration: 0,
        errors: [error instanceof Error ? error.message : String(error)],
      };
      this.lastRunTime = new Date();
    }
  }

  /**
   * 运行每日主聚合
   *
   * 调用 aggregationService.runMainAggregation() 执行完整的聚合流程：
   * 1. 先处理脏数据
   * 2. 如果没有脏数据，执行全量重算（兜底）
   */
  private async runScheduledMainAggregation(): Promise<void> {
    try {
      console.log(`${LOG_PREFIX} Running scheduled main aggregation...`);
      // 使用更大的批量大小（1000）用于定时任务
      this.lastRunResult = await aggregationService.runMainAggregation(1000);
      this.lastRunTime = new Date();

      console.log(
        `${LOG_PREFIX} Scheduled main aggregation completed: ${this.lastRunResult.processedCount} records processed`
      );
    } catch (error) {
      console.error(`${LOG_PREFIX} Scheduled main aggregation failed:`, error);
      this.lastRunResult = {
        success: false,
        processedCount: 0,
        failedCount: 1,
        duration: 0,
        errors: [error instanceof Error ? error.message : String(error)],
      };
      this.lastRunTime = new Date();
    }
  }

  /**
   * 手动触发聚合
   *
   * @param agentId - 可选 Agent ID，如果提供则仅对该 Agent 进行全量重算
   */
  async triggerManual(agentId?: string): Promise<AggregationResult> {
    if (agentId) {
      // 指定 Agent：仅对该 Agent 全量重算
      console.log(`${LOG_PREFIX} Manual full re-aggregation triggered for: ${agentId}`);
      const result = await aggregationService.fullReaggregation(agentId);
      this.lastRunResult = result;
      this.lastRunTime = new Date();
      return result;
    } else {
      // 未指定 Agent：执行完整主聚合流程（脏数据 + 兜底全量）
      console.log(`${LOG_PREFIX} Manual main aggregation triggered`);
      const result = await aggregationService.runMainAggregation(this.config.batchSize);
      this.lastRunResult = result;
      this.lastRunTime = new Date();
      return result;
    }
  }

  /**
   * 获取调度器状态
   */
  getStatus(): SchedulerStatus {
    return {
      isRunning: this.isRunning,
      lastRunResult: this.lastRunResult,
      lastRunTime: this.lastRunTime,
      nextMainAggregationTime: this.nextMainAggregationTime,
      config: this.config,
    };
  }

  /**
   * 更新配置
   *
   * 注意：需要重启调度器才能生效
   */
  updateConfig(config: Partial<SchedulerConfig>): void {
    this.config = { ...this.config, ...config };
    console.log(`${LOG_PREFIX} Config updated:`, this.config);
  }

  /**
   * 检查调度器是否正在运行
   */
  isSchedulerRunning(): boolean {
    return this.isRunning;
  }
}

/**
 * 单例实例
 *
 * 使用 globalThis 确保在 Next.js 开发模式下（HMR/不同执行上下文）
 * instrumentation.ts 和 Server Actions 使用同一个实例
 */
const globalForScheduler = globalThis as unknown as {
  schedulerService: SchedulerService | undefined;
};

export const schedulerService =
  globalForScheduler.schedulerService ?? new SchedulerService();

if (process.env.NODE_ENV !== "production") {
  globalForScheduler.schedulerService = schedulerService;
}
