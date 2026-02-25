/**
 * 实体提取 Agent 单元测试
 *
 * 测试重点：
 * - 累积式提取（从整个对话历史中收集信息）
 * - 保留用户原话（除品牌外）
 * - 品牌映射（别名 → 正式名称）
 * - 与阶段无关（全面提取所有事实）
 * - 降级策略（LLM 失败时返回空对象）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  extractCandidateFacts,
  fetchBrandData,
  clearBrandDataCache,
} from "../wework-entity-extraction-agent";
import * as aiModule from "@/lib/ai";

// Mock safeGenerateObject
vi.mock("@/lib/ai", () => ({
  safeGenerateObject: vi.fn(),
}));

// Mock fetch for fetchBrandData
global.fetch = vi.fn();

describe("fetchBrandData", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // 重置环境变量
    process.env = { ...originalEnv };
    // 清除内存缓存，避免测试间干扰
    clearBrandDataCache();
  });

  afterEach(() => {
    // 恢复环境变量
    process.env = originalEnv;
    vi.clearAllMocks();
    clearBrandDataCache();
  });

  it("should fetch brand data successfully", async () => {
    // Mock 环境变量
    process.env.DULIDAY_TOKEN = "test-token";

    const mockBrandData = {
      brands: [
        { name: "肯德基", aliases: ["KFC", "开封菜"] },
        { name: "麦当劳", aliases: ["McDonald's", "金拱门"] },
      ],
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockBrandData,
    });

    const result = await fetchBrandData();

    expect(result).toEqual(mockBrandData.brands);
    // 验证使用了正确的 API 端点和方法
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/persistence/ai/api/brand/list"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Duliday-Token": "test-token",
        }),
      })
    );
  });

  it("should return empty array when fetch fails", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const result = await fetchBrandData();

    expect(result).toEqual([]);
  });

  it("should return empty array when data format is invalid", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ invalid: "data" }),
    });

    const result = await fetchBrandData();

    expect(result).toEqual([]);
  });
});

describe("extractCandidateFacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should extract all facts from conversation history", async () => {
    const mockResult = {
      interview_info: {
        age: "18",
        is_student: "是",
      },
      preferences: {
        brands: ["肯德基", "麦当劳"],
        district: "浦东",
        salary: "时薪20以上",
        schedule: "周末",
      },
      reasoning: "累积提取：年龄18、学生身份、品牌偏好肯德基/麦当劳、浦东区域、薪资预期、周末排班",
    };

    vi.spyOn(aiModule, "safeGenerateObject").mockResolvedValue({
      success: true,
      data: mockResult,
    });

    const result = await extractCandidateFacts("我是学生，周末可以上班", {
      conversationHistory: [
        "候选人: 我18岁，想找份兼职",
        "HR: 好的，您对哪个品牌感兴趣呢？",
        "候选人: 肯德基或者麦当劳都可以",
        "HR: 您方便在哪个区域工作呢？",
        "候选人: 浦东这边，时薪20以上",
      ],
      brandData: [
        { name: "肯德基", aliases: ["KFC", "开封菜"] },
        { name: "麦当劳", aliases: ["McDonald's", "金拱门"] },
      ],
    });

    // 应该累积提取所有历史信息
    expect(result.interview_info.age).toBe("18");
    expect(result.interview_info.is_student).toBe("是");
    expect(result.preferences.brands).toEqual(["肯德基", "麦当劳"]);
    expect(result.preferences.district).toBe("浦东");
    expect(result.preferences.salary).toContain("20");
    expect(result.preferences.schedule).toBe("周末");
  });

  it("should extract both interview_info and preferences when mentioned", async () => {
    const mockResult = {
      interview_info: {
        name: "张三",
        phone: "13800138000",
      },
      preferences: {
        brands: ["肯德基"],
      },
      reasoning: "候选人提供了姓名、电话，并表达了对肯德基的兴趣",
    };

    vi.spyOn(aiModule, "safeGenerateObject").mockResolvedValue({
      success: true,
      data: mockResult,
    });

    const result = await extractCandidateFacts("我叫张三，手机13800138000，想找肯德基的工作", {
      conversationHistory: [],
      brandData: [{ name: "肯德基", aliases: ["KFC"] }],
    });

    // 同时提取面试信息和意向信息
    expect(result.interview_info.name).toBe("张三");
    expect(result.interview_info.phone).toBe("13800138000");
    expect(result.preferences.brands).toContain("肯德基");
  });

  it("should return empty objects when extraction fails", async () => {
    vi.spyOn(aiModule, "safeGenerateObject").mockResolvedValue({
      success: false,
      error: new Error("LLM extraction failed") as any,
    });

    const result = await extractCandidateFacts("测试", {
      conversationHistory: [],
      brandData: [],
    });

    expect(result.interview_info).toEqual({});
    expect(result.preferences).toEqual({});
    expect(result.reasoning).toContain("失败");
  });

  it("should preserve user original words for age field", async () => {
    const mockResult = {
      interview_info: {
        age: "18岁", // 保留用户原话（字符串类型）
      },
      preferences: {},
      reasoning: "提取了年龄信息",
    };

    vi.spyOn(aiModule, "safeGenerateObject").mockResolvedValue({
      success: true,
      data: mockResult,
    });

    const result = await extractCandidateFacts("我18岁", {
      conversationHistory: [],
      brandData: [],
    });

    // 应该保留用户原话，不转换为数字
    expect(result.interview_info.age).toBe("18岁");
    expect(typeof result.interview_info.age).toBe("string");
  });

  it("should preserve brand aliases as original words", async () => {
    const mockResult = {
      interview_info: {},
      preferences: {
        brands: ["KFC"], // ✅ 保留用户原话，不做映射
      },
      reasoning: "识别品牌实体并保留原词",
    };

    vi.spyOn(aiModule, "safeGenerateObject").mockResolvedValue({
      success: true,
      data: mockResult,
    });

    const result = await extractCandidateFacts("想去KFC工作", {
      conversationHistory: [],
      brandData: [{ name: "肯德基", aliases: ["KFC", "开封菜"] }],
    });

    // ✅ 应该保留用户原话"KFC"，而不是映射为"肯德基"
    expect(result.preferences.brands).toContain("KFC");
    expect(result.preferences.brands).not.toContain("肯德基");
  });

  it("should extract multiple cities as array", async () => {
    const mockResult = {
      interview_info: {},
      preferences: {
        cities: ["上海", "杭州"],
      },
      reasoning: "候选人提及多个意向城市",
    };

    vi.spyOn(aiModule, "safeGenerateObject").mockResolvedValue({
      success: true,
      data: mockResult,
    });

    const result = await extractCandidateFacts("我想在上海或者杭州工作", {
      conversationHistory: [],
      brandData: [],
    });

    expect(result.preferences.cities).toEqual(["上海", "杭州"]);
    expect(Array.isArray(result.preferences.cities)).toBe(true);
  });

  // ========== 新增边界测试用例 ==========

  it("should handle unknown brand names gracefully", async () => {
    const mockResult = {
      interview_info: {},
      preferences: {
        brands: ["星巴克"], // 不在 brandData 中，应该保留原话
      },
      reasoning: "候选人提及未知品牌",
    };

    vi.spyOn(aiModule, "safeGenerateObject").mockResolvedValue({
      success: true,
      data: mockResult,
    });

    const result = await extractCandidateFacts("想去星巴克工作", {
      conversationHistory: [],
      brandData: [
        { name: "肯德基", aliases: ["KFC"] },
        { name: "麦当劳", aliases: ["McDonald's"] },
      ],
    });

    // 未知品牌应该保留原话（LLM不做映射）
    expect(result.preferences.brands).toContain("星巴克");
  });

  it("should accumulate facts across multiple conversation turns", async () => {
    const mockResult = {
      interview_info: {
        name: "张三",
        age: "25岁",
        phone: "13800138000",
      },
      preferences: {
        brands: ["肯德基"],
        salary: "时薪20以上",
      },
      reasoning: "累积提取：姓名（第1轮）、年龄（第2轮）、电话+品牌+薪资（第3轮）",
    };

    vi.spyOn(aiModule, "safeGenerateObject").mockResolvedValue({
      success: true,
      data: mockResult,
    });

    const result = await extractCandidateFacts("我叫张三，手机13800138000，想找肯德基时薪20以上的工作", {
      conversationHistory: [
        "候选人: 你好",
        "HR: 请问您多大了？",
        "候选人: 我25岁",
      ],
      brandData: [{ name: "肯德基", aliases: ["KFC"] }],
    });

    // 应该累积所有历史信息
    expect(result.interview_info.name).toBe("张三");
    expect(result.interview_info.age).toBe("25岁");
    expect(result.interview_info.phone).toBe("13800138000");
    expect(result.preferences.brands).toContain("肯德基");
    expect(result.preferences.salary).toContain("20");
  });

  it("should handle empty brandData array", async () => {
    const mockResult = {
      interview_info: {},
      preferences: {
        brands: ["KFC"], // 无品牌数据时保留原话
      },
      reasoning: "无品牌数据，保留原始输入",
    };

    vi.spyOn(aiModule, "safeGenerateObject").mockResolvedValue({
      success: true,
      data: mockResult,
    });

    const result = await extractCandidateFacts("想去KFC工作", {
      conversationHistory: [],
      brandData: [], // 空品牌数据
    });

    // 应该保留原始输入
    expect(result.preferences.brands).toContain("KFC");
  });

  it("should preserve mixed content (numbers + text) in salary field", async () => {
    const mockResult = {
      interview_info: {},
      preferences: {
        salary: "4000-5000元/月，包吃住",
      },
      reasoning: "保留薪资原始表述",
    };

    vi.spyOn(aiModule, "safeGenerateObject").mockResolvedValue({
      success: true,
      data: mockResult,
    });

    const result = await extractCandidateFacts("想找月薪4000-5000，包吃住的工作", {
      conversationHistory: [],
      brandData: [],
    });

    // 应该保留完整的原话，不做拆分
    expect(result.preferences.salary).toBe("4000-5000元/月，包吃住");
  });

  it("should handle concurrent extraction calls correctly", async () => {
    const mockResult1 = {
      interview_info: { name: "张三" },
      preferences: {},
      reasoning: "提取用户1信息",
    };

    const mockResult2 = {
      interview_info: { name: "李四" },
      preferences: {},
      reasoning: "提取用户2信息",
    };

    // Mock 返回不同结果
    vi.spyOn(aiModule, "safeGenerateObject")
      .mockResolvedValueOnce({ success: true, data: mockResult1 })
      .mockResolvedValueOnce({ success: true, data: mockResult2 });

    // 并发调用
    const [result1, result2] = await Promise.all([
      extractCandidateFacts("我叫张三", {
        conversationHistory: [],
        brandData: [],
      }),
      extractCandidateFacts("我叫李四", {
        conversationHistory: [],
        brandData: [],
      }),
    ]);

    // 应该正确区分不同调用的结果
    expect(result1.interview_info.name).toBe("张三");
    expect(result2.interview_info.name).toBe("李四");
  });
});
