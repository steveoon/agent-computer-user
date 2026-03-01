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
  HiringRequirements,
} from "@/types/zhipin";
import { getBrandNameByOrgId } from "@/actions/brand-mapping";
// Note: 地理编码已移至 API route (server-only) 以避免客户端 bundler 错误

/**
 * 将 Duliday API 的列表响应转换为我们的本地数据格式
 */
export async function convertDulidayListToZhipinData(
  dulidayResponse: DulidayRaw.ListResponse,
  organizationId: number
): Promise<Partial<ZhipinData>> {
  const stores = new Map<string, Store>();
  const brandName = (await getBrandNameByOrgId(organizationId)) || "未知品牌";

  // 遍历所有岗位数据，聚合成门店（每条数据只 normalize 一次）
  let firstCity = "上海市";
  dulidayResponse.data.result.forEach((item, index) => {
    const normalized = normalizePosition(item);
    if (index === 0) {
      firstCity = normalized.cityName[0] || "上海市";
    }
    const storeKey = `store_${normalized.storeId}`;

    if (!stores.has(storeKey)) {
      stores.set(storeKey, convertToStore(normalized, brandName));
    }

    const position = convertToPosition(normalized);
    const store = stores.get(storeKey);
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
  };

  // 获取门店列表
  // Note: 地理编码在 API route 中进行，此处只做数据转换
  const storeList = Array.from(stores.values());

  return {
    city: firstCity,
    stores: storeList,
    brands: {
      [brandName]: brandConfig,
    },
    defaultBrand: brandName,
  };
}

type NormalizedDulidayPosition = {
  jobBasicInfoId: number;
  jobStoreId: number;
  storeId: number;
  storeName: string;
  storeCityId: number;
  storeRegionId: number;
  storeRegionName?: string;
  jobName: string;
  jobId: number;
  organizationId?: number;
  organizationName?: string;
  brandId?: number;
  brandName?: string;
  projectId?: number;
  projectName?: string;
  cityName: string[];
  salary: number;
  salaryUnitStr: string;
  workTimeArrangement: DulidayRaw.WorkTimeArrangement;
  welfare: DulidayRaw.Welfare;
  cooperationMode: number;
  requirementNum: number;
  thresholdNum: number;
  signUpNum: number | null;
  postTime: string;
  successDuliriUserId: number;
  successNameStr: string;
  storeAddress: string;
  longitude?: number;
  latitude?: number;
  // 新 API 扩展字段（透传给 convertToPosition）
  basicPersonalRequirements?: {
    minAge?: number | null;
    maxAge?: number | null;
    genderRequirement?: string | null;
  } | null;
  certificate?: {
    education?: string | null;
    healthCertificate?: string | null;
  } | null;
  salaryScenarioList?: Array<{
    salaryType?: string;          // "正式"/"培训期" (新) 或 "0"/"1" (旧)
    salaryPeriod?: string;        // "月结算"/"日结算" (新) 或 "1"/"3" (旧)
    hasStairSalary?: string;
    basicSalary?: { basicSalary?: number; basicSalaryUnit?: string };
    stairSalaries?: Array<{
      fullWorkTime?: number;
      fullWorkTimeUnit?: string;
      salary?: number;            // 新 API 字段名
      salaryUnit?: string;        // 新 API 字段名
      stairSalary?: number;       // 旧 API 字段名（兼容）
      stairSalaryUnit?: string;   // 旧 API 字段名（兼容）
    }>;
    comprehensiveSalary?: {
      minComprehensiveSalary?: number;
      maxComprehensiveSalary?: number;
      comprehensiveSalaryUnit?: string;
    };
    holidaySalary?: {
      holidaySalaryType?: string;   // "固定薪资"/"按倍数计算" (新) 或 "1" (旧)
      holidaySalaryMultiple?: number;
      holidayFixedSalary?: number;
      holidayFixedSalaryUnit?: string;
    };
  }> | null;
  jobContent?: string | null;
};

// ─── 新 API 格式检测 & 归一化适配器 ───

/**
 * 检测 welfare 是否为新 API 格式（string 类型字段，无 id/jobBasicInfoId）
 */
function isNewWelfareFormat(welfare: unknown): welfare is DulidayRaw.NewWelfare {
  if (typeof welfare !== "object" || welfare === null) return false;
  const w = welfare as Record<string, unknown>;
  return typeof w.haveInsurance === "string" && typeof w.id !== "number";
}

/**
 * 检测 workTime 是否为新 API 嵌套格式
 */
function isNewWorkTimeFormat(workTime: unknown): workTime is DulidayRaw.NewWorkTime {
  if (typeof workTime !== "object" || workTime === null) return false;
  const wt = workTime as Record<string, unknown>;
  return (
    typeof wt.employmentForm === "string" ||
    (typeof wt.weekWorkTime === "object" && wt.weekWorkTime !== null) ||
    (typeof wt.dailyShiftSchedule === "object" && wt.dailyShiftSchedule !== null)
  );
}

/**
 * 将新 API welfare 结构归一化为旧扁平 Welfare 类型
 */
function normalizeNewWelfare(nw: DulidayRaw.NewWelfare): DulidayRaw.Welfare {
  const raw = nw as Record<string, unknown>;

  // string → number: "无"/"0"/""→0，其余→1
  const haveInsuranceStr = nw.haveInsurance;
  const haveInsurance =
    !haveInsuranceStr || haveInsuranceStr === "无" || haveInsuranceStr === "0"
      ? 0
      : 1;

  const accommodation = Number(nw.accommodation) || 0;
  const catering = Number(nw.catering ?? 0) || 0;

  // array<string> → string（用逗号连接）
  const otherWelfare = Array.isArray(nw.otherWelfare)
    ? nw.otherWelfare.join("，")
    : null;

  return {
    id: 0,
    jobBasicInfoId: 0,
    haveInsurance,
    accommodation,
    accommodationSalary: (raw.accommodationAllowance as number) ?? null,
    accommodationSalaryUnit: null,
    probationAccommodationSalaryReceive: null,
    catering,
    cateringImage: null,
    cateringSalary: nw.cateringSalary ?? null,
    cateringSalaryUnit: null,
    trafficAllowanceSalary: nw.trafficAllowanceSalary ?? null,
    trafficAllowanceSalaryUnit: null,
    otherWelfare,
    moreWelfares: nw.moreWelfares ?? null,
    insuranceFund: null,
    insuranceFundCityId: null,
    insuranceFundCityStr: null,
    insuranceFundAmount: null,
    memo: nw.memo ?? null,
    promotionWelfare: nw.promotionWelfare ?? null,
    accommodationNum: null,
    commuteDistance: null,
    accommodationEnv: null,
    imagesDTOList: null,
  };
}

/**
 * 解析 "HH:MM" 时间字符串为秒数（兼容旧数字格式）
 * 例如 "14:00" → 50400, "23:00" → 82800
 */
function parseTimeStringToSeconds(timeStr: unknown): number {
  if (typeof timeStr === "number") return timeStr;
  if (typeof timeStr !== "string" || !timeStr) return 0;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return Number(timeStr) || 0;
  return Number(match[1]) * 3600 + Number(match[2]) * 60;
}

/**
 * 将新 API 嵌套 workTime 结构归一化为旧扁平 WorkTimeArrangement 类型
 */
function normalizeNewWorkTime(nwt: DulidayRaw.NewWorkTime): DulidayRaw.WorkTimeArrangement {
  const week = nwt.weekWorkTime;
  const month = nwt.monthWorkTime;
  const day = nwt.dayWorkTime;
  const schedule = nwt.dailyShiftSchedule;
  const temp = nwt.temporaryEmployment;
  const fixedTime = schedule?.fixedTime;

  // 兼容旧数字格式和新中文格式
  const employmentFormMap: Record<string, number> = { "长期用工": 1, "临时用工": 2, "短期用工": 2 };
  const arrangementTypeMap: Record<string, number> = { "固定排班制": 1, "组合排班制": 3 };
  const reqMap: Record<string, number> = { "无要求": 0, "有要求": 1 };

  const employmentForm = Number(nwt.employmentForm) || (employmentFormMap[String(nwt.employmentForm)] ?? 1);
  const arrangementType = Number(schedule?.arrangementType) || (arrangementTypeMap[String(schedule?.arrangementType)] ?? 0);
  const weekWorkTimeRequirement = Number(week?.weekWorkTimeRequirement) || (reqMap[String(week?.weekWorkTimeRequirement)] ?? 0);
  const monthWorkTimeRequirement = Number(month?.monthWorkTimeRequirement) || (reqMap[String(month?.monthWorkTimeRequirement)] ?? 0);
  const dayWorkTimeRequirement = Number(day?.dayWorkTimeRequirement) || (reqMap[String(day?.dayWorkTimeRequirement)] ?? 0);

  const rawPerDay = day?.perDayMinWorkHours != null ? Number(day.perDayMinWorkHours) : null;
  const perDayMinWorkHours = rawPerDay !== null && Number.isFinite(rawPerDay) ? rawPerDay : null;

  // customnWorkTimeList（API typo）→ customWorkTimes
  const customWorkTimes = week?.customnWorkTimeList?.map(item => ({
    jobWorkTimeArrangementId: 0,
    weekdays: Array.isArray(item.customWorkWeekdays)
      ? item.customWorkWeekdays.map(d => Number(d)).filter(d => Number.isFinite(d))
      : [],
    minWorkDays: item.customMinWorkDays ?? null,
    maxWorkDays: item.customMaxWorkDays ?? null,
  })) ?? null;

  // fixedScheduleList → fixedArrangementTimes
  const fixedArrangementTimes = schedule?.fixedScheduleList?.map(item => ({
    jobWorkTimeArrangementId: 0,
    startTime: item.startTime ?? parseTimeStringToSeconds(item.fixedShiftStartTime),
    endTime: item.endTime ?? parseTimeStringToSeconds(item.fixedShiftEndTime),
  })) ?? null;

  // combinedArrangement → combinedArrangementTimes
  const combinedArrangementTimes = schedule?.combinedArrangement?.map(item => {
    // 收集 weekdays 并过滤 null/NaN（API 可能返回 [null] 或 [null, 1, 2]）
    const rawWeekdays = item.weekdays ??
      (typeof item.CombinedArrangementWeekdays === "string"
        ? [Number(item.CombinedArrangementWeekdays)]
        : Array.isArray(item.CombinedArrangementWeekdays)
          ? item.CombinedArrangementWeekdays
          : []);
    const weekdays = rawWeekdays
      .map((d: unknown) => (typeof d === "number" ? d : Number(d)))
      .filter((d: number) => Number.isFinite(d));
    return {
      jobWorkTimeArrangementId: 0,
      startTime: item.startTime ?? item.CombinedArrangementStartTime ?? 0,
      endTime: item.endTime ?? item.CombinedArrangementEndTime ?? 0,
      weekdays,
    };
  }) ?? null;

  const toNum = (v: unknown): number | null =>
    typeof v === "number" ? v : typeof v === "string" ? (Number(v) || null) : null;

  return {
    id: 0,
    jobBasicInfoId: 0,
    employmentForm,
    minWorkMonths: nwt.minWorkMonths ?? null,
    temporaryEmploymentStartTime: temp?.temporaryEmploymentStartTime ?? null,
    temporaryEmploymentEndTime: temp?.temporaryEmploymentEndTime ?? null,
    employmentDescription: nwt.employmentDescription ?? null,
    monthWorkTimeRequirement,
    perMonthMinWorkTime: month?.perMonthMinWorkTime ?? null,
    perMonthMinWorkTimeUnit: null,
    perMonthMaxRestTime: month?.perMonthMaxRestTime ?? null,
    perMonthMaxRestTimeUnit: month?.perMonthMaxRestTimeUnit ?? null,
    weekWorkTimeRequirement,
    perWeekNeedWorkDays: week?.perWeekNeedWorkDays != null ? Number(week.perWeekNeedWorkDays) : null,
    perWeekWorkDays: week?.perWeekWorkDays ?? null,
    perWeekRestDays: week?.perWeekRestDays ?? null,
    evenOddType: null,
    customWorkTimes,
    dayWorkTimeRequirement,
    perDayMinWorkHours,
    arrangementType,
    fixedArrangementTimes,
    combinedArrangementTimes,
    goToWorkStartTime: toNum(fixedTime?.goToWorkStartTime),
    goToWorkEndTime: toNum(fixedTime?.goToWorkEndTime),
    goOffWorkStartTime: toNum(fixedTime?.goOffWorkStartTime),
    goOffWorkEndTime: toNum(fixedTime?.goOffWorkEndTime),
    maxWorkTakingTime: nwt.maxWorkTakingTime ?? 0,
    restTimeDesc: nwt.restTimeDesc ?? null,
    workTimeRemark: nwt.workTimeRemark ?? null,
  };
}

/**
 * 从 raw 值解析并归一化 welfare（兼容新旧格式）
 */
function resolveWelfare(legacy: unknown, newFormatVal: unknown): DulidayRaw.Welfare {
  const raw = legacy ?? newFormatVal;
  if (!raw || typeof raw !== "object") return {} as DulidayRaw.Welfare;
  if (isNewWelfareFormat(raw)) return normalizeNewWelfare(raw);
  return raw as DulidayRaw.Welfare;
}

/**
 * 从 raw 值解析并归一化 workTime（兼容新旧格式）
 */
function resolveWorkTime(legacy: unknown, newFormatVal: unknown): DulidayRaw.WorkTimeArrangement {
  const raw = legacy ?? newFormatVal;
  if (!raw || typeof raw !== "object") return {} as DulidayRaw.WorkTimeArrangement;
  if (isNewWorkTimeFormat(raw)) return normalizeNewWorkTime(raw);
  return raw as DulidayRaw.WorkTimeArrangement;
}

// ─── 岗位数据归一化 ───

function normalizePosition(dulidayData: DulidayRaw.Position | undefined): NormalizedDulidayPosition {
  if (!dulidayData) {
    throw new Error("空岗位数据，无法转换");
  }

  const newFormat = dulidayData as unknown as {
    basicInfo?: Partial<NormalizedDulidayPosition> & {
      jobId?: number;
      createTime?: string;
      jobContent?: string;
      storeInfo?: {
        storeId?: number;
        storeName?: string;
        storeCityId?: number;
        storeRegionId?: number;
        storeCityName?: string;
        storeRegionName?: string;
        storeAddress?: string;
        longitude?: number;
        latitude?: number;
      };
    };
    jobSalary?: {
      salary?: number;
      salaryUnitStr?: string;
      salaryScenarioList?: NormalizedDulidayPosition["salaryScenarioList"];
    };
    welfare?: unknown;
    hiringRequirement?: {
      cooperationMode?: number;
      requirementNum?: number;
      thresholdNum?: number;
      signUpNum?: number | null;
      basicPersonalRequirements?: {
        minAge?: number | null;
        maxAge?: number | null;
        genderRequirement?: string | null;
      };
      certificate?: {
        education?: string | null;
        healthCertificate?: string | null;
      };
    };
    workTime?: unknown;
  };

  const basic = newFormat.basicInfo;
  const salary = newFormat.jobSalary;
  const hiring = newFormat.hiringRequirement;
  const storeInfo = basic?.storeInfo;
  const storeName =
    (dulidayData as { storeName?: string }).storeName ??
    basic?.storeName ??
    storeInfo?.storeName ??
    "未知门店";
  const storeAddress =
    (dulidayData as { storeAddress?: string }).storeAddress ??
    basic?.storeAddress ??
    storeInfo?.storeAddress ??
    "";
  const rawStoreId =
    (dulidayData as { storeId?: number }).storeId ??
    basic?.storeId ??
    storeInfo?.storeId;

  let resolvedStoreId: number;
  if (rawStoreId != null) {
    resolvedStoreId = rawStoreId;
  } else {
    const storeIdFallbackSource = `${storeName}|${storeAddress}`;
    resolvedStoreId = Array.from(storeIdFallbackSource).reduce(
      (acc, char) => ((acc * 31 + char.charCodeAt(0)) >>> 0),
      7
    );
    console.warn(
      `[normalizePosition] storeId 缺失，使用派生值 ${resolvedStoreId}（来源: ${storeIdFallbackSource}）`
    );
  }

  return {
    jobBasicInfoId: (dulidayData as { jobBasicInfoId?: number }).jobBasicInfoId ?? basic?.jobBasicInfoId ?? 0,
    jobStoreId: (dulidayData as { jobStoreId?: number }).jobStoreId ?? basic?.jobStoreId ?? 0,
    storeId: resolvedStoreId,
    storeName,
    storeCityId:
      (dulidayData as { storeCityId?: number }).storeCityId ??
      basic?.storeCityId ??
      storeInfo?.storeCityId ??
      0,
    storeRegionId:
      (dulidayData as { storeRegionId?: number }).storeRegionId ??
      basic?.storeRegionId ??
      storeInfo?.storeRegionId ??
      0,
    storeRegionName:
      (dulidayData as { storeRegionName?: string }).storeRegionName ??
      basic?.storeRegionName ??
      storeInfo?.storeRegionName ??
      undefined,
    jobName: (dulidayData as { jobName?: string }).jobName ?? basic?.jobName ?? "未知岗位",
    jobId: (dulidayData as { jobId?: number }).jobId ?? basic?.jobId ?? 0,
    organizationId: (dulidayData as { organizationId?: number }).organizationId ?? basic?.organizationId,
    organizationName:
      (dulidayData as { organizationName?: string }).organizationName ?? basic?.organizationName,
    brandId: (dulidayData as { brandId?: number }).brandId ?? basic?.brandId,
    brandName: (dulidayData as { brandName?: string }).brandName ?? basic?.brandName,
    projectId: (dulidayData as { projectId?: number }).projectId ?? basic?.projectId,
    projectName: (dulidayData as { projectName?: string }).projectName ?? basic?.projectName,
    cityName:
      (dulidayData as { cityName?: string[] }).cityName ??
      basic?.cityName ??
      (storeInfo?.storeCityName ? [storeInfo.storeCityName] : ["上海市"]),
    salary: (dulidayData as { salary?: number }).salary ?? salary?.salary
      ?? salary?.salaryScenarioList?.find(s => s.salaryType === "正式" || s.salaryType === "0")?.basicSalary?.basicSalary
      ?? salary?.salaryScenarioList?.[0]?.basicSalary?.basicSalary ?? 0,
    salaryUnitStr: (dulidayData as { salaryUnitStr?: string }).salaryUnitStr ?? salary?.salaryUnitStr
      ?? salary?.salaryScenarioList?.find(s => s.salaryType === "正式" || s.salaryType === "0")?.basicSalary?.basicSalaryUnit
      ?? salary?.salaryScenarioList?.[0]?.basicSalary?.basicSalaryUnit ?? "元/小时",
    workTimeArrangement: resolveWorkTime(
      (dulidayData as { workTimeArrangement?: unknown }).workTimeArrangement,
      newFormat.workTime
    ),
    welfare: resolveWelfare(
      (dulidayData as { welfare?: unknown }).welfare,
      newFormat.welfare
    ),
    cooperationMode:
      (dulidayData as { cooperationMode?: number }).cooperationMode ?? hiring?.cooperationMode ?? 0,
    requirementNum:
      (dulidayData as { requirementNum?: number }).requirementNum ?? hiring?.requirementNum ?? 0,
    thresholdNum: (dulidayData as { thresholdNum?: number }).thresholdNum ?? hiring?.thresholdNum ?? 0,
    signUpNum: (dulidayData as { signUpNum?: number | null }).signUpNum ?? hiring?.signUpNum ?? null,
    postTime:
      (dulidayData as { postTime?: string }).postTime ??
      basic?.postTime ??
      basic?.createTime ??
      "",
    successDuliriUserId:
      (dulidayData as { successDuliriUserId?: number }).successDuliriUserId ??
      basic?.successDuliriUserId ??
      0,
    successNameStr:
      (dulidayData as { successNameStr?: string }).successNameStr ?? basic?.successNameStr ?? "",
    storeAddress,
    longitude: storeInfo?.longitude,
    latitude: storeInfo?.latitude,
    // 新 API 扩展字段
    basicPersonalRequirements: hiring?.basicPersonalRequirements ?? null,
    certificate: hiring?.certificate ?? null,
    salaryScenarioList: salary?.salaryScenarioList ?? null,
    jobContent: basic?.jobContent ?? (dulidayData as { jobContent?: string }).jobContent ?? null,
  };
}

/**
 * 转换为门店数据
 */
function convertToStore(normalized: NormalizedDulidayPosition, brandName: string): Store {
  return {
    id: `store_${normalized.storeId}`,
    name: normalized.storeName,
    city: normalized.cityName[0], // 门店所在城市（从 API cityName 获取）
    location: normalized.storeAddress,
    district: extractDistrict(normalized.storeAddress, normalized.storeRegionName),
    subarea: extractSubarea(normalized.storeName),
    coordinates:
      typeof normalized.latitude === "number" && typeof normalized.longitude === "number"
        ? { lat: normalized.latitude, lng: normalized.longitude }
        : { lat: 0, lng: 0 },
    brand: brandName,
    positions: [], // 将在后续添加
  };
}

/**
 * 转换为岗位数据
 */
function convertToPosition(normalized: NormalizedDulidayPosition): Position {
  const workTimeArrangement = normalized.workTimeArrangement;
  const normalizedProjectId = normalized.projectId ?? normalized.organizationId;
  const normalizedProjectName = normalized.projectName ?? normalized.organizationName;
  const normalizedBrandId = normalized.brandId ?? normalizedProjectId;
  const normalizedBrandName = normalized.brandName ?? normalizedProjectName;

  // 获取时间段数据（添加备用逻辑，与 availableSlots 保持一致）
  let timeSlots: string[] = [];
  if (workTimeArrangement.combinedArrangementTimes?.length) {
    timeSlots = convertTimeSlots(workTimeArrangement.combinedArrangementTimes);
  } else if (workTimeArrangement.fixedArrangementTimes?.length) {
    timeSlots = convertFixedTimeSlots(workTimeArrangement.fixedArrangementTimes);
  }

  return {
    id: `pos_${normalized.jobId}`,
    name: extractPositionType(normalized.jobName),
    brandId: normalizedBrandId !== undefined ? String(normalizedBrandId) : undefined,
    brandName: normalizedBrandName,
    projectId: normalizedProjectId !== undefined ? String(normalizedProjectId) : undefined,
    projectName: normalizedProjectName,
    timeSlots,
    salary: {
      ...parseSalaryDetails(normalized.salary, normalized.welfare),
      scenarioSummary: buildScenarioSummary(normalized.salaryScenarioList),
      settlementCycle: extractSettlementCycle(normalized.salaryScenarioList),
    },
    workHours: String(workTimeArrangement.perDayMinWorkHours ?? 8),
    benefits: parseBenefits(normalized.welfare),
    requirements: generateRequirements(normalized),
    urgent: normalized.requirementNum > 3,
    scheduleType: normalized.cooperationMode === 2 ? "flexible" : "fixed",
    attendancePolicy: generateAttendancePolicy(normalized.cooperationMode),
    availableSlots: generateAvailableSlots(normalized),
    schedulingFlexibility: generateSchedulingFlexibility(normalized),
    minHoursPerWeek: calculateMinHoursPerWeek(workTimeArrangement),
    maxHoursPerWeek: calculateMaxHoursPerWeek(workTimeArrangement),
    attendanceRequirement: generateAttendanceRequirement(workTimeArrangement),
    hiringRequirements: extractHiringRequirements(normalized),
    description: normalized.jobContent || undefined,
  };
}

/**
 * 从地址中提取区域
 */
function extractDistrict(storeAddress: string, storeRegionName?: string): string {
  // 优先使用 API 直接提供的区域名称
  if (storeRegionName) {
    return storeRegionName;
  }

  // 降级：解析 storeAddress（如 "上海-浦东新区-张江" → "浦东新区"）
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
 * 从新 API 的结构化数据生成招聘要求（优先使用真实数据，回退到旧默认逻辑）
 */
function generateRequirements(normalized: NormalizedDulidayPosition): string[] {
  const reqs: string[] = [];
  const bpr = normalized.basicPersonalRequirements;
  const cert = normalized.certificate;

  if (bpr?.minAge != null || bpr?.maxAge != null) {
    const min = bpr?.minAge ?? "不限";
    const max = bpr?.maxAge ?? "不限";
    reqs.push(`年龄${min}-${max}岁`);
  }
  // 性别要求（兼容旧数字格式 "0"/"1"/"2" 和新中文格式 "男性"/"女性"/"男性,女性"）
  if (bpr?.genderRequirement && bpr.genderRequirement !== "0") {
    const noRestriction = /男性.*女性|女性.*男性|不限/.test(bpr.genderRequirement);
    if (!noRestriction) {
      const genderMap: Record<string, string> = { "1": "限男性", "2": "限女性", "男性": "限男性", "女性": "限女性" };
      reqs.push(genderMap[bpr.genderRequirement] ?? `性别要求:${bpr.genderRequirement}`);
    }
  }
  // 学历要求（兼容旧数字格式和新中文格式）
  if (cert?.education && cert.education !== "1" && cert.education !== "不限") {
    const eduMap: Record<string, string> = {
      "2": "本科及以上", "3": "专科及以上", "4": "高中及以上", "5": "初中及以上",
      "本科": "本科及以上", "专科": "专科及以上", "高中": "高中及以上", "初中": "初中及以上",
    };
    reqs.push(eduMap[cert.education] ?? `学历${cert.education}`);
  }
  // 健康证要求（兼容旧数字格式和新中文格式）
  if (cert?.healthCertificate) {
    const hcMap: Record<string, string> = {
      "1": "需食品健康证", "2": "需零售健康证",
      "食品健康证": "需食品健康证", "零售健康证": "需零售健康证",
    };
    reqs.push(hcMap[cert.healthCertificate] ?? "需健康证");
  }

  // 真实数据不足时回退到旧默认逻辑
  if (reqs.length === 0) {
    return generateDefaultRequirements(normalized.jobName);
  }
  return reqs;
}

/**
 * 从新 API hiringRequirement 提取结构化招聘要求
 */
function extractHiringRequirements(normalized: NormalizedDulidayPosition): HiringRequirements | undefined {
  const bpr = normalized.basicPersonalRequirements;
  const cert = normalized.certificate;
  if (!bpr && !cert) return undefined;

  return {
    minAge: bpr?.minAge ?? null,
    maxAge: bpr?.maxAge ?? null,
    genderRequirement: bpr?.genderRequirement ?? null,
    education: cert?.education ?? null,
    healthCertificate: cert?.healthCertificate ?? null,
  };
}

/**
 * 从 salaryScenarioList 提炼可读薪资摘要
 */
function buildScenarioSummary(
  scenarios: NormalizedDulidayPosition["salaryScenarioList"]
): string | undefined {
  if (!scenarios || scenarios.length === 0) return undefined;

  const parts: string[] = [];
  for (const s of scenarios) {
    // 跳过培训期薪资，只摘要正式薪资
    if (s.salaryType === "培训期" || s.salaryType === "1") continue;

    // 阶梯薪资（兼容新旧字段名：salary/salaryUnit vs stairSalary/stairSalaryUnit）
    if (s.stairSalaries?.length) {
      const stairs = s.stairSalaries
        .filter(st => (st.salary ?? st.stairSalary) != null)
        .map(st => {
          const pay = st.salary ?? st.stairSalary;
          const unit = st.salaryUnit ?? st.stairSalaryUnit ?? "元/时";
          return `满${st.fullWorkTime ?? "?"}${st.fullWorkTimeUnit ?? "小时"}后${pay}${unit}`;
        })
        .join("，");
      if (stairs) parts.push(stairs);
    }

    // 综合薪资范围
    const comp = s.comprehensiveSalary;
    if (comp?.minComprehensiveSalary != null && comp?.maxComprehensiveSalary != null) {
      parts.push(`综合${comp.minComprehensiveSalary}-${comp.maxComprehensiveSalary}${comp.comprehensiveSalaryUnit ?? "元/月"}`);
    }

    // 节假日薪资（兼容新旧格式）
    const holiday = s.holidaySalary;
    if (holiday) {
      if (holiday.holidaySalaryMultiple) {
        parts.push(`节假日${holiday.holidaySalaryMultiple}倍`);
      } else if (holiday.holidayFixedSalary != null) {
        parts.push(`节假日${holiday.holidayFixedSalary}${holiday.holidayFixedSalaryUnit ?? "元/时"}`);
      }
    }
  }

  return parts.length > 0 ? parts.join("；") : undefined;
}

/**
 * 从 salaryScenarioList 提取结算周期
 */
function extractSettlementCycle(
  scenarios: NormalizedDulidayPosition["salaryScenarioList"]
): string | undefined {
  if (!scenarios || scenarios.length === 0) return undefined;

  // 旧格式用数字编码，新格式用中文字符串
  const cycleMap: Record<string, string> = {
    "1": "日结", "2": "周结", "3": "月结", "4": "完结", "5": "半月结",
    "日结算": "日结", "周结算": "周结", "月结算": "月结", "完结算": "完结", "半月结算": "半月结",
  };
  // 取第一个正式薪资场景的结算周期
  const primary = scenarios.find(s => s.salaryType === "正式" || s.salaryType === "0") ?? scenarios[0];
  return cycleMap[primary?.salaryPeriod ?? ""] ?? undefined;
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
function generateAvailableSlots(dulidayData: NormalizedDulidayPosition): TimeSlotAvailability[] {
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
function generateSchedulingFlexibility(dulidayData: NormalizedDulidayPosition): SchedulingFlexibility {
  const isFlexible = dulidayData.cooperationMode === 2;
  const arrangementType = dulidayData.workTimeArrangement.arrangementType ?? 0;

  return {
    canSwapShifts: arrangementType === 3 || isFlexible,
    advanceNoticeHours: (dulidayData.workTimeArrangement.maxWorkTakingTime ?? 0) / 60,
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

  // 获取工作天数（三层备用逻辑）
  let workDays: number | null = null;

  // 优先级1：使用 perWeekWorkDays
  if (
    workTimeArrangement.perWeekWorkDays !== null &&
    workTimeArrangement.perWeekWorkDays !== undefined
  ) {
    workDays = workTimeArrangement.perWeekWorkDays;
  }

  // 优先级2：从 customWorkTimes 获取 minWorkDays
  if (workDays === null && workTimeArrangement.customWorkTimes?.length) {
    const minWorkDaysArray = workTimeArrangement.customWorkTimes
      .map(ct => ct.minWorkDays)
      .filter((days): days is number => days !== null && days !== undefined);

    if (minWorkDaysArray.length > 0) {
      workDays = Math.min(...minWorkDaysArray);
    }
  }

  // 优先级3：使用 perWeekNeedWorkDays
  if (
    workDays === null &&
    workTimeArrangement.perWeekNeedWorkDays !== null &&
    workTimeArrangement.perWeekNeedWorkDays !== undefined
  ) {
    workDays = workTimeArrangement.perWeekNeedWorkDays;
  }

  // 最终默认值
  if (workDays === null) {
    workDays = 5;
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
  // 注意：API 可能返回含 null 的 weekdays（如 [null]），需过滤
  if (workTimeArrangement.combinedArrangementTimes?.length) {
    const allDays = new Set<number>();
    workTimeArrangement.combinedArrangementTimes.forEach(slot => {
      slot.weekdays.forEach(day => {
        if (day != null && Number.isFinite(day)) allDays.add(day);
      });
    });
    requiredDays = Array.from(allDays).sort();
  }
  // 备用：从 customWorkTimes 获取 weekdays
  else if (workTimeArrangement.customWorkTimes?.length) {
    const allDays = new Set<number>();
    workTimeArrangement.customWorkTimes.forEach(customTime => {
      customTime.weekdays.forEach(day => {
        if (day != null && Number.isFinite(day)) allDays.add(day);
      });
    });
    requiredDays = Array.from(allDays).sort();
  }

  // 获取最少工作天数（三层备用逻辑）
  let minimumDays: number | null = null;

  // 优先级1：使用 perWeekWorkDays
  if (
    workTimeArrangement.perWeekWorkDays !== null &&
    workTimeArrangement.perWeekWorkDays !== undefined
  ) {
    minimumDays = workTimeArrangement.perWeekWorkDays;
  }

  // 优先级2：从 customWorkTimes 获取 minWorkDays
  if (minimumDays === null && workTimeArrangement.customWorkTimes?.length) {
    const minWorkDaysArray = workTimeArrangement.customWorkTimes
      .map(ct => ct.minWorkDays)
      .filter((days): days is number => days !== null && days !== undefined);

    if (minWorkDaysArray.length > 0) {
      minimumDays = Math.min(...minWorkDaysArray);
    }
  }

  // 优先级3：使用 perWeekNeedWorkDays
  if (
    minimumDays === null &&
    workTimeArrangement.perWeekNeedWorkDays !== null &&
    workTimeArrangement.perWeekNeedWorkDays !== undefined
  ) {
    minimumDays = workTimeArrangement.perWeekNeedWorkDays;
  }

  // 最终默认值
  if (minimumDays === null) {
    minimumDays = 5;
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
  return dulidayWeekdays
    .filter(day => Number.isFinite(day))
    .map(day => (day === 0 ? 7 : day));
}
