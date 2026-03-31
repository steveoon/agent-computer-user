"use client";

import React, { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, RefreshCw, Eye, Code2, Database, Calendar } from "lucide-react";
import { ScheduleEditor } from "./schedule-editor";
import { SearchPagination } from "@/components/ui/search-pagination";
import { useBrandEditorStore } from "@/lib/stores/brand-editor-store";
import type { ZhipinData } from "@/types";
import { getAllStores, getBrandById, getPrimaryCity } from "@/types";

interface BrandDataEditorProps {
  data: ZhipinData | undefined;
  onSave: (
    data: ZhipinData,
    options?: {
      customToast?: {
        title: string;
        description?: string;
      };
    }
  ) => Promise<void>;
}

export const BrandDataEditor: React.FC<BrandDataEditorProps> = ({ data, onSave }) => {
  const {
    localData,
    jsonData,
    editMode,
    editingBrand,
    editingType,
    isSaving,
    error,
    hasUnsavedChanges,
    initializeData,
    setEditMode,
    setEditingBrand,
    setEditingType,
    updateJsonData,
    saveData,
    resetData,
  } = useBrandEditorStore();

  // Initialize data when data prop changes
  useEffect(() => {
    if (data) {
      initializeData(data);
      console.log("BrandDataEditor re-initialized data", {
        brands: data.brands.length,
        stores: getAllStores(data).length,
        timestamp: new Date().toISOString(),
      });
    }
  }, [data, initializeData]);

  // Render overview
  const renderOverview = () => {
    if (!localData) return null;

    const allStores = getAllStores(localData);
    const brandCount = localData.brands.length;
    const storeCount = allStores.length;

    // Infer covered cities from stores
    const storeCities = allStores
      .map(store => store.city)
      .filter((city): city is string => Boolean(city));
    const uniqueCities = Array.from(new Set(storeCities));
    const primaryCity = getPrimaryCity(localData);
    const cityInfo =
      uniqueCities.length > 0
        ? uniqueCities.length === 1
          ? uniqueCities[0]
          : `${uniqueCities.length}个城市`
        : primaryCity || "未设置";
    const cityTooltip = uniqueCities.length > 1 ? uniqueCities.join("、") : undefined;

    return (
      <div className="space-y-6">
        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">品牌数量</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{brandCount}</div>
              <p className="text-xs text-muted-foreground">个配置品牌</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">门店数量</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{storeCount}</div>
              <p className="text-xs text-muted-foreground">家门店</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">覆盖城市</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" title={cityTooltip}>
                {cityInfo}
              </div>
              <p className="text-xs text-muted-foreground">
                {uniqueCities.length > 1
                  ? `${uniqueCities.slice(0, 3).join("、")}${uniqueCities.length > 3 ? "等" : ""}`
                  : "主要城市"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Brand list */}
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>品牌配置</CardTitle>
                <CardDescription className="mt-1">当前配置的品牌及其基本信息</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {editingBrand ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">
                    编辑 {editingBrand} 品牌排班
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingBrand(null);
                      setEditingType(null);
                    }}
                  >
                    返回列表
                  </Button>
                </div>
                {editingType === "schedule" && (
                  <ScheduleEditor brandName={editingBrand} onDataUpdate={onSave} />
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {localData.brands.map(brand => (
                  <div
                    key={brand.id}
                    className="p-4 border rounded-lg bg-white/40 backdrop-blur-sm hover:bg-white/60 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium">{brand.name}</h3>
                      <Badge variant="outline" className="bg-white/50">
                        {brand.stores.length} 门店
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>
                        岗位：
                        {brand.stores.reduce((sum, s) => sum + s.positions.length, 0)} 个
                      </div>
                      {brand.aliases && brand.aliases.length > 0 && (
                        <div>别名：{brand.aliases.join("、")}</div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-white/50 hover:bg-white/80"
                        onClick={() => {
                          setEditingBrand(brand.name);
                          setEditingType("schedule");
                        }}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        编辑排班
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Store list */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>所有品牌门店配置</CardTitle>
            <CardDescription>门店分布和基本信息</CardDescription>
          </CardHeader>
          <CardContent>
            <SearchPagination
              data={allStores}
              searchKeys={["name", "location", "district", "brandId"]}
              itemsPerPageOptions={[10, 20, 50, 100]}
              defaultItemsPerPage={20}
              placeholder="搜索门店名称、地址、区域..."
              emptyMessage="暂无门店数据"
              searchEmptyMessage="未找到匹配的门店"
              renderItem={store => {
                const brand = getBrandById(localData, store.brandId);
                return (
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-medium">{store.name}</h4>
                        <p className="text-sm text-muted-foreground">{store.location}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary">{brand?.name ?? store.brandId}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">{store.district}</p>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <div>岗位：{store.positions.length} 个</div>
                    </div>
                  </div>
                );
              }}
            />
          </CardContent>
        </Card>

        {/* Usage instructions */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>编辑说明</CardTitle>
            <CardDescription>如何编辑品牌数据配置</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-2">
              <p>切换到 "JSON编辑" 标签页可以直接编辑原始数据</p>
              <p>修改后请点击 "保存" 按钮保存更改</p>
              <p>支持添加新品牌、修改门店信息、调整筛选规则等</p>
              <p>保存前请确保JSON格式正确，避免数据损坏</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  if (!data) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>品牌数据编辑器</CardTitle>
          <CardDescription>配置品牌信息和门店数据</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">没有品牌数据可编辑</p>
            <p className="text-sm text-muted-foreground mt-2">
              请确保已完成数据迁移或重新初始化配置
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header action bar */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>品牌数据编辑器</CardTitle>
              <CardDescription>管理品牌配置和门店信息，支持概览查看和JSON编辑</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {hasUnsavedChanges && (
                <Badge variant="outline" className="text-amber-600">
                  未保存的更改
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={resetData} disabled={isSaving}>
                <RefreshCw className="h-4 w-4 mr-2" />
                重置
              </Button>
              <Button
                onClick={() => saveData(onSave)}
                size="sm"
                disabled={isSaving}
                className="min-w-20"
              >
                {isSaving ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {isSaving ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Error display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Edit mode toggle */}
      <Tabs value={editMode} onValueChange={value => setEditMode(value as "overview" | "json")}>
        <TabsList className="grid w-full grid-cols-2 glass-tabs">
          <TabsTrigger value="overview" className="flex items-center gap-2 glass-tab-active">
            <Eye className="h-4 w-4" />
            数据概览
          </TabsTrigger>
          <TabsTrigger value="json" className="flex items-center gap-2 glass-tab-active">
            <Code2 className="h-4 w-4" />
            JSON编辑
          </TabsTrigger>
        </TabsList>

        {/* Overview mode */}
        <TabsContent value="overview">{renderOverview()}</TabsContent>

        {/* JSON edit mode */}
        <TabsContent value="json">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">JSON 数据编辑</CardTitle>
              <CardDescription>直接编辑品牌数据的JSON格式，请确保语法正确</CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                value={jsonData}
                onChange={e => updateJsonData(e.target.value)}
                className="w-full h-96 p-4 font-mono text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring bg-slate-950 text-slate-50 leading-relaxed"
                placeholder="输入品牌数据的JSON格式..."
                spellCheck={false}
              />
              <div className="mt-2 text-xs text-muted-foreground">
                提示：修改后请点击"保存"按钮保存更改
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
