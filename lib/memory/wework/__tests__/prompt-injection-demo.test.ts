/**
 * 验证预处理器注入到大模型的完整提示词内容
 *
 * 模拟场景：候选人已有多轮对话，缓存中有事实信息和上轮推荐岗位
 */

import { describe, it, expect } from "vitest";
import {
  WeworkSessionMemory,
  formatSessionMemoryForPrompt,
} from "../session-memory";
import type { EntityExtractionResult } from "@/lib/tools/wework/types";
import type { RecommendedJobSummary } from "../session-memory";

describe("提示词注入验证", () => {
  it("完整场景：事实信息 + 上轮推荐岗位", async () => {
    const memory = new WeworkSessionMemory("demo-user", "demo-session");

    // 模拟已提取的候选人事实
    const facts: EntityExtractionResult = {
      interview_info: {
        name: "小王",
        phone: "13912345678",
        gender: "女",
        age: "22岁",
        applied_store: null,
        applied_position: "服务员",
        interview_time: "明天下午2点",
        is_student: true,
        education: "本科在读",
        has_health_certificate: "有",
      },
      preferences: {
        brands: ["肯德基", "麦当劳", "海底捞"],
        salary: "时薪20以上",
        position: ["服务员", "收银员"],
        schedule: "周末",
        city: "上海",
        district: ["浦东", "徐汇"],
        location: ["陆家嘴", "人民广场"],
        labor_form: "兼职",
      },
      reasoning: "用户提到在读大三，推断为本科在读学生；提到只有周末有空，推断为兼职需求",
    };

    // 模拟上轮推荐的岗位
    const recommendedJobs: RecommendedJobSummary[] = [
      {
        jobId: 10001,
        brandName: "肯德基",
        jobName: "前台服务员",
        storeName: "陆家嘴店",
        cityName: "上海市",
        regionName: "浦东新区",
        laborForm: "兼职",
        salaryDesc: "22-25 元/时",
        jobCategoryName: "服务员",
      },
      {
        jobId: 10002,
        brandName: "麦当劳",
        jobName: "收银员",
        storeName: "人民广场店",
        cityName: "上海市",
        regionName: "黄浦区",
        laborForm: "兼职",
        salaryDesc: "20-23 元/时",
        jobCategoryName: "收银员",
      },
      {
        jobId: 10003,
        brandName: "海底捞",
        jobName: "服务员",
        storeName: null,
        cityName: "上海市",
        regionName: null,
        laborForm: "全职",
        salaryDesc: "4000-5000 元/月",
        jobCategoryName: "服务员",
      },
    ];

    await memory.saveFacts(facts);
    await memory.saveLastRecommendedJobs(recommendedJobs);

    // 加载并格式化
    const state = await memory.load();
    const suffix = formatSessionMemoryForPrompt(state);

    // 模拟 route.ts 中的拼接
    const baseSystemPrompt = "你是一位专业的招聘顾问，帮助候选人找到合适的工作机会。";
    const finalSystemPrompt = baseSystemPrompt + suffix;

    // 打印完整提示词
    console.log("\n" + "=".repeat(80));
    console.log("最终注入大模型的系统提示词");
    console.log("=".repeat(80));
    console.log(finalSystemPrompt);
    console.log("=".repeat(80));
    console.log(`总长度: ${finalSystemPrompt.length} 字符`);
    console.log(`基础提示词: ${baseSystemPrompt.length} 字符`);
    console.log(`记忆注入: ${suffix.length} 字符`);
    console.log("=".repeat(80) + "\n");

    // 断言结构正确
    expect(suffix).toContain("[会话记忆");
    expect(suffix).toContain("## 候选人已知信息");
    expect(suffix).toContain("## 上轮已推荐岗位");

    // 断言候选人信息完整
    expect(suffix).toContain("姓名: 小王");
    expect(suffix).toContain("联系方式: 13912345678");
    expect(suffix).toContain("性别: 女");
    expect(suffix).toContain("年龄: 22岁");
    expect(suffix).toContain("应聘岗位: 服务员");
    expect(suffix).toContain("面试时间: 明天下午2点");
    expect(suffix).toContain("是否学生: 是");
    expect(suffix).toContain("学历: 本科在读");
    expect(suffix).toContain("健康证: 有");
    expect(suffix).toContain("用工形式: 兼职");
    expect(suffix).toContain("意向品牌: 肯德基、麦当劳、海底捞");
    expect(suffix).toContain("意向薪资: 时薪20以上");
    expect(suffix).toContain("意向岗位: 服务员、收银员");
    expect(suffix).toContain("意向班次: 周末");
    expect(suffix).toContain("意向城市: 上海");
    expect(suffix).toContain("意向区域: 浦东、徐汇");
    expect(suffix).toContain("意向地点: 陆家嘴、人民广场");

    // 断言岗位推荐信息完整
    expect(suffix).toContain("[jobId:10001]");
    expect(suffix).toContain("品牌:肯德基 - 岗位:前台服务员");
    expect(suffix).toContain("门店:陆家嘴店");
    expect(suffix).toContain("薪资:22-25 元/时");

    expect(suffix).toContain("[jobId:10002]");
    expect(suffix).toContain("品牌:麦当劳 - 岗位:收银员");
    expect(suffix).toContain("门店:人民广场店");

    expect(suffix).toContain("[jobId:10003]");
    expect(suffix).toContain("品牌:海底捞 - 岗位:服务员");
  });

  it("空记忆场景：首次对话无注入", async () => {
    const memory = new WeworkSessionMemory("new-user", "new-session");
    const state = await memory.load();
    const suffix = formatSessionMemoryForPrompt(state);

    console.log("\n--- 空记忆场景 ---");
    console.log(`注入内容: "${suffix}"`);
    console.log(`长度: ${suffix.length}\n`);

    expect(suffix).toBe("");
  });

  it("仅有事实、无推荐岗位", async () => {
    const memory = new WeworkSessionMemory("partial-user", "partial-session");

    await memory.saveFacts({
      interview_info: {
        name: "张三",
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
        city: "杭州",
        district: null,
        location: null,
        labor_form: null,
      },
      reasoning: "仅提取到姓名和城市",
    });

    const state = await memory.load();
    const suffix = formatSessionMemoryForPrompt(state);

    console.log("\n--- 仅事实场景 ---");
    console.log(suffix);
    console.log("---\n");

    expect(suffix).toContain("候选人已知信息");
    expect(suffix).toContain("姓名: 张三");
    expect(suffix).toContain("意向城市: 杭州");
    expect(suffix).not.toContain("上轮已推荐岗位");
  });
});
