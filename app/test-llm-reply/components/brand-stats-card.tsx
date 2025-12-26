import { RotateCw, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface BrandStats {
  historyCount: number;
  currentBrand: string | null;
}

interface BrandStatsCardProps {
  brandStats: BrandStats | null;
  loadBrandStats: () => void;
  handleClearPreferences: () => void;
}

export function BrandStatsCard({
  brandStats,
  loadBrandStats,
  handleClearPreferences,
}: BrandStatsCardProps) {
  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">统计信息</CardTitle>
      </CardHeader>
      <CardContent>
        {brandStats ? (
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">当前选中品牌</span>
              <span className="font-medium">{brandStats.currentBrand || "默认"}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">品牌切换历史</span>
              <span className="font-medium">{brandStats.historyCount} 条</span>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadBrandStats}
                className="flex-1 h-8 text-xs"
              >
                <RotateCw className="w-3 h-3 mr-1" /> 刷新
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearPreferences}
                className="flex-1 h-8 text-xs bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-200"
              >
                <Trash2 className="w-3 h-3 mr-1" /> 清除
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={loadBrandStats} className="w-full text-xs">
            加载统计信息
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
