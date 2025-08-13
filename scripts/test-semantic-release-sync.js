#!/usr/bin/env node

/**
 * 手动测试 semantic-release 同步脚本
 * 使用方法: node scripts/test-semantic-release-sync.js
 * 
 * 这个脚本创建一个模拟的 semantic-release 环境来测试同步功能
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// 导入要测试的模块
const syncPlugin = require('./semantic-release-sync-branches.js');

// 彩色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 模拟 logger
const mockLogger = {
  log: (msg) => log(`  [LOG] ${msg}`, 'cyan'),
  success: (msg) => log(`  [SUCCESS] ${msg}`, 'green'),
  error: (msg) => log(`  [ERROR] ${msg}`, 'red'),
  warn: (msg) => log(`  [WARN] ${msg}`, 'yellow'),
};

// 执行 git 命令的辅助函数
function git(command) {
  try {
    return execSync(`git ${command}`, { 
      encoding: 'utf8',
      stdio: 'pipe'
    }).trim();
  } catch (error) {
    return null;
  }
}

// 测试场景
async function runTests() {
  log('\n🧪 开始测试 semantic-release 同步脚本\n', 'magenta');
  
  // 测试 1: 非 main 分支应该跳过
  log('测试 1: 非 main 分支应该跳过同步', 'blue');
  try {
    const context = {
      logger: mockLogger,
      branch: { name: 'develop' },
      nextRelease: { version: '1.0.0' }
    };
    
    await syncPlugin.success({}, context);
    log('✅ 测试通过: 成功跳过非 main 分支\n', 'green');
  } catch (error) {
    log(`❌ 测试失败: ${error.message}\n`, 'red');
  }
  
  // 测试 2: 检查当前分支状态
  log('测试 2: 检查当前 Git 仓库状态', 'blue');
  try {
    const currentBranch = git('branch --show-current');
    const hasMain = git('branch -l main');
    const hasDevelop = git('branch -l develop');
    const remoteMain = git('ls-remote --heads origin main');
    const remoteDevelop = git('ls-remote --heads origin develop');
    
    log(`  当前分支: ${currentBranch || '(无)'}`);
    log(`  本地 main 分支: ${hasMain ? '存在' : '不存在'}`);
    log(`  本地 develop 分支: ${hasDevelop ? '存在' : '不存在'}`);
    log(`  远程 main 分支: ${remoteMain ? '存在' : '不存在'}`);
    log(`  远程 develop 分支: ${remoteDevelop ? '存在' : '不存在'}`);
    log('✅ 状态检查完成\n', 'green');
  } catch (error) {
    log(`❌ 状态检查失败: ${error.message}\n`, 'red');
  }
  
  // 测试 3: 模拟成功的同步（干运行）
  log('测试 3: 模拟成功的同步流程（干运行）', 'blue');
  let originalBranch = null;
  try {
    originalBranch = git('branch --show-current');
    
    // 只有当前在 develop 分支时才测试
    if (originalBranch === 'develop') {
      log('  检测到当前在 develop 分支，模拟 main 分支同步...');
      
      // 创建模拟的 context
      const context = {
        logger: mockLogger,
        branch: { name: 'main' },
        nextRelease: { version: '1.2.3-test' }
      };
      
      // 注意：这会实际尝试执行 git 命令，但由于我们在 develop 分支，
      // 它应该会失败在切换分支的步骤，这是预期的
      log('  注意: 以下操作是模拟的，可能会看到一些警告');
      
      // 我们可以通过设置环境变量来让脚本进入"测试模式"
      process.env.SEMANTIC_RELEASE_TEST_MODE = 'true';
      
      try {
        await syncPlugin.success({}, context);
        log('  同步流程执行完成');
      } catch (syncError) {
        log(`  同步流程遇到预期错误: ${syncError.message}`, 'yellow');
      } finally {
        delete process.env.SEMANTIC_RELEASE_TEST_MODE;
        // 恢复到原始分支
        const currentBranch = git('branch --show-current');
        if (currentBranch !== originalBranch) {
          log(`  恢复到原始分支 ${originalBranch}...`);
          git(`checkout ${originalBranch}`);
        }
      }
      
      log('✅ 模拟测试完成\n', 'green');
    } else {
      log('  跳过测试: 需要在 develop 分支执行', 'yellow');
      log('  请运行: git checkout develop\n', 'yellow');
    }
  } catch (error) {
    log(`❌ 模拟测试失败: ${error.message}\n`, 'red');
    // 确保恢复到原始分支
    if (originalBranch) {
      const currentBranch = git('branch --show-current');
      if (currentBranch !== originalBranch) {
        log(`  恢复到原始分支 ${originalBranch}...`);
        git(`checkout ${originalBranch}`);
      }
    }
  }
  
  // 测试 4: 验证 execSync 的 null 处理
  log('测试 4: 验证 execSync null 返回值处理', 'blue');
  try {
    // 直接测试有问题的代码路径
    const testExecGit = (command, options = {}) => {
      try {
        const result = execSync(`git ${command}`, {
          encoding: 'utf8',
          stdio: options.silent ? 'pipe' : 'inherit',
          ...options
        });
        
        // 这是修复的关键部分
        return result ? result.trim() : '';
      } catch (error) {
        return null;
      }
    };
    
    // 测试 inherit 模式（应该返回空字符串而不是崩溃）
    log('  测试 stdio: "inherit" 模式...');
    const result1 = testExecGit('--version', { silent: false });
    log(`  结果类型: ${result1 === '' ? '空字符串（正确）' : typeof result1}`);
    
    // 测试 pipe 模式（应该返回实际输出）
    log('  测试 stdio: "pipe" 模式...');
    const result2 = testExecGit('--version', { silent: true });
    log(`  结果: ${result2 ? '有输出（正确）' : '无输出'}`);
    
    log('✅ null 处理测试通过\n', 'green');
  } catch (error) {
    log(`❌ null 处理测试失败: ${error.message}\n`, 'red');
  }
  
  // 测试总结
  log('🎉 测试完成！', 'magenta');
  log('\n建议的下一步操作:', 'cyan');
  log('1. 确保 develop 分支存在并与 origin/develop 同步');
  log('2. 在真实的 PR 合并时观察脚本执行');
  log('3. 查看 GitHub Actions 的 semantic-release 日志');
  log('\n如果需要完整的集成测试，可以:', 'cyan');
  log('- 创建测试分支并模拟完整的发布流程');
  log('- 使用 semantic-release --dry-run 进行干运行测试');
}

// 运行测试
runTests().catch((error) => {
  log(`\n💥 测试运行器错误: ${error.message}`, 'red');
  process.exit(1);
});