"use client";

import { useEffect, useState, useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";
import { useSyncStore } from "@/lib/stores/sync-store";
import { useBrandManagementStore } from "@/lib/stores/brand-management-store";

export const BrandSelector = () => {
  const { selectedBrands, toggleBrand, selectAllBrands, clearSelectedBrands, setSelectedBrands } =
    useSyncStore();
  const [searchQuery, setSearchQuery] = useState("");

  // 从 Brand Management Store 获取品牌列表
  const availableBrands = useBrandManagementStore(state => state.availableBrands);
  const loading = useBrandManagementStore(state => state.availableBrandsLoading);
  const loadAvailableBrands = useBrandManagementStore(state => state.loadAvailableBrands);

  // 初次加载品牌列表
  useEffect(() => {
    if (availableBrands.length === 0) {
      loadAvailableBrands();
    }
  }, [availableBrands.length, loadAvailableBrands]);

  // 当品牌列表更新后，清理已删除品牌的选择状态
  useEffect(() => {
    if (availableBrands.length > 0 && selectedBrands.length > 0) {
      const availableBrandIds = new Set(availableBrands.map(b => b.id));
      const validSelectedBrands = selectedBrands.filter(id => availableBrandIds.has(id));

      // 如果有无效的品牌ID被过滤掉，更新store
      if (validSelectedBrands.length !== selectedBrands.length) {
        console.log(
          `🧹 清理了 ${selectedBrands.length - validSelectedBrands.length} 个已删除的品牌选择`
        );
        setSelectedBrands(validSelectedBrands);
      }
    }
  }, [availableBrands, selectedBrands, setSelectedBrands]);

  // 过滤品牌
  const filteredBrands = useMemo(() => {
    if (!searchQuery.trim()) return availableBrands;
    return availableBrands.filter(
      brand =>
        brand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        brand.id.includes(searchQuery)
    );
  }, [availableBrands, searchQuery]);

  const isAllSelected =
    availableBrands.length > 0 && selectedBrands.length === availableBrands.length;
  const isPartialSelected =
    selectedBrands.length > 0 && selectedBrands.length < availableBrands.length;

  // 加载状态
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">加载品牌列表中...</span>
      </div>
    );
  }

  // 空状态
  if (availableBrands.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
        <p>暂无可用品牌</p>
        <p className="text-xs mt-1">请先在品牌管理中添加品牌</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 工具栏：搜索和全选 */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索品牌名称或ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="select-all"
              checked={isAllSelected}
              ref={ref => {
                if (ref && "indeterminate" in ref) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (ref as any).indeterminate = isPartialSelected;
                }
              }}
              onCheckedChange={checked => {
                if (checked) {
                  selectAllBrands(availableBrands.map(b => b.id));
                } else {
                  clearSelectedBrands();
                }
              }}
            />
            <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer select-none">
              全选 ({selectedBrands.length}/{availableBrands.length})
            </Label>
          </div>

          <div className="flex gap-2">
            {selectedBrands.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelectedBrands}
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
              >
                清空
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 品牌列表 - 滚动区域 */}
      <div className="border rounded-md bg-background">
        <div className="h-[400px] overflow-y-auto custom-scrollbar">
          <div className="p-2 space-y-1">
            {filteredBrands.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                没有找到匹配的品牌
              </div>
            ) : (
              filteredBrands.map(brand => {
                const isSelected = selectedBrands.includes(brand.id);
                return (
                  <div
                    key={brand.id}
                    className={`flex items-center space-x-3 p-2 rounded-md transition-colors cursor-pointer ${
                      isSelected ? "bg-primary/10" : "hover:bg-muted"
                    }`}
                    onClick={() => toggleBrand(brand.id)}
                  >
                    <Checkbox checked={isSelected} className="pointer-events-none" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">{brand.name}</span>
                        {isSelected && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1">
                            已选
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="truncate">ID: {brand.id}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
