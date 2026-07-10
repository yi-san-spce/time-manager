import { useCallback, useEffect, useMemo, useState } from 'react'
import { MessageSquarePlus, Trash2, MessagesSquare, PictureInPicture2 } from 'lucide-react'
import type { AgentConversation } from '@shared/types/models'
import { GlassSurface, IconButton } from '../../design-system'
import { PageHeader } from '../../shell/PageHeader'
import { ChatPanel } from './ChatPanel'
import styles from './AssistantPage.module.css'

/** 全局 AI 助手页：左侧对话历史侧栏 + 右侧聊天面板（DeepSeek 风，需求7）。 */
export function AssistantPage(): React.JSX.Element {
  const [conversations, setConversations] = useState<AgentConversation[]>([])
  // null 表示“新对话（尚未落库）”：首条消息发出后由服务端解析出真实 id 再采纳
  const [activeId, setActiveId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const list = await window.api.agent.listConversations()
    setConversations(list)
    return list
  }, [])

  useEffect(() => {
    void refresh().then((list) => {
      // 首次进入：选中最近一条；没有则停留在“新对话”
      setActiveId((cur) => cur ?? list[0]?.id ?? null)
    })
  }, [refresh])

  // send/confirm 后服务端回传实际对话 id：采纳它（新对话首次发消息的情形）并刷新侧栏
  const handleActivity = useCallback(
    (resolvedId: string) => {
      setActiveId((cur) => cur ?? resolvedId)
      void refresh()
    },
    [refresh]
  )

  function startNew(): void {
    setActiveId(null)
  }

  function selectConversation(id: string): void {
    setActiveId(id)
  }

  async function deleteConversation(id: string, e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    await window.api.agent.deleteConversation(id)
    const list = await refresh()
    if (activeId === id) setActiveId(list[0]?.id ?? null)
  }

  // ChatPanel 的 key：新对话用固定串，切换/采纳后用真实 id，确保切换时干净重挂载
  const panelKey = activeId ?? 'new-conversation'

  const emptyHint = useMemo(
    () =>
      '试试：“帮我建一个明天上午10点的会议”、“这周我在各分类上花了多久”、“把某任务拆成步骤”。所有写操作都会先请你确认。',
    []
  )

  return (
    <section className={styles.page}>
      <PageHeader
        title="AI 助手"
        subtitle="用自然语言规划日程、拆解任务、查询统计"
        actions={
          <IconButton aria-label="悬浮助手小窗" onClick={() => void window.api.floatingAssistant.open()}>
            <PictureInPicture2 size={18} />
          </IconButton>
        }
      />
      <div className={styles.body}>
        <GlassSurface radius="lg" className={styles.sidebar}>
          <button className={styles.newBtn} onClick={startNew}>
            <MessageSquarePlus size={16} />
            新对话
          </button>
          <div className={styles.list}>
            {conversations.length === 0 && <div className={styles.listEmpty}>还没有对话</div>}
            {conversations.map((c) => (
              <div
                key={c.id}
                className={`${styles.item} ${c.id === activeId ? styles.itemActive : ''}`}
                onClick={() => selectConversation(c.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    selectConversation(c.id)
                  }
                }}
              >
                <MessagesSquare size={15} className={styles.itemIcon} />
                <span className={styles.itemText}>{c.title ?? c.preview ?? '新对话'}</span>
                <IconButton
                  size="sm"
                  danger
                  aria-label="删除对话"
                  className={styles.itemDel}
                  onClick={(e) => void deleteConversation(c.id, e)}
                >
                  <Trash2 size={14} />
                </IconButton>
              </div>
            ))}
          </div>
        </GlassSurface>

        <GlassSurface radius="lg" className={styles.chat}>
          <ChatPanel
            key={panelKey}
            scope="global"
            conversationId={activeId}
            emptyHint={emptyHint}
            onActivity={handleActivity}
          />
        </GlassSurface>
      </div>
    </section>
  )
}
