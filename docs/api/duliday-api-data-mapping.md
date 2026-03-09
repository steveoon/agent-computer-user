# Duliday API 列表接口与本地数据结构映射关系

本文档记录了 Duliday API **列表接口** (`/job-requirement/hiring/list`) 返回的数据结构与我们本地系统中 `types/zhipin.ts` 数据结构的映射关系。

**设计原则**: 为简化数据转换逻辑，我们只使用列表接口的字段进行数据映射，不依赖详情接口的额外数据。缺失的字段将通过业务规则推断或设置合理默认值。

**架构特点**:

- **部分成功策略**: 支持岗位数据逐个验证，确保部分有效数据能够被处理，提升同步成功率
- **服务端获取，客户端存储**: 同步服务只负责数据获取和转换，不直接保存数据，由客户端配置服务处理持久化
- **错误处理增强**: 集成 `DulidayErrorFormatter` 提供详细的错误上下文和重试机制

## 1. 门店（Store）级别映射

| Duliday API 字段                 | 我们系统字段           | 业务含义     | 映射规则                                                                    |
| -------------------------------- | ---------------------- | ------------ | --------------------------------------------------------------------------- |
| `storeId`                        | `Store.id`             | 门店唯一标识 | 转换为字符串: `store_${storeId}`                                            |
| `storeName`                      | `Store.name`           | 门店名称     | 直接映射                                                                    |
| `storeAddress`                   | `Store.location`       | 门店地址     | 直接映射                                                                    |
| `cityName[0]`                    | `ZhipinData.city`      | 城市名称     | 取数组第一个元素                                                            |
| `organizationId`                 | `Store.brand`          | 品牌名称     | 从 `organizationId` 映射品牌名称                                            |
| `storeRegionId` / `storeAddress` | `Store.district`       | 区域名称     | **优先**使用 `storeRegionId` 直接映射，**备用**方案为从 `storeAddress` 解析 |
| `storeName`                      | `Store.subarea`        | 子区域/商圈  | 从门店名称解析（如："佘山宝地附近" → "佘山宝地"）                           |
| -                                | `Store.coordinates`    | 经纬度坐标   | 设置默认值 `{lat: 0, lng: 0}`                                               |
| -                                | `Store.transportation` | 交通信息     | 设置默认值 "交通便利"                                                       |
| -                                | `Store.positions`      | 岗位列表     | 从当前岗位数据生成 Position 对象数组                                        |

### 1.1 解析规则说明

**品牌名称解析**:

```typescript
// 从 organizationId 映射品牌名称
const brandName = getBrandNameByOrgId(organizationId);
```

**区域名称解析**:

```typescript
// 优先使用 API 提供的 storeRegionName，降级为解析 storeAddress
const district = storeRegionName || storeAddress.split("-")[1] || "未知区域";
```

**子区域解析**:

```typescript
// 从 storeName 中提取子区域关键词
const subarea = extractSubarea(storeName); // "佘山宝地附近" → "佘山宝地"
```

## 2. 岗位（Position）级别映射

### 2.1 基础岗位信息

| Duliday API 字段       | 我们系统字段            | 业务含义     | 映射规则                                                   |
| ---------------------- | ----------------------- | ------------ | ---------------------------------------------------------- |
| `jobId`                | `Position.id`           | 岗位唯一标识 | 转换为字符串: `pos_${jobId}`                               |
| `jobName`              | `Position.name`         | 岗位名称     | 解析岗位类型（如："肯德基-xx-储备经理-全职" → "储备经理"） |
| `salary` + `welfare.*` | `Position.salary`       | 结构化薪资   | 解析为 SalaryDetails 对象（见下表）                        |
| `welfare.*`            | `Position.benefits`     | 结构化福利   | 解析为 Benefits 对象（见下表）                             |
| `cooperationMode`      | `Position.scheduleType` | 排班类型     | 2="flexible"(兼职), 3="fixed"(全职)                        |
| `requirementNum > 3`   | `Position.urgent`       | 是否紧急     | 需求人数大于3时标记为紧急                                  |
| -                      | `Position.requirements` | 岗位要求     | 设置默认要求数组                                           |

