# Neural Field Architecture 技术方案说明

## 概述

Neural Field Architecture (NFA) 是基于Context Engineering原则设计的多Agent协作架构，通过统一的语义场实现Agent间的自然信息流动和共振协作，解决当前三层嵌套架构中的上下文碎片化、线性信息流、刚性边界等问题。

## 项目文件结构

### 新增文件目录结构

#### Phase 1 - 基础设施（当前实施）
```
lib/
├── neural-field/                           # 神经场核心模块
│   ├── core/                              # 核心实现
│   │   ├── semantic-field.ts              # 语义场基础类（含共振逻辑）
│   │   └── field-operations.ts            # 场操作工具类
│   ├── orchestrator/                      # 编排层
│   │   └── migration-adapter.ts           # 迁移适配器
│   └── __tests__/                         # 测试文件
│       └── semantic-field.test.ts         # 基础功能测试
types/
└── neural-field.d.ts                      # 类型定义
```

#### Phase 2+ - 后续扩展（规划中）
```
lib/
├── neural-field/
│   ├── agents/                            # 场感知Agent（Phase 2）
│   │   ├── base-field-agent.ts
│   │   ├── intent-recognizer.ts
│   │   ├── reply-generator.ts
│   │   └── quality-validator.ts
│   ├── orchestrator/
│   │   └── field-orchestrator.ts          # 统一场编排器（Phase 3）
│   └── utils/                             # 工具集（Phase 4+）
│       └── field-metrics.ts               # 性能监控
```

### 需要修改的文件目录结构

```
lib/
├── tools/
│   └── zhipin-reply-tool.ts               # [修改] 添加场架构支持
├── loaders/
│   └── zhipin-data.loader.ts              # [修改] 添加场架构接口
├── config/
│   └── models.ts                          # [修改] 添加experimental配置
app/
├── api/
│   ├── chat/
│   │   └── route.ts                       # [修改] 支持场架构开关
│   └── test-field-reply/                  # [新增] 测试端点
│       └── route.ts
types/
└── neural-field.d.ts                      # [新增] 类型定义
```

## Phase 1: 基础语义场基础设施

### 1. SemanticField 类详解

#### 1.1 类的核心职责
- 维护统一的高维语义空间（默认1536维，对应OpenAI embedding维度）
- 管理Agent激活状态和相互作用
- 实现场演化和稳定性检测（包含共振逻辑）
- 提供场切片访问接口

**注意**：共振机制直接集成在SemanticField类中，不需要独立的ResonanceEngine

#### 1.2 配置参数说明

```typescript
export const FieldConfigSchema = z.object({
  dimensions: z.number().default(1536),
  // 语义场的维度，决定了场的表达能力
  // 1536维对应OpenAI text-embedding-3-small模型的输出维度
  
  resonanceDecay: z.number().min(0).max(1).default(0.1),
  // 共振衰减率，控制Agent间相互影响的持续性
  // 0.1表示每次迭代共振强度衰减10%
  // 值越小，共振影响持续越久；值越大，系统收敛越快
  
  boundaryPermeability: z.number().min(0).max(1).default(0.8),
  // 边界渗透率，控制信息注入场时的渗透程度
  // 0.8表示注入的信息有80%的强度进入场
  // 高值利于信息流动，低值保持场的稳定性
  
  stabilityThreshold: z.number().default(0.01),
  // 稳定性阈值，判断场是否达到稳定状态
  // 当连续两次迭代的场变化小于此值时，认为场已稳定
  // 值越小，要求的稳定性越高，演化时间越长
  
  maxIterations: z.number().default(20)
  // 最大演化迭代次数，防止无限循环
  // 20次通常足够达到稳定，可根据实际调整
});
```

#### 1.3 核心方法说明

```typescript
class SemanticField {
  // 注入方法：将信息编码到场中
  async inject(data: string | number[], position?: number): Promise<void>
  // data: 要注入的数据，可以是文本或向量
  // position: 注入位置，默认从0开始
  // 使用指数衰减函数确保平滑注入，避免场的突变
  
  // 演化方法：让场通过Agent相互作用达到稳定
  async evolve(iterations?: number): Promise<FieldState>
  // iterations: 可选的迭代次数，覆盖默认配置
  // 返回最终的场状态，包含是否稳定的标志
  
  // 切片方法：获取场的特定区域供Agent使用
  getSlice(start: number, end: number): Float32Array
  // start: 切片起始位置
  // end: 切片结束位置
  // 返回指定区域的场向量
  
  // 激活注册：Agent将其激活状态注册到场中
  registerActivation(agentName: string, activation: Float32Array): void
  // agentName: Agent标识符
  // activation: Agent的激活向量
  // 用于后续的共振计算
}
```

### 2. 场演化核心算法

#### 2.1 演化流程

```
初始状态 → 注入信息 → Agent激活 → 共振计算 → 场更新 → 稳定检测
    ↑                                                        ↓
    └────────────── 未稳定则继续迭代 ←──────────────────────┘
```

#### 2.2 共振算法详解

```typescript
private applyResonance(): void {
  // 1. 获取所有Agent的激活状态
  const activations = Array.from(this.agentActivations.entries());
  
  // 2. 计算两两Agent间的共振
  for (let i = 0; i < activations.length; i++) {
    for (let j = i + 1; j < activations.length; j++) {
      const [name1, vec1] = activations[i];
      const [name2, vec2] = activations[j];
      
      // 3. 计算语义相似度（余弦相似度）
      const similarity = this.cosineSimilarity(vec1, vec2);
      
      // 4. 相似度超过阈值(0.7)时产生共振
      if (similarity > 0.7) {
        // 5. 共振强度 = 相似度 × 衰减系数
        const resonanceStrength = similarity * (1 - this.config.resonanceDecay);
        
        // 6. 更新场状态：相似的Agent会强化彼此的信号
        this.applyResonanceEffect(vec1, vec2, resonanceStrength);
      }
    }
  }
}
```

