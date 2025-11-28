/**
 * Human-in-the-Loop (HITL) Server Utilities
 *
 * Server-only utilities for implementing human confirmation workflow
 * for sensitive tool operations like bash command execution.
 *
 * NOTE: This file imports Node.js modules and should only be used in server components.
 * For client components, import constants from '@/lib/constants/hitl-constants' instead.
 */

import { exec } from "child_process";
import { promisify } from "util";
import { ToolSet, UIMessageStreamWriter, isToolUIPart, getToolName } from "ai";
import type { UIMessage } from "ai";

// Import and re-export constants for convenience in server code
import { APPROVAL, type ApprovalValue } from "@/lib/constants/hitl-constants";
export { APPROVAL, type ApprovalValue };

const execAsync = promisify(exec);

// Dangerous commands blacklist
const DANGEROUS_COMMANDS = [
  "rm -rf /",
  "rm -rf /*",
  "dd if=",
  "mkfs",
  "format",
  ":(){ :|:& };:", // fork bomb
  "> /dev/sda",
  "mv /* /dev/null",
  "chmod -R 777 /",
  "chown -R",
];

/**
 * Check if a command is potentially dangerous
 */
export function isDangerousCommand(command: string): boolean {
  const lowerCommand = command.toLowerCase();
  return DANGEROUS_COMMANDS.some(dangerous => lowerCommand.includes(dangerous.toLowerCase()));
}

/**
 * Execute a bash command locally with safety checks
 * @param command - The bash command to execute
 * @returns The command output or error message
 */
export async function executeBashCommandLocally(command: string): Promise<string> {
  // Safety check: block dangerous commands
  if (isDangerousCommand(command)) {
    return `Error: Dangerous command detected and blocked.\n\nCommand: ${command}\n\nThis command has been blocked for safety reasons.`;
  }

  try {
    // Create a sanitized environment object with only essential variables
    // This prevents sensitive environment variables (API keys, secrets) from being exposed to the child process
    const safeEnv: NodeJS.ProcessEnv = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      LANG: process.env.LANG,
      LC_ALL: process.env.LC_ALL,
      TERM: process.env.TERM,
      TZ: process.env.TZ,
      NODE_ENV: process.env.NODE_ENV,
    };

    const { stdout, stderr } = await execAsync(command, {
      timeout: 30000, // 30 second timeout
      maxBuffer: 1024 * 1024, // 1MB buffer
      encoding: "utf-8",
      env: safeEnv, // Explicitly pass sanitized environment
    });

    if (stderr && !stdout) {
      return `Error output:\n${stderr}`;
    }

    if (stdout && stderr) {
      return `Output:\n${stdout}\n\nWarnings:\n${stderr}`;
    }

    return stdout || "(Command executed successfully with no output)";
  } catch (error) {
    if (error instanceof Error) {
      // Handle timeout
      if (error.message.includes("TIMEOUT")) {
        return `Error: Command timed out after 30 seconds.\n\nCommand: ${command}`;
      }

      // Handle other errors
      return `Error executing command: ${error.message}`;
    }
    return `Error: ${String(error)}`;
  }
}

/**
 * Get list of tool names that require human confirmation
 * Tools without an execute function require confirmation
 */
export function getToolsRequiringConfirmation(tools: ToolSet): string[] {
  return Object.entries(tools)
    .filter(([, tool]) => {
      // Tools without execute function require confirmation
      return typeof (tool as { execute?: unknown }).execute !== "function";
    })
    .map(([name]) => name);
}

/**
 * Type for tool execution functions
 */
type ExecuteFunction<TInput = unknown> = (input: TInput) => Promise<string>;

/**
 * Process tool calls that require human confirmation
 * Executes tools when user confirms, returns error when denied
 */
export async function processToolCalls<TTools extends Record<string, ExecuteFunction>>({
  writer,
  messages,
  executeFunctions,
}: {
  writer: UIMessageStreamWriter;
  messages: UIMessage[];
  executeFunctions: TTools;
}): Promise<UIMessage[]> {
  const lastMessage = messages[messages.length - 1];
  const parts = lastMessage.parts;

  if (!parts || !Array.isArray(parts)) {
    return messages;
  }

  const processedParts = await Promise.all(
    parts.map(async part => {
      // Only process tool UI parts
      if (!isToolUIPart(part)) {
        return part;
      }

      const toolName = getToolName(part);

      // Check if this tool has an execute function and is in output-available state
      if (!(toolName in executeFunctions) || part.state !== "output-available") {
        return part;
      }

      const toolCallId = part.toolCallId;
      let result: string;

      if (part.output === APPROVAL.YES) {
        // User confirmed - execute the tool
        const executeFunc = executeFunctions[toolName as keyof TTools];
        if (executeFunc) {
          try {
            result = await executeFunc(part.input);
          } catch (error) {
            result = `Error executing tool: ${error instanceof Error ? error.message : String(error)}`;
          }
        } else {
          result = "Error: No execute function found for tool";
        }
      } else if (part.output === APPROVAL.NO) {
        // User denied - return error message
        result = "User denied execution of this command";
      } else {
        // Not a confirmation response, return unchanged
        return part;
      }

      // Send the result to the client
      writer.write({
        type: "tool-output-available",
        toolCallId,
        output: result,
      });

      // Return updated part with actual result
      return {
        ...part,
        output: result,
      };
    })
  );

  // Return messages with processed parts
  return [...messages.slice(0, -1), { ...lastMessage, parts: processedParts }];
}

/**
 * Check if a message contains pending tool confirmations
 */
export function hasPendingToolConfirmation(
  message: UIMessage,
  toolsRequiringConfirmation: string[]
): boolean {
  if (!message.parts || !Array.isArray(message.parts)) {
    return false;
  }

  return message.parts.some(part => {
    if (!isToolUIPart(part)) {
      return false;
    }

    const toolName = getToolName(part);
    return toolsRequiringConfirmation.includes(toolName) && part.state === "input-available";
  });
}