### 2.2 结构化薪资对象（SalaryDetails）映射

| Duliday API 字段      | SalaryDetails 字段 | 业务含义 | 映射规则                                   |
| --------------------- | ------------------ | -------- | ------------------------------------------ |
| `salary`              | `base`             | 基础薪资 | 直接映射数值                               |
| `welfare.memo` (解析) | `range`            | 薪资范围 | 从 memo 中提取"5250元-5750元"类似文本      |
| `welfare.memo` (解析) | `bonus`            | 奖金说明 | 从 memo 中提取"季度奖金1000～1500"类似文本 |
| `welfare.memo`        | `memo`             | 原始备注 | 保留完整的薪资备注文本                     |

### 2.3 结构化福利对象（Benefits）映射

| Duliday API 字段                       | Benefits 字段 | 业务含义     | 映射规则                                 |
| -------------------------------------- | ------------- | ------------ | ---------------------------------------- |
| `welfare.promotionWelfare`             | `promotion`   | 晋升福利     | 直接映射（可选）                         |
| `welfare.moreWelfares[]` + `welfare.*` | `items`       | 福利项目数组 | 从结构化数组和其他字段解析出福利项目列表 |

**福利项目解析优先级**:

1. `welfare.moreWelfares[]`: 结构化福利数组（优先使用，来自列表接口）
2. `welfare.haveInsurance/accommodation/catering`: 基础福利标志
3. `welfare.memo`: 文本解析补充（备用）

### 2.4 时间安排（workTimeArrangement）映射

| Duliday API 字段                                                         | 我们系统字段                                  | 业务含义         | 映射规则                                                                                                |
| ------------------------------------------------------------------------ | --------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------- |
| `workTimeArrangement.combinedArrangementTimes` / `fixedArrangementTimes` | `Position.timeSlots`                          | 班次时间         | **优先**使用 `combinedArrangementTimes`，**备用** `fixedArrangementTimes`，转换秒数为时间字符串数组     |
| `workTimeArrangement.perDayMinWorkHours`                                 | `Position.workHours`                          | 每班工时         | 转换为字符串 `String(perDayMinWorkHours)`                                                               |
| `workTimeArrangement.perWeekWorkDays` / `customWorkTimes`                | `Position.attendanceRequirement.minimumDays`  | 每周最少工作天数 | **优先**使用 `perWeekWorkDays`，**备用** `customWorkTimes` 中 `minWorkDays` 的最小值                    |
| `workTimeArrangement.combinedArrangementTimes` / `customWorkTimes`       | `Position.attendanceRequirement.requiredDays` | 工作日要求       | **优先**合并所有 `combinedArrangementTimes` 的 `weekdays`，**备用**合并 `customWorkTimes` 的 `weekdays` |
| `workTimeArrangement.workTimeRemark`                                     | `Position.attendanceRequirement.description`  | 工时备注         | 直接映射                                                                                                |
| `workTimeArrangement.*`                                                  | `Position.minHoursPerWeek`                    | 每周最少工时     | `perDayMinWorkHours` 乘以工作天数（工作天数**优先**取 `perWeekWorkDays`，**备用** `customWorkTimes`）   |
| `workTimeArrangement.perDayMinWorkHours * 7`                             | `Position.maxHoursPerWeek`                    | 每周最多工时     | 估算值（每日工时×7）                                                                                    |

### 2.3 时间格式转换规则

**班次时间转换**:

```typescript
// 将秒数转换为时间字符串
function convertTimeSlots(combinedArrangementTimes: any[]): string[] {
  return combinedArrangementTimes.map(slot => {
    const startHour = Math.floor(slot.startTime / 3600);
    const startMin = Math.floor((slot.startTime % 3600) / 60);
    const endHour = Math.floor(slot.endTime / 3600);
    const endMin = Math.floor((slot.endTime % 3600) / 60);
    return `${startHour.toString().padStart(2, "0")}:${startMin.toString().padStart(2, "0")}~${endHour.toString().padStart(2, "0")}:${endMin.toString().padStart(2, "0")}`;
  });
}
```

