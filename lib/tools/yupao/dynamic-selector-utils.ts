/**
 * Dynamic selector utilities for handling CSS modules with changing hash values
 * 这个工具提供了策略来处理CSS modules生成的动态class名称
 */

/**
 * 创建动态CSS选择器，用于匹配CSS modules的class
 * 例如: _convItem_xxxxx_48 -> [class*="_convItem_"]
 *
 * @param baseClassName - 基础class名称，如 "_convItem", "_name-text" 等
 * @returns 返回一个CSS属性选择器，可以匹配任何包含该模式的class
 */
export function createDynamicClassSelector(baseClassName: string): string {
  // 返回属性选择器来匹配包含特定模式的class
  // 这个选择器会匹配任何包含 baseClassName_ 的class
  return `[class*="${baseClassName}_"]`;
}

/**
 * 生成自适应的选择器数组
 * 为每种元素类型提供多个备用选择器策略
 *
 * @param elementType - 元素类型
 * @returns 返回一个选择器数组，按优先级排序
 */
export function getAdaptiveSelectors(elementType: string): string[] {
  const selectors: Record<string, string[]> = {
    convItem: [
      createDynamicClassSelector("_convItem"),
      'div[style*="padding: 0px 12px"] > div',
      'div:has(img[width="40"][height="40"]):has(span)',
    ],
    candidateName: [
      createDynamicClassSelector("_name-text"),
      'span:first-child:not([class*="time"]):not([class*="unread"])',
      "div > div > div > span:first-child",
    ],
    jobTitle: [
      createDynamicClassSelector("_title-dec"),
      "span:nth-child(2)",
      "div > div > div > span:nth-child(2)",
    ],
    unreadNum: [
      `${createDynamicClassSelector("_imageBox")} ${createDynamicClassSelector("_unreadNum")}`,
      'div:has(img[width="40"]) > span:not([class*="name"])',
      "span:matches(/^\\d+$/)",
    ],
    statusUnread: [createDynamicClassSelector("_status-unread"), "span:matches(/^\\[.*\\]$/)"],
    messageTime: [
      createDynamicClassSelector("_time"),
      "span:matches(/^(\\d{1,2}:\\d{2}|昨天|今天)$/)",
    ],
    msgText: [
      createDynamicClassSelector("_msg-text"),
      'div:last-child:not([class*="time"]):not([class*="name"])',
    ],
    // Say Hello page selectors
    candidateCard: [
      createDynamicClassSelector("_card"),
      'div[class*="_card_"][style*="margin-top"]',
      'div[data-index]:has(button:contains("聊一聊"))',
    ],
    sayHelloName: [
      createDynamicClassSelector("_name_xejow"),
      createDynamicClassSelector("_name") + ':not([class*="_nameR_"])',
      'span[class*="_name_"]:not([class*="_nameR_"])',
    ],
    sayHelloButton: [
      createDynamicClassSelector("_chatBtn"),
      'button[class*="_btn_"][class*="_lightPrimaryStroke_"]',
      'button:contains("聊一聊"), button:contains("继续聊")',
    ],
    candidateIntro: [
      createDynamicClassSelector("_introduce"),
      'p[class*="_introduce_"]',
      'div[class*="_cardML_"] > p:last-child',
    ],
    candidateBaseInfo: [
      // Old structure: _baseInfoStr_
      createDynamicClassSelector("_baseInfoStr"),
      'p[class*="_baseInfoStr_"]',
      // New structure: _baseInfoRow_
      createDynamicClassSelector("_baseInfoRow"),
      'div[class*="_baseInfoRow_"]',
      // Fallback
      'div[class*="_cardML_"] > p:first-child',
    ],
    candidateSalary: [
      // Old structure: _salary_
      createDynamicClassSelector("_salary"),
      'span[class*="_salary_"]',
      // New structure: uses Tailwind color class
      '.text-\\[\\#0092FF\\]',
      'div.flex-none.text-\\[\\#0092FF\\]',
      // Fallback: match by content pattern
      "span:matches(/\\d+[-~]\\d+元/)",
    ],
    candidateExpectation: [
      // Old structure: _cardMRI_
      createDynamicClassSelector("_cardMRI"),
      'div[class*="_cardMRI_"]',
      // New structure: _recentEventRow_
      createDynamicClassSelector("_recentEventRow"),
      'div[class*="_recentEventRow_"]',
      // Fallback
      'div[class*="_cardMR_"] > div:first-child',
    ],
    candidateIntroduce: [
      // Old structure: _introduce_
      createDynamicClassSelector("_introduce"),
      'p[class*="_introduce_"]',
      // New structure: _introduceRow_
      createDynamicClassSelector("_introduceRow"),
      'div[class*="_introduceRow_"]',
      // Fallback
      'div[class*="_cardML_"] > p:last-child',
    ],
    candidateOnlineStatus: [
      createDynamicClassSelector("_onlineYes"),
      createDynamicClassSelector("_online"),
      'p[class*="_online"]',
    ],
  };

  return selectors[elementType] || [];
}

/**
 * 生成在浏览器端执行的查找元素函数
 * 这个函数会尝试多个选择器直到找到元素
 *
 * @returns 返回一个可以在浏览器端执行的JavaScript函数字符串
 */
export function generateFindElementScript(): string {
  return `
    function findElement(element, patterns) {
      for (const pattern of patterns) {
        try {
          const found = element.querySelector(pattern);
          if (found) return found;
        } catch (e) {
          // 某些选择器可能不被支持，继续尝试下一个
        }
      }
      return null;
    }
  `;
}
