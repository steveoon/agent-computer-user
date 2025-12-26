import { Bot } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useModelConfig } from "@/lib/stores/model-config-store";

export function ModelConfigCard() {
  const { classifyModel, replyModel } = useModelConfig();

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="w-4 h-4 text-blue-500" />
          当前模型配置
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-4 text-sm">
          <div className="flex flex-col items-start gap-1">
            <span className="text-muted-foreground text-xs">分类模型</span>
            <Badge
              variant="secondary"
              className="font-normal w-full justify-start break-all h-auto py-1"
            >
              {classifyModel}
            </Badge>
          </div>
          <div className="flex flex-col items-start gap-1">
            <span className="text-muted-foreground text-xs">回复模型</span>
            <Badge
              variant="outline"
              className="font-normal w-full justify-start break-all h-auto py-1"
            >
              {replyModel}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground bg-blue-50/50 p-2 rounded text-center">
          可在右上角"模型配置"中修改
        </p>
      </CardContent>
    </Card>
  );
}
