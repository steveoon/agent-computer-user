# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Environment:** Node.js 18.18+, pnpm 8+ recommended

## Development Commands

### Essential Commands

- `pnpm dev` - Start development server on port 3000 with Turbopack
- `pnpm build` - Build production bundle
- `pnpm lint` - Run ESLint checks
- `pnpm start` - Start production server
- `pnpm test` - Run unit tests with Vitest (watch mode)
- `pnpm test:run` - Run unit tests once
- `pnpm test:coverage` - Generate test coverage report
- `pnpm format` - Format code with Prettier
- `npx tsc --noEmit` - Run TypeScript type checking
- `pnpm test -- path/to/test.spec.ts` - Run a specific test file

### Docker Commands

- `./scripts/deploy.sh` - Build and push to GitHub Container Registry
- `docker compose -f docker-compose.local.yml up -d` - Local macOS (ARM64)
- `docker compose -f docker-compose.prod.yml up -d` - VPS production

### Multi-Agent Commands

Manage multiple Agent instances with isolated browser sessions. See [MULTI_AGENT_GUIDE.md](docs/guides/MULTI_AGENT_GUIDE.md) for details.

- `pnpm agent:add zhipin --count 3` - Add Agents
- `pnpm agent:list` - List all Agents with status
- `pnpm agent:start/stop` - Start/stop Agents
- `pnpm agent:update` - Auto-update: pull + build + restart running Agents
- `./scripts/multi-agent.sh help` - See all commands

## Architecture Overview

### Core Application Structure

Next.js 15 AI recruitment assistant platform with:

**Multi-Provider AI Integration:**
- Primary: Anthropic Claude Sonnet for computer use
- Secondary: Qwen models via `qwen-ai-provider` for smart reply
- Supports OpenAI, Google AI, OpenRouter via AI SDK
- Provider management: `lib/model-registry/`

**Configuration Management:**
- Unified Config Service (`lib/services/config.service.ts`) using LocalForage
- Three-tier structure: Brand data, System prompts, Reply prompts
- Admin interface: `/admin/settings`
- Zustand stores for state management

**Smart Reply System:**
- Two-phase AI: Classification (generateObject) → Reply generation (generateText)
- 16 reply scenarios (10 recruitment + 6 attendance)
- Fallback to rule-based engine when LLM fails
- Main function: `generateSmartReplyWithLLM()` in `lib/loaders/zhipin-data.loader.ts`

### Core Design Patterns

**Singleton Pattern:** Core services (`configService`, `mcpClientManager`) use singleton for resource efficiency.

**Zod Schema-First Architecture:**
```typescript
const schema = z.object({...})
type SchemaType = z.infer<typeof schema>
```
- Runtime validation at external boundaries
- All data structures derive from Zod schemas

**Zod v4 Migration (Important):**
```typescript
// ❌ Deprecated: message, invalid_type_error, required_error
z.string().min(5, { message: "Too short" })

// ✅ Use error parameter instead
z.string().min(5, { error: "Too short" })
z.string({ error: issue => issue.input === undefined ? "Required" : "Invalid" })
```
- Use `z.partialRecord()` instead of `z.record()` when not requiring exhaustive keys

**Dynamic CSS Selector Pattern:**
- `lib/tools/yupao/dynamic-selector-utils.ts` for CSS modules with changing hashes
- Multi-strategy fallback: CSS pattern → DOM structure → content-based

### File Organization

- **Components**: `components/` with domain subdirectories
- **API Routes**: `app/api/*/route.ts` (Next.js 15 App Router)
- **Tools**: `lib/tools/` with tool-specific subdirectories
- **Stores**: `lib/stores/` (Zustand)
- **Services**: `lib/services/` (singletons)
- **Errors**: `lib/errors/` (structured error handling - AppError, error codes, factories)
- **Types**: `types/` for shared TypeScript definitions

## Available AI Tools

### Communication Tools
- **wechat** - Send messages to WeChat groups (requires WECHAT_BOT_ACCESS_TOKEN)
- **feishu** - Send messages to Feishu groups (requires FEISHU_BOT_WEBHOOK)

### Automation Tools
- **bash** - Execute commands with safety features (E2B sandbox or local preview)
- **puppeteer** - Browser automation via MCP

### Business-Specific Tools
- **job_posting_generator** - Generate formatted job vacancy messages for WeChat
- **duliday** tools - HR system integration (`duliday_job_list`, `duliday_job_details`, `duliday_interview_booking`)
- **yupao** tools - Yupao recruitment platform (`get_unread_messages`, `exchange_wechat`)
- **zhipin** tools - BOSS直聘 recruitment automation

## Testing

### Strategy
- Vitest with 80% coverage thresholds
- React Testing Library for components
- Test files in `__tests__` directories
- AI SDK test utilities: `lib/__tests__/test-utils/ai-mocks.ts`

### Endpoints
- `/test-llm-reply` - Web interface for LLM smart reply testing
- `/api/diagnose` - E2B diagnostic tools
- `/api/health` - Health check endpoint

### TypeScript Config
- `tsconfig.json` - Main config for all files
- `tsconfig.test.json` - Test-specific with test type definitions

## Chinese Language Support

- Primary language for recruitment scenarios
- UTF-8 encoding throughout
- Desktop automation: Chinese IME handling in E2B, resolution fixed at 1024x768
- Reference `docs/CHINESE_INPUT_GUIDE.md` for input issues

