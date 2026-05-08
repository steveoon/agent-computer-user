import { z } from "zod/v3";
import {
  ApiSource,
  DataSource,
  RecruitmentEventType,
  SourcePlatform,
  WechatExchangeType,
  type DataSourceValue,
  type SourcePlatformValue,
  type WechatExchangeTypeValue,
} from "@/db/types";
import { extractBrandIdFromJobName } from "./brand-lookup";
import { parseAge, parseSalary } from "./candidate-parser";
import { recruitmentEventService } from "./service";
import { recruitmentEventsRepository, type DrizzleInsertEvent, type DrizzleSelectEvent } from "./repository";
import { recruitmentStatsRepository } from "@/lib/services/recruitment-stats";
import { isAgentAllowed } from "@/lib/utils/open-api-agent-auth";
import type { DirtyRecord } from "@/lib/services/recruitment-stats/types";
import type { RecruitmentContext } from "./types";

const MAX_BATCH_SIZE = 100;
const MAX_FUTURE_MS = 5 * 60 * 1000;
const MAX_PAST_MS = 90 * 24 * 60 * 60 * 1000;

const candidateSchema = z.object({
  name: z.string().min(1).max(100),
  position: z.string().max(100).optional(),
  age: z.string().max(20).optional(),
  gender: z.string().max(10).optional(),
  education: z.string().max(50).optional(),
  expectedSalary: z.string().max(50).optional(),
  expectedLocation: z.string().max(100).optional(),
  height: z.string().max(20).optional(),
  weight: z.string().max(20).optional(),
  healthCert: z.boolean().optional(),
});

const jobSchema = z.object({
  jobId: z.number().int().optional(),
  jobName: z.string().max(100).optional(),
});

const baseEventSchema = z.object({
  idempotencyKey: z.string().min(1).max(128).optional(),
  agentId: z.string().min(1).max(50),
  sourcePlatform: z
    .enum([SourcePlatform.ZHIPIN, SourcePlatform.YUPAO, SourcePlatform.DULIDAY])
    .default(SourcePlatform.ZHIPIN),
  dataSource: z.enum([DataSource.API_CALLBACK, DataSource.MANUAL]).default(DataSource.API_CALLBACK),
  eventTime: z.string().optional(),
  candidate: candidateSchema,
  job: jobSchema.optional(),
  brandId: z.number().int().optional(),
});

const openApiEventSchema = z.discriminatedUnion("eventType", [
  baseEventSchema.extend({
    eventType: z.literal(RecruitmentEventType.MESSAGE_SENT),
    details: z.object({
      content: z.string().min(1),
      isAutoReply: z.boolean().optional(),
      unreadCountBeforeReply: z.number().int().min(0).optional(),
    }),
  }),
  baseEventSchema.extend({
    eventType: z.literal(RecruitmentEventType.MESSAGE_RECEIVED),
    details: z.object({
      unreadCount: z.number().int().min(0).optional(),
      lastMessagePreview: z.string().optional(),
    }).optional().default({}),
  }),
  baseEventSchema.extend({
    eventType: z.literal(RecruitmentEventType.WECHAT_EXCHANGED),
    details: z.object({
      wechatNumber: z.string().optional(),
      exchangeType: z
        .enum([
          WechatExchangeType.REQUESTED,
          WechatExchangeType.ACCEPTED,
          WechatExchangeType.COMPLETED,
        ])
        .optional(),
    }).optional().default({}),
  }),
  baseEventSchema.extend({
    eventType: z.literal(RecruitmentEventType.INTERVIEW_BOOKED),
    details: z.object({
      interviewTime: z.string().min(1),
      address: z.string().optional(),
      candidatePhone: z.string().optional(),
    }),
  }),
  baseEventSchema.extend({
    eventType: z.literal(RecruitmentEventType.CANDIDATE_CONTACTED),
    details: z.object({}).optional().default({}),
  }),
  baseEventSchema.extend({
    eventType: z.literal(RecruitmentEventType.CANDIDATE_HIRED),
    details: z.object({
      hireDate: z.string().optional(),
      notes: z.string().optional(),
    }).optional().default({}),
  }),
]);

const openApiBatchSchema = z.object({
  events: z.array(z.unknown()).min(1).max(MAX_BATCH_SIZE),
});

export type OpenApiRecruitmentEventInput = z.infer<typeof openApiEventSchema>;

export type OpenApiRecruitmentEventResult =
  | {
      idempotencyKey?: string;
      status: "created" | "existing";
      eventId: string;
      agentId: string;
      eventType: string;
      eventTime: string;
      candidateKey: string;
      candidateName: string | null;
      sessionId: string | null;
      sourcePlatform: string | null;
      jobId: number | null;
      jobName: string | null;
      apiSource: string | null;
      dataSource: string | null;
    }
  | {
      idempotencyKey?: string;
      status: "error";
      error: {
        code: string;
        message: string;
      };
    };

