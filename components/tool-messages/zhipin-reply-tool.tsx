"use client";

import { Bot } from "lucide-react";
import { BaseToolMessage } from "./base-tool-message";
import { themes, type ToolMessageProps } from "./types";
import { useMemo } from "react";
import { REPLY_TYPE_NAMES, type ReplyContext } from "@/types/zhipin";
import { MatchedStoresCard } from "./matched-stores-card";
import type { StoreWithDistance } from "@/types/geocoding";

export function ZhipinReplyToolMessage(props: ToolMessageProps) {
  const { input, state, output, isLatestMessage, status, messageId, partIndex } = props;
  const candidateMessage = input.candidate_message as string | undefined;
  const brand = input.brand as string | undefined;
  const includeStats = input.include_stats as boolean | undefined;

  // 从结果中提取分类信息和调试信息
  const { replyType, reasoningText, matchedStores } = useMemo(() => {
    if (output && typeof output === "object" && "replyType" in output) {
      const typedResult = output as {
        replyType?: string;
        reasoningText?: string;
        debugInfo?: {
          relevantStores: StoreWithDistance[];
          storeCount: number;
        };
      };
      return {
        replyType: typedResult.replyType,
        reasoningText: typedResult.reasoningText,
        matchedStores: typedResult.debugInfo?.relevantStores,
      };
    }
    return { replyType: undefined, reasoningText: undefined, matchedStores: undefined };
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

  // 添加分类信息到详情
  if (replyType) {
    const typeName = REPLY_TYPE_NAMES[replyType as ReplyContext] || replyType;
    details.push(`🎯 ${typeName}`);
  }

  const detail = details.join(" · ");

  return (
    <>
      <BaseToolMessage
        icon={Bot}
        label="生成智能回复"
        detail={detail}
        theme={themes.yellow}
        state={state}
        output={output}
        isLatestMessage={isLatestMessage}
        status={status}
        messageId={messageId}
        partIndex={partIndex}
      />
      {reasoningText && state === "output-available" && (
        <div className="mt-2 ml-8 p-3 bg-gray-50 dark:bg-gray-800 rounded-md text-sm">
          <div className="flex items-start gap-2">
            <span className="font-medium text-gray-600 dark:text-gray-400">📊 分类依据：</span>
            <span className="text-gray-700 dark:text-gray-300 flex-1">{reasoningText}</span>
          </div>
        </div>
      )}
      {matchedStores && matchedStores.length > 0 && state === "output-available" && (
        <MatchedStoresCard stores={matchedStores} displayCount={3} compact className="ml-8" />
      )}
    </>
  );
}