**星期映射转换**:

```typescript
// Duliday: 0=周日, 1=周一, ..., 6=周六
// 本地系统: 1=周一, 2=周二, ..., 7=周日
function convertWeekdays(dulidayWeekdays: number[]): number[] {
  return dulidayWeekdays.map(day => (day === 0 ? 7 : day));
}
```

### 2.4 考勤政策映射（基于推断规则）

| 推断来源                              | 我们系统字段                                     | 业务含义     | 推断规则                            |
| ------------------------------------- | ------------------------------------------------ | ------------ | ----------------------------------- |
| `cooperationMode`                     | `Position.attendancePolicy.punctualityRequired`  | 准时要求     | 全职(3)=true, 兼职(2)=false         |
| `cooperationMode`                     | `Position.attendancePolicy.lateToleranceMinutes` | 迟到容忍度   | 全职=5分钟, 兼职=15分钟             |
| `cooperationMode`                     | `Position.attendancePolicy.attendanceTracking`   | 考勤严格度   | 全职="strict", 兼职="flexible"      |
| `workTimeArrangement.arrangementType` | `Position.attendancePolicy.makeupShiftsAllowed`  | 是否允许补班 | 固定排班(1)=false, 组合排班(3)=true |

### 2.5 排班灵活性映射（基于推断规则）

| 推断来源                                | 我们系统字段                                        | 业务含义     | 推断规则                                                               |
| --------------------------------------- | --------------------------------------------------- | ------------ | ---------------------------------------------------------------------- |
| `workTimeArrangement.arrangementType`   | `Position.schedulingFlexibility.canSwapShifts`      | 可否换班     | 组合排班(3)=true, 固定排班(1)=false                                    |
| `workTimeArrangement.maxWorkTakingTime` | `Position.schedulingFlexibility.advanceNoticeHours` | 提前通知时间 | 分钟转小时: `maxWorkTakingTime / 60`                                   |
| `cooperationMode`                       | `Position.schedulingFlexibility.partTimeAllowed`    | 允许兼职     | 兼职(2)=true, 全职(3)=false                                            |
| `combinedArrangementTimes[].weekdays`   | `Position.schedulingFlexibility.weekendRequired`    | 需要周末班   | 仅当存在 `combinedArrangementTimes` 时检查，包含0或6=true，否则为false |
| -                                       | `Position.schedulingFlexibility.holidayRequired`    | 需要节假日班 | 默认值: false                                                          |

### 2.6 时间段可用性映射

| Duliday API 字段                                                         | 我们系统字段                              | 业务含义   | 映射规则                                                                                        |
| ------------------------------------------------------------------------ | ----------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| `workTimeArrangement.combinedArrangementTimes` / `fixedArrangementTimes` | `Position.availableSlots[].slot`          | 时间段     | **优先**使用 `combinedArrangementTimes`，**备用** `fixedArrangementTimes`，转换为时间字符串格式 |
| `requirementNum`                                                         | `Position.availableSlots[].maxCapacity`   | 最大容量   | 直接映射                                                                                        |
| `signUpNum ?? 0`                                                         | `Position.availableSlots[].currentBooked` | 已预定人数 | null时设为0                                                                                     |
| `signUpNum < requirementNum`                                             | `Position.availableSlots[].isAvailable`   | 是否可用   | 计算得出                                                                                        |
| `requirementNum > 3 ? "high" : "medium"`                                 | `Position.availableSlots[].priority`      | 优先级     | 根据需求量判断                                                                                  |

## 3. 默认值和推断字段映射

### 3.1 未在列表接口中提供的字段

以下字段在列表接口中不存在，需要设置合理的默认值：

