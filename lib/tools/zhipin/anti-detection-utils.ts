/**
 * 反爬虫检测规避工具函数
 *
 * 这些函数用于模拟真实用户行为，降低被反爬虫系统检测的风险
 */

import type { MCPClient } from "@/types/mcp";

/**
 * 生成随机延迟
 * @param min 最小延迟时间（毫秒）
 * @param max 最大延迟时间（毫秒）
 * @returns Promise that resolves after random delay
 */
export const randomDelay = (min: number = 300, max: number = 800): Promise<void> => {
  const delay = min + Math.random() * (max - min);
  return new Promise(resolve => setTimeout(resolve, delay));
};

/**
 * 生成人性化的延迟时间
 * 模拟真实用户的操作节奏，包含偶尔的长时间停顿
 */
export const humanDelay = (): Promise<void> => {
  const rand = Math.random();
  if (rand < 0.5) {
    // 50% 概率：正常操作 800-2000ms
    return randomDelay(800, 2000);
  } else if (rand < 0.8) {
    // 30% 概率：较快操作 500-800ms
    return randomDelay(500, 800);
  } else if (rand < 0.95) {
    // 15% 概率：思考时间 2000-4000ms
    return randomDelay(2000, 4000);
  } else {
    // 5% 概率：长时间停顿 4000-6000ms
    return randomDelay(4000, 6000);
  }
};

/**
 * 生成用于替代 console.log 的混淆日志
 * 避免关键词被检测
 */
export const obfuscatedLog = (message: string): string => {
  // 替换敏感关键词
  const replacements: Record<string, string> = {
    candidate: "c4nd1d",
    Candidate: "C4nd1d",
    candidates: "c4nd1ds",
    Processed: "Pr0c3ss3d",
    Found: "F0und",
    chat: "ch4t",
    message: "m3ss4g3",
    unread: "unr34d",
    click: "cl1ck",
  };

  let obfuscated = message;
  Object.entries(replacements).forEach(([key, value]) => {
    obfuscated = obfuscated.replace(new RegExp(key, "g"), value);
  });

  // 添加随机 Unicode 字符作为前缀
  const randomPrefix = String.fromCharCode(0x2000 + Math.floor(Math.random() * 0x100));
  return `${randomPrefix}${obfuscated}`;
};

/**
 * 生成分批处理的脚本，避免大量DOM查询
 * @param processingLogic 处理逻辑的字符串
 * @param batchSize 每批处理的元素数量
 */
export const generateBatchProcessingScript = (
  processingLogic: string,
  batchSize: number = 5
): string => {
  return `
    // 分批处理函数
    const processBatch = (elements, startIndex, batchSize) => {
      const endIndex = Math.min(startIndex + batchSize, elements.length);
      const batchResults = [];
      
      for (let idx = startIndex; idx < endIndex; idx++) {
        const element = elements[idx];
        const i = idx; // 保持兼容性
        const results = batchResults; // 为 processingLogic 提供 results 引用
        try {
          ${processingLogic}
        } catch (err) {
          // 静默处理错误，避免暴露
        }
      }
      
      return { results: batchResults, nextIndex: endIndex };
    };
    
    // 使用 requestIdleCallback 调度批处理
    const processAllBatches = (elements) => {
      return new Promise((resolve) => {
        const allResults = [];
        let currentIndex = 0;
        
        const processNext = () => {
          if (currentIndex >= elements.length) {
            resolve(allResults);
            return;
          }
          
          // 混合使用 rIC 和 setTimeout，降低 rIC 特征
          const useRIC = typeof requestIdleCallback !== 'undefined' && Math.random() > 0.5;
          
          if (useRIC) {
            const idleId = requestIdleCallback((deadline) => {
              // 在空闲时间处理，但不超过 50ms
              while (currentIndex < elements.length && deadline.timeRemaining() > 0) {
                const batch = processBatch(elements, currentIndex, ${batchSize});
                allResults.push(...batch.results);
                currentIndex = batch.nextIndex;
              }
              processNext();
            }, { timeout: 500 }); // 添加超时，避免无限等待
            
            // 记录 ID 以便必要时取消
            if (typeof window !== 'undefined' && !window._ricIds) {
              window._ricIds = [];
            }
            if (typeof window !== 'undefined') {
              window._ricIds.push(idleId);
            }
          } else {
            // 使用 setTimeout，模拟更自然的处理节奏
            setTimeout(() => {
              const batch = processBatch(elements, currentIndex, ${batchSize});
              allResults.push(...batch.results);
              currentIndex = batch.nextIndex;
              processNext();
            }, 100 + Math.random() * 200); // 100-300ms 随机延迟
          }
        };
        
        processNext();
      });
    };
  `;
};

