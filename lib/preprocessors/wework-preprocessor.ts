/**
 * 企微私域运营预处理器
 *
 * 每轮对话前注入上一轮的会话记忆。
 * 事实提取在 LLM 响应结束后通过 afterResponse 回调异步触发，结果在下一轮对话时生效。
 *
 * 冷启动场景（跨天恢复对话 / 缓存过期 / 服务重启）：
 * 检测到有对话历史但无缓存 facts 时，同步提取一次再进入 LLM 调用，
 * 保证首轮回复即可使用结构化记忆。
 *
 * 时序：读缓存 → [冷启动? 同步提取] → 注入提示词 → 返回 → （LLM 响应结束后）异步提取事实
 * 通过 registerPreprocessor() 自注册，route.ts 只需 import 此文件即可。
 */

import { registerPreprocessor } from "./registry";
import {
  WeworkSessionMemory,
  formatSessionMemoryForPrompt,
  createJobsFetchedHandler,
} from "@/lib/memory/wework/session-memory";
import { extractAndSaveFacts } from "@/lib/memory/wework/fact-extraction";

registerPreprocessor("weworkSystemPrompt", async ctx => {
  if (!ctx.userId || !ctx.sessionId) {
    return { systemPromptSuffix: "" };
  }

  const sessionMemory = new WeworkSessionMemory(ctx.userId, ctx.sessionId);

  // 读取上一轮缓存的记忆
  let state = await sessionMemory.load();

  // 冷启动检测：有对话历史但无缓存 facts → 同步提取一次，保证首轮即有结构化记忆
  const hasHistory =
    ctx.processedMessages.filter(m => m.role === "user" || m.role === "assistant").length > 2;
  if (!state.facts && hasHistory) {
    console.log(
      `[${ctx.correlationId}] Wework preprocessor: cold start detected, running sync fact extraction`
    );
    await extractAndSaveFacts(
      sessionMemory,
      ctx.processedMessages,
      ctx.modelConfig?.extractModel,
      ctx.dulidayToken
    );
    state = await sessionMemory.load();
  }

  const suffix = formatSessionMemoryForPrompt(state);

  if (suffix) {
    console.log(
      `[${ctx.correlationId}] Wework preprocessor: injected memory (${suffix.length} chars)`
    );
  }

  return {
    systemPromptSuffix: suffix,
    onJobsFetched: createJobsFetchedHandler(sessionMemory),
    // LLM 响应结束后异步提取事实，结果在下一轮对话时生效
    afterResponse: () => {
      extractAndSaveFacts(
        sessionMemory,
        ctx.processedMessages,
        ctx.modelConfig?.extractModel,
        ctx.dulidayToken
      ).catch(err => console.warn(`[${ctx.correlationId}] Wework fact extraction failed:`, err));
    },
  };
});
