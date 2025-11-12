# 品牌管理 CRUD 功能需求文档

## 文档信息

- **创建日期**: 2025-01-10
- **版本**: v1.0
- **状态**: 待审核
- **目标用户**: 业务运营人员

---

## 1. 功能概述

### 1.1 需求背景

当前品牌数据管理流程：

1. 硬编码品牌映射 → **已迁移** → 数据库存储
2. 品牌新增/修改需要开发人员介入 → **待改进** → 业务人员自主管理
3. 品牌同步依赖手动配置 → **待改进** → 自动识别数据库品牌

**核心诉求**: 业务运营人员能够自主管理品牌数据，无需技术支持。

### 1.2 功能目标

- ✅ **新增品牌**: 业务人员可以添加新的品牌映射
- ✅ **编辑品牌**: 修改品牌名称或组织ID映射
- ✅ **删除品牌**: 软删除品牌（可恢复）
- ✅ **恢复品牌**: 恢复已删除的品牌
- ✅ **查看品牌**: 查看所有品牌（包括已删除）
- ✅ **同步联动**: 品牌变更后自动影响数据同步

---

## 2. 用户场景

### 场景 1: 新增品牌

**角色**: 业务运营
**场景**: 公司签约了新品牌"喜茶"，需要添加到系统

**操作流程**:

1. 进入"应用配置管理" → "品牌数据" → "品牌管理"（新增 tab）
2. 点击"新增品牌"按钮
3. 填写表单：
   - 组织 ID: `12345`
   - 品牌名称: `喜茶`
   - 来源系统: `haimian`（下拉选择）
   - 显示顺序: `100`（可选）
   - 描述: `喜茶上海区域门店`（可选）
4. 点击"保存"
5. **联动效果**:
   - 数据同步页面立即可见"喜茶"
   - 智能回复系统可识别"喜茶"品牌

### 场景 2: 修改品牌名称

**角色**: 业务运营
**场景**: "肯德基"需要更名为"肯德基中国"

**操作流程**:

1. 在品牌列表中找到"肯德基"
2. 点击"编辑"按钮
3. 修改品牌名称: `肯德基` → `肯德基中国`
4. 填写变更原因: `品牌名称标准化`
5. 点击"保存"
6. **联动效果**:
   - 历史配置数据保持不变（向后兼容）
   - 新同步的数据使用新名称
   - 智能提取器识别别名"肯德基" → "肯德基中国"

### 场景 3: 修改组织 ID

**角色**: 业务运营
**场景**: Haimian 系统中"麦当劳"的组织 ID 从 `10001` 变更为 `20001`

**操作流程**:

1. 编辑"麦当劳"品牌
2. 修改组织 ID: `10001` → `20001`
3. 填写变更原因: `Haimian 系统 ID 变更`
4. 点击"保存"
5. **风险提示**:
   - ⚠️ 系统弹窗警告："修改组织 ID 将影响数据同步，请确认"
6. **联动效果**:
   - 下次同步时使用新 ID `20001`
   - 旧 ID `10001` 的历史数据保留

### 场景 4: 删除品牌（软删除）

**角色**: 业务运营
**场景**: "成都你六姐"门店全部关闭，不再需要

**操作流程**:

1. 在品牌列表中找到"成都你六姐"
2. 点击"删除"按钮
3. 确认对话框: "删除后将不再显示在同步列表，但可以恢复，是否继续？"
4. 点击"确认"
5. **联动效果**:
   - 品牌状态变为"已停用"（`isActive = false`）
   - 同步页面不再显示该品牌
   - 历史配置数据保留
   - 智能提取器停止识别该品牌

### 场景 5: 恢复已删除品牌

**角色**: 业务运营
**场景**: "成都你六姐"重新开业

**操作流程**:

1. 筛选器选择"已停用"
2. 找到"成都你六姐"
3. 点击"恢复"按钮
4. 确认恢复
5. **联动效果**:
   - 品牌状态恢复为"启用"（`isActive = true`）
   - 立即可在同步页面选择
   - 智能提取器恢复识别

---

## 3. 数据模型分析

### 3.1 涉及的数据库表

基于 `db/schema.ts`：

#### 主表: `data_dictionary`

```typescript
{
  id: serial,                          // 自增主键
  dictionaryType: enum,                // 固定为 'brand'
  mappingKey: varchar(100),            // 组织ID（如 "10001"）
  mappingValue: varchar(255),          // 品牌名称（如 "肯德基"）
  sourceSystem: varchar(50),           // 来源系统（如 "haimian"）
  metadata: jsonb,                     // 扩展信息（JSON格式）
  displayOrder: integer,               // 显示顺序
  isActive: boolean,                   // 是否启用（软删除标记）✅
  description: text,                   // 描述
  createdAt: timestamp,                // 创建时间
  updatedAt: timestamp,                // 更新时间
  createdBy: varchar(100),             // 创建人
  updatedBy: varchar(100)              // 更新人
}
```

**关键约束**:

```sql
-- 部分唯一索引：仅对启用的记录保证唯一
UNIQUE INDEX unique_active_type_key
  ON (dictionary_type, mapping_key)
  WHERE is_active = true;
```

**设计优势**:

