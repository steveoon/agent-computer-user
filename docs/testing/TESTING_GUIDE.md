# 测试指南

## 概述

本项目使用 Vitest + React Testing Library 进行单元测试和组件测试。配置已根据 2025 年最佳实践进行优化。

## 运行测试

```bash
# 运行所有测试（监听模式）
pnpm test

# 运行一次所有测试
pnpm test:run

# 监听模式运行测试
pnpm test:watch

# 使用 UI 界面运行测试
pnpm test:ui

# 生成测试覆盖率报告
pnpm test:coverage

# UI 界面查看测试覆盖率
pnpm test:coverage:ui
```

## 文件结构

测试文件应放置在相应的 `__tests__` 目录中：

```
lib/
  utils.ts
  __tests__/
    utils.test.ts

components/
  brand-selector.tsx
  __tests__/
    brand-selector.test.tsx
```

## 编写测试

### 单元测试示例

```typescript
import { describe, it, expect } from "vitest";
import { myFunction } from "../myModule";

describe("myFunction", () => {
  it("should return expected value", () => {
    expect(myFunction("input")).toBe("expected output");
  });
});
```

### 组件测试示例

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MyComponent } from '../MyComponent'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('handles user interaction', async () => {
    const user = userEvent.setup()
    render(<MyComponent />)

    await user.click(screen.getByRole('button'))
    expect(screen.getByText('Clicked!')).toBeInTheDocument()
  })
})
```

## Mock 处理

项目已配置了常用的 Next.js 相关 mock：

- `next/navigation` - Router, pathname, searchParams 等
- `next/image` - Image 组件
- `window.matchMedia` - 媒体查询
- `IntersectionObserver` - 交叉观察器
- `ResizeObserver` - 尺寸观察器

## 最佳实践

1. **测试用户行为而非实现细节**
2. **使用 Testing Library 的查询优先级**：
   - getByRole > getByLabelText > getByPlaceholderText > getByText > getByTestId
3. **避免测试内部状态**，专注于组件的输入输出
4. **为异步操作使用 waitFor 或 findBy 查询**
5. **合理使用 mock**，但尽量保持测试的真实性

## 调试测试

如果测试失败，可以：

1. 使用 `screen.debug()` 打印当前 DOM
2. 运行 `pnpm test:ui` 使用可视化界面调试
3. 在测试中添加 `console.log` 语句
4. 使用 `--reporter=verbose` 获取更详细的输出

## 配置特性

基于 2025 年最佳实践，我们的 Vitest 配置包含以下优化：

- **性能优化**：使用 worker threads 进行并行测试
- **SVG 支持**：集成 vite-plugin-magical-svg 处理 SVG 文件
- **代码覆盖率阈值**：设置 80% 的覆盖率要求
- **超时配置**：测试和钩子超时设置为 10 秒
- **路径别名**：支持 TypeScript 路径映射

### 高级配置选项

1. **自动更新覆盖率阈值**（实验性功能）：

   ```typescript
   coverage: {
     thresholds: {
       autoUpdate: true; // 当覆盖率提升时自动更新阈值
     }
   }
   ```

2. **AST-aware V8 Coverage**（实验性功能）：

   ```typescript
   coverage: {
     experimentalAstAwareRemapping: true; // 提升性能并与 Istanbul 对齐
   }
   ```

3. **自定义测试环境**：
   除了 `jsdom`，Vitest 还支持 `happy-dom` 和 `node` 环境：
   ```typescript
   test: {
     environment: "happy-dom"; // 或 'jsdom', 'node'
   }
   ```

## 相关资源

- [Vitest 文档](https://vitest.dev/)
- [React Testing Library 文档](https://testing-library.com/docs/react-testing-library/intro)
- [Testing Library 查询优先级](https://testing-library.com/docs/queries/about#priority)
- [Next.js Testing Guide](https://nextjs.org/docs/app/guides/testing/vitest)
