import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppConfigDataSchema } from "@/types/config";
import { DEFAULT_REPLY_POLICY, type AppConfigData, type ZhipinData } from "@/types";
import { upgradeConfigData, CONFIG_VERSION } from "@/lib/services/config.service";

function createBrandData(): ZhipinData {
  return {
    meta: { defaultBrandId: "test_brand" },
    brands: [
      {
        id: "test_brand",
        name: "测试品牌",
        stores: [
          {
            id: "store-1",
            name: "测试门店",
            brandId: "test_brand",
            location: "浦东新区",
            district: "浦东新区",
            subarea: "世纪大道",
            coordinates: { lat: 31.23, lng: 121.47 },
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
