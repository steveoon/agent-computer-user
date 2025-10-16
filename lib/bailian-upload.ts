/**
 * 阿里云百炼文件上传工具
 * 根据官方文档实现的文件上传和获取公网URL功能
 */

// 重试配置
const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelay: 1000, // 初始延迟1秒
  maxDelay: 5000, // 最大延迟5秒
  timeout: 10000, // 请求超时10秒
} as const;

/**
 * 跨环境的base64解码函数
 * 在Node环境使用Buffer，在浏览器使用atob
 * @param base64Data base64编码的数据（可能包含data URI前缀）
 * @returns Uint8Array
 */
function base64ToUint8Array(base64Data: string): Uint8Array {
  // 移除可能的data URI前缀
  const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, "");

  // Node.js环境
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(cleanBase64, "base64"));
  }

  // 浏览器环境
  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * 检查文件大小是否符合限制
 * @param bytes 文件字节数组
 * @param maxSizeMB 最大文件大小（MB）
 * @returns 是否符合大小限制
 */
function checkFileSize(bytes: Uint8Array, maxSizeMB: number): boolean {
  const sizeMB = bytes.length / (1024 * 1024);
  if (sizeMB > maxSizeMB) {
    console.warn(`⚠️ 文件大小 ${sizeMB.toFixed(2)}MB 超过限制 ${maxSizeMB}MB`);
    return false;
  }
  return true;
}

interface UploadPolicyData {
  readonly policy: string;
  readonly signature: string;
  readonly upload_dir: string;
  readonly upload_host: string;
  readonly expire_in_seconds: number;
  readonly max_file_size_mb: number;
  readonly capacity_limit_mb: number;
  readonly oss_access_key_id: string;
  readonly x_oss_object_acl: string;
  readonly x_oss_forbid_overwrite: string;
}

interface BailianUploadResponse {
  readonly request_id: string;
  readonly data: UploadPolicyData;
}

/**
 * 获取文件上传凭证
 * @param apiKey 阿里云百炼 API Key
 * @param modelName 模型名称，如 'qwen-vl-plus'
 * @returns 上传凭证数据
 */
