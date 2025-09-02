/**
 * 🔧 统一配置服务
 * 封装所有 localforage 操作，提供配置数据的读写接口
 */

import localforage from "localforage";
import { CONFIG_VERSION } from "@/types";
import type {
  AppConfigData,
  ConfigService,
  SystemPromptsConfig,
  ReplyPromptsConfig,
  ZhipinData,
  CONFIG_STORAGE_KEY,
} from "@/types";

// 检查是否在客户端环境
const isClient = typeof window !== "undefined";

// 创建专门的配置存储实例（仅在客户端）
const configStorage = isClient
  ? localforage.createInstance({
      name: "ai-sdk-computer-use",
      storeName: "app_config",
      description: "应用配置数据存储",
    })
  : null;

/**
 * 核心配置服务实现
 */
class AppConfigService implements ConfigService {
  private readonly storageKey = "APP_CONFIG_DATA" as typeof CONFIG_STORAGE_KEY;

  /**
   * 获取完整配置数据
   */
  async getConfig(): Promise<AppConfigData | null> {
    if (!isClient || !configStorage) {
      console.log("ℹ️ 服务器端环境，跳过配置加载");
      return null;
    }

    try {
      const config = await configStorage.getItem<AppConfigData>(this.storageKey);

      if (config) {
        console.log("✅ 配置数据已从 localforage 加载");
        return config;
      }

      console.log("ℹ️ 未找到配置数据，可能是首次使用");
      return null;
    } catch (error) {
      console.error("❌ 配置数据读取失败:", error);
      throw new Error("配置数据读取失败");
    }
  }

  /**
   * 保存完整配置数据
   */
  async saveConfig(data: AppConfigData): Promise<void> {
    if (!isClient || !configStorage) {
      console.log("ℹ️ 服务器端环境，跳过配置保存");
      return;
    }

    try {
      // 更新元信息
      const configWithMetadata: AppConfigData = {
        ...data,
        metadata: {
          ...data.metadata,
          version: data.metadata.version || CONFIG_VERSION, // 保留传入的版本号，只有在没有版本号时才使用默认值
          lastUpdated: new Date().toISOString(),
        },
      };

      await configStorage.setItem(this.storageKey, configWithMetadata);
      console.log("✅ 配置数据已保存到 localforage");
    } catch (error) {
      console.error("❌ 配置数据保存失败:", error);
      throw new Error("配置数据保存失败");
    }
  }

  /**
   * 更新品牌数据
   */
  async updateBrandData(brandData: ZhipinData): Promise<void> {
    const currentConfig = await this.getConfig();
    if (!currentConfig) {
      throw new Error("配置数据不存在，请先进行初始化");
    }

    await this.saveConfig({
      ...currentConfig,
      brandData,
    });
  }

  /**
   * 更新系统提示词
   */
  async updateSystemPrompts(prompts: SystemPromptsConfig): Promise<void> {
    const currentConfig = await this.getConfig();
    if (!currentConfig) {
      throw new Error("配置数据不存在，请先进行初始化");
    }

    await this.saveConfig({
      ...currentConfig,
      systemPrompts: prompts,
    });
  }

  /**
   * 更新智能回复指令
   */
  async updateReplyPrompts(prompts: ReplyPromptsConfig): Promise<void> {
    const currentConfig = await this.getConfig();
    if (!currentConfig) {
      throw new Error("配置数据不存在，请先进行初始化");
    }

    await this.saveConfig({
      ...currentConfig,
      replyPrompts: prompts,
    });
  }

  /**
   * 更新活动系统提示词
   */
  async updateActiveSystemPrompt(promptType: keyof SystemPromptsConfig): Promise<void> {
    const currentConfig = await this.getConfig();
    if (!currentConfig) {
      throw new Error("配置数据不存在，请先进行初始化");
    }

    await this.saveConfig({
      ...currentConfig,
      activeSystemPrompt: promptType,
    });
  }

  /**
   * 清除所有配置数据
   */
  async clearConfig(): Promise<void> {
    if (!isClient || !configStorage) {
      console.log("ℹ️ 服务器端环境，跳过配置清除");
      return;
    }

    try {
      await configStorage.removeItem(this.storageKey);
      console.log("✅ 配置数据已清除");
    } catch (error) {
      console.error("❌ 配置数据清除失败:", error);
      throw new Error("配置数据清除失败");
    }
  }

