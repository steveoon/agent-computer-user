/**
 * Recruitment Stats Module
 *
 * 统计聚合模块导出入口
 */

// Types
export * from "./types";

// Repository
export {
  recruitmentStatsRepository,
  calculateRate,
  type DrizzleInsertStats,
  type DrizzleSelectStats,
} from "./repository";

// Services
export { aggregationService } from "./aggregation.service";
export { schedulerService } from "./scheduler.service";
export { queryService } from "./query.service";
