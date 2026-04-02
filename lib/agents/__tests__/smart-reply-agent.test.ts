/**
 * Smart Reply Agent 适配层单元测试
 *
 * 验证适配层正确委托给 @roll-agent/smart-reply-agent/pipeline
 * 并补回 classification 兼容字段
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  SmartReplyAgentOptions as PipelineOptions,
  SmartReplyAgentResult as PipelineResult,
} from "@roll-agent/smart-reply-agent/pipeline";
import { DEFAULT_MODEL_CONFIG } from "@/lib/config/models";

function createMockPipelineResult(): PipelineResult {
  const turnPlan: PipelineResult["turnPlan"] = {
    stage: "job_consultation" as const,
    subGoals: ["回答岗位问题", "推进下一步沟通"],
    needs: ["salary" as const],
    primaryNeed: "salary" as const,
    riskFlags: [],
    confidence: 0.8,
    extractedInfo: {
      mentionedBrand: null,
      city: "成都",
      mentionedLocations: [],
      mentionedDistricts: [],
      specificAge: null,
      hasUrgency: false,
      preferredSchedule: null,
    },
    reasoningText: "候选人询问薪资待遇，进入岗位咨询阶段",
  };

  return {
    turnPlan,
    suggestedReply: "您好！我们的薪资待遇很有竞争力，具体可以进一步沟通。",
    confidence: 0.8,
    shouldExchangeWechat: false,
    factGateRewritten: false,
    replyGateRewritten: false,
    gateViolations: [],
    contextInfo: "品牌：蜀地源冒菜\n当前品牌：蜀地源冒菜",
    debugInfo: {
      relevantStores: [],
      storeCount: 1,
      detailLevel: "minimal" as const,
      resolvedBrand: "蜀地源冒菜",
      turnPlan,
      turnIndex: 1,
      effectiveDisclosureMode: "minimal" as const,
      primaryNeed: "salary" as const,
      replyGateRewritten: false,
      gateViolations: [],
      aliasLookupError: undefined,
      gateStatus: "unknown" as const,
      appliedStrategy: {
        enabled: true,
        revealRange: false,
        failStrategy: "礼貌说明不匹配，避免承诺",
        unknownStrategy: "先核实年龄或资格条件",
        passStrategy: "确认匹配后推进下一步",
        allowRedirect: false,
        redirectPriority: "low" as const,
        status: "unknown" as const,
        strategy: "先核实年龄或资格条件",
      },
      ageRangeSummary: {
        minAgeObserved: null,
        maxAgeObserved: null,
        matchedCount: 0,
        total: 0,
      },
    },
    usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    latencyMs: 1200,
    error: undefined,
  };
}

// Mock the npm package
const mockGenerateSmartReply = vi.fn<(options: PipelineOptions) => Promise<PipelineResult>>();

vi.mock("@roll-agent/smart-reply-agent/pipeline", () => ({
  generateSmartReply: mockGenerateSmartReply,
}));

const sampleConfigData = {
  meta: {
    defaultBrandId: "1",
    syncedAt: new Date().toISOString(),
    source: "test",
  },
  brands: [
    {
      id: "1",
      name: "蜀地源冒菜",
      stores: [
        {
          id: "store-1",
          brandId: "1",
          name: "蜀地源冒菜（春熙路店）",
          city: "成都",
          location: "成都市锦江区春熙路123号",
          district: "锦江区",
          subarea: "春熙路",
          coordinates: { lat: 30.6571, lng: 104.0665 },
          positions: [],
        },
      ],
    },
  ],
} as unknown as import("@/types/zhipin").ZhipinData;

function getFirstPipelineCall(): PipelineOptions | undefined {
  return mockGenerateSmartReply.mock.calls[0]?.[0];
}

describe("Smart Reply Adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateSmartReply.mockResolvedValue(createMockPipelineResult());
  });

  it("should delegate to npm pipeline and return result", async () => {
    const { generateSmartReply } = await import("../smart-reply-agent");
    const mockPipelineResult = createMockPipelineResult();

    const result = await generateSmartReply({
      candidateMessage: "你们工资多少钱一个月？",
      conversationHistory: [],
      configData: sampleConfigData,
    });

    expect(mockGenerateSmartReply).toHaveBeenCalledOnce();
    expect(result.suggestedReply).toBe(mockPipelineResult.suggestedReply);
    expect(result.turnPlan.stage).toBe("job_consultation");
    expect(result.confidence).toBe(0.8);
  });

  it("should add classification compat field from turnPlan", async () => {
    const { generateSmartReply } = await import("../smart-reply-agent");
    const mockPipelineResult = createMockPipelineResult();

    const result = await generateSmartReply({
      candidateMessage: "你们工资多少？",
      conversationHistory: [],
      configData: sampleConfigData,
    });

    expect(result.classification).toBeDefined();
    expect(result.classification.replyType).toBe("salary_inquiry");
    expect(result.classification.extractedInfo.city).toBe("成都");
    expect(result.classification.reasoningText).toBe(mockPipelineResult.turnPlan.reasoningText);
  });

  it("should pass options through to pipeline with normalized modelConfig", async () => {
    const { generateSmartReply } = await import("../smart-reply-agent");

    const options = {
      candidateMessage: "你们工资多少？",
      conversationHistory: ["你好", "你好！"],
      configData: sampleConfigData,
      preferredBrand: "蜀地源冒菜",
      toolBrand: "蜀地源",
      brandPriorityStrategy: "smart" as const,
      modelConfig: { replyModel: "qwen/qwen-plus-latest" },
      defaultWechatId: "hr_123",
      industryVoiceId: "default",
      channelType: "public" as const,
    };

    await generateSmartReply(options);

    const calledOptions = getFirstPipelineCall();

    expect(calledOptions).toMatchObject({
      candidateMessage: options.candidateMessage,
      conversationHistory: options.conversationHistory,
      configData: options.configData,
      preferredBrand: options.preferredBrand,
      toolBrand: options.toolBrand,
      brandPriorityStrategy: options.brandPriorityStrategy,
      defaultWechatId: options.defaultWechatId,
      industryVoiceId: options.industryVoiceId,
      channelType: options.channelType,
      modelConfig: {
        chatModel: DEFAULT_MODEL_CONFIG.chatModel,
        classifyModel: DEFAULT_MODEL_CONFIG.classifyModel,
        replyModel: "qwen/qwen-plus-latest",
      },
    });
  });

  it("should pass through supported provider models and downgrade openrouter", async () => {
    const { generateSmartReply } = await import("../smart-reply-agent");

    await generateSmartReply({
      candidateMessage: "你好",
      conversationHistory: [],
      configData: sampleConfigData,
      modelConfig: {
        classifyModel: "openai/gpt-5-chat-latest",
        replyModel: "openrouter/anthropic/claude-sonnet-4",
      },
    });

    const normalizedConfig = getFirstPipelineCall()?.modelConfig;

    // openai/* 是已注册 provider，直接透传
    expect(normalizedConfig?.classifyModel).toBe("openai/gpt-5-chat-latest");
    // openrouter/* 降级为同家直连模型
    expect(normalizedConfig?.replyModel).toBe("anthropic/claude-sonnet-4-6");
  });

  it("should inject host defaults when modelConfig is omitted", async () => {
    const { generateSmartReply } = await import("../smart-reply-agent");

    await generateSmartReply({
      candidateMessage: "你好",
      conversationHistory: [],
      configData: sampleConfigData,
    });

    expect(getFirstPipelineCall()?.modelConfig).toEqual({
      chatModel: DEFAULT_MODEL_CONFIG.chatModel,
      classifyModel: DEFAULT_MODEL_CONFIG.classifyModel,
      replyModel: DEFAULT_MODEL_CONFIG.replyModel,
    });
  });

  it("should fall back to host defaults for unknown providers", async () => {
    const { generateSmartReply } = await import("../smart-reply-agent");

    await generateSmartReply({
      candidateMessage: "你好",
      conversationHistory: [],
      configData: sampleConfigData,
      modelConfig: {
        classifyModel: "xai/grok-3-beta",
        replyModel: "custom-proxy/reply-model",
      },
    });

    const normalizedConfig = getFirstPipelineCall()?.modelConfig;

    expect(normalizedConfig?.classifyModel).toBe(DEFAULT_MODEL_CONFIG.classifyModel);
    expect(normalizedConfig?.replyModel).toBe(DEFAULT_MODEL_CONFIG.replyModel);
  });

  it("should adapt debugInfo with classification field", async () => {
    const { generateSmartReply } = await import("../smart-reply-agent");

    const result = await generateSmartReply({
      candidateMessage: "有什么岗位？",
      conversationHistory: [],
      configData: sampleConfigData,
    });

    expect(result.debugInfo).toBeDefined();
    expect(result.debugInfo?.classification).toBeDefined();
    expect(result.debugInfo?.gateStatus).toBe("unknown");
    expect(result.debugInfo?.storeCount).toBe(1);
    expect(result.debugInfo?.resolvedBrand).toBe("蜀地源冒菜");
    expect(result.debugInfo?.turnIndex).toBe(1);
    expect(result.debugInfo?.primaryNeed).toBe("salary");
  });

  it("should forward error from pipeline", async () => {
    const baseResult = createMockPipelineResult();
    const errorResult: PipelineResult = {
      ...baseResult,
      suggestedReply: "",
      confidence: 0,
      error: {
        code: "LLM_GENERATION_FAILED",
        message: "Model timeout",
        userMessage: "回复生成超时",
      } as NonNullable<PipelineResult["error"]>,
    };
    mockGenerateSmartReply.mockResolvedValueOnce(errorResult);

    const { generateSmartReply } = await import("../smart-reply-agent");

    const result = await generateSmartReply({
      candidateMessage: "你好",
      conversationHistory: [],
      configData: sampleConfigData,
    });

    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe("LLM_GENERATION_FAILED");
    expect(result.suggestedReply).toBe("");
  });

  it("should map interview_scheduling stage to shouldExchangeWechat", async () => {
    const baseResult = createMockPipelineResult();
    mockGenerateSmartReply.mockResolvedValueOnce({
      ...baseResult,
      turnPlan: { ...baseResult.turnPlan, stage: "interview_scheduling" as const },
      shouldExchangeWechat: true,
    });

    const { generateSmartReply } = await import("../smart-reply-agent");

    const result = await generateSmartReply({
      candidateMessage: "我可以来面试吗？",
      conversationHistory: [],
      configData: sampleConfigData,
    });

    expect(result.shouldExchangeWechat).toBe(true);
  });

  it("should preserve gate metadata from pipeline result", async () => {
    const baseResult = createMockPipelineResult();
    mockGenerateSmartReply.mockResolvedValueOnce({
      ...baseResult,
      factGateRewritten: true,
      replyGateRewritten: true,
      gateViolations: ["too_many_questions"],
    });

    const { generateSmartReply } = await import("../smart-reply-agent");

    const result = await generateSmartReply({
      candidateMessage: "你好",
      conversationHistory: [],
      configData: sampleConfigData,
    });

    expect(result.factGateRewritten).toBe(true);
    expect(result.replyGateRewritten).toBe(true);
    expect(result.gateViolations).toEqual(["too_many_questions"]);
  });

  it("should handle undefined debugInfo gracefully", async () => {
    const baseResult = createMockPipelineResult();
    mockGenerateSmartReply.mockResolvedValueOnce({
      ...baseResult,
      debugInfo: undefined,
    });

    const { generateSmartReply } = await import("../smart-reply-agent");

    const result = await generateSmartReply({
      candidateMessage: "你好",
      conversationHistory: [],
      configData: sampleConfigData,
    });

    expect(result.debugInfo).toBeUndefined();
    expect(result.classification).toBeDefined(); // classification still works
  });
});