- ✅ 允许软删除后的记录重复（`isActive = false` 不参与唯一性）
- ✅ 恢复品牌时不会冲突（重新激活即可）
- ✅ 保留完整历史记录

#### 辅助表: `dictionary_change_log`

```typescript
{
  id: uuid,                            // UUID主键
  dictionaryId: integer,               // 关联的字典ID
  operation: varchar(20),              // 操作类型: INSERT/UPDATE/DELETE
  oldData: jsonb,                      // 变更前数据
  newData: jsonb,                      // 变更后数据
  changeReason: text,                  // 变更原因（重要！）
  operatedBy: varchar(100),            // 操作人
  operatedAt: timestamp                // 操作时间
}
```

**用途**:

- 📝 审计追踪
- 🔍 问题回溯
- ↩️ 数据回滚参考

### 3.2 字段变更影响分析

#### 变更 `mappingKey` (组织ID)

**影响范围**:

| 系统模块                   | 影响说明           | 应对策略                |
| -------------------------- | ------------------ | ----------------------- |
| **数据同步** (`/api/sync`) | 下次同步时使用新ID | ⚠️ 需手动触发同步       |
| **Config Service**         | 配置数据键名不匹配 | ❌ 不影响（品牌名为键） |
| **Smart Extractor**        | 品牌识别逻辑       | ✅ 不影响（基于品牌名） |
| **Brand Context**          | 前端品牌列表       | ✅ 自动更新             |

**风险提示**:

```
⚠️ 警告：修改组织 ID 将影响数据同步
- 旧 ID 的数据将无法同步
- 需要重新同步该品牌的所有数据
- 建议在非工作时间修改
```

**推荐操作**:

1. 确认新 ID 正确
2. 备份现有配置数据
3. 修改后立即触发同步
4. 验证数据完整性

#### 变更 `mappingValue` (品牌名称)

**影响范围**:

| 系统模块            | 影响说明     | 应对策略                  |
| ------------------- | ------------ | ------------------------- |
| **数据同步**        | 品牌名称更新 | ✅ 自动生效               |
| **Config Service**  | 历史配置键名 | ⚠️ 可能不匹配（详见下文） |
| **Smart Extractor** | 别名映射     | ⚠️ 需更新别名配置         |
| **Brand Context**   | 前端显示名称 | ✅ 自动更新               |
| **已有对话记忆**    | 提取的品牌名 | ❌ 历史数据不变           |

**Config Service 影响分析**:

当前 `brandData` 结构：

```typescript
{
  brands: {
    "肯德基": {      // ← 品牌名作为键
      id: "10001",
      systemPrompt: "...",
      replyPrompts: {...}
    }
  }
}
```

**如果修改品牌名**:

```typescript
// 修改前
"肯德基" → { id: "10001", ... }

// 修改后
"肯德基中国" → { id: "10001", ... }

// 问题：旧的 "肯德基" 键的配置数据怎么办？
```

**解决方案**（待讨论）:

方案 A: **保持向后兼容**（推荐）

```typescript
// 同步时创建别名映射
{
  "肯德基中国": { id: "10001", ... },  // 新名称
  "肯德基": { id: "10001", ... }       // 保留旧名称（引用同一配置）
}
```

方案 B: **自动迁移配置**

```typescript
// 修改品牌名时，自动重命名配置键
// 风险：可能影响正在使用的会话
```

方案 C: **提示用户手动处理**

```typescript
// 弹窗提示："品牌名称已修改，请手动更新配置数据"
// 优点：安全，用户可控
// 缺点：增加操作成本
```

#### 变更 `isActive` (软删除)

**影响范围**:

| 系统模块            | 影响说明     | 行为               |
| ------------------- | ------------ | ------------------ |
| **数据同步**        | 品牌列表过滤 | 不显示已停用品牌   |
| **Config Service**  | 配置数据     | 保留（不删除）     |
| **Smart Extractor** | 品牌识别     | 停止识别（待确认） |
| **Brand Context**   | 前端列表     | 不显示已停用品牌   |

**Smart Extractor 处理策略**（待讨论）:

```typescript
// 问题：已停用品牌是否还需要识别？

// 场景 1：用户提到"成都你六姐"（已停用）
// 策略 A：仍然识别，但标记为"已停用"
// 策略 B：不识别，当作普通文本
```

**推荐策略 A**（识别但标记）:

- 优点：完整的对话理解，可以告知用户"该品牌已停用"
- 缺点：需要额外的状态管理

---

## 4. 业务流程设计

### 4.1 新增品牌流程

```mermaid
graph TD
    A[用户点击"新增品牌"] --> B[打开表单对话框]
    B --> C{填写必填字段}
    C -->|缺少字段| D[显示错误提示]
    C -->|完整| E[调用 createBrand API]
    E --> F{验证组织ID唯一性}
    F -->|重复| G[提示"该组织ID已存在"]
    F -->|唯一| H[插入数据库]
    H --> I[记录变更日志]
    I --> J[刷新品牌列表]
    J --> K[显示成功提示]
```

**API 设计**:

```typescript
POST /api/brands

Request Body:
{
  mappingKey: string;        // 组织ID（必填）
  mappingValue: string;      // 品牌名称（必填）
  sourceSystem?: string;     // 来源系统（可选，默认 "haimian"）
  displayOrder?: number;     // 显示顺序（可选，默认 0）
  description?: string;      // 描述（可选）
  metadata?: object;         // 扩展信息（可选）
}

Response:
{
  success: true,
  data: {
    id: number;
    mappingKey: string;
    mappingValue: string;
    // ...
  }
}
```

