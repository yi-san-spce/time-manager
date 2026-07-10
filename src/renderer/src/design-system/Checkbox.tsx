import { Check } from 'lucide-react'
import styles from './controls.module.css'

export interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: React.ReactNode
  size?: 'sm' | 'md'
  disabled?: boolean
  className?: string
}

/** 自定义玻璃复选框，勾选时弹性缩放（cubic-bezier bounce）。 */
export function Checkbox({
  checked,
  onChange,
  label,
  size = 'md',
  disabled = false,
  className
}: CheckboxProps): React.JSX.Element {
  return (
    <label className={[styles.checkbox, className].filter(Boolean).join(' ')}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={[styles.box, size === 'sm' && styles.boxSm].filter(Boolean).join(' ')}>
        <Check size={size === 'sm' ? 11 : 14} strokeWidth={3} />
      </span>
      {label && <span className={styles.checkLabel}>{label}</span>}
    </label>
  )
}
