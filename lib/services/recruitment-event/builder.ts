/**
 * Recruitment Event Builder
 *
 * Type-safe builder for constructing recruitment events with chain-style API.
 *
 * @example
 * ```typescript
 * const event = new RecruitmentEventBuilder(context)
 *   .candidate({ name: "张三", position: "服务员" })
 *   .at(new Date())
 *   .withUnreadContext(3)
 *   .messageSent("您好，请问方便加一下微信吗？");
 * ```
 */

import {
  RecruitmentEventType,
  DataSource,
  ApiSource,
  generateCandidateKey,
  generateSessionId,
  type RecruitmentEventTypeValue,
  type SourcePlatformValue,
  type EventDetails,
} from "@/db/types";
import { recruitmentContext } from "./context";
import type { DrizzleInsertEvent } from "./repository";
import type {
  RecruitmentContext,
  CandidateSnapshot,
  MessageSentOptions,
  InterviewBookingDetails,
  MessageSenderType,
} from "./types";

export class RecruitmentEventBuilder {
  private data: Partial<DrizzleInsertEvent> = {};
  private context: RecruitmentContext;

  /**
   * Create a new event builder
   *
   * @param context - Optional explicit context. If not provided, uses AsyncLocalStorage context.
   * @throws Error if no context is available
   */
  constructor(context?: RecruitmentContext) {
    this.context = context || recruitmentContext.requireContext();

    // Auto-fill context fields
    this.data.agentId = this.context.agentId;
    this.data.sourcePlatform = this.context.sourcePlatform;
    this.data.brandId = this.context.brandId;
    this.data.jobId = this.context.jobId;
    this.data.jobName = this.context.jobName;
    this.data.dataSource = DataSource.TOOL_AUTO;
    this.data.apiSource = this.context.apiSource || ApiSource.WEB;
  }

  /**
   * Set candidate information snapshot
   *
   * @param snapshot - Candidate data to record
   * @returns this for chaining
   */
  candidate(snapshot: CandidateSnapshot): this {
    this.data.candidateName = snapshot.name;
    this.data.candidatePosition = snapshot.position;
    this.data.candidateAge = snapshot.age;
    this.data.candidateGender = snapshot.gender;
    this.data.candidateEducation = snapshot.education;
    this.data.candidateExpectedSalary = snapshot.expectedSalary;
    this.data.candidateExpectedLocation = snapshot.expectedLocation;
    this.data.candidateHeight = snapshot.height;
    this.data.candidateWeight = snapshot.weight;
    this.data.candidateHealthCert = snapshot.healthCert;
    return this;
  }

  /**
   * Set event time
   *
   * @param time - When the event occurred
   * @returns this for chaining
   */
  at(time: Date): this {
    this.data.eventTime = time;
    return this;
  }

  /**
   * Set unread context for tracking Unread Replied metrics
   *
   * @param unreadCount - Number of unread messages before this action
   * @returns this for chaining
   */
  withUnreadContext(unreadCount: number): this {
    this.data.wasUnreadBeforeReply = unreadCount > 0;
    this.data.unreadCountBeforeReply = unreadCount;
    return this;
  }

  /**
   * Set message sequence number
   *
   * @param sequence - Position in the conversation
   * @returns this for chaining
   */
  withMessageSequence(sequence: number): this {
    this.data.messageSequence = sequence;
    return this;
  }

  /**
   * Override job information (if different from context)
   *
   * @param jobId - Job ID
   * @param jobName - Job name
   * @returns this for chaining
   */
  forJob(jobId: number, jobName?: string): this {
    this.data.jobId = jobId;
    if (jobName) {
      this.data.jobName = jobName;
    }
    return this;
  }

  /**
   * Override brand (if different from context)
   *
   * @param brandId - Brand ID
   * @returns this for chaining
   */
  forBrand(brandId: number): this {
    this.data.brandId = brandId;
    return this;
  }

  /**
   * Override source platform (if different from context)
   *
   * Useful when the tool knows the specific platform (e.g., yupao, zhipin)
   * but the context might have a default or different value.
   *
   * @param platform - Source platform identifier
   * @returns this for chaining
   *
   * @example
   * ```typescript
   * builder.forPlatform(SourcePlatform.YUPAO).candidate({ name: "张三" });
   * ```
   */
  forPlatform(platform: SourcePlatformValue): this {
    this.data.sourcePlatform = platform;
    return this;
  }

  /**
   * Create a MESSAGE_SENT event
   *
   * @param content - Message content
   * @param options - Additional options
   * @returns Complete event ready for insertion
   */
  messageSent(content: string, options?: MessageSentOptions): DrizzleInsertEvent {
    return this.finalize({
      eventType: RecruitmentEventType.MESSAGE_SENT,
      eventDetails: {
        type: "message_sent",
        content,
        isAutoReply: options?.isAutoReply,
      },
    });
  }

