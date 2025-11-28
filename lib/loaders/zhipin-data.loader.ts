/**
 * 🎯 Boss直聘数据加载器 - 重构版
 * 从 localforage 配置服务中加载数据，替代硬编码文件
 */

import { getDynamicRegistry } from "@/lib/model-registry/dynamic-registry";
import {
  ZhipinData,
  MessageClassification,
  ReplyContextSchema,
  ReplyContext,
  Store,
  Position,
} from "../../types/zhipin";
import { generateText, generateObject } from "ai";
import { z } from "zod";
import {
  getBrandData,
  getReplyPrompts,
  migrateFromHardcodedData,
  needsMigration,
} from "../services/config.service";
import type { ReplyPromptsConfig, BrandPriorityStrategy } from "../../types/config";
import { DEFAULT_PROVIDER_CONFIGS, DEFAULT_MODEL_CONFIG } from "@/lib/config/models";
import type { ModelConfig } from "@/lib/config/models";
import type { CandidateInfo } from "@/lib/tools/zhipin/types";
import type { SalaryDetails } from "../../types/zhipin";
import type { BrandResolutionInput, BrandResolutionOutput } from "../../types/brand-resolution";
import {
  geocodingService,
  extractCityFromAddress,
  mostFrequent,
  isValidCoordinates,
} from "../services/geocoding.service";
import type { StoreWithDistance } from "@/types/geocoding";
// 使用新的模块化 prompt engineering
import {
  ClassificationPromptBuilder,
  ReplyPromptBuilder,
  type ClassificationParams,
  type ReplyBuilderParams,
} from "@/lib/prompt-engineering";

/**
 * 🔧 智能薪资描述构建器
 * 根据base值和memo内容智能判断薪资类型，生成合适的描述
 * @param salary 薪资详情对象
 * @returns 格式化的薪资描述字符串
 */
function buildSalaryDescription(salary: SalaryDetails): string {
  const { base, range, memo } = salary;

  // 🎯 简单启发式判断：base值很小时可能是计件制
  const isPossiblyPieceRate = base < 10; // 小于10元通常不是时薪

  // 🔧 构建基础薪资信息
  let description = "";

  if (isPossiblyPieceRate && memo) {
    // 可能是计件制，包含memo信息让LLM理解
    description = `${base}元（${memo.replace(/\n/g, " ").trim()}）`;
  } else {
    // 常规时薪
    description = `${base}元/时`;
    if (range && range !== `${base}-${base}`) {
      description += `，范围${range}元`;
    }
    // 如果有memo且不太长，也包含进来
    if (memo && memo.length < 50) {
      description += `（${memo.replace(/\n/g, " ").trim()}）`;
    }
  }

  return description;
}

/**
 * 🎯 加载Boss直聘相关数据 - 重构版
 * 优先使用传入的配置数据，仅在浏览器环境中作为备用加载器
 * @param preferredBrand 优先使用的品牌（可选）
 * @param configData 预加载的配置数据（服务端调用时必须提供）
 * @returns Promise<ZhipinData> 返回加载的数据
 */
export async function loadZhipinData(
  preferredBrand?: string,
  configData?: ZhipinData
): Promise<ZhipinData> {
  try {
    // 🎯 如果提供了配置数据，优先使用
    if (configData) {
      console.log("✅ 使用传入的配置数据");

      // 不再在这里修改 defaultBrand，保持原始配置数据不变
      // 品牌解析逻辑将在 resolveBrandConflict 中统一处理

      const totalPositions = configData.stores.reduce(
        (sum, store) => sum + store.positions.length,
        0
      );
      console.log(
        `📊 数据统计: ${configData.stores.length} 家门店，${totalPositions} 个岗位${
          preferredBrand ? ` - UI选择品牌: ${preferredBrand}` : ""
        }`
      );
      return configData;
    }

    // 🌐 浏览器环境备用逻辑：从 localforage 加载
    if (typeof window !== "undefined") {
      console.log("🌐 浏览器环境，从 localforage 加载配置");

      // 检查是否需要迁移
      if (await needsMigration()) {
        console.log("🔄 检测到首次使用，正在自动执行数据迁移...");
        try {
          await migrateFromHardcodedData();
          console.log("✅ 数据迁移完成");
        } catch (migrationError) {
          console.error("❌ 自动迁移失败:", migrationError);
          throw new Error("浏览器环境数据迁移失败");
        }
      }

      // 从配置服务加载品牌数据
      const brandData = await getBrandData();
      if (!brandData) {
        throw new Error("浏览器环境配置数据未找到");
      }

      // 应用品牌选择（与上面的逻辑保持一致）
      let effectiveBrand = brandData.defaultBrand || Object.keys(brandData.brands)[0];

      if (preferredBrand) {
        const matchedBrand = fuzzyMatchBrand(preferredBrand, Object.keys(brandData.brands));
        if (matchedBrand) {
          effectiveBrand = matchedBrand;
          if (matchedBrand === preferredBrand) {
            console.log(`✅ 品牌精确匹配成功: ${preferredBrand}`);
          } else {
            console.log(`🔄 品牌模糊匹配成功: ${preferredBrand} → ${matchedBrand}`);
          }
        } else {
          console.warn(`⚠️ 品牌 "${preferredBrand}" 未找到匹配，使用默认品牌: ${effectiveBrand}`);
        }
      }

      const effectiveData = {
        ...brandData,
        defaultBrand: effectiveBrand,
      };

      const totalPositions = effectiveData.stores.reduce(
        (sum, store) => sum + store.positions.length,
        0
      );
      console.log(
        `✅ 已从配置服务加载 ${effectiveData.stores.length} 家门店数据 (${totalPositions} 个岗位)${
          preferredBrand ? ` - 当前品牌: ${preferredBrand}` : ""
        }`
      );
      return effectiveData;
    }

    // 🚨 服务端环境必须提供配置数据
    throw new Error("服务端环境必须提供 configData 参数，不再支持硬编码数据读取");
  } catch (error) {
    console.error("❌ 数据加载失败:", error);
    throw error; // 不再降级，明确报错
  }
}

/**
 * 模糊匹配品牌名称
 * @param inputBrand 用户输入的品牌名
 * @param availableBrands 可用的品牌列表
 * @returns 匹配的品牌名或null
 */
export function fuzzyMatchBrand(inputBrand: string, availableBrands: string[]): string | null {
  if (!inputBrand) return null;

  const inputLower = inputBrand.toLowerCase();

  // 1. 精确匹配（忽略大小写）
  const exactMatch = availableBrands.find(brand => brand.toLowerCase() === inputLower);
  if (exactMatch) {
    return exactMatch;
  }

  // 2. 包含匹配（品牌名包含输入或输入包含品牌名，忽略大小写）
  // 收集所有匹配项，然后选择最具体的（最长的）
  const containsMatches = availableBrands.filter(brand => {
    const brandLower = brand.toLowerCase();
    return brandLower.includes(inputLower) || inputLower.includes(brandLower);
  });

  if (containsMatches.length > 0) {
    // 优先返回最长的匹配（更具体的品牌名）
    return containsMatches.sort((a, b) => b.length - a.length)[0];
  }

  // 3. 特殊处理：山姆相关的匹配
  if (inputLower.includes("山姆") || inputLower.includes("sam")) {
    const samBrand = availableBrands.find(brand => {
      const brandLower = brand.toLowerCase();
      return brandLower.includes("山姆") || brandLower.includes("sam");
    });
    if (samBrand) {
      return samBrand;
    }
  }

  return null;
}

/**
 * 获取品牌名称（支持多品牌结构）
 * @param data Boss直聘数据
 * @param preferredBrand 优先使用的品牌
 * @returns 品牌名称
 */
