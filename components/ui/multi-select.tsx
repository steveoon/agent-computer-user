"use client";

import * as React from "react";
import { CheckIcon, ChevronsUpDown, X, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * MultiSelect 选项
 */
export interface MultiSelectOption {
  value: string;
  label: string;
}

/**
 * MultiSelect 组件属性
 */
interface MultiSelectProps {
  /** 可选项列表 */
  options: MultiSelectOption[];
  /** 已选值列表 */
  selected: string[];
  /** 选择变化回调 */
  onChange: (values: string[]) => void;
  /** 占位符文本 */
  placeholder?: string;
  /** 搜索框占位符 */
  searchPlaceholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 最大显示已选数量（超过则折叠） */
  maxDisplayCount?: number;
}

/**
 * MultiSelect 多选下拉组件
 *
 * 支持搜索、全选/清除、深色主题
 */
export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "请选择...",
  searchPlaceholder = "搜索...",
  disabled = false,
  className,
  maxDisplayCount = 2,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const listboxId = React.useId();

  // 过滤选项
  const filteredOptions = React.useMemo(() => {
    if (!search.trim()) return options;
    const lower = search.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(lower));
  }, [options, search]);

  // 切换选中状态
  const toggleOption = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    onChange(newSelected);
  };

  // 全选当前过滤结果
  const selectAll = () => {
    const allValues = filteredOptions.map((opt) => opt.value);
    const newSelected = Array.from(new Set([...selected, ...allValues]));
    onChange(newSelected);
  };

  // 清除所有选中
  const clearAll = () => {
    onChange([]);
    setSearch("");
  };

  // 移除单个选中项
  const removeItem = (value: string) => {
    onChange(selected.filter((v) => v !== value));
  };

  // 获取选中项的显示标签
  const getSelectedLabels = () => {
    return selected
      .map((value) => options.find((opt) => opt.value === value)?.label ?? value)
      .slice(0, maxDisplayCount);
  };

  const selectedLabels = getSelectedLabels();
  const hasMore = selected.length > maxDisplayCount;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          className={cn(
            "flex h-8 min-w-[160px] items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors",
            "bg-[var(--dash-surface-2)] border-[var(--dash-border)] text-[var(--dash-text-secondary)]",
            "hover:bg-[var(--dash-surface-1)] hover:border-[var(--dash-border-glow)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--dash-border-glow)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
            {selected.length === 0 ? (
              <span className="text-[var(--dash-text-muted)]">{placeholder}</span>
            ) : (
              <>
                {selectedLabels.map((label, index) => (
                  <span
                    key={selected[index]}
                    className="inline-flex items-center gap-1 rounded bg-[var(--dash-surface-1)] px-1.5 py-0.5 text-xs text-[var(--dash-text-secondary)] max-w-[80px] truncate"
                  >
                    <span className="truncate">{label}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeItem(selected[index]);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          removeItem(selected[index]);
                        }
                      }}
                      className="flex-shrink-0 hover:text-[var(--dash-text-primary)] cursor-pointer"
                      aria-label={`移除 ${label}`}
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </span>
                ))}
                {hasMore && (
                  <span className="text-xs text-[var(--dash-text-muted)]">
                    +{selected.length - maxDisplayCount}
                  </span>
                )}
              </>
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-[var(--dash-text-muted)]" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[280px] p-0 bg-[var(--dash-surface-1)] border-[var(--dash-border)]"
        align="start"
      >
        {/* 搜索框 */}
        <div className="flex items-center gap-2 border-b border-[var(--dash-border)] px-3 py-2">
          <Search className="h-4 w-4 text-[var(--dash-text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 bg-transparent text-sm text-[var(--dash-text-secondary)] placeholder:text-[var(--dash-text-muted)] outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-between border-b border-[var(--dash-border)] px-3 py-1.5">
          <span className="text-xs text-[var(--dash-text-muted)]">
            已选 {selected.length} / {options.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs text-dash-cyan hover:underline"
            >
              全选
            </button>
            <span className="text-[var(--dash-text-muted)]">|</span>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-dash-rose hover:underline"
            >
              清除
            </button>
          </div>
        </div>

        {/* 选项列表 */}
        <div id={listboxId} role="listbox" aria-multiselectable="true" className="max-h-[240px] overflow-y-auto py-1">
          {filteredOptions.length === 0 ? (
            <div className="py-6 text-center text-sm text-[var(--dash-text-muted)]">
              无匹配结果
            </div>
          ) : (
            filteredOptions.map((option) => {
              const isSelected = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => toggleOption(option.value)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors",
                    "hover:bg-[var(--dash-surface-2)]",
                    isSelected && "text-dash-cyan"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      isSelected
                        ? "border-dash-cyan bg-dash-cyan text-[var(--dash-bg)]"
                        : "border-[var(--dash-border)]"
                    )}
                  >
                    {isSelected && <CheckIcon className="h-3 w-3" />}
                  </div>
                  <span className="truncate text-[var(--dash-text-secondary)]">
                    {option.label}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
