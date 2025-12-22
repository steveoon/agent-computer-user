"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { UserX, Clock, RefreshCw, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardStatsStore } from "@/lib/stores/dashboard-stats-store";
import {
  getUnrepliedCandidates,
  type UnrepliedCandidate,
} from "@/actions/recruitment-stats";

/**
 * 格式化时间为相对时间（简短版）
 */
function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  return `${Math.floor(diffHours / 24)}天前`;
}

/**
 * 平台显示名称
 */
const PLATFORM_LABELS: Record<string, string> = {
  yupao: "鱼泡",
  zhipin: "BOSS",
};

/**
 * 候选人卡片组件
 */
function CandidateCard({ candidate }: { candidate: UnrepliedCandidate }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-white/70 border border-amber-100 hover:bg-white transition-colors flex-shrink-0">
      {/* 姓名 + 岗位 */}
      <div className="flex items-center gap-1">
        <span className="font-medium text-sm text-gray-800">
          {candidate.name}
        </span>
        <span className="text-xs text-muted-foreground">
          {candidate.position ?? "未知"}
        </span>
      </div>

      {/* Agent + 平台 */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="h-5 px-1.5 text-xs font-normal text-gray-500 border-gray-200 cursor-help"
            >
              <Bot className="h-3 w-3 mr-0.5" />
              {candidate.agentId.split("-").slice(-1)[0]}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top">
            {candidate.agentId}
          </TooltipContent>
        </Tooltip>
        <Badge
          variant="outline"
          className={`h-5 px-1.5 text-xs font-normal ${
            candidate.platform === "zhipin"
              ? "text-blue-600 border-blue-200 bg-blue-50/50"
              : "text-cyan-600 border-cyan-200 bg-cyan-50/50"
          }`}
        >
          {PLATFORM_LABELS[candidate.platform ?? ""] ?? candidate.platform ?? "未知"}
        </Badge>
      </div>

      {/* 时间 */}
      <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        {formatRelativeTime(candidate.lastMessageTime)}
      </div>
    </div>
  );
}

/**
 * 未回复候选人组件 - 紧凑横向设计 + 跑马灯效果
 */
export function UnrepliedCandidates() {
  const { filters } = useDashboardStatsStore();
  const [candidates, setCandidates] = useState<UnrepliedCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [needsMarquee, setNeedsMarquee] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getUnrepliedCandidates(filters);
      if (result.success) {
        setCandidates(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 检测是否需要跑马灯效果
  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && contentRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const contentWidth = contentRef.current.scrollWidth;
        setNeedsMarquee(contentWidth > containerWidth);
      }
    };

    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [candidates]);

  // 没有未回复候选人时不显示
  if (!loading && candidates.length === 0 && !error) {
    return null;
  }

  // 计算动画时长（根据内容宽度）
  const animationDuration = Math.max(candidates.length * 5, 15);

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50/80 border border-amber-200/60">
      {/* 标题 */}
      <div className="flex items-center gap-1.5 text-amber-700 flex-shrink-0">
        <UserX className="h-4 w-4" />
        <span className="text-sm font-medium">待回复</span>
        {!loading && candidates.length > 0 && (
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 h-5 px-1.5 text-xs">
            {candidates.length}
          </Badge>
        )}
      </div>

      {/* 分隔线 */}
      <div className="h-6 w-px bg-amber-200/80 flex-shrink-0" />

      {/* 候选人列表 - 跑马灯容器 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {loading && (
          <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            加载中...
          </div>
        )}

        {error && !loading && (
          <div className="text-destructive text-sm">{error}</div>
        )}

        {!loading && !error && candidates.length > 0 && (
          <div
            ref={contentRef}
            className="flex items-center gap-2"
            style={{
              animation: needsMarquee
                ? `marquee ${animationDuration}s linear infinite`
                : "none",
              animationPlayState: isPaused ? "paused" : "running",
              width: needsMarquee ? "max-content" : "auto",
            }}
          >
            {/* 候选人列表 */}
            {candidates.map((candidate, index) => (
              <CandidateCard
                key={`${candidate.name}-${candidate.agentId}-${index}`}
                candidate={candidate}
              />
            ))}

            {/* 跑马灯时复制一份内容实现无缝滚动 */}
            {needsMarquee && candidates.map((candidate, index) => (
              <CandidateCard
                key={`dup-${candidate.name}-${candidate.agentId}-${index}`}
                candidate={candidate}
              />
            ))}
          </div>
        )}
      </div>

      {/* 刷新按钮 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={loadData}
        disabled={loading}
        className="h-7 w-7 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-100 flex-shrink-0"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
      </Button>

      {/* 跑马灯动画样式 */}
      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
