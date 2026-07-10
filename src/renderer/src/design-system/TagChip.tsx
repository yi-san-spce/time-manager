import { X } from 'lucide-react'
import styles from './display.module.css'

export interface TagChipProps {
  label: string
  color?: string | null
  onClick?: () => void
  onRemove?: () => void
  className?: string
}

/** 标签胶囊：可选颜色圆点、点击、删除按钮。 */
export function TagChip({ label, color, onClick, onRemove, className }: TagChipProps): React.JSX.Element {
  return (
    <span
      className={[styles.chip, onClick && styles.clickable, className].filter(Boolean).join(' ')}
      onClick={onClick}
    >
      {color && <span className={styles.chipDot} style={{ background: color }} />}
      {label}
      {onRemove && (
        <button
          type="button"
          className={styles.chipRemove}
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          aria-label="移除标签"
        >
          <X size={12} />
        </button>
      )}
    </span>
  )
}
