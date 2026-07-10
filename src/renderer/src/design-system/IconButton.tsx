import { forwardRef } from 'react'
import styles from './controls.module.css'

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md'
  danger?: boolean
}

/** 纯图标按钮（用于卡片操作、窗控等）。children 传 lucide 图标。 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { size = 'md', danger = false, className, children, type = 'button', ...rest },
  ref
) {
  const classNames = [styles.iconBtn, size === 'sm' && styles.sm, danger && styles.danger, className]
    .filter(Boolean)
    .join(' ')
  return (
    <button ref={ref} type={type} className={classNames} {...rest}>
      {children}
    </button>
  )
})
