import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecruitmentEventType } from "@/db/types";
import type { DrizzleInsertEvent, DrizzleSelectEvent } from "../repository";

const mockFindByIdempotencyKey = vi.fn();
const mockInsertStrict = vi.fn();
const mockGetMaxMessageSequence = vi.fn();
const mockMarkDirtyBatch = vi.fn();
const mockExtractBrandIdFromJobName = vi.fn();

vi.mock("../repository", () => ({
  recruitmentEventsRepository: {
    findByIdempotencyKey: mockFindByIdempotencyKey,
    insertStrict: mockInsertStrict,
    getMaxMessageSequence: mockGetMaxMessageSequence,
  },
}));

vi.mock("@/lib/services/recruitment-stats", () => ({
  recruitmentStatsRepository: {
    markDirtyBatch: mockMarkDirtyBatch,
  },
}));

vi.mock("../brand-lookup", () => ({
  extractBrandIdFromJobName: mockExtractBrandIdFromJobName,
}));

function selectFromInsert(event: DrizzleInsertEvent, id: string): DrizzleSelectEvent {
  return {
    id,
    agentId: event.agentId,
    candidateKey: event.candidateKey,
    sessionId: event.sessionId ?? null,
    eventType: event.eventType,
    eventTime: event.eventTime,
    candidateName: event.candidateName ?? null,
    candidatePosition: event.candidatePosition ?? null,
    candidateAge: event.candidateAge ?? null,
    candidateGender: event.candidateGender ?? null,
    candidateEducation: event.candidateEducation ?? null,
    candidateExpectedSalary: event.candidateExpectedSalary ?? null,
    candidateExpectedLocation: event.candidateExpectedLocation ?? null,
    candidateHeight: event.candidateHeight ?? null,
    candidateWeight: event.candidateWeight ?? null,
    candidateHealthCert: event.candidateHealthCert ?? null,
    eventDetails: event.eventDetails ?? null,
    sourcePlatform: event.sourcePlatform ?? null,
    jobId: event.jobId ?? null,
    jobName: event.jobName ?? null,
    brandId: event.brandId ?? null,
    wasUnreadBeforeReply: event.wasUnreadBeforeReply ?? null,
    unreadCountBeforeReply: event.unreadCountBeforeReply ?? 0,
    messageSequence: event.messageSequence ?? null,
    createdAt: new Date("2026-05-07T02:00:00Z"),
    dataSource: event.dataSource ?? null,
    apiSource: event.apiSource ?? null,
    idempotencyKey: event.idempotencyKey ?? null,
  };
}

