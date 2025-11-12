import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";
import type { ConfigSyncPayload } from "@/lib/utils/config-sync-schema";
import type { ReplyContext } from "@/types/zhipin";
import { saveSyncedConfigSnapshot } from "@/lib/services/config-sync-repository";

vi.mock("@/lib/services/config-sync-repository", () => ({
  saveSyncedConfigSnapshot: vi.fn(),
}));

const mockSaveSyncedConfigSnapshot = vi.mocked(saveSyncedConfigSnapshot);

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

const createMockRequest = (body: ConfigSyncPayload): NextRequest =>
  ({
    json: async () => body,
  }) as unknown as NextRequest;

const validPayload: ConfigSyncPayload = {
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
  metadata: {
    version: "1.0.0",
    lastUpdated: "2025-01-01T00:00:00.000Z",
    migratedAt: "2025-01-01T00:00:00.000Z",
    upgradedAt: "2025-01-02T00:00:00.000Z",
    repairedAt: "2025-01-03T00:00:00.000Z",
  },
};

describe("/api/internal/config/sync API 路由测试", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("成功场景", () => {
    it("应该成功接收并存储配置数据", async () => {
      const response = await POST(createMockRequest(validPayload));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(
        expect.objectContaining({
          synced: true,
          serverSyncedAt: expect.any(String),
        })
      );
      expect(mockSaveSyncedConfigSnapshot).toHaveBeenCalledTimes(1);
    });

    it("保存数据时应自动补充 serverSyncedAt 时间戳", async () => {
      await POST(createMockRequest(validPayload));

      const savedPayload = mockSaveSyncedConfigSnapshot.mock.calls[0][0];
      expect(savedPayload.synced).toBe(true);
      expect(typeof savedPayload.serverSyncedAt).toBe("string");
      expect(() => new Date(savedPayload.serverSyncedAt!)).not.toThrow();
    });

    it("应该完整保存复杂品牌与门店数据", async () => {
      const complexPayload: ConfigSyncPayload = {
        ...validPayload,
        brandData: {
          city: "上海市",
          defaultBrand: "肯德基",
          brands: {
            肯德基: {
              templates: createValidTemplates(),
              screening: {
                age: { min: 18, max: 60, preferred: [25, 30, 35] },
                blacklistKeywords: ["黑名单1", "黑名单2"],
                preferredKeywords: ["优选词"],
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
      };

      await POST(createMockRequest(complexPayload));

      const savedPayload = mockSaveSyncedConfigSnapshot.mock.calls[0][0];
      expect(savedPayload.brandData.brands).toHaveProperty("肯德基");
      expect(savedPayload.brandData.brands).toHaveProperty("必胜客");
      expect(savedPayload.brandData.stores).toHaveLength(1);
      expect(savedPayload.brandData.stores?.[0].coordinates).toEqual({ lat: 31.23, lng: 121.5 });
    });
  });

  describe("边界条件", () => {
    it("应该能处理空品牌数据", async () => {
      const emptyPayload: ConfigSyncPayload = {
        ...validPayload,
        brandData: {
          city: "",
          defaultBrand: "",
          brands: {},
          stores: [],
        },
      };

      const response = await POST(createMockRequest(emptyPayload));
      expect(response.status).toBe(200);
      expect(mockSaveSyncedConfigSnapshot).toHaveBeenCalledTimes(1);
    });

    it("应该能处理大量品牌和门店数据", async () => {
      const largeBrands: Record<string, any> = {};
      const largeStores: any[] = [];

      for (let i = 0; i < 100; i++) {
        largeBrands[`品牌${i}`] = {
          templates: createValidTemplates(),
          screening: {
            age: { min: 18, max: 50, preferred: [25] },
            blacklistKeywords: [],
            preferredKeywords: [],
          },
        };
      }

      for (let i = 0; i < 1000; i++) {
        largeStores.push({
          id: `store_${i}`,
          name: `门店${i}`,
          brand: `品牌${i % 100}`,
          location: "上海市浦东新区",
          district: "浦东新区",
          subarea: "陆家嘴",
          coordinates: { lat: 0, lng: 0 },
          transportation: "地铁2号线",
          positions: [],
        });
      }

      const response = await POST(
        createMockRequest({
          ...validPayload,
          brandData: {
            city: "上海市",
            defaultBrand: "品牌0",
            brands: largeBrands,
            stores: largeStores,
          },
        })
      );

      expect(response.status).toBe(200);
      const savedPayload = mockSaveSyncedConfigSnapshot.mock.calls[0][0];
      expect(Object.keys(savedPayload.brandData.brands)).toHaveLength(100);
      expect(savedPayload.brandData.stores).toHaveLength(1000);
    });
  });

  describe("错误场景", () => {
    it("当 payload 无效时应该返回 422", async () => {
      const invalidRequest = {
        json: async () => ({ foo: "bar" }),
      } as NextRequest;

      const response = await POST(invalidRequest);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("UnprocessableEntity");
      expect(mockSaveSyncedConfigSnapshot).not.toHaveBeenCalled();
    });

    it("当保存失败时应该返回 500", async () => {
      mockSaveSyncedConfigSnapshot.mockRejectedValueOnce(new Error("Supabase error"));

      const response = await POST(createMockRequest(validPayload));
      expect(response.status).toBe(500);
    });
  });
});