| 我们系统字段             | 默认值策略                            | 说明                           |
| ------------------------ | ------------------------------------- | ------------------------------ |
| `Position.requirements`  | 根据岗位类型设置通用要求              | 如：["健康证", "工作认真负责"] |
| `Position.preferredDays` | 从 `workTimeArrangement` 的工作日推断 | 可选字段                       |
| `Position.blackoutDates` | 空数组 `[]`                           | 可选字段                       |
| `Store.coordinates`      | `{lat: 0, lng: 0}`                    | 需要后续地理编码               |
| `Store.transportation`   | "交通便利"                            | 通用描述                       |

### 3.3 福利信息处理策略

**福利字段的优先级选择**:

- `welfare.promotionWelfare`: 优先用于 `benefits` 和 `levelSalary`，包含晋升相关福利
- `welfare.memo`: 作为备选，包含薪资构成详情，可用于补充说明
- 如果 `promotionWelfare` 为空，可回退到解析 `memo` 中的福利相关内容

### 3.2 系统不存储的API字段

以下API字段在我们系统中不需要存储：

| Duliday API 字段      | 说明           | 用途                           |
| --------------------- | -------------- | ------------------------------ |
| `postTime`            | 岗位发布时间   | 可用于排序或过期判断           |
| `thresholdNum`        | 门槛数量       | 业务逻辑参考，影响紧急度判断   |
| `successDuliriUserId` | 对接人用户ID   | 内部管理字段                   |
| `successNameStr`      | 对接人姓名     | 内部管理字段                   |
| `jobStoreId`          | 岗位门店关联ID | 数据库关联字段                 |
| `jobBasicInfoId`      | 岗位基本信息ID | 用于调用详情接口（我们不使用） |
| `storeCityId`         | 门店城市ID     | 可用于筛选，但我们用字符串     |
| `storeRegionId`       | 门店区域ID     | 可用于筛选，但我们用字符串     |

## 4. 同步服务架构与错误处理

### 4.1 部分成功同步策略

**新增接口定义**:

```typescript
export interface PartialSuccessResponse {
  validPositions: DulidayRaw.Position[];
  invalidPositions: Array<{
    position: Partial<DulidayRaw.Position>;
    error: string;
  }>;
  totalCount: number;
}
```

**处理逻辑**:

- 逐个验证每个岗位数据，使用 `DulidayRaw.PositionSchema.parse()`
- 有效岗位进入 `validPositions`，失败岗位记录到 `invalidPositions`
- 只要有任何有效数据就视为部分成功，继续处理转换

### 4.2 错误处理与重试机制

**超时控制**:

```typescript
// 30秒超时控制
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);
```

**网络错误重试**:

- 自动重试最多 3 次网络相关错误
- 延迟递增策略：第 n 次重试延迟 n\*1000ms
- 使用 `DulidayErrorFormatter.isNetworkError()` 判断是否需要重试

**错误格式化**:

```typescript
// 带组织上下文的错误格式化
const contextualError = DulidayErrorFormatter.formatWithOrganizationContext(
  organizationId,
  errorMessage,
  brandName
);

// 带岗位上下文的验证错误格式化
const validationError = DulidayErrorFormatter.formatValidationErrorWithContext(zodError, {
  jobName: position.jobName,
  jobId: position.jobId,
});
```

### 4.3 同步结果数据结构

**更新后的 SyncResult 接口**:

```typescript
export interface SyncResult {
  success: boolean;
  totalRecords: number;
  processedRecords: number; // 成功处理的岗位数量
  storeCount: number;
  brandName: string;
  errors: string[]; // 🆕 错误信息数组
  duration: number;
  convertedData?: Partial<ZhipinData>; // 🆕 可选的转换后数据
}
```

**成功判断逻辑**:

```typescript
// 有任何有效数据就算部分成功
const isSuccess = partialResponse.validPositions.length > 0;
```

### 4.4 数据流架构

**服务端职责**:

1. 从 Duliday API 获取原始数据
2. 逐个验证岗位数据结构
3. 转换有效数据为 ZhipinData 格式
4. 返回 SyncResult（包含转换后的数据，但不保存）

**客户端职责**:

1. 调用同步服务获取转换后的数据
2. 通过 `configService` 将数据持久化到 LocalForage
3. 处理同步历史记录的本地存储

