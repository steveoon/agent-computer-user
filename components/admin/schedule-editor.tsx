"use client";

import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { toastConfirm } from "@/lib/ui/toast-confirm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  Clock,
  Users,
  Building,
  Save,
  CheckCircle2,
  Settings,
  Zap,
  Timer,
  UserCheck,
  CalendarDays,
  Edit3,
  Search,
  X,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useBrandEditorStore } from "@/lib/stores/brand-editor-store";
import type { ScheduleType, SchedulingFlexibility, ZhipinData } from "@/types";

interface ScheduleEditorProps {
  brandName: string;
  onDataUpdate?: (data: ZhipinData) => Promise<void>;
}

const SCHEDULE_TYPE_CONFIG: Record<
  ScheduleType,
  {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }
> = {
  fixed: {
    label: "固定排班",
    description: "固定时间段工作，时间相对稳定",
    icon: Clock,
    color: "text-brand-primary",
  },
  flexible: {
    label: "灵活排班",
    description: "可以灵活调整工作时间，适应不同需求",
    icon: Zap,
    color: "text-green-600",
  },
  rotating: {
    label: "轮班制",
    description: "按轮班表轮流工作，适合24小时营业",
    icon: CalendarDays,
    color: "text-purple-600",
  },
  on_call: {
    label: "随叫随到",
    description: "根据需要随时待命工作，灵活性最高",
    icon: Timer,
    color: "text-orange-600",
  },
};

