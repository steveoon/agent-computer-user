# Repository Guidelines

## Project Structure & Module Organization
- `app/` contains Next.js 15 route groups, layouts, server actions, and MCP entry points; add new surfaces under descriptive segment folders to keep routing explicit.
- Presentation logic lives under `components/` (UI primitives) and `hooks/` (state + effects). Cross-cutting services, model registries, and stores sit in `lib/`.
- Platform wiring—`configs/`, `drizzle/`, `db/`, and `scripts/`—covers feature flags, schema migrations, seeds, and automation (multi-agent, release, deploy). Avoid mixing product logic in these directories.
- Tests belong in `__tests__/` for integration suites or colocated `*.test.ts(x)` files for focused coverage. Static assets stay in `public/`.

## Architecture Snapshot
- Multi-provider AI orchestration lives under `lib/model-registry/` and `lib/services/`, enabling Anthropic computer-use, Qwen replies, OpenRouter, and Google providers through AI SDK adapters.
- Zustand stores plus LocalForage persistence coordinate configurable brand/system/reply prompts; review `lib/services/config.service.ts` before changing global state flows.
- Desktop automation uses the E2B desktop agent, with MCP browser control and multi-brand recruitment scenarios outlined in `docs/guides/`.

## Build, Test & Development Commands
- Core loop: `pnpm dev` (Turbopack) and `pnpm agent:start` (spawns agents after dependency checks). Use `pnpm agent:list` / `pnpm agent:logs <name>` for inspection.
- Quality gates: `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm test:run`, and `pnpm test:coverage`. UI debugging is available via `pnpm test:ui`.
- Database lifecycle: `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:push`, `pnpm db:init`. Run `pnpm test:mcp-connection` before shipping MCP protocol changes.
- Deploy parity: `docker compose -f docker-compose.local.yml up -d` for ARM64 dev, `docker compose -f docker-compose.prod.yml up -d` for production parity.

## Coding Style & Naming Conventions
- TypeScript across the repo with 2-space indentation. Export explicit types for anything shared beyond a file boundary.
- React components use PascalCase filenames; server utilities follow `lib/server-*.ts`, hooks use `useThing`, and Drizzle schemas stay in `drizzle/schema/*.ts`.
- Tailwind utility chains should read from layout → color → motion; reach for `class-variance-authority` when stateful variants appear.
- Always run `pnpm lint --fix` and `pnpm format` before committing to align with `eslint.config.mjs` and Prettier defaults.

## Testing Guidelines
- Vitest + Testing Library bootstrap via `vitest.setup.ts`; keep DOM helpers and mocks under `__mocks__/` to avoid duplication.
- Name files `*.test.ts` / `*.test.tsx`; integration specs housed in `__tests__/` help `pnpm test --runInBand __tests__/multi-agent.test.ts` stay predictable.
- Maintain meaningful coverage for new surfaces (logic, hooks, multi-agent commands). Keep generated `coverage/` artifacts untracked unless debugging CI.

## Commit & Pull Request Guidelines
- Use conventional commits so semantic-release can bump versions (`feat:`, `fix:`, `chore(release): 1.14.0 [skip ci]`). Include scope when touching automation or DB layers.
- PRs should document: business context, testing output (command snippets or screenshots), database/agent impacts, and links to relevant docs.
- Update `README.md`, `docs/`, or `CLAUDE.md` when behavior, commands, or architecture primitives change; keep AGENTS.md synchronized.

## Multi-Agent & Deployment Ops
- `scripts/multi-agent.sh` manages isolated browser profiles with automatic port assignment. Typical flows: `pnpm agent:add zhipin --count 2`, `pnpm agent:start`, `pnpm agent:update -- --skip-install`.
- Prereqs (`jq`, `curl`, `lsof`, Chrome) are auto-validated; investigate failures with `pnpm agent:logs <name> chrome`.
- After code pushes on a host, run `pnpm agent:update` to stop running agents, pull latest main/develop, reinstall, rebuild, and restart the original set automatically.

## Security & Configuration Tips
- Secrets stay in `.env.local`, Docker overrides, or remote secret stores; reference usage through `next.config.ts` and `drizzle.config.ts` only.
- Use the Supabase/Postgres credentials exposed via `db/` helpers; never commit real keys or generated Drizzle migrations containing secrets.
- Before releases, run `docker compose -f docker-compose.local.yml up -d` plus `pnpm agent:status` to confirm both web and agent stacks are healthy.