### 4.2 编辑品牌流程

```mermaid
graph TD
    A[用户点击"编辑"] --> B[加载品牌详情]
    B --> C[显示编辑表单]
    C --> D{检测字段变更}
    D -->|修改了 mappingKey| E[显示警告对话框]
    D -->|仅修改 mappingValue| F[直接保存]
    D -->|修改其他字段| F
    E --> G{用户确认}
    G -->|取消| C
    G -->|确认| H[调用 updateBrand API]
    F --> H
    H --> I[更新数据库]
    I --> J[记录变更日志]
    J --> K[刷新列表]
```

**API 设计**:

```typescript
PUT /api/brands/:id

Request Body:
{
  mappingKey?: string;       // 组织ID（可选）
  mappingValue?: string;     // 品牌名称（可选）
  displayOrder?: number;     // 显示顺序（可选）
  description?: string;      // 描述（可选）
  metadata?: object;         // 扩展信息（可选）
  changeReason: string;      // 变更原因（必填！）
}

Response:
{
  success: true,
  data: { /* updated brand */ },
  warnings: [                // 如果有影响，返回警告
    "组织ID已修改，请重新同步数据"
  ]
}
```

### 4.3 删除品牌流程（软删除）

```mermaid
graph TD
    A[用户点击"删除"] --> B[显示确认对话框]
    B --> C{用户确认}
    C -->|取消| D[关闭对话框]
    C -->|确认| E[调用 deleteBrand API]
    E --> F[设置 isActive = false]
    F --> G[记录变更日志]
    G --> H[刷新列表]
    H --> I[显示成功提示]
```

**API 设计**:

```typescript
DELETE /api/brands/:id

Request Body:
{
  changeReason: string;      // 删除原因（必填）
}

Response:
{
  success: true,
  message: "品牌已停用，可在'已停用'筛选器中恢复"
}
```

### 4.4 恢复品牌流程

```mermaid
graph TD
    A[用户筛选"已停用"] --> B[显示已停用品牌列表]
    B --> C[点击"恢复"按钮]
    C --> D[显示确认对话框]
    D --> E{用户确认}
    E -->|取消| F[关闭对话框]
    E -->|确认| G[调用 restoreBrand API]
    G --> H[设置 isActive = true]
    H --> I[记录变更日志]
    I --> J[刷新列表]
```

**API 设计**:

```typescript
POST /api/brands/:id/restore

Request Body:
{
  changeReason: string;      // 恢复原因（必填）
}

Response:
{
  success: true,
  message: "品牌已恢复"
}
```

---

## 5. 前端设计建议

### 5.1 页面布局

**位置**: `/admin/settings` → "品牌数据" tab → 新增"品牌管理"二级 tab

**布局结构**:

```
┌─────────────────────────────────────────────────────┐
│  应用配置管理                      [数据同步] [导入] │
├─────────────────────────────────────────────────────┤
│  [总览] [通用配置] [品牌数据] [系统提示词] [回复指令] │
│                      └─ [配置编辑器] [品牌管理] ←新增│
├─────────────────────────────────────────────────────┤
│                                                      │
│  品牌管理                           [+ 新增品牌]     │
│  ─────────────────────────────────────────────      │
│                                                      │
│  筛选: [全部 ▼] [来源系统: 全部 ▼]  🔍 搜索...      │
│                                                      │
│  ┌──────────────────────────────────────────┐      │
│  │ 组织ID │ 品牌名称 │ 来源  │ 状态 │ 操作  │      │
│  ├──────────────────────────────────────────┤      │
│  │ 10001  │ 肯德基   │haimian│ 启用 │ ✏️ 🗑️│      │
│  │ 10002  │ 麦当劳   │haimian│ 启用 │ ✏️ 🗑️│      │
│  │ 10003  │ 星巴克   │haimian│ 启用 │ ✏️ 🗑️│      │
│  └──────────────────────────────────────────┘      │
│                                                      │
│  显示 1-50 条，共 250 条            ← 上一页 下一页→ │
└─────────────────────────────────────────────────────┘
```

### 5.2 组件设计

**推荐使用**: shadcn/ui Table + Dialog 组件

```tsx
// 主要组件结构
<BrandManagementTab>
  <BrandTableToolbar>
    {" "}
    // 工具栏
    <FilterSelect /> // 筛选器
    <SearchInput /> // 搜索框
    <Button>新增品牌</Button>
  </BrandTableToolbar>
  <DataTable>
    {" "}
    // 表格
    <TableHeader />
    <TableBody>
      <TableRow>
        <TableCell>组织ID</TableCell>
        <TableCell>品牌名称</TableCell>
        <TableCell>来源系统</TableCell>
        <TableCell>状态</TableCell>
        <TableCell>
          <DropdownMenu>
            {" "}
            // 操作菜单
            <MenuItem>编辑</MenuItem>
            <MenuItem>删除</MenuItem>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    </TableBody>
  </DataTable>
  <TablePagination /> // 分页
  <BrandFormDialog /> // 新增/编辑对话框
  <ConfirmDialog /> // 确认对话框
</BrandManagementTab>
```