```typescript
// 典型的同步流程
const result = await syncService.syncOrganization(orgId);
if (result.success && result.convertedData) {
  // 客户端负责保存数据
  await configService.updateBrandData(brandName, result.convertedData);
}
```

## 5. 数据转换实施指南

### 5.1 关键数据类型转换

#### 5.1.1 ID字段转换

```typescript
// 统一转换为字符串格式
const storeId = `store_${dulidayData.storeId}`;
const positionId = `pos_${dulidayData.jobId}`;
```

#### 5.1.2 时间格式转换

```typescript
// 秒数转时间字符串
function convertSecondsToTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

// 时间段转换
function convertTimeSlot(slot: any): string {
  const start = convertSecondsToTime(slot.startTime);
  const end = convertSecondsToTime(slot.endTime);
  return `${start}~${end}`;
}
```

#### 5.1.3 星期映射转换

```typescript
// Duliday: 0=周日, 1=周一, ..., 6=周六
// 本地系统: 1=周一, 2=周二, ..., 7=周日
function convertWeekday(dulidayDay: number): number {
  return dulidayDay === 0 ? 7 : dulidayDay;
}
```

### 5.2 枚举值映射

#### cooperationMode (合作模式)

- `2`: 小时工/兼职 → `scheduleType: "flexible"`
- `3`: 全职 → `scheduleType: "fixed"`

#### arrangementType (排班类型)

- `1`: 固定排班
- `3`: 组合排班

#### haveInsurance (保险状态)

- `0`: 无保险
- `1`: 有保险
- `2`: 特殊情况

### 5.3 字符串解析规则

#### 品牌名称解析

```typescript
function extractBrandName(jobName: string): string {
  return jobName.split("-")[0] || "未知品牌";
}
```

#### 岗位类型解析

```typescript
function extractPositionType(jobName: string): string {
  const parts = jobName.split("-");
  return parts[parts.length - 2] || "服务员"; // 倒数第二个部分通常是岗位类型
}
```

#### 区域解析

```typescript
function extractDistrict(storeAddress: string): string {
  const parts = storeAddress.split("-");
  return parts[1] || "未知区域"; // 第二部分通常是区域
}
```

### 5.4 数据验证和容错

#### 必填字段检查

```typescript
function validateRequiredFields(data: any): boolean {
  const required = ["jobId", "storeName", "salary", "jobName"];
  return required.every(field => data[field] !== undefined && data[field] !== null);
}
```

#### 默认值设置

```typescript
function setDefaultValues(position: Partial<Position>): Position {
  return {
    requirements: ["工作认真负责", "有相关工作经验者优先"],
    coordinates: { lat: 0, lng: 0 },
    transportation: "交通便利",
    ...position,
  } as Position;
}
```

## 6. 完整转换示例代码

### 6.1 核心转换函数（含部分成功逻辑）

