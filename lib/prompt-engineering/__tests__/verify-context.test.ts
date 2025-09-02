/**
 * 验证 ReplyPromptBuilder 是否正确包含完整的招聘数据上下文
 * 专门用于验证问题中提到的缺失上下文问题
 */

import { describe, it, expect } from "vitest";
import { ReplyPromptBuilder } from "../core/reply-builder";
import type { ReplyBuilderParams } from "@/types/context-engineering";

describe("ReplyPromptBuilder - 验证招聘数据上下文", () => {
  it("应该包含完整的门店和职位信息", () => {
    const builder = new ReplyPromptBuilder();

    const params: ReplyBuilderParams = {
      message: "我要近一点，兼职日结夜班",
      classification: {
        replyType: "location_inquiry",
        extractedInfo: {
          preferredSchedule: "兼职, 日结, 夜班",
        },
        reasoningText: "用户询问位置并提出工作时间要求",
      },
      contextInfo: `默认推荐品牌：奥乐齐
匹配到的门店信息：
• 1083曲阳666（虹口区1083曲阳666）：上海市-虹口区-虹口曲阳路666号新神州商厦
  职位：晚班补货，时间：22:00-07:00，薪资：30元/时
  福利：五险一金
  排班类型：灵活排班（可换班）
  排班特点：可换班、兼职
  每周工时：48-56小时
  出勤要求：最少6天/周

• 1080梦享家（闵行区1080梦享家）：上海市-闵行区-东川路2088号置业梦享家
  职位：晚班补货，时间：22:00-07:00，薪资：30元/时
  福利：五险一金
  排班类型：灵活排班（可换班）
  排班特点：可换班、兼职
  每周工时：48-56小时
  出勤要求：最少6天/周

• 1079 中房金谊广场（浦东新区1079 中房金谊广场）：上海市上南路-地铁站
  职位：晚班补货，时间：22:00-07:00，薪资：30元/时
  福利：五险一金
  排班类型：灵活排班（可换班）
  排班特点：可换班、兼职
  每周工时：48-56小时
  出勤要求：最少6天/周

📋 奥乐齐品牌专属话术模板（位置咨询）：
离你比较近在{location}的奥乐齐门店有空缺，排班{schedule}，时薪{salary}元，有兴趣吗？`,
      systemInstruction:
        "如果对方提供的位置，能找到距离较近的门店，按以下话术回复：离你近的有{brand}的{location}门店，加我 wx，我给你约店长面试",
      conversationHistory: [
        "我: 奥乐齐-晚班补货-时薪30-全市可安排",
        "求职者: 您好，我仔细阅读了您发布的这个职位，觉得比较适合自己，希望能与您进一步沟通一下，期待您的回复～",
        "求职者: 松江九亭的有没有？",
        "我: 离你比较近在开元地中海的奥乐齐门店有空缺，排班灵活，时薪30元，有兴趣吗？",
      ],
      targetBrand: "奥乐齐",
    };

    const result = builder.build(params);

    console.log("\n======== 生成的 Prompt ========");
    console.log(result.prompt);
    console.log("================================\n");

    // 验证关键信息是否都包含在prompt中
    const criticalInfo = [
      "1083曲阳666",
      "1080梦享家",
      "1079 中房金谊广场",
      "晚班补货",
      "30元/时",
      "五险一金",
      "灵活排班",
      "奥乐齐品牌专属话术",
    ];

    criticalInfo.forEach(info => {
      expect(result.prompt).toContain(info);
      console.log(`✅ 包含: ${info}`);
    });

    // 验证提示包含所有必要的结构部分
    expect(result.prompt).toContain("[指令]");
    expect(result.prompt).toContain("[招聘数据]");
    expect(result.prompt).toContain("[当前上下文]");
    expect(result.prompt).toContain("[对话历史]");
    expect(result.prompt).toContain("[候选人消息]");
    expect(result.prompt).toContain("[输出要求]");
  });

  it("对比测试：带品牌过滤 vs 不带品牌过滤", () => {
    // 测试品牌过滤设置的影响
    const params: ReplyBuilderParams = {
      message: "工作时间怎么安排？",
      classification: {
        replyType: "schedule_inquiry",
        extractedInfo: {},
        reasoningText: "询问排班",
      },
      contextInfo: `默认推荐品牌：肯德基
其他品牌信息：必胜客、麦当劳

肯德基门店信息：
• 人民广场店：早晚班都有，时薪25元
• 南京路店：全天班次，时薪26元

必胜客门店信息：
• 徐家汇店：晚班为主，时薪28元

麦当劳门店信息：
• 陆家嘴店：24小时营业，时薪24元`,
      systemInstruction: "回复排班信息",
      conversationHistory: [],
      targetBrand: "肯德基",
    };

    // 默认配置（不过滤）
    const builderNoFilter = new ReplyPromptBuilder();
    const resultNoFilter = builderNoFilter.build(params);

    // 启用品牌过滤
    const builderWithFilter = new ReplyPromptBuilder({
      contextOptimizerConfig: {
        prioritizeBrandSpecific: true,
      },
    });
    const resultWithFilter = builderWithFilter.build(params);

    console.log("\n======== 不过滤的结果 ========");
    const hasAllBrandsNoFilter =
      resultNoFilter.prompt.includes("肯德基") &&
      resultNoFilter.prompt.includes("必胜客") &&
      resultNoFilter.prompt.includes("麦当劳");
    console.log(`包含所有品牌信息: ${hasAllBrandsNoFilter}`);

    console.log("\n======== 过滤后的结果 ========");
    const hasTargetBrand = resultWithFilter.prompt.includes("肯德基");
    const hasOtherBrands =
      resultWithFilter.prompt.includes("必胜客") || resultWithFilter.prompt.includes("麦当劳");
    console.log(`包含目标品牌(肯德基): ${hasTargetBrand}`);
    console.log(`包含其他品牌: ${hasOtherBrands}`);

    // 默认应该保留完整上下文
    expect(hasAllBrandsNoFilter).toBe(true);
  });
});
