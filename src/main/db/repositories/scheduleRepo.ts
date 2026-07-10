import { randomUUID } from 'crypto'
import { getDb } from '../connection'
import type { Priority, Schedule, ScheduleStatus } from '@shared/types/models'
import type { CreateScheduleInput, UpdateScheduleInput } from '@shared/types/ipc'
import { createRecurrenceRule } from './recurrenceRepo'

interface ScheduleRow {
  id: string
  title: string
  description: string | null
  category_id: string | null
  priority: number
  start_time: number
  end_time: number
  recurrence_rule_id: string | null
  reminder_minutes_before: number | null
  status: string
  created_at: number
  updated_at: number
}

function mapRow(row: ScheduleRow): Schedule {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    categoryId: row.category_id,
    priority: row.priority as Priority,
    startTime: row.start_time,
    endTime: row.end_time,
    recurrenceRuleId: row.recurrence_rule_id,
    reminderMinutesBefore: row.reminder_minutes_before,
    status: row.status as ScheduleStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function listSchedules(): Schedule[] {
  const rows = getDb().prepare('SELECT * FROM schedule ORDER BY start_time ASC').all() as ScheduleRow[]
  return rows.map(mapRow)
}

/** 只返回重复日程的母版（recurrence_rule_id 非空），用于日历视图按需展开。 */
export function listRecurringSchedules(): Schedule[] {
  const rows = getDb()
    .prepare('SELECT * FROM schedule WHERE recurrence_rule_id IS NOT NULL ORDER BY start_time ASC')
    .all() as ScheduleRow[]
  return rows.map(mapRow)
}

export function getSchedule(id: string): Schedule | null {
  const row = getDb().prepare('SELECT * FROM schedule WHERE id = ?').get(id) as ScheduleRow | undefined
  return row ? mapRow(row) : null
}

export function createSchedule(input: CreateScheduleInput): Schedule {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()

  const recurrenceRuleId = input.recurrence ? createRecurrenceRule(input.recurrence).id : null

  db.prepare(
    `INSERT INTO schedule
      (id, title, description, category_id, priority, start_time, end_time, recurrence_rule_id, reminder_minutes_before, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'planned', ?, ?)`
  ).run(
    id,
    input.title,
    input.description ?? null,
    input.categoryId ?? null,
    input.priority ?? 2,
    input.startTime,
    input.endTime,
    recurrenceRuleId,
    input.reminderMinutesBefore ?? null,
    now,
    now
  )

  return getSchedule(id) as Schedule
}

export function updateSchedule(input: UpdateScheduleInput): Schedule {
  const db = getDb()
  const existing = getSchedule(input.id)
  if (!existing) {
    throw new Error(`Schedule not found: ${input.id}`)
  }

  const next = {
    title: input.title ?? existing.title,
    description: input.description !== undefined ? input.description : existing.description,
    categoryId: input.categoryId !== undefined ? input.categoryId : existing.categoryId,
    priority: input.priority ?? existing.priority,
    startTime: input.startTime ?? existing.startTime,
    endTime: input.endTime ?? existing.endTime,
    reminderMinutesBefore:
      input.reminderMinutesBefore !== undefined ? input.reminderMinutesBefore : existing.reminderMinutesBefore,
    status: input.status ?? existing.status
  }

  db.prepare(
    `UPDATE schedule SET
      title = ?, description = ?, category_id = ?, priority = ?,
      start_time = ?, end_time = ?, reminder_minutes_before = ?, status = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    next.title,
    next.description,
    next.categoryId,
    next.priority,
    next.startTime,
    next.endTime,
    next.reminderMinutesBefore,
    next.status,
    Date.now(),
    input.id
  )

  return getSchedule(input.id) as Schedule
}

export function deleteSchedule(id: string): void {
  getDb().prepare('DELETE FROM schedule WHERE id = ?').run(id)
}
