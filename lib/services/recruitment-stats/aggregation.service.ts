/**
 * Aggregation Service
 *
 * 统计聚合核心逻辑
 * 从 recruitment_events 表聚合数据到 recruitment_daily_stats 表
 */

import { eq, and, gte, lte, sql, count, countDistinct } from "drizzle-orm";
import { getDb } from "@/db";
import { recruitmentEvents } from "@/db/schema";
import { RecruitmentEventType } from "@/db/types";
import { recruitmentStatsRepository, normalizeToStartOfDay, calculateRate } from "./repository";
import { recruitmentEventsRepository } from "@/lib/services/recruitment-event/repository";
import type { DirtyRecord, AggregationResult, DailyStatsRecord } from "./types";

const LOG_PREFIX = "[RecruitmentStats][Aggregation]";

class AggregationService {
  /**
   * 处理所有脏数据记录（增量聚合）
   *
   * 定时任务的主入口
   *
   * @param batchSize - 每次处理的最大记录数
   */
  async processDirtyRecords(batchSize: number = 50): Promise<AggregationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let processedCount = 0;
    let failedCount = 0;

    console.log(`${LOG_PREFIX} Starting incremental aggregation...`);

    const dirtyRecords = await recruitmentStatsRepository.findDirtyRecords(batchSize);
    console.log(`${LOG_PREFIX} Found ${dirtyRecords.length} dirty records`);

