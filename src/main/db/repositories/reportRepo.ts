import { randomUUID } from 'crypto'
import { getDb } from '../connection'
import type { Report, ReportKind } from '@shared/types/models'

interface ReportRow {
  id: string
  type: string
  period_start: number
  period_end: number
  self_reflection: string | null
  ai_summary: string | null
  ai_provider_used: string | null
  generated_at: number | null
  created_at: number
  updated_at: number
}

function mapRow(row: ReportRow): Report {
  return {
    id: row.id,
    type: row.type as ReportKind,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    selfReflection: row.self_reflection,
    aiSummary: row.ai_summary,
    aiProviderUsed: row.ai_provider_used,
    generatedAt: row.generated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function listReports(): Report[] {
  const rows = getDb().prepare('SELECT * FROM report ORDER BY period_start DESC').all() as ReportRow[]
  return rows.map(mapRow)
}

export function getReport(id: string): Report | null {
  const row = getDb().prepare('SELECT * FROM report WHERE id = ?').get(id) as ReportRow | undefined
  return row ? mapRow(row) : null
}

export function createReport(input: {
  type: ReportKind
  periodStart: number
  periodEnd: number
  selfReflection?: string | null
}): Report {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()

  db.prepare(
    `INSERT INTO report (id, type, period_start, period_end, self_reflection, ai_summary, ai_provider_used, generated_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)`
  ).run(id, input.type, input.periodStart, input.periodEnd, input.selfReflection ?? null, now, now)

  return getReport(id) as Report
}

export function updateReportSelfReflection(id: string, selfReflection: string | null): Report {
  getDb()
    .prepare('UPDATE report SET self_reflection = ?, updated_at = ? WHERE id = ?')
    .run(selfReflection, Date.now(), id)
  return getReport(id) as Report
}

export function setReportAISummary(id: string, aiSummary: string, aiProviderUsed: string): Report {
  const now = Date.now()
  getDb()
    .prepare(
      'UPDATE report SET ai_summary = ?, ai_provider_used = ?, generated_at = ?, updated_at = ? WHERE id = ?'
    )
    .run(aiSummary, aiProviderUsed, now, now, id)
  return getReport(id) as Report
}

export function deleteReport(id: string): void {
  getDb().prepare('DELETE FROM report WHERE id = ?').run(id)
}
