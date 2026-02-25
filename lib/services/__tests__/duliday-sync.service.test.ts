import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DulidaySyncService } from "@/lib/services/duliday-sync.service";

describe("DulidaySyncService 新结构校验", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("fetchJobList 应接受新 Duliday 分段结构并返回有效记录", async () => {
    const mockApiResponse = {
      code: 0,
      message: "success",
      data: {
        result: [
          {
            basicInfo: {
              jobBasicInfoId: 6001,
              jobStoreId: 6001,
              storeId: 6001,
              storeName: "新结构门店",
              storeCityId: 310100,
              storeRegionId: 310101,
              jobName: "新结构-门店-服务员-兼职",
              jobId: 6001,
              cityName: ["上海市"],
              postTime: "2026.02.25 16:00",
              successDuliriUserId: 6001,
              successNameStr: "测试",
              storeAddress: "上海市-黄浦区-测试路",
            },
            jobSalary: {
              salary: 26,
              salaryUnitStr: "元/小时",
            },
            welfare: {
              id: 6001,
              jobBasicInfoId: 6001,
              haveInsurance: 1,
              accommodation: 0,
              accommodationSalary: null,
              accommodationSalaryUnit: null,
              probationAccommodationSalaryReceive: null,
              catering: 0,
              cateringImage: null,
              cateringSalary: null,
              cateringSalaryUnit: null,
              trafficAllowanceSalary: null,
              trafficAllowanceSalaryUnit: null,
              otherWelfare: null,
              moreWelfares: null,
              insuranceFund: null,
              insuranceFundCityId: null,
              insuranceFundCityStr: null,
              insuranceFundAmount: null,
              memo: "",
              promotionWelfare: null,
              accommodationNum: null,
              commuteDistance: null,
              accommodationEnv: null,
              imagesDTOList: null,
            },
            hiringRequirement: {
              cooperationMode: 2,
              requirementNum: 2,
              thresholdNum: 10,
              signUpNum: 0,
            },
            workTime: {
              id: 6001,
              jobBasicInfoId: 6001,
              employmentForm: 2,
              minWorkMonths: 1,
              temporaryEmploymentStartTime: null,
              temporaryEmploymentEndTime: null,
              employmentDescription: null,
              monthWorkTimeRequirement: 0,
              perMonthMinWorkTime: null,
              perMonthMinWorkTimeUnit: null,
              perMonthMaxRestTime: null,
              perMonthMaxRestTimeUnit: null,
              weekWorkTimeRequirement: 3,
              perWeekNeedWorkDays: 3,
              perWeekWorkDays: null,
              perWeekRestDays: null,
              evenOddType: null,
              customWorkTimes: null,
              dayWorkTimeRequirement: 1,
              perDayMinWorkHours: 4,
              arrangementType: 2,
              fixedArrangementTimes: null,
              combinedArrangementTimes: null,
              goToWorkStartTime: null,
              goToWorkEndTime: null,
              goOffWorkStartTime: null,
              goOffWorkEndTime: null,
              maxWorkTakingTime: 30,
              restTimeDesc: null,
              workTimeRemark: "新结构服务测试",
            },
            interviewProcess: {},
          },
        ],
        total: 1,
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
      status: 200,
      statusText: "OK",
    } as Response);

    const service = new DulidaySyncService("mock-token");
    const result = await service.fetchJobList([5], ["上海市"]);

    expect(result.totalCount).toBe(1);
    expect(result.validPositions.length).toBe(1);
    expect(result.invalidPositions.length).toBe(0);
  });
});
