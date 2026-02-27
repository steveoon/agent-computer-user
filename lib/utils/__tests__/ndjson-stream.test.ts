import { describe, it, expect } from "vitest";
import { ReadableStream } from "stream/web";
import { TextEncoder } from "util";
import { consumeNdjsonStream } from "@/lib/utils/ndjson-stream";

const encoder = new TextEncoder();

const streamFromChunks = (chunks: string[]) =>
  new ReadableStream({
    start(controller) {
      chunks.forEach(chunk => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

describe("consumeNdjsonStream", () => {
  it("returns result on normal stream", async () => {
    const stream = streamFromChunks([
      '{"type":"progress","message":"ok"}\n',
      '{"type":"result","value":42}\n',
    ]);

    const { result, error } = await consumeNdjsonStream<number>(stream.getReader(), data => {
      if (isRecord(data) && data.type === "result" && typeof data.value === "number") {
        return { action: "result", value: data.value };
      }
      return { action: "skip" };
    });

    expect(result).toBe(42);
    expect(error).toBeNull();
  });

  it("handles chunked lines", async () => {
    const stream = streamFromChunks(['{"type":"result","value":', "123}\n"]);

    const { result, error } = await consumeNdjsonStream<number>(stream.getReader(), data => {
      if (isRecord(data) && data.type === "result" && typeof data.value === "number") {
        return { action: "result", value: data.value };
      }
      return { action: "skip" };
    });

    expect(result).toBe(123);
    expect(error).toBeNull();
  });

  it("throws when only error is received", async () => {
    const stream = streamFromChunks(['{"type":"error","error":"boom"}\n']);

    await expect(
      consumeNdjsonStream<string>(stream.getReader(), data => {
        if (isRecord(data) && data.type === "error" && typeof data.error === "string") {
          return { action: "error", message: data.error };
        }
        return { action: "skip" };
      })
    ).rejects.toThrow("boom");
  });

  it("returns result and error when result precedes error", async () => {
    const stream = streamFromChunks([
      '{"type":"result","value":"ok"}\n',
      '{"type":"error","error":"partial"}\n',
    ]);

    const { result, error } = await consumeNdjsonStream<string>(stream.getReader(), data => {
      if (isRecord(data) && data.type === "result" && typeof data.value === "string") {
        return { action: "result", value: data.value };
      }
      if (isRecord(data) && data.type === "error" && typeof data.error === "string") {
        return { action: "error", message: data.error };
      }
      return { action: "skip" };
    });

    expect(result).toBe("ok");
    expect(error?.message).toBe("partial");
  });
});
