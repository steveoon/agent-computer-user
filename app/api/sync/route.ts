import { NextRequest, NextResponse } from "next/server";
import { createSyncService } from "@/lib/services/duliday-sync.service";
import { geocodingService } from "@/lib/services/geocoding.service";
import { z } from "zod/v3";

/**
 * 同步请求体 Schema
 */
const SyncRequestSchema = z.object({
  organizationIds: z.array(z.union([z.number(), z.string()])).min(1, "至少需要选择一个组织ID"),
  pageSize: z.number().optional().default(100),
  validateOnly: z.boolean().optional().default(false),
  token: z.string().optional(), // 支持从客户端传递token
  existingCoordinates: z
    .record(z.string(), z.object({ lat: z.number(), lng: z.number() }))
    .optional(),
});

/**
 * POST /api/sync
 *
 * 执行数据同步
 */
export async function POST(request: NextRequest) {
  try {
    // 解析请求体
    const body = await request.json();
    const {
      organizationIds,
      validateOnly,
      token: clientToken,
      existingCoordinates,
    } = SyncRequestSchema.parse(body);

    // 确定使用的Token：优先使用客户端传递的token，然后是环境变量
    const dulidayToken = clientToken || process.env.DULIDAY_TOKEN;
    if (!dulidayToken) {
      return NextResponse.json(
        {
          success: false,
          error: "未找到Duliday Token，请在Token管理中设置或配置环境变量",
          code: "MISSING_TOKEN",
        },
        { status: 500 }
      );
    }

    // 创建同步服务
    const syncService = createSyncService(dulidayToken);

    // 如果只是验证Token，验证后直接返回结果
    if (validateOnly) {
      const isTokenValid = await syncService.validateToken();

      if (isTokenValid) {
        return NextResponse.json({
          success: true,
          message: "Token验证成功",
          tokenValid: true,
        });
      } else {
        return NextResponse.json(
          {
            success: false,
            error: "Duliday Token 无效或已过期，请检查Token或联系管理员更新",
            code: "INVALID_TOKEN",
            tokenValid: false,
          },
          { status: 401 }
        );
      }
    }

    // 对于实际同步操作，仍需验证Token
    const isTokenValid = await syncService.validateToken();
    if (!isTokenValid) {
      return NextResponse.json(
        {
          success: false,
          error: "Duliday Token 无效或已过期，请检查Token或联系管理员更新",
          code: "INVALID_TOKEN",
        },
        { status: 401 }
      );
    }

    // 将 organizationIds 转换为数字（Duliday API 需要 number[]）
    const numericOrgIds = organizationIds.map(id => {
      const parsed = typeof id === "string" ? parseInt(id, 10) : id;
      if (isNaN(parsed)) {
        throw new Error(`无效的组织ID: ${id}`);
      }
      return parsed;
    });

    // 执行数据同步
    console.log(`[SYNC API] 开始同步组织: ${numericOrgIds.join(", ")}`);

    // 创建流式响应
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 辅助函数：发送消息
          const send = (data: unknown) => {
            controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
          };
          const roundToOneDecimal = (value: number) => Math.round(value * 10) / 10;

          const syncRecord = await syncService.syncMultipleOrganizations(
            numericOrgIds,
            (progress, currentOrg, message) => {
              // 这里的 progress 是同步阶段的进度 (0-100)
              // 我们将其映射到总体进度的 0-50%
              const overallProgress = roundToOneDecimal(progress * 0.5);
              send({
                type: "progress",
                progress: overallProgress,
                currentOrg,
                message: `[同步] ${message}`,
              });
              console.log(`[SYNC API] 进度: ${overallProgress}% - 组织 ${currentOrg}: ${message}`);
            }
          );

          // 🗺️ 对同步后的门店进行批量地理编码
          console.log(`[SYNC API] 开始批量地理编码...`);
          send({
            type: "progress",
            progress: 50,
            message: "开始批量地理编码...",
          });

          // 计算总共需要处理的门店数（用于日志）
          const totalStoresToGeocode = syncRecord.results.reduce(
            (sum, r) => sum + (r.convertedData?.stores?.length || 0),
            0
          );
          console.log(`[SYNC API] 共 ${totalStoresToGeocode} 个门店需要地理编码`);
          const geocodingProgressByBrand = new Map<string, { processed: number; total: number }>();
          let totalGeocodingProcessed = 0;

          for (const result of syncRecord.results) {
            if (result.convertedData?.stores && result.convertedData.stores.length > 0) {
              try {
                // 🔄 注入已知坐标
                if (existingCoordinates) {
                  let matchedCount = 0;
                  result.convertedData.stores = result.convertedData.stores.map(store => {
                    const knownCoords = existingCoordinates[store.location];
                    if (knownCoords) {
                      matchedCount++;
                      return { ...store, coordinates: knownCoords };
                    }
                    return store;
                  });
                  if (matchedCount > 0) {
                    console.log(
                      `[SYNC API] ${result.brandName}: 已匹配 ${matchedCount} 个现有坐标`
                    );
                  }
                }

                const { stores: geocodedStores, stats } =
                  await geocodingService.batchGeocodeStoresWithStats(
                    result.convertedData.stores,
                    (processed, total, currentStats) => {
                      const previousProgress = geocodingProgressByBrand.get(result.brandName);
                      const previousProcessed = previousProgress?.processed ?? 0;
                      const nextProcessed = Math.max(previousProcessed, processed);
                      totalGeocodingProcessed += nextProcessed - previousProcessed;
                      geocodingProgressByBrand.set(result.brandName, {
                        processed: nextProcessed,
                        total,
                      });
                      const geocodingProgress =
                        totalStoresToGeocode > 0
                          ? roundToOneDecimal(
                              50 + (totalGeocodingProcessed / totalStoresToGeocode) * 40
                            )
                          : 50;
                      const overallProgress = Math.min(90, Math.max(50, geocodingProgress));
                      // 计算总体进度 (50% - 90%)
                      // 简化计算：每次更新都发送消息
                      send({
                        type: "geocoding_progress",
                        brandName: result.brandName,
                        processed,
                        total,
                        overallProgress,
                        stats: currentStats,
                      });
                    }
                  );

                result.convertedData.stores = geocodedStores;
                // 添加地理编码统计到结果中
                result.geocodingStats = {
                  total: stats.needsGeocoding,
                  success: stats.success,
                  failed: stats.failed,
                  skipped: stats.skipped,
                  failedStores: stats.failedStores,
                };
                console.log(
                  `[SYNC API] ${result.brandName} 地理编码完成: 成功 ${stats.success}，失败 ${stats.failed}，跳过 ${stats.skipped}`
                );
              } catch (geocodeError) {
                console.warn(`[SYNC API] ${result.brandName} 地理编码失败，跳过:`, geocodeError);
                // 地理编码失败时设置默认统计
                result.geocodingStats = {
                  total: result.convertedData.stores.length,
                  success: 0,
                  failed: result.convertedData.stores.length,
                  skipped: 0,
                  failedStores: result.convertedData.stores.map(s => s.name),
                };
              }
            }
          }

          console.log(`[SYNC API] 同步完成`, {
            success: syncRecord.overallSuccess,
            totalDuration: syncRecord.totalDuration,
            processedBrands: syncRecord.results.length,
          });

          // 发送最终结果
          send({
            type: "result",
            data: syncRecord,
          });

          controller.close();
        } catch (error) {
          console.error("[SYNC API] 流式处理失败:", error);
          const errorMessage = error instanceof Error ? error.message : "同步过程中发生未知错误";
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "error",
                error: errorMessage,
              }) + "\n"
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[SYNC API] 同步请求初始化失败:", error);

    // 处理 Zod 验证错误
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "请求参数验证失败",
          details: error.issues,
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    // 处理其他错误
    const errorMessage = error instanceof Error ? error.message : "同步过程中发生未知错误";

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        code: "SYNC_ERROR",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sync
 *
 * 获取同步状态或配置信息
 * 支持通过查询参数传递客户端token: /api/sync?token=xxx
 */
export async function GET(request: NextRequest) {
  try {
    // 从查询参数获取客户端token
    const { searchParams } = new URL(request.url);
    const clientToken = searchParams.get("token");

    // 确定使用的Token：优先使用客户端传递的token，然后是环境变量
    const dulidayToken = clientToken || process.env.DULIDAY_TOKEN;

    // 检查 Token 配置
    if (!dulidayToken) {
      return NextResponse.json({
        configured: false,
        error: "未找到Duliday Token，请在Token管理中设置或配置环境变量",
        tokenSource: "none",
      });
    }

    // 验证 Token 有效性
    const syncService = createSyncService(dulidayToken);
    const isTokenValid = await syncService.validateToken();

    return NextResponse.json({
      configured: true,
      tokenValid: isTokenValid,
      tokenSource: clientToken ? "client" : "environment",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[SYNC API] 状态检查失败:", error);

    return NextResponse.json(
      {
        configured: false,
        error: error instanceof Error ? error.message : "状态检查失败",
      },
      { status: 500 }
    );
  }
}
