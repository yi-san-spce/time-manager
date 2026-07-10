import { useEffect } from 'react'
import { X } from 'lucide-react'
import { GlassSurface } from './GlassSurface'
import { IconButton } from './IconButton'
import styles from './overlay.module.css'

export interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  children: React.ReactNode
  /** 头部右侧额外操作区（标题栏与关闭按钮之间） */
  headerExtra?: React.ReactNode
}

/** 右侧滑出的毛玻璃抽屉，承载详情/编辑表单。Esc 关闭，点遮罩关闭。 */
export function Drawer({ open, onClose, title, children, headerExtra }: DrawerProps): React.JSX.Element | null {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <GlassSurface strong className={styles.drawer} role="dialog" aria-modal="true">
        <div className={styles.header}>
          {typeof title === 'string' ? <h2 className={styles.title}>{title}</h2> : title}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {headerExtra}
            <IconButton onClick={onClose} aria-label="关闭">
              <X size={18} />
            </IconButton>
          </div>
        </div>
        <div className={styles.body}>{children}</div>
      </GlassSurface>
    </>
  )
}