function getBrandName(data: ZhipinData, preferredBrand?: string): string {
  if (preferredBrand && data.brands[preferredBrand]) {
    return preferredBrand;
  }
  return data.defaultBrand || Object.keys(data.brands)[0] || "未知品牌";
}

/**
 * 根据消息内容和上下文生成智能回复
 * @param data Boss直聘数据
 * @param message 候选人消息
 * @param context 回复上下文
 * @returns 生成的回复内容
 */
export function generateSmartReply(
  data: ZhipinData,
  message: string = "",
  context: string = "initial_inquiry"
): string {
  const msg = message.toLowerCase();

  // 1. 主动沟通/初次咨询场景
  if (
    context === "initial_inquiry" ||
    msg.includes("咨询") ||
    msg.includes("兼职") ||
    msg.includes("工作")
  ) {
    // 🎯 使用数据对象中的默认品牌（已在 loadZhipinData 中设置为用户选择的品牌）
    const targetBrand = getBrandName(data);
    const brandStores = data.stores.filter(store => store.brand === targetBrand);

    // 如果指定品牌没有门店，返回明确的提示
    const availableStores = brandStores;
    if (brandStores.length === 0) {
      console.warn(`⚠️ 品牌 "${targetBrand}" 没有找到任何门店`);
      return `抱歉，${targetBrand}暂时没有招聘信息，请稍后再试或联系客服了解详情。`;
    }

    const randomStore = availableStores[Math.floor(Math.random() * availableStores.length)];
    const randomPosition =
      randomStore.positions[Math.floor(Math.random() * randomStore.positions.length)];

    // 使用实际选中门店的品牌名，而不是目标品牌名
    const actualBrand = randomStore.brand;
    // 使用门店级别的城市，优先级：门店 city > 全局 data.city
    const storeCity = getStoreCity(randomStore, data.city);
    let reply = `你好，${storeCity}各区有${actualBrand}门店岗位空缺，兼职排班 ${randomPosition.workHours} 小时。基本薪资：${randomPosition.salary.base} 元/小时。`;
    if (randomPosition.salary.range) {
      reply += `薪资范围：${randomPosition.salary.range}。`;
    }
    if (randomPosition.salary.bonus) {
      reply += `奖金：${randomPosition.salary.bonus}。`;
    }

    // 添加排班类型和灵活性信息
    const scheduleTypeText = getScheduleTypeText(randomPosition.scheduleType);
    reply += `排班方式：${scheduleTypeText}`;

    if (randomPosition.schedulingFlexibility.partTimeAllowed) {
      reply += "，支持兼职";
    }
    if (randomPosition.schedulingFlexibility.canSwapShifts) {
      reply += "，可换班";
    }

    return reply;
  }

  // 2. 位置咨询场景（合并了原来的 location_inquiry 和 location_match）
  if (
    context === "location_inquiry" ||
    msg.includes("位置") ||
    msg.includes("在哪") ||
    msg.includes("地址") ||
    msg.includes("哪里")
  ) {
    // 动态提取所有区域名称
    const districts = new Set<string>();
    data.stores.forEach(store => {
      if (store.district) districts.add(store.district);
      if (store.subarea) districts.add(store.subarea);
    });

    let matchedStore = null;

    // 检查消息中是否包含任何区域名称
    for (const district of districts) {
      if (msg.includes(district.toLowerCase())) {
        matchedStore = data.stores.find(
          store =>
            store.district.toLowerCase().includes(district.toLowerCase()) ||
            store.subarea.toLowerCase().includes(district.toLowerCase())
        );
        if (matchedStore) break;
      }
    }

    // 如果找到匹配的门店，返回具体位置
    if (matchedStore && matchedStore.positions.length > 0) {
      const position = matchedStore.positions[0];
      const timeSlot = position.timeSlots[0];
      return `目前离你比较近在 ${matchedStore.location}，空缺 ${timeSlot}`;
    }

    // 否则询问用户位置
    // 🔧 优先级: 门店 store.city → 门店地址提取 → data.city (fallback)
    const inferredCity = inferCityFromStores(data.stores, data.city);
    return `你好，${inferredCity}目前各区有门店岗位空缺，你在什么位置？我可以查下你附近`;
  }

  // 3. 时间安排咨询
  if (
    context === "schedule_inquiry" ||
    msg.includes("时间") ||
    msg.includes("班次") ||
    msg.includes("排班")
  ) {
    // 🎯 使用数据对象中的默认品牌（已在 loadZhipinData 中设置为用户选择的品牌）
    const targetBrand = getBrandName(data);
    const brandStores = data.stores.filter(store => store.brand === targetBrand);

    // 如果指定品牌没有门店，返回明确的提示
    const availableStores = brandStores;
    if (brandStores.length === 0) {
      console.warn(`⚠️ 品牌 "${targetBrand}" 没有找到任何门店`);
      return `抱歉，${targetBrand}暂时没有招聘信息，请稍后再试或联系客服了解详情。`;
    }

    const randomStore = availableStores[Math.floor(Math.random() * availableStores.length)];
    const position = randomStore.positions[0];

    // 使用新的排班信息构建回复
    let reply = `门店除了${position.timeSlots[0]}空缺，还有${
      position.timeSlots[1] || position.timeSlots[0]
    }也空缺呢`;

    // 添加排班类型信息
    const scheduleTypeText = getScheduleTypeText(position.scheduleType);
    reply += `，排班方式是${scheduleTypeText}`;

    // 添加灵活性信息
    if (position.schedulingFlexibility.canSwapShifts) {
      reply += "，可以换班";
    }
    if (position.schedulingFlexibility.partTimeAllowed) {
      reply += "，支持兼职";
    }

    reply += "，具体时间可以和店长商量呢";
    return reply;
  }

  // 4. 面试邀约场景
  if (
    context === "interview_request" ||
    msg.includes("面试") ||
    msg.includes("去店里") ||
    msg.includes("什么时候")
  ) {
    return "可以帮你和店长约面试，麻烦加一下我微信吧，需要几项简单的个人信息";
  }

  // 5. 年龄相关问题处理
  if (msg.includes("年龄") || msg.includes("岁")) {
    if (msg.includes("50") || msg.includes("五十") || msg.includes("18") || msg.includes("十八")) {
      return "你附近目前没有岗位空缺了";
    }
    return "你的年龄没问题的";
  }

  // 6. 社保相关问题
  if (msg.includes("社保") || msg.includes("保险")) {
    return "有商业保险";
  }

  // 7. 薪资咨询
  if (msg.includes("工资") || msg.includes("薪资") || msg.includes("多少钱")) {
    // 🎯 使用数据对象中的默认品牌（已在 loadZhipinData 中设置为用户选择的品牌）
    const targetBrand = getBrandName(data);
    const brandStores = data.stores.filter(store => store.brand === targetBrand);
    const availableStores = brandStores.length > 0 ? brandStores : data.stores;

    const randomStore = availableStores[Math.floor(Math.random() * availableStores.length)];
    const position = randomStore.positions[0];

    let reply = `基本薪资是 ${position.salary.base} 元/小时`;
    if (position.salary.range) {
      reply += `，薪资范围：${position.salary.range}`;
    }
    if (position.salary.bonus) {
      reply += `，奖金：${position.salary.bonus}`;
    }
    return reply;
  }

  // 8. 通用私聊话术（保持联系）
  if (context === "general_chat") {
    // 🎯 使用数据对象中的默认品牌（已在 loadZhipinData 中设置为用户选择的品牌）
    const brandName = getBrandName(data);

    const alternatives = [
      `门店除了服务员岗位还有洗碗工岗位也空缺的，如果服务员觉得不合适，可以和店长商量呢`,
      `门店除了早班空缺，还有晚班也空缺呢，如果对排班时间有要求，可以和店长商量呢`,
      `这家门店不合适也没关系的，以后还有其他店空缺的，到时候可以再报名呢`,
      `${brandName}您愿意做吗？我同时还负责其他品牌的招募，您要有兴趣的话，可以看看呢？`,
    ];
    return alternatives[Math.floor(Math.random() * alternatives.length)];
  }

  // 9. 默认回复
  // 🔧 优先级: 门店 store.city → 门店地址提取 → data.city (fallback)
  const defaultCity = inferCityFromStores(data.stores, data.city);
  return `你好，${defaultCity}目前各区有门店岗位空缺，你在什么位置？我可以查下你附近`;
}

