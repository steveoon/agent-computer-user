"use client";

import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, ChevronLeft, ChevronRight } from "lucide-react";

export interface SearchPaginationProps<T> {
  data: T[];
  searchKeys: (keyof T)[];
  itemsPerPageOptions?: number[];
  defaultItemsPerPage?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  placeholder?: string;
  emptyMessage?: string;
  searchEmptyMessage?: string;
  className?: string;
}

export function SearchPagination<T>({
  data,
  searchKeys,
  itemsPerPageOptions = [10, 20, 50, 100],
  defaultItemsPerPage = 20,
  renderItem,
  placeholder = "搜索...",
  emptyMessage = "暂无数据",
  searchEmptyMessage = "未找到匹配项",
  className = "",
}: SearchPaginationProps<T>) {
  const [searchKeyword, setSearchKeyword] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(defaultItemsPerPage);

  // 过滤数据
  const filteredData = useMemo(() => {
    if (!searchKeyword.trim()) return data;

    const keyword = searchKeyword.toLowerCase();
    return data.filter(item =>
      searchKeys.some(key => {
        const value = item[key];
        if (typeof value === "string") {
          return value.toLowerCase().includes(keyword);
        }
        if (typeof value === "number") {
          return value.toString().includes(keyword);
        }
        return false;
      })
    );
  }, [data, searchKeyword, searchKeys]);

  // 计算分页
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  // 当搜索或每页项目数改变时，重置到第一页
  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 搜索和每页项目数选择 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            value={searchKeyword}
            onChange={e => handleSearch(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchKeyword.trim() && (
            <Button
              size="sm"
              variant="ghost"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
              onClick={() => handleSearch("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {itemsPerPageOptions.map(option => (
              <SelectItem key={option} value={option.toString()}>
                {option} 条/页
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 数据列表 */}
      <div className="space-y-4">
        {paginatedData.length > 0 ? (
          paginatedData.map((item, index) => (
            <div key={startIndex + index}>{renderItem(item, startIndex + index)}</div>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {searchKeyword.trim() ? (
              <div className="space-y-2">
                <Search className="h-8 w-8 mx-auto text-muted-foreground/50" />
                <div>{searchEmptyMessage}</div>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => handleSearch("")}
                  className="text-blue-600"
                >
                  清除搜索条件
                </Button>
              </div>
            ) : (
              emptyMessage
            )}
          </div>
        )}
      </div>

      {/* 分页控制 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            显示 {startIndex + 1} - {Math.min(endIndex, filteredData.length)} 项，共{" "}
            {filteredData.length} 项
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                // 只显示当前页附近的页码
                if (page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2) {
                  return (
                    <Button
                      key={page}
                      variant={page === currentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                      className="min-w-[32px]"
                    >
                      {page}
                    </Button>
                  );
                } else if (page === currentPage - 3 || page === currentPage + 3) {
                  return (
                    <span key={page} className="px-1">
                      ...
                    </span>
                  );
                }
                return null;
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
