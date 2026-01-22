# Vercel AI SDK v6 Reference

## Coverage Promise
This file contains only API facts/patterns that are safe to reuse.
If something is not covered here, do NOT guess.

---

## 1) Core Text Generation
### Use cases
- `generateText`: non-interactive generation (background jobs, batch tasks, one-shot)
- `streamText`: interactive streaming (chat UX, progressive rendering)

### Required items to confirm when coding
- Which model/provider is used
- Whether streaming is required
- Whether structured output is required
- Whether tool calling is required

---

## 2) Tools / Tool Calling
### Rules
- Every tool must have: name, description (recommended), and input schema
- Validate tool inputs (schema) before executing
- For side-effect tools, implement an approval gate (human-in-the-loop or explicit allowlist)

### Tool design heuristics
- Keep tools small and single-purpose
- Prefer deterministic return types (avoid ambiguous free-form text)
- Log tool invocations and failures for debugging

---

## 3) Structured Output
### When to use
- When downstream code consumes the result (DB writes, UI rendering, workflow transitions)
- When you need stable JSON shape and validation

### Rules
- Prefer schema-constrained output over "please output JSON" prompts
- Always validate the returned structure

---

## 4) Next.js Route Handlers (App Router)
### Route Handler guidance
- Keep endpoint minimal: parse request -> call AI SDK -> return response
- Separate prompt construction and tool definitions from handler glue
- Ensure correct runtime (Node vs Edge) is explicitly considered

---

## 5) Streaming
### Streaming endpoint guidance
- Use stream-based response patterns for chat UX
- Ensure errors are handled without breaking the stream unexpectedly
- Provide graceful fallback or final error message

---

## 6) UI Message Parts & Tool UI Facts

In AI SDK v6 UI integrations, messages may expose structured UI parts rather than a single text blob.

### Message parts
- Messages can contain `message.parts[]`
- Each part represents a renderable unit

Common part types:
- Text part:
  - `part.type === "text"`
  - Render using `part.text`
- Tool UI part:
  - Use `isToolUIPart(part)` to detect
  - Tool UI parts expose tool-related state and payload

### Tool UI part fields (facts)
Tool UI parts may expose:
- `part.state`: lifecycle state (e.g. approval-requested, running, completed, error)
- `part.input`: validated tool input (if available)
- `part.output`: tool execution result (if completed)
- `part.errorText`: error message (if failed)

UI code should render based on `part.state`, not assume synchronous execution.

---

## 7) Tool Approval Protocol (UI-driven)

Some tools require explicit approval before execution.

### Approval lifecycle
- When a tool requires approval:
  - The tool UI part will enter `state === "approval-requested"`
  - An approval payload is exposed via `part.approval.id`

### UI responsibility
- The UI must present a clear approval choice to the user:
  - Approve
  - Deny (optionally with a reason)

### Responding to approval
- The UI must call:
  - `addToolApprovalResponse({ id, approved, reason? })`
- The `id` MUST match `part.approval.id`
- Tool execution will resume or terminate based on the approval response

Approval handling is part of the application contract and must not be skipped or auto-approved silently.

---

## 8) Structured Object Streaming (experimental)

The UI may consume structured objects streamed from the model.

### Hook characteristics
- Implemented via `experimental_useObject`
- Requires a schema to be provided up-front
- The streamed result is exposed as a structured `object`, not free-form text

### UI contract
- The UI renders data from `object`
- Loading, error, and stop states must be handled explicitly
- `stop()` may be called by the user to terminate generation early

### Stability note
This API is experimental:
- Use only in controlled or UI-driven flows
- Provide clear error handling and user feedback
- Do not assume backward compatibility

---

## 9) ToolLoopAgent (Agent Class)

Encapsulates LLM configuration, tools, and behavior into reusable agent components.

### Import
`ToolLoopAgent`, `tool`, `stepCountIs`, `Output`, `createAgentUIStreamResponse`, `InferAgentUIMessage` from `'ai'`

### Constructor Options

| Option | Type | Description |
|--------|------|-------------|
| `model` | `string \| LanguageModel` | Model identifier (Gateway or Provider format) |
| `instructions` | `string` | System prompt defining agent behavior |
| `tools` | `Record<string, Tool>` | Available tools for the agent |
| `toolChoice` | `ToolChoice` | `'auto'` (default) / `'required'` / `'none'` / `{ type: 'tool', toolName }` |
| `stopWhen` | `StopCondition[]` | Loop termination conditions (default: `stepCountIs(20)`) |
| `output` | `Output` | Structured output schema via `Output.object({ schema })` |

### Agent Methods
- `agent.generate({ prompt })` → `{ text, output }` (one-shot)
- `agent.stream({ prompt })` → `{ textStream }` (streaming)

### API Route Helper
- `createAgentUIStreamResponse({ agent, messages })` → `Response`

### Type Inference
- `InferAgentUIMessage<typeof agent>` → UIMessage type for client

### Loop Termination Triggers
1. Finish reason other than `tool-calls` returned
2. Tool without `execute` function invoked
3. Tool requiring approval called
4. Stop condition met

For code examples, see `snippets/tool-loop-agent.ts`.

---

## 10) Version boundary
- This skill is for AI SDK v6 only.
- If user code resembles older versions, propose migration.