/**
 * 使用LLM分析候选人消息的意图和提取关键信息
 * @param message 候选人消息
 * @param conversationHistory 对话历史（可选）
 * @param data Boss直聘数据
 * @param modelConfig 模型配置（可选）
 * @returns Promise<Classification> 分类结果
 */
export async function classifyUserMessage(
  message: string = "",
  conversationHistory: string[] = [],
  data: ZhipinData,
  modelConfig?: ModelConfig,
  candidateInfo?: CandidateInfo
): Promise<MessageClassification> {
  // 🎯 获取配置的模型和provider设置
  const classifyModel = modelConfig?.classifyModel || DEFAULT_MODEL_CONFIG.classifyModel;
  const providerConfigs = modelConfig?.providerConfigs || DEFAULT_PROVIDER_CONFIGS;

  // 使用动态registry
  const dynamicRegistry = getDynamicRegistry(providerConfigs);

  console.log(`[CLASSIFY] 使用模型: ${classifyModel}`);

  // 创建分类构建器
  const classificationBuilder = new ClassificationPromptBuilder();

  // 构建分类参数（城市从门店推断，优先级：门店 city > 全局 data.city）
  const inferredCity = inferCityFromStores(data.stores, data.city);
  const classificationParams: ClassificationParams = {
    message,
    conversationHistory,
    candidateInfo,
    brandData: {
      city: inferredCity,
      defaultBrand: data.defaultBrand || getBrandName(data),
      availableBrands: Object.keys(data.brands),
      storeCount: data.stores.length,
    },
  };

  // 构建分类提示
  const classificationPrompts = classificationBuilder.build(classificationParams);

  // 使用generateObject进行智能分类
  const { object: classification } = await generateObject({
    model: dynamicRegistry.languageModel(classifyModel),
    schema: z.object({
      replyType: ReplyContextSchema.describe("回复类型分类"),
      extractedInfo: z
        .object({
          mentionedBrand: z.string().nullable().optional().describe("提到的品牌名称"),
          city: z.string().nullable().optional().describe("提到的工作城市"),
          mentionedLocations: z
            .array(
              z.object({
                location: z.string().describe("地点名称"),
                confidence: z.number().min(0).max(1).describe("地点识别置信度 0-1"),
              })
            )
            .max(10)
            .nullable()
            .optional()
            .describe("提到的具体位置（按置信度排序，最多10个）"),
          mentionedDistricts: z
            .array(
              z.object({
                district: z.string().describe("区域名称"),
                confidence: z.number().min(0).max(1).describe("区域识别置信度 0-1"),
              })
            )
            .max(10)
            .nullable()
            .optional()
            .describe(
              "提到的区域 (按置信度排序,最多10个), 如果没有提到区域, 依据Location给出多个距离最近的区域"
            ),
          specificAge: z.number().nullable().optional().describe("提到的具体年龄"),
          hasUrgency: z.boolean().nullable().optional().describe("是否表达紧急需求"),
          preferredSchedule: z.string().nullable().optional().describe("偏好的工作时间"),
        })
        .describe("从消息中提取的关键信息"),
      reasoningText: z.string().describe("分类依据和分析过程"),
    }),
    system: classificationPrompts.system,
    prompt: classificationPrompts.prompt,
  });

  return classification;
}

/**
 * 基于LLM的智能回复生成函数 - 重构版
 * 优先使用传入的配置数据，服务端调用时必须提供
 * @param message 候选人消息
 * @param conversationHistory 对话历史（可选）
 * @param preferredBrand UI选择的品牌（可选）
 * @param toolBrand 工具调用时从职位详情识别的品牌（可选）
 * @param modelConfig 模型配置（可选）
 * @param configData 预加载的配置数据（服务端调用时必须提供）
 * @param replyPrompts 预加载的回复指令（服务端调用时必须提供）
 * @param candidateInfo 候选人信息（可选）
 * @param defaultWechatId 默认微信号（可选）
 * @param brandPriorityStrategy 品牌冲突处理策略（可选，默认 "smart"）
 * @returns Promise<{replyType: string, text: string, reasoning: string}> 生成的智能回复、分类类型和分类依据
 */
export async function generateSmartReplyWithLLM(
  message: string = "",
  conversationHistory: string[] = [],
  preferredBrand?: string,
  toolBrand?: string,
  modelConfig?: ModelConfig,
  configData?: ZhipinData,
  replyPrompts?: ReplyPromptsConfig,
  candidateInfo?: CandidateInfo,
  defaultWechatId?: string,
  brandPriorityStrategy?: BrandPriorityStrategy
): Promise<{
  replyType: string;
  text: string;
  reasoningText: string;
  debugInfo?: {
    relevantStores: StoreWithDistance[];
    storeCount: number;
    detailLevel: string;
    classification: MessageClassification;
  };
  contextInfo?: string;
}> {
  try {
    // 🎯 获取配置的模型和provider设置
    const replyModel = modelConfig?.replyModel || DEFAULT_MODEL_CONFIG.replyModel;
    const providerConfigs = modelConfig?.providerConfigs || DEFAULT_PROVIDER_CONFIGS;

    // 使用动态registry
    const dynamicRegistry = getDynamicRegistry(providerConfigs);

    console.log(`[REPLY] 使用模型: ${replyModel}`);

    // 🎯 优先使用传入的配置数据
    let data: ZhipinData;
    let effectiveReplyPrompts: ReplyPromptsConfig;

    if (configData && replyPrompts) {
      console.log("✅ 使用传入的配置数据和回复指令");
      data = await loadZhipinData(preferredBrand, configData);
      effectiveReplyPrompts = replyPrompts;
    } else if (typeof window !== "undefined") {
      // 🌐 浏览器环境备用：从 localforage 加载
      console.log("🌐 浏览器环境，从配置服务加载数据");
      data = await loadZhipinData(preferredBrand);

      const loadedReplyPrompts = await getReplyPrompts();
      if (!loadedReplyPrompts) {
        throw new Error("浏览器环境回复指令配置未找到");
      }
      effectiveReplyPrompts = loadedReplyPrompts;
    } else {
      // 🚨 服务端环境必须提供配置数据
      throw new Error("服务端环境必须提供 configData 和 replyPrompts 参数");
    }

    // 第一步：使用独立的分类函数进行智能分类
    const classification = await classifyUserMessage(
      message,
      conversationHistory,
      data,
      modelConfig, // 传递模型配置
      candidateInfo // 传递候选人信息
    );

    const systemPromptInstruction =
      effectiveReplyPrompts[classification.replyType as keyof typeof effectiveReplyPrompts] ||
      effectiveReplyPrompts.general_chat;

    // 构建上下文信息并获取解析后的品牌（异步：支持真实距离计算）
    const { contextInfo, resolvedBrand, debugInfo } = await buildContextInfo(
      data,
      classification,
      preferredBrand,
      toolBrand,
      brandPriorityStrategy,
      candidateInfo // 传递候选人信息，用于获取 jobAddress
    );

    // 创建回复构建器
    const replyBuilder = new ReplyPromptBuilder();

    // 构建回复参数（使用解析后的品牌，确保一致性）
    const replyParams: ReplyBuilderParams = {
      message,
      classification,
      contextInfo,
      systemInstruction: systemPromptInstruction,
      conversationHistory,
      candidateInfo,
      targetBrand: resolvedBrand, // 🎯 使用解析后的品牌，而非用户原始选择
      defaultWechatId,
    };

    // 使用新的构建器生成提示
    const optimizedPrompts = replyBuilder.build(replyParams);

    // 生成最终回复
    const finalReply = await generateText({
      model: dynamicRegistry.languageModel(replyModel),
      system: optimizedPrompts.system,
      prompt: optimizedPrompts.prompt,
    });

    // 更新对话内存（通过builder内部的内存管理器）
    replyBuilder.updateMemory(message, finalReply.text);

    // 定期清理内存
    if (Math.random() < 0.1) {
      replyBuilder.cleanupMemory();
    }

    return {
      replyType: classification.replyType,
      text: finalReply.text,
      reasoningText: classification.reasoningText,
      debugInfo,
      contextInfo,
    };
  } catch (error) {
    console.error("LLM智能回复生成失败:", error);

    try {
      // 降级逻辑：仅在浏览器环境中尝试
      if (typeof window !== "undefined") {
        console.log("🔄 降级模式：尝试从浏览器配置加载");
        const data = await loadZhipinData(preferredBrand);

        // 尝试使用分类功能确定回复类型
        let replyContext = "initial_inquiry"; // 默认值

        try {
          const classification = await classifyUserMessage(
            message,
            conversationHistory,
            data,
            modelConfig // 传递模型配置
          );
          replyContext = classification.replyType;
          console.log(`✅ 降级模式使用分类结果: ${replyContext}`);
        } catch (classificationError) {
          console.error("分类功能也失败，使用默认分类:", classificationError);
          // 保持默认值 "initial_inquiry"
        }

        return {
          replyType: replyContext,
          text: generateSmartReply(data, message, replyContext),
          reasoningText: "降级模式：使用规则引擎生成回复",
        };
      } else {
        // 服务端环境降级：返回错误回复
        console.error("服务端环境无法降级，缺少必要的配置数据");
        return {
          replyType: "error",
          text: "抱歉，当前系统繁忙，请稍后再试或直接联系我们的客服。",
          reasoningText: "系统错误：服务端环境缺少必要的配置数据",
        };
      }
    } catch (dataError) {
      console.error("降级模式数据加载失败，返回通用错误回复:", dataError);
      // 最终降级：返回通用错误回复
      return {
        replyType: "error",
        text: "抱歉，当前系统繁忙，请稍后再试或直接联系我们的客服。",
        reasoningText: "系统错误：数据加载失败",
      };
    }
  }
}

