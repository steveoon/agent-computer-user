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
 * 格式化时间为相对时间（使用 Intl.RelativeTimeFormat）
 */
const rtf = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto", style: "short" });

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return rtf.format(-diffMins, "minute");
  if (diffHours < 24) return rtf.format(-diffHours, "hour");
  return rtf.format(-diffDays, "day");
}

/**
 * 根据等待时间获取紧急度颜色
 */
function getUrgencyColor(isoString: string): { bg: string; text: string; border: string } {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours >= 24) {
    // 超过 24 小时 - 高紧急 Rose
    return {
      bg: "rgba(251, 113, 133, 0.15)",
      text: "#FB7185",
      border: "rgba(251, 113, 133, 0.3)",
    };
  }
  if (diffHours >= 4) {
    // 4-24 小时 - 中等紧急 Amber
    return {
      bg: "rgba(251, 191, 36, 0.15)",
      text: "#FBBF24",
      border: "rgba(251, 191, 36, 0.3)",
    };
  }
  // 4 小时内 - 正常 Cyan
  return {
    bg: "rgba(34, 211, 238, 0.1)",
    text: "#22D3EE",
    border: "rgba(34, 211, 238, 0.2)",
  };
}

/**
 * 平台显示名称
 */
const PLATFORM_LABELS: Record<string, string> = {
  yupao: "鱼泡",
  zhipin: "BOSS",
};

/**
 * 候选人卡片组件 - 深色主题版
 */
function CandidateCard({ candidate }: { candidate: UnrepliedCandidate }) {
  const urgencyColor = getUrgencyColor(candidate.lastMessageTime);

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all flex-shrink-0 hover:scale-[1.02]"
      style={{
        background: urgencyColor.bg,
        border: `1px solid ${urgencyColor.border}`,
      }}
    >
      {/* 姓名 + 岗位 */}
      <div className="flex items-center gap-1.5">
        <span
          className="font-medium text-sm"
          style={{ color: urgencyColor.text }}
        >
          {candidate.name}
        </span>
        <span className="text-xs text-[var(--dash-text-muted)]">
          {candidate.position ?? "未知"}
        </span>
      </div>

      {/* Agent + 平台 */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="h-5 px-1.5 text-[10px] font-normal text-[var(--dash-text-muted)] border-[var(--dash-border)] bg-transparent cursor-help"
            >
              <Bot className="h-2.5 w-2.5 mr-0.5" />
              {candidate.agentId.split("-").slice(-1)[0]}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="dash-glass text-[var(--dash-text-secondary)]">
            {candidate.agentId}
          </TooltipContent>
        </Tooltip>
        <Badge
          variant="outline"
          className={`h-5 px-1.5 text-[10px] font-normal ${
            candidate.platform === "zhipin"
              ? "text-dash-cyan border-dash-cyan/30 bg-dash-cyan/10"
              : "text-dash-lime border-dash-lime/30 bg-dash-lime/10"
          }`}
        >
          {PLATFORM_LABELS[candidate.platform ?? ""] ?? candidate.platform ?? "未知"}
        </Badge>
      </div>

      {/* 时间 */}
      <div
        className="flex items-center gap-1 text-xs dash-number"
        style={{ color: urgencyColor.text }}
      >
        <Clock className="h-3 w-3" />
        {formatRelativeTime(candidate.lastMessageTime)}
      </div>
    </div>
  );
}

/**
 * 未回复候选人组件 - Rose 警告条 + 脉冲发光
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

  // 根据候选人数量决定紧急程度
  const urgencyLevel = candidates.length >= 5 ? "high" : candidates.length >= 2 ? "medium" : "low";

  return (
    <div
      className={`
        flex items-center gap-3 p-3 rounded-xl
        bg-dash-rose/10 border border-dash-rose/30
        ${urgencyLevel === "high" ? "pulse-glow-rose" : ""}
      `}
    >
      {/* 标题 */}
      <div className="flex items-center gap-1.5 text-dash-rose flex-shrink-0">
        <UserX className="h-4 w-4" />
        <span className="text-sm font-medium">待回复</span>
        {!loading && candidates.length > 0 && (
          <Badge
            variant="secondary"
            className="bg-dash-rose/20 text-dash-rose border-dash-rose/30 h-5 px-1.5 text-xs dash-number"
          >
            {candidates.length}
          </Badge>
        )}
      </div>

      {/* 分隔线 */}
      <div className="h-6 w-px bg-dash-rose/30 flex-shrink-0" />

      {/* 候选人列表 - 跑马灯容器 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {loading && (
          <div className="flex items-center gap-1.5 text-[var(--dash-text-muted)] text-sm">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            加载中...
          </div>
        )}

        {error && !loading && (
          <div className="text-dash-rose text-sm">{error}</div>
        )}

        {!loading && !error && candidates.length > 0 && (
          <div
            ref={contentRef}
            className="flex items-center gap-2"
            style={{
              animationName: needsMarquee ? "marquee" : "none",
              animationDuration: needsMarquee ? `${animationDuration}s` : undefined,
              animationTimingFunction: needsMarquee ? "linear" : undefined,
              animationIterationCount: needsMarquee ? "infinite" : undefined,
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
        aria-label="刷新待回复候选人列表"
        className="h-7 w-7 p-0 text-dash-rose hover:text-dash-rose hover:bg-dash-rose/20 flex-shrink-0"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
      </Button>

      {/* 跑马灯动画样式 - 支持 prefers-reduced-motion */}
      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
