import { randomUUID } from 'crypto'
import { getDb } from '../connection'
import type { Subtask } from '@shared/types/models'
import type { CreateSubtaskInput, UpdateSubtaskInput } from '@shared/types/ipc'

interface SubtaskRow {
  id: string
  task_id: string
  title: string
  done: number
  sort_order: number
  created_at: number
  updated_at: number
}

function mapRow(row: SubtaskRow): Subtask {
  return {
    id: row.id,
    taskId: row.task_id,
    title: row.title,
    done: row.done === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

/**
 * 纯逻辑：给定已存在的 id 集合和期望顺序，返回每个 id 的新 sort_order。
 * 只对属于该任务的 id 排序，忽略传入的未知 id。抽出来便于 vitest 覆盖。
 */
export function computeReorder(existingIds: string[], orderedIds: string[]): { id: string; sortOrder: number }[] {
  const known = new Set(existingIds)
  const seen = new Set<string>()
  const result: { id: string; sortOrder: number }[] = []
  for (const id of orderedIds) {
    if (known.has(id) && !seen.has(id)) {
      result.push({ id, sortOrder: result.length })
      seen.add(id)
    }
  }
  // 未在 orderedIds 中出现的既有项，按原样追加到末尾，避免丢失
  for (const id of existingIds) {
    if (!seen.has(id)) {
      result.push({ id, sortOrder: result.length })
      seen.add(id)
    }
  }
  return result
}

export function listSubtasks(taskId: string): Subtask[] {
  const rows = getDb()
    .prepare('SELECT * FROM subtask WHERE task_id = ? ORDER BY sort_order ASC, created_at ASC')
    .all(taskId) as SubtaskRow[]
  return rows.map(mapRow)
}

function getSubtask(id: string): Subtask | null {
  const row = getDb().prepare('SELECT * FROM subtask WHERE id = ?').get(id) as SubtaskRow | undefined
  return row ? mapRow(row) : null
}

export function createSubtask(input: CreateSubtaskInput): Subtask {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  const maxOrder = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM subtask WHERE task_id = ?')
    .get(input.taskId) as { m: number }

  db.prepare(
    `INSERT INTO subtask (id, task_id, title, done, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, 0, ?, ?, ?)`
  ).run(id, input.taskId, input.title, maxOrder.m + 1, now, now)

  return getSubtask(id) as Subtask
}

export function updateSubtask(input: UpdateSubtaskInput): Subtask {
  const existing = getSubtask(input.id)
  if (!existing) throw new Error(`Subtask not found: ${input.id}`)

  const title = input.title ?? existing.title
  const done = input.done !== undefined ? (input.done ? 1 : 0) : existing.done ? 1 : 0

  getDb()
    .prepare('UPDATE subtask SET title = ?, done = ?, updated_at = ? WHERE id = ?')
    .run(title, done, Date.now(), input.id)

  return getSubtask(input.id) as Subtask
}

export function deleteSubtask(id: string): void {
  getDb().prepare('DELETE FROM subtask WHERE id = ?').run(id)
}

export function reorderSubtasks(taskId: string, orderedIds: string[]): Subtask[] {
  const db = getDb()
  const existing = listSubtasks(taskId)
  const plan = computeReorder(
    existing.map((s) => s.id),
    orderedIds
  )
  const now = Date.now()
  const stmt = db.prepare('UPDATE subtask SET sort_order = ?, updated_at = ? WHERE id = ? AND task_id = ?')
  db.transaction(() => {
    for (const { id, sortOrder } of plan) {
      stmt.run(sortOrder, now, id, taskId)
    }
  })()
  return listSubtasks(taskId)
}