  /**
   * 检查是否已配置
   */
  async isConfigured(): Promise<boolean> {
    if (!isClient || !configStorage) {
      return false;
    }

    try {
      const config = await configStorage.getItem<AppConfigData>(this.storageKey);
      return config !== null;
    } catch (error) {
      console.warn("检查配置状态失败:", error);
      return false;
    }
  }

  /**
   * 获取配置统计信息（调试用）
   */
  async getConfigStats(): Promise<{
    isConfigured: boolean;
    version?: string;
    lastUpdated?: string;
    brandCount?: number;
    storeCount?: number;
  }> {
    try {
      const config = await this.getConfig();

      if (!config) {
        return { isConfigured: false };
      }

      return {
        isConfigured: true,
        version: config.metadata.version,
        lastUpdated: config.metadata.lastUpdated,
        brandCount: Object.keys(config.brandData.brands).length,
        storeCount: config.brandData.stores.length,
      };
    } catch (error) {
      console.error("获取配置统计失败:", error);
      return { isConfigured: false };
    }
  }
}

// 导出单例实例
export const configService = new AppConfigService();

// 导出升级函数和版本常量供外部使用
export { upgradeConfigData, CONFIG_VERSION };

/**
 * 便捷函数：检查是否需要迁移
 */
export async function needsMigration(): Promise<boolean> {
  const isConfigured = await configService.isConfigured();

  // 如果未配置，肯定需要迁移
  if (!isConfigured) {
    return true;
  }

  // 检查版本和数据结构是否需要升级
  return await needsDataUpgrade();
}

/**
 * 检查是否需要数据升级
 */
