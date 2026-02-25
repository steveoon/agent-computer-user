/**
 * 统一配置服务
 * Policy-first: replyPolicy 作为唯一运行时回复配置。
 */

import localforage from "localforage";
import {
  CONFIG_VERSION,
  DEFAULT_REPLY_POLICY,
  type AppConfigData,
  type BrandPriorityStrategy,
  type ConfigService,
  type ReplyPolicyConfig,
  type SystemPromptsConfig,
  type ZhipinData,
} from "@/types";
import { AppConfigDataSchema } from "@/types/config";
import { ReplyPolicyConfigSchema } from "@/types/reply-policy";
import { ZhipinDataSchema } from "@/types/zhipin";

const isClient = typeof window !== "undefined";

const configStorage = isClient
  ? localforage.createInstance({
      name: "ai-sdk-computer-use",
      storeName: "app_config",
      description: "应用配置数据存储",
    })
  : null;

type LegacyPromptMap = Record<string, string>;

const SYSTEM_PROMPT_KEYS = [
  "bossZhipinSystemPrompt",
  "generalComputerSystemPrompt",
  "bossZhipinLocalSystemPrompt",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function toStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(value)) {
    if (typeof val === "string") {
      result[key] = val;
    }
  }
  return result;
}

function cloneDefaultReplyPolicy(): ReplyPolicyConfig {
  return {
    ...DEFAULT_REPLY_POLICY,
    stageGoals: {
      ...DEFAULT_REPLY_POLICY.stageGoals,
      trust_building: { ...DEFAULT_REPLY_POLICY.stageGoals.trust_building },
      private_channel: { ...DEFAULT_REPLY_POLICY.stageGoals.private_channel },
      qualify_candidate: { ...DEFAULT_REPLY_POLICY.stageGoals.qualify_candidate },
      job_consultation: { ...DEFAULT_REPLY_POLICY.stageGoals.job_consultation },
      interview_scheduling: { ...DEFAULT_REPLY_POLICY.stageGoals.interview_scheduling },
      onboard_followup: { ...DEFAULT_REPLY_POLICY.stageGoals.onboard_followup },
    },
    persona: { ...DEFAULT_REPLY_POLICY.persona },
    industryVoices: Object.fromEntries(
      Object.entries(DEFAULT_REPLY_POLICY.industryVoices).map(([id, voice]) => [id, { ...voice }])
    ),
    hardConstraints: {
      rules: DEFAULT_REPLY_POLICY.hardConstraints.rules.map(rule => ({ ...rule })),
    },
    factGate: { ...DEFAULT_REPLY_POLICY.factGate },
    qualificationPolicy: {
      age: { ...DEFAULT_REPLY_POLICY.qualificationPolicy.age },
    },
  };
}

function resolveBrandPriorityStrategy(value: unknown): BrandPriorityStrategy {
  if (value === "user-selected" || value === "conversation-extracted" || value === "smart") {
    return value;
  }
  return "smart";
}

function resolveActiveSystemPrompt(value: unknown): keyof SystemPromptsConfig {
  if (
    value === "bossZhipinSystemPrompt" ||
    value === "generalComputerSystemPrompt" ||
    value === "bossZhipinLocalSystemPrompt"
  ) {
    return value;
  }
  return "bossZhipinSystemPrompt";
}

function buildDefaultSystemPrompts(): Promise<SystemPromptsConfig> {
  return import("@/lib/system-prompts").then(
    ({
      getBossZhipinSystemPrompt,
      getGeneralComputerSystemPrompt,
      getBossZhipinLocalSystemPrompt,
    }): SystemPromptsConfig => ({
      bossZhipinSystemPrompt: getBossZhipinSystemPrompt(),
      generalComputerSystemPrompt: getGeneralComputerSystemPrompt(),
      bossZhipinLocalSystemPrompt: getBossZhipinLocalSystemPrompt(),
    })
  );
}

