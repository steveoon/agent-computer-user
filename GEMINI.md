# AI SDK Computer Use - Gemini Context

This file provides high-level context, architectural guidelines, and operational instructions for Gemini when interacting with this codebase.

## Project Overview

**Name**: `ai-sdk-computer-use`
**Type**: Next.js 15 Application (App Router)
**Purpose**: Enterprise-grade AI recruitment assistant and office automation platform.
**Key Features**:
- **Smart Replies**: Two-phase AI (Classification -> Generation) for recruitment scenarios.
- **Computer Use**: Desktop automation via Claude 3.5 Sonnet and E2B sandbox.
- **Multi-Agent**: Isolated browser sessions for managing multiple accounts (Boss Zhipin, etc.).
- **Integration**: Supports Feishu, WeChat, and HR systems (Duliday).

## Tech Stack

- **Framework**: Next.js 15, React 19, TypeScript (Strict).
- **Styling**: Tailwind CSS, Shadcn UI.
- **Database**: PostgreSQL (via Drizzle ORM).
- **AI**: Vercel AI SDK, Anthropic (Primary), Qwen/OpenAI/Google (Secondary).
- **Infrastructure**: Docker, E2B (Sandbox), Supabase (Optional Auth/DB).
- **State Management**: Zustand, LocalForage (Persistence).

## Architecture & Patterns

### 1. Zod Schema-First
Data structures must be derived from Zod schemas. Runtime validation is mandatory at boundaries.
```typescript
const schema = z.object({...});
type SchemaType = z.infer<typeof schema>;
```
*Note: Use `z.partialRecord()` instead of `z.record()` for non-exhaustive keys.*

### 2. Singleton Services
Core services are implemented as singletons to prevent memory leaks and ensure consistent state:
- `configService` (`lib/services/config.service.ts`)
- `mcpClientManager` (`lib/services/mcp-client-manager.ts`)

### 3. Structured Error Handling
All API endpoints (`app/api/v1/*`) MUST use the unified error system in `lib/errors/`.
- **Wrap**: `wrapError(error, ErrorCode.CODE)`
- **Log**: `logError("Context", appError)`
- **Return**: `{ error: appError.userMessage, ... }`

### 4. AI Message Handling
- **Structure**: Use `message.parts` array, NOT `message.content` string.
- **Tools**: Tool invocations are in `part.toolInvocation`.
- **Migration**: See `docs/AI_SDK_MESSAGE_MIGRATION.md` for details.

## Key Development Commands

### Core
- **Start Dev**: `pnpm dev` (Turbopack, port 3000)
- **Build**: `pnpm build`
- **Lint/Format**: `pnpm lint`, `pnpm format`
- **Type Check**: `npx tsc --noEmit` (Crucial: 0% `any` allowed)

### Database (Drizzle)
- **Generate**: `pnpm db:generate`
- **Migrate**: `pnpm db:migrate`
- **Studio**: `pnpm db:studio`
- **Schema Filter**: `app_huajune` (Multi-tenant isolation)

### Multi-Agent System
- **Control Script**: `scripts/multi-agent.sh`
- **Start**: `pnpm agent:start`
- **Logs**: `pnpm agent:logs <name>`
- **Add Agent**: `pnpm agent:add <name> --count <n>`

### Testing
- **Unit/Watch**: `pnpm test`
- **Coverage**: `pnpm test:coverage` (Target: 80%)
- **MCP Connection**: `pnpm test:mcp-connection`

## Project Structure

- `app/` - Next.js App Router (Routes, API, Layouts).
- `actions/` - Server Actions.
- `components/` - React components (UI, Tool Messages).
- `configs/` - JSON templates and config loaders.
- `db/` - Drizzle setup and schema definitions.
- `docs/` - Comprehensive documentation (Architecture, API, Guides).
- `hooks/` - Custom React hooks.
- `lib/` - Core logic, Services, Stores, Tools, Utils.
  - `lib/e2b/` - Desktop automation logic.
  - `lib/model-registry/` - AI Provider adapters.
  - `lib/tools/` - Business logic tools (Yupao, Duliday, etc.).
- `scripts/` - DevOps and automation scripts.

## Critical Implementation Details

1.  **Configuration Management**:
    - Configs are stored in IndexedDB (via LocalForage) on the client.
    - `ConfigInitializer` component ensures data is loaded.
    - **Do not** hardcode prompts; use the `configService`.

2.  **Desktop Automation**:
    - Uses E2B sandbox.
    - Resolution fixed at 1024x768.
    - **Chinese Input**: Requires special handling (see `docs/CHINESE_INPUT_GUIDE.md`).

3.  **Security**:
    - Secrets go in `.env.local`.
    - `NEXT_PUBLIC_` prefix only for client-safe vars.
    - Dangerous commands are blacklisted/sandboxed.

4.  **Convention**:
    - **Language**: Code comments in English; UI/Business Logic content in Chinese (Target audience).
    - **Commits**: Conventional Commits (`feat:`, `fix:`, `refactor:`).
    - **CSS**: Tailwind with `class-variance-authority` for complex variants.
