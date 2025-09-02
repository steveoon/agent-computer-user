import {
  DulidayRaw,
  Store,
  Position,
  ZhipinData,
  BrandConfig,
  SalaryDetails,
  Benefits,
  AttendancePolicy,
  SchedulingFlexibility,
  TimeSlotAvailability,
  AttendanceRequirement,
} from "@/types/zhipin";
import { getBrandNameByOrgId, getDistrictByRegionId } from "@/lib/constants/organization-mapping";

/**
 * 将 Duliday API 的列表响应转换为我们的本地数据格式
 */
export function convertDulidayListToZhipinData(
  dulidayResponse: DulidayRaw.ListResponse,
  organizationId: number
): Partial<ZhipinData> {
  const stores = new Map<string, Store>();
  const brandName = getBrandNameByOrgId(organizationId) || "未知品牌";

  // 遍历所有岗位数据，聚合成门店
  dulidayResponse.data.result.forEach(item => {
    const storeId = `store_${item.storeId}`;

    if (!stores.has(storeId)) {
      stores.set(storeId, convertToStore(item, brandName));
    }

    const position = convertToPosition(item);
    const store = stores.get(storeId);
    if (store) {
      store.positions.push(position);
    }
  });

  // 构建品牌配置（使用默认模板）
  const brandConfig: BrandConfig = {
    templates: {
      initial_inquiry: [`你好，${brandName}在上海各区有兼职，排班{hours}小时，时薪{salary}元。`],
      location_inquiry: [
        `离你比较近在{location}的${brandName}门店有空缺，排班{schedule}，时薪{salary}元，有兴趣吗？`,
      ],
      no_location_match: [`你附近暂时没岗位，{alternative_location}的门店考虑吗？{transport_info}`],
      interview_request: [`可以帮你和店长约面试，加我微信吧，需要几个简单的个人信息。`],
      salary_inquiry: [`基本薪资是{salary}元/小时，{level_salary}。`],
      schedule_inquiry: [`排班比较灵活，一般是2-4小时，具体可以和店长商量。`],
      general_chat: [`好的，有什么其他问题可以问我。`],
      age_concern: [`你的年龄没问题的。`],
      insurance_inquiry: [`有商业保险。`],
      followup_chat: [`这家门店不合适也没关系，以后还有其他店空缺的，到时候可以再报名。`],
      attendance_inquiry: [`出勤要求是{attendance_description}，{minimum_days}天起，比较灵活的。`],
      flexibility_inquiry: [
        `排班{schedule_type}，{can_swap_shifts}换班，{part_time_allowed}兼职。`,
      ],
      attendance_policy_inquiry: [
        `考勤要求：{punctuality_required}准时到岗，最多可以迟到{late_tolerance_minutes}分钟。`,
      ],
      work_hours_inquiry: [
        `每周工作{min_hours_per_week}-{max_hours_per_week}小时，可以根据你的时间来安排。`,
      ],
      availability_inquiry: [
        `{time_slot}班次还有{available_spots}个位置，{priority}优先级，可以报名。`,
      ],
      part_time_support: [`完全支持兼职，{part_time_allowed}，时间可以和其他工作错开安排。`],
    },
    screening: {
      age: { min: 18, max: 50, preferred: [20, 30, 40] },
      blacklistKeywords: ["骗子", "不靠谱", "假的"],
      preferredKeywords: ["经验", "稳定", "长期"],
    },
  };

  return {
    city: dulidayResponse.data.result[0]?.cityName[0] || "上海市",
    stores: Array.from(stores.values()),
    brands: {
      [brandName]: brandConfig,
    },
    defaultBrand: brandName,
  };
}

/**
 * 转换为门店数据
 */
function convertToStore(dulidayData: DulidayRaw.Position, brandName: string): Store {
  return {
    id: `store_${dulidayData.storeId}`,
    name: dulidayData.storeName,
    location: dulidayData.storeAddress,
    district: extractDistrict(dulidayData.storeAddress, dulidayData.storeRegionId),
    subarea: extractSubarea(dulidayData.storeName),
    coordinates: { lat: 0, lng: 0 }, // 默认值，需要后续地理编码
    transportation: "交通便利", // 默认值
    brand: brandName,
    positions: [], // 将在后续添加
  };
}

/**
 * 转换为岗位数据
 */
