/**
 * 阿里云百炼文件上传工具
 * 根据官方文档实现的文件上传和获取公网URL功能
 */

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

  try {
    const response = await fetch(`${url}?${params}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get upload policy: ${response.status} ${errorText}`);
    }

    const result: BailianUploadResponse = await response.json();
    return result.data;
  } catch (error) {
    console.error("❌ 获取上传凭证失败:", error);
    throw new Error(
      `Failed to get upload policy: ${error instanceof Error ? error.message : String(error)}`
    );
  }
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
  try {
    // 将base64转换为Blob（JPEG格式）
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const imageBlob = new Blob([bytes], { type: "image/jpeg" });

    // 构造上传路径
    const key = `${policyData.upload_dir}/${fileName}`;

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

    // 上传文件
    const response = await fetch(policyData.upload_host, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload file: ${response.status} ${errorText}`);
    }

    // 返回OSS URL
    return `oss://${key}`;
  } catch (error) {
    console.error("❌ 图片上传失败:", error);
    throw new Error(
      `Failed to upload image: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 上传截图并获取公网URL的主函数
 * @param base64Data base64编码的截图数据（JPEG格式）
 * @param modelName 模型名称，默认为 'qwen-vl-plus'
 * @param fileName 文件名，默认为 'screenshot.jpg'
 * @returns 公网可访问的OSS URL
 */
export async function uploadScreenshotToBalian(
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
