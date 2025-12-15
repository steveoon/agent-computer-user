/**
 * Recruitment Event Builder Tests
 *
 * Tests for the chain-style event builder API.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RecruitmentEventBuilder } from "../builder";
import { recruitmentContext } from "../context";
import { RecruitmentEventType, DataSource } from "@/db/types";
import type { RecruitmentContext, CandidateSnapshot } from "../types";

describe("RecruitmentEventBuilder", () => {
  const testContext: RecruitmentContext = {
    agentId: "zhipin-001",
    brandId: 123,
    sourcePlatform: "zhipin",
    apiSource: "web",
    jobId: 456,
    jobName: "服务员",
  };

  const testCandidate: CandidateSnapshot = {
    name: "张三",
    position: "服务员",
    age: "25",
    gender: "男",
    education: "高中",
    expectedSalary: "5000-6000",
    expectedLocation: "上海",
    height: "175",
    weight: "70",
    healthCert: true,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-12-05T10:30:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("构造函数", () => {
    it("应该使用显式传入的上下文", () => {
      const builder = new RecruitmentEventBuilder(testContext);
      const event = builder.candidate({ name: "测试" }).messageSent("你好");

      expect(event.agentId).toBe("zhipin-001");
      expect(event.sourcePlatform).toBe("zhipin");
      expect(event.brandId).toBe(123);
    });

    it("应该使用 AsyncLocalStorage 上下文", () => {
      recruitmentContext.run(testContext, () => {
        const builder = new RecruitmentEventBuilder();
        const event = builder.candidate({ name: "测试" }).messageSent("你好");

        expect(event.agentId).toBe("zhipin-001");
      });
    });

    it("没有上下文时应抛出错误", () => {
      expect(() => new RecruitmentEventBuilder()).toThrow("Context not initialized");
    });
  });

  describe("链式 API", () => {
    it("candidate() 应该设置候选人信息", () => {
      const event = new RecruitmentEventBuilder(testContext)
        .candidate(testCandidate)
        .messageSent("你好");

      expect(event.candidateName).toBe("张三");
      expect(event.candidatePosition).toBe("服务员");
      expect(event.candidateAge).toBe("25");
      expect(event.candidateGender).toBe("男");
      expect(event.candidateEducation).toBe("高中");
      expect(event.candidateExpectedSalary).toBe("5000-6000");
      expect(event.candidateHeight).toBe("175");
      expect(event.candidateWeight).toBe("70");
      expect(event.candidateHealthCert).toBe(true);
    });

    it("at() 应该设置事件时间", () => {
      const customTime = new Date("2025-12-04T15:00:00");
      const event = new RecruitmentEventBuilder(testContext)
        .candidate({ name: "测试" })
        .at(customTime)
        .messageSent("你好");

      expect(event.eventTime).toEqual(customTime);
    });

    it("withUnreadContext() 应该设置未读状态", () => {
      const event = new RecruitmentEventBuilder(testContext)
        .candidate({ name: "测试" })
        .withUnreadContext(5)
        .messageSent("你好");

      expect(event.wasUnreadBeforeReply).toBe(true);
      expect(event.unreadCountBeforeReply).toBe(5);
    });

    it("withUnreadContext(0) 应该设置 wasUnreadBeforeReply 为 false", () => {
      const event = new RecruitmentEventBuilder(testContext)
        .candidate({ name: "测试" })
        .withUnreadContext(0)
        .messageSent("你好");

      expect(event.wasUnreadBeforeReply).toBe(false);
      expect(event.unreadCountBeforeReply).toBe(0);
    });

    it("withMessageSequence() 应该设置消息序号", () => {
      const event = new RecruitmentEventBuilder(testContext)
        .candidate({ name: "测试" })
        .withMessageSequence(3)
        .messageSent("你好");

      expect(event.messageSequence).toBe(3);
    });

    it("forJob() 应该覆盖职位信息", () => {
      const event = new RecruitmentEventBuilder(testContext)
        .candidate({ name: "测试" })
        .forJob(789, "厨师")
        .messageSent("你好");

      expect(event.jobId).toBe(789);
      expect(event.jobName).toBe("厨师");
    });

    it("forBrand() 应该覆盖品牌信息", () => {
      const event = new RecruitmentEventBuilder(testContext)
        .candidate({ name: "测试" })
        .forBrand(999)
        .messageSent("你好");

      expect(event.brandId).toBe(999);
    });
  });

  describe("事件类型方法", () => {
    it("messageSent() 应该创建 MESSAGE_SENT 事件", () => {
      const event = new RecruitmentEventBuilder(testContext)
        .candidate({ name: "测试" })
        .messageSent("你好，请问有意向吗？");

      expect(event.eventType).toBe(RecruitmentEventType.MESSAGE_SENT);
      expect(event.eventDetails).toEqual({
        type: "message_sent",
        content: "你好，请问有意向吗？",
        isAutoReply: undefined,
      });
    });

    it("messageSent() 带 isAutoReply 选项", () => {
      const event = new RecruitmentEventBuilder(testContext)
        .candidate({ name: "测试" })
        .messageSent("自动回复内容", { isAutoReply: true });

      expect(event.eventDetails).toEqual({
        type: "message_sent",
        content: "自动回复内容",
        isAutoReply: true,
      });
    });

    it("messageReceived() 应该创建 MESSAGE_RECEIVED 事件（入站消息检测）", () => {
      const event = new RecruitmentEventBuilder(testContext)
        .candidate({ name: "测试" })
        .withUnreadContext(5)
        .messageReceived(5, "您好，想了解一下岗位");

      expect(event.eventType).toBe(RecruitmentEventType.MESSAGE_RECEIVED);
      expect(event.eventDetails).toEqual({
        type: "message_received",
        unreadCount: 5,
        lastMessagePreview: "您好，想了解一下岗位",
      });
      expect(event.wasUnreadBeforeReply).toBe(true);
      expect(event.unreadCountBeforeReply).toBe(5);
    });

    it("wechatExchanged() 应该创建 WECHAT_EXCHANGED 事件", () => {
      const event = new RecruitmentEventBuilder(testContext)
        .candidate({ name: "测试" })
        .wechatExchanged("wx123456");

      expect(event.eventType).toBe(RecruitmentEventType.WECHAT_EXCHANGED);
      expect(event.eventDetails).toEqual({
        type: "wechat_exchanged",
        wechatNumber: "wx123456",
      });
    });

    it("wechatExchanged() 无微信号", () => {
      const event = new RecruitmentEventBuilder(testContext)
        .candidate({ name: "测试" })
        .wechatExchanged();

      expect(event.eventDetails).toEqual({
        type: "wechat_exchanged",
        wechatNumber: undefined,
      });
    });

    it("interviewBooked() 应该创建 INTERVIEW_BOOKED 事件", () => {
      const event = new RecruitmentEventBuilder(testContext)
        .candidate({ name: "测试" })
        .interviewBooked({
          interviewTime: "2025-12-10 14:00",
          address: "上海市浦东新区",
          candidatePhone: "13800138000",
        });

      expect(event.eventType).toBe(RecruitmentEventType.INTERVIEW_BOOKED);
      expect(event.eventDetails).toEqual({
        type: "interview_booked",
        interviewTime: "2025-12-10 14:00",
        address: "上海市浦东新区",
        candidatePhone: "13800138000",
        dulidayJobId: 456, // From context
      });
    });

    it("candidateContacted() 应该创建 CANDIDATE_CONTACTED 事件（主动打招呼）", () => {
      const event = new RecruitmentEventBuilder(testContext)
        .candidate({ name: "测试" })
        .candidateContacted();

      expect(event.eventType).toBe(RecruitmentEventType.CANDIDATE_CONTACTED);
      expect(event.eventDetails).toEqual({
        type: "candidate_contacted",
      });
    });

    it("candidateHired() 应该创建 CANDIDATE_HIRED 事件", () => {
      const event = new RecruitmentEventBuilder(testContext)
        .candidate({ name: "测试" })
        .candidateHired("2025-12-15", "顺利入职");

      expect(event.eventType).toBe(RecruitmentEventType.CANDIDATE_HIRED);
      expect(event.eventDetails).toEqual({
        type: "candidate_hired",
        hireDate: "2025-12-15",
        notes: "顺利入职",
      });
    });
  });

  describe("自动生成字段", () => {
    it("应该自动生成 candidateKey", () => {
      const event = new RecruitmentEventBuilder(testContext)
        .candidate({ name: "张三", position: "服务员" })
        .messageSent("你好");

      expect(event.candidateKey).toBeDefined();
      expect(event.candidateKey).toContain("zhipin");
      expect(event.candidateKey).toContain("张三");
    });

    it("应该自动生成 sessionId", () => {
      const event = new RecruitmentEventBuilder(testContext)
        .candidate({ name: "张三" })
        .messageSent("你好");

      expect(event.sessionId).toBeDefined();
      expect(event.sessionId).toContain("zhipin-001");
      expect(event.sessionId).toContain("2025-12-05");
    });

    it("应该自动设置 dataSource 为 TOOL_AUTO", () => {
      const event = new RecruitmentEventBuilder(testContext)
        .candidate({ name: "测试" })
        .messageSent("你好");

      expect(event.dataSource).toBe(DataSource.TOOL_AUTO);
    });

    it("没有设置时间时应使用当前时间", () => {
      const event = new RecruitmentEventBuilder(testContext)
        .candidate({ name: "测试" })
        .messageSent("你好");

      expect(event.eventTime).toEqual(new Date("2025-12-05T10:30:00"));
    });

    it("候选人名称缺失时应使用 unknown", () => {
      const event = new RecruitmentEventBuilder(testContext)
        .candidate({ name: "" })
        .messageSent("你好");

      // candidateKey should still be generated with "unknown"
      expect(event.candidateKey).toContain("unknown");
    });
  });

  describe("复杂场景", () => {
    it("完整的消息发送事件构建", () => {
      const event = new RecruitmentEventBuilder(testContext)
        .candidate(testCandidate)
        .at(new Date("2025-12-05T14:30:00"))
        .withUnreadContext(2)
        .withMessageSequence(5)
        .messageSent("您好，我们这边正在招聘服务员，请问您有兴趣吗？", {
          isAutoReply: false,
        });

      // 验证所有字段
      expect(event.agentId).toBe("zhipin-001");
      expect(event.brandId).toBe(123);
      expect(event.sourcePlatform).toBe("zhipin");
      expect(event.jobId).toBe(456);
      expect(event.jobName).toBe("服务员");
      expect(event.candidateName).toBe("张三");
      expect(event.candidatePosition).toBe("服务员");
      expect(event.eventType).toBe(RecruitmentEventType.MESSAGE_SENT);
      expect(event.eventTime).toEqual(new Date("2025-12-05T14:30:00"));
      expect(event.wasUnreadBeforeReply).toBe(true);
      expect(event.unreadCountBeforeReply).toBe(2);
      expect(event.messageSequence).toBe(5);
      expect(event.dataSource).toBe(DataSource.TOOL_AUTO);
      expect(event.candidateKey).toBeDefined();
      expect(event.sessionId).toBeDefined();
    });
  });
});
