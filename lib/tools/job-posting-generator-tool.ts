import { tool } from "ai";
import { z } from "zod/v3";
import { getDynamicRegistry } from "@/lib/model-registry/dynamic-registry";
import { DEFAULT_PROVIDER_CONFIGS } from "@/lib/config/models";
import { safeGenerateObject } from "@/lib/ai";
import type { Store, Position, ZhipinData } from "@/types/zhipin";

// 岗位类型枚举 - 包含常见的零售和餐饮岗位
const positionTypeSchema = z
  .enum([
    "前厅",
    "后厨",
    "洗碗",
    "早班",
    "日结", // 零售超市常见岗位
    "收银", // 收银员
    "理货", // 理货员
    "全职", // 通用全职
    "兼职", // 通用兼职
  ])
  .describe("岗位类型");

// 阶梯薪资解析 schema
const stepSalarySchema = z.object({
  step40Hours: z.string().describe("超40小时部分的工时要求描述，如：'超40小时的部分'"),
  step40Salary: z.number().describe("超40小时部分的时薪"),
  step80Hours: z.string().describe("超80小时部分的工时要求描述，如：'超80小时的部分'"),
  step80Salary: z.number().describe("超80小时部分的时薪"),
});

/**
 * 岗位推送消息生成工具
 *
 * @description 根据岗位类型生成格式化的微信推送消息
 * @param preferredBrand 用户选择的首选品牌
 * @param configData 配置数据，包含品牌和门店信息
 * @returns AI SDK tool instance
 */
export const jobPostingGeneratorTool = (preferredBrand?: string, configData?: ZhipinData) =>
  tool({
    description:
      "生成岗位空缺推送消息。根据指定的岗位类型，从品牌数据中筛选匹配的门店和岗位信息，生成格式化的微信群推送消息。",
    inputSchema: z.object({
      positionType: positionTypeSchema,
      brand: z.string().optional().describe("品牌名称，如果不指定则使用当前默认品牌"),
      limit: z.number().optional().default(10).describe("最多显示的门店数量，默认10个"),
    }),
    execute: async ({ positionType, brand, limit = 10 }) => {
      try {
        // 检查配置数据
        if (!configData) {
          return {
            type: "text" as const,
            text: "❌ 无法获取品牌数据，请确保配置已初始化",
          };
        }

        // 确定使用的品牌 - 优先级：工具参数 > 用户选择的品牌 > 默认品牌
        const targetBrand = brand || preferredBrand || configData.defaultBrand;
        if (!targetBrand) {
          return {
            type: "text" as const,
            text: "❌ 未指定品牌且没有默认品牌设置",
          };
        }

        // 筛选包含指定岗位的门店
        const matchingStores: Array<{
          store: Store;
          position: Position;
        }> = [];

        for (const store of configData.stores) {
          // 只处理指定品牌的门店
          if (store.brand !== targetBrand) continue;

          // 查找匹配的岗位
          for (const position of store.positions) {
            // 更灵活的匹配：检查岗位名称是否包含岗位类型关键词
            if (position.name.includes(positionType)) {
              matchingStores.push({ store, position });
              break; // 每个门店只取第一个匹配的岗位
            }
          }
        }

        if (matchingStores.length === 0) {
          return {
            type: "text" as const,
            text: `❌ 未找到${targetBrand}品牌下的${positionType}岗位空缺`,
          };
        }

        // 限制显示数量
        const displayStores = matchingStores.slice(0, limit);

        // 获取基础薪资（假设所有同类岗位薪资相同）
        const baseSalary = displayStores[0]?.position.salary.base || 24;
        const salaryMemo = displayStores[0]?.position.salary.memo || "";

        // 默认薪资信息
        const defaultStepSalary: z.infer<typeof stepSalarySchema> = {
          step40Hours: "超40小时的部分",
          step40Salary: baseSalary + 2,
          step80Hours: "超80小时的部分",
          step80Salary: baseSalary + 4,
        };

        // 使用 AI 解析阶梯薪资信息
        let stepSalaryInfo: z.infer<typeof stepSalarySchema> = defaultStepSalary;

        if (salaryMemo) {
          const dynamicRegistry = getDynamicRegistry(DEFAULT_PROVIDER_CONFIGS);
          const salaryResult = await safeGenerateObject({
            model: dynamicRegistry.languageModel("deepseek/deepseek-chat"),
            schema: stepSalarySchema,
            schemaName: "StepSalary",
            prompt: `请从以下薪资备注信息中提取阶梯工时薪资信息：

              ${salaryMemo}

              注意：
              1. 识别超过40小时和超过80小时的阶梯薪资
              2. 提取对应的时薪数字
              3. 保持原文中的描述方式`,
            onError: (error, rawText) => {
              // 如果是 markdown 格式，记录更详细的信息
              const details = error.details as Record<string, unknown> | undefined;
              if (details?.isMarkdownFormat) {
                console.warn("LLM returned markdown instead of JSON. Raw text:", rawText?.slice(0, 200));
              }
            },
          });

          if (salaryResult.success) {
            stepSalaryInfo = salaryResult.data;
          }
          // 失败时使用 defaultStepSalary（已在初始化时设置）
        }

        // 构建消息内容
        let message = `[太阳]急[太阳]${positionType}岗位空缺🔥\n\n`;

        // 添加门店信息
        for (const { store, position } of displayStores) {
          const timeSlots = position.timeSlots.join("、");
          message += `📍${store.district} - ${store.name}\n`;
          message += `时段：${timeSlots}\n\n`;
        }

        // 添加薪资信息
        message += `基础薪资 ${baseSalary}/小时\n`;
        message += `月工时【${stepSalaryInfo.step40Hours} ${stepSalaryInfo.step40Salary}】\n`;
        message += `月工时【${stepSalaryInfo.step80Hours} ${stepSalaryInfo.step80Salary}】\n\n`;

        // 添加尾部信息
        message += `【更多岗位空缺】，可点击下面的小程序查看，欢迎分享给亲友哦~\n\n`;
        message += `报名加我私聊~`;

        return {
          type: "text" as const,
          text: `✅ 已生成${positionType}岗位推送消息（${displayStores.length}个门店）：\n\n${message}`,
        };
      } catch (error) {
        console.error("生成岗位推送消息失败:", error);
        return {
          type: "text" as const,
          text: `❌ 生成消息失败: ${error instanceof Error ? error.message : "未知错误"}`,
        };
      }
    },
  });
