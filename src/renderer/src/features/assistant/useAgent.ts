import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { AgentMessage, AgentScope } from '@shared/types/models'
import type { AgentReply } from '@shared/types/ipc'

export interface UseAgentResult {
  messages: AgentMessage[]
  loading: boolean
  error: string | null
  awaitingConfirmation: boolean
  send: (text: string) => Promise<void>
  confirm: (messageId: string, approved: boolean, editedToolCalls?: Record<string, unknown>) => Promise<void>
  clear: () => Promise<void>
}

export interface UseAgentOptions {
  /** 每次 send/confirm 后回调服务端解析出的对话 id（供多对话侧栏采纳/刷新，需求7）。 */
  onActivity?: (resolvedConversationId: string) => void
}

/**
 * 驱动一条 Agent 对话（global 或某任务）。发送/确认后刷新消息，
 * 并让相关 react-query 缓存失效（写操作可能改了任务/日程/报告）。
 */
export function useAgent(
  scope: AgentScope,
  taskId?: string | null,
  conversationId?: string | null,
  options?: UseAgentOptions
): UseAgentResult {
  const queryClient = useQueryClient()
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [awaitingConfirmation, setAwaiting] = useState(false)

  const scopeKey = `${scope}:${taskId ?? ''}:${conversationId ?? ''}`

  useEffect(() => {
    let active = true
    void window.api.agent.getMessages({ scope, taskId, conversationId }).then((msgs) => {
      if (active) setMessages(msgs)
    })
    return () => {
      active = false
    }
  }, [scopeKey])

  function invalidateAll(): void {
    void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    void queryClient.invalidateQueries({ queryKey: ['schedules'] })
    void queryClient.invalidateQueries({ queryKey: ['recurrence-expand'] })
    void queryClient.invalidateQueries({ queryKey: ['reports'] })
    if (taskId) void queryClient.invalidateQueries({ queryKey: ['task', taskId] })
  }

  const onActivityRef = useRef(options?.onActivity)
  onActivityRef.current = options?.onActivity

  const applyReply = useCallback((reply: AgentReply) => {
    setMessages(reply.messages)
    setAwaiting(reply.awaitingConfirmation)
    onActivityRef.current?.(reply.conversationId)
  }, [])

  const send = useCallback(
    async (text: string) => {
      setLoading(true)
      setError(null)
      try {
        const reply = await window.api.agent.sendMessage({ scope, taskId, conversationId, text })
        applyReply(reply)
        invalidateAll()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    },
    [scopeKey, applyReply]
  )

  const confirm = useCallback(
    async (messageId: string, approved: boolean, editedToolCalls?: Record<string, unknown>) => {
      setLoading(true)
      setError(null)
      try {
        const reply = await window.api.agent.confirmToolCall({
          scope,
          taskId,
          conversationId,
          messageId,
          approved,
          editedToolCalls
        })
        applyReply(reply)
        invalidateAll()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    },
    [scopeKey, applyReply]
  )

  const clear = useCallback(
    async () => {
      await window.api.agent.clearConversation({ scope, taskId, conversationId })
      setMessages([])
      setAwaiting(false)
    },
    [scopeKey]
  )

  return { messages, loading, error, awaitingConfirmation, send, confirm, clear }
}
