#!/usr/bin/env tsx

/**
 * 🚚 一次性数据迁移脚本
 * 将硬编码的数据文件迁移到 localforage 存储
 */

import { configService } from "../lib/services/config.service";
import { CONFIG_VERSION } from "@/types";
import { zhipinData } from "../lib/data/sample-data";
import {
  getBossZhipinSystemPrompt,
  getGeneralComputerSystemPrompt,
  getBossZhipinLocalSystemPrompt,
} from "../lib/system-prompts";
import type { AppConfigData, ReplyPromptsConfig } from "@/types";

/**
 * 智能回复指令配置
 * 从 zhipin-data-loader.ts 中的 replySystemPrompts 提取
 */
const replyPromptsConfig: ReplyPromptsConfig = {
  initial_inquiry: `作为招聘助手，参考这个模板回复: "你好，{city}各区有{brand}门店在招人，排班{hours}小时，时薪{salary}元，{level_salary}"。语气要自然，突出薪资。`,

  location_inquiry: `候选人咨询某个位置是否有门店，用这个模板回复: "离你比较近在{location}，空缺{schedule}"。强调距离近和具体班次。`,

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

  // 新增：出勤要求相关回复
  attendance_inquiry: `出勤要求咨询，参考话术: "出勤要求{attendance_description}，{minimum_days}天起"。强调灵活性。`,

  // 新增：排班灵活性相关回复
  flexibility_inquiry: `排班灵活性咨询，参考话术: "排班{schedule_type}，{can_swap_shifts}换班"。强调人性化。`,

  // 新增：考勤政策相关回复
  attendance_policy_inquiry: `考勤政策咨询，参考话术: "考勤要求{punctuality_required}准时到岗"。说明迟到政策。`,

  // 新增：工时要求相关回复
  work_hours_inquiry: `工时要求咨询，参考话术: "每周工作{min_hours_per_week}-{max_hours_per_week}小时"。强调灵活安排。`,

  // 新增：时间段可用性相关回复
  availability_inquiry: `时间段可用性咨询，参考话术: "{time_slot}班次还有{available_spots}个位置"。说明优先级。`,

  // 新增：兼职支持相关回复
  part_time_support: `兼职支持咨询，参考话术: "完全支持兼职，{part_time_allowed}"。强调时间错开安排。`,
};

/**
 * 执行迁移
 */
async function migrate() {
  console.log("🚚 开始数据迁移...");

  try {
    // 检查是否已经迁移过
    const isConfigured = await configService.isConfigured();
    if (isConfigured) {
      console.log("⚠️ 数据已存在，是否要覆盖？(y/N)");
      // 在实际使用中，这里可以添加用户确认逻辑
      // 暂时跳过，允许覆盖
      console.log("继续覆盖现有数据...");
    }

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

      // 配置元信息
      metadata: {
        version: CONFIG_VERSION,
        lastUpdated: new Date().toISOString(),
        migratedAt: new Date().toISOString(),
      },
    };

    // 保存到 localforage
    await configService.saveConfig(configData);

    // 验证迁移结果
    const savedConfig = await configService.getConfig();
    if (savedConfig) {
      console.log("✅ 数据迁移成功！");
      console.log(`📊 统计信息:`);
      console.log(`  - 品牌数量: ${Object.keys(savedConfig.brandData.brands).length}`);
      console.log(`  - 门店数量: ${savedConfig.brandData.stores.length}`);
      console.log(`  - 系统提示词: ${Object.keys(savedConfig.systemPrompts).length} 个`);
      console.log(`  - 回复指令: ${Object.keys(savedConfig.replyPrompts).length} 个`);
      console.log(`  - 配置版本: ${savedConfig.metadata.version}`);
      console.log(`  - 迁移时间: ${savedConfig.metadata.migratedAt}`);
    } else {
      throw new Error("迁移验证失败");
    }
  } catch (error) {
    console.error("❌ 数据迁移失败:", error);
    process.exit(1);
  }
}

/**
 * 主函数
 */
async function main() {
  console.log("📋 AI-SDK Computer Use 配置数据迁移工具");
  console.log("目标：将硬编码数据迁移到 localforage 存储\n");

  await migrate();

  console.log("\n🎉 迁移完成！");
  console.log("💡 提示：现在可以使用 /admin/settings 页面来管理配置");
}

// 执行迁移（如果直接运行此脚本）
if (require.main === module) {
  main().catch(error => {
    console.error("迁移脚本执行失败:", error);
    process.exit(1);
  });
}

export { migrate };
