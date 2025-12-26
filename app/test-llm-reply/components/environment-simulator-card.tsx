import { Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EnvironmentSimulatorCardProps {
  toolBrand: string;
  setToolBrand: (value: string) => void;
}

export function EnvironmentSimulatorCard({
  toolBrand,
  setToolBrand,
}: EnvironmentSimulatorCardProps) {
  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="w-4 h-4 text-purple-500" />
          环境模拟
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tool-brand" className="text-xs text-muted-foreground">
            工具识别品牌 (模拟抓取数据)
          </Label>
          <Input
            id="tool-brand"
            type="text"
            value={toolBrand}
            onChange={e => setToolBrand(e.target.value)}
            placeholder="例如: 海底捞"
            className="bg-white/50"
          />
          <p className="text-[10px] text-muted-foreground">
            用于测试当上下文品牌与配置品牌不一致时的冲突处理逻辑
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
