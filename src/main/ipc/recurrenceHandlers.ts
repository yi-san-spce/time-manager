import { ipcMain } from 'electron'
import { IPC } from '@shared/types/ipc'
import type { ScheduleOccurrence } from '@shared/types/models'
import { listRecurringSchedules } from '../db/repositories/scheduleRepo'
import {
  getRecurrenceRule,
  listExceptionsForSchedules,
  setScheduleException
} from '../db/repositories/recurrenceRepo'
import { expandSchedule } from '../services/recurrenceExpansion'
import { expandRecurrenceSchema, setScheduleExceptionSchema } from './schemas'
import { emitWidgetContextChanged } from '../services/widgetContextBus'

function expandAllRecurringSchedules(rangeStart: number, rangeEnd: number): ScheduleOccurrence[] {
  const recurringSchedules = listRecurringSchedules()
  if (recurringSchedules.length === 0) return []

  const exceptions = listExceptionsForSchedules(recurringSchedules.map((s) => s.id))
  const exceptionsBySchedule = new Map<string, typeof exceptions>()
  for (const exception of exceptions) {
    const list = exceptionsBySchedule.get(exception.scheduleId) ?? []
    list.push(exception)
    exceptionsBySchedule.set(exception.scheduleId, list)
  }

  const occurrences: ScheduleOccurrence[] = []
  for (const schedule of recurringSchedules) {
    const rule = schedule.recurrenceRuleId ? getRecurrenceRule(schedule.recurrenceRuleId) : null
    if (!rule) continue
    occurrences.push(
      ...expandSchedule(
        schedule,
        rule,
        exceptionsBySchedule.get(schedule.id) ?? [],
        rangeStart,
        rangeEnd
      )
    )
  }

  return occurrences.sort((a, b) => a.occurrenceStart - b.occurrenceStart)
}

export function registerRecurrenceHandlers(): void {
  ipcMain.handle(IPC.recurrenceExpand, (_event, input) => {
    const { rangeStart, rangeEnd } = expandRecurrenceSchema.parse(input)
    return expandAllRecurringSchedules(rangeStart, rangeEnd)
  })

  ipcMain.handle(IPC.recurrenceSetException, (_event, input) => {
    const parsed = setScheduleExceptionSchema.parse(input)
    setScheduleException(parsed.scheduleId, parsed.occurrenceDate, parsed.action)
    emitWidgetContextChanged()
  })
}

// 供 report/stats 等阶段直接复用（避免重复实现同一套展开逻辑）
export { expandAllRecurringSchedules }
