import { getAvailableBrands } from "@/actions/brand-mapping";
import { configService } from "@/lib/services/config.service";

/**
 * 品牌同步管理器
 * 确保数据库中的所有品牌都被同步到本地 IndexedDB
 */
export class BrandSyncManager {
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
        throw new Error("未找到 Duliday Token，请先配置 Token");
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
          const errorData = await response.json();
          throw new Error(errorData.error || "同步请求失败");
        }

        const { data: syncRecord } = await response.json();

        // 处理同步结果
        if (syncRecord && syncRecord.results) {
          for (const result of syncRecord.results) {
            const brand = missingBrands.find(b => b.name === result.brandName);
            if (brand) {
              if (result.success) {
                syncedBrands.push(brand.name);
                console.log(`✅ 成功同步品牌: ${brand.name}`);
              } else {
                failedBrands.push(brand.name);
                errors[brand.name] = result.errors.join(", ") || "同步失败";
                console.error(`❌ 同步品牌失败: ${brand.name}`, result.errors);
              }
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
