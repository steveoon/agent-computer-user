import { createOpenRouter, type OpenRouterProvider } from "@openrouter/ai-sdk-provider";

/**
 * 自定义 OpenRouter provider
 * 基于官方 @openrouter/ai-sdk-provider 包
 * 为某些模型（如 Kimi K2）提供特殊处理
 */

// 创建自定义的 fetch 函数来拦截和修改响应
function createCustomFetch(modelId: string): typeof fetch {
  // 只对 Kimi K2 模型进行处理
  if (!modelId.includes("kimi-k2")) {
    return fetch;
  }

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await fetch(input, init);

    // 只处理流式响应
    if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream")) {
      return response;
    }

    // 创建转换流
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const transformedStream = new ReadableStream({
      async start(controller) {
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            if (buffer) {
              controller.enqueue(encoder.encode(buffer));
            }
            controller.close();
            break;
          }

          // 解码数据
          const text = decoder.decode(value, { stream: true });
          buffer += text;

          // 按行处理
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // 保留最后一行（可能不完整）

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const jsonStr = line.slice(6);

              // 跳过特殊消息
              if (jsonStr.trim() === "[DONE]" || !jsonStr.trim()) {
                controller.enqueue(encoder.encode(line + "\n"));
                continue;
              }

              try {
                const data = JSON.parse(jsonStr);

                // 修复 tool_calls 中的 type 字段
                if (data.choices?.[0]?.delta?.tool_calls) {
                  data.choices[0].delta.tool_calls = data.choices[0].delta.tool_calls.map(
                    (toolCall: unknown) => {
                      const tc = toolCall as Record<string, unknown>;
                      if (tc.type === "") {
                        return { ...tc, type: "function" };
                      }
                      return tc;
                    }
                  );

                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n`));
                } else {
                  controller.enqueue(encoder.encode(line + "\n"));
                }
              } catch {
                // 解析失败，原样输出
                controller.enqueue(encoder.encode(line + "\n"));
              }
            } else {
              // 非数据行，原样输出
              controller.enqueue(encoder.encode(line + "\n"));
            }
          }
        }
      },
    });

    return new Response(transformedStream, {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    });
  };
}

/**
 * 扩展的 Provider 接口，包含 AI SDK 要求的所有方法
 */
interface ExtendedProvider extends OpenRouterProvider {
  textEmbeddingModel(modelId: string): never;
  imageModel(modelId: string): never;
}

/**
 * 创建自定义的 OpenRouter provider
 * 使用官方包，并为特定模型提供自定义处理
 */
export function createCustomOpenRouter(config: {
  apiKey: string | undefined;
  baseURL?: string;
}): ExtendedProvider {
  // 基础配置
  const baseConfig = {
    apiKey: config.apiKey || "",
    baseURL: config.baseURL || "https://openrouter.ai/api/v1",
  };

  // 创建默认的 OpenRouter provider 实例作为基础
  const defaultProvider = createOpenRouter(baseConfig);

  // 创建代理来拦截模型调用
  return new Proxy(defaultProvider, {
    get(target, prop: string | symbol): unknown {
      if (prop === "languageModel" || prop === "chat" || prop === "completion") {
        return (modelId: string) => {
          // 对于 Kimi K2，使用自定义 fetch
          const customFetch = modelId.includes("kimi-k2") ? createCustomFetch(modelId) : undefined;

          // 创建配置了自定义 fetch 的 provider
          const provider = createOpenRouter({
            ...baseConfig,
            fetch: customFetch,
          });

          // 根据方法名调用相应的方法
          if (prop === "chat") {
            return provider.chat(modelId);
          } else if (prop === "completion") {
            return provider.completion(modelId);
          } else {
            return provider.languageModel(modelId);
          }
        };
      }

      // OpenRouter 不支持 textEmbeddingModel 和 imageModel，返回会抛出错误的函数
      if (prop === "textEmbeddingModel") {
        return (_modelId: string) => {
          throw new Error("OpenRouter does not support text embedding models");
        };
      }

      if (prop === "imageModel") {
        return (_modelId: string) => {
          throw new Error("OpenRouter does not support image models");
        };
      }

      // 其他属性直接传递给原始 provider
      return target[prop as keyof OpenRouterProvider];
    },
  }) as ExtendedProvider;
}

/**
 * 导出类型兼容的 Provider（用于向后兼容）
 * @deprecated 使用 createCustomOpenRouter 替代
 */
export const createOpenRouterProvider = createCustomOpenRouter;
