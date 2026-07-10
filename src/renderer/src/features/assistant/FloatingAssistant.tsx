import { Sparkles, X } from 'lucide-react'
import { IconButton } from '../../design-system'
import { ChatPanel } from './ChatPanel'
import styles from './FloatingAssistant.module.css'

/**
 * 悬浮 AI 助手小窗内容（需求7）：紧凑单栏聊天，复用 ChatPanel（global scope）。
 * 顶部为可拖拽标题条（-webkit-app-region: drag），右上角关闭。
 */
export function FloatingAssistant(): React.JSX.Element {
  return (
    <div className={styles.root}>
      <header className={styles.bar}>
        <div className={styles.title}>
          <Sparkles size={15} />
          <span>AI 助手</span>
        </div>
        <IconButton
          size="sm"
          aria-label="关闭"
          className={styles.close}
          onClick={() => void window.api.floatingAssistant.close()}
        >
          <X size={15} />
        </IconButton>
      </header>
      <div className={styles.chat}>
        <ChatPanel
          scope="global"
          placeholder="问点什么…（Enter 发送）"
          emptyHint="悬浮助手：随手记想法、建日程、查统计。写操作仍会请你确认。"
        />
      </div>
    </div>
  )
}
