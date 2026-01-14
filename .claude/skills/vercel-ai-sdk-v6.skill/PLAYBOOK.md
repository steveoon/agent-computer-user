# Engineering Playbook (AI SDK v6)

## A) Decision Tree
1) Do you need streaming UX?
- Yes -> prefer streamText
- No -> prefer generateText

2) Do you need deterministic machine-readable output?
- Yes -> structured output + schema
- No -> plain text is acceptable

3) Do you need external actions/data?
- Yes -> tool calling with schemas
- No -> keep it pure

## B) Tool Calling Patterns
- Always schema-validate inputs
- Use allowlists for tool exposure
- For side effects:
  - require user confirmation OR
  - require policy-based approval step
  
## B.1 Tool Calling as a User-Visible Process

Tool execution is not a black box.

### UI principles
- Users should see:
  - Tool name
  - Current state (pending, approval-requested, running, completed, error)
  - Tool input and output (when safe to display)
- Side-effect tools MUST be visible and explainable

### Approval UX
- Approval requests must:
  - Explain what the tool will do
  - Allow explicit approve/deny actions
- Silent auto-approval is discouraged except for clearly safe, read-only tools

Tool transparency improves trust, debuggability, and safety.


## C) Prompting Patterns
- Keep system instructions short and testable
- Put business rules in schema/tool validation where possible
- Use examples sparingly; keep them canonical and version-accurate

## C.1 Experimental API Usage Policy

Experimental APIs (e.g. structured object streaming hooks) are allowed only when:

- The UX explicitly reflects experimental behavior
- Errors and partial results are handled gracefully
- The user can interrupt or stop generation

Production usage requires:
- Clear fallback behavior
- No silent failure modes
- No assumption of long-term API stability


## D) Reliability & Observability
- Add timeouts to tool calls
- Add structured logs:
  - model name, latency, token usage (if available)
  - tool name, args, result size, errors
- Add retries only when safe (idempotent tools)

## E) Security
- Never hardcode secrets
- For user-provided content: sanitize/validate before tool execution
- Avoid tool calls that can exfiltrate sensitive data

## F) Agent Loop Safety & Termination

Agent-style tool loops must be bounded.

### Required safeguards
- Maximum iteration count
- Clear termination condition when:
  - No tool is applicable
  - Tool results do not change state meaningfully
- Explicit exit when approval is denied

### Observability
- Log each loop iteration:
  - Tool name
  - Input
  - Output or error
- Avoid infinite or self-reinforcing loops

---

## G) Building Agents with ToolLoopAgent

### When to use ToolLoopAgent
- Reusable AI configurations across multiple endpoints
- Multi-step tool orchestration (agent loops)
- Type-safe agent definitions with consistent behavior
- Complex workflows requiring tool chaining

### Agent Design Principles

#### 1) Single-Purpose Agents
- Create focused agents for specific tasks (code review, customer support, research)
- Avoid "everything" agents with too many tools/responsibilities
- Each agent should have a clear domain boundary

#### 2) Instruction Design
- Write clear, testable system instructions
- Include explicit rules and constraints
- Specify tool usage order/priority when relevant
- Keep instructions concise but complete

#### 3) Tool Guidance
- Document when and how to use each tool in instructions
- Establish tool usage sequences (e.g., "search first, then analyze")
- Include cross-referencing requirements for research tasks

### Stop Condition Strategies

- Default: `stepCountIs(20)` - 20 steps maximum
- Each step = one generation (text or tool call)
- Custom conditions: check for specific text markers, tool success, or state changes
- Combine multiple conditions with array syntax

### Agent Composition Patterns

| Pattern | Use Case |
|---------|----------|
| Sequential | Pipeline: research → analysis → report |
| Conditional routing | Classifier → specialized agent |
| Parallel | Independent subtasks |

### API Route Guidelines

- Define agent outside route handler (reusable)
- Use `createAgentUIStreamResponse` for streaming
- Preprocess messages if context injection needed
- Export `InferAgentUIMessage` type for client type safety

For code examples, see `snippets/tool-loop-agent.ts`.
