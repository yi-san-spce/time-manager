import { randomUUID } from 'crypto'
import { getDb } from '../connection'
import type { Tag } from '@shared/types/models'
import type { CreateTagInput } from '@shared/types/ipc'

interface TagRow {
  id: string
  name: string
  color: string | null
}

function mapRow(row: TagRow): Tag {
  return { id: row.id, name: row.name, color: row.color }
}

export function listTags(): Tag[] {
  const rows = getDb().prepare('SELECT * FROM tag ORDER BY name ASC').all() as TagRow[]
  return rows.map(mapRow)
}

export function getTagsForTask(taskId: string): Tag[] {
  const rows = getDb()
    .prepare(
      `SELECT tag.* FROM tag
       JOIN task_tag ON task_tag.tag_id = tag.id
       WHERE task_tag.task_id = ?
       ORDER BY tag.name ASC`
    )
    .all(taskId) as TagRow[]
  return rows.map(mapRow)
}

/** 创建标签；若同名标签已存在则复用（name UNIQUE，避免重复）。 */
export function createTag(input: CreateTagInput): Tag {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM tag WHERE name = ?').get(input.name) as TagRow | undefined
  if (existing) return mapRow(existing)

  const id = randomUUID()
  db.prepare('INSERT INTO tag (id, name, color) VALUES (?, ?, ?)').run(id, input.name, input.color ?? null)
  return { id, name: input.name, color: input.color ?? null }
}

export function deleteTag(id: string): void {
  getDb().prepare('DELETE FROM tag WHERE id = ?').run(id)
}

/** 全量设置某任务的标签集合（先清空再插入，事务内完成）。 */
export function setTaskTags(taskId: string, tagIds: string[]): void {
  const db = getDb()
  const insert = db.prepare('INSERT OR IGNORE INTO task_tag (task_id, tag_id) VALUES (?, ?)')
  db.transaction(() => {
    db.prepare('DELETE FROM task_tag WHERE task_id = ?').run(taskId)
    for (const tagId of tagIds) {
      insert.run(taskId, tagId)
    }
  })()
}
