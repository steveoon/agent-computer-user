import { getAvailableBrands } from "@/actions/brand-mapping";
import { configService } from "@/lib/services/config.service";
import { consumeNdjsonStream } from "@/lib/utils/ndjson-stream";
import { createSyncStreamHandler } from "@/lib/utils/sync-stream";

// 从统一类型文件导入（Schema-First 原则）
import type { SyncRecord } from "@/types/duliday-sync";
import { SyncResponseSchema } from "@/types/duliday-sync";

/**
 * 品牌同步管理器
 * 确保数据库中的所有品牌都被同步到本地 IndexedDB
 */
export class BrandSyncManager {
  private static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  private static async parseSyncResponse(response: Response): Promise<SyncRecord> {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/x-ndjson")) {
      if (!response.body) {
        throw new Error("未收到同步响应流");
      }

      const reader = response.body.getReader();
      const { result, error } = await consumeNdjsonStream<SyncRecord>(
        reader,
        createSyncStreamHandler()
      );

      if (error) {
        console.warn("[BrandSyncManager] 同步流返回错误，但已收到结果:", error.message);
      }

      return result;
    }

    const json = await response.json();
    const parsed = SyncResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error("同步响应格式校验失败");
    }

    const responseData = parsed.data;
    // 提取 SyncRecord（可能包装在 data 字段中）
    const record = "data" in responseData ? responseData.data : responseData;
    return record as SyncRecord;
  }

  /**
   * 检查并同步缺失的品牌
   * @param dulidayToken Duliday API Token
   * @param forceSync 是否强制同步所有品牌
   * @returns 同步结果
   */
  static async syncMissingBrands(
    dulidayToken?: string,
    forceSync: boolean = false
  ): Promise<{
    syncedBrands: string[];
    failedBrands: string[];
    errors: Record<string, string>;
    /** Token 缺失标志，调用方可据此显示提示 */
    tokenMissing?: boolean;
    /** 未登录/无权限（避免在未登录场景下自动同步导致控制台报错） */
    unauthorized?: boolean;
    /** 全量同步要求未满足 */
    requiresFullResync?: boolean;
    /** 阻断原因 */
    blockedReason?: string;
  }> {
    const syncedBrands: string[] = [];
    const failedBrands: string[] = [];
    const errors: Record<string, string> = {};

    try {
      // 获取当前配置
      const config = await configService.getConfig();
      const existingBrands = Object.keys(config?.brandData?.brands || {});

      // 获取所有映射的品牌（从数据库）
      const mappedBrands = await getAvailableBrands();
      const mappedBrandNames = mappedBrands.map(b => b.name);

      const needsFullResync = config?.metadata?.needsFullResync === true;
      if (needsFullResync && !forceSync) {
        return {
          syncedBrands,
          failedBrands,
          errors,
          requiresFullResync: true,
          blockedReason:
            "检测到旧版本配置，需要全量同步所有品牌。请前往同步管理选择全部品牌后再同步。",
        };
      }

      // 找出缺失的映射品牌（只同步数据库中定义的品牌）
      const missingBrands = forceSync
        ? mappedBrands
        : mappedBrands.filter(brand => !existingBrands.includes(brand.name));

      // 记录非映射品牌（用户导入的额外品牌）
      const customBrands = existingBrands.filter(brand => !mappedBrandNames.includes(brand));
      if (customBrands.length > 0) {
        console.log(`🛡️ 检测到用户自定义品牌（不会被同步影响）: ${customBrands.join("、")}`);
      }

      if (missingBrands.length === 0) {
        console.log("✅ 所有映射的品牌都已存在，无需同步");
        return { syncedBrands, failedBrands, errors };
      }

      console.log(
        `🔍 发现 ${missingBrands.length} 个${forceSync ? "" : "缺失的"}品牌需要同步:`,
        missingBrands.map(b => b.name).join(", ")
      );

      // 获取 token
      const token =
        dulidayToken || localStorage.getItem("duliday_token") || process.env.DULIDAY_TOKEN;
      if (!token) {
        // Token 缺失时返回标志，由调用方决定如何处理（避免控制台报错）
        console.info("ℹ️ 未配置 Duliday Token，跳过品牌同步");
        return { syncedBrands, failedBrands, errors, tokenMissing: true };
      }

      // 通过 API 路由同步品牌（避免 CSP 问题）
      try {
        const response = await fetch("/api/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            organizationIds: missingBrands.map(brand => brand.id),
            token,
          }),
        });

        if (!response.ok) {
          // ✅ 产品化处理：未登录时跳过（/api/sync 在 middleware 中属于受保护 API）
          if (response.status === 401) {
            let errorMessage: string | undefined;
            try {
              const data: unknown = await response.json();
              if (BrandSyncManager.isRecord(data)) {
                const message = data.message;
                if (typeof message === "string") errorMessage = message;
              }
            } catch {
              // ignore
            }

            console.info(
              `[BrandSyncManager] 未登录或无权限，跳过自动同步品牌` +
                (errorMessage ? `（${errorMessage}）` : "")
            );
            return { syncedBrands, failedBrands, errors, unauthorized: true };
          }

          let serverError: string | undefined;
          try {
            const data: unknown = await response.json();
            if (BrandSyncManager.isRecord(data)) {
              const error = data.error;
              if (typeof error === "string") serverError = error;
            }
          } catch {
            // ignore
          }

          throw new Error(serverError || "同步请求失败");
        }

        const syncRecord = await BrandSyncManager.parseSyncResponse(response);

        // 处理同步结果
        if (syncRecord && syncRecord.results) {
          const resultsByBrand = new Map(
            syncRecord.results.map(result => [result.brandName, result])
          );

          for (const brand of missingBrands) {
            const result = resultsByBrand.get(brand.name);

            if (!result) {
              failedBrands.push(brand.name);
              errors[brand.name] = "同步响应中缺少该品牌的结果";
              console.error(`❌ 同步结果缺失: ${brand.name}`);
              continue;
            }

            if (result.success) {
              syncedBrands.push(brand.name);
              console.log(`✅ 成功同步品牌: ${brand.name}`);
            } else {
              failedBrands.push(brand.name);
              errors[brand.name] = result.errors.join(", ") || "同步失败";
              // 用 warn 避免在 Next.js dev 中触发 error overlay
              console.warn(`⚠️ 同步品牌失败: ${brand.name}`, result.errors);
            }
          }
        }
      } catch (error) {
        // 所有品牌都失败
        for (const brand of missingBrands) {
          failedBrands.push(brand.name);
          errors[brand.name] = error instanceof Error ? error.message : "未知错误";
        }
        console.error("❌ 品牌同步请求失败:", error);
      }

      return { syncedBrands, failedBrands, errors };
    } catch (error) {
      console.error("❌ 品牌同步管理器错误:", error);
      throw error;
    }
  }

  /**
   * 获取品牌同步状态
   * @returns 同步状态信息
   */
  static async getBrandSyncStatus(): Promise<{
    totalMapped: number;
    totalSynced: number;
    missingBrands: string[];
    syncedBrands: string[];
  }> {
    const config = await configService.getConfig();
    const existingBrands = Object.keys(config?.brandData?.brands || {});
    const mappedBrands = await getAvailableBrands();

    const missingBrands = mappedBrands
      .filter(brand => !existingBrands.includes(brand.name))
      .map(brand => brand.name);

    const syncedBrands = mappedBrands
      .filter(brand => existingBrands.includes(brand.name))
      .map(brand => brand.name);

    return {
      totalMapped: mappedBrands.length,
      totalSynced: syncedBrands.length,
      missingBrands,
      syncedBrands,
    };
  }
}

// 导出便捷函数
export const syncMissingBrands = BrandSyncManager.syncMissingBrands;
export const getBrandSyncStatus = BrandSyncManager.getBrandSyncStatus;
