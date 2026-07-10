import { NavLink } from 'react-router-dom'
import {
  CalendarDays,
  Timer,
  ListChecks,
  BarChart3,
  FileText,
  Bot,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  PictureInPicture2,
  Clock
} from 'lucide-react'
import { PomodoroWidget } from '../features/timer/PomodoroWidget'
import styles from './MainLayout.module.css'

export interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: '日历', icon: <CalendarDays size={20} /> },
  { to: '/tracking', label: '追踪', icon: <Timer size={20} /> },
  { to: '/tasks', label: '任务', icon: <ListChecks size={20} /> },
  { to: '/stats', label: '统计', icon: <BarChart3 size={20} /> },
  { to: '/reports', label: '报告', icon: <FileText size={20} /> },
  { to: '/assistant', label: 'AI 助手', icon: <Bot size={20} /> },
  { to: '/settings', label: '设置', icon: <Settings size={20} /> }
]

export interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps): React.JSX.Element {
  return (
    <aside className={[styles.sidebar, collapsed && styles.collapsed].filter(Boolean).join(' ')}>
      <div className={styles.brand}>
        <span className={styles.brandLogo}>
          <Clock size={20} />
        </span>
        {!collapsed && <span className={styles.brandName}>时间管理器</span>}
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) => [styles.navItem, isActive && styles.active].filter(Boolean).join(' ')}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <button
        type="button"
        className={styles.navItem}
        onClick={() => void window.api.floatingWidget.open()}
        title={collapsed ? '打开悬浮窗' : undefined}
        style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', width: '100%' }}
      >
        <span className={styles.navIcon}>
          <PictureInPicture2 size={20} />
        </span>
        {!collapsed && <span className={styles.navLabel}>悬浮窗</span>}
      </button>

      <button className={styles.collapseBtn} onClick={onToggle} title={collapsed ? '展开侧边栏' : '收起侧边栏'}>
        {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        {!collapsed && <span>收起</span>}
      </button>

      <PomodoroWidget collapsed={collapsed} />
    </aside>
  )
}
