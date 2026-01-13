# Repository Guidelines

## Project Structure & Module Organization
- `app/` holds Next.js 15 route groups, layouts, server actions, and MCP entry points; add new surfaces under descriptive segments.
- `components/` contains UI primitives; `hooks/` holds state/effect hooks; shared services, registries, and stores live in `lib/`.
- Platform wiring stays in `configs/`, `drizzle/`, `db/`, and `scripts/`—avoid product logic there.
- Tests go in `__tests__/` for integration suites or colocated `*.test.ts(x)` files; assets belong in `public/`.

## Build, Test, and Development Commands
- `pnpm dev`: run the Next.js dev server (Turbopack).
- `pnpm agent:start`: start multi-agent flows; use `pnpm agent:list` and `pnpm agent:logs <name>` for inspection.
- `pnpm lint` and `pnpm format`: enforce eslint and Prettier rules (run before committing).
- `pnpm test`, `pnpm test:run`, `pnpm test:coverage`: run Vitest suites and coverage.
- `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:push`, `pnpm db:init`: Drizzle schema lifecycle.

## Coding Style & Naming Conventions
- TypeScript throughout; use 2-space indentation.
- React components use PascalCase filenames; hooks follow `useThing`; server utilities use `lib/server-*.ts`.
- Drizzle schemas live in `drizzle/schema/*.ts`.
- Tailwind utility chains should read layout → color → motion; use `class-variance-authority` for stateful variants.
- 尽量不使用类型断言，确保类型安全。

## Testing Guidelines
- Testing stack: Vitest + Testing Library; setup in `vitest.setup.ts`.
- Name tests `*.test.ts` / `*.test.tsx`; integration suites under `__tests__/`.
- Run targeted suites with `pnpm test --runInBand __tests__/multi-agent.test.ts`.
- 改动完成后尽量运行 `pnpm lint` 或 `npx tsc --noEmit`，确保没有类型错误。

## Commit & Pull Request Guidelines
- Use conventional commits (e.g., `feat:`, `fix:`, `chore(release): 1.14.0 [skip ci]`), include scope for automation/DB changes.
- PRs should include business context, testing output, agent or DB impacts, and doc updates when behavior or commands change.

## Security & Configuration
- Keep secrets in `.env.local` or remote stores; do not commit credentials.
- Validate MCP changes with `pnpm test:mcp-connection` before shipping.
