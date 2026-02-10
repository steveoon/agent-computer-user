import { Bot, Zap, Bug, RotateCw, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import type { MessageClassification } from "@/types/zhipin";
import type { FunnelStage, ReplyNeed, RiskFlag } from "@/types/reply-policy";
import type { StoreWithDistance } from "@/types/geocoding";
import { MatchedStoresCard } from "@/components/tool-messages/matched-stores-card";

interface DebugInfo {
  relevantStores: StoreWithDistance[];
  storeCount: number;
  detailLevel: string;
  classification: MessageClassification;
}

interface ReplyResultProps {
  reply: string;
  stage: FunnelStage | "";
  needs: ReplyNeed[];
  riskFlags: RiskFlag[];
  reasoning: string;
  debugInfo: DebugInfo | null;
  contextInfo: string;
  loading: boolean;
  error: string;
  configLoading: boolean;
}

export function ReplyResult({
  reply,
  stage,
  needs,
  riskFlags,
  reasoning,
  debugInfo,
  contextInfo,
  loading,
  error,
  configLoading,
}: ReplyResultProps) {
  if (configLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-indigo-600 bg-white/40 rounded-xl backdrop-blur-sm border border-indigo-100">
        <RotateCw className="w-6 h-6 animate-spin mr-3" />
        <span>正在加载配置数据...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-3 shadow-sm">
        <X className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold">发生错误</h4>
          <p className="text-sm opacity-90">{error}</p>
        </div>
      </div>
    );
  }

  if (!reply || loading) {
    return null;
  }

  return (
    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500">
      {/* 智能回复结果 */}
      <Card className="glass-card ring-1 ring-green-400/50 shadow-lg shadow-green-100/50">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-green-700 flex items-center gap-2">
            <Bot className="w-5 h-5" />
            智能回复
          </CardTitle>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Generated
          </Badge>
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-lg text-gray-800 leading-relaxed whitespace-pre-wrap">{reply}</p>
        </CardContent>
      </Card>

      {/* 回合规划 */}
      {(stage || reasoning || needs.length > 0 || riskFlags.length > 0) && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-blue-700 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              回合规划
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {stage && (
              <div className="bg-blue-50/50 p-3 rounded border border-blue-100">
                <span className="font-medium text-blue-700 block mb-1">阶段</span>
                <span className="text-gray-700">{stage}</span>
              </div>
            )}

            {needs.length > 0 && (
              <div className="bg-blue-50/50 p-3 rounded border border-blue-100">
                <span className="font-medium text-blue-700 block mb-1">Needs</span>
                <span className="text-gray-700">{needs.join("、")}</span>
              </div>
            )}

            {riskFlags.length > 0 && (
              <div className="bg-blue-50/50 p-3 rounded border border-blue-100">
                <span className="font-medium text-blue-700 block mb-1">风险标记</span>
                <span className="text-gray-700">{riskFlags.join("、")}</span>
              </div>
            )}

            {reasoning && (
              <div className="bg-white/50 p-3 rounded border border-gray-100">
                <span className="font-medium text-gray-700 block mb-1">规划依据</span>
                <span className="text-gray-600 leading-relaxed">{reasoning}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 深度调试信息 */}
      {debugInfo && (
        <Card className="glass-card">
          <CardHeader className="pb-0 cursor-pointer group" onClick={() => console.log(debugInfo)}>
            <CardTitle className="text-sm text-gray-500 flex items-center gap-2 group-hover:text-gray-800 transition-colors">
              <Bug className="w-4 h-4" />
              深度调试信息 (Debug Info)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/60 p-3 rounded-lg border text-center shadow-sm">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  门店展示数
                </div>
                <div className="font-bold text-xl text-indigo-600">{debugInfo.storeCount}</div>
              </div>
              <div className="bg-white/60 p-3 rounded-lg border text-center shadow-sm">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  详细级别
                </div>
                <div className="font-bold text-xl text-indigo-600 uppercase">
                  {debugInfo.detailLevel}
                </div>
              </div>
              <div className="bg-white/60 p-3 rounded-lg border text-center shadow-sm">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  匹配门店总数
                </div>
                <div className="font-bold text-xl text-indigo-600">
                  {debugInfo.relevantStores.length}
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs mb-2 block text-muted-foreground">提取的关键实体</Label>
              <pre className="bg-slate-950 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono shadow-inner">
                {JSON.stringify(debugInfo.classification.extractedInfo, null, 2)}
              </pre>
            </div>

            {contextInfo && (
              <div>
                <Label className="text-xs mb-2 block text-muted-foreground">
                  Prompt Context (RAG)
                </Label>
                <div className="bg-slate-50 text-slate-600 p-4 rounded-lg border overflow-x-auto text-xs font-mono h-[200px] overflow-y-auto whitespace-pre-wrap shadow-inner">
                  {contextInfo}
                </div>
              </div>
            )}

            {debugInfo.relevantStores.length > 0 ? (
              <div className="pt-2 border-t border-gray-100">
                <Label className="text-xs mb-3 block text-muted-foreground">匹配门店列表</Label>
                <MatchedStoresCard
                  stores={debugInfo.relevantStores}
                  displayCount={debugInfo.storeCount}
                  defaultExpanded
                  compact={false}
                />
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground italic bg-gray-50/50 rounded-lg">
                无地理位置相关匹配门店
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
