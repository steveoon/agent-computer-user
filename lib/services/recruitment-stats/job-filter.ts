/**
 * Job 筛选工具模块
 *
 * 集中管理 Job 筛选逻辑，方便后续从 job_name 切换到 job_id
 *
 * 切换步骤：
 * 1. 确保 job_id 字段数据完整
 * 2. 修改 JOB_FILTER_MODE = "id"
 * 3. 实现 getDistinctJobsById 方法
 * 4. 测试验证
 */

import { inArray } from "drizzle-orm";
import { recruitmentEvents } from "@/db/schema";

/**
 * Job 筛选策略配置
 *
 * - "name": 使用 job_name 字符串筛选（当前方案）
 * - "id": 使用 job_id 数字筛选（将来方案）
 */
export const JOB_FILTER_MODE: "name" | "id" = "name";

/**
 * Job 筛选选项接口（保持稳定）
 */
export interface JobFilterOption {
  /** 值：name 模式下是岗位名称，id 模式下是 job_id 字符串 */
  value: string;
  /** 显示标签：岗位名称 */
  label: string;
}

/**
 * 构建 Job 筛选的 Drizzle 条件
 *
 * @param jobValues - 筛选值数组（name 或 id 的字符串形式）
 * @returns Drizzle SQL 条件
 */
export function buildJobCondition(jobValues: string[]) {
  if (jobValues.length === 0) {
    return undefined;
  }

  if (JOB_FILTER_MODE === "id") {
    // 将来：使用 job_id
    const ids = jobValues.map((v) => parseInt(v, 10)).filter((n) => !isNaN(n));
    if (ids.length === 0) return undefined;
    return inArray(recruitmentEvents.jobId, ids);
  }

  // 当前：使用 job_name
  return inArray(recruitmentEvents.jobName, jobValues);
}

/**
 * 构建子查询的 Job 条件字符串（原生 SQL）
 *
 * 用于复杂子查询中避免 Drizzle 参数绑定问题
 *
 * @param alias - 表别名（如 "received", "contacted"）
 * @param jobValues - 筛选值数组
 * @returns SQL 条件字符串，如 "alias.job_name IN ('值1', '值2')"
 */
export function buildJobConditionRaw(alias: string, jobValues: string[]): string {
  if (jobValues.length === 0) {
    return "";
  }

  if (JOB_FILTER_MODE === "id") {
    // 将来：使用 job_id
    const ids = jobValues.map((v) => parseInt(v, 10)).filter((n) => !isNaN(n));
    if (ids.length === 0) return "";
    return `${alias}.job_id IN (${ids.join(", ")})`;
  }

  // 当前：使用 job_name（转义单引号防止 SQL 注入）
  const escaped = jobValues.map((n) => `'${n.replace(/'/g, "''")}'`).join(", ");
  return `${alias}.job_name IN (${escaped})`;
}

/**
 * 获取当前使用的 Job 字段名
 */
export function getJobColumnName(): "job_id" | "job_name" {
  return JOB_FILTER_MODE === "id" ? "job_id" : "job_name";
}

/**
 * 判断是否启用了 Job 筛选
 */
export function hasJobFilter(jobValues?: string[]): boolean {
  return Boolean(jobValues && jobValues.length > 0);
}