### 5.3 状态标识

**品牌状态**:

```tsx
// 启用状态
<Badge variant="success">启用</Badge>

// 已停用状态
<Badge variant="secondary">已停用</Badge>
```

**来源系统标识**:

```tsx
<Badge variant="outline">haimian</Badge>
<Badge variant="outline">zhipin</Badge>
<Badge variant="outline">manual</Badge>  // 手动添加
```

### 5.4 表单设计

**新增/编辑品牌表单**:

```tsx
<Dialog>
  <DialogHeader>
    <DialogTitle>{isEdit ? "编辑品牌" : "新增品牌"}</DialogTitle>
  </DialogHeader>

  <DialogContent>
    <Form>
      {/* 组织ID */}
      <FormField
        name="mappingKey"
        label="组织ID *"
        placeholder="输入组织ID（如: 10001）"
        description="来自外部系统的组织标识"
      />

      {/* 品牌名称 */}
      <FormField name="mappingValue" label="品牌名称 *" placeholder="输入品牌名称（如: 肯德基）" />

      {/* 来源系统 */}
      <FormSelect
        name="sourceSystem"
        label="来源系统"
        options={[
          { value: "haimian", label: "Haimian" },
          { value: "zhipin", label: "BOSS直聘" },
          { value: "manual", label: "手动添加" },
        ]}
      />

      {/* 显示顺序 */}
      <FormField
        name="displayOrder"
        label="显示顺序"
        type="number"
        placeholder="数字越小越靠前（可选）"
      />

      {/* 描述 */}
      <FormTextarea name="description" label="描述" placeholder="品牌备注信息（可选）" />

      {/* 变更原因（仅编辑时） */}
      {isEdit && (
        <FormTextarea
          name="changeReason"
          label="变更原因 *"
          placeholder="请说明修改原因，用于审计追踪"
        />
      )}
    </Form>
  </DialogContent>

  <DialogFooter>
    <Button variant="outline">取消</Button>
    <Button type="submit">保存</Button>
  </DialogFooter>
</Dialog>
```

---

## 6. API 接口设计

### 6.1 RESTful API 规范

**Base URL**: `/api/brands`

| Method | Endpoint                  | 功能                     | 权限 |
| ------ | ------------------------- | ------------------------ | ---- |
| GET    | `/api/brands`             | 获取品牌列表（支持筛选） | 读取 |
| GET    | `/api/brands/:id`         | 获取单个品牌详情         | 读取 |
| POST   | `/api/brands`             | 创建新品牌               | 写入 |
| PUT    | `/api/brands/:id`         | 更新品牌                 | 写入 |
| DELETE | `/api/brands/:id`         | 软删除品牌               | 写入 |
| POST   | `/api/brands/:id/restore` | 恢复已删除品牌           | 写入 |
| GET    | `/api/brands/history/:id` | 获取品牌变更历史         | 读取 |

### 6.2 查询参数

**GET `/api/brands`**:

```typescript
Query Parameters:
{
  page?: number;              // 页码（默认 1）
  pageSize?: number;          // 每页数量（默认 50）
  isActive?: boolean;         // 筛选状态（true/false/all，默认 true）
  sourceSystem?: string;      // 筛选来源系统
  search?: string;            // 搜索关键词（搜索品牌名和组织ID）
  sortBy?: string;            // 排序字段（displayOrder/createdAt）
  sortOrder?: 'asc'|'desc';   // 排序方向
}

Response:
{
  success: true,
  data: {
    items: Brand[];           // 品牌列表
    total: number;            // 总数
    page: number;             // 当前页
    pageSize: number;         // 每页数量
    totalPages: number;       // 总页数
  }
}
```

### 6.3 错误处理

**统一错误响应格式**:

```typescript
{
  success: false,
  error: string;              // 错误消息
  code: string;               // 错误代码
  details?: object;           // 详细信息（可选）
}
```

**错误代码定义**:

```typescript
enum BrandErrorCode {
  DUPLICATE_KEY = "DUPLICATE_KEY", // 组织ID重复
  DUPLICATE_NAME = "DUPLICATE_NAME", // 品牌名称重复
  NOT_FOUND = "NOT_FOUND", // 品牌不存在
  INVALID_INPUT = "INVALID_INPUT", // 输入验证失败
  DB_ERROR = "DB_ERROR", // 数据库错误
  PERMISSION_DENIED = "PERMISSION_DENIED", // 权限不足
}
```

---

## 7. 数据库操作设计

### 7.1 Server Actions

**推荐文件**: `actions/brand-mapping.ts`（扩展现有文件）

