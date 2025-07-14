import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { Provider } from "ai";

/**
 * 自定义 OpenRouter provider
 * 修复某些模型（如 Kimi K2）的响应格式问题
 */

// 创建自定义的 fetch 函数来拦截和修改响应
function createCustomFetch(modelId: string): typeof fetch {
  // 只对 Kimi K2 模型进行处理
  if (!modelId.includes('kimi-k2')) {
    return fetch;
  }

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await fetch(input, init);
    
    // 只处理流式响应
    if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
      return response;
    }

    // 创建转换流
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    
    const transformedStream = new ReadableStream({
      async start(controller) {
        let buffer = '';
        
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
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留最后一行（可能不完整）
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6);
              
              // 跳过特殊消息
              if (jsonStr.trim() === '[DONE]' || !jsonStr.trim()) {
                controller.enqueue(encoder.encode(line + '\n'));
                continue;
              }
              
              try {
                const data = JSON.parse(jsonStr);
                
                // 修复 tool_calls 中的 type 字段
                if (data.choices?.[0]?.delta?.tool_calls) {
                  data.choices[0].delta.tool_calls = data.choices[0].delta.tool_calls.map(
                    (toolCall: unknown) => {
                      const tc = toolCall as Record<string, unknown>;
                      if (tc.type === '') {
                        return { ...tc, type: 'function' };
                      }
                      return tc;
                    }
                  );
                  
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n`));
                } else {
                  controller.enqueue(encoder.encode(line + '\n'));
                }
              } catch {
                // 解析失败，原样输出
                controller.enqueue(encoder.encode(line + '\n'));
              }
            } else {
              // 非数据行，原样输出
              controller.enqueue(encoder.encode(line + '\n'));
            }
          }
        }
      }
    });

    return new Response(transformedStream, {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    });
  };
}

export function createCustomOpenRouter(config: {
  apiKey: string | undefined;
  baseURL?: string;
}): Provider {
  const baseProvider = createOpenAICompatible({
    name: "openrouter",
    baseURL: config.baseURL || "https://openrouter.ai/api/v1",
    apiKey: config.apiKey,
  });

  // 创建代理来拦截 languageModel 调用
  return new Proxy(baseProvider, {
    get(target, prop) {
      if (prop === 'languageModel') {
        return (modelId: string) => {
          // 对于 Kimi K2，使用自定义 fetch
          if (modelId.includes('kimi-k2')) {
            return createOpenAICompatible({
              name: "openrouter",
              baseURL: config.baseURL || "https://openrouter.ai/api/v1",
              apiKey: config.apiKey,
              fetch: createCustomFetch(modelId),
            }).languageModel(modelId);
          }
          
          // 其他模型使用原始实现
          return target.languageModel(modelId);
        };
      }
      
      return target[prop as keyof typeof target];
    }
  });
}