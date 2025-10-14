import { describe, it, expect } from "vitest";
import { zhipinReplyTool } from "../zhipin-reply-tool";
import type { ZhipinData } from "@/types/zhipin";

describe("zhipinReplyTool - ConfigData Validation", () => {
  it("应该在 configData 缺少 stores 时抛出错误", () => {
    // 缺少 stores 字段的不完整数据
    const incompleteConfigData = {
      city: "上海",
      brands: {
        大米先生: {
          templates: {
            initial_inquiry: ["你好！我们正在招聘..."],
            location_inquiry: ["请问您在哪个区域？"],
            no_location_match: ["很抱歉，该区域暂无职位"],
            schedule_inquiry: ["工作时间为..."],
            interview_request: ["欢迎来面试！"],
            general_chat: ["有什么可以帮到您？"],
            salary_inquiry: ["薪资待遇为..."],
            age_concern: ["年龄要求..."],
            insurance_inquiry: ["我们提供五险一金"],
            followup_chat: ["请问还有其他问题吗？"],
            attendance_inquiry: ["出勤要求为..."],
            flexibility_inquiry: ["排班较为灵活"],
            attendance_policy_inquiry: ["考勤制度为..."],
            work_hours_inquiry: ["每周工作..."],
            availability_inquiry: ["目前有空缺..."],
            part_time_support: ["支持兼职"],
          },
          screening: {
            age: { min: 18, max: 50, preferred: [25, 30, 35] },
            blacklistKeywords: ["不合适"],
            preferredKeywords: ["有经验"],
          },
        },
      },
      // 缺少 stores: []
    } as unknown as ZhipinData;

    expect(() => {
      zhipinReplyTool(undefined, undefined, incompleteConfigData);
    }).toThrow(/智能回复工具初始化失败.*configData 数据结构不完整/);
  });

  it("应该在 configData.stores 为空数组时成功创建工具", () => {
    const validConfigData: ZhipinData = {
      city: "上海",
      stores: [], // 空数组是有效的
      brands: {
        奥乐齐: {
          templates: {
            initial_inquiry: ["你好！我们正在招聘..."],
            location_inquiry: ["请问您在哪个区域？"],
            no_location_match: ["很抱歉，该区域暂无职位"],
            schedule_inquiry: ["工作时间为..."],
            interview_request: ["欢迎来面试！"],
            general_chat: ["有什么可以帮到您？"],
            salary_inquiry: ["薪资待遇为..."],
            age_concern: ["年龄要求..."],
            insurance_inquiry: ["我们提供五险一金"],
            followup_chat: ["请问还有其他问题吗？"],
            attendance_inquiry: ["出勤要求为..."],
            flexibility_inquiry: ["排班较为灵活"],
            attendance_policy_inquiry: ["考勤制度为..."],
            work_hours_inquiry: ["每周工作..."],
            availability_inquiry: ["目前有空缺..."],
            part_time_support: ["支持兼职"],
          },
          screening: {
            age: { min: 18, max: 50, preferred: [25, 30, 35] },
            blacklistKeywords: ["不合适"],
            preferredKeywords: ["有经验"],
          },
        },
      },
    };

    expect(() => {
      zhipinReplyTool(undefined, undefined, validConfigData);
    }).not.toThrow();
  });

  it("应该在 configData 缺少 brands 时抛出错误", () => {
    const incompleteConfigData = {
      city: "上海",
      stores: [],
      // 缺少 brands
    } as unknown as ZhipinData;

    expect(() => {
      zhipinReplyTool(undefined, undefined, incompleteConfigData);
    }).toThrow(/智能回复工具初始化失败.*configData 数据结构不完整/);
  });

  it("应该在 configData 缺少 city 时抛出错误", () => {
    const incompleteConfigData = {
      stores: [],
      brands: {
        肯德基: {
          templates: {
            initial_inquiry: ["你好！我们正在招聘..."],
            location_inquiry: ["请问您在哪个区域？"],
            no_location_match: ["很抱歉，该区域暂无职位"],
            schedule_inquiry: ["工作时间为..."],
            interview_request: ["欢迎来面试！"],
            general_chat: ["有什么可以帮到您？"],
            salary_inquiry: ["薪资待遇为..."],
            age_concern: ["年龄要求..."],
            insurance_inquiry: ["我们提供五险一金"],
            followup_chat: ["请问还有其他问题吗？"],
            attendance_inquiry: ["出勤要求为..."],
            flexibility_inquiry: ["排班较为灵活"],
            attendance_policy_inquiry: ["考勤制度为..."],
            work_hours_inquiry: ["每周工作..."],
            availability_inquiry: ["目前有空缺..."],
            part_time_support: ["支持兼职"],
          },
          screening: {
            age: { min: 18, max: 50, preferred: [25, 30, 35] },
            blacklistKeywords: ["不合适"],
            preferredKeywords: ["有经验"],
          },
        },
      },
      // 缺少 city
    } as unknown as ZhipinData;

    expect(() => {
      zhipinReplyTool(undefined, undefined, incompleteConfigData);
    }).toThrow(/智能回复工具初始化失败.*configData 数据结构不完整/);
  });

  it("应该在 configData 为 undefined 时不抛出错误", () => {
    // 工具允许不传 configData（会在执行时使用默认数据）
    expect(() => {
      zhipinReplyTool();
    }).not.toThrow();
  });

  it("错误信息应该包含详细的字段路径", () => {
    const incompleteConfigData = {
      city: "上海",
      stores: [],
      brands: {
        "M Stand": {
          // 缺少 templates 字段
          screening: {
            age: { min: 18, max: 50, preferred: [25, 30, 35] },
            blacklistKeywords: ["不合适"],
            preferredKeywords: ["有经验"],
          },
        },
      },
    } as unknown as ZhipinData;

    try {
      zhipinReplyTool(undefined, undefined, incompleteConfigData);
      expect.fail("应该抛出错误");
    } catch (error) {
      const errorMessage = (error as Error).message;
      expect(errorMessage).toContain("brands.M Stand.templates");
    }
  });
});
