"use client";

import { useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckSquare, Square, Users, Building2, Loader2 } from "lucide-react";
import { useSyncStore } from "@/lib/stores/sync-store";
import { useBrandManagementStore } from "@/lib/stores/brand-management-store";

export const BrandSelector = () => {
  const { selectedBrands, toggleBrand, selectAllBrands, clearSelectedBrands, setSelectedBrands } = useSyncStore();

  // 从 Brand Management Store 获取品牌列表
  const availableBrands = useBrandManagementStore((state) => state.availableBrands);
  const loading = useBrandManagementStore((state) => state.availableBrandsLoading);
  const loadAvailableBrands = useBrandManagementStore((state) => state.loadAvailableBrands);

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
        console.log(`🧹 清理了 ${selectedBrands.length - validSelectedBrands.length} 个已删除的品牌选择`);
        setSelectedBrands(validSelectedBrands);
      }
    }
  }, [availableBrands, selectedBrands, setSelectedBrands]);

  const isAllSelected = selectedBrands.length === availableBrands.length;
  const isPartialSelected =
    selectedBrands.length > 0 && selectedBrands.length < availableBrands.length;

  // 加载状态
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">加载品牌列表中...</span>
      </div>
    );
  }

  // 空状态
  if (availableBrands.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>暂无可用品牌</p>
        <p className="text-xs mt-1">请先在品牌管理中添加品牌</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 全选控制 */}
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
          <Label htmlFor="select-all" className="font-medium">
            {isAllSelected ? "取消全选" : "全选"}
          </Label>
          <Badge variant="secondary" className="ml-2">
            {selectedBrands.length} / {availableBrands.length}
          </Badge>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => selectAllBrands(availableBrands.map(b => b.id))}
            disabled={isAllSelected}
          >
            <CheckSquare className="h-4 w-4 mr-1" />
            全选
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearSelectedBrands}
            disabled={selectedBrands.length === 0}
          >
            <Square className="h-4 w-4 mr-1" />
            清空
          </Button>
        </div>
      </div>

      {/* 品牌列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {availableBrands.map(brand => {
          const isSelected = selectedBrands.includes(brand.id);

          return (
            <Card
              key={brand.id}
              className={`cursor-pointer transition-all ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/50 hover:bg-accent/50"
              }`}
              onClick={() => toggleBrand(brand.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={isSelected}
                    onChange={() => {}} // 控制权交给父容器的 onClick
                    className="pointer-events-none"
                  />

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <Label className="font-medium cursor-pointer">{brand.name}</Label>
                    </div>

                    <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span>组织ID: {brand.id}</span>
                    </div>
                  </div>

                  {isSelected && (
                    <Badge variant="default" className="ml-auto">
                      已选择
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 选择状态提示 */}
      {selectedBrands.length > 0 && (
        <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <CheckSquare className="h-4 w-4 text-primary" />
            <span className="font-medium">已选择 {selectedBrands.length} 个品牌进行数据同步</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            选中的品牌:{" "}
            {selectedBrands
              .map(id => availableBrands.find(b => b.id === id)?.name)
              .filter(Boolean)
              .join(", ")}
          </div>
        </div>
      )}

      {/* 空状态提示 */}
      {selectedBrands.length === 0 && (
        <div className="mt-4 p-3 bg-muted/50 border border-muted rounded-lg text-center">
          <div className="text-sm text-muted-foreground">请选择至少一个品牌进行数据同步</div>
        </div>
      )}
    </div>
  );
};
