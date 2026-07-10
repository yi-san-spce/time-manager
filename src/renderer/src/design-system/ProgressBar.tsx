import styles from './display.module.css'

export interface ProgressBarProps {
  value: number
  max?: number
  /** 显示 "3/5" 文本标签 */
  showLabel?: boolean
  className?: string
}

/** 进度条，可选带 "done/total" 标签。完成度 100% 时填充转为成功色。 */
export function ProgressBar({ value, max = 100, showLabel = false, className }: ProgressBarProps): React.JSX.Element {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  const complete = max > 0 && value >= max
  return (
    <div className={[styles.progressRow, className].filter(Boolean).join(' ')}>
      <div className={styles.progressTrack}>
        <div
          className={styles.progressFill}
          style={{
            width: `${pct}%`,
            ...(complete ? { background: 'var(--color-success)' } : {})
          }}
        />
      </div>
      {showLabel && (
        <span className={styles.progressLabel}>
          {value}/{max}
        </span>
      )}
    </div>
  )
}
