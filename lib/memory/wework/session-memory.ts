/**
 * 企微私域运营 — 会话级记忆管理
 *
 * 统一管理事实信息（候选人提取结果）+ 上轮推荐岗位，
 * 通过 localCacheService 持久化（24h TTL），跨请求累积。
 *
 * 消费方式：route.ts 在调用 LLM 前 load → formatSessionMemoryForPrompt → 注入系统提示词
 * 写入方式：预处理器（wework-preprocessor）写 facts，duliday_job_list_for_llm 通过 onJobsFetched 回调写 lastRecommendedJobs
 */

import { z } from "zod/v3";
import { localCacheService } from "@/lib/services/local-cache.service";
import type { EntityExtractionResult } from "@/lib/tools/wework/types";
import { aiJobItemSchema, type AIJobItem } from "@/lib/tools/ai-job-types";

// ========== 类型定义 ==========

export interface RecommendedJobSummary {
  // 核心标识 — 用于下游工具调用（面试预约、岗位详情）
  jobId: number;

  // 匹配信息 — 让 LLM 能从候选人的模糊描述定位到具体岗位
  brandName: string | null;
  jobName: string | null;
  storeName: string | null;
  cityName: string | null;
  regionName: string | null;
  laborForm: string | null;

  // 高频问答 — 避免每次都回调 API
  salaryDesc: string | null;
  jobCategoryName: string | null;
}

export interface WeworkSessionState {
  facts: EntityExtractionResult | null;
  /** 每轮覆盖：最后一次 duliday_job_list_for_llm 调用的结果 */
  lastRecommendedJobs: RecommendedJobSummary[] | null;
}

// ========== 常量 ==========

const SESSION_CACHE_PREFIX = "wework_session";
const DEFAULT_TTL_SECONDS = 24 * 60 * 60; // 24h

const EMPTY_STATE: WeworkSessionState = {
  facts: null,
  lastRecommendedJobs: null,
};

// ========== WeworkSessionMemory ==========

export class WeworkSessionMemory {
  private readonly cacheKey: string;
  /** 简易互斥：保证 load→mutate→save 的原子性，防止并发写入互相覆盖 */
  private writeLock: Promise<void> = Promise.resolve();

  constructor(userId: string, sessionId: string) {
    this.cacheKey = `${SESSION_CACHE_PREFIX}:${userId}:${sessionId}`;
  }

  // ---- 加载 / 保存 ----

  async load(): Promise<WeworkSessionState> {
    const cached = await localCacheService.get<WeworkSessionState>(this.cacheKey);
    return cached ?? { ...EMPTY_STATE };
  }

  private async save(state: WeworkSessionState): Promise<void> {
    await localCacheService.setex(this.cacheKey, DEFAULT_TTL_SECONDS, state);
  }

  /**
   * 串行化写操作：排队等待前一个写操作完成后再执行
   * 保证 load→mutate→save 不会被并发写入打断
   */
  private async withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.writeLock;
    let resolve: () => void;
    this.writeLock = new Promise<void>(r => {
      resolve = r;
    });
    await prev;
    try {
      return await fn();
    } finally {
      resolve!();
    }
  }

  // ---- Facts ----

  async getFacts(): Promise<EntityExtractionResult | null> {
    const state = await this.load();
    return state.facts;
  }

  async saveFacts(facts: EntityExtractionResult): Promise<void> {
    return this.withWriteLock(async () => {
      const state = await this.load();
      state.facts = facts;
      await this.save(state);
    });
  }

  // ---- Recommended Jobs（覆盖语义） ----

  async getLastRecommendedJobs(): Promise<RecommendedJobSummary[] | null> {
    const state = await this.load();
    return state.lastRecommendedJobs;
  }

  async saveLastRecommendedJobs(jobs: RecommendedJobSummary[]): Promise<void> {
    return this.withWriteLock(async () => {
      const state = await this.load();
      state.lastRecommendedJobs = jobs;
      await this.save(state);
    });
  }
}

// ========== 提示词格式化 ==========

/**
 * 将会话记忆格式化为系统提示词段落
 * 返回空字符串表示无记忆需要注入
 */
