"use client";

import { useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useDesktopSandboxStore } from "@/lib/stores/desktop-sandbox-store";
import { useAuthStore } from "@/lib/stores/auth-store";

// 调用受保护的 API 端点获取 Desktop URL
async function fetchDesktopURL(sandboxId?: string) {
  const params = sandboxId ? `?sandboxId=${encodeURIComponent(sandboxId)}` : '';
  const response = await fetch(`/api/desktop-url${params}`);
  
  if (!response.ok) {
    // 处理认证错误
    if (response.status === 401) {
      const error = await response.json();
      throw new Error(error.message || '未授权访问，请先登录');
    }
    
    const error = await response.json();
    throw new Error(error.error || 'Failed to get desktop URL');
  }
  
  return response.json();
}

export function useDesktopSandbox() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthStore();

  const {
    sandboxId,
    streamUrl,
    sandboxStatus,
    isInitializing,
    isPausing,
    manualInit,
    setSandboxId,
    setStreamUrl,
    setSandboxStatus,
    setIsInitializing,
    setIsPausing,
    setManualInit,
    reset,
  } = useDesktopSandboxStore();

  // 刷新/创建桌面
  const refreshDesktop = useCallback(async () => {
    try {
      setIsInitializing(true);

      // 如果当前状态是暂停，优先尝试恢复
      if (sandboxStatus === "paused" && sandboxId) {
        console.log("Attempting to resume paused sandbox:", sandboxId);
        toast.info("正在恢复暂停的沙盒...", {
          richColors: true,
          position: "top-center",
        });
      }

      const { streamUrl: newStreamUrl, id } = await fetchDesktopURL(
        sandboxId || undefined
      );
      console.log("Desktop connection established with ID:", id);
      setStreamUrl(newStreamUrl);
      setSandboxId(id);
      setSandboxStatus("running");

      if (sandboxStatus === "paused") {
        toast.success("沙盒已成功恢复！", {
          richColors: true,
          position: "top-center",
        });
      }
    } catch (err) {
      console.error("Failed to refresh desktop:", err);
      toast.error("恢复沙盒失败，将创建新的沙盒", {
        richColors: true,
        position: "top-center",
      });
      // 如果恢复失败，清除当前sandboxId，强制创建新的
      setSandboxId(null);
      setSandboxStatus("unknown");
    } finally {
      setIsInitializing(false);
    }
  }, [
    sandboxId,
    sandboxStatus,
    setSandboxId,
    setStreamUrl,
    setSandboxStatus,
    setIsInitializing,
  ]);

  // 暂停桌面
  const pauseDesktop = useCallback(async () => {
    if (!sandboxId || isPausing) return;

    try {
      setIsPausing(true);
      const response = await fetch(
        `/api/pause-desktop?sandboxId=${encodeURIComponent(sandboxId)}`,
        {
          method: "POST",
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log("Desktop pause response:", result);

        if (result.isFullPauseSupported) {
          // 真正的暂停功能可用
          setSandboxStatus("paused");
          toast.success("桌面已暂停", {
            description: "你可以稍后恢复使用",
            richColors: true,
            position: "top-center",
          });
        } else {
          // 使用了降级方案（延长超时）
          toast.info("桌面超时已延长", {
            description: "暂停功能暂未完全支持，已将会话延长到1小时",
            richColors: true,
            position: "top-center",
            duration: 5000, // 显示更长时间
          });
          // 保持运行状态，因为实际上沙盒仍在运行
          setSandboxStatus("running");
        }
      } else {
        const errorResult = await response.json();
        throw new Error(errorResult.message || "Failed to pause desktop");
      }
    } catch (err) {
      console.error("Failed to pause desktop:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";

      toast.error("操作失败", {
        description: errorMessage,
        richColors: true,
        position: "top-center",
      });
    } finally {
      setIsPausing(false);
    }
  }, [sandboxId, isPausing, setSandboxStatus, setIsPausing]);

  // 检查沙盒状态
  const checkSandboxStatus = useCallback(async () => {
    if (!sandboxId) return;

    try {
      const response = await fetch(
        `/api/sandbox-status?sandboxId=${encodeURIComponent(sandboxId)}`
      );
      if (response.ok) {
        const status = await response.json();
        const newStatus = status.isRunning ? "running" : "paused";

        // 如果沙盒从运行状态变为暂停状态，显示通知
        if (sandboxStatus === "running" && newStatus === "paused") {
          console.log("Sandbox has been paused unexpectedly");
          toast.info("沙盒已暂停", {
            description: "点击'刷新桌面'按钮可以恢复",
            richColors: true,
            position: "top-center",
          });
        }

        setSandboxStatus(newStatus);
      }
    } catch (err) {
      console.error("Failed to check sandbox status:", err);
      setSandboxStatus("unknown");
    }
  }, [sandboxId, sandboxStatus, setSandboxStatus]);

  // Kill desktop on page close
  useEffect(() => {
    if (!sandboxId) return;

    // Function to kill the desktop
    const killDesktop = () => {
      if (!sandboxId) return;

      // Use sendBeacon which is best supported across browsers
      navigator.sendBeacon(
        `/api/kill-desktop?sandboxId=${encodeURIComponent(sandboxId)}`
      );
    };

    // Detect iOS / Safari
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    // Choose exactly ONE event handler based on the browser
    if (isIOS || isSafari) {
      // For Safari on iOS, use pagehide which is most reliable
      window.addEventListener("pagehide", killDesktop);

      return () => {
        window.removeEventListener("pagehide", killDesktop);
        // Also kill desktop when component unmounts
        killDesktop();
      };
    } else {
      // For all other browsers, use beforeunload
      window.addEventListener("beforeunload", killDesktop);

      return () => {
        window.removeEventListener("beforeunload", killDesktop);
        // Also kill desktop when component unmounts
        killDesktop();
      };
    }
  }, [sandboxId]);

  // 心跳检测 - 定期检查沙盒状态
  useEffect(() => {
    if (!sandboxId) return;

    // 立即检查一次状态
    checkSandboxStatus();

    // 设置定期检查
    const heartbeatInterval = setInterval(() => {
      checkSandboxStatus();
    }, 60000); // 每分钟检查一次

    return () => clearInterval(heartbeatInterval);
  }, [sandboxId, checkSandboxStatus]);

  // 初始化桌面
  const initializeDesktop = useCallback(async () => {
    try {
      setIsInitializing(true);
      console.log("Starting desktop initialization...");

      // Use the provided ID or create a new one
      const { streamUrl: newStreamUrl, id } = await fetchDesktopURL(
        sandboxId ?? undefined
      );

      console.log("Desktop initialized successfully:", {
        sandboxId: id,
        streamUrl: newStreamUrl ? "URL received" : "No URL",
      });

      setStreamUrl(newStreamUrl);
      setSandboxId(id);
      setSandboxStatus("running");
    } catch (err) {
      console.error("Failed to initialize desktop:", err);

      // 更详细的错误信息
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      const errorDetails = {
        message: errorMessage,
        sandboxId: sandboxId,
        timestamp: new Date().toISOString(),
      };

      console.error("Desktop initialization error details:", errorDetails);

      // 根据错误类型显示不同的提示
      if (errorMessage.includes("cache key") || errorMessage.includes("API")) {
        toast.error("API 配置错误", {
          description: "请检查 E2B API 密钥配置",
          richColors: true,
          position: "top-center",
        });
      } else if (
        errorMessage.includes("network") ||
        errorMessage.includes("fetch")
      ) {
        toast.error("网络连接失败", {
          description: "请检查网络连接后重试",
          richColors: true,
          position: "top-center",
        });
      } else {
        toast.error("初始化桌面失败", {
          description: errorMessage,
          richColors: true,
          position: "top-center",
        });
      }

      setSandboxStatus("unknown");
      // 清理状态，允许重试
      setSandboxId(null);
      setStreamUrl(null);
    } finally {
      setIsInitializing(false);
    }
  }, [
    sandboxId,
    setIsInitializing,
    setStreamUrl,
    setSandboxId,
    setSandboxStatus,
  ]);

  useEffect(() => {
    // 只有在用户认证后才初始化E2B桌面
    if (!isAuthenticated || isAuthLoading) {
      // 如果用户未认证或正在加载认证状态，重置E2B相关状态
      reset();
      return;
    }

    // 如果设置为手动初始化，则不自动初始化
    if (manualInit) {
      return;
    }

    // 防止重复初始化
    if (isInitializing || sandboxId || streamUrl) {
      return;
    }

    initializeDesktop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isAuthLoading, manualInit]); // 移除不必要的依赖项，避免循环

  return {
    sandboxId,
    streamUrl,
    sandboxStatus,
    isInitializing,
    isPausing,
    manualInit,
    refreshDesktop,
    pauseDesktop,
    resumeDesktop: refreshDesktop, // 恢复和刷新使用相同的逻辑
    initializeDesktop,
    setManualInit,
  };
}