/**
 * 解析品牌冲突，根据策略返回最终品牌
 *
 * 品牌来源优先级说明：
 * - user-selected: UI选择 → 配置默认 → 第一个可用品牌
 * - conversation-extracted: 对话提取 → UI选择 → 配置默认 → 第一个可用品牌
 * - smart: 对话提取 → UI选择 → 配置默认 → 第一个可用品牌（带智能判断）
 *
 * @param input 品牌解析输入参数
 * @returns 解析后的品牌和决策原因
 */
export function resolveBrandConflict(input: BrandResolutionInput): BrandResolutionOutput {
  const {
    uiSelectedBrand,
    configDefaultBrand,
    conversationBrand,
    availableBrands,
    strategy = "smart",
  } = input;

  // 记录解析尝试历史
  const attempts: Array<{
    source: string;
    value: string | undefined;
    matched: boolean;
    reason: string;
  }> = [];

  // 辅助函数：尝试匹配品牌
  const tryMatchBrand = (brand: string | undefined, source: string): string | undefined => {
    if (!brand) {
      attempts.push({ source, value: undefined, matched: false, reason: "未提供" });
      return undefined;
    }

    const matched = fuzzyMatchBrand(brand, availableBrands);
    if (matched) {
      const isExact = matched === brand;
      attempts.push({
        source,
        value: brand,
        matched: true,
        reason: isExact ? "精确匹配" : `模糊匹配 (${brand} → ${matched})`,
      });
      return matched;
    }

    attempts.push({ source, value: brand, matched: false, reason: "无法匹配到可用品牌" });
    return undefined;
  };

  // 根据策略执行不同的优先级逻辑
  switch (strategy) {
    case "user-selected": {
      // 优先级：UI选择 → 配置默认 → 第一个可用品牌
      // 1. 尝试 UI 选择的品牌
      const uiMatched = tryMatchBrand(uiSelectedBrand, "UI选择");
      if (uiMatched) {
        return {
          resolvedBrand: uiMatched,
          matchType: uiMatched === uiSelectedBrand ? "exact" : "fuzzy",
          source: "ui",
          reason: `用户选择策略: 使用UI选择的品牌 (${uiSelectedBrand}${uiMatched !== uiSelectedBrand ? ` → ${uiMatched}` : ""})`,
          originalInput: uiSelectedBrand,
        };
      }

      // 2. 尝试配置默认品牌
      const configMatched = tryMatchBrand(configDefaultBrand, "配置默认");
      if (configMatched) {
        return {
          resolvedBrand: configMatched,
          matchType: configMatched === configDefaultBrand ? "exact" : "fuzzy",
          source: "config",
          reason: `用户选择策略: UI品牌无法匹配，使用配置默认 (${configDefaultBrand}${configMatched !== configDefaultBrand ? ` → ${configMatched}` : ""})`,
          originalInput: configDefaultBrand,
        };
      }

      // 3. 使用第一个可用品牌
      const fallback = availableBrands[0];
      return {
        resolvedBrand: fallback,
        matchType: "fallback",
        source: "default",
        reason: `用户选择策略: 无有效品牌输入，使用系统默认 (${fallback})`,
      };
    }

    case "conversation-extracted": {
      // 优先级：对话提取 → UI选择 → 配置默认 → 第一个可用品牌
      // 1. 尝试对话提取的品牌
      const conversationMatched = tryMatchBrand(conversationBrand, "对话提取");
      if (conversationMatched) {
        return {
          resolvedBrand: conversationMatched,
          matchType: conversationMatched === conversationBrand ? "exact" : "fuzzy",
          source: "conversation",
          reason: `对话提取策略: 使用对话中提取的品牌 (${conversationBrand}${conversationMatched !== conversationBrand ? ` → ${conversationMatched}` : ""})`,
          originalInput: conversationBrand,
        };
      }

      // 2. 尝试 UI 选择的品牌
      const uiMatched = tryMatchBrand(uiSelectedBrand, "UI选择");
      if (uiMatched) {
        return {
          resolvedBrand: uiMatched,
          matchType: uiMatched === uiSelectedBrand ? "exact" : "fuzzy",
          source: "ui",
          reason: `对话提取策略: 对话品牌无法匹配，使用UI选择 (${uiSelectedBrand}${uiMatched !== uiSelectedBrand ? ` → ${uiMatched}` : ""})`,
          originalInput: uiSelectedBrand,
        };
      }

      // 3. 尝试配置默认品牌
      const configMatched = tryMatchBrand(configDefaultBrand, "配置默认");
      if (configMatched) {
        return {
          resolvedBrand: configMatched,
          matchType: configMatched === configDefaultBrand ? "exact" : "fuzzy",
          source: "config",
          reason: `对话提取策略: 无有效对话/UI品牌，使用配置默认 (${configDefaultBrand}${configMatched !== configDefaultBrand ? ` → ${configMatched}` : ""})`,
          originalInput: configDefaultBrand,
        };
      }

      // 4. 使用第一个可用品牌
      const fallback = availableBrands[0];
      return {
        resolvedBrand: fallback,
        matchType: "fallback",
        source: "default",
        reason: `对话提取策略: 无有效品牌输入，使用系统默认 (${fallback})`,
      };
    }

    case "smart":
    default: {
      // 优先级：对话提取 → UI选择 → 配置默认 → 第一个可用品牌
      // 特殊逻辑：如果对话品牌和UI品牌都存在且不同，进行智能判断
      const conversationMatched = tryMatchBrand(conversationBrand, "对话提取");
      const uiMatched = tryMatchBrand(uiSelectedBrand, "UI选择");

      // 如果两者都存在且不同，需要智能判断
      if (conversationMatched && uiMatched && conversationMatched !== uiMatched) {
        // 检查是否是同品牌系列
        const isSameBrandFamily =
          conversationMatched.includes(uiMatched) || uiMatched.includes(conversationMatched);

        if (isSameBrandFamily) {
          // 同系列品牌，优先使用对话提取的品牌（更符合当前上下文意图）
          return {
            resolvedBrand: conversationMatched,
            matchType: conversationMatched === conversationBrand ? "exact" : "fuzzy",
            source: "conversation",
            reason: `同系列品牌冲突，优先对话`,
            originalInput: conversationBrand,
          };
        } else {
          // 不同品牌系列，优先对话提取（因为更符合当前上下文）
          return {
            resolvedBrand: conversationMatched,
            matchType: conversationMatched === conversationBrand ? "exact" : "fuzzy",
            source: "conversation",
            reason: `不同品牌冲突，优先对话`,
            originalInput: conversationBrand,
          };
        }
      }

      // 如果只有一个存在，或两者相同，按正常优先级处理
      if (conversationMatched) {
        return {
          resolvedBrand: conversationMatched,
          matchType: conversationMatched === conversationBrand ? "exact" : "fuzzy",
          source: "conversation",
          reason: `智能策略: 使用对话中提取的品牌 (${conversationBrand}${conversationMatched !== conversationBrand ? ` → ${conversationMatched}` : ""})`,
          originalInput: conversationBrand,
        };
      }

      if (uiMatched) {
        return {
          resolvedBrand: uiMatched,
          matchType: uiMatched === uiSelectedBrand ? "exact" : "fuzzy",
          source: "ui",
          reason: `智能策略: 对话无品牌，使用UI选择 (${uiSelectedBrand}${uiMatched !== uiSelectedBrand ? ` → ${uiMatched}` : ""})`,
          originalInput: uiSelectedBrand,
        };
      }

      // 尝试配置默认品牌
      const configMatched = tryMatchBrand(configDefaultBrand, "配置默认");
      if (configMatched) {
        return {
          resolvedBrand: configMatched,
          matchType: configMatched === configDefaultBrand ? "exact" : "fuzzy",
          source: "config",
          reason: `智能策略: 无对话/UI品牌，使用配置默认 (${configDefaultBrand}${configMatched !== configDefaultBrand ? ` → ${configMatched}` : ""})`,
          originalInput: configDefaultBrand,
        };
      }

      // 使用第一个可用品牌
      const fallback = availableBrands[0];
      return {
        resolvedBrand: fallback,
        matchType: "fallback",
        source: "default",
        reason: `智能策略: 无有效品牌输入，使用系统默认 (${fallback})`,
      };
    }
  }
}

