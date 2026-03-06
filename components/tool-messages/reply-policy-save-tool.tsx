"use client";

import { useEffect, useState } from "react";
import { configService } from "@/lib/services/config.service";
import { CheckCircle, XCircle, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import type { ReplyPolicyConfig } from "@/types/reply-policy";
import type { ToolMessageProps } from "./types";

interface SaveOutput {
  success: boolean;
  policy: ReplyPolicyConfig | null;
  summary: string;
  error?: string;
}

export function ReplyPolicySaveToolMessage({ output }: ToolMessageProps): React.ReactElement {
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const data = output as SaveOutput | undefined;

  useEffect(() => {
    if (data?.success && data.policy && !saved && !saveError) {
      configService
        .updateReplyPolicy(data.policy)
        .then(() => setSaved(true))
        .catch((err: unknown) =>
          setSaveError(err instanceof Error ? err.message : "保存失败")
        );
    }
  }, [data, saved, saveError]);

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
        <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
        正在验证策略配置...
      </div>
    );
  }

  if (!data.success) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
          <span className="text-sm font-medium text-red-700">配置验证失败</span>
        </div>
        <p className="text-xs text-red-600 pl-6">{data.error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-green-200 bg-green-50/50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        {saved ? (
          <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
        ) : saveError ? (
          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-green-500 shrink-0" />
        )}
        <span className="text-sm font-medium text-green-800">
          {saved ? "策略已保存" : saveError ? `保存失败: ${saveError}` : "正在保存到本地存储..."}
        </span>
      </div>

      <p className="text-sm text-zinc-600 pl-6">{data.summary}</p>

      {saved && (
        <div className="pl-6">
          <Link
            href="/test-llm-reply"
            className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
          >
            前往测试页面验证效果
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
