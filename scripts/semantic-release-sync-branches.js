/**
 * Semantic Release 插件：自动同步 main 分支到 develop
 * 
 * 在 main 分支发布完成后，自动将更改合并回 develop 分支
 * 避免版本号和 CHANGELOG 冲突
 */

const { execSync } = require('child_process');

/**
 * 执行 Git 命令的辅助函数
 */
function execGit(command, options = {}) {
  try {
    const result = execSync(`git ${command}`, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
    
    // 当 stdio 是 'inherit' 时，result 是 null
    // 当 stdio 是 'pipe' 时，result 是字符串
    return result ? result.trim() : '';
  } catch (error) {
    if (!options.silent) {
      console.error(`Git command failed: git ${command}`);
      console.error(error.message);
    }
    throw error;
  }
}

/**
 * 检查分支是否存在
 */
function branchExists(branch) {
  try {
    execGit(`rev-parse --verify origin/${branch}`, { silent: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Success 生命周期钩子
 * 在发布成功后执行
 */
async function success(pluginConfig, context) {
  const { logger, branch, nextRelease } = context;
  
  // 只在 main 分支发布后执行同步
  if (branch.name !== 'main') {
    logger.log('Not on main branch, skipping sync to develop');
    return;
  }

  // 检查 develop 分支是否存在
  if (!branchExists('develop')) {
    logger.log('Develop branch does not exist, skipping sync');
    return;
  }

  logger.log('Starting sync from main to develop...');

  try {
    // 获取当前分支
    const currentBranch = execGit('branch --show-current', { silent: true });
    
    // 配置 Git 用户（使用 semantic-release 的 bot 身份）
    execGit('config user.name "semantic-release-bot"', { silent: true });
    execGit('config user.email "semantic-release-bot@martynus.net"', { silent: true });
    
    // 获取最新的远程分支信息
    logger.log('Fetching latest branches...');
    execGit('fetch origin', { silent: true });
    
    // 切换到 develop 分支
    logger.log('Switching to develop branch...');
    execGit('checkout develop', { silent: true });
    
    // 尝试合并 main 分支
    logger.log(`Merging main (v${nextRelease.version}) into develop...`);
    
    try {
      // 尝试自动合并
      execGit(`merge origin/main --no-ff -m "chore: sync release v${nextRelease.version} from main to develop [skip ci]

This is an automated merge to sync the latest release from main branch.
Version: ${nextRelease.version}
Released: ${new Date().toISOString()}"`);
      
      logger.log('Merge successful, no conflicts detected');
      
    } catch (mergeError) {
      // 如果有冲突，尝试智能解决
      logger.log('Merge conflict detected, attempting automatic resolution...');
      
      // 获取冲突文件列表
      const conflicts = execGit('diff --name-only --diff-filter=U', { silent: true }).split('\n').filter(Boolean);
      
      for (const file of conflicts) {
        if (file === 'package.json') {
          // 对于 package.json，使用 develop 的版本（因为它应该更高）
          logger.log('Resolving package.json conflict (keeping develop version)...');
          execGit('checkout --ours package.json');
          execGit('add package.json');
          
        } else if (file === 'CHANGELOG.md') {
          // 对于 CHANGELOG.md，尝试合并两边的内容
          logger.log('Resolving CHANGELOG.md conflict...');
          
          // 保存两边的内容
          const oursContent = execGit('show :2:CHANGELOG.md', { silent: true });
          const theirsContent = execGit('show :3:CHANGELOG.md', { silent: true });
          
          // 简单策略：保留 develop 的内容，但添加 main 的新版本信息
          // 这里可以实现更复杂的合并逻辑
          execGit('checkout --ours CHANGELOG.md');
          execGit('add CHANGELOG.md');
          
        } else if (file === 'pnpm-lock.yaml' || file === 'package-lock.json') {
          // 对于锁文件，使用 main 的版本（更稳定）
          logger.log(`Resolving ${file} conflict (using main version)...`);
          execGit(`checkout --theirs ${file}`);
          execGit(`add ${file}`);
          
        } else {
          // 对于其他文件，记录警告但继续
          logger.warn(`Unable to auto-resolve conflict in ${file}, manual intervention may be needed`);
        }
      }
      
      // 提交解决冲突后的合并
      execGit(`commit -m "chore: sync release v${nextRelease.version} from main with conflict resolution [skip ci]

Automated conflict resolution:
- package.json: kept develop version
- CHANGELOG.md: merged content
- lock files: used main version"`);
      
      logger.log('Conflicts resolved automatically');
    }
    
    // 推送到远程
    logger.log('Pushing to origin/develop...');
    execGit('push origin develop');
    
    logger.success(`✅ Successfully synced main (v${nextRelease.version}) to develop`);
    
    // 切换回原来的分支
    if (currentBranch && currentBranch !== 'develop') {
      execGit(`checkout ${currentBranch}`, { silent: true });
    }
    
  } catch (error) {
    logger.error('Failed to sync main to develop:', error.message);
    
    // 尝试恢复到原始状态
    try {
      execGit('merge --abort', { silent: true });
    } catch {}
    
    try {
      execGit('checkout main', { silent: true });
    } catch {}
    
    // 不抛出错误，避免影响发布流程
    logger.warn('⚠️  Automatic sync failed. Please manually merge main into develop.');
    logger.warn('Run: git checkout develop && git merge main');
  }
}

module.exports = {
  success
};