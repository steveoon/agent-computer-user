"use client";

import { CheckCircle, AlertCircle } from "lucide-react";
import type { ToolMessageProps } from "./types";

interface ReadOutput {
  success: boolean;
  error?: string;
}

export function ReplyPolicyReadToolMessage({ output }: ToolMessageProps): React.ReactElement {
  const data = output as ReadOutput | undefined;

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        正在读取策略配置...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm p-2">
      {data.success ? (
        <>
          <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
          <span className="text-green-700">已加载当前策略配置</span>
        </>
      ) : (
        <>
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <span className="text-red-600">{data.error ?? "读取失败"}</span>
        </>
      )}
    </div>
  );
}
