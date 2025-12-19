/**
 * Recruitment Event Service Tests
 *
 * Tests for the main service with mocked repository.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { recruitmentContext } from "../context";
import { DataSource } from "@/db/types";
import type { RecruitmentContext } from "../types";
import type { DrizzleInsertEvent, DrizzleSelectEvent } from "../repository";

// Mock dependencies before importing service
vi.mock("../repository", () => ({
  recruitmentEventsRepository: {
    insert: vi.fn(),
    insertMany: vi.fn(),
    findByAgentAndTimeRange: vi.fn(),
    findBySessionId: vi.fn(),
    findByCandidateKey: vi.fn(),
  },
  // Export types properly
  DrizzleInsertEvent: undefined,
  DrizzleSelectEvent: undefined,
}));

// Mock db/types to provide a simple schema
vi.mock("@/db/types", async () => {
  const actual = await vi.importActual<typeof import("@/db/types")>("@/db/types");
  return {
    ...actual,
    // Override the schema with a simple mock that always passes
    insertRecruitmentEventSchema: {
      safeParse: (data: unknown) => {
        // Simple validation - just check required fields exist
        const d = data as Record<string, unknown>;
        if (!d.agentId || !d.candidateKey || !d.eventType || !d.eventTime) {
          return { success: false, error: { issues: ["Missing required fields"] } };
        }
        return { success: true, data };
      },
    },
  };
});

// Import after mocking
import { recruitmentEventService } from "../service";
import { recruitmentEventsRepository } from "../repository";

describe("RecruitmentEventService", () => {
  const testContext: RecruitmentContext = {
    agentId: "zhipin-001",
    brandId: 123,
    sourcePlatform: "zhipin",
    apiSource: "web",
  };

  const mockEvent: DrizzleInsertEvent = {
    agentId: "zhipin-001",
    candidateKey: "zhipin_张三_服务员_123",
    sessionId: "zhipin-001_zhipin_张三_服务员_123_2025-12-05",
    eventType: "message_sent",
    eventTime: new Date("2025-12-05T10:30:00"),
    candidateName: "张三",
    candidatePosition: "服务员",
    eventDetails: {
      type: "message_sent",
      content: "你好",
    },
    sourcePlatform: "zhipin",
    brandId: 123,
    dataSource: DataSource.TOOL_AUTO,
    apiSource: "web",
  };

  const mockSelectEvent: DrizzleSelectEvent = {
    id: "uuid-123",
    agentId: mockEvent.agentId,
    candidateKey: mockEvent.candidateKey,
    eventType: mockEvent.eventType,
    eventTime: mockEvent.eventTime,
    eventDetails: mockEvent.eventDetails,
    sessionId: mockEvent.sessionId ?? null,
    candidateName: mockEvent.candidateName ?? null,
    candidatePosition: mockEvent.candidatePosition ?? null,
    candidateAge: null,
    candidateGender: null,
    candidateEducation: null,
    candidateExpectedSalary: null,
    candidateExpectedLocation: null,
    candidateHeight: null,
    candidateWeight: null,
    candidateHealthCert: null,
    sourcePlatform: mockEvent.sourcePlatform ?? null,
    jobId: null,
    jobName: null,
    brandId: mockEvent.brandId ?? null,
    wasUnreadBeforeReply: null,
    unreadCountBeforeReply: 0,
    messageSequence: null,
    createdAt: new Date(),
    dataSource: mockEvent.dataSource ?? null,
    apiSource: mockEvent.apiSource ?? null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("event()", () => {
    it("应该返回 RecruitmentEventBuilder 实例", () => {
      const builder = recruitmentEventService.event(testContext);
      expect(builder).toBeDefined();
      expect(typeof builder.candidate).toBe("function");
      expect(typeof builder.messageSent).toBe("function");
    });

    it("应该使用 AsyncLocalStorage 上下文", () => {
      recruitmentContext.run(testContext, () => {
        const builder = recruitmentEventService.event();
        const event = builder.candidate({ name: "测试" }).messageSent("你好");
        expect(event.agentId).toBe("zhipin-001");
      });
    });
  });

  describe("record()", () => {
    it("应该成功记录有效事件", async () => {
      vi.mocked(recruitmentEventsRepository.insert).mockResolvedValue(mockSelectEvent);

      const result = await recruitmentEventService.record(mockEvent);

      expect(result).toEqual(mockSelectEvent);
      expect(recruitmentEventsRepository.insert).toHaveBeenCalledWith(mockEvent);
    });

    it("验证失败时应返回 null", async () => {
      const invalidEvent = {
        ...mockEvent,
        agentId: "", // Invalid: empty string
      };

      const result = await recruitmentEventService.record(invalidEvent);

      expect(result).toBeNull();
      expect(recruitmentEventsRepository.insert).not.toHaveBeenCalled();
    });

    it("数据库写入失败时应返回 null", async () => {
      vi.mocked(recruitmentEventsRepository.insert).mockResolvedValue(null);

      const result = await recruitmentEventService.record(mockEvent);

      expect(result).toBeNull();
    });
  });

  describe("recordBatch()", () => {
    it("应该成功批量记录有效事件", async () => {
      vi.mocked(recruitmentEventsRepository.insertMany).mockResolvedValue(3);

      const events = [mockEvent, mockEvent, mockEvent];
      const result = await recruitmentEventService.recordBatch(events);

      expect(result).toBe(3);
      expect(recruitmentEventsRepository.insertMany).toHaveBeenCalledWith(events);
    });

    it("空数组应返回 0", async () => {
      const result = await recruitmentEventService.recordBatch([]);

      expect(result).toBe(0);
      expect(recruitmentEventsRepository.insertMany).not.toHaveBeenCalled();
    });

    it("应该过滤无效事件", async () => {
      vi.mocked(recruitmentEventsRepository.insertMany).mockResolvedValue(1);

      const invalidEvent = { ...mockEvent, agentId: "" };
      const events = [mockEvent, invalidEvent];

      await recruitmentEventService.recordBatch(events);

      // Only valid event should be passed
      expect(recruitmentEventsRepository.insertMany).toHaveBeenCalledWith([mockEvent]);
    });

    it("所有事件都无效时应返回 0", async () => {
      const invalidEvent = { ...mockEvent, agentId: "" };
      const events = [invalidEvent, invalidEvent];

      const result = await recruitmentEventService.recordBatch(events);

      expect(result).toBe(0);
      expect(recruitmentEventsRepository.insertMany).not.toHaveBeenCalled();
    });
  });

  describe("recordAsync()", () => {
    it("应该异步记录事件而不阻塞", async () => {
      vi.mocked(recruitmentEventsRepository.insert).mockResolvedValue(mockSelectEvent);

      // This should not throw
      recruitmentEventService.recordAsync(mockEvent);

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(recruitmentEventsRepository.insert).toHaveBeenCalled();
    });

    it("错误应该被静默处理", async () => {
      vi.mocked(recruitmentEventsRepository.insert).mockRejectedValue(new Error("DB Error"));

      // Should not throw
      expect(() => recruitmentEventService.recordAsync(mockEvent)).not.toThrow();

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  });

  describe("查询方法", () => {
    it("getEventsByAgentAndTimeRange 应该调用 repository", async () => {
      vi.mocked(recruitmentEventsRepository.findByAgentAndTimeRange).mockResolvedValue([
        mockSelectEvent,
      ]);

      const startTime = new Date("2025-12-01");
      const endTime = new Date("2025-12-05");

      const result = await recruitmentEventService.getEventsByAgentAndTimeRange(
        "zhipin-001",
        startTime,
        endTime
      );

      expect(result).toEqual([mockSelectEvent]);
      expect(recruitmentEventsRepository.findByAgentAndTimeRange).toHaveBeenCalledWith(
        "zhipin-001",
        startTime,
        endTime
      );
    });

    it("getEventsBySessionId 应该调用 repository", async () => {
      vi.mocked(recruitmentEventsRepository.findBySessionId).mockResolvedValue([mockSelectEvent]);

      const result = await recruitmentEventService.getEventsBySessionId("session-123");

      expect(result).toEqual([mockSelectEvent]);
      expect(recruitmentEventsRepository.findBySessionId).toHaveBeenCalledWith("session-123");
    });

    it("getEventsByCandidateKey 应该调用 repository", async () => {
      vi.mocked(recruitmentEventsRepository.findByCandidateKey).mockResolvedValue([mockSelectEvent]);

      const result = await recruitmentEventService.getEventsByCandidateKey("candidate-key", 50);

      expect(result).toEqual([mockSelectEvent]);
      expect(recruitmentEventsRepository.findByCandidateKey).toHaveBeenCalledWith(
        "candidate-key",
        50
      );
    });
  });

  describe("集成场景", () => {
    it("完整的事件记录流程", async () => {
      vi.mocked(recruitmentEventsRepository.insert).mockResolvedValue(mockSelectEvent);

      await recruitmentContext.runAsync(testContext, async () => {
        const event = recruitmentEventService
          .event()
          .candidate({ name: "张三", position: "服务员" })
          .at(new Date("2025-12-05T10:30:00"))
          .withUnreadContext(2)
          .messageSent("您好！");

        const result = await recruitmentEventService.record(event);

        expect(result).toBeDefined();
        expect(result?.id).toBe("uuid-123");
        expect(recruitmentEventsRepository.insert).toHaveBeenCalled();
      });
    });
  });
});
