/**
 * NDJSON 流消费器
 *
 * 提供统一的 ReadableStream NDJSON 解析：缓冲、行切分、JSON 解析、错误收集
 * 通过回调让调用方决定每条消息的处理方式
 */

export type NdjsonAction<T> =
  | { action: "result"; value: T }
  | { action: "error"; message: string }
  | { action: "skip" };

export interface NdjsonConsumeResult<T> {
  result: T;
  error: Error | null;
}

/**
 * 消费 NDJSON 流并返回最终结果
 *
 * @param reader  ReadableStream reader
 * @param onMessage  每行 JSON 解析后的回调，返回动作指令
 * @returns result + 可选 error（由调用方决定是否容忍）
 * @throws 未收到任何 result 时抛出
 */
export async function consumeNdjsonStream<T>(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onMessage: (data: unknown) => NdjsonAction<T>
): Promise<NdjsonConsumeResult<T>> {
  const decoder = new TextDecoder();
  let buffer = "";
  let result: T | null = null;
  let streamError: Error | null = null;

  const processLine = (line: string): void => {
    if (!line.trim()) return;

    let data: unknown;
    try {
      data = JSON.parse(line);
    } catch {
      console.warn("NDJSON 解析失败:", line.slice(0, 120));
      return;
    }

    const action = onMessage(data);
    if (action.action === "result") {
      result = action.value;
    } else if (action.action === "error") {
      if (!streamError) {
        streamError = new Error(action.message);
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      processLine(line);
    }
  }

  if (buffer.trim()) {
    processLine(buffer);
  }

  if (result === null) {
    if (streamError) throw streamError;
    throw new Error("未收到同步结果数据");
  }
  return { result, error: streamError };
}
