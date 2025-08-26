import { describe, it, expect } from "vitest";
import { convertDulidayListToZhipinData } from "../duliday-to-zhipin.mapper";
import { DulidayRaw } from "@/types/zhipin";

describe("Duliday to Zhipin Mapper", () => {
  describe("数据验证和转换", () => {
    it("当 perWeekWorkDays 有值时，应该成功验证即使 customWorkTimes.minWorkDays 为 null", () => {
      // 使用真实失败的数据
      const testData: DulidayRaw.Position = {
        jobBasicInfoId: 34921,
        jobStoreId: 34287,
        storeId: 307895,
        storeName: "3006苏州景城邻里",
        storeCityId: 320500,
        storeRegionId: 320576,
        jobName: "奥乐齐-3006苏州景城邻里-通岗店员-全职",
        jobId: 523827,
        cityName: ["苏州市"],
        salary: 5000,
        salaryUnitStr: "元/月",
        workTimeArrangement: {
          id: 34825,
          jobBasicInfoId: 34921,
          employmentForm: 1,
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
          perWeekNeedWorkDays: null,
          perWeekWorkDays: 5, // 有值
          perWeekRestDays: 2,
          evenOddType: null,
          customWorkTimes: [
            {
              jobWorkTimeArrangementId: 34825,
              weekdays: [0, 1, 2, 3, 4, 5, 6],
              minWorkDays: null, // null 值
              maxWorkDays: null, // null 值
            },
          ],
          dayWorkTimeRequirement: 1,
          perDayMinWorkHours: 8,
          arrangementType: 3,
          fixedArrangementTimes: null,
          combinedArrangementTimes: [
            {
              jobWorkTimeArrangementId: 34825,
              startTime: 18000,
              endTime: 50400,
              weekdays: [0, 1, 2, 3, 4, 5, 6],
            },
            {
              jobWorkTimeArrangementId: 34825,
              startTime: 50400,
              endTime: 82800,
              weekdays: [0, 1, 2, 3, 4, 5, 6],
            },
          ],
          goToWorkStartTime: null,
          goToWorkEndTime: null,
          goOffWorkStartTime: null,
          goOffWorkEndTime: null,
          maxWorkTakingTime: 60,
          restTimeDesc: null,
          workTimeRemark:
            "门店排班：至少保证每周有1天休息，结合门店业务情况，也有可能一周安排两天休息，每天8小时，超出月工时标准计算加班工资，最早上班时间5点，最晚23点下班，分两个班次排班（5：00-14：00；14：00-23：00），必须接受排班。",
        },
        welfare: {
          id: 34881,
          jobBasicInfoId: 34921,
          haveInsurance: 2,
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
          insuranceFund: [1, 2, 3, 4, 5, 6],
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
        cooperationMode: 3,
        requirementNum: 2,
        thresholdNum: 10,
        signUpNum: 8,
        postTime: "2025.08.25 17:34",
        successDuliriUserId: 3624,
        successNameStr: "姚怡玟",
        storeAddress: "江苏省苏州市-苏州工业园区-九华路65号景城邻里中心",
      };

      // 先验证数据可以通过 Zod schema
      expect(() => {
        DulidayRaw.PositionSchema.parse(testData);
      }).not.toThrow();

      // 创建 mock response
      const mockResponse: DulidayRaw.ListResponse = {
        code: 0,
        message: "操作成功",
        data: {
          result: [testData],
          total: 1,
        },
      };

      // 测试转换
      const result = convertDulidayListToZhipinData(mockResponse, 865); // 奥乐齐的组织ID

      // 验证转换结果
      expect(result.stores).toHaveLength(1);
      expect(result.stores![0].positions).toHaveLength(1);

      const position = result.stores![0].positions[0];

      // 验证关键字段正确处理
      expect(position.attendanceRequirement?.minimumDays).toBe(5); // 应该使用 perWeekWorkDays 的值
      expect(position.minHoursPerWeek).toBe(40); // 8小时 * 5天
      expect(position.maxHoursPerWeek).toBe(56); // 8小时 * 7天
    });

    it("当 perWeekWorkDays 为 null 但 customWorkTimes.minWorkDays 有值时，应该使用 customWorkTimes", () => {
      const testData: DulidayRaw.Position = {
        jobBasicInfoId: 12345,
        jobStoreId: 12345,
        storeId: 12345,
        storeName: "测试门店",
        storeCityId: 310100,
        storeRegionId: 310101,
        jobName: "测试品牌-测试门店-服务员-兼职",
        jobId: 12345,
        cityName: ["上海市"],
        salary: 25,
        salaryUnitStr: "元/小时",
        workTimeArrangement: {
          id: 12345,
          jobBasicInfoId: 12345,
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
          perWeekNeedWorkDays: null,
          perWeekWorkDays: null, // 没有值
          perWeekRestDays: null,
          evenOddType: null,
          customWorkTimes: [
            {
              jobWorkTimeArrangementId: 12345,
              weekdays: [1, 2, 3, 4, 5],
              minWorkDays: 3, // 有值
              maxWorkDays: 5, // 有值
            },
          ],
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
          workTimeRemark: "灵活排班",
        },
        welfare: {
          id: 12345,
          jobBasicInfoId: 12345,
          haveInsurance: 0,
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
          insuranceFund: [],
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
        cooperationMode: 2,
        requirementNum: 5,
        thresholdNum: 10,
        signUpNum: 0,
        postTime: "2025.08.25 10:00",
        successDuliriUserId: 1234,
        successNameStr: "测试人员",
        storeAddress: "上海市-浦东新区-测试地址",
      };

      // 验证数据可以通过 Zod schema
      expect(() => {
        DulidayRaw.PositionSchema.parse(testData);
      }).not.toThrow();

      const mockResponse: DulidayRaw.ListResponse = {
        code: 0,
        message: "操作成功",
        data: {
          result: [testData],
          total: 1,
        },
      };

      const result = convertDulidayListToZhipinData(mockResponse, 100);
      const position = result.stores![0].positions[0];

      // 验证使用了 customWorkTimes 的值
      expect(position.attendanceRequirement?.minimumDays).toBe(3); // 使用 customWorkTimes.minWorkDays
      expect(position.minHoursPerWeek).toBe(12); // 4小时 * 3天
    });

    it("当 perWeekWorkDays 为 null 且 customWorkTimes 有多个不同的 minWorkDays 时，应该选择最小值", () => {
      const testData: DulidayRaw.Position = {
        jobBasicInfoId: 54321,
        jobStoreId: 54321,
        storeId: 54321,
        storeName: "复杂排班门店",
        storeCityId: 310100,
        storeRegionId: 310101,
        jobName: "测试品牌-复杂排班门店-收银员-兼职",
        jobId: 54321,
        cityName: ["上海市"],
        salary: 30,
        salaryUnitStr: "元/小时",
        workTimeArrangement: {
          id: 54321,
          jobBasicInfoId: 54321,
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
          perWeekNeedWorkDays: null,
          perWeekWorkDays: null, // 没有值
          perWeekRestDays: null,
          evenOddType: null,
          customWorkTimes: [
            {
              jobWorkTimeArrangementId: 54321,
              weekdays: [1, 2, 3],
              minWorkDays: 2, // 最小值
              maxWorkDays: 3,
            },
            {
              jobWorkTimeArrangementId: 54321,
              weekdays: [4, 5, 6, 0],
              minWorkDays: 4, // 较大值
              maxWorkDays: 4,
            },
            {
              jobWorkTimeArrangementId: 54321,
              weekdays: [5, 6, 0],
              minWorkDays: null, // null 值，应该被忽略
              maxWorkDays: null,
            },
          ],
          dayWorkTimeRequirement: 1,
          perDayMinWorkHours: 6,
          arrangementType: 2,
          fixedArrangementTimes: null,
          combinedArrangementTimes: null,
          goToWorkStartTime: null,
          goToWorkEndTime: null,
          goOffWorkStartTime: null,
          goOffWorkEndTime: null,
          maxWorkTakingTime: 30,
          restTimeDesc: null,
          workTimeRemark: "多时段灵活排班",
        },
        welfare: {
          id: 54321,
          jobBasicInfoId: 54321,
          haveInsurance: 0,
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
          insuranceFund: [],
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
        cooperationMode: 2,
        requirementNum: 3,
        thresholdNum: 10,
        signUpNum: 1,
        postTime: "2025.08.25 11:00",
        successDuliriUserId: 5432,
        successNameStr: "测试员工",
        storeAddress: "上海市-静安区-测试路",
      };

      const mockResponse: DulidayRaw.ListResponse = {
        code: 0,
        message: "操作成功",
        data: {
          result: [testData],
          total: 1,
        },
      };

      const result = convertDulidayListToZhipinData(mockResponse, 100);
      const position = result.stores![0].positions[0];

      // 验证选择了最小的非 null minWorkDays
      expect(position.attendanceRequirement?.minimumDays).toBe(2); // 最小的非 null 值
      expect(position.minHoursPerWeek).toBe(12); // 6小时 * 2天
    });

    it("验证数据必须满足至少一个字段有值的约束", () => {
      const invalidData = {
        jobBasicInfoId: 99999,
        jobStoreId: 99999,
        storeId: 99999,
        storeName: "无效数据门店",
        storeCityId: 310100,
        storeRegionId: 310101,
        jobName: "测试品牌-无效数据门店-服务员-兼职",
        jobId: 99999,
        cityName: ["上海市"],
        salary: 20,
        salaryUnitStr: "元/小时",
        workTimeArrangement: {
          id: 99999,
          jobBasicInfoId: 99999,
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
          perWeekNeedWorkDays: null,
          perWeekWorkDays: null, // 没有值
          perWeekRestDays: null,
          evenOddType: null,
          customWorkTimes: [
            {
              jobWorkTimeArrangementId: 99999,
              weekdays: [1, 2, 3],
              minWorkDays: null, // 也没有值
              maxWorkDays: null,
            },
          ],
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
          workTimeRemark: "测试备注",
        },
        welfare: {
          id: 99999,
          jobBasicInfoId: 99999,
          haveInsurance: 0,
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
          insuranceFund: [],
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
        cooperationMode: 2,
        requirementNum: 1,
        thresholdNum: 10,
        signUpNum: 0,
        postTime: "2025.08.25 12:00",
        successDuliriUserId: 9999,
        successNameStr: "测试",
        storeAddress: "上海市-浦东新区-测试",
      };

      // 验证应该失败，因为 perWeekWorkDays 和所有 customWorkTimes.minWorkDays 都是 null
      expect(() => {
        DulidayRaw.PositionSchema.parse(invalidData);
      }).toThrow(/必须提供 perWeekWorkDays 或至少一个 customWorkTimes.minWorkDays/);
    });
  });
});