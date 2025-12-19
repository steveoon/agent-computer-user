import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isToolUIPart,
  getToolName,
} from "ai";
import type { UIMessage } from "ai";
import { killDesktop } from "@/lib/e2b/utils";
import { createAndFilterTools } from "@/lib/tools/tool-registry";
import { prunedMessages, shouldCleanupSandbox } from "@/lib/utils";
import { getDynamicRegistry } from "@/lib/model-registry/dynamic-registry";
import { getBossZhipinSystemPrompt } from "@/lib/loaders/system-prompts.loader";
import { DEFAULT_PROVIDER_CONFIGS, DEFAULT_MODEL_CONFIG } from "@/lib/config/models";
import { APPROVAL, executeBashCommandLocally } from "@/lib/utils/hitl-utils";
import type { ChatRequestBody } from "@/types";
import { SourcePlatform, ApiSource } from "@/db/types";
import {
  recruitmentContext,
  processStepToolResults,
  type RecruitmentContext,
} from "@/lib/services/recruitment-event";

// Allow streaming responses up to 30 seconds
export const maxDuration = 300;

// 清理沙箱的公共函数
async function cleanupSandboxIfNeeded(sandboxId: string | null, error: unknown, context: string) {
  // 如果没有sandboxId，无需清理
  if (!sandboxId) {
    return;
  }

  if (shouldCleanupSandbox(error)) {
    try {
      console.log(`🧹 开始清理沙箱: ${sandboxId} (${context})`);
      await killDesktop(sandboxId);
      console.log(`✅ 沙箱清理完成: ${sandboxId}`);
    } catch (cleanupError) {
      console.warn(`Failed to cleanup sandbox in ${context}:`, cleanupError);
    }
  } else {
    console.log(`🔄 保留沙箱环境，可继续使用: ${sandboxId} (${context})`);
  }
}

// 处理错误消息的辅助函数
function handleStreamError(error: unknown): string {
  console.error("Stream error:", error);

  // 记录详细的错误信息
  if (error instanceof Error) {
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });

    // 检查是否是工具调用错误
    if (error.name === "AI_ToolExecutionError") {
      return `工具执行失败: ${error.message}`;
    }

    // 检查是否是网络相关错误
    if (
      error.message.includes("SocketError") ||
      error.message.includes("terminated") ||
      error.message.includes("other side closed")
    ) {
      return "网络连接中断，请重试";
    }

    return error.message;
  }

  // 处理结构化错误对象（如 overloaded_error）
  if (error && typeof error === "object") {
    const errorObj = error as Record<string, unknown>;

    // 记录完整的错误对象
    console.error("Structured error object:", {
      type: errorObj.type,
      message: errorObj.message,
      statusCode: errorObj.statusCode,
      error: errorObj.error,
      cause: errorObj.cause,
    });

    const nestedError = errorObj.error as Record<string, unknown> | undefined;

    // 处理 overloaded_error
    if (nestedError?.type === "overloaded_error") {
      return "AI服务当前负载过高，请稍后重试";
    }

    // 处理其他已知错误类型
    if (nestedError?.type === "rate_limit_error") {
      return "请求频率过高，请稍后重试";
    }

    if (nestedError?.type === "authentication_error") {
      return "认证失败，请检查API密钥配置";
    }

    // 返回错误消息
    if (errorObj.message) {
      return String(errorObj.message);
    }

    if (nestedError?.message) {
      return String(nestedError.message);
    }
  }

  if (typeof error === "string") {
    return error;
  }

  return "发生未知错误，请重试";
}

