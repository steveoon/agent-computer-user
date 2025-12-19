/**
 * Brand Lookup Utility
 *
 * Extracts brand ID from job name by:
 * 1. Using SmartExtractor to find brand names in job_name
 * 2. Querying data_dictionary for exact match
 * 3. Returning data_dictionary.id as brand_id
 */

import { eq, and } from "drizzle-orm";
import { getDb } from "@/db";
import { dataDictionary } from "@/db/schema";
import { SmartExtractor } from "@/lib/prompt-engineering/memory/smart-patterns";

const LOG_PREFIX = "[RecruitmentEvent][BrandLookup]";

/**
 * Extract brand ID from job name
 *
 * @param jobName - Job name string (e.g., "大连肯德基-兼职服务员-就近安排")
 * @returns Brand ID (data_dictionary.id) if found, undefined otherwise
 *
 * @example
 * ```typescript
 * const brandId = await extractBrandIdFromJobName("大连肯德基-兼职服务员");
 * // Returns: 123 (data_dictionary.id for "大连肯德基")
 * ```
 */
export async function extractBrandIdFromJobName(
  jobName?: string
): Promise<number | undefined> {
  if (!jobName) return undefined;

  try {
    // Step 1: Extract brand names from job name using SmartExtractor
    // SmartExtractor returns brands sorted by priority (longest match first)
    const brandNames = await SmartExtractor.extractBrands(jobName);

    if (brandNames.length === 0) {
      return undefined;
    }

    // Step 2: Try each extracted brand name (in priority order) until we find a match
    const db = getDb();

    for (const brandName of brandNames) {
      const brandRecord = await db
        .select({ id: dataDictionary.id })
        .from(dataDictionary)
        .where(
          and(
            eq(dataDictionary.dictionaryType, "brand"),
            eq(dataDictionary.mappingValue, brandName), // Exact match
            eq(dataDictionary.isActive, true)
          )
        )
        .limit(1);

      if (brandRecord.length > 0) {
        return brandRecord[0].id;
      }
    }

    // No matching brand found in database
    return undefined;
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to extract brand ID:`, error);
    return undefined;
  }
}
