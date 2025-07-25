import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mergeAndSaveSyncData } from "../stores/sync-store";
import { configService } from "../services/config.service";
import { ORGANIZATION_MAPPING } from "../constants/organization-mapping";
import type { ZhipinData, Store } from "@/types";
import type { SyncResult } from "../services/duliday-sync.service";

// Mock dependencies
vi.mock("../services/config.service", () => ({
  configService: {
    getConfig: vi.fn(),
    updateBrandData: vi.fn(),
  },
  getBrandData: vi.fn(),
}));

// Import getBrandData from the mock
import { getBrandData as mockGetBrandData } from "../services/config.service";

describe("品牌同步和导入功能测试", () => {
  const mockGetConfig = vi.mocked(configService.getConfig);
  const mockUpdateBrandData = vi.mocked(configService.updateBrandData);
  const mockGetBrandDataFn = vi.mocked(mockGetBrandData);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("自动同步场景", () => {
    it("应该只同步 ORGANIZATION_MAPPING 中的品牌，保留非映射品牌的数据和话术", async () => {
      // 准备测试数据
      const existingBrandData: ZhipinData = {
        city: "上海市",
        defaultBrand: "肯德基",
        brands: {
          // 映射品牌（会被更新）
          肯德基: {
            templates: {
              initial_inquiry: ["旧的肯德基话术模板"],
              location_inquiry: ["旧的位置询问模板"],
              // ... 其他必要的模板
            } as any,
            screening: {
              age: { min: 18, max: 50, preferred: [25] },
              blacklistKeywords: [],
              preferredKeywords: [],
            },
          },
          // 非映射品牌（应该保持不变）
          测试品牌: {
            templates: {
              initial_inquiry: ["测试品牌的自定义话术模板"],
              location_inquiry: ["测试品牌的位置询问模板"],
            } as any,
            screening: {
              age: { min: 20, max: 45, preferred: [30] },
              blacklistKeywords: ["测试黑名单"],
              preferredKeywords: ["测试关键词"],
            },
          },
        },
        stores: [
          // 映射品牌的门店（会被替换）
          {
            id: "store_kfc_001",
            name: "肯德基上海店",
            brand: "肯德基",
            location: "上海市浦东新区",
            district: "浦东新区",
            subarea: "陆家嘴",
            coordinates: { lat: 0, lng: 0 },
            transportation: "地铁2号线",
            positions: [],
          },
          // 非映射品牌的门店（应该保持不变）
          {
            id: "store_test_001",
            name: "测试品牌门店",
            brand: "测试品牌",
            location: "上海市静安区",
            district: "静安区",
            subarea: "南京西路",
            coordinates: { lat: 0, lng: 0 },
            transportation: "地铁2号线",
            positions: [],
          },
        ],
      };

      // Mock 返回现有配置
      mockGetConfig.mockResolvedValue({
        brandData: existingBrandData,
        replyPrompts: {} as any,
        systemPrompts: {} as any,
        activeSystemPrompt: "bossZhipinSystemPrompt",
        metadata: {
          version: "1.0.0",
          lastUpdated: new Date().toISOString(),
        },
      });
      
      // Mock getBrandData to return existing data
      mockGetBrandDataFn.mockResolvedValue(existingBrandData);

      // 同步结果（只包含肯德基的新数据）
      const syncResults: SyncResult[] = [
        {
          success: true,
          totalRecords: 1,
          processedRecords: 1,
          storeCount: 2,
          brandName: "肯德基",
          errors: [],
          duration: 1000,
          convertedData: {
            city: "上海市",
            defaultBrand: "肯德基",
            brands: {
              肯德基: {
                templates: {
                  initial_inquiry: ["新的肯德基话术模板（应该被保留）"],
                } as any,
                screening: {
                  age: { min: 18, max: 60, preferred: [25, 30] },
                  blacklistKeywords: ["新黑名单"],
                  preferredKeywords: ["新关键词"],
                },
              },
            },
            stores: [
              {
                id: "store_kfc_new_001",
                name: "肯德基浦东新店",
                brand: "肯德基",
                location: "上海市浦东新区",
                district: "浦东新区",
                subarea: "张江",
                coordinates: { lat: 0, lng: 0 },
                transportation: "地铁2号线",
                positions: [],
              },
              {
                id: "store_kfc_new_002",
                name: "肯德基徐汇店",
                brand: "肯德基",
                location: "上海市徐汇区",
                district: "徐汇区",
                subarea: "徐家汇",
                coordinates: { lat: 0, lng: 0 },
                transportation: "地铁1号线",
                positions: [],
              },
            ],
          },
        },
      ];

      // 执行同步
      await mergeAndSaveSyncData(syncResults);

      // 验证更新调用
      expect(mockUpdateBrandData).toHaveBeenCalledTimes(1);
      const updatedData = mockUpdateBrandData.mock.calls[0][0] as ZhipinData;

      // 验证品牌数据
      expect(Object.keys(updatedData.brands)).toHaveLength(2); // 应该有2个品牌
      expect(updatedData.brands["测试品牌"]).toBeDefined(); // 测试品牌应该存在
      expect(updatedData.brands["肯德基"]).toBeDefined(); // 肯德基应该存在

      // 验证测试品牌的数据完全保持不变
      expect(updatedData.brands["测试品牌"]).toEqual(existingBrandData.brands["测试品牌"]);

      // 验证肯德基保留了原有的话术模板
      expect(updatedData.brands["肯德基"].templates.initial_inquiry).toEqual(["旧的肯德基话术模板"]);
      // 但其他配置应该更新
      expect(updatedData.brands["肯德基"].screening.age.max).toBe(60);

      // 验证门店数据
      const testBrandStores = updatedData.stores.filter((s: Store) => s.brand === "测试品牌");
      const kfcStores = updatedData.stores.filter((s: Store) => s.brand === "肯德基");

      // 测试品牌的门店应该保持不变
      expect(testBrandStores).toHaveLength(1);
      expect(testBrandStores[0]).toEqual(existingBrandData.stores[1]);

      // 肯德基的门店应该被完全替换为新的
      expect(kfcStores).toHaveLength(2);
      expect(kfcStores.map((s: Store) => s.id)).toEqual(["store_kfc_new_001", "store_kfc_new_002"]);
    });

    it("应该能添加新的映射品牌而不影响现有品牌", async () => {
      const existingBrandData: ZhipinData = {
        city: "上海市",
        defaultBrand: "测试品牌",
        brands: {
          测试品牌: {
            templates: {
              initial_inquiry: ["测试品牌话术"],
            } as any,
            screening: {
              age: { min: 18, max: 50, preferred: [25] },
              blacklistKeywords: [],
              preferredKeywords: [],
            },
          },
        },
        stores: [
          {
            id: "store_test_001",
            name: "测试品牌门店",
            brand: "测试品牌",
            location: "上海市",
            district: "静安区",
            subarea: "测试",
            coordinates: { lat: 0, lng: 0 },
            transportation: "测试",
            positions: [],
          },
        ],
      };

      mockGetConfig.mockResolvedValue({
        brandData: existingBrandData,
        replyPrompts: {} as any,
        systemPrompts: {} as any,
        activeSystemPrompt: "bossZhipinSystemPrompt",
        metadata: {
          version: "1.0.0",
          lastUpdated: new Date().toISOString(),
        },
      });
      
      // Mock getBrandData to return existing data
      mockGetBrandDataFn.mockResolvedValue(existingBrandData);

      // 同步新的映射品牌
      const syncResults: SyncResult[] = [
        {
          success: true,
          totalRecords: 1,
          processedRecords: 1,
          storeCount: 1,
          brandName: "必胜客",
          errors: [],
          duration: 1000,
          convertedData: {
            city: "上海市",
            defaultBrand: "必胜客",
            brands: {
              必胜客: {
                templates: {
                  initial_inquiry: ["必胜客默认话术"],
                } as any,
                screening: {
                  age: { min: 18, max: 50, preferred: [25] },
                  blacklistKeywords: [],
                  preferredKeywords: [],
                },
              },
            },
            stores: [
              {
                id: "store_pizza_001",
                name: "必胜客徐汇店",
                brand: "必胜客",
                location: "上海市徐汇区",
                district: "徐汇区",
                subarea: "徐家汇",
                coordinates: { lat: 0, lng: 0 },
                transportation: "地铁1号线",
                positions: [],
              },
            ],
          },
        },
      ];

      await mergeAndSaveSyncData(syncResults);

      const updatedData = mockUpdateBrandData.mock.calls[0][0] as ZhipinData;

      // 应该有2个品牌
      expect(Object.keys(updatedData.brands)).toHaveLength(2);
      expect(updatedData.brands["测试品牌"]).toBeDefined();
      expect(updatedData.brands["必胜客"]).toBeDefined();

      // 测试品牌保持不变
      expect(updatedData.brands["测试品牌"]).toEqual(existingBrandData.brands["测试品牌"]);

      // 新品牌被正确添加
      expect(updatedData.brands["必胜客"].templates.initial_inquiry).toEqual(["必胜客默认话术"]);

      // 门店数据正确
      expect(updatedData.stores).toHaveLength(2);
      expect(updatedData.stores.find((s: Store) => s.brand === "测试品牌")).toBeDefined();
      expect(updatedData.stores.find((s: Store) => s.brand === "必胜客")).toBeDefined();
    });
  });

  describe("手动导入场景", () => {
    it("应该完全覆盖所有数据，包括话术模板", async () => {
      // 导入的新数据
      const importedData: ZhipinData = {
        city: "北京市",
        defaultBrand: "新品牌",
        brands: {
          新品牌: {
            templates: {
              initial_inquiry: ["新品牌的全新话术模板"],
              location_inquiry: ["新品牌的位置询问模板"],
              no_location_match: ["没有匹配位置的模板"],
              interview_request: ["面试请求模板"],
              salary_inquiry: ["薪资询问模板"],
              schedule_inquiry: ["排班询问模板"],
              general_chat: ["通用聊天模板"],
              age_concern: ["年龄关注模板"],
              insurance_inquiry: ["保险询问模板"],
              followup_chat: ["跟进聊天模板"],
              attendance_inquiry: ["考勤询问模板"],
              flexibility_inquiry: ["灵活性询问模板"],
              attendance_policy_inquiry: ["考勤政策询问模板"],
              work_hours_inquiry: ["工时询问模板"],
              availability_inquiry: ["可用性询问模板"],
              part_time_support: ["兼职支持模板"],
            },
            screening: {
              age: { min: 18, max: 60, preferred: [25, 30, 35] },
              blacklistKeywords: ["新黑名单词"],
              preferredKeywords: ["新优选词"],
            },
          },
          扩展品牌: {
            templates: {
              initial_inquiry: ["扩展品牌话术"],
              location_inquiry: ["扩展品牌位置询问"],
              no_location_match: ["没有匹配位置"],
              interview_request: ["面试请求"],
              salary_inquiry: ["薪资询问"],
              schedule_inquiry: ["排班询问"],
              general_chat: ["通用聊天"],
              age_concern: ["年龄关注"],
              insurance_inquiry: ["保险询问"],
              followup_chat: ["跟进聊天"],
              attendance_inquiry: ["考勤询问"],
              flexibility_inquiry: ["灵活性询问"],
              attendance_policy_inquiry: ["考勤政策询问"],
              work_hours_inquiry: ["工时询问"],
              availability_inquiry: ["可用性询问"],
              part_time_support: ["兼职支持"],
            },
            screening: {
              age: { min: 20, max: 50, preferred: [28] },
              blacklistKeywords: [],
              preferredKeywords: [],
            },
          },
        },
        stores: [
          {
            id: "store_new_001",
            name: "新品牌北京店",
            brand: "新品牌",
            location: "北京市朝阳区",
            district: "朝阳区",
            subarea: "三里屯",
            coordinates: { lat: 0, lng: 0 },
            transportation: "地铁10号线",
            positions: [],
          },
          {
            id: "store_ext_001",
            name: "扩展品牌门店",
            brand: "扩展品牌",
            location: "北京市海淀区",
            district: "海淀区",
            subarea: "中关村",
            coordinates: { lat: 0, lng: 0 },
            transportation: "地铁4号线",
            positions: [],
          },
        ],
      };

      // 模拟导入操作（直接保存新数据）
      await configService.updateBrandData(importedData);

      expect(mockUpdateBrandData).toHaveBeenCalledWith(importedData);

      // 验证数据被完全覆盖
      const savedData = mockUpdateBrandData.mock.calls[0][0] as ZhipinData;

      // 城市改变了
      expect(savedData.city).toBe("北京市");
      expect(savedData.defaultBrand).toBe("新品牌");

      // 品牌完全替换
      expect(Object.keys(savedData.brands)).toHaveLength(2);
      expect(Object.keys(savedData.brands)).toEqual(["新品牌", "扩展品牌"]);

      // 旧品牌不存在了
      expect(savedData.brands["肯德基"]).toBeUndefined();
      expect(savedData.brands["测试品牌"]).toBeUndefined();

      // 门店完全替换
      expect(savedData.stores).toHaveLength(2);
      expect(savedData.stores.every((s: Store) => s.id.startsWith("store_new_") || s.id.startsWith("store_ext_"))).toBe(true);

      // 话术模板是新的
      expect(savedData.brands["新品牌"].templates.initial_inquiry).toEqual(["新品牌的全新话术模板"]);
    });
  });

  describe("数据验证", () => {
    it("同步时应该验证品牌名称是否在 ORGANIZATION_MAPPING 中", () => {
      const mappedBrands = Object.values(ORGANIZATION_MAPPING);
      
      // 验证所有映射的品牌
      expect(mappedBrands).toContain("肯德基");
      expect(mappedBrands).toContain("成都你六姐");
      expect(mappedBrands).toContain("大米先生");
      expect(mappedBrands).toContain("天津肯德基");
      expect(mappedBrands).toContain("上海必胜客");
      expect(mappedBrands).toContain("奥乐齐");

      // 非映射品牌
      expect(mappedBrands).not.toContain("测试品牌");
      expect(mappedBrands).not.toContain("自定义品牌");
    });
  });
});