function convertToPosition(dulidayData: DulidayRaw.Position): Position {
  const workTimeArrangement = dulidayData.workTimeArrangement;

  // 获取时间段数据（添加备用逻辑，与 availableSlots 保持一致）
  let timeSlots: string[] = [];
  if (workTimeArrangement.combinedArrangementTimes?.length) {
    timeSlots = convertTimeSlots(workTimeArrangement.combinedArrangementTimes);
  } else if (workTimeArrangement.fixedArrangementTimes?.length) {
    timeSlots = convertFixedTimeSlots(workTimeArrangement.fixedArrangementTimes);
  }

  return {
    id: `pos_${dulidayData.jobId}`,
    name: extractPositionType(dulidayData.jobName),
    timeSlots,
    salary: parseSalaryDetails(dulidayData.salary, dulidayData.welfare),
    workHours: String(workTimeArrangement.perDayMinWorkHours ?? 8),
    benefits: parseBenefits(dulidayData.welfare),
    requirements: generateDefaultRequirements(dulidayData.jobName),
    urgent: dulidayData.requirementNum > 3,
    scheduleType: dulidayData.cooperationMode === 2 ? "flexible" : "fixed",
    attendancePolicy: generateAttendancePolicy(dulidayData.cooperationMode),
    availableSlots: generateAvailableSlots(dulidayData),
    schedulingFlexibility: generateSchedulingFlexibility(dulidayData),
    minHoursPerWeek: calculateMinHoursPerWeek(workTimeArrangement),
    maxHoursPerWeek: calculateMaxHoursPerWeek(workTimeArrangement),
    attendanceRequirement: generateAttendanceRequirement(workTimeArrangement),
  };
}

/**
 * 从地址中提取区域
 */
function extractDistrict(storeAddress: string, storeRegionId: number): string {
  // 优先使用 storeRegionId 直接映射
  const districtFromId = getDistrictByRegionId(storeRegionId);
  if (districtFromId !== "未知区域") {
    return districtFromId;
  }

  // 备用：解析 storeAddress
  const parts = storeAddress.split("-");
  return parts[1] || "未知区域";
}

/**
 * 从门店名称中提取子区域
 */
function extractSubarea(storeName: string): string {
  // 提取关键词，如 "佘山宝地附近" → "佘山宝地"
  const match = storeName.match(/(.+?)(附近|周边|旁边|店)/);
  return match ? match[1] : storeName;
}

/**
 * 从岗位名称中提取岗位类型
 */
function extractPositionType(jobName: string): string {
  const parts = jobName.split("-");
  // 倒数第二个部分通常是岗位类型
  return parts[parts.length - 2] || "服务员";
}

/**
 * 转换时间段
 */
function convertTimeSlots(
  combinedArrangementTimes: DulidayRaw.WorkTimeArrangementSlot[]
): string[] {
  return combinedArrangementTimes.map(slot => {
    const startHour = Math.floor(slot.startTime / 3600);
    const startMin = Math.floor((slot.startTime % 3600) / 60);
    const endHour = Math.floor(slot.endTime / 3600);
    const endMin = Math.floor((slot.endTime % 3600) / 60);
    return `${startHour.toString().padStart(2, "0")}:${startMin.toString().padStart(2, "0")}~${endHour.toString().padStart(2, "0")}:${endMin.toString().padStart(2, "0")}`;
  });
}

/**
 * 转换固定时间段
 */
function convertFixedTimeSlots(fixedArrangementTimes: DulidayRaw.FixedTimeSlot[]): string[] {
  return fixedArrangementTimes.map(slot => {
    const startHour = Math.floor(slot.startTime / 3600);
    const startMin = Math.floor((slot.startTime % 3600) / 60);
    const endHour = Math.floor(slot.endTime / 3600);
    const endMin = Math.floor((slot.endTime % 3600) / 60);
    return `${startHour.toString().padStart(2, "0")}:${startMin.toString().padStart(2, "0")}~${endHour.toString().padStart(2, "0")}:${endMin.toString().padStart(2, "0")}`;
  });
}

/**
 * 解析薪资详情
 */
function parseSalaryDetails(baseSalary: number, welfare: DulidayRaw.Welfare): SalaryDetails {
  const memo = welfare.memo || "";

  // 提取薪资范围，如 "5250元-5750元"
  const rangeMatch = memo.match(/(\d+元?-\d+元?)/);
  const range = rangeMatch ? rangeMatch[1] : undefined;

  // 提取奖金信息，如 "季度奖金1000～1500"
  const bonusMatch = memo.match(/(奖金[\d～\-~元]+)/);
  const bonus = bonusMatch ? bonusMatch[1] : undefined;

  return {
    base: baseSalary,
    range,
    bonus,
    memo: memo,
  };
}

