/**
 * POST /api/v1/chat
 *
 * Open API Agent chat endpoint
 * Supports streaming/non-streaming output, tool calling, message pruning
 *
 * Authentication is handled by Next.js middleware
 */

import { streamText, generateText, convertToModelMessages, stepCountIs } from "ai";
import {
  validateOpenChatRequest,
  type OpenChatRequest,
  type OpenChatResponse,
  type ValidationReport,
} from "@/types/api";
import {
  normalizeMessages,
  validateModel,
  buildToolSet,
  convertGenerateTextResultToUIMessages,
} from "@/lib/utils/open-chat-utils";
import { prunedMessages } from "@/lib/utils";
import { getDynamicRegistry } from "@/lib/model-registry/dynamic-registry";
import {
  createSuccessResponse,
  createErrorResponse,
  generateCorrelationId,
  handleUnknownError,
  ApiErrorType,
} from "@/lib/utils/api-response";
import { ErrorCode } from "@/lib/errors";
import { DEFAULT_PROVIDER_CONFIGS } from "@/lib/config/models";
import type { ModelConfig } from "@/lib/config/models";

export const maxDuration = 300;

export async function POST(req: Request) {
  const correlationId = generateCorrelationId();

  try {
    // Step 1: Parse and validate request
    const body = await req.json();
    let requestData: OpenChatRequest;

    try {
      requestData = validateOpenChatRequest(body);
    } catch (error) {
      console.error(`[${correlationId}] Request validation failed:`, error);
      return createErrorResponse(ApiErrorType.BadRequest, {
        message: "Invalid request body",
        details: error instanceof Error ? error.message : "Unknown validation error",
        correlationId,
      });
    }

    const {
      model,
      messages,
      stream = true,
      prune = false,
      pruneOptions,
      systemPrompt: customSystemPrompt,
      promptType,
      allowedTools,
      toolContext,
      contextStrategy = "error",
      sandboxId,
      context = {},
      validateOnly = false,
    } = requestData;

    console.log(`[${correlationId}] Request: model=${model}, stream=${stream}, prune=${prune}`);
    console.log(`[${correlationId}] Tools: ${allowedTools?.join(", ") || "none"}`);
    console.log(`[${correlationId}] ContextStrategy: ${contextStrategy}`);

    // Step 2: Model validation
    const modelValidation = validateModel(model);
    if (!modelValidation.valid) {
      console.error(`[${correlationId}] Model validation failed:`, modelValidation.error);
      return createErrorResponse(ApiErrorType.Forbidden, {
        message: modelValidation.error,
        correlationId,
      });
    }

    // Step 3: Message normalization and optional pruning
    const normalizedMessages = normalizeMessages(messages);
    console.log(`[${correlationId}] Normalized ${normalizedMessages.length} messages`);

    let processedMessages = normalizedMessages;
    let messagesPruned = false;

    if (prune) {
      const prunedResult = await prunedMessages(normalizedMessages, pruneOptions);
      processedMessages = prunedResult;
      messagesPruned = prunedResult.length < normalizedMessages.length;

      if (messagesPruned) {
        console.log(
          `[${correlationId}] Messages pruned: ${normalizedMessages.length} -> ${processedMessages.length}`
        );
      }
    }

    // Step 4: Tool set construction
    const effectiveModelConfig: ModelConfig = {
      ...context.modelConfig,
      providerConfigs: context.modelConfig?.providerConfigs || DEFAULT_PROVIDER_CONFIGS,
    };

    const toolCreationContext = {
      sandboxId: sandboxId ?? null,
      preferredBrand: context.preferredBrand,
      brandPriorityStrategy: context.brandPriorityStrategy,
      modelConfig: effectiveModelConfig,
      configData: context.configData,
      replyPrompts: context.replyPrompts,
      dulidayToken: context.dulidayToken,
      defaultWechatId: context.defaultWechatId,
    };

    // 当 validateOnly=true 时，强制使用 "report" 策略避免抛出错误
    const effectiveContextStrategy = validateOnly ? "report" : contextStrategy;

    let toolResult;
    try {
      toolResult = buildToolSet(
        promptType,
        allowedTools,
        toolCreationContext,
        toolContext,
        effectiveContextStrategy
      );
    } catch (error) {
      console.error(`[${correlationId}] Tool creation failed:`, error);

      // 解析错误消息中的 missingContext
      const errorMessage = error instanceof Error ? error.message : "Tool creation failed";
      const missingContextMatch = errorMessage.match(/Missing required context: ([^.]+)/);
      const missingContext = missingContextMatch
        ? missingContextMatch[1].split(", ").map(s => s.trim())
        : undefined;

      return createErrorResponse(ApiErrorType.BadRequest, {
        message: errorMessage,
        details: {
          error: errorMessage,
          ...(missingContext && { missingContext }),
        },
        correlationId,
      });
    }

    const { tools, used, skipped, validationReport } = toolResult;

    console.log(`[${correlationId}] Tools used: ${used.join(", ") || "none"}`);
    if (skipped.length > 0) {
      console.log(
        `[${correlationId}] Tools skipped: ${skipped.map(s => `${s.name} (${s.reason})`).join(", ")}`
      );
    }

    // Step 5: Validation mode
    if (validateOnly || contextStrategy === "report") {
      const report: ValidationReport = validationReport || {
        valid: true,
        model: { valid: true },
        tools: [],
      };
      report.model = modelValidation;

      // 直接返回验证报告，不包装在 success/data 中
      return new Response(JSON.stringify(report), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Correlation-Id": correlationId,
        },
      });
    }

    // Step 6: Determine system prompt
    // Priority: customSystemPrompt > promptType lookup > default
    let systemPrompt: string;

    if (customSystemPrompt) {
      // Priority 1: Direct custom system prompt
      systemPrompt = customSystemPrompt;
      console.log(`[${correlationId}] Using custom system prompt (${systemPrompt.length} chars)`);
    } else if (promptType && context.systemPrompts?.[promptType]) {
      // Priority 2: Lookup from context.systemPrompts by promptType
      systemPrompt = context.systemPrompts[promptType];
      console.log(`[${correlationId}] Using system prompt from promptType: ${promptType}`);
    } else {
      // Priority 3: Default fallback
      systemPrompt = "You are a helpful AI assistant.";
      if (promptType) {
        console.log(
          `[${correlationId}] promptType '${promptType}' not found in context.systemPrompts, using default`
        );
      }
    }

    // Step 7: Generate and output
    const dynamicRegistry = getDynamicRegistry(effectiveModelConfig.providerConfigs!);

    if (stream) {
      // Streaming output
      console.log(`[${correlationId}] Starting streaming response`);

      const result = streamText({
        model: dynamicRegistry.languageModel(model as never),
        system: systemPrompt,
        messages: convertToModelMessages(processedMessages),
        tools: Object.keys(tools).length > 0 ? tools : undefined,
        stopWhen: stepCountIs(30),
      });

      const response = result.toUIMessageStreamResponse();

      // Set custom headers
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "no-cache");
      headers.set("X-Accel-Buffering", "no");
      headers.set("X-Correlation-Id", correlationId);

      if (messagesPruned) {
        headers.set("X-Message-Pruned", "true");
      }

      if (skipped.length > 0) {
        headers.set("X-Tools-Skipped", skipped.map(s => s.name).join(","));
      }

      return new Response(response.body, {
        status: 200,
        headers,
      });
    } else {
      // Non-streaming output
      console.log(`[${correlationId}] Starting non-streaming response`);

      const result = await generateText({
        model: dynamicRegistry.languageModel(model as never),
        system: systemPrompt,
        messages: convertToModelMessages(processedMessages),
        tools: Object.keys(tools).length > 0 ? tools : undefined,
        stopWhen: stepCountIs(30),
      });

      // Convert generateText result to UIMessage array
      // This preserves complete tool call history from all steps
      const responseMessages = convertGenerateTextResultToUIMessages(result);

      const responseData: OpenChatResponse = {
        correlationId, // 添加请求追踪ID到响应体
        messages: responseMessages,
        usage: {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          totalTokens: result.usage.totalTokens,
          reasoningTokens: result.usage.reasoningTokens,
          cachedInputTokens: result.usage.cachedInputTokens,
        },
        tools: {
          used,
          skipped: skipped.map(s => s.name),
        },
        // actions 字段暂不实现，留待后续添加工具调用逻辑
        // actions: extractActionsFromMessages(responseMessages),
      };

      const headers: Record<string, string> = {
        "X-Correlation-Id": correlationId,
      };

      if (messagesPruned) {
        headers["X-Message-Pruned"] = "true";
      }

      if (skipped.length > 0) {
        headers["X-Tools-Skipped"] = skipped.map(s => s.name).join(",");
      }

      return createSuccessResponse(responseData, {
        correlationId,
        headers,
      });
    }
  } catch (error) {
    // 使用结构化错误处理，自动识别 LLM/网络/认证等错误类型
    return handleUnknownError(error, correlationId, ErrorCode.LLM_GENERATION_FAILED);
  }
}
