"use server";

import { getEncoding, type Tiktoken } from "js-tiktoken";

let encoding: Tiktoken | null = null;

/**
 * 🚀 服务端 Token 编码函数
 * 在服务端环境中初始化和使用 tiktoken
 */
export async function encodeTextServer(text: string): Promise<number> {
  try {
    // 懒加载编码器
    if (!encoding) {
      encoding = getEncoding("cl100k_base");
      console.log("✅ [Server] js-tiktoken 初始化成功");
    }

    const tokens = encoding.encode(text);
    return tokens.length;
  } catch (error) {
    console.warn("⚠️ [Server] js-tiktoken 编码失败:", error);
    // 降级到字符长度估算
    return Math.ceil(text.length / 4);
  }
}

/**
 * 🧹 清理编码器资源
 */
export async function cleanupEncodingServer(): Promise<void> {
  if (encoding) {
    try {
      // js-tiktoken 是纯 JS 实现，不需要手动释放资源
      encoding = null;
      console.log("✅ [Server] js-tiktoken 资源已清理");
    } catch (error) {
      console.warn("⚠️ [Server] js-tiktoken 清理失败:", error);
    }
  }
}

/**
 * 📊 批量编码多个文本
 * 优化性能，减少服务端调用次数
 */
export async function encodeTextsServer(texts: string[]): Promise<number[]> {
  try {
    // 懒加载编码器
    if (!encoding) {
      encoding = getEncoding("cl100k_base");
      console.log("✅ [Server] js-tiktoken 批量编码初始化成功");
    }

    return texts.map(text => {
      try {
        if (!encoding) {
          return Math.ceil(text.length / 4);
        }
        const tokens = encoding.encode(text);
        return tokens.length;
      } catch (error) {
        console.warn("⚠️ [Server] 单个文本编码失败:", error);
        return Math.ceil(text.length / 4);
      }
    });
  } catch (error) {
    console.warn("⚠️ [Server] js-tiktoken 批量编码失败:", error);
    // 降级到字符长度估算
    return texts.map(text => Math.ceil(text.length / 4));
  }
}