/**
 * 解析福利信息
 */
function parseBenefits(welfare: DulidayRaw.Welfare): Benefits {
  const benefitItems: string[] = [];

  // 基础福利检测
  if (welfare.haveInsurance > 0) {
    benefitItems.push("五险一金");
  }

  // 住宿福利
  if (welfare.accommodation > 0) {
    benefitItems.push("住宿");
  }

  // 餐饮福利
  if (welfare.catering > 0) {
    benefitItems.push("餐饮");
  }

  // 从 moreWelfares 数组中提取福利项目
  if (welfare.moreWelfares && Array.isArray(welfare.moreWelfares)) {
    welfare.moreWelfares.forEach(item => {
      const content = item.content;
      const benefitKeywords = ["保险", "年假", "补贴", "福利", "股票", "学历提升"];
      benefitKeywords.forEach(keyword => {
        if (
          content.includes(keyword) &&
          !benefitItems.some(existingItem => existingItem.includes(keyword))
        ) {
          // 提取关键信息
          const match = content.match(new RegExp(`\\d*[天个月年]*${keyword}[^，。]*`));
          benefitItems.push(match ? match[0] : keyword);
        }
      });
    });
  }

  // 从memo中智能提取其他福利（作为补充）
  if (welfare.memo) {
    const benefitKeywords = ["年假", "补贴", "商保", "股票", "学历提升"];
    benefitKeywords.forEach(keyword => {
      if (welfare.memo?.includes(keyword) && !benefitItems.some(item => item.includes(keyword))) {
        benefitItems.push(keyword);
      }
    });
  }

  // 如果没有找到任何福利，添加默认项
  if (benefitItems.length === 0) {
    benefitItems.push("按国家规定");
  }

  return {
    items: benefitItems,
    promotion: welfare.promotionWelfare || undefined,
  };
}

/**
 * 生成默认岗位要求
 */
function generateDefaultRequirements(jobName: string): string[] {
  const base = ["工作认真负责", "团队合作精神"];

  if (jobName.includes("服务员")) {
    return [...base, "有服务行业经验优先", "沟通能力强"];
  }
  if (jobName.includes("经理")) {
    return [...base, "有管理经验", "责任心强"];
  }

  return [...base, "有相关工作经验者优先"];
}

/**
 * 生成考勤政策
 */
function generateAttendancePolicy(cooperationMode: number): AttendancePolicy {
  const isFullTime = cooperationMode === 3;

  return {
    punctualityRequired: isFullTime,
    lateToleranceMinutes: isFullTime ? 5 : 15,
    attendanceTracking: isFullTime ? "strict" : "flexible",
    makeupShiftsAllowed: !isFullTime,
  };
}

/**
 * 生成可用时段
 */
function generateAvailableSlots(dulidayData: DulidayRaw.Position): TimeSlotAvailability[] {
  const slots: TimeSlotAvailability[] = [];
  let timeSlots: string[] = [];

  // 优先使用 combinedArrangementTimes
  if (dulidayData.workTimeArrangement.combinedArrangementTimes?.length) {
    timeSlots = convertTimeSlots(dulidayData.workTimeArrangement.combinedArrangementTimes);
  }
  // 备用：使用 fixedArrangementTimes
  else if (dulidayData.workTimeArrangement.fixedArrangementTimes?.length) {
    timeSlots = convertFixedTimeSlots(dulidayData.workTimeArrangement.fixedArrangementTimes);
  }

  timeSlots.forEach(slot => {
    slots.push({
      slot,
      maxCapacity: dulidayData.requirementNum,
      currentBooked: dulidayData.signUpNum || 0,
      isAvailable: (dulidayData.signUpNum || 0) < dulidayData.requirementNum,
      priority: dulidayData.requirementNum > 3 ? "high" : "medium",
    });
  });

  return slots;
}

/**
 * 生成排班灵活性
 */
