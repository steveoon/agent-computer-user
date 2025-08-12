import { NextRequest, NextResponse } from "next/server";
import { generateSmartReplyWithLLM } from "../../../lib/loaders/zhipin-data.loader";

export async function POST(request: NextRequest) {
  try {
    const { message, brand, modelConfig, configData, replyPrompts, conversationHistory } =
      await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "请提供有效的消息内容" },
        { status: 400 }
      );
    }

    // 🔧 验证客户端传递的配置数据
    if (!configData) {
      return NextResponse.json(
        { error: "缺少配置数据，请确保客户端正确传递 configData" },
        { status: 400 }
      );
    }

    if (!replyPrompts) {
      return NextResponse.json(
        { error: "缺少回复指令，请确保客户端正确传递 replyPrompts" },
        { status: 400 }
      );
    }

    console.log("✅ test-llm-reply API: 使用客户端传递的配置数据", {
      brands: Object.keys(configData.brands),
      stores: configData.stores.length,
      replyPromptsCount: Object.keys(replyPrompts).length,
    });

    // 调用LLM智能回复生成函数（使用客户端传递的配置数据）
    const reply = await generateSmartReplyWithLLM(
      message.trim(),
      conversationHistory || [], // 对话历史
      brand, // 品牌参数
      modelConfig, // 模型配置参数
      configData, // 🔧 使用客户端传递的配置数据
      replyPrompts // 🔧 使用客户端传递的回复指令
    );

    return NextResponse.json({
      success: true,
      reply: reply.text,
      replyType: reply.replyType,
      reasoningText: reply.reasoningText,
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
