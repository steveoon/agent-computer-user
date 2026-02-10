"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Save, ShieldCheck } from "lucide-react";
import type { ReplyPolicyConfig } from "@/types/config";
import { ReplyPolicyConfigSchema } from "@/types/reply-policy";

interface PromptsEditorProps {
  data: ReplyPolicyConfig | undefined;
  onSave: (data: ReplyPolicyConfig) => Promise<void>;
}

function stringifyPolicy(policy: ReplyPolicyConfig): string {
  return JSON.stringify(policy, null, 2);
}

export function PromptsEditor({ data, onSave }: PromptsEditorProps) {
  const [text, setText] = useState<string>(data ? stringifyPolicy(data) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setText(stringifyPolicy(data));
      setError(null);
    }
  }, [data]);

  const parseResult = useMemo(() => {
    if (!text.trim()) {
      return { valid: false, message: "内容为空" } as const;
    }

    try {
      const parsedJson: unknown = JSON.parse(text);
      const parsedPolicy = ReplyPolicyConfigSchema.safeParse(parsedJson);
      if (!parsedPolicy.success) {
        const issue = parsedPolicy.error.issues[0];
        const path = issue?.path?.join(".") || "replyPolicy";
        return {
          valid: false,
          message: `${path}: ${issue?.message || "格式错误"}`,
        } as const;
      }

      return {
        valid: true,
        message: "校验通过",
        value: parsedPolicy.data,
      } as const;
    } catch {
      return { valid: false, message: "不是有效 JSON" } as const;
    }
  }, [text]);

  const handleSave = useCallback(async () => {
    if (!parseResult.valid) {
      setError(parseResult.message);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave(parseResult.value);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }, [onSave, parseResult]);

  const handleReset = useCallback(() => {
    if (!data) {
      return;
    }
    setText(stringifyPolicy(data));
    setError(null);
  }, [data]);

  if (!data) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Policy 编辑器</CardTitle>
          <CardDescription>当前没有可编辑的 replyPolicy 数据</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">请先完成配置初始化或导入配置。</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Reply Policy 编辑器
              </CardTitle>
              <CardDescription>
                直接编辑 JSON。保存前执行 ReplyPolicy schema 校验。
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}>
                <RefreshCw className="h-4 w-4 mr-2" />
                重置
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !parseResult.valid}>
                {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {saving ? "保存中" : "保存"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant={parseResult.valid ? "default" : "destructive"}>
              {parseResult.valid ? "Schema OK" : "Schema Error"}
            </Badge>
            <span className="text-muted-foreground">defaultIndustryVoiceId: {data.defaultIndustryVoiceId}</span>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {!error && <p className="text-sm text-muted-foreground">{parseResult.message}</p>}

          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            className="min-h-[520px] w-full rounded-md border bg-background p-3 font-mono text-xs leading-5"
            spellCheck={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
