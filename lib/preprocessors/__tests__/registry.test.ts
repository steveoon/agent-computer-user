import { describe, it, expect } from "vitest";

/**
 * 测试预处理器注册表
 *
 * 因为 registry.ts 使用模块级 PREPROCESSOR_REGISTRY 单例，
 * 这里直接 import 后测试注册 + 运行逻辑。
 */

// 每次测试需要全新的 registry，通过动态 import 实现隔离
// 但由于模块缓存，改为直接测试公共 API 行为

import { registerPreprocessor, runPreprocessor } from "../registry";
import type { PreprocessorContext } from "../registry";

function makeCtx(overrides: Partial<PreprocessorContext> = {}): PreprocessorContext {
  return {
    promptType: "weworkSystemPrompt",
    processedMessages: [],
    correlationId: "test-123",
    ...overrides,
  };
}

describe("preprocessor registry", () => {
  it("returns empty suffix when no preprocessor is registered for promptType", async () => {
    const result = await runPreprocessor(
      makeCtx({ promptType: "generalComputerSystemPrompt" })
    );
    expect(result.systemPromptSuffix).toBe("");
  });

  it("executes registered preprocessor and returns its result", async () => {
    registerPreprocessor("bossZhipinSystemPrompt", async () => ({
      systemPromptSuffix: "\n\n[test memory]",
    }));

    const result = await runPreprocessor(
      makeCtx({ promptType: "bossZhipinSystemPrompt" })
    );
    expect(result.systemPromptSuffix).toBe("\n\n[test memory]");
  });

  it("passes context to the preprocessor function", async () => {
    let receivedCtx: PreprocessorContext | null = null;

    registerPreprocessor("bossZhipinLocalSystemPrompt", async (ctx) => {
      receivedCtx = ctx;
      return { systemPromptSuffix: "" };
    });

    const ctx = makeCtx({
      promptType: "bossZhipinLocalSystemPrompt",
      userId: "u1",
      sessionId: "s1",
    });

    await runPreprocessor(ctx);

    expect(receivedCtx).not.toBeNull();
    expect(receivedCtx!.userId).toBe("u1");
    expect(receivedCtx!.sessionId).toBe("s1");
    expect(receivedCtx!.correlationId).toBe("test-123");
  });
});
