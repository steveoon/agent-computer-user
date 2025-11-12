import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import type { StoredConfigSync } from "@/lib/utils/config-sync-schema";
import type { ReplyContext } from "@/types/zhipin";
import { loadSyncedConfigSnapshot } from "@/lib/services/config-sync-repository";

vi.mock("@/lib/services/config-sync-repository", () => ({
  loadSyncedConfigSnapshot: vi.fn(),
}));

const mockLoadSyncedConfigSnapshot = vi.mocked(loadSyncedConfigSnapshot);

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

const validStoredConfig: StoredConfigSync = {
  synced: true,
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
  serverSyncedAt: "2025-01-01T12:00:00.000Z",
};

describe("/api/v1/config/export API 路由测试", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("成功场景", () => {
    it("应该成功返回已同步的配置数据", async () => {
      mockLoadSyncedConfigSnapshot.mockResolvedValueOnce(validStoredConfig);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(validStoredConfig);
    });

    it("应该能正确读取包含多个品牌与门店的配置", async () => {
      const multibrandConfig: StoredConfigSync = {
        ...validStoredConfig,
        brandData: {
          city: "上海市",
          defaultBrand: "肯德基",
          brands: {
            肯德基: validStoredConfig.brandData.brands["肯德基"],
            必胜客: {
              templates: createValidTemplates(),
              screening: {
                age: { min: 20, max: 50, preferred: [28] },
                blacklistKeywords: [],
                preferredKeywords: [],
              },
            },
            大米先生: {
              templates: createValidTemplates(),
              screening: {
                age: { min: 18, max: 55, preferred: [30] },
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
            {
              id: "store_002",
              name: "必胜客徐汇店",
              brand: "必胜客",
              location: "上海市徐汇区",
              district: "徐汇区",
              subarea: "徐家汇",
              coordinates: { lat: 31.19, lng: 121.43 },
              transportation: "地铁1号线",
              positions: [],
            },
          ],
        },
      };

      mockLoadSyncedConfigSnapshot.mockResolvedValueOnce(multibrandConfig);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Object.keys(data.data.brandData.brands)).toHaveLength(3);
      expect(data.data.brandData.stores).toHaveLength(2);
    });
  });

  describe("空数据与容错", () => {
    it("当没有同步数据时应该返回空配置", async () => {
      mockLoadSyncedConfigSnapshot.mockResolvedValueOnce(null);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.synced).toBe(false);
      expect(data.message).toBe("配置尚未通过前端同步");
    });

    it("当数据校验失败时应该返回空配置并提示损坏", async () => {
      mockLoadSyncedConfigSnapshot.mockResolvedValueOnce({
        ...validStoredConfig,
        brandData: {
          ...validStoredConfig.brandData,
          city: null as unknown as string,
        },
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.synced).toBe(false);
      expect(data.message).toContain("配置文件已损坏");
    });
  });

  describe("错误场景", () => {
    it("当存储层读取失败时应该返回 500", async () => {
      mockLoadSyncedConfigSnapshot.mockRejectedValueOnce(new Error("Supabase error"));

      const response = await GET();
      expect(response.status).toBe(500);
    });
  });
});
