"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * 检测用户本地时区的 Hook
 * 使用 useEffect 避免 SSR 水合不匹配问题
 */
function useTimeZone(): string | undefined {
  const [timeZone, setTimeZone] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  return timeZone;
}

/** 禁用未来日期的判断函数（提升到模块级避免重复创建） */
const disableFutureDates = (date: Date): boolean => date > new Date();

/**
 * 日期范围格式化器（使用 Intl.DateTimeFormat）
 * 短格式：不含年份，适合 Dashboard 等空间有限的场景
 */
const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
});

interface DateRangePickerProps {
  /** 当前选中的日期范围 */
  value?: DateRange;
  /** 日期范围变化回调 */
  onChange?: (range: DateRange | undefined) => void;
  /** 自定义类名 */
  className?: string;
  /** 占位文本 */
  placeholder?: string;
  /** 禁用状态 */
  disabled?: boolean;
  /** 对齐方式 */
  align?: "start" | "center" | "end";
  /** 主题变体 */
  variant?: "default" | "dark";
}

/**
 * 日期范围选择器组件
 *
 * 符合 Web Interface Guidelines:
 * - 使用 Intl.DateTimeFormat 格式化日期
 * - 包含 aria-label 和键盘支持
 * - 支持 focus-visible 状态
 */