```typescript
import {
  Store,
  Position,
  ZhipinData,
  DulidayRaw,
  SalaryDetails,
  Benefits,
  BrandConfig,
} from "../types/zhipin";

// 主转换函数 - 支持部分成功的响应
function convertDulidayListToZhipinData(
  dulidayResponse: DulidayRaw.ListResponse,
  organizationId: number
): Partial<ZhipinData> {
  const stores = new Map<string, Store>();
  const brandName = getBrandNameByOrgId(organizationId) || "未知品牌"; // 🔧 统一获取品牌名称

  dulidayResponse.data.result.forEach((item: DulidayRaw.Position) => {
    const storeId = `store_${item.storeId}`;

    if (!stores.has(storeId)) {
      stores.set(storeId, convertToStore(item, brandName)); // 🔧 传入统一的品牌名称
    }

    const position = convertToPosition(item);
    stores.get(storeId)!.positions.push(position);
  });

  // 构建品牌配置（使用默认模板）
  const brandConfig: BrandConfig = {
    templates: {
      initial_inquiry: [`你好，${brandName}在上海各区有兼职，排班{hours}小时，时薪{salary}元。`],
      location_inquiry: [
        `离你比较近在{location}的${brandName}门店有空缺，排班{schedule}，时薪{salary}元，有兴趣吗？`,
      ],
      salary_inquiry: [`基本薪资是{salary}元/小时，{level_salary}。`],
      schedule_inquiry: [`排班比较灵活，一般是2-4小时，具体可以和店长商量。`],
      // ... 其他模板
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

// 门店转换
function convertToStore(dulidayData: DulidayRaw.Position, brandName: string): Store {
  return {
    id: `store_${dulidayData.storeId}`,
    name: dulidayData.storeName,
    location: dulidayData.storeAddress,
    district: extractDistrict(dulidayData.storeAddress, dulidayData.storeRegionId),
    subarea: extractSubarea(dulidayData.storeName),
    coordinates: { lat: 0, lng: 0 },
    transportation: "交通便利",
    brand: brandName, // 🔧 使用传入的 brandName 参数
    positions: [], // 将在后续添加
  };
}

// 岗位转换
function convertToPosition(dulidayData: DulidayRaw.Position): Position {
  const workTimeArrangement = dulidayData.workTimeArrangement;

  return {
    id: `pos_${dulidayData.jobId}`,
    name: extractPositionType(dulidayData.jobName),
    // 🔧 timeSlots, availableSlots, attendanceRequirement 等字段的生成已封装到独立函数中
    // 🔧 这些函数内部处理了备用逻辑
    timeSlots: getTimeSlots(workTimeArrangement),
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
    // 🔧 使用独立的生成函数，内部已包含备用数据源逻辑
    attendanceRequirement: generateAttendanceRequirement(workTimeArrangement),
  };
}
```

### 6.2 辅助函数（含错误处理）

```typescript
// 生成默认岗位要求
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

// 计算工时（处理可能为 null 的字段）
function calculateMinHoursPerWeek(workTimeArrangement: DulidayRaw.WorkTimeArrangement): number {
  const dailyHours = workTimeArrangement.perDayMinWorkHours ?? 8;

  // 🔧 获取工作天数（添加备用逻辑）
  let workDays = workTimeArrangement.perWeekWorkDays ?? 5;
  if (!workTimeArrangement.perWeekWorkDays && workTimeArrangement.customWorkTimes?.length) {
    const minWorkDaysArray = workTimeArrangement.customWorkTimes.map(ct => ct.minWorkDays);
    workDays = Math.min(...minWorkDaysArray);
  }

  return dailyHours * workDays;
}

function calculateMaxHoursPerWeek(workTimeArrangement: DulidayRaw.WorkTimeArrangement): number {
  const dailyHours = workTimeArrangement.perDayMinWorkHours ?? 8;
  return dailyHours * 7; // 最多每天都工作
}

// 🔧 结构化薪资解析
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

// 🔧 结构化福利解析
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
          // 提取关键信息，如 "10天带薪年假" -> "带薪年假"
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
      if (welfare.memo!.includes(keyword) && !benefitItems.some(item => item.includes(keyword))) {
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

// 🆕 带错误处理的岗位验证函数
function validateAndConvertPosition(
  positionData: any,
  index: number
): { position?: DulidayRaw.Position; error?: string } {
  try {
    const validatedPosition = DulidayRaw.PositionSchema.parse(positionData);
    return { position: validatedPosition };
  } catch (validationError) {
    let errorMessage = "";

    if (validationError instanceof z.ZodError) {
      errorMessage = DulidayErrorFormatter.formatValidationErrorWithContext(validationError, {
        jobName: positionData?.jobName || `未知岗位_${index}`,
        jobId: positionData?.jobId || `unknown_${index}`,
      });
    } else {
      errorMessage = formatDulidayError(validationError);
    }

    return { error: errorMessage };
  }
}

// 🆕 安全的数据访问函数
function safeGetWorkingHours(workTimeArrangement: DulidayRaw.WorkTimeArrangement): number {
  return workTimeArrangement?.perDayMinWorkHours ?? 8;
}

function safeGetWorkingDays(workTimeArrangement: DulidayRaw.WorkTimeArrangement): number {
  if (workTimeArrangement?.perWeekWorkDays) {
    return workTimeArrangement.perWeekWorkDays;
  }

  // 备用方案：从 customWorkTimes 中获取
  if (workTimeArrangement?.customWorkTimes?.length) {
    const minWorkDaysArray = workTimeArrangement.customWorkTimes
      .map(ct => ct.minWorkDays)
      .filter(days => days > 0);

    if (minWorkDaysArray.length > 0) {
      return Math.min(...minWorkDaysArray);
    }
  }

  return 5; // 默认值
}
```

