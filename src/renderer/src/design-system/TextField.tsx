import { forwardRef } from 'react'
import styles from './controls.module.css'

export const TextField = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function TextField({ className, ...rest }, ref) {
    return <input ref={ref} className={[styles.control, className].filter(Boolean).join(' ')} {...rest} />
  }
)