```typescript
"use server";

import { db } from "@/db";
import { dataDictionary, dictionaryChangeLog } from "@/db/schema";
import { eq, and, like, or } from "drizzle-orm";

/**
 * 创建品牌
 */
export async function createBrand(data: {
  mappingKey: string;
  mappingValue: string;
  sourceSystem?: string;
  displayOrder?: number;
  description?: string;
  metadata?: object;
  operatedBy: string;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // 1. 检查组织ID是否已存在（仅检查启用的）
    const existing = await db
      .select()
      .from(dataDictionary)
      .where(
        and(
          eq(dataDictionary.dictionaryType, "brand"),
          eq(dataDictionary.mappingKey, data.mappingKey),
          eq(dataDictionary.isActive, true)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return {
        success: false,
        error: `组织ID "${data.mappingKey}" 已存在`,
      };
    }

    // 2. 插入新品牌
    const [newBrand] = await db
      .insert(dataDictionary)
      .values({
        dictionaryType: "brand",
        mappingKey: data.mappingKey,
        mappingValue: data.mappingValue,
        sourceSystem: data.sourceSystem || "manual",
        displayOrder: data.displayOrder || 0,
        description: data.description,
        metadata: data.metadata,
        isActive: true,
        createdBy: data.operatedBy,
        updatedBy: data.operatedBy,
      })
      .returning();

    // 3. 记录变更日志
    await db.insert(dictionaryChangeLog).values({
      dictionaryId: newBrand.id,
      operation: "INSERT",
      newData: newBrand,
      changeReason: "新增品牌",
      operatedBy: data.operatedBy,
    });

    return { success: true, data: newBrand };
  } catch (error) {
    console.error("创建品牌失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}

/**
 * 更新品牌
 */
export async function updateBrand(
  id: number,
  data: {
    mappingKey?: string;
    mappingValue?: string;
    displayOrder?: number;
    description?: string;
    metadata?: object;
    changeReason: string;
    operatedBy: string;
  }
): Promise<{ success: boolean; data?: any; error?: string; warnings?: string[] }> {
  try {
    // 1. 获取原始数据
    const [oldBrand] = await db
      .select()
      .from(dataDictionary)
      .where(eq(dataDictionary.id, id))
      .limit(1);

    if (!oldBrand) {
      return { success: false, error: "品牌不存在" };
    }

    // 2. 检测关键字段变更
    const warnings: string[] = [];
    if (data.mappingKey && data.mappingKey !== oldBrand.mappingKey) {
      warnings.push("组织ID已修改，请重新同步该品牌数据");
    }
    if (data.mappingValue && data.mappingValue !== oldBrand.mappingValue) {
      warnings.push("品牌名称已修改，可能影响历史配置数据");
    }

    // 3. 更新品牌
    const [updatedBrand] = await db
      .update(dataDictionary)
      .set({
        ...data,
        updatedBy: data.operatedBy,
        updatedAt: new Date(),
      })
      .where(eq(dataDictionary.id, id))
      .returning();

    // 4. 记录变更日志
    await db.insert(dictionaryChangeLog).values({
      dictionaryId: id,
      operation: "UPDATE",
      oldData: oldBrand,
      newData: updatedBrand,
      changeReason: data.changeReason,
      operatedBy: data.operatedBy,
    });

    return {
      success: true,
      data: updatedBrand,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    console.error("更新品牌失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}

/**
 * 软删除品牌
 */
export async function deleteBrand(
  id: number,
  data: {
    changeReason: string;
    operatedBy: string;
  }
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // 1. 获取原始数据
    const [oldBrand] = await db
      .select()
      .from(dataDictionary)
      .where(eq(dataDictionary.id, id))
      .limit(1);

    if (!oldBrand) {
      return { success: false, error: "品牌不存在" };
    }

    // 2. 软删除（设置 isActive = false）
    const [deletedBrand] = await db
      .update(dataDictionary)
      .set({
        isActive: false,
        updatedBy: data.operatedBy,
        updatedAt: new Date(),
      })
      .where(eq(dataDictionary.id, id))
      .returning();

    // 3. 记录变更日志
    await db.insert(dictionaryChangeLog).values({
      dictionaryId: id,
      operation: "DELETE",
      oldData: oldBrand,
      newData: deletedBrand,
      changeReason: data.changeReason,
      operatedBy: data.operatedBy,
    });

    return {
      success: true,
      message: '品牌已停用，可在"已停用"筛选器中恢复',
    };
  } catch (error) {
    console.error("删除品牌失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}

/**
 * 恢复品牌
 */
export async function restoreBrand(
  id: number,
  data: {
    changeReason: string;
    operatedBy: string;
  }
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // 1. 获取原始数据
    const [oldBrand] = await db
      .select()
      .from(dataDictionary)
      .where(eq(dataDictionary.id, id))
      .limit(1);

    if (!oldBrand) {
      return { success: false, error: "品牌不存在" };
    }

    if (oldBrand.isActive) {
      return { success: false, error: "品牌未被停用，无需恢复" };
    }

    // 2. 检查是否会与现有启用品牌冲突
    const conflict = await db
      .select()
      .from(dataDictionary)
      .where(
        and(
          eq(dataDictionary.dictionaryType, "brand"),
          eq(dataDictionary.mappingKey, oldBrand.mappingKey),
          eq(dataDictionary.isActive, true)
        )
      )
      .limit(1);

    if (conflict.length > 0) {
      return {
        success: false,
        error: `组织ID "${oldBrand.mappingKey}" 已被其他品牌使用，无法恢复`,
      };
    }

    // 3. 恢复品牌（设置 isActive = true）
    const [restoredBrand] = await db
      .update(dataDictionary)
      .set({
        isActive: true,
        updatedBy: data.operatedBy,
        updatedAt: new Date(),
      })
      .where(eq(dataDictionary.id, id))
      .returning();

    // 4. 记录变更日志
    await db.insert(dictionaryChangeLog).values({
      dictionaryId: id,
      operation: "UPDATE",
      oldData: oldBrand,
      newData: restoredBrand,
      changeReason: data.changeReason,
      operatedBy: data.operatedBy,
    });

    return {
      success: true,
      message: "品牌已恢复",
    };
  } catch (error) {
    console.error("恢复品牌失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}
```

