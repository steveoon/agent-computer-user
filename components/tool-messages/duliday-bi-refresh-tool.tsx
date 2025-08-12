"use client";

import { RefreshCwIcon } from "lucide-react";
import { BaseToolMessage } from "./base-tool-message";
import { themes, type ToolMessageProps } from "./types";

export function DulidayBiRefreshTool(props: ToolMessageProps) {
  const { state, output, isLatestMessage, messageId, partIndex, status } = props;

  // 解析结果
  const resultText =
    typeof output === "object" && output !== null && "text" in output
      ? (output as { text?: string }).text
      : typeof output === "string"
        ? output
        : "";

  // 根据状态显示不同的信息
  let displayStatus = "";

  if (state === "input-streaming" || state === "input-available") {
    displayStatus = "数据源刷新已启动";
  } else if (state === "output-available" && resultText) {
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
      output={output}
      messageId={messageId}
      partIndex={partIndex}
      isLatestMessage={isLatestMessage}
      status={status}
    />
  );
}
