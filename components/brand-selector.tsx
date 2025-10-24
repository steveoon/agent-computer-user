"use client";

import { useBrand } from "@/lib/contexts/brand-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect } from "react";
import { getBrandHistory } from "@/lib/utils/brand-storage";
// 移除 BrandName 类型导入，使用 string 代替

/**
 * 🏪 品牌选择器组件
 *
 * 允许用户在不同品牌之间切换，影响数据加载和消息生成
 * 支持显示最近使用的品牌历史记录
 */
export function BrandSelector({ showHistory = false }: { showHistory?: boolean }) {
  const { currentBrand, setCurrentBrand, availableBrands, isLoaded } = useBrand();
  const [brandHistory, setBrandHistory] = useState<string[]>([]);

  // 📊 加载品牌历史记录
  useEffect(() => {
    if (showHistory && isLoaded) {
      getBrandHistory().then(setBrandHistory).catch(console.warn);
    }
  }, [showHistory, isLoaded]);

  return (
    <div className="flex items-center gap-2">
      <Select value={currentBrand} onValueChange={setCurrentBrand}>
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue placeholder="选择品牌" />
        </SelectTrigger>
        <SelectContent className="max-h-[320px]">
          {showHistory && brandHistory.length > 0 ? (
            <>
              {/* 历史记录部分 - 最近使用的品牌（最多3个） */}
              {brandHistory.slice(0, 3).map(brand => (
                <SelectItem key={`history-${brand}`} value={brand} className="text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-brand-primary">📋</span>
                    <span>{brand}</span>
                  </div>
                </SelectItem>
              ))}

              {/* 分隔线 */}
              <div className="h-px bg-border my-1" />

              {/* 所有品牌列表（去重显示） */}
              {availableBrands
                .filter(brand => !brandHistory.slice(0, 3).includes(brand))
                .map(brand => (
                  <SelectItem key={brand} value={brand} className="text-xs">
                    {brand}
                  </SelectItem>
                ))}
            </>
          ) : (
            /* 不显示历史记录时的标准列表 */
            availableBrands.map(brand => (
              <SelectItem key={brand} value={brand} className="text-xs">
                {brand}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {/* 💾 持久化状态指示器 */}
      {isLoaded && showHistory && (
        <span className="text-xs text-green-600" title="品牌偏好已保存">
          💾
        </span>
      )}
    </div>
  );
}