---

## 8. 关联系统影响分析

### 8.1 数据同步系统

**文件**: `app/api/sync/route.ts` + `lib/services/duliday-sync.service.ts`

**当前逻辑**:

```typescript
// 从数据库获取所有启用的品牌
const brands = await getAvailableBrands(); // isActive = true

// 用户在前端选择品牌
const selectedBrands = ["10001", "10002"]; // 组织ID

// 调用 Duliday API 同步
syncMultipleOrganizations(selectedBrands);
```

**影响**:

- ✅ 新增品牌后：自动出现在品牌选择列表
- ✅ 删除品牌后：从选择列表中移除
- ✅ 恢复品牌后：重新出现在选择列表
- ⚠️ 修改组织ID：需要用户重新选择并同步

**建议改进**:

```typescript
// 在同步页面显示警告
if (hasRecentlyUpdatedBrands()) {
  showWarning("以下品牌的组织ID已更新，请重新同步：...");
}
```

### 8.2 Config Service

**文件**: `lib/services/config.service.ts`

**当前结构**:

```typescript
{
  brandData: {
    brands: {
      "肯德基": {         // ← 品牌名作为键
        id: "10001",
        systemPrompt: "...",
        replyPrompts: {...}
      }
    }
  }
}
```

**影响分析**:

| 操作       | 影响                     | 处理策略                |
| ---------- | ------------------------ | ----------------------- |
| 新增品牌   | 同步后新品牌出现在配置中 | ✅ 自动处理             |
| 删除品牌   | 配置数据保留，但不再同步 | ✅ 保持原样（历史数据） |
| 修改品牌名 | 配置键名不匹配           | ⚠️ 需要别名或迁移       |
| 修改组织ID | 不影响（ID存储在值中）   | ✅ 无影响               |

**推荐方案**（修改品牌名时）:

方案 1: **配置迁移工具**（推荐）

```typescript
// 提供管理界面
"检测到品牌名称变更：肯德基 → 肯德基中国"[迁移配置][保留旧配置][忽略];

// 点击"迁移配置"后：
// 1. 复制 "肯德基" 的所有配置
// 2. 重命名为 "肯德基中国"
// 3. 保留 "肯德基" 作为别名（可选）
```

方案 2: **使用组织ID作为配置键**（长期优化）

```typescript
// 重构配置结构
{
  brandData: {
    brands: {
      "10001": {        // ← 使用组织ID作为键
        name: "肯德基",  // 品牌名作为属性
        systemPrompt: "...",
        replyPrompts: {...}
      }
    }
  }
}

// 优点：品牌名变更不影响配置
// 缺点：需要重构现有代码
```

### 8.3 Smart Extractor

**文件**: `lib/prompt-engineering/memory/smart-patterns.ts`

**当前逻辑**:

```typescript
// 从数据库加载品牌列表
const brandMapping = await getAllBrandMappings(); // isActive = true?

// 构建品牌字典（包含别名）
const brandDictionary = {
  肯德基: ["肯德基", "KFC", "kfc"],
  麦当劳: ["麦当劳", "麦当劳叔叔", "金拱门"],
  // ...
};

// 从对话中提取品牌
extractBrands("我想去肯德基工作"); // → ["肯德基"]
```

**影响分析**:

| 操作       | 当前行为                 | 建议改进               |
| ---------- | ------------------------ | ---------------------- |
| 新增品牌   | 不识别（缓存未更新）     | 清除缓存或自动刷新     |
| 删除品牌   | 仍然识别（已加载到缓存） | 停止识别或标记"已停用" |
| 修改品牌名 | 旧名无法识别             | 保留旧名作为别名       |

**推荐改进**:

```typescript
// 1. 加载品牌时包含状态
async function buildBrandDictionary() {
  const brands = await db
    .select()
    .from(dataDictionary)
    .where(eq(dataDictionary.dictionaryType, "brand"));

  // 区分启用和停用品牌
  const activeBrands = brands.filter(b => b.isActive);
  const inactiveBrands = brands.filter(b => !b.isActive);

  // 构建字典（仅包含启用的）
  const dictionary = buildDictionary(activeBrands);

  return { dictionary, inactiveBrands };
}

// 2. 提取时标记状态
async function extractBrands(text: string) {
  const { dictionary, inactiveBrands } = await buildBrandDictionary();

  const extracted = findMatches(text, dictionary);

  // 检查是否提到已停用品牌
  const inactiveMatches = findMatches(text, inactiveBrands);
  if (inactiveMatches.length > 0) {
    console.warn("对话中提到已停用品牌:", inactiveMatches);
    // 可选：添加到提取结果，但标记为 inactive
  }

  return extracted;
}

// 3. 缓存失效策略
let lastCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5分钟

if (Date.now() - lastCacheTime > CACHE_TTL) {
  clearCache();
  lastCacheTime = Date.now();
}
```

### 8.4 Brand Context

