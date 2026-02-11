import { z } from "zod/v3";

const DULIDAY_JOB_LIST_ENDPOINT = "https://k8s.duliday.com/persistence/ai/api/job/list";

export type AgeEligibilityStatus = "pass" | "fail" | "unknown";

export type AgeEligibilitySummary = {
  minAgeObserved: number | null;
  maxAgeObserved: number | null;
  matchedCount: number;
  total: number;
};

export type AgeQualificationPolicy = {
  enabled: boolean;
  revealRange: boolean;
  failStrategy: string;
  unknownStrategy: string;
  passStrategy: string;
  allowRedirect: boolean;
  redirectPriority: "low" | "medium" | "high";
};

export type AgeEligibilityAppliedStrategy = AgeQualificationPolicy & {
  status: AgeEligibilityStatus;
  strategy: string;
};

export type AgeEligibilityResult = {
  status: AgeEligibilityStatus;
  summary: AgeEligibilitySummary;
  appliedStrategy: AgeEligibilityAppliedStrategy;
};

const fallbackPolicy: AgeQualificationPolicy = {
  enabled: false,
  revealRange: false,
  failStrategy: "礼貌说明不匹配，避免承诺",
  unknownStrategy: "先核实年龄或资格条件",
  passStrategy: "确认匹配后推进下一步",
  allowRedirect: false,
  redirectPriority: "low",
};

const jobListResponseSchema = z.object({
  data: z
    .object({
      result: z.array(z.unknown()).optional(),
      list: z.array(z.unknown()).optional(),
      total: z.number().optional(),
    })
    .nullable()
    .optional(),
  result: z.array(z.unknown()).optional(),
});

const JOB_LIST_CACHE_TTL_MS = 60_000;
let jobListCache: { token: string; payload: unknown; fetchedAt: number } | null = null;
let inflightJobListRequest: Promise<unknown> | null = null;

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function firstText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const first = value.find(item => typeof item === "string");
    return typeof first === "string" ? first : "";
  }
  return "";
}

function pickText(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    if (key in source) {
      const text = firstText(source[key]);
      if (text) return text;
    }
  }
  return "";
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function buildAppliedStrategy(
  status: AgeEligibilityStatus,
  policy?: AgeQualificationPolicy
): AgeEligibilityAppliedStrategy {
  const effective = policy ?? fallbackPolicy;
  const strategy =
    status === "pass"
      ? effective.passStrategy
      : status === "fail"
      ? effective.failStrategy
      : effective.unknownStrategy;

  return {
    ...effective,
    status,
    strategy,
  };
}

function extractResults(payload: unknown): { items: unknown[]; total: number } {
  const parsed = jobListResponseSchema.safeParse(payload);
  if (!parsed.success) {
    return { items: [], total: 0 };
  }

  const data = parsed.data;
  const items =
    data.data?.result ??
    data.data?.list ??
    (Array.isArray(data.result) ? data.result : []);

  const total = data.data?.total ?? (Array.isArray(items) ? items.length : 0);

  return {
    items: Array.isArray(items) ? items : [],
    total: typeof total === "number" ? total : 0,
  };
}

async function fetchJobList(token: string): Promise<unknown> {
  const shouldUseCache = process.env.NODE_ENV !== "test";
  const now = Date.now();
  if (
    shouldUseCache &&
    jobListCache &&
    jobListCache.token === token &&
    now - jobListCache.fetchedAt < JOB_LIST_CACHE_TTL_MS
  ) {
    return jobListCache.payload;
  }

  if (shouldUseCache && inflightJobListRequest) {
    return inflightJobListRequest;
  }

  inflightJobListRequest = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    const requestBody = {
      // Duliday 接口从 1 开始分页；传 0 会返回 50000
      pageNum: 1,
      pageSize: 200,
    };

    try {
      let response = await fetch(DULIDAY_JOB_LIST_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Duliday-Token": token,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        if ([400, 405, 415].includes(response.status)) {
          const url = new URL(DULIDAY_JOB_LIST_ENDPOINT);
          url.searchParams.set("pageNum", "0");
          url.searchParams.set("pageSize", "200");
          response = await fetch(url.toString(), {
            headers: {
              "Duliday-Token": token,
            },
            signal: controller.signal,
          });
        }
      }

      if (!response.ok) {
        throw new Error(`Duliday job list fetch failed: ${response.status}`);
      }

      const payload = await response.json();
      jobListCache = {
        token,
        payload,
        fetchedAt: Date.now(),
      };
      return payload;
    } finally {
      clearTimeout(timeoutId);
      inflightJobListRequest = null;
    }
  })();

  return inflightJobListRequest;
}

