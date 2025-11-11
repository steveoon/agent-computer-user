/**
 * 配置导出 API
 *
 * GET /api/config/export - 返回完整的应用配置数据
 *
 * 该接口返回默认的配置数据结构，包括：
 * - brandData: 品牌和门店数据
 * - systemPrompts: 系统级提示词
 * - replyPrompts: 智能回复指令
 * - activeSystemPrompt: 活动系统提示词类型
 * - brandPriorityStrategy: 品牌优先级策略
 * - metadata: 配置元信息
 */

import { NextResponse } from "next/server";
import { zhipinData } from "@/lib/data/sample-data";
import {
  getBossZhipinSystemPrompt,
  getGeneralComputerSystemPrompt,
  getBossZhipinLocalSystemPrompt,
} from "@/lib/system-prompts";
import { CONFIG_VERSION } from "@/types/config";
import type { AppConfigData, ReplyPromptsConfig } from "@/types";

export async function GET() {
  try {
    // 智能回复指令配置
    const replyPromptsConfig: ReplyPromptsConfig = {
      initial_inquiry: `作为招聘助手，参考这个模板回复: "你好，{city}各区有{brand}门店在招人，排班{hours}小时，时薪{salary}元，{level_salary}"。语气要自然，突出薪资。`,
      location_inquiry: `候选人问位置，用这个模板回复: "你好，{city}各区都有门店，你在什么位置？我帮你查下附近"。必须问对方位置。`,
      no_location_match: `附近无门店，按这个话术处理: "你附近暂时没岗位，{alternative_location}的门店考虑吗？"。同时，主动询问是否可以加微信，告知以后有其他机会可以推荐。`,
      salary_inquiry: `薪资咨询，按这个模板提供信息: "基本薪资{salary}元/小时，{level_salary}"。需要包含阶梯薪资说明。`,
      schedule_inquiry: `时间安排咨询，参考这个话术: "门店除了{time1}空缺，还有{time2}也空缺呢，可以和店长商量"。强调时间灵活性。`,
      interview_request: `面试邀约，严格按照这个话术: "可以帮你和店长约面试，方便加下微信吗，需要几项简单的个人信息"。必须主动要微信。`,
      age_concern: `年龄问题，严格按运营指南处理：
      - 符合要求(18-45岁): "你的年龄没问题的"
      - 超出要求: "你附近目前没有岗位空缺了"
      绝不透露具体年龄限制。`,
      insurance_inquiry: `保险咨询，使用固定话术:
      - 标准回复: "有商业保险"
      简洁明确，不展开说明。`,
      followup_chat: `跟进聊天，参考这个话术模板保持联系: "门店除了{position1}还有{position2}也空缺的，可以和店长商量"。营造机会丰富的感觉。`,
      general_chat: `通用回复，引导到具体咨询。重新询问位置或工作意向，保持专业。`,
      // 出勤和排班相关回复指令
      attendance_inquiry: `出勤要求咨询，参考这个话术: "出勤要求是{attendance_description}，一周最少{minimum_days}天，时间安排可以和店长商量。"。强调灵活性和协商性。`,
      flexibility_inquiry: `排班灵活性咨询，参考这个话术: "排班方式是{schedule_type}，{can_swap_shifts}换班，{part_time_allowed}兼职，比较人性化的。"。突出灵活性和人性化管理。`,
      attendance_policy_inquiry: `考勤政策咨询，参考这个话术: "考勤要求{punctuality_required}准时到岗，最多可以迟到{late_tolerance_minutes}分钟，{makeup_shifts_allowed}补班。"。说明具体政策细节。`,
      work_hours_inquiry: `工时要求咨询，参考这个话术: "每周工作{min_hours_per_week}-{max_hours_per_week}小时，可以根据你的时间来安排。"。强调时间安排的灵活性。`,
      availability_inquiry: `时间段可用性咨询，参考这个话术: "{time_slot}班次还有{available_spots}个位置，{priority}优先级，可以报名。"。提供具体的可用性信息。`,
      part_time_support: `兼职支持咨询，参考这个话术: "完全支持兼职，{part_time_allowed}，时间可以和其他工作错开安排。"。突出对兼职的支持和理解。`,
    };

    // 聚合所有配置数据
    const configData: AppConfigData = {
      // 品牌和门店数据
      brandData: zhipinData,

      // 系统级提示词
      systemPrompts: {
        bossZhipinSystemPrompt: getBossZhipinSystemPrompt(),
        generalComputerSystemPrompt: getGeneralComputerSystemPrompt(),
        bossZhipinLocalSystemPrompt: getBossZhipinLocalSystemPrompt(),
      },

      // 智能回复指令
      replyPrompts: replyPromptsConfig,

      // 活动系统提示词（默认使用Boss直聘）
      activeSystemPrompt: "bossZhipinSystemPrompt",

      // 品牌优先级策略（默认智能判断）
      brandPriorityStrategy: "smart",

      // 配置元信息
      metadata: {
        version: CONFIG_VERSION,
        lastUpdated: new Date().toISOString(),
        migratedAt: new Date().toISOString(),
      },
    };

    // 返回配置数据
    return NextResponse.json(
      {
        success: true,
        data: configData,
        timestamp: new Date().toISOString(),
        version: CONFIG_VERSION,
      },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          // 添加 CORS 头，允许跨域访问
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  } catch (error) {
    console.error("❌ 配置导出 API 错误:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// 处理 OPTIONS 请求（CORS 预检）
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