function extractLegacyPrompts(raw: Record<string, unknown>): LegacyPromptMap | null {
  const oldReplyPrompts = toStringRecord(raw.replyPrompts);
  if (Object.keys(oldReplyPrompts).length > 0) {
    return oldReplyPrompts;
  }

  if (isRecord(raw.replyPolicy) && !("stageGoals" in raw.replyPolicy)) {
    const oldReplyPolicy = toStringRecord(raw.replyPolicy);
    if (Object.keys(oldReplyPolicy).length > 0) {
      return oldReplyPolicy;
    }
  }

  return null;
}

function extractBrandTemplatesBackup(brandData: unknown): Record<string, Record<string, string[]>> {
  if (!isRecord(brandData) || !isRecord(brandData.brands)) {
    return {};
  }

  const backup: Record<string, Record<string, string[]>> = {};

  for (const [brandName, config] of Object.entries(brandData.brands)) {
    if (!isRecord(config) || !isRecord(config.templates)) {
      continue;
    }

    const templateRecord: Record<string, string[]> = {};
    for (const [templateKey, templateVal] of Object.entries(config.templates)) {
      if (Array.isArray(templateVal)) {
        const values = templateVal.filter(item => typeof item === "string");
        if (values.length > 0) {
          templateRecord[templateKey] = values;
        }
      }
    }

    if (Object.keys(templateRecord).length > 0) {
      backup[brandName] = templateRecord;
    }
  }

  return backup;
}

function buildReplyPolicyFromLegacy(
  legacyPrompts: LegacyPromptMap | null,
  brandTemplates: Record<string, Record<string, string[]>> = {}
): ReplyPolicyConfig {
  const next = cloneDefaultReplyPolicy();

  if (!legacyPrompts) {
    return next;
  }

  const prompt = (key: string) => legacyPrompts[key]?.trim();

  const trustPrompt = prompt("initial_inquiry") || prompt("general_chat");
  const privatePrompt = prompt("interview_request") || prompt("followup_chat");
  const qualifyPrompt =
    prompt("age_concern") || prompt("attendance_inquiry") || prompt("requirements_inquiry");
  const consultPrompt =
    prompt("salary_inquiry") || prompt("schedule_inquiry") || prompt("location_inquiry");
  const interviewPrompt = prompt("interview_request") || prompt("availability_inquiry");
  const onboardPrompt =
    prompt("followup_chat") || prompt("part_time_support") || prompt("attendance_policy_inquiry");

  if (trustPrompt) {
    next.stageGoals.trust_building.primaryGoal = `建立信任并持续沟通（来源于旧模板）`;
    next.stageGoals.trust_building.ctaStrategy = trustPrompt;
  }
  if (privatePrompt) {
    next.stageGoals.private_channel.ctaStrategy = privatePrompt;
  }
  if (qualifyPrompt) {
    next.stageGoals.qualify_candidate.ctaStrategy = qualifyPrompt;
  }
  if (consultPrompt) {
    next.stageGoals.job_consultation.ctaStrategy = consultPrompt;
  }
  if (interviewPrompt) {
    next.stageGoals.interview_scheduling.ctaStrategy = interviewPrompt;
  }
  if (onboardPrompt) {
    next.stageGoals.onboard_followup.ctaStrategy = onboardPrompt;
  }

  const templateTexts = Object.values(brandTemplates)
    .flatMap(templates => Object.values(templates).flat())
    .map(text => text.trim())
    .filter(text => text.length > 0);

  if (templateTexts.length > 0) {
    const uniqueGuidance = Array.from(new Set(templateTexts)).slice(0, 6);
    const jargonDictionary = ["排班", "到岗", "门店", "班次", "面试", "微信", "薪资", "时薪"];
    const detectedJargon = jargonDictionary.filter(keyword =>
      templateTexts.some(text => text.includes(keyword))
    );

    next.industryVoices.default = {
      ...next.industryVoices.default,
      industryBackground: `${next.industryVoices.default.industryBackground}（迁移自品牌模板）`,
      jargon:
        detectedJargon.length > 0
          ? Array.from(new Set([...next.industryVoices.default.jargon, ...detectedJargon]))
          : next.industryVoices.default.jargon,
      guidance: uniqueGuidance,
    };
  }

  const parsed = ReplyPolicyConfigSchema.safeParse(next);
  return parsed.success ? parsed.data : cloneDefaultReplyPolicy();
}

