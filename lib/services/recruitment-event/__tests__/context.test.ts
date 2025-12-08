/**
 * Recruitment Context Manager Tests
 *
 * Tests for AsyncLocalStorage-based context management.
 */

import { describe, it, expect } from "vitest";
import { recruitmentContext } from "../context";
import type { RecruitmentContext } from "../types";

describe("RecruitmentContextManager", () => {
  const testContext: RecruitmentContext = {
    agentId: "zhipin-001",
    brandId: 123,
    sourcePlatform: "zhipin",
    apiSource: "web",
    jobId: 456,
    jobName: "服务员",
  };

  describe("run / getContext", () => {
    it("应该在 run 范围内获取到上下文", () => {
      recruitmentContext.run(testContext, () => {
        const ctx = recruitmentContext.getContext();
        expect(ctx).toEqual(testContext);
      });
    });

    it("在 run 范围外应返回 undefined", () => {
      const ctx = recruitmentContext.getContext();
      expect(ctx).toBeUndefined();
    });

    it("嵌套 run 应该覆盖外层上下文", () => {
      const outerContext: RecruitmentContext = {
        agentId: "outer",
        sourcePlatform: "zhipin",
        apiSource: "web",
      };
      const innerContext: RecruitmentContext = {
        agentId: "inner",
        sourcePlatform: "yupao",
        apiSource: "open_api",
      };

      recruitmentContext.run(outerContext, () => {
        expect(recruitmentContext.getContext()?.agentId).toBe("outer");

        recruitmentContext.run(innerContext, () => {
          expect(recruitmentContext.getContext()?.agentId).toBe("inner");
          expect(recruitmentContext.getContext()?.sourcePlatform).toBe("yupao");
        });

        // 退出内层后应恢复外层上下文
        expect(recruitmentContext.getContext()?.agentId).toBe("outer");
      });
    });
  });

  describe("runAsync", () => {
    it("应该在异步函数中保持上下文", async () => {
      await recruitmentContext.runAsync(testContext, async () => {
        // 模拟异步操作
        await new Promise((resolve) => setTimeout(resolve, 10));
        const ctx = recruitmentContext.getContext();
        expect(ctx?.agentId).toBe("zhipin-001");
      });
    });

    it("异步操作后应该仍能获取上下文", async () => {
      await recruitmentContext.runAsync(testContext, async () => {
        const ctx1 = recruitmentContext.getContext();
        expect(ctx1?.agentId).toBe("zhipin-001");

        await Promise.resolve();

        const ctx2 = recruitmentContext.getContext();
        expect(ctx2?.agentId).toBe("zhipin-001");
      });
    });
  });

  describe("requireContext", () => {
    it("在有上下文时应返回上下文", () => {
      recruitmentContext.run(testContext, () => {
        const ctx = recruitmentContext.requireContext();
        expect(ctx).toEqual(testContext);
      });
    });

    it("在没有上下文时应抛出错误", () => {
      expect(() => recruitmentContext.requireContext()).toThrow(
        "Context not initialized"
      );
    });
  });

  describe("hasContext", () => {
    it("在 run 范围内应返回 true", () => {
      recruitmentContext.run(testContext, () => {
        expect(recruitmentContext.hasContext()).toBe(true);
      });
    });

    it("在 run 范围外应返回 false", () => {
      expect(recruitmentContext.hasContext()).toBe(false);
    });
  });

  describe("并发隔离测试", () => {
    it("多个并发任务应该有独立的上下文", async () => {
      const results: string[] = [];

      const task1 = recruitmentContext.runAsync(
        { agentId: "task-1", sourcePlatform: "zhipin", apiSource: "web" },
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          results.push(recruitmentContext.getContext()?.agentId || "");
        }
      );

      const task2 = recruitmentContext.runAsync(
        { agentId: "task-2", sourcePlatform: "yupao", apiSource: "open_api" },
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          results.push(recruitmentContext.getContext()?.agentId || "");
        }
      );

      await Promise.all([task1, task2]);

      // task2 先完成，task1 后完成
      expect(results).toContain("task-1");
      expect(results).toContain("task-2");
    });
  });
});
