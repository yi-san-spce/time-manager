import type { Priority, TaskStatus } from '@shared/types/models'
import type { BadgeTone } from '../../design-system'

export const TASK_STATUS_META: Record<TaskStatus, { label: string; tone: BadgeTone; dot: string }> = {
  pending: { label: '待办', tone: 'neutral', dot: 'var(--color-text-muted)' },
  in_progress: { label: '进行中', tone: 'accent', dot: 'var(--color-accent)' },
  blocked: { label: '阻塞', tone: 'warning', dot: 'var(--color-warning)' },
  done: { label: '已完成', tone: 'success', dot: 'var(--color-success)' },
  cancelled: { label: '已取消', tone: 'danger', dot: 'var(--color-danger)' }
}

export const TASK_STATUS_ORDER: TaskStatus[] = ['pending', 'in_progress', 'blocked', 'done', 'cancelled']

export const PRIORITY_META: Record<Priority, { label: string; tone: BadgeTone }> = {
  1: { label: 'P1', tone: 'danger' },
  2: { label: 'P2', tone: 'warning' },
  3: { label: 'P3', tone: 'neutral' }
}

export function formatDueDate(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(ts)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '明天'
  if (diffDays === -1) return '昨天'
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export function isOverdue(ts: number | null, status: TaskStatus): boolean {
  if (ts === null || status === 'done' || status === 'cancelled') return false
  return ts < Date.now()
}