function ensurePositionAttendance(
  brandData: ZhipinData,
  sampleData: ZhipinData
): ZhipinData {
  const stores = brandData.stores.map((store, storeIndex) => {
    const sampleStore = sampleData.stores[storeIndex];

    const positions = store.positions.map((position, positionIndex) => {
      if (position.attendanceRequirement) {
        return position;
      }

      const samplePosition = sampleStore?.positions[positionIndex];
      const attendanceRequirement =
        samplePosition?.attendanceRequirement ||
        generateDefaultAttendanceRequirement({
          name: position.name,
          urgent: position.urgent,
        });

      return {
        ...position,
        attendanceRequirement,
      };
    });

    return {
      ...store,
      positions,
    };
  });

  return {
    ...brandData,
    stores,
  };
}

function generateDefaultAttendanceRequirement(position: { name?: string; urgent?: boolean }) {
  const positionName = position.name?.toLowerCase() || "";
  const urgent = position.urgent || false;

  if (positionName.includes("后厨") || positionName.includes("厨房")) {
    return {
      requiredDays: [6, 7],
      minimumDays: 5,
      description: "周六、日上岗，一周至少上岗5天",
    };
  }

  if (urgent) {
    return {
      requiredDays: [1, 2, 3, 4, 5],
      minimumDays: 4,
      description: "周一到周五优先，一周至少上岗4天",
    };
  }

  return {
    minimumDays: 3,
    description: "一周至少上岗3天，时间可协商",
  };
}

async function normalizeToLatestConfig(
  rawInput: unknown,
  forceRepair = false
): Promise<AppConfigData> {
  const [{ zhipinData }, defaultSystemPrompts] = await Promise.all([
    import("@/lib/data/sample-data"),
    buildDefaultSystemPrompts(),
  ]);

  const raw = isRecord(rawInput) ? rawInput : {};

  const brandDataParsed = ZhipinDataSchema.safeParse(raw.brandData);
  const brandData = ensurePositionAttendance(
    brandDataParsed.success ? brandDataParsed.data : zhipinData,
    zhipinData
  );

  const brandTemplates = extractBrandTemplatesBackup(raw.brandData);
  const replyPolicyParsed = ReplyPolicyConfigSchema.safeParse(raw.replyPolicy);
  const legacyPrompts = extractLegacyPrompts(raw);
  const replyPolicy = replyPolicyParsed.success
    ? replyPolicyParsed.data
    : buildReplyPolicyFromLegacy(legacyPrompts, brandTemplates);

  const rawSystemPrompts = isRecord(raw.systemPrompts) ? raw.systemPrompts : {};
  const systemPrompts: SystemPromptsConfig = {
    bossZhipinSystemPrompt:
      typeof rawSystemPrompts.bossZhipinSystemPrompt === "string"
        ? rawSystemPrompts.bossZhipinSystemPrompt
        : defaultSystemPrompts.bossZhipinSystemPrompt,
    generalComputerSystemPrompt:
      typeof rawSystemPrompts.generalComputerSystemPrompt === "string"
        ? rawSystemPrompts.generalComputerSystemPrompt
        : defaultSystemPrompts.generalComputerSystemPrompt,
    bossZhipinLocalSystemPrompt:
      typeof rawSystemPrompts.bossZhipinLocalSystemPrompt === "string"
        ? rawSystemPrompts.bossZhipinLocalSystemPrompt
        : defaultSystemPrompts.bossZhipinLocalSystemPrompt,
  };

  const rawMetadata = isRecord(raw.metadata) ? raw.metadata : {};
  const legacyReplyPrompts = legacyPrompts ?? undefined;
  const currentVersion =
    typeof rawMetadata.version === "string" && rawMetadata.version.length > 0
      ? rawMetadata.version
      : CONFIG_VERSION;

  const metadata: AppConfigData["metadata"] = {
    version: forceRepair && currentVersion === CONFIG_VERSION ? currentVersion : CONFIG_VERSION,
    lastUpdated:
      typeof rawMetadata.lastUpdated === "string"
        ? rawMetadata.lastUpdated
        : new Date().toISOString(),
    migratedAt: typeof rawMetadata.migratedAt === "string" ? rawMetadata.migratedAt : undefined,
    upgradedAt: new Date().toISOString(),
    repairedAt: forceRepair ? new Date().toISOString() : undefined,
    backup:
      legacyReplyPrompts || Object.keys(brandTemplates).length > 0
        ? {
            replyPrompts: legacyReplyPrompts,
            brandTemplates: Object.keys(brandTemplates).length > 0 ? brandTemplates : undefined,
            createdAt: new Date().toISOString(),
          }
        : undefined,
  };

  const normalized: AppConfigData = {
    brandData,
    systemPrompts,
    replyPolicy,
    activeSystemPrompt: resolveActiveSystemPrompt(raw.activeSystemPrompt),
    brandPriorityStrategy: resolveBrandPriorityStrategy(raw.brandPriorityStrategy),
    metadata,
  };

  const parsed = AppConfigDataSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new Error(`配置升级失败: ${parsed.error.issues[0]?.message || "unknown"}`);
  }

  return parsed.data;
}

