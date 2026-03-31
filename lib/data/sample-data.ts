import type { ZhipinData } from "@/types";
import { getAllStores } from "@/types";

/**
 * Boss direct recruitment store data
 *
 * Stores all store, position, and brand data.
 * After modifying this file, the LLM will automatically adapt to the new data structure.
 */
export const zhipinData: ZhipinData = {
  meta: {
    defaultBrandId: "sample:damixiansheng",
    source: "sample",
  },
  brands: [
    {
      id: "sample:chengduniliujie",
      name: "成都你六姐",
      stores: [
        {
          id: "store_xujiahui_001",
          brandId: "sample:chengduniliujie",
          name: "上海太平洋森活天地店",
          city: "上海",
          location: "淞沪路199号B1层太平洋森活天地A-2",
          district: "杨浦区",
          subarea: "五角场",
          coordinates: { lat: 31.1956, lng: 121.4349 },
          positions: [
            {
              id: "pos_001",
              name: "前厅岗位",
              timeSlots: ["11:30~14:00"],
              salary: {
                base: 24,
                range: "24-28元/时",
                bonus: "每月做满40小时之后，时薪是26元/时，每月做满80小时后，时薪是28元/时",
                memo: "每月做满40小时之后，时薪是26元/时，每月做满80小时后，时薪是28元/时",
              },
              workHours: "2.5",
              benefits: { items: [] },
              requirements: ["18-45岁", "有服务经验优先"],
              urgent: true,
              scheduleType: "flexible",
              attendancePolicy: {
                punctualityRequired: true,
                lateToleranceMinutes: 10,
                attendanceTracking: "flexible",
                makeupShiftsAllowed: true,
              },
              availableSlots: [
                {
                  slot: "11:30~14:00",
                  maxCapacity: 3,
                  currentBooked: 1,
                  isAvailable: true,
                  priority: "high",
                },
              ],
              schedulingFlexibility: {
                canSwapShifts: true,
                advanceNoticeHours: 24,
                partTimeAllowed: true,
                weekendRequired: false,
                holidayRequired: false,
              },
              minHoursPerWeek: 10,
              maxHoursPerWeek: 20,
              attendanceRequirement: {
                requiredDays: [1, 2, 3, 4, 5],
                minimumDays: 3,
                description: "周一-周五都上岗，一周至少3天",
              },
            },
            {
              id: "pos_002",
              name: "后厨岗位",
              timeSlots: ["11:00~14:00"],
              salary: {
                base: 24,
                range: "24-28元/时",
                bonus: "每月做满40小时之后，时薪是26元/时，每月做满80小时后，时薪是28元/时",
                memo: "每月做满40小时之后，时薪是26元/时，每月做满80小时后，时薪是28元/时",
              },
              workHours: "3",
              benefits: { items: [] },
              requirements: ["18-45岁", "有服务经验优先"],
              urgent: false,
              scheduleType: "fixed",
              attendancePolicy: {
                punctualityRequired: true,
                lateToleranceMinutes: 5,
                attendanceTracking: "strict",
                makeupShiftsAllowed: false,
              },
              availableSlots: [
                {
                  slot: "11:00~14:00",
                  maxCapacity: 2,
                  currentBooked: 0,
                  isAvailable: true,
                  priority: "medium",
                },
              ],
              schedulingFlexibility: {
                canSwapShifts: false,
                advanceNoticeHours: 48,
                partTimeAllowed: true,
                weekendRequired: true,
                holidayRequired: true,
              },
              minHoursPerWeek: 15,
              maxHoursPerWeek: 25,
              attendanceRequirement: {
                requiredDays: [6, 7],
                minimumDays: 6,
                description: "周六、日上岗，一周至少上岗6天",
              },
            },
          ],
        },
        {
          id: "store_jangan_001",
          brandId: "sample:chengduniliujie",
          name: "上海宝龙旭辉店",
          city: "上海",
          location: "周家嘴路3608号宝龙旭辉广场B1层",
          district: "杨浦区",
          subarea: "五角场",
          coordinates: { lat: 31.242, lng: 121.4467 },
          positions: [
            {
              id: "pos_003",
              name: "前厅岗位",
              timeSlots: ["11:30~14:00", "17:30~20:30"],
              salary: {
                base: 24,
                range: "24-28元/时",
                bonus: "每月做满40小时之后，时薪是26元/时，每月做满80小时后，时薪是28元/时",
                memo: "每月做满40小时之后，时薪是26元/时，每月做满80小时后，时薪是28元/时",
              },
              workHours: "3",
              benefits: { items: [] },
              requirements: ["18-45岁", "有服务经验优先"],
              urgent: true,
              scheduleType: "rotating",
              attendancePolicy: {
                punctualityRequired: true,
                lateToleranceMinutes: 15,
                attendanceTracking: "flexible",
                makeupShiftsAllowed: true,
              },
              availableSlots: [
                {
                  slot: "11:30~14:00",
                  maxCapacity: 2,
                  currentBooked: 1,
                  isAvailable: true,
                  priority: "high",
                },
                {
                  slot: "17:30~20:30",
                  maxCapacity: 2,
                  currentBooked: 0,
                  isAvailable: true,
                  priority: "high",
                },
              ],
              schedulingFlexibility: {
                canSwapShifts: true,
                advanceNoticeHours: 12,
                partTimeAllowed: true,
                weekendRequired: true,
                holidayRequired: false,
              },
              minHoursPerWeek: 12,
              maxHoursPerWeek: 30,
              attendanceRequirement: {
                requiredDays: [5, 6, 7],
                minimumDays: 2,
                description: "周五-周日都上岗，至少2天",
              },
            },
          ],
        },
        {
          id: "store_pudong_001",
          brandId: "sample:chengduniliujie",
          name: "上海七巧国店",
          city: "上海",
          location: "大桥街道长阳路1750号1楼04号商铺",
          district: "杨浦区",
          subarea: "大桥街道",
          coordinates: { lat: 31.2354, lng: 121.5055 },
          positions: [
            {
              id: "pos_004",
              name: "前厅岗位",
              timeSlots: ["11:00~14:00"],
              salary: {
                base: 24,
                range: "24-28元/时",
                bonus: "每月做满40小时之后，时薪是26元/时，每月做满80小时后，时薪是28元/时",
                memo: "每月做满40小时之后，时薪是26元/时，每月做满80小时后，时薪是28元/时",
              },
              workHours: "3",
              benefits: { items: [] },
              requirements: ["18-45岁", "有服务经验优先"],
              urgent: false,
              scheduleType: "flexible",
              attendancePolicy: {
                punctualityRequired: false,
                lateToleranceMinutes: 20,
                attendanceTracking: "none",
                makeupShiftsAllowed: true,
              },
              availableSlots: [
                {
                  slot: "11:00~14:00",
                  maxCapacity: 4,
                  currentBooked: 2,
                  isAvailable: true,
                  priority: "low",
                },
              ],
              schedulingFlexibility: {
                canSwapShifts: true,
                advanceNoticeHours: 6,
                partTimeAllowed: true,
                weekendRequired: false,
                holidayRequired: false,
              },
              minHoursPerWeek: 6,
              maxHoursPerWeek: 15,
              attendanceRequirement: {
                minimumDays: 2,
                description: "一周至少上岗2天，时间灵活",
              },
            },
          ],
        },
      ],
    },
    {
      id: "sample:damixiansheng",
      name: "大米先生",
      stores: [
        {
          id: "store_damixiansheng_001",
          brandId: "sample:damixiansheng",
          name: "大米先生-上海天盛广场店",
          city: "上海",
          location: "政立路天盛广场C101单元",
          district: "杨浦区",
          subarea: "天盛广场",
          coordinates: { lat: 31.2965, lng: 121.5089 },
          positions: [
            {
              id: "pos_005",
              name: "通岗",
              timeSlots: ["10:00~14:00"],
              salary: {
                base: 23,
                range: "23-28元/时",
                memo: "基础时薪23-28元，具体工作内容听店长安排",
              },
              workHours: "4",
              benefits: { items: ["面议"] },
              requirements: ["18-45岁", "服从店长安排"],
              urgent: true,
              scheduleType: "on_call",
              attendancePolicy: {
                punctualityRequired: true,
                lateToleranceMinutes: 5,
                attendanceTracking: "strict",
                makeupShiftsAllowed: true,
              },
              availableSlots: [
                {
                  slot: "10:00~14:00",
                  maxCapacity: 1,
                  currentBooked: 0,
                  isAvailable: true,
                  priority: "high",
                },
              ],
              schedulingFlexibility: {
                canSwapShifts: false,
                advanceNoticeHours: 72,
                partTimeAllowed: false,
                weekendRequired: true,
                holidayRequired: true,
              },
              minHoursPerWeek: 20,
              maxHoursPerWeek: 40,
              attendanceRequirement: {
                requiredDays: [1, 2, 3, 4, 5, 6, 7],
                minimumDays: 5,
                description: "每天都来，一周至少上岗5天",
              },
            },
          ],
        },
        {
          id: "store_damixiansheng_002",
          brandId: "sample:damixiansheng",
          name: "大米先生-上海彩虹湾店",
          city: "上海",
          location: "虹湾路99弄2号1层137-1、177、178、179室",
          district: "虹口区",
          subarea: "彩虹湾",
          coordinates: { lat: 31.2384, lng: 121.4759 },
          positions: [
            {
              id: "pos_006",
              name: "通岗",
              timeSlots: ["17:30~20:30"],
              salary: {
                base: 23,
                range: "23-28元/时",
                memo: "基础时薪23-28元，具体工作内容听店长安排",
              },
              workHours: "3",
              benefits: { items: ["面议"] },
              requirements: ["18-45岁", "服从店长安排"],
              urgent: true,
              scheduleType: "fixed",
              attendancePolicy: {
                punctualityRequired: true,
                lateToleranceMinutes: 10,
                attendanceTracking: "flexible",
                makeupShiftsAllowed: true,
              },
              availableSlots: [
                {
                  slot: "17:30~20:30",
                  maxCapacity: 1,
                  currentBooked: 0,
                  isAvailable: true,
                  priority: "high",
                },
              ],
              schedulingFlexibility: {
                canSwapShifts: true,
                advanceNoticeHours: 24,
                partTimeAllowed: true,
                weekendRequired: false,
                holidayRequired: true,
              },
              minHoursPerWeek: 15,
              maxHoursPerWeek: 25,
              attendanceRequirement: {
                requiredDays: [1, 2, 3, 4, 5],
                minimumDays: 4,
                description: "周一-周五都上岗，一周至少4天",
              },
            },
          ],
        },
      ],
    },
  ],
};

/**
 * Data statistics
 */
export const dataStats = {
  storeCount: getAllStores(zhipinData).length,
  brandCount: zhipinData.brands.length,
  positionCount: getAllStores(zhipinData).reduce(
    (sum, store) => sum + store.positions.length,
    0
  ),
  districts: [...new Set(getAllStores(zhipinData).map(store => store.district))],
  brands: zhipinData.brands.map(b => b.name),
};
