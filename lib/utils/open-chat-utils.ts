/**
 * Open Chat API 工具函数
 * 用于处理消息归一化、工具创建、上下文验证等
 */

import type { UIMessage, GenerateTextResult, ToolSet as AIToolSet } from "ai";
import { getOpenApiModels } from "@/lib/config/models";
import { getToolRegistry, getToolsForPrompt, OPEN_API_PROMPT_TYPES } from "@/lib/tools/tool-registry";
import { safeCreateTool } from "@/types/tool-common";
import type { ToolCreationContext, ToolSet } from "@/types/tool-common";
import type { ContextStrategy, ValidationReport, ToolContextMap } from "@/types/api";

/**
 * 归一化消息
 * 将 {role, content} 格式转换为 AI SDK v5 UIMessage 格式
 *
 * 参考 AI SDK 文档:
 * - UIMessage 必须有 id, role, parts 字段
 * - parts 是一个数组，包含 text/file/tool 等类型的消息部分
 * - 使用 crypto.randomUUID() 生成唯一 ID
 */
export function normalizeMessages(
  messages: UIMessage[] | Array<{ role: string; content: string }>
): UIMessage[] {
  return messages.map(msg => {
    // 如果已经是 UIMessage 格式（有 parts 字段），直接返回
    if ("parts" in msg && Array.isArray(msg.parts)) {
      return msg as UIMessage;
    }

    // 如果是 {role, content} 格式，转换为 UIMessage
    if ("content" in msg && typeof msg.content === "string") {
      const normalizedMessage: UIMessage = {
        id: crypto.randomUUID(),
        role: msg.role as "user" | "assistant" | "system",
        parts: [
          {
            type: "text",
            text: msg.content,
          } as const,
        ],
      };
      return normalizedMessage;
    }

    // 其他情况直接返回（可能已经是正确的格式）
    return msg as UIMessage;
  });
}

/**
 * 验证模型是否在许可列表
 *
 * @param modelId - 模型 ID
 * @param allowedModels - 可选的允许模型列表（用于测试注入）
 */
export function validateModel(
  modelId: string,
  allowedModels?: Array<{ id: string; name: string; categories: string[] }>
): {
  valid: boolean;
  error?: string;
} {
  const models = allowedModels || getOpenApiModels();

  if (!models || !Array.isArray(models)) {
    console.error("getOpenApiModels() returned invalid data:", models);
    return {
      valid: false,
      error: "Failed to load allowed models list",
    };
  }

  const isAllowed = models.some(model => model.id === modelId);

  if (!isAllowed) {
    return {
      valid: false,
      error: `Model '${modelId}' is not in the allowed list. Use GET /api/v1/models to see available models.`,
    };
  }

  return { valid: true };
}

/**
 * 合并工具上下文
 * toolContext 中的字段会覆盖 globalContext 中的同名字段
 */
export function mergeToolContext(
  globalContext: Record<string, unknown>,
  toolContext: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!toolContext) {
    return globalContext;
  }

  return {
    ...globalContext,
    ...toolContext,
  };
}

/**
 * 工具创建结果
 */
interface ToolCreationResult {
  tools: ToolSet;
  used: string[];
  skipped: Array<{
    name: string;
    reason: string;
    missingContext?: string[];
    structureErrors?: Array<{
      field: string;
      issues: string[];
    }>;
  }>;
  validationReport?: ValidationReport;
}

/**
 * 根据 contextStrategy 创建工具集
 */
