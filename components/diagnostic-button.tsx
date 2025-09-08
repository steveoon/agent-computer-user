"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface DiagnosticButtonProps {
  sandboxId?: string;
}

export function DiagnosticButton({ sandboxId }: DiagnosticButtonProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<string>("");

  const runDiagnostic = async () => {
    if (!sandboxId) {
      setResult("❌ 没有可用的 Sandbox ID");
      return;
    }

    setIsRunning(true);
    setResult("🔍 正在运行诊断...");

    try {
      const response = await fetch("/api/diagnose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sandboxId }),
      });

      const data = await response.json();

      if (data.success) {
        setResult("✅ 诊断完成！请查看浏览器控制台和服务器日志获取详细信息。");
      } else {
        setResult(`❌ 诊断失败: ${data.error}`);
      }
    } catch (error) {
      setResult(`❌ 请求失败: ${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-4 border rounded-lg bg-background">
      <h3 className="text-sm font-semibold">E2B 环境诊断</h3>
      <Button
        onClick={runDiagnostic}
        disabled={isRunning || !sandboxId}
        variant="outline"
        size="sm"
      >
        {isRunning ? "运行中..." : "开始诊断"}
      </Button>
      {result && <p className="text-xs text-muted-foreground mt-2">{result}</p>}
    </div>
  );
}
