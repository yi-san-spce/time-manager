import { forwardRef } from 'react'
import styles from './GlassSurface.module.css'

export interface GlassSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  radius?: 'sm' | 'md' | 'lg'
  distort?: boolean
  /** 更实的玻璃底色（用于弹层/侧边栏等需要更强可读性的容器） */
  strong?: boolean
  /** 可交互：hover 上浮 + 扫光划过（卡片、可点面板） */
  interactive?: boolean
}

export const GlassSurface = forwardRef<HTMLDivElement, GlassSurfaceProps>(function GlassSurface(
  { radius = 'md', distort = false, strong = false, interactive = false, className, children, ...rest },
  ref
) {
  const classNames = [
    styles.surface,
    styles[`radius-${radius}`],
    distort && styles.distort,
    strong && styles.strong,
    interactive && styles.interactive,
    className
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div ref={ref} className={classNames} {...rest}>
      {children}
    </div>
  )
})
