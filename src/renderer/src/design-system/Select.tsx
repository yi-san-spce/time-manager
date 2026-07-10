import { forwardRef } from 'react'
import styles from './controls.module.css'

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select ref={ref} className={[styles.control, styles.select, className].filter(Boolean).join(' ')} {...rest}>
        {children}
      </select>
    )
  }
)
