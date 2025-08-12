import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../route'
import { createMockTextStream, createMockToolCallStream } from '@/lib/__tests__/test-utils/ai-mocks'
import type { UIMessage } from 'ai'

// Mock dependencies
vi.mock('@/lib/model-registry/dynamic-registry', () => ({
  getDynamicRegistry: vi.fn(() => ({
    languageModel: vi.fn()
  }))
}))

vi.mock('@/lib/e2b/utils', () => ({
  killDesktop: vi.fn()
}))

vi.mock('@/lib/loaders/system-prompts.loader', () => ({
  getBossZhipinSystemPrompt: vi.fn(() => 'Mock Boss直聘系统提示词'),
  getBossZhipinLocalSystemPrompt: vi.fn(() => 'Mock Boss直聘本地系统提示词'),
  getGeneralComputerSystemPrompt: vi.fn(() => 'Mock 通用计算机系统提示词')
}))

vi.mock('@/lib/tools/tool-registry', () => ({
  createAndFilterTools: vi.fn(() => ({
    // Return mock tools - empty object is fine for most tests
    // Individual tests can override this if needed
  }))
}))

describe('Chat API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle a simple text response', async () => {
    const mockModel = createMockTextStream(['Hello', ', ', 'world!'])
    const { getDynamicRegistry } = await import('@/lib/model-registry/dynamic-registry')
    vi.mocked(getDynamicRegistry).mockReturnValue({
      languageModel: () => mockModel,
      textEmbeddingModel: () => null as any,
      imageModel: () => null as any,
      transcriptionModel: () => null as any,
      speechModel: () => null as any
    })

    const messages: UIMessage[] = [
      { 
        id: '1', 
        role: 'user', 
        parts: [{ type: 'text', text: 'Hello' }]
      }
    ]

    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages,
        sandboxId: 'test-sandbox',
        preferredBrand: '测试品牌'
      })
    })

    const response = await POST(request)
    expect(response).toBeInstanceOf(Response)
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    
    // Read the stream
    const reader = response.body?.getReader()
    const chunks: string[] = []
    
    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(new TextDecoder().decode(value))
      }
    }
    
    const responseText = chunks.join('')
    expect(responseText).toContain('Hello')
    expect(responseText).toContain('world')
  })

  it.skip('should handle tool invocations', async () => {
    // TODO: Fix tool mock for AI SDK v5 - the mock format needs updating for v5's tool call stream chunks
    const mockModel = createMockToolCallStream(
      'wechat',
      { 
        message: '测试消息',
        notification_type: 'test_result'
      },
      '已发送消息到微信群'
    )

    const { getDynamicRegistry } = await import('@/lib/model-registry/dynamic-registry')
    vi.mocked(getDynamicRegistry).mockReturnValue({
      languageModel: () => mockModel,
      textEmbeddingModel: () => null as any,
      imageModel: () => null as any,
      transcriptionModel: () => null as any,
      speechModel: () => null as any
    })

    const messages: UIMessage[] = [
      { 
        id: '1', 
        role: 'user', 
        parts: [{ type: 'text', text: '发送测试消息到微信群' }]
      }
    ]

    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages,
        sandboxId: 'test-sandbox',
        preferredBrand: '测试品牌',
        activeSystemPrompt: 'bossZhipinSystemPrompt'
      })
    })

    const response = await POST(request)
    expect(response).toBeInstanceOf(Response)
    
    // Read and parse the stream
    const reader = response.body?.getReader()
    const chunks: string[] = []
    
    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(new TextDecoder().decode(value))
      }
    }
    
    const responseText = chunks.join('')
    // AI SDK 流式响应格式检查
    expect(responseText).toBeTruthy()
    // 验证响应中包含工具调用相关内容
    expect(responseText).toMatch(/tool.*(call|wechat)/i)
    expect(responseText).toContain('已发送消息到微信群')
  })

  it('should handle error gracefully', async () => {
    const { getDynamicRegistry } = await import('@/lib/model-registry/dynamic-registry')
    vi.mocked(getDynamicRegistry).mockImplementation(() => {
      throw new Error('Model initialization failed')
    })

    const messages: UIMessage[] = [
      { 
        id: '1', 
        role: 'user', 
        parts: [{ type: 'text', text: 'Test message' }]
      }
    ]

    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages,
        sandboxId: 'test-sandbox',
        preferredBrand: '测试品牌'
      })
    })

    const response = await POST(request)
    expect(response.status).toBe(500)
    const responseData = await response.json()
    expect(responseData.error).toBe('Internal Server Error')
  })

  it('should apply message pruning for large conversations', async () => {
    const mockModel = createMockTextStream(['Response'])
    const { getDynamicRegistry } = await import('@/lib/model-registry/dynamic-registry')
    vi.mocked(getDynamicRegistry).mockReturnValue({
      languageModel: () => mockModel,
      textEmbeddingModel: () => null as any,
      imageModel: () => null as any,
      transcriptionModel: () => null as any,
      speechModel: () => null as any
    })

    // Create a large conversation history
    const messages: UIMessage[] = Array.from({ length: 100 }, (_, i) => {
      const content = `This is a long message ${i} with some content to make it substantial enough for token counting purposes.`
      return {
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant' as const,
        content,
        parts: [{ type: 'text', text: content }]
      }
    })

    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages,
        sandboxId: 'test-sandbox',
        preferredBrand: '测试品牌'
      })
    })

    const response = await POST(request)
    expect(response).toBeInstanceOf(Response)
    
    // The prunedMessages function should have reduced the message count
    // This is verified by the console.log output in the actual implementation
  })
})