"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBrandManagementStore } from "@/lib/stores/brand-management-store";
import { BrandFormDialog } from "./brand-form-dialog";
import { BrandTableToolbar } from "./brand-table-toolbar";
import type { BrandQueryParams, SourceSystem } from "./types";
import { isSourceSystem } from "./types";
import { deleteBrand, restoreBrand } from "@/actions/brand-mapping";
import type { DataDictionary } from "@/db/types";
import { useAuthStore } from "@/lib/stores/auth-store";

// 使用类型约束，确保与枚举一致
const SOURCE_SYSTEM_LABELS: Record<SourceSystem, string> = {
  haimian: "海棉系统",
  other: "其他",
};

export function BrandTable() {
  // 使用 zustand store
  const {
    brands: data,
    loading,
    error,
    params,
    setParams,
    loadBrands,
    refreshBrands,
  } = useBrandManagementStore();

  // Tab 状态
  const [activeTab, setActiveTab] = useState<"active" | "deleted">("active");

  // 删除确认对话框状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [brandToDelete, setBrandToDelete] = useState<DataDictionary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 恢复确认对话框状态
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [brandToRestore, setBrandToRestore] = useState<DataDictionary | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // 获取当前用户
  const { user } = useAuthStore();

  // 当 Tab 切换时，更新查询参数中的 isActive
  useEffect(() => {
    setParams(prev => ({ ...prev, isActive: activeTab === "active", page: 1 }));
  }, [activeTab, setParams]);

  // 初始加载和参数变化时重新加载
  useEffect(() => {
    loadBrands();
  }, [params, loadBrands]);

  // 显示错误提示
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  // 处理参数变化
  const handleParamsChange = (newParams: BrandQueryParams) => {
    setParams(newParams);
  };

  // 处理分页
  const handlePageChange = (newPage: number) => {
    setParams({ ...params, page: newPage });
  };

  // 格式化日期
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 打开删除确认对话框
  const handleDeleteClick = (brand: DataDictionary) => {
    setBrandToDelete(brand);
    setDeleteDialogOpen(true);
  };

  // 执行删除操作
  const handleDeleteConfirm = async () => {
    if (!brandToDelete) return;

    setIsDeleting(true);
    try {
      const result = await deleteBrand(brandToDelete.id, user?.email || "unknown user");

      if (result.success) {
        toast.success(result.message || "品牌已停用");
        setDeleteDialogOpen(false);
        setBrandToDelete(null);
        refreshBrands(); // 刷新列表
      } else {
        toast.error(result.error || "删除失败");
      }
    } catch (error) {
      console.error("删除品牌失败:", error);
      toast.error("删除失败，请重试");
    } finally {
      setIsDeleting(false);
    }
  };

  // 打开恢复确认对话框
  const handleRestoreClick = (brand: DataDictionary) => {
    setBrandToRestore(brand);
    setRestoreDialogOpen(true);
  };

  // 执行恢复操作
  const handleRestoreConfirm = async () => {
    if (!brandToRestore) return;

    setIsRestoring(true);
    try {
      const result = await restoreBrand(brandToRestore.id, user?.email || "unknown user");

      if (result.success) {
        toast.success(result.message || "品牌已恢复");
        setRestoreDialogOpen(false);
        setBrandToRestore(null);
        refreshBrands(); // 刷新列表
        // 切换到活跃品牌 tab 并短暂高亮
        setActiveTab("active");
      } else {
        toast.error(result.error || "恢复失败");
      }
    } catch (error) {
      console.error("恢复品牌失败:", error);
      toast.error("恢复失败，请重试");
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>品牌管理</CardTitle>
            <CardDescription>
              管理品牌与组织的映射关系，新增的品牌会自动出现在数据同步页面
            </CardDescription>
          </div>
          <BrandFormDialog onSuccess={refreshBrands} />
        </div>
      </CardHeader>

      <CardContent>
        {/* Tab 切换 */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "active" | "deleted")} className="mb-4">
          <TabsList>
            <TabsTrigger value="active">
              活跃品牌
              {data && activeTab === "active" && (
                <Badge variant="secondary" className="ml-2">
                  {data.total}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="deleted">
              已删除品牌
              {data && activeTab === "deleted" && data.total > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {data.total}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* 搜索和筛选工具栏 */}
        <BrandTableToolbar params={params} onParamsChange={handleParamsChange} />

        {/* 错误提示 */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={refreshBrands} disabled={loading}>
                重试
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* 表格 */}
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">ID</TableHead>
                <TableHead>组织ID</TableHead>
                <TableHead>品牌名称</TableHead>
                <TableHead>来源系统</TableHead>
                <TableHead>描述</TableHead>
                {activeTab === "active" ? (
                  <>
                    <TableHead>创建时间</TableHead>
                    <TableHead>更新时间</TableHead>
                    <TableHead className="w-[100px]">操作</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead>删除时间</TableHead>
                    <TableHead>删除人</TableHead>
                    <TableHead className="w-[100px]">操作</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <div className="flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span>加载中...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : data && data.items.length > 0 ? (
                data.items.map(brand => (
                  <TableRow key={brand.id}>
                    <TableCell className="font-medium">{brand.id}</TableCell>
                    <TableCell className="font-mono">{brand.mappingKey}</TableCell>
                    <TableCell className="font-medium">{brand.mappingValue}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {isSourceSystem(brand.sourceSystem)
                          ? SOURCE_SYSTEM_LABELS[brand.sourceSystem]
                          : SOURCE_SYSTEM_LABELS.other}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {brand.description || "-"}
                    </TableCell>
                    {activeTab === "active" ? (
                      <>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(brand.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(brand.updatedAt)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(brand)}
                            disabled={loading || isDeleting}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(brand.updatedAt)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {brand.updatedBy || "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRestoreClick(brand)}
                            disabled={loading || isRestoring}
                            className="text-green-600 hover:text-green-700"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    {params.keyword || params.sourceSystem ? "未找到匹配的品牌" : "暂无品牌数据"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* 分页控制 */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              共 {data.total} 条记录，第 {data.page} / {data.totalPages} 页
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(data.page - 1)}
                disabled={data.page <= 1 || loading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(data.page + 1)}
                disabled={data.page >= data.totalPages || loading}
              >
                下一页
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* 删除确认对话框 */}
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={open => {
          setDeleteDialogOpen(open);
          if (!open) {
            setBrandToDelete(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除品牌</DialogTitle>
            <DialogDescription>
              您确定要删除品牌{" "}
              <span className="font-semibold text-foreground">{brandToDelete?.mappingValue}</span>
              （组织ID: {brandToDelete?.mappingKey}）吗？
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-2">删除后的影响：</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>无法再同步该品牌的新数据</li>
              <li>已同步的历史数据会保留</li>
              <li>自动回复将不再识别该品牌</li>
            </ul>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              取消
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isDeleting ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 恢复确认对话框 */}
      <Dialog
        open={restoreDialogOpen}
        onOpenChange={open => {
          setRestoreDialogOpen(open);
          if (!open) {
            setBrandToRestore(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认恢复品牌</DialogTitle>
            <DialogDescription>
              您确定要恢复品牌{" "}
              <span className="font-semibold text-foreground">{brandToRestore?.mappingValue}</span>
              （组织ID: {brandToRestore?.mappingKey}）吗？
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-2">恢复后：</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>可以重新同步该品牌的数据</li>
              <li>自动回复将重新识别该品牌</li>
              <li>将出现在同步列表中</li>
            </ul>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestoreDialogOpen(false)}
              disabled={isRestoring}
            >
              取消
            </Button>
            <Button
              variant="default"
              onClick={handleRestoreConfirm}
              disabled={isRestoring}
              className="bg-green-600 hover:bg-green-700"
            >
              {isRestoring && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isRestoring ? "恢复中..." : "确认恢复"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
