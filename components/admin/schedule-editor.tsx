"use client";

import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { toastConfirm } from "@/lib/ui/toast-confirm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import {
  Users,
  Building,
  Save,
  CheckCircle2,
  Settings,
  Edit3,
  Search,
  X,
  Loader2,
  Briefcase,
} from "lucide-react";
import { useBrandEditorStore } from "@/lib/stores/brand-editor-store";
import type { ZhipinData, Store } from "@/types";
import { getAllStores, findBrandByNameOrAlias } from "@/types";

interface ScheduleEditorProps {
  brandName: string;
  onDataUpdate?: (data: ZhipinData) => Promise<void>;
}

export function ScheduleEditor({ brandName, onDataUpdate }: ScheduleEditorProps) {
  const { localData, updatePositionFields } = useBrandEditorStore();

  const [searchKeyword, setSearchKeyword] = useState<string>("");
  const [isApplying, setIsApplying] = useState<boolean>(false);

  // 批量设置状态
  const [batchLaborForm, setBatchLaborForm] = useState<string>("");
  const [batchEmploymentForm, setBatchEmploymentForm] = useState<string>("");

  // 编辑状态
  const [editingStore, setEditingStore] = useState<{
    storeIndex: number;
    positionIndex?: number;
    laborForm: string;
    employmentForm: string;
  } | null>(null);

  const brandStores = useMemo(() => {
    if (!localData) return [];
    const brand = findBrandByNameOrAlias(localData, brandName);
    if (!brand) return [];
    const allStores = getAllStores(localData);
    return allStores
      .map((store: Store, index: number) => ({ ...store, originalIndex: index }))
      .filter(store => store.brandId === brand.id)
      .filter(store => {
        if (!searchKeyword.trim()) return true;
        return (
          store.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
          store.location.toLowerCase().includes(searchKeyword.toLowerCase())
        );
      });
  }, [localData, brandName, searchKeyword]);

  // 从现有数据初始化批量设置
  useEffect(() => {
    if (localData && brandStores.length > 0) {
      const firstPosition = brandStores[0]?.positions[0];
      if (firstPosition) {
        setBatchLaborForm(firstPosition.laborForm ?? "");
        setBatchEmploymentForm(firstPosition.employmentForm ?? "");
      }
    }
  }, [localData, brandStores]);

  if (!localData) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">品牌数据未找到</div>
        </CardContent>
      </Card>
    );
  }

  const handleBatchApply = async () => {
    if (isApplying) return;

    const brand = localData ? findBrandByNameOrAlias(localData, brandName) : undefined;
    const currentBrandStores = brand?.stores ?? [];
    const totalPositions = currentBrandStores.reduce(
      (total: number, store: Store) => total + store.positions.length,
      0
    );

    toastConfirm({
      title: "批量应用用工设置",
      description: `这将更新 ${brandName} 品牌下的 ${currentBrandStores.length} 家门店和 ${totalPositions} 个岗位。`,
      confirmLabel: "确定应用",
      cancelLabel: "取消",
      onConfirm: async () => {
        setIsApplying(true);
        let loadingToastId: string | number | undefined;

        try {
          loadingToastId = toast.loading("正在批量应用用工设置...", {
            description: `即将更新 ${currentBrandStores.length} 家门店的 ${totalPositions} 个岗位`,
          });

          await new Promise(resolve => setTimeout(resolve, 800));

          const updatedData = updatePositionFields(
            brandName,
            batchLaborForm || null,
            batchEmploymentForm || null,
            "all"
          );

          if (updatedData && onDataUpdate) {
            await onDataUpdate(updatedData);
          }

          toast.dismiss(loadingToastId);
          toast.success("批量设置成功！", {
            description: `已成功更新 ${currentBrandStores.length} 家门店的所有岗位并自动保存`,
            duration: 3000,
          });
        } catch (error) {
          console.error("批量应用失败:", error);
          if (loadingToastId) {
            toast.dismiss(loadingToastId);
          }
          toast.error("批量设置失败", {
            description: "请稍后重试或检查网络连接",
            duration: 3000,
          });
        } finally {
          setIsApplying(false);
        }
      },
    });
  };

  const handleStartEdit = (storeIndex: number, positionIndex?: number) => {
    const store = brandStores[storeIndex];
    if (!store) return;

    const currentPosition =
      positionIndex !== undefined ? store.positions[positionIndex] : store.positions[0];

    if (currentPosition) {
      setEditingStore({
        storeIndex: store.originalIndex,
        positionIndex,
        laborForm: currentPosition.laborForm ?? "",
        employmentForm: currentPosition.employmentForm ?? "",
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!editingStore) return;

    try {
      const updatedData = updatePositionFields(
        brandName,
        editingStore.laborForm || null,
        editingStore.employmentForm || null,
        "store",
        editingStore.storeIndex,
        editingStore.positionIndex
      );

      if (updatedData && onDataUpdate) {
        await onDataUpdate(updatedData);
      }

      const isIndividualPosition = editingStore.positionIndex !== undefined;
      toast.success(isIndividualPosition ? "岗位设置已更新" : "门店设置已更新", {
        description: isIndividualPosition
          ? "已成功更新该岗位的用工信息并保存"
          : "已成功更新该门店所有岗位的用工信息并保存",
        duration: 2000,
      });

      setEditingStore(null);
    } catch (error) {
      console.error("保存设置失败:", error);
      toast.error("保存失败", {
        description: "请稍后重试或检查数据格式",
        duration: 3000,
      });
    }
  };

  // 渲染岗位状态标识
  const renderPositionStatus = (position: { laborForm: string | null; employmentForm: string | null }) => (
    <div className="flex flex-wrap gap-1 text-xs">
      {position.laborForm && (
        <Badge variant="default" className="text-xs">
          {position.laborForm}
        </Badge>
      )}
      {position.employmentForm && (
        <Badge variant="secondary" className="text-xs">
          {position.employmentForm}
        </Badge>
      )}
      {!position.laborForm && !position.employmentForm && (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          未设置
        </Badge>
      )}
    </div>
  );

  // 渲染单个门店
  const renderStore = (store: (typeof brandStores)[0], storeIndex: number) => (
    <AccordionItem key={store.originalIndex} value={store.originalIndex.toString()}>
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center justify-between w-full pr-4">
          <div className="flex items-center gap-3 text-left">
            <div className="p-1.5 bg-orange-100 rounded-md">
              <Building className="h-4 w-4 text-orange-600" />
            </div>
            <div>
              <div className="font-medium">{store.name}</div>
              <div className="text-xs text-muted-foreground">{store.location}</div>
            </div>
          </div>
          <Badge variant="outline" className="bg-white">
            {store.positions.length} 个岗位
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4 pt-2">
          {/* 门店级操作 */}
          <div className="p-3 bg-gray-50 rounded-lg border-l-4 border-gray-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium">门店统一设置</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => handleStartEdit(storeIndex)}>
                <Edit3 className="h-4 w-4 mr-1" />
                编辑所有岗位
              </Button>
            </div>
          </div>

          {/* 岗位列表 */}
          <div className="space-y-3">
            {store.positions.map((position, positionIndex) => (
              <div
                key={position.id}
                className="border rounded-lg p-4 bg-white hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-brand-light/30">
                      <Briefcase className="h-4 w-4 text-brand-primary" />
                    </div>
                    <div>
                      <span className="font-medium">{position.name}</span>
                      <div className="text-xs text-muted-foreground">
                        {position.laborForm ?? "未设置用工形式"}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleStartEdit(storeIndex, positionIndex)}
                  >
                    <Edit3 className="h-4 w-4 mr-1" />
                    编辑
                  </Button>
                </div>
                {renderPositionStatus(position)}
              </div>
            ))}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );

  return (
    <div className="space-y-6">
      {/* 批量设置区域 */}
      <Card className="bg-gradient-to-r from-brand-light/20 to-brand-light/10 border-brand-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-brand-light/30 rounded-lg">
              <Users className="h-5 w-5 text-brand-primary" />
            </div>
            批量设置用工信息
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            为{" "}
            <Badge variant="outline" className="mx-1">
              {brandName}
            </Badge>{" "}
            品牌下所有门店统一设置用工形式
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">用工形式</Label>
              <Input
                placeholder="如：兼职、全职"
                value={batchLaborForm}
                onChange={e => setBatchLaborForm(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">用工类型</Label>
              <Input
                placeholder="如：长期用工、短期用工"
                value={batchEmploymentForm}
                onChange={e => setBatchEmploymentForm(e.target.value)}
              />
            </div>
          </div>

          <Separator />

          <Button
            onClick={handleBatchApply}
            className="w-full"
            size="lg"
            disabled={isApplying || brandStores.length === 0}
          >
            {isApplying ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isApplying ? "正在应用设置..." : "应用到所有门店岗位"}
          </Button>
        </CardContent>
      </Card>

      {/* 门店列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Building className="h-5 w-5 text-orange-600" />
            </div>
            门店用工管理
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            精细化管理 {brandName} 品牌下的用工设置
            {searchKeyword.trim() && (
              <span className="ml-2 text-brand-primary font-medium">
                • 找到 {brandStores.length} 家匹配门店
              </span>
            )}
          </div>

          {/* 搜索框 */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索门店名称或地址..."
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchKeyword.trim() && (
              <Button
                size="sm"
                variant="ghost"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-gray-100"
                onClick={() => setSearchKeyword("")}
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {brandStores.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {brandStores.map((store, index) => renderStore(store, index))}
            </Accordion>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {searchKeyword.trim() ? (
                <div className="space-y-2">
                  <Search className="h-8 w-8 mx-auto text-muted-foreground/50" />
                  <div>未找到匹配 "{searchKeyword}" 的门店</div>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setSearchKeyword("")}
                    className="text-brand-primary h-auto p-0"
                  >
                    清除搜索条件
                  </Button>
                </div>
              ) : (
                "该品牌下暂无门店数据"
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 编辑弹窗 */}
      {editingStore && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setEditingStore(null)} />
          <Card className="fixed inset-x-4 top-4 z-50 max-w-lg mx-auto shadow-xl border-2">
            <CardHeader className="bg-gradient-to-r from-brand-light/20 to-brand-light/10">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-brand-light/30 rounded-lg">
                  <Briefcase className="h-5 w-5 text-brand-primary" />
                </div>
                编辑用工设置
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                {editingStore.positionIndex !== undefined
                  ? "设置单个岗位的用工信息"
                  : "批量设置门店所有岗位的用工信息"}
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">用工形式</Label>
                  <Input
                    placeholder="如：兼职、全职"
                    value={editingStore.laborForm}
                    onChange={e =>
                      setEditingStore({ ...editingStore, laborForm: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">用工类型</Label>
                  <Input
                    placeholder="如：长期用工、短期用工"
                    value={editingStore.employmentForm}
                    onChange={e =>
                      setEditingStore({ ...editingStore, employmentForm: e.target.value })
                    }
                  />
                </div>
              </div>

              <Separator />

              <div className="flex gap-3 pt-4">
                <Button onClick={handleSaveEdit} className="flex-1">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  确定保存
                </Button>
                <Button variant="outline" onClick={() => setEditingStore(null)} className="flex-1">
                  取消
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