  /**
   * Create a MESSAGE_RECEIVED event
   *
   * @param content - Message content
   * @param senderType - Who sent the message
   * @returns Complete event ready for insertion
   */
  messageReceived(content: string, senderType: MessageSenderType): DrizzleInsertEvent {
    return this.finalize({
      eventType: RecruitmentEventType.MESSAGE_RECEIVED,
      eventDetails: {
        type: "message_received",
        content,
        senderType,
      },
    });
  }

  /**
   * Create a WECHAT_EXCHANGED event
   *
   * @param wechatNumber - Optional WeChat number if captured
   * @returns Complete event ready for insertion
   */
  wechatExchanged(wechatNumber?: string): DrizzleInsertEvent {
    return this.finalize({
      eventType: RecruitmentEventType.WECHAT_EXCHANGED,
      eventDetails: {
        type: "wechat_exchanged",
        wechatNumber,
      },
    });
  }

  /**
   * Create an INTERVIEW_BOOKED event
   *
   * @param details - Interview details
   * @returns Complete event ready for insertion
   */
  interviewBooked(details: InterviewBookingDetails): DrizzleInsertEvent {
    return this.finalize({
      eventType: RecruitmentEventType.INTERVIEW_BOOKED,
      eventDetails: {
        type: "interview_booked",
        interviewTime: details.interviewTime,
        address: details.address,
        candidatePhone: details.candidatePhone,
        dulidayJobId: this.data.jobId ?? undefined,
      },
    });
  }

  /**
   * Create a CANDIDATE_CONTACTED event
   *
   * @param unreadCount - Number of unread messages
   * @param lastMessagePreview - Preview of last message
   * @returns Complete event ready for insertion
   */
  candidateContacted(unreadCount: number, lastMessagePreview?: string): DrizzleInsertEvent {
    return this.finalize({
      eventType: RecruitmentEventType.CANDIDATE_CONTACTED,
      eventDetails: {
        type: "candidate_contacted",
        unreadCount,
        lastMessagePreview,
      },
    });
  }

  /**
   * Create a CANDIDATE_HIRED event
   *
   * @param hireDate - Date of hiring (optional)
   * @param notes - Additional notes
   * @returns Complete event ready for insertion
   */
  candidateHired(hireDate?: string, notes?: string): DrizzleInsertEvent {
    return this.finalize({
      eventType: RecruitmentEventType.CANDIDATE_HIRED,
      eventDetails: {
        type: "candidate_hired",
        hireDate,
        notes,
      },
    });
  }

  /**
   * Internal method to finalize event construction
   */
  private finalize(eventData: {
    eventType: RecruitmentEventTypeValue;
    eventDetails: EventDetails;
  }): DrizzleInsertEvent {
    const eventTime = this.data.eventTime || new Date();

    // Generate candidateKey (convert null to undefined for brandId)
    // Use this.data.sourcePlatform which may be overridden by forPlatform()
    const candidateKey = generateCandidateKey({
      platform: this.data.sourcePlatform!,
      candidateName: this.data.candidateName || "unknown",
      candidatePosition: this.data.candidatePosition ?? undefined,
      brandId: this.data.brandId ?? undefined,
    });

    // Generate sessionId
    const sessionId = generateSessionId(this.context.agentId, candidateKey, eventTime);

    return {
      agentId: this.data.agentId!,
      candidateKey,
      sessionId,
      eventType: eventData.eventType,
      eventTime,
      candidateName: this.data.candidateName,
      candidatePosition: this.data.candidatePosition,
      candidateAge: this.data.candidateAge,
      candidateGender: this.data.candidateGender,
      candidateEducation: this.data.candidateEducation,
      candidateExpectedSalary: this.data.candidateExpectedSalary,
      candidateExpectedLocation: this.data.candidateExpectedLocation,
      candidateHeight: this.data.candidateHeight,
      candidateWeight: this.data.candidateWeight,
      candidateHealthCert: this.data.candidateHealthCert,
      eventDetails: eventData.eventDetails,
      sourcePlatform: this.data.sourcePlatform,
      jobId: this.data.jobId,
      jobName: this.data.jobName,
      brandId: this.data.brandId,
      wasUnreadBeforeReply: this.data.wasUnreadBeforeReply,
      unreadCountBeforeReply: this.data.unreadCountBeforeReply,
      messageSequence: this.data.messageSequence,
      dataSource: this.data.dataSource,
      apiSource: this.data.apiSource,
    };
  }
}
