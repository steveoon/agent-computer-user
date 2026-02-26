/**
 * fact-extraction-agent 单元测试
 *
 * 覆盖：
 * - 无缓存：直接返回 LLM 结果
 * - LLM 失败降级：返回 fallback
 * - 有缓存 cache miss：全量 50 条消息，写入缓存
 * - 有缓存 cache hit：增量 10 条消息，与历史合并
 * - deepMerge：数组去重累积、基本类型新值覆盖
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod/v3";

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

const mockLocalCache = {
  get: vi.fn<() => Promise<unknown>>().mockResolvedValue(null),
  setex: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
};

vi.mock("@/lib/services/local-cache.service", () => ({
  localCacheService: mockLocalCache,
}));

vi.mock("@/lib/config/models", () => ({
  DEFAULT_PROVIDER_CONFIGS: {},
  DEFAULT_MODEL_CONFIG: { classifyModel: "qwen-default" },
}));

// ========== 测试 Schema & 数据 ==========

const TestSchema = z.object({
  name: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
type TestFact = z.infer<typeof TestSchema>;

const FALLBACK: TestFact = { name: undefined, tags: [] };
const buildPrompt = (_msg: string, _hist: string[]) => "test prompt";

// ========== 导入被测模块（在 mock 之后）==========

const { extractFacts } = await import("../fact-extraction-agent");

// ========== 测试套件 ==========

describe("extractFacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalCache.get.mockResolvedValue(null);
    mockLocalCache.setex.mockResolvedValue(undefined);
  });

  describe("无缓存模式（不传 cache）", () => {
    it("应返回 LLM 提取结果", async () => {
      const extracted: TestFact = { name: "张三", tags: ["服务员"] };
      mockSafeGenerateObject.mockResolvedValue({ success: true, data: extracted });

      const result = await extractFacts("你好", [], {
        extractionSchemaOutput: TestSchema,
        schemaName: "Test",
        buildUserPrompt: buildPrompt,
        fallback: FALLBACK,
      });

      expect(result).toEqual(extracted);
      expect(mockLocalCache.get).not.toHaveBeenCalled();
      expect(mockLocalCache.setex).not.toHaveBeenCalled();
    });

    it("LLM 失败时应返回 fallback", async () => {
      mockSafeGenerateObject.mockResolvedValue({ success: false, error: "LLM error" });

      const result = await extractFacts("你好", [], {
        extractionSchemaOutput: TestSchema,
        schemaName: "Test",
        buildUserPrompt: buildPrompt,
        fallback: FALLBACK,
      });

      expect(result).toEqual(FALLBACK);
    });
  });

  describe("缓存模式（传 cache）", () => {
    const cacheOptions = { userId: "u1", sessionId: "s1" };

    it("cache miss：应处理全量 50 条消息，并写入缓存", async () => {
      mockLocalCache.get.mockResolvedValue(null); // cache miss
      const extracted: TestFact = { name: "李四", tags: ["收银"] };
      mockSafeGenerateObject.mockResolvedValue({ success: true, data: extracted });

      // 60 条消息，cache miss 时裁剪到最后 50 条
      const history = Array.from({ length: 60 }, (_, i) => `消息${i}`);
      let capturedPrompt = "";
      const capturePrompt = (_msg: string, hist: string[]) => {
        capturedPrompt = hist.join(",");
        return "prompt";
      };

      await extractFacts("新消息", history, {
        extractionSchemaOutput: TestSchema,
        schemaName: "Test",
        buildUserPrompt: capturePrompt,
        fallback: FALLBACK,
        cache: cacheOptions,
      });

      // 应传入最后 50 条
      const passedHistory = capturedPrompt.split(",");
      expect(passedHistory).toHaveLength(50);
      expect(passedHistory[0]).toBe("消息10");

      // 应写入缓存
      expect(mockLocalCache.setex).toHaveBeenCalledWith(
        "candidate_facts:u1:s1",
        expect.any(Number),
        extracted
      );
    });

    it("cache hit：应只处理最近 10 条消息，并与历史合并", async () => {
      const previousFacts: TestFact = { name: "老王", tags: ["服务员"] };
      mockLocalCache.get.mockResolvedValue(previousFacts); // cache hit

      const newFacts: TestFact = { tags: ["收银"] };
      mockSafeGenerateObject.mockResolvedValue({ success: true, data: newFacts });

      const history = Array.from({ length: 30 }, (_, i) => `消息${i}`);
      let passedHistoryLen = 0;
      const capturePrompt = (_msg: string, hist: string[]) => {
        passedHistoryLen = hist.length;
        return "prompt";
      };

      const result = await extractFacts<TestFact>("新消息", history, {
        extractionSchemaOutput: TestSchema,
        schemaName: "Test",
        buildUserPrompt: capturePrompt,
        fallback: FALLBACK,
        cache: cacheOptions,
      });

      // 增量模式：最近 10 条
      expect(passedHistoryLen).toBe(10);

      // 数组合并去重：服务员 + 收银
      expect(result.tags).toEqual(expect.arrayContaining(["服务员", "收银"]));
      expect(result.tags).toHaveLength(2);
    });

    it("合并后应写入缓存，TTL 使用默认 24h", async () => {
      mockLocalCache.get.mockResolvedValue({ name: "老王", tags: [] });
      mockSafeGenerateObject.mockResolvedValue({ success: true, data: { name: "老王更新", tags: ["打荷"] } });

      await extractFacts("消息", [], {
        extractionSchemaOutput: TestSchema,
        schemaName: "Test",
        buildUserPrompt: buildPrompt,
        fallback: FALLBACK,
        cache: cacheOptions,
      });

      expect(mockLocalCache.setex).toHaveBeenCalledWith(
        "candidate_facts:u1:s1",
        24 * 60 * 60,
        expect.objectContaining({ name: "老王更新" })
      );
    });

    it("应使用自定义 TTL 和消息窗口", async () => {
      mockLocalCache.get.mockResolvedValue({ name: "已有" });
      mockSafeGenerateObject.mockResolvedValue({ success: true, data: { name: "更新" } });

      const history = Array.from({ length: 100 }, (_, i) => `m${i}`);
      let passedLen = 0;
      const capturePrompt = (_msg: string, hist: string[]) => {
        passedLen = hist.length;
        return "prompt";
      };

      await extractFacts("msg", history, {
        extractionSchemaOutput: TestSchema,
        schemaName: "Test",
        buildUserPrompt: capturePrompt,
        fallback: FALLBACK,
        cache: { ...cacheOptions, ttl: 3600, incrementalMessages: 5, fullMessages: 20 },
      });

      expect(passedLen).toBe(5);
      expect(mockLocalCache.setex).toHaveBeenCalledWith(expect.any(String), 3600, expect.anything());
    });
  });

  describe("deepMerge 行为", () => {
    it("数组字段应累积去重", async () => {
      mockLocalCache.get.mockResolvedValue({ tags: ["A", "B"] });
      mockSafeGenerateObject.mockResolvedValue({ success: true, data: { tags: ["B", "C"] } });

      const result = await extractFacts<TestFact>("msg", [], {
        extractionSchemaOutput: TestSchema,
        schemaName: "Test",
        buildUserPrompt: buildPrompt,
        fallback: FALLBACK,
        cache: { userId: "u", sessionId: "s" },
      });

      expect(result.tags).toEqual(expect.arrayContaining(["A", "B", "C"]));
      expect(result.tags).toHaveLength(3);
    });

    it("基本类型新值非空时覆盖旧值", async () => {
      mockLocalCache.get.mockResolvedValue({ name: "旧名字" });
      mockSafeGenerateObject.mockResolvedValue({ success: true, data: { name: "新名字" } });

      const result = await extractFacts<TestFact>("msg", [], {
        extractionSchemaOutput: TestSchema,
        schemaName: "Test",
        buildUserPrompt: buildPrompt,
        fallback: FALLBACK,
        cache: { userId: "u", sessionId: "s" },
      });

      expect(result.name).toBe("新名字");
    });

    it("新值为 undefined 时保留旧值", async () => {
      mockLocalCache.get.mockResolvedValue({ name: "保留旧值" });
      mockSafeGenerateObject.mockResolvedValue({ success: true, data: { tags: ["新tag"] } });

      const result = await extractFacts<TestFact>("msg", [], {
        extractionSchemaOutput: TestSchema,
        schemaName: "Test",
        buildUserPrompt: buildPrompt,
        fallback: FALLBACK,
        cache: { userId: "u", sessionId: "s" },
      });

      expect(result.name).toBe("保留旧值");
    });
  });
});
