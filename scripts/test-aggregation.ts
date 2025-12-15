/**
 * 聚合服务测试脚本
 *
 * 用法: npx tsx scripts/test-aggregation.ts [command]
 *
 * Commands:
 *   check    - 检查数据库状态
 *   trigger  - 手动触发聚合
 *   query    - 查询聚合结果
 */

import { getDb } from "../db";
import { recruitmentEvents, recruitmentDailyStats } from "../db/schema";
import { sql, eq, desc } from "drizzle-orm";
import { aggregationService } from "../lib/services/recruitment-stats";

const command = process.argv[2] || "check";

async function checkData() {
  console.log("\n=== 数据库状态检查 ===\n");

  const db = getDb();

  // 检查 events 表
  const eventsCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(recruitmentEvents);
  console.log("📊 recruitment_events 总数:", eventsCount[0]?.count ?? 0);

  // 检查 daily_stats 表
  const statsCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(recruitmentDailyStats);
  console.log("📈 recruitment_daily_stats 总数:", statsCount[0]?.count ?? 0);

  // 检查脏数据
  const dirtyCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(recruitmentDailyStats)
    .where(eq(recruitmentDailyStats.isDirty, true));
  console.log("🔄 待聚合（isDirty=true）:", dirtyCount[0]?.count ?? 0);

  // 显示最近几条事件
  const recentEvents = await db
    .select({
      agentId: recruitmentEvents.agentId,
      eventType: recruitmentEvents.eventType,
      eventTime: recruitmentEvents.eventTime,
      candidateKey: recruitmentEvents.candidateKey,
    })
    .from(recruitmentEvents)
    .orderBy(desc(recruitmentEvents.eventTime))
    .limit(5);

  if (recentEvents.length > 0) {
    console.log("\n📝 最近 5 条事件:");
    recentEvents.forEach((e) => {
      const time = e.eventTime.toISOString().split("T")[0];
      console.log(`   ${time} | ${e.agentId} | ${e.eventType}`);
    });
  } else {
    console.log("\n⚠️  没有事件数据，请先插入一些测试数据");
  }

  // 显示 distinct agents
  const agents = await db
    .selectDistinct({ agentId: recruitmentEvents.agentId })
    .from(recruitmentEvents);
  if (agents.length > 0) {
    console.log("\n🤖 Agent 列表:", agents.map((a) => a.agentId).join(", "));
  }
}

async function triggerAggregation() {
  console.log("\n=== 手动触发聚合 ===\n");

  // 先处理脏数据
  console.log("1️⃣  处理脏数据...");
  const dirtyResult = await aggregationService.processDirtyRecords(100);
  console.log(`   处理完成: ${dirtyResult.processedCount} 条成功, ${dirtyResult.failedCount} 条失败`);

  if (dirtyResult.errors && dirtyResult.errors.length > 0) {
    console.log("   错误详情:");
    dirtyResult.errors.forEach((e) => console.log(`   - ${e}`));
  }

  // 如果没有脏数据，询问是否全量重算
  if (dirtyResult.processedCount === 0) {
    const db = getDb();
    const agents = await db
      .selectDistinct({ agentId: recruitmentEvents.agentId })
      .from(recruitmentEvents);

    if (agents.length > 0) {
      console.log("\n2️⃣  没有脏数据，执行全量重算...");
      for (const { agentId } of agents) {
        console.log(`   重算 Agent: ${agentId}`);
        const result = await aggregationService.fullReaggregation(agentId);
        console.log(`   结果: ${result.processedCount} 天处理完成`);
      }
    }
  }

  console.log("\n✅ 聚合完成");
}

async function queryStats() {
  console.log("\n=== 聚合结果查询 ===\n");

  const db = getDb();

  const stats = await db
    .select()
    .from(recruitmentDailyStats)
    .orderBy(desc(recruitmentDailyStats.statDate))
    .limit(10);

  if (stats.length === 0) {
    console.log("⚠️  暂无统计数据");
    return;
  }

  console.log("最近 10 条统计记录:\n");

  stats.forEach((s) => {
    const date = s.statDate.toISOString().split("T")[0];
    console.log(`📅 ${date} | Agent: ${s.agentId}`);
    console.log(`   事件总数: ${s.totalEvents} | 候选人: ${s.uniqueCandidates} | 会话: ${s.uniqueSessions}`);
    console.log(`   消息发送: ${s.messagesSent} | 消息接收: ${s.messagesReceived}`);
    console.log(`   入站: ${s.inboundCandidates} | 回复: ${s.candidatesReplied} | 主动触达: ${s.proactiveOutreach} | 触达回复: ${s.proactiveResponded}`);
    console.log(`   微信: ${s.wechatExchanged}`);
    console.log(`   面试: ${s.interviewsBooked} | 入职: ${s.candidatesHired}`);

    const replyRate = s.replyRate ? (s.replyRate / 100).toFixed(2) + "%" : "N/A";
    const wechatRate = s.wechatRate ? (s.wechatRate / 100).toFixed(2) + "%" : "N/A";
    const interviewRate = s.interviewRate ? (s.interviewRate / 100).toFixed(2) + "%" : "N/A";
    console.log(`   回复率: ${replyRate} | 微信率: ${wechatRate} | 面试率: ${interviewRate}`);
    console.log(`   isDirty: ${s.isDirty} | 聚合时间: ${s.aggregatedAt?.toISOString() ?? "未聚合"}`);
    console.log("");
  });
}

async function main() {
  try {
    switch (command) {
      case "check":
        await checkData();
        break;
      case "trigger":
        await triggerAggregation();
        break;
      case "query":
        await queryStats();
        break;
      default:
        console.log("未知命令:", command);
        console.log("可用命令: check, trigger, query");
    }
  } catch (error) {
    console.error("执行失败:", error);
  } finally {
    process.exit();
  }
}

main();
