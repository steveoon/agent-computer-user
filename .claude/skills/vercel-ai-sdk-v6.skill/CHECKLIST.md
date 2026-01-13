# Pre-Ship Checklist (AI SDK v6)

## Correctness
- [ ] Confirm v6 usage patterns (imports, function names, flow)
- [ ] No invented options/helpers beyond this skill's reference/snippets
- [ ] Node vs Edge runtime explicitly considered

## Tools
- [ ] Tools have schemas
- [ ] Tool inputs validated
- [ ] Side-effect tools gated (approval/allowlist)
- [ ] Tool errors handled

## Tool UI & Approval
- [ ] UI renders `message.parts`, not only a single text content
- [ ] Tool UI parts display tool name and execution state
- [ ] Tool input/output or error are visible when applicable
- [ ] Approval-required tools present Approve/Deny actions
- [ ] Approval responses correctly call `addToolApprovalResponse` with matching id

## Structured Output
- [ ] Schema defined and enforced
- [ ] Output validated
- [ ] Downstream code handles validation failures

## Structured Object Streaming
- [ ] Structured object generation is schema-bound
- [ ] UI renders data from `object`, not parsed text
- [ ] Loading and error states are visible
- [ ] User can interrupt generation via stop/cancel
- [ ] Object access is null-safe and validated

## Streaming
- [ ] Streaming response is stable
- [ ] Partial output handling is correct
- [ ] Stream error path is graceful

## Security
- [ ] No secrets in code
- [ ] User input sanitized where needed
- [ ] Sensitive operations protected

## Agent Loop Safety
- [ ] Agent loop has a maximum iteration limit
- [ ] Loop terminates when no meaningful tool action remains
- [ ] Denied approvals terminate or redirect the loop safely
- [ ] Each loop iteration is logged for debugging