class AppConfigService implements ConfigService {
  private readonly storageKey = "APP_CONFIG_DATA";

  async getConfig(): Promise<AppConfigData | null> {
    if (!isClient || !configStorage) {
      return null;
    }

    try {
      const config = await configStorage.getItem<unknown>(this.storageKey);
      if (!config) {
        return null;
      }

      const parsed = AppConfigDataSchema.safeParse(config);
      if (parsed.success) {
        return parsed.data;
      }

      // 读取时兜底修复一次，避免脏数据阻断应用。
      const repaired = await normalizeToLatestConfig(config, true);
      await this.saveConfig(repaired);
      return repaired;
    } catch (error) {
      console.error("配置数据读取失败:", error);
      throw new Error("配置数据读取失败");
    }
  }

  async saveConfig(data: AppConfigData): Promise<void> {
    if (!isClient || !configStorage) {
      return;
    }

    const parsed = AppConfigDataSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(`配置数据格式错误: ${parsed.error.issues[0]?.message || "unknown"}`);
    }

    const configWithMetadata: AppConfigData = {
      ...parsed.data,
      metadata: {
        ...parsed.data.metadata,
        version: parsed.data.metadata.version || CONFIG_VERSION,
        lastUpdated: new Date().toISOString(),
      },
    };

    await configStorage.setItem(this.storageKey, configWithMetadata);
  }

  async updateBrandData(brandData: ZhipinData): Promise<void> {
    const currentConfig = await this.getConfig();
    if (!currentConfig) {
      throw new Error("配置数据不存在，请先初始化");
    }

    await this.saveConfig({
      ...currentConfig,
      brandData,
    });
  }

  async updateSystemPrompts(prompts: SystemPromptsConfig): Promise<void> {
    const currentConfig = await this.getConfig();
    if (!currentConfig) {
      throw new Error("配置数据不存在，请先初始化");
    }

    await this.saveConfig({
      ...currentConfig,
      systemPrompts: prompts,
    });
  }

  async updateReplyPolicy(policy: ReplyPolicyConfig): Promise<void> {
    const currentConfig = await this.getConfig();
    if (!currentConfig) {
      throw new Error("配置数据不存在，请先初始化");
    }

    await this.saveConfig({
      ...currentConfig,
      replyPolicy: policy,
    });
  }

  async updateActiveSystemPrompt(promptType: keyof SystemPromptsConfig): Promise<void> {
    const currentConfig = await this.getConfig();
    if (!currentConfig) {
      throw new Error("配置数据不存在，请先初始化");
    }

    await this.saveConfig({
      ...currentConfig,
      activeSystemPrompt: promptType,
    });
  }

  async clearConfig(): Promise<void> {
    if (!isClient || !configStorage) {
      return;
    }

    await configStorage.removeItem(this.storageKey);
  }

  async isConfigured(): Promise<boolean> {
    if (!isClient || !configStorage) {
      return false;
    }

    const config = await configStorage.getItem<unknown>(this.storageKey);
    return config !== null;
  }

  async getConfigStats(): Promise<{
    isConfigured: boolean;
    version?: string;
    lastUpdated?: string;
    brandCount?: number;
    storeCount?: number;
  }> {
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
  }
}