/**
 * 生成随机鼠标移动脚本
 * 模拟真实的鼠标轨迹
 */
export const generateMouseMovementScript = (): string => {
  return `
    // 生成贝塞尔曲线轨迹
    const generateBezierPath = (start, end, steps = 20) => {
      const points = [];
      
      // 生成控制点
      const cp1 = {
        x: start.x + (end.x - start.x) * 0.25 + (Math.random() - 0.5) * 100,
        y: start.y + (end.y - start.y) * 0.25 + (Math.random() - 0.5) * 100
      };
      const cp2 = {
        x: start.x + (end.x - start.x) * 0.75 + (Math.random() - 0.5) * 100,
        y: start.y + (end.y - start.y) * 0.75 + (Math.random() - 0.5) * 100
      };
      
      // 生成路径点
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = Math.pow(1 - t, 3) * start.x +
                  3 * Math.pow(1 - t, 2) * t * cp1.x +
                  3 * (1 - t) * Math.pow(t, 2) * cp2.x +
                  Math.pow(t, 3) * end.x;
        const y = Math.pow(1 - t, 3) * start.y +
                  3 * Math.pow(1 - t, 2) * t * cp1.y +
                  3 * (1 - t) * Math.pow(t, 2) * cp2.y +
                  Math.pow(t, 3) * end.y;
        points.push({ x: Math.round(x), y: Math.round(y) });
      }
      
      return points;
    };
    
    // 触发鼠标移动事件
    const triggerMouseMove = (x, y) => {
      const event = new MouseEvent('mousemove', {
        clientX: x,
        clientY: y,
        bubbles: true,
        cancelable: true,
        view: window
      });
      document.elementFromPoint(x, y)?.dispatchEvent(event);
    };
  `;
};

/**
 * 生成随机滚动脚本
 * 模拟用户浏览行为
 */
export const generateRandomScrollScript = (): string => {
  const scrollDistance = 50 + Math.random() * 150; // 50-200px
  const duration = 200 + Math.random() * 300; // 200-500ms

  return `
    // 平滑滚动
    const smoothScroll = (distance, duration) => {
      const start = window.pageYOffset;
      const startTime = performance.now();
      
      const scroll = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // 使用缓动函数
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        window.scrollTo(0, start + distance * easeProgress);
        
        if (progress < 1) {
          requestAnimationFrame(scroll);
        }
      };
      
      requestAnimationFrame(scroll);
    };
    
    smoothScroll(${scrollDistance}, ${duration});
  `;
};

/**
 * 混淆选择器字符串
 * 避免选择器模式被识别
 */