export async function evaluateAgeEligibility({
  age,
  brandAlias,
  cityName,
  regionName,
  strategy,
}: {
  age?: number | null;
  brandAlias?: string | null;
  cityName?: string | null;
  regionName?: string | null;
  strategy?: AgeQualificationPolicy;
}): Promise<AgeEligibilityResult> {
  const token = process.env.DULIDAY_TOKEN;
  const summary: AgeEligibilitySummary = {
    minAgeObserved: null,
    maxAgeObserved: null,
    matchedCount: 0,
    total: 0,
  };

  if (!token) {
    return {
      status: "unknown",
      summary,
      appliedStrategy: buildAppliedStrategy("unknown", strategy),
    };
  }

  try {
    const payload = await fetchJobList(token);
    const { items, total } = extractResults(payload);

    summary.total = total;

    const brandFilter = normalizeText(brandAlias);
    const cityFilter = normalizeText(cityName);
    const regionFilter = normalizeText(regionName);

    let anyRange = false;
    let anyMatch = false;

    for (const item of items) {
      if (!isRecord(item)) {
        continue;
      }

      // 接口返回结构可能是扁平字段，也可能嵌套在 basicInfo/storeInfo 下
      const record = item;
      const basicInfo = isRecord(record.basicInfo) ? (record.basicInfo as Record<string, unknown>) : null;
      const storeInfo =
        basicInfo && isRecord(basicInfo.storeInfo) ? (basicInfo.storeInfo as Record<string, unknown>) : null;

      const itemBrand = normalizeText(
        pickText(record, ["brandAlias", "brandName", "brand", "organizationName"]) ||
          (basicInfo ? pickText(basicInfo, ["brandAlias", "brandName", "brand"]) : "")
      );
      const itemCity = normalizeText(
        pickText(record, ["cityName", "storeCityName", "jobCityName"]) ||
          (storeInfo ? pickText(storeInfo, ["storeCityName", "cityName"]) : "")
      );
      const itemRegion = normalizeText(
        pickText(record, ["regionName", "storeRegionName", "districtName"]) ||
          (storeInfo ? pickText(storeInfo, ["storeRegionName", "regionName", "districtName"]) : "")
      );
      const itemAddress = normalizeText(
        pickText(record, ["storeAddress", "jobAddress", "address", "storeExactAddress"]) ||
          (storeInfo ? pickText(storeInfo, ["storeAddress", "storeExactAddress", "address"]) : "")
      );

      if (brandFilter && !itemBrand.includes(brandFilter)) {
        continue;
      }
      if (cityFilter && !itemCity.includes(cityFilter)) {
        continue;
      }
      if (regionFilter && !itemRegion.includes(regionFilter) && !itemAddress.includes(regionFilter)) {
        continue;
      }

      summary.matchedCount += 1;

      const hiringRequirement = isRecord(record.hiringRequirement)
        ? record.hiringRequirement
        : undefined;
      const requirement = isRecord(hiringRequirement?.basicPersonalRequirements)
        ? hiringRequirement.basicPersonalRequirements
        : undefined;

      const minAge = toNumber(requirement?.minAge ?? record.minAge);
      const maxAge = toNumber(requirement?.maxAge ?? record.maxAge);

      if (minAge !== null) {
        anyRange = true;
        summary.minAgeObserved =
          summary.minAgeObserved === null ? minAge : Math.min(summary.minAgeObserved, minAge);
      }
      if (maxAge !== null) {
        anyRange = true;
        summary.maxAgeObserved =
          summary.maxAgeObserved === null ? maxAge : Math.max(summary.maxAgeObserved, maxAge);
      }

      if (typeof age === "number") {
        const belowMin = minAge !== null && age < minAge;
        const aboveMax = maxAge !== null && age > maxAge;
        if (!belowMin && !aboveMax) {
          anyMatch = true;
        }
      }
    }

    if (typeof age !== "number" || summary.matchedCount === 0 || !anyRange) {
      return {
        status: "unknown",
        summary,
        appliedStrategy: buildAppliedStrategy("unknown", strategy),
      };
    }

    const status: AgeEligibilityStatus = anyMatch ? "pass" : "fail";

    return {
      status,
      summary,
      appliedStrategy: buildAppliedStrategy(status, strategy),
    };
  } catch (_error) {
    return {
      status: "unknown",
      summary,
      appliedStrategy: buildAppliedStrategy("unknown", strategy),
    };
  }
}
