import { NextRequest, NextResponse } from "next/server";
import { createSyncService } from "@/lib/services/duliday-sync.service";
import { z } from "zod";

/**
 * 同步请求体 Schema
 */
const SyncRequestSchema = z.object({
  organizationIds: z.array(z.union([z.number(), z.string()])).min(1, "至少需要选择一个组织ID"),
  pageSize: z.number().optional().default(100),
  validateOnly: z.boolean().optional().default(false),
  token: z.string().optional(), // 支持从客户端传递token
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
    const { organizationIds, validateOnly, token: clientToken } = SyncRequestSchema.parse(body);

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
      const parsed = typeof id === 'string' ? parseInt(id, 10) : id;
      if (isNaN(parsed)) {
        throw new Error(`无效的组织ID: ${id}`);
      }
      return parsed;
    });

    // 执行数据同步
    console.log(`[SYNC API] 开始同步组织: ${numericOrgIds.join(", ")}`);

    const syncRecord = await syncService.syncMultipleOrganizations(
      numericOrgIds,
      (progress, currentOrg, message) => {
        console.log(`[SYNC API] 进度: ${progress}% - 组织 ${currentOrg}: ${message}`);
      }
    );

    console.log(`[SYNC API] 同步完成`, {
      success: syncRecord.overallSuccess,
      totalDuration: syncRecord.totalDuration,
      processedBrands: syncRecord.results.length,
    });

    return NextResponse.json({
      success: true,
      data: syncRecord,
    });
  } catch (error) {
    console.error("[SYNC API] 同步失败:", error);

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
