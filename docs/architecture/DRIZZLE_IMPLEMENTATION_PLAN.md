# Drizzle + Supabase 集成实施计划

> **分支**: `feature/drizzle-supabase`  
> **基于**: `develop` 分支  
> **参考项目**: `/Users/rensiwen/Documents/react-projects/Next-PJ/with-supabase-app`  
> **创建日期**: 2025-01-23

---

## 📋 目录

- [实施概览](#实施概览)
- [依赖安装](#依赖安装)
- [文件修改清单](#文件修改清单)
- [详细实施步骤](#详细实施步骤)
- [配置文件内容](#配置文件内容)
- [测试和验证](#测试和验证)
- [部署注意事项](#部署注意事项)
- [回滚方案](#回滚方案)
- [参考资源](#参考资源)

---

## 实施概览

### 集成目标

将 Drizzle ORM 集成到现有项目中，用于 PostgreSQL 数据库操作，同时保持现有的 Supabase Auth 功能不变。

### 架构设计

```
现有架构:
  Supabase Auth (lib/utils/supabase/*) → 用户认证

新增架构:
  Drizzle ORM (db/*) → 数据库操作
```

### 关键原则

- ✅ 遵循项目的 **Singleton 模式**
- ✅ 符合项目的 **Zod schema-first** 架构
- ✅ 保持现有 Supabase Auth 集成不变
- ✅ 参考已验证的 `with-supabase-app` 项目实现
- ✅ 不影响现有功能和测试

---

## 依赖安装

### 生产依赖

```bash
pnpm add drizzle-orm@^0.44.6 postgres@^3.4.7 drizzle-zod@^0.5.1
```

| 包名 | 版本 | 说明 |
|------|------|------|
| `drizzle-orm` | ^0.44.6 | ORM 核心库 |
| `postgres` | ^3.4.7 | PostgreSQL 驱动（比 pg 更快） |
| `drizzle-zod` | ^0.5.1 | Drizzle 与 Zod 集成（符合项目架构） |

### 开发依赖

```bash
pnpm add -D drizzle-kit@^0.31.5
```

| 包名 | 版本 | 说明 |
|------|------|------|
| `drizzle-kit` | ^0.31.5 | 迁移管理工具 |

---

## 文件修改清单

### 新建文件（4 个核心文件）

| 路径 | 类型 | 说明 |
|------|------|------|
| `db/index.ts` | 代码 | 数据库客户端实例（Singleton） |
| `db/schema.ts` | 代码 | Drizzle Schema 定义 |
| `db/types.ts` | 代码 | Zod Schema 和 TypeScript 类型 |
| `drizzle.config.ts` | 配置 | Drizzle Kit 配置文件 |

### 修改文件（6 个）

| 路径 | 修改内容 | 影响范围 |
|------|---------|----------|
| `package.json` | 添加依赖和脚本 | 构建和开发流程 |
| `.env.example` | 添加 `DATABASE_URL` | 环境变量模板 |
| `.dockerignore` | 添加 `drizzle/` 和 `drizzle.config.ts` | Docker 构建 |
| `eslint.config.mjs` | 添加 `drizzle/**` 到 ignores | ESLint 检查 |
| `docker-compose.yml` | 添加 `DATABASE_URL` 环境变量 | Docker 本地开发 |
| `docker-compose.prod.yml` | 添加 `DATABASE_URL` 环境变量 | Docker 生产部署 |

### 无需修改文件

| 路径 | 原因 |
|------|------|
| `Dockerfile` | Drizzle 作为依赖自动安装，无需特殊构建步骤 |
| `lib/utils/supabase/*` | 认证功能保持不变 |
| `middleware.ts` | 不涉及数据库操作 |
| `tsconfig.json` | TypeScript 配置已足够 |

---

## 详细实施步骤

### 第一阶段：环境准备（预计 10 分钟）

#### 步骤 1.1：安装依赖

```bash
# 生产依赖
pnpm add drizzle-orm@^0.44.6 postgres@^3.4.7 drizzle-zod@^0.5.1

# 开发依赖
pnpm add -D drizzle-kit@^0.31.5
```

**验证**：
```bash
pnpm list drizzle-orm drizzle-kit postgres drizzle-zod
```

#### 步骤 1.2：创建目录结构

```bash
mkdir -p db
```

注意：`drizzle/` 目录会在运行 `pnpm db:generate` 时自动创建。

#### 步骤 1.3：更新 package.json 脚本

在 `package.json` 的 `scripts` 部分添加：

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

**说明**：
- `db:generate` - 根据 schema 生成迁移文件
- `db:migrate` - 执行迁移（应用到数据库）
- `db:push` - 直接推送 schema 到数据库（开发用）
- `db:studio` - 打开 Drizzle Studio 可视化界面

---

### 第二阶段：配置文件创建（预计 15 分钟）

#### 步骤 2.1：创建 drizzle.config.ts

**文件路径**: `drizzle.config.ts`（项目根目录）

见 [配置文件内容](#drizzleconfigts) 部分。

#### 步骤 2.2：创建数据库连接实例

**文件路径**: `db/index.ts`

见 [配置文件内容](#dbindexts) 部分。

#### 步骤 2.3：创建 Schema 定义

**文件路径**: `db/schema.ts`

见 [配置文件内容](#dbschemats) 部分。

#### 步骤 2.4：创建类型定义

**文件路径**: `db/types.ts`

见 [配置文件内容](#dbtypests) 部分。

---

### 第三阶段：环境变量配置（预计 5 分钟）

#### 步骤 3.1：更新 .env.example

在 `.env.example` 中的 Supabase 配置下方添加：

```bash
# ===== Supabase (可选) =====
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# ===== Database (Drizzle ORM) =====
# Supabase 数据库连接字符串
# 获取方式: Supabase Dashboard > Settings > Database > Connection string
# 注意: 使用 Transaction mode 连接池（生产环境推荐）
# 格式: postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
DATABASE_URL=
```

#### 步骤 3.2：配置本地 .env 文件

**获取 DATABASE_URL**：
1. 登录 Supabase Dashboard
2. 选择项目
3. 进入 `Settings` > `Database` > `Connection string`
4. 选择 `Transaction` 模式（生产推荐）
5. 复制连接字符串并替换 `[YOUR-PASSWORD]` 为实际密码

**示例**：
```
DATABASE_URL=postgresql://postgres.abcdefghijk:YourPassword123@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

---

### 第四阶段：Docker 配置更新（预计 10 分钟）

#### 步骤 4.1：更新 .dockerignore

在 `.dockerignore` 文件末尾添加：

```bash
# Drizzle 迁移文件 - 不应包含在镜像中
# 迁移应在部署前手动执行，不应打包到镜像
drizzle/
drizzle.config.ts
```

**说明**：
- `drizzle/` 目录包含 SQL 迁移文件和元数据，不应打包
- `drizzle.config.ts` 是开发工具配置，运行时不需要

#### 步骤 4.2：更新 docker-compose.yml

在 `environment` 部分的 Supabase 配置下方添加：

```yaml
services:
  app:
    environment:
      # ... 现有环境变量
      
      # Supabase (可选)
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}

      # Database (Drizzle ORM)
      - DATABASE_URL=${DATABASE_URL}

      # ... 其他环境变量
```

#### 步骤 4.3：更新 docker-compose.prod.yml

同样在 `environment` 部分添加：

```yaml
services:
  app:
    environment:
      # ... 现有环境变量
      
      # Supabase (可选)
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}

      # Database (Drizzle ORM)
      - DATABASE_URL=${DATABASE_URL}

      # ... 其他环境变量
```

#### 步骤 4.4：确认 Dockerfile 无需修改

**无需修改 Dockerfile**，原因：
- ✅ Drizzle 依赖在 `deps` 阶段自动安装
- ✅ 迁移文件被 `.dockerignore` 排除
- ✅ 数据库连接在运行时通过环境变量注入
- ✅ 不需要在容器中运行迁移（应在部署前手动执行）

---

### 第五阶段：ESLint 配置更新（预计 5 分钟）

#### 步骤 5.1：更新 eslint.config.mjs

在 `ignores` 数组中添加 `drizzle/**`：

```javascript
const eslintConfig = [
  // 首先定义要忽略的文件
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      ".next/**",
      "out/**",
      "**/__tests__/**",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "vitest.config.*",
      "vitest.setup.*",
      "coverage/**",
      ".nyc_output/**",
      "examples/**",
      "e2e/**",
      "playwright-tests/**",
      "docs/**",
      "*.md",
      // 新增：Drizzle 自动生成的迁移文件
      "drizzle/**",
    ],
  },
  // ... 其他配置
];
```

**说明**：
- `drizzle/**` 包含自动生成的 SQL 文件和 JSON 元数据
- 这些文件不应该被 ESLint 检查
- `db/**` 目录中的代码是我们自己写的，应该被检查，所以不排除

---

### 第六阶段：数据库迁移（预计 10 分钟）

#### 步骤 6.1：生成初始迁移

```bash
pnpm db:generate
```

**预期输出**：
```
📦 Generating migrations...
✓ Migrations generated successfully!
📁 drizzle/0000_initial.sql
📁 drizzle/meta/_journal.json
📁 drizzle/meta/0000_snapshot.json
```

#### 步骤 6.2：查看生成的迁移文件

```bash
cat drizzle/0000_*_*.sql
```

**预期内容**（示例）：
```sql
CREATE TABLE "users_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"bio" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_profile_auth_user_id_unique" UNIQUE("auth_user_id"),
	CONSTRAINT "users_profile_email_unique" UNIQUE("email")
);
```

#### 步骤 6.3：推送到 Supabase 数据库

```bash
# 方式 1: 直接推送（开发环境，快速测试）
pnpm db:push

# 方式 2: 执行迁移（生产环境推荐）
pnpm db:migrate
```

**推荐使用 `db:push` 用于开发**：
- ✅ 跳过迁移历史
- ✅ 快速同步 schema 到数据库
- ✅ 适合频繁修改 schema 的开发阶段

#### 步骤 6.4：验证数据库表创建

```bash
# 打开 Drizzle Studio 可视化界面
pnpm db:studio
```

或在 Supabase Dashboard 中查看：
1. 登录 Supabase
2. 进入 `Table Editor`
3. 确认 `users_profile` 和 `posts` 表已创建

---

## 配置文件内容

### drizzle.config.ts

**文件路径**: `drizzle.config.ts`（项目根目录）

```typescript
import { loadEnvConfig } from '@next/env';
import { defineConfig } from 'drizzle-kit';

// 加载 Next.js 环境变量 (.env.local, .env, etc.)
loadEnvConfig(process.cwd());

export default defineConfig({
  out: './drizzle',                    // 迁移文件输出目录
  schema: './db/schema.ts',            // Schema 定义位置
  dialect: 'postgresql',               // 使用 PostgreSQL
  dbCredentials: {
    url: process.env.DATABASE_URL!,    // 数据库连接字符串
  },
});
```

**关键点**：
- 使用 `@next/env` 加载环境变量（与 Next.js 一致）
- 输出目录为 `./drizzle`（与参考项目一致）
- Schema 路径为 `./db/schema.ts`

---

### db/index.ts

**文件路径**: `db/index.ts`

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Database client for Drizzle ORM
 *
 * IMPORTANT: For Supabase connection pooling (transaction mode),
 * set { prepare: false } to disable prepared statements.
 *
 * Connection modes:
 * - Session mode: Use default settings (开发环境)
 * - Transaction mode: Add { prepare: false } (生产环境推荐)
 */

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Create PostgreSQL connection
// Supabase Transaction pooling requires prepare: false
const client = postgres(process.env.DATABASE_URL, {
  prepare: false, // Required for Supabase transaction pooling
});

// Create Drizzle instance with schema
export const db = drizzle({ client, schema });

// Export schema for use in queries
export { schema };
```

**设计说明**：
- ✅ Singleton 模式：导出单一 `db` 实例
- ✅ 错误处理：启动时检查环境变量
- ✅ Supabase 兼容：设置 `prepare: false` 用于事务模式连接池
- ✅ Schema 导出：方便在应用中导入

---

### db/schema.ts

**文件路径**: `db/schema.ts`

> **⚠️ 重要说明**：以下是用于测试 Drizzle 集成的**示例 schema**。  
> 实际的业务 schema 应根据项目需求单独定义。  
> 你可以先使用此示例完成集成测试，验证成功后再替换为实际的业务表结构。

```typescript
import { integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * 【示例】用户资料表
 * 用于演示如何扩展 Supabase Auth 用户信息
 * 
 * ⚠️ 注意：这是测试用的示例表，实际项目中请根据业务需求定义
 */
export const usersProfileTable = pgTable("users_profile", {
  id: uuid("id").primaryKey().defaultRandom(),
  // 关联 Supabase Auth 的 user ID
  authUserId: uuid("auth_user_id").unique(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  bio: text("bio"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * 示例：文章表（演示一对多关系）
 */
export const postsTable = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersProfileTable.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content"),
  published: integer("published").default(0).notNull(), // 0 = draft, 1 = published
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

**Schema 设计特点**：
- UUID 主键（与 Supabase 默认一致）
- `authUserId` 字段关联 Supabase Auth 用户
- 外键约束和级联删除
- 自动时间戳（`defaultNow()`）
- 唯一约束

---

### db/types.ts

**文件路径**: `db/types.ts`

```typescript
import { z } from "zod";
import { createSelectSchema, createInsertSchema } from "drizzle-zod";
import { usersProfileTable, postsTable } from "./schema";

// ==================== 用户资料相关类型 ====================

/**
 * 用户资料查询 Schema（从 Drizzle Schema 生成）
 */
export const selectUserProfileSchema = createSelectSchema(usersProfileTable);

/**
 * 用户资料插入 Schema（从 Drizzle Schema 生成）
 */
export const insertUserProfileSchema = createInsertSchema(usersProfileTable, {
  // 可以自定义字段验证
  email: z.string().email("Invalid email format"),
  name: z.string().min(1, "Name is required").max(255),
  bio: z.string().max(1000, "Bio is too long").optional(),
});

/**
 * 用户资料更新 Schema（所有字段可选）
 */
export const updateUserProfileSchema = insertUserProfileSchema.partial();

/**
 * 用户资料 TypeScript 类型
 */
export type UserProfile = z.infer<typeof selectUserProfileSchema>;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;

// ==================== 文章相关类型 ====================

export const selectPostSchema = createSelectSchema(postsTable);
export const insertPostSchema = createInsertSchema(postsTable, {
  title: z.string().min(1, "Title is required").max(500),
  content: z.string().optional(),
});
export const updatePostSchema = insertPostSchema.partial();

export type Post = z.infer<typeof selectPostSchema>;
export type InsertPost = z.infer<typeof insertPostSchema>;
export type UpdatePost = z.infer<typeof updatePostSchema>;
```

**类型系统设计**：
- ✅ 符合项目的 **Zod schema-first** 原则
- ✅ 从 Drizzle Schema 生成 Zod Schema（单一数据源）
- ✅ 提供 Select、Insert、Update 三种操作的类型
- ✅ 自定义验证规则（email 格式、长度限制等）
- ✅ 运行时验证 + 编译时类型安全

---

## 测试和验证

### 测试清单

#### 1. 依赖安装验证

```bash
# 检查依赖是否正确安装
pnpm list drizzle-orm drizzle-kit postgres drizzle-zod
```

**预期输出**：
```
drizzle-orm 0.44.6
drizzle-kit 0.31.5
postgres 3.4.7
drizzle-zod 0.5.1
```

#### 2. 配置文件验证

```bash
# 检查 drizzle.config.ts 语法
npx tsx drizzle.config.ts
```

**预期**：无报错。

#### 3. TypeScript 类型检查

```bash
npx tsc --noEmit
```

**预期**：无类型错误。

#### 4. 数据库连接测试

创建临时测试脚本 `scripts/test-db-connection.ts`：

```typescript
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function testConnection() {
  try {
    console.log('Testing database connection...');
    const result = await db.execute(sql`SELECT NOW()`);
    console.log('✅ Database connected successfully!');
    console.log('Server time:', result.rows[0]);
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

testConnection();
```

运行测试：
```bash
npx tsx scripts/test-db-connection.ts
```

#### 5. 迁移验证

```bash
# 生成迁移
pnpm db:generate

# 检查生成的文件
ls -la drizzle/

# 推送到数据库
pnpm db:push
```

#### 6. ESLint 检查

```bash
pnpm lint
```

**预期**：drizzle 目录被忽略，无相关错误。

#### 7. Docker 构建测试

```bash
# 测试本地构建
docker compose -f docker-compose.local.yml build

# 检查环境变量是否正确注入
docker compose -f docker-compose.local.yml config
```

#### 8. 现有测试通过

```bash
pnpm test:run
```

**预期**：所有现有测试通过，无回归问题。

---

## 部署注意事项

### 部署前检查清单

- [ ] ✅ 所有环境变量在生产环境中配置（包括 `DATABASE_URL`）
- [ ] ✅ 迁移文件在部署前手动执行（`pnpm db:migrate`）
- [ ] ✅ `.env` 文件不包含在 Git 仓库中
- [ ] ✅ `.dockerignore` 排除 `drizzle/` 目录
- [ ] ✅ Docker Compose 文件包含 `DATABASE_URL` 环境变量
- [ ] ✅ TypeScript 类型检查通过（`npx tsc --noEmit`）
- [ ] ✅ ESLint 检查通过（`pnpm lint`）
- [ ] ✅ 现有测试通过（`pnpm test:run`）

### 部署流程

#### 方式 1: 本地部署（使用 Docker）

```bash
# 1. 确保 .env 文件包含正确的 DATABASE_URL

# 2. 执行迁移（首次部署或 schema 变更时）
pnpm db:migrate

# 3. 构建和启动容器
docker compose -f docker-compose.yml up -d

# 4. 检查健康状态
curl http://localhost:3000/api/health
```

#### 方式 2: VPS 部署（使用 GitHub Container Registry）

```bash
# 1. 在 VPS 上拉取镜像
docker pull ghcr.io/steveoon/ai-computer-use:latest

# 2. 更新 .env 文件（包含 DATABASE_URL）

# 3. 在本地或 CI/CD 中执行迁移
pnpm db:migrate

# 4. 启动容器
docker compose -f docker-compose.prod.yml up -d

# 5. 检查健康状态
curl http://localhost:4000/api/health
```

### 数据库迁移最佳实践

#### 开发环境

```bash
# 快速迭代，不保留迁移历史
pnpm db:push
```

#### 预生产/生产环境

```bash
# 1. 生成迁移
pnpm db:generate

# 2. 审查迁移文件
cat drizzle/0001_*.sql

# 3. 在非高峰时段执行
pnpm db:migrate

# 4. 验证表结构
pnpm db:studio
```

---

## 回滚方案

### 场景 1: 依赖安装问题

```bash
# 删除依赖
pnpm remove drizzle-orm postgres drizzle-kit drizzle-zod

# 清理 node_modules
rm -rf node_modules
pnpm install
```

### 场景 2: 配置文件问题

```bash
# 删除新建的文件
rm -rf db/ drizzle/ drizzle.config.ts

# 恢复修改的文件
git checkout .env.example package.json .dockerignore eslint.config.mjs
git checkout docker-compose.yml docker-compose.prod.yml
```

### 场景 3: 数据库表冲突

```sql
-- 在 Supabase SQL Editor 中执行
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS users_profile CASCADE;
```

### 场景 4: 完全回滚

```bash
# 1. 删除数据库表
# 在 Supabase Dashboard 中手动删除表

# 2. 删除所有新文件
rm -rf db/ drizzle/ drizzle.config.ts

# 3. 恢复修改的文件
git checkout .env.example package.json .dockerignore eslint.config.mjs
git checkout docker-compose.yml docker-compose.prod.yml

# 4. 卸载依赖
pnpm remove drizzle-orm postgres drizzle-kit drizzle-zod

# 5. 重新安装依赖
rm -rf node_modules
pnpm install
```

---

## 使用示例

### 在 Server Component 中使用

```typescript
import { db } from '@/db';
import { usersProfileTable } from '@/db/schema';

export default async function UsersPage() {
  // 查询所有用户
  const users = await db.query.usersProfileTable.findMany();
  
  return (
    <div>
      {users.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
}
```

### 在 API Route 中使用

```typescript
import { db } from '@/db';
import { usersProfileTable } from '@/db/schema';
import { insertUserProfileSchema } from '@/db/types';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Zod 验证
    const validatedData = insertUserProfileSchema.parse(body);
    
    // 插入数据
    const [newUser] = await db
      .insert(usersProfileTable)
      .values(validatedData)
      .returning();
    
    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 400 }
    );
  }
}
```

### 在 Server Action 中使用（带认证）

```typescript
'use server';

import { createClient } from '@/lib/utils/supabase/server';
import { db } from '@/db';
import { usersProfileTable } from '@/db/schema';
import { insertUserProfileSchema } from '@/db/types';

export async function createUserProfile(formData: FormData) {
  // 1. 验证用户认证状态
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }
  
  // 2. 准备数据
  const data = {
    authUserId: user.id,
    name: formData.get('name') as string,
    email: user.email!,
    bio: formData.get('bio') as string,
  };
  
  // 3. Zod 验证
  const validatedData = insertUserProfileSchema.parse(data);
  
  // 4. 插入数据
  const [profile] = await db
    .insert(usersProfileTable)
    .values(validatedData)
    .returning();
  
  return profile;
}
```

---

## 验收标准

### 功能性标准

- [ ] ✅ Drizzle ORM 依赖正确安装
- [ ] ✅ 数据库连接成功
- [ ] ✅ 迁移文件成功生成
- [ ] ✅ 表结构在 Supabase 中创建成功
- [ ] ✅ Zod Schema 验证正常工作
- [ ] ✅ TypeScript 类型推导正确
- [ ] ✅ 示例 API 可以正常 CRUD

### 代码质量标准

- [ ] ✅ TypeScript 类型检查通过（无 `any` 类型）
- [ ] ✅ ESLint 检查通过（drizzle 目录被忽略）
- [ ] ✅ 现有测试全部通过
- [ ] ✅ 代码符合项目风格指南
- [ ] ✅ 所有新代码有适当的注释

### Docker 标准

- [ ] ✅ 本地 Docker 构建成功
- [ ] ✅ 生产镜像构建成功
- [ ] ✅ 环境变量正确注入
- [ ] ✅ 健康检查通过
- [ ] ✅ 迁移文件不包含在镜像中

### 文档标准

- [ ] ✅ 实施计划文档完整
- [ ] ✅ `.env.example` 包含所有必要变量
- [ ] ✅ 代码注释清晰

---

## 风险评估

### 高风险项

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 数据库连接失败 | 阻塞开发 | 提前验证 DATABASE_URL，准备 Session mode 备选方案 |
| 迁移冲突 | 数据丢失 | 仅在开发环境测试，使用 db:push 避免历史冲突 |
| 依赖版本冲突 | 构建失败 | 使用参考项目验证过的版本号 |

### 中风险项

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Docker 构建时间增加 | 开发体验下降 | 依赖层缓存，增量构建 |
| ESLint 误报 | 开发体验下降 | 正确配置 ignores |
| TypeScript 类型错误 | 开发体验下降 | 使用 drizzle-zod 确保类型正确 |

### 低风险项

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 文档过时 | 维护成本增加 | 版本控制，定期审查 |
| 示例代码不完整 | 学习曲线陡峭 | 提供完整的使用指南 |

---

## 预期时间线

| 阶段 | 预计时间 | 累计时间 |
|------|---------|----------|
| 第一阶段：环境准备 | 10 分钟 | 10 分钟 |
| 第二阶段：配置文件创建 | 15 分钟 | 25 分钟 |
| 第三阶段：环境变量配置 | 5 分钟 | 30 分钟 |
| 第四阶段：Docker 配置更新 | 10 分钟 | 40 分钟 |
| 第五阶段：ESLint 配置更新 | 5 分钟 | 45 分钟 |
| 第六阶段：数据库迁移 | 10 分钟 | 55 分钟 |
| 测试和验证 | 20 分钟 | 75 分钟 |

**总预计时间**: 约 1.5 小时

---

## 参考资源

### 官方文档

- [Drizzle ORM 官方文档](https://orm.drizzle.team/)
- [Drizzle Kit 文档](https://orm.drizzle.team/kit-docs/overview)
- [Supabase + Drizzle 集成指南](https://supabase.com/docs/guides/database/drizzle)
- [postgres-js 文档](https://github.com/porsager/postgres)
- [drizzle-zod 文档](https://orm.drizzle.team/docs/zod)

### 项目参考

- 参考项目路径: `/Users/rensiwen/Documents/react-projects/Next-PJ/with-supabase-app`
- 当前项目路径: `/Users/rensiwen/Documents/react-projects/Next-PJ/ai-sdk-computer-use`

### 内部文档

- `CLAUDE.md` - 项目开发指南
- `docs/architecture/SYSTEM_ARCHITECTURE_GUIDE.md` - 系统架构指南

---

## 后续优化建议

### 短期（1-2 周）

- [ ] 添加数据库查询的单元测试
- [ ] 创建常用查询的 helper 函数
- [ ] 添加数据库错误处理中间件

### 中期（1-2 月）

- [ ] 实现数据库查询的性能监控
- [ ] 添加更多表和关系
- [ ] 创建数据填充脚本（seeding）

### 长期（3+ 月）

- [ ] 评估是否需要读写分离
- [ ] 实现数据库备份策略
- [ ] 考虑引入查询优化工具

---

## 联系和支持

如果在实施过程中遇到问题：

1. 查看本文档的相关部分
2. 查看 Drizzle 官方文档
3. 查看参考项目 `with-supabase-app` 的实现
4. 使用 `pnpm db:studio` 可视化检查数据库状态

---

**文档版本**: 1.0  
**创建日期**: 2025-01-23  
**最后更新**: 2025-01-23  
**作者**: Claude Code
