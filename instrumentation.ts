/**
 * Next.js Instrumentation
 *
 * 在服务器启动时执行初始化任务
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * 注意：此文件必须放在项目根目录，且文件名必须是 instrumentation.ts
 */

export async function register() {
  // 只在 Node.js 运行时执行（不在 Edge 运行时执行）
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[Instrumentation] Initializing server-side services...");

    try {
      // 动态导入调度器模块（避免在构建时执行）
      const { initializeSchedulers } = await import("./lib/scheduler");
      initializeSchedulers();
    } catch (error) {
      // 初始化失败不应阻塞应用启动
      console.error("[Instrumentation] Failed to initialize schedulers:", error);
    }
  }
}