/**
 * 🎯 信息详细级别类型
 */
type DetailLevel = "minimal" | "standard" | "detailed";

/**
 * 🎯 门店评分结构
 */
interface StoreScore {
  store: Store;
  score: number;
  breakdown: {
    locationMatch: number; // 位置匹配得分 (0-40)
    districtMatch: number; // 区域匹配得分 (0-30)
    positionDiversity: number; // 岗位多样性得分 (0-20)
    availability: number; // 可用性得分 (0-10)
  };
}

// 🗺️ StoreWithDistance 类型从 @/types/geocoding 导入
// 重新导出供其他模块使用
export type { StoreWithDistance } from "@/types/geocoding";

/**
 * 🌐 推断城市
 * 从分类结果或门店数据中推断用户所在城市
 */
function inferCity(classification: MessageClassification, stores: Store[]): string {
  // 1. 优先使用分类结果的 city
  if (classification.extractedInfo.city) {
    return classification.extractedInfo.city;
  }

  // 2. 从门店数据推断城市
  return inferCityFromStores(stores);
}

/**
 * 🏙️ 从门店列表推断城市
 * 优先使用门店级别的 city 字段，其次从地址提取
 * @param stores 门店列表
 * @param fallback 备用值（可选）
 * @returns 最常见的城市名称
 */
function inferCityFromStores(stores: Store[], fallback?: string): string {
  // 1. 优先收集门店级别的 city 字段
  const storeCities = stores.map(s => s.city).filter((c): c is string => Boolean(c));

  if (storeCities.length > 0) {
    return mostFrequent(storeCities) || fallback || "当地";
  }

  // 2. 降级：从门店地址提取城市
  const addressCities = stores.map(s => extractCityFromAddress(s.location)).filter(Boolean);
  return mostFrequent(addressCities) || fallback || "当地";
}

/**
 * 🏪 获取门店所在城市
 * @param store 门店对象
 * @param fallback 备用值
 * @returns 门店城市
 */
function getStoreCity(store: Store, fallback?: string): string {
  return store.city || fallback || "当地";
}

/**
 * 🔍 基于文本匹配的门店排序（降级方案）
 * @returns 带距离信息的门店列表（文本匹配时 distance 为 undefined）
 */
function rankStoresByTextMatch(
  stores: Store[],
  classification: MessageClassification
): StoreWithDistance[] {
  const { mentionedLocations, mentionedDistricts } = classification.extractedInfo;

  const scoredStores: StoreScore[] = stores.map(store => {
    let locationMatch = 0;
    let districtMatch = 0;
    let positionDiversity = 0;
    let availability = 0;

    // 1. 位置匹配（40%权重）
    if (mentionedLocations && mentionedLocations.length > 0) {
      const matchingLocation = mentionedLocations.find(
        loc =>
          store.name.includes(loc.location) ||
          store.location.includes(loc.location) ||
          store.subarea.includes(loc.location)
      );
      if (matchingLocation) {
        locationMatch = matchingLocation.confidence * 40;
      }
    }

    // 2. 区域匹配（30%权重）
    if (mentionedDistricts && mentionedDistricts.length > 0) {
      const matchingDistrict = mentionedDistricts.find(
        dist => store.district.includes(dist.district) || store.subarea.includes(dist.district)
      );
      if (matchingDistrict) {
        districtMatch = matchingDistrict.confidence * 30;
      }
    }

    // 3. 岗位多样性（20%权重）
    const uniquePositionTypes = new Set(store.positions.map(p => p.name));
    positionDiversity = Math.min(uniquePositionTypes.size * 5, 20);

    // 4. 岗位可用性（10%权重）
    const availablePositions = store.positions.filter(p =>
      p.availableSlots?.some(slot => slot.isAvailable)
    );
    availability = Math.min(availablePositions.length * 2, 10);

    const totalScore = locationMatch + districtMatch + positionDiversity + availability;

    return {
      store,
      score: totalScore,
      breakdown: { locationMatch, districtMatch, positionDiversity, availability },
    };
  });

  const ranked = scoredStores.sort((a, b) => b.score - a.score);

  if (ranked.length > 0 && ranked[0].score > 0) {
    console.log(
      `📊 文本匹配排序: 前3名得分 = ${ranked
        .slice(0, 3)
        .map(s => `${s.store.name}(${s.score.toFixed(1)})`)
        .join(", ")}`
    );
  }

  // 返回带距离信息的结构（文本匹配时无距离）
  return ranked.map(item => ({ store: item.store, distance: undefined }));
}

