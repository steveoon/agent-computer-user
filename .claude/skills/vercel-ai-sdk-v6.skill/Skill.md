---
name: vercel-ai-sdk-v6
description: Use when implementing AI features in TypeScript/Next.js with Vercel AI SDK v6 (generateText/streamText, tools, structured output, streaming route handlers). Enforces v6 APIs and best practices; prevents hallucinated options.
---

# Purpose
This Skill is the source of truth for implementing AI-related logic with Vercel AI SDK v6 in production codebases (TypeScript/Next.js).

# When to Use (Trigger Conditions)
Use this Skill when the task involves any of the following:
- `generateText` or `streamText`
- Streaming endpoints / stream protocol handling
- Tool calling (function tools) and schema validation
- Structured output generation (schema-constrained JSON)
- Next.js Route Handlers (App Router) for AI endpoints
- Chat UI integration (e.g., tool usage, message handling)
- Refactoring older AI SDK code to v6 patterns
- **Building AI Agents** with `ToolLoopAgent` class
- Agent loop control (`stepCountIs`, custom stop conditions)
- Multi-step tool orchestration workflows
- `createAgentUIStreamResponse` for agent API routes
- Type-safe agent definitions (`InferAgentUIMessage`)

# Non-Negotiable Rules
1. Use only APIs/options shown in `REFERENCE.md` / `snippets/`. If not present, do not guess.
2. If the user appears to be on v5 or earlier, call out version mismatch and propose v6 migration.
3. Prefer type-safe schemas for tools and structured output.
4. For side-effect tools (DB writes, payments, emails), require explicit approval step in the flow.
5. Always consider runtime constraints: Node vs Edge.

# Navigation
- Core reference (APIs & signatures): `REFERENCE.md`
- Best practices & architecture decisions: `PLAYBOOK.md`
- Pre-ship checklist: `CHECKLIST.md`
- Copy/paste templates: `snippets/`
- Curated official links: `resources/links.md`

# “Good Output” Definition
- Correct v6 imports and usage
- Clear separation of concerns: prompt -> tools -> execution -> output
- Deterministic structured outputs when the result is consumed by code
- Robust error handling, timeouts, and safe defaults
