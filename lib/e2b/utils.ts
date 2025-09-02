"use server";

import { Sandbox, SandboxOpts } from "@e2b/desktop";
import { resolution, dpi } from "./tool";

// 直接使用Sandbox类型，避免类型不匹配问题
export type E2BDesktop = Sandbox;

// 扩展E2B Sandbox类型定义以支持暂停/恢复功能
interface SandboxWithExtensions extends Sandbox {
  pause?: () => Promise<string>;
}

interface SandboxConstructor {
  create: (template: string, options: SandboxOpts) => Promise<SandboxWithExtensions>;
  connect: (id: string) => Promise<SandboxWithExtensions>;
  resume?: (id: string) => Promise<SandboxWithExtensions>;
}

// 沙盒持久化相关函数 - 使用beta版本API
export const pauseDesktop = async (desktop: E2BDesktop) => {
  try {
    // 检查pause方法是否存在
    const extendedDesktop = desktop as unknown as SandboxWithExtensions;
    if (typeof extendedDesktop.pause !== "function") {
      // 目前 Desktop SDK 还不支持 pause 功能，我们提供一个优雅的降级方案
      console.warn("Desktop SDK 暂停功能暂未完全支持，将保存沙盒ID以供后续连接使用");

      // 返回当前沙盒ID，用于后续连接
      const sandboxId = desktop.sandboxId;
      console.log("Sandbox ID saved for future connection:", sandboxId);

      // 延长沙盒超时时间，而不是暂停
      await desktop.setTimeout(3600000); // 延长到1小时
      console.log("Sandbox timeout extended to 1 hour");

      return sandboxId;
    }

    const sandboxId = await extendedDesktop.pause();
    console.log("Sandbox paused with ID:", sandboxId);
    return sandboxId;
  } catch (error) {
    console.error("Error pausing desktop:", error);

    // 如果暂停失败，尝试延长超时时间作为替代方案
    try {
      await desktop.setTimeout(3600000); // 延长到1小时
      console.log("Fallback: Extended sandbox timeout to 1 hour");
      return desktop.sandboxId;
    } catch (fallbackError) {
      console.error("Fallback option also failed:", fallbackError);
      throw error;
    }
  }
};

export const resumeDesktop = async (sandboxId: string) => {
  try {
    // 检查resume方法是否存在
    const sandboxConstructor = Sandbox as unknown as SandboxConstructor;
    if (typeof sandboxConstructor.resume !== "function") {
      console.warn("Desktop SDK 恢复功能暂未完全支持，将尝试连接到现有沙盒");

      // 尝试连接到现有沙盒
      try {
        const desktop = await Sandbox.connect(sandboxId);
        const isRunning = await desktop.isRunning();

        if (isRunning) {
          console.log("Successfully connected to existing sandbox:", sandboxId);
          await desktop.stream.start();
          return desktop;
        } else {
          throw new Error("Sandbox is not running");
        }
      } catch (connectError) {
        console.log("Cannot connect to existing sandbox, creating new one");
        throw connectError;
      }
    }

    const desktop = await sandboxConstructor.resume(sandboxId);
    console.log("Sandbox resumed with ID:", desktop.sandboxId);
    await desktop.stream.start();
    return desktop;
  } catch (error) {
    console.error("Error resuming desktop:", error);
    throw error;
  }
};

export const getDesktop = async (sandboxId?: string): Promise<E2BDesktop> => {
  try {
    if (sandboxId) {
      // 首先尝试连接到现有的沙盒
      try {
        const connected = await Sandbox.connect(sandboxId);
        const isRunning = await connected.isRunning();
        if (isRunning) {
          console.log("Connected to existing running sandbox:", sandboxId);
          return connected;
        } else {
          console.log("Sandbox not running, attempting to resume...");

          // 尝试恢复暂停的沙盒
          try {
            const resumed = await resumeDesktop(sandboxId);
            console.log("Successfully resumed sandbox:", sandboxId);
            return resumed;
          } catch (resumeError) {
            console.log("Failed to resume sandbox, creating new one:", resumeError);
          }
        }
      } catch (connectError) {
        console.log("Failed to connect to sandbox, creating new one:", connectError);
      }
    }

    // 创建新的沙盒 - 使用可配置的分辨率
    const desktop = await Sandbox.create({
      resolution: [resolution.x, resolution.y], // 动态分辨率
      dpi: dpi, // 动态 DPI
      timeoutMs: 3600000, // 延长到1小时 (3600000毫秒)
    });

    console.log(`Created new sandbox with ID: ${desktop.sandboxId}`);
    console.log(`Resolution: ${resolution.x}x${resolution.y}, DPI: ${dpi}`);

    // 启动桌面流
    await desktop.stream.start();
    console.log("Desktop stream started successfully");
    return desktop;
  } catch (error) {
    console.error("Error in getDesktop:", error);
    // 添加重试逻辑或更详细的错误信息
    if (error instanceof Error && error.message.includes("cache key")) {
      console.error("Cache key generation failed - check E2B API key");
    }
    throw error;
  }
};

export const getDesktopURL = async (id?: string) => {
  try {
    const desktop = await getDesktop(id);
    const streamUrl = desktop.stream.getUrl();

    return { streamUrl, id: desktop.sandboxId };
  } catch (error) {
    console.error("Error in getDesktopURL:", error);
    throw error;
  }
};

export const killDesktop = async (id: string = "desktop") => {
  try {
    const desktop = await getDesktop(id);
    await desktop.kill();
    console.log("Desktop killed successfully:", id);
  } catch (error) {
    console.error("Error killing desktop:", error);
    throw error;
  }
};

// 检查沙盒状态的工具函数
export const checkSandboxStatus = async (id: string) => {
  try {
    const connected = await Sandbox.connect(id);
    const isRunning = await connected.isRunning();
    return { isRunning, sandboxId: id };
  } catch (error) {
    console.error("Error checking sandbox status:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { isRunning: false, sandboxId: id, error: errorMessage };
  }
};

// 为诊断操作添加超时保护
export const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> => {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`${operation} timeout after ${timeoutMs}ms`)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
};
