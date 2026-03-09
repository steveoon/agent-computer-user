import { z } from "zod/v3";
import {
  type FunnelStage,
  type ReplyNeed,
  type RiskFlag,
  type StageGoalPolicy,
} from "@/types/reply-policy";

// ========== 实体提取 Schema ==========

export const InterviewInfoSchema = z.object({
  name: z.string().nullable().describe("姓名（如：\"张三\"）"),
  phone: z.string().nullable().describe("联系方式（如：\"13800138000\"）"),
  gender: z.string().nullable().describe("性别（如：\"男\"、\"女\"）"),
  age: z.string().nullable().describe("年龄（保留原话，如：\"18\"、\"25岁\"）"),
  applied_store: z.string().nullable().describe("应聘门店（如：\"人民广场店\"）"),
  applied_position: z.string().nullable().describe("应聘岗位（如：\"服务员\"）"),
  interview_time: z.string().nullable().describe("面试时间（如：\"明天下午2点\"）"),
  is_student: z.boolean().nullable().describe("是否是学生"),
  education: z.string().nullable().describe("学历（如：\"大专\"、\"本科\"），用于预约面试"),
  has_health_certificate: z.string().nullable().describe("是否有健康证（如：\"有\"、\"无但接受办理\"、\"无且不接受\")"),
});

export const PreferencesSchema = z.object({
  brands: z.array(z.string()).nullable().describe("意向品牌（数组，统一为品牌名称，如：[\"肯德基\", \"麦当劳\"]）"),
  salary: z.string().nullable().describe("意向薪资（保留原话，如：\"时薪20\"、\"4000-5000\"）"),
  position: z.array(z.string()).nullable().describe("意向岗位（数组，如：[\"服务员\", \"收银员\"]）"),
  schedule: z.string().nullable().describe("意向班次/时间（如：\"周末\"、\"晚班\"）"),
  city: z.string().nullable().describe("意向城市（如：\"上海\"、\"杭州\"）"),
  district: z.array(z.string()).nullable().describe("意向区域（数组，如：[\"浦东\", \"徐汇\"]）"),
  location: z.array(z.string()).nullable().describe("意向地点/商圈（数组，如：[\"人民广场\", \"陆家嘴\"]）"),
  labor_form: z.string().nullable().describe("用工形式（兼职、全职、寒假工、暑假工、小时工）"),
});

export const EntityExtractionResultSchema = z.object({
  interview_info: InterviewInfoSchema,
  preferences: PreferencesSchema,
  reasoning: z.string().describe("提取与推理说明：列出每个字段的来源（直接提取/推理得出），推理字段需说明推理链（如：'用户提到在读大三 → 推断为本科在读学生'）"),
});

export const BrandInfoSchema = z.object({
  name: z.string().describe("品牌正式名称"),
  aliases: z.array(z.string()).describe("品牌别名列表"),
});

export const BrandDataListSchema = z.array(BrandInfoSchema);

export type InterviewInfo = z.infer<typeof InterviewInfoSchema>;
export type Preferences = z.infer<typeof PreferencesSchema>;
export type EntityExtractionResult = z.infer<typeof EntityExtractionResultSchema>;
export type BrandInfo = z.infer<typeof BrandInfoSchema>;
export type BrandDataList = z.infer<typeof BrandDataListSchema>;

// ---- wework_plan_turn ----

export type WeworkPlanTurnOutput = {
  stage: FunnelStage;
  needs: ReplyNeed[];
  riskFlags: RiskFlag[];
  confidence: number;
  reasoning: string;
  stageGoal: StageGoalPolicy;
};
