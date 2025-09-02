/**
 * 薪资描述构建功能测试
 * 验证智能薪资类型识别和格式化效果
 */

import { describe, it, expect } from "vitest";

// 从loader中导入薪资构建函数（需要先导出）
// import { buildSalaryDescription } from '../zhipin-data.loader';

// 临时在测试文件中重现函数用于测试
function buildSalaryDescription(salary: { base: number; range?: string; memo: string }): string {
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

describe("薪资描述构建功能", () => {
  describe("计件制薪资处理", () => {
    it("应该正确处理奥乐齐分拣岗位的计件制薪资", () => {
      const salary = {
        base: 1.5,
        range: "220-250",
        memo: "计件制（首月有薪资保护，即入职之日起30天内）\n【首月】1、单价1.5元/单+2600元新人补贴\n2、26元/时，全月260小时保底薪资\n以上两种计薪方式取其高发放\n【次月开始】单价1.5元/单（目前门店一般220-250单/人/天）\n\n*30天内离职按照26/时*实际出勤工时计算薪资，无新人补贴；\n*顾客投诉或异常订单或不符合分拣流程和标准的订单，需要剔除，不结算费用；\n*若享受过新人补贴人员二次入职，无新人补贴；",
      };

      const result = buildSalaryDescription(salary);

      // 验证基本格式
      expect(result).toContain("1.5元");
      expect(result).toContain("计件制"); // 应该包含薪资类型信息
      expect(result).toContain("首月"); // 应该包含关键信息

      // 验证不是按时薪格式显示（应该以计件制格式开始）
      expect(result).toMatch(/^1\.5元（/); // 应该以"1.5元（"开始，而不是"1.5元/时"

      console.log("奥乐齐分拣岗位薪资描述:");
      console.log(result);
      console.log("---");
    });

    it("应该正确处理其他类型的计件制薪资", () => {
      const salary = {
        base: 2.8,
        range: "150-200",
        memo: "按件计费，单价2.8元/件，熟练工人每天可完成150-200件",
      };

      const result = buildSalaryDescription(salary);

      expect(result).toContain("2.8元");
      expect(result).not.toContain("元/时");
      expect(result).toContain("按件计费");

      console.log("其他计件制薪资描述:");
      console.log(result);
      console.log("---");
    });
  });

  describe("时薪制薪资处理", () => {
    it("应该正确处理常规时薪", () => {
      const salary = {
        base: 22,
        range: "22-25",
        memo: "时薪制，根据班次不同有小幅调整",
      };

      const result = buildSalaryDescription(salary);

      expect(result).toContain("22元/时");
      expect(result).toContain("范围22-25元");
      expect(result).toContain("时薪制"); // memo不长，应该包含

      console.log("常规时薪描述:");
      console.log(result);
      console.log("---");
    });

    it("应该正确处理高时薪（不包含长memo）", () => {
      const salary = {
        base: 30,
        range: "30-35",
        memo: "夜班补货员，工作时间22:00-07:00，时薪30-35元，包含夜班津贴，提供工作餐，有加班费，月休4天",
      };

      const result = buildSalaryDescription(salary);

      expect(result).toContain("30元/时");
      expect(result).toContain("范围30-35元");
      expect(result).not.toContain("夜班补货员"); // memo太长，不应该完整包含

      console.log("高时薪（长memo）描述:");
      console.log(result);
      console.log("---");
    });
  });

  describe("边界情况处理", () => {
    it("应该处理边界值（10元）", () => {
      const salary1 = {
        base: 9.9,
        range: "100-120",
        memo: "可能是计件制",
      };

      const salary2 = {
        base: 10.1,
        range: "10-12",
        memo: "应该是时薪",
      };

      const result1 = buildSalaryDescription(salary1);
      const result2 = buildSalaryDescription(salary2);

      expect(result1).not.toContain("元/时"); // 9.9应该被识别为计件制
      expect(result2).toContain("元/时"); // 10.1应该被识别为时薪

      console.log("边界值测试:");
      console.log("9.9元:", result1);
      console.log("10.1元:", result2);
      console.log("---");
    });

    it("应该处理空memo的情况", () => {
      const salary = {
        base: 5,
        range: "100-150",
        memo: "",
      };

      const result = buildSalaryDescription(salary);

      expect(result).toContain("5元/时"); // 没有memo时回退到时薪格式
      expect(result).toContain("范围100-150元"); // 应该包含范围信息

      console.log("空memo处理:");
      console.log(result);
      console.log("---");
    });
  });

  describe("实际效果展示", () => {
    it("展示构建的完整上下文信息示例", () => {
      const positions = [
        {
          name: "分拣打包",
          timeSlots: ["07:00~22:00"],
          salary: {
            base: 1.5,
            range: "220-250",
            memo: "计件制（首月有薪资保护，即入职之日起30天内）\n【首月】1、单价1.5元/单+2600元新人补贴\n2、26元/时，全月260小时保底薪资\n以上两种计薪方式取其高发放\n【次月开始】单价1.5元/单（目前门店一般220-250单/人/天）",
          },
        },
        {
          name: "服务员",
          timeSlots: ["09:00-18:00", "18:00-02:00"],
          salary: {
            base: 22,
            range: "22-25",
            memo: "时薪制，根据工作表现有调整空间",
          },
        },
      ];

      console.log("\n=== 完整上下文信息示例 ===");
      console.log("• 奥乐齐张江店（浦东新区张江）：上海市浦东新区张江高科技园区");

      positions.forEach(pos => {
        const salaryInfo = buildSalaryDescription(pos.salary);
        console.log(`  职位：${pos.name}，时间：${pos.timeSlots.join("、")}，薪资：${salaryInfo}`);
      });
      console.log("========================\n");
    });
  });
});
