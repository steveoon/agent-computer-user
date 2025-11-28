"use client";

import { useState } from "react";
import { MapPin, ChevronDown, ChevronUp, Store } from "lucide-react";
import type { StoreWithDistance } from "@/types/geocoding";

interface MatchedStoresCardProps {
  stores: StoreWithDistance[];
  displayCount?: number;
  /** 是否默认展开 */
  defaultExpanded?: boolean;
  /** 是否紧凑模式 */
  compact?: boolean;
  /** 自定义样式类名 */
  className?: string;
}

/**
 * 格式化距离显示
 */
function formatDistance(distance: number | undefined): string | null {
  if (distance === undefined) return null;
  if (distance < 1000) return `${Math.round(distance)}米`;
  return `${(distance / 1000).toFixed(1)}公里`;
}

/**
 * 匹配到的门店列表卡片
 * 用于展示智能回复时匹配到的门店信息
 */
export function MatchedStoresCard({
  stores,
  displayCount = 3,
  defaultExpanded = false,
  compact = true,
  className = "",
}: MatchedStoresCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!stores || stores.length === 0) {
    return null;
  }

  const visibleStores = expanded ? stores.slice(0, 5) : stores.slice(0, displayCount);
  const hasMore = stores.length > displayCount;
  const remainingCount = stores.length - 5;

  return (
    <div className={`mt-2 ${className}`}>
      {/* 标题栏 - 可点击展开/收起 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors w-full"
      >
        <Store className="w-4 h-4" />
        <span className="font-medium">匹配门店 ({stores.length})</span>
        {hasMore &&
          (expanded ? (
            <ChevronUp className="w-4 h-4 ml-auto" />
          ) : (
            <ChevronDown className="w-4 h-4 ml-auto" />
          ))}
      </button>

      {/* 门店列表 */}
      <div className={`mt-2 space-y-1.5 ${!expanded && compact ? "max-h-32 overflow-hidden" : ""}`}>
        {visibleStores.map((item, idx) => {
          const { store, distance } = item;
          const distanceText = formatDistance(distance);
          const isTop = idx < displayCount;

          return (
            <div
              key={store.id}
              className={`flex items-center gap-2 p-2 rounded text-xs ${
                isTop
                  ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900"
                  : "bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 opacity-70"
              }`}
            >
              {/* 排名 */}
              <span
                className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-medium ${
                  isTop
                    ? "bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                }`}
              >
                {idx + 1}
              </span>

              {/* 门店信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-gray-800 dark:text-gray-200 truncate">
                    {store.name}
                  </span>
                  {distanceText && (
                    <span className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400 shrink-0">
                      <MapPin className="w-3 h-3" />
                      {distanceText}
                    </span>
                  )}
                </div>
                {!compact && (
                  <div className="text-gray-500 dark:text-gray-400 truncate">
                    {store.district} - {store.location}
                  </div>
                )}
              </div>

              {/* 品牌标签 */}
              <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs shrink-0">
                {store.brand}
              </span>
            </div>
          );
        })}

        {/* 显示更多提示 */}
        {expanded && remainingCount > 0 && (
          <div className="text-center text-xs text-gray-500 dark:text-gray-400 py-1">
            ... 还有 {remainingCount} 家门店未显示
          </div>
        )}
      </div>

      {/* 收起时显示更多提示 */}
      {!expanded && hasMore && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          展开查看全部 {stores.length} 家门店
        </button>
      )}
    </div>
  );
}