export interface ProcessOpenApiRecruitmentEventsResult {
  results: OpenApiRecruitmentEventResult[];
}

type ParsedItem =
  | { index: number; success: true; event: OpenApiRecruitmentEventInput }
  | { index: number; success: false; idempotencyKey?: string; code: string; message: string };

export function parseOpenApiRecruitmentEventsBody(body: unknown): unknown[] {
  return openApiBatchSchema.parse(body).events;
}

export async function processOpenApiRecruitmentEvents(
  rawEvents: unknown[],
  allowedAgentIds: readonly string[]
): Promise<ProcessOpenApiRecruitmentEventsResult> {
  const parsedItems = rawEvents.map(parseItem);
  const brandMap = await resolveBrandIds(parsedItems, allowedAgentIds);
  const results = new Array<OpenApiRecruitmentEventResult>(rawEvents.length);
  const dirtyRecords: DirtyRecord[] = [];

  for (const item of parsedItems) {
    if (!item.success) {
      results[item.index] = errorResult(item.idempotencyKey, item.code, item.message);
      continue;
    }

    const result = await processOneEvent(item.event, allowedAgentIds, brandMap);
    results[item.index] = result.result;
    if (result.inserted) {
      dirtyRecords.push(...buildDirtyRecords(result.inserted));
    }
  }

  await recruitmentStatsRepository.markDirtyBatch(dirtyRecords);

  return { results };
}

function parseItem(raw: unknown, index: number): ParsedItem {
  const idempotencyKey = extractIdempotencyKey(raw);
  const parsed = openApiEventSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      index,
      success: false,
      idempotencyKey,
      code: "InvalidEvent",
      message: parsed.error.issues.map(issue => issue.message).join("; "),
    };
  }

  return { index, success: true, event: parsed.data };
}

function extractIdempotencyKey(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object" || !("idempotencyKey" in raw)) return undefined;
  const value = (raw as { idempotencyKey?: unknown }).idempotencyKey;
  return typeof value === "string" ? value : undefined;
}

async function resolveBrandIds(
  parsedItems: ParsedItem[],
  allowedAgentIds: readonly string[]
): Promise<Map<string, number | undefined>> {
  const jobNames = new Set<string>();

  for (const item of parsedItems) {
    if (
      item.success &&
      isAgentAllowed(item.event.agentId, allowedAgentIds) &&
      parseAndValidateEventTime(item.event.eventTime).valid &&
      item.event.brandId === undefined &&
      item.event.job?.jobName
    ) {
      jobNames.add(item.event.job.jobName);
    }
  }

  const entries = await Promise.all(
    Array.from(jobNames).map(async jobName => {
      try {
        return [jobName, await extractBrandIdFromJobName(jobName)] as const;
      } catch (error) {
        console.warn("[RecruitmentEvent][OpenAPI] Brand lookup failed:", {
          jobName,
          error,
        });
        return [jobName, undefined] as const;
      }
    })
  );

  return new Map(entries);
}

async function processOneEvent(
  event: OpenApiRecruitmentEventInput,
  allowedAgentIds: readonly string[],
  brandMap: ReadonlyMap<string, number | undefined>
): Promise<{ result: OpenApiRecruitmentEventResult; inserted?: DrizzleSelectEvent }> {
  if (!isAgentAllowed(event.agentId, allowedAgentIds)) {
    return {
      result: errorResult(
        event.idempotencyKey,
        "ForbiddenAgent",
        `Agent '${event.agentId}' is not authorized for this API key`
      ),
    };
  }

  const eventTime = parseAndValidateEventTime(event.eventTime);
  if (!eventTime.valid) {
    return {
      result: errorResult(event.idempotencyKey, eventTime.code, eventTime.message),
    };
  }

  if (event.idempotencyKey) {
    const existing = await recruitmentEventsRepository.findByIdempotencyKey(
      event.agentId,
      event.idempotencyKey
    );
    if (existing) {
      return { result: existingResult(existing) };
    }
  }

  const insertEvent = await buildInsertEvent(event, eventTime.value, brandMap);

  try {
    const inserted = await recruitmentEventsRepository.insertStrict(insertEvent);
    return { result: createdResult(inserted), inserted };
  } catch (error) {
    if (event.idempotencyKey && isUniqueViolation(error)) {
      const existing = await recruitmentEventsRepository.findByIdempotencyKey(
        event.agentId,
        event.idempotencyKey
      );
      if (existing) {
        return { result: existingResult(existing) };
      }
    }

    console.error("[RecruitmentEvent][OpenAPI] Insert failed:", error);

    return {
      result: errorResult(
        event.idempotencyKey,
        "InsertFailed",
        "Failed to insert recruitment event"
      ),
    };
  }
}