export const configService = new AppConfigService();

export async function needsMigration(): Promise<boolean> {
  const configured = await configService.isConfigured();
  if (!configured) {
    return true;
  }

  return needsDataUpgrade();
}

export async function needsDataUpgrade(): Promise<boolean> {
  if (!isClient || !configStorage) {
    return false;
  }

  try {
    const raw = await configStorage.getItem<unknown>("APP_CONFIG_DATA");
    if (!raw) {
      return true;
    }

    const parsed = AppConfigDataSchema.safeParse(raw);
    if (!parsed.success) {
      return true;
    }

    const config = parsed.data;
    if (config.metadata.version !== CONFIG_VERSION) {
      return true;
    }

    if (!config.systemPrompts.bossZhipinLocalSystemPrompt) {
      return true;
    }

    const hasAttendanceRequirements = config.brandData.stores.every(store =>
      store.positions.every(position => position.attendanceRequirement !== undefined)
    );

    if (!hasAttendanceRequirements) {
      return true;
    }

    for (const key of SYSTEM_PROMPT_KEYS) {
      if (!config.systemPrompts[key]) {
        return true;
      }
    }

    return false;
  } catch {
    return true;
  }
}

export async function getBrandData(): Promise<ZhipinData | null> {
  const config = await configService.getConfig();
  return config?.brandData || null;
}

export async function getSystemPrompts(): Promise<SystemPromptsConfig | null> {
  const config = await configService.getConfig();
  return config?.systemPrompts || null;
}

// 兼容旧函数名，返回新 policy 结构。
export async function getReplyPrompts(): Promise<ReplyPolicyConfig | null> {
  const config = await configService.getConfig();
  return config?.replyPolicy || null;
}

export async function getActiveSystemPromptType(): Promise<keyof SystemPromptsConfig> {
  const config = await configService.getConfig();
  return config?.activeSystemPrompt || "bossZhipinSystemPrompt";
}

export async function getBrandPriorityStrategy(): Promise<BrandPriorityStrategy> {
  const config = await configService.getConfig();
  return config?.brandPriorityStrategy || "smart";
}

export async function migrateFromHardcodedData(): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("迁移功能只能在浏览器环境中使用");
  }

  const existing = await configService.getConfig();
  if (existing) {
    const upgraded = await upgradeConfigData(existing, true, existing.metadata.version === CONFIG_VERSION);
    await configService.saveConfig(upgraded);
    return;
  }

  const [{ zhipinData }, defaultSystemPrompts] = await Promise.all([
    import("@/lib/data/sample-data"),
    buildDefaultSystemPrompts(),
  ]);

  const config: AppConfigData = {
    brandData: ensurePositionAttendance(zhipinData, zhipinData),
    systemPrompts: defaultSystemPrompts,
    replyPolicy: cloneDefaultReplyPolicy(),
    activeSystemPrompt: "bossZhipinSystemPrompt",
    brandPriorityStrategy: "smart",
    metadata: {
      version: CONFIG_VERSION,
      lastUpdated: new Date().toISOString(),
      migratedAt: new Date().toISOString(),
    },
  };

  await configService.saveConfig(config);
}

export async function upgradeConfigData(
  existingConfig: AppConfigData | Record<string, unknown>,
  saveToStorage = true,
  forceRepair = false
): Promise<AppConfigData> {
  const upgradedConfig = await normalizeToLatestConfig(existingConfig, forceRepair);

  if (saveToStorage) {
    await configService.saveConfig(upgradedConfig);
  }

  return upgradedConfig;
}

export { CONFIG_VERSION };