describe("processOpenApiRecruitmentEvents", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-07T02:00:00Z"));
    vi.clearAllMocks();
    mockGetMaxMessageSequence.mockResolvedValue(0);
    mockExtractBrandIdFromJobName.mockResolvedValue(88);
    mockInsertStrict.mockImplementation(async (event: DrizzleInsertEvent) =>
      selectFromInsert(event, `event-${event.idempotencyKey ?? "no-key"}`)
    );
  });

  it("rejects unauthorized agentId per item", async () => {
    const { processOpenApiRecruitmentEvents } = await import("../open-api");

    const result = await processOpenApiRecruitmentEvents(
      [
        {
          idempotencyKey: "evt-1",
          agentId: "zhipin-2",
          eventType: RecruitmentEventType.CANDIDATE_CONTACTED,
          eventTime: "2026-05-07T10:00:00+08:00",
          candidate: { name: "张三" },
          job: { jobName: "肯德基服务员" },
        },
      ],
      ["zhipin-1"]
    );

    expect(result.results[0]).toMatchObject({
      status: "error",
      error: { code: "ForbiddenAgent" },
    });
    expect(mockInsertStrict).not.toHaveBeenCalled();
    expect(mockExtractBrandIdFromJobName).not.toHaveBeenCalled();
  });

  it("returns existing when idempotencyKey already exists", async () => {
    const { processOpenApiRecruitmentEvents } = await import("../open-api");
    const existing = selectFromInsert(
      {
        agentId: "zhipin-1",
        candidateKey: "zhipin_张三",
        eventType: "candidate_contacted",
        eventTime: new Date("2026-05-07T02:00:00Z"),
        idempotencyKey: "evt-existing",
      },
      "event-existing"
    );
    mockFindByIdempotencyKey.mockResolvedValueOnce(existing);

    const result = await processOpenApiRecruitmentEvents(
      [
        {
          idempotencyKey: "evt-existing",
          agentId: "zhipin-1",
          eventType: RecruitmentEventType.CANDIDATE_CONTACTED,
          eventTime: "2026-05-07T10:00:00+08:00",
          candidate: { name: "张三" },
        },
      ],
      ["zhipin-1"]
    );

    expect(result.results[0]).toMatchObject({
      status: "existing",
      eventId: "event-existing",
      agentId: "zhipin-1",
      eventType: RecruitmentEventType.CANDIDATE_CONTACTED,
      eventTime: "2026-05-07T02:00:00.000Z",
      candidateName: null,
    });
    expect(mockInsertStrict).not.toHaveBeenCalled();
    expect(mockMarkDirtyBatch).toHaveBeenCalledWith([]);
  });

  it("deduplicates brand lookup and dirty records for batch writes", async () => {
    const { processOpenApiRecruitmentEvents } = await import("../open-api");

    const result = await processOpenApiRecruitmentEvents(
      [
        {
          idempotencyKey: "evt-1",
          agentId: "zhipin-1",
          eventType: RecruitmentEventType.MESSAGE_SENT,
          eventTime: "2026-05-07T10:00:00+08:00",
          candidate: { name: "张三" },
          job: { jobId: 7, jobName: "肯德基服务员" },
          details: { content: "您好", unreadCountBeforeReply: 1 },
        },
        {
          idempotencyKey: "evt-2",
          agentId: "zhipin-1",
          eventType: RecruitmentEventType.MESSAGE_SENT,
          eventTime: "2026-05-07T10:01:00+08:00",
          candidate: { name: "李四" },
          job: { jobId: 7, jobName: "肯德基服务员" },
          details: { content: "您好", unreadCountBeforeReply: 0 },
        },
      ],
      ["zhipin-1"]
    );

    expect(result.results).toHaveLength(2);
    expect(result.results.every(item => item.status === "created")).toBe(true);
    expect(result.results[0]).toMatchObject({
      status: "created",
      agentId: "zhipin-1",
      eventType: RecruitmentEventType.MESSAGE_SENT,
      eventTime: "2026-05-07T02:00:00.000Z",
      candidateName: "张三",
      jobId: 7,
      jobName: "肯德基服务员",
      apiSource: "open_api",
      dataSource: "api_callback",
    });
    expect(mockExtractBrandIdFromJobName).toHaveBeenCalledTimes(1);
    expect(mockExtractBrandIdFromJobName).toHaveBeenCalledWith("肯德基服务员");

    const dirtyRecords = mockMarkDirtyBatch.mock.calls[0][0] as Array<{
      agentId: string;
      brandId: number | null;
      jobId: number | null;
    }>;
    expect(dirtyRecords).toEqual([
      expect.objectContaining({ agentId: "zhipin-1", brandId: null, jobId: null }),
      expect.objectContaining({ agentId: "zhipin-1", brandId: 88, jobId: 7 }),
      expect.objectContaining({ agentId: "zhipin-1", brandId: null, jobId: null }),
      expect.objectContaining({ agentId: "zhipin-1", brandId: 88, jobId: 7 }),
    ]);
  });

  it("continues writing when brand lookup fails", async () => {
    const { processOpenApiRecruitmentEvents } = await import("../open-api");
    mockExtractBrandIdFromJobName.mockRejectedValueOnce(new Error("lookup unavailable"));

    const result = await processOpenApiRecruitmentEvents(
      [
        {
          idempotencyKey: "evt-brand-fail",
          agentId: "zhipin-1",
          eventType: RecruitmentEventType.CANDIDATE_CONTACTED,
          eventTime: "2026-05-07T10:00:00+08:00",
          candidate: { name: "张三" },
          job: { jobId: 7, jobName: "未知品牌服务员" },
        },
      ],
      ["zhipin-1"]
    );

    expect(result.results[0]).toMatchObject({ status: "created" });
    expect(mockInsertStrict).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "evt-brand-fail",
        brandId: undefined,
      })
    );
  });

  it("rejects eventTime outside allowed range", async () => {
    const { processOpenApiRecruitmentEvents } = await import("../open-api");

    const result = await processOpenApiRecruitmentEvents(
      [
        {
          idempotencyKey: "evt-future",
          agentId: "zhipin-1",
          eventType: RecruitmentEventType.CANDIDATE_CONTACTED,
          eventTime: "2026-05-07T10:06:00+08:00",
          candidate: { name: "张三" },
          job: { jobName: "肯德基服务员" },
        },
      ],
      ["zhipin-1"]
    );

    expect(result.results[0]).toMatchObject({
      status: "error",
      error: { code: "InvalidEventTime" },
    });
    expect(mockInsertStrict).not.toHaveBeenCalled();
    expect(mockExtractBrandIdFromJobName).not.toHaveBeenCalled();
  });
});
