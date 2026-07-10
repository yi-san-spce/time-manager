import { useEffect } from 'react'
import { X } from 'lucide-react'
import { GlassSurface } from './GlassSurface'
import { IconButton } from './IconButton'
import styles from './overlay.module.css'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  children: React.ReactNode
}

/** 居中玻璃弹窗，用于确认/小型表单。Esc 关闭，点遮罩关闭。 */
export function Modal({ open, onClose, title, children }: ModalProps): React.JSX.Element | null {
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
      <div className={styles.modalWrap}>
        <GlassSurface strong radius="lg" className={styles.modal} role="dialog" aria-modal="true">
          {title && (
            <div className={styles.header}>
              {typeof title === 'string' ? <h2 className={styles.title}>{title}</h2> : title}
              <IconButton onClick={onClose} aria-label="关闭">
                <X size={18} />
              </IconButton>
            </div>
          )}
          <div className={styles.body}>{children}</div>
        </GlassSurface>
      </div>
    </>
  )
}
