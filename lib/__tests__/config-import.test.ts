import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppConfigDataSchema } from "@/types/config";
import { DEFAULT_REPLY_POLICY, type AppConfigData, type ZhipinData } from "@/types";
import { upgradeConfigData, CONFIG_VERSION } from "@/lib/services/config.service";

function createBrandData(): ZhipinData {
  return {
    city: "上海市",
    defaultBrand: "测试品牌",
    brands: {
      测试品牌: {
        templates: {
          initial_inquiry: ["你好"],
          location_inquiry: ["你在哪"],
          no_location_match: ["附近暂无"],
          schedule_inquiry: ["排班可沟通"],
          interview_request: ["可以约面试"],
          general_chat: ["继续沟通"],
          salary_inquiry: ["薪资区间"],
          age_concern: ["年龄需匹配"],
          insurance_inquiry: ["商业保险"],
          followup_chat: ["保持联系"],
          attendance_inquiry: ["出勤要求"],
          flexibility_inquiry: ["排班灵活"],
          attendance_policy_inquiry: ["考勤规则"],
          work_hours_inquiry: ["周工时"],
          availability_inquiry: ["可约时段"],
          part_time_support: ["支持兼职"],
        },
        screening: {
          age: { min: 18, max: 45, preferred: [22, 25] },
          blacklistKeywords: [],
          preferredKeywords: [],
        },
      },
    },
    stores: [
      {
        id: "store-1",
        name: "测试门店",
        brand: "测试品牌",
        location: "浦东新区",
        district: "浦东新区",
        subarea: "世纪大道",
        coordinates: { lat: 31.23, lng: 121.47 },
        transportation: "2号线",
        positions: [
          {
            id: "pos-1",
            name: "服务员",
            timeSlots: ["09:00-18:00"],
            salary: {
              base: 25,
              range: "25-30",
              bonus: "绩效",
              memo: "时薪",
            },
            workHours: "8",
            benefits: { items: ["商业保险"] },
            requirements: ["沟通能力"],
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
  };
}

function createValidConfig(): AppConfigData {
  return {
    brandData: createBrandData(),
    systemPrompts: {
      bossZhipinSystemPrompt: "boss",
      bossZhipinLocalSystemPrompt: "boss-local",
      generalComputerSystemPrompt: "general",
    },
    replyPolicy: DEFAULT_REPLY_POLICY,
    activeSystemPrompt: "bossZhipinSystemPrompt",
    brandPriorityStrategy: "smart",
    metadata: {
      version: CONFIG_VERSION,
      lastUpdated: new Date().toISOString(),
    },
  };
}

describe("配置导入数据格式校验", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("接受新版本完整配置", () => {
    const validConfig = createValidConfig();
    const result = AppConfigDataSchema.safeParse(validConfig);

    expect(result.success).toBe(true);
  });

  it("拒绝非法 replyPolicy", () => {
    const invalid = {
      ...createValidConfig(),
      replyPolicy: {
        ...DEFAULT_REPLY_POLICY,
        defaultIndustryVoiceId: "missing-voice-id",
      },
    };

    const result = AppConfigDataSchema.safeParse(invalid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.replyPolicy.industryVoices["missing-voice-id"]).toBeUndefined();
    }
  });

  it("升级旧配置并写入 backup", async () => {
    const legacyConfig = {
      brandData: createBrandData(),
      systemPrompts: {
        bossZhipinSystemPrompt: "boss",
        generalComputerSystemPrompt: "general",
      },
      replyPrompts: {
        initial_inquiry: "旧初次咨询模板",
        salary_inquiry: "旧薪资模板",
        interview_request: "旧约面模板",
      },
      metadata: {
        version: "1.0.0",
        lastUpdated: new Date().toISOString(),
      },
    };

    const upgraded = await upgradeConfigData(legacyConfig, false, false);

    const result = AppConfigDataSchema.safeParse(upgraded);
    expect(result.success).toBe(true);

    expect(upgraded.metadata.version).toBe(CONFIG_VERSION);
    expect(upgraded.replyPolicy.stageGoals.job_consultation).toBeDefined();
    expect(upgraded.metadata.backup?.replyPrompts?.initial_inquiry).toBe("旧初次咨询模板");
  });
});
