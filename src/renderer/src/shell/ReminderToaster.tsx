import { useEffect, useState } from 'react'
import { BellRing, X } from 'lucide-react'
import type { ReminderFirePayload } from '@shared/types/ipc'
import { GlassSurface, IconButton } from '../design-system'

interface ActiveReminder extends ReminderFirePayload {
  /** 用于 React key 与去重：同一日程可能重复提醒（重复日程的不同发生） */
  key: string
}

/** 提醒到点时主进程会弹系统通知，并推送 event:reminder:fire；这里在应用内也叠一个玻璃吐司条。 */
export function ReminderToaster(): React.JSX.Element {
  const [reminders, setReminders] = useState<ActiveReminder[]>([])

  useEffect(() => {
    return window.api.schedule.onReminderFire((reminder) => {
      const key = `${reminder.scheduleId}-${reminder.startTime}`
      setReminders((prev) => (prev.some((r) => r.key === key) ? prev : [...prev, { ...reminder, key }]))
      // 8 秒后自动消失
      setTimeout(() => {
        setReminders((prev) => prev.filter((r) => r.key !== key))
      }, 8000)
    })
  }, [])

  function dismiss(key: string): void {
    setReminders((prev) => prev.filter((r) => r.key !== key))
  }

  function startsInText(startTime: number): string {
    const minutes = Math.max(0, Math.round((startTime - Date.now()) / 60_000))
    return minutes > 0 ? `约 ${minutes} 分钟后开始` : '即将开始'
  }

  if (reminders.length === 0) return <></>

  return (
    <div
      style={{
        position: 'fixed',
        right: 'var(--space-5)',
        bottom: 'var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        zIndex: 1000,
        maxWidth: 360
      }}
    >
      {reminders.map((reminder) => (
        <GlassSurface
          key={reminder.key}
          radius="md"
          strong
          style={{
            padding: 'var(--space-4)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-3)',
            animation: 'slide-fade-in 0.25s var(--ease)'
          }}
        >
          <BellRing size={20} style={{ color: 'var(--stage-plan)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>日程提醒：{reminder.title}</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              {startsInText(reminder.startTime)}
            </div>
          </div>
          <IconButton aria-label="关闭提醒" onClick={() => dismiss(reminder.key)}>
            <X size={16} />
          </IconButton>
        </GlassSurface>
      ))}
    </div>
  )
}
