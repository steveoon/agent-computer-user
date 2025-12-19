/**
 * Time Parser Tests
 *
 * Tests for time string parsing from recruitment platforms.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { parseMessageTime, formatDateForSession } from "../time-parser";

describe("parseMessageTime", () => {
  beforeEach(() => {
    // Mock current date to 2025-12-05 10:30:00
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-12-05T10:30:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("时间格式解析", () => {
    it("应该解析 HH:MM 格式（当天时间）", () => {
      const result = parseMessageTime("14:30");
      expect(result).toBeInstanceOf(Date);
      expect(result?.getHours()).toBe(14);
      expect(result?.getMinutes()).toBe(30);
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(11); // December (0-indexed)
      expect(result?.getDate()).toBe(5);
    });

    it("应该解析 MM-DD HH:MM 格式", () => {
      const result = parseMessageTime("12-04 14:30");
      expect(result).toBeInstanceOf(Date);
      expect(result?.getMonth()).toBe(11); // December
      expect(result?.getDate()).toBe(4);
      expect(result?.getHours()).toBe(14);
      expect(result?.getMinutes()).toBe(30);
    });

    it("应该解析 YYYY-MM-DD HH:MM 格式", () => {
      const result = parseMessageTime("2025-12-04 14:30");
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(11);
      expect(result?.getDate()).toBe(4);
      expect(result?.getHours()).toBe(14);
      expect(result?.getMinutes()).toBe(30);
    });

    it("应该解析 昨天 HH:MM 格式", () => {
      const result = parseMessageTime("昨天 14:30");
      expect(result).toBeInstanceOf(Date);
      expect(result?.getDate()).toBe(4); // Yesterday (Dec 4th)
      expect(result?.getHours()).toBe(14);
      expect(result?.getMinutes()).toBe(30);
    });

    it("应该解析 前天 HH:MM 格式", () => {
      const result = parseMessageTime("前天 14:30");
      expect(result).toBeInstanceOf(Date);
      expect(result?.getDate()).toBe(3); // Day before yesterday (Dec 3rd)
      expect(result?.getHours()).toBe(14);
      expect(result?.getMinutes()).toBe(30);
    });

    it("应该解析 ISO 日期格式", () => {
      const result = parseMessageTime("2025-12-04T14:30:00.000Z");
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2025);
    });

    it("应该处理跨年情况（当前1月，解析12月）", () => {
      // Set current time to Jan 5th, 2026
      vi.setSystemTime(new Date("2026-01-05T10:30:00"));

      // Parse a date from Dec 31st (should be treated as 2025)
      const result = parseMessageTime("12-31 23:59");

      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2025); // Should be last year
      expect(result?.getMonth()).toBe(11); // Dec
      expect(result?.getDate()).toBe(31);
    });

    it("应该处理非法日期（如 02-30）", () => {
      // Date object auto-corrects 02-30 to 03-02 (or similar),
      // but we just want to ensure it doesn't crash and returns a valid date object
      const result = parseMessageTime("02-30 14:30");
      expect(result).toBeInstanceOf(Date);
      // JS Date auto-correction behavior: Feb 30 -> Mar 2 (in non-leap year)
      expect(result?.getMonth()).not.toBe(1); // Should not be Feb anymore if auto-corrected
    });
  });

  describe("回退行为", () => {
    it("解析失败时应返回当前时间（fallbackToNow = true）", () => {
      const result = parseMessageTime("invalid time string", true);
      expect(result).toBeInstanceOf(Date);
      expect(result?.getHours()).toBe(10);
      expect(result?.getMinutes()).toBe(30);
    });

    it("解析失败时应返回 null（fallbackToNow = false）", () => {
      const result = parseMessageTime("invalid time string", false);
      expect(result).toBeNull();
    });

    it("空字符串应返回当前时间（默认 fallback）", () => {
      const result = parseMessageTime("");
      expect(result).toBeInstanceOf(Date);
    });

    it("空字符串且 fallbackToNow = false 应返回 null", () => {
      const result = parseMessageTime("", false);
      expect(result).toBeNull();
    });

    it("undefined/null 输入应返回当前时间", () => {
      // @ts-expect-error Testing invalid input
      const result1 = parseMessageTime(undefined);
      // @ts-expect-error Testing invalid input
      const result2 = parseMessageTime(null);
      expect(result1).toBeInstanceOf(Date);
      expect(result2).toBeInstanceOf(Date);
    });
  });

  describe("边界情况", () => {
    it("应该处理带空格的时间字符串", () => {
      const result = parseMessageTime("  14:30  ");
      expect(result?.getHours()).toBe(14);
      expect(result?.getMinutes()).toBe(30);
    });

    it("应该处理没有空格的昨天格式", () => {
      const result = parseMessageTime("昨天14:30");
      expect(result?.getDate()).toBe(4);
    });

    it("应该处理月份开头的格式", () => {
      const result = parseMessageTime("01-15 09:00");
      expect(result?.getMonth()).toBe(0); // January
      expect(result?.getDate()).toBe(15);
    });
  });
});

describe("formatDateForSession", () => {
  it("应该格式化日期为 YYYY-MM-DD", () => {
    const date = new Date("2025-12-05T14:30:00");
    const result = formatDateForSession(date);
    expect(result).toBe("2025-12-05");
  });

  it("应该正确处理月份和日期的零填充", () => {
    const date = new Date("2025-01-05T14:30:00");
    const result = formatDateForSession(date);
    expect(result).toBe("2025-01-05");
  });
});
