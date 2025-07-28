# Duliday 招聘系统集成工具集

这个目录包含了与 Duliday API 集成的三个核心工具，用于处理职位查询和面试预约功能。

## 工具概览

### 1. duliday-job-list-tool
获取品牌的在招岗位列表，支持多种过滤条件。

**主要功能：**
- 按品牌查询在招岗位
- 支持门店名称筛选
- 支持地理位置筛选
- 支持工作类型筛选（全职/兼职/小时工）
- 支持岗位速记名筛选
- 支持分页查询

### 2. duliday-job-details-tool
获取特定岗位的详细信息，包括面试时间安排。

**主要功能：**
- 获取岗位详细信息
- 查看面试时间安排
- 获取面试地址
- 查看岗位要求

### 3. duliday-interview-booking-tool
为求职者预约面试。

**主要功能：**
- 提交求职者信息
- 预约面试时间
- 支持健康证状态设置
- 自动处理学历映射

## 使用流程

### 典型的面试预约流程：

1. **查询岗位列表** → 获取 jobId 和 jobBasicInfoId
2. **（可选）查询岗位详情** → 获取更多面试安排信息
3. **预约面试** → 使用 jobId 完成预约

## 工具参数详解

### duliday_job_list 参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| brandName | string | 否 | 品牌名称，如不指定则使用默认品牌 |
| storeName | string | 否 | 门店名称关键词 |
| regionName | string | 否 | 地理位置/区域名称 |
| laborForm | enum | 否 | 工作类型：全职、兼职、小时工 |
| jobNickName | string | 否 | 岗位速记名，如：日结、兼职+、洗碗工 |
| pageNum | number | 否 | 页码，从0开始，默认0 |
| pageSize | number | 否 | 每页数量，默认80条 |

### duliday_job_details 参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| jobBasicInfoId | number | 是 | 岗位基础信息ID |

### duliday_interview_booking 参数

| 参数名 | 类型 | 必填 | 说明 | 默认值 |
|--------|------|------|------|--------|
| name | string | 是 | 求职者姓名 | - |
| phone | string | 是 | 联系电话 | - |
| age | string | 是 | 年龄（字符串形式） | - |
| genderId | number | 是 | 性别ID：1=男，2=女 | - |
| jobId | number | 是 | 岗位ID | - |
| interviewTime | string | 是 | 面试时间，格式：YYYY-MM-DD HH:mm:ss | - |
| education | string | 否 | 学历 | 大专 |
| hasHealthCertificate | number | 否 | 健康证状态：1=有，2=无但接受办理，3=无且不接受办理 | 1 |

## 工具使用示例

### 场景 1：用户查询特定品牌的所有岗位
```
用户：帮我看看奥乐齐有哪些在招岗位
LLM：使用 duliday_job_list 工具，参数：{ brandName: "奥乐齐" }
```

### 场景 2：用户查询特定条件的岗位
```
用户：我想找肯德基在浦东新区的兼职岗位
LLM：使用 duliday_job_list 工具，参数：{ 
  brandName: "肯德基",
  regionName: "浦东新区",
  laborForm: "兼职"
}
```

### 场景 3：查询更多岗位
```
用户：还有其他门店吗？
LLM：使用 duliday_job_list 工具，参数：{ 
  brandName: "肯德基",
  regionName: "浦东新区",
  laborForm: "兼职",
  pageSize: 200  // 增加每页数量以获取更多结果
}
```

### 场景 4：用户预约面试（完整信息）
```
用户：姓名：李青，电话：13585516989，性别：男，年龄：39，
     想应聘奥乐齐世茂店的岗位，面试时间：2025年7月22日下午13点，
     有健康证

LLM步骤：
1. 使用 duliday_job_list 工具查找奥乐齐世茂店的岗位
   参数：{ brandName: "奥乐齐", storeName: "世茂" }
   
2. 从返回结果中获取 jobId（如：520422）

3. 使用 duliday_interview_booking 工具预约面试
   参数：{
     name: "李青",
     phone: "13585516989",
     genderId: 1,
     age: "39",
     education: "大专",
     jobId: 520422,
     interviewTime: "2025-07-22 13:00:00",
     hasHealthCertificate: 1
   }
```

