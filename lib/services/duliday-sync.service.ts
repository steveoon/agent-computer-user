import { DulidayRaw, ZhipinData } from "@/types/zhipin";
import { convertDulidayListToZhipinData } from "@/lib/mappers/duliday-to-zhipin.mapper";
import { DulidayErrorFormatter, formatDulidayError, formatHttpError } from "@/lib/utils/duliday-error-formatter";
import { getBrandNameByOrgId } from "@/lib/constants/organization-mapping";
import { z } from "zod";
// 注意：服务器端不使用 configService，数据保存逻辑在客户端处理

/**
 * 部分成功的响应接口
 */
export interface PartialSuccessResponse {
  validPositions: DulidayRaw.Position[];
  invalidPositions: Array<{
    position: Partial<DulidayRaw.Position>;
    error: string;
  }>;
  totalCount: number;
}

/**
 * Duliday API 端点配置
 */
const DULIDAY_API_BASE = "https://k8s.duliday.com/persistence/a";
const DULIDAY_LIST_ENDPOINT = `${DULIDAY_API_BASE}/job-requirement/hiring/list`;

/**
 * 同步结果接口
 */
export interface SyncResult {
  success: boolean;
  totalRecords: number;
  processedRecords: number;
  storeCount: number;
  brandName: string;
  errors: string[];
  duration: number;
  convertedData?: Partial<ZhipinData>; // 可选：转换后的数据
}

/**
 * 同步历史记录接口
 */
export interface SyncRecord {
  id: string;
  timestamp: string;
  organizationIds: number[];
  results: SyncResult[];
  totalDuration: number;
  overallSuccess: boolean;
}

/**
 * 数据同步服务类
 */
export class DulidaySyncService {
  private dulidayToken: string;

  constructor(token?: string) {
    this.dulidayToken = token || process.env.DULIDAY_TOKEN || "";
    if (!this.dulidayToken) {
      throw new Error("DULIDAY_TOKEN is required for data synchronization");
    }
  }

