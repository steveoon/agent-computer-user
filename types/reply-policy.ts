import { z } from 'zod/v3';

export const FunnelStageSchema = z.enum([
  "trust_building",
  "private_channel",
  "qualify_candidate",
  "job_consultation",
  "interview_scheduling",
  "onboard_followup",
]);

export const ReplyNeedSchema = z.enum([
  "stores",
  "location",
  "salary",
  "schedule",
  "policy",
  "availability",
  "requirements",
  "interview",
  "wechat",
  "none",
]);

export const RiskFlagSchema = z.enum([
  "insurance_promise_risk",
  "age_sensitive",
  "confrontation_emotion",
  "urgency_high",
  "qualification_mismatch",
]);

export const TurnExtractedInfoSchema = z.object({
  mentionedBrand: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  mentionedLocations: z
    .array(
      z.object({
        location: z.string(),
        confidence: z.number().min(0).max(1),
      })
    )
    .nullable()
    .optional(),
  mentionedDistricts: z
    .array(
      z.object({
        district: z.string(),
        confidence: z.number().min(0).max(1),
      })
    )
    .max(10)
    .nullable()
    .optional(),
  specificAge: z.number().nullable().optional(),
  hasUrgency: z.boolean().nullable().optional(),
  preferredSchedule: z.string().nullable().optional(),
});

export const TurnPlanSchema = z.object({
  stage: FunnelStageSchema,
  subGoals: z.array(z.string()).max(6),
  needs: z.array(ReplyNeedSchema).max(8),
  riskFlags: z.array(RiskFlagSchema).max(6),
  confidence: z.number().min(0).max(1),
  extractedInfo: TurnExtractedInfoSchema,
  reasoningText: z.string(),
});

export const StageGoalPolicySchema = z.object({
  primaryGoal: z.string(),
  successCriteria: z.array(z.string()),
  ctaStrategy: z.string(),
  disallowedActions: z.array(z.string()).optional(),
});

export const PersonaPolicySchema = z.object({
  tone: z.string(),
  warmth: z.string(),
  humor: z.string(),
  length: z.enum(["short", "medium", "long"]),
  questionStyle: z.string(),
  empathyStrategy: z.string(),
  addressStyle: z.string(),
  professionalIdentity: z.string(),
  companyBackground: z.string(),
});

export const IndustryVoicePolicySchema = z.object({
  name: z.string(),
  industryBackground: z.string(),
  jargon: z.array(z.string()),
  styleKeywords: z.array(z.string()),
  tabooPhrases: z.array(z.string()),
  guidance: z.array(z.string()),
});

export const HardConstraintRuleSchema = z.object({
  id: z.string(),
  rule: z.string(),
  severity: z.enum(["high", "medium", "low"]),
});

export const HardConstraintsPolicySchema = z.object({
  rules: z.array(HardConstraintRuleSchema),
});

export const FactGatePolicySchema = z.object({
  mode: z.enum(["strict", "balanced", "open"]),
  verifiableClaimTypes: z.array(z.string()),
  fallbackBehavior: z.enum(["generic_answer", "ask_followup", "handoff"]),
  forbiddenWhenMissingFacts: z.array(z.string()),
});

const StageGoalsSchema = z.object({
  trust_building: StageGoalPolicySchema,
  private_channel: StageGoalPolicySchema,
  qualify_candidate: StageGoalPolicySchema,
  job_consultation: StageGoalPolicySchema,
  interview_scheduling: StageGoalPolicySchema,
  onboard_followup: StageGoalPolicySchema,
});

export const ReplyPolicyConfigSchema = z.object({
  stageGoals: StageGoalsSchema,
  persona: PersonaPolicySchema,
  industryVoices: z.record(z.string(), IndustryVoicePolicySchema),
  defaultIndustryVoiceId: z.string(),
  hardConstraints: HardConstraintsPolicySchema,
  factGate: FactGatePolicySchema,
});

