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

// ============================================
// Pattern: Research Agent with Tool Guidance
// ============================================
const searchTool = tool({
  description: "Search the web for information.",
  inputSchema: z.object({
    query: z.string().describe("Search query"),
  }),
  execute: async ({ query }) => ({
    results: [`Result for: ${query}`],
  }),
});

export const researchAgent = new ToolLoopAgent({
  model,
  instructions: `You are a research assistant.

When researching:
1. Start with a broad search to understand the topic
2. Cross-reference multiple sources
3. Cite sources when presenting information
4. If information conflicts, present both viewpoints`,
  tools: { search: searchTool },
  stopWhen: stepCountIs(15),
});

// ============================================
// Pattern: Customer Support Agent
// ============================================
const checkOrderTool = tool({
  description: "Check order status by order ID.",
  inputSchema: z.object({
    orderId: z.string(),
  }),
  execute: async ({ orderId }) => ({
    orderId,
    status: "shipped",
    eta: "2024-01-15",
  }),
});

const createTicketTool = tool({
  description: "Create a support ticket (requires approval).",
  inputSchema: z.object({
    subject: z.string(),
    description: z.string(),
    priority: z.enum(["low", "medium", "high"]),
  }),
  needsApproval: true,
  execute: async (input) => ({
    ticketId: `TICKET-${Date.now()}`,
    ...input,
  }),
});

export const supportAgent = new ToolLoopAgent({
  model,
  instructions: `You are a customer support specialist.

Rules:
- Never promise refunds without checking policy
- Always be empathetic and professional
- If unsure, say so and offer to escalate
- Keep responses concise and actionable`,
  tools: {
    checkOrder: checkOrderTool,
    createTicket: createTicketTool,
  },
  stopWhen: [
    stepCountIs(10),
    ({ steps }) => steps.some((s) => s.finishReason === "stop"),
  ],
});

export type SupportAgentUIMessage = InferAgentUIMessage<typeof supportAgent>;

// ============================================
// Pattern: Analysis Agent with Structured Output
// ============================================
export const analysisAgent = new ToolLoopAgent({
  model,
  instructions: "Analyze the provided content and extract key insights.",
  output: Output.object({
    schema: z.object({
      sentiment: z.enum(["positive", "neutral", "negative"]),
      summary: z.string().describe("Brief summary of the content"),
      keyPoints: z.array(z.string()).describe("Main points extracted"),
      actionItems: z.array(z.string()).optional(),
    }),
  }),
  stopWhen: stepCountIs(5),
});

export async function analyzeContent(content: string) {
  const { output } = await analysisAgent.generate({
    prompt: `Analyze this content: ${content}`,
  });
  return output; // Typed as { sentiment, summary, keyPoints, actionItems? }
}