**文件**: `lib/contexts/brand-context.tsx`

**当前逻辑**:

```typescript
// 从数据库加载品牌
const mappedBrands = await getAvailableBrands(); // isActive = true

// 合并配置数据中的品牌
const dataBrands = Object.keys(brandData.brands);
const availableBrands = [...mappedBrands, ...dataBrands];
```

**影响**:

- ✅ 新增品牌：自动出现在下拉列表
- ✅ 删除品牌：从列表中移除
- ✅ 修改品牌名：自动更新显示

**无需额外改动**，现有逻辑已支持。

---

## 9. 风险和注意事项

### 9.1 数据一致性风险

**风险 1**: 修改组织ID后，历史同步数据失效

**场景**:

```
旧配置：
{
  "肯德基": {
    id: "10001",
    stores: [...] // 旧ID同步的门店数据
  }
}

修改后：组织ID 10001 → 20001

问题：旧的门店数据无法关联到新ID
```

**解决方案**:

- 方案A：禁止修改组织ID（创建新品牌代替）
- 方案B：提供数据迁移工具（复杂，不推荐）
- 方案C：警告用户并记录变更日志（推荐）

### 9.2 缓存不一致风险

**风险 2**: Smart Extractor 缓存未及时更新

**场景**:

```
T0: 缓存加载品牌列表 ["肯德基", "麦当劳"]
T1: 用户新增品牌 "喜茶"
T2: 用户发送消息 "喜茶有岗位吗？"
T3: Smart Extractor 无法识别"喜茶"（缓存未更新）
```

**解决方案**:

```typescript
// 1. 短TTL缓存（5分钟）
const CACHE_TTL = 5 * 60 * 1000;

// 2. 主动清除缓存（品牌变更时）
export async function createBrand(...) {
  // ... 创建品牌
  await clearSmartExtractorCache();  // 清除缓存
}

// 3. 缓存版本控制
const CACHE_VERSION = Date.now();
```

### 9.3 并发操作风险

**风险 3**: 两个用户同时操作同一品牌

**场景**:

```
用户A: 编辑"肯德基"，修改组织ID为 20001
用户B: 同时编辑"肯德基"，修改品牌名为 "肯德基中国"

结果：后提交的覆盖先提交的（数据丢失）
```

**解决方案**:

```typescript
// 乐观锁（使用 updatedAt）
PUT /api/brands/:id
{
  mappingValue: "肯德基中国",
  updatedAt: "2025-01-10T10:00:00Z"  // 客户端的版本
}

// 服务端检查
if (dbRecord.updatedAt > requestData.updatedAt) {
  return { error: "数据已被其他用户修改，请刷新后重试" };
}
```

### 9.4 软删除恢复风险

**风险 4**: 恢复品牌时组织ID已被占用

**场景**:

```
T0: 品牌A（组织ID: 10001）被删除
T1: 创建新品牌B，使用组织ID: 10001
T2: 尝试恢复品牌A → 失败（组织ID冲突）
```

**解决方案**:

```typescript
// 恢复前检查冲突
const conflict = await db
  .select()
  .where(
    and(eq(dataDictionary.mappingKey, oldBrand.mappingKey), eq(dataDictionary.isActive, true))
  );

if (conflict.length > 0) {
  return {
    error: `组织ID "${oldBrand.mappingKey}" 已被品牌 "${conflict[0].mappingValue}" 使用`,
  };
}
```

---

## 10. 测试计划

### 10.1 单元测试

**测试文件**: `actions/__tests__/brand-mapping.test.ts`

```typescript
describe('Brand CRUD Operations', () => {
  describe('createBrand', () => {
    it('应该成功创建新品牌', async () => {
      const result = await createBrand({
        mappingKey: '99999',
        mappingValue: '测试品牌',
        operatedBy: 'test-user'
      });

      expect(result.success).toBe(true);
      expect(result.data.mappingKey).toBe('99999');
    });

    it('应该拒绝重复的组织ID', async () => {
      // 先创建一个品牌
      await createBrand({ mappingKey: '10001', ... });

      // 尝试创建相同ID的品牌
      const result = await createBrand({ mappingKey: '10001', ... });

      expect(result.success).toBe(false);
      expect(result.error).toContain('已存在');
    });
  });

  describe('updateBrand', () => {
    it('应该成功更新品牌', async () => {
      // 测试更新逻辑
    });

    it('应该在修改组织ID时返回警告', async () => {
      const result = await updateBrand(1, {
        mappingKey: 'new-id',
        changeReason: '测试',
        operatedBy: 'test-user'
      });

      expect(result.warnings).toContain('组织ID已修改');
    });
  });

  describe('deleteBrand', () => {
    it('应该软删除品牌（设置isActive=false）', async () => {
      // 测试软删除
    });
  });

  describe('restoreBrand', () => {
    it('应该成功恢复已删除品牌', async () => {
      // 测试恢复
    });

    it('应该拒绝恢复冲突的品牌', async () => {
      // 测试冲突检测
    });
  });
});
```

### 10.2 集成测试

**测试文件**: `app/api/brands/__tests__/route.test.ts`