function generateSchedulingFlexibility(dulidayData: DulidayRaw.Position): SchedulingFlexibility {
  const isFlexible = dulidayData.cooperationMode === 2;
  const arrangementType = dulidayData.workTimeArrangement.arrangementType;

  return {
    canSwapShifts: arrangementType === 3 || isFlexible,
    advanceNoticeHours: dulidayData.workTimeArrangement.maxWorkTakingTime / 60,
    partTimeAllowed: isFlexible,
    weekendRequired: hasWeekendInSchedule(dulidayData.workTimeArrangement),
    holidayRequired: false, // 默认值
  };
}

/**
 * 检查是否包含周末班
 */
function hasWeekendInSchedule(workTimeArrangement: DulidayRaw.WorkTimeArrangement): boolean {
  if (!workTimeArrangement.combinedArrangementTimes) return false;

  return workTimeArrangement.combinedArrangementTimes.some(
    slot => slot.weekdays.includes(0) || slot.weekdays.includes(6)
  );
}

/**
 * 计算每周最少工时
 */
function calculateMinHoursPerWeek(workTimeArrangement: DulidayRaw.WorkTimeArrangement): number {
  const dailyHours = workTimeArrangement.perDayMinWorkHours ?? 8;

  // 获取工作天数（添加备用逻辑）
  let workDays = workTimeArrangement.perWeekWorkDays ?? 5;

  // 备用：如果 perWeekWorkDays 为空，从 customWorkTimes 获取 minWorkDays
  if (!workTimeArrangement.perWeekWorkDays && workTimeArrangement.customWorkTimes?.length) {
    // 从所有 customWorkTimes 中取最小的非空 minWorkDays（最宽松的要求）
    const minWorkDaysArray = workTimeArrangement.customWorkTimes
      .map(ct => ct.minWorkDays)
      .filter((days): days is number => days !== null && days !== undefined);

    if (minWorkDaysArray.length > 0) {
      workDays = Math.min(...minWorkDaysArray);
    }
  }

  return dailyHours * workDays;
}

/**
 * 计算每周最多工时
 */
function calculateMaxHoursPerWeek(workTimeArrangement: DulidayRaw.WorkTimeArrangement): number {
  const dailyHours = workTimeArrangement.perDayMinWorkHours ?? 8;
  return dailyHours * 7; // 最多每天都工作
}

/**
 * 生成出勤要求
 */
function generateAttendanceRequirement(
  workTimeArrangement: DulidayRaw.WorkTimeArrangement
): AttendanceRequirement {
  let requiredDays: number[] = [];

  // 优先获取所有 combinedArrangementTimes 的 weekdays（合并多时间段）
  if (workTimeArrangement.combinedArrangementTimes?.length) {
    const allDays = new Set<number>();
    workTimeArrangement.combinedArrangementTimes.forEach(slot => {
      slot.weekdays.forEach(day => allDays.add(day));
    });
    requiredDays = Array.from(allDays).sort();
  }
  // 备用：从 customWorkTimes 获取 weekdays
  else if (workTimeArrangement.customWorkTimes?.length) {
    const allDays = new Set<number>();
    workTimeArrangement.customWorkTimes.forEach(customTime => {
      customTime.weekdays.forEach(day => allDays.add(day));
    });
    requiredDays = Array.from(allDays).sort();
  }

  // 获取最少工作天数（添加备用逻辑）
  let minimumDays = workTimeArrangement.perWeekWorkDays || 5;

  // 备用：如果 perWeekWorkDays 为空，从 customWorkTimes 获取 minWorkDays
  if (!workTimeArrangement.perWeekWorkDays && workTimeArrangement.customWorkTimes?.length) {
    // 从所有 customWorkTimes 中取最小的非空 minWorkDays（最宽松的要求）
    const minWorkDaysArray = workTimeArrangement.customWorkTimes
      .map(ct => ct.minWorkDays)
      .filter((days): days is number => days !== null && days !== undefined);

    if (minWorkDaysArray.length > 0) {
      minimumDays = Math.min(...minWorkDaysArray);
    }
  }

  return {
    minimumDays,
    requiredDays: convertWeekdays(requiredDays),
    description: workTimeArrangement.workTimeRemark || "",
  };
}

/**
 * 转换星期格式
 * Duliday: 0=周日, 1=周一, ..., 6=周六
 * 本地系统: 1=周一, 2=周二, ..., 7=周日
 */
function convertWeekdays(dulidayWeekdays: number[]): number[] {
  return dulidayWeekdays.map(day => (day === 0 ? 7 : day));
}
