import { describe, it, expect, beforeAll } from "vitest";
import { JSDOM } from "jsdom";
import fs from "fs";
import path from "path";
import {
  createDynamicClassSelector,
  getAdaptiveSelectors,
  generateFindElementScript,
} from "../dynamic-selector-utils";

describe("Dynamic Selector Utils", () => {
  let yupaoOldDOM: JSDOM;
  let yupaoNewDOM: JSDOM;
  let yupaoWechatDOM: JSDOM;

  beforeAll(() => {
    // 加载两个不同的HTML文件
    const oldHtml = fs.readFileSync(
      path.join(process.cwd(), "docs/sample-data/yupao.html"),
      "utf-8"
    );
    const newHtml = fs.readFileSync(
      path.join(process.cwd(), "docs/sample-data/yupao-new.html"),
      "utf-8"
    );
    const wechatHtml = fs.readFileSync(
      path.join(process.cwd(), "docs/sample-data/yupao-wechat-element-new.html"),
      "utf-8"
    );

    yupaoOldDOM = new JSDOM(oldHtml);
    yupaoNewDOM = new JSDOM(newHtml);
    yupaoWechatDOM = new JSDOM(wechatHtml);
  });

  describe("createDynamicClassSelector", () => {
    it("应该生成正确的CSS属性选择器", () => {
      const selector = createDynamicClassSelector("_convItem");
      expect(selector).toBe('[class*="_convItem_"]');
    });

    it("应该处理不同的类名模式", () => {
      const selectors = [
        { input: "_name-text", expected: '[class*="_name-text_"]' },
        { input: "_unreadNum", expected: '[class*="_unreadNum_"]' },
        { input: "_title-dec", expected: '[class*="_title-dec_"]' },
      ];

      selectors.forEach(({ input, expected }) => {
        expect(createDynamicClassSelector(input)).toBe(expected);
      });
    });
  });

  describe("getAdaptiveSelectors", () => {
    it("应该返回正确的选择器数组", () => {
      const convItemSelectors = getAdaptiveSelectors("convItem");
      expect(convItemSelectors).toContain('[class*="_convItem_"]');
      expect(convItemSelectors).toContain('div[style*="padding: 0px 12px"] > div');
      expect(convItemSelectors).toContain('div:has(img[width="40"][height="40"]):has(span)');
    });

    it("应该为未知元素类型返回空数组", () => {
      const unknownSelectors = getAdaptiveSelectors("unknownElement");
      expect(unknownSelectors).toEqual([]);
    });
  });

  describe("动态选择器在不同hash值下的适应性", () => {
    it("应该在旧HTML (hash: 1rm6c) 中找到会话项", () => {
      const document = yupaoOldDOM.window.document;
      const selector = createDynamicClassSelector("_convItem");

      // 使用动态选择器查找元素
      const items = document.querySelectorAll(selector);
      expect(items.length).toBeGreaterThan(0);

      // 验证找到的是正确的元素
      const firstItem = items[0];
      expect(firstItem.className).toContain("_convItem_1rm6c_");
    });

    it("应该在新HTML (hash: 1qq7t) 中找到会话项", () => {
      const document = yupaoNewDOM.window.document;
      const selector = createDynamicClassSelector("_convItem");

      // 使用动态选择器查找元素
      const items = document.querySelectorAll(selector);
      expect(items.length).toBeGreaterThan(0);

      // 验证找到的是正确的元素
      const firstItem = items[0];
      expect(firstItem.className).toContain("_convItem_1qq7t_");
    });

    it("应该在两个不同的DOM中找到相同的语义元素", () => {
      const oldDoc = yupaoOldDOM.window.document;
      const newDoc = yupaoNewDOM.window.document;

      // 测试各种元素选择器
      const elementTypes = ["candidateName", "jobTitle", "messageTime", "msgText"];

      elementTypes.forEach(elementType => {
        const selectors = getAdaptiveSelectors(elementType);

        // 在旧DOM中查找
        let oldElements: Element[] = [];
        for (const selector of selectors) {
          try {
            const elements = oldDoc.querySelectorAll(selector);
            if (elements.length > 0) {
              oldElements = Array.from(elements);
              break;
            }
          } catch (e) {
            // 某些选择器可能不被JSDOM支持
          }
        }

        // 在新DOM中查找
        let newElements: Element[] = [];
        for (const selector of selectors) {
          try {
            const elements = newDoc.querySelectorAll(selector);
            if (elements.length > 0) {
              newElements = Array.from(elements);
              break;
            }
          } catch (e) {
            // 某些选择器可能不被JSDOM支持
          }
        }

        // 验证两个DOM中都找到了元素
        expect(oldElements.length).toBeGreaterThan(0);
        expect(newElements.length).toBeGreaterThan(0);
      });
    });

    it("应该正确识别未读数量", () => {
      const oldDoc = yupaoOldDOM.window.document;
      const newDoc = yupaoNewDOM.window.document;

      // 使用动态选择器查找未读数量
      const unreadSelector = createDynamicClassSelector("_unreadNum");

      // 在旧HTML中查找
      const oldUnreadElements = oldDoc.querySelectorAll(unreadSelector);
      const oldUnreadNumbers = Array.from(oldUnreadElements)
        .map((el: Element) => parseInt(el.textContent || "0"))
        .filter(n => n > 0);

      // 在新HTML中查找
      const newUnreadElements = newDoc.querySelectorAll(unreadSelector);
      const newUnreadNumbers = Array.from(newUnreadElements)
        .map((el: Element) => parseInt(el.textContent || "0"))
        .filter(n => n > 0);

      // 验证找到了未读数量
      if (oldUnreadElements.length > 0) {
        expect(oldUnreadNumbers.length).toBeGreaterThan(0);
      }
      if (newUnreadElements.length > 0) {
        expect(newUnreadNumbers.length).toBeGreaterThan(0);
      }
    });

    it("应该正确提取候选人名字", () => {
      const oldDoc = yupaoOldDOM.window.document;
      const newDoc = yupaoNewDOM.window.document;

      const nameSelector = createDynamicClassSelector("_name-text");

      // 在旧HTML中查找候选人名字
      const oldNameElements = oldDoc.querySelectorAll(nameSelector);
      const oldNames = Array.from(oldNameElements)
        .map((el: Element) => el.textContent?.trim())
        .filter((name): name is string => !!name && name.length > 0);

      // 在新HTML中查找候选人名字
      const newNameElements = newDoc.querySelectorAll(nameSelector);
      const newNames = Array.from(newNameElements)
        .map((el: Element) => el.textContent?.trim())
        .filter((name): name is string => !!name && name.length > 0);

      // 验证找到了候选人名字
      if (oldNameElements.length > 0) {
        expect(oldNames.length).toBeGreaterThan(0);
        // 验证名字是中文或包含中文字符
        oldNames.forEach(name => {
          expect(name).toMatch(/[\u4e00-\u9fa5]/);
        });
      }

      if (newNameElements.length > 0) {
        expect(newNames.length).toBeGreaterThan(0);
        // 验证名字是中文或包含中文字符
        newNames.forEach(name => {
          expect(name).toMatch(/[\u4e00-\u9fa5]/);
        });
      }
    });
  });

  describe("generateFindElementScript", () => {
    it("应该生成有效的JavaScript函数", () => {
      const script = generateFindElementScript();
      expect(script).toContain("function findElement");
      expect(script).toContain("for (const pattern of patterns)");
      expect(script).toContain("element.querySelector(pattern)");
    });
  });

  describe("结构选择器作为后备方案", () => {
    it("应该使用结构选择器找到会话项", () => {
      const oldDoc = yupaoOldDOM.window.document;
      const newDoc = yupaoNewDOM.window.document;

      // 使用基于样式的选择器
      const structureSelector = 'div[style*="padding: 0px 12px"] > div';

      const oldItems = oldDoc.querySelectorAll(structureSelector);
      const newItems = newDoc.querySelectorAll(structureSelector);

      // 两个DOM中都应该找到会话项
      expect(oldItems.length).toBeGreaterThan(0);
      expect(newItems.length).toBeGreaterThan(0);
    });

    it("应该使用结构选择器找到包含头像的容器", () => {
      const oldDoc = yupaoOldDOM.window.document;
      const newDoc = yupaoNewDOM.window.document;

      // 使用基于图片属性的选择器
      const imgContainers = 'img[width="40"][height="40"]';

      const oldImages = oldDoc.querySelectorAll(imgContainers);
      const newImages = newDoc.querySelectorAll(imgContainers);

      // 验证找到了头像图片
      expect(oldImages.length).toBeGreaterThan(0);
      expect(newImages.length).toBeGreaterThan(0);
    });
  });

  describe("Exchange WeChat 工具选择器测试", () => {
    it("应该找到换微信按钮 (新hash: 1rf60)", () => {
      const document = yupaoWechatDOM.window.document;

      // 测试动态选择器
      const exchangeBtnSelector = createDynamicClassSelector("_exchange-tel-btn");
      const buttons = document.querySelectorAll(exchangeBtnSelector);

      // 应该找到多个交换按钮
      expect(buttons.length).toBeGreaterThan(0);

      // 查找包含"换微信"文本的按钮
      let foundWechatButton = false;
      buttons.forEach((btn: Element) => {
        if (btn.textContent?.includes("换微信")) {
          foundWechatButton = true;
          // 验证class包含新的hash值
          expect(btn.className).toContain("_exchange-tel-btn_1rf60");
        }
      });

      expect(foundWechatButton).toBe(true);
    });

    it("应该找到确认对话框 (新hash: 1rf60)", () => {
      const document = yupaoWechatDOM.window.document;

      // 测试动态选择器
      const dialogSelector = createDynamicClassSelector("_exchangeTipPop");
      const dialogs = document.querySelectorAll(dialogSelector);

      // 应该找到对话框元素
      expect(dialogs.length).toBeGreaterThan(0);

      // 查找微信交换对话框（包含_wechatPop类）
      let wechatDialog: Element | null = null;
      dialogs.forEach((dialog: Element) => {
        if (dialog.className.includes("_wechatPop")) {
          wechatDialog = dialog;
        }
      });

      expect(wechatDialog).not.toBeNull();
      if (wechatDialog) {
        const dialog = wechatDialog as Element;
        expect(dialog.className).toContain("_exchangeTipPop_1rf60");
        expect(dialog.className).toContain("_wechatPop_1rf60");

        // 验证对话框标题
        const title = dialog.querySelector('[class*="_title_"]');
        expect(title?.textContent).toContain("确定与对方交换微信吗");
      }
    });

    it("应该找到确认和取消按钮", () => {
      const document = yupaoWechatDOM.window.document;

      // 找到微信对话框
      const dialogSelector = createDynamicClassSelector("_exchangeTipPop");
      const dialogs = document.querySelectorAll(dialogSelector);

      let wechatDialog: Element | null = null;
      dialogs.forEach((dialog: Element) => {
        if (dialog.className.includes("_wechatPop")) {
          wechatDialog = dialog;
        }
      });

      expect(wechatDialog).not.toBeNull();

      if (wechatDialog) {
        const dialog = wechatDialog as Element;
        // 查找所有按钮
        const buttons = dialog.querySelectorAll("button");
        expect(buttons.length).toBe(2);

        // 查找确认按钮（primary样式）和取消按钮
        const buttonArray = Array.from(buttons) as HTMLButtonElement[];
        const confirmButton = buttonArray.find(btn =>
          btn.classList.toString().includes("_primary")
        );
        const cancelButton = buttonArray.find(btn =>
          btn.classList.toString().includes("_lightGreyStroke")
        );

        expect(confirmButton).toBeDefined();
        expect((confirmButton as HTMLButtonElement)?.textContent?.trim()).toBe("确定");

        expect(cancelButton).toBeDefined();
        expect((cancelButton as HTMLButtonElement)?.textContent?.trim()).toBe("取消");
      }
    });

    it("应该处理多个对话框的情况", () => {
      const document = yupaoWechatDOM.window.document;

      // 使用动态选择器查找所有对话框
      const dialogSelector = createDynamicClassSelector("_exchangeTipPop");
      const dialogs = document.querySelectorAll(dialogSelector);

      // 文档中有多个对话框（换微信、求简历等）
      expect(dialogs.length).toBeGreaterThan(1);

      // 验证能找到正确的微信对话框
      let foundWechatDialog = false;
      dialogs.forEach((dialog: Element) => {
        const title = dialog.querySelector('[class*="_title_"]');
        if (title?.textContent?.includes("交换微信")) {
          foundWechatDialog = true;
          // 这个对话框应该是可见的（display: block）
          const style = (dialog as HTMLElement).style;
          expect(style.display).toBe("block");
        }
      });

      expect(foundWechatDialog).toBe(true);
    });

    it("应该使用备用选择器策略找到元素", () => {
      const document = yupaoWechatDOM.window.document;

      // 测试使用更宽泛的选择器
      const allExchangeButtons = document.querySelectorAll('div[class*="_exchange-tel-btn"]');
      expect(allExchangeButtons.length).toBeGreaterThan(0);

      // 测试查找包含特定文本的按钮
      let foundByText = false;
      allExchangeButtons.forEach((btn: Element) => {
        if (btn.textContent?.includes("换微信")) {
          foundByText = true;
        }
      });
      expect(foundByText).toBe(true);

      // 测试查找包含 _wechatPop 的对话框
      const allDialogs = document.querySelectorAll('[class*="_exchangeTipPop"]');
      let foundWechatPop = false;
      allDialogs.forEach((dialog: Element) => {
        if (dialog.className.includes("_wechatPop")) {
          foundWechatPop = true;
        }
      });
      expect(foundWechatPop).toBe(true);
    });

    it("动态选择器应该兼容不同的hash值", () => {
      // 测试选择器在不同hash值下的通用性
      const testCases = [
        { className: "_exchange-tel-btn_fdply_71", baseClass: "_exchange-tel-btn" },
        { className: "_exchange-tel-btn_1rf60_85", baseClass: "_exchange-tel-btn" },
        { className: "_exchangeTipPop_fdply_91", baseClass: "_exchangeTipPop" },
        { className: "_exchangeTipPop_1rf60_108", baseClass: "_exchangeTipPop" },
      ];

      testCases.forEach(({ className, baseClass }) => {
        const selector = createDynamicClassSelector(baseClass);

        // 创建一个测试元素
        const testDoc = new JSDOM(`<div class="${className}">Test</div>`);
        const element = testDoc.window.document.querySelector(selector);

        expect(element).not.toBeNull();
        expect(element?.className).toBe(className);
      });
    });
  });
});
