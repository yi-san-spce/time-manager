import styles from './display.module.css'

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

export interface BadgeProps {
  tone?: BadgeTone
  children: React.ReactNode
  className?: string
}

export function Badge({ tone = 'neutral', children, className }: BadgeProps): React.JSX.Element {
  return (
    <span className={[styles.badge, styles[`badge-${tone}`], className].filter(Boolean).join(' ')}>
      {children}
    </span>
  )
}