## Authentication & Security

- Supabase integration (optional) - app works standalone
- Middleware: `lib/utils/supabase/middleware.ts`
- Tool registry: `lib/tools/tool-registry.ts` for conditional availability
- Production has additional safety restrictions

## Environment Variables

```bash
# AI Providers (at least one required)
ANTHROPIC_API_KEY=your_key
DASHSCOPE_API_KEY=your_key  # Qwen models

# E2B Desktop
E2B_API_KEY=your_key

# Optional
DEEPSEEK_API_KEY, OPENROUTER_API_KEY, GEMINI_API_KEY
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
FEISHU_BOT_WEBHOOK, WECHAT_BOT_WEBHOOK, WECHAT_BOT_ACCESS_TOKEN
DULIDAY_TOKEN, EXA_API_KEY
```

## Advanced Features

### Desktop Automation (E2B)
- `lib/e2b/tool.ts` - Computer use tools with screen capture
- Automatic resource cleanup on termination

### MCP Integration
- Singleton manager for client lifecycle
- Multiple servers: Puppeteer, Google Maps, Exa
- Test: `pnpm test:mcp-connection`

### AI SDK Message Handling
- Uses `message.parts` array (not `message.content` array)
- Tool invocations in `part.toolInvocation` (not `part.toolCall`)
- See `docs/AI_SDK_MESSAGE_MIGRATION.md`

### Tool Component Architecture
- Registry pattern in `components/tool-messages/`
- Each tool has component with theme configuration
- Registry maps tool names to render components

## Development Guidelines

### Code Quality Standards

- **Zero `any` types** - Use `unknown` with type narrowing
- **Strict TypeScript** - Enable strict null checks
- **Explicit prop types** - All components need interface definitions
- **Error handling** - All async operations must handle errors
- **Explicit return types** for all functions
- **Prefer `readonly`** for immutability
- **Check `types/` folder first** - Avoid duplicate type definitions

### TypeScript Patterns (Eliminate if-else)

**Handler/Strategy Pattern:**
```typescript
// ❌ if (type === "a") { doA(); } else if (type === "b") { doB(); }
// ✅
const HANDLERS: Record<TypeKey, Handler> = {
  a: { execute: doA }, b: { execute: doB },
};
HANDLERS[type].execute();
```

**Type Predicates:**
```typescript
// ❌ arr.filter(x => isValid(x)) as ValidType[]
// ✅ arr.filter((x): x is ValidType => isValid(x))
```

**Record Mapping:**
```typescript
// ❌ switch (key) { case "a": return "A"; }
// ✅ const MAP: Record<Key, string> = { a: "A" }; return MAP[key];
```

### API Development

- Validate all inputs with Zod schemas
- Return consistent `{ success: boolean; data?: T; error?: string }` responses
- Use proper HTTP status codes

### Database Operations

- Use transactions for multi-step operations
- Add type checks in WHERE clauses
- Prefer soft deletes with `isActive` flag
- Record audit logs: INSERT stores `newData`, UPDATE/DELETE stores both `oldData` and `newData`

## Error Handling & Debugging

### Structured Error System (Required for Open API)

All `app/api/v1/*` endpoints MUST use `lib/errors/` to preserve error chains:

```typescript
import { wrapError, extractErrorContext, logError, ErrorCode } from "@/lib/errors";

catch (error) {
  const appError = wrapError(error, ErrorCode.LLM_GENERATION_FAILED);
  logError("Context", appError);
  return { error: appError.userMessage, errorContext: extractErrorContext(appError) };
}
```

**Key APIs:** `wrapError()` auto-detects AI SDK/network errors, `extractErrorContext()` returns `{ errorCode, category, originalError }`

**Categories:** `LLM`, `CONFIG`, `AUTH`, `NETWORK`, `VALIDATION`, `BUSINESS`, `SYSTEM`

**Common Codes:** `LLM_UNAUTHORIZED`, `LLM_MODEL_NOT_FOUND`, `CONFIG_MISSING_FIELD`, `NETWORK_TIMEOUT`

❌ `return { error: "硬编码错误信息" }` → ✅ `return { error: appError.userMessage }`

### Common Issues

**Configuration:** Check DevTools > Application > IndexedDB, or clear to re-initialize

**Tool Component Not Rendering:**
- Verify `message.parts` exists
- Check `components/tool-messages/index.ts` registry

**CSS Module Selectors:**
- Use dynamic selectors from `lib/tools/yupao/dynamic-selector-utils.ts`
- Update constants in `lib/tools/yupao/constants.ts` if needed

**Type Errors:** Run `npx tsc --noEmit`, use `unknown` instead of `any`

## Key Data Flows

1. **Config**: `ConfigInitializer` → `configService.getConfig()` → Components
2. **Smart Reply**: Message → Classification → Reply generation
3. **Computer Use**: Action → E2B tools → Desktop → Screenshot/result
4. **Brand Management**: Database → Server Actions → Zustand → Admin UI

## Important Notes

- Check configuration state before accessing brand/prompt data
- Follow two-phase AI pattern for intelligent features
- Test Chinese input when modifying desktop automation
- Run `npx tsc --noEmit` before committing
- When tests fail, analyze business logic first (don't just modify tests to pass)

### Commit Convention

Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