### 场景 5：信息不完整的处理
```
用户：帮我预约肯德基的面试，我叫张三，电话13800138000

LLM：发现缺少必要信息，回复用户：
"我需要以下信息才能为您预约面试：
- 性别
- 年龄
- 想应聘的具体门店或地区
- 期望的面试时间
- 是否有健康证

请提供这些信息。"
```

## 配置要求

### 环境变量
- `DULIDAY_TOKEN`: Duliday API 访问令牌（必需）

### 客户端传递的 Token
工具支持通过参数传递自定义 token，优先级高于环境变量。这使得可以在运行时动态切换不同的 token。

## 支持的品牌

当前系统支持以下品牌的岗位查询和面试预约：
- 肯德基 (ID: 5)
- 成都你六姐 (ID: 941)
- 大米先生 (ID: 985)
- 天津肯德基 (ID: 1072)
- 上海必胜客 (ID: 850)
- 奥乐齐 (ID: 865)

如需添加新品牌，请在 `lib/constants/organization-mapping.ts` 中更新 `ORGANIZATION_MAPPING`。

## 支持的学历类型

系统支持以下学历类型及其别名：
- 初中以下（小学）
- 初中
- 高中
- 中专/技校/职高
- 高职
- 大专（专科）
- 本科（学士）
- 硕士（研究生）

学历会自动进行智能匹配，支持常见别名。

## 支持的地区（上海）

系统包含完整的上海市区域映射：
- 黄浦区、徐汇区、长宁区、静安区
- 普陀区、虹口区、杨浦区
- 闵行区、宝山区、嘉定区
- 浦东新区、金山区、松江区
- 青浦区、奉贤区、崇明区

## 错误处理

### 常见错误及解决方案：

1. **缺少 Token**
   - 错误：缺少DULIDAY_TOKEN
   - 解决：在环境变量中配置 DULIDAY_TOKEN

2. **品牌未找到**
   - 错误：未找到品牌"XXX"的组织ID映射
   - 解决：使用支持的品牌名称，或联系管理员添加新品牌映射

3. **重复报名**
   - 错误：您已为用户报名该岗位
   - 解决：告知用户已经报名成功，无需重复操作

4. **信息不完整**
   - 错误：缺少必填信息：姓名、联系电话等
   - 解决：询问用户并收集完整信息后重试

5. **API 错误**
   - 错误：API调用失败，返回错误码
   - 解决：检查网络连接，确认 token 有效性

## 数据结构说明

### JobItem（岗位信息）
```typescript
{
  jobId: number,              // 岗位ID（预约面试用）
  jobBasicInfoId: number,     // 岗位基础信息ID（查询详情用）
  jobName: string,            // 岗位名称
  jobNickName: string,        // 岗位速记名
  organizationName: string,   // 组织/品牌名称
  storeName: string,          // 门店名称
  storeAddress: string,       // 门店地址
  laborFormName: string,      // 工作类型（全职/兼职等）
  salary: number,             // 薪资
  salaryUnitName: string,     // 薪资单位
  // ... 更多字段
}
```

### InterviewTime（面试时间）
```typescript
{
  interviewDate: string,      // 面试日期
  interviewTime: string,      // 面试时间段
  interviewDateTime: string,  // 完整的面试时间
  // ... 更多字段
}
```

## 注意事项

1. **时间格式**：面试时间必须严格按照 `YYYY-MM-DD HH:mm:ss` 格式
2. **性别 ID**：必须使用数字，1=男，2=女
3. **年龄格式**：必须以字符串形式传递，如 "25" 而不是 25
4. **健康证**：餐饮行业通常需要健康证，默认设置为"有健康证"
5. **分页查询**：如果用户找不到想要的门店，建议增加 pageSize 参数值
6. **Token 优先级**：自定义 token > 环境变量 token
7. **学历处理**：如果用户未提供学历信息，默认使用"大专"

## 最佳实践

1. **查询优化**：先使用较小的 pageSize，如果没找到再增加
2. **信息收集**：在预约前确保收集完整的必要信息
3. **错误处理**：对 API 返回的错误进行友好的解释
4. **数据验证**：在调用 API 前验证数据格式（如电话号码、时间格式）
5. **用户体验**：提供清晰的反馈，告知用户操作结果