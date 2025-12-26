/**
 * Brand Resolution System Type Definitions
 *
 * This file defines the interfaces and types for the brand resolution logic,
 * which determines which brand to use based on multiple input sources and strategies.
 *
 * Note: Some schemas and types are defined for documentation and future runtime validation,
 * even if not currently imported elsewhere.
 */

import { z } from 'zod/v3';
import { BrandPriorityStrategy, BrandPriorityStrategySchema } from './config';

/**
 * Input parameters for brand resolution
 * Contains all possible brand sources and resolution strategy
 */
export const BrandResolutionInputSchema = z.object({
  /** Brand selected from the UI brand selector component */
  uiSelectedBrand: z.string().optional(),

  /** Default brand from configuration storage (IndexedDB) */
  configDefaultBrand: z.string().optional(),

  /** Brand identified from job posting details during tool invocation */
  conversationBrand: z.string().optional(),

  /** List of all available brands in the system */
  availableBrands: z.array(z.string()),

  /** Strategy to use for conflict resolution */
  strategy: BrandPriorityStrategySchema,
});

export type BrandResolutionInput = z.infer<typeof BrandResolutionInputSchema>;

/**
 * Match type for brand resolution
 * Indicates how the brand was matched
 */
export const BrandMatchTypeSchema = z.enum([
  'exact',      // Exact string match
  'fuzzy',      // Fuzzy/alias match
  'fallback',   // Fallback to default
]);

export type BrandMatchType = z.infer<typeof BrandMatchTypeSchema>;

/**
 * Source of the resolved brand
 * Indicates which input source was used
 */
export const BrandSourceSchema = z.enum([
  'ui',           // From UI selection
  'conversation', // From conversation extraction
  'config',       // From configuration default
  'default',      // System fallback (first available)
]);

export type BrandSource = z.infer<typeof BrandSourceSchema>;

/**
 * Output of brand resolution
 * Contains the resolved brand and metadata about the resolution
 */
export const BrandResolutionOutputSchema = z.object({
  /** The final resolved brand name */
  resolvedBrand: z.string(),

  /** How the brand was matched */
  matchType: BrandMatchTypeSchema,

  /** Which source provided the brand */
  source: BrandSourceSchema,

  /** Human-readable explanation of the resolution */
  reason: z.string(),

  /** Optional: The original input that was matched (if fuzzy matched) */
  originalInput: z.string().optional(),
});

export type BrandResolutionOutput = z.infer<typeof BrandResolutionOutputSchema>;

/**
 * Brand matching result from fuzzy matching
 */
export const FuzzyMatchResultSchema = z.object({
  /** Matched brand name */
  brand: z.string(),

  /** Whether it was an exact match */
  isExact: z.boolean(),

  /** The original input that was matched */
  originalInput: z.string(),
});

export type FuzzyMatchResult = z.infer<typeof FuzzyMatchResultSchema>;

/**
 * Resolution priority chains for each strategy
 * Documents the exact priority order for each strategy
 */
export const BRAND_RESOLUTION_PRIORITY = {
  'user-selected': [
    'uiSelectedBrand',
    'configDefaultBrand',
    'firstAvailable',
  ] as const,

  'conversation-extracted': [
    'conversationBrand',
    'uiSelectedBrand',
    'configDefaultBrand',
    'firstAvailable',
  ] as const,

  'smart': [
    'conversationBrand',
    'uiSelectedBrand',
    'configDefaultBrand',
    'firstAvailable',
  ] as const,
} as const;

/**
 * Type guard to check if a value is a valid brand priority strategy
 * Note: Uses the BrandPriorityStrategySchema imported from config.ts
 */
export function isBrandPriorityStrategy(value: unknown): value is BrandPriorityStrategy {
  return BrandPriorityStrategySchema.safeParse(value).success;
}

/**
 * Helper type for brand resolution context
 * Used internally by the resolution logic
 */
export interface BrandResolutionContext {
  /** All brand sources */
  sources: {
    ui?: string;
    conversation?: string;
    config?: string;
  };

  /** Available brands for validation */
  availableBrands: string[];

  /** Current strategy */
  strategy: BrandPriorityStrategy;

  /** Resolution history for debugging */
  attempts: Array<{
    source: string;
    value: string | undefined;
    matched: boolean;
    reason: string;
  }>;
}