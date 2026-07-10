import styles from './PageHeader.module.css'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

/** 统一页头：标题（+副标题）在左，操作区在右。 */
export function PageHeader({ title, subtitle, actions }: PageHeaderProps): React.JSX.Element {
  return (
    <header className={styles.header}>
      <div className={styles.titleGroup}>
        <h2 className={styles.title}>{title}</h2>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  )
}
