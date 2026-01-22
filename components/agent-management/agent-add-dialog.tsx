"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAgentStore } from "@/lib/stores/agent-store";
import { toast } from "sonner";

interface AgentAddDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

/**
 * 添加 Agent 对话框
 */
export function AgentAddDialog({ trigger, onSuccess }: AgentAddDialogProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>("");
  const [customId, setCustomId] = useState("");
  const [count, setCount] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { templates, addAgent } = useAgentStore();

  const templateKeys = Object.keys(templates);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!type) {
      toast.error("请选择 Agent 类型");
      return;
    }

    // 验证数量范围
    if (count < 1 || count > 10) {
      toast.error("数量必须在 1-10 之间");
      return;
    }

    setIsSubmitting(true);
    try {
      const options: { id?: string; count?: number } = {};
      if (customId.trim()) {
        options.id = customId.trim();
      }
      if (count > 1) {
        options.count = count;
      }

      const newAgents = await addAgent(type, Object.keys(options).length > 0 ? options : undefined);

      if (newAgents.length > 0) {
        toast.success(`成功添加 ${newAgents.length} 个 Agent`);
        setOpen(false);
        resetForm();
        onSuccess?.();
      }
    } catch {
      toast.error("添加 Agent 失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setType("");
    setCustomId("");
    setCount(1);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            添加 Agent
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[380px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-slate-200/50 dark:border-slate-700/50">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="pb-3">
            <DialogTitle className="text-base font-semibold text-slate-800 dark:text-slate-100">
              添加 Agent
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              创建新的 Agent 实例，每个 Agent 拥有独立的浏览器环境
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Agent 类型选择 */}
            <div className="space-y-1.5">
              <Label htmlFor="type" className="text-xs font-medium text-slate-600 dark:text-slate-300">
                类型
              </Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-9 text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="选择 Agent 类型" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                  {templateKeys.map((key) => (
                    <SelectItem key={key} value={key} className="text-sm">
                      <div className="flex flex-col py-0.5">
                        <span className="font-medium">{templates[key].name}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          {templates[key].description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 自定义 ID（可选） */}
            <div className="space-y-1.5">
              <Label htmlFor="customId" className="text-xs font-medium text-slate-600 dark:text-slate-300">
                ID <span className="text-slate-400 font-normal">(可选)</span>
              </Label>
              <Input
                id="customId"
                value={customId}
                onChange={(e) => {
                  setCustomId(e.target.value);
                  // 填写自定义 ID 时，强制数量为 1
                  if (e.target.value.trim()) {
                    setCount(1);
                  }
                }}
                placeholder="留空则自动生成"
                className="h-9 text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              />
            </div>

            {/* 数量 */}
            <div className="space-y-1.5">
              <Label htmlFor="count" className="text-xs font-medium text-slate-600 dark:text-slate-300">
                数量
              </Label>
              <Input
                id="count"
                type="number"
                min={1}
                max={customId.trim() ? 1 : 10}
                value={count}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  const max = customId.trim() ? 1 : 10;
                  // 限制在有效范围内，空值默认为 1
                  setCount(isNaN(value) ? 1 : Math.max(1, Math.min(max, value)));
                }}
                disabled={!!customId.trim()}
                className="h-9 text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 w-24 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {customId.trim() && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  自定义 ID 时只能添加 1 个
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
              className="h-8 px-3 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
            >
              取消
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !type}
              className="h-8 px-3 text-xs bg-brand-primary hover:bg-brand-dark text-white"
            >
              {isSubmitting ? "添加中..." : "添加"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
