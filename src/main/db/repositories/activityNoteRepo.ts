import { getDb } from '../connection'

export interface ActivityNote {
  scopeKey: string
  note: string | null
  aiSummary: string | null
  updatedAt: number
}

interface ActivityNoteRow {
  scope_key: string
  note: string | null
  ai_summary: string | null
  updated_at: number
}

function mapRow(row: ActivityNoteRow): ActivityNote {
  return { scopeKey: row.scope_key, note: row.note, aiSummary: row.ai_summary, updatedAt: row.updated_at }
}

export function getActivityNote(scopeKey: string): ActivityNote | null {
  const row = getDb().prepare('SELECT * FROM activity_note WHERE scope_key = ?').get(scopeKey) as
    | ActivityNoteRow
    | undefined
  return row ? mapRow(row) : null
}

/** upsert 用户笔记（保留已有 ai_summary）。 */
export function saveActivityNote(scopeKey: string, note: string | null): ActivityNote {
  const db = getDb()
  db.prepare(
    `INSERT INTO activity_note (scope_key, note, ai_summary, updated_at)
     VALUES (?, ?, NULL, ?)
     ON CONFLICT(scope_key) DO UPDATE SET note = excluded.note, updated_at = excluded.updated_at`
  ).run(scopeKey, note, Date.now())
  return getActivityNote(scopeKey) as ActivityNote
}

/** 写入 AI 总结（保留已有用户笔记）。 */
export function setActivityAISummary(scopeKey: string, aiSummary: string): ActivityNote {
  const db = getDb()
  db.prepare(
    `INSERT INTO activity_note (scope_key, note, ai_summary, updated_at)
     VALUES (?, NULL, ?, ?)
     ON CONFLICT(scope_key) DO UPDATE SET ai_summary = excluded.ai_summary, updated_at = excluded.updated_at`
  ).run(scopeKey, aiSummary, Date.now())
  return getActivityNote(scopeKey) as ActivityNote
}