export function createToolsWithStrategy(
  allowedTools: string[],
  globalContext: ToolCreationContext,
  toolContextMap: ToolContextMap = {},
  contextStrategy: ContextStrategy = "error"
): ToolCreationResult {
  const result: ToolCreationResult = {
    tools: {},
    used: [],
    skipped: [],
  };

  // 准备验证报告（用于 report 策略）
  const validationReport: ValidationReport = {
    valid: true,
    model: { valid: true },
    tools: [],
  };

  const TOOL_REGISTRY = getToolRegistry();

  for (const toolName of allowedTools) {
    const toolDef = TOOL_REGISTRY[toolName];

    if (!toolDef) {
      result.skipped.push({
        name: toolName,
        reason: "Tool not found in registry",
      });
      validationReport.tools.push({
        name: toolName,
        valid: false,
        error: "Tool not found in registry",
      });
      validationReport.valid = false;
      continue;
    }

    // 合并上下文
    const effectiveContext = mergeToolContext(
      globalContext as unknown as Record<string, unknown>,
      toolContextMap[toolName] || {}
    );

    // 验证必需上下文 - 第一阶段：存在性检查
    const missingContext: string[] = [];
    if (toolDef.requiredContext) {
      for (const requiredField of toolDef.requiredContext) {
        const value = (effectiveContext as Record<string, unknown>)[requiredField];
        if (value === undefined || value === null) {
          missingContext.push(requiredField);
        }
      }
    }

    // 如果有缺失的上下文，先处理
    if (missingContext.length > 0) {
      const errorMsg = `Missing required context: ${missingContext.join(", ")}`;

      if (contextStrategy === "error") {
        // 抛出错误，中断执行
        throw new Error(
          `Tool '${toolName}' ${errorMsg}. Please provide these fields in 'context' or 'toolContext.${toolName}'.`
        );
      } else if (contextStrategy === "skip") {
        // 跳过该工具，继续处理其他工具
        result.skipped.push({
          name: toolName,
          reason: errorMsg,
          missingContext,
        });
        continue;
      } else {
        // contextStrategy === "report"
        // 记录到验证报告，但不创建工具
        validationReport.tools.push({
          name: toolName,
          valid: false,
          missingContext,
        });
        validationReport.valid = false;
        continue;
      }
    }

    // 验证必需上下文 - 第二阶段：Schema 结构验证
    // 支持所有 contextStrategy（error/skip/report）
    if (toolDef.contextSchemas) {
      const structureErrors: Array<{ field: string; issues: string[] }> = [];

      for (const [fieldName, schema] of Object.entries(toolDef.contextSchemas)) {
        const value = (effectiveContext as Record<string, unknown>)[fieldName];

        // 如果值存在，进行 Schema 验证
        if (value !== undefined && value !== null) {
          const validation = schema.safeParse(value);

          if (!validation.success) {
            // 收集 Zod 验证错误
            const issues = validation.error.issues.map(
              issue => `${issue.path.join(".")}: ${issue.message}`
            );
            structureErrors.push({ field: fieldName, issues });
          }
        }
      }

      // 如果有 Schema 验证错误，根据策略处理
      if (structureErrors.length > 0) {
        if (contextStrategy === "error") {
          // 格式化错误并抛出
          const errorMsg = structureErrors
            .map(e => `  ${e.field}:\n${e.issues.map(i => `    - ${i}`).join("\n")}`)
            .join("\n");
          throw new Error(`Tool '${toolName}' Invalid context data structure:\n${errorMsg}`);
        } else if (contextStrategy === "skip") {
          // 跳过该工具
          result.skipped.push({
            name: toolName,
            reason: "Invalid context data structure",
            structureErrors,
          });
          continue;
        } else {
          // contextStrategy === "report"
          validationReport.tools.push({
            name: toolName,
            valid: false,
            structureErrors,
          });
          validationReport.valid = false;
          continue;
        }
      }
    }

    // 尝试创建工具
    try {
      // 当 contextStrategy 为 "error" 时，让 safeCreateTool 抛出异常而不是返回 null
      const shouldThrow = contextStrategy === "error";
      const tool = safeCreateTool(
        toolDef,
        effectiveContext as unknown as ToolCreationContext,
        shouldThrow
      );

      if (tool) {
        result.tools[toolName] = tool;
        result.used.push(toolName);
        validationReport.tools.push({
          name: toolName,
          valid: true,
        });
      } else {
        const reason = "Tool creation returned null";
        result.skipped.push({
          name: toolName,
          reason,
        });
        validationReport.tools.push({
          name: toolName,
          valid: false,
          error: reason,
        });
        validationReport.valid = false;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      const reason = `Tool creation failed: ${errorMsg}`;

      if (contextStrategy === "error") {
        throw error;
      } else {
        result.skipped.push({
          name: toolName,
          reason,
        });
        validationReport.tools.push({
          name: toolName,
          valid: false,
          error: reason,
        });
        validationReport.valid = false;
      }
    }
  }

  result.validationReport = validationReport;
  return result;
}

/**
 * 构建完整的工具集
 * 包括 promptType 和 allowedTools
 */
export function buildToolSet(
  promptType: string | undefined,
  allowedTools: string[] | undefined,
  globalContext: ToolCreationContext,
  toolContextMap: ToolContextMap = {},
  contextStrategy: ContextStrategy = "error"
): ToolCreationResult {
  const toolNames = new Set<string>();

  // 如果提供了 promptType 且在公开模板列表中，添加模板工具
  if (promptType && OPEN_API_PROMPT_TYPES.includes(promptType as never)) {
    const templateTools = getToolsForPrompt(promptType);
    templateTools.forEach(name => toolNames.add(name));
  }

  // 添加 allowedTools（覆盖模板工具）
  if (allowedTools && allowedTools.length > 0) {
    allowedTools.forEach(name => toolNames.add(name));
  }

  // 如果没有任何工具，返回空集合
  if (toolNames.size === 0) {
    return {
      tools: {},
      used: [],
      skipped: [],
      validationReport: {
        valid: true,
        model: { valid: true },
        tools: [],
      },
    };
  }

  // 创建工具
  return createToolsWithStrategy(
    Array.from(toolNames),
    globalContext,
    toolContextMap,
    contextStrategy
  );
}

/**
 * 将 generateText() 的 result 转换为 UIMessage 数组
 * 保留完整的工具调用历史
 *
 * @param result - generateText() 的返回结果
 * @returns UIMessage 数组,每个 step 对应一个 message
 *
 * @remarks
 * - 如果 result 包含 steps,则遍历每个 step 构建 message
 * - 每个 step 的 text 转换为 text part
 * - 每个 step 的 toolCalls + toolResults 转换为 dynamic-tool part
 * - 如果没有 steps,返回包含最终 text 的单个 message
 *
 * @example
 * ```typescript
 * const result = await generateText({
 *   model: languageModel,
 *   messages: [...],
 *   tools: { bash: bashTool }
 * });
 *
 * const uiMessages = convertGenerateTextResultToUIMessages(result);
 * // uiMessages[0] 包含工具调用和结果
 * // uiMessages[1] 包含最终文本回复
 * ```
 */
export function convertGenerateTextResultToUIMessages<TOOLS extends AIToolSet>(
  result: Pick<GenerateTextResult<TOOLS, never>, "text" | "steps">
): UIMessage[] {
  const responseMessages: UIMessage[] = [];

  if (result.steps && result.steps.length > 0) {
    // Process each step to build complete conversation history
    for (const step of result.steps) {
      const parts: UIMessage["parts"] = [];

      // Add text content if present
      if (step.text) {
        parts.push({
          type: "text",
          text: step.text,
          state: "done",
        });
      }

      // Add tool calls with their results using DynamicToolUIPart format
      if (step.toolCalls && step.toolCalls.length > 0) {
        for (const toolCall of step.toolCalls) {
          // Find corresponding result
          const toolResult = step.toolResults?.find(r => r.toolCallId === toolCall.toolCallId);

          if (toolResult) {
            // Tool with result
            parts.push({
              type: "dynamic-tool",
              toolName: toolCall.toolName,
              toolCallId: toolCall.toolCallId,
              state: "output-available",
              input: toolCall.input,
              output: toolResult.output,
            });
          } else {
            // Tool call without result (shouldn't happen in generateText)
            parts.push({
              type: "dynamic-tool",
              toolName: toolCall.toolName,
              toolCallId: toolCall.toolCallId,
              state: "input-available",
              input: toolCall.input,
            });
          }
        }
      }

      // Only create message if there are parts
      if (parts.length > 0) {
        responseMessages.push({
          id: crypto.randomUUID(),
          role: "assistant",
          parts,
        });
      }
    }
  } else {
    // Fallback: No steps available, create single message with final text
    responseMessages.push({
      id: crypto.randomUUID(),
      role: "assistant",
      parts: [
        {
          type: "text",
          text: result.text,
          state: "done",
        },
      ],
    });
  }

  return responseMessages;
}