#### 2.3 稳定性检测

```typescript
private checkStability(): boolean {
  // 计算当前状态与上一状态的欧氏距离
  let totalChange = 0;
  for (let i = 0; i < this.state.length; i++) {
    const diff = this.state[i] - this.previousState[i];
    totalChange += diff * diff;
  }
  
  // 归一化变化量
  const normalizedChange = Math.sqrt(totalChange) / this.state.length;
  
  // 当变化小于阈值时，认为场已稳定
  return normalizedChange < this.config.stabilityThreshold;
}
```

### 3. FieldOperations 工具类

#### 3.1 文本转向量方法

```typescript
static async textToVector(text: string): Promise<Float32Array>
// 功能：将文本转换为高维语义向量
// 参数：
//   - text: 输入文本
// 实现：
//   - 使用OpenAI text-embedding-3-small模型
//   - 自动返回1536维向量
//   - 包含重试和错误处理机制
// 返回：1536维的Float32Array向量

// 实现示例：
import { openai } from '@ai-sdk/openai';

static async textToVector(text: string): Promise<Float32Array> {
  try {
    const response = await openai.embedding('text-embedding-3-small', {
      input: text,
    });
    return new Float32Array(response.embedding);
  } catch (error) {
    console.error('Embedding generation failed:', error);
    throw new Error('Failed to generate text embedding');
  }
}
```

#### 3.2 向量运算方法

```typescript
static normalize(vector: Float32Array): Float32Array
// 功能：向量归一化，确保向量长度为1
// 用途：统一不同来源向量的尺度，便于比较

static cosineSimilarity(vec1: Float32Array, vec2: Float32Array): number
// 功能：计算两个向量的余弦相似度
// 返回：-1到1之间的相似度值
// 用途：判断Agent激活模式的相似程度，决定共振强度
```

#### 3.3 性能优化建议

为了简化向量运算实现并提高性能，建议使用以下数学库之一：

**选项1：TensorFlow.js**
```typescript
import * as tf from '@tensorflow/tfjs';

// 使用TensorFlow.js优化的向量运算
static cosineSimilarity(vec1: Float32Array, vec2: Float32Array): number {
  const a = tf.tensor1d(vec1);
  const b = tf.tensor1d(vec2);
  
  // TensorFlow.js内置的余弦相似度计算
  const similarity = tf.losses.cosineDistance(a, b, 0).dataSync()[0];
  
  // 清理内存
  a.dispose();
  b.dispose();
  
  return 1 - similarity; // 转换为相似度
}
```

**选项2：ml-matrix（轻量级）**
```typescript
import { Matrix } from 'ml-matrix';

// 使用ml-matrix进行矩阵运算
static normalize(vector: Float32Array): Float32Array {
  const mat = new Matrix([Array.from(vector)]);
  const norm = mat.norm('frobenius');
  return new Float32Array(mat.div(norm).getRow(0));
}
```

**性能优势**：
- TensorFlow.js：支持WebGL加速，批量运算性能优异
- ml-matrix：轻量级，适合简单运算，无需GPU
- 两者都提供成熟的数学运算实现，减少手写错误

### 4. 共振机制的业务含义

#### 4.1 招聘场景示例

当候选人说"工资多少？"时：

1. **IntentRecognizer** 识别到"薪资询问"意图，在其区域(0-384)产生薪资相关的激活模式
2. **ReplyGenerator** 感知到薪资激活，开始准备薪资回复模板，在其区域(384-1152)产生相应激活
3. **QualityValidator** 检测到薪资话题，激活薪资披露规则检查，在其区域(1152-1536)产生合规激活

共振过程：
- 第1次迭代：三个Agent的激活模式开始相互影响
- 第2-3次迭代：薪资相关的语义信号在场中增强
- 第4-5次迭代：合规信号影响生成Agent，调整回复措辞
- 第6次迭代：场达到稳定，所有Agent达成"共识"

#### 4.2 共振的优势

1. **并行处理**：三个Agent同时工作，不需要等待
2. **相互纠正**：验证Agent的信号可以实时影响生成Agent
3. **涌现智能**：Agent间的相互作用可能产生预设之外的合理回复
4. **上下文保持**：信息在统一场中流动，避免传递损失

### 5. 性能优化考虑

1. **向量运算优化**
   - 使用Float32Array而非普通数组，提升计算效率
   - 优先使用TensorFlow.js或ml-matrix库进行向量运算
   - TensorFlow.js可提供GPU加速（通过WebGL）
   - 批量处理相似度计算

2. **场演化优化**
   - 自适应迭代次数：简单查询快速收敛，复杂查询允许更多迭代
   - 早停机制：连续3次变化极小时提前停止
   - 并行化Agent处理

3. **内存管理**
   - 复用向量内存，避免频繁分配
   - 定期清理历史激活记录
   - 使用对象池管理临时向量

## 下一步

完成Phase 1后，我们将拥有：
1. 完整的语义场基础设施
2. 基本的共振机制实现
3. 文本向量化能力
4. 场演化和稳定性检测

这为后续的Agent重构和系统集成奠定了坚实基础。Phase 2将重点实现三个场感知Agent，真正展现共振协作的威力。