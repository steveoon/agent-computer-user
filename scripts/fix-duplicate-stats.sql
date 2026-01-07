-- 修复 recruitment_daily_stats 表的重复记录问题
-- 执行前请先备份数据！
-- 执行时间: 约 1 分钟

BEGIN;

-- 1. 查看将要删除的重复记录数量
SELECT COUNT(*) as records_to_delete
FROM (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY agent_id, stat_date, COALESCE(brand_id, -1), COALESCE(job_id, -1)
      ORDER BY updated_at DESC, id DESC
    ) as rn
  FROM app_huajune.recruitment_daily_stats
) sub
WHERE rn > 1;

-- 2. 删除重复记录（保留每组中 updated_at 最新的，如果相同则取 id 最大的）
DELETE FROM app_huajune.recruitment_daily_stats
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY agent_id, stat_date, COALESCE(brand_id, -1), COALESCE(job_id, -1)
        ORDER BY updated_at DESC, id DESC
      ) as rn
    FROM app_huajune.recruitment_daily_stats
  ) sub
  WHERE rn > 1
);

-- 3. 删除旧的唯一索引（对 NULL 无效）
DROP INDEX IF EXISTS app_huajune.unique_daily_stats;

-- 4. 添加新的唯一索引（使用 COALESCE 处理 NULL）
CREATE UNIQUE INDEX unique_daily_stats_v2
ON app_huajune.recruitment_daily_stats (
  agent_id,
  stat_date,
  COALESCE(brand_id, -1),
  COALESCE(job_id, -1)
);

-- 5. 验证没有重复记录
SELECT
  agent_id,
  stat_date,
  brand_id,
  job_id,
  COUNT(*) as cnt
FROM app_huajune.recruitment_daily_stats
GROUP BY agent_id, stat_date, brand_id, job_id
HAVING COUNT(*) > 1;

COMMIT;

-- 如果一切正常，上面的验证查询应该返回 0 行