export function DateRangePicker({
  value,
  onChange,
  className,
  placeholder = "选择日期范围",
  disabled = false,
  align = "start",
  variant = "default",
}: DateRangePickerProps) {
  const isDark = variant === "dark";
  const [open, setOpen] = React.useState(false);
  const timeZone = useTimeZone();
  // 内部选择状态（用于跟踪选择过程）
  const [internalRange, setInternalRange] = React.useState<
    DateRange | undefined
  >(undefined);

  // Popover 打开时同步外部值，便于在已有范围上调整
  React.useEffect(() => {
    if (open) {
      setInternalRange(value);
    } else {
      setInternalRange(undefined);
    }
  }, [open, value]);

  // 判断当前选择阶段
  const activeRange = internalRange ?? value;
  const selectionPhase = React.useMemo(() => {
    if (!activeRange?.from) return "start";
    if (!activeRange?.to) return "end";
    return "complete";
  }, [activeRange]);

  // 格式化显示文本
  const displayText = React.useMemo(() => {
    if (!value?.from) return placeholder;

    if (value.to) {
      return `${dateFormatter.format(value.from)} - ${dateFormatter.format(value.to)}`;
    }

    return dateFormatter.format(value.from);
  }, [value, placeholder]);

  // 处理日期选择
  const handleSelect = React.useCallback(
    (range: DateRange | undefined) => {
      // 更新内部状态
      setInternalRange(range);

      if (range?.from && range?.to) {
        // 选择完成，通知父组件并关闭
        onChange?.(range);
        setOpen(false);
      }
    },
    [onChange]
  );

  // 清除选择
  const handleClear = React.useCallback(() => {
    setInternalRange(undefined);
    onChange?.(undefined);
  }, [onChange]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          aria-label={`选择日期范围，当前: ${displayText}`}
          aria-expanded={open}
          className={cn(
            "justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" aria-hidden="true" />
          <span className="truncate">{displayText}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "w-auto rounded-xl border p-0 shadow-lg backdrop-blur-xl",
          isDark
            ? "bg-[var(--dash-surface-1)] border-[var(--dash-border)]"
            : "border-border/60 bg-background/95"
        )}
        align={align}
      >
        <Calendar
          autoFocus
          mode="range"
          timeZone={timeZone}
          defaultMonth={value?.from}
          selected={activeRange}
          onSelect={handleSelect}
          numberOfMonths={2}
          disabled={disableFutureDates}
          classNames={isDark ? {
            // 深色主题样式 - Dashboard 风格
            months: "flex flex-col sm:flex-row gap-8 p-4",
            month: "flex flex-col gap-3",
            month_caption:
              "flex justify-center pt-1 pb-3 relative items-center w-full",
            caption_label: "text-sm font-semibold tracking-tight text-[var(--dash-text-primary)]",
            nav: "flex items-center gap-1",
            button_previous:
              "absolute left-1 top-1 inline-flex size-7 items-center justify-center rounded-full border border-transparent bg-transparent p-0 text-[var(--dash-text-muted)] hover:text-[var(--dash-text-primary)] hover:bg-dash-amber/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-amber/30",
            button_next:
              "absolute right-1 top-1 inline-flex size-7 items-center justify-center rounded-full border border-transparent bg-transparent p-0 text-[var(--dash-text-muted)] hover:text-[var(--dash-text-primary)] hover:bg-dash-amber/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-amber/30",
            weekdays: "flex border-b border-[var(--dash-border)] pb-2 mb-2",
            weekday:
              "text-[var(--dash-text-muted)] w-9 text-[11px] font-medium",
            week: "flex w-full mt-0.5",
            day: "relative p-0.5 text-center text-sm focus-within:relative focus-within:z-20",
            day_button:
              "inline-flex size-8 items-center justify-center p-0 font-medium rounded-full text-[var(--dash-text-secondary)] hover:bg-dash-amber/10 hover:text-[var(--dash-text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-amber/30 aria-selected:opacity-100 cursor-pointer",
            range_start:
              "day-range-start rounded-l-full rounded-r-none bg-dash-amber/20",
            range_end:
              "day-range-end rounded-r-full rounded-l-none bg-dash-amber/20",
            selected:
              "!bg-dash-amber !text-[var(--dash-bg-base)] hover:!bg-dash-amber/90 rounded-full font-semibold",
            today: "relative text-dash-amber font-bold after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:size-1 after:rounded-full after:bg-dash-amber",
            outside:
              "day-outside text-[var(--dash-text-muted)]/40 aria-selected:bg-dash-amber/5 aria-selected:text-[var(--dash-text-muted)]",
            disabled: "text-[var(--dash-text-muted)]/30 cursor-not-allowed hover:bg-transparent",
            range_middle: "!bg-dash-amber/10 !rounded-none !text-[var(--dash-text-secondary)] hover:!bg-dash-amber/15 hover:!text-[var(--dash-text-primary)]",
          } : {
            // 默认浅色主题样式
            months: "flex flex-col sm:flex-row gap-8",
            month: "flex flex-col gap-3",
            month_caption:
              "flex justify-center pt-1 pb-3 relative items-center w-full",
            caption_label: "text-sm font-semibold tracking-tight text-foreground",
            nav: "flex items-center gap-1",
            button_previous:
              "absolute left-1 top-1 inline-flex size-7 items-center justify-center rounded-full border border-transparent bg-transparent p-0 text-foreground/50 hover:text-foreground hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
            button_next:
              "absolute right-1 top-1 inline-flex size-7 items-center justify-center rounded-full border border-transparent bg-transparent p-0 text-foreground/50 hover:text-foreground hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
            weekdays: "flex border-b border-border/30 pb-2 mb-2",
            weekday:
              "text-muted-foreground w-9 text-[11px] font-medium",
            week: "flex w-full mt-0.5",
            day: "relative p-0.5 text-center text-sm focus-within:relative focus-within:z-20",
            day_button:
              "inline-flex size-8 items-center justify-center p-0 font-medium rounded-full text-foreground/70 hover:bg-primary/10 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 aria-selected:opacity-100 cursor-pointer",
            range_start:
              "day-range-start rounded-l-full rounded-r-none bg-primary/20",
            range_end:
              "day-range-end rounded-r-full rounded-l-none bg-primary/20",
            selected:
              "!bg-primary !text-primary-foreground hover:!bg-primary/90 rounded-full font-semibold",
            today: "relative text-primary font-bold after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:size-1 after:rounded-full after:bg-primary",
            outside:
              "day-outside text-foreground/25 aria-selected:bg-primary/8 aria-selected:text-foreground/50",
            disabled: "text-foreground/20 cursor-not-allowed hover:bg-transparent",
            range_middle: "!bg-primary/8 !rounded-none !text-foreground hover:!bg-primary/15 hover:!text-foreground",
          }}
          aria-label="日期范围选择日历"
        />
        <div className={cn(
          "flex items-center justify-between border-t px-4 py-2.5 text-xs",
          isDark
            ? "border-[var(--dash-border)] text-[var(--dash-text-muted)]"
            : "border-border/50 text-foreground/60"
        )}>
          <span>
            {selectionPhase === "start" && (
              <span className="flex items-center gap-2">
                <span className={cn(
                  "inline-block size-1.5 rounded-full",
                  isDark ? "bg-[var(--dash-text-muted)]" : "bg-foreground/50"
                )} />
                请选择开始日期
              </span>
            )}
            {selectionPhase === "end" && (
              <span className="flex items-center gap-2">
                <span className={cn(
                  "inline-block size-1.5 rounded-full",
                  isDark ? "bg-[var(--dash-text-muted)]" : "bg-foreground/50"
                )} />
                请选择结束日期
              </span>
            )}
            {selectionPhase === "complete" &&
              activeRange?.from &&
              activeRange?.to &&
              `已选择 ${Math.ceil((activeRange.to.getTime() - activeRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1} 天`}
          </span>
          {activeRange?.from && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-2",
                isDark
                  ? "text-[var(--dash-text-muted)] hover:text-dash-rose hover:bg-dash-rose/10"
                  : "text-foreground/70 hover:text-foreground"
              )}
              onClick={handleClear}
              aria-label="清除已选日期"
            >
              清除
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
