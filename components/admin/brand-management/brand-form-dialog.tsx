"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createBrand } from "@/actions/brand-mapping";
import { SOURCE_SYSTEMS, isSourceSystem, type CreateBrandFormData } from "./types";
import { useAuthStore } from "@/lib/stores/auth-store";

interface BrandFormDialogProps {
  onSuccess?: () => void;
}

export function BrandFormDialog({ onSuccess }: BrandFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateBrandFormData>({
    mappingKey: "",
    mappingValue: "",
    sourceSystem: "haimian",
    displayOrder: 999,
    description: "",
  });
  const { user } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 验证必填字段
    if (!formData.mappingKey.trim()) {
      toast.error("请输入组织ID");
      return;
    }

    if (!formData.mappingValue.trim()) {
      toast.error("请输入品牌名称");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createBrand({
        mappingKey: formData.mappingKey.trim(),
        mappingValue: formData.mappingValue.trim(),
        sourceSystem: formData.sourceSystem,
        displayOrder: formData.displayOrder,
        description: formData.description.trim() || undefined,
        operatedBy: user?.email || "unknown user",
      });

      if (result.success) {
        toast.success("品牌创建成功");
        setOpen(false);
        // 重置表单
        setFormData({
          mappingKey: "",
          mappingValue: "",
          sourceSystem: "haimian",
          displayOrder: 999,
          description: "",
        });
        onSuccess?.();
      } else {
        toast.error(result.error || "创建失败");
      }
    } catch (error) {
      console.error("创建品牌失败:", error);
      toast.error("创建失败，请重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      setOpen(newOpen);
      // 关闭时重置表单
      if (!newOpen) {
        setFormData({
          mappingKey: "",
          mappingValue: "",
          sourceSystem: "haimian",
          displayOrder: 999,
          description: "",
        });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          新增品牌
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>新增品牌</DialogTitle>
            <DialogDescription>填写品牌信息以创建新的品牌映射关系</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* 组织ID */}
            <div className="grid gap-2">
              <Label htmlFor="mappingKey">
                组织ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="mappingKey"
                placeholder="请输入组织ID（数字）"
                value={formData.mappingKey}
                onChange={e => setFormData({ ...formData, mappingKey: e.target.value })}
                disabled={isSubmitting}
                required
              />
            </div>

            {/* 品牌名称 */}
            <div className="grid gap-2">
              <Label htmlFor="mappingValue">
                品牌名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="mappingValue"
                placeholder="请输入品牌名称"
                value={formData.mappingValue}
                onChange={e => setFormData({ ...formData, mappingValue: e.target.value })}
                disabled={isSubmitting}
                required
              />
            </div>

            {/* 来源系统 */}
            <div className="grid gap-2">
              <Label htmlFor="sourceSystem">
                来源系统 <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.sourceSystem}
                onValueChange={value => {
                  if (isSourceSystem(value)) {
                    setFormData({ ...formData, sourceSystem: value });
                  }
                }}
                disabled={isSubmitting}
              >
                <SelectTrigger id="sourceSystem">
                  <SelectValue placeholder="选择来源系统" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_SYSTEMS.map(system => (
                    <SelectItem key={system.value} value={system.value}>
                      {system.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 显示顺序 */}
            <div className="grid gap-2">
              <Label htmlFor="displayOrder">显示顺序</Label>
              <Input
                id="displayOrder"
                type="number"
                placeholder="默认为 999"
                value={formData.displayOrder}
                onChange={e =>
                  setFormData({
                    ...formData,
                    displayOrder: parseInt(e.target.value, 10) || 999,
                  })
                }
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                数字越小显示越靠前。默认值 999 表示排在最后，可根据需要调整
              </p>
            </div>

            {/* 描述 */}
            <div className="grid gap-2">
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                placeholder="选填，可添加品牌相关描述信息"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                disabled={isSubmitting}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
