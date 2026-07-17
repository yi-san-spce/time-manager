import { getDb } from '../connection'
import type { TaskQuickNote } from '@shared/types/models'

interface TaskQuickNoteRow {
  task_id: string
  text: string
  updated_at: number
}

function mapRow(row: TaskQuickNoteRow): TaskQuickNote {
  return {
    taskId: row.task_id,
    text: row.text,
    updatedAt: row.updated_at
  }
}

/** Returns null until a note is first saved for the task. */
export function getTaskQuickNote(taskId: string): TaskQuickNote | null {
  const row = getDb()
    .prepare('SELECT task_id, text, updated_at FROM task_quick_note WHERE task_id = ?')
    .get(taskId) as TaskQuickNoteRow | undefined
  return row ? mapRow(row) : null
}

/** Upserts a note; the table FK guarantees automatic cleanup when its task is deleted. */
export function setTaskQuickNote(taskId: string, text: string): TaskQuickNote {
  const now = Date.now()
  getDb()
    .prepare(
      `INSERT INTO task_quick_note (task_id, text, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(task_id) DO UPDATE SET text = excluded.text, updated_at = excluded.updated_at`
    )
    .run(taskId, text, now)

  return getTaskQuickNote(taskId) as TaskQuickNote
}
