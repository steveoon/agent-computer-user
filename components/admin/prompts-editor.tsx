"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, RefreshCw, MessageSquare } from "lucide-react";
import type { ReplyPromptsConfig } from "@/types/config";
import type { ReplyContext } from "@/types/zhipin";

interface PromptsEditorProps {
  data: ReplyPromptsConfig | undefined;
  onSave: (data: ReplyPromptsConfig) => Promise<void>;
}

// 回复指令中文名称映射 - 使用 ReplyContext 类型确保类型安全
const PROMPT_NAMES: Record<ReplyContext, string> = {
  // 基础咨询类
  initial_inquiry: "初次咨询",
  location_inquiry: "位置咨询",
  no_location_match: "无位置匹配",
  schedule_inquiry: "时间安排咨询",
  interview_request: "面试邀约",
  general_chat: "通用聊天",

  // 敏感信息类
  salary_inquiry: "薪资咨询",
  age_concern: "年龄问题",
  insurance_inquiry: "保险咨询",

  // 跟进沟通类
  followup_chat: "跟进聊天",

  // 考勤排班类
  attendance_inquiry: "出勤要求咨询",
  flexibility_inquiry: "排班灵活性咨询",
  attendance_policy_inquiry: "考勤政策咨询",
  work_hours_inquiry: "工时要求咨询",
  availability_inquiry: "时间段可用性咨询",
  part_time_support: "兼职支持咨询",
} as const;

// 类型守卫函数：检查 key 是否为有效的 ReplyContext
const isValidReplyContext = (key: string): key is ReplyContext => {
  return key in PROMPT_NAMES;
};

// 安全获取指令名称的辅助函数
const getPromptName = (key: string): string => {
  return isValidReplyContext(key) ? PROMPT_NAMES[key] : key;
};

export const PromptsEditor: React.FC<PromptsEditorProps> = ({ data, onSave }) => {
  const [prompts, setPrompts] = useState<ReplyPromptsConfig>(
    () => data || ({} as ReplyPromptsConfig)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 同步数据到编辑器
  React.useEffect(() => {
    if (data) {
      setPrompts(data);
    }
  }, [data]);

  // 保存配置
  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);

    try {
      // 基本验证
      const promptEntries = Object.entries(prompts);
      const emptyPrompts = promptEntries.filter(([_, value]) => !value?.trim());

      if (emptyPrompts.length > 0) {
        throw new Error(
          `以下回复指令不能为空: ${emptyPrompts.map(([key]) => getPromptName(key)).join(", ")}`
        );
      }

      await onSave(prompts);
      console.log("✅ 回复指令保存成功");
    } catch (error) {
      console.error("❌ 回复指令保存失败:", error);
      setError(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }, [prompts, onSave]);

  // 重置到原始数据
  const handleReset = useCallback(() => {
    if (data) {
      setPrompts(data);
      setError(null);
    }
  }, [data]);

  // 更新回复指令
  const updatePrompt = useCallback((key: string, value: string) => {
    setPrompts(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>回复指令编辑器</CardTitle>
          <CardDescription>配置智能回复的模板指令</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">没有回复指令数据</p>
            <p className="text-sm text-muted-foreground mt-2">
              请确保已完成数据迁移或重新初始化配置
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 头部操作栏 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-6 w-6" />
                回复指令编辑器
              </CardTitle>
              <CardDescription>
                配置不同场景下的智能回复模板，支持变量替换和动态生成
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}>
                <RefreshCw className="h-4 w-4 mr-2" />
                重置
              </Button>
              <Button onClick={handleSave} size="sm" disabled={saving} className="min-w-20">
                {saving ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {saving ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 错误提示 */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* 统计信息 */}
      <Card>
        <CardHeader>
          <CardTitle>回复指令概览</CardTitle>
          <CardDescription>当前配置的智能回复模板统计</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-primary">{Object.keys(prompts).length}</div>
              <div className="text-sm text-muted-foreground">总指令数</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-primary">
                {Object.values(prompts).filter(p => p && p.length > 0).length}
              </div>
              <div className="text-sm text-muted-foreground">已配置</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-primary">
                {Object.values(prompts).reduce((acc, p) => acc + (p?.length || 0), 0)}
              </div>
              <div className="text-sm text-muted-foreground">总字符数</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-primary">
                {Math.round(
                  Object.values(prompts).reduce((acc, p) => acc + (p?.length || 0), 0) /
                    Object.keys(prompts).length
                )}
              </div>
              <div className="text-sm text-muted-foreground">平均长度</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 回复指令列表 */}
      <div className="space-y-4">
        {Object.entries(prompts).map(([key, value]) => (
          <Card key={key}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{getPromptName(key)}</CardTitle>
                  <CardDescription className="text-xs font-mono text-muted-foreground">
                    {key}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  {value?.length || 0} 字符
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <textarea
                value={value || ""}
                onChange={e => updatePrompt(key, e.target.value)}
                className="w-full h-32 p-3 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={`输入 ${getPromptName(key)} 的回复模板...`}
              />
              <div className="mt-2 text-xs text-muted-foreground">
                支持变量：{"{brand}"}, {"{city}"}, {"{location}"}, {"{salary}"}, {"{schedule}"} 等
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle>编辑说明</CardTitle>
          <CardDescription>回复指令的作用和编辑注意事项</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-3">
            <div>
              <h4 className="font-medium mb-1">📝 回复指令作用</h4>
              <p className="text-muted-foreground">
                回复指令定义了AI在不同沟通场景下的回复模板，支持动态变量替换，确保回复的一致性和专业性。
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-1">🔧 变量替换</h4>
              <p className="text-muted-foreground">
                模板中可使用变量如 {"{brand}"}, {"{city}"}, {"{location}"}{" "}
                等，系统会根据实际数据自动替换。
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-1">💡 编辑建议</h4>
              <ul className="text-muted-foreground space-y-1 ml-4">
                <li>• 保持语言自然、亲和，符合招聘场景</li>
                <li>• 合理使用变量，提高回复的针对性</li>
                <li>• 考虑不同候选人类型的沟通需求</li>
                <li>• 修改后可在测试页面验证效果</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
