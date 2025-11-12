"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import type { BrandQueryParams } from "./types";
import { SOURCE_SYSTEMS, isSourceSystem } from "./types";
import { useDebounce } from "@/hooks/useDebounce";

interface BrandTableToolbarProps {
  params: BrandQueryParams;
  onParamsChange: (params: BrandQueryParams) => void;
}

export function BrandTableToolbar({ params, onParamsChange }: BrandTableToolbarProps) {
  // 本地状态：立即更新输入框显示
  const [localKeyword, setLocalKeyword] = useState(params.keyword || "");

  // 同步外部 params 变化到本地状态（例如清除筛选时）
  useEffect(() => {
    setLocalKeyword(params.keyword || "");
  }, [params.keyword]);

  // 防抖处理：300ms 后才更新父组件的查询参数，触发查询
  const debouncedSearch = useDebounce((value: string) => {
    onParamsChange({ ...params, keyword: value || undefined, page: 1 });
  }, 300);

  // 处理输入变化
  const handleKeywordChange = (value: string) => {
    setLocalKeyword(value); // 立即更新本地状态（输入框显示）
    debouncedSearch(value); // 防抖后触发查询
  };

  const handleSourceSystemChange = (value: string) => {
    onParamsChange({
      ...params,
      sourceSystem: value === "all" ? undefined : isSourceSystem(value) ? value : undefined,
      page: 1,
    });
  };

  const handleClearFilters = () => {
    onParamsChange({
      page: 1,
      pageSize: params.pageSize,
      keyword: undefined,
      sourceSystem: undefined,
      isActive: true,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  };

  const hasFilters = params.keyword || params.sourceSystem;

  return (
    <div className="flex items-center gap-2 py-4">
      {/* 搜索框 */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索组织ID或品牌名称..."
          value={localKeyword}
          onChange={e => handleKeywordChange(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* 来源系统筛选 */}
      <Select value={params.sourceSystem || "all"} onValueChange={handleSourceSystemChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="全部来源" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部来源</SelectItem>
          {SOURCE_SYSTEMS.map(system => (
            <SelectItem key={system.value} value={system.value}>
              {system.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 清除筛选按钮 */}
      {hasFilters && (
        <Button variant="ghost" onClick={handleClearFilters} className="h-8 px-2 lg:px-3">
          清除筛选
          <X className="ml-2 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
