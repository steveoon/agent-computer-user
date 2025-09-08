import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { killDesktop } from "@/lib/e2b/utils";
import { createAndFilterTools } from "@/lib/tools/tool-registry";
import { prunedMessages, shouldCleanupSandbox } from "@/lib/utils";
import { getDynamicRegistry } from "@/lib/model-registry/dynamic-registry";
import { getBossZhipinSystemPrompt } from "@/lib/loaders/system-prompts.loader";
import { DEFAULT_PROVIDER_CONFIGS, DEFAULT_MODEL_CONFIG } from "@/lib/config/models";
import type { ChatRequestBody } from "@/types";

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

export async function POST(req: Request) {
  const {
    messages,
    sandboxId,
    preferredBrand,
    modelConfig,
    configData,
    systemPrompts,
    replyPrompts,
    activeSystemPrompt,
    dulidayToken,
    defaultWechatId,
  }: ChatRequestBody = await req.json();

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
    // 这替代了之前手动创建每个工具的复杂逻辑
    const filteredTools = createAndFilterTools(
      {
        sandboxId,
        preferredBrand,
        modelConfig,
        configData,
        replyPrompts,
        dulidayToken,
        defaultWechatId,
      },
      promptType
    );

    const result = streamText({
      model: dynamicRegistry.languageModel(chatModel), // 使用配置的模型
      system: systemPrompt,
      messages: convertToModelMessages(processedMessages),
      tools: filteredTools,
      providerOptions: {
        anthropic: { cacheControl: { type: "ephemeral" } },
      },
      stopWhen: stepCountIs(30),
      onFinish: async ({ usage, toolResults }) => {
        console.log("📊 usage", usage);
        // Note: toolResults is typically empty in streaming mode as results are sent immediately
        if (toolResults && toolResults.length > 0) {
          console.log("🛠️ toolResults", toolResults);
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

    // Create response stream with proper error handling
    const response = result.toUIMessageStreamResponse({
      onError(error: unknown) {
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
      },
    });

    return response;
  } catch (error) {
    console.error("Chat API error:", error);

    // 清理沙箱
    await cleanupSandboxIfNeeded(sandboxId, error, "Chat API");

    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
