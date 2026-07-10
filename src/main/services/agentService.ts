import type { ChatInput, ChatMessage, ToolDefinition } from '@shared/types/ai'
import type { AgentMessage, AgentScope, AgentToolCall } from '@shared/types/models'
import { getActiveAIProviderConfig } from '../db/repositories/aiConfigRepo'
import { decryptApiKey } from './aiSettingsService'
import { createAIProvider } from '../ai/providerFactory'
import { getTaskDetail } from '../db/repositories/taskRepo'
import {
  appendMessage,
  getMessage,
  getOrCreateConversation,
  isGlobalConversation,
  listMessages,
  toUIMessages,
  updateMessageStatus,
  updateMessageToolCalls,
  type StoredMessage
} from '../db/repositories/conversationRepo'
import { findTool, toolsForScope, type AgentTool, type ToolContext } from '../ai/tools/registry'

const MAX_TOOL_ITERATIONS = 6

export interface SendMessageInput {
  scope: AgentScope
  taskId?: string | null
  /** global scope：指定要追加到的对话；省略则用最近一条或新建（需求7 多对话）。 */
  conversationId?: string | null
  text: string
}

export interface ConfirmToolCallInput {
  scope: AgentScope
  taskId?: string | null
  conversationId?: string | null
  messageId: string
  approved: boolean
  /** 需求11：用户确认前编辑过的工具参数，按 toolCallId 覆盖 arguments。 */
  editedToolCalls?: Record<string, unknown>
}

export interface AgentReply {
  conversationId: string
  messages: AgentMessage[]
  /** 是否有一个写类工具在等待用户确认 */
  awaitingConfirmation: boolean
}

function resolveProvider(): { provider: ReturnType<typeof createAIProvider> } {
  const config = getActiveAIProviderConfig()
  if (!config) {
    throw new Error('未配置激活的 AI 供应商，请先在设置页配置并激活一个供应商')
  }
  const apiKey = decryptApiKey(config.id)
  return { provider: createAIProvider(config.provider, apiKey, config.model, config.baseUrl) }
}

function systemContext(scope: AgentScope, taskId?: string | null): string {
  const base =
    '你是时间管理器应用内的 AI 助手。你可以调用工具查询和修改用户的日程/任务/统计/报告。' +
    '所有写操作都会在执行前请用户确认。回答简洁、用中文。当前时间戳（毫秒）：' +
    Date.now() +
    '。'
  if (scope === 'task' && taskId) {
    const detail = getTaskDetail(taskId)
    if (detail) {
      const subs = detail.subtasks.map((s) => `${s.done ? '[x]' : '[ ]'} ${s.title}`).join('\n')
      return (
        base +
        `\n\n你正在协助拆解这个任务：\n标题：${detail.title}\n描述：${detail.description ?? '（无）'}\n` +
        `现有步骤：\n${subs || '（暂无）'}\n` +
        '当用户要求拆解步骤时，用 propose_subtasks 工具生成有序步骤清单（taskId 可省略，默认作用于当前任务）。'
      )
    }
  }
  return base
}

/** 把持久化消息重建为 provider 需要的 ChatInput.messages（含 system 之外的 user/assistant/tool）。 */
function buildChatMessages(system: string, stored: StoredMessage[]): ChatMessage[] {
  const msgs: ChatMessage[] = [{ role: 'user', content: system }]
  for (const m of stored) {
    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
      msgs.push({
        role: 'assistant',
        content: m.content,
        toolCalls: m.toolCalls.map((c) => ({ id: c.id, name: c.name, arguments: c.arguments }))
      })
    } else if (m.role === 'tool') {
      msgs.push({ role: 'tool', content: m.content, toolCallId: m.toolCallId ?? undefined })
    } else {
      msgs.push({ role: m.role, content: m.content })
    }
  }
  return msgs
}

function toolDefs(scope: AgentScope): ToolDefinition[] {
  return toolsForScope(scope).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.jsonSchema
  }))
}

function reply(conversationId: string, awaiting: boolean): AgentReply {
  return {
    conversationId,
    messages: toUIMessages(listMessages(conversationId)),
    awaitingConfirmation: awaiting
  }
}

/**
 * 运行 Agent 循环，直到：模型给出纯文本、遇到需确认的写类工具、或达到迭代上限。
 * 只读工具直接执行并把结果喂回续跑；写类工具落一条 pending assistant 消息后暂停，等待 confirmToolCall。
 */
