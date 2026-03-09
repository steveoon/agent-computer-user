"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { BrandSelector } from "@/components/brand-selector";
import { BackButton } from "@/components/ui/back-button";
import { useBrand } from "@/lib/contexts/brand-context";
import { clearBrandStorage, getBrandStorageStatus } from "@/lib/utils/brand-storage";
import { useModelConfig } from "@/lib/stores/model-config-store";
import { useConfigDataForChat } from "@/hooks/useConfigDataForChat";
import { configService } from "@/lib/services/config.service";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { MessageClassification } from "@/types/zhipin";
import type { StoreWithDistance } from "@/types/geocoding";
import type { FunnelStage, ReplyNeed, RiskFlag, ReplyPolicyConfig, ChannelType } from "@/types/reply-policy";
import type {
  AgeEligibilityAppliedStrategy,
  AgeEligibilityStatus,
  AgeEligibilitySummary,
} from "@/lib/services/eligibility/age-eligibility";

// Components
import { ModelConfigCard } from "./components/model-config-card";
import { EnvironmentSimulatorCard } from "./components/environment-simulator-card";
import { BrandStatsCard } from "./components/brand-stats-card";
import { TestInputCard } from "./components/test-input-card";
import { ConversationHistoryCard } from "./components/conversation-history-card";
import { ReplyResult } from "./components/reply-result";
import { PolicyEditorCard } from "./components/policy-editor-card";

