import { forwardRef } from 'react'
import styles from './controls.module.css'

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={[styles.control, styles.textarea, className].filter(Boolean).join(' ')}
        {...rest}
      />
    )
  }
)
