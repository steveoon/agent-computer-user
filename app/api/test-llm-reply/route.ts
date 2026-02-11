import { NextRequest, NextResponse } from "next/server";
import { generateSmartReply } from "@/lib/agents";
import { DEFAULT_PROVIDER_CONFIGS } from "@/lib/config/models";

export async function POST(request: NextRequest) {
  try {
    const {
      message,
      brand,
      toolBrand,
      modelConfig,
      configData,
      replyPolicy,
      brandPriorityStrategy,
      conversationHistory,
    } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "请提供有效的消息内容" }, { status: 400 });
    }

    // 验证客户端传递的配置数据
    if (!configData) {
      return NextResponse.json(
        { error: "缺少配置数据，请确保客户端正确传递 configData" },
        { status: 400 }
      );
    }

    if (!replyPolicy) {
      return NextResponse.json(
        { error: "缺少回复策略，请确保客户端正确传递 replyPolicy" },
        { status: 400 }
      );
    }

    console.log("✅ test-llm-reply API: 使用客户端传递的配置数据", {
      brands: Object.keys(configData.brands),
      stores: configData.stores.length,
      hasReplyPolicy: !!replyPolicy,
    });

    // 调用新的 Agent-based 智能回复生成函数
    // 使用用户传入的 providerConfigs，如果没有则使用默认配置
    const result = await generateSmartReply({
      candidateMessage: message.trim(),
      conversationHistory: conversationHistory || [],
      preferredBrand: brand, // UI 选择的品牌
      toolBrand, // 工具识别的品牌
      modelConfig: {
        ...modelConfig,
        providerConfigs: modelConfig?.providerConfigs || DEFAULT_PROVIDER_CONFIGS,
      },
      configData,
      replyPolicy,
      brandPriorityStrategy,
    });

    return NextResponse.json({
      success: true,
      reply: result.suggestedReply,
      stage: result.turnPlan.stage,
      needs: result.turnPlan.needs,
      riskFlags: result.turnPlan.riskFlags,
      reasoningText: result.turnPlan.reasoningText,
      debugInfo: result.debugInfo,
      contextInfo: result.contextInfo,
      confidence: result.confidence,
      shouldExchangeWechat: result.shouldExchangeWechat,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("LLM回复生成API错误:", error);

    return NextResponse.json(
      {
        error: "回复生成失败",
        details: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "请使用 POST 方法调用此 API",
    usage: 'POST /api/test-llm-reply with { message: "候选人消息" }',
  });
}