```typescript
describe("Brand API Routes", () => {
  describe("POST /api/brands", () => {
    it("应该返回201和新创建的品牌", async () => {
      const response = await fetch("/api/brands", {
        method: "POST",
        body: JSON.stringify({
          mappingKey: "88888",
          mappingValue: "API测试品牌",
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe("GET /api/brands", () => {
    it("应该返回分页的品牌列表", async () => {
      const response = await fetch("/api/brands?page=1&pageSize=10");
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.items).toBeInstanceOf(Array);
      expect(data.data.total).toBeGreaterThan(0);
    });

    it("应该支持筛选已停用品牌", async () => {
      const response = await fetch("/api/brands?isActive=false");
      const data = await response.json();

      data.data.items.forEach(brand => {
        expect(brand.isActive).toBe(false);
      });
    });
  });
});
```

### 10.3 E2E 测试

**测试场景**:

1. 新增品牌 → 同步页面可见 → 选择并同步 → 验证数据
2. 修改品牌名 → Config数据检查 → Smart Extractor识别
3. 删除品牌 → 同步页面消失 → 恢复 → 重新出现

---

## 11. 实施计划

### 11.1 开发阶段

**Phase 1: 数据层（1天）**

- ✅ Database Schema 已完成
- [ ] Server Actions 扩展（`actions/brand-mapping.ts`）
  - `createBrand`
  - `updateBrand`
  - `deleteBrand`
  - `restoreBrand`
  - `getBrands`（带分页/筛选）
  - `getBrandHistory`

**Phase 2: API层（1天）**

- [ ] 创建 `app/api/brands/route.ts`
  - GET /api/brands（列表）
  - POST /api/brands（创建）
- [ ] 创建 `app/api/brands/[id]/route.ts`
  - GET /api/brands/:id（详情）
  - PUT /api/brands/:id（更新）
  - DELETE /api/brands/:id（删除）
- [ ] 创建 `app/api/brands/[id]/restore/route.ts`
  - POST /api/brands/:id/restore（恢复）

**Phase 3: 前端组件（2天）**

- [ ] 创建 `components/admin/brand-management/`
  - `brand-table.tsx`（表格组件）
  - `brand-form-dialog.tsx`（表单对话框）
  - `brand-table-toolbar.tsx`（工具栏）
  - `brand-actions.tsx`（操作按钮）
- [ ] 集成到 `app/admin/settings/page.tsx`
  - 添加"品牌管理"二级 tab
  - 连接API

**Phase 4: 联动适配（1天）**

- [ ] 适配 Smart Extractor 缓存策略
- [ ] 适配 Config Service（品牌名变更处理）
- [ ] 测试数据同步流程

**Phase 5: 测试（1天）**

- [ ] 单元测试
- [ ] 集成测试
- [ ] E2E 测试

### 11.2 总工时估算

**总计**: 约 6 个工作日

---

## 12. 待确认事项

### 12.1 核心决策点

**问题 1**: 品牌名称变更时，如何处理配置数据？

- [ ] 方案A: 提供配置迁移工具（推荐）
- [ ] 方案B: 使用组织ID作为配置键（长期重构）
- [ ] 方案C: 保留旧名称作为别名

**问题 2**: 已停用品牌是否需要在 Smart Extractor 中识别？

- [ ] 方案A: 仍然识别，但标记为"已停用"（推荐）
- [ ] 方案B: 完全不识别

**问题 3**: 是否允许修改组织ID？

- [ ] 方案A: 允许，但显示强警告（推荐）
- [ ] 方案B: 禁止修改（创建新品牌代替）

**问题 4**: 缓存刷新策略？

- [ ] 方案A: 短TTL + 手动刷新（推荐）
- [ ] 方案B: 品牌变更时主动清除缓存
- [ ] 方案C: 使用 Redis 发布订阅

### 12.2 用户权限

**问题 5**: 是否需要权限控制？

- [ ] 不需要（所有管理员都可操作）
- [ ] 需要（区分只读/编辑权限）

**问题 6**: 是否需要审批流程？

- [ ] 不需要（直接生效）
- [ ] 需要（修改后需审批）

---

## 13. 参考资料

- 数据库 Schema: `db/schema.ts`
- 现有 Server Actions: `actions/brand-mapping.ts`
- 数据同步服务: `lib/services/duliday-sync.service.ts`
- 品牌上下文: `lib/contexts/brand-context.tsx`
- Smart Extractor: `lib/prompt-engineering/memory/smart-patterns.ts`

---

## 附录

### A. 数据库表结构

详见 `db/schema.ts`：

- `data_dictionary`: 主表
- `dictionary_change_log`: 变更日志
- `dictionary_type_definition`: 类型定义

### B. 现有API端点

- `GET /api/sync`: 检查同步状态
- `POST /api/sync`: 执行数据同步

### C. 前端页面结构

```
/admin/settings
├── 总览 (tab)
├── 通用配置 (tab)
├── 品牌数据 (tab)
│   ├── 配置编辑器 (sub-tab)
│   └── 品牌管理 (sub-tab) ← 新增
├── 系统提示词 (tab)
└── 回复指令 (tab)
```

---

**文档状态**: 待用户审核
**待确认**: 第12节的核心决策点

请确认以上需求是否符合预期，特别是：

1. 品牌名称变更的处理策略
2. 已停用品牌的识别逻辑
3. 组织ID是否允许修改
4. 缓存刷新策略
