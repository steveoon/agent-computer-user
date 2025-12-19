/**
 * Global Scheduler Registry
 *
 * 全局调度器初始化和管理
 * 在应用启动时调用 initializeSchedulers()
 */

import { schedulerService } from "@/lib/services/recruitment-stats";

const LOG_PREFIX = "[Scheduler]";

let isInitialized = false;

/**
 * 初始化所有调度任务
 *
 * 只在以下条件下启动：
 * 1. 生产环境 (NODE_ENV === 'production')
 * 2. 或显式启用 (ENABLE_SCHEDULER === 'true')
 *
 * 在 Next.js instrumentation.ts 中调用此函数
 */
export function initializeSchedulers(): void {
  if (isInitialized) {
    console.log(`${LOG_PREFIX} Already initialized, skipping...`);
    return;
  }

  // 检查是否应该启动调度器
  const shouldRun =
    process.env.NODE_ENV === "production" ||
    process.env.ENABLE_SCHEDULER === "true";

  if (!shouldRun) {
    console.log(
      `${LOG_PREFIX} Skipped (not production and ENABLE_SCHEDULER !== 'true')`
    );
    return;
  }

  console.log(`${LOG_PREFIX} Initializing schedulers...`);

  try {
    // 启动统计聚合调度器
    schedulerService.start();

    isInitialized = true;
    console.log(`${LOG_PREFIX} Initialization complete`);
  } catch (error) {
    console.error(`${LOG_PREFIX} Initialization failed:`, error);
    // 不抛出错误，避免阻塞应用启动
  }
}

/**
 * 关闭所有调度任务
 *
 * 在应用关闭时调用（如果需要优雅关闭）
 */
export function shutdownSchedulers(): void {
  if (!isInitialized) {
    console.log(`${LOG_PREFIX} Not initialized, nothing to shutdown`);
    return;
  }

  console.log(`${LOG_PREFIX} Shutting down schedulers...`);

  try {
    schedulerService.stop();
    isInitialized = false;
    console.log(`${LOG_PREFIX} Shutdown complete`);
  } catch (error) {
    console.error(`${LOG_PREFIX} Shutdown failed:`, error);
  }
}

/**
 * 检查调度器是否已初始化
 */
export function isSchedulersInitialized(): boolean {
  return isInitialized;
}
