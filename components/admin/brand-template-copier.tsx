"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, AlertCircle, CheckCircle } from "lucide-react";
import type { ZhipinData } from "@/types";
import { Badge } from "@/components/ui/badge";

interface BrandTemplateCopierProps {
  data: ZhipinData | undefined;
  onCopy: (sourceBrand: string, targetBrand: string) => Promise<void>;
}

export function BrandTemplateCopier({ data, onCopy }: BrandTemplateCopierProps) {
  const [open, setOpen] = useState(false);
  const [sourceBrand, setSourceBrand] = useState<string>("");
  const [targetBrand, setTargetBrand] = useState<string>("");
  const [copying, setCopying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!data?.brands) {
    return null;
  }

  const brandNames = Object.keys(data.brands);

  const getTemplateCount = (brandName: string) => {
    const templates = data.brands[brandName]?.templates;
    if (!templates) return 0;
    
    return Object.entries(templates).reduce((acc, [_, templateArray]) => {
      return acc + (templateArray?.length || 0);
    }, 0);
  };

  const getScenarioCount = (brandName: string) => {
    const templates = data.brands[brandName]?.templates;
    if (!templates) return 0;
    return Object.keys(templates).length;
  };

  const handleCopy = async () => {
    if (!sourceBrand || !targetBrand) {
      setError("请选择源品牌和目标品牌");
      return;
    }

    if (sourceBrand === targetBrand) {
      setError("源品牌和目标品牌不能相同");
      return;
    }

    setCopying(true);
    setError(null);
    setSuccess(false);

    try {
      await onCopy(sourceBrand, targetBrand);
      setSuccess(true);
      
      // 2秒后关闭对话框
      setTimeout(() => {
        setOpen(false);
        setSourceBrand("");
        setTargetBrand("");
        setSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "复制失败");
    } finally {
      setCopying(false);
    }
  };

  const handleReset = () => {
    setSourceBrand("");
    setTargetBrand("");
    setError(null);
    setSuccess(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Copy className="h-4 w-4 mr-2" />
          复制品牌话术
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>复制品牌话术模板</DialogTitle>
          <DialogDescription>
            将一个品牌的所有话术模板复制到另一个品牌，目标品牌原有的话术将被覆盖
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 源品牌选择 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">源品牌（复制自）</label>
            <Select value={sourceBrand} onValueChange={setSourceBrand}>
              <SelectTrigger>
                <SelectValue placeholder="选择要复制的品牌" />
              </SelectTrigger>
              <SelectContent>
                {brandNames.map((brand) => {
                  const templateCount = getTemplateCount(brand);
                  const scenarioCount = getScenarioCount(brand);
                  return (
                    <SelectItem key={brand} value={brand}>
                      <div className="flex items-center justify-between w-full">
                        <span>{brand}</span>
                        <div className="flex gap-2 ml-4">
                          <Badge variant="secondary" className="text-xs">
                            {scenarioCount} 场景
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {templateCount} 条话术
                          </Badge>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {sourceBrand && (
              <p className="text-xs text-muted-foreground">
                该品牌有 {getScenarioCount(sourceBrand)} 个场景，共 {getTemplateCount(sourceBrand)} 条话术
              </p>
            )}
          </div>

          {/* 目标品牌选择 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">目标品牌（复制到）</label>
            <Select 
              value={targetBrand} 
              onValueChange={setTargetBrand}
              disabled={!sourceBrand}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择目标品牌" />
              </SelectTrigger>
              <SelectContent>
                {brandNames
                  .filter(brand => brand !== sourceBrand)
                  .map((brand) => {
                    const templateCount = getTemplateCount(brand);
                    const scenarioCount = getScenarioCount(brand);
                    return (
                      <SelectItem key={brand} value={brand}>
                        <div className="flex items-center justify-between w-full">
                          <span>{brand}</span>
                          <div className="flex gap-2 ml-4">
                            <Badge variant="secondary" className="text-xs">
                              {scenarioCount} 场景
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {templateCount} 条话术
                            </Badge>
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
            {targetBrand && (
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-xs">
                  注意：{targetBrand} 现有的 {getTemplateCount(targetBrand)} 条话术将被 {sourceBrand} 的话术替换
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* 错误提示 */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* 成功提示 */}
          {success && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                成功将 {sourceBrand} 的话术复制到 {targetBrand}！
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleReset} disabled={copying}>
            重置
          </Button>
          <Button 
            onClick={handleCopy} 
            disabled={!sourceBrand || !targetBrand || copying}
          >
            {copying ? "复制中..." : "确认复制"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}