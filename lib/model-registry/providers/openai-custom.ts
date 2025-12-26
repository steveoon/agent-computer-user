import { createOpenAI } from "@ai-sdk/openai";

/**
 * 创建自定义的 OpenAI provider
 * 解决第三方代理服务不支持 /v1/responses 端点的问题
 *
 * 背景：
 * - AI SDK v5 默认使用新的 /v1/responses 端点
 * - 许多代理服务器（如 ohmygpt）只支持标准的 /v1/chat/completions 端点
 *
 * 解决方案：
 * - 使用 Proxy 拦截 languageModel 调用
 * - 强制使用 chat 方法以使用标准端点
 */
export function createCustomOpenAI(config: { apiKey: string | undefined; baseURL?: string }) {
  // 创建基础 OpenAI 实例
  const openaiInstance = createOpenAI({
    apiKey: config.apiKey || "",
    baseURL: config.baseURL,
  });

  // 创建代理来拦截方法调用
  return new Proxy(openaiInstance, {
    get(_target, prop) {
      // 拦截 languageModel 方法
      if (prop === "languageModel") {
        return (modelId: string) => {
          // 强制使用 chat 方法以使用标准的 /v1/chat/completions 端点
          // 而不是新的 /v1/responses 端点
          console.log(`🔄 OpenAI: 使用 chat 方法以兼容代理服务器 (${modelId})`);
          return openaiInstance.chat(modelId);
        };
      }

      // 直接使用 chat 和 completion 方法
      if (prop === "chat" || prop === "completion") {
        return openaiInstance[prop as keyof typeof openaiInstance];
      }

      // 处理可选的方法
      // Note: AI SDK v6 renamed textEmbeddingModel to embeddingModel
      if (prop === "embeddingModel" || prop === "imageModel") {
        const method = openaiInstance[prop as keyof typeof openaiInstance];
        return method || undefined;
      }

      // 其他属性直接传递
      return openaiInstance[prop as keyof typeof openaiInstance];
    },
  });
}

/**
 * 导出类型兼容的 Provider（用于向后兼容）
 * @deprecated 使用 createCustomOpenAI 替代
 */
export const createOpenAIProvider = createCustomOpenAI;
