import { useEffect, useMemo, useRef, useState } from 'react'
import { Send, Wrench, CheckCircle2, XCircle, Brain, Pencil } from 'lucide-react'
import { IconButton, Button } from '../../design-system'
import { renderMarkdown } from '../../design-system/markdown'
import type { AgentMessage, AgentScope } from '@shared/types/models'
import { useAgent } from './useAgent'
import styles from './ChatPanel.module.css'

export interface ChatPanelProps {
  scope: AgentScope
  taskId?: string | null
  /** global 多对话：当前激活的对话 id（需求7）；task scope 忽略。 */
  conversationId?: string | null
  placeholder?: string
  emptyHint?: string
  /** send/confirm 后回调服务端解析出的对话 id（供侧栏采纳新对话并刷新）。 */
  onActivity?: (resolvedConversationId: string) => void
}

/** 共用聊天面板：消息流 + 工具/确认卡 + 自适应输入。全局助手页与任务详情内嵌复用。 */
export function ChatPanel({
  scope,
  taskId,
  conversationId,
  placeholder,
  emptyHint,
  onActivity
}: ChatPanelProps): React.JSX.Element {
  const { messages, loading, error, send, confirm } = useAgent(scope, taskId, conversationId, { onActivity })
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  function autoGrow(): void {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }

  function handleSend(): void {
    const text = draft.trim()
    if (!text || loading) return
    setDraft('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    void send(text)
  }

  return (
    <div className={styles.panel}>
      <div className={styles.messages} ref={listRef}>
        {messages.length === 0 && !loading && (
          <div className={styles.empty}>{emptyHint ?? '开始和 AI 对话吧。所有写操作都会先请你确认。'}</div>
        )}
        {messages.map((msg) => (
          <MessageView key={msg.id} msg={msg} onConfirm={confirm} loading={loading} />
        ))}
        {loading && (
          <div className={styles.rowAssistant + ' ' + styles.row}>
            <div className={styles.loadingDots}>
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </div>

      {error && <div className={styles.errorText}>{error}</div>}

      <div className={styles.inputBar}>
        <textarea
          ref={inputRef}
          className={styles.input}
          value={draft}
          rows={1}
          placeholder={placeholder ?? '输入消息…（Enter 发送，Shift+Enter 换行）'}
          onChange={(e) => {
            setDraft(e.target.value)
            autoGrow()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
        />
        <IconButton onClick={handleSend} disabled={loading || !draft.trim()} aria-label="发送">
          <Send size={18} />
        </IconButton>
      </div>
    </div>
  )
}

function MessageView({
  msg,
  onConfirm,
  loading
}: {
  msg: AgentMessage
  onConfirm: (id: string, approved: boolean, editedToolCalls?: Record<string, unknown>) => void
  loading: boolean
}): React.JSX.Element | null {
  // 带工具调用的 assistant 消息 → 工具/确认卡
  if (msg.toolCalls && msg.toolCalls.length > 0) {
    return <ToolCard msg={msg} onConfirm={onConfirm} loading={loading} />
  }

  // 纯文本消息
  if (!msg.content && !msg.thinking) return null
  const isUser = msg.role === 'user'
  if (isUser) {
    return (
      <div className={`${styles.row} ${styles.rowUser}`}>
        <div className={`${styles.bubble} ${styles.bubbleUser}`}>{msg.content}</div>
      </div>
    )
  }
  return (
    <div className={`${styles.row} ${styles.rowAssistant} ${styles.colStack}`}>
      <ThinkingBlock thinking={msg.thinking} />
      {msg.content && <AssistantBubble content={msg.content} />}
    </div>
  )
}

/** 工具/确认卡。pending 且含 propose_subtasks 时，允许用户先编辑步骤再确认（需求11）。 */
function ToolCard({
  msg,
  onConfirm,
  loading
}: {
  msg: AgentMessage
  onConfirm: (id: string, approved: boolean, editedToolCalls?: Record<string, unknown>) => void
  loading: boolean
}): React.JSX.Element {
  const pending = msg.status === 'pending'
  const proposeCall = msg.toolCalls?.find((c) => c.name === 'propose_subtasks')
  const initialSteps = useMemo(() => {
    const args = proposeCall?.arguments as { subtasks?: unknown } | null
    return Array.isArray(args?.subtasks) ? (args!.subtasks as string[]) : null
  }, [proposeCall])
  const [editing, setEditing] = useState(false)
  const [draftSteps, setDraftSteps] = useState('')

  function beginEdit(): void {
    setDraftSteps((initialSteps ?? []).join('\n'))
    setEditing(true)
  }

  function confirmWithEdits(): void {
    if (editing && proposeCall && initialSteps) {
      const steps = draftSteps
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
      // 仅当用户实际改动了步骤才传编辑版
      const changed = steps.length !== initialSteps.length || steps.some((s, i) => s !== initialSteps[i])
      if (changed) {
        const edited = { ...(proposeCall.arguments as Record<string, unknown>), subtasks: steps }
        onConfirm(msg.id, true, { [proposeCall.id]: edited })
        return
      }
    }
    onConfirm(msg.id, true)
  }

  return (
    <div className={`${styles.row} ${styles.rowAssistant} ${styles.colStack}`}>
      <ThinkingBlock thinking={msg.thinking} />
      <div className={styles.toolCard}>
        {msg.toolCalls!.map((call) => (
          <div key={call.id}>
            <div className={styles.toolHead}>
              <Wrench size={15} />
              <span>{call.write ? 'AI 想执行操作' : 'AI 正在查询'}</span>
              <span className={styles.toolName}>{call.name}</span>
            </div>
            {editing && call.id === proposeCall?.id ? (
              <textarea
                className={styles.editArea}
                value={draftSteps}
                rows={Math.max(3, (initialSteps?.length ?? 3) + 1)}
                onChange={(e) => setDraftSteps(e.target.value)}
                placeholder="每行一个步骤"
              />
            ) : (
              <div className={styles.toolSummary}>{summarizeCall(call)}</div>
            )}
          </div>
        ))}

        {pending && (
          <div className={styles.confirmActions}>
            <Button
              size="sm"
              variant="primary"
              icon={<CheckCircle2 size={15} />}
              onClick={confirmWithEdits}
              disabled={loading}
            >
              确认执行
            </Button>
            {initialSteps && !editing && (
              <Button size="sm" variant="secondary" icon={<Pencil size={15} />} onClick={beginEdit} disabled={loading}>
                编辑
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => onConfirm(msg.id, false)} disabled={loading}>
              取消
            </Button>
          </div>
        )}
          {msg.status === 'executed' && (
            <div className={`${styles.statusLine} ${styles.statusExecuted}`}>
              <CheckCircle2 size={14} /> 已执行
            </div>
          )}
          {msg.status === 'cancelled' && (
            <div className={`${styles.statusLine} ${styles.statusCancelled}`}>
              <XCircle size={14} /> 已取消
            </div>
          )}
        </div>
      </div>
    )
  }

/** 可折叠"已思考"块（DeepSeek 风，需求11）：默认折叠，点开看 AI 思考摘要。 */
function ThinkingBlock({ thinking }: { thinking: string | null }): React.JSX.Element | null {
  if (!thinking) return null
  return (
    <details className={styles.thinking}>
      <summary className={styles.thinkingSummary}>
        <Brain size={14} /> 已思考
      </summary>
      <div className={styles.thinkingBody}>{thinking}</div>
    </details>
  )
}

/** 助手气泡：把 Markdown 渲染成 HTML（复用报告/活动详情同一套 renderMarkdown）。 */
function AssistantBubble({ content }: { content: string }): React.JSX.Element {
  const html = useMemo(() => renderMarkdown(content), [content])
  return (
    <div
      className={`${styles.bubble} ${styles.bubbleAssistant} ${styles.markdownBubble}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function summarizeCall(call: { name: string; arguments: unknown }): string {
  const args = call.arguments as Record<string, unknown> | null
  if (call.name === 'propose_subtasks' && args && Array.isArray(args.subtasks)) {
    return (args.subtasks as string[]).map((s, i) => `${i + 1}. ${s}`).join('\n')
  }
  if (args && typeof args === 'object' && Object.keys(args).length > 0) {
    // 简洁展示关键参数
    const entries = Object.entries(args)
      .filter(([k]) => k !== 'taskId')
      .map(([k, v]) => `${k}: ${formatVal(v)}`)
    return entries.join('\n') || '（无参数）'
  }
  return '（无参数）'
}

function formatVal(v: unknown): string {
  if (typeof v === 'number' && v > 1e12) return new Date(v).toLocaleString()
  if (Array.isArray(v)) return v.join('、')
  return String(v)
}
