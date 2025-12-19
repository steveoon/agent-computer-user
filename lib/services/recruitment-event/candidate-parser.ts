/**
 * Candidate Info Parser
 *
 * Utility functions for parsing candidate information strings
 * extracted from recruitment platforms (BOSS直聘, 鱼泡).
 */

/**
 * Parse age string to extract numeric value
 *
 * @param ageStr - Age string like "36岁", "21岁", "36"
 * @returns Numeric string like "36", or undefined if invalid
 *
 * @example
 * parseAge("36岁")  // "36"
 * parseAge("21")    // "21"
 * parseAge(undefined) // undefined
 */
export function parseAge(ageStr?: string): string | undefined {
  if (!ageStr) return undefined;
  const match = ageStr.match(/(\d+)/);
  return match ? match[1] : ageStr;
}

/**
 * Parse salary string to remove unit suffix
 *
 * @param salaryStr - Salary string like "3000-4000元", "3-8K", "3000-4000元/月"
 * @returns Cleaned string like "3000-4000", "3-8K", or undefined if invalid
 *
 * @example
 * parseSalary("3000-4000元")     // "3000-4000"
 * parseSalary("3000-4000元/月")  // "3000-4000"
 * parseSalary("3-8K")            // "3-8K"
 * parseSalary(undefined)         // undefined
 */
export function parseSalary(salaryStr?: string): string | undefined {
  if (!salaryStr) return undefined;
  // Remove "元", "元/月", "元/天" etc. suffixes, keep numbers and separators
  return salaryStr.replace(/元.*$/, "").trim();
}
