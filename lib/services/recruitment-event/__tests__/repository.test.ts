/**
 * Recruitment Events Repository Tests
 *
 * Tests for database operations and retry logic.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { recruitmentEventsRepository } from "../repository";

// Mock dependencies
const mockDb = {
  insert: vi.fn(),
  select: vi.fn(),
};

// Mock @/db
vi.mock("@/db", () => ({
  getDb: () => mockDb,
}));

// Mock @/db/schema
vi.mock("@/db/schema", () => ({
  recruitmentEvents: {
    id: "id",
    agentId: "agentId",
    eventTime: "eventTime",
    sessionId: "sessionId",
    candidateKey: "candidateKey",
    $inferInsert: {},
    $inferSelect: {},
  },
}));

describe("RecruitmentEventsRepository", () => {
  const mockEvent = {
    agentId: "test-agent",
    eventType: "message_sent",
    // other fields omitted for brevity
  } as any;

  const mockResult = {
    id: "uuid-123",
    ...mockEvent,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations
    mockDb.insert.mockReturnThis();
    mockDb.select.mockReturnThis();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("insert (withRetry)", () => {
    it("should insert successfully on first attempt", async () => {
      // Mock chain: insert().values().returning()
      const mockReturning = vi.fn().mockResolvedValue([mockResult]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      mockDb.insert.mockReturnValue({ values: mockValues });

      const result = await recruitmentEventsRepository.insert(mockEvent);

      expect(result).toEqual(mockResult);
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      expect(mockValues).toHaveBeenCalledWith(mockEvent);
    });

    it("should retry on failure and succeed", async () => {
      vi.useFakeTimers();

      // Setup mock to fail once then succeed
      const mockReturning = vi
        .fn()
        .mockRejectedValueOnce(new Error("DB Connection Error"))
        .mockResolvedValueOnce([mockResult]);

      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      mockDb.insert.mockReturnValue({ values: mockValues });

      // Start the operation
      const promise = recruitmentEventsRepository.insert(mockEvent);

      // Fast-forward time for retry delay (500ms)
      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toEqual(mockResult);
      // Should have been called twice
      expect(mockValues).toHaveBeenCalledTimes(2);
    });

    it("should return null after exhausting retries", async () => {
      vi.useFakeTimers();

      // Setup mock to always fail
      const mockReturning = vi.fn().mockRejectedValue(new Error("Persistent DB Error"));
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      mockDb.insert.mockReturnValue({ values: mockValues });

      const promise = recruitmentEventsRepository.insert(mockEvent);

      // Fast-forward through all retries
      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBeNull();
      // Initial + 2 retries = 3 calls
      expect(mockValues).toHaveBeenCalledTimes(3);
    });
  });

  describe("insertMany", () => {
    it("should handle empty array", async () => {
      const result = await recruitmentEventsRepository.insertMany([]);
      expect(result).toBe(0);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("should insert multiple events successfully", async () => {
      const events = [mockEvent, mockEvent];
      const mockReturning = vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      mockDb.insert.mockReturnValue({ values: mockValues });

      const result = await recruitmentEventsRepository.insertMany(events);

      expect(result).toBe(2);
      expect(mockValues).toHaveBeenCalledWith(events);
    });
  });

  describe("Query Methods", () => {
    // Helper to mock select chain
    const setupSelectMock = (result: any[]) => {
      const mockLimit = vi.fn().mockResolvedValue(result);

      // Object returned by orderBy(), which supports .limit() and is also awaitable
      const orderByReturn = {
        limit: mockLimit,
        then: (resolve: (value: any) => void, reject: (reason?: any) => void) =>
          Promise.resolve(result).then(resolve, reject),
      };

      const mockOrderBy = vi.fn().mockReturnValue(orderByReturn);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      return { mockFrom, mockWhere, mockOrderBy, mockLimit };
    };

    it("findByAgentAndTimeRange should construct correct query", async () => {
      const { mockWhere } = setupSelectMock([mockResult]);

      await recruitmentEventsRepository.findByAgentAndTimeRange(
        "agent-1",
        new Date("2025-01-01"),
        new Date("2025-01-02")
      );

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
    });

    it("findBySessionId should construct correct query", async () => {
      const { mockWhere } = setupSelectMock([mockResult]);

      await recruitmentEventsRepository.findBySessionId("session-1");

      expect(mockWhere).toHaveBeenCalled();
    });

    it("findByCandidateKey should apply limit", async () => {
      const { mockLimit } = setupSelectMock([mockResult]);

      await recruitmentEventsRepository.findByCandidateKey("key-1", 50);

      expect(mockLimit).toHaveBeenCalledWith(50);
    });
  });
});
