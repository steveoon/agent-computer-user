"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bot, X, CalendarDays } from "lucide-react";
import { useDashboardStatsStore } from "@/lib/stores/dashboard-stats-store";
import type { DashboardFilters as DashboardFiltersType } from "@/lib/services/recruitment-stats/types";
import { cn } from "@/lib/utils";

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
 * Dashboard 筛选器组件
 *
 * 单行紧凑布局，提供时间范围预设和 Agent 筛选
 */
export function DashboardFilters() {
  const {
    filters,
    setPreset,
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

  // 格式化日期显示 (MM.DD 格式)
  const formatDateRange = () => {
    const start = filters.startDate.slice(5).replace("-", ".");
    const end = filters.endDate.slice(5).replace("-", ".");
    return `${start} - ${end}`;
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3 flex-wrap">
        {/* 时间范围预设按钮组 */}
        <div className="flex items-center bg-gray-50 rounded-lg p-1 gap-0.5">
          {PRESET_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setPreset(option.value)}
              disabled={loading}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200",
                filters.preset === option.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* 分隔线 */}
        <div className="h-6 w-px bg-gray-200" />

        {/* Agent 筛选 */}
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-gray-400" />
          <Select
            value={filters.agentId ?? "all"}
            onValueChange={(value) =>
              setAgentFilter(value === "all" ? undefined : value)
            }
            disabled={loading || filterOptionsLoading}
          >
            <SelectTrigger className="w-[140px] h-8 border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors">
              <SelectValue placeholder="全部 Agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部 Agent</SelectItem>
              {availableAgents.map((agent) => (
                <SelectItem key={agent.agentId} value={agent.agentId}>
                  {agent.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Brand 筛选 - 暂时禁用，待 message_received 事件支持 brand_id 关联后启用 */}
        {/* <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-gray-400" />
          <Select
            value={filters.brandId?.toString() ?? "all"}
            onValueChange={(value) =>
              setBrandFilter(value === "all" ? undefined : parseInt(value, 10))
            }
            disabled={loading || filterOptionsLoading}
          >
            <SelectTrigger className="w-[140px] h-8 border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors">
              <SelectValue placeholder="全部品牌" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部品牌</SelectItem>
              {availableBrands.map((brand) => (
                <SelectItem key={brand.id} value={brand.id.toString()}>
                  {brand.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div> */}

        {/* 已选筛选标签 */}
        {hasDimensionFilters && (
          <>
            <div className="h-6 w-px bg-gray-200" />
            <div className="flex items-center gap-2">
              {selectedAgentName && (
                <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 text-xs font-medium bg-blue-50 text-blue-600 rounded-full">
                  {selectedAgentName}
                  <button
                    onClick={() => setAgentFilter(undefined)}
                    className="hover:bg-blue-100 rounded-full p-0.5 transition-colors"
                    disabled={loading}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {selectedBrandName && (
                <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 text-xs font-medium bg-green-50 text-green-600 rounded-full">
                  {selectedBrandName}
                  <button
                    onClick={() => setBrandFilter(undefined)}
                    className="hover:bg-green-100 rounded-full p-0.5 transition-colors"
                    disabled={loading}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearDimensionFilters}
                disabled={loading}
                className="h-7 px-2 text-xs text-gray-400 hover:text-gray-600"
              >
                清除
              </Button>
            </div>
          </>
        )}

        {/* 日期范围显示 - 右侧 */}
        <div className="ml-auto flex items-center gap-1.5 text-sm text-gray-400">
          <CalendarDays className="h-3.5 w-3.5" />
          <span>{formatDateRange()}</span>
        </div>
      </div>
    </div>
  );
}
