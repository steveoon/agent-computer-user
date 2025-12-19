/**
 * Time Parser Utility
 *
 * Parses time strings from recruitment platforms into Date objects.
 * Uses simplified parsing strategy: if parsing fails, returns current time.
 *
 * Supported formats:
 * - "HH:MM" (e.g., "14:30") - assumes today
 * - "MM-DD HH:MM" (e.g., "12-04 14:30") - assumes current year
 * - "YYYY-MM-DD HH:MM" (e.g., "2025-12-04 14:30") - full date
 * - "昨天 HH:MM" (e.g., "昨天 14:30") - yesterday
 * - "前天 HH:MM" (e.g., "前天 14:30") - day before yesterday
 */

const LOG_PREFIX = "[TimeParser]";

/**
 * Parse a time string from the platform into a Date object
 *
 * @param timeStr - The time string to parse
 * @param fallbackToNow - If true, returns current time on parse failure (default: true)
 * @returns Parsed Date or current time if parsing fails and fallbackToNow is true
 */
export function parseMessageTime(timeStr: string, fallbackToNow = true): Date | null {
  if (!timeStr || typeof timeStr !== "string") {
    return fallbackToNow ? new Date() : null;
  }

  const trimmed = timeStr.trim();
  const now = new Date();

  try {
    // Full datetime: "2025-12-04 14:30"
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(trimmed)) {
      const parsed = new Date(trimmed.replace(" ", "T") + ":00");
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    // Date without year: "12-04 14:30"
    const dateTimeMatch = trimmed.match(/^(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
    if (dateTimeMatch) {
      const [, month, day, hour, minute] = dateTimeMatch;
      const result = new Date(
        now.getFullYear(),
        parseInt(month, 10) - 1,
        parseInt(day, 10),
        parseInt(hour, 10),
        parseInt(minute, 10)
      );

      // Handle year rollover: if parsed date is in the future (with 1 month buffer),
      // assume it's from last year.
      // Example: Current is Jan 2025, parsed is Dec 2025 -> should be Dec 2024
      if (result > new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)) {
        result.setFullYear(result.getFullYear() - 1);
      }

      if (!isNaN(result.getTime())) {
        return result;
      }
    }

    // Time only: "14:30"
    const timeOnlyMatch = trimmed.match(/^(\d{2}):(\d{2})$/);
    if (timeOnlyMatch) {
      const [, hour, minute] = timeOnlyMatch;
      const result = new Date(now);
      result.setHours(parseInt(hour, 10), parseInt(minute, 10), 0, 0);
      return result;
    }

    // Yesterday: "昨天 14:30"
    const yesterdayMatch = trimmed.match(/^昨天\s*(\d{2}):(\d{2})/);
    if (yesterdayMatch) {
      const [, hour, minute] = yesterdayMatch;
      const result = new Date(now);
      result.setDate(result.getDate() - 1);
      result.setHours(parseInt(hour, 10), parseInt(minute, 10), 0, 0);
      return result;
    }

    // Day before yesterday: "前天 14:30"
    const dayBeforeMatch = trimmed.match(/^前天\s*(\d{2}):(\d{2})/);
    if (dayBeforeMatch) {
      const [, hour, minute] = dayBeforeMatch;
      const result = new Date(now);
      result.setDate(result.getDate() - 2);
      result.setHours(parseInt(hour, 10), parseInt(minute, 10), 0, 0);
      return result;
    }

    // ISO string or other standard formats
    const isoDate = new Date(trimmed);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to parse time string: "${timeStr}"`, error);
  }

  // Fallback
  if (fallbackToNow) {
    console.warn(`${LOG_PREFIX} Using current time as fallback for: "${timeStr}"`);
    return new Date();
  }

  return null;
}

/**
 * Format a Date to YYYY-MM-DD string (for sessionId generation)
 *
 * @param date - The date to format
 * @returns Formatted date string
 */
export function formatDateForSession(date: Date): string {
  return date.toISOString().split("T")[0];
}
