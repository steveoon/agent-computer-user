/**
 * Display configuration for E2B Desktop
 * 
 * 提供不同设备的显示配置预设
 * 
 * 使用方法:
 * 1. 默认使用 LAPTOP_14_2K 配置 (2560x1440, 120 DPI)
 * 2. 通过环境变量切换配置: E2B_DISPLAY_PROFILE=LAPTOP_14_FHD
 * 3. 可选配置:
 *    - STANDARD: 1024x768 (原始低分辨率)
 *    - LAPTOP_14_FHD: 1920x1080 (14英寸全高清)
 *    - LAPTOP_14_2K: 2560x1440 (14英寸2K，推荐)
 *    - LAPTOP_15_FHD: 1920x1080 (15.6英寸)
 *    - DESKTOP_24_FHD: 1920x1080 (24英寸显示器)
 *    - DESKTOP_27_2K: 2560x1440 (27英寸显示器)
 *    - TABLET: 1366x768 (平板设备)
 */

export interface DisplayConfig {
  resolution: { x: number; y: number };
  dpi: number;
  description: string;
}

// 预定义的显示配置
export const DisplayProfiles = {
  // 标准配置 (原始设置)
  STANDARD: {
    resolution: { x: 1024, y: 768 },
    dpi: 96,
    description: "标准分辨率 (1024x768)"
  },
  
  // 14英寸笔记本 - 全高清
  LAPTOP_14_FHD: {
    resolution: { x: 1920, y: 1080 },
    dpi: 120,
    description: "14英寸笔记本全高清 (1920x1080)"
  },
  
  // 14英寸笔记本 - 2K分辨率 (推荐)
  LAPTOP_14_2K: {
    resolution: { x: 2560, y: 1440 },
    dpi: 120,
    description: "14英寸笔记本2K分辨率 (2560x1440)"
  },
  
  // 15.6英寸笔记本
  LAPTOP_15_FHD: {
    resolution: { x: 1920, y: 1080 },
    dpi: 96,
    description: "15.6英寸笔记本全高清 (1920x1080)"
  },
  
  // 桌面显示器 - 24英寸
  DESKTOP_24_FHD: {
    resolution: { x: 1920, y: 1080 },
    dpi: 96,
    description: "24英寸桌面显示器 (1920x1080)"
  },
  
  // 桌面显示器 - 27英寸 2K
  DESKTOP_27_2K: {
    resolution: { x: 2560, y: 1440 },
    dpi: 110,
    description: "27英寸桌面显示器2K (2560x1440)"
  },
  
  // 平板设备
  TABLET: {
    resolution: { x: 1366, y: 768 },
    dpi: 96,
    description: "平板设备 (1366x768)"
  }
} as const;

// 获取当前激活的配置
// 可以通过环境变量 E2B_DISPLAY_PROFILE 来切换配置
export function getActiveDisplayConfig(): DisplayConfig {
  const profileName = process.env.E2B_DISPLAY_PROFILE || 'LAPTOP_14_2K';
  
  // 类型安全的配置查找
  const profile = DisplayProfiles[profileName as keyof typeof DisplayProfiles];
  
  if (!profile) {
    console.warn(`Unknown display profile: ${profileName}, falling back to LAPTOP_14_2K`);
    return DisplayProfiles.LAPTOP_14_2K;
  }
  
  console.log(`Using display profile: ${profile.description}`);
  return profile;
}

// 导出当前激活的配置
export const activeConfig = getActiveDisplayConfig();