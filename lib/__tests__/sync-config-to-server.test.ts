import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { syncConfigToServer } from "../stores/sync-store";
import { configService } from "../services/config.service";
import { toast } from "sonner";
import type { AppConfig } from "@/types/config";
import type { ReplyContext } from "@/types/zhipin";

// Mock dependencies
vi.mock("../services/config.service", () => ({
  configService: {
    getConfig: vi.fn(),
    updateBrandData: vi.fn(),
  },
  getBrandData: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    warning: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Helper functions to create valid test data
const createValidTemplates = (): Record<ReplyContext, string[]> => ({
  initial_inquiry: ["测试话术"],
  location_inquiry: [],
  no_location_match: [],
  schedule_inquiry: [],
  interview_request: [],
  general_chat: [],
  salary_inquiry: [],
  age_concern: [],
  insurance_inquiry: [],
  followup_chat: [],
  attendance_inquiry: [],
  flexibility_inquiry: [],
  attendance_policy_inquiry: [],
  work_hours_inquiry: [],
  availability_inquiry: [],
  part_time_support: [],
});

const createValidReplyPrompts = (): Record<ReplyContext, string> => ({
  initial_inquiry: "测试指令",
  location_inquiry: "",
  no_location_match: "",
  schedule_inquiry: "",
  interview_request: "",
  general_chat: "",
  salary_inquiry: "",
  age_concern: "",
  insurance_inquiry: "",
  followup_chat: "",
  attendance_inquiry: "",
  flexibility_inquiry: "",
  attendance_policy_inquiry: "",
  work_hours_inquiry: "",
  availability_inquiry: "",
  part_time_support: "",
});

describe("syncConfigToServer 功能测试", () => {
  const mockGetConfig = vi.mocked(configService.getConfig);
  const mockToastError = vi.mocked(toast.error);
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock global fetch
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("成功场景", () => {
    it("应该成功将配置同步到服务器", async () => {
      const mockConfig: AppConfig = {
        brandData: {
          city: "上海市",
          defaultBrand: "肯德基",
          brands: {
            肯德基: {
              templates: createValidTemplates(),
              screening: {
                age: { min: 18, max: 50, preferred: [25] },
                blacklistKeywords: [],
                preferredKeywords: [],
              },
            },
          },
          stores: [],
        },
        replyPrompts: createValidReplyPrompts(),
        systemPrompts: {} as any,
        activeSystemPrompt: "bossZhipinSystemPrompt",
        brandPriorityStrategy: "smart",
        metadata: {
          version: "1.0.0",
          lastUpdated: new Date().toISOString(),
        },
      };

      mockGetConfig.mockResolvedValue(mockConfig);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await syncConfigToServer();

      // 验证 fetch 被正确调用
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith("/api/internal/config/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          brandData: mockConfig.brandData,
          replyPrompts: mockConfig.replyPrompts,
          metadata: mockConfig.metadata,
        }),
      });

      // 验证没有触发错误提示
      expect(mockToastError).not.toHaveBeenCalled();
    });
  });

  describe("早期返回场景", () => {
    it("当 latestConfig 为 null 时应该早期返回，不调用 fetch", async () => {
      mockGetConfig.mockResolvedValue(null);

      await syncConfigToServer();

      // 验证 fetch 没有被调用
      expect(mockFetch).not.toHaveBeenCalled();
      // 验证没有触发错误提示
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it("当 latestConfig 为 undefined 时应该早期返回", async () => {
      mockGetConfig.mockResolvedValue(undefined as any);

      await syncConfigToServer();

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockToastError).not.toHaveBeenCalled();
    });
  });

  describe("网络错误场景", () => {
    it("当 fetch 抛出网络错误时应该捕获并显示 toast 警告", async () => {
      const mockConfig: AppConfig = {
        brandData: {
          city: "上海市",
          defaultBrand: "肯德基",
          brands: {},
          stores: [],
        },
        replyPrompts: createValidReplyPrompts(),
        systemPrompts: {} as any,
        activeSystemPrompt: "bossZhipinSystemPrompt",
        brandPriorityStrategy: "smart",
        metadata: {
          version: "1.0.0",
          lastUpdated: new Date().toISOString(),
        },
      };

      mockGetConfig.mockResolvedValue(mockConfig);
      mockFetch.mockRejectedValue(new Error("Network error"));

      await syncConfigToServer();

      // 验证 fetch 被调用
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // 验证触发了错误提示
      expect(mockToastError).toHaveBeenCalledTimes(1);
      expect(mockToastError).toHaveBeenCalledWith("Network error");
    });

    it("当 fetch 因超时失败时应该正确处理", async () => {
      const mockConfig: AppConfig = {
        brandData: {
          city: "上海市",
          defaultBrand: "肯德基",
          brands: {},
          stores: [],
        },
        replyPrompts: createValidReplyPrompts(),
        systemPrompts: {} as any,
        activeSystemPrompt: "bossZhipinSystemPrompt",
        brandPriorityStrategy: "smart",
        metadata: {
          version: "1.0.0",
          lastUpdated: new Date().toISOString(),
        },
      };

      mockGetConfig.mockResolvedValue(mockConfig);
      mockFetch.mockRejectedValue(new Error("Request timeout"));

      await syncConfigToServer();

      expect(mockToastError).toHaveBeenCalledTimes(1);
      expect(mockToastError).toHaveBeenCalledWith("Request timeout");
    });
  });

  describe("HTTP 错误响应场景", () => {
    it("当响应状态为 500 时应该抛出错误并显示 toast", async () => {
      const mockConfig: AppConfig = {
        brandData: {
          city: "上海市",
          defaultBrand: "肯德基",
          brands: {},
          stores: [],
        },
        replyPrompts: createValidReplyPrompts(),
        systemPrompts: {} as any,
        activeSystemPrompt: "bossZhipinSystemPrompt",
        brandPriorityStrategy: "smart",
        metadata: {
          version: "1.0.0",
          lastUpdated: new Date().toISOString(),
        },
      };

      mockGetConfig.mockResolvedValue(mockConfig);
      mockFetch.mockResolvedValue({
        ok: false,
        text: async () => "Internal Server Error",
      });

      await syncConfigToServer();

      expect(mockToastError).toHaveBeenCalledTimes(1);
      expect(mockToastError).toHaveBeenCalledWith("Internal Server Error");
    });

    it("当响应状态为 422 (Unprocessable Entity) 时应该正确处理", async () => {
      const mockConfig: AppConfig = {
        brandData: {
          city: "上海市",
          defaultBrand: "肯德基",
          brands: {},
          stores: [],
        },
        replyPrompts: createValidReplyPrompts(),
        systemPrompts: {} as any,
        activeSystemPrompt: "bossZhipinSystemPrompt",
        brandPriorityStrategy: "smart",
        metadata: {
          version: "1.0.0",
          lastUpdated: new Date().toISOString(),
        },
      };

      mockGetConfig.mockResolvedValue(mockConfig);
      mockFetch.mockResolvedValue({
        ok: false,
        text: async () => "配置数据格式不符合要求",
      });

      await syncConfigToServer();

      expect(mockToastError).toHaveBeenCalledTimes(1);
    });

    it("当响应无错误消息时应该使用默认错误信息", async () => {
      const mockConfig: AppConfig = {
        brandData: {
          city: "上海市",
          defaultBrand: "肯德基",
          brands: {},
          stores: [],
        },
        replyPrompts: createValidReplyPrompts(),
        systemPrompts: {} as any,
        activeSystemPrompt: "bossZhipinSystemPrompt",
        brandPriorityStrategy: "smart",
        metadata: {
          version: "1.0.0",
          lastUpdated: new Date().toISOString(),
        },
      };

      mockGetConfig.mockResolvedValue(mockConfig);
      mockFetch.mockResolvedValue({
        ok: false,
        text: async () => "",
      });

      await syncConfigToServer();

      expect(mockToastError).toHaveBeenCalledTimes(1);
    });
  });

  describe("数据完整性验证", () => {
    it("应该只同步必要的配置字段（brandData, replyPrompts, metadata）", async () => {
      const mockConfig: AppConfig = {
        brandData: {
          city: "上海市",
          defaultBrand: "肯德基",
          brands: {
            肯德基: {
              templates: createValidTemplates(),
              screening: {
                age: { min: 18, max: 50, preferred: [25] },
                blacklistKeywords: [],
                preferredKeywords: [],
              },
            },
          },
          stores: [],
        },
        replyPrompts: createValidReplyPrompts(),
        systemPrompts: {
          系统提示: "不应该被同步",
        } as any,
        activeSystemPrompt: "bossZhipinSystemPrompt",
        brandPriorityStrategy: "smart",
        metadata: {
          version: "1.0.0",
          lastUpdated: "2025-01-01T00:00:00.000Z",
        },
      };

      mockGetConfig.mockResolvedValue(mockConfig);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await syncConfigToServer();

      // 验证 payload 只包含指定字段
      const fetchCall = mockFetch.mock.calls[0];
      const payload = JSON.parse(fetchCall[1].body);

      expect(payload).toHaveProperty("brandData");
      expect(payload).toHaveProperty("replyPrompts");
      expect(payload).toHaveProperty("metadata");
      expect(payload).not.toHaveProperty("systemPrompts");
      expect(payload).not.toHaveProperty("activeSystemPrompt");
      expect(payload).not.toHaveProperty("brandPriorityStrategy");
    });

    it("应该正确序列化复杂的品牌数据结构", async () => {
      const mockConfig: AppConfig = {
        brandData: {
          city: "上海市",
          defaultBrand: "肯德基",
          brands: {
            肯德基: {
              templates: createValidTemplates(),
              screening: {
                age: { min: 18, max: 60, preferred: [25, 30, 35] },
                blacklistKeywords: ["关键词1", "关键词2"],
                preferredKeywords: ["优选词1"],
              },
            },
            必胜客: {
              templates: createValidTemplates(),
              screening: {
                age: { min: 20, max: 50, preferred: [28] },
                blacklistKeywords: [],
                preferredKeywords: [],
              },
            },
          },
          stores: [
            {
              id: "store_001",
              name: "肯德基浦东店",
              brand: "肯德基",
              location: "上海市浦东新区",
              district: "浦东新区",
              subarea: "陆家嘴",
              coordinates: { lat: 31.23, lng: 121.5 },
              transportation: "地铁2号线",
              positions: [],
            },
          ],
        },
        replyPrompts: createValidReplyPrompts(),
        systemPrompts: {} as any,
        activeSystemPrompt: "bossZhipinSystemPrompt",
        brandPriorityStrategy: "smart",
        metadata: {
          version: "1.0.0",
          lastUpdated: "2025-01-01T00:00:00.000Z",
        },
      };

      mockGetConfig.mockResolvedValue(mockConfig);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await syncConfigToServer();

      const fetchCall = mockFetch.mock.calls[0];
      const payload = JSON.parse(fetchCall[1].body);

      // 验证数据结构完整性
      expect(payload.brandData.brands).toHaveProperty("肯德基");
      expect(payload.brandData.brands).toHaveProperty("必胜客");
      expect(payload.brandData.stores).toHaveLength(1);
      expect(payload.brandData.stores[0].coordinates).toEqual({ lat: 31.23, lng: 121.5 });
    });
  });

  describe("并发安全性", () => {
    it("应该能处理并发调用而不会产生竞态条件", async () => {
      const mockConfig: AppConfig = {
        brandData: {
          city: "上海市",
          defaultBrand: "肯德基",
          brands: {},
          stores: [],
        },
        replyPrompts: createValidReplyPrompts(),
        systemPrompts: {} as any,
        activeSystemPrompt: "bossZhipinSystemPrompt",
        brandPriorityStrategy: "smart",
        metadata: {
          version: "1.0.0",
          lastUpdated: new Date().toISOString(),
        },
      };

      mockGetConfig.mockResolvedValue(mockConfig);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      // 并发调用
      await Promise.all([syncConfigToServer(), syncConfigToServer(), syncConfigToServer()]);

      // 验证每次调用都成功执行
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockToastError).not.toHaveBeenCalled();
    });
  });

  describe("边界条件", () => {
    it("应该能处理空品牌数据", async () => {
      const mockConfig: AppConfig = {
        brandData: {
          city: "",
          defaultBrand: "",
          brands: {},
          stores: [],
        },
        replyPrompts: createValidReplyPrompts(),
        systemPrompts: {} as any,
        activeSystemPrompt: "bossZhipinSystemPrompt",
        brandPriorityStrategy: "smart",
        metadata: {
          version: "1.0.0",
          lastUpdated: new Date().toISOString(),
        },
      };

      mockGetConfig.mockResolvedValue(mockConfig);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await syncConfigToServer();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it("应该能处理大量品牌和门店数据", async () => {
      const largeBrands: Record<string, any> = {};
      const largeStores: any[] = [];

      // 生成 50 个品牌和 500 个门店
      for (let i = 0; i < 50; i++) {
        largeBrands[`品牌${i}`] = {
          templates: createValidTemplates(),
          screening: {
            age: { min: 18, max: 50, preferred: [25] },
            blacklistKeywords: [],
            preferredKeywords: [],
          },
        };
      }

      for (let i = 0; i < 500; i++) {
        largeStores.push({
          id: `store_${i}`,
          name: `门店${i}`,
          brand: `品牌${i % 50}`,
          location: "上海市浦东新区",
          district: "浦东新区",
          subarea: "陆家嘴",
          coordinates: { lat: 0, lng: 0 },
          transportation: "地铁2号线",
          positions: [],
        });
      }

      const mockConfig: AppConfig = {
        brandData: {
          city: "上海市",
          defaultBrand: "品牌0",
          brands: largeBrands,
          stores: largeStores,
        },
        replyPrompts: createValidReplyPrompts(),
        systemPrompts: {} as any,
        activeSystemPrompt: "bossZhipinSystemPrompt",
        brandPriorityStrategy: "smart",
        metadata: {
          version: "1.0.0",
          lastUpdated: new Date().toISOString(),
        },
      };

      mockGetConfig.mockResolvedValue(mockConfig);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await syncConfigToServer();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchCall = mockFetch.mock.calls[0];
      const payload = JSON.parse(fetchCall[1].body);

      expect(Object.keys(payload.brandData.brands)).toHaveLength(50);
      expect(payload.brandData.stores).toHaveLength(500);
    });
  });
});
