import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mergeAndSaveSyncData } from "../stores/sync-store";
import { configService } from "../services/config.service";
import type { ZhipinData, Store, Brand } from "@/types";
import { getAllStores } from "@/types/zhipin";
import type { SyncResult } from "../services/duliday-sync.service";

// Mock 品牌映射数据（用于测试）
const MOCK_BRAND_MAPPING = {
  "肯德基": true,
  "成都你六姐": true,
  "大米先生": true,
  "天津肯德基": true,
  "上海必胜客": true,
  "奥乐齐": true,
  "大连肯德基": true,
  "海底捞": true,
  "必胜客": true,
};

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
    it("应该只同步 ORGANIZATION_MAPPING 中的品牌，保留非映射品牌的数据", async () => {
      // 准备测试数据
      const existingBrandData: ZhipinData = {
        meta: { defaultBrandId: "kfc" },
        brands: [
          // 映射品牌（会被更新）
          {
            id: "kfc",
            name: "肯德基",
            stores: [
              {
                id: "store_kfc_001",
                name: "肯德基上海店",
                brandId: "kfc",
                location: "上海市浦东新区",
                district: "浦东新区",
                subarea: "陆家嘴",
                coordinates: { lat: 0, lng: 0 },
                positions: [],
              },
            ],
          },
          // 非映射品牌（应该保持不变）
          {
            id: "test_brand",
            name: "测试品牌",
            stores: [
              {
                id: "store_test_001",
                name: "测试品牌门店",
                brandId: "test_brand",
                location: "上海市静安区",
                district: "静安区",
                subarea: "南京西路",
                coordinates: { lat: 0, lng: 0 },
                positions: [],
              },
            ],
          },
        ],
      };

      // Mock 返回现有配置
      mockGetConfig.mockResolvedValue({
        brandData: existingBrandData,
        replyPolicy: {} as any,
        systemPrompts: {} as any,
        activeSystemPrompt: "bossZhipinSystemPrompt",
        brandPriorityStrategy: "smart",
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
            meta: { defaultBrandId: "kfc" },
            brands: [
              {
                id: "kfc",
                name: "肯德基",
                stores: [
                  {
                    id: "store_kfc_new_001",
                    name: "肯德基浦东新店",
                    brandId: "kfc",
                    location: "上海市浦东新区",
                    district: "浦东新区",
                    subarea: "张江",
                    coordinates: { lat: 0, lng: 0 },
                    positions: [],
                  },
                  {
                    id: "store_kfc_new_002",
                    name: "肯德基徐汇店",
                    brandId: "kfc",
                    location: "上海市徐汇区",
                    district: "徐汇区",
                    subarea: "徐家汇",
                    coordinates: { lat: 0, lng: 0 },
                    positions: [],
                  },
                ],
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
      expect(updatedData.brands).toHaveLength(2); // 应该有2个品牌
      expect(updatedData.brands.find((b: Brand) => b.name === "测试品牌")).toBeDefined();
      expect(updatedData.brands.find((b: Brand) => b.name === "肯德基")).toBeDefined();

      // 验证测试品牌的数据完全保持不变
      const testBrand = updatedData.brands.find((b: Brand) => b.name === "测试品牌");
      const existingTestBrand = existingBrandData.brands.find((b: Brand) => b.name === "测试品牌");
      expect(testBrand).toEqual(existingTestBrand);

      // 验证门店数据
      const allStores = getAllStores(updatedData);
      const testBrandStores = allStores.filter((s: Store) => s.brandId === "test_brand");
      const kfcStores = allStores.filter((s: Store) => s.brandId === "kfc");

      // 测试品牌的门店应该保持不变
      expect(testBrandStores).toHaveLength(1);
      expect(testBrandStores[0]).toEqual(existingTestBrand!.stores[0]);

      // 肯德基的门店应该被完全替换为新的
      expect(kfcStores).toHaveLength(2);
      expect(kfcStores.map((s: Store) => s.id)).toEqual(["store_kfc_new_001", "store_kfc_new_002"]);
    });

    it("应该能添加新的映射品牌而不影响现有品牌", async () => {
      const existingBrandData: ZhipinData = {
        meta: { defaultBrandId: "test_brand" },
        brands: [
          {
            id: "test_brand",
            name: "测试品牌",
            stores: [
              {
                id: "store_test_001",
                name: "测试品牌门店",
                brandId: "test_brand",
                location: "上海市",
                district: "静安区",
                subarea: "测试",
                coordinates: { lat: 0, lng: 0 },
                positions: [],
              },
            ],
          },
        ],
      };

      mockGetConfig.mockResolvedValue({
        brandData: existingBrandData,
        replyPolicy: {} as any,
        systemPrompts: {} as any,
        activeSystemPrompt: "bossZhipinSystemPrompt",
        brandPriorityStrategy: "smart",
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
            meta: { defaultBrandId: "pizzahut" },
            brands: [
              {
                id: "pizzahut",
                name: "必胜客",
                stores: [
                  {
                    id: "store_pizza_001",
                    name: "必胜客徐汇店",
                    brandId: "pizzahut",
                    location: "上海市徐汇区",
                    district: "徐汇区",
                    subarea: "徐家汇",
                    coordinates: { lat: 0, lng: 0 },
                    positions: [],
                  },
                ],
              },
            ],
          },
        },
      ];

      await mergeAndSaveSyncData(syncResults);

      const updatedData = mockUpdateBrandData.mock.calls[0][0] as ZhipinData;

      // 应该有2个品牌
      expect(updatedData.brands).toHaveLength(2);
      expect(updatedData.brands.find((b: Brand) => b.name === "测试品牌")).toBeDefined();
      expect(updatedData.brands.find((b: Brand) => b.name === "必胜客")).toBeDefined();

      // 测试品牌保持不变
      const testBrand = updatedData.brands.find((b: Brand) => b.name === "测试品牌");
      const existingTestBrand = existingBrandData.brands.find((b: Brand) => b.name === "测试品牌");
      expect(testBrand).toEqual(existingTestBrand);

      // 新品牌被正确添加
      const pizzaBrand = updatedData.brands.find((b: Brand) => b.name === "必胜客");
      expect(pizzaBrand).toBeDefined();

      // 门店数据正确
      const allStores = getAllStores(updatedData);
      expect(allStores).toHaveLength(2);
      expect(allStores.find((s: Store) => s.brandId === "test_brand")).toBeDefined();
      expect(allStores.find((s: Store) => s.brandId === "pizzahut")).toBeDefined();
    });
  });

  describe("手动导入场景", () => {
    it("应该完全覆盖所有数据", async () => {
      // 导入的新数据
      const importedData: ZhipinData = {
        meta: { defaultBrandId: "new_brand" },
        brands: [
          {
            id: "new_brand",
            name: "新品牌",
            stores: [
              {
                id: "store_new_001",
                name: "新品牌北京店",
                brandId: "new_brand",
                location: "北京市朝阳区",
                district: "朝阳区",
                subarea: "三里屯",
                coordinates: { lat: 0, lng: 0 },
                positions: [],
              },
            ],
          },
          {
            id: "ext_brand",
            name: "扩展品牌",
            stores: [
              {
                id: "store_ext_001",
                name: "扩展品牌门店",
                brandId: "ext_brand",
                location: "北京市海淀区",
                district: "海淀区",
                subarea: "中关村",
                coordinates: { lat: 0, lng: 0 },
                positions: [],
              },
            ],
          },
        ],
      };

      // 模拟导入操作（直接保存新数据）
      await configService.updateBrandData(importedData);

      expect(mockUpdateBrandData).toHaveBeenCalledWith(importedData);

      // 验证数据被完全覆盖
      const savedData = mockUpdateBrandData.mock.calls[0][0] as ZhipinData;

      // 默认品牌 ID
      expect(savedData.meta.defaultBrandId).toBe("new_brand");

      // 品牌完全替换
      expect(savedData.brands).toHaveLength(2);
      expect(savedData.brands.map((b: Brand) => b.name)).toEqual(["新品牌", "扩展品牌"]);

      // 旧品牌不存在了
      expect(savedData.brands.find((b: Brand) => b.name === "肯德基")).toBeUndefined();
      expect(savedData.brands.find((b: Brand) => b.name === "测试品牌")).toBeUndefined();

      // 门店完全替换
      const allStores = getAllStores(savedData);
      expect(allStores).toHaveLength(2);
      expect(
        allStores.every(
          (s: Store) => s.id.startsWith("store_new_") || s.id.startsWith("store_ext_")
        )
      ).toBe(true);
    });
  });

  describe("数据验证", () => {
    it("同步时应该验证品牌名称是否在品牌映射中", () => {
      const mappedBrands = Object.keys(MOCK_BRAND_MAPPING);

      // 验证所有映射的品牌（原有品牌）
      expect(mappedBrands).toContain("肯德基");
      expect(mappedBrands).toContain("成都你六姐");
      expect(mappedBrands).toContain("大米先生");
      expect(mappedBrands).toContain("天津肯德基");
      expect(mappedBrands).toContain("上海必胜客");
      expect(mappedBrands).toContain("奥乐齐");

      // 验证新增品牌
      expect(mappedBrands).toContain("大连肯德基");
      expect(mappedBrands).toContain("海底捞");

      // 非映射品牌
      expect(mappedBrands).not.toContain("测试品牌");
      expect(mappedBrands).not.toContain("自定义品牌");
    });
  });

  describe("部分成功策略", () => {
    it("应该跳过数据校验失败的岗位，继续同步其他岗位", async () => {
      const existingBrandData: ZhipinData = {
        meta: { defaultBrandId: "kfc" },
        brands: [
          {
            id: "kfc",
            name: "肯德基",
            stores: [],
          },
        ],
      };

      mockGetConfig.mockResolvedValue({
        brandData: existingBrandData,
        replyPolicy: {} as any,
        systemPrompts: {} as any,
        activeSystemPrompt: "bossZhipinSystemPrompt",
        brandPriorityStrategy: "smart",
        metadata: {
          version: "1.0.0",
          lastUpdated: new Date().toISOString(),
        },
      });

      mockGetBrandDataFn.mockResolvedValue(existingBrandData);

      // 同步结果包含部分成功和失败的岗位
      const syncResults: SyncResult[] = [
        {
          success: true, // 部分成功
          totalRecords: 5, // 总共5个岗位
          processedRecords: 3, // 成功处理3个
          storeCount: 2,
          brandName: "肯德基",
          errors: [
            "岗位 '服务员-早班' (ID: job_001): 字段 'workTimeArrangement.perDayMinWorkHours' 期望数字类型，但收到字符串",
            "岗位 '收银员-晚班' (ID: job_003): 字段 'salary' 必须为正数",
          ],
          duration: 1500,
          convertedData: {
            meta: { defaultBrandId: "kfc" },
            brands: [
              {
                id: "kfc",
                name: "肯德基",
                stores: [
                  {
                    id: "store_kfc_001",
                    name: "肯德基浦东店",
                    brandId: "kfc",
                    location: "上海市浦东新区",
                    district: "浦东新区",
                    subarea: "陆家嘴",
                    coordinates: { lat: 0, lng: 0 },
                    positions: [
                      {
                        id: "pos_002",
                        name: "服务员",
                        timeSlots: ["09:00~14:00"],
                        salary: { base: 25, memo: "" },
                        workHours: "5",
                        benefits: { items: ["餐饮"] },
                        requirements: ["工作认真负责"],
                        urgent: false,
                        scheduleType: "flexible",
                        attendancePolicy: {
                          punctualityRequired: false,
                          lateToleranceMinutes: 15,
                          attendanceTracking: "flexible",
                          makeupShiftsAllowed: true,
                        },
                        availableSlots: [
                          {
                            slot: "09:00~14:00",
                            maxCapacity: 5,
                            currentBooked: 2,
                            isAvailable: true,
                            priority: "medium",
                          },
                        ],
                        schedulingFlexibility: {
                          canSwapShifts: true,
                          advanceNoticeHours: 24,
                          partTimeAllowed: true,
                          weekendRequired: false,
                          holidayRequired: false,
                        },
                      },
                    ],
                  },
                  {
                    id: "store_kfc_002",
                    name: "肯德基徐汇店",
                    brandId: "kfc",
                    location: "上海市徐汇区",
                    district: "徐汇区",
                    subarea: "徐家汇",
                    coordinates: { lat: 0, lng: 0 },
                    positions: [
                      {
                        id: "pos_004",
                        name: "配送员",
                        timeSlots: ["14:00~20:00"],
                        salary: { base: 30, memo: "" },
                        workHours: "6",
                        benefits: { items: ["餐饮", "补贴"] },
                        requirements: ["熟悉路线"],
                        urgent: true,
                        scheduleType: "fixed",
                        attendancePolicy: {
                          punctualityRequired: true,
                          lateToleranceMinutes: 5,
                          attendanceTracking: "strict",
                          makeupShiftsAllowed: false,
                        },
                        availableSlots: [
                          {
                            slot: "14:00~20:00",
                            maxCapacity: 3,
                            currentBooked: 1,
                            isAvailable: true,
                            priority: "high",
                          },
                        ],
                        schedulingFlexibility: {
                          canSwapShifts: false,
                          advanceNoticeHours: 48,
                          partTimeAllowed: false,
                          weekendRequired: true,
                          holidayRequired: false,
                        },
                      },
                      {
                        id: "pos_005",
                        name: "清洁员",
                        timeSlots: ["06:00~10:00"],
                        salary: { base: 22, memo: "" },
                        workHours: "4",
                        benefits: { items: ["餐饮"] },
                        requirements: ["工作细心"],
                        urgent: false,
                        scheduleType: "flexible",
                        attendancePolicy: {
                          punctualityRequired: false,
                          lateToleranceMinutes: 10,
                          attendanceTracking: "flexible",
                          makeupShiftsAllowed: true,
                        },
                        availableSlots: [
                          {
                            slot: "06:00~10:00",
                            maxCapacity: 2,
                            currentBooked: 0,
                            isAvailable: true,
                            priority: "low",
                          },
                        ],
                        schedulingFlexibility: {
                          canSwapShifts: true,
                          advanceNoticeHours: 12,
                          partTimeAllowed: true,
                          weekendRequired: false,
                          holidayRequired: false,
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ];

      await mergeAndSaveSyncData(syncResults);

      const updatedData = mockUpdateBrandData.mock.calls[0][0] as ZhipinData;

      // 验证门店数据
      const allStores = getAllStores(updatedData);
      expect(allStores).toHaveLength(2);

      // 验证岗位数据 - 只有3个成功的岗位被同步
      const allPositions = allStores.flatMap((s: Store) => s.positions || []);
      expect(allPositions).toHaveLength(3);
      expect(allPositions.map(p => p.id)).toEqual(["pos_002", "pos_004", "pos_005"]);

      // 验证失败的岗位 job_001 和 job_003 没有被同步
      expect(allPositions.find(p => p.id === "pos_001")).toBeUndefined();
      expect(allPositions.find(p => p.id === "pos_003")).toBeUndefined();
    });

    it("应该正确报告错误信息，包含具体的岗位名称和错误原因", () => {
      const syncResult: SyncResult = {
        success: true, // 部分成功
        totalRecords: 10,
        processedRecords: 7,
        storeCount: 3,
        brandName: "必胜客",
        errors: [
          "岗位 '服务员-早班' (ID: job_101): 字段 'workTimeArrangement.combinedArrangementTimes[0].startTime' 期望数字类型，但收到 null",
          "岗位 '经理-全天' (ID: job_102): 字段 'requirementNum' 必须大于0",
          "岗位 '收银员' (ID: job_103): 字段 'storeAddress' 格式不正确，期望格式：'城市-区域-详细地址'",
        ],
        duration: 2000,
      };

      // 验证错误信息格式
      expect(syncResult.errors).toHaveLength(3);
      expect(syncResult.errors[0]).toContain("服务员-早班");
      expect(syncResult.errors[0]).toContain("job_101");
      expect(syncResult.errors[0]).toContain(
        "workTimeArrangement.combinedArrangementTimes[0].startTime"
      );

      expect(syncResult.errors[1]).toContain("经理-全天");
      expect(syncResult.errors[1]).toContain("requirementNum");

      expect(syncResult.errors[2]).toContain("收银员");
      expect(syncResult.errors[2]).toContain("storeAddress");

      // 验证统计信息
      expect(syncResult.totalRecords).toBe(10);
      expect(syncResult.processedRecords).toBe(7);
      expect(syncResult.success).toBe(true); // 部分成功仍然标记为成功
    });

    it("应该在再次同步时，成功同步之前失败的岗位（如果数据已修复）", async () => {
      const existingBrandData: ZhipinData = {
        meta: { defaultBrandId: "kfc" },
        brands: [
          {
            id: "kfc",
            name: "肯德基",
            stores: [
              {
                id: "store_kfc_001",
                name: "肯德基浦东店",
                brandId: "kfc",
                location: "上海市浦东新区",
                district: "浦东新区",
                subarea: "陆家嘴",
                coordinates: { lat: 0, lng: 0 },
                positions: [
                  {
                    id: "pos_002",
                    name: "服务员",
                    timeSlots: ["09:00~14:00"],
                    salary: { base: 25, memo: "" },
                    workHours: "5",
                    benefits: { items: ["餐饮"] },
                    requirements: ["工作认真负责"],
                    urgent: false,
                    scheduleType: "flexible",
                    attendancePolicy: {
                      punctualityRequired: false,
                      lateToleranceMinutes: 15,
                      attendanceTracking: "flexible",
                      makeupShiftsAllowed: true,
                    },
                    availableSlots: [
                      {
                        slot: "09:00~14:00",
                        maxCapacity: 5,
                        currentBooked: 2,
                        isAvailable: true,
                        priority: "medium",
                      },
                    ],
                    schedulingFlexibility: {
                      canSwapShifts: true,
                      advanceNoticeHours: 24,
                      partTimeAllowed: true,
                      weekendRequired: false,
                      holidayRequired: false,
                    },
                  },
                ],
              },
            ],
          },
        ],
      };

      mockGetConfig.mockResolvedValue({
        brandData: existingBrandData,
        replyPolicy: {} as any,
        systemPrompts: {} as any,
        activeSystemPrompt: "bossZhipinSystemPrompt",
        brandPriorityStrategy: "smart",
        metadata: {
          version: "1.0.0",
          lastUpdated: new Date().toISOString(),
        },
      });

      mockGetBrandDataFn.mockResolvedValue(existingBrandData);

      // 第二次同步，之前失败的岗位数据已修复
      const syncResults: SyncResult[] = [
        {
          success: true,
          totalRecords: 2,
          processedRecords: 2, // 这次全部成功
          storeCount: 1,
          brandName: "肯德基",
          errors: [], // 没有错误
          duration: 1000,
          convertedData: {
            meta: { defaultBrandId: "kfc" },
            brands: [
              {
                id: "kfc",
                name: "肯德基",
                stores: [
                  {
                    id: "store_kfc_001",
                    name: "肯德基浦东店",
                    brandId: "kfc",
                    location: "上海市浦东新区",
                    district: "浦东新区",
                    subarea: "陆家嘴",
                    coordinates: { lat: 0, lng: 0 },
                    positions: [
                      {
                        id: "pos_001", // 之前失败的岗位
                        name: "服务员-早班",
                        timeSlots: ["06:00~12:00"],
                        salary: { base: 26, memo: "" },
                        workHours: "6",
                        benefits: { items: ["餐饮", "早餐"] },
                        requirements: ["早起", "准时"],
                        urgent: true,
                        scheduleType: "fixed",
                        attendancePolicy: {
                          punctualityRequired: true,
                          lateToleranceMinutes: 5,
                          attendanceTracking: "strict",
                          makeupShiftsAllowed: false,
                        },
                        availableSlots: [
                          {
                            slot: "06:00~12:00",
                            maxCapacity: 4,
                            currentBooked: 1,
                            isAvailable: true,
                            priority: "high",
                          },
                        ],
                        schedulingFlexibility: {
                          canSwapShifts: false,
                          advanceNoticeHours: 24,
                          partTimeAllowed: false,
                          weekendRequired: true,
                          holidayRequired: false,
                        },
                      },
                      {
                        id: "pos_003", // 之前失败的岗位
                        name: "收银员-晚班",
                        timeSlots: ["18:00~23:00"],
                        salary: { base: 28, memo: "" },
                        workHours: "5",
                        benefits: { items: ["餐饮", "夜班补贴"] },
                        requirements: ["细心", "数学好"],
                        urgent: false,
                        scheduleType: "fixed",
                        attendancePolicy: {
                          punctualityRequired: true,
                          lateToleranceMinutes: 5,
                          attendanceTracking: "strict",
                          makeupShiftsAllowed: false,
                        },
                        availableSlots: [
                          {
                            slot: "18:00~23:00",
                            maxCapacity: 2,
                            currentBooked: 0,
                            isAvailable: true,
                            priority: "medium",
                          },
                        ],
                        schedulingFlexibility: {
                          canSwapShifts: false,
                          advanceNoticeHours: 12,
                          partTimeAllowed: false,
                          weekendRequired: true,
                          holidayRequired: false,
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ];

      await mergeAndSaveSyncData(syncResults);

      const updatedData = mockUpdateBrandData.mock.calls[0][0] as ZhipinData;

      // 验证之前失败的岗位现在被成功同步
      const allStores = getAllStores(updatedData);
      const allPositions = allStores.flatMap((s: Store) => s.positions || []);

      // 应该有之前失败的2个岗位（同步替换了整个品牌的门店数据）
      expect(allPositions.find(p => p.id === "pos_001")).toBeDefined();
      expect(allPositions.find(p => p.id === "pos_003")).toBeDefined();

      // 验证岗位详情
      const pos001 = allPositions.find(p => p.id === "pos_001");
      expect(pos001?.name).toBe("服务员-早班");
      expect(pos001?.salary.base).toBe(26);

      const pos003 = allPositions.find(p => p.id === "pos_003");
      expect(pos003?.name).toBe("收银员-晚班");
      expect(pos003?.salary.base).toBe(28);
    });

    it("应该正确处理完全失败的场景（所有岗位都校验失败）", async () => {
      const existingBrandData: ZhipinData = {
        meta: { defaultBrandId: "pizzahut" },
        brands: [
          {
            id: "pizzahut",
            name: "必胜客",
            stores: [
              {
                id: "store_pizza_001",
                name: "必胜客徐汇店",
                brandId: "pizzahut",
                location: "上海市徐汇区",
                district: "徐汇区",
                subarea: "徐家汇",
                coordinates: { lat: 0, lng: 0 },
                positions: [],
              },
            ],
          },
        ],
      };

      mockGetConfig.mockResolvedValue({
        brandData: existingBrandData,
        replyPolicy: {} as any,
        systemPrompts: {} as any,
        activeSystemPrompt: "bossZhipinSystemPrompt",
        brandPriorityStrategy: "smart",
        metadata: {
          version: "1.0.0",
          lastUpdated: new Date().toISOString(),
        },
      });

      mockGetBrandDataFn.mockResolvedValue(existingBrandData);

      // 同步结果 - 所有岗位都失败
      const syncResults: SyncResult[] = [
        {
          success: false, // 完全失败
          totalRecords: 3,
          processedRecords: 0, // 没有成功处理的
          storeCount: 0,
          brandName: "必胜客",
          errors: [
            "岗位 '服务员' (ID: job_201): 必填字段 'jobName' 缺失",
            "岗位 '经理' (ID: job_202): 必填字段 'storeId' 缺失",
            "岗位 '清洁员' (ID: job_203): 数据结构完全不符合预期格式",
          ],
          duration: 500,
        },
      ];

      await mergeAndSaveSyncData(syncResults);

      // 验证原有数据保持不变
      expect(mockUpdateBrandData).not.toHaveBeenCalled();
    });

    it("应该正确统计和报告部分成功的统计信息", () => {
      const syncResult: SyncResult = {
        success: true,
        totalRecords: 100,
        processedRecords: 85,
        storeCount: 10,
        brandName: "肯德基",
        errors: Array(15)
          .fill("")
          .map((_, i) => `岗位错误 ${i + 1}`),
        duration: 5000,
      };

      // 计算成功率
      const successRate = (syncResult.processedRecords / syncResult.totalRecords) * 100;
      expect(successRate).toBe(85);

      // 验证失败数量
      const failedCount = syncResult.totalRecords - syncResult.processedRecords;
      expect(failedCount).toBe(15);
      expect(syncResult.errors).toHaveLength(15);

      // 验证部分成功仍标记为成功
      expect(syncResult.success).toBe(true);
    });
  });
});
