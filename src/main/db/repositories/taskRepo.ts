import { randomUUID } from 'crypto'
import { getDb } from '../connection'
import type { Priority, Task, TaskDetail, TaskListItem, TaskStatus } from '@shared/types/models'
import type { CreateTaskInput, UpdateTaskInput } from '@shared/types/ipc'
import { listSubtasks } from './subtaskRepo'
import { getTagsForTask } from './tagRepo'

interface TaskRow {
  id: string
  title: string
  description: string | null
  category_id: string | null
  priority: number
  schedule_id: string | null
  status: string
  due_date: number | null
  estimate_minutes: number | null
  created_at: number
  updated_at: number
}

function mapRow(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    categoryId: row.category_id,
    priority: row.priority as Priority,
    scheduleId: row.schedule_id,
    status: row.status as TaskStatus,
    dueDate: row.due_date,
    estimateMinutes: row.estimate_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function getTaskRow(id: string): Task | null {
  const row = getDb().prepare('SELECT * FROM task WHERE id = ?').get(id) as TaskRow | undefined
  return row ? mapRow(row) : null
}

/** 列表项：附带子任务完成计数（进度条）与标签。 */
export function listTasks(): TaskListItem[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM task ORDER BY created_at DESC').all() as TaskRow[]

  const counts = db
    .prepare(
      `SELECT task_id,
              COUNT(*) AS total,
              SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done
       FROM subtask GROUP BY task_id`
    )
    .all() as { task_id: string; total: number; done: number }[]
  const countByTask = new Map(counts.map((c) => [c.task_id, c]))

  return rows.map((row) => {
    const task = mapRow(row)
    const count = countByTask.get(row.id)
    return {
      ...task,
      subtaskTotal: count?.total ?? 0,
      subtaskDone: count?.done ?? 0,
      tags: getTagsForTask(row.id)
    }
  })
}

export function getTask(id: string): Task | null {
  return getTaskRow(id)
}

/** 详情：任务本体 + 子任务清单 + 标签。 */
export function getTaskDetail(id: string): TaskDetail | null {
  const task = getTaskRow(id)
  if (!task) return null
  return { ...task, subtasks: listSubtasks(id), tags: getTagsForTask(id) }
}

export function createTask(input: CreateTaskInput): Task {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()

  db.prepare(
    `INSERT INTO task
       (id, title, description, category_id, priority, schedule_id, status, due_date, estimate_minutes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`
  ).run(
    id,
    input.title,
    input.description ?? null,
    input.categoryId ?? null,
    input.priority ?? 2,
    input.scheduleId ?? null,
    input.dueDate ?? null,
    input.estimateMinutes ?? null,
    now,
    now
  )

  return getTaskRow(id) as Task
}

export function updateTask(input: UpdateTaskInput): Task {
  const existing = getTaskRow(input.id)
  if (!existing) {
    throw new Error(`Task not found: ${input.id}`)
  }

  const next = {
    title: input.title ?? existing.title,
    description: input.description !== undefined ? input.description : existing.description,
    categoryId: input.categoryId !== undefined ? input.categoryId : existing.categoryId,
    priority: input.priority ?? existing.priority,
    scheduleId: input.scheduleId !== undefined ? input.scheduleId : existing.scheduleId,
    status: input.status ?? existing.status,
    dueDate: input.dueDate !== undefined ? input.dueDate : existing.dueDate,
    estimateMinutes: input.estimateMinutes !== undefined ? input.estimateMinutes : existing.estimateMinutes
  }

  getDb()
    .prepare(
      `UPDATE task SET
         title = ?, description = ?, category_id = ?, priority = ?, schedule_id = ?,
         status = ?, due_date = ?, estimate_minutes = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      next.title,
      next.description,
      next.categoryId,
      next.priority,
      next.scheduleId,
      next.status,
      next.dueDate,
      next.estimateMinutes,
      Date.now(),
      input.id
    )

  return getTaskRow(input.id) as Task
}

export function deleteTask(id: string): void {
  getDb().prepare('DELETE FROM task WHERE id = ?').run(id)
}
