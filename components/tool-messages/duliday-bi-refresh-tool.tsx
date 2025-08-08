"use client";

import { RefreshCwIcon } from "lucide-react";
import { BaseToolMessage } from "./base-tool-message";
import { themes, type ToolMessageProps } from "./types";

export function DulidayBiRefreshTool(props: ToolMessageProps) {
  const { state, result, isLatestMessage, messageId, partIndex } = props;
  
  // 解析结果
  const resultText = typeof result === "object" && result !== null && "text" in result 
    ? (result as { text?: string }).text 
    : typeof result === "string" 
    ? result 
    : "";

  // 根据状态显示不同的信息
  let displayStatus = "";

  if (state === "partial-call" || state === "call") {
    displayStatus = "数据源刷新已启动";
  } else if (state === "result" && resultText) {
    // 从结果中提取任务ID
    const taskIdMatch = resultText.match(/任务ID: ([a-f0-9-]+)/);
    if (taskIdMatch) {
      displayStatus = `任务ID: ${taskIdMatch[1]}`;
    } else if (resultText.includes("失败") || resultText.includes("❌")) {
      displayStatus = "刷新失败";
    } else {
      displayStatus = "刷新任务已成功触发";
    }
  }

  return (
    <BaseToolMessage
      icon={RefreshCwIcon}
      label="Duliday BI数据源刷新"
      detail={displayStatus}
      theme={themes.amber}
      state={state}
      result={result}
      messageId={messageId}
      partIndex={partIndex}
      isLatestMessage={isLatestMessage}
    />
  );
}