  /**
   * 从 Duliday API 获取岗位列表（带超时和重试机制）
   * 支持部分成功策略：即使部分岗位数据校验失败，也返回成功的数据
   */
  async fetchJobList(
    organizationIds: number[],
    pageSize: number = 100,
    retryCount: number = 0
  ): Promise<PartialSuccessResponse> {
    const requestBody = {
      organizationIds,
      pageNum: 0,
      pageSize,
      listOrderBy: 0,
      supportSupplier: null,
    };

    // 创建 AbortController 用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

    try {
      const response = await fetch(DULIDAY_LIST_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Duliday-Token": this.dulidayToken,
          // Node.js fetch 会自动处理 keep-alive，不需要手动设置
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
        // Node.js 18+ 的 fetch 自动处理连接管理，不需要自定义 agent
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(formatHttpError(response.status, response.statusText));
      }

      const data = await response.json();

      // 部分成功策略：逐个验证岗位数据
      const validPositions: DulidayRaw.Position[] = [];
      const invalidPositions: Array<{
        position: Partial<DulidayRaw.Position>;
        error: string;
      }> = [];

      // 首先验证整体响应结构
      if (!data?.data?.result || !Array.isArray(data.data.result)) {
        throw new Error("API响应格式不正确：缺少data.result数组");
      }

      const totalCount = data.data.total || data.data.result.length;

      // 逐个验证每个岗位
      for (let index = 0; index < data.data.result.length; index++) {
        const positionData = data.data.result[index];
        
        try {
          // 尝试验证单个岗位数据
          const validatedPosition = DulidayRaw.PositionSchema.parse(positionData);
          validPositions.push(validatedPosition);
        } catch (validationError) {
          // 记录失败的岗位和错误信息
          let errorMessage = "";
          
          if (validationError instanceof z.ZodError) {
            // 使用带上下文的错误格式化
            errorMessage = DulidayErrorFormatter.formatValidationErrorWithContext(
              validationError,
              { 
                jobName: positionData?.jobName || `未知岗位_${index}`,
                jobId: positionData?.jobId || `unknown_${index}`
              }
            );
          } else {
            errorMessage = formatDulidayError(validationError);
          }

          invalidPositions.push({
            position: positionData || {},
            error: errorMessage
          });

          console.warn(`岗位数据验证失败 (索引 ${index}):`, errorMessage);
        }
      }

      // 如果没有任何有效的岗位，抛出错误
      if (validPositions.length === 0 && invalidPositions.length > 0) {
        const allErrors = invalidPositions.map(item => item.error).join('\n\n');
        throw new Error(`所有岗位数据验证失败:\n${allErrors}`);
      }

      return {
        validPositions,
        invalidPositions,
        totalCount
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      // 处理不同类型的错误
      if (error instanceof Error) {
        // 检查是否是网络相关错误并需要重试
        if (DulidayErrorFormatter.isNetworkError(error) && retryCount < 3) {
          console.warn(`网络错误，正在重试 (${retryCount + 1}/3)...`, error.message);
          // 延迟后重试，避免过快的重试
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return this.fetchJobList(organizationIds, pageSize, retryCount + 1);
        }
        
        // 格式化网络错误信息
        if (retryCount >= 3) {
          throw new Error(`${formatDulidayError(error)}（已重试${retryCount}次）`);
        }
      }
      
      console.error("Failed to fetch job list from Duliday API:", error);
      throw error;
    }
  }

  /**
   * 同步单个组织的数据（仅获取和转换，不保存）
   * 支持部分成功策略
   */
  async syncOrganization(
    organizationId: number,
    onProgress?: (progress: number, message: string) => void
  ): Promise<SyncResult & { convertedData?: Partial<ZhipinData> }> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      onProgress?.(
        10,
        `正在从 Duliday API 获取组织 ${organizationId} 的数据...`
      );

      // 获取数据（支持部分成功）
      const partialResponse = await this.fetchJobList([organizationId]);

      const totalRecords = partialResponse.totalCount;
      const validCount = partialResponse.validPositions.length;
      const invalidCount = partialResponse.invalidPositions.length;

      onProgress?.(
        50,
        `获取到 ${totalRecords} 条记录，其中 ${validCount} 条有效，${invalidCount} 条失败，正在转换数据格式...`
      );

      // 收集失败岗位的错误信息
      if (partialResponse.invalidPositions.length > 0) {
        partialResponse.invalidPositions.forEach(item => {
          errors.push(item.error);
        });
      }

      // 只转换有效的数据
      let zhipinData: Partial<ZhipinData> | undefined;
      let storeCount = 0;

      if (partialResponse.validPositions.length > 0) {
        // 创建一个符合 ListResponse 格式的对象，只包含有效数据
        const validListResponse: DulidayRaw.ListResponse = {
          code: 200,
          message: "success",
          data: {
            result: partialResponse.validPositions,
            total: partialResponse.validPositions.length
          }
        };

        zhipinData = convertDulidayListToZhipinData(
          validListResponse,
          organizationId
        );
        
        storeCount = zhipinData.stores?.length || 0;
      }

      onProgress?.(100, `数据转换完成！`);

      const duration = Date.now() - startTime;
      const brandName = getBrandNameByOrgId(organizationId) || "未知品牌";

      // 判断是否成功：有任何有效数据就算部分成功
      const isSuccess = partialResponse.validPositions.length > 0;

      return {
        success: isSuccess,
        totalRecords,
        processedRecords: validCount,
        storeCount,
        brandName,
        errors,
        duration,
        convertedData: zhipinData, // 返回转换后的数据，但不保存
      };
    } catch (error) {
      const brandName = getBrandNameByOrgId(organizationId);
      const errorMessage = formatDulidayError(error);
      const contextualError = DulidayErrorFormatter.formatWithOrganizationContext(
        organizationId,
        errorMessage,
        brandName
      );
      
      errors.push(contextualError);

      const duration = Date.now() - startTime;

      return {
        success: false,
        totalRecords: 0,
        processedRecords: 0,
        storeCount: 0,
        brandName: brandName || `组织 ${organizationId}`,
        errors,
        duration,
      };
    }
  }

  /**
   * 同步多个组织的数据
   */
  async syncMultipleOrganizations(
    organizationIds: number[],
    onProgress?: (
      overallProgress: number,
      currentOrg: number,
      message: string
    ) => void
  ): Promise<SyncRecord> {
    const startTime = Date.now();
    const syncId = `sync_${Date.now()}`;
    const results: SyncResult[] = [];

    for (let i = 0; i < organizationIds.length; i++) {
      const orgId = organizationIds[i];
      const orgProgress = Math.floor((i / organizationIds.length) * 100);

      onProgress?.(orgProgress, orgId, `开始同步组织 ${orgId}...`);

      try {
        const result = await this.syncOrganization(
          orgId,
          (progress, message) => {
            const currentOrgProgress = Math.floor(
              (i / organizationIds.length) * 100 +
                progress / organizationIds.length
            );
            onProgress?.(currentOrgProgress, orgId, message);
          }
        );

        results.push(result);
      } catch (error) {
        const brandName = getBrandNameByOrgId(orgId);
        const errorMessage = formatDulidayError(error);
        const contextualError = DulidayErrorFormatter.formatWithOrganizationContext(
          orgId,
          errorMessage,
          brandName
        );
        
        results.push({
          success: false,
          totalRecords: 0,
          processedRecords: 0,
          storeCount: 0,
          brandName: brandName || `组织 ${orgId}`,
          errors: [contextualError],
          duration: 0,
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    const overallSuccess = results.every((r) => r.success);

    onProgress?.(100, 0, `所有同步任务完成！`);

    return {
      id: syncId,
      timestamp: new Date().toISOString(),
      organizationIds,
      results,
      totalDuration,
      overallSuccess,
    };
  }

  /**
   * 验证 Duliday Token 是否有效
   */
  async validateToken(): Promise<boolean> {
    // 创建 AbortController 用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时（验证请求可以更短）

    try {
      const response = await fetch(DULIDAY_LIST_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Duliday-Token": this.dulidayToken,
          // Node.js fetch 会自动处理 keep-alive，不需要手动设置
        },
        body: JSON.stringify({
          organizationIds: [1], // 使用一个测试的组织ID
          pageNum: 0,
          pageSize: 1,
        }),
        signal: controller.signal,
        // Node.js 18+ 的 fetch 自动处理连接管理，不需要自定义 agent
      });

      clearTimeout(timeoutId);

      // 如果返回 401 或 403，说明 token 无效
      return ![401, 403].includes(response.status);
    } catch (error) {
      clearTimeout(timeoutId);
      console.warn("Token validation failed:", error);
      return false;
    }
  }
}

/**
 * 创建同步服务实例
 */
export function createSyncService(token?: string): DulidaySyncService {
  return new DulidaySyncService(token);
}

/**
 * 存储同步历史记录到 localStorage
 */
export function saveSyncRecord(record: SyncRecord): void {
  try {
    const existingRecords = getSyncHistory();
    const updatedRecords = [record, ...existingRecords].slice(0, 50); // 只保留最近50条记录
    localStorage.setItem("sync_history", JSON.stringify(updatedRecords));
  } catch (error) {
    console.error("Failed to save sync record:", error);
  }
}

/**
 * 从 localStorage 获取同步历史记录
 */
export function getSyncHistory(): SyncRecord[] {
  try {
    const records = localStorage.getItem("sync_history");
    return records ? JSON.parse(records) : [];
  } catch (error) {
    console.error("Failed to load sync history:", error);
    return [];
  }
}

/**
 * 清除同步历史记录
 */
export function clearSyncHistory(): void {
  try {
    localStorage.removeItem("sync_history");
  } catch (error) {
    console.error("Failed to clear sync history:", error);
  }
}