export function ScheduleEditor({ brandName, onDataUpdate }: ScheduleEditorProps) {
  const { localData, updateSchedulingInfo } = useBrandEditorStore();

  // 搜索状态
  const [searchKeyword, setSearchKeyword] = useState<string>("");

  // 批量操作状态
  const [isApplying, setIsApplying] = useState<boolean>(false);

  // 批量设置的状态
  const [batchScheduleType, setBatchScheduleType] = useState<ScheduleType>("flexible");
  const [batchFlexibility, setBatchFlexibility] = useState<SchedulingFlexibility>({
    canSwapShifts: true,
    advanceNoticeHours: 24,
    partTimeAllowed: true,
    weekendRequired: false,
    holidayRequired: false,
  });

  // 编辑状态
  const [editingStore, setEditingStore] = useState<{
    storeIndex: number;
    positionIndex?: number;
    scheduleType: ScheduleType;
    flexibility: SchedulingFlexibility;
  } | null>(null);

  const brandStores = useMemo(() => {
    if (!localData) return [];
    return localData.stores
      .map((store, index) => ({ ...store, originalIndex: index }))
      .filter(store => store.brand === brandName)
      .filter(store => {
        if (!searchKeyword.trim()) return true;
        return (
          store.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
          store.location.toLowerCase().includes(searchKeyword.toLowerCase())
        );
      });
  }, [localData, brandName, searchKeyword]);

  // 分析当前品牌下门店的排班设置，获取最常见的配置
  const getMostCommonConfig = useMemo(() => {
    if (!localData || brandStores.length === 0) {
      return {
        scheduleType: "flexible" as ScheduleType,
        flexibility: {
          canSwapShifts: true,
          advanceNoticeHours: 24,
          partTimeAllowed: true,
          weekendRequired: false,
          holidayRequired: false,
        } as SchedulingFlexibility,
      };
    }

    // 收集所有岗位的设置
    const allPositions = brandStores.flatMap(store => store.positions);

    if (allPositions.length === 0) {
      return {
        scheduleType: "flexible" as ScheduleType,
        flexibility: {
          canSwapShifts: true,
          advanceNoticeHours: 24,
          partTimeAllowed: true,
          weekendRequired: false,
          holidayRequired: false,
        } as SchedulingFlexibility,
      };
    }

    // 统计排班类型出现频率
    const scheduleTypeCount: Record<ScheduleType, number> = {
      fixed: 0,
      flexible: 0,
      rotating: 0,
      on_call: 0,
    };

    allPositions.forEach(position => {
      if (position.scheduleType in scheduleTypeCount) {
        scheduleTypeCount[position.scheduleType]++;
      }
    });

    // 找到最常见的排班类型
    const mostCommonScheduleType = Object.entries(scheduleTypeCount).sort(
      ([, a], [, b]) => b - a
    )[0][0] as ScheduleType;

    // 获取使用最常见排班类型的第一个岗位的设置
    const samplePosition = allPositions.find(p => p.scheduleType === mostCommonScheduleType);

    return {
      scheduleType: mostCommonScheduleType,
      flexibility: samplePosition?.schedulingFlexibility || {
        canSwapShifts: true,
        advanceNoticeHours: 24,
        partTimeAllowed: true,
        weekendRequired: false,
        holidayRequired: false,
      },
    };
  }, [localData, brandStores]);

  // 当数据加载完成或品牌变更时，初始化批量设置为最常见的配置
  useEffect(() => {
    if (localData && brandStores.length > 0) {
      const commonConfig = getMostCommonConfig;
      setBatchScheduleType(commonConfig.scheduleType);
      setBatchFlexibility(commonConfig.flexibility);
      console.log("🔄 初始化批量设置为最常见配置", {
        scheduleType: commonConfig.scheduleType,
        flexibility: commonConfig.flexibility,
        basedOnPositions: brandStores.flatMap(store => store.positions).length,
      });
    }
  }, [localData, brandStores, getMostCommonConfig]);

  // 手动刷新批量设置为最常见配置
  const handleRefreshBatchConfig = () => {
    if (localData && brandStores.length > 0) {
      const commonConfig = getMostCommonConfig;
      setBatchScheduleType(commonConfig.scheduleType);
      setBatchFlexibility(commonConfig.flexibility);
      toast.success("已刷新为最常见配置", {
        description: `基于 ${brandStores.flatMap(store => store.positions).length} 个岗位的设置`,
        duration: 2000,
      });
    }
  };

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

    // 获取当前品牌下的门店数量和岗位数量
    const currentBrandStores = localData?.stores.filter(store => store.brand === brandName) || [];
    const totalPositions = currentBrandStores.reduce(
      (total, store) => total + store.positions.length,
      0
    );

    // 使用 toast 确认
    toastConfirm({
      title: "批量应用排班设置",
      description: `这将更新 ${brandName} 品牌下的 ${currentBrandStores.length} 家门店和 ${totalPositions} 个岗位。此操作将覆盖现有的排班设置。`,
      confirmLabel: "确定应用",
      cancelLabel: "取消",
      onConfirm: async () => {
        setIsApplying(true);

        // 将 loadingToastId 声明提到 try 外部，以便在 catch 中访问
        let loadingToastId: string | number | undefined;

        try {
          // 显示开始应用的提示
          loadingToastId = toast.loading("正在批量应用排班设置...", {
            description: `即将更新 ${currentBrandStores.length} 家门店的 ${totalPositions} 个岗位`,
          });

          // 模拟一个短暂的延迟来显示加载状态
          await new Promise(resolve => setTimeout(resolve, 800));

          // 执行批量更新（更新Zustand store）并获取更新后的数据
          const updatedData = updateSchedulingInfo(
            brandName,
            batchScheduleType,
            batchFlexibility,
            "all"
          );

          // 保存更新后的数据
          if (updatedData && onDataUpdate) {
            await onDataUpdate(updatedData);
            console.log("✅ 排班设置已自动保存并同步状态");
          }

          // 关闭加载提示并显示成功提示
          toast.dismiss(loadingToastId);
          toast.success("批量设置成功！", {
            description: `已成功更新 ${currentBrandStores.length} 家门店的所有岗位排班设置并自动保存`,
            duration: 3000,
          });
        } catch (error) {
          console.error("批量应用失败:", error);
          // 只关闭当前的 loading toast，避免误关其他 toast
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
        scheduleType: currentPosition.scheduleType,
        flexibility: { ...currentPosition.schedulingFlexibility },
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!editingStore) return;

    try {
      // 执行排班更新（更新Zustand store）并获取更新后的数据
      const updatedData = updateSchedulingInfo(
        brandName,
        editingStore.scheduleType,
        editingStore.flexibility,
        "store",
        editingStore.storeIndex,
        editingStore.positionIndex
      );

      // 保存更新后的数据
      if (updatedData && onDataUpdate) {
        await onDataUpdate(updatedData);
        console.log("✅ 排班设置已自动保存并同步状态");
      }

      const isIndividualPosition = editingStore.positionIndex !== undefined;
      const successMessage = isIndividualPosition ? "岗位排班设置已更新" : "门店排班设置已更新";

      toast.success(successMessage, {
        description: isIndividualPosition
          ? "已成功更新该岗位的排班规则并保存"
          : "已成功更新该门店所有岗位的排班规则并保存",
        duration: 2000,
      });

      setEditingStore(null);
    } catch (error) {
      console.error("保存排班设置失败:", error);
      toast.error("保存失败", {
        description: "请稍后重试或检查数据格式",
        duration: 3000,
      });
    }
  };

  // 渲染排班类型选择器
  const renderScheduleTypeSelector = (
    value: ScheduleType,
    onChange: (value: ScheduleType) => void,
    size: "default" | "sm" = "default"
  ) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={size === "sm" ? "h-8" : ""}>
        <SelectValue>
          <div className="flex items-center gap-2">
            {(() => {
              const IconComponent = SCHEDULE_TYPE_CONFIG[value].icon;
              return <IconComponent className={`h-4 w-4 ${SCHEDULE_TYPE_CONFIG[value].color}`} />;
            })()}
            <span>{SCHEDULE_TYPE_CONFIG[value].label}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(SCHEDULE_TYPE_CONFIG).map(([key, config]) => {
          const IconComponent = config.icon;
          return (
            <SelectItem key={key} value={key}>
              <div className="flex items-start gap-3 py-1">
                <IconComponent className={`h-4 w-4 mt-0.5 ${config.color}`} />
                <div>
                  <div className="font-medium">{config.label}</div>
                  <div className="text-xs text-muted-foreground">{config.description}</div>
                </div>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );

  // 渲染灵活性设置
  const renderFlexibilitySettings = (
    flexibility: SchedulingFlexibility,
    onChange: (key: keyof SchedulingFlexibility, value: boolean | number) => void,
    size: "default" | "compact" = "default"
  ) => (
    <div className={`space-y-${size === "compact" ? "3" : "4"}`}>
      <div
        className={`grid grid-cols-1 ${size === "compact" ? "md:grid-cols-4" : "md:grid-cols-2"} gap-${size === "compact" ? "3" : "4"}`}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-between space-x-2 p-2 rounded-md border">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-brand-primary" />
                  <Label className="text-sm font-medium">换班</Label>
                </div>
                <Switch
                  checked={flexibility.canSwapShifts}
                  onCheckedChange={checked => onChange("canSwapShifts", checked)}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>员工是否可以相互调换班次</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-between space-x-2 p-2 rounded-md border">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-green-600" />
                  <Label className="text-sm font-medium">兼职</Label>
                </div>
                <Switch
                  checked={flexibility.partTimeAllowed}
                  onCheckedChange={checked => onChange("partTimeAllowed", checked)}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>是否支持兼职员工</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-between space-x-2 p-2 rounded-md border">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-purple-600" />
                  <Label className="text-sm font-medium">周末</Label>
                </div>
                <Switch
                  checked={flexibility.weekendRequired}
                  onCheckedChange={checked => onChange("weekendRequired", checked)}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>是否需要员工周末上班</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-between space-x-2 p-2 rounded-md border">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-orange-600" />
                  <Label className="text-sm font-medium">节假日</Label>
                </div>
                <Switch
                  checked={flexibility.holidayRequired}
                  onCheckedChange={checked => onChange("holidayRequired", checked)}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>是否需要员工节假日上班</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Timer className="h-4 w-4 text-amber-600" />
                提前通知时间
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max="168"
                  value={flexibility.advanceNoticeHours}
                  onChange={e => onChange("advanceNoticeHours", parseInt(e.target.value) || 24)}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">小时</span>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>员工需要提前多少小时通知调班或请假</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );

  // 渲染批量设置区域
  const renderBatchSettings = () => (
    <Card className="bg-gradient-to-r from-brand-light/20 to-brand-light/10 border-brand-primary/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-brand-light/30 rounded-lg">
              <Users className="h-5 w-5 text-brand-primary" />
            </div>
            批量设置排班规则
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshBatchConfig}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            重新计算
          </Button>
        </div>
        <div className="text-sm text-muted-foreground">
          为{" "}
          <Badge variant="outline" className="mx-1">
            {brandName}
          </Badge>{" "}
          品牌下所有门店统一设置排班规则
          <br />
          <span className="text-xs text-brand-primary">💡 当前显示的是基于现有门店数据的最常见配置</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 排班类型选择 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-gray-600" />
            <Label className="text-base font-medium">排班类型</Label>
          </div>
          {renderScheduleTypeSelector(batchScheduleType, setBatchScheduleType)}
        </div>

        <Separator />

        {/* 排班灵活性设置 */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-gray-600" />
            <Label className="text-base font-medium">排班灵活性设置</Label>
          </div>
          {renderFlexibilitySettings(batchFlexibility, (key, value) =>
            setBatchFlexibility({ ...batchFlexibility, [key]: value })
          )}
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
  );

  // 渲染岗位状态标识
  const renderPositionStatus = (position: { schedulingFlexibility: SchedulingFlexibility }) => (
    <div className="flex flex-wrap gap-1 text-xs">
      <Badge
        variant={position.schedulingFlexibility.canSwapShifts ? "default" : "secondary"}
        className="text-xs"
      >
        {position.schedulingFlexibility.canSwapShifts ? "可换班" : "不可换班"}
      </Badge>
      <Badge
        variant={position.schedulingFlexibility.partTimeAllowed ? "default" : "secondary"}
        className="text-xs"
      >
        {position.schedulingFlexibility.partTimeAllowed ? "支持兼职" : "仅全职"}
      </Badge>
      <Badge variant="outline" className="text-xs">
        提前{position.schedulingFlexibility.advanceNoticeHours}h
      </Badge>
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
            {store.positions.map((position, positionIndex) => {
              const TypeIcon = SCHEDULE_TYPE_CONFIG[position.scheduleType].icon;
              return (
                <div
                  key={position.id}
                  className="border rounded-lg p-4 bg-white hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-1.5 rounded-md ${
                          position.scheduleType === "fixed"
                            ? "bg-brand-light/30"
                            : position.scheduleType === "flexible"
                              ? "bg-green-100"
                              : position.scheduleType === "rotating"
                                ? "bg-purple-100"
                                : "bg-orange-100"
                        }`}
                      >
                        <TypeIcon
                          className={`h-4 w-4 ${SCHEDULE_TYPE_CONFIG[position.scheduleType].color}`}
                        />
                      </div>
                      <div>
                        <span className="font-medium">{position.name}</span>
                        <div className="text-xs text-muted-foreground">
                          {SCHEDULE_TYPE_CONFIG[position.scheduleType].label}
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
              );
            })}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );

  return (
    <div className="space-y-6">
      {/* 批量设置区域 */}
      {renderBatchSettings()}

      {/* 门店列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Building className="h-5 w-5 text-orange-600" />
            </div>
            门店排班管理
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            精细化管理 {brandName} 品牌下的排班设置
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
          <Card className="fixed inset-x-4 top-4 z-50 max-w-3xl mx-auto shadow-xl border-2">
            <CardHeader className="bg-gradient-to-r from-brand-light/20 to-brand-light/10">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-brand-light/30 rounded-lg">
                  <Calendar className="h-5 w-5 text-brand-primary" />
                </div>
                编辑排班设置
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                {editingStore.positionIndex !== undefined
                  ? "设置单个岗位的排班规则"
                  : "批量设置门店所有岗位的排班规则"}
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              {/* 排班类型 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-gray-600" />
                  <Label className="text-base font-medium">排班类型</Label>
                </div>
                {renderScheduleTypeSelector(editingStore.scheduleType, value =>
                  setEditingStore({ ...editingStore, scheduleType: value })
                )}
              </div>

              <Separator />

              {/* 灵活性设置 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-gray-600" />
                  <Label className="text-base font-medium">排班灵活性设置</Label>
                </div>
                {renderFlexibilitySettings(
                  editingStore.flexibility,
                  (key, value) =>
                    setEditingStore({
                      ...editingStore,
                      flexibility: { ...editingStore.flexibility, [key]: value },
                    }),
                  "compact"
                )}
              </div>

              <Separator />

              {/* 操作按钮 */}
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
