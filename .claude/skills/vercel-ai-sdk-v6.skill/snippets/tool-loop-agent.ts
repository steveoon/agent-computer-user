import {
  ToolLoopAgent,
  createAgentUIStreamResponse,
  InferAgentUIMessage,
  Output,
  stepCountIs,
  tool,
} from "ai";
import { z } from "zod";

type AgentConfig = ConstructorParameters<typeof ToolLoopAgent>[0];
const model = "__MODEL__" as unknown as AgentConfig["model"];

const weatherTool = tool({
  description: "Get the weather for a location.",
  inputSchema: z.object({
    location: z.string().describe("City and state"),
  }),
  execute: async ({ location }) => ({
    location,
    temperature: 72,
    condition: "sunny",
  }),
});

const runCommandTool = tool({
  description: "Run a shell command (requires approval).",
  inputSchema: z.object({
    command: z.string().describe("Shell command to execute"),
  }),
  needsApproval: true,
  execute: async ({ command }) => ({
    ok: true,
    output: `Executed: ${command}`,
  }),
});

export const assistantAgent = new ToolLoopAgent({
  model,
  instructions: "You are a helpful assistant that cites tool results.",
  tools: {
    weather: weatherTool,
    run_command: runCommandTool,
  },
  toolChoice: {
    type: "tool",
    toolName: "weather",
  },
  stopWhen: [
    stepCountIs(10),
    ({ steps }) => steps.some(step => step.finishReason === "stop"),
  ],
  output: Output.object({
    schema: z.object({
      summary: z.string(),
      recommendation: z.string(),
    }),
  }),
});

export type AssistantUIMessage = InferAgentUIMessage<typeof assistantAgent>;

export const requiredToolAgent = new ToolLoopAgent({
  model,
  instructions: "Always call a tool before responding.",
  tools: {
    weather: weatherTool,
  },
  toolChoice: "required",
  stopWhen: stepCountIs(5),
});

export const noToolAgent = new ToolLoopAgent({
  model,
  instructions: "Do not use tools. Respond directly.",
  tools: {
    weather: weatherTool,
  },
  toolChoice: "none",
});

export async function generateWithAgent(prompt: string) {
  const result = await assistantAgent.generate({ prompt });
  return { text: result.text, output: result.output };
}

export async function streamWithAgent(prompt: string) {
  const stream = await assistantAgent.stream({ prompt });
  for await (const chunk of stream.textStream) {
    process.stdout.write(chunk);
  }
}

export async function POST(req: Request) {
  const { messages } = await req.json();
  return createAgentUIStreamResponse({
    agent: assistantAgent,
    uiMessages: messages,
  });
}
