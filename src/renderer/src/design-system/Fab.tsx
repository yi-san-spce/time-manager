import { forwardRef } from 'react'
import styles from './misc.module.css'

export interface FabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode
  label?: string
}

/** 右下角悬浮玻璃按钮（Floating Action Button），用于「创建」主操作。 */
export const Fab = forwardRef<HTMLButtonElement, FabProps>(function Fab(
  { icon, label, className, type = 'button', ...rest },
  ref
) {
  return (
    <button ref={ref} type={type} className={[styles.fab, className].filter(Boolean).join(' ')} {...rest}>
      {icon}
      {label && <span>{label}</span>}
    </button>
  )
})