/**
 * 🔍 智能门店排序函数（异步版本）
 * 优先使用真实地理距离排序，失败时降级到文本匹配
 *
 * @param stores 待排序的门店列表
 * @param classification 消息分类结果（包含位置、区域等提取信息）
 * @returns 带距离信息的门店列表（按距离/相关性排序）
 */
async function rankStoresByRelevance(
  stores: Store[],
  classification: MessageClassification
): Promise<StoreWithDistance[]> {
  const { mentionedLocations } = classification.extractedInfo;

  // 🗺️ 如果有位置信息，尝试使用真实距离排序
  if (mentionedLocations && mentionedLocations.length > 0) {
    const primaryLocation = mentionedLocations[0];

    // 检查是否有门店有有效坐标
    const storesWithCoords = stores.filter(s => isValidCoordinates(s.coordinates));

    if (storesWithCoords.length > 0) {
      try {
        // 推断城市
        const city = inferCity(classification, stores);

        // 获取用户位置坐标（使用智能编码：优先 POI 搜索，适合小区/楼盘名）
        console.log(`\n━━━ 🗺️ 坐标获取 ━━━\n   目标: ${primaryLocation.location} (城市: ${city || "未知"})`);
        const userCoords = await geocodingService.smartGeocode(primaryLocation.location, city);

        if (userCoords) {
          // 计算各门店到用户的距离
          const storesWithDistance = geocodingService.calculateDistancesToTarget(
            storesWithCoords,
            userCoords
          );

          // 合并无坐标的门店（排在最后，距离为 undefined）
          const storesWithoutCoords = stores.filter(s => !isValidCoordinates(s.coordinates));

          console.log(
            `   排序结果: ${storesWithDistance
              .slice(0, 3)
              .map(s => `${s.store.name}(${geocodingService.formatDistance(s.distance)})`)
              .join(" → ")}`
          );

          // 返回带距离信息的结构
          return [
            ...storesWithDistance.map(s => ({ store: s.store, distance: s.distance })),
            ...storesWithoutCoords.map(s => ({ store: s, distance: undefined })),
          ];
        } else {
          console.warn(`⚠️ 无法获取用户位置坐标: ${primaryLocation.location}，降级到文本匹配`);
        }
      } catch (error) {
        console.error("❌ 距离排序失败，降级到文本匹配:", error);
      }
    } else {
      console.warn("⚠️ 没有门店有有效坐标，使用文本匹配排序");
    }
  }

  // 降级：使用原有的文本匹配排序
  return rankStoresByTextMatch(stores, classification);
}

/**
 * 🔢 确定展示门店数量
 * 根据对话类型动态决定展示多少个门店
 *
 * @param rankedStores 已排序的门店列表
 * @param replyType 回复类型
 * @returns 应展示的门店数量
 */
function determineStoreCount(rankedStores: Store[], replyType: ReplyContext): number {
  // 早期探索阶段 → 5个门店（提供更多选择）
  const earlyStages: ReplyContext[] = ["initial_inquiry", "location_inquiry", "no_location_match"];

  // 具体咨询阶段 → 3个门店（聚焦相关信息）
  const specificStages: ReplyContext[] = [
    "salary_inquiry",
    "schedule_inquiry",
    "attendance_inquiry",
    "flexibility_inquiry",
    "work_hours_inquiry",
    "availability_inquiry",
  ];

  if (earlyStages.includes(replyType)) {
    return Math.min(5, rankedStores.length);
  }

  if (specificStages.includes(replyType)) {
    return Math.min(3, rankedStores.length);
  }

  // 默认3个
  return Math.min(3, rankedStores.length);
}

/**
 * 🎨 回复类型到信息详细级别的映射
 */
const REPLY_TYPE_DETAIL_MAP: Record<ReplyContext, DetailLevel> = {
  // Minimal：初次探索，仅展示关键信息
  initial_inquiry: "minimal",
  location_inquiry: "minimal",
  no_location_match: "minimal",
  age_concern: "minimal",
  insurance_inquiry: "minimal",

  // Standard：常规咨询，展示核心信息
  salary_inquiry: "standard",
  schedule_inquiry: "standard",
  interview_request: "standard",
  general_chat: "standard",
  followup_chat: "standard",

  // Detailed：深度咨询，展示完整信息
  attendance_inquiry: "detailed",
  flexibility_inquiry: "detailed",
  attendance_policy_inquiry: "detailed",
  work_hours_inquiry: "detailed",
  availability_inquiry: "detailed",
  part_time_support: "detailed",
};

/**
 * 🎯 确定信息详细级别
 * 根据回复类型返回对应的信息详细程度
 *
 * @param replyType 回复类型
 * @returns 信息详细级别 (minimal | standard | detailed)
 */
function determineDetailLevel(replyType: ReplyContext): DetailLevel {
  return REPLY_TYPE_DETAIL_MAP[replyType] || "standard";
}

/**
 * 📝 构建岗位信息
 * 根据详细级别和回复类型动态生成岗位信息
 *
 * @param position 岗位对象
 * @param detailLevel 信息详细级别
 * @param replyType 回复类型
 * @returns 格式化的岗位信息字符串
 */
