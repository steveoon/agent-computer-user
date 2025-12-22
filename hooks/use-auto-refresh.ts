"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * useAutoRefresh Hook 配置选项
 */
interface UseAutoRefreshOptions {
  /** 刷新间隔（毫秒），默认 30000 (30秒) */
  interval?: number;
  /** 是否在页面不可见时暂停刷新，默认 true */
  pauseOnHidden?: boolean;
  /** 是否在刷新过程中禁用下一次刷新，默认 true */
  skipWhileLoading?: boolean;
  /** 是否启用自动刷新，默认 true */
  enabled?: boolean;
}

/**
 * useAutoRefresh Hook 返回值
 */
interface UseAutoRefreshReturn {
  /** 距离下次刷新的剩余秒数 */
  countdown: number;
  /** 是否正在刷新 */
  isRefreshing: boolean;
  /** 是否已暂停（页面不可见） */
  isPaused: boolean;
  /** 手动触发刷新 */
  refresh: () => Promise<void>;
  /** 重置倒计时 */
  resetCountdown: () => void;
}

/**
 * 自动刷新 Hook
 *
 * 提供定时轮询功能，支持：
 * - 可配置的刷新间隔
 * - 页面可见性检测（不可见时暂停）
 * - 刷新状态锁定（正在刷新时不重复触发）
 * - 倒计时显示
 *
 * @example
 * ```tsx
 * const { countdown, isRefreshing, isPaused, refresh } = useAutoRefresh({
 *   interval: 30000, // 30秒
 *   onRefresh: async () => {
 *     await loadDashboardData();
 *   },
 * });
 *
 * // 显示状态
 * {isPaused ? "已暂停" : isRefreshing ? "刷新中..." : `${countdown}s 后刷新`}
 * ```
 */
export function useAutoRefresh(
  onRefresh: () => Promise<void>,
  options: UseAutoRefreshOptions = {}
): UseAutoRefreshReturn {
  const {
    interval = 30000,
    pauseOnHidden = true,
    skipWhileLoading = true,
    enabled = true,
  } = options;

  const intervalSeconds = Math.floor(interval / 1000);

  const [countdown, setCountdown] = useState(intervalSeconds);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const onRefreshRef = useRef(onRefresh);
  const isRefreshingRef = useRef(false);
  const isMountedRef = useRef(true);

  // 组件卸载时标记
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 保持 onRefresh 引用最新
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  // 执行刷新
  const refresh = useCallback(async () => {
    if (isRefreshingRef.current && skipWhileLoading) {
      return;
    }

    isRefreshingRef.current = true;
    setIsRefreshing(true);

    try {
      await onRefreshRef.current();
    } finally {
      isRefreshingRef.current = false;
      // 仅在组件仍挂载时更新状态
      if (isMountedRef.current) {
        setIsRefreshing(false);
        setCountdown(intervalSeconds);
      }
    }
  }, [intervalSeconds, skipWhileLoading]);

  // 重置倒计时
  const resetCountdown = useCallback(() => {
    setCountdown(intervalSeconds);
  }, [intervalSeconds]);

  // 页面可见性检测
  useEffect(() => {
    if (!pauseOnHidden) return;

    const handleVisibilityChange = () => {
      const isHidden = document.visibilityState === "hidden";
      setIsPaused(isHidden);

      // 页面重新可见时重置倒计时
      if (!isHidden) {
        setCountdown(intervalSeconds);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 初始化状态
    setIsPaused(document.visibilityState === "hidden");

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pauseOnHidden, intervalSeconds]);

  // 倒计时到 0 时触发刷新的标记
  const shouldRefreshRef = useRef(false);

  // 倒计时逻辑
  useEffect(() => {
    if (!enabled || isPaused) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // 标记需要刷新，在下一个 effect 中处理
          shouldRefreshRef.current = true;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [enabled, isPaused]);

  // 监听 countdown 为 0 时触发刷新（将异步操作移出 setState）
  useEffect(() => {
    if (countdown === 0 && shouldRefreshRef.current && enabled && !isPaused) {
      shouldRefreshRef.current = false;
      void refresh();
    }
  }, [countdown, enabled, isPaused, refresh]);

  return {
    countdown,
    isRefreshing,
    isPaused,
    refresh,
    resetCountdown,
  };
}
