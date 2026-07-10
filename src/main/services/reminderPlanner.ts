import type { Schedule, ScheduleOccurrence } from '@shared/types/models'

/** 一条待触发的提醒（母版单次或重复展开的某次发生）。 */
export interface PlannedReminder {
  scheduleId: string
  title: string
  /** 日程（或该次发生）的开始时间戳（毫秒） */
  startTime: number
  /** 提醒应触发的时间戳（毫秒）= startTime - reminderMinutesBefore*60000 */
  fireAt: number
}

/** 已完成/已跳过/已取消的日程不再提醒。 */
function isActiveStatus(status: Schedule['status']): boolean {
  return status === 'planned'
}

/**
 * 计算所有"未来"应触发的提醒并按 fireAt 升序排列。纯函数，便于单测。
 *
 * - `nonRecurringSchedules`：非重复日程（recurrenceRuleId === null），用自身 start_time 计算。
 * - `occurrences`：重复日程按区间展开后的具体发生实例；带 exceptionAction 的（单次已完成/跳过）会被排除。
 * - 只保留 reminderMinutesBefore 非空、状态为 planned、且 fireAt 严格大于 now 的提醒。
 */
export function computeReminders(
  nonRecurringSchedules: Schedule[],
  occurrences: ScheduleOccurrence[],
  now: number
): PlannedReminder[] {
  const reminders: PlannedReminder[] = []

  for (const schedule of nonRecurringSchedules) {
    if (schedule.reminderMinutesBefore == null || !isActiveStatus(schedule.status)) continue
    const fireAt = schedule.startTime - schedule.reminderMinutesBefore * 60_000
    if (fireAt > now) {
      reminders.push({ scheduleId: schedule.id, title: schedule.title, startTime: schedule.startTime, fireAt })
    }
  }

  for (const occ of occurrences) {
    const { schedule } = occ
    if (schedule.reminderMinutesBefore == null || !isActiveStatus(schedule.status)) continue
    // 该次发生被单独标记为完成/跳过 → 不提醒
    if (occ.exceptionAction !== null) continue
    const fireAt = occ.occurrenceStart - schedule.reminderMinutesBefore * 60_000
    if (fireAt > now) {
      reminders.push({
        scheduleId: schedule.id,
        title: schedule.title,
        startTime: occ.occurrenceStart,
        fireAt
      })
    }
  }

  return reminders.sort((a, b) => a.fireAt - b.fireAt)
}

/** 取最近一条待触发的提醒（computeReminders 已排序，即首元素），无则返回 null。 */
export function nextReminder(reminders: PlannedReminder[]): PlannedReminder | null {
  return reminders.length > 0 ? reminders[0] : null
}