    for (const record of dirtyRecords) {
      try {
        await this.aggregateSingleDay(record);
        processedCount++;
      } catch (error) {
        failedCount++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${record.agentId}@${record.statDate}: ${errorMsg}`);
        console.error(`${LOG_PREFIX} Failed to aggregate:`, record, error);
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `${LOG_PREFIX} Incremental aggregation completed: ${processedCount} success, ${failedCount} failed, ${duration}ms`
    );

    return {
      success: failedCount === 0,
      processedCount,
      failedCount,
      duration,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * 聚合单日单维度的统计
   *
   * 核心聚合逻辑，使用 PostgreSQL FILTER 语法
   *
   * @param record - 脏记录（包含维度信息）
   */
  async aggregateSingleDay(record: DirtyRecord): Promise<void> {
    const db = getDb();
    const { agentId, statDate, brandId, jobId } = record;

    // 计算当天的时间范围
    const dayStart = normalizeToStartOfDay(statDate);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCHours(23, 59, 59, 999);

    // 构建 WHERE 条件
    const conditions = [
      eq(recruitmentEvents.agentId, agentId),
      gte(recruitmentEvents.eventTime, dayStart),
      lte(recruitmentEvents.eventTime, dayEnd),
    ];

    // 添加品牌/岗位过滤（如果有）
    if (brandId !== null) {
      conditions.push(eq(recruitmentEvents.brandId, brandId));
    }
    if (jobId !== null) {
      conditions.push(eq(recruitmentEvents.jobId, jobId));
    }

    // 执行聚合查询
    // 新的事件模型:
    // - MESSAGE_RECEIVED: 入站事件（候选人 → 我们），由 get_unread_candidates 触发
    // - CANDIDATE_CONTACTED: 主动打招呼事件（我们 → 候选人），由 say_hello 触发
    // - MESSAGE_SENT: 回复事件（我们 → 候选人），由 send_message 触发
    const [stats] = await db
      .select({
        totalEvents: count(),
        uniqueCandidates: countDistinct(recruitmentEvents.candidateKey),
        uniqueSessions: countDistinct(recruitmentEvents.sessionId),
        // === 入站漏斗指标 ===
        // 发送消息次数
        messagesSent: sql<number>`COUNT(*) FILTER (WHERE ${recruitmentEvents.eventType} = ${RecruitmentEventType.MESSAGE_SENT})`,
        // Total Flow: 入站消息总数 = SUM(unread_count) WHERE type=MESSAGE_RECEIVED
        messagesReceived: sql<number>`COALESCE(SUM(${recruitmentEvents.unreadCountBeforeReply}) FILTER (WHERE ${recruitmentEvents.eventType} = ${RecruitmentEventType.MESSAGE_RECEIVED}), 0)`,
        // Inbound Candidates: 入站候选人数（给我们发过消息的候选人）
        // 两种来源合并：
        // 1. 有 MESSAGE_RECEIVED 事件（通过 get_unread_messages 检测到）
        // 2. 或有 MESSAGE_SENT 且 was_unread_before_reply=true（Agent 直接回复，说明对方发过消息）
        inboundCandidates: sql<number>`COUNT(DISTINCT ${recruitmentEvents.candidateKey}) FILTER (WHERE ${recruitmentEvents.eventType} = ${RecruitmentEventType.MESSAGE_RECEIVED} OR (${recruitmentEvents.eventType} = ${RecruitmentEventType.MESSAGE_SENT} AND ${recruitmentEvents.wasUnreadBeforeReply} = true))`,
        // Immediate Reply: 立即回复的未读消息数（wasUnreadBeforeReply=true 的 MESSAGE_SENT）
        unreadReplied: sql<number>`COALESCE(SUM(${recruitmentEvents.unreadCountBeforeReply}) FILTER (WHERE ${recruitmentEvents.eventType} = ${RecruitmentEventType.MESSAGE_SENT} AND ${recruitmentEvents.wasUnreadBeforeReply} = true), 0)`,
        // === 出站漏斗指标 ===
        // Proactive Outreach: 主动打招呼候选人数 = COUNT DISTINCT candidate_key WHERE type=CANDIDATE_CONTACTED
        proactiveOutreach: sql<number>`COUNT(DISTINCT ${recruitmentEvents.candidateKey}) FILTER (WHERE ${recruitmentEvents.eventType} = ${RecruitmentEventType.CANDIDATE_CONTACTED})`,
        // WeChat: 获取微信的候选人数
        wechatExchanged: sql<number>`COUNT(DISTINCT ${recruitmentEvents.candidateKey}) FILTER (WHERE ${recruitmentEvents.eventType} = ${RecruitmentEventType.WECHAT_EXCHANGED})`,
        // Interview: 预约面试的候选人数
        interviewsBooked: sql<number>`COUNT(DISTINCT ${recruitmentEvents.candidateKey}) FILTER (WHERE ${recruitmentEvents.eventType} = ${RecruitmentEventType.INTERVIEW_BOOKED})`,
        // Hired: 入职的候选人数
        candidatesHired: sql<number>`COUNT(DISTINCT ${recruitmentEvents.candidateKey}) FILTER (WHERE ${recruitmentEvents.eventType} = ${RecruitmentEventType.CANDIDATE_HIRED})`,
      })
      .from(recruitmentEvents)
      .where(and(...conditions));

    // 单独查询 candidatesReplied：入站候选人中被回复的数量
    // 逻辑：只统计同时满足以下条件的候选人
    // 1. 有 MESSAGE_SENT 事件（被我方回复）
    // 2. 有 MESSAGE_RECEIVED 事件（是入站候选人）
    // 这样 reply_rate = candidatesReplied / candidatesContacted 才有意义（不会超过 100%）
    //
    // 使用 Drizzle 表引用确保 schema 正确
    // 将 Date 转换为 ISO 字符串以兼容 postgres 驱动
    const brandCondition = brandId !== null ? sql`AND brand_id = ${brandId}` : sql``;
    const jobCondition = jobId !== null ? sql`AND job_id = ${jobId}` : sql``;
    const dayStartStr = dayStart.toISOString();
    const dayEndStr = dayEnd.toISOString();

    // 子查询：入站候选人中被回复的数量 + 出站候选人中获得回复的数量
    const [subqueryStats] = await db
      .select({
        // candidatesReplied: 入站候选人中被回复的数量
        // 逻辑：发送消息时 was_unread_before_reply = true 的候选人
        // 说明：was_unread_before_reply 表示"发送消息前对方有未读消息"，即对方之前发过消息
        // 这比依赖 MESSAGE_RECEIVED 事件更可靠，因为 MESSAGE_RECEIVED 只在 get_unread_messages 时记录
        // 而 Agent 可能直接打开聊天回复，不一定经过 get_unread_messages 流程
        candidatesReplied: sql<number>`(
          SELECT COUNT(DISTINCT sent.candidate_key)
          FROM ${recruitmentEvents} AS sent
          WHERE sent.event_type = ${RecruitmentEventType.MESSAGE_SENT}
            AND sent.was_unread_before_reply = true
            AND sent.agent_id = ${agentId}
            AND sent.event_time >= ${dayStartStr}::timestamptz
            AND sent.event_time <= ${dayEndStr}::timestamptz
            ${brandCondition}
            ${jobCondition}
        )`,
        // proactiveResponded: 主动触达后对方回复的候选人数
        // 逻辑：同时有 CANDIDATE_CONTACTED 和 MESSAGE_RECEIVED 的候选人
        // 注意：使用 candidate_name 进行宽松匹配，因为 zhipin say-hello 使用意向职位，
        // 而 MESSAGE_RECEIVED 使用沟通职位，导致 candidate_key 不一致
        proactiveResponded: sql<number>`(
          SELECT COUNT(DISTINCT received.candidate_name)
          FROM ${recruitmentEvents} AS received
          WHERE received.event_type = ${RecruitmentEventType.MESSAGE_RECEIVED}
            AND received.agent_id = ${agentId}
            AND received.event_time >= ${dayStartStr}::timestamptz
            AND received.event_time <= ${dayEndStr}::timestamptz
            ${brandCondition}
            ${jobCondition}
            AND received.candidate_name IN (
              SELECT DISTINCT contacted.candidate_name
              FROM ${recruitmentEvents} AS contacted
              WHERE contacted.event_type = ${RecruitmentEventType.CANDIDATE_CONTACTED}
                AND contacted.agent_id = ${agentId}
                AND contacted.event_time >= ${dayStartStr}::timestamptz
                AND contacted.event_time <= ${dayEndStr}::timestamptz
                ${brandCondition}
                ${jobCondition}
            )
        )`,
      })
      .from(recruitmentEvents)
      .limit(1);

    // 提取结果（处理可能的 null）
    const totalEvents = Number(stats?.totalEvents) || 0;
    const uniqueCandidates = Number(stats?.uniqueCandidates) || 0;
    const uniqueSessions = Number(stats?.uniqueSessions) || 0;
    // 入站漏斗
    const messagesSent = Number(stats?.messagesSent) || 0;
    const messagesReceived = Number(stats?.messagesReceived) || 0;
    const inboundCandidates = Number(stats?.inboundCandidates) || 0;
    const candidatesReplied = Number(subqueryStats?.candidatesReplied) || 0;
    const unreadReplied = Number(stats?.unreadReplied) || 0;
    // 出站漏斗
    const proactiveOutreach = Number(stats?.proactiveOutreach) || 0;
    const proactiveResponded = Number(subqueryStats?.proactiveResponded) || 0;
    // 转化指标
    const wechatExchanged = Number(stats?.wechatExchanged) || 0;
    const interviewsBooked = Number(stats?.interviewsBooked) || 0;
    const candidatesHired = Number(stats?.candidatesHired) || 0;

    // 计算转化率（基于入站漏斗）
    const replyRate = calculateRate(candidatesReplied, inboundCandidates);
    const wechatRate = calculateRate(wechatExchanged, inboundCandidates);
    const interviewRate = calculateRate(interviewsBooked, inboundCandidates);

    // 构建统计记录
    const statsRecord: DailyStatsRecord = {
      agentId,
      statDate: dayStart,
      brandId,
      jobId,
      totalEvents,
      uniqueCandidates,
      uniqueSessions,
      // 入站漏斗
      messagesSent,
      messagesReceived,
      inboundCandidates,
      candidatesReplied,
      unreadReplied,
      // 出站漏斗
      proactiveOutreach,
      proactiveResponded,
      // 转化指标
      wechatExchanged,
      interviewsBooked,
      candidatesHired,
      replyRate,
      wechatRate,
      interviewRate,
    };

    // 写入数据库
    await recruitmentStatsRepository.upsertStats(statsRecord);

    console.log(
      `${LOG_PREFIX} Aggregated: ${agentId} @ ${dayStart.toISOString().split("T")[0]} ` +
        `[events=${totalEvents}, candidates=${uniqueCandidates}, wechat=${wechatExchanged}]`
    );
  }

  /**
   * 全量重算某个 Agent 的所有历史数据
   *
   * 手动触发使用
   *
   * @param agentId - Agent ID
   */
  async fullReaggregation(agentId: string): Promise<AggregationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let processedCount = 0;
    let failedCount = 0;

    console.log(`${LOG_PREFIX} Starting full re-aggregation for: ${agentId}`);

    // 获取所有有事件的日期
    const dates = await recruitmentEventsRepository.getDistinctEventDates(agentId);
    console.log(`${LOG_PREFIX} Found ${dates.length} days with events`);

    for (const date of dates) {
      try {
        // 聚合 Agent 总体维度
        await this.aggregateSingleDay({
          agentId,
          statDate: date,
          brandId: null,
          jobId: null,
        });

        // 获取当天的所有品牌-岗位组合并分别聚合
        const dimensions = await recruitmentEventsRepository.getDistinctDimensions(agentId, date);

        for (const dim of dimensions) {
          // 跳过 brandId 为 null 的维度（已经在上面处理了总体聚合）
          // 注意：只要 brandId 是 null 就跳过，不管 jobId 是什么值
          // 因为 brandId: null 意味着"不按品牌过滤"，会聚合所有事件
          if (dim.brandId === null) continue;

          await this.aggregateSingleDay({
            agentId,
            statDate: date,
            brandId: dim.brandId,
            jobId: dim.jobId,
          });
        }

        processedCount++;
      } catch (error) {
        failedCount++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${agentId}@${date}: ${errorMsg}`);
        console.error(`${LOG_PREFIX} Full re-aggregation failed for date:`, date, error);
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `${LOG_PREFIX} Full re-aggregation completed: ${processedCount} days success, ${failedCount} failed, ${duration}ms`
    );

