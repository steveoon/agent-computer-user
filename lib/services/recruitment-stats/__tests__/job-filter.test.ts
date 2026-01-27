/**
 * Job Filter Tests
 *
 * Tests for centralized job filtering utilities.
 */

import { describe, it, expect } from "vitest";
import {
  JOB_FILTER_MODE,
  buildJobCondition,
  buildJobConditionRaw,
  getJobColumnName,
  hasJobFilter,
} from "../job-filter";

describe("job-filter", () => {
  describe("JOB_FILTER_MODE", () => {
    it("当前应该是 name 模式", () => {
      expect(JOB_FILTER_MODE).toBe("name");
    });
  });

  describe("getJobColumnName", () => {
    it("name 模式下应该返回 job_name", () => {
      // 当前是 name 模式
      expect(getJobColumnName()).toBe("job_name");
    });
  });

  describe("hasJobFilter", () => {
    it("undefined 应该返回 false", () => {
      expect(hasJobFilter(undefined)).toBe(false);
    });

    it("空数组应该返回 false", () => {
      expect(hasJobFilter([])).toBe(false);
    });

    it("有值的数组应该返回 true", () => {
      expect(hasJobFilter(["岗位1"])).toBe(true);
      expect(hasJobFilter(["岗位1", "岗位2"])).toBe(true);
    });
  });

  describe("buildJobCondition", () => {
    it("空数组应该返回 undefined", () => {
      const result = buildJobCondition([]);
      expect(result).toBeUndefined();
    });

    it("有值时应该返回 Drizzle SQL 条件", () => {
      const result = buildJobCondition(["岗位1", "岗位2"]);
      // buildJobCondition 返回 Drizzle SQL 对象，不是 undefined
      expect(result).toBeDefined();
      // 由于是 Drizzle SQL 对象，我们只验证它存在
      // 具体的 SQL 生成由 Drizzle 负责
    });

    it("单个值也应该返回有效条件", () => {
      const result = buildJobCondition(["测试岗位"]);
      expect(result).toBeDefined();
    });
  });

  describe("buildJobConditionRaw (name 模式)", () => {
    it("空数组应该返回空字符串", () => {
      const result = buildJobConditionRaw("t", []);
      expect(result).toBe("");
    });

    it("单个值应该生成正确的 SQL", () => {
      const result = buildJobConditionRaw("events", ["软件工程师"]);
      expect(result).toBe("events.job_name IN ('软件工程师')");
    });

    it("多个值应该生成正确的 SQL", () => {
      const result = buildJobConditionRaw("e", ["岗位1", "岗位2", "岗位3"]);
      expect(result).toBe("e.job_name IN ('岗位1', '岗位2', '岗位3')");
    });

    it("应该正确处理不同的表别名", () => {
      const result1 = buildJobConditionRaw("received", ["测试"]);
      const result2 = buildJobConditionRaw("contacted", ["测试"]);

      expect(result1).toBe("received.job_name IN ('测试')");
      expect(result2).toBe("contacted.job_name IN ('测试')");
    });

    describe("SQL 注入防护", () => {
      it("应该转义单引号", () => {
        const result = buildJobConditionRaw("t", ["测试'岗位"]);
        expect(result).toBe("t.job_name IN ('测试''岗位')");
      });

      it("应该转义多个单引号", () => {
        const result = buildJobConditionRaw("t", ["It's a 'test'"]);
        expect(result).toBe("t.job_name IN ('It''s a ''test''')");
      });

      it("应该处理混合正常值和含引号的值", () => {
        const result = buildJobConditionRaw("t", ["正常岗位", "带'引号"]);
        expect(result).toBe("t.job_name IN ('正常岗位', '带''引号')");
      });

      it("应该处理空字符串值", () => {
        const result = buildJobConditionRaw("t", [""]);
        expect(result).toBe("t.job_name IN ('')");
      });

      it("应该处理只有引号的值", () => {
        // 输入: ''' (3 个单引号)
        // 转义后: '''''' (6 个单引号，每个 ' -> '')
        // 加外围引号: ' + '''''' + ' = '''''''' (8 个单引号)
        const result = buildJobConditionRaw("t", ["'''"]);
        expect(result).toBe("t.job_name IN ('''''''')");
      });
    });

    describe("特殊字符处理", () => {
      it("应该保留中文字符", () => {
        const result = buildJobConditionRaw("t", ["高级软件工程师（北京）"]);
        expect(result).toBe("t.job_name IN ('高级软件工程师（北京）')");
      });

      it("应该保留数字和字母", () => {
        const result = buildJobConditionRaw("t", ["Java工程师P7"]);
        expect(result).toBe("t.job_name IN ('Java工程师P7')");
      });

      it("应该保留常见特殊字符", () => {
        const result = buildJobConditionRaw("t", ["前端/后端-全栈"]);
        expect(result).toBe("t.job_name IN ('前端/后端-全栈')");
      });
    });
  });

  describe("将来 id 模式的测试预留", () => {
    /**
     * 当 JOB_FILTER_MODE 改为 "id" 时，启用以下测试：
     *
     * it("getJobColumnName 应该返回 job_id", () => {
     *   expect(getJobColumnName()).toBe("job_id");
     * });
     *
     * it("buildJobConditionRaw 应该生成 job_id IN (1, 2, 3)", () => {
     *   const result = buildJobConditionRaw("t", ["1", "2", "3"]);
     *   expect(result).toBe("t.job_id IN (1, 2, 3)");
     * });
     *
     * it("buildJobConditionRaw 应该过滤非数字值", () => {
     *   const result = buildJobConditionRaw("t", ["1", "invalid", "3"]);
     *   expect(result).toBe("t.job_id IN (1, 3)");
     * });
     *
     * it("buildJobConditionRaw 全是非数字值时返回空字符串", () => {
     *   const result = buildJobConditionRaw("t", ["invalid", "abc"]);
     *   expect(result).toBe("");
     * });
     */
    it.skip("id 模式测试（待 JOB_FILTER_MODE 切换后启用）", () => {
      // 占位测试
    });
  });
});