async function getUploadPolicy(
  apiKey: string,
  modelName: string = "qwen-vl-plus"
): Promise<UploadPolicyData> {
  const url = "https://dashscope.aliyuncs.com/api/v1/uploads";
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const params = new URLSearchParams({
    action: "getPolicy",
    model: modelName,
  });

  // 使用重试机制获取上传凭证
  return withRetry(async signal => {
    const response = await fetch(`${url}?${params}`, {
      method: "GET",
      headers,
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get upload policy: ${response.status} ${errorText}`);
    }

    const result: BailianUploadResponse = await response.json();
    return result.data;
  }, "获取上传凭证");
}

/**
 * 判断错误是否可重试
 * @param error 错误对象
 * @returns 是否可重试
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // 网络错误、超时错误可重试
    if (
      error.message.includes("fetch failed") ||
      error.message.includes("timeout") ||
      error.message.includes("ECONNRESET") ||
      error.message.includes("ETIMEDOUT") ||
      error.message.includes("ENOTFOUND")
    ) {
      return true;
    }

    // HTTP 5xx 错误可重试
    if (
      error.message.includes("500") ||
      error.message.includes("502") ||
      error.message.includes("503") ||
      error.message.includes("504")
    ) {
      return true;
    }

    // HTTP 4xx 错误不可重试（客户端错误）
    if (
      error.message.includes("400") ||
      error.message.includes("401") ||
      error.message.includes("403") ||
      error.message.includes("404")
    ) {
      return false;
    }
  }

  // 默认可重试
  return true;
}

/**
 * 执行带重试的异步操作
 * @param fn 要执行的异步函数，接收AbortSignal参数
 * @param operationName 操作名称，用于日志
 * @returns 操作结果
 */
async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  operationName: string
): Promise<T> {
  let lastError: Error | unknown;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RETRY_CONFIG.timeout);

    try {
      console.log(`🔄 ${operationName} - 尝试 ${attempt}/${RETRY_CONFIG.maxAttempts}`);

      // 执行操作，传递AbortSignal
      const result = await fn(controller.signal);

      clearTimeout(timeoutId);
      console.log(`✅ ${operationName} - 第 ${attempt} 次尝试成功`);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;
      console.error(`❌ ${operationName} - 第 ${attempt} 次尝试失败:`, error);

      // 检查是否可重试
      if (!isRetryableError(error)) {
        console.log(`🚫 ${operationName} - 错误不可重试，终止`);
        throw error;
      }

      if (attempt < RETRY_CONFIG.maxAttempts) {
        // 计算延迟时间（指数退避 + 抖动）
        const baseDelay = Math.min(
          RETRY_CONFIG.initialDelay * Math.pow(2, attempt - 1),
          RETRY_CONFIG.maxDelay
        );
        // 添加随机抖动（±20%）
        const jitter = baseDelay * 0.2 * (Math.random() - 0.5);
        const delay = Math.max(0, baseDelay + jitter);

        console.log(`⏳ 等待 ${Math.round(delay)}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(
    `${operationName} - 所有重试均失败: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}

/**
 * 将base64图片上传到阿里云OSS临时存储
 * @param policyData 上传凭证数据
 * @param base64Data base64编码的图片数据（JPEG格式）
 * @param fileName 文件名，默认为 'screenshot.jpg'
 * @returns OSS URL
 */
async function uploadImageToOSS(
  policyData: UploadPolicyData,
  base64Data: string,
  fileName: string = "screenshot.jpg"
): Promise<string> {
  // 将base64转换为Uint8Array（跨环境兼容）
  const bytes = base64ToUint8Array(base64Data);

  // 检查文件大小
  if (!checkFileSize(bytes, policyData.max_file_size_mb)) {
    throw new Error(`文件大小超过限制 ${policyData.max_file_size_mb}MB，请压缩后重试`);
  }

  // 适配较新 TS DOM lib 对 BlobPart 的更严格约束：传入 ArrayBuffer 而非视图
  const arrayBuffer: ArrayBuffer =
    bytes.buffer instanceof ArrayBuffer
      ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      : bytes.slice().buffer;
  const imageBlob = new Blob([arrayBuffer], { type: "image/jpeg" });

  // 构造上传路径（规范化，避免双斜杠）
  const uploadDir = policyData.upload_dir.replace(/\/$/, "");
  const key = `${uploadDir}/${fileName}`;

  // 构造FormData
  const formData = new FormData();
  formData.append("OSSAccessKeyId", policyData.oss_access_key_id);
  formData.append("policy", policyData.policy);
  formData.append("Signature", policyData.signature);
  formData.append("key", key);
  formData.append("x-oss-object-acl", policyData.x_oss_object_acl);
  formData.append("x-oss-forbid-overwrite", policyData.x_oss_forbid_overwrite);
  formData.append("success_action_status", "200");
  formData.append("file", imageBlob, fileName);

  // 使用重试机制上传文件
  return withRetry(async signal => {
    const response = await fetch(policyData.upload_host, {
      method: "POST",
      body: formData,
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload file: ${response.status} ${errorText}`);
    }

    // 返回OSS URL
    return `oss://${key}`;
  }, "OSS文件上传");
}

/**
 * 上传截图并获取OSS地址的主函数
 * @param base64Data base64编码的截图数据（JPEG格式）
 * @param modelName 模型名称，默认为 'qwen-vl-plus'
 * @param fileName 文件名，默认为 'screenshot.jpg'
 * @returns OSS临时地址（格式：oss://...）
 */
export async function uploadScreenshotToBailian(
  base64Data: string,
  modelName: string = "qwen-vl-plus",
  fileName: string = "screenshot.jpg"
): Promise<string> {
  // 从环境变量获取API Key
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error("请设置 DASHSCOPE_API_KEY 环境变量");
  }

  try {
    console.log("🔑 正在获取上传凭证...");

    // 1. 获取上传凭证
    const policyData = await getUploadPolicy(apiKey, modelName);
    console.log(`✅ 上传凭证获取成功，有效期: ${policyData.expire_in_seconds}秒`);

    // 2. 上传文件到OSS
    console.log("📤 正在上传截图到阿里云OSS...");
    const ossUrl = await uploadImageToOSS(policyData, base64Data, fileName);

    console.log(`✅ 截图上传成功! URL: ${ossUrl}`);
    console.log(`⏰ URL有效期: 48小时`);

    return ossUrl;
  } catch (error) {
    console.error("❌ 截图上传到百炼失败:", error);
    throw error;
  }
}

/**
 * 验证OSS URL是否有效的辅助函数
 * @param ossUrl OSS URL
 * @returns 是否为有效的OSS URL格式
 */
export function isValidOSSUrl(ossUrl: string): boolean {
  return ossUrl.startsWith("oss://") && ossUrl.length > 6;
}

// 为了保持向后兼容，保留旧名称作为别名
/** @deprecated 使用 uploadScreenshotToBailian 代替 */
export const uploadScreenshotToBalian = uploadScreenshotToBailian;
