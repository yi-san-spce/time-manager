import { randomUUID } from 'crypto'
import { getDb } from '../connection'
import type { RecurrenceFreq, RecurrenceRule, ScheduleException, ScheduleExceptionAction } from '@shared/types/models'

interface RecurrenceRuleRow {
  id: string
  freq: string
  interval: number
  by_weekday: string | null
  until_date: number | null
  count: number | null
}

function mapRuleRow(row: RecurrenceRuleRow): RecurrenceRule {
  return {
    id: row.id,
    freq: row.freq as RecurrenceFreq,
    interval: row.interval,
    byWeekday: row.by_weekday ? (JSON.parse(row.by_weekday) as number[]) : null,
    untilDate: row.until_date,
    count: row.count
  }
}

export function getRecurrenceRule(id: string): RecurrenceRule | null {
  const row = getDb().prepare('SELECT * FROM recurrence_rule WHERE id = ?').get(id) as
    | RecurrenceRuleRow
    | undefined
  return row ? mapRuleRow(row) : null
}

export function createRecurrenceRule(input: {
  freq: RecurrenceFreq
  interval?: number
  byWeekday?: number[] | null
  untilDate?: number | null
  count?: number | null
}): RecurrenceRule {
  const db = getDb()
  const id = randomUUID()

  db.prepare(
    `INSERT INTO recurrence_rule (id, freq, interval, by_weekday, until_date, count)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.freq,
    input.interval ?? 1,
    input.byWeekday ? JSON.stringify(input.byWeekday) : null,
    input.untilDate ?? null,
    input.count ?? null
  )

  return getRecurrenceRule(id) as RecurrenceRule
}

export function deleteRecurrenceRule(id: string): void {
  getDb().prepare('DELETE FROM recurrence_rule WHERE id = ?').run(id)
}

interface ScheduleExceptionRow {
  schedule_id: string
  occurrence_date: number
  action: string
}

function mapExceptionRow(row: ScheduleExceptionRow): ScheduleException {
  return {
    scheduleId: row.schedule_id,
    occurrenceDate: row.occurrence_date,
    action: row.action as ScheduleExceptionAction
  }
}

export function listExceptionsForSchedule(scheduleId: string): ScheduleException[] {
  const rows = getDb()
    .prepare('SELECT * FROM schedule_exception WHERE schedule_id = ?')
    .all(scheduleId) as ScheduleExceptionRow[]
  return rows.map(mapExceptionRow)
}

export function listExceptionsForSchedules(scheduleIds: string[]): ScheduleException[] {
  if (scheduleIds.length === 0) return []
  const placeholders = scheduleIds.map(() => '?').join(',')
  const rows = getDb()
    .prepare(`SELECT * FROM schedule_exception WHERE schedule_id IN (${placeholders})`)
    .all(...scheduleIds) as ScheduleExceptionRow[]
  return rows.map(mapExceptionRow)
}

export function setScheduleException(
  scheduleId: string,
  occurrenceDate: number,
  action: ScheduleExceptionAction
): void {
  getDb()
    .prepare(
      `INSERT INTO schedule_exception (schedule_id, occurrence_date, action) VALUES (?, ?, ?)
       ON CONFLICT(schedule_id, occurrence_date) DO UPDATE SET action = excluded.action`
    )
    .run(scheduleId, occurrenceDate, action)
}

export function clearScheduleException(scheduleId: string, occurrenceDate: number): void {
  getDb()
    .prepare('DELETE FROM schedule_exception WHERE schedule_id = ? AND occurrence_date = ?')
    .run(scheduleId, occurrenceDate)
}
