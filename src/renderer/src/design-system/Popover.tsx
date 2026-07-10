import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { GlassSurface } from './GlassSurface'
import styles from './misc.module.css'

export interface PopoverProps {
  open: boolean
  onClose: () => void
  /** 锚点元素：菜单相对它定位。传入触发器的 ref。 */
  anchorRef: React.RefObject<HTMLElement | null>
  children: React.ReactNode
  align?: 'left' | 'right'
  className?: string
}

interface Pos {
  top: number
  left: number
  width: number
}

/**
 * 玻璃弹出层。渲染到 document.body 的 portal 中并用 fixed 定位，
 * 从而脱离父级 backdrop-filter/isolation 造成的层叠上下文——否则菜单会被
 * 下方的卡片遮挡且无法点击（见 AI 供应商下拉反馈）。点击外部/Esc 关闭，滚动时跟随关闭。
 */
export function Popover({ open, onClose, anchorRef, children, align = 'left', className }: PopoverProps): React.JSX.Element | null {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<Pos | null>(null)

  useLayoutEffect(() => {
    if (!open) return
    const anchor = anchorRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    setPos({ top: rect.bottom + 6, left: rect.left, width: rect.width })
  }, [open, anchorRef])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      const target = e.target as Node
      if (menuRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    // 面板外的任意滚动都关闭菜单（fixed 定位不会自动跟随滚动）
    const onScroll = (e: Event): void => {
      if (menuRef.current?.contains(e.target as Node)) return
      onClose()
    }
    const id = setTimeout(() => {
      document.addEventListener('mousedown', onDown)
      window.addEventListener('scroll', onScroll, true)
    }, 0)
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, anchorRef])

  if (!open || !pos) return null

  const style: React.CSSProperties =
    align === 'right'
      ? { top: pos.top, right: Math.max(8, window.innerWidth - (pos.left + pos.width)) }
      : { top: pos.top, left: pos.left }

  return createPortal(
    <div ref={menuRef} className={styles.popoverWrap} style={style}>
      <GlassSurface
        strong
        radius="md"
        className={[styles.popover, className].filter(Boolean).join(' ')}
        style={{ background: 'var(--glass-menu-bg)' }}
      >
        {children}
      </GlassSurface>
    </div>,
    document.body
  )
}
