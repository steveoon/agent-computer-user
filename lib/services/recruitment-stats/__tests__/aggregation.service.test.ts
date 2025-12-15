/**
 * Aggregation Service Tests
 *
 * 核心聚合逻辑测试
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { aggregationService } from "../aggregation.service";

// Mock DB
const mockDb = {
  select: vi.fn(),
};

// Mock @/db
vi.mock("@/db", () => ({
  getDb: () => mockDb,
}));

// Mock schema
vi.mock("@/db/schema", () => ({
  recruitmentEvents: {
    agentId: "agentId",
    eventTime: "eventTime",
    eventType: "eventType",
    candidateKey: "candidateKey",
    sessionId: "sessionId",
    brandId: "brandId",
    jobId: "jobId",
    unreadCountBeforeReply: "unreadCountBeforeReply",
  },
  recruitmentDailyStats: {
    agentId: "agentId",
    statDate: "statDate",
    brandId: "brandId",
    jobId: "jobId",
    isDirty: "isDirty",
  },
}));

// Mock repository
const mockMarkDirty = vi.fn().mockResolvedValue(undefined);
const mockUpsertStats = vi.fn().mockResolvedValue(undefined);
const mockFindDirtyRecords = vi.fn();
const mockGetDistinctEventDates = vi.fn();
const mockGetDistinctDimensions = vi.fn();

vi.mock("../repository", () => ({
  recruitmentStatsRepository: {
    markDirty: (...args: unknown[]) => mockMarkDirty(...args),
    upsertStats: (...args: unknown[]) => mockUpsertStats(...args),
    findDirtyRecords: (...args: unknown[]) => mockFindDirtyRecords(...args),
    getDistinctEventDates: (...args: unknown[]) => mockGetDistinctEventDates(...args),
    getDistinctDimensions: (...args: unknown[]) => mockGetDistinctDimensions(...args),
  },
  normalizeToStartOfDay: (date: Date) => {
    const normalized = new Date(date);
    normalized.setUTCHours(0, 0, 0, 0);
    return normalized;
  },
  calculateRate: (numerator: number, denominator: number) => {
    if (denominator === 0) return null;
    return Math.round((numerator / denominator) * 10000);
  },
}));

// Mock db/types
vi.mock("@/db/types", () => ({
  RecruitmentEventType: {
    CANDIDATE_CONTACTED: "candidate_contacted",
    MESSAGE_SENT: "message_sent",
    MESSAGE_RECEIVED: "message_received",
    WECHAT_EXCHANGED: "wechat_exchanged",
    INTERVIEW_BOOKED: "interview_booked",
    CANDIDATE_HIRED: "candidate_hired",
  },
}));

describe("AggregationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("aggregateSingleDay", () => {
    // Helper to setup mock select chain
    // Now handles two queries: main stats and subquery (candidatesReplied + proactiveResponded)
    const setupSelectMock = (result: Record<string, number | null>) => {
      const mockFrom = vi.fn().mockImplementation(() => ({
        where: vi.fn().mockResolvedValue([result]),
        limit: vi.fn().mockResolvedValue([{
          candidatesReplied: result.candidatesReplied ?? 0,
          proactiveResponded: result.proactiveResponded ?? 0,
        }]),
      }));
      mockDb.select.mockReturnValue({ from: mockFrom });
      return { mockFrom };
    };

    it("should aggregate events correctly for a single day", async () => {
      // Mock aggregation result
      const aggregationResult = {
        totalEvents: 100,
        uniqueCandidates: 50,
        uniqueSessions: 45,
        messagesSent: 60,
        messagesReceived: 20,
        inboundCandidates: 40,
        candidatesReplied: 35,
        unreadReplied: 25,
        proactiveOutreach: 10,
        proactiveResponded: 5,
        wechatExchanged: 15,
        interviewsBooked: 8,
        candidatesHired: 3,
      };

      setupSelectMock(aggregationResult);

      const record = {
        agentId: "test-agent",
        statDate: new Date("2025-12-10"),
        brandId: null,
        jobId: null,
      };

      await aggregationService.aggregateSingleDay(record);

      // Verify upsertStats was called with correct data
      expect(mockUpsertStats).toHaveBeenCalledTimes(1);
      const statsArg = mockUpsertStats.mock.calls[0][0];

      expect(statsArg.agentId).toBe("test-agent");
      expect(statsArg.totalEvents).toBe(100);
      expect(statsArg.uniqueCandidates).toBe(50);
      expect(statsArg.messagesSent).toBe(60);
      expect(statsArg.proactiveOutreach).toBe(10);
      expect(statsArg.wechatExchanged).toBe(15);
      expect(statsArg.interviewsBooked).toBe(8);
      expect(statsArg.candidatesHired).toBe(3);

      // Verify rates are calculated correctly (candidatesReplied/inboundCandidates * 10000)
      // 35/40 = 0.875 -> 8750
      expect(statsArg.replyRate).toBe(8750);
      // 15/40 = 0.375 -> 3750
      expect(statsArg.wechatRate).toBe(3750);
      // 8/40 = 0.2 -> 2000
      expect(statsArg.interviewRate).toBe(2000);
    });

    it("should handle zero inbound candidates (avoid division by zero)", async () => {
      const aggregationResult = {
        totalEvents: 10,
        uniqueCandidates: 5,
        uniqueSessions: 5,
        messagesSent: 10,
        messagesReceived: 0,
        inboundCandidates: 0, // Zero inbound
        candidatesReplied: 0,
        unreadReplied: 0,
        proactiveOutreach: 5,
        proactiveResponded: 0,
        wechatExchanged: 0,
        interviewsBooked: 0,
        candidatesHired: 0,
      };

      setupSelectMock(aggregationResult);

      const record = {
        agentId: "test-agent",
        statDate: new Date("2025-12-10"),
        brandId: null,
        jobId: null,
      };

      await aggregationService.aggregateSingleDay(record);

      const statsArg = mockUpsertStats.mock.calls[0][0];

      // Rates should be null when denominator is zero
      expect(statsArg.replyRate).toBeNull();
      expect(statsArg.wechatRate).toBeNull();
      expect(statsArg.interviewRate).toBeNull();
    });

    it("should handle null values from database", async () => {
      const aggregationResult = {
        totalEvents: null,
        uniqueCandidates: null,
        uniqueSessions: null,
        messagesSent: null,
        messagesReceived: null,
        inboundCandidates: null,
        candidatesReplied: null,
        unreadReplied: null,
        proactiveOutreach: null,
        proactiveResponded: null,
        wechatExchanged: null,
        interviewsBooked: null,
        candidatesHired: null,
      };

      setupSelectMock(aggregationResult);

      const record = {
        agentId: "test-agent",
        statDate: new Date("2025-12-10"),
        brandId: 8,
        jobId: 123,
      };

      await aggregationService.aggregateSingleDay(record);

      const statsArg = mockUpsertStats.mock.calls[0][0];

      // All numeric values should default to 0
      expect(statsArg.totalEvents).toBe(0);
      expect(statsArg.uniqueCandidates).toBe(0);
      expect(statsArg.messagesSent).toBe(0);
      expect(statsArg.wechatExchanged).toBe(0);

      // brandId and jobId should be preserved
      expect(statsArg.brandId).toBe(8);
      expect(statsArg.jobId).toBe(123);
    });
  });

  describe("processDirtyRecords", () => {
    it("should process all dirty records", async () => {
      // Mock dirty records
      const dirtyRecords = [
        { agentId: "agent-1", statDate: new Date("2025-12-10"), brandId: null, jobId: null },
        { agentId: "agent-2", statDate: new Date("2025-12-10"), brandId: 8, jobId: null },
      ];
      mockFindDirtyRecords.mockResolvedValue(dirtyRecords);

      // Mock aggregation query (handles both main stats and subquery)
      const mockResult = {
        totalEvents: 10,
        uniqueCandidates: 5,
        uniqueSessions: 5,
        messagesSent: 8,
        messagesReceived: 2,
        inboundCandidates: 4,
        candidatesReplied: 3,
        unreadReplied: 2,
        proactiveOutreach: 2,
        proactiveResponded: 1,
        wechatExchanged: 1,
        interviewsBooked: 1,
        candidatesHired: 0,
      };
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([mockResult]),
        limit: vi.fn().mockResolvedValue([{ candidatesReplied: 3, proactiveResponded: 1 }]),
      });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const result = await aggregationService.processDirtyRecords(50);

      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(mockUpsertStats).toHaveBeenCalledTimes(2);
    });

    it("should return empty result when no dirty records", async () => {
      mockFindDirtyRecords.mockResolvedValue([]);

      const result = await aggregationService.processDirtyRecords(50);

      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(0);
      expect(result.failedCount).toBe(0);
    });

    it("should track failed aggregations", async () => {
      const dirtyRecords = [
        { agentId: "agent-1", statDate: new Date("2025-12-10"), brandId: null, jobId: null },
      ];
      mockFindDirtyRecords.mockResolvedValue(dirtyRecords);

      // Mock failure
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error("DB Error")),
        limit: vi.fn().mockRejectedValue(new Error("DB Error")),
      });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const result = await aggregationService.processDirtyRecords(50);

      expect(result.success).toBe(false);
      expect(result.processedCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe("fullReaggregation", () => {
    it("should re-aggregate all historical data for an agent", async () => {
      // Mock distinct dates
      mockGetDistinctEventDates.mockResolvedValue([
        new Date("2025-12-08"),
        new Date("2025-12-09"),
        new Date("2025-12-10"),
      ]);

      // Mock dimensions (no brand/job dimensions)
      mockGetDistinctDimensions.mockResolvedValue([]);

      // Mock aggregation query (handles both main stats and subquery)
      const mockResult = {
        totalEvents: 10,
        uniqueCandidates: 5,
        uniqueSessions: 5,
        messagesSent: 8,
        messagesReceived: 2,
        inboundCandidates: 4,
        candidatesReplied: 3,
        unreadReplied: 2,
        proactiveOutreach: 2,
        proactiveResponded: 1,
        wechatExchanged: 1,
        interviewsBooked: 1,
        candidatesHired: 0,
      };
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([mockResult]),
        limit: vi.fn().mockResolvedValue([{ candidatesReplied: 3, proactiveResponded: 1 }]),
      });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const result = await aggregationService.fullReaggregation("test-agent");

      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(3); // 3 days
      expect(mockGetDistinctEventDates).toHaveBeenCalledWith("test-agent");
    });
  });
});
