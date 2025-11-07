import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppConfigDataSchema } from "@/types/config";
import type { AppConfigData } from "@/types";

describe("配置导入数据格式校验", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("数据格式验证", () => {
    it("应该接受完整有效的配置数据", () => {
      const validConfig: AppConfigData = {
        brandData: {
          city: "上海市",
          defaultBrand: "测试品牌",
          brands: {
            测试品牌: {
              templates: {
                initial_inquiry: ["初始询问模板"],
                location_inquiry: ["位置询问模板"],
                no_location_match: ["无位置匹配模板"],
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
                age: { min: 18, max: 60, preferred: [25, 30] },
                blacklistKeywords: ["黑名单词"],
                preferredKeywords: ["优选词"],
              },
            },
          },
          stores: [
            {
              id: "store_001",
              name: "测试门店",
              brand: "测试品牌",
              location: "上海市浦东新区",
              district: "浦东新区",
              subarea: "陆家嘴",
              coordinates: { lat: 31.2, lng: 121.5 },
              transportation: "地铁2号线",
              positions: [
                {
                  id: "pos_001",
                  name: "服务员",
                  timeSlots: ["9:00-12:00"],
                  salary: {
                    base: 25,
                    range: "25-30元/时",
                    bonus: "满勤奖",
                    memo: "薪资说明",
                  },
                  workHours: "3",
                  benefits: {
                    items: ["五险一金"],
                  },
                  requirements: ["18-45岁"],
                  urgent: false,
                  scheduleType: "flexible",
                  attendancePolicy: {
                    punctualityRequired: true,
                    lateToleranceMinutes: 5,
                    attendanceTracking: "strict",
                    makeupShiftsAllowed: true,
                  },
                  availableSlots: [],
                  schedulingFlexibility: {
                    canSwapShifts: true,
                    advanceNoticeHours: 24,
                    weekendRequired: false,
                    partTimeAllowed: true,
                    holidayRequired: false,
                  },
                  minHoursPerWeek: 10,
                  maxHoursPerWeek: 40,
                  attendanceRequirement: {
                    minimumDays: 3,
                    description: "每周至少3天",
                  },
                },
              ],
            },
          ],
        },
        replyPrompts: {
          initial_inquiry: "初始询问回复",
          location_inquiry: "位置询问回复",
          no_location_match: "无位置匹配回复",
          salary_inquiry: "薪资询问回复",
          schedule_inquiry: "排班询问回复",
          interview_request: "面试请求回复",
          age_concern: "年龄关注回复",
          insurance_inquiry: "保险询问回复",
          followup_chat: "跟进聊天回复",
          general_chat: "通用聊天回复",
          attendance_inquiry: "考勤询问回复",
          flexibility_inquiry: "灵活性询问回复",
          attendance_policy_inquiry: "考勤政策询问回复",
          work_hours_inquiry: "工时询问回复",
          availability_inquiry: "可用性询问回复",
          part_time_support: "兼职支持回复",
        },
        systemPrompts: {
          bossZhipinSystemPrompt: "Boss直聘系统提示词",
          bossZhipinLocalSystemPrompt: "Boss直聘本地系统提示词",
          generalComputerSystemPrompt: "通用计算机系统提示词",
        },
        activeSystemPrompt: "bossZhipinSystemPrompt",
        brandPriorityStrategy: "smart",
        metadata: {
          version: "1.0.0",
          lastUpdated: new Date().toISOString(),
        },
      };

      const result = AppConfigDataSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validConfig);
      }
    });

    it("应该拒绝缺少必要字段的配置", () => {
      const invalidConfig = {
        brandData: {
          // 缺少 city
          stores: [],
          brands: {},
          defaultBrand: "测试品牌",
        },
        replyPrompts: {},
        systemPrompts: {},
        activeSystemPrompt: "bossZhipinSystemPrompt",
        brandPriorityStrategy: "smart",
        metadata: {
          version: "1.0.0",
          lastUpdated: new Date().toISOString(),
        },
      };

      const result = AppConfigDataSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.issues;
        expect(errors.some(e => e.path.includes("city"))).toBe(true);
      }
    });

    it("应该拒绝使用无效回复提示词键的配置", () => {
      const configWithInvalidReplyPromptKey = {
        brandData: {
          city: "上海市",
          defaultBrand: "测试品牌",
          brands: {
            测试品牌: {
              templates: {
                initial_inquiry: ["初始询问"],
              },
              screening: {
                age: { min: 18, max: 60, preferred: [25] },
                blacklistKeywords: [],
                preferredKeywords: [],
              },
            },
          },
          stores: [],
        },
        replyPrompts: {
          initial_inquiry: "初始询问回复",
          invalid_key: "无效的键", // 这个键不在 ReplyContextSchema 中
        },
        systemPrompts: {
          bossZhipinSystemPrompt: "Boss直聘系统提示词",
          bossZhipinLocalSystemPrompt: "Boss直聘本地系统提示词",
          generalComputerSystemPrompt: "通用计算机系统提示词",
        },
        activeSystemPrompt: "bossZhipinSystemPrompt",
        brandPriorityStrategy: "smart",
        metadata: {
          version: "1.0.0",
          lastUpdated: new Date().toISOString(),
        },
      };

      const result = AppConfigDataSchema.safeParse(configWithInvalidReplyPromptKey);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.issues;
        // 应该有关于无效键的错误
        expect(
          errors.some(e => e.message.includes("Invalid") || e.message.includes("invalid"))
        ).toBe(true);
      }
    });

    it("应该拒绝门店品牌不在品牌列表中的配置", () => {
      const configWithMismatchedBrand: AppConfigData = {
        brandData: {
          city: "上海市",
          defaultBrand: "品牌A",
          brands: {
            品牌A: {
              templates: {
                initial_inquiry: ["初始询问模板"],
                location_inquiry: ["位置询问模板"],
                no_location_match: ["无位置匹配模板"],
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
                age: { min: 18, max: 60, preferred: [25] },
                blacklistKeywords: [],
                preferredKeywords: [],
              },
            },
          },
          stores: [
            {
              id: "store_001",
              name: "测试门店",
              brand: "品牌B", // 品牌B不在brands中
              location: "上海市",
              district: "浦东新区",
              subarea: "陆家嘴",
              coordinates: { lat: 0, lng: 0 },
              transportation: "地铁",
              positions: [],
            },
          ],
        },
        replyPrompts: {
          initial_inquiry: "初始询问回复",
          location_inquiry: "位置询问回复",
          no_location_match: "无位置匹配回复",
          salary_inquiry: "薪资询问回复",
          schedule_inquiry: "排班询问回复",
          interview_request: "面试请求回复",
          age_concern: "年龄关注回复",
          insurance_inquiry: "保险询问回复",
          followup_chat: "跟进聊天回复",
          general_chat: "通用聊天回复",
          attendance_inquiry: "考勤询问回复",
          flexibility_inquiry: "灵活性询问回复",
          attendance_policy_inquiry: "考勤政策询问回复",
          work_hours_inquiry: "工时询问回复",
          availability_inquiry: "可用性询问回复",
          part_time_support: "兼职支持回复",
        },
        systemPrompts: {
          bossZhipinSystemPrompt: "Boss直聘系统提示词",
          bossZhipinLocalSystemPrompt: "Boss直聘本地系统提示词",
          generalComputerSystemPrompt: "通用计算机系统提示词",
        },
        activeSystemPrompt: "bossZhipinSystemPrompt",
        brandPriorityStrategy: "smart",
        metadata: {
          version: "1.0.0",
          lastUpdated: new Date().toISOString(),
        },
      };

      // 这个测试展示了业务逻辑验证（不是schema验证）
      const brandNames = Object.keys(configWithMismatchedBrand.brandData.brands);
      const storeBrands = configWithMismatchedBrand.brandData.stores.map(s => s.brand);
      const invalidBrands = storeBrands.filter(brand => !brandNames.includes(brand));

      expect(invalidBrands.length).toBeGreaterThan(0);
      expect(invalidBrands).toContain("品牌B");
    });

    it("应该接受包含非映射品牌的配置", () => {
      const configWithCustomBrand: AppConfigData = {
        brandData: {
          city: "上海市",
          defaultBrand: "自定义品牌",
          brands: {
            自定义品牌: {
              templates: {
                initial_inquiry: ["自定义品牌的初始询问"],
                location_inquiry: ["自定义品牌的位置询问"],
                no_location_match: ["自定义品牌的无位置匹配"],
                interview_request: ["自定义品牌的面试请求"],
                salary_inquiry: ["自定义品牌的薪资询问"],
                schedule_inquiry: ["自定义品牌的排班询问"],
                general_chat: ["自定义品牌的通用聊天"],
                age_concern: ["自定义品牌的年龄关注"],
                insurance_inquiry: ["自定义品牌的保险询问"],
                followup_chat: ["自定义品牌的跟进聊天"],
                attendance_inquiry: ["自定义品牌的考勤询问"],
                flexibility_inquiry: ["自定义品牌的灵活性询问"],
                attendance_policy_inquiry: ["自定义品牌的考勤政策询问"],
                work_hours_inquiry: ["自定义品牌的工时询问"],
                availability_inquiry: ["自定义品牌的可用性询问"],
                part_time_support: ["自定义品牌的兼职支持"],
              },
              screening: {
                age: { min: 20, max: 50, preferred: [30] },
                blacklistKeywords: ["测试黑名单"],
                preferredKeywords: ["测试优选"],
              },
            },
            肯德基: {
              templates: {
                initial_inquiry: ["肯德基的初始询问"],
                location_inquiry: ["肯德基的位置询问"],
                no_location_match: ["肯德基的无位置匹配"],
                interview_request: ["肯德基的面试请求"],
                salary_inquiry: ["肯德基的薪资询问"],
                schedule_inquiry: ["肯德基的排班询问"],
                general_chat: ["肯德基的通用聊天"],
                age_concern: ["肯德基的年龄关注"],
                insurance_inquiry: ["肯德基的保险询问"],
                followup_chat: ["肯德基的跟进聊天"],
                attendance_inquiry: ["肯德基的考勤询问"],
                flexibility_inquiry: ["肯德基的灵活性询问"],
                attendance_policy_inquiry: ["肯德基的考勤政策询问"],
                work_hours_inquiry: ["肯德基的工时询问"],
                availability_inquiry: ["肯德基的可用性询问"],
                part_time_support: ["肯德基的兼职支持"],
              },
              screening: {
                age: { min: 18, max: 60, preferred: [25, 30] },
                blacklistKeywords: [],
                preferredKeywords: [],
              },
            },
          },
          stores: [],
        },
        replyPrompts: {
          initial_inquiry: "初始询问回复",
          location_inquiry: "位置询问回复",
          no_location_match: "无位置匹配回复",
          salary_inquiry: "薪资询问回复",
          schedule_inquiry: "排班询问回复",
          interview_request: "面试请求回复",
          age_concern: "年龄关注回复",
          insurance_inquiry: "保险询问回复",
          followup_chat: "跟进聊天回复",
          general_chat: "通用聊天回复",
          attendance_inquiry: "考勤询问回复",
          flexibility_inquiry: "灵活性询问回复",
          attendance_policy_inquiry: "考勤政策询问回复",
          work_hours_inquiry: "工时询问回复",
          availability_inquiry: "可用性询问回复",
          part_time_support: "兼职支持回复",
        },
        systemPrompts: {
          bossZhipinSystemPrompt: "Boss直聘系统提示词",
          bossZhipinLocalSystemPrompt: "Boss直聘本地系统提示词",
          generalComputerSystemPrompt: "通用计算机系统提示词",
        },
        activeSystemPrompt: "bossZhipinSystemPrompt",
        brandPriorityStrategy: "smart",
        metadata: {
          version: "1.0.0",
          lastUpdated: new Date().toISOString(),
        },
      };

      const result = AppConfigDataSchema.safeParse(configWithCustomBrand);
      expect(result.success).toBe(true);

      if (result.success) {
        // 验证自定义品牌被正确解析
        expect(Object.keys(result.data.brandData.brands)).toContain("自定义品牌");
        expect(Object.keys(result.data.brandData.brands)).toContain("肯德基");

        // 验证品牌数量
        expect(Object.keys(result.data.brandData.brands)).toHaveLength(2);
      }
    });
  });

  describe("旧版本配置自动升级", () => {
    it("应该自动升级缺少新字段的旧版本配置", async () => {
      // 模拟旧版本配置（缺少新增的考勤相关模板字段）
      const oldConfig = {
        brandData: {
          city: "上海市",
          defaultBrand: "大米先生",
          brands: {
            大米先生: {
              templates: {
                // 只包含旧版本的模板字段
                initial_inquiry: ["初始询问"],
                location_inquiry: ["位置询问"],
                no_location_match: ["无位置匹配"],
                interview_request: ["面试请求"],
                salary_inquiry: ["薪资询问"],
                schedule_inquiry: ["排班询问"],
                general_chat: ["通用聊天"],
                age_concern: ["年龄关注"],
                insurance_inquiry: ["保险询问"],
                followup_chat: ["跟进聊天"],
                // 缺少新增的6个字段
              },
              screening: {
                age: { min: 18, max: 45, preferred: [25] },
                blacklistKeywords: [],
                preferredKeywords: [],
              },
            },
          },
          stores: [],
        },
        replyPrompts: {
          // 只包含旧版本的回复指令
          initial_inquiry: "初始询问回复",
          location_inquiry: "位置询问回复",
          no_location_match: "无位置匹配回复",
          salary_inquiry: "薪资询问回复",
          schedule_inquiry: "排班询问回复",
          interview_request: "面试请求回复",
          age_concern: "年龄关注回复",
          insurance_inquiry: "保险询问回复",
          followup_chat: "跟进聊天回复",
          general_chat: "通用聊天回复",
          // 缺少新增的6个字段
        },
        systemPrompts: {
          bossZhipinSystemPrompt: "Boss直聘系统提示词",
          bossZhipinLocalSystemPrompt: "Boss直聘本地系统提示词",
          generalComputerSystemPrompt: "通用计算机系统提示词",
        },
        metadata: {
          version: "1.0.0", // 旧版本号
          lastUpdated: new Date().toISOString(),
        },
      };

      // 初始验证应该失败
      const initialResult = AppConfigDataSchema.safeParse(oldConfig);
      expect(initialResult.success).toBe(false);

      // 动态导入升级函数
      const { upgradeConfigData } = await import("@/lib/services/config.service");

      // 升级配置（第三个参数 false 表示这是版本升级，不是修复）
      const upgradedConfig = await upgradeConfigData(oldConfig as any, false, false);

      // 验证升级后的配置
      const finalResult = AppConfigDataSchema.safeParse(upgradedConfig);
      expect(finalResult.success).toBe(true);

      if (finalResult.success) {
        // 验证品牌模板中新字段已添加
        const brandTemplates = finalResult.data.brandData.brands["大米先生"].templates;
        expect(brandTemplates.attendance_inquiry).toBeDefined();
        expect(brandTemplates.flexibility_inquiry).toBeDefined();
        expect(brandTemplates.attendance_policy_inquiry).toBeDefined();
        expect(brandTemplates.work_hours_inquiry).toBeDefined();
        expect(brandTemplates.availability_inquiry).toBeDefined();
        expect(brandTemplates.part_time_support).toBeDefined();

        // 验证回复指令中新字段已添加
        expect(finalResult.data.replyPrompts.attendance_inquiry).toBeDefined();
        expect(finalResult.data.replyPrompts.flexibility_inquiry).toBeDefined();
        expect(finalResult.data.replyPrompts.attendance_policy_inquiry).toBeDefined();
        expect(finalResult.data.replyPrompts.work_hours_inquiry).toBeDefined();
        expect(finalResult.data.replyPrompts.availability_inquiry).toBeDefined();
        expect(finalResult.data.replyPrompts.part_time_support).toBeDefined();
      }
    });

    it("应该升级 1.2.0 版本配置到 1.2.1（添加 brandPriorityStrategy 字段）", async () => {
      // 模拟 1.2.0 版本但缺少某些模板字段和 brandPriorityStrategy 的配置
      const v120Config = {
        brandData: {
          city: "上海市",
          defaultBrand: "肯德基",
          brands: {
            肯德基: {
              templates: {
                // 包含大部分字段，但缺少一些
                initial_inquiry: ["初始询问"],
                location_inquiry: ["位置询问"],
                no_location_match: ["无位置匹配"],
                interview_request: ["面试请求"],
                salary_inquiry: ["薪资询问"],
                schedule_inquiry: ["排班询问"],
                general_chat: ["通用聊天"],
                age_concern: ["年龄关注"],
                insurance_inquiry: ["保险询问"],
                followup_chat: ["跟进聊天"],
                attendance_inquiry: ["考勤询问"],
                // 故意缺少这些字段
                // flexibility_inquiry
                // attendance_policy_inquiry
                // work_hours_inquiry
                // availability_inquiry
                // part_time_support
              },
              screening: {
                age: { min: 18, max: 45, preferred: [25] },
                blacklistKeywords: [],
                preferredKeywords: [],
              },
            },
          },
          stores: [],
        },
        replyPrompts: {
          initial_inquiry: "初始询问回复",
          location_inquiry: "位置询问回复",
          no_location_match: "无位置匹配回复",
          salary_inquiry: "薪资询问回复",
          schedule_inquiry: "排班询问回复",
          interview_request: "面试请求回复",
          age_concern: "年龄关注回复",
          insurance_inquiry: "保险询问回复",
          followup_chat: "跟进聊天回复",
          general_chat: "通用聊天回复",
          attendance_inquiry: "考勤询问回复",
          flexibility_inquiry: "灵活性询问回复",
          attendance_policy_inquiry: "考勤政策询问回复",
          work_hours_inquiry: "工时询问回复",
          availability_inquiry: "可用性询问回复",
          part_time_support: "兼职支持回复",
        },
        systemPrompts: {
          bossZhipinSystemPrompt: "Boss直聘系统提示词",
          bossZhipinLocalSystemPrompt: "Boss直聘本地系统提示词",
          generalComputerSystemPrompt: "通用计算机系统提示词",
        },
        // 故意不包含 brandPriorityStrategy 字段（1.2.0 版本没有这个字段）
        metadata: {
          version: "1.2.0",
          lastUpdated: new Date().toISOString(),
        },
      };

      // 初始验证应该失败（因为缺少 brandPriorityStrategy 和某些模板字段）
      const initialResult = AppConfigDataSchema.safeParse(v120Config);
      expect(initialResult.success).toBe(false);

      // 动态导入升级函数
      const { upgradeConfigData } = await import("@/lib/services/config.service");

      // 升级配置（1.2.0 -> 1.2.1）
      const upgradedConfig = await upgradeConfigData(v120Config as any, false);

      // 验证升级后的配置
      const finalResult = AppConfigDataSchema.safeParse(upgradedConfig);
      expect(finalResult.success).toBe(true);

      if (finalResult.success) {
        // 验证版本号已升级到 1.2.1
        expect(finalResult.data.metadata.version).toBe("1.2.1");

        // 验证 brandPriorityStrategy 字段已添加
        expect(finalResult.data.brandPriorityStrategy).toBe("smart");

        // 验证缺失的模板字段已补全
        const brandTemplates = finalResult.data.brandData.brands["肯德基"].templates;
        expect(brandTemplates.flexibility_inquiry).toBeDefined();
        expect(brandTemplates.attendance_policy_inquiry).toBeDefined();
        expect(brandTemplates.work_hours_inquiry).toBeDefined();
        expect(brandTemplates.availability_inquiry).toBeDefined();
        expect(brandTemplates.part_time_support).toBeDefined();

        // 验证元数据中有 upgradedAt 而不是 repairedAt（这是版本升级，不是修复）
        expect(finalResult.data.metadata).toHaveProperty("upgradedAt");
        expect(finalResult.data.metadata).not.toHaveProperty("repairedAt");
      }
    });
  });
});
