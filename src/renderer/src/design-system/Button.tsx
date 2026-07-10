import { forwardRef } from 'react'
import styles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  block?: boolean
  /** 左侧图标（lucide 组件） */
  icon?: React.ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', block = false, icon, className, children, type = 'button', ...rest },
  ref
) {
  const classNames = [styles.btn, styles[variant], styles[size], block && styles.block, className]
    .filter(Boolean)
    .join(' ')

  return (
    <button ref={ref} type={type} className={classNames} {...rest}>
      {icon}
      {children}
    </button>
  )
})
