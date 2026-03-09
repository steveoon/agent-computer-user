import { describe, it, expect, beforeEach } from "vitest";
import { WeworkSessionMemory, formatSessionMemoryForPrompt } from "../session-memory";
import type { WeworkSessionState, RecommendedJobSummary } from "../session-memory";
import type { EntityExtractionResult } from "@/lib/tools/wework/types";

describe("WeworkSessionMemory", () => {
  let memory: WeworkSessionMemory;
  let testId = 0;

  beforeEach(() => {
    testId++;
    memory = new WeworkSessionMemory(`test-user-${testId}`, `test-session-${testId}`);
  });

  it("returns empty state when no data cached", async () => {
    const state = await memory.load();
    expect(state.facts).toBeNull();
    expect(state.lastRecommendedJobs).toBeNull();
  });

  it("saves and loads facts", async () => {
    const facts: EntityExtractionResult = {
      interview_info: {
        name: "张三",
        phone: "13800138000",
        gender: "男",
        age: "25",
        applied_store: null,
        applied_position: "服务员",
        interview_time: null,
        is_student: false,
        education: "本科",
        has_health_certificate: null,
      },
      preferences: {
        brands: ["海底捞"],
        salary: "4000-5000",
        position: ["服务员"],
        schedule: null,
        city: "上海",
        district: null,
        location: null,
        labor_form: "全职",
      },
      reasoning: "测试推理",
    };

    await memory.saveFacts(facts);
    const loaded = await memory.getFacts();

    expect(loaded).not.toBeNull();
    expect(loaded!.interview_info.name).toBe("张三");
    expect(loaded!.preferences.city).toBe("上海");
  });

  it("saves and loads recommended jobs (overwrite semantics)", async () => {
    const jobs1: RecommendedJobSummary[] = [
      {
        jobId: 100,
        brandName: "海底捞",
        jobName: "服务员",
        storeName: "浦东店",
        cityName: "上海市",
        regionName: "浦东新区",
        laborForm: "全职",
        salaryDesc: "4000-5000 元/月",
        jobCategoryName: "服务员",
      },
    ];

    await memory.saveLastRecommendedJobs(jobs1);
    let loaded = await memory.getLastRecommendedJobs();
    expect(loaded).toHaveLength(1);
    expect(loaded![0].jobId).toBe(100);

    // 覆盖写入
    const jobs2: RecommendedJobSummary[] = [
      {
        jobId: 200,
        brandName: "肯德基",
        jobName: "收银员",
        storeName: null,
        cityName: null,
        regionName: null,
        laborForm: "兼职",
        salaryDesc: "22 元/时",
        jobCategoryName: "收银员",
      },
    ];

    await memory.saveLastRecommendedJobs(jobs2);
    loaded = await memory.getLastRecommendedJobs();
    expect(loaded).toHaveLength(1);
    expect(loaded![0].jobId).toBe(200);
    expect(loaded![0].brandName).toBe("肯德基");
  });

  it("facts and jobs are independent", async () => {
    const facts: EntityExtractionResult = {
      interview_info: {
        name: "李四",
        phone: null,
        gender: null,
        age: null,
        applied_store: null,
        applied_position: null,
        interview_time: null,
        is_student: null,
        education: null,
        has_health_certificate: null,
      },
      preferences: {
        brands: null,
        salary: null,
        position: null,
        schedule: null,
        city: null,
        district: null,
        location: null,
        labor_form: null,
      },
      reasoning: "",
    };

    await memory.saveFacts(facts);
    // jobs should still be null
    const jobs = await memory.getLastRecommendedJobs();
    expect(jobs).toBeNull();

    const loadedFacts = await memory.getFacts();
    expect(loadedFacts!.interview_info.name).toBe("李四");
  });
});

describe("formatSessionMemoryForPrompt", () => {
  it("returns empty string for empty state", () => {
    const state: WeworkSessionState = {
      facts: null,
      lastRecommendedJobs: null,
    };
    expect(formatSessionMemoryForPrompt(state)).toBe("");
  });

  it("formats facts into prompt section", () => {
    const state: WeworkSessionState = {
      facts: {
        interview_info: {
          name: "张三",
          phone: "13800138000",
          gender: null,
          age: "25",
          applied_store: null,
          applied_position: "服务员",
          interview_time: null,
          is_student: true,
          education: null,
          has_health_certificate: null,
        },
        preferences: {
          brands: ["海底捞", "肯德基"],
          salary: null,
          position: null,
          schedule: null,
          city: "上海",
          district: null,
          location: null,
          labor_form: "兼职",
        },
        reasoning: "",
      },
      lastRecommendedJobs: null,
    };

    const result = formatSessionMemoryForPrompt(state);
    expect(result).toContain("[会话记忆");
    expect(result).toContain("候选人已知信息");
    expect(result).toContain("姓名: 张三");
    expect(result).toContain("联系方式: 13800138000");
    expect(result).toContain("年龄: 25");
    expect(result).toContain("应聘岗位: 服务员");
    expect(result).toContain("是否学生: 是");
    expect(result).toContain("意向品牌: 海底捞、肯德基");
    expect(result).toContain("意向城市: 上海");
    expect(result).toContain("用工形式: 兼职");
  });

  it("formats recommended jobs into prompt section", () => {
    const state: WeworkSessionState = {
      facts: null,
      lastRecommendedJobs: [
        {
          jobId: 100,
          brandName: "海底捞",
          jobName: "服务员",
          storeName: "浦东陆家嘴店",
          cityName: "上海市",
          regionName: "浦东新区",
          laborForm: "全职",
          salaryDesc: "4000-5000 元/月",
          jobCategoryName: "服务员",
        },
        {
          jobId: 200,
          brandName: "肯德基",
          jobName: "收银员",
          storeName: null,
          cityName: "北京市",
          regionName: null,
          laborForm: "兼职",
          salaryDesc: null,
          jobCategoryName: "收银员",
        },
      ],
    };

    const result = formatSessionMemoryForPrompt(state);
    expect(result).toContain("上轮已推荐岗位");
    expect(result).toContain("[jobId:100]");
    expect(result).toContain("品牌:海底捞 - 岗位:服务员");
    expect(result).toContain("门店:浦东陆家嘴店");
    expect(result).toContain("上海市浦东新区");
    expect(result).toContain("薪资:4000-5000 元/月");
    expect(result).toContain("[jobId:200]");
    expect(result).toContain("品牌:肯德基 - 岗位:收银员");
    expect(result).toContain("北京市");
  });

  it("formats both facts and jobs together", () => {
    const state: WeworkSessionState = {
      facts: {
        interview_info: {
          name: "王五",
          phone: null,
          gender: null,
          age: null,
          applied_store: null,
          applied_position: null,
          interview_time: null,
          is_student: null,
          education: null,
          has_health_certificate: null,
        },
        preferences: {
          brands: null,
          salary: null,
          position: null,
          schedule: null,
          city: null,
          district: null,
          location: null,
          labor_form: null,
        },
        reasoning: "",
      },
      lastRecommendedJobs: [
        {
          jobId: 300,
          brandName: "星巴克",
          jobName: "咖啡师",
          storeName: null,
          cityName: null,
          regionName: null,
          laborForm: null,
          salaryDesc: null,
          jobCategoryName: null,
        },
      ],
    };

    const result = formatSessionMemoryForPrompt(state);
    expect(result).toContain("候选人已知信息");
    expect(result).toContain("姓名: 王五");
    expect(result).toContain("上轮已推荐岗位");
    expect(result).toContain("[jobId:300]");
    expect(result).toContain("品牌:星巴克 - 岗位:咖啡师");
  });
});