export function formatSessionMemoryForPrompt(state: WeworkSessionState): string {
  const sections: string[] = [];

  // 事实信息
  if (state.facts) {
    const { interview_info: info, preferences: pref } = state.facts;
    const factLines: string[] = [];

    if (info.name) factLines.push(`- 姓名: ${info.name}`);
    if (info.phone) factLines.push(`- 联系方式: ${info.phone}`);
    if (info.gender) factLines.push(`- 性别: ${info.gender}`);
    if (info.age) factLines.push(`- 年龄: ${info.age}`);
    if (info.applied_store) factLines.push(`- 应聘门店: ${info.applied_store}`);
    if (info.applied_position) factLines.push(`- 应聘岗位: ${info.applied_position}`);
    if (info.interview_time) factLines.push(`- 面试时间: ${info.interview_time}`);
    if (info.is_student != null) factLines.push(`- 是否学生: ${info.is_student ? "是" : "否"}`);
    if (info.education) factLines.push(`- 学历: ${info.education}`);
    if (info.has_health_certificate) factLines.push(`- 健康证: ${info.has_health_certificate}`);

    if (pref.labor_form) factLines.push(`- 用工形式: ${pref.labor_form}`);
    if (pref.brands?.length) factLines.push(`- 意向品牌: ${pref.brands.join("、")}`);
    if (pref.salary) factLines.push(`- 意向薪资: ${pref.salary}`);
    if (pref.position?.length) factLines.push(`- 意向岗位: ${pref.position.join("、")}`);
    if (pref.schedule) factLines.push(`- 意向班次: ${pref.schedule}`);
    if (pref.city) factLines.push(`- 意向城市: ${pref.city}`);
    if (pref.district?.length) factLines.push(`- 意向区域: ${pref.district.join("、")}`);
    if (pref.location?.length) factLines.push(`- 意向地点: ${pref.location.join("、")}`);

    if (factLines.length > 0) {
      sections.push(`## 候选人已知信息\n${factLines.join("\n")}`);
    }
  }

  // 上轮推荐岗位
  if (state.lastRecommendedJobs?.length) {
    const jobLines = state.lastRecommendedJobs.map((j, i) => {
      const parts = [`${i + 1}. [jobId:${j.jobId}]`, `${j.brandName ?? ""} - ${j.jobName ?? ""}`];
      if (j.storeName) parts.push(j.storeName);
      if (j.cityName || j.regionName) {
        parts.push([j.cityName, j.regionName].filter(Boolean).join(""));
      }
      if (j.laborForm) parts.push(j.laborForm);
      if (j.salaryDesc) parts.push(j.salaryDesc);
      return parts.join(" | ");
    });
    sections.push(`## 上轮已推荐岗位\n${jobLines.join("\n")}`);
  }

  if (sections.length === 0) return "";

  const instructions: string[] = [];

  return `\n\n[会话记忆 — 使用指引]\n${instructions.join("\n")}\n\n${sections.join("\n\n")}`;
}

// ========== 岗位数据映射 ==========

/**
 * 从复杂薪资结构中提取一行摘要
 * 优先级：综合薪资 > 基本薪资 > 试工期薪资
 */
function formatSalarySummary(job: AIJobItem): string | null {
  const salary = job.jobSalary;
  if (!salary) return null;

  const scenario = salary.salaryScenarioList?.[0];
  if (scenario) {
    const comp = scenario.comprehensiveSalary;
    if (comp && (comp.minComprehensiveSalary != null || comp.maxComprehensiveSalary != null)) {
      const min = comp.minComprehensiveSalary ?? "?";
      const max = comp.maxComprehensiveSalary ?? "?";
      const unit = comp.comprehensiveSalaryUnit || "元/月";
      return `${min}-${max} ${unit}`;
    }

    const basic = scenario.basicSalary;
    if (basic?.basicSalary != null) {
      return `${basic.basicSalary}${basic.basicSalaryUnit || "元"}`;
    }
  }

  const probation = salary.probationSalary;
  if (probation?.salary != null) {
    return `${probation.salary}${probation.salaryUnit || "元"}（试工期）`;
  }

  return null;
}

/**
 * 将 AIJobItem[] 映射为 RecommendedJobSummary[] 并写入会话记忆
 *
 * 用于 tool-registry 创建 duliday_job_list_for_llm 工具时注入回调，
 * 避免公共工具直接依赖 wework 记忆模块。
 */
export function createJobsFetchedHandler(
  sessionMemory: WeworkSessionMemory
): (jobs: unknown[]) => void {
  return rawJobs => {
    const parsed = z.array(aiJobItemSchema).safeParse(rawJobs);
    if (!parsed.success) {
      console.warn("[wework] onJobsFetched: invalid job data, skipping", parsed.error.message);
      return;
    }
    const jobs = parsed.data;
    const summaries: RecommendedJobSummary[] = jobs.map(job => ({
      jobId: job.basicInfo.jobId,
      brandName: job.basicInfo.brandName,
      jobName: job.basicInfo.jobName,
      storeName: job.basicInfo.storeInfo?.storeName ?? null,
      cityName: job.basicInfo.storeInfo?.storeCityName ?? null,
      regionName: job.basicInfo.storeInfo?.storeRegionName ?? null,
      laborForm: job.basicInfo.laborForm,
      salaryDesc: formatSalarySummary(job),
      jobCategoryName: job.basicInfo.jobCategoryName,
    }));

    sessionMemory.saveLastRecommendedJobs(summaries).catch((err: unknown) => {
      console.warn("[wework] Session memory save recommended jobs failed:", err);
    });
  };
}