## 7. 实施建议

### 7.1 部分成功策略的优势

- **容错性强**: 单个岗位数据问题不会影响整体同步，提升系统健壮性
- **详细错误报告**: 每个失败的岗位都有具体的错误信息和上下文
- **数据完整性**: 只处理通过验证的有效数据，确保数据质量
- **用户体验**: 用户能看到具体哪些岗位失败及失败原因

### 7.2 结构化数据模型的优势

- **类型安全**: 使用 Zod schema 确保运行时和编译时的类型安全
- **智能解析**: `parseSalaryDetails` 和 `parseBenefits` 函数将原始文本解析为结构化对象
- **组件友好**: 前端组件可以稳定地访问 `position.salary.range` 而无需字符串处理
- **测试便利**: 强类型的映射函数 `(raw: DulidayRaw.Position) => Position` 更易于单元测试

### 7.3 错误处理策略

- **上下文错误**: 使用 `DulidayErrorFormatter` 提供组织和岗位上下文
- **网络重试**: 自动重试网络相关错误，避免临时网络问题
- **超时控制**: 30秒超时确保不会长时间阻塞
- **分层错误处理**: 区分验证错误、网络错误和业务逻辑错误

### 7.4 架构分离优势

- **职责清晰**: 服务端专注数据获取和转换，客户端专注存储和展示
- **缓存优化**: 客户端可以独立管理缓存策略
- **离线支持**: 数据存储在本地，支持离线访问
- **安全性**: 避免在服务端直接操作客户端存储

### 7.5 数据质量保证

- **字段验证**: 使用 Zod schema 验证转换后的数据
- **容错处理**: 处理API字段缺失或格式异常，提供备用方案
- **日志记录**: 记录转换过程中的警告和错误
- **部分成功**: 确保有效数据能够被处理，不因个别问题影响整体

### 7.6 性能优化

- **批量处理**: 一次处理多个岗位数据
- **逐个验证**: 避免一个问题影响所有数据
- **增量更新**: 支持数据的增量同步
- **并发控制**: 合理的超时和重试机制

## 8. 变更记录

| 版本 | 日期       | 说明                                                                                                                                            |
| ---- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.0 | 2025-06-30 | 初始版本，基于列表接口和详情接口的双重映射                                                                                                      |
| v2.0 | 2025-06-30 | 重构为仅基于列表接口的单一映射，简化实现逻辑                                                                                                    |
| v2.1 | 2025-06-30 | 修复福利字段映射冲突，使用 `promotionWelfare` 而非 `memo`                                                                                       |
| v3.0 | 2025-06-30 | 引入结构化数据模型：SalaryDetails 和 Benefits，添加 DulidayRaw 命名空间                                                                         |
| v3.1 | 2025-06-30 | 修复接口不一致：moreWelfares 数组结构，perDayMinWorkHours 和 perWeekWorkDays 可空                                                               |
| v3.2 | 2025-07-01 | **[核心优化]** 为 `district`, `timeSlots`, `requiredDays`, `minimumDays`, `minHoursPerWeek` 等关键字段添加备用数据源逻辑，提高数据完整性。      |
| v4.0 | 2025-09-01 | **[架构重构]** 实现部分成功同步策略，增强错误处理和重试机制，服务端与客户端职责分离，新增 `PartialSuccessResponse` 和增强的 `SyncResult` 接口。 |
