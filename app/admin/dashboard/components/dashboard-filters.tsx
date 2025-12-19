"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { useDashboardStatsStore } from "@/lib/stores/dashboard-stats-store";
import type { DashboardFilters as DashboardFiltersType } from "@/lib/services/recruitment-stats/types";

/**
 * 预设时间范围选项
 */
const PRESET_OPTIONS: Array<{
  value: DashboardFiltersType["preset"];
  label: string;
}> = [
  { value: "today", label: "今天" },
  { value: "yesterday", label: "昨天" },
  { value: "last7days", label: "最近 7 天" },
  { value: "last14days", label: "最近 14 天" },
  { value: "last30days", label: "最近 30 天" },
];

/**
 * Dashboard 筛选器组件
 *
 * 提供时间范围预设按钮
 */
export function DashboardFilters() {
  const { filters, setPreset, loading } = useDashboardStatsStore();

  return (
    <Card className="border-0 shadow-sm bg-white">
      <CardContent className="py-4">
        <div className="flex items-center flex-wrap gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-fit">
            <Calendar className="h-4 w-4" />
            <span>时间范围：</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {PRESET_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={filters.preset === option.value ? "default" : "outline"}
                size="sm"
                onClick={() => setPreset(option.value)}
                disabled={loading}
                className={
                  filters.preset === option.value
                    ? "shadow-sm"
                    : "glass-button"
                }
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="ml-auto text-sm text-muted-foreground hidden md:block">
            {filters.startDate} ~ {filters.endDate}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