    return {
      success: failedCount === 0,
      processedCount,
      failedCount,
      duration,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * 主聚合流程
   *
   * 完整的聚合逻辑，包含兜底机制：
   * 1. 先处理所有脏数据记录（增量聚合）
   * 2. 如果没有脏数据，则执行全量重算（兜底）
   *
   * 用于：凌晨定时任务、手动触发聚合按钮
   *
   * @param batchSize - 脏数据处理的批量大小（默认 100）
   */
  async runMainAggregation(batchSize: number = 100): Promise<AggregationResult> {
    console.log(`${LOG_PREFIX} Running main aggregation...`);

    // 1. 先处理脏数据
    const dirtyResult = await this.processDirtyRecords(batchSize);
    console.log(
      `${LOG_PREFIX} Dirty records processed: ${dirtyResult.processedCount} success, ${dirtyResult.failedCount} failed`
    );

    // 2. 如果没有脏数据，执行全量重算（兜底）
    if (dirtyResult.processedCount === 0) {
      console.log(`${LOG_PREFIX} No dirty records found, performing full re-aggregation...`);

      const agents = await recruitmentEventsRepository.getDistinctAgents();

      if (agents.length === 0) {
        console.log(`${LOG_PREFIX} No agents found, skipping full re-aggregation`);
        return dirtyResult;
      }

      let totalProcessed = 0;
      let totalFailed = 0;
      const allErrors: string[] = [];

      for (const agentId of agents) {
        console.log(`${LOG_PREFIX} Full re-aggregation for agent: ${agentId}`);
        const result = await this.fullReaggregation(agentId);
        totalProcessed += result.processedCount;
        totalFailed += result.failedCount;
        if (result.errors) {
          allErrors.push(...result.errors);
        }
      }

      console.log(
        `${LOG_PREFIX} Full re-aggregation completed: ${totalProcessed} days processed, ${totalFailed} failed`
      );

      return {
        success: totalFailed === 0,
        processedCount: totalProcessed,
        failedCount: totalFailed,
        duration: dirtyResult.duration,
        errors: allErrors.length > 0 ? allErrors : undefined,
      };
    }

    return dirtyResult;
  }

  /**
   * 聚合指定日期范围内的所有数据
   *
   * @param agentId - Agent ID
   * @param startDate - 开始日期
   * @param endDate - 结束日期
   */
  async aggregateDateRange(
    agentId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AggregationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let processedCount = 0;
    let failedCount = 0;

    console.log(
      `${LOG_PREFIX} Aggregating date range: ${agentId} from ${startDate.toISOString()} to ${endDate.toISOString()}`
    );

    // 遍历日期范围
    const currentDate = normalizeToStartOfDay(startDate);
    const endDateNormalized = normalizeToStartOfDay(endDate);

    while (currentDate <= endDateNormalized) {
      try {
        // 标记为脏然后聚合
        await recruitmentStatsRepository.markDirty(agentId, currentDate);
        await this.aggregateSingleDay({
          agentId,
          statDate: currentDate,
          brandId: null,
          jobId: null,
        });
        processedCount++;
      } catch (error) {
        failedCount++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${agentId}@${currentDate}: ${errorMsg}`);
      }

      // 移动到下一天
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const duration = Date.now() - startTime;
    console.log(
      `${LOG_PREFIX} Date range aggregation completed: ${processedCount} success, ${failedCount} failed, ${duration}ms`
    );

    return {
      success: failedCount === 0,
      processedCount,
      failedCount,
      duration,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}

/**
 * 单例实例
 */
export const aggregationService = new AggregationService();
