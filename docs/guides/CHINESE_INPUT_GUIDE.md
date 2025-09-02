# 中文输入问题解决指南

## 问题描述

在 E2B 环境中使用 AI SDK Computer Use 进行中文输入时，可能会遇到 "Invalid multi-byte sequence encountered" 错误。这是由于 E2B 环境默认没有配置中文输入支持导致的。

## 解决方案

### 自动解决方案

系统已经实现了多层级的自动处理机制：

1. **自动检测**: 当检测到中文字符时，系统会自动启用特殊处理模式
2. **多种输入方法**: 依次尝试以下方法：
   - 剪贴板输入法 (推荐)
   - xdotool 输入法
   - 逐字符 Unicode 输入法

### 手动配置

如果自动方案无效，可以手动配置：

#### 方法 1: 使用配置工具

在对话中发送以下提示：

```
执行 setup_chinese_input 操作来配置完整的中文输入环境
```

#### 方法 2: 手动命令配置

通过 bash 工具执行以下命令：

```bash
# 1. 安装必要工具
apt-get update && apt-get install -y xclip xdotool ibus ibus-pinyin fonts-wqy-zenhei

# 2. 配置环境变量
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
export LC_CTYPE=en_US.UTF-8
export XMODIFIERS=@im=ibus
export GTK_IM_MODULE=ibus
export QT_IM_MODULE=ibus

# 3. 启动输入法守护进程
ibus-daemon -drx

# 4. 刷新字体缓存
fc-cache -fv
```

## 技术实现细节

### 输入方法优先级

1. **剪贴板方法** (首选)
   - 使用 `xclip` 将文本写入系统剪贴板
   - 通过 `Ctrl+V` 粘贴内容
   - 兼容性最好，成功率最高

2. **xdotool 方法** (备选)
   - 直接使用 `xdotool type` 命令输入
   - 适用于系统级输入

3. **Unicode 输入方法** (最后备选)
   - 逐字符转换为 Unicode 码点
   - 使用 `Ctrl+Shift+U` + Unicode 码 + Space 的方式输入
   - 兼容性有限但可作为最后手段

### 错误处理机制

- 每种方法都有独立的错误捕获
- 失败时自动尝试下一种方法
- 提供详细的错误日志和用户友好的错误信息

## 常见问题解决

### Q: 中文输入仍然失败怎么办？

A: 尝试以下步骤：

1. 确认桌面环境已完全加载
2. 手动运行 `setup_chinese_input` 操作
3. 检查是否有特殊字符或表情符号干扰

### Q: 只有部分中文字符无法输入？

A: 这可能是字体问题：

1. 运行 `check_fonts` 操作检查字体状态
2. 安装更完整的中文字体包

### Q: 输入速度很慢？

A: 这是正常现象：

1. 系统需要逐个处理特殊字符
2. 建议输入较短的文本段落
3. 对于长文本，考虑分段输入

## 开发者信息

### 文件位置

- 主要实现: `lib/e2b/tool.ts`
- 环境配置: `lib/e2b/utils.ts`
- 字体管理: `lib/e2b/font-packages.ts`

### 配置标记

- `_needsChineseSetup`: 标记是否需要中文环境配置
- `_chineseInputConfigured`: 标记是否已完成完整中文配置

### 支持的字符范围

- 中日韩统一表意文字 (U+4E00-U+9FFF)
- 中日韩统一表意文字扩展 A (U+3400-U+4DBF)
- 中日韩兼容表意文字 (U+F900-U+FAFF)
