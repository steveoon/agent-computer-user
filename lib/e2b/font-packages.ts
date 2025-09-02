// E2B环境中可用字体包的检测和推荐

import { type E2BDesktop } from "./utils";

export interface FontPackage {
  name: string;
  description: string;
  priority: number; // 优先级，数字越小优先级越高
  alternatives?: string[]; // 备用包名
}

// 命令执行结果类型
interface CommandResult {
  stdout?: string;
  stderr?: string;
  exitCode: number;
}

// 基础字体包列表（按优先级排序）
export const BASIC_FONT_PACKAGES: FontPackage[] = [
  {
    name: "fonts-dejavu",
    description: "DejaVu 字体集合",
    priority: 1,
    alternatives: ["ttf-dejavu", "ttf-dejavu-core"],
  },
  {
    name: "fonts-liberation",
    description: "Liberation 字体集合",
    priority: 2,
    alternatives: ["ttf-liberation"],
  },
  {
    name: "fontconfig",
    description: "字体配置工具",
    priority: 3,
  },
];

// 中文字体包列表（如果基础包可用的话）
export const CHINESE_FONT_PACKAGES: FontPackage[] = [
  {
    name: "fonts-wqy-zenhei",
    description: "文泉驿正黑（最常用的中文黑体）",
    priority: 1,
    alternatives: ["ttf-wqy-zenhei"],
  },
  {
    name: "fonts-wqy-microhei",
    description: "文泉驿微米黑",
    priority: 2,
    alternatives: ["ttf-wqy-microhei"],
  },
  {
    name: "fonts-arphic-uming",
    description: "文鼎PL細上海宋（宋体）",
    priority: 3,
    alternatives: ["ttf-arphic-uming"],
  },
  {
    name: "fonts-arphic-ukai",
    description: "文鼎PL中楷（楷体）",
    priority: 4,
    alternatives: ["ttf-arphic-ukai"],
  },
];

/**
 * 检测系统中可用的字体包
 */
export const detectAvailableFontPackages = async (desktop: E2BDesktop): Promise<FontPackage[]> => {
  console.log("🔍 检测可用的字体包...");
  const available: FontPackage[] = [];

  // 检查基础包
  for (const pkg of BASIC_FONT_PACKAGES) {
    const isAvailable = await checkPackageExists(desktop, pkg);
    if (isAvailable) {
      available.push(pkg);
      console.log(`✅ 发现基础包: ${pkg.description}`);
    }
  }

  // 如果有基础包可用，再检查中文包
  if (available.length > 0) {
    for (const pkg of CHINESE_FONT_PACKAGES) {
      const isAvailable = await checkPackageExists(desktop, pkg);
      if (isAvailable) {
        available.push(pkg);
        console.log(`✅ 发现中文包: ${pkg.description}`);
      }
    }
  }

  // 按优先级排序
  available.sort((a, b) => a.priority - b.priority);

  console.log(`📦 共发现 ${available.length} 个可用字体包`);
  return available;
};

/**
 * 检查单个包是否存在
 */
export const checkPackageExists = async (
  desktop: E2BDesktop,
  pkg: FontPackage
): Promise<boolean> => {
  // 检查主包名
  try {
    const mainCheck: CommandResult = await desktop.commands.run(
      `apt-cache show ${pkg.name} >/dev/null 2>&1 && echo "exists"`
    );
    if (mainCheck.stdout?.includes("exists")) {
      return true;
    }
  } catch (_error) {
    // 主包不存在，继续检查备用包名
  }

  // 检查备用包名
  if (pkg.alternatives) {
    for (const altName of pkg.alternatives) {
      try {
        const altCheck: CommandResult = await desktop.commands.run(
          `apt-cache show ${altName} >/dev/null 2>&1 && echo "exists"`
        );
        if (altCheck.stdout?.includes("exists")) {
          // 更新包名为实际可用的名称
          pkg.name = altName;
          return true;
        }
      } catch (_error) {
        // 继续检查下一个
      }
    }
  }

  return false;
};

/**
 * 获取系统当前的字体状态
 */
export const getFontStatus = async (desktop: E2BDesktop) => {
  const status = {
    hasFontTools: false,
    totalFonts: 0,
    chineseFonts: 0,
    installedPackages: [] as string[],
  };

  try {
    // 检查字体工具
    const toolCheck: CommandResult = await desktop.commands.run("which fc-list && echo 'ok'");
    status.hasFontTools = toolCheck.stdout?.includes("ok") ?? false;

    if (status.hasFontTools) {
      // 检查字体数量
      const totalCheck: CommandResult = await desktop.commands.run("fc-list | wc -l");
      status.totalFonts = parseInt(totalCheck.stdout?.trim() || "0");

      const chineseCheck: CommandResult = await desktop.commands.run("fc-list :lang=zh | wc -l");
      status.chineseFonts = parseInt(chineseCheck.stdout?.trim() || "0");
    }

    // 检查已安装的字体包
    const packages = ["fonts-dejavu", "fonts-liberation", "fonts-wqy-zenhei", "fontconfig"];
    for (const pkg of packages) {
      try {
        const pkgCheck: CommandResult = await desktop.commands.run(
          `dpkg -l | grep ${pkg} && echo "installed"`
        );
        if (pkgCheck.stdout?.includes("installed")) {
          status.installedPackages.push(pkg);
        }
      } catch (_error) {
        // 包未安装
      }
    }
  } catch (error) {
    console.warn("⚠️ 获取字体状态失败:", error);
  }

  return status;
};
