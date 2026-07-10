import { randomUUID } from 'crypto'
import { getDb } from '../connection'
import type {
  AgentConversation,
  AgentMessage,
  AgentMessageRole,
  AgentMessageStatus,
  AgentScope,
  AgentToolCall
} from '@shared/types/models'

interface ConversationRow {
  id: string
  scope: string
  task_id: string | null
  title: string | null
  created_at: number
  updated_at: number
}

interface MessageRow {
  id: string
  conversation_id: string
  role: string
  content: string
  tool_calls: string | null
  tool_call_id: string | null
  status: string | null
  thinking: string | null
  created_at: number
}

/** 内部完整消息（含 tool_call_id，用于重建 ChatInput）。 */
export interface StoredMessage {
  id: string
  conversationId: string
  role: AgentMessageRole
  content: string
  toolCalls: { id: string; name: string; arguments: unknown; write: boolean }[] | null
  toolCallId: string | null
  status: AgentMessageStatus | null
  /** AI 思考摘要（需求11）；仅 assistant 消息可能有，可空。 */
  thinking: string | null
  createdAt: number
}

function mapMessage(row: MessageRow): StoredMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role as AgentMessageRole,
    content: row.content,
    toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : null,
    toolCallId: row.tool_call_id,
    status: (row.status as AgentMessageStatus | null) ?? null,
    thinking: row.thinking ?? null,
    createdAt: row.created_at
  }
}

/** 取得（或创建）某 scope 的对话。task scope 每个任务一条；global 复用最近一条或新建。 */
export function getOrCreateConversation(scope: AgentScope, taskId: string | null): string {
  const db = getDb()
  let row: ConversationRow | undefined
  if (scope === 'task') {
    row = db.prepare('SELECT * FROM agent_conversation WHERE scope = ? AND task_id = ?').get(scope, taskId) as
      | ConversationRow
      | undefined
  } else {
    row = db
      .prepare("SELECT * FROM agent_conversation WHERE scope = 'global' ORDER BY updated_at DESC LIMIT 1")
      .get() as ConversationRow | undefined
  }
  if (row) return row.id

  const id = randomUUID()
  const now = Date.now()
  db.prepare(
    'INSERT INTO agent_conversation (id, scope, task_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, scope, scope === 'task' ? taskId : null, null, now, now)
  return id
}

/** 显式新建一条 global 对话，返回其 id（助手页“新对话”按钮，需求7）。 */
export function createGlobalConversation(): string {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  db.prepare(
    'INSERT INTO agent_conversation (id, scope, task_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, 'global', null, null, now, now)
  return id
}

/** 列出全部 global 对话（历史侧栏用），最近活跃在前，附首条用户消息预览与消息数。 */
export function listGlobalConversations(): AgentConversation[] {
  const rows = getDb()
    .prepare("SELECT * FROM agent_conversation WHERE scope = 'global' ORDER BY updated_at DESC")
    .all() as ConversationRow[]
  const previewStmt = getDb().prepare(
    "SELECT content FROM agent_message WHERE conversation_id = ? AND role = 'user' ORDER BY created_at ASC, rowid ASC LIMIT 1"
  )
  const countStmt = getDb().prepare(
    "SELECT COUNT(*) AS n FROM agent_message WHERE conversation_id = ? AND role != 'tool'"
  )
  return rows.map((row) => {
    const previewRow = previewStmt.get(row.id) as { content: string } | undefined
    const countRow = countStmt.get(row.id) as { n: number }
    const preview = previewRow?.content.replace(/\s+/g, ' ').trim().slice(0, 60) ?? null
    return {
      id: row.id,
      scope: 'global',
      taskId: null,
      title: row.title,
      preview: preview || null,
      messageCount: countRow.n,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  })
}

/** 删除整条对话（含其消息，靠外键级联或手动清理）。 */
export function deleteConversation(conversationId: string): void {
  const db = getDb()
  db.prepare('DELETE FROM agent_message WHERE conversation_id = ?').run(conversationId)
  db.prepare('DELETE FROM agent_conversation WHERE id = ?').run(conversationId)
}

/** 重命名对话标题（null 恢复为自动预览）。 */
export function renameConversation(conversationId: string, title: string | null): void {
  getDb().prepare('UPDATE agent_conversation SET title = ? WHERE id = ?').run(title, conversationId)
}

/** 校验某 conversationId 确实是一条 global 对话（渲染端传入的 id 需守卫）。 */
export function isGlobalConversation(conversationId: string): boolean {
  const row = getDb()
    .prepare("SELECT id FROM agent_conversation WHERE id = ? AND scope = 'global'")
    .get(conversationId) as { id: string } | undefined
  return !!row
}

export function listMessages(conversationId: string): StoredMessage[] {
  const rows = getDb()
    .prepare('SELECT * FROM agent_message WHERE conversation_id = ? ORDER BY created_at ASC, rowid ASC')
    .all(conversationId) as MessageRow[]
  return rows.map(mapMessage)
}

export function appendMessage(input: {
  conversationId: string
  role: AgentMessageRole
  content: string
  toolCalls?: AgentToolCall[] | null
  toolCallId?: string | null
  status?: AgentMessageStatus | null
  thinking?: string | null
}): StoredMessage {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  db.prepare(
    `INSERT INTO agent_message (id, conversation_id, role, content, tool_calls, tool_call_id, status, thinking, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.conversationId,
    input.role,
    input.content,
    input.toolCalls ? JSON.stringify(input.toolCalls) : null,
    input.toolCallId ?? null,
    input.status ?? null,
    input.thinking ?? null,
    now
  )
  db.prepare('UPDATE agent_conversation SET updated_at = ? WHERE id = ?').run(now, input.conversationId)
  return mapMessage(
    db.prepare('SELECT * FROM agent_message WHERE id = ?').get(id) as MessageRow
  )
}

export function updateMessageStatus(id: string, status: AgentMessageStatus): void {
  getDb().prepare('UPDATE agent_message SET status = ? WHERE id = ?').run(status, id)
}

/** 覆盖某消息的工具调用（需求11：用户确认前编辑了 AI 拟的参数）。 */
export function updateMessageToolCalls(id: string, toolCalls: AgentToolCall[]): void {
  getDb()
    .prepare('UPDATE agent_message SET tool_calls = ? WHERE id = ?')
    .run(JSON.stringify(toolCalls), id)
}

export function getMessage(id: string): StoredMessage | null {
  const row = getDb().prepare('SELECT * FROM agent_message WHERE id = ?').get(id) as MessageRow | undefined
  return row ? mapMessage(row) : null
}

export function clearConversation(conversationId: string): void {
  getDb().prepare('DELETE FROM agent_message WHERE conversation_id = ?').run(conversationId)
}

/** 映射为 UI 消息：过滤掉 tool 角色（工具结果不直接展示），assistant 的工具调用保留。 */
export function toUIMessages(messages: StoredMessage[]): AgentMessage[] {
  return messages
    .filter((m) => m.role !== 'tool')
    .map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      toolCalls: m.toolCalls,
      status: m.status,
      thinking: m.thinking,
      createdAt: m.createdAt
    }))
}
