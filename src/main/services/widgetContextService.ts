import type { Schedule, ScheduleOccurrence, ScheduleStatus } from '@shared/types/models'
import type { WidgetContext, WidgetSchedule } from '@shared/types/ipc'
import { listSchedules } from '../db/repositories/scheduleRepo'
import { listTasks } from '../db/repositories/taskRepo'
import { expandAllRecurringSchedules } from '../ipc/recurrenceHandlers'

function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function overlaps(startTime: number, endTime: number, rangeStart: number, rangeEnd: number): boolean {
  return startTime < rangeEnd && endTime > rangeStart
}

function isFocusableSchedule(status: ScheduleStatus): boolean {
  return status === 'planned'
}

function toWidgetSchedule(schedule: Schedule, startTime = schedule.startTime, endTime = schedule.endTime, status = schedule.status): WidgetSchedule {
  return {
    id: schedule.id,
    title: schedule.title,
    startTime,
    endTime,
    status
  }
}

function occurrenceStatus(occurrence: ScheduleOccurrence): ScheduleStatus {
  return occurrence.exceptionAction === 'completed' ? 'completed' : occurrence.schedule.status
}

/**
 * Returns the local-day calendar occurrence list plus every task that can still be focused.
 * Recurrence instances retain their parent schedule ID because the rest of the data model links
 * work to a schedule, not to a separately persisted occurrence.
 */
export function getWidgetContext(now = Date.now()): WidgetContext {
  const dayStart = startOfLocalDay(now)
  const dayEnd = new Date(dayStart).setDate(new Date(dayStart).getDate() + 1)
  const schedules = listSchedules()
  const todaySchedules: WidgetSchedule[] = []

  for (const schedule of schedules) {
    if (
      !schedule.recurrenceRuleId &&
      isFocusableSchedule(schedule.status) &&
      overlaps(schedule.startTime, schedule.endTime, dayStart, dayEnd)
    ) {
      todaySchedules.push(toWidgetSchedule(schedule))
    }
  }

  // Expand far enough backwards to retain a recurring event that began before midnight but
  // overlaps the selected day. This also avoids treating the recurring parent row as an instance.
  const longestRecurringDuration = schedules
    .filter((schedule) => schedule.recurrenceRuleId)
    .reduce((longest, schedule) => Math.max(longest, schedule.endTime - schedule.startTime), 0)
  const recurringRangeStart = dayStart - Math.max(0, longestRecurringDuration)

  for (const occurrence of expandAllRecurringSchedules(recurringRangeStart, dayEnd)) {
    const status = occurrenceStatus(occurrence)
    if (
      occurrence.exceptionAction === 'skipped' ||
      !isFocusableSchedule(status) ||
      !overlaps(occurrence.occurrenceStart, occurrence.occurrenceEnd, dayStart, dayEnd)
    ) {
      continue
    }
    todaySchedules.push(
      toWidgetSchedule(occurrence.schedule, occurrence.occurrenceStart, occurrence.occurrenceEnd, status)
    )
  }

  todaySchedules.sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime || a.title.localeCompare(b.title))

  const currentSchedule =
    todaySchedules
      .filter((schedule) => schedule.status === 'planned' && schedule.startTime <= now && now < schedule.endTime)
      .sort((a, b) => a.endTime - b.endTime || a.startTime - b.startTime)[0] ?? null

  const focusableTasks = listTasks()
    .filter((task) => task.status !== 'done' && task.status !== 'cancelled')
    .map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      scheduleId: task.scheduleId
    }))

  return { currentSchedule, todaySchedules, focusableTasks }
}
