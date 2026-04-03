"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState, useCallback, useLayoutEffect } from "react";
import { toast } from "sonner";
import { ABORTED } from "@/lib/utils";
import { useSmartClean } from "./useSmartClean";
import { useFeishuNotification } from "./useFeishuNotification";
import { useBrand } from "@/lib/contexts/brand-context";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useModelConfig } from "@/lib/stores/model-config-store";
import { useConfigDataForChat } from "./useConfigDataForChat";
import { getEnvironmentLimits, detectEnvironment } from "@/lib/utils/environment";
import type { ChatRequestOptions, FinishReason } from "@/types";
import type { ToolPart } from "@/types/tool-common";

// 同构 useLayoutEffect，避免 SSR 问题
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * 模块级可变存储，用于 transport body 的间接读取
 * 避免在 useState 初始化器中引用 React ref（react-hooks/refs 规则限制）
 * key = chatId, value = 最新请求体数据
 */
const chatBodyStore = new Map<string, Record<string, unknown>>();

function getChatBodyForId(chatId: string): Record<string, unknown> {
  return chatBodyStore.get(chatId) ?? {};
}

interface UseCustomChatProps {
  sandboxId: string | null;
  sandboxStatus: "running" | "paused" | "unknown";
}

export function useCustomChat({ sandboxId, sandboxStatus: _sandboxStatus }: UseCustomChatProps) {
  // 🔐 用户认证状态
  const { isAuthenticated } = useAuthStore();

  // 🏪 品牌管理
  const { currentBrand } = useBrand();

  // 🤖 模型配置
  const { chatModel, classifyModel, replyModel, providerConfigs, maxSteps, agentId } = useModelConfig();

  // 🔧 配置数据 - 从 localforage 加载
  const {
    configData,
    systemPrompts,
    replyPolicy,
    activeSystemPrompt,
    brandPriorityStrategy,
    isLoading: configLoading,
    error: configError,
  } = useConfigDataForChat();

  // 🔄 防止飞书通知循环调用的标志（使用 ref 因为仅在 effect/callback 中读写，不影响渲染）
  const isProcessingErrorRef = useRef(false);

  // 🛡️ 防止短时间内重复处理载荷错误的时间戳（使用 ref 因为仅在 effect 中读写）
  const lastPayloadErrorTimeRef = useRef(0);

  // 🌍 环境信息状态 - 使用 isomorphic effect 避免 hydration 不匹配
  const [envInfo, setEnvInfo] = useState(() => {
    // 初始值使用安全的默认值
    return {
      environment: "unknown" as "unknown" | "vercel" | "local",
      limits: getEnvironmentLimits(),
      description: "未知环境 - 使用保守设置",
    };
  });

  // 🌍 使用 useIsomorphicLayoutEffect 在客户端同步更新环境信息
  useIsomorphicLayoutEffect(() => {
    const actualEnv = detectEnvironment();
    const actualLimits = getEnvironmentLimits();
    const actualDescription = {
      vercel: "Vercel 部署环境 - 严格的请求大小限制",
      local: "本地开发环境 - 较宽松的限制",
      unknown: "未知环境 - 使用保守设置",
    }[actualEnv];

    setEnvInfo({
      environment: actualEnv,
      limits: actualLimits,
      description: actualDescription,
    });
  }, []);

  const envLimits = envInfo.limits;

  // 🎯 检查是否为请求过大错误
  const isPayloadTooLargeError = (error: Error) => {
    return (
      error.message.includes("Request Entity Too Large") ||
      error.message.includes("FUNCTION_PAYLOAD_TOO_LARGE") ||
      error.message.includes("Payload Too Large") ||
      error.message.includes("413")
    );
  };

  // 🎯 检查是否为服务过载错误
  const isOverloadedError = (error: Error) => {
    return error.message.includes("AI服务当前负载过高");
  };

  // 🎯 检查是否为频率限制错误
  const isRateLimitError = (error: Error) => {
    return error.message.includes("请求频率过高");
  };

  // 从 localStorage 获取 dulidayToken（使用 lazy initializer 避免 set-state-in-effect）
  const [dulidayToken] = useState<string | null>(
    () => (typeof window !== "undefined" ? localStorage.getItem("duliday_token") : null)
  );
  // 从 localStorage 获取默认微信号
  const [defaultWechatId] = useState<string | null>(
    () => (typeof window !== "undefined" ? localStorage.getItem("default_wechat_id") : null)
  );

  // 🎯 AI SDK v5: 手动管理 input 状态
  const [input, setInput] = useState("");

  // 🎯 存储最后的 finishReason，用于判断是否需要显示"继续"按钮
  const [lastFinishReason, setLastFinishReason] = useState<FinishReason>(null);

  // 🎯 生成稳定的聊天 ID（如果没有 sandboxId）
  const [stableChatId] = useState(() => `chat-${crypto.randomUUID()}`);
  const chatId = sandboxId || stableChatId;

  // 🔧 HITL 修复：用模块级 Map 存储最新的请求体数据，供 DefaultChatTransport.body 读取
  // 这样 HITL 恢复（addToolOutput + sendMessage()）时也能带上 modelConfig 等上下文
  // 使用模块级 chatBodyStore 而非 useRef，避免 react-hooks/refs 在 useState 初始化器中报错
  useEffect(() => {
    const body: Record<string, unknown> = { sandboxId: sandboxId || null };
    if (currentBrand) body.preferredBrand = currentBrand;
    if (brandPriorityStrategy) body.brandPriorityStrategy = brandPriorityStrategy;
    body.modelConfig = { chatModel, classifyModel, replyModel, providerConfigs };
    if (configData) body.configData = configData;
    if (systemPrompts) body.systemPrompts = systemPrompts;
    if (replyPolicy) body.replyPolicy = replyPolicy;
    if (activeSystemPrompt) body.activeSystemPrompt = activeSystemPrompt;
    if (dulidayToken) body.dulidayToken = dulidayToken;
    if (defaultWechatId) body.defaultWechatId = defaultWechatId;
    if (maxSteps) body.maxSteps = maxSteps;
    if (agentId) body.agentId = agentId;
    chatBodyStore.set(chatId, body);
    return () => { chatBodyStore.delete(chatId); };
  }, [
    chatId,
    sandboxId, currentBrand, brandPriorityStrategy,
    chatModel, classifyModel, replyModel, providerConfigs,
    configData, systemPrompts, replyPolicy, activeSystemPrompt,
    dulidayToken, defaultWechatId, maxSteps, agentId,
  ]);

  // 🎯 transport 实例需要稳定引用（避免每次 render 重建）
  // body 回调通过 chatId 间接读取模块级 store（不引用 React ref）
  const [transport] = useState(() => new DefaultChatTransport({
    api: "/api/chat",
    credentials: "include",
    body: () => getChatBodyForId(chatId),
  }));

  // 🎯 AI SDK v5: 使用 DefaultChatTransport 配置
  const {
    messages,
    status,
    stop: stopGeneration,
    sendMessage,
    setMessages,
    error,
    regenerate,
    addToolOutput, // HITL: 用于发送工具确认决策
  } = useChat({
    transport,
    id: chatId,
    onFinish: ({finishReason}) => {
      // 保存最后的 finishReason
      if (finishReason) {
        setLastFinishReason(finishReason);
        console.log(`🏁 Chat完成 | finishReason: ${finishReason}`);
      }
    },
  });

  // 使用智能清理 Hook
  const { smartClean, clearMessages, handlePayloadTooLargeError, checkCleanThreshold } =
    useSmartClean({
      messages,
      setMessages,
      envLimits,
      envInfo,
    });

  // 使用飞书通知 Hook
  const { sendFeishuNotification } = useFeishuNotification({
    append: async (message: { role: "user"; content: string }) => {
      // 构建简化的请求体
      const requestBody: Record<string, unknown> = { sandboxId: sandboxId || null };

      // 构建 modelConfig 对象
      const modelConfig = {
        chatModel,
        classifyModel,
        replyModel,
        providerConfigs,
      };

      if (currentBrand) requestBody.preferredBrand = currentBrand;
      if (brandPriorityStrategy) requestBody.brandPriorityStrategy = brandPriorityStrategy;
      if (modelConfig) requestBody.modelConfig = modelConfig;
      if (configData) requestBody.configData = configData;
      if (systemPrompts) requestBody.systemPrompts = systemPrompts;
      if (replyPolicy) requestBody.replyPolicy = replyPolicy;
      if (activeSystemPrompt) requestBody.activeSystemPrompt = activeSystemPrompt;
      if (dulidayToken) requestBody.dulidayToken = dulidayToken;
      if (defaultWechatId) requestBody.defaultWechatId = defaultWechatId;
      if (maxSteps) requestBody.maxSteps = maxSteps;
      if (agentId) requestBody.agentId = agentId;

      await sendMessage({ text: message.content }, { body: requestBody });
    },
  });

  // 设置 onError 和 onFinish 回调
  useEffect(() => {
    if (!error) return;

    console.error("Chat error:", error);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });

    // 🔄 防止错误处理循环
    if (isProcessingErrorRef.current) {
      console.warn("🚫 正在处理错误中，跳过重复处理");
      return;
    }

    // 🎯 处理请求过大错误
    if (isPayloadTooLargeError(error)) {
      const now = Date.now();

      // 🛡️ 防止短时间内重复处理同样的错误（30秒内）
      if (now - lastPayloadErrorTimeRef.current < 30000) {
        console.warn("🚫 短时间内已处理过载荷错误，跳过重复处理");
        return;
      }

      isProcessingErrorRef.current = true;
      lastPayloadErrorTimeRef.current = now;
      console.warn("💾 检测到请求载荷过大错误，准备智能清理");

      // 🎯 立即尝试清理，不先发送通知避免循环
      console.log("🔄 优先执行清理操作，避免通知循环");

      const wasHandled = handlePayloadTooLargeError();

      if (wasHandled) {
        // 🎯 清理成功，准备重试
        console.log("✅ 载荷清理成功，准备自动重试");

        setTimeout(() => {
          console.log("🔄 载荷过大错误处理完成，自动重试请求");
          isProcessingErrorRef.current = false;
          regenerate();
        }, 1000);
      } else {
        // 🚨 清理失败，现在发送通知并显示错误
        console.warn("❌ 载荷清理失败，发送通知并显示错误提示");

        // 只有在清理失败时才发送飞书通知
        sendFeishuNotification("payload_error", {
          additional_info: `对话历史包含${messages.length}条消息，估算大小${(
            JSON.stringify(messages).length /
            (1024 * 1024)
          ).toFixed(2)}MB，清理失败，仍然触发载荷过大限制。错误信息：${error.message}`,
        });

        isProcessingErrorRef.current = false;
        toast.error("请求过大", {
          description: "智能清理失败，请考虑手动清空部分对话历史后重试",
          richColors: true,
          position: "top-center",
          action: {
            label: "清空对话",
            onClick: clearMessages,
          },
        });
      }
    } else if (isOverloadedError(error)) {
      // 处理服务过载错误
      console.warn("🔄 AI服务过载，建议稍后重试");
      toast.warning("服务繁忙", {
        description: "AI服务当前负载较高，建议稍后重试",
        richColors: true,
        position: "top-center",
        duration: 5000,
      });

      // 发送飞书通知
      sendFeishuNotification("system_warning", {
        additional_info: `AI服务过载，错误信息：${error.message}`,
      });
    } else if (isRateLimitError(error)) {
      // 处理频率限制错误
      console.warn("⏱️ 请求频率过高");
      toast.warning("请求过于频繁", {
        description: "您的请求频率过高，请稍后再试",
        richColors: true,
        position: "top-center",
        duration: 5000,
      });
    } else {
      // 其他类型错误的通用处理
      toast.error("请求失败", {
        description: error.message || "请检查网络连接或稍后重试",
        richColors: true,
        position: "top-center",
      });
    }
  }, [
    error,
    messages,
    sendFeishuNotification,
    handlePayloadTooLargeError,
    regenerate,
    clearMessages,
  ]);

  // 停止生成
  const stop = useCallback(() => {
    stopGeneration();

    setMessages(prev => {
      const lastMessage = prev.at(-1);
      const lastMessageLastPart = lastMessage?.parts.at(-1);
      const isToolPart =
        typeof lastMessageLastPart?.type === "string" &&
        lastMessageLastPart.type.startsWith("tool-");
      const state = lastMessageLastPart && "state" in lastMessageLastPart
        ? lastMessageLastPart.state
        : undefined;

      if (!lastMessage || lastMessage.role !== "assistant" || !isToolPart) {
        return prev;
      }

      if (state === "output-available" || state === "output-error") {
        return prev;
      }

      // AI SDK v5 tool part 格式 - 需要保留 toolCallId
      return [
        ...prev.slice(0, -1),
        {
          ...lastMessage,
          parts: [
            ...lastMessage.parts.slice(0, -1),
            {
              ...lastMessageLastPart,
              state: "output-available" as const,
              output: ABORTED,
            } as ToolPart,
          ],
        },
      ];
    });
  }, [stopGeneration, setMessages]);

  // 🎯 AI SDK v5: 手动实现 handleInputChange
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    []
  );

  // 🎯 AI SDK v5: 手动实现 handleSubmit
  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      // 🔐 检查用户认证状态
      if (!isAuthenticated) {
        toast.error("请先登录", {
          description: "您需要登录后才能使用AI助手功能",
          richColors: true,
          position: "top-center",
        });
        return;
      }

      if (!input.trim()) return;

      if (error != null) {
        console.log("Removing last message due to error before retry");

        // 对于某些错误类型，不应该立即重试
        if (isPayloadTooLargeError(error)) {
          console.log("🚫 载荷过大错误，跳过重试以避免重复错误");
          return;
        }

        if (isOverloadedError(error)) {
          console.log("🚫 服务过载错误，请稍后重试");
          toast.info("请稍等片刻", {
            description: "AI服务正在恢复中，请稍后再试",
            position: "top-center",
          });
          return;
        }

        if (isRateLimitError(error)) {
          console.log("🚫 频率限制错误，请稍后重试");
          toast.info("请慢一点", {
            description: "请求过于频繁，请稍后再试",
            position: "top-center",
          });
          return;
        }

        setMessages(messages.slice(0, -1));
      }

      // 发送消息 (AI SDK v5 格式 - sendMessage 使用简化格式)
      // 简化 body 参数，只传递必要的数据
      const requestBody: Record<string, unknown> = {
        sandboxId: sandboxId || null,
      };

      // 构建 modelConfig 对象
      const modelConfig = {
        chatModel,
        classifyModel,
        replyModel,
        providerConfigs,
      };

      // 只在数据存在时添加
      if (currentBrand) requestBody.preferredBrand = currentBrand;
      if (brandPriorityStrategy) requestBody.brandPriorityStrategy = brandPriorityStrategy;
      if (modelConfig) requestBody.modelConfig = modelConfig;
      if (configData) requestBody.configData = configData;
      if (systemPrompts) requestBody.systemPrompts = systemPrompts;
      if (replyPolicy) requestBody.replyPolicy = replyPolicy;
      if (activeSystemPrompt) requestBody.activeSystemPrompt = activeSystemPrompt;
      if (dulidayToken) requestBody.dulidayToken = dulidayToken;
      if (defaultWechatId) requestBody.defaultWechatId = defaultWechatId;
      if (maxSteps) requestBody.maxSteps = maxSteps;
      if (agentId) requestBody.agentId = agentId;

      // 重置 finishReason
      setLastFinishReason(null);

      sendMessage({ text: input }, { body: requestBody });

      // 清空输入
      setInput("");
    },
    [
      isAuthenticated,
      error,
      sendMessage,
      messages,
      setMessages,
      input,
      sandboxId,
      currentBrand,
      brandPriorityStrategy,
      chatModel,
      classifyModel,
      replyModel,
      providerConfigs,
      configData,
      systemPrompts,
      replyPolicy,
      activeSystemPrompt,
      dulidayToken,
      defaultWechatId,
      maxSteps,
      agentId,
    ]
  );

  // 🎯 AI SDK v5: 实现 append 方法（兼容层）
  const append = useCallback(
    async (message: { role: "user" | "assistant"; content: string }) => {
      // sendMessage 只支持 user 角色，assistant 消息需要通过 setMessages 添加
      if (message.role === "user") {
        // 构建类型安全的请求体
        const requestBody: ChatRequestOptions = { sandboxId: sandboxId || null };

        // 构建 modelConfig 对象
        const modelConfig = {
          chatModel,
          classifyModel,
          replyModel,
          providerConfigs,
        };

        if (currentBrand) requestBody.preferredBrand = currentBrand;
        if (brandPriorityStrategy) requestBody.brandPriorityStrategy = brandPriorityStrategy;
        if (modelConfig) requestBody.modelConfig = modelConfig;
        if (configData) requestBody.configData = configData;
        if (systemPrompts) requestBody.systemPrompts = systemPrompts;
        if (replyPolicy) requestBody.replyPolicy = replyPolicy;
        if (activeSystemPrompt) requestBody.activeSystemPrompt = activeSystemPrompt;
        if (dulidayToken) requestBody.dulidayToken = dulidayToken;
        if (maxSteps) requestBody.maxSteps = maxSteps;
        if (agentId) requestBody.agentId = agentId;

        // 重置 finishReason
        setLastFinishReason(null);

        await sendMessage({ text: message.content }, { body: requestBody });
      } else {
        // 对于 assistant 消息，直接添加到 messages
        // AI SDK v5 要求使用 parts 数组而不是 content 字符串
        setMessages(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            parts: [
              {
                type: "text",
                text: message.content,
              },
            ],
            // Note: createdAt is not part of the UIMessage interface in v5
          } as UIMessage,
        ]);
      }
    },
    [
      sendMessage,
      setMessages,
      sandboxId,
      currentBrand,
      brandPriorityStrategy,
      chatModel,
      classifyModel,
      replyModel,
      providerConfigs,
      configData,
      systemPrompts,
      replyPolicy,
      activeSystemPrompt,
      dulidayToken,
      maxSteps,
      agentId,
    ]
  );

  // 监听消息数量变化
  useEffect(() => {
    checkCleanThreshold();
  }, [messages.length, checkCleanThreshold]);

  // 监听错误状态变化
  useEffect(() => {
    if (error) {
      console.log("Error detected:", error);
    }
  }, [error]);

  const isLoading = status !== "ready" || configLoading;

  // 🔧 配置错误处理
  useEffect(() => {
    if (configError) {
      console.error("配置数据加载错误:", configError);
      toast.error("配置加载失败", {
        description: "使用默认配置，部分功能可能受限",
        richColors: true,
        position: "top-center",
      });
    }
  }, [configError]);

  return {
    // 状态
    messages,
    input,
    status,
    error,
    isLoading,
    lastFinishReason, // 最后的完成原因

    // 🔧 配置状态
    configLoading,
    configError,

    // 方法
    handleInputChange,
    handleSubmit,
    stop,
    append,
    reload: regenerate, // 兼容旧 API

    // 清理相关
    clearMessages,
    smartClean: () => smartClean(false),

    // 通知相关
    sendFeishuNotification,

    // 环境信息
    envInfo,

    // HITL: 工具确认相关
    addToolOutput, // 发送工具确认决策
    sendMessage, // 继续对话
  };
}