export type FunnelStage = z.infer<typeof FunnelStageSchema>;
export type ReplyNeed = z.infer<typeof ReplyNeedSchema>;
export type RiskFlag = z.infer<typeof RiskFlagSchema>;
export type TurnExtractedInfo = z.infer<typeof TurnExtractedInfoSchema>;
export type TurnPlan = z.infer<typeof TurnPlanSchema>;
export type StageGoalPolicy = z.infer<typeof StageGoalPolicySchema>;
export type PersonaPolicy = z.infer<typeof PersonaPolicySchema>;
export type IndustryVoicePolicy = z.infer<typeof IndustryVoicePolicySchema>;
export type HardConstraintRule = z.infer<typeof HardConstraintRuleSchema>;
export type HardConstraintsPolicy = z.infer<typeof HardConstraintsPolicySchema>;
export type FactGatePolicy = z.infer<typeof FactGatePolicySchema>;
export type ReplyPolicyConfig = z.infer<typeof ReplyPolicyConfigSchema>;

export const DEFAULT_REPLY_POLICY: ReplyPolicyConfig = {
  stageGoals: {
    trust_building: {
      primaryGoal: "建立信任并了解求职意向",
      successCriteria: ["候选人愿意继续沟通"],
      ctaStrategy: "用轻量提问引导需求细化",
      disallowedActions: ["过早承诺具体待遇"],
    },
    private_channel: {
      primaryGoal: "推动进入私域沟通",
      successCriteria: ["候选人愿意交换联系方式"],
      ctaStrategy: "说明后续沟通效率与资料同步价值",
      disallowedActions: ["强迫式要微信"],
    },
    qualify_candidate: {
      primaryGoal: "确认基本匹配度",
      successCriteria: ["完成年龄/时间/岗位匹配确认"],
      ctaStrategy: "逐条确认关键条件",
      disallowedActions: ["直接否定候选人"],
    },
    job_consultation: {
      primaryGoal: "回答岗位问题并提升兴趣",
      successCriteria: ["候选人对岗位保持兴趣"],
      ctaStrategy: "先答核心问题，再给下一步建议",
      disallowedActions: ["编造数字或政策"],
    },
    interview_scheduling: {
      primaryGoal: "推动面试预约",
      successCriteria: ["候选人给出可面试时间"],
      ctaStrategy: "给出明确时间选项并确认",
      disallowedActions: ["不确认候选人可到店性"],
    },
    onboard_followup: {
      primaryGoal: "促进到岗并保持回访",
      successCriteria: ["候选人确认上岗安排"],
      ctaStrategy: "明确下一步动作与提醒",
      disallowedActions: ["承诺不确定资源"],
    },
  },
  persona: {
    tone: "口语化",
    warmth: "高",
    humor: "低",
    length: "short",
    questionStyle: "单轮一个关键问题",
    empathyStrategy: "先认可关切再给建议",
    addressStyle: "使用你",
    professionalIdentity: "资深招聘专员",
    companyBackground: "连锁餐饮招聘",
  },
  industryVoices: {
    default: {
      name: "餐饮连锁招聘",
      industryBackground: "门店密集、排班灵活、强调稳定出勤",
      jargon: ["排班", "到岗", "门店", "班次"],
      styleKeywords: ["直接", "清晰", "可信"],
      tabooPhrases: ["包过", "绝对", "随便都行"],
      guidance: ["先解决顾虑，再推动下一步"],
    },
  },
  defaultIndustryVoiceId: "default",
  hardConstraints: {
    rules: [
      {
        id: "no-fabrication",
        rule: "不得编造门店、薪资、排班、福利等事实信息",
        severity: "high",
      },
      {
        id: "no-insurance-promise",
        rule: "兼职场景不得承诺五险一金",
        severity: "high",
      },
      {
        id: "age-sensitive",
        rule: "年龄敏感问题使用合规话术，不暴露内部筛选线",
        severity: "high",
      },
    ],
  },
  factGate: {
    mode: "strict",
    verifiableClaimTypes: ["salary", "location", "schedule", "policy", "availability"],
    fallbackBehavior: "generic_answer",
    forbiddenWhenMissingFacts: ["具体数字", "具体门店承诺", "明确福利承诺"],
  },
};
