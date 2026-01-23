"use client";

import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Bot, X } from "lucide-react";
import { useDashboardStatsStore } from "@/lib/stores/dashboard-stats-store";
import type { DashboardFilters as DashboardFiltersType } from "@/lib/services/recruitment-stats/types";
import { cn } from "@/lib/utils";
import { parseBeijingDateString, toBeijingDateString } from "@/lib/utils/beijing-timezone";
import type { DateRange } from "react-day-picker";

/**
 * 预设时间范围选项
 */
const PRESET_OPTIONS: Array<{
  value: DashboardFiltersType["preset"];
  label: string;
}> = [
  { value: "today", label: "今天" },
  { value: "yesterday", label: "昨天" },
  { value: "last7days", label: "7天" },
  { value: "last14days", label: "14天" },
  { value: "last30days", label: "30天" },
];

/**
 * Dashboard 筛选器组件 - Command Bar 风格
 *
 * 深色毛玻璃背景，紧凑 pill 形状按钮
 */
export function DashboardFilters() {
  const {
    filters,
    setPreset,
    setCustomDateRange,
    setAgentFilter,
    setBrandFilter,
    clearDimensionFilters,
    loading,
    availableAgents,
    availableBrands,
    filterOptionsLoading,
    loadFilterOptions,
  } = useDashboardStatsStore();

  // 加载筛选选项
  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  // 获取当前选中的 Agent 和 Brand 名称
  const selectedAgentName = filters.agentId
    ? availableAgents.find((a) => a.agentId === filters.agentId)?.displayName
    : null;
  const selectedBrandName = filters.brandId
    ? availableBrands.find((b) => b.id === filters.brandId)?.name
    : null;

  // 是否有维度筛选
  const hasDimensionFilters = filters.agentId || filters.brandId;

  // 将 store 中的日期字符串转换为 DateRange 对象（使用北京时间解析）
  const dateRangeValue = useMemo<DateRange | undefined>(() => {
    if (!filters.startDate || !filters.endDate) return undefined;
    return {
      from: parseBeijingDateString(filters.startDate),
      to: parseBeijingDateString(filters.endDate),
    };
  }, [filters.startDate, filters.endDate]);

  // 处理日期范围选择变化（使用北京时间格式化）
  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setCustomDateRange(
        toBeijingDateString(range.from),
        toBeijingDateString(range.to)
      );
    } else if (!range) {
      // 清除自定义日期范围时，重置为默认预设（7天）
      setPreset("last7days");
    }
  };

  return (
    <div className="dash-command-bar px-4 py-3 sticky top-4 z-20">
      <div className="flex items-center gap-3 flex-wrap">
        {/* 时间范围预设按钮组 - Pill 风格 */}
        <div className="flex items-center gap-1" role="group" aria-label="时间范围选择">
          {PRESET_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setPreset(option.value)}
              disabled={loading}
              aria-label={`选择${option.label}时间范围`}
              aria-pressed={filters.preset === option.value}
              className={cn(
                "dash-pill",
                filters.preset === option.value && "dash-pill-active"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* 分隔线 */}
        <div className="h-6 w-px bg-[var(--dash-border)]" />

        {/* Agent 筛选 */}
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-[var(--dash-text-muted)]" />
          <Select
            value={filters.agentId ?? "all"}
            onValueChange={(value) =>
              setAgentFilter(value === "all" ? undefined : value)
            }
            disabled={loading || filterOptionsLoading}
          >
            <SelectTrigger className="w-[140px] h-8 bg-[var(--dash-surface-2)] border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-surface-1)] hover:border-[var(--dash-border-glow)] transition-colors text-sm">
              <SelectValue placeholder="全部 Agent" />
            </SelectTrigger>
            <SelectContent className="bg-[var(--dash-surface-1)] border-[var(--dash-border)]">
              <SelectItem value="all" className="text-[var(--dash-text-secondary)] focus:bg-[var(--dash-surface-2)] focus:text-[var(--dash-text-primary)]">
                全部 Agent
              </SelectItem>
              {availableAgents.map((agent) => (
                <SelectItem
                  key={agent.agentId}
                  value={agent.agentId}
                  className="text-[var(--dash-text-secondary)] focus:bg-[var(--dash-surface-2)] focus:text-[var(--dash-text-primary)]"
                >
                  {agent.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 已选筛选标签 */}
        {hasDimensionFilters && (
          <>
            <div className="h-6 w-px bg-[var(--dash-border)]" />
            <div className="flex items-center gap-2">
              {selectedAgentName && (
                <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 text-xs font-medium bg-dash-cyan/15 text-dash-cyan rounded-full border border-dash-cyan/30">
                  {selectedAgentName}
                  <button
                    onClick={() => setAgentFilter(undefined)}
                    className="hover:bg-dash-cyan/20 rounded-full p-0.5 transition-colors"
                    disabled={loading}
                    aria-label={`移除 Agent 筛选: ${selectedAgentName}`}
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              )}
              {selectedBrandName && (
                <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 text-xs font-medium bg-dash-lime/15 text-dash-lime rounded-full border border-dash-lime/30">
                  {selectedBrandName}
                  <button
                    onClick={() => setBrandFilter(undefined)}
                    className="hover:bg-dash-lime/20 rounded-full p-0.5 transition-colors"
                    disabled={loading}
                    aria-label={`移除品牌筛选: ${selectedBrandName}`}
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearDimensionFilters}
                disabled={loading}
                className="h-7 px-2 text-xs text-[var(--dash-text-muted)] hover:text-dash-rose hover:bg-dash-rose/10"
              >
                清除
              </Button>
            </div>
          </>
        )}

        {/* 日期范围选择器 - 右侧 */}
        <div className="ml-auto">
          <DateRangePicker
            value={dateRangeValue}
            onChange={handleDateRangeChange}
            disabled={loading}
            variant="dark"
            timeZone="Asia/Shanghai"
            className={cn(
              "h-8 bg-[var(--dash-surface-2)] border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-surface-1)] hover:border-[var(--dash-border-glow)] transition-colors text-sm",
              !filters.preset && "border-dash-amber/50 bg-dash-amber/5"
            )}
            placeholder="自定义日期"
          />
        </div>
      </div>
    </div>
  );
}
