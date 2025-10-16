"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  History,
  MoreHorizontal,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  Users,
} from "lucide-react";
import { useSyncStore, formatDuration, getSyncStatusText } from "@/lib/stores/sync-store";
import { getAvailableBrands } from "@/lib/constants/organization-mapping";

export const SyncHistory = () => {
  const { syncHistory, loadSyncHistory, clearHistory } = useSyncStore();
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);

  const availableBrands = getAvailableBrands();

  // 获取品牌名称 (unused for now but may be needed later)
  // const getBrandNames = (organizationIds: number[]) => {
  //   return organizationIds
  //     .map(id => availableBrands.find(b => b.id === id)?.name)
  //     .filter(Boolean)
  //     .join(", ");
  // };

  // 格式化时间
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString("zh-CN");
  };

  const handleClearHistory = () => {
    if (confirm("确定要清除所有同步历史记录吗？此操作不可逆！")) {
      clearHistory();
    }
  };

  const handleViewDetails = (recordId: string) => {
    setSelectedRecord(selectedRecord === recordId ? null : recordId);
  };

  const selectedRecordData = syncHistory.find(record => record.id === selectedRecord);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              同步历史记录
            </CardTitle>
            <CardDescription>查看历史同步记录和详细信息</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadSyncHistory}>
              刷新
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearHistory}
              disabled={syncHistory.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              清除历史
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {syncHistory.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>暂无同步历史记录</p>
            <p className="text-sm">完成第一次数据同步后，记录将显示在这里</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 历史记录表格 */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>同步时间</TableHead>
                  <TableHead>同步品牌</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>耗时</TableHead>
                  <TableHead>结果统计</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncHistory.map(record => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{formatTime(record.timestamp)}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {record.organizationIds.slice(0, 2).map(id => {
                          const brand = availableBrands.find(b => b.id === id);
                          return (
                            <Badge key={id} variant="outline" className="text-xs">
                              {brand?.name || `ID:${id}`}
                            </Badge>
                          );
                        })}
                        {record.organizationIds.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{record.organizationIds.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        {record.overallSuccess ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <Badge
                          variant={record.overallSuccess ? "default" : "destructive"}
                          className={record.overallSuccess ? "" : "text-white"}
                        >
                          {getSyncStatusText(record.overallSuccess)}
                        </Badge>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="text-sm font-mono">
                        {formatDuration(record.totalDuration)}
                      </span>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-1">
                          <Database className="h-3 w-3 text-brand-primary" />
                          <span>
                            {record.results.reduce((sum, r) => sum + r.processedRecords, 0)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-purple-600" />
                          <span>{record.results.reduce((sum, r) => sum + r.storeCount, 0)}</span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDetails(record.id)}>
                            <Eye className="h-4 w-4 mr-2" />
                            {selectedRecord === record.id ? "隐藏详情" : "查看详情"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* 详情面板 */}
            {selectedRecordData && (
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle className="text-lg">
                    同步详情 - {formatTime(selectedRecordData.timestamp)}
                  </CardTitle>
                  <CardDescription>
                    同步了 {selectedRecordData.organizationIds.length} 个品牌， 共耗时{" "}
                    {formatDuration(selectedRecordData.totalDuration)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 总体统计 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-2xl font-bold text-brand-primary">
                        {selectedRecordData.results.length}
                      </div>
                      <div className="text-sm text-muted-foreground">品牌数量</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {selectedRecordData.results.reduce((sum, r) => sum + r.processedRecords, 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">处理记录</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {selectedRecordData.results.reduce((sum, r) => sum + r.storeCount, 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">门店数量</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        {selectedRecordData.results.filter(r => r.success).length}
                      </div>
                      <div className="text-sm text-muted-foreground">成功品牌</div>
                    </div>
                  </div>

                  {/* 各品牌详情 */}
                  <div>
                    <h4 className="font-medium mb-3">各品牌同步详情</h4>
                    <div className="space-y-2">
                      {selectedRecordData.results.map((result, index) => (
                        <div
                          key={index}
                          className={`p-4 border rounded-lg ${
                            result.success
                              ? "border-green-200 bg-green-50"
                              : "border-red-200 bg-red-50"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {result.success ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-600" />
                              )}
                              <span className="font-medium">{result.brandName}</span>
                            </div>
                            <Badge
                              variant={result.success ? "default" : "destructive"}
                              className={result.success ? "" : "text-white"}
                            >
                              {getSyncStatusText(result.success)}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">处理记录:</span>
                              <span className="font-medium ml-1">{result.processedRecords}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">门店数量:</span>
                              <span className="font-medium ml-1">{result.storeCount}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">耗时:</span>
                              <span className="font-medium ml-1">
                                {formatDuration(result.duration)}
                              </span>
                            </div>
                          </div>

                          {/* 错误信息 */}
                          {result.errors.length > 0 && (
                            <div className="mt-3 p-2">
                              <div className="text-sm font-medium text-red-800 mb-1">错误信息:</div>
                              {result.errors.map((error, errorIndex) => (
                                <div key={errorIndex} className="text-sm text-red-700">
                                  • {error}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
