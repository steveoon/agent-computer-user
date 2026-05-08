import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetDashboardSummary = vi.fn();
const mockGetStatsTrend = vi.fn();

vi.mock("@/lib/services/recruitment-stats/query.service", () => ({
  queryService: {
    getDashboardSummary: mockGetDashboardSummary,
    getStatsTrend: mockGetStatsTrend,
  },
}));

describe("recruitment stats Open API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDashboardSummary.mockResolvedValue({
      current: [{ totalEvents: 1 }],
      previous: [],
      trend: {},
    });
    mockGetStatsTrend.mockResolvedValue([{ date: "2026-05-07", messagesReceived: 1 }]);
  });

  it("summary rejects unauthorized agentId", async () => {
    const { GET } = await import("../summary/route");
    const req = new Request("http://localhost/api/v1/recruitment-stats/summary?agentId=agent-2", {
      headers: {
        "x-open-api-allowed-agent-ids": JSON.stringify(["agent-1"]),
      },
    });

    const response = await GET(req);

    expect(response.status).toBe(403);
    expect(mockGetDashboardSummary).not.toHaveBeenCalled();
  });

  it("summary supports endDate and comma-separated jobNames", async () => {
    const { GET } = await import("../summary/route");
    const req = new Request(
      "http://localhost/api/v1/recruitment-stats/summary?agentId=agent-1&days=7&endDate=2026-05-07&jobNames=A,B",
      {
        headers: {
          "x-open-api-allowed-agent-ids": JSON.stringify(["agent-1"]),
        },
      }
    );

    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(mockGetDashboardSummary).toHaveBeenCalledWith(
      "agent-1",
      7,
      expect.any(Date),
      undefined,
      ["A", "B"]
    );
  });

  it("summary returns a clear message when the requested range has no data", async () => {
    const { GET } = await import("../summary/route");
    mockGetDashboardSummary.mockResolvedValueOnce({
      current: [],
      previous: [],
      trend: {},
    });
    const req = new Request(
      "http://localhost/api/v1/recruitment-stats/summary?agentId=agent-1&days=7&endDate=2026-05-07",
      {
        headers: {
          "x-open-api-allowed-agent-ids": JSON.stringify(["agent-1"]),
        },
      }
    );

    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe("No recruitment stats found for the requested agent and date range");
    expect(body.data.summary.current).toEqual([]);
  });

  it("trend supports repeated jobNames query params", async () => {
    const { GET } = await import("../trend/route");
    const req = new Request(
      "http://localhost/api/v1/recruitment-stats/trend?agentId=agent-1&startDate=2026-05-01&endDate=2026-05-07&jobNames=A&jobNames=B",
      {
        headers: {
          "x-open-api-allowed-agent-ids": JSON.stringify(["agent-1"]),
        },
      }
    );

    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(mockGetStatsTrend).toHaveBeenCalledWith(
      "agent-1",
      expect.any(Date),
      expect.any(Date),
      undefined,
      ["A", "B"]
    );
  });

  it("trend returns a clear message when the requested range has no data", async () => {
    const { GET } = await import("../trend/route");
    mockGetStatsTrend.mockResolvedValueOnce([]);
    const req = new Request(
      "http://localhost/api/v1/recruitment-stats/trend?agentId=agent-1&startDate=2026-05-01&endDate=2026-05-07",
      {
        headers: {
          "x-open-api-allowed-agent-ids": JSON.stringify(["agent-1"]),
        },
      }
    );

    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe(
      "No recruitment trend data found for the requested agent and date range"
    );
    expect(body.data.trend).toEqual([]);
  });

  it("summary rejects non-integer brandId", async () => {
    const { GET } = await import("../summary/route");
    const req = new Request(
      "http://localhost/api/v1/recruitment-stats/summary?agentId=agent-1&brandId=1.5",
      {
        headers: {
          "x-open-api-allowed-agent-ids": JSON.stringify(["agent-1"]),
        },
      }
    );

    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBe("brandId must be an integer");
    expect(mockGetDashboardSummary).not.toHaveBeenCalled();
  });
});
