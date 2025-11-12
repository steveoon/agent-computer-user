/**
 * ⚠️ 此脚本已废弃
 *
 * 品牌映射数据已迁移到数据库（data_dictionary 表）
 * 请使用 @/actions/brand-mapping 中的函数进行品牌管理
 *
 * 如需初始化数据，请：
 * 1. 在数据库中直接插入 data_dictionary 记录
 * 2. 或使用 /admin/settings 页面的品牌管理功能手动添加
 *
 * 此文件保留仅用于参考历史迁移逻辑
 */

import { db } from '../db';
import { dataDictionary, dictionaryChangeLog } from '../db/schema';
import { getDictionaryType } from '../db/types';
import { eq, and } from 'drizzle-orm';

// Mock 数据（原 ORGANIZATION_MAPPING，仅用于测试）
const ORGANIZATION_MAPPING: Record<number, string> = {};

interface MigrationResult {
  total: number;
  inserted: number;
  skipped: number;
  failed: number;
  errors: Array<{ key: string; error: string }>;
}

async function initBrandData(): Promise<MigrationResult> {
  const result: MigrationResult = {
    total: 0,
    inserted: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  console.log('🚀 开始初始化品牌数据...\n');
  console.log(`📊 源数据: ${Object.keys(ORGANIZATION_MAPPING).length} 条品牌映射`);
  console.log(`🏷️  来源系统: haimian\n`);

  // 转换为数组并排序（按 organizationId 升序）
  const entries = Object.entries(ORGANIZATION_MAPPING)
    .map(([id, name]) => ({
      organizationId: parseInt(id),
      brandName: name,
    }))
    .sort((a, b) => a.organizationId - b.organizationId);

  result.total = entries.length;

  try {
    // 使用事务：要么全部成功，要么全部回滚
    await db.transaction(async (tx) => {
      console.log('📝 处理中...\n');

      for (const entry of entries) {
        const { organizationId, brandName } = entry;
        const mappingKey = organizationId.toString();

        try {
          // 1. 检查是否已存在（同类型 + 同键 + 生效中）
          const existing = await tx
            .select()
            .from(dataDictionary)
            .where(
              and(
                eq(dataDictionary.dictionaryType, getDictionaryType('BRAND')),
                eq(dataDictionary.mappingKey, mappingKey),
                eq(dataDictionary.isActive, true)
              )
            )
            .limit(1);

          if (existing.length > 0) {
            console.log(`⏭️  跳过: ${mappingKey} - ${brandName} (已存在)`);
            result.skipped++;
            continue;
          }

          // 2. 插入数据
          const [inserted] = await tx
            .insert(dataDictionary)
            .values({
              dictionaryType: getDictionaryType('BRAND'),
              mappingKey,
              mappingValue: brandName,
              sourceSystem: 'haimian',
              description: `从 organization-mapping.ts 迁移 (组织ID: ${organizationId})`,
              displayOrder: organizationId, // 使用 organizationId 作为排序
              isActive: true,
              metadata: {
                migratedFrom: 'organization-mapping.ts',
                migratedAt: new Date().toISOString(),
                originalId: organizationId,
              },
            })
            .returning();

          console.log(`✅ 插入: ${mappingKey} - ${brandName}`);
          result.inserted++;

          // 4. 记录变更日志
          await tx.insert(dictionaryChangeLog).values({
            dictionaryId: inserted.id,
            operation: 'INIT', // 初始化操作
            oldData: null,     // 初始化无旧数据
            newData: inserted,
            changeReason: '数据初始化：从 organization-mapping.ts 迁移',
            operatedBy: 'system:init-script',
          });

        } catch (error) {
          console.error(`❌ 失败: ${mappingKey} - ${brandName}`, error);
          result.failed++;
          result.errors.push({
            key: mappingKey,
            error: error instanceof Error ? error.message : String(error),
          });

          // 继续处理其他数据，不中断事务
        }
      }

      // 如果有失败的，抛出错误回滚事务
      if (result.failed > 0) {
        throw new Error(`有 ${result.failed} 条数据插入失败，事务已回滚`);
      }
    });

    console.log('\n✨ 初始化完成！\n');
    console.log('📊 统计结果:');
    console.log(`   总数: ${result.total}`);
    console.log(`   ✅ 插入: ${result.inserted}`);
    console.log(`   ⏭️  跳过: ${result.skipped}`);
    console.log(`   ❌ 失败: ${result.failed}`);

    if (result.errors.length > 0) {
      console.log('\n❌ 错误详情:');
      result.errors.forEach(({ key, error }) => {
        console.log(`   - ${key}: ${error}`);
      });
    }

    return result;

  } catch (error) {
    console.error('\n❌ 初始化失败:', error);
    throw error;
  }
}

// 执行脚本
if (require.main === module) {
  initBrandData()
    .then((result) => {
      if (result.failed === 0) {
        console.log('\n🎉 所有数据初始化成功！');
        process.exit(0);
      } else {
        console.log('\n⚠️  部分数据初始化失败，请检查错误详情');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n💥 初始化过程中发生错误:', error);
      process.exit(1);
    });
}

export { initBrandData };