/**
 * 企微私域运营预处理器
 *
 * 每轮对话前注入上一轮的会话记忆。
 * 事实提取在 LLM 响应结束后通过 afterResponse 回调异步触发，结果在下一轮对话时生效。
 *
 * 时序：读缓存 → 注入提示词 → 返回 → （LLM 响应结束后）异步提取事实
 * 通过 registerPreprocessor() 自注册，route.ts 只需 import 此文件即可。
 */

import { registerPreprocessor } from "./registry";
import {
  WeworkSessionMemory,
  formatSessionMemoryForPrompt,
  createJobsFetchedHandler,
} from "@/lib/memory/wework/session-memory";
import { extractAndSaveFacts } from "@/lib/memory/wework/fact-extraction";

registerPreprocessor("weworkSystemPrompt", async (ctx) => {
  if (!ctx.userId || !ctx.sessionId) {
    return { systemPromptSuffix: "" };
  }

  const sessionMemory = new WeworkSessionMemory(ctx.userId, ctx.sessionId);

  // 读取上一轮缓存的记忆 → 注入系统提示词（零延迟）
  const state = await sessionMemory.load();
  const suffix = formatSessionMemoryForPrompt(state);

  if (suffix) {
    console.log(`[${ctx.correlationId}] Wework preprocessor: injected memory (${suffix.length} chars)`);
  }

  return {
    systemPromptSuffix: suffix,
    onJobsFetched: createJobsFetchedHandler(sessionMemory),
    // LLM 响应结束后异步提取事实，结果在下一轮对话时生效
    afterResponse: () => {
      extractAndSaveFacts(sessionMemory, ctx.processedMessages, ctx.modelConfig?.extractModel, ctx.dulidayToken)
        .catch(err => console.warn(`[${ctx.correlationId}] Wework fact extraction failed:`, err));
    },
  };
});
