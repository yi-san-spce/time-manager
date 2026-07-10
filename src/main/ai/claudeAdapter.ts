import Anthropic from '@anthropic-ai/sdk'
import type {
  AnalyzeInput,
  AnalyzeResult,
  ChatInput,
  ChatResult,
  SummarizeInput,
  TestConnectionResult
} from '@shared/types/ai'
import type { AIProvider } from './types'
import { buildAnalyzePrompt, buildSummarizePrompt } from './promptBuilder'
import { parseAnalyzeResponse } from './responseParser'

export class ClaudeAdapter implements AIProvider {
  private readonly client: Anthropic
  private readonly model: string

  constructor(apiKey: string, model: string, baseUrl?: string | null) {
    this.client = new Anthropic(baseUrl ? { apiKey, baseURL: baseUrl } : { apiKey })
    this.model = model
  }

  async testConnection(): Promise<TestConnectionResult> {
    try {
      await this.client.messages.create({
        model: this.model,
        max_tokens: 8,
        messages: [{ role: 'user', content: 'ping' }]
      })
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  async analyze(input: AnalyzeInput): Promise<AnalyzeResult> {
    const { system, user } = buildAnalyzePrompt(input)
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: user }]
    })
    const rawText = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n')
    return parseAnalyzeResponse(rawText)
  }

  async summarize(input: SummarizeInput): Promise<string> {
    const { system, user } = buildSummarizePrompt(input)
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: user }]
    })
    return response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
  }

  async chat(input: ChatInput): Promise<ChatResult> {
    const messages: Anthropic.MessageParam[] = input.messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: m.toolCallId ?? '',
              content: m.content
            }
          ]
        }
      }
      if (m.role === 'assistant' && m.toolCalls) {
        return {
          role: 'assistant',
          content: m.toolCalls.map((call) => ({
            type: 'tool_use' as const,
            id: call.id,
            name: call.name,
            input: call.arguments as Record<string, unknown>
          }))
        }
      }
      return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }
    })

    const tools: Anthropic.Tool[] = input.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Tool.InputSchema
    }))

    // 流式请求：Sonnet 5 用 adaptive thinking（budget_tokens 会 400），
    // display:"summarized" 才能拿到思考摘要（默认 omitted 为空）。即便代理缓冲 SSE，
    // finalMessage() 仍返回完整结果，故正确性不依赖逐块到达。
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 8192,
      thinking: { type: 'adaptive', display: 'summarized' },
      messages,
      tools: tools.length > 0 ? tools : undefined
    })
    const response = await stream.finalMessage()

    const thinking =
      response.content
        .filter((b) => b.type === 'thinking')
        .map((b) => b.thinking)
        .join('\n')
        .trim() || null

    const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use')
    if (toolUseBlocks.length > 0) {
      return {
        type: 'tool_calls',
        calls: toolUseBlocks.map((b) => ({ id: b.id, name: b.name, arguments: b.input })),
        thinking
      }
    }

    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n')
    return { type: 'text', content: text, thinking }
  }
}
