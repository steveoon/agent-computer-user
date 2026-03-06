"use client";

import { useState, type KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CheckCircle, MessageSquareDashed } from "lucide-react";
import type { ToolMessageProps } from "./types";

interface AskInput {
  module?: string;
  question?: string;
  options?: Array<{ label: string; description: string; value?: unknown }>;
}

interface AskOutput {
  module: string;
  value?: unknown;
  keepCurrent?: boolean;
  displayValue?: string;
}

export function ReplyPolicyAskToolMessage({
  input,
  state,
  output,
  addToolOutput,
  sendMessage,
  toolCallId,
}: ToolMessageProps): React.ReactElement {
  const [selected, setSelected] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const data = input as AskInput;
  const question = data?.question ?? "请选择一个选项";
  const options = data?.options ?? [];
  const configModule = data?.module ?? "";

  const handleSelect = async (label: string, value: unknown): Promise<void> => {
    if (!addToolOutput || !sendMessage || !toolCallId || isSubmitting) return;
    setIsSubmitting(true);
    setSelected(label);
    try {
      await addToolOutput({
        toolCallId,
        tool: "reply_policy_ask",
        output: {
          module: configModule,
          value,
          displayValue: label,
        } satisfies AskOutput,
      });
      sendMessage();
    } catch (error) {
      setIsSubmitting(false);
      setSelected(null);
      toast.error("提交失败", {
        description: error instanceof Error ? error.message : "请重试",
      });
    }
  };

  const handleSkip = async (): Promise<void> => {
    if (!addToolOutput || !sendMessage || !toolCallId || isSubmitting) return;
    setIsSubmitting(true);
    setSelected("跳过（保留当前值）");
    try {
      await addToolOutput({
        toolCallId,
        tool: "reply_policy_ask",
        output: {
          module: configModule,
          keepCurrent: true,
          displayValue: "跳过（保留当前值）",
        } satisfies AskOutput,
      });
      sendMessage();
    } catch (error) {
      setIsSubmitting(false);
      setSelected(null);
      toast.error("提交失败", {
        description: error instanceof Error ? error.message : "请重试",
      });
    }
  };

  const handleCustomSubmit = async (): Promise<void> => {
    if (!customInput.trim() || !addToolOutput || !sendMessage || !toolCallId || isSubmitting) return;
    setIsSubmitting(true);
    setSelected(customInput.trim());
    try {
      await addToolOutput({
        toolCallId,
        tool: "reply_policy_ask",
        output: {
          module: configModule,
          value: customInput.trim(),
          displayValue: customInput.trim(),
        } satisfies AskOutput,
      });
      sendMessage();
    } catch (error) {
      setIsSubmitting(false);
      setSelected(null);
      toast.error("提交失败", {
        description: error instanceof Error ? error.message : "请重试",
      });
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleCustomSubmit();
    }
  };

  // 等待用户选择
  if (state === "input-available" && addToolOutput && sendMessage && toolCallId) {
    return (
      <div className="rounded-xl border border-indigo-200 bg-white/80 backdrop-blur-sm p-4 space-y-3 shadow-sm">
        <div className="flex items-start gap-2">
          <MessageSquareDashed className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
          <div>
            {configModule && (
              <Badge
                variant="outline"
                className="mb-1.5 text-[10px] font-mono bg-indigo-50 border-indigo-200 text-indigo-600"
              >
                {configModule}
              </Badge>
            )}
            <p className="text-sm font-medium text-zinc-800 leading-relaxed">{question}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 pl-7">
          {options.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => void handleSelect(opt.label, opt.value ?? opt.label)}
              disabled={!!selected}
              className="flex items-start gap-3 p-3 rounded-lg border border-zinc-200 bg-zinc-50/50 hover:bg-indigo-50 hover:border-indigo-300 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-zinc-800">{opt.label}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{opt.description}</div>
              </div>
            </button>
          ))}

          <div className="flex gap-2 mt-1">
            <Input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="自定义回答..."
              disabled={!!selected}
              className="h-9 text-sm bg-white/70 border-zinc-200 focus:border-indigo-400"
            />
            <Button
              size="sm"
              onClick={() => void handleCustomSubmit()}
              disabled={!!selected || !customInput.trim()}
              className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
            >
              确认
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleSkip()}
              disabled={!!selected}
              className="h-9 px-3 shrink-0"
            >
              跳过
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 已回答 — 折叠显示
  if (state === "output-available" || selected) {
    let answer = selected || "";

    if (output && typeof output === "object") {
      const typedOutput = output as AskOutput;
      if (typedOutput.displayValue) {
        answer = typedOutput.displayValue;
      } else if (typedOutput.keepCurrent) {
        answer = "跳过（保留当前值）";
      } else if (typeof typedOutput.value === "string") {
        answer = typedOutput.value;
      } else if (typedOutput.value !== undefined) {
        answer = JSON.stringify(typedOutput.value);
      }
    } else if (typeof output === "string" && output) {
      answer = output;
    }

    return (
      <div className="flex items-center gap-2 text-sm p-2 rounded-lg bg-indigo-50/50">
        <CheckCircle className="h-4 w-4 text-indigo-500 shrink-0" />
        {configModule && (
          <Badge
            variant="outline"
            className="text-[10px] font-mono bg-white border-indigo-200 text-indigo-600"
          >
            {configModule}
          </Badge>
        )}
        <span className="text-zinc-600 truncate">{question}</span>
        <span className="text-indigo-600 font-medium shrink-0">→ {answer}</span>
      </div>
    );
  }

  // 加载中
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      准备提问...
    </div>
  );
}