export default function TestLLMReplyPage() {
  const { currentBrand } = useBrand();
  const { classifyModel, replyModel, providerConfigs } = useModelConfig();
  const {
    configData,
    replyPolicy,
    brandPriorityStrategy,
    isLoading: configLoading,
    error: configError,
  } = useConfigDataForChat();
  const [message, setMessage] = useState("");
  const [toolBrand, setToolBrand] = useState("");
  const [channelType, setChannelType] = useState<ChannelType>("public");
  const [reply, setReply] = useState("");
  const [stage, setStage] = useState<FunnelStage | "">("");
  const [needs, setNeeds] = useState<ReplyNeed[]>([]);
  const [riskFlags, setRiskFlags] = useState<RiskFlag[]>([]);
  const [reasoning, setReasoning] = useState("");
  const [debugInfo, setDebugInfo] = useState<{
    relevantStores: StoreWithDistance[];
    storeCount: number;
    detailLevel: string;
    classification: MessageClassification;
    gateStatus: AgeEligibilityStatus;
    appliedStrategy: AgeEligibilityAppliedStrategy;
    ageRangeSummary: AgeEligibilitySummary;
  } | null>(null); // 🆕 调试信息
  const [contextInfo, setContextInfo] = useState<string>(""); // 🆕 上下文信息
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [brandStats, setBrandStats] = useState<{
    historyCount: number;
    currentBrand: string | null;
  } | null>(null);
  const [conversationHistory, setConversationHistory] = useState<string[]>([]);
  const [editablePolicy, setEditablePolicy] = useState<ReplyPolicyConfig | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  // 当 replyPolicy 加载后初始化可编辑副本
  useEffect(() => {
    if (replyPolicy && !editablePolicy) {
      setEditablePolicy(structuredClone(replyPolicy));
    }
  }, [replyPolicy, editablePolicy]);

  const handleResetPolicy = (): void => {
    if (replyPolicy) setEditablePolicy(structuredClone(replyPolicy));
  };

  const handleApplyPolicy = async (): Promise<void> => {
    if (!editablePolicy) return;
    setIsApplying(true);
    try {
      await configService.updateReplyPolicy(editablePolicy);
      toast.success("策略已生效", {
        description: "配置已保存，智能回复将使用此策略",
      });
    } catch (error) {
      toast.error("保存失败", {
        description: error instanceof Error ? error.message : "未知错误",
      });
    } finally {
      setIsApplying(false);
    }
  };

  // 🗑️ 清除品牌偏好
  const handleClearPreferences = async () => {
    try {
      await clearBrandStorage();
      alert("品牌偏好已清除！页面将刷新以重置状态。");
      window.location.reload();
    } catch (error) {
      alert("清除失败：" + error);
    }
  };

  // 📊 加载品牌统计信息
  const loadBrandStats = async () => {
    try {
      const stats = await getBrandStorageStatus();
      setBrandStats(stats);
    } catch (error) {
      console.warn("加载品牌统计失败:", error);
    }
  };

  const handleSubmit = async (testMessage?: string) => {
    const messageToTest = testMessage || message;

    if (!messageToTest.trim()) {
      return;
    }

    // 🔧 检查配置数据是否加载完成
    if (configLoading) {
      setError("配置数据加载中，请稍候...");
      return;
    }

    if (configError) {
      setError(`配置数据加载失败: ${configError}`);
      return;
    }

    if (!configData || !editablePolicy) {
      setError("配置数据未加载，请刷新页面重试");
      return;
    }

    setLoading(true);
    setError("");
    setReply("");
    setStage("");
    setNeeds([]);
    setRiskFlags([]);
    setReasoning("");
    setDebugInfo(null); // 重置调试信息
    setContextInfo(""); // 重置上下文信息

    try {
      const response = await fetch("/api/test-llm-reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: messageToTest,
          brand: currentBrand,
          toolBrand, // 🆕 传递工具识别品牌
          modelConfig: {
            classifyModel,
            replyModel,
            providerConfigs,
          },
          configData, // 🔧 传递配置数据
          replyPolicy: editablePolicy, // 传递可编辑的回复策略
          brandPriorityStrategy, // 传递品牌优先级策略
          conversationHistory, // 传递对话历史
          channelType, // 渠道类型
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      // 确保只存储文本内容，避免渲染对象
      const replyText = typeof data.reply === "string" ? data.reply : data.reply?.text || "";
      setReply(replyText);
      setStage(data.stage || "");
      setNeeds(Array.isArray(data.needs) ? data.needs : []);
      setRiskFlags(Array.isArray(data.riskFlags) ? data.riskFlags : []);
      setReasoning(data.reasoningText || "");
      if (data.debugInfo) {
        setDebugInfo(data.debugInfo);
      }
      if (data.contextInfo) {
        setContextInfo(data.contextInfo);
      }

      // 自动追加到对话历史：候选人消息 + 生成的回复
      if (replyText) {
        setConversationHistory(prev => [
          ...prev,
          `求职者: ${messageToTest.trim()}`,
          `我: ${replyText}`,
        ]);
      }
    } catch (error) {
      console.error("测试失败:", error);
      setError(error instanceof Error ? error.message : "未知错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-background font-sans">
      {/* 背景光斑效果 - 使用更清爽的蓝紫色调替代黄色 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="bg-blob bg-blob-1"
          style={{ background: "#60a5fa", opacity: 0.15 }} // Blue
        />
        <div
          className="bg-blob bg-blob-2"
          style={{ background: "#a78bfa", opacity: 0.15, animationDelay: "2s" }} // Purple
        />
        <div
          className="bg-blob bg-blob-3"
          style={{ background: "#38bdf8", opacity: 0.15, animationDelay: "4s" }} // Sky
        />
      </div>

      <div className="relative z-10 container mx-auto p-6 max-w-5xl space-y-6">
        {/* 头部标题区 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BackButton href="/" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">智能回复测试</h1>
              <p className="text-muted-foreground">测试AI对求职者消息的理解与自动回复生成</p>
            </div>
          </div>
          <div className="flex items-center bg-white/60 backdrop-blur-md rounded-xl border border-white/40 shadow-sm p-1 gap-1">
            <div className="flex items-center px-3 py-1.5 gap-2 border-r border-black/5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                当前品牌
              </span>
              <BrandSelector showHistory={true} />
            </div>
            <Link href="/agent-config">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 h-9 px-3 text-gray-600 hover:text-indigo-600 hover:bg-white/50 rounded-lg"
              >
                <Settings className="w-4 h-4" />
                模型配置
              </Button>
            </Link>
          </div>
        </div>

        {/* 策略编辑器 - 全宽 */}
        {editablePolicy && (
          <PolicyEditorCard
            policy={editablePolicy}
            onChange={setEditablePolicy}
            onReset={handleResetPolicy}
            onApply={handleApplyPolicy}
            isApplying={isApplying}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧栏：配置与历史 */}
          <div className="space-y-6 lg:col-span-1">
            {/* 当前模型配置 */}
            <ModelConfigCard />

            {/* 模拟环境设置 */}
            <EnvironmentSimulatorCard
              toolBrand={toolBrand}
              setToolBrand={setToolBrand}
              channelType={channelType}
              setChannelType={setChannelType}
            />

            {/* 功能说明 & 统计 */}
            <BrandStatsCard
              brandStats={brandStats}
              loadBrandStats={loadBrandStats}
              handleClearPreferences={handleClearPreferences}
            />
          </div>

          {/* 右侧栏：主要交互区 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 测试控制区 - 优先展示 */}
            <TestInputCard
              message={message}
              setMessage={setMessage}
              handleSubmit={handleSubmit}
              loading={loading}
            />

            {/* 对话历史编辑器 - 次要展示 */}
            <ConversationHistoryCard
              conversationHistory={conversationHistory}
              setConversationHistory={setConversationHistory}
            />

            {/* 结果展示区 */}
            <ReplyResult
              reply={reply}
              stage={stage}
              needs={needs}
              riskFlags={riskFlags}
              reasoning={reasoning}
              debugInfo={debugInfo}
              contextInfo={contextInfo}
              loading={loading}
              error={error}
              configLoading={configLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