export async function needsDataUpgrade(): Promise<boolean> {
  try {
    const config = await configService.getConfig();

    if (!config) {
      console.log("🔄 没有找到配置数据，需要执行初次迁移");
      return true;
    }

    // 检查版本号（包括缺失版本的情况）
    const currentVersion = config.metadata?.version;
    if (!currentVersion || currentVersion !== CONFIG_VERSION) {
      console.log(`🔄 检测到版本升级需求: ${currentVersion || "undefined"} -> ${CONFIG_VERSION}`);
      return true;
    }

    // 检查是否所有Position都有attendanceRequirement字段
    const hasAttendanceRequirements = config.brandData.stores.every(
      (store: { positions: { attendanceRequirement?: unknown }[] }) =>
        store.positions.every(
          (position: { attendanceRequirement?: unknown }) =>
            position.attendanceRequirement !== undefined
        )
    );

    if (!hasAttendanceRequirements) {
      console.log("🔄 检测到缺失的AttendanceRequirement字段，需要数据升级");
      return true;
    }

    // 检查是否所有新的replyPrompts分类都存在
    const requiredReplyPromptKeys = [
      "attendance_inquiry",
      "flexibility_inquiry",
      "attendance_policy_inquiry",
      "work_hours_inquiry",
      "availability_inquiry",
      "part_time_support",
    ];

    const hasAllReplyPrompts = requiredReplyPromptKeys.every(
      key => config.replyPrompts[key as keyof typeof config.replyPrompts] !== undefined
    );

    if (!hasAllReplyPrompts) {
      const missingKeys = requiredReplyPromptKeys.filter(
        key => config.replyPrompts[key as keyof typeof config.replyPrompts] === undefined
      );
      console.log(`🔄 检测到缺失的replyPrompts字段: ${missingKeys.join(", ")}，需要数据升级`);
      console.log(`📊 当前replyPrompts字段: ${Object.keys(config.replyPrompts).join(", ")}`);
      return true;
    }

    // 检查是否存在废弃的顶层字段（需要清理）
    const hasDeprecatedFields = "templates" in config.brandData || "screening" in config.brandData;

    if (hasDeprecatedFields) {
      console.log("🔄 检测到废弃的顶层字段（templates/screening），需要数据升级");
      return true;
    }

    // 检查是否存在废弃的 location_match
    const hasLocationMatch = "location_match" in config.replyPrompts;
    if (hasLocationMatch) {
      console.log("🔄 检测到废弃的 location_match 字段，需要数据升级");
      return true;
    }

    // 检查是否缺少新的系统提示词
    if (!config.systemPrompts?.bossZhipinLocalSystemPrompt) {
      console.log("🔄 检测到缺少 bossZhipinLocalSystemPrompt 系统提示词，需要数据升级");
      return true;
    }

    console.log(`✅ 配置数据检查完成，版本: ${currentVersion}，无需升级`);
    return false;
  } catch (error) {
    console.error("❌ 检查数据升级需求失败:", error);
    console.error("错误详情:", {
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return true; // 出错时保守处理，触发升级
  }
}

/**
 * 便捷函数：获取品牌数据
 */
export async function getBrandData(): Promise<ZhipinData | null> {
  const config = await configService.getConfig();
  return config?.brandData || null;
}

/**
 * 便捷函数：获取系统提示词
 */
export async function getSystemPrompts(): Promise<SystemPromptsConfig | null> {
  const config = await configService.getConfig();
  return config?.systemPrompts || null;
}

/**
 * 便捷函数：获取回复提示词
 */
export async function getReplyPrompts(): Promise<ReplyPromptsConfig | null> {
  const config = await configService.getConfig();
  return config?.replyPrompts || null;
}

/**
 * 便捷函数：获取活动系统提示词类型
 */
export async function getActiveSystemPromptType(): Promise<keyof SystemPromptsConfig> {
  const config = await configService.getConfig();
  return config?.activeSystemPrompt || "bossZhipinSystemPrompt";
}

/**
 * 浏览器环境迁移函数
 * 从硬编码数据创建配置，仅在浏览器环境中使用
 * 支持全新迁移和数据升级
 */
export async function migrateFromHardcodedData(): Promise<void> {
  // 检查是否在浏览器环境
  if (typeof window === "undefined") {
    throw new Error("迁移功能只能在浏览器环境中使用");
  }

  try {
    // 首先检查是否是数据升级场景
    const existingConfig = await configService.getConfig();

    if (existingConfig) {
      const currentVersion = existingConfig.metadata?.version;
      if (!currentVersion || currentVersion !== CONFIG_VERSION) {
        console.log(`🔄 执行数据升级 ${currentVersion || "undefined"} -> ${CONFIG_VERSION}...`);
        await upgradeConfigData(existingConfig);
        console.log("✅ 数据升级完成！");
        return;
      } else {
        console.log("ℹ️ 配置已是最新版本，无需升级");
        return;
      }
    }

    // 如果是全新迁移，执行完整的数据导入
    // 动态导入硬编码数据（仅在浏览器中）
    const [
      { zhipinData },
      { getBossZhipinSystemPrompt, getGeneralComputerSystemPrompt, getBossZhipinLocalSystemPrompt },
    ] = await Promise.all([
      import("../../lib/data/sample-data"),
      import("../../lib/system-prompts"),
    ]);

    // 智能回复指令配置
    const replyPromptsConfig: ReplyPromptsConfig = {
      initial_inquiry: `作为招聘助手，参考这个模板回复: "你好，{city}各区有{brand}门店在招人，排班{hours}小时，时薪{salary}元，{level_salary}"。语气要自然，突出薪资。`,
      location_inquiry: `候选人问位置，用这个模板回复: "你好，{city}各区都有门店，你在什么位置？我帮你查下附近"。必须问对方位置。`,
      no_location_match: `附近无门店，按这个话术处理: "你附近暂时没岗位，{alternative_location}的门店考虑吗？"。同时，主动询问是否可以加微信，告知以后有其他机会可以推荐。`,
      salary_inquiry: `薪资咨询，按这个模板提供信息: "基本薪资{salary}元/小时，{level_salary}"。需要包含阶梯薪资说明。`,
      schedule_inquiry: `时间安排咨询，参考这个话术: "门店除了{time1}空缺，还有{time2}也空缺呢，可以和店长商量"。强调时间灵活性。`,
      interview_request: `面试邀约，严格按照这个话术: "可以帮你和店长约面试，方便加下微信吗，需要几项简单的个人信息"。必须主动要微信。`,
      age_concern: `年龄问题，严格按运营指南处理：
      - 符合要求(18-45岁): "你的年龄没问题的"
      - 超出要求: "你附近目前没有岗位空缺了"
      绝不透露具体年龄限制。`,
      insurance_inquiry: `保险咨询，使用固定话术:
      - 标准回复: "有商业保险"
      简洁明确，不展开说明。`,
      followup_chat: `跟进聊天，参考这个话术模板保持联系: "门店除了{position1}还有{position2}也空缺的，可以和店长商量"。营造机会丰富的感觉。`,
      general_chat: `通用回复，引导到具体咨询。重新询问位置或工作意向，保持专业。`,
      // 🆕 新增：出勤和排班相关回复指令
      attendance_inquiry: `出勤要求咨询，参考这个话术: "出勤要求是{attendance_description}，一周最少{minimum_days}天，时间安排可以和店长商量。"。强调灵活性和协商性。`,
      flexibility_inquiry: `排班灵活性咨询，参考这个话术: "排班方式是{schedule_type}，{can_swap_shifts}换班，{part_time_allowed}兼职，比较人性化的。"。突出灵活性和人性化管理。`,
      attendance_policy_inquiry: `考勤政策咨询，参考这个话术: "考勤要求{punctuality_required}准时到岗，最多可以迟到{late_tolerance_minutes}分钟，{makeup_shifts_allowed}补班。"。说明具体政策细节。`,
      work_hours_inquiry: `工时要求咨询，参考这个话术: "每周工作{min_hours_per_week}-{max_hours_per_week}小时，可以根据你的时间来安排。"。强调时间安排的灵活性。`,
      availability_inquiry: `时间段可用性咨询，参考这个话术: "{time_slot}班次还有{available_spots}个位置，{priority}优先级，可以报名。"。提供具体的可用性信息。`,
      part_time_support: `兼职支持咨询，参考这个话术: "完全支持兼职，{part_time_allowed}，时间可以和其他工作错开安排。"。突出对兼职的支持和理解。`,
    };

    // 聚合所有配置数据
    const configData: AppConfigData = {
      // 品牌和门店数据
      brandData: zhipinData,

      // 系统级提示词
      systemPrompts: {
        bossZhipinSystemPrompt: getBossZhipinSystemPrompt(),
        generalComputerSystemPrompt: getGeneralComputerSystemPrompt(),
        bossZhipinLocalSystemPrompt: getBossZhipinLocalSystemPrompt(),
      },

      // 智能回复指令
      replyPrompts: replyPromptsConfig,

      // 活动系统提示词（默认使用Boss直聘）
      activeSystemPrompt: "bossZhipinSystemPrompt",

      // 配置元信息
      metadata: {
        version: CONFIG_VERSION,
        lastUpdated: new Date().toISOString(),
        migratedAt: new Date().toISOString(),
      },
    };

    // 保存到 localforage
    await configService.saveConfig(configData);

    console.log("✅ 浏览器环境数据迁移成功！");
  } catch (error) {
    console.error("❌ 浏览器环境数据迁移失败:", error);
    throw error;
  }
}

/**
 * 升级现有配置数据到新版本
 * @param existingConfig 现有配置
 * @param saveToStorage 是否保存到存储（默认true）
 * @param forceRepair 是否强制修复数据（即使版本号是最新的）
 * @returns 升级后的配置数据
 */
async function upgradeConfigData(
  existingConfig: AppConfigData,
  saveToStorage = true,
  forceRepair = false
): Promise<AppConfigData> {
  try {
    const currentVersion = existingConfig.metadata?.version || "undefined";
    const isLatestVersion = currentVersion === CONFIG_VERSION;

    // 判断是升级还是修复
    const operation = isLatestVersion && forceRepair ? "修复" : "升级";

    console.log(
      `🔄 开始${operation}配置数据 ${
        isLatestVersion
          ? `(版本 ${currentVersion} 保持不变)`
          : `从版本 ${currentVersion} 到 ${CONFIG_VERSION}`
      }`
    );

    console.log(`📊 ${operation}前数据状态:`, {
      replyPromptsCount: Object.keys(existingConfig.replyPrompts || {}).length,
      storesCount: existingConfig.brandData?.stores?.length || 0,
      hasVersion: !!existingConfig.metadata?.version,
      currentVersion,
    });

    // 导入最新的sample-data以获取attendanceRequirement示例，以及ReplyContextSchema获取所有模板键
    const [{ zhipinData }, { ReplyContextSchema }] = await Promise.all([
      import("../../lib/data/sample-data"),
      import("../../types/zhipin"),
    ]);

    // 创建升级后的品牌数据，移除已废弃的顶层templates和screening字段
    const upgradedBrandData = { ...existingConfig.brandData };

    // 🗑️ 移除已废弃的顶层字段（如果存在）
    if ("templates" in upgradedBrandData) {
      delete (upgradedBrandData as Record<string, unknown>).templates;
      console.log("✅ 移除了废弃的顶层templates字段");
    }
    if ("screening" in upgradedBrandData) {
      delete (upgradedBrandData as Record<string, unknown>).screening;
      console.log("✅ 移除了废弃的顶层screening字段");
    }

    // 🆕 升级品牌配置中的templates字段，确保包含所有必需的模板字段
    // 使用 ReplyContextSchema 的枚举值而不是硬编码
    const requiredTemplateKeys = ReplyContextSchema.options;

    const upgradedBrands = { ...upgradedBrandData.brands };
    Object.keys(upgradedBrands).forEach(brandName => {
      const brand = upgradedBrands[brandName] as Record<string, unknown>;
      const templates = (brand.templates || {}) as Record<string, string[]>;

      // 确保所有必需的模板字段都存在，缺失的设置为空数组
      requiredTemplateKeys.forEach(key => {
        if (!templates[key]) {
          templates[key] = [];
          console.log(`✅ 为品牌 ${brandName} 添加缺失的模板字段: ${key}`);
        }
      });

      brand.templates = templates;
    });
    upgradedBrandData.brands = upgradedBrands;

    // 为每个门店的每个岗位添加attendanceRequirement字段
    upgradedBrandData.stores.forEach((store: Record<string, unknown>, storeIndex: number) => {
      const positions = store.positions as Array<Record<string, unknown>>;
      store.positions = positions.map(
        (position: Record<string, unknown>, positionIndex: number) => {
          // 如果已经有attendanceRequirement，保持不变
          if (position.attendanceRequirement) {
            return position;
          }

          // 尝试从sample-data中找到对应的position作为模板
          const sampleStore = zhipinData.stores[storeIndex];
          const samplePosition = sampleStore?.positions[positionIndex];

          let defaultAttendanceRequirement;

          if (samplePosition?.attendanceRequirement) {
            // 使用对应的sample数据
            defaultAttendanceRequirement = samplePosition.attendanceRequirement;
          } else {
            // 生成默认的attendanceRequirement
            defaultAttendanceRequirement = generateDefaultAttendanceRequirement({
              name: position.name as string,
              urgent: position.urgent as boolean,
            });
          }

          return {
            ...position,
            attendanceRequirement: defaultAttendanceRequirement,
          };
        }
      );
    });

    // 升级回复指令配置，添加新的分类
    const upgradedReplyPrompts = { ...existingConfig.replyPrompts };

    // 🗑️ 处理废弃的 location_match 字段
    if ("location_match" in upgradedReplyPrompts) {
      // 如果 location_inquiry 不存在，将 location_match 的值迁移过去
      if (!upgradedReplyPrompts.location_inquiry) {
        upgradedReplyPrompts.location_inquiry = upgradedReplyPrompts.location_match as string;
        console.log("✅ 将 location_match 内容迁移到 location_inquiry");
      }
      // 删除废弃的 location_match
      delete (upgradedReplyPrompts as Record<string, unknown>).location_match;
      console.log("✅ 移除了废弃的 location_match 字段");
    }

    // 逐个检查并添加缺失的回复指令
    if (!upgradedReplyPrompts.attendance_inquiry) {
      upgradedReplyPrompts.attendance_inquiry = `出勤要求咨询，参考这个话术: "出勤要求是{attendance_description}，一周最少{minimum_days}天，时间安排可以和店长商量。"。强调灵活性和协商性。`;
    }

    if (!upgradedReplyPrompts.flexibility_inquiry) {
      upgradedReplyPrompts.flexibility_inquiry = `排班灵活性咨询，参考这个话术: "排班方式是{schedule_type}，{can_swap_shifts}换班，{part_time_allowed}兼职，比较人性化的。"。突出灵活性和人性化管理。`;
    }

    if (!upgradedReplyPrompts.attendance_policy_inquiry) {
      upgradedReplyPrompts.attendance_policy_inquiry = `考勤政策咨询，参考这个话术: "考勤要求{punctuality_required}准时到岗，最多可以迟到{late_tolerance_minutes}分钟，{makeup_shifts_allowed}补班。"。说明具体政策细节。`;
    }

    if (!upgradedReplyPrompts.work_hours_inquiry) {
      upgradedReplyPrompts.work_hours_inquiry = `工时要求咨询，参考这个话术: "每周工作{min_hours_per_week}-{max_hours_per_week}小时，可以根据你的时间来安排。"。强调时间安排的灵活性。`;
    }

    if (!upgradedReplyPrompts.availability_inquiry) {
      upgradedReplyPrompts.availability_inquiry = `时间段可用性咨询，参考这个话术: "{time_slot}班次还有{available_spots}个位置，{priority}优先级，可以报名。"。提供具体的可用性信息。`;
    }

    if (!upgradedReplyPrompts.part_time_support) {
      upgradedReplyPrompts.part_time_support = `兼职支持咨询，参考这个话术: "完全支持兼职，{part_time_allowed}，时间可以和其他工作错开安排。"。突出对兼职的支持和理解。`;
    }

    // 升级系统提示词（添加缺失的bossZhipinLocalSystemPrompt）
    const upgradedSystemPrompts = { ...existingConfig.systemPrompts };

    if (!upgradedSystemPrompts.bossZhipinLocalSystemPrompt) {
      // 导入getBossZhipinLocalSystemPrompt
      const { getBossZhipinLocalSystemPrompt } = await import("../../lib/system-prompts");
      upgradedSystemPrompts.bossZhipinLocalSystemPrompt = getBossZhipinLocalSystemPrompt();
      console.log("✅ 添加了新的系统提示词: bossZhipinLocalSystemPrompt");
    }

    // 创建升级后的配置
    const upgradedConfig: AppConfigData = {
      ...existingConfig,
      brandData: upgradedBrandData,
      replyPrompts: upgradedReplyPrompts,
      systemPrompts: upgradedSystemPrompts,
      metadata: {
        ...existingConfig.metadata,
        // 只有在真正升级时才更新版本号，修复时保持原版本
        version: isLatestVersion && forceRepair ? currentVersion : CONFIG_VERSION,
        lastUpdated: new Date().toISOString(),
        // 根据操作类型设置不同的时间戳字段
        ...(isLatestVersion && forceRepair
          ? { repairedAt: new Date().toISOString() }
          : { upgradedAt: new Date().toISOString() }),
      },
    };

    // 根据参数决定是否保存到存储
    if (saveToStorage) {
      await configService.saveConfig(upgradedConfig);
      console.log("✅ 配置数据已保存到存储");
    }

    console.log(`✅ 配置数据${operation}成功！`);
    console.log(`📊 ${operation}后数据状态:`, {
      version: upgradedConfig.metadata.version,
      operation: isLatestVersion && forceRepair ? "数据修复" : "版本升级",
      replyPromptsCount: Object.keys(upgradedConfig.replyPrompts).length,
      replyPromptsKeys: Object.keys(upgradedConfig.replyPrompts),
      hasAttendanceRequirements: upgradedBrandData.stores.every((store: Record<string, unknown>) =>
        (store.positions as Array<Record<string, unknown>>).every(
          (pos: Record<string, unknown>) => pos.attendanceRequirement !== undefined
        )
      ),
    });

    return upgradedConfig;
  } catch (error) {
    console.error("❌ 配置数据升级失败:", error);
    console.error("错误详情:", {
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      configState: {
        hasExistingConfig: !!existingConfig,
        hasMetadata: !!existingConfig?.metadata,
        hasReplyPrompts: !!existingConfig?.replyPrompts,
        hasBrandData: !!existingConfig?.brandData,
      },
    });
    throw error;
  }
}

/**
 * 为现有岗位生成默认的出勤要求
 */
function generateDefaultAttendanceRequirement(position: { name?: string; urgent?: boolean }) {
  // 导入ATTENDANCE_PATTERNS常量
  const ATTENDANCE_PATTERNS = {
    WEEKENDS: [6, 7],
    WEEKDAYS: [1, 2, 3, 4, 5],
    FRIDAY_TO_SUNDAY: [5, 6, 7],
    EVERYDAY: [1, 2, 3, 4, 5, 6, 7],
  };

  // 根据岗位特征生成默认规则
  const positionName = position.name?.toLowerCase() || "";
  const urgent = position.urgent || false;

  // 后厨岗位通常需要周末工作
  if (positionName.includes("后厨") || positionName.includes("厨房")) {
    return {
      requiredDays: ATTENDANCE_PATTERNS.WEEKENDS,
      minimumDays: 5,
      description: "周六、日上岗，一周至少上岗5天",
    };
  }

  // 紧急岗位要求更多天数
  if (urgent) {
    return {
      requiredDays: ATTENDANCE_PATTERNS.WEEKDAYS,
      minimumDays: 4,
      description: "周一-周五都上岗，一周至少上岗4天",
    };
  }

  // 通用岗位默认规则
  return {
    minimumDays: 3,
    description: "一周至少上岗3天，时间灵活",
  };
}
