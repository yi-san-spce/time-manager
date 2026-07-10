import type { WidgetContext } from '@shared/types/ipc'
import { listSchedules } from '../db/repositories/scheduleRepo'
import { listTasks } from '../db/repositories/taskRepo'
import { expandAllRecurringSchedules } from '../ipc/recurrenceHandlers'

/**
 * 计算“此刻”的悬浮窗上下文（需求6）：命中当前时间点的日程 + 其关联任务。
 * 单次（非重复）日程按 start/end 命中；重复日程展开今日窗口后取命中的一次。
 * 命中多个时取结束最早的（更贴近“正在进行、即将结束”的那件事）。
 */
export function getWidgetContext(now = Date.now()): WidgetContext {
  const hits: Array<{ id: string; title: string; startTime: number; endTime: number }> = []

  // 单次日程：直接按时间区间命中（排除重复母版，母版靠展开）
  for (const s of listSchedules()) {
    if (s.recurrenceRuleId) continue
    if (s.startTime <= now && now < s.endTime) {
      hits.push({ id: s.id, title: s.title, startTime: s.startTime, endTime: s.endTime })
    }
  }

  // 重复日程：展开今日范围，取命中当前时刻的发生实例（跳过被标记跳过的）
  const dayStart = now - 12 * 60 * 60 * 1000
  const dayEnd = now + 12 * 60 * 60 * 1000
  for (const occ of expandAllRecurringSchedules(dayStart, dayEnd)) {
    if (occ.exceptionAction === 'skipped') continue
    if (occ.occurrenceStart <= now && now < occ.occurrenceEnd) {
      hits.push({
        id: occ.schedule.id,
        title: occ.schedule.title,
        startTime: occ.occurrenceStart,
        endTime: occ.occurrenceEnd
      })
    }
  }

  if (hits.length === 0) return { schedule: null, tasks: [] }

  hits.sort((a, b) => a.endTime - b.endTime)
  const schedule = hits[0]

  const tasks = listTasks()
    .filter((t) => t.scheduleId === schedule.id)
    .map((t) => ({ id: t.id, title: t.title, status: t.status }))

  return { schedule, tasks }
}
