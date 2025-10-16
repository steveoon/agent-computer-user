# 花卷品牌色使用指南

## 品牌色配置

### 颜色定义

```javascript
{
  "primary": "#F59E0B",  // 琥珀橙 - 主色调
  "light": "#FCD34D",    // 浅黄 - 强调/高亮
  "dark": "#D97706"      // 深橙 - 深色变体
}
```

### OKLCH 颜色值

```css
--brand-primary: oklch(0.74 0.15 70);    /* #F59E0B */
--brand-light: oklch(0.85 0.15 85);      /* #FCD34D */
--brand-dark: oklch(0.60 0.18 60);       /* #D97706 */
```

## Tailwind CSS 使用方法

### 1. 使用品牌色类名

```tsx
// 背景色
<div className="bg-brand-primary">主色背景</div>
<div className="bg-brand-light">浅色背景</div>
<div className="bg-brand-dark">深色背景</div>

// 文字颜色
<span className="text-brand-primary">品牌色文字</span>
<span className="text-brand-light">浅色文字</span>
<span className="text-brand-dark">深色文字</span>

// 边框颜色
<div className="border border-brand-primary">品牌色边框</div>
```

### 2. 使用语义化类名

所有 shadcn/ui 组件默认使用 `primary` 和 `accent` 颜色，已配置为花卷品牌色：

```tsx
// Button 组件自动使用品牌主色
<Button>默认按钮</Button>

// 使用 primary 变体
<Button variant="default">主要操作</Button>

// Ring/Focus 效果自动使用品牌色
<Input className="focus:ring-primary" />
```

### 3. Hover 和交互状态

```tsx
// Hover 效果
<div className="hover:bg-brand-primary hover:text-white">
  鼠标悬停变色
</div>

// Active 状态
<button className="active:bg-brand-dark">
  点击时变深
</button>

// Focus 环
<input className="focus:ring-2 focus:ring-brand-primary" />
```

## shadcn/ui 组件示例

### Button 组件

```tsx
// 默认按钮（使用品牌主色）
<Button>保存</Button>

// 强调按钮
<Button className="bg-brand-light text-brand-dark hover:bg-brand-primary">
  立即体验
</Button>

// 次要按钮
<Button variant="outline" className="border-brand-primary text-brand-primary">
  了解更多
</Button>
```

### Badge 组件

```tsx
<Badge className="bg-brand-primary">新功能</Badge>
<Badge variant="outline" className="border-brand-primary text-brand-primary">
  热门
</Badge>
```

### Alert 组件

```tsx
<Alert className="border-brand-primary bg-brand-light/10">
  <AlertTitle className="text-brand-dark">提示</AlertTitle>
  <AlertDescription>这是一条品牌色提示</AlertDescription>
</Alert>
```

## 图表颜色配置

所有图表的第一个颜色（`chart-1`）已配置为品牌主色：

```tsx
// Recharts 示例
<BarChart data={data}>
  <Bar dataKey="value" className="fill-chart-1" /> {/* 使用品牌色 */}
</BarChart>
```

## 深色模式支持

品牌色在深色模式下自动适配，保持一致性：

```tsx
// 无需特殊处理，深色模式自动生效
<div className="bg-brand-primary text-primary-foreground">
  浅色和深色模式下都正确显示
</div>
```

## 渐变效果

```tsx
// 从品牌主色到浅色
<div className="bg-gradient-to-r from-brand-primary to-brand-light">
  渐变背景
</div>

// 从品牌主色到深色
<div className="bg-gradient-to-b from-brand-primary to-brand-dark">
  垂直渐变
</div>
```

## 透明度控制

```tsx
// 使用透明度
<div className="bg-brand-primary/50">50% 透明度</div>
<div className="bg-brand-primary/20">20% 透明度</div>
<div className="bg-brand-primary/10">10% 透明度</div>
```

## 完整配色方案

### 主要操作（Primary Actions）
- 背景：`bg-brand-primary`
- 文字：`text-white`
- Hover：`hover:bg-brand-dark`

### 次要操作（Secondary Actions）
- 背景：`bg-transparent`
- 文字：`text-brand-primary`
- 边框：`border-brand-primary`
- Hover：`hover:bg-brand-primary/10`

### 强调/高亮（Highlight）
- 背景：`bg-brand-light`
- 文字：`text-brand-dark`

### 状态指示

```tsx
// 成功（保持绿色）
<Badge className="bg-green-500">成功</Badge>

// 警告（使用品牌浅色）
<Badge className="bg-brand-light text-brand-dark">警告</Badge>

// 信息（使用品牌主色）
<Badge className="bg-brand-primary">信息</Badge>

// 错误（保持红色）
<Badge className="bg-destructive">错误</Badge>
```

## 品牌一致性检查清单

- [ ] 所有主要按钮使用品牌主色
- [ ] 链接颜色使用品牌色
- [ ] Focus ring 使用品牌色
- [ ] Loading 指示器使用品牌色
- [ ] 图表主要数据使用品牌色
- [ ] Logo 和品牌色协调一致
- [ ] 深色模式下品牌色正确显示

## 注意事项

1. **避免过度使用**：品牌色应用于强调元素，不是所有元素
2. **保持对比度**：确保文字在品牌色背景上可读
3. **深色模式**：测试深色模式下的显示效果
4. **辅助功能**：确保颜色对比度符合 WCAG AA 标准
