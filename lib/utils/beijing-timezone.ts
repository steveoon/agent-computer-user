/**
 * 北京时区 (UTC+8) 日期工具函数
 *
 * 用于统一处理所有与北京时区相关的日期计算
 * 避免各模块重复实现导致的不一致问题
 */

/** 北京时区偏移量（8小时 = 8*60*60*1000 毫秒） */
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * 将任意时间转换为北京时间当天 0:00:00 的 UTC 时间戳
 *
 * @param date - 输入日期
 * @returns 北京时间当天午夜对应的 UTC Date 对象
 *
 * @example
 * // 北京时间 2026-01-07 10:30 → 2026-01-07 00:00 北京时间 → 2026-01-06T16:00:00Z
 * toBeijingMidnight(new Date('2026-01-07T02:30:00Z'))
 * // Returns: Date representing 2026-01-06T16:00:00Z
 */
export function toBeijingMidnight(date: Date): Date {
  const utcTime = date.getTime();
  const beijingTime = utcTime + BEIJING_OFFSET_MS;
  const beijingMidnight = Math.floor(beijingTime / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);
  return new Date(beijingMidnight - BEIJING_OFFSET_MS);
}

/**
 * 将任意时间转换为北京时间当天 23:59:59.999 的 UTC 时间戳
 *
 * @param date - 输入日期
 * @returns 北京时间当天结束时刻对应的 UTC Date 对象
 */
export function toBeijingDayEnd(date: Date): Date {
  const midnight = toBeijingMidnight(date);
  return new Date(midnight.getTime() + 24 * 60 * 60 * 1000 - 1);
}

/**
 * 将 UTC 时间戳转换为北京时间日期字符串 (YYYY-MM-DD)
 *
 * @param date - UTC Date 对象
 * @returns 北京时间日期字符串
 *
 * @example
 * // UTC 2026-01-05T16:00:00Z = 北京时间 2026-01-06 00:00
 * toBeijingDateString(new Date('2026-01-05T16:00:00Z'))
 * // Returns: "2026-01-06"
 */
export function toBeijingDateString(date: Date): string {
  const beijingTime = new Date(date.getTime() + BEIJING_OFFSET_MS);
  return beijingTime.toISOString().split("T")[0];
}

/**
 * 解析日期字符串为北京时间当天 0:00:00 的 UTC 时间戳
 *
 * @param dateStr - 日期字符串 (YYYY-MM-DD)
 * @returns 北京时间当天午夜对应的 UTC Date 对象
 *
 * @example
 * // "2026-01-07" → 北京时间 2026-01-07 00:00 → UTC 2026-01-06T16:00:00Z
 * parseBeijingDateString("2026-01-07")
 * // Returns: Date representing 2026-01-06T16:00:00Z
 */
export function parseBeijingDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  // 创建北京时间午夜对应的 UTC 时间
  // 北京时间 00:00:00 = UTC 前一天 16:00:00
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - BEIJING_OFFSET_MS);
}
