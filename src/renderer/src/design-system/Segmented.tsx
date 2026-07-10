import styles from './display.module.css'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: React.ReactNode
}

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

/** 段控：一组互斥选项，激活项品牌渐变高亮。用于视图/类型切换。 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className
}: SegmentedProps<T>): React.JSX.Element {
  return (
    <div className={[styles.segmented, className].filter(Boolean).join(' ')}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={[styles.segment, value === opt.value && styles.active].filter(Boolean).join(' ')}
          onClick={() => onChange(opt.value)}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  )
}