export const obfuscateSelector = (selector: string): string => {
  // 对于简单选择器，添加随机属性选择器
  if (selector.match(/^[.#][\w-]+$/)) {
    const randomAttr = `[data-${Math.random().toString(36).substr(2, 5)}]`;
    return `${selector}:not(${randomAttr})`;
  }
  return selector;
};

/**
 * 生成防检测的 evaluate 脚本包装器
 * 添加各种防检测措施
 * 注意：MCP 会将脚本包装在 (function() { script })() 中，所以我们不能返回 IIFE
 */
export const wrapAntiDetectionScript = (innerScript: string): string => {
  // 生成随机延迟时间
  const randomDelayMs = Math.floor(Math.random() * 100);

  // 判断脚本是否包含 await 关键字
  const hasAwait = innerScript.includes("await ");

  if (hasAwait) {
    // 对于包含 await 的脚本，返回 async 函数体
    return `
      // 防检测包装器
      return (async () => {
        // 防检测延迟
        await new Promise(r => setTimeout(r, ${randomDelayMs}));
        
        // 临时禁用console
        const originalLog = console.log;
        const originalWarn = console.warn; 
        const originalError = console.error;
        
        console.log = () => {};
        console.warn = () => {};
        console.error = () => {};
        
        try {
          // 执行内部脚本
          ${innerScript}
        } finally {
          // 恢复console
          console.log = originalLog;
          console.warn = originalWarn;
          console.error = originalError;
        }
      })();
    `;
  } else {
    // 对于同步脚本，返回同步函数体
    return `
      // 防检测包装器
      // 临时禁用console
      const originalLog = console.log;
      const originalWarn = console.warn; 
      const originalError = console.error;
      
      console.log = () => {};
      console.warn = () => {};
      console.error = () => {};
      
      try {
        // 执行内部脚本
        ${innerScript}
      } finally {
        // 恢复console
        console.log = originalLog;
        console.warn = originalWarn;
        console.error = originalError;
      }
    `;
  }
};

/**
 * 检查是否应该添加额外的随机行为
 * 基于概率决定是否执行额外的迷惑行为
 */
export const shouldAddRandomBehavior = (probability: number = 0.3): boolean => {
  return Math.random() < probability;
};

/**
 * 生成随机的键盘输入延迟
 * 模拟真实的打字速度
 */
export const generateTypingDelay = (): number => {
  // 基础延迟 60-120ms
  const baseDelay = 60 + Math.random() * 60;

  // 10% 概率出现较长延迟（思考）
  if (Math.random() < 0.1) {
    return baseDelay + 200 + Math.random() * 300;
  }

  // 5% 概率出现很短延迟（快速输入）
  if (Math.random() < 0.05) {
    return 30 + Math.random() * 30;
  }

  return baseDelay;
};

/**
 * 执行带鼠标轨迹的点击
 * 模拟真实用户的鼠标移动和点击行为
 * @param mcpClient - MCP 客户端实例
 * @param selector - 要点击的元素选择器
 * @param options - 可选配置
 */
export const clickWithMouseTrajectory = async (
  mcpClient: MCPClient,
  selector: string,
  options: {
    moveSteps?: number; // 鼠标移动步数，默认 15-25
    moveDelayMin?: number; // 每步最小延迟，默认 10ms
    moveDelayMax?: number; // 每步最大延迟，默认 30ms
    preClickDelay?: number; // 点击前延迟，默认 50-150ms
    fallbackToDirectClick?: boolean; // 当轨迹模拟失败时是否回退到直接点击，默认 true
  } = {}
): Promise<void> => {
  const tools = await mcpClient.tools();

  if (!tools.puppeteer_evaluate || !tools.puppeteer_click) {
    throw new Error("必需的 puppeteer 工具不可用");
  }

  // 获取目标元素的位置
  const getElementPositionScript = wrapAntiDetectionScript(`
    // 使用 JSON.stringify 来安全地处理选择器字符串
    const selectorStr = ${JSON.stringify(selector)};
    let element = null;
    
    try {
      element = document.querySelector(selectorStr);
    } catch (e) {
      return { 
        success: false, 
        error: '选择器语法错误: ' + e.message,
        selector: selectorStr 
      };
    }
    
    if (!element) {
      // 尝试查找类似的元素以提供更好的诊断信息
      const similarElements = document.querySelectorAll('span.operate-btn');
      return { 
        success: false, 
        error: '元素未找到',
        selector: selectorStr,
        similarElementsCount: similarElements.length,
        pageHasOperateBtns: similarElements.length > 0
      };
    }
    
    // 检查元素是否可见
    const isVisible = element.offsetParent !== null || 
                     element.style.position === 'fixed' ||
                     element.style.position === 'sticky';
    
    if (!isVisible) {
      return { 
        success: false, 
        error: '元素存在但不可见',
        selector: selectorStr 
      };
    }
    
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // 添加随机偏移，不总是点击中心
    const offsetX = (Math.random() - 0.5) * rect.width * 0.6;
    const offsetY = (Math.random() - 0.5) * rect.height * 0.6;
    
    return {
      success: true,
      x: Math.round(centerX + offsetX),
      y: Math.round(centerY + offsetY),
      width: rect.width,
      height: rect.height
    };
  `);

  const posResult = await tools.puppeteer_evaluate.execute({ script: getElementPositionScript });
  const posData = parseEvaluateResult(posResult) as {
    success?: boolean;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  } | null;

  if (!posData?.success) {
    // 如果启用了回退机制，则直接使用 puppeteer_click
    if (options.fallbackToDirectClick !== false) {
      console.warn(`无法获取元素位置，回退到直接点击: ${selector}`);

      // 添加一个随机延迟
      const preClickDelay = options.preClickDelay || 50 + Math.random() * 100;
      await randomDelay(preClickDelay, preClickDelay + 50);

      // 直接点击
      await tools.puppeteer_click.execute({ selector });
      return;
    }

    throw new Error(`无法获取元素位置: ${selector}`);
  }

  // 生成鼠标轨迹
  const steps = options.moveSteps || 15 + Math.floor(Math.random() * 10);
  const moveDelayMin = options.moveDelayMin || 10;
  const moveDelayMax = options.moveDelayMax || 30;

  // 获取当前鼠标位置（使用视口中心作为起点）
  const getCurrentMouseScript = wrapAntiDetectionScript(`
    return {
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 200,
      y: window.innerHeight / 2 + (Math.random() - 0.5) * 200
    };
  `);

  const mouseResult = await tools.puppeteer_evaluate.execute({ script: getCurrentMouseScript });
  const currentPos = (parseEvaluateResult(mouseResult) as { x: number; y: number }) || {
    x: 100,
    y: 100,
  };

  // 生成贝塞尔曲线轨迹
  const mouseTrajectoryScript = wrapAntiDetectionScript(`
    const start = ${JSON.stringify(currentPos)};
    const end = { x: ${posData.x}, y: ${posData.y} };
    const steps = ${steps};
    
    // 生成控制点
    const cp1 = {
      x: start.x + (end.x - start.x) * 0.25 + (Math.random() - 0.5) * 100,
      y: start.y + (end.y - start.y) * 0.25 + (Math.random() - 0.5) * 100
    };
    const cp2 = {
      x: start.x + (end.x - start.x) * 0.75 + (Math.random() - 0.5) * 100,
      y: start.y + (end.y - start.y) * 0.75 + (Math.random() - 0.5) * 100
    };
    
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.pow(1 - t, 3) * start.x +
                3 * Math.pow(1 - t, 2) * t * cp1.x +
                3 * (1 - t) * Math.pow(t, 2) * cp2.x +
                Math.pow(t, 3) * end.x;
      const y = Math.pow(1 - t, 3) * start.y +
                3 * Math.pow(1 - t, 2) * t * cp1.y +
                3 * (1 - t) * Math.pow(t, 2) * cp2.y +
                Math.pow(t, 3) * end.y;
      points.push({ x: Math.round(x), y: Math.round(y) });
    }
    
    return points;
  `);

  const trajectoryResult = await tools.puppeteer_evaluate.execute({
    script: mouseTrajectoryScript,
  });
  const points = parseEvaluateResult(trajectoryResult) as Array<{ x: number; y: number }> | null;

  // 模拟鼠标移动
  if (points && Array.isArray(points)) {
    for (const point of points) {
      // 使用 puppeteer 的 mouse.move 模拟鼠标移动
      if (tools.puppeteer_evaluate) {
        const moveScript = wrapAntiDetectionScript(`
          const event = new MouseEvent('mousemove', {
            clientX: ${point.x},
            clientY: ${point.y},
            bubbles: true,
            cancelable: true,
            view: window
          });
          document.dispatchEvent(event);
        `);
        await tools.puppeteer_evaluate.execute({ script: moveScript });
      }

      // 每步之间的随机延迟
      await randomDelay(moveDelayMin, moveDelayMax);
    }
  }

  // 点击前的小延迟
  const preClickDelay = options.preClickDelay || 50 + Math.random() * 100;
  await randomDelay(preClickDelay, preClickDelay + 50);

  // 执行点击
  await tools.puppeteer_click.execute({ selector });
};

/**
 * 解析 puppeteer_evaluate 的结果
 * @param result - puppeteer_evaluate 的返回结果
 * @returns 解析后的数据或 null
 */
function parseEvaluateResult(result: unknown): unknown {
  try {
    const mcpResult = result as { content?: Array<{ text?: string }> };
    if (mcpResult?.content?.[0]?.text) {
      const resultText = mcpResult.content[0].text;
      const executionMatch = resultText.match(
        /Execution result:\s*\n([\s\S]*?)(\n\nConsole output|$)/
      );

      if (executionMatch && executionMatch[1].trim() !== "undefined") {
        const jsonResult = executionMatch[1].trim();
        return JSON.parse(jsonResult);
      }
    }
  } catch (_e) {
    // 静默处理错误
  }
  return null;
}

/**
 * 执行随机滚动
 * 模拟真实用户的浏览行为
 * @param mcpClient - MCP 客户端实例
 * @param options - 可选配置
 */
export const performRandomScroll = async (
  mcpClient: MCPClient,
  options: {
    minDistance?: number; // 最小滚动距离，默认 50px
    maxDistance?: number; // 最大滚动距离，默认 300px
    duration?: number; // 滚动动画时长，默认 200-500ms
    probability?: number; // 执行滚动的概率，默认 0.3
    direction?: "down" | "up" | "both"; // 滚动方向，默认 both
  } = {}
): Promise<void> => {
  const {
    minDistance = 50,
    maxDistance = 300,
    duration = 200 + Math.random() * 300,
    probability = 0.3,
    direction = "both",
  } = options;

  // 根据概率决定是否执行滚动
  if (Math.random() > probability) {
    return;
  }

  const tools = await mcpClient.tools();
  if (!tools.puppeteer_evaluate) {
    return;
  }

  // 计算滚动距离
  let scrollDistance = minDistance + Math.random() * (maxDistance - minDistance);

  // 根据方向调整滚动距离
  if (direction === "up") {
    scrollDistance = -scrollDistance;
  } else if (direction === "both") {
    scrollDistance = Math.random() < 0.7 ? scrollDistance : -scrollDistance; // 70% 向下，30% 向上
  }

  // 执行滚动
  const scrollScript = wrapAntiDetectionScript(`
    const distance = ${scrollDistance};
    const duration = ${duration};
    const start = window.pageYOffset;
    const startTime = performance.now();
    
    const scroll = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // 使用缓动函数
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      window.scrollTo(0, start + distance * easeProgress);
      
      if (progress < 1) {
        requestAnimationFrame(scroll);
      }
    };
    
    requestAnimationFrame(scroll);
    
    // 返回滚动信息
    return {
      scrolled: true,
      distance: distance,
      duration: duration,
      from: start,
      to: start + distance
    };
  `);

  try {
    await tools.puppeteer_evaluate.execute({ script: scrollScript });
    // 滚动后的小延迟
    await randomDelay(100, 300);
  } catch (_e) {
    // 静默处理错误
  }
};

/**
 * 在页面加载后执行初始滚动
 * 模拟用户开始浏览页面的行为
 */
export const performInitialScrollPattern = async (mcpClient: MCPClient): Promise<void> => {
  // 第一次小幅度滚动
  await performRandomScroll(mcpClient, {
    minDistance: 100,
    maxDistance: 200,
    probability: 0.8,
    direction: "down",
  });

  await humanDelay();

  // 第二次随机滚动
  await performRandomScroll(mcpClient, {
    minDistance: 50,
    maxDistance: 150,
    probability: 0.5,
    direction: "both",
  });
};
