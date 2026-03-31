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
import { ZhipinDataSchema, getAllStores } from "@/types/zhipin";
import type { Store } from "@/types/zhipin";

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

function parseVersionNumber(version: string): number[] {
  const parts = version.split(".").map(part => Number.parseInt(part, 10));
  if (parts.some(part => Number.isNaN(part))) {
    return [];
  }
  while (parts.length < 3) {
    parts.push(0);
  }
  return parts.slice(0, 3);
}

function isLegacyConfigVersion(version: string | undefined): boolean {
  if (!version) {
    return true;
  }

  const current = parseVersionNumber(version);
  const target = parseVersionNumber(CONFIG_VERSION);
  if (current.length === 0 || target.length === 0) {
    return true;
  }

  for (let i = 0; i < 3; i += 1) {
    if (current[i] < target[i]) return true;
    if (current[i] > target[i]) return false;
  }

  return false;
}

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

function buildReplyPolicyFromLegacy(
  legacyPrompts: LegacyPromptMap | null,
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
  if (privatePrompt && next.stageGoals.private_channel) {
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

  const parsed = ReplyPolicyConfigSchema.safeParse(next);
  return parsed.success ? parsed.data : cloneDefaultReplyPolicy();
}

function ensurePositionAttendance(
  brandData: ZhipinData,
  sampleData: ZhipinData
): ZhipinData {
  const allStores = getAllStores(brandData);
  const sampleStores = getAllStores(sampleData);

  const updatedStoreMap = new Map<string, Store>();

  allStores.forEach((store: Store, storeIndex: number) => {
    const sampleStore = sampleStores[storeIndex];

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

    updatedStoreMap.set(store.id, { ...store, positions });
  });

  return {
    ...brandData,
    brands: brandData.brands.map(brand => ({
      ...brand,
      stores: brand.stores.map(store => updatedStoreMap.get(store.id) ?? store),
    })),
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
  const defaultSystemPrompts = await buildDefaultSystemPrompts();

  const raw = isRecord(rawInput) ? rawInput : {};

  const brandDataParsed = ZhipinDataSchema.safeParse(raw.brandData);
  // 校验失败时降级为空数据集，不再回退 sample-data（避免假 Brand.id 污染）
  const emptyBrandData: ZhipinData = { meta: {}, brands: [] };
  let parsedBrandData = brandDataParsed.success ? brandDataParsed.data : emptyBrandData;

  // 🛡️ 老库迁移：清除残留的 sample 数据
  // 检测条件：sample: 前缀（新格式）或已知旧格式 sample ID
  const LEGACY_SAMPLE_IDS = new Set(["brand_chengduniliujie", "brand_damixiansheng"]);
  if (parsedBrandData.brands.length > 0) {
    const cleanedBrands = parsedBrandData.brands.filter(brand => {
      const isSampleBrand = brand.id.startsWith("sample:") || LEGACY_SAMPLE_IDS.has(brand.id);
      if (isSampleBrand) {
        console.log(`🧹 迁移清理: 移除 sample 品牌 "${brand.name}" (id: ${brand.id})`);
      }
      return !isSampleBrand;
    });
    if (cleanedBrands.length < parsedBrandData.brands.length) {
      parsedBrandData = { ...parsedBrandData, brands: cleanedBrands };
      // 清理 sample 来源标记
      if (parsedBrandData.meta?.source === "sample") {
        parsedBrandData = { ...parsedBrandData, meta: { ...parsedBrandData.meta, source: undefined } };
      }
      // 修正 defaultBrandId（清理后可能指向已不存在的品牌）
      const currentDefault = parsedBrandData.meta?.defaultBrandId;
      if (currentDefault && !cleanedBrands.some(b => b.id === currentDefault)) {
        parsedBrandData = {
          ...parsedBrandData,
          meta: { ...parsedBrandData.meta, defaultBrandId: cleanedBrands[0]?.id },
        };
      }
    }
  }

  const brandData = parsedBrandData.brands.length > 0
    ? ensurePositionAttendance(parsedBrandData, parsedBrandData)
    : parsedBrandData;

  const replyPolicyParsed = ReplyPolicyConfigSchema.safeParse(raw.replyPolicy);
  const legacyPrompts = extractLegacyPrompts(raw);
  const replyPolicy = replyPolicyParsed.success
    ? replyPolicyParsed.data
    : buildReplyPolicyFromLegacy(legacyPrompts);

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
  const needsFullResync =
    (typeof rawMetadata.needsFullResync === "boolean" && rawMetadata.needsFullResync) ||
    isLegacyConfigVersion(currentVersion) ||
    !brandDataParsed.success || // brandData 校验失败时强制标记需要全量重同步
    parsedBrandData.brands.length === 0; // 清理 sample 后为空，或初始就是空数据

  const backupBase = isRecord(rawMetadata.backup) ? rawMetadata.backup : undefined;
  const backupReplyPrompts = (() => {
    if (backupBase && isRecord(backupBase.replyPrompts)) {
      const record = toStringRecord(backupBase.replyPrompts);
      if (Object.keys(record).length > 0) {
        return record;
      }
    }
    return legacyReplyPrompts;
  })();
  const backupReplyPolicy = (() => {
    if (backupBase && "replyPolicy" in backupBase) {
      const parsed = ReplyPolicyConfigSchema.safeParse(backupBase.replyPolicy);
      if (parsed.success) {
        return parsed.data;
      }
    }
    return needsFullResync ? replyPolicy : undefined;
  })();
  const backupBrandPriorityStrategy = (() => {
    if (backupBase && "brandPriorityStrategy" in backupBase) {
      const value = backupBase.brandPriorityStrategy;
      if (value !== undefined) {
        return resolveBrandPriorityStrategy(value);
      }
    }
    return needsFullResync ? resolveBrandPriorityStrategy(raw.brandPriorityStrategy) : undefined;
  })();

  const metadata: AppConfigData["metadata"] = {
    version: forceRepair && currentVersion === CONFIG_VERSION ? currentVersion : CONFIG_VERSION,
    lastUpdated:
      typeof rawMetadata.lastUpdated === "string"
        ? rawMetadata.lastUpdated
        : new Date().toISOString(),
    migratedAt:
      typeof rawMetadata.migratedAt === "string"
        ? rawMetadata.migratedAt
        : needsFullResync
          ? new Date().toISOString()
          : undefined,
    upgradedAt: new Date().toISOString(),
    repairedAt: forceRepair ? new Date().toISOString() : undefined,
    needsFullResync,
    backup:
      backupReplyPrompts ||
      backupReplyPolicy ||
      backupBrandPriorityStrategy
        ? {
            replyPrompts: backupReplyPrompts,
            replyPolicy: backupReplyPolicy,
            brandPriorityStrategy: backupBrandPriorityStrategy,
            createdAt:
              typeof backupBase?.createdAt === "string"
                ? backupBase.createdAt
                : new Date().toISOString(),
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
        // 🛡️ 在正常加载路径也做 sample 品牌清理（覆盖已污染但 schema 合法的老库）
        const data = parsed.data;
        const LEGACY_SAMPLE_IDS = new Set(["brand_chengduniliujie", "brand_damixiansheng"]);
        const isSampleId = (id: string): boolean => id.startsWith("sample:") || LEGACY_SAMPLE_IDS.has(id);
        const hasSampleBrands = data.brandData.brands.some(b => isSampleId(b.id));
        if (hasSampleBrands) {
          const cleanedBrands = data.brandData.brands.filter(b => !isSampleId(b.id));
          const currentDefault = data.brandData.meta?.defaultBrandId;
          const defaultValid = currentDefault && cleanedBrands.some(b => b.id === currentDefault);
          const cleanedData: AppConfigData = {
            ...data,
            brandData: {
              ...data.brandData,
              brands: cleanedBrands,
              meta: {
                ...data.brandData.meta,
                source: data.brandData.meta?.source === "sample" ? undefined : data.brandData.meta?.source,
                defaultBrandId: defaultValid ? currentDefault : cleanedBrands[0]?.id,
              },
            },
            metadata: {
              ...data.metadata,
              needsFullResync: cleanedBrands.length === 0 ? true : data.metadata.needsFullResync,
            },
          };
          console.log(`🧹 getConfig: 清理 ${data.brandData.brands.length - cleanedBrands.length} 个 sample 品牌`);
          await this.saveConfig(cleanedData);
          return cleanedData;
        }
        return data;
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
      // 输出详细的校验失败信息便于排查
      const allIssues = parsed.error.issues.map(
        (i: { path: (string | number)[]; message: string; code: string }) =>
          `  [${i.code}] ${i.path.join(".")}: ${i.message}`
      );
      console.error(
        `[configService.saveConfig] AppConfigDataSchema 验证失败 (${parsed.error.issues.length} 个问题):\n${allIssues.join("\n")}`
      );

      // 降级策略：跳过严格验证直接保存（保留数据比丢弃更重要）
      console.warn(
        "[configService.saveConfig] 降级写入：跳过 schema 验证直接保存到 IndexedDB"
      );
      const configWithMetadata = {
        ...data,
        metadata: {
          ...data.metadata,
          version: data.metadata.version || CONFIG_VERSION,
          lastUpdated: new Date().toISOString(),
        },
      };
      await configStorage.setItem(this.storageKey, configWithMetadata);
      return;
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

  async clearBrandData(): Promise<void> {
    const currentConfig = await this.getConfig();
    if (!currentConfig) {
      throw new Error("配置数据不存在，请先初始化");
    }

    const clearedBrandData: ZhipinData = {
      meta: {},
      brands: [],
    };

    await this.saveConfig({
      ...currentConfig,
      brandData: clearedBrandData,
      metadata: {
        ...currentConfig.metadata,
        needsFullResync: true,
      },
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
      brandCount: config.brandData.brands.length,
      storeCount: getAllStores(config.brandData).length,
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

    const hasAttendanceRequirements = getAllStores(config.brandData).every((store: Store) =>
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

  const defaultSystemPrompts = await buildDefaultSystemPrompts();

  const emptyBrandData: ZhipinData = { meta: {}, brands: [] };

  const config: AppConfigData = {
    brandData: emptyBrandData,
    systemPrompts: defaultSystemPrompts,
    replyPolicy: cloneDefaultReplyPolicy(),
    activeSystemPrompt: "bossZhipinSystemPrompt",
    brandPriorityStrategy: "smart",
    metadata: {
      version: CONFIG_VERSION,
      lastUpdated: new Date().toISOString(),
      migratedAt: new Date().toISOString(),
      needsFullResync: true,
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
