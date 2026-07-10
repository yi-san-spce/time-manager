import { randomUUID } from 'crypto'
import { getDb } from '../connection'
import type { Category } from '@shared/types/models'

interface CategoryRow {
  id: string
  name: string
  color: string | null
  created_at: number
}

function mapRow(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at
  }
}

export function listCategories(): Category[] {
  const rows = getDb().prepare('SELECT * FROM category ORDER BY created_at ASC').all() as CategoryRow[]
  return rows.map(mapRow)
}

export function upsertCategory(input: { id?: string; name: string; color?: string | null }): Category {
  const db = getDb()

  if (input.id) {
    db.prepare('UPDATE category SET name = ?, color = ? WHERE id = ?').run(
      input.name,
      input.color ?? null,
      input.id
    )
    const row = db.prepare('SELECT * FROM category WHERE id = ?').get(input.id) as CategoryRow
    return mapRow(row)
  }

  const id = randomUUID()
  const createdAt = Date.now()
  db.prepare('INSERT INTO category (id, name, color, created_at) VALUES (?, ?, ?, ?)').run(
    id,
    input.name,
    input.color ?? null,
    createdAt
  )
  return { id, name: input.name, color: input.color ?? null, createdAt }
}

export function deleteCategory(id: string): void {
  getDb().prepare('DELETE FROM category WHERE id = ?').run(id)
}