async function buildInsertEvent(
  input: OpenApiRecruitmentEventInput,
  eventTime: Date,
  brandMap: ReadonlyMap<string, number | undefined>
): Promise<DrizzleInsertEvent> {
  const jobName = input.job?.jobName;
  const brandId = input.brandId ?? (jobName ? brandMap.get(jobName) : undefined);
  const candidatePosition = input.candidate.position ?? jobName;
  const context: RecruitmentContext = {
    agentId: input.agentId,
    sourcePlatform: input.sourcePlatform as SourcePlatformValue,
    apiSource: ApiSource.OPEN_API,
    brandId,
    jobId: input.job?.jobId,
    jobName,
  };

  const builder = recruitmentEventService
    .event(context)
    .withDataSource(input.dataSource as DataSourceValue)
    .withIdempotencyKey(input.idempotencyKey)
    .candidate({
      name: input.candidate.name,
      position: candidatePosition,
      age: parseAge(input.candidate.age),
      gender: input.candidate.gender,
      education: input.candidate.education,
      expectedSalary: parseSalary(input.candidate.expectedSalary),
      expectedLocation: input.candidate.expectedLocation,
      height: input.candidate.height,
      weight: input.candidate.weight,
      healthCert: input.candidate.healthCert,
    })
    .at(eventTime);

  if (input.job?.jobName) {
    builder.forJob(input.job.jobId ?? 0, input.job.jobName);
  }
  if (brandId) {
    builder.forBrand(brandId);
  }

  switch (input.eventType) {
    case "message_sent": {
      builder.withUnreadContext(input.details.unreadCountBeforeReply ?? 0);
      const probe = builder.messageSent(input.details.content, {
        isAutoReply: input.details.isAutoReply,
      });
      const messageSequence = await recruitmentEventService.getNextMessageSequence(
        probe.sessionId ?? ""
      );
      return {
        ...probe,
        messageSequence,
      };
    }
    case "message_received":
      builder.withUnreadContext(input.details.unreadCount ?? 0);
      return builder.messageReceived(input.details.unreadCount ?? 0, input.details.lastMessagePreview);
    case "wechat_exchanged":
      return builder.wechatExchanged(
        input.details.wechatNumber,
        input.details.exchangeType as WechatExchangeTypeValue | undefined
      );
    case "interview_booked":
      return builder.interviewBooked({
        interviewTime: input.details.interviewTime,
        address: input.details.address,
        candidatePhone: input.details.candidatePhone,
      });
    case "candidate_contacted":
      return builder.candidateContacted();
    case "candidate_hired":
      return builder.candidateHired(input.details.hireDate, input.details.notes);
  }
}

function parseAndValidateEventTime(
  eventTime?: string
):
  | { valid: true; value: Date }
  | { valid: false; code: "InvalidEventTime"; message: string } {
  const parsed = eventTime ? new Date(eventTime) : new Date();

  if (Number.isNaN(parsed.getTime())) {
    return {
      valid: false,
      code: "InvalidEventTime",
      message: "eventTime must be a valid date string",
    };
  }

  const now = Date.now();
  if (parsed.getTime() > now + MAX_FUTURE_MS) {
    return {
      valid: false,
      code: "InvalidEventTime",
      message: "eventTime cannot be more than 5 minutes in the future",
    };
  }
  if (parsed.getTime() < now - MAX_PAST_MS) {
    return {
      valid: false,
      code: "InvalidEventTime",
      message: "eventTime cannot be older than 90 days",
    };
  }

  return { valid: true, value: parsed };
}

function buildDirtyRecords(event: DrizzleSelectEvent): DirtyRecord[] {
  const records: DirtyRecord[] = [
    {
      agentId: event.agentId,
      statDate: event.eventTime,
      brandId: null,
      jobId: null,
    },
  ];

  if (event.brandId !== null || event.jobId !== null) {
    records.push({
      agentId: event.agentId,
      statDate: event.eventTime,
      brandId: event.brandId,
      jobId: event.jobId,
    });
  }

  return records;
}

function createdResult(event: DrizzleSelectEvent): OpenApiRecruitmentEventResult {
  return eventResult(event, "created");
}

function existingResult(event: DrizzleSelectEvent): OpenApiRecruitmentEventResult {
  return eventResult(event, "existing");
}

function eventResult(
  event: DrizzleSelectEvent,
  status: "created" | "existing"
): OpenApiRecruitmentEventResult {
  return {
    idempotencyKey: event.idempotencyKey ?? undefined,
    status,
    eventId: event.id,
    agentId: event.agentId,
    eventType: event.eventType,
    eventTime: event.eventTime.toISOString(),
    candidateKey: event.candidateKey,
    candidateName: event.candidateName,
    sessionId: event.sessionId,
    sourcePlatform: event.sourcePlatform,
    jobId: event.jobId,
    jobName: event.jobName,
    apiSource: event.apiSource,
    dataSource: event.dataSource,
  };
}

function errorResult(
  idempotencyKey: string | undefined,
  code: string,
  message: string
): OpenApiRecruitmentEventResult {
  return {
    idempotencyKey,
    status: "error",
    error: { code, message },
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}
