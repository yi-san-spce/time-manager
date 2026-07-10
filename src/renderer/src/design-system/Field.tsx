import styles from './controls.module.css'

export interface FieldProps {
  label?: string
  error?: string
  children: React.ReactNode
  className?: string
}

/** 表单字段容器：标签 + 控件 + 错误提示的统一垂直布局 */
export function Field({ label, error, children, className }: FieldProps): React.JSX.Element {
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      {label && <label className={styles.label}>{label}</label>}
      {children}
      {error && <span className={styles.error}>{error}</span>}
    </div>
  )
}