async function runLoop(conversationId: string, scope: AgentScope, ctx: ToolContext): Promise<AgentReply> {
  const { provider } = resolveProvider()
  const system = systemContext(scope, ctx.taskId)
  const tools = toolDefs(scope)

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const stored = listMessages(conversationId)
    const chatInput: ChatInput = { messages: buildChatMessages(system, stored), tools }
    const result = await provider.chat(chatInput)

    const thinking = result.thinking ?? null

    if (result.type === 'text') {
      appendMessage({ conversationId, role: 'assistant', content: result.content, thinking })
      return reply(conversationId, false)
    }

    // tool_calls：可能含多个。分离读/写。
    const calls: AgentToolCall[] = result.calls.map((c) => {
      const tool = findTool(c.name)
      return { id: c.id, name: c.name, arguments: c.arguments, write: tool?.write ?? true }
    })

    const writeCalls = calls.filter((c) => c.write)
    if (writeCalls.length > 0) {
      // 落一条 pending assistant 消息（携带全部本轮工具调用），暂停等待确认
      appendMessage({
        conversationId,
        role: 'assistant',
        content: '',
        toolCalls: calls,
        status: 'pending',
        thinking
      })
      return reply(conversationId, true)
    }

    // 全是只读工具：先记录 assistant 的工具调用，再逐个执行喂回
    appendMessage({ conversationId, role: 'assistant', content: '', toolCalls: calls, status: 'executed', thinking })
    for (const call of calls) {
      const tool = findTool(call.name)
      const output = await executeToolSafely(tool, call, ctx)
      appendMessage({ conversationId, role: 'tool', content: output, toolCallId: call.id })
    }
  }

  appendMessage({
    conversationId,
    role: 'assistant',
    content: '（已达到工具调用上限，请换个说法或拆分请求）'
  })
  return reply(conversationId, false)
}

async function executeToolSafely(tool: AgentTool | undefined, call: AgentToolCall, ctx: ToolContext): Promise<string> {
  if (!tool) return JSON.stringify({ error: `未知工具：${call.name}` })
  try {
    const parsed = tool.schema.parse(call.arguments ?? {})
    const output = await tool.execute(parsed, ctx)
    return JSON.stringify(output ?? { ok: true })
  } catch (error) {
    // zod 校验失败或执行异常：把可读错误喂回模型而不是崩溃
    return JSON.stringify({ error: error instanceof Error ? error.message : String(error) })
  }
}

/**
 * 解析要操作的对话 id。global scope 若传入了合法的 conversationId 则用它（多对话，需求7），
 * 否则回退到“最近一条或新建”。task scope 始终按 taskId 定位（每任务一条）。
 */
function resolveConversationId(
  scope: AgentScope,
  taskId: string | null,
  conversationId?: string | null
): string {
  if (scope === 'global' && conversationId && isGlobalConversation(conversationId)) {
    return conversationId
  }
  return getOrCreateConversation(scope, taskId)
}

export async function sendMessage(input: SendMessageInput): Promise<AgentReply> {
  const conversationId = resolveConversationId(input.scope, input.taskId ?? null, input.conversationId)
  appendMessage({ conversationId, role: 'user', content: input.text })
  return runLoop(conversationId, input.scope, { taskId: input.taskId ?? null })
}

export async function confirmToolCall(input: ConfirmToolCallInput): Promise<AgentReply> {
  const conversationId = resolveConversationId(input.scope, input.taskId ?? null, input.conversationId)
  const pending = getMessage(input.messageId)
  if (!pending || !pending.toolCalls) {
    return reply(conversationId, false)
  }
  const ctx: ToolContext = { taskId: input.taskId ?? null }

  if (!input.approved) {
    updateMessageStatus(pending.id, 'cancelled')
    // 把"用户已拒绝"作为 tool_result 喂回，让模型据此调整
    for (const call of pending.toolCalls) {
      appendMessage({
        conversationId,
        role: 'tool',
        content: JSON.stringify({ cancelled: true, reason: '用户拒绝执行该操作' }),
        toolCallId: call.id
      })
    }
    return runLoop(conversationId, input.scope, ctx)
  }

  // 确认：应用用户编辑（若有），执行全部工具调用并把结果喂回
  updateMessageStatus(pending.id, 'confirmed')
  const edited = input.editedToolCalls ?? {}
  // 用户改过参数则以编辑版为准；并持久化回 pending 消息，让 UI 展示实际执行的内容
  const finalCalls = pending.toolCalls.map((call) =>
    Object.prototype.hasOwnProperty.call(edited, call.id) ? { ...call, arguments: edited[call.id] } : call
  )
  const hasEdits = pending.toolCalls.some((c) => Object.prototype.hasOwnProperty.call(edited, c.id))
  if (hasEdits) {
    updateMessageToolCalls(pending.id, finalCalls)
  }
  for (const call of finalCalls) {
    const tool = findTool(call.name)
    const output = await executeToolSafely(tool, call, ctx)
    appendMessage({ conversationId, role: 'tool', content: output, toolCallId: call.id })
  }
  updateMessageStatus(pending.id, 'executed')
  return runLoop(conversationId, input.scope, ctx)
}

export function getMessages(
  scope: AgentScope,
  taskId?: string | null,
  conversationId?: string | null
): AgentMessage[] {
  const resolved = resolveConversationId(scope, taskId ?? null, conversationId)
  return toUIMessages(listMessages(resolved))
}
