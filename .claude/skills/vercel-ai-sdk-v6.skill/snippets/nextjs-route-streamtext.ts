import { streamText } from "ai";
// __PROVIDER_IMPORT__

type StreamTextModel = Parameters<typeof streamText>[0]["model"];
const model = "__MODEL__" as unknown as StreamTextModel;

export const runtime = "nodejs";
export const maxDuration = 30;

type ChatBody = {
  prompt: string;
  system?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as ChatBody | null;
  if (!body?.prompt) {
    return new Response("Invalid JSON", { status: 400 });
  }

  const result = streamText({
    model,
    system: body.system,
    prompt: body.prompt,
    onChunk({ chunk }) {
      if (chunk.type === "text-delta") {
        process.stdout.write(chunk.text);
      }
    },
    onError({ error }) {
      console.error("streamText error:", error);
    },
    onFinish({ finishReason, usage }) {
      console.log("streamText finished:", finishReason, usage);
    },
    onStepFinish({ text, toolCalls, toolResults, finishReason }) {
      console.log("step finished:", finishReason, text);
      if (toolCalls.length || toolResults.length) {
        console.log("tools:", { toolCalls, toolResults });
      }
    },
  });

  return result.toTextStreamResponse();
}

export async function debugFullStream(prompt: string) {
  const result = streamText({
    model,
    prompt,
  });

  for await (const part of result.fullStream) {
    switch (part.type) {
      case "start":
      case "start-step":
      case "text-start":
      case "text-end":
      case "reasoning-start":
      case "reasoning-end":
      case "finish-step":
      case "finish":
      case "abort":
        break;
      case "text-delta":
      case "reasoning-delta":
        process.stdout.write(part.text);
        break;
      case "tool-input-delta":
        process.stdout.write(part.delta);
        break;
      case "tool-call":
      case "tool-result":
      case "tool-error":
      case "tool-output-denied":
      case "source":
      case "file":
      case "tool-approval-request":
      case "error":
      case "raw":
        break;
    }
  }
}

export async function consumeTextStream(prompt: string) {
  const result = streamText({
    model,
    prompt,
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }
}
