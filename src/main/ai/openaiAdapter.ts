import OpenAI from 'openai'
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

export class OpenAIAdapter implements AIProvider {
  private readonly client: OpenAI
  private readonly model: string

  constructor(apiKey: string, model: string, baseUrl?: string | null) {
    this.client = new OpenAI(baseUrl ? { apiKey, baseURL: baseUrl } : { apiKey })
    this.model = model
  }

  async testConnection(): Promise<TestConnectionResult> {
    try {
      await this.client.chat.completions.create({
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
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
    const rawText = response.choices[0]?.message.content ?? ''
    return parseAnalyzeResponse(rawText)
  }

  async summarize(input: SummarizeInput): Promise<string> {
    const { system, user } = buildSummarizePrompt(input)
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 2048,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
    return response.choices[0]?.message.content ?? ''
  }

  async chat(input: ChatInput): Promise<ChatResult> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = input.messages.map((m) => {
      if (m.role === 'tool') {
        return { role: 'tool', content: m.content, tool_call_id: m.toolCallId ?? '' }
      }
      if (m.role === 'assistant' && m.toolCalls) {
        return {
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map((call) => ({
            id: call.id,
            type: 'function' as const,
            function: { name: call.name, arguments: JSON.stringify(call.arguments) }
          }))
        }
      }
      return { role: m.role, content: m.content }
    })

    const tools: OpenAI.Chat.ChatCompletionTool[] = input.tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.inputSchema }
    }))

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 2048,
      messages,
      tools: tools.length > 0 ? tools : undefined
    })

    const choice = response.choices[0]
    const toolCalls = choice?.message.tool_calls?.filter((c) => c.type === 'function')

    if (toolCalls && toolCalls.length > 0) {
      return {
        type: 'tool_calls',
        calls: toolCalls.map((c) => ({
          id: c.id,
          name: c.function.name,
          arguments: JSON.parse(c.function.arguments)
        }))
      }
    }

    return { type: 'text', content: choice?.message.content ?? '' }
  }
}
