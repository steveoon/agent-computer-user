import type { UIMessage } from "ai";
import { ReplyPolicyConfigSchema, type ReplyPolicyConfig } from "@/types/reply-policy";
import type {
  ReplyPolicyDraftRuntimeContext,
  ReplyPolicyPatchChange,
} from "@/types/tool-common";

interface CreateReplyPolicyDraftContextOptions {
  initialPolicy?: ReplyPolicyConfig;
  historyMessages: UIMessage[];
  modelVisibleMessages: UIMessage[];
}

interface ReadToolOutput {
  success?: boolean;
  currentPolicy?: unknown;
}

interface SaveToolOutput {
  success?: boolean;
  policy?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isValidArrayIndex(segment: string): boolean {
  if (!/^\d+$/.test(segment)) {
    return false;
  }
  const index = Number(segment);
  return Number.isSafeInteger(index) && index >= 0;
}

function clonePolicy(policy: ReplyPolicyConfig): ReplyPolicyConfig {
  return structuredClone(policy);
}

function extractToolOutput(part: unknown, toolName: string): unknown {
  if (!isRecord(part)) {
    return undefined;
  }

  if (part.type !== `tool-${toolName}` || part.state !== "output-available") {
    return undefined;
  }

  return part.output;
}

function parseReadOutput(output: unknown): ReplyPolicyConfig | null {
  if (!isRecord(output)) {
    return null;
  }

  const candidate: ReadToolOutput = output;
  if (!candidate.success) {
    return null;
  }

  const validation = ReplyPolicyConfigSchema.safeParse(candidate.currentPolicy);
  if (!validation.success) {
    return null;
  }

  return validation.data;
}

function parseSaveOutput(output: unknown): ReplyPolicyConfig | null {
  if (!isRecord(output)) {
    return null;
  }

  const candidate: SaveToolOutput = output;
  if (!candidate.success) {
    return null;
  }

  const validation = ReplyPolicyConfigSchema.safeParse(candidate.policy);
  if (!validation.success) {
    return null;
  }

  return validation.data;
}

function parseAskOutput(output: unknown): ReplyPolicyPatchChange | null {
  if (!isRecord(output)) {
    return null;
  }

  const moduleValue = output.module;
  if (typeof moduleValue !== "string" || moduleValue.trim().length === 0) {
    return null;
  }

  const keepCurrent = output.keepCurrent === true;

  return {
    module: moduleValue,
    value: output.value,
    keepCurrent,
    displayValue: typeof output.displayValue === "string" ? output.displayValue : undefined,
  };
}

function setValueAtPath(target: unknown, path: string, value: unknown): boolean {
  const segments = path
    .split(".")
    .map(segment => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return false;
  }

  let cursor: unknown = target;

  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];

    if (Array.isArray(cursor)) {
      if (!isValidArrayIndex(segment)) {
        return false;
      }
      const index = Number(segment);
      if (index >= cursor.length) {
        return false;
      }
      cursor = cursor[index];
      continue;
    }

    if (!isRecord(cursor) || !(segment in cursor)) {
      return false;
    }

    cursor = cursor[segment];
  }

  const leaf = segments[segments.length - 1];

  if (Array.isArray(cursor)) {
    if (!isValidArrayIndex(leaf)) {
      return false;
    }
    const leafIndex = Number(leaf);
    if (leafIndex >= cursor.length) {
      return false;
    }
    cursor[leafIndex] = value;
    return true;
  }

  if (!isRecord(cursor) || !(leaf in cursor)) {
    return false;
  }

  cursor[leaf] = value;
  return true;
}

function hasServedFullPolicy(messages: UIMessage[]): boolean {
  for (const message of messages) {
    if (!Array.isArray(message.parts)) {
      continue;
    }

    for (const part of message.parts) {
      const readOutput = parseReadOutput(extractToolOutput(part, "reply_policy_read"));
      if (readOutput) {
        return true;
      }
    }
  }

  return false;
}

function rebuildDraftFromHistory(
  initialPolicy: ReplyPolicyConfig | undefined,
  historyMessages: UIMessage[]
): {
  currentPolicy: ReplyPolicyConfig | null;
  draftPolicy: ReplyPolicyConfig | null;
  revision: number;
} {
  let currentPolicy = initialPolicy ? clonePolicy(initialPolicy) : null;
  let draftPolicy = initialPolicy ? clonePolicy(initialPolicy) : null;
  let revision = 0;

  for (const message of historyMessages) {
    if (!Array.isArray(message.parts)) {
      continue;
    }

    for (const part of message.parts) {
      const readOutput = parseReadOutput(extractToolOutput(part, "reply_policy_read"));
      if (readOutput) {
        currentPolicy = clonePolicy(readOutput);
        draftPolicy = clonePolicy(readOutput);
        revision = 0;
        continue;
      }

      const askOutput = parseAskOutput(extractToolOutput(part, "reply_policy_ask"));
      if (askOutput) {
        if (!askOutput.keepCurrent) {
          if (draftPolicy === null) {
            if (currentPolicy) {
              draftPolicy = clonePolicy(currentPolicy);
            } else {
              continue;
            }
          }

          const applied = setValueAtPath(draftPolicy, askOutput.module, askOutput.value);
          if (applied) {
            revision += 1;
          }
        }
        continue;
      }

      const saveOutput = parseSaveOutput(extractToolOutput(part, "reply_policy_save"));
      if (saveOutput) {
        currentPolicy = clonePolicy(saveOutput);
        draftPolicy = clonePolicy(saveOutput);
        revision = 0;
      }
    }
  }

  return {
    currentPolicy,
    draftPolicy,
    revision,
  };
}

export function createReplyPolicyDraftContext({
  initialPolicy,
  historyMessages,
  modelVisibleMessages,
}: CreateReplyPolicyDraftContextOptions): ReplyPolicyDraftRuntimeContext {
  const rebuilt = rebuildDraftFromHistory(initialPolicy, historyMessages);
  let currentPolicy = rebuilt.currentPolicy;
  let draftPolicy = rebuilt.draftPolicy;
  let revision = rebuilt.revision;
  let fullPolicyServed = hasServedFullPolicy(modelVisibleMessages);

  return {
    hasServedFullPolicy: () => fullPolicyServed,
    markFullPolicyServed: () => {
      fullPolicyServed = true;
    },
    getCurrentPolicy: () => (currentPolicy ? clonePolicy(currentPolicy) : null),
    getDraftPolicy: () => (draftPolicy ? clonePolicy(draftPolicy) : null),
    getRevision: () => revision,
    applyPatch: (patch: ReplyPolicyPatchChange) => {
      if (!patch.module || patch.module.trim().length === 0) {
        return {
          applied: false,
          reason: "module 不能为空",
          revision,
        };
      }

      if (patch.keepCurrent) {
        return {
          applied: false,
          reason: "keepCurrent=true，保持原值",
          revision,
        };
      }

      if (draftPolicy === null) {
        if (currentPolicy) {
          draftPolicy = clonePolicy(currentPolicy);
        } else {
          return {
            applied: false,
            reason: "当前没有可编辑的策略草稿",
            revision,
          };
        }
      }

      const applied = setValueAtPath(draftPolicy, patch.module, patch.value);
      if (!applied) {
        return {
          applied: false,
          reason: `无效路径: ${patch.module}`,
          revision,
        };
      }

      revision += 1;
      return {
        applied: true,
        revision,
      };
    },
    commitPolicy: (policy: ReplyPolicyConfig) => {
      currentPolicy = clonePolicy(policy);
      draftPolicy = clonePolicy(policy);
      revision = 0;
    },
  };
}
