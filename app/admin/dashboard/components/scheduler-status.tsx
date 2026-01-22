"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Zap, Clock, Activity } from "lucide-react";
import { getSchedulerStatus, type SerializedSchedulerStatus } from "@/actions/recruitment-stats";

/**
 * 格式化时间为简短格式
 * 返回对象包含文本和是否为空状态
 */
function formatTime(isoString: string | null): { text: string; isEmpty: boolean } {
  if (!isoString) return { text: "—", isEmpty: true };
  const date = new Date(isoString);
  return {
    text: date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    isEmpty: false,
  };
}

/**
 * 计算距离下次执行的时间
 */
function getTimeUntil(isoString: string | null): string {
  if (!isoString) return "未调度";
  const target = new Date(isoString);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) return "即将";

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * 调度器状态组件 - 深色科技风版本
 *
 * 紧凑型设计，显示定时聚合任务的关键状态
 */
export function SchedulerStatus() {
  const [status, setStatus] = useState<SerializedSchedulerStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getSchedulerStatus();
      if (result.success) {
        setStatus(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取状态失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (error) {
    return (
      <div className="dash-card">
        <div className="p-4">
          <div className="text-xs text-dash-rose text-center">{error}</div>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="dash-card">
        <div className="p-4">
          <div className="h-20 bg-[var(--dash-surface-2)] rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="dash-card overflow-hidden">
      {/* 头部状态栏 */}
      <div
        className={`px-4 py-2.5 flex items-center justify-between border-b ${
          status.isRunning
            ? "bg-dash-lime/10 border-dash-lime/20"
            : "bg-[var(--dash-surface-2)] border-[var(--dash-border)]"
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              status.isRunning ? "bg-dash-lime animate-pulse" : "bg-[var(--dash-text-muted)]"
            }`}
          />
          <span className="text-xs font-medium text-[var(--dash-text-secondary)]">定时聚合</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              status.isRunning
                ? "bg-dash-lime/20 text-dash-lime"
                : "bg-[var(--dash-surface-1)] text-[var(--dash-text-muted)]"
            }`}
          >
            {status.isRunning ? "运行中" : "未启动"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchStatus}
          disabled={loading}
          className="h-6 w-6 p-0 hover:bg-[var(--dash-surface-2)] text-[var(--dash-text-muted)]"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* 主体内容 - 三列布局 */}
      <div className="px-4 pt-3 pb-10 grid grid-cols-3 gap-3">
        {/* 执行间隔 */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <Zap className="h-3.5 w-3.5 text-dash-amber" />
          </div>
          <div className="text-sm font-semibold text-[var(--dash-text-primary)] dash-number">
            {status.config.dirtyIntervalMinutes}min
          </div>
          <div className="text-[10px] text-[var(--dash-text-muted)] leading-tight mt-1">
            增量间隔
          </div>
        </div>

        {/* 最近执行 */}
        {(() => {
          const lastRun = formatTime(status.lastRunTime);
          return (
            <div className="text-center border-x border-[var(--dash-border)]">
              <div className="flex items-center justify-center mb-1">
                <Clock
                  className={`h-3.5 w-3.5 ${lastRun.isEmpty ? "text-[var(--dash-text-muted)]" : "text-dash-cyan"}`}
                />
              </div>
              <div
                className={`text-sm font-semibold dash-number ${lastRun.isEmpty ? "text-[var(--dash-text-muted)]" : "text-[var(--dash-text-primary)]"}`}
              >
                {lastRun.text}
              </div>
              <div className="text-[10px] text-[var(--dash-text-muted)] leading-tight mt-1">
                {lastRun.isEmpty ? "未执行" : "最近执行"}
              </div>
            </div>
          );
        })()}

        {/* 下次主聚合 */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <Activity className="h-3.5 w-3.5 text-dash-rose" />
          </div>
          <div className="text-sm font-semibold text-[var(--dash-text-primary)] dash-number">
            {getTimeUntil(status.nextMainAggregationTime)}
          </div>
          <div className="text-[10px] text-[var(--dash-text-muted)] leading-tight mt-1 whitespace-nowrap">
            {status.config.mainAggregationHour}:00 主聚合
          </div>
        </div>
      </div>

      {/* 最近结果（如果有） */}
      {status.lastResult && (
        <div className="px-4 py-2 bg-[var(--dash-surface-2)]/50 border-t border-[var(--dash-border)]">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[var(--dash-text-muted)]">最近结果</span>
            <div className="flex items-center gap-2">
              {status.lastResult.success ? (
                <span className="text-dash-lime font-medium dash-number">
                  {status.lastResult.processedCount} 条成功
                </span>
              ) : (
                <span className="text-dash-rose font-medium dash-number">
                  {status.lastResult.failedCount} 条失败
                </span>
              )}
              <span className="text-[var(--dash-text-muted)] dash-number">
                {status.lastResult.duration}ms
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
