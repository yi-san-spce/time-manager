import { useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { Popover } from './Popover'
import styles from './SelectMenu.module.css'

export interface SelectOption<T extends string> {
  value: T
  label: string
}

export interface SelectMenuProps<T extends string> {
  options: SelectOption<T>[]
  value: T
  onChange: (value: T) => void
  placeholder?: string
  disabled?: boolean
  /** 菜单对齐方向（锚点在触发器） */
  align?: 'left' | 'right'
  className?: string
  style?: React.CSSProperties
}

/**
 * 自定义玻璃下拉选择。替代原生 <select>——原生 <option> 弹出层由操作系统渲染，
 * 在深色模式下会出现暗底暗字看不清的问题（见任务追踪页反馈）。这里用 Popover +
 * 真实 DOM 选项，完全走设计系统的玻璃样式，明暗两态都清晰。
 */
export function SelectMenu<T extends string>({
  options,
  value,
  onChange,
  placeholder = '请选择',
  disabled = false,
  align = 'left',
  className,
  style
}: SelectMenuProps<T>): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const selected = options.find((o) => o.value === value)

  return (
    <div className={[styles.wrap, className].filter(Boolean).join(' ')} style={style}>
      <button
        ref={triggerRef}
        type="button"
        className={[styles.trigger, open && styles.open].filter(Boolean).join(' ')}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={[styles.triggerLabel, !selected && styles.placeholder].filter(Boolean).join(' ')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} className={[styles.chevron, open && styles.flipped].filter(Boolean).join(' ')} />
      </button>

      <Popover open={open} onClose={() => setOpen(false)} anchorRef={triggerRef} align={align}>
        <div className={styles.menu}>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={[styles.option, opt.value === value && styles.selected].filter(Boolean).join(' ')}
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
            >
              <span>{opt.label}</span>
              {opt.value === value && <Check size={15} className={styles.check} />}
            </button>
          ))}
        </div>
      </Popover>
    </div>
  )
}
