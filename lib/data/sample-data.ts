import { SampleData } from "../../types/zhipin";

/**
 * 🏪 Boss直聘门店招聘数据
 *
 * 这里存放所有门店、岗位、品牌等相关数据
 * 修改此文件后，LLM会自动适配新的数据结构
 */
export const sampleData: SampleData = {
  zhipin: {
    city: "上海",
    defaultBrand: "大米先生",
    stores: [
      {
        id: "store_xujiahui_001",
        name: "上海太平洋森活天地店",
        location: "淞沪路199号B1层太平洋森活天地A-2",
        district: "杨浦区",
        subarea: "五角场",
        coordinates: { lat: 31.1956, lng: 121.4349 },
        brand: "成都你六姐",
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
            benefits: {
              items: [],
            },
            requirements: ["18-45岁", "有服务经验优先"],
            urgent: true,
            // 新增：考勤和排班信息
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
            // 新增：出勤要求
            attendanceRequirement: {
              requiredDays: [1, 2, 3, 4, 5], // 周一到周五
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
            benefits: {
              items: [],
            },
            requirements: ["18-45岁", "有服务经验优先"],
            urgent: false,
            // 新增：考勤和排班信息
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
            // 新增：出勤要求
            attendanceRequirement: {
              requiredDays: [6, 7], // 周六、周日
              minimumDays: 6,
              description: "周六、日上岗，一周至少上岗6天",
            },
          },
        ],
      },
      {
        id: "store_jangan_001",
        name: "上海宝龙旭辉店",
        location: "周家嘴路3608号宝龙旭辉广场B1层",
        district: "杨浦区",
        subarea: "五角场",
        coordinates: { lat: 31.242, lng: 121.4467 },
        brand: "成都你六姐",
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
            benefits: {
              items: [],
            },
            requirements: ["18-45岁", "有服务经验优先"],
            urgent: true,
            // 新增：考勤和排班信息
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
            // 新增：出勤要求
            attendanceRequirement: {
              requiredDays: [5, 6, 7], // 周五-周日
              minimumDays: 2,
              description: "周五-周日都上岗，至少2天",
            },
          },
        ],
      },
      {
        id: "store_pudong_001",
        name: "上海七巧国店",
        location: "大桥街道长阳路1750号1楼04号商铺",
        district: "杨浦区",
        subarea: "大桥街道",
        coordinates: { lat: 31.2354, lng: 121.5055 },
        brand: "成都你六姐",
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
            benefits: {
              items: [],
            },
            requirements: ["18-45岁", "有服务经验优先"],
            urgent: false,
            // 新增：考勤和排班信息
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
            // 新增：出勤要求
            attendanceRequirement: {
              minimumDays: 2,
              description: "一周至少上岗2天，时间灵活",
            },
          },
        ],
      },
      {
        id: "store_damixiansheng_001",
        name: "大米先生-上海天盛广场店",
        location: "政立路天盛广场C101单元",
        district: "杨浦区",
        subarea: "天盛广场",
        coordinates: { lat: 31.2965, lng: 121.5089 },
        brand: "大米先生",
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
            benefits: {
              items: ["面议"],
            },
            requirements: ["18-45岁", "服从店长安排"],
            urgent: true,
            // 新增：考勤和排班信息
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
            // 新增：出勤要求
            attendanceRequirement: {
              requiredDays: [1, 2, 3, 4, 5, 6, 7], // 每天都来
              minimumDays: 5,
              description: "每天都来，一周至少上岗5天",
            },
          },
        ],
      },
      {
        id: "store_damixiansheng_002",
        name: "大米先生-上海彩虹湾店",
        location: "虹湾路99弄2号1层137-1、177、178、179室",
        district: "虹口区",
        subarea: "彩虹湾",
        coordinates: { lat: 31.2384, lng: 121.4759 },
        brand: "大米先生",
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
            benefits: {
              items: ["面议"],
            },
            requirements: ["18-45岁", "服从店长安排"],
            urgent: true,
            // 新增：考勤和排班信息
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
            // 新增：出勤要求
            attendanceRequirement: {
              requiredDays: [1, 2, 3, 4, 5], // 周一-周五
              minimumDays: 4,
              description: "周一-周五都上岗，一周至少4天",
            },
          },
        ],
      },
    ],
    brands: {
      成都你六姐: {
        templates: {
          initial_inquiry: [
            "你好，{brand}在上海各区有兼职，排班{hours}小时，时薪{salary}元，{level_salary}。",
            "在{location}的{position}岗位有空缺，班次{schedule}，时薪{salary}元，有兴趣吗？",
          ],
          location_inquiry: [
            "离你比较近在{location}的{brand}门店有空缺，排班{schedule}，时薪{salary}元，有兴趣吗？",
            "离你比较近在{district}的多个门店有空缺，你在{location}附近吗？",
          ],
          no_location_match: [
            "你附近暂时没岗位，{alternative_location}的门店考虑吗？{transport_info}",
            "你附近暂时没有空缺，不过{alternative_area}有合适的，{distance_info}，可以考虑吗？",
          ],
          interview_request: [
            "可以帮你和店长约面试，加我微信吧，需要几个简单的个人信息。",
            "好的，我可以安排你和{store_name}店长面谈，方便加微信沟通具体时间和准备材料吗？",
          ],
          salary_inquiry: [
            "基本薪资是{salary}元/小时，{level_salary}。",
            "时薪{salary}元起，根据每月工时有阶梯，最高能到28元。",
          ],
          schedule_inquiry: [
            "排班比较灵活，一般是2-4小时，具体可以和店长商量。",
            "门店除了{time1}空缺，还有{time2}也空缺呢，时间有要求可以和店长商量。",
          ],
          // 🆕 新增：出勤要求相关回复模板
          attendance_inquiry: [
            "出勤要求是{attendance_description}，{minimum_days}天起，比较灵活的。",
            "这个岗位{attendance_description}，一周最少{minimum_days}天，时间安排可以和店长商量。",
            "出勤安排：{attendance_description}，如果时间有冲突可以提前和店长协调。",
          ],
          // 🆕 新增：排班灵活性相关回复模板
          flexibility_inquiry: [
            "排班{schedule_type}，{can_swap_shifts}换班，{part_time_allowed}兼职，比较人性化的。",
            "时间安排很灵活，{can_swap_shifts}调班，需要提前{advance_notice_hours}小时通知就行。",
            "排班方式是{schedule_type}的，{weekend_required}周末班，具体可以和店长商量。",
          ],
          // 🆕 新增：考勤政策相关回复模板
          attendance_policy_inquiry: [
            "考勤要求：{punctuality_required}准时到岗，最多可以迟到{late_tolerance_minutes}分钟。",
            "考勤比较{attendance_tracking}，{punctuality_required}严格要求准时，{makeup_shifts_allowed}补班。",
            "迟到政策：最多{late_tolerance_minutes}分钟，超过需要提前请假或补班。",
          ],
          // 🆕 新增：工时要求相关回复模板
          work_hours_inquiry: [
            "每周工作{min_hours_per_week}-{max_hours_per_week}小时，可以根据你的时间来安排。",
            "工时安排：最少每周{min_hours_per_week}小时，最多{max_hours_per_week}小时，比较灵活。",
            "时间要求每周{min_hours_per_week}小时起，上限{max_hours_per_week}小时，不会太累。",
          ],
          // 🆕 新增：时间段可用性相关回复模板
          availability_inquiry: [
            "{time_slot}班次还有{available_spots}个位置，{priority}优先级，可以报名。",
            "现在{time_slot}时段还缺{available_spots}个人，属于{priority}需求，比较好排班。",
            "时间段{time_slot}：容纳{max_capacity}人，现在还有{available_spots}个空位。",
          ],
          // 🆕 新增：兼职支持相关回复模板
          part_time_support: [
            "完全支持兼职，{part_time_allowed}，时间可以和其他工作错开安排。",
            "我们很欢迎兼职人员，{flexible_scheduling}，可以根据你的主业时间来排班。",
            "兼职没问题的，{scheduling_flexibility}，学生和上班族都可以来做。",
          ],
          followup_chat: [
            "门店除了{position1}岗位还有{position2}岗位也空缺的，如果{position1}觉得不合适，可以和店长商量。",
            "门店除了{shift1}空缺，还有{shift2}也空缺呢，如果对排班时间有要求，可以和店长商量。",
            "这家门店不合适也没关系，以后还有其他店空缺的，到时候可以再报名。",
            "{brand}你愿意做吗？我同时还负责其他品牌的招募，你有兴趣的话，可以看看。",
          ],
          // 新增缺失的模板
          general_chat: ["好的，有什么其他问题可以问我，方便的话可以加个微信"],
          age_concern: ["你的年龄没问题的，听店长安排。", "年龄要求比较灵活，你的情况可以考虑。"],
          insurance_inquiry: ["有商业保险的。", "六姐门店有商业保险保障。"],
        },
      },
      大米先生: {
        templates: {
          initial_inquiry: [
            "你好，大米先生{location}店在招{position}，{schedule}班次，时薪{salary}元起。",
            "Hi，大米先生{district}店{position}岗位在招人，薪资{salary}-28元/时，有兴趣吗？",
          ],
          location_inquiry: [
            "离你比较近在{location}的{brand}门店有空缺，排班{schedule}，时薪{salary}元，有兴趣吗？",
            "离你比较近在{district}的多个门店有空缺，你在{location}附近吗？",
          ],
          no_location_match: [
            "你附近暂无空缺，但{alternative_location}大米先生在招聘，{transport_info}，可以考虑吗？",
            "目前你周边没有合适岗位，{alternative_area}店有空缺，愿意了解下吗？",
          ],
          interview_request: [
            "可以，我可以安排你和{store_name}店长面试，方便加微信详细沟通吗？",
            "好的，我帮你约店长面谈，需要你的基本信息，可以加下微信吗？",
          ],
          salary_inquiry: ["基本时薪是{salary}元，最高可以到28元，具体看店长安排。"],
          schedule_inquiry: ["排班时间比较灵活，具体可以和店长沟通，一般是3-4小时的班。"],
          // 🆕 新增：大米先生专属出勤要求回复模板
          attendance_inquiry: [
            "大米先生的出勤要求：{attendance_description}，最少{minimum_days}天，听店长安排。",
            "我们{attendance_description}，一周{minimum_days}天起，比较严格但很稳定。",
            "出勤安排：{attendance_description}，店长会根据情况灵活调整。",
          ],
          // 🆕 新增：大米先生专属排班灵活性回复模板
          flexibility_inquiry: [
            "大米先生排班{schedule_type}，{can_swap_shifts}换班，需要{advance_notice_hours}小时提前通知。",
            "排班方式是{schedule_type}，{part_time_allowed}兼职，{weekend_required}周末班。",
            "时间安排{schedule_type}，{can_swap_shifts}调班，听店长统一安排。",
          ],
          // 🆕 新增：大米先生专属考勤政策回复模板
          attendance_policy_inquiry: [
            "大米先生考勤要求{punctuality_required}准时，迟到最多{late_tolerance_minutes}分钟。",
            "考勤管理{attendance_tracking}，{punctuality_required}守时，{makeup_shifts_allowed}补班。",
            "迟到规定：超过{late_tolerance_minutes}分钟需要请假或调班。",
          ],
          // 🆕 新增：大米先生专属工时要求回复模板
          work_hours_inquiry: [
            "大米先生工时要求：每周{min_hours_per_week}-{max_hours_per_week}小时，听店长安排。",
            "每周最少{min_hours_per_week}小时，最多{max_hours_per_week}小时，工时相对稳定。",
            "时间要求每周{min_hours_per_week}小时起步，上限{max_hours_per_week}小时。",
          ],
          // 🆕 新增：大米先生专属时间段可用性回复模板
          availability_inquiry: [
            "大米先生{time_slot}班次还有{available_spots}个名额，{priority}级需求。",
            "目前{time_slot}还缺{available_spots}人，属于{priority}优先级岗位。",
            "{time_slot}时段：总共{max_capacity}人，现在还有{available_spots}个位置。",
          ],
          // 🆕 新增：大米先生专属兼职支持回复模板
          part_time_support: [
            "大米先生{part_time_allowed}兼职，不过需要服从店长整体安排。",
            "我们{part_time_allowed}兼职员工，{scheduling_flexibility}，听店长安排时间。",
            "兼职可以考虑，但要{part_time_allowed}，具体和店长商量。",
          ],
          followup_chat: [
            "大米先生除了{position1}还有其他岗位，如果{position1}不合适，可以和店长商量。",
            "这个时间段不合适的话，还有{alternative_time}班次，排班比较灵活的。",
            "这家店不合适也没关系，以后还有其他店空缺的，到时候可以再报名。",
            "大米先生你考虑吗？我同时还负责其他品牌的招募，你有兴趣的话，可以看看。",
          ],
          // 新增缺失的模板
          general_chat: [
            "好的，有什么其他问题可以问我。",
            "了解，听店长安排就行。",
            "没问题，有需要随时联系我。",
          ],
          age_concern: [
            "你的年龄没问题的，听店长安排。",
            "年龄要求大米先生比较严格，但你的情况可以考虑。",
          ],
          insurance_inquiry: ["有商业保险的。", "大米先生有商业保险保障。"],
        },
      },
    },
  },
};

/**
 * 🎯 便捷访问Boss直聘数据
 */
export const zhipinData = sampleData.zhipin;

/**
 * 📊 数据统计信息
 */
export const dataStats = {
  storeCount: sampleData.zhipin.stores.length,
  brandCount: Object.keys(sampleData.zhipin.brands).length,
  positionCount: sampleData.zhipin.stores.reduce((sum, store) => sum + store.positions.length, 0),
  districts: [...new Set(sampleData.zhipin.stores.map(store => store.district))],
  brands: Object.keys(sampleData.zhipin.brands),
};
