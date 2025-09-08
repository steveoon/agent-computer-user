# Puppeteer MCP Server API 接口文档

本文档提供了Puppeteer MCP Server的完整API接口说明，帮助Claude Code Agent快速、准确地调用浏览器自动化功能。

## 概述

Puppeteer MCP Server通过Model Context Protocol提供了8个浏览器自动化工具，可以控制Chrome浏览器执行各种操作。

## 前置条件

### 连接现有Chrome浏览器

如需连接到已打开的Chrome浏览器，需要启动Chrome时开启远程调试：

**Windows:**

```bash
chrome.exe --remote-debugging-port=9222
```

**Mac:**

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

## API 接口列表

### 1. 连接到Chrome浏览器

```typescript
Tool: puppeteer_connect_active_tab;
```

**功能描述：** 连接到现有的Chrome浏览器实例或创建新实例

**参数：**
| 参数名 | 类型 | 必需 | 默认值 | 说明 |
|--------|------|------|--------|------|
| targetUrl | string | 否 | - | 目标标签页URL，不指定则连接第一个可用标签页 |
| debugPort | number | 否 | 9222 | Chrome远程调试端口 |

**返回示例：**

```json
{
  "content": [
    {
      "type": "text",
      "text": "Successfully connected to active tab: Example Page"
    }
  ]
}
```

**错误处理：**

- 如果Chrome未启动或未开启远程调试，会返回详细的启动指令
- 如果无法找到目标标签页，会列出所有可用标签页

---

### 2. 导航到URL

```typescript
Tool: puppeteer_navigate;
```

**功能描述：** 导航浏览器到指定URL

**参数：**
| 参数名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| url | string | 是 | 要访问的完整URL地址 |

**返回示例：**

```json
{
  "content": [
    {
      "type": "text",
      "text": "Successfully navigated to https://example.com"
    }
  ]
}
```

**注意事项：**

- 导航超时时间为30秒
- HTTP状态码>=400会被视为错误
- 会等待页面load事件完成

---

### 3. 截图

```typescript
Tool: puppeteer_screenshot;
```

**功能描述：** 对当前页面或指定元素进行截图

**参数：**
| 参数名 | 类型 | 必需 | 默认值 | 说明 |
|--------|------|------|--------|------|
| name | string | 是 | - | 截图名称，用于后续引用 |
| selector | string | 否 | - | CSS选择器，指定要截图的元素 |
| width | number | 否 | 800 | 视口宽度（像素） |
| height | number | 否 | 600 | 视口高度（像素） |

**返回示例：**

```json
{
  "content": [
    {
      "type": "text",
      "text": "Screenshot saved as 'homepage'"
    }
  ]
}
```

**资源访问：**
截图保存后可通过资源URI访问：`screenshot://homepage`

---

### 4. 点击元素

```typescript
Tool: puppeteer_click;
```

**功能描述：** 点击页面上的指定元素

**参数：**
| 参数名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| selector | string | 是 | 要点击元素的CSS选择器 |

**返回示例：**

```json
{
  "content": [
    {
      "type": "text",
      "text": "Successfully clicked element: button#submit"
    }
  ]
}
```

**注意事项：**

- 会等待元素出现在页面上
- 如果元素不存在会返回错误

---

### 5. 填充输入框

```typescript
Tool: puppeteer_fill;
```

**功能描述：** 向输入框填充文本

**参数：**
| 参数名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| selector | string | 是 | 输入框的CSS选择器 |
| value | string | 是 | 要填充的文本内容 |

**返回示例：**

```json
{
  "content": [
    {
      "type": "text",
      "text": "Successfully filled element: input#username"
    }
  ]
}
```

**注意事项：**

- 会先清空输入框再填充新内容
- 支持各种input类型和textarea

---

### 6. 选择下拉菜单

```typescript
Tool: puppeteer_select;
```

**功能描述：** 在下拉菜单中选择指定选项

**参数：**
| 参数名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| selector | string | 是 | select元素的CSS选择器 |
| value | string | 是 | 要选择的option的value值 |

**返回示例：**

```json
{
  "content": [
    {
      "type": "text",
      "text": "Successfully selected value in element: select#country"
    }
  ]
}
```

---

### 7. 悬停元素

```typescript
Tool: puppeteer_hover;
```

**功能描述：** 将鼠标悬停在指定元素上

**参数：**
| 参数名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| selector | string | 是 | 要悬停元素的CSS选择器 |

**返回示例：**

```json
{
  "content": [
    {
      "type": "text",
      "text": "Successfully hovered over element: div.menu-item"
    }
  ]
}
```

---

### 8. 执行JavaScript

```typescript
Tool: puppeteer_evaluate;
```

**功能描述：** 在页面上下文中执行JavaScript代码

**参数：**
| 参数名 | 类型 | 必需 | 说明 |
|--------|------|------|------|
| script | string | 是 | 要执行的JavaScript代码 |

**返回示例：**

```json
{
  "content": [
    {
      "type": "text",
      "text": "Script result: {\"title\":\"Example Page\",\"url\":\"https://example.com\"}"
    }
  ]
}
```

**特殊功能：**

- 自动捕获console.log输出
- 支持异步代码执行
- 返回值会被JSON序列化

---

## 资源访问

### 控制台日志

**URI:** `console://logs`  
**描述:** 获取所有捕获的控制台输出

### 截图

**URI:** `screenshot://{name}`  
**描述:** 获取指定名称的截图（Base64格式）

## 典型使用流程

```typescript
// 1. 连接到浏览器
await use_mcp_tool("puppeteer_connect_active_tab", {});

// 2. 导航到网站
await use_mcp_tool("puppeteer_navigate", {
  url: "https://example.com",
});

// 3. 填充登录表单
await use_mcp_tool("puppeteer_fill", {
  selector: "#username",
  value: "user@example.com",
});

await use_mcp_tool("puppeteer_fill", {
  selector: "#password",
  value: "password123",
});

// 4. 点击登录按钮
await use_mcp_tool("puppeteer_click", {
  selector: "#login-button",
});

// 5. 等待并截图
await use_mcp_tool("puppeteer_screenshot", {
  name: "dashboard",
  selector: ".main-content",
});

// 6. 执行自定义脚本
await use_mcp_tool("puppeteer_evaluate", {
  script: "return document.title",
});
```

## 错误处理建议

1. **连接失败：** 检查Chrome是否启动并开启远程调试
2. **元素未找到：** 确认选择器正确，考虑添加等待时间
3. **导航超时：** 检查URL是否可访问，网络是否正常
4. **脚本执行失败：** 检查JavaScript语法，确保返回值可序列化

## 最佳实践

1. **先连接再操作：** 始终先调用`puppeteer_connect_active_tab`
2. **使用准确的选择器：** 优先使用ID选择器，其次是class
3. **合理使用截图：** 为关键步骤截图便于调试
4. **错误恢复：** 捕获错误并提供有意义的反馈
5. **资源清理：** 操作完成后浏览器会自动清理

## 注意事项

- 所有操作都是异步的
- 选择器必须是有效的CSS选择器
- 执行的JavaScript代码在页面上下文中运行
- 截图以Base64格式存储在内存中
- 控制台日志会实时更新