function buildPositionInfo(
  position: Position,
  detailLevel: DetailLevel,
  replyType: ReplyContext
): string {
  let info = "";

  // ========== 所有级别都包含的基础信息 ==========
  info += `  职位：${position.name}\n`;

  // 时间段（最多显示2个）
  const timeSlots = position.timeSlots.slice(0, 2).join("、");
  info += `  时间：${timeSlots}${position.timeSlots.length > 2 ? "等" : ""}\n`;

  // 薪资信息（使用现有的智能构建函数）
  const salaryInfo = buildSalaryDescription(position.salary);
  info += `  薪资：${salaryInfo}\n`;

  // ⭐ 重要：年龄要求必须在所有级别展示（用户要求）
  if (position.requirements && position.requirements.length > 0) {
    const requirements = position.requirements.filter(req => req !== "无");
    if (requirements.length > 0) {
      info += `  要求：${requirements.join("、")}\n`;
    }
  }

  // ========== Minimal 级别：添加基础排班信息 ==========
  if (detailLevel === "minimal") {
    const scheduleTypeText = getScheduleTypeText(position.scheduleType);
    const flexText = position.schedulingFlexibility.canSwapShifts ? "（可换班）" : "";
    info += `  排班：${scheduleTypeText}${flexText}\n`;
    return info;
  }

  // ========== Standard 级别：根据 replyType 添加聚焦信息 ==========
  if (detailLevel === "standard") {
    if (replyType === "salary_inquiry") {
      // 薪资咨询：重点展示奖金和福利
      if (position.salary.bonus) {
        info += `  奖金：${position.salary.bonus}\n`;
      }
      if (position.benefits?.items?.length) {
        const benefits = position.benefits.items.filter(item => item !== "无");
        if (benefits.length > 0) {
          info += `  福利：${benefits.slice(0, 3).join("、")}\n`;
        }
      }
    } else if (replyType === "schedule_inquiry" || replyType === "flexibility_inquiry") {
      // 排班咨询：重点展示灵活性和工时
      const flexibility = position.schedulingFlexibility;
      const features = [];
      if (flexibility.canSwapShifts) features.push("可换班");
      if (flexibility.partTimeAllowed) features.push("支持兼职");
      if (flexibility.weekendRequired) features.push("需周末");
      if (features.length > 0) {
        info += `  排班特点：${features.join("、")}\n`;
      }

      if (position.minHoursPerWeek || position.maxHoursPerWeek) {
        info += `  每周工时：${position.minHoursPerWeek || 0}-${position.maxHoursPerWeek || "不限"}小时\n`;
      }
    } else {
      // 其他场景：展示基础排班和部分福利
      const scheduleTypeText = getScheduleTypeText(position.scheduleType);
      const flexText = position.schedulingFlexibility.canSwapShifts ? "（可换班）" : "";
      info += `  排班：${scheduleTypeText}${flexText}\n`;

      // 展示前2个福利
      if (position.benefits?.items?.length) {
        const benefits = position.benefits.items.filter(item => item !== "无");
        if (benefits.length > 0) {
          info += `  福利：${benefits.slice(0, 2).join("、")}\n`;
        }
      }
    }
    return info;
  }

  // ========== Detailed 级别：展示完整信息 ==========
  if (detailLevel === "detailed") {
    // 1. 完整薪资和福利
    if (position.salary.bonus) {
      info += `  奖金：${position.salary.bonus}\n`;
    }
    if (position.benefits && position.benefits.items && position.benefits.items.length > 0) {
      const benefitsList = position.benefits.items.filter(item => item !== "无");
      if (benefitsList.length > 0) {
        info += `  福利：${benefitsList.join("、")}\n`;
      }
    }
    if (position.benefits && position.benefits.promotion) {
      info += `  晋升福利：${position.benefits.promotion}\n`;
    }

    // 2. 完整排班信息
    const scheduleTypeText = getScheduleTypeText(position.scheduleType);
    const canSwapText = position.schedulingFlexibility.canSwapShifts
      ? "（可换班）"
      : "（不可换班）";
    info += `  排班类型：${scheduleTypeText}${canSwapText}\n`;

    // 3. 可用时段（如果与 replyType 相关）
    if (replyType === "availability_inquiry" || replyType === "schedule_inquiry") {
      const availableSlots = position.availableSlots?.filter(slot => slot.isAvailable);
      if (availableSlots && availableSlots.length > 0) {
        info += `  可预约时段：${availableSlots
          .slice(0, 3)
          .map(slot => `${slot.slot}(${slot.currentBooked}/${slot.maxCapacity}人)`)
          .join("、")}\n`;
      }
    }

    // 4. 考勤政策
    if (position.attendancePolicy.punctualityRequired) {
      info += `  考勤要求：准时到岗，最多迟到${position.attendancePolicy.lateToleranceMinutes}分钟\n`;
    }

    // 5. 排班灵活性特点
    const flexibility = position.schedulingFlexibility;
    const flexibilityFeatures = [];
    if (flexibility.canSwapShifts) flexibilityFeatures.push("可换班");
    if (flexibility.partTimeAllowed) flexibilityFeatures.push("兼职");
    if (flexibility.weekendRequired) flexibilityFeatures.push("需周末");
    if (flexibility.holidayRequired) flexibilityFeatures.push("需节假日");
    if (flexibilityFeatures.length > 0) {
      info += `  排班特点：${flexibilityFeatures.join("、")}\n`;
    }

    // 6. 工时要求
    if (position.minHoursPerWeek || position.maxHoursPerWeek) {
      info += `  每周工时：${position.minHoursPerWeek || 0}-${position.maxHoursPerWeek || "不限"}小时\n`;
    }

    // 7. 工作日偏好
    if (position.preferredDays && position.preferredDays.length > 0) {
      info += `  工作日偏好：${position.preferredDays.map(day => getDayText(day)).join("、")}\n`;
    }

    // 8. 出勤要求
    if (position.attendanceRequirement) {
      const req = position.attendanceRequirement;
      let reqText = `出勤要求：${req.description}`;
      if (req.requiredDays && req.requiredDays.length > 0) {
        const dayNames = req.requiredDays.map(dayNum => getDayNumberText(dayNum));
        reqText += `（需要：${dayNames.join("、")}）`;
      }
      if (req.minimumDays) {
        reqText += `，最少${req.minimumDays}天/周`;
      }
      info += `  ${reqText}\n`;
    }
  }

  return info;
}

/**
 * 构建上下文信息，根据提取的信息筛选相关数据
 * @param data 配置数据
 * @param classification 消息分类结果
 * @param uiSelectedBrand UI选择的品牌（来自brand-selector组件）
 * @param toolBrand 工具调用时从职位详情识别的品牌
 * @param brandPriorityStrategy 品牌优先级策略
 * @param candidateInfo 候选人信息（包含 jobAddress 等）
 * @returns 返回上下文信息和解析后的品牌
 */
