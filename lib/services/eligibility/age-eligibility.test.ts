import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { evaluateAgeEligibility } from "./age-eligibility";

const makeResponse = (payload: unknown) =>
  ({
    ok: true,
    status: 200,
    json: async () => payload,
  }) as unknown as Response;

describe("evaluateAgeEligibility", () => {
  const oldFetch = globalThis.fetch;
  const oldToken = process.env.DULIDAY_TOKEN;

  beforeEach(() => {
    process.env.DULIDAY_TOKEN = "test-token";
  });

  afterEach(() => {
    globalThis.fetch = oldFetch;
    process.env.DULIDAY_TOKEN = oldToken;
    vi.restoreAllMocks();
  });

  it("returns unknown when age missing", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      makeResponse({ data: { result: [], total: 0 } })
    );

    const res = await evaluateAgeEligibility({
      age: undefined,
      brandAlias: "上海必胜客",
      cityName: "上海市",
      regionName: "青浦区",
      strategy: {
        enabled: true,
        revealRange: false,
        failStrategy: "fail",
        unknownStrategy: "unknown",
        passStrategy: "pass",
        allowRedirect: true,
        redirectPriority: "medium",
      },
    });

    expect(res.status).toBe("unknown");
    expect(res.appliedStrategy.status).toBe("unknown");
    expect(res.appliedStrategy.strategy).toBe("unknown");
  });

  it("returns pass when any matched job range includes age", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      makeResponse({
        data: {
          result: [
            {
              basicInfo: {
                brandName: "上海必胜客",
                storeInfo: {
                  storeCityName: "上海市",
                  storeRegionName: "青浦区",
                },
              },
              hiringRequirement: {
                basicPersonalRequirements: {
                  minAge: 18,
                  maxAge: 60,
                },
              },
            },
          ],
          total: 1,
        },
      })
    );

    const res = await evaluateAgeEligibility({
      age: 45,
      brandAlias: "上海必胜客",
      cityName: "上海市",
      regionName: "青浦区",
      strategy: {
        enabled: true,
        revealRange: false,
        failStrategy: "fail",
        unknownStrategy: "unknown",
        passStrategy: "pass",
        allowRedirect: true,
        redirectPriority: "medium",
      },
    });

    expect(res.status).toBe("pass");
    expect(res.summary.matchedCount).toBe(1);
    expect(res.summary.minAgeObserved).toBe(18);
    expect(res.summary.maxAgeObserved).toBe(60);
  });

  it("returns fail when matched jobs exist but none include age", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      makeResponse({
        data: {
          result: [
            {
              basicInfo: {
                brandName: "上海必胜客",
                storeInfo: {
                  storeCityName: "上海市",
                  storeRegionName: "青浦区",
                },
              },
              hiringRequirement: {
                basicPersonalRequirements: {
                  minAge: 18,
                  maxAge: 35,
                },
              },
            },
          ],
          total: 1,
        },
      })
    );

    const res = await evaluateAgeEligibility({
      age: 45,
      brandAlias: "上海必胜客",
      cityName: "上海市",
      regionName: "青浦区",
      strategy: {
        enabled: true,
        revealRange: false,
        failStrategy: "fail",
        unknownStrategy: "unknown",
        passStrategy: "pass",
        allowRedirect: true,
        redirectPriority: "medium",
      },
    });

    expect(res.status).toBe("fail");
    // matchedCount 表示 brand+city+region 过滤后命中的岗位数，不等同于年龄通过数
    expect(res.summary.matchedCount).toBe(1);
    expect(res.summary.total).toBe(1);
  });
});
