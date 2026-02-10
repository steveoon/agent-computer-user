"use client";

import { Bot, AlertCircle, Zap } from "lucide-react";
import { BaseToolMessage } from "./base-tool-message";
import { themes, type ToolMessageProps } from "./types";
import { useMemo } from "react";
import { MatchedStoresCard } from "./matched-stores-card";
import type { StoreWithDistance } from "@/types/geocoding";
import type { FunnelStage, ReplyNeed, RiskFlag } from "@/types/reply-policy";

/**
 * 工具输出类型（与 ZhipinReplyToolResult 对齐）
 */
interface ZhipinReplyOutput {
  replyType?: string;
  stage?: FunnelStage;
  subGoals?: string[];
  needs?: ReplyNeed[];
  riskFlags?: RiskFlag[];
  reasoningText?: string;
  debugInfo?: {
    relevantStores: StoreWithDistance[];
    storeCount: number;
  };
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  latencyMs?: number;
  error?: {
    code: string;
    message: string;
    userMessage: string;
  };
}

const STAGE_LABELS: Record<FunnelStage, string> = {
  trust_building: "建立信任",
  private_channel: "转私域",
  qualify_candidate: "候选匹配",
  job_consultation: "岗位咨询",
  interview_scheduling: "约面安排",
  onboard_followup: "到岗回访",
};

export function ZhipinReplyToolMessage(props: ToolMessageProps) {
  const { input, state, output, isLatestMessage, status, messageId, partIndex } = props;
  const candidateMessage = input.candidate_message as string | undefined;
  const brand = input.brand as string | undefined;
  const includeStats = input.include_stats as boolean | undefined;

  // 从结果中提取分类信息、调试信息、错误和统计
  const { replyType, stage, needs, riskFlags, reasoningText, matchedStores, error, usage, latencyMs } =
    useMemo(() => {
      if (output && typeof output === "object") {
        const typedResult = output as ZhipinReplyOutput;
        return {
          replyType: typedResult.replyType,
          stage: typedResult.stage,
          needs: typedResult.needs,
          riskFlags: typedResult.riskFlags,
          reasoningText: typedResult.reasoningText,
          matchedStores: typedResult.debugInfo?.relevantStores,
          error: typedResult.error,
          usage: typedResult.usage,
          latencyMs: typedResult.latencyMs,
        };
      }
      return {
        replyType: undefined,
        stage: undefined,
        needs: undefined,
        riskFlags: undefined,
        reasoningText: undefined,
        matchedStores: undefined,
        error: undefined,
        usage: undefined,
        latencyMs: undefined,
      };
    }, [output]);

  const details: string[] = [];
  if (candidateMessage) {
    const truncated =
      candidateMessage.length > 20 ? candidateMessage.substring(0, 20) + "..." : candidateMessage;
    details.push(`"${truncated}"`);
  }
  // 突出显示品牌信息
  if (brand) {
    details.push(`🏢 品牌: ${brand}`);
  } else {
    details.push(`⚠️ 品牌: 未传入(使用默认)`);
  }
  if (includeStats) details.push("含统计");

  // 添加规划信息到详情
  if (stage) {
    details.push(`🎯 阶段: ${STAGE_LABELS[stage] || stage}`);
  } else if (replyType) {
    details.push(`🎯 类型: ${replyType}`);
  }

  if (needs && needs.length > 0) {
    details.push(`📌 needs: ${needs.join("、")}`);
  }

  if (riskFlags && riskFlags.length > 0) {
    details.push(`⚠️ 风险: ${riskFlags.join("、")}`);
  }

  // 添加错误标记到详情
  if (error) {
    details.push(`❌ 失败`);
  }

  const detail = details.join(" · ");

  // 根据是否有错误选择主题
  const theme = error ? themes.red : themes.yellow;

  return (
    <>
      <BaseToolMessage
        icon={error ? AlertCircle : Bot}
        label={error ? "智能回复失败" : "生成智能回复"}
        detail={detail}
        theme={theme}
        state={state}
        output={output}
        isLatestMessage={isLatestMessage}
        status={status}
        messageId={messageId}
        partIndex={partIndex}
      />
      {/* 错误信息展示 */}
      {error && state === "output-available" && (
        <div className="mt-2 ml-8 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <span className="font-medium text-red-700 dark:text-red-400">错误：</span>
              <span className="text-red-600 dark:text-red-300">{error.userMessage}</span>
              <div className="mt-1 text-xs text-red-500 dark:text-red-400">
                错误代码: {error.code}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 规划依据展示（仅在无错误时） */}
      {reasoningText && !error && state === "output-available" && (
        <div className="mt-2 ml-8 p-3 bg-gray-50 dark:bg-gray-800 rounded-md text-sm">
          <div className="flex items-start gap-2">
            <span className="font-medium text-gray-600 dark:text-gray-400">📊 规划依据：</span>
            <span className="text-gray-700 dark:text-gray-300 flex-1">{reasoningText}</span>
          </div>
        </div>
      )}
      {/* LLM 统计信息展示 */}
      {(latencyMs !== undefined || usage) && !error && state === "output-available" && (
        <div className="mt-2 ml-8 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md text-xs">
          <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
            <Zap className="w-3 h-3" />
            {latencyMs !== undefined && <span>耗时: {latencyMs}ms</span>}
            {usage?.totalTokens !== undefined && (
              <span>
                Tokens: {usage.totalTokens} (输入: {usage.inputTokens ?? "?"}, 输出:{" "}
                {usage.outputTokens ?? "?"})
              </span>
            )}
          </div>
        </div>
      )}
      {/* 匹配门店展示 */}
      {matchedStores && matchedStores.length > 0 && !error && state === "output-available" && (
        <MatchedStoresCard stores={matchedStores} displayCount={3} compact className="ml-8" />
      )}
    </>
  );
}
