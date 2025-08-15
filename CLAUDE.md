# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Essential Commands

- `pnpm dev` - Start development server on port 3000 with Turbopack
- `pnpm build` - Build production bundle
- `pnpm lint` - Run ESLint checks
- `pnpm start` - Start production server
- `pnpm test` - Run unit tests with Vitest (watch mode)
- `pnpm test:run` - Run unit tests once
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:ui` - Run tests with interactive UI
- `pnpm test:coverage` - Generate test coverage report
- `pnpm test:coverage:ui` - View coverage report in UI
- `pnpm test:mcp-connection` - Test MCP connection using Puppeteer
- `pnpm format` - Format code with Prettier
- `pnpm format:check` - Check code formatting
- `npx tsc --noEmit` - Run TypeScript type checking without emitting files
- `pnpm test -- path/to/test.spec.ts` - Run a specific test file
- `pnpm test -- -t "test name"` - Run tests matching a pattern
- `pnpm test:ui -- path/to/test.spec.ts` - Debug specific tests in UI mode

### Docker Deployment Commands

- `./scripts/deploy.sh` - Automated Docker build and push to GitHub Container Registry
- `docker compose -f docker-compose.local.yml up -d` - Run locally on macOS (ARM64)
- `docker compose -f docker-compose.yml up -d` - Build and run production image (AMD64)
- `docker compose -f docker-compose.prod.yml up -d` - Deploy on VPS (production)

### Semantic Release Commands

- `pnpm release` - Run semantic release (CI only)
- `pnpm release:dry-run` - Preview what would be released without making changes

## Architecture Overview

### Core Application Structure

This is a Next.js 15 AI recruitment assistant platform with the following key components:

**Multi-Provider AI Integration:**

- Primary: Anthropic Claude Sonnet for computer use capabilities
- Secondary: Qwen models via `qwen-ai-provider` for smart reply generation
- Supports OpenAI, Google AI, and OpenRouter providers via AI SDK
- Dynamic model provider management through `lib/model-registry/`
- Provider caching to avoid recreating identical configurations

**Configuration Management:**

- Unified Config Service (`lib/services/config.service.ts`) using localforage
- Three-tier data structure: Brand data, System prompts, Reply prompts
- Migration system from hardcoded data to persistent storage
- Zustand stores for model configuration and state management
- LocalForage for browser-based persistence with IndexedDB fallback

**Smart Reply System:**

- Two-phase AI architecture: Classification (generateObject) → Reply generation (generateText)
- 16 reply scenarios with intelligent intent recognition (10 recruitment + 6 attendance)
- Multi-brand support with dynamic brand detection via React Context
- Fallback mechanism to rule-based engine when LLM fails
- Main function: `generateSmartReplyWithLLM()` in `lib/loaders/zhipin-data.loader.ts`

### Core Design Patterns

**Singleton Pattern:**

- Core services (`configService`, `mcpClientManager`) use singleton pattern
- Ensures single instance for resource efficiency
- Prevents memory leaks and duplicate connections

**Zod Schema-First Architecture:**
All data types and interfaces are derived from Zod schemas:

```typescript
// Define schema first
const schema = z.object({...})
// Derive types
type SchemaType = z.infer<typeof schema>
```

- Runtime validation at all external data boundaries
- Compile-time type safety throughout the application
- Schema-derived types eliminating duplication
- All data structures must derive from Zod schemas

**Type Safety Flow:**

```
API Response → Zod Schema Validation → TypeScript Types → React Components
```

**Dynamic CSS Selector Pattern:**

- Handles CSS modules with changing hash values
- `lib/tools/yupao/dynamic-selector-utils.ts` provides adaptive selectors
- Multi-strategy fallback for element finding:
  1. CSS module pattern matching `[class*="_className_"]`
  2. DOM structure-based selectors
  3. Content-based selection
- Critical for automation tools (Yupao, Zhipin integrations)

### File Organization

- **Components**: `components/` with subdirectories for domain-specific components
- **API Routes**: `app/api/*/route.ts` using Next.js 15 App Router
- **Tools**: `lib/tools/` with tool-specific subdirectories for complex integrations
- **Stores**: `lib/stores/` using Zustand for state management
- **Services**: `lib/services/` for singleton service instances
- **Types**: `types/` for shared TypeScript type definitions

## Available AI Tools

### Communication Tools

- **wechat** - Send messages to WeChat groups via bot integration
  - Requires WECHAT_BOT_ACCESS_TOKEN environment variable
  - Supports image attachments (base64 or URL)
- **feishu** - Send messages to Feishu (Lark) groups
  - Requires FEISHU_BOT_WEBHOOK environment variable
  - Supports rich text formatting

### Automation Tools

- **bash** - Execute bash commands with safety features
  - E2B sandbox mode: Auto-executes in isolated environment when sandboxId present
  - Local mode: Returns command preview with copy button for manual execution
  - Built-in dangerous command blacklist (rm -rf /, dd if=, etc.)
  - Production environment blocks local execution for safety
- **puppeteer** - Browser automation for web scraping and testing
  - Integrated with MCP for advanced browser control
  - Supports screenshot capture and element interaction

### Business-Specific Tools

- **job_posting_generator** - Generates formatted job vacancy messages
  - Supports position types: 前厅, 后厨, 洗碗, 早班
  - Automatically extracts and formats store information
  - Uses AI to parse salary step information from unstructured text
  - Integrates with wechat tool for seamless notification workflow
- **duliday** tools - Integration with Duliday HR system
  - `duliday_job_list` - Fetch job listings
  - `duliday_job_details` - Get detailed job information
  - `duliday_interview_booking` - Schedule interviews
- **yupao** tools - Integration with Yupao recruitment platform
  - `get_unread_messages` - Fetch unread candidate messages with dynamic selectors
  - `exchange_wechat` - Exchange WeChat contacts with candidates
  - Anti-detection measures and dynamic CSS selector handling
- **zhipin** tools - Integration with BOSS直聘 recruitment platform
  - Complete recruitment workflow automation
  - Anti-detection measures built-in

## Testing Guide

### Testing Commands

- `pnpm test` - Run unit tests with Vitest (watch mode)
- `pnpm test:run` - Run unit tests once
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:ui` - Run tests with interactive UI
- `pnpm test:coverage` - Generate test coverage report
- `pnpm test:coverage:ui` - View coverage report in UI
- `pnpm test:mcp-connection` - Test MCP connection using Puppeteer
- `pnpm test -- path/to/test.spec.ts` - Run a specific test file
- `pnpm test -- -t "test name"` - Run tests matching a pattern
- `pnpm test:ui -- path/to/test.spec.ts` - Debug specific tests in UI mode

### Testing Strategy

- **Configuration**: Vitest with 80% code coverage thresholds
- **Tools**: React Testing Library for component testing
- **Performance**: Worker threads for parallel test execution
- **Support**: SVG file support via vite-plugin-magical-svg
- **Timeouts**: 10-second timeouts for tests and hooks
- **Organization**: Test files in `__tests__` directories
- **Utilities**: AI SDK test utilities in `lib/__tests__/test-utils/ai-mocks.ts`
- **Dynamic Selector Testing**: Test utilities for CSS module hash changes in `lib/tools/yupao/__tests__/`

### Testing Endpoints

- Visit `/test-llm-reply` - Web interface for testing LLM smart reply functionality
- `POST /api/test-llm-reply` - API endpoint for programmatic testing
- `GET /api/diagnose` - E2B diagnostic tools for troubleshooting sandbox issues
- `GET /api/health` - Health check endpoint for monitoring and load balancers

### TypeScript Testing Configuration

The project uses separate TypeScript configurations for production and testing:

- `tsconfig.json` - Main configuration that includes all files for proper type inference
- `tsconfig.test.json` - Test-specific configuration with test type definitions
- ESLint configured to ignore test files via flat config `ignores` array
- Test files excluded from production builds via `.dockerignore`

## Chinese Language Support

The application has comprehensive Chinese language support as primary language:

### General Support

- Primary language is Chinese for recruitment scenarios
- UTF-8 encoding throughout the application
- All text operations handle Chinese characters properly
- Supports conversation history for context-aware responses

### Desktop Automation

- Special handling for Chinese IME in E2B environments
- Screen resolution fixed at 1024x768 for consistency
- All desktop interactions go through `lib/e2b/tool.ts`
- Image compression handled by `compressImageServerV2()`
- Reference `docs/CHINESE_INPUT_GUIDE.md` for troubleshooting input issues

### Testing Requirements

- Always test features with Chinese input
- Test Chinese text encoding in all scenarios
- Verify IME compatibility in desktop automation

## Authentication & Security

### Authentication System

- Supabase integration for user authentication (optional)
- App works without authentication in standalone mode
- Cookie-based session management for SSR support
- Route-based protection with configurable public/protected routes
- Middleware at `lib/utils/supabase/middleware.ts`
- Always check if Supabase is configured before using auth features

### Security Features

- `.env` files excluded from Docker images via `.dockerignore`
- Build-time variables (`NEXT_PUBLIC_*`) injected during build
- Runtime variables (API keys) passed via environment variables
- Tool filtering based on environment and configuration
- Production environment has additional safety restrictions
- Use `lib/tools/tool-registry.ts` for tool creation, registration, and conditional availability

## Environment Configuration

### Required Environment Variables

```bash
# AI Providers (at least one required)
ANTHROPIC_API_KEY=your_anthropic_key
DASHSCOPE_API_KEY=your_dashscope_key  # For Qwen models
DEEPSEEK_API_KEY=your_deepseek_key  # Optional
OPENROUTER_API_KEY=your_openrouter_key  # Optional
GEMINI_API_KEY=your_google_gemini_key  # Optional

# E2B Desktop (for computer use features)
E2B_API_KEY=your_e2b_key

# Supabase (Optional - for authentication)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key

# Feishu Integration (Optional)
FEISHU_BOT_WEBHOOK=your_feishu_webhook_url

# WeChat Bot Integration (Optional)
WECHAT_BOT_WEBHOOK=your_wechat_webhook_url
WECHAT_BOT_ACCESS_TOKEN=your_wechat_access_token

# Duliday Integration (Optional)
DULIDAY_TOKEN=your_duliday_token

# MCP Server APIs (Optional)
EXA_API_KEY=your_exa_search_key
```

## Performance Optimization

### Development Performance

- Use Turbopack in development for faster builds (`pnpm dev`)
- React 19 features for improved runtime performance
- Implement lazy loading for heavy components

### Runtime Optimization

- Cache AI provider instances to avoid recreation
- Singleton pattern for core services prevents duplicate instances
- Lazy connection establishment for MCP servers
- Automatic resource cleanup prevents memory leaks

### Production Optimization

- Optimize images with Next.js Image component and Sharp
- Build-time optimizations with proper environment variable handling
- Health check endpoint `/api/health` for monitoring

## Configuration Management

### Config Service Architecture

- All configuration data flows through `configService` singleton
- Components use `ConfigInitializer` for automatic migration on first use
- Admin interface at `/admin/settings` for visual configuration management
- Never modify hardcoded data files - use the config service instead
- Automatic versioning and migration system handles schema upgrades
- Configuration data stored in browser IndexedDB via LocalForage

### Admin Interfaces

- Visit `/admin/settings` - Configuration management interface
- Visit `/admin/config` - Legacy configuration interface (redirects to settings)

### Configuration Data Flow

`ConfigInitializer` → `configService.getConfig()` → Components

## Docker Deployment

### Configuration Files

- **`docker-compose.yml`** - Production image build (linux/amd64)
- **`docker-compose.local.yml`** - Local development on macOS (ARM64)
- **`docker-compose.prod.yml`** - VPS production deployment

### Deployment Workflow

1. **Local Development**: Use `docker-compose.local.yml` or run `pnpm dev` directly
2. **Production Build**: Use `./scripts/deploy.sh` to build and push to GitHub Container Registry
3. **VPS Deployment**: Use `docker-compose.prod.yml` with environment variables from `.env`

### Common Issues

- **macOS Puppeteer errors**: Use `docker-compose.local.yml` instead of `docker-compose.yml`
- **Environment variable warnings**: Check `.env` file exists in same directory as docker-compose file
- **Image architecture conflicts**: Ensure correct docker-compose file for your platform
- **Container health checks**: Use `curl http://localhost:PORT/api/health` to verify service
- **VPS deployment**: Always use `docker-compose.prod.yml` with pre-built images

## Advanced Features

### Desktop Automation (E2B Integration)

- `lib/e2b/tool.ts` - Computer use tools with screen capture and interaction
- `@e2b/desktop` integration for sandbox environments
- Automatic resource cleanup on process termination

### MCP (Model Context Protocol) Integration

- Singleton manager pattern for MCP client lifecycle
- Multiple MCP servers (Puppeteer, Google Maps, Exa) with unified interface
- Tool schema validation and type safety
- Puppeteer usage examples in `examples/` directory
- Test MCP connections using `pnpm test:mcp-connection`

### Progressive Web App Capabilities

- **Full mode**: With authentication, E2B desktop, and all features enabled
- **Standalone mode**: Without Supabase authentication for local development
- **Offline mode**: Using cached configurations from LocalForage
- **Degraded mode**: Fallback to rule-based systems when AI providers fail

### AI SDK React Message Handling

- `@ai-sdk/react` uses `message.parts` array instead of `message.content` array
- Tool invocations are in `part.toolInvocation` not `part.toolCall`
- Always check `parts` array first before falling back to string `content`
- See `docs/AI_SDK_MESSAGE_MIGRATION.md` for detailed migration guide

### Tool Component Architecture

- Tool messages use a registry pattern in `components/tool-messages/`
- Each tool has its own component with theme configuration
- Base component provides consistent structure and loading states
- Tool registry maps tool names to their render components

## Development Guidelines

### Code Quality Standards

- **Zero tolerance for `any` types** - Use `unknown` and type narrowing instead
- **Strict TypeScript** - Enable strict null checks and exhaustive dependency checking
- **Component props interfaces** - All components must have explicit prop type definitions
- **Error handling** - All async operations must include proper error handling
- **Performance considerations** - Avoid unnecessary re-renders and expensive calculations
- **Hook-based composition** - Features encapsulated in custom hooks for reusability
- **PREFER** `readonly` arrays and object properties for immutability
- **USE** explicit return types for all functions

### Component Development

- **USE** the established component patterns in `components/ui/`
- **FOLLOW** the registry pattern for tool components (`components/tool-messages/`)
- **IMPLEMENT** proper loading and error states
- **ENSURE** components are accessible with proper ARIA labels

### API Development

- **VALIDATE** all inputs with Zod schemas
- **RETURN** consistent error responses using established patterns
- **USE** proper HTTP status codes
- **IMPLEMENT** proper error boundaries and try-catch blocks

### State Management

- Zustand for client-side state (auth, desktop, model config)
- React Context for brand selection across components
- LocalForage for persistent configuration storage

## Error Handling & Debugging

### Error Handling Patterns

**Duliday API Error Formatting:**

- Use `DulidayErrorFormatter` class in `lib/utils/duliday-error-formatter.ts`
- Provides detailed field-level validation errors with Zod
- Formats network errors (timeout, connection reset) with user-friendly messages
- Adds organization context to errors for better debugging

**Error Display Components:**

- `SyncErrorDisplay` component for formatted error rendering
- Supports multi-line errors with proper indentation
- Located in `components/sync/sync-error-display.tsx`

### Common Debugging Patterns

**Configuration Issues:**

- Check browser DevTools > Application > IndexedDB for stored config data
- Use `/admin/settings` to verify configuration state
- Clear IndexedDB to force config re-initialization

**Tool Component Not Rendering:**

- Verify `message.parts` array exists (not `message.content` array)
- Check tool registry in `components/tool-messages/index.ts`
- Ensure tool name matches registry key exactly

**Type Errors:**

- Run `npx tsc --noEmit` to check types without building
- Use `unknown` instead of `any` and narrow types properly
- All data structures should derive from Zod schemas

**API Route Debugging:**

- Server-side tools receive config data as parameters
- Check `configData` is passed from route handler to tool
- Verify environment variables are loaded correctly

**CSS Module Selector Issues:**

- Check if CSS module hash values have changed
- Use dynamic selectors from `lib/tools/yupao/dynamic-selector-utils.ts`
- Test with sample HTML files in `docs/sample-data/`
- Update constants in `lib/tools/yupao/constants.ts` if needed

## Data Flow Patterns

1. **Configuration Loading**: `ConfigInitializer` → `configService.getConfig()` → Components
2. **Smart Replies**: User message → `generateSmartReplyWithLLM()` → Classification → Reply generation
3. **Computer Use**: User action → E2B tools → Desktop interaction → Screenshot/result
4. **Model Selection**: `useModelConfigStore()` → Dynamic provider selection → AI SDK execution
5. **Authentication Flow**: Middleware → Supabase Auth → Session Cookie → Protected Routes
6. **Sync Architecture**: External API → Server-side fetch → Client-side persistence via ConfigService
7. **Docker Deployment**: Local build → GitHub Container Registry → VPS pull and run

## Integration Features

### Brand and Organization Management

- Organization ID to brand name mapping in `lib/constants/organization-mapping.ts`
- Supports dynamic brand synchronization from external APIs
- Brand context available throughout the application via React Context
- Multi-tenant support using React Context

### Duliday Integration

- Server-side data fetching without direct storage access
- Client-side data persistence through the config service
- Progress tracking with real-time updates
- History management in localStorage for audit trails

### Yupao Platform Integration

- Dynamic CSS selector handling for resilient automation
- Exchange WeChat functionality with multi-strategy element finding
- Anti-detection measures integrated
- Test utilities for verifying selector adaptability

### Semantic Release Integration

- **Branches**: `main` (production), `develop` (pre-release), `beta` (pre-release)
- **Commit convention**: Use conventional commits (feat:, fix:, chore:, etc.)
- **Release workflow**: `.github/workflows/release.yml` runs tests before releases
- **Configuration**: `release.config.js` defines the release process

## Important Development Notes

When working with this codebase:

- Always check configuration state before accessing brand/prompt data
- Use the type definitions in `types/config.d.ts` for configuration interfaces
- Follow the two-phase AI pattern for new intelligent features
- Test Chinese input scenarios when modifying desktop automation
- Follow the error formatting patterns established in the codebase
- Use dynamic selectors for web automation to handle CSS module hash changes
- Run type checking with `npx tsc --noEmit` before committing
- Test with multiple AI providers to ensure fallback mechanisms work
- When a test fails, prioritize analyzing the business logic for correctness, rather than modifying the test case to fit faulty logic.
