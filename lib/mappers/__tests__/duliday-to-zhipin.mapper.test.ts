import { describe, it, expect } from "vitest";
import { convertDulidayListToZhipinData } from "../duliday-to-zhipin.mapper";
import { DulidayRaw, ZhipinDataSchema, getAllStores, type Store, type Position, type ZhipinData } from "@/types/zhipin";

describe("Duliday to Zhipin Mapper", () => {
  describe("数据验证和转换", () => {
    it("当 perWeekWorkDays 有值时，应该成功验证即使 customWorkTimes.minWorkDays 为 null", async () => {
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
      const result = await convertDulidayListToZhipinData(mockResponse, 865); // 奥乐齐的组织ID

      // 验证转换结果
      expect(result.brands![0].stores).toHaveLength(1);
      expect(result.brands![0].stores[0].positions).toHaveLength(1);

      const position = result.brands![0].stores[0].positions[0];

      // 验证关键字段正确处理
      expect(position.attendanceRequirement?.minimumDays).toBe(5); // 应该使用 perWeekWorkDays 的值
      expect(position.minHoursPerWeek).toBe(40); // 8小时 * 5天
      expect(position.maxHoursPerWeek).toBe(56); // 8小时 * 7天
    });

    it("当 perWeekWorkDays 为 null 但 customWorkTimes.minWorkDays 有值时，应该使用 customWorkTimes", async () => {
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

      const result = await convertDulidayListToZhipinData(mockResponse, 100);
      const position = result.brands![0].stores[0].positions[0];

      // 验证使用了 customWorkTimes 的值
      expect(position.attendanceRequirement?.minimumDays).toBe(3); // 使用 customWorkTimes.minWorkDays
      expect(position.minHoursPerWeek).toBe(12); // 4小时 * 3天
    });

    it("当 perWeekWorkDays 为 null 且 customWorkTimes 有多个不同的 minWorkDays 时，应该选择最小值", async () => {
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

      const result = await convertDulidayListToZhipinData(mockResponse, 100);
      const position = result.brands![0].stores[0].positions[0];

      // 验证选择了最小的非 null minWorkDays
      expect(position.attendanceRequirement?.minimumDays).toBe(2); // 最小的非 null 值
      expect(position.minHoursPerWeek).toBe(12); // 6小时 * 2天
    });

    it("当 perWeekWorkDays 和 customWorkTimes.minWorkDays 都为 null 但 perWeekNeedWorkDays 有值时，应该使用 perWeekNeedWorkDays", async () => {
      const testData: DulidayRaw.Position = {
        jobBasicInfoId: 77777,
        jobStoreId: 77777,
        storeId: 77777,
        storeName: "perWeekNeedWorkDays测试门店",
        storeCityId: 310100,
        storeRegionId: 310101,
        jobName: "测试品牌-perWeekNeedWorkDays测试门店-服务员-兼职",
        jobId: 77777,
        cityName: ["上海市"],
        salary: 22,
        salaryUnitStr: "元/小时",
        workTimeArrangement: {
          id: 77777,
          jobBasicInfoId: 77777,
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
          perWeekNeedWorkDays: 3, // 有值，应该使用这个
          perWeekWorkDays: null, // 没有值
          perWeekRestDays: null,
          evenOddType: null,
          customWorkTimes: [
            {
              jobWorkTimeArrangementId: 77777,
              weekdays: [1, 2, 3, 4, 5],
              minWorkDays: null, // 没有值
              maxWorkDays: null,
            },
          ],
          dayWorkTimeRequirement: 1,
          perDayMinWorkHours: 5,
          arrangementType: 2,
          fixedArrangementTimes: null,
          combinedArrangementTimes: null,
          goToWorkStartTime: null,
          goToWorkEndTime: null,
          goOffWorkStartTime: null,
          goOffWorkEndTime: null,
          maxWorkTakingTime: 30,
          restTimeDesc: null,
          workTimeRemark: "使用 perWeekNeedWorkDays",
        },
        welfare: {
          id: 77777,
          jobBasicInfoId: 77777,
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
        signUpNum: 0,
        postTime: "2025.08.25 13:00",
        successDuliriUserId: 7777,
        successNameStr: "测试人员3",
        storeAddress: "上海市-徐汇区-测试路",
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

      const result = await convertDulidayListToZhipinData(mockResponse, 100);
      const position = result.brands![0].stores[0].positions[0];

      // 验证使用了 perWeekNeedWorkDays 的值
      expect(position.attendanceRequirement?.minimumDays).toBe(3); // 使用 perWeekNeedWorkDays
      expect(position.minHoursPerWeek).toBe(15); // 5小时 * 3天
    });

    it("验证优先级：perWeekWorkDays > customWorkTimes.minWorkDays > perWeekNeedWorkDays", async () => {
      // 测试场景：所有三个字段都有值，应该使用 perWeekWorkDays
      const testDataPriority1: DulidayRaw.Position = {
        jobBasicInfoId: 88888,
        jobStoreId: 88888,
        storeId: 88888,
        storeName: "优先级测试门店1",
        storeCityId: 310100,
        storeRegionId: 310101,
        jobName: "测试品牌-优先级测试门店1-服务员-兼职",
        jobId: 88888,
        cityName: ["上海市"],
        salary: 25,
        salaryUnitStr: "元/小时",
        workTimeArrangement: {
          id: 88888,
          jobBasicInfoId: 88888,
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
          perWeekNeedWorkDays: 2, // 有值
          perWeekWorkDays: 4, // 有值，应该优先使用这个
          perWeekRestDays: null,
          evenOddType: null,
          customWorkTimes: [
            {
              jobWorkTimeArrangementId: 88888,
              weekdays: [1, 2, 3, 4, 5],
              minWorkDays: 3, // 有值，但优先级低于 perWeekWorkDays
              maxWorkDays: 5,
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
          workTimeRemark: "测试优先级1",
        },
        welfare: {
          id: 88888,
          jobBasicInfoId: 88888,
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
        signUpNum: 0,
        postTime: "2025.08.25 14:00",
        successDuliriUserId: 8888,
        successNameStr: "测试人员4",
        storeAddress: "上海市-黄浦区-测试路",
      };

      const mockResponse1: DulidayRaw.ListResponse = {
        code: 0,
        message: "操作成功",
        data: {
          result: [testDataPriority1],
          total: 1,
        },
      };

      const result1 = await convertDulidayListToZhipinData(mockResponse1, 100);
      const position1 = result1.brands![0].stores[0].positions[0];

      // 应该使用 perWeekWorkDays = 4
      expect(position1.attendanceRequirement?.minimumDays).toBe(4);
      expect(position1.minHoursPerWeek).toBe(24); // 6小时 * 4天

      // 测试场景：只有 customWorkTimes.minWorkDays 和 perWeekNeedWorkDays 有值
      const testDataPriority2: DulidayRaw.Position = {
        ...testDataPriority1,
        jobBasicInfoId: 88889,
        jobId: 88889,
        workTimeArrangement: {
          ...testDataPriority1.workTimeArrangement,
          id: 88889,
          jobBasicInfoId: 88889,
          perWeekNeedWorkDays: 2, // 有值
          perWeekWorkDays: null, // 没有值
          customWorkTimes: [
            {
              jobWorkTimeArrangementId: 88889,
              weekdays: [1, 2, 3, 4, 5],
              minWorkDays: 3, // 有值，应该优先使用这个
              maxWorkDays: 5,
            },
          ],
        },
      };

      const mockResponse2: DulidayRaw.ListResponse = {
        code: 0,
        message: "操作成功",
        data: {
          result: [testDataPriority2],
          total: 1,
        },
      };

      const result2 = await convertDulidayListToZhipinData(mockResponse2, 100);
      const position2 = result2.brands![0].stores[0].positions[0];

      // 应该使用 customWorkTimes.minWorkDays = 3
      expect(position2.attendanceRequirement?.minimumDays).toBe(3);
      expect(position2.minHoursPerWeek).toBe(18); // 6小时 * 3天
    });

    it("当所有三个字段都为 null 时，应该使用默认值 5", async () => {
      const testData: DulidayRaw.Position = {
        jobBasicInfoId: 99999,
        jobStoreId: 99999,
        storeId: 99999,
        storeName: "默认值测试门店",
        storeCityId: 310100,
        storeRegionId: 310101,
        jobName: "测试品牌-默认值测试门店-服务员-兼职",
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
          perWeekNeedWorkDays: null, // 没有值
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
          workTimeRemark: "测试默认值",
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

      const mockResponse: DulidayRaw.ListResponse = {
        code: 0,
        message: "操作成功",
        data: {
          result: [testData],
          total: 1,
        },
      };

      const result = await convertDulidayListToZhipinData(mockResponse, 100);
      const position = result.brands![0].stores[0].positions[0];

      // 应该使用默认值 5
      expect(position.attendanceRequirement?.minimumDays).toBe(5);
      expect(position.minHoursPerWeek).toBe(20); // 4小时 * 5天
    });

    it("应该保留品牌/项目追踪字段并优先使用新字段", async () => {
      const basePosition: DulidayRaw.Position = {
        jobBasicInfoId: 9001,
        jobStoreId: 9001,
        storeId: 9001,
        storeName: "追踪门店",
        storeCityId: 310100,
        storeRegionId: 310101,
        jobName: "追踪品牌-追踪门店-服务员-兼职",
        jobId: 9001,
        organizationId: 101,
        organizationName: "组织名称",
        brandId: 202,
        brandName: "品牌名称",
        projectId: 303,
        projectName: "项目名称",
        cityName: ["上海市"],
        salary: 25,
        salaryUnitStr: "元/小时",
        workTimeArrangement: {
          id: 9001,
          jobBasicInfoId: 9001,
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
          perWeekWorkDays: 4,
          perWeekRestDays: null,
          evenOddType: null,
          customWorkTimes: null,
          dayWorkTimeRequirement: 1,
          perDayMinWorkHours: 5,
          arrangementType: 2,
          fixedArrangementTimes: null,
          combinedArrangementTimes: null,
          goToWorkStartTime: null,
          goToWorkEndTime: null,
          goOffWorkStartTime: null,
          goOffWorkEndTime: null,
          maxWorkTakingTime: 30,
          restTimeDesc: null,
          workTimeRemark: "追踪测试",
        },
        welfare: {
          id: 9001,
          jobBasicInfoId: 9001,
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

      const mockResponse: DulidayRaw.ListResponse = {
        code: 0,
        message: "操作成功",
        data: {
          result: [basePosition],
          total: 1,
        },
      };

      const result = await convertDulidayListToZhipinData(mockResponse, 100);
      const position = result.brands![0].stores[0].positions[0];

      expect(position.brandId).toBe("202");
      expect(position.brandName).toBe("品牌名称");
      expect(position.projectId).toBe("303");
      expect(position.projectName).toBe("项目名称");
    });

    it("支持新 Duliday 分段结构并正确映射追踪字段", async () => {
      const newFormatData = {
        basicInfo: {
          jobBasicInfoId: 5001,
          jobStoreId: 5001,
          storeId: 5001,
          storeName: "新结构门店",
          storeCityId: 310100,
          storeRegionId: 310101,
          jobName: "新品牌-新结构门店-服务员-兼职",
          jobId: 5001,
          cityName: ["上海市"],
          postTime: "2026.02.25 10:00",
          successDuliriUserId: 5001,
          successNameStr: "测试",
          storeAddress: "上海市-黄浦区-测试路",
          organizationId: 700,
          organizationName: "组织-新",
          brandId: 701,
          brandName: "品牌-新",
          projectId: 702,
          projectName: "项目-新",
        },
        jobSalary: {
          salary: 28,
          salaryUnitStr: "元/小时",
        },
        welfare: {
          id: 5001,
          jobBasicInfoId: 5001,
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
          requirementNum: 4,
          thresholdNum: 10,
          signUpNum: 1,
        },
        workTime: {
          id: 5001,
          jobBasicInfoId: 5001,
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
          workTimeRemark: "新结构测试",
        },
        interviewProcess: {},
      } as unknown as DulidayRaw.Position;

      expect(() => {
        DulidayRaw.PositionSchema.parse(newFormatData);
      }).not.toThrow();

      const mockResponse: DulidayRaw.ListResponse = {
        code: 0,
        message: "操作成功",
        data: {
          result: [newFormatData],
          total: 1,
        },
      };

      const result = await convertDulidayListToZhipinData(mockResponse, 100);
      const position = result.brands![0].stores[0].positions[0];

      expect(position.brandId).toBe("701");
      expect(position.brandName).toBe("品牌-新");
      expect(position.projectId).toBe("702");
      expect(position.projectName).toBe("项目-新");
      expect(position.minHoursPerWeek).toBe(12);
    });

    it("缺少 workTime 时 advanceNoticeHours 不应为 NaN", async () => {
      const dataWithoutWorkTime = {
        basicInfo: {
          jobBasicInfoId: 60001,
          jobStoreId: 60001,
          storeId: 60001,
          storeName: "无排班门店",
          storeCityId: 310100,
          storeRegionId: 310101,
          jobName: "测试品牌-无排班门店-服务员-兼职",
          jobId: 60001,
          cityName: ["上海市"],
          postTime: "2026.02.25 10:00",
          successDuliriUserId: 6001,
          successNameStr: "测试",
          storeAddress: "上海市-浦东新区-测试路",
        },
        jobSalary: { salary: 20, salaryUnitStr: "元/小时" },
        welfare: {
          id: 60001,
          jobBasicInfoId: 60001,
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
        hiringRequirement: {
          cooperationMode: 2,
          requirementNum: 3,
          thresholdNum: 10,
          signUpNum: 0,
        },
        // workTime intentionally missing — triggers {} fallback
        interviewProcess: {},
      } as unknown as DulidayRaw.Position;

      const mockResponse: DulidayRaw.ListResponse = {
        code: 0,
        message: "操作成功",
        data: { result: [dataWithoutWorkTime], total: 1 },
      };

      const result = await convertDulidayListToZhipinData(mockResponse, 100);
      const position = result.brands![0].stores[0].positions[0];

      expect(Number.isNaN(position.schedulingFlexibility?.advanceNoticeHours)).toBe(false);
      expect(position.schedulingFlexibility?.advanceNoticeHours).toBe(0);
    });

    it("当缺少新追踪字段时，应该回退到 organizationId/organizationName", async () => {
      const basePosition: DulidayRaw.Position = {
        jobBasicInfoId: 9002,
        jobStoreId: 9002,
        storeId: 9002,
        storeName: "追踪门店2",
        storeCityId: 310100,
        storeRegionId: 310101,
        jobName: "追踪品牌-追踪门店2-服务员-兼职",
        jobId: 9002,
        organizationId: 404,
        organizationName: "旧组织名称",
        cityName: ["上海市"],
        salary: 25,
        salaryUnitStr: "元/小时",
        workTimeArrangement: {
          id: 9002,
          jobBasicInfoId: 9002,
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
          perWeekWorkDays: 4,
          perWeekRestDays: null,
          evenOddType: null,
          customWorkTimes: null,
          dayWorkTimeRequirement: 1,
          perDayMinWorkHours: 5,
          arrangementType: 2,
          fixedArrangementTimes: null,
          combinedArrangementTimes: null,
          goToWorkStartTime: null,
          goToWorkEndTime: null,
          goOffWorkStartTime: null,
          goOffWorkEndTime: null,
          maxWorkTakingTime: 30,
          restTimeDesc: null,
          workTimeRemark: "追踪测试",
        },
        welfare: {
          id: 9002,
          jobBasicInfoId: 9002,
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

      const mockResponse: DulidayRaw.ListResponse = {
        code: 0,
        message: "操作成功",
        data: {
          result: [basePosition],
          total: 1,
        },
      };

      const result = await convertDulidayListToZhipinData(mockResponse, 100);
      const position = result.brands![0].stores[0].positions[0];

      expect(position.brandId).toBe("404");
      expect(position.brandName).toBe("旧组织名称");
      expect(position.projectId).toBe("404");
      expect(position.projectName).toBe("旧组织名称");
    });
  });

  describe("新 API 格式 welfare/workTime 归一化", () => {
    it("新格式 welfare（string 类型字段）应正确归一化并提取福利信息", async () => {
      const newFormatData = {
        basicInfo: {
          jobId: 8001,
          jobName: "新格式-测试门店-服务员-兼职",
          storeInfo: {
            storeId: 8001,
            storeName: "新格式测试门店",
            storeCityName: "上海市",
            storeRegionName: "浦东新区",
            storeAddress: "上海市-浦东新区-测试路100号",
            longitude: 121.5,
            latitude: 31.2,
          },
          brandId: 100,
          brandName: "测试品牌",
          createTime: "2026.02.27 10:00",
        },
        jobSalary: { salary: 25, salaryUnitStr: "元/小时" },
        welfare: {
          haveInsurance: "独立日购买",
          accommodation: "1",
          catering: "2",
          otherWelfare: ["交通补贴", "餐补"],
          accommodationAllowance: 500,
          accommodationAllowanceUnit: "元/月",
          memo: "福利说明",
          promotionWelfare: null,
        },
        hiringRequirement: {
          cooperationMode: 2,
          requirementNum: 3,
          thresholdNum: 10,
          signUpNum: 1,
        },
        workTime: {
          employmentForm: "1",
          weekWorkTime: {
            perWeekWorkDays: 5,
            weekWorkTimeRequirement: "1",
          },
          dayWorkTime: {
            perDayMinWorkHours: "8",
          },
          dailyShiftSchedule: {
            arrangementType: "3",
            combinedArrangement: [
              { CombinedArrangementStartTime: 32400, CombinedArrangementEndTime: 61200, CombinedArrangementWeekdays: "1", weekdays: [1, 2, 3, 4, 5] },
            ],
          },
          maxWorkTakingTime: 60,
          restTimeDesc: null,
          workTimeRemark: "新格式排班",
        },
        interviewProcess: {},
      } as unknown as DulidayRaw.Position;

      const mockResponse: DulidayRaw.ListResponse = {
        code: 0,
        message: "操作成功",
        data: { result: [newFormatData], total: 1 },
      };

      const result = await convertDulidayListToZhipinData(mockResponse, 100);
      const position = result.brands![0].stores[0].positions[0];

      // welfare 归一化验证
      expect(position.benefits.items).toContain("五险一金");
      expect(position.benefits.items).toContain("住宿");
      expect(position.benefits.items).toContain("餐饮");

      // workTime 归一化验证
      expect(position.minHoursPerWeek).toBe(40); // 8 * 5
      expect(position.workHours).toBe("8");
      expect(position.timeSlots.length).toBe(1);
      expect(position.timeSlots[0]).toBe("09:00~17:00");

      // schedulingFlexibility
      expect(position.schedulingFlexibility.canSwapShifts).toBe(true); // arrangementType=3
      expect(position.schedulingFlexibility.advanceNoticeHours).toBe(1); // 60/60
      expect(position.schedulingFlexibility.partTimeAllowed).toBe(true); // cooperationMode=2

      // attendanceRequirement
      expect(position.attendanceRequirement?.minimumDays).toBe(5);
      expect(position.attendanceRequirement?.description).toBe("新格式排班");
    });

    it("新格式 welfare haveInsurance='无' 时不应添加五险一金", async () => {
      const newFormatData = {
        basicInfo: {
          jobId: 8002,
          jobName: "无保险-测试",
          storeInfo: {
            storeId: 8002,
            storeName: "无保险门店",
            storeCityName: "上海市",
            storeAddress: "上海市-测试",
          },
          createTime: "2026.02.27 10:00",
        },
        jobSalary: { salary: 20, salaryUnitStr: "元/小时" },
        welfare: {
          haveInsurance: "无",
          accommodation: "0",
          catering: "0",
          otherWelfare: null,
        },
        hiringRequirement: { cooperationMode: 2, requirementNum: 1, thresholdNum: 5, signUpNum: 0 },
        workTime: {
          employmentForm: "2",
          weekWorkTime: { perWeekWorkDays: 3 },
          dayWorkTime: { perDayMinWorkHours: "6" },
          dailyShiftSchedule: { arrangementType: "1" },
          maxWorkTakingTime: 30,
        },
        interviewProcess: {},
      } as unknown as DulidayRaw.Position;

      const mockResponse: DulidayRaw.ListResponse = {
        code: 0,
        message: "操作成功",
        data: { result: [newFormatData], total: 1 },
      };

      const result = await convertDulidayListToZhipinData(mockResponse, 100);
      const position = result.brands![0].stores[0].positions[0];

      // 无保险/住宿/餐饮 → 应只有默认项
      expect(position.benefits.items).not.toContain("五险一金");
      expect(position.benefits.items).not.toContain("住宿");
      expect(position.benefits.items).not.toContain("餐饮");

      // workTime 验证
      expect(position.minHoursPerWeek).toBe(18); // 6 * 3
      expect(position.attendanceRequirement?.minimumDays).toBe(3);
    });

    it("新格式 workTime 嵌套 customnWorkTimeList 应正确映射为 customWorkTimes", async () => {
      const newFormatData = {
        basicInfo: {
          jobId: 8003,
          jobName: "自定义工时-测试",
          storeInfo: { storeId: 8003, storeName: "自定义门店", storeCityName: "北京市", storeAddress: "北京-测试" },
          createTime: "2026.02.27 10:00",
        },
        jobSalary: { salary: 30, salaryUnitStr: "元/小时" },
        welfare: { haveInsurance: "独立日购买", accommodation: "0", otherWelfare: null },
        hiringRequirement: { cooperationMode: 2, requirementNum: 2, thresholdNum: 5, signUpNum: 0 },
        workTime: {
          employmentForm: "1",
          weekWorkTime: {
            weekWorkTimeRequirement: "2",
            customnWorkTimeList: [
              { customMinWorkDays: 3, customMaxWorkDays: 5, customWorkWeekdays: [1, 2, 3, 4, 5] },
            ],
          },
          dayWorkTime: { perDayMinWorkHours: "7" },
          dailyShiftSchedule: { arrangementType: "2" },
          maxWorkTakingTime: 0,
        },
        interviewProcess: {},
      } as unknown as DulidayRaw.Position;

      const mockResponse: DulidayRaw.ListResponse = {
        code: 0,
        message: "操作成功",
        data: { result: [newFormatData], total: 1 },
      };

      const result = await convertDulidayListToZhipinData(mockResponse, 100);
      const position = result.brands![0].stores[0].positions[0];

      // customnWorkTimeList 的 customMinWorkDays=3 应作为 minWorkDays 被提取
      // perWeekWorkDays 不存在，所以走 customWorkTimes 路径
      expect(position.minHoursPerWeek).toBe(21); // 7 * 3
      expect(position.attendanceRequirement?.minimumDays).toBe(3);
    });

    it("应从 basicPersonalRequirements 提取 hiringRequirements 并生成真实 requirements", async () => {
      const newFormatData = {
        basicInfo: {
          jobBasicInfoId: 9001,
          jobStoreId: 9001,
          storeId: 9001,
          jobName: "深圳肯德基-服务员-兼职",
          jobId: 9001,
          organizationId: 100,
          organizationName: "肯德基",
          salary: 22,
          salaryUnitStr: "元/小时",
          cooperationMode: 2,
          requirementNum: 5,
          thresholdNum: 10,
          signUpNum: 0,
          postTime: "2026.02.27 10:00",
          storeName: "深圳肯德基店",
          storeAddress: "深圳-福田区-测试地址",
          jobContent: "负责餐厅日常服务工作，包括点餐、上菜、清洁等",
          storeInfo: { storeId: 9001, storeName: "深圳肯德基店", storeCityName: "深圳市", storeAddress: "深圳-福田区-测试地址" },
        },
        jobSalary: { salary: 22, salaryUnitStr: "元/小时" },
        welfare: { haveInsurance: "独立日购买", accommodation: "0" },
        hiringRequirement: {
          cooperationMode: 2,
          requirementNum: 5,
          thresholdNum: 10,
          signUpNum: 0,
          basicPersonalRequirements: { minAge: 18, maxAge: 40, genderRequirement: "0" },
          certificate: { education: "4", healthCertificate: "1" },
        },
        workTime: { employmentForm: "1", dayWorkTime: { perDayMinWorkHours: "8" } },
      } as unknown as DulidayRaw.Position;

      const mockResponse: DulidayRaw.ListResponse = {
        code: 0,
        message: "操作成功",
        data: { result: [newFormatData], total: 1 },
      };

      const result = await convertDulidayListToZhipinData(mockResponse, 100);
      const position = result.brands![0].stores[0].positions[0];

      // hiringRequirements 应从 basicPersonalRequirements + certificate 提取
      expect(position.hiringRequirements).toBeDefined();
      expect(position.hiringRequirements!.minAge).toBe(18);
      expect(position.hiringRequirements!.maxAge).toBe(40);
      expect(position.hiringRequirements!.genderRequirement).toBe("0");
      expect(position.hiringRequirements!.education).toBe("4");
      expect(position.hiringRequirements!.healthCertificate).toBe("1");

      // requirements 应使用真实数据生成
      expect(position.requirements).toContain("年龄18-40岁");
      expect(position.requirements).toContain("高中及以上");
      expect(position.requirements).toContain("需食品健康证");
      // genderRequirement="0" 表示不限，不应出现在 requirements 中
      expect(position.requirements.some((r: string) => r.includes("性别"))).toBe(false);

      // description 应从 jobContent 填充
      expect(position.description).toBe("负责餐厅日常服务工作，包括点餐、上菜、清洁等");
    });

    it("应从 salaryScenarioList 生成薪资摘要", async () => {
      const newFormatData = {
        basicInfo: {
          jobBasicInfoId: 9002,
          jobStoreId: 9002,
          storeId: 9002,
          jobName: "上海必胜客-服务员-兼职",
          jobId: 9002,
          organizationId: 100,
          organizationName: "必胜客",
          salary: 20,
          salaryUnitStr: "元/小时",
          cooperationMode: 2,
          requirementNum: 3,
          thresholdNum: 5,
          signUpNum: 0,
          postTime: "2026.02.27 10:00",
          storeName: "必胜客店",
          storeAddress: "上海-浦东新区-测试",
          storeInfo: { storeId: 9002, storeName: "必胜客店", storeCityName: "上海市", storeAddress: "上海-浦东新区-测试" },
        },
        jobSalary: {
          salary: 20,
          salaryUnitStr: "元/小时",
          salaryScenarioList: [
            {
              salaryType: "0",
              salaryPeriod: "3",
              hasStairSalary: "1",
              basicSalary: { basicSalary: 20, basicSalaryUnit: "元/小时" },
              stairSalaries: [
                { fullWorkTime: 100, fullWorkTimeUnit: "小时", stairSalary: 22, stairSalaryUnit: "元/时" },
              ],
              comprehensiveSalary: { minComprehensiveSalary: 3000, maxComprehensiveSalary: 5000, comprehensiveSalaryUnit: "元/月" },
              holidaySalary: { holidaySalaryType: "1", holidaySalaryMultiple: 2 },
            },
          ],
        },
        welfare: { haveInsurance: "无", accommodation: "0" },
        hiringRequirement: { cooperationMode: 2, requirementNum: 3, thresholdNum: 5, signUpNum: 0 },
        workTime: { employmentForm: "1", dayWorkTime: { perDayMinWorkHours: "8" } },
      } as unknown as DulidayRaw.Position;

      const mockResponse: DulidayRaw.ListResponse = {
        code: 0,
        message: "操作成功",
        data: { result: [newFormatData], total: 1 },
      };

      const result = await convertDulidayListToZhipinData(mockResponse, 100);
      const position = result.brands![0].stores[0].positions[0];

      // salary.scenarioSummary 应包含阶梯薪资、综合薪资和节假日倍数
      expect(position.salary.scenarioSummary).toBeDefined();
      expect(position.salary.scenarioSummary).toContain("满100小时后22元/时");
      expect(position.salary.scenarioSummary).toContain("综合3000-5000元/月");
      expect(position.salary.scenarioSummary).toContain("节假日2倍");

      // settlementCycle 应从 salaryPeriod "3" 映射为 "月结"
      expect(position.salary.settlementCycle).toBe("月结");
    });

    it("应正确处理新 API 中文字符串格式（真实大连肯德基数据）", async () => {
      const realApiData = {
        basicInfo: {
          jobId: 37492,
          storeInfo: {
            storeId: 309348,
            storeName: "新丰荣-DL1011 ",
            storeCityName: "大连市",
            storeRegionName: "普兰店区",
            storeAddress: "辽宁省大连市-普兰店区-中心路二段148号1层肯德基(新丰荣店)",
            longitude: 121.963246,
            latitude: 39.401074,
          },
          brandId: 10005,
          brandName: "肯德基",
          projectId: 1167,
          projectName: "大连肯德基",
          jobName: "大连肯德基-新丰荣-DL1011 -厨房-小时工",
          jobNickName: "厨房",
          jobContent: "1、布置餐厅和餐桌；\n2、引领客人入座就席；\n3、整理餐厅的清洁卫生。",
          laborForm: "小时工",
        },
        jobSalary: {
          salaryScenarioList: [
            {
              salaryType: "正式",
              salaryPeriod: "月结算",
              hasStairSalary: "有阶梯薪资",
              basicSalary: { basicSalary: 12.8, basicSalaryUnit: "元/时" },
              stairSalaries: [
                { fullWorkTime: 100, fullWorkTimeUnit: "小时", salary: 13.5, salaryUnit: "元/时" },
                { fullWorkTime: 180, fullWorkTimeUnit: "小时", salary: 14.0, salaryUnit: "元/时" },
              ],
              comprehensiveSalary: { minComprehensiveSalary: 1500, maxComprehensiveSalary: 3000, comprehensiveSalaryUnit: "元/月" },
              holidaySalary: { holidaySalaryType: "固定薪资", holidayFixedSalary: 28, holidayFixedSalaryUnit: "元/时" },
            },
            {
              salaryType: "培训期",
              salaryPeriod: null,
              basicSalary: { basicSalary: 7.3, basicSalaryUnit: "元/时" },
              stairSalaries: null,
              comprehensiveSalary: { minComprehensiveSalary: 1500, maxComprehensiveSalary: 3000, comprehensiveSalaryUnit: "元/月" },
              holidaySalary: { holidaySalaryType: "无薪资" },
            },
          ],
        },
        welfare: {
          haveInsurance: "独立日购买",
          accommodation: "无住宿福利",
          catering: "无餐饮福利",
          memo: "入职先培训 训练一般1-2天",
        },
        hiringRequirement: {
          cooperationMode: 0,
          requirementNum: 5,
          thresholdNum: 10,
          signUpNum: 0,
          basicPersonalRequirements: { minAge: 18, maxAge: 60, genderRequirement: "男性,女性" },
          certificate: { education: "初中", healthCertificate: "食品健康证" },
        },
        workTime: {
          employmentForm: "长期用工",
          minWorkMonths: 6,
          weekWorkTime: { weekWorkTimeRequirement: "无要求", perWeekWorkDays: 6, perWeekRestDays: 1 },
          dayWorkTime: { perDayMinWorkHours: "8.0" },
          dailyShiftSchedule: {
            arrangementType: "固定排班制",
            fixedScheduleList: [{ fixedShiftStartTime: "14:00", fixedShiftEndTime: "23:00" }],
          },
        },
      } as unknown as DulidayRaw.Position;

      const mockResponse: DulidayRaw.ListResponse = {
        code: 0,
        message: "操作成功",
        data: { result: [realApiData], total: 1 },
      };

      const result = await convertDulidayListToZhipinData(mockResponse, 1167);
      const position = result.brands![0].stores[0].positions[0];

      // 时间段应正确解析 "14:00"/"23:00" → "14:00~23:00"
      expect(position.timeSlots).toContain("14:00~23:00");

      // 薪资应从 salaryScenarioList[0].basicSalary 提取
      expect(position.salary.base).toBe(12.8);

      // scenarioSummary 应只包含正式薪资（跳过培训期），含阶梯和节假日固定薪资
      expect(position.salary.scenarioSummary).toBeDefined();
      expect(position.salary.scenarioSummary).toContain("满100小时后13.5元/时");
      expect(position.salary.scenarioSummary).toContain("满180小时后14元/时");
      expect(position.salary.scenarioSummary).toContain("综合1500-3000元/月");
      expect(position.salary.scenarioSummary).toContain("节假日28元/时");

      // settlementCycle 应从 "月结算" 映射为 "月结"
      expect(position.salary.settlementCycle).toBe("月结");

      // requirements 应使用真实中文格式数据
      expect(position.requirements).toContain("年龄18-60岁");
      expect(position.requirements).toContain("初中及以上");
      expect(position.requirements).toContain("需食品健康证");
      // "男性,女性" 表示不限性别，不应出现性别要求
      expect(position.requirements.some((r: string) => r.includes("性别"))).toBe(false);

      // hiringRequirements 应正确提取
      expect(position.hiringRequirements).toBeDefined();
      expect(position.hiringRequirements!.minAge).toBe(18);
      expect(position.hiringRequirements!.maxAge).toBe(60);
      expect(position.hiringRequirements!.education).toBe("初中");
      expect(position.hiringRequirements!.healthCertificate).toBe("食品健康证");

      // description 应从 jobContent 提取
      expect(position.description).toContain("布置餐厅和餐桌");
    });

    it("无 basicPersonalRequirements 时应回退到默认 requirements", async () => {
      const newFormatData = {
        basicInfo: {
          jobBasicInfoId: 9003,
          jobStoreId: 9003,
          storeId: 9003,
          jobName: "北京必胜客-服务员-兼职",
          jobId: 9003,
          organizationId: 100,
          organizationName: "必胜客",
          salary: 25,
          salaryUnitStr: "元/小时",
          cooperationMode: 2,
          requirementNum: 2,
          thresholdNum: 5,
          signUpNum: 0,
          postTime: "2026.02.27 10:00",
          storeName: "必胜客北京店",
          storeAddress: "北京-朝阳区-测试",
          storeInfo: { storeId: 9003, storeName: "必胜客北京店", storeCityName: "北京市", storeAddress: "北京-朝阳区-测试" },
        },
        jobSalary: { salary: 25, salaryUnitStr: "元/小时" },
        welfare: { haveInsurance: "无", accommodation: "0" },
        hiringRequirement: { cooperationMode: 2, requirementNum: 2, thresholdNum: 5, signUpNum: 0 },
        workTime: { employmentForm: "1", dayWorkTime: { perDayMinWorkHours: "8" } },
      } as unknown as DulidayRaw.Position;

      const mockResponse: DulidayRaw.ListResponse = {
        code: 0,
        message: "操作成功",
        data: { result: [newFormatData], total: 1 },
      };

      const result = await convertDulidayListToZhipinData(mockResponse, 100);
      const position = result.brands![0].stores[0].positions[0];

      // 无 basicPersonalRequirements → hiringRequirements 应为 undefined
      expect(position.hiringRequirements).toBeUndefined();

      // requirements 应回退到旧默认逻辑（服务员关键词匹配）
      expect(position.requirements).toContain("有服务行业经验优先");
      expect(position.requirements).toContain("工作认真负责");

      // 无 salaryScenarioList → scenarioSummary 应为 undefined
      expect(position.salary.scenarioSummary).toBeUndefined();
      expect(position.salary.settlementCycle).toBeUndefined();

      // 无 jobContent → description 应为 undefined
      expect(position.description).toBeUndefined();
    });
  });

  describe("ZhipinDataSchema 验证诊断", () => {
    it("convertedData 应通过 ZhipinDataSchema.partial() 验证（新 API 格式）", async () => {
      // 使用真实新 API 格式数据（projectId = 旧 organizationId，新接口 projectId 等价于旧 organizationId）
      const realNewFormatData = {
        basicInfo: {
          jobId: 37492,
          storeInfo: {
            storeId: 309348,
            storeName: "新丰荣-DL1011",
            storeCityId: 210200,
            storeRegionId: 210214,
            storeCityName: "大连市",
            storeRegionName: "普兰店区",
            storeAddress: "辽宁省大连市-普兰店区-中心路二段148号1层肯德基(新丰荣店)",
            longitude: 121.963246,
            latitude: 39.401074,
          },
          brandId: 10005,
          brandName: "肯德基",
          projectId: 1167,
          projectName: "大连肯德基",
          jobName: "大连肯德基-新丰荣-DL1011-厨房-小时工",
          jobContent: "1、布置餐厅和餐桌；\n2、引领客人入座就席；\n3、整理餐厅的清洁卫生。",
          createTime: "2026.02.25 10:00",
        },
        jobSalary: {
          salaryScenarioList: [
            {
              salaryType: "正式",
              salaryPeriod: "月结算",
              hasStairSalary: "有阶梯薪资",
              basicSalary: { basicSalary: 12.8, basicSalaryUnit: "元/时" },
              stairSalaries: [
                { fullWorkTime: 100, fullWorkTimeUnit: "小时", salary: 13.5, salaryUnit: "元/时" },
                { fullWorkTime: 180, fullWorkTimeUnit: "小时", salary: 14.0, salaryUnit: "元/时" },
              ],
              comprehensiveSalary: {
                minComprehensiveSalary: 1500,
                maxComprehensiveSalary: 3000,
                comprehensiveSalaryUnit: "元/月",
              },
              holidaySalary: {
                holidaySalaryType: "固定薪资",
                holidayFixedSalary: 28,
                holidayFixedSalaryUnit: "元/时",
              },
            },
            {
              salaryType: "培训期",
              salaryPeriod: null,
              basicSalary: { basicSalary: 7.3, basicSalaryUnit: "元/时" },
              stairSalaries: null,
              comprehensiveSalary: {
                minComprehensiveSalary: 1500,
                maxComprehensiveSalary: 3000,
                comprehensiveSalaryUnit: "元/月",
              },
              holidaySalary: { holidaySalaryType: "无薪资" },
            },
          ],
        },
        welfare: {
          haveInsurance: "独立日购买",
          accommodation: "无住宿福利",
          catering: "无餐饮福利",
          memo: "入职先培训 训练一般1-2天",
        },
        hiringRequirement: {
          cooperationMode: 0,
          requirementNum: 5,
          thresholdNum: 10,
          signUpNum: 0,
          basicPersonalRequirements: {
            minAge: 18,
            maxAge: 60,
            genderRequirement: "男性,女性",
          },
          certificate: { education: "初中", healthCertificate: "食品健康证" },
        },
        workTime: {
          employmentForm: "长期用工",
          minWorkMonths: 6,
          weekWorkTime: {
            weekWorkTimeRequirement: "无要求",
            perWeekWorkDays: 6,
            perWeekRestDays: 1,
          },
          dayWorkTime: { perDayMinWorkHours: "8.0" },
          dailyShiftSchedule: {
            arrangementType: "固定排班制",
            fixedScheduleList: [
              { fixedShiftStartTime: "14:00", fixedShiftEndTime: "23:00" },
            ],
          },
        },
      } as unknown as DulidayRaw.Position;

      const mockResponse: DulidayRaw.ListResponse = {
        code: 0,
        message: "操作成功",
        data: { result: [realNewFormatData], total: 1 },
      };

      // 调用 mapper 转换
      const convertedData = await convertDulidayListToZhipinData(mockResponse, 1167);

      // 关键诊断：用 ZhipinDataSchema.partial().safeParse() 验证 —— 这是 sync-stream.ts:70 的同一校验
      const parseResult = ZhipinDataSchema.partial().safeParse(convertedData);

      if (!parseResult.success) {
        // 打印完整 Zod 错误路径，帮助定位数据丢失原因
        console.error(
          "=== ZhipinDataSchema.partial() 验证失败 ===\n",
          JSON.stringify(parseResult.error.issues, null, 2)
        );
        // 同时打印 convertedData 的结构概览，方便对比
        const allStores = convertedData.brands ? getAllStores(convertedData as ZhipinData) : [];
        const firstStore = allStores[0];
        console.error(
          "=== convertedData 结构概览 ===\n",
          JSON.stringify(
            {
              brandCount: convertedData.brands?.length,
              storeCount: allStores.length,
              firstStore: firstStore
                ? {
                    id: firstStore.id,
                    name: firstStore.name,
                    positionCount: firstStore.positions?.length,
                    firstPosition: firstStore.positions?.[0]
                      ? {
                          id: firstStore.positions[0].id,
                          name: firstStore.positions[0].name,
                          salary: firstStore.positions[0].salary,
                          scheduleType: firstStore.positions[0].scheduleType,
                          attendancePolicy: firstStore.positions[0].attendancePolicy,
                          workHours: firstStore.positions[0].workHours,
                        }
                      : "无岗位",
                  }
                : "无门店",
              defaultBrandId: convertedData.meta?.defaultBrandId,
            },
            null,
            2
          )
        );
      }

      expect(parseResult.success).toBe(true);
    });

    it("convertedData 应通过 ZhipinDataSchema.partial() 验证（旧 API 格式）", async () => {
      // 旧格式数据（使用 organizationId，对应数据库中存储的品牌 ID）
      const legacyFormatData: DulidayRaw.Position = {
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
          perWeekWorkDays: 5,
          perWeekRestDays: 2,
          evenOddType: null,
          customWorkTimes: [
            {
              jobWorkTimeArrangementId: 34825,
              weekdays: [0, 1, 2, 3, 4, 5, 6],
              minWorkDays: null,
              maxWorkDays: null,
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
          workTimeRemark: "门店排班",
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

      const mockResponse: DulidayRaw.ListResponse = {
        code: 0,
        message: "操作成功",
        data: { result: [legacyFormatData], total: 1 },
      };

      const convertedData = await convertDulidayListToZhipinData(mockResponse, 865);

      const parseResult = ZhipinDataSchema.partial().safeParse(convertedData);

      if (!parseResult.success) {
        console.error(
          "=== ZhipinDataSchema.partial() 验证失败（旧格式）===\n",
          JSON.stringify(parseResult.error.issues, null, 2)
        );
        const allStores = convertedData.brands ? getAllStores(convertedData as ZhipinData) : [];
        const firstStore = allStores[0];
        console.error(
          "=== convertedData 结构概览（旧格式）===\n",
          JSON.stringify(
            {
              brandCount: convertedData.brands?.length,
              storeCount: allStores.length,
              firstStore: firstStore
                ? {
                    id: firstStore.id,
                    name: firstStore.name,
                    positionCount: firstStore.positions?.length,
                    firstPosition: firstStore.positions?.[0]
                      ? {
                          id: firstStore.positions[0].id,
                          name: firstStore.positions[0].name,
                          salary: firstStore.positions[0].salary,
                          scheduleType: firstStore.positions[0].scheduleType,
                          attendancePolicy: firstStore.positions[0].attendancePolicy,
                          workHours: firstStore.positions[0].workHours,
                        }
                      : "无岗位",
                  }
                : "无门店",
              defaultBrandId: convertedData.meta?.defaultBrandId,
            },
            null,
            2
          )
        );
      }

      expect(parseResult.success).toBe(true);
    });

    it("convertedData 应通过 ZhipinDataSchema.partial() 验证（多门店场景）", async () => {
      // 模拟真实同步场景：多个门店、多个岗位（projectId=1167 等价于旧 organizationId）
      const position1 = {
        basicInfo: {
          jobId: 40001,
          storeInfo: {
            storeId: 400001,
            storeName: "肯德基-浦东店",
            storeCityName: "上海市",
            storeRegionName: "浦东新区",
            storeAddress: "上海市-浦东新区-张杨路100号",
            longitude: 121.52,
            latitude: 31.23,
          },
          brandId: 10005,
          brandName: "肯德基",
          projectId: 1167,
          projectName: "上海肯德基",
          jobName: "上海肯德基-浦东店-前台-小时工",
          createTime: "2026.02.27 09:00",
        },
        jobSalary: {
          salary: 22,
          salaryUnitStr: "元/小时",
        },
        welfare: {
          haveInsurance: "独立日购买",
          accommodation: "无住宿福利",
          catering: "无餐饮福利",
        },
        hiringRequirement: {
          cooperationMode: 2,
          requirementNum: 3,
          thresholdNum: 10,
          signUpNum: 1,
          basicPersonalRequirements: { minAge: 18, maxAge: 50, genderRequirement: "男性,女性" },
          certificate: { education: "高中", healthCertificate: "食品健康证" },
        },
        workTime: {
          employmentForm: "长期用工",
          minWorkMonths: 3,
          weekWorkTime: { perWeekWorkDays: 5, perWeekRestDays: 2 },
          dayWorkTime: { perDayMinWorkHours: "6" },
          dailyShiftSchedule: {
            arrangementType: "组合排班制",
            combinedArrangement: [
              { startTime: 28800, endTime: 50400, weekdays: [1, 2, 3, 4, 5] },
              { startTime: 50400, endTime: 72000, weekdays: [1, 2, 3, 4, 5] },
            ],
          },
          maxWorkTakingTime: 60,
        },
      } as unknown as DulidayRaw.Position;

      const position2 = {
        basicInfo: {
          jobId: 40002,
          storeInfo: {
            storeId: 400002,
            storeName: "肯德基-徐汇店",
            storeCityName: "上海市",
            storeRegionName: "徐汇区",
            storeAddress: "上海市-徐汇区-漕溪路200号",
            longitude: 121.44,
            latitude: 31.18,
          },
          brandId: 10005,
          brandName: "肯德基",
          projectId: 1167,
          projectName: "上海肯德基",
          jobName: "上海肯德基-徐汇店-厨房-小时工",
          createTime: "2026.02.27 09:30",
        },
        jobSalary: {
          salary: 23,
          salaryUnitStr: "元/小时",
        },
        welfare: {
          haveInsurance: "无",
          accommodation: "0",
        },
        hiringRequirement: {
          cooperationMode: 2,
          requirementNum: 2,
          thresholdNum: 5,
          signUpNum: 0,
        },
        workTime: {
          employmentForm: "长期用工",
          weekWorkTime: { perWeekWorkDays: 4 },
          dayWorkTime: { perDayMinWorkHours: "8" },
          dailyShiftSchedule: { arrangementType: "固定排班制" },
          maxWorkTakingTime: 30,
        },
      } as unknown as DulidayRaw.Position;

      const mockResponse: DulidayRaw.ListResponse = {
        code: 0,
        message: "操作成功",
        data: { result: [position1, position2], total: 2 },
      };

      const convertedData = await convertDulidayListToZhipinData(mockResponse, 1167);

      // 先验证基本结构
      const allStores = convertedData.brands ? getAllStores(convertedData as ZhipinData) : [];
      expect(allStores).toBeDefined();
      expect(allStores.length).toBe(2);

      // 关键诊断：ZhipinDataSchema.partial().safeParse()
      const parseResult = ZhipinDataSchema.partial().safeParse(convertedData);

      if (!parseResult.success) {
        console.error(
          "=== ZhipinDataSchema.partial() 验证失败（多门店）===\n",
          JSON.stringify(parseResult.error.issues, null, 2)
        );
        // 遍历每个门店/岗位，逐个诊断
        const brandSchema = ZhipinDataSchema.shape.brands.element;
        const storeSchema = brandSchema.shape.stores.element;
        const posSchema = storeSchema.shape.positions.element;
        allStores.forEach((store: Store, si: number) => {
          store.positions.forEach((pos: Position, pi: number) => {
            const posResult = posSchema.safeParse(pos);
            if (!posResult.success) {
              console.error(
                `=== stores[${si}].positions[${pi}] 验证失败 ===\n`,
                `门店: ${store.name}, 岗位: ${pos.name}\n`,
                JSON.stringify(posResult.error.issues, null, 2)
              );
            }
          });
        });
      }

      expect(parseResult.success).toBe(true);
    });
  });
});
