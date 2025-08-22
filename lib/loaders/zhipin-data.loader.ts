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
} from "../../types/zhipin";
import { generateText, generateObject } from "ai";
import { z } from "zod";
import {
  getBrandData,
  getReplyPrompts,
  migrateFromHardcodedData,
  needsMigration,
} from "../services/config.service";
import type { ReplyPromptsConfig } from "../../types/config";
import { DEFAULT_PROVIDER_CONFIGS, DEFAULT_MODEL_CONFIG } from "@/lib/config/models";
import type { ModelConfig } from "@/lib/config/models";
import type { CandidateInfo } from "@/lib/tools/zhipin/types";
import type { SalaryDetails } from "../../types/zhipin";
// 使用新的模块化 prompt engineering
import { 
  ClassificationPromptBuilder,
  ReplyPromptBuilder,
  type ClassificationParams,
  type ReplyBuilderParams
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
  let description = '';
  
  if (isPossiblyPieceRate && memo) {
    // 可能是计件制，包含memo信息让LLM理解
    description = `${base}元（${memo.replace(/\n/g, ' ').trim()}）`;
  } else {
    // 常规时薪
    description = `${base}元/时`;
    if (range && range !== `${base}-${base}`) {
      description += `，范围${range}元`;
    }
    // 如果有memo且不太长，也包含进来
    if (memo && memo.length < 50) {
      description += `（${memo.replace(/\n/g, ' ').trim()}）`;
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

      // 如果指定了品牌，动态更新默认品牌
      const effectiveData =
        preferredBrand && configData.brands[preferredBrand]
          ? {
              ...configData,
              defaultBrand: preferredBrand,
            }
          : configData;

      const totalPositions = effectiveData.stores.reduce(
        (sum, store) => sum + store.positions.length,
        0
      );
      console.log(
        `📊 数据统计: ${effectiveData.stores.length} 家门店，${totalPositions} 个岗位${
          preferredBrand ? ` - 当前品牌: ${preferredBrand}` : ""
        }`
      );
      return effectiveData;
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

      // 应用品牌选择
      const effectiveData =
        preferredBrand && brandData.brands[preferredBrand]
          ? { ...brandData, defaultBrand: preferredBrand }
          : brandData;

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
    const availableStores = brandStores.length > 0 ? brandStores : data.stores;

    const randomStore = availableStores[Math.floor(Math.random() * availableStores.length)];
    const randomPosition =
      randomStore.positions[Math.floor(Math.random() * randomStore.positions.length)];

    const brandName = getBrandName(data);
    let reply = `你好，${data.city}各区有${brandName}门店岗位空缺，兼职排班 ${randomPosition.workHours} 小时。基本薪资：${randomPosition.salary.base} 元/小时。`;
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
    // 简单的区域匹配逻辑
    const districts = [
      "徐汇",
      "静安",
      "浦东",
      "黄浦",
      "长宁",
      "普陀",
      "杨浦",
      "虹口",
      "闵行",
      "宝山",
    ];
    let matchedStore = null;

    // 检查消息中是否包含任何区域名称
    for (const district of districts) {
      if (msg.includes(district)) {
        matchedStore = data.stores.find(
          store => store.district.includes(district) || store.subarea.includes(district)
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
    return `你好，${data.city}目前各区有门店岗位空缺，你在什么位置？我可以查下你附近`;
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
    const availableStores = brandStores.length > 0 ? brandStores : data.stores;

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
  return `你好，${data.city}目前各区有门店岗位空缺，你在什么位置？我可以查下你附近`;
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

  // 构建分类参数
  const classificationParams: ClassificationParams = {
    message,
    conversationHistory,
    candidateInfo,
    brandData: {
      city: data.city,
      defaultBrand: data.defaultBrand || getBrandName(data),
      availableBrands: Object.keys(data.brands),
      storeCount: data.stores.length
    }
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
    prompt: classificationPrompts.prompt
  });

  return classification;
}

/**
 * 基于LLM的智能回复生成函数 - 重构版
 * 优先使用传入的配置数据，服务端调用时必须提供
 * @param message 候选人消息
 * @param conversationHistory 对话历史（可选）
 * @param preferredBrand 优先使用的品牌（可选）
 * @param modelConfig 模型配置（可选）
 * @param configData 预加载的配置数据（服务端调用时必须提供）
 * @param replyPrompts 预加载的回复指令（服务端调用时必须提供）
 * @returns Promise<{replyType: string, text: string, reasoning: string}> 生成的智能回复、分类类型和分类依据
 */
export async function generateSmartReplyWithLLM(
  message: string = "",
  conversationHistory: string[] = [],
  preferredBrand?: string,
  modelConfig?: ModelConfig,
  configData?: ZhipinData,
  replyPrompts?: ReplyPromptsConfig,
  candidateInfo?: CandidateInfo
): Promise<{ replyType: string; text: string; reasoningText: string }> {
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

    // 构建上下文信息
    const contextInfo = buildContextInfo(data, classification);

    // 获取当前品牌
    const targetBrand = data.defaultBrand || getBrandName(data);

    // 创建回复构建器
    const replyBuilder = new ReplyPromptBuilder();

    // 构建回复参数
    const replyParams: ReplyBuilderParams = {
      message,
      classification,
      contextInfo,
      systemInstruction: systemPromptInstruction,
      conversationHistory,
      candidateInfo,
      targetBrand
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
 * 构建上下文信息，根据提取的信息筛选相关数据
 */
function buildContextInfo(data: ZhipinData, classification: MessageClassification): string {
  const extractedInfo = classification.extractedInfo;
  const { mentionedBrand, city, mentionedLocations, mentionedDistricts } = extractedInfo;

  // 根据提到的品牌过滤门店
  let targetBrand = data.defaultBrand || getBrandName(data);
  let relevantStores = data.stores;

  // 获取目标品牌的所有门店，用于后续判断是否已经进行过位置过滤
  const brandStores = data.stores.filter(store => store.brand === (mentionedBrand || targetBrand));

  if (mentionedBrand && data.brands[mentionedBrand]) {
    // 有明确提到的品牌，使用该品牌
    relevantStores = brandStores;
    targetBrand = mentionedBrand;
  } else {
    // 没有提到品牌，使用默认品牌的门店
    relevantStores = brandStores;
  }

  // 优先使用明确提到的工作城市进行过滤
  if (city && city !== data.city) {
    // 如果提到的城市与数据城市不匹配，记录但不过滤（避免误判）
    console.warn(`候选人提到的城市 "${city}" 与数据城市 "${data.city}" 不匹配`);
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
        console.log(`✅ 位置匹配成功: ${location} (置信度: ${confidence})`);
        break;
      } else {
        console.log(`❌ 位置匹配失败: ${location} (置信度: ${confidence})`);
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
        console.log(
          `✅ 区域匹配成功: ${sortedDistricts
            .map(d => `${d.district}(置信度:${d.confidence})`)
            .join(", ")}`
        );
      } else {
        console.log(`❌ 区域匹配失败: 没有找到匹配的区域`);
      }
    } else {
      console.log(`⚠️ 所有区域置信度过低 (≤0.6)，跳过区域过滤`);
    }
  }

  // 构建上下文信息
  let context = `默认推荐品牌：${targetBrand}\n`;

  if (relevantStores.length > 0) {
    context += `匹配到的门店信息：\n`;
    relevantStores.slice(0, 3).forEach(store => {
      context += `• ${store.name}（${store.district}${store.subarea}）：${store.location}\n`;
      store.positions.forEach(pos => {
        // 🔧 智能薪资信息构建（包含memo解析）
        const salaryInfo = buildSalaryDescription(pos.salary);
        context += `  职位：${pos.name}，时间：${pos.timeSlots.join("、")}，薪资：${salaryInfo}\n`;
        
        if (pos.salary.bonus) {
          context += `  奖金：${pos.salary.bonus}\n`;
        }

        // 处理结构化福利对象
        if (pos.benefits && pos.benefits.items && pos.benefits.items.length > 0) {
          const benefitsList = pos.benefits.items.filter(item => item !== "无");
          if (benefitsList.length > 0) {
            context += `  福利：${benefitsList.join("、")}\n`;
          }
        }
        if (pos.benefits && pos.benefits.promotion) {
          context += `  晚升福利：${pos.benefits.promotion}\n`;
        }

        // 新增：考勤和排班信息
        const scheduleTypeText = getScheduleTypeText(pos.scheduleType);
        const canSwapText = pos.schedulingFlexibility.canSwapShifts ? "（可换班）" : "（不可换班）";
        context += `  排班类型：${scheduleTypeText}${canSwapText}\n`;

        // 可用时间段信息
        const availableSlots = pos.availableSlots.filter(slot => slot.isAvailable);
        if (availableSlots.length > 0) {
          context += `  可预约时段：${availableSlots
            .map(
              slot =>
                `${slot.slot}(${slot.currentBooked}/${
                  slot.maxCapacity
                }人，${getPriorityText(slot.priority)}优先级)`
            )
            .join("、")}\n`;
        }

        // 考勤要求
        const attendance = pos.attendancePolicy;
        if (attendance.punctualityRequired) {
          context += `  考勤要求：准时到岗，最多迟到${attendance.lateToleranceMinutes}分钟\n`;
        }

        // 排班灵活性
        const flexibility = pos.schedulingFlexibility;
        const flexibilityFeatures = [];
        if (flexibility.canSwapShifts) flexibilityFeatures.push("可换班");
        if (flexibility.partTimeAllowed) flexibilityFeatures.push("兼职");
        if (flexibility.weekendRequired) flexibilityFeatures.push("需周末");
        if (flexibility.holidayRequired) flexibilityFeatures.push("需节假日");

        if (flexibilityFeatures.length > 0) {
          context += `  排班特点：${flexibilityFeatures.join("、")}\n`;
        }

        // 每周工时要求
        if (pos.minHoursPerWeek || pos.maxHoursPerWeek) {
          context += `  每周工时：${pos.minHoursPerWeek || 0}-${
            pos.maxHoursPerWeek || "不限"
          }小时\n`;
        }

        // 偏好工作日
        if (pos.preferredDays && pos.preferredDays.length > 0) {
          context += `  工作日偏好：${pos.preferredDays.map(day => getDayText(day)).join("、")}\n`;
        }

        // 新增：出勤要求
        if (pos.attendanceRequirement) {
          const req = pos.attendanceRequirement;
          let reqText = `出勤要求：${req.description}`;

          if (req.requiredDays && req.requiredDays.length > 0) {
            const dayNames = req.requiredDays.map(dayNum => getDayNumberText(dayNum));
            reqText += `（需要：${dayNames.join("、")}）`;
          }

          if (req.minimumDays) {
            reqText += `，最少${req.minimumDays}天/周`;
          }

          context += `  ${reqText}\n`;
        }
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

  return context;
}

/**
 * 获取排班类型的中文描述
 */
function getScheduleTypeText(scheduleType: "fixed" | "flexible" | "rotating" | "on_call"): string {
  const typeMap = {
    fixed: "固定排班",
    flexible: "灵活排班",
    rotating: "轮班制",
    on_call: "随叫随到",
  };
  return typeMap[scheduleType] || scheduleType;
}

/**
 * 获取优先级的中文描述
 */
function getPriorityText(priority: "high" | "medium" | "low"): string {
  const priorityMap = {
    high: "高",
    medium: "中",
    low: "低",
  };
  return priorityMap[priority] || priority;
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