async function buildContextInfo(
  data: ZhipinData,
  classification: MessageClassification,
  uiSelectedBrand?: string,
  toolBrand?: string,
  brandPriorityStrategy?: BrandPriorityStrategy,
  candidateInfo?: CandidateInfo
): Promise<{
  contextInfo: string;
  resolvedBrand: string;
  debugInfo: {
    relevantStores: StoreWithDistance[];
    storeCount: number;
    detailLevel: string;
    classification: MessageClassification;
  };
}> {
  const extractedInfo = classification.extractedInfo;
  const { city, mentionedLocations, mentionedDistricts } = extractedInfo;

  // 📍 jobAddress 是岗位发布地址，单独用于门店过滤（不用于距离计算）
  // mentionedLocations 是候选人提到的位置，用于门店过滤 + 距离排序
  const jobAddressForFilter = candidateInfo?.jobAddress;

  // 使用新的冲突解析逻辑，传入三个独立的品牌源
  const brandResolution = resolveBrandConflict({
    uiSelectedBrand: uiSelectedBrand, // UI选择的品牌
    configDefaultBrand: data.defaultBrand, // 配置中的默认品牌
    conversationBrand: toolBrand || undefined, // 工具调用时从职位详情识别的品牌
    availableBrands: Object.keys(data.brands),
    strategy: brandPriorityStrategy || "smart",
  });

  const targetBrand = brandResolution.resolvedBrand;
  console.log(
    `\n━━━ 🏢 品牌解析 ━━━\n` +
      `   输入: UI=${uiSelectedBrand || "无"} | 工具=${toolBrand || "无"} | 默认=${data.defaultBrand}\n` +
      `   结果: ${targetBrand} (${brandResolution.reason})`
  );

  // 获取目标品牌的所有门店
  const brandStores = data.stores.filter(store => store.brand === targetBrand);
  let relevantStores = brandStores; // 保持品牌过滤，即使为空

  // 如果没有门店数据，构建空的上下文
  if (relevantStores.length === 0) {
    return {
      contextInfo: `品牌：${targetBrand}\n注意：该品牌当前没有门店数据。**门店可能暂时没有在招岗位**。`,
      resolvedBrand: targetBrand,
      debugInfo: {
        relevantStores: [],
        storeCount: 0,
        detailLevel: "minimal",
        classification,
      },
    };
  }

  // 优先使用明确提到的工作城市进行过滤
  // 🔧 优先级: 门店 store.city → 门店地址提取 → data.city (fallback)
  const brandCity = inferCityFromStores(relevantStores, data.city);

  // 位置过滤日志收集
  const locationLogs: string[] = [];
  if (city && city !== brandCity) {
    locationLogs.push(`⚠️ 城市不匹配: 候选人="${city}" vs 门店="${brandCity}"`);
  }

  // 根据提到的位置进一步过滤（按置信度排序）
  if (mentionedLocations && mentionedLocations.length > 0) {
    // 按置信度降序排序
    const sortedLocations = mentionedLocations.sort((a, b) => b.confidence - a.confidence);

    // 尝试按置信度匹配位置
    for (const { location, confidence } of sortedLocations) {
      const filteredStores = relevantStores.filter(
        store =>
          store.name.includes(location) ||
          store.location.includes(location) ||
          store.district.includes(location) ||
          store.subarea.includes(location)
      );

      if (filteredStores.length > 0) {
        relevantStores = filteredStores;
        locationLogs.push(`✅ 位置匹配: ${location} → ${filteredStores.length}家门店`);
        break;
      } else {
        locationLogs.push(`   尝试: ${location} (${confidence}) → 无匹配`);
      }
    }
  }

  // 如果还有mentionedDistrict，且还没有进行过位置过滤（relevantStores包含品牌的所有门店）
  if (mentionedDistricts && relevantStores.length === brandStores.length) {
    // 🎯 按置信度排序区域，优先匹配高置信度的区域
    const sortedDistricts = mentionedDistricts
      .filter(d => d.confidence > 0.6) // 过滤掉置信度过低的区域
      .sort((a, b) => b.confidence - a.confidence); // 降序排序

    if (sortedDistricts.length > 0) {
      const districtFiltered = relevantStores.filter(store =>
        sortedDistricts.some(
          district =>
            store.district.includes(district.district) || store.subarea.includes(district.district)
        )
      );

      if (districtFiltered.length > 0) {
        relevantStores = districtFiltered;
        locationLogs.push(
          `✅ 区域匹配: ${sortedDistricts.map(d => d.district).join("/")} → ${districtFiltered.length}家门店`
        );
      } else {
        locationLogs.push(`   区域尝试: ${sortedDistricts.map(d => d.district).join("/")} → 无匹配`);
      }
    } else {
      locationLogs.push(`   区域置信度过低，跳过`);
    }
  }

  // 📍 如果候选人没有提到位置（门店未被过滤），使用岗位地址过滤
  if (relevantStores.length === brandStores.length && jobAddressForFilter) {
    locationLogs.push(`📍 使用岗位地址: ${jobAddressForFilter}`);
    const jobAddressFiltered = relevantStores.filter(
      store =>
        store.name.includes(jobAddressForFilter) ||
        store.location.includes(jobAddressForFilter) ||
        store.district.includes(jobAddressForFilter) ||
        store.subarea.includes(jobAddressForFilter)
    );

    if (jobAddressFiltered.length > 0) {
      relevantStores = jobAddressFiltered;
      locationLogs.push(`✅ 岗位地址匹配 → ${jobAddressFiltered.length}家门店`);
    } else {
      locationLogs.push(`   岗位地址无匹配`);
    }
  }

  // 输出位置过滤日志
  if (locationLogs.length > 0) {
    console.log(`\n━━━ 📍 位置过滤 ━━━\n` + locationLogs.map(l => `   ${l}`).join("\n"));
  }

  // 构建上下文信息
  let context = `默认推荐品牌：${targetBrand}\n`;
  let rankedStoresWithDistance: StoreWithDistance[] = [];

  if (relevantStores.length > 0) {
    // 🎯 智能门店排序（异步：支持真实距离计算）
    rankedStoresWithDistance = await rankStoresByRelevance(relevantStores, classification);

    // 🔢 确定展示门店数量（使用门店数组）
    const storeCount = determineStoreCount(
      rankedStoresWithDistance.map(s => s.store),
      classification.replyType
    );

    // 📊 确定信息详细级别
    const detailLevel = determineDetailLevel(classification.replyType);

    console.log(
      `\n━━━ 📊 上下文构建 ━━━\n` +
        `   回复类型: ${classification.replyType}\n` +
        `   展示门店: ${storeCount}家 | 详细级别: ${detailLevel}`
    );

    context += `匹配到的门店信息：\n`;

    // 🏢 构建优化后的门店信息（包含距离）
    rankedStoresWithDistance.slice(0, storeCount).forEach(({ store, distance }) => {
      // 🗺️ 如果有距离信息，显示在门店名称后
      const distanceText =
        distance !== undefined ? `【距离约${geocodingService.formatDistance(distance)}】` : "";
      context += `• ${store.name}${distanceText}（${store.district}${store.subarea}）：${store.location}\n`;

      store.positions.forEach(pos => {
        context += buildPositionInfo(pos, detailLevel, classification.replyType);
      });
    });
  } else {
    context += `暂无完全匹配的门店，可推荐其他区域门店\n`;
    context += `⚠️ 无匹配时必须：主动要微信联系方式，告知"以后有其他门店空了可以再推给你"\n`;
  }

  // 添加品牌专属模板话术参考 - 仅添加当前分类对应的话术
  const brandConfig = data.brands[targetBrand];
  if (brandConfig && brandConfig.templates && classification.replyType) {
    const templateMap: Record<ReplyContext, string> = {
      initial_inquiry: "初次咨询",
      location_inquiry: "位置咨询",
      no_location_match: "无位置匹配",
      schedule_inquiry: "排班咨询",
      interview_request: "面试邀约",
      general_chat: "一般对话",
      salary_inquiry: "薪资咨询",
      age_concern: "年龄问题",
      insurance_inquiry: "保险咨询",
      followup_chat: "跟进话术",
      // 🆕 新增：出勤和排班相关模板映射
      attendance_inquiry: "出勤要求咨询",
      flexibility_inquiry: "排班灵活性咨询",
      attendance_policy_inquiry: "考勤政策咨询",
      work_hours_inquiry: "工时要求咨询",
      availability_inquiry: "时间段可用性咨询",
      part_time_support: "兼职支持咨询",
    };

    // 只获取当前分类对应的话术模板
    const currentReplyType = classification.replyType as ReplyContext;
    const templates = brandConfig.templates[currentReplyType];

    if (templates && templates.length > 0) {
      const templateName = templateMap[currentReplyType];
      context += `\n📋 ${targetBrand}品牌专属话术模板（${templateName}）：\n`;

      // 如果有多个模板，全部列出供LLM参考
      templates.forEach((template, index) => {
        if (templates.length > 1) {
          context += `模板${index + 1}：${template}\n`;
        } else {
          context += `${template}\n`;
        }
      });
    } else {
      context += `\n⚠️ 注意：${targetBrand}品牌暂无此场景的专属话术模板，请参考通用回复指令\n`;
    }
  }

  // 如果没有排序结果，将原始门店转换为带距离的结构
  const finalStoresWithDistance: StoreWithDistance[] =
    rankedStoresWithDistance.length > 0
      ? rankedStoresWithDistance
      : relevantStores.map(store => ({ store, distance: undefined }));

  return {
    contextInfo: context,
    resolvedBrand: targetBrand,
    debugInfo: {
      relevantStores: finalStoresWithDistance,
      storeCount:
        rankedStoresWithDistance.length > 0
          ? determineStoreCount(
              rankedStoresWithDistance.map(s => s.store),
              classification.replyType
            )
          : 0,
      detailLevel: determineDetailLevel(classification.replyType),
      classification,
    },
  };
}

/**
 * 获取排班类型的中文描述
 */
function getScheduleTypeText(
  scheduleType: "fixed" | "flexible" | "rotating" | "on_call" | string
): string {
  if (!scheduleType) return "灵活排班"; // 默认值

  const typeMap: Record<string, string> = {
    fixed: "固定排班",
    flexible: "灵活排班",
    rotating: "轮班制",
    on_call: "随叫随到",
  };
  return typeMap[scheduleType] || "灵活排班";
}

/**
 * 获取工作日的中文描述
 */
function getDayText(day: string): string {
  const dayMap: { [key: string]: string } = {
    Monday: "周一",
    Tuesday: "周二",
    Wednesday: "周三",
    Thursday: "周四",
    Friday: "周五",
    Saturday: "周六",
    Sunday: "周日",
  };
  return dayMap[day] || day;
}

/**
 * 获取数字工作日的中文描述 (1=周一, 7=周日)
 */
function getDayNumberText(dayNumber: number): string {
  const dayMap: { [key: number]: string } = {
    1: "周一",
    2: "周二",
    3: "周三",
    4: "周四",
    5: "周五",
    6: "周六",
    7: "周日",
  };
  return dayMap[dayNumber] || `第${dayNumber}天`;
}