export async function POST(req: Request) {
  const {
    messages,
    sandboxId,
    preferredBrand,
    brandPriorityStrategy,
    modelConfig,
    configData,
    systemPrompts,
    replyPrompts,
    activeSystemPrompt,
    dulidayToken,
    defaultWechatId,
    maxSteps,
  }: ChatRequestBody = await req.json();

  // 📊 Set up recruitment event context for tracking
  const eventContext: RecruitmentContext = {
    agentId: process.env.AGENT_ID || "default",
    sourcePlatform: SourcePlatform.ZHIPIN,
    apiSource: ApiSource.WEB,
    // brandId is not available in configData for web route
  };

  // Run with context for event tracking
  return recruitmentContext.runAsync(eventContext, async () => {
    try {
      // 🎯 获取配置的模型和provider设置
      const chatModel = modelConfig?.chatModel || DEFAULT_MODEL_CONFIG.chatModel;
      const providerConfigs = modelConfig?.providerConfigs || DEFAULT_PROVIDER_CONFIGS;

      // 使用动态registry
      const dynamicRegistry = getDynamicRegistry(providerConfigs);

      console.log(`[CHAT API] 使用模型: ${chatModel}`);

      // 🎯 获取系统提示词 - 根据activeSystemPrompt选择
      let systemPrompt: string;
      const promptType = activeSystemPrompt || "bossZhipinSystemPrompt";

      if (systemPrompts && systemPrompts[promptType]) {
        console.log(
          `✅ 使用客户端传入的${
            promptType === "bossZhipinSystemPrompt"
              ? "Boss直聘"
              : promptType === "bossZhipinLocalSystemPrompt"
                ? "Boss直聘(本地版)"
                : "通用计算机"
          }系统提示词`
        );
        systemPrompt = systemPrompts[promptType];
      } else {
        console.log(
          `⚠️ 使用默认${
            promptType === "bossZhipinSystemPrompt"
              ? "Boss直聘"
              : promptType === "bossZhipinLocalSystemPrompt"
                ? "Boss直聘(本地版)"
                : "通用计算机"
          }系统提示词（降级模式）`
        );
        // 降级到默认提示词
        if (promptType === "bossZhipinSystemPrompt") {
          systemPrompt = await getBossZhipinSystemPrompt();
        } else if (promptType === "bossZhipinLocalSystemPrompt") {
          // 需要导入getBossZhipinLocalSystemPrompt
          const { getBossZhipinLocalSystemPrompt } = await import(
            "@/lib/loaders/system-prompts.loader"
          );
          systemPrompt = await getBossZhipinLocalSystemPrompt();
        } else {
          // 需要导入getGeneralComputerSystemPrompt
          const { getGeneralComputerSystemPrompt } = await import(
            "@/lib/loaders/system-prompts.loader"
          );
          systemPrompt = await getGeneralComputerSystemPrompt();
        }
      }

      // 🎯 对历史消息应用智能Token优化 (10K tokens阈值)
      const processedMessages = await prunedMessages(messages, {
        maxOutputTokens: 15000, // 硬限制：15K tokens
        targetTokens: 8000, // 目标：8K tokens时开始优化
        preserveRecentMessages: 2, // 保护最近2条消息
      });

      // 估算消息大小并记录优化效果
      const originalSize = JSON.stringify(messages).length;
      const processedSize = JSON.stringify(processedMessages).length;
      const savedPercent = (((originalSize - processedSize) / originalSize) * 100).toFixed(2);

      console.log(
        `📊 消息优化: ${(originalSize / 1024).toFixed(2)}KB -> ${(processedSize / 1024).toFixed(
          2
        )}KB (节省 ${savedPercent}%) | 消息数: ${messages.length} -> ${processedMessages.length}`
      );

      // 使用新的工具注册表系统创建和过滤工具
      const filteredTools = createAndFilterTools(
        {
          sandboxId,
          preferredBrand,
          brandPriorityStrategy,
          modelConfig,
          configData,
          replyPrompts,
          dulidayToken,
          defaultWechatId,
        },
        promptType
      );

      // 创建 UI 消息流 - 支持 HITL
      const stream = createUIMessageStream({
        execute: async ({ writer }) => {
          // 复制消息以便修改
          const mutableMessages = [...processedMessages] as UIMessage[];

          // 🔧 HITL: 处理工具确认
          // 只处理最后一条 assistant 消息中的待确认工具
          // 使用 Set 追踪已处理的 toolCallId，防止重复处理
          const processedToolCallIds = new Set<string>();

          // 从后往前找最后一条 assistant 消息
          for (let i = mutableMessages.length - 1; i >= 0; i--) {
            const message = mutableMessages[i];
            if (message.role !== "assistant" || !message.parts || !Array.isArray(message.parts)) {
              continue;
            }

            // 检查这条消息是否有待处理的 HITL 确认
            const hasPendingConfirmation = message.parts.some(
              part =>
                isToolUIPart(part) &&
                getToolName(part) === "bash" &&
                part.state === "output-available" &&
                (part.output === APPROVAL.YES || part.output === APPROVAL.NO)
            );

            if (!hasPendingConfirmation) {
              continue;
            }

            // 处理这条消息中的工具确认
            const processedParts = await Promise.all(
              message.parts.map(async part => {
                // 只处理工具 UI 部分
                if (!isToolUIPart(part)) {
                  return part;
                }

                const toolName = getToolName(part);
                const toolCallId = part.toolCallId;

                // 只处理 bash 工具的确认
                if (toolName !== "bash" || part.state !== "output-available") {
                  return part;
                }

                // 防止重复处理同一个 toolCallId
                if (processedToolCallIds.has(toolCallId)) {
                  return part;
                }

                let result: string;

                // 检查用户的确认决策
                if (part.output === APPROVAL.YES) {
                  // 用户确认 - 执行命令
                  processedToolCallIds.add(toolCallId);
                  console.log(`🔧 HITL: 用户确认执行 bash 命令 (toolCallId: ${toolCallId})`);
                  const input = part.input as { command?: string };
                  const command = input?.command || "";
                  result = await executeBashCommandLocally(command);
                  console.log(`✅ HITL: bash 命令执行完成`);
                } else if (part.output === APPROVAL.NO) {
                  // 用户拒绝
                  processedToolCallIds.add(toolCallId);
                  console.log(`❌ HITL: 用户拒绝执行 bash 命令 (toolCallId: ${toolCallId})`);
                  result = "User denied execution of this command";
                } else {
                  // 不是确认响应（已经是执行结果），保持原样
                  return part;
                }

                // 🔧 发送执行结果到前端，更新 UI 显示
                writer.write({
                  type: "tool-output-available",
                  toolCallId,
                  output: result,
                });

                // 返回更新后的 part（output 已更新为执行结果）
                return {
                  ...part,
                  output: result,
                };
              })
            );

            // 更新这条消息的 parts
            mutableMessages[i] = {
              ...message,
              parts: processedParts,
            };

            // 只处理最近一条有待确认的 assistant 消息
            break;
          }

          // 继续 AI 对话
          const textResult = streamText({
            model: dynamicRegistry.languageModel(chatModel),
            system: systemPrompt,
            messages: convertToModelMessages(mutableMessages),
            tools: filteredTools,
            providerOptions: {
              anthropic: { cacheControl: { type: "ephemeral" } },
            },
            // 🎯 传递中止信号，支持客户端停止生成
            abortSignal: req.signal,
            stopWhen: stepCountIs(maxSteps || 30),
            onAbort: async ({ steps }) => {
              console.log(`⏹️ Stream被客户端中止 | 已完成步数: ${steps.length}`);
              // 清理沙箱资源
              await cleanupSandboxIfNeeded(sandboxId, new Error("User aborted"), "Stream aborted");
            },
            onStepFinish: async ({ finishReason, usage, toolCalls, toolResults }) => {
              const toolInfo = toolCalls?.length
                ? ` | tools: [${toolCalls.map(t => t.toolName).join(", ")}]`
                : "";
              console.log(
                `📊 Step finish=${finishReason}${toolInfo} | tokens: ${usage?.totalTokens || 0}`
              );

              // 📊 Record events for read-type tools
              const ctx = recruitmentContext.getContext();
              if (ctx && toolCalls && toolResults) {
                processStepToolResults(ctx, toolCalls, toolResults);
              }
            },
            onFinish: async ({ usage, finishReason, steps }) => {
              // 区分正常完成和被中止（中止时 finishReason 为 unknown 或 other）
              const isAborted = finishReason === "unknown" || finishReason === "other";
              if (isAborted) {
                console.log(
                  `\n⏹️ Stream被中止 | 原因: ${finishReason} | 总步数: ${steps.length} | 总tokens: ${usage?.totalTokens || 0}`
                );
              } else {
                console.log(
                  `\n🏁 Stream完成 | 原因: ${finishReason} | 总步数: ${steps.length} | 总tokens: ${usage?.totalTokens || 0}`
                );
              }
              // 打印每步摘要
              if (steps.length > 0) {
                console.log("📋 步骤摘要:");
                steps.forEach((step, i) => {
                  const tools = step.toolCalls?.map(t => t.toolName).join(", ") || "无";
                  console.log(`   ${i + 1}. ${step.finishReason} | tools: ${tools}`);
                });
              }
            },
            onError: async error => {
              console.error("Stream generation error:", error);

              // 记录详细错误信息
              if (error && typeof error === "object") {
                const errorObj = error as Record<string, unknown>;
                console.error("Error details:", {
                  name: errorObj.name,
                  message: errorObj.message,
                  type: errorObj.type,
                  statusCode: errorObj.statusCode,
                  cause: errorObj.cause,
                  stack: errorObj.stack,
                });
              }

              // 清理沙箱
              await cleanupSandboxIfNeeded(sandboxId, error, "Stream generation");
            },
          });

          // 合并 streamText 的结果到 UI 消息流
          // 重要: 传递 originalMessages 防止重复的 assistant 消息
          writer.merge(
            textResult.toUIMessageStream({
              originalMessages: mutableMessages,
            })
          );
        },
        originalMessages: processedMessages,
        onError: error => handleStreamError(error),
      });

      // 创建响应流
      return createUIMessageStreamResponse({ stream });
    } catch (error) {
      console.error("Chat API error:", error);

      // 清理沙箱
      await cleanupSandboxIfNeeded(sandboxId, error, "Chat API");

      return new Response(JSON.stringify({ error: "Internal Server Error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  });
}
