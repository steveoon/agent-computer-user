/**
 * fact-extraction 单元测试
 *
 * 覆盖：
 * - 无历史缓存（全量 50 条消息窗口）
 * - 有历史缓存（增量 10 条消息窗口 + 合并）
 * - LLM 失败降级（fallback 写入）
 * - 合并行为：数组去重累积、标量新值覆盖、null 保留旧值
 * - 品牌数据获取失败不阻塞提取
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UIMessage } from "ai";
import type { EntityExtractionResult } from "@/lib/tools/wework/types";

// ========== Mock 依赖 ==========

const mockSafeGenerateObject = vi.fn();

vi.mock("@/lib/ai", () => ({
  safeGenerateObject: mockSafeGenerateObject,
}));

vi.mock("@/lib/model-registry/dynamic-registry", () => ({
  getDynamicRegistry: vi.fn(() => ({
    languageModel: vi.fn(() => "mock-model"),
  })),
}));

vi.mock("@/lib/config/models", () => ({
  DEFAULT_PROVIDER_CONFIGS: {},
}));

// Mock fetch for brand data API
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ========== 导入被测模块 ==========

const { extractAndSaveFacts } = await import("../fact-extraction");
const { WeworkSessionMemory } = await import("../session-memory");

// ========== 辅助函数 ==========

function makeMessages(count: number, role: "user" | "assistant" = "user"): UIMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i}`,
    role,
    parts: [{ type: "text" as const, text: `消息${i}` }],
  }));
}

function makeFacts(overrides: Partial<{
  name: string | null;
  phone: string | null;
  brands: string[] | null;
  city: string | null;
  labor_form: string | null;
}>): EntityExtractionResult {
  return {
    interview_info: {
      name: overrides.name ?? null,
      phone: overrides.phone ?? null,
      gender: null,
      age: null,
      applied_store: null,
      applied_position: null,
      interview_time: null,
      is_student: null,
      education: null,
      has_health_certificate: null,
    },
    preferences: {
      brands: overrides.brands ?? null,
      salary: null,
      position: null,
      schedule: null,
      city: overrides.city ?? null,
      district: null,
      location: null,
      labor_form: overrides.labor_form ?? null,
    },
    reasoning: "test",
  };
}

// ========== 测试套件 ==========

describe("extractAndSaveFacts", () => {
  let memory: InstanceType<typeof WeworkSessionMemory>;
  let testId = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    testId++;
    memory = new WeworkSessionMemory(`test-extract-${testId}`, `session-${testId}`);

    // 默认品牌 API 返回空（不阻塞测试）
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ([]),
    });
  });

  describe("无历史缓存（首次提取）", () => {
    it("应返回 LLM 提取结果并写入缓存", async () => {
      const extracted = makeFacts({ name: "张三", city: "上海" });
      mockSafeGenerateObject.mockResolvedValue({ success: true, data: extracted });

      const messages = makeMessages(5);
      await extractAndSaveFacts(memory, messages);

      const saved = await memory.getFacts();
      expect(saved).not.toBeNull();
      expect(saved!.interview_info.name).toBe("张三");
      expect(saved!.preferences.city).toBe("上海");
    });

    it("LLM 失败时应写入 fallback（全 null 值）", async () => {
      mockSafeGenerateObject.mockResolvedValue({ success: false, error: "LLM error" });

      await extractAndSaveFacts(memory, makeMessages(3));

      const saved = await memory.getFacts();
      expect(saved).not.toBeNull();
      expect(saved!.interview_info.name).toBeNull();
      expect(saved!.preferences.brands).toBeNull();
      expect(saved!.reasoning).toBe("实体提取失败，使用空值降级");
    });
  });

  describe("有历史缓存（增量提取 + 合并）", () => {
    it("应与历史 facts 合并：标量新值覆盖旧值", async () => {
      // 预设历史缓存
      await memory.saveFacts(makeFacts({ name: "老王", city: "北京" }));

      // LLM 返回新值
      const newFacts = makeFacts({ name: "老王更新", city: "上海" });
      mockSafeGenerateObject.mockResolvedValue({ success: true, data: newFacts });

      await extractAndSaveFacts(memory, makeMessages(5));

      const saved = await memory.getFacts();
      expect(saved!.interview_info.name).toBe("老王更新");
      expect(saved!.preferences.city).toBe("上海");
    });

    it("应与历史 facts 合并：数组累积去重", async () => {
      await memory.saveFacts(makeFacts({ brands: ["肯德基", "麦当劳"] }));

      const newFacts = makeFacts({ brands: ["麦当劳", "海底捞"] });
      mockSafeGenerateObject.mockResolvedValue({ success: true, data: newFacts });

      await extractAndSaveFacts(memory, makeMessages(3));

      const saved = await memory.getFacts();
      expect(saved!.preferences.brands).toEqual(
        expect.arrayContaining(["肯德基", "麦当劳", "海底捞"])
      );
      expect(saved!.preferences.brands).toHaveLength(3);
    });

    it("null 新值应保留旧值（不覆盖）", async () => {
      await memory.saveFacts(makeFacts({ name: "保留旧值", city: "深圳" }));

      // LLM 返回 null（表示本轮未提取到）
      const newFacts = makeFacts({ name: null, city: null, labor_form: "兼职" });
      mockSafeGenerateObject.mockResolvedValue({ success: true, data: newFacts });

      await extractAndSaveFacts(memory, makeMessages(3));

      const saved = await memory.getFacts();
      expect(saved!.interview_info.name).toBe("保留旧值");
      expect(saved!.preferences.city).toBe("深圳");
      expect(saved!.preferences.labor_form).toBe("兼职");
    });
  });

  describe("消息窗口策略", () => {
    it("无缓存时应传入完整消息（上限 50 条历史）", async () => {
      mockSafeGenerateObject.mockResolvedValue({ success: true, data: makeFacts({}) });

      // 60 条消息 = 59 条历史 + 1 条当前
      const messages = makeMessages(60);
      await extractAndSaveFacts(memory, messages);

      // 验证 safeGenerateObject 被调用，且 prompt 包含裁剪后的消息
      expect(mockSafeGenerateObject).toHaveBeenCalledTimes(1);
      const call = mockSafeGenerateObject.mock.calls[0][0];
      // 全量模式下应包含最后 50 条历史消息的内容
      // 消息 59 条历史中取后 50 条 = 消息9..消息58
      expect(call.prompt).toContain("消息9");
      expect(call.prompt).not.toContain("消息8");
    });

    it("有缓存时应仅传入最近消息（上限 10 条历史）", async () => {
      await memory.saveFacts(makeFacts({ name: "已有" }));
      mockSafeGenerateObject.mockResolvedValue({ success: true, data: makeFacts({}) });

      const messages = makeMessages(30);
      await extractAndSaveFacts(memory, messages);

      const call = mockSafeGenerateObject.mock.calls[0][0];
      // 增量模式下应包含最后 10 条历史消息
      // 29 条历史中取后 10 条 = 消息19..消息28
      expect(call.prompt).toContain("消息19");
      expect(call.prompt).not.toContain("消息18");
    });
  });

  describe("品牌数据获取", () => {
    it("品牌 API 失败时应继续提取（不阻塞）", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));
      mockSafeGenerateObject.mockResolvedValue({
        success: true,
        data: makeFacts({ name: "张三" }),
      });

      await extractAndSaveFacts(memory, makeMessages(3));

      const saved = await memory.getFacts();
      expect(saved!.interview_info.name).toBe("张三");
    });
  });

  describe("空消息处理", () => {
    it("空消息数组不应崩溃", async () => {
      mockSafeGenerateObject.mockResolvedValue({ success: true, data: makeFacts({}) });

      await extractAndSaveFacts(memory, []);

      expect(mockSafeGenerateObject).toHaveBeenCalledTimes(1);
    });
  });
});
