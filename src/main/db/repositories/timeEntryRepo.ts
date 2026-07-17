import { randomUUID } from 'crypto'
import { getDb } from '../connection'
import type { TimeEntry, TimeEntrySource, TimeStatBucket } from '@shared/types/models'
import type {
  ActivityDetailTarget,
  CreateManualTimeEntryInput,
  LinkTimeEntryToTaskInput,
  MergeTimeEntriesInput,
  UpdateTimeEntryInput
} from '@shared/types/ipc'
import { getSafeExternalHost } from '../../services/safeExternalHost'

interface TimeEntryRow {
  id: string
  task_id: string | null
  schedule_id: string | null
  start_time: number
  end_time: number
  source: string
  app_name: string | null
  window_title: string | null
  domain: string | null
  note: string | null
  created_at: number
  updated_at: number
}

function mapRow(row: TimeEntryRow): TimeEntry {
  return {
    id: row.id,
    taskId: row.task_id,
    scheduleId: row.schedule_id ?? null,
    startTime: row.start_time,
    endTime: row.end_time,
    source: row.source as TimeEntrySource,
    appName: row.app_name,
    windowTitle: row.window_title,
    domain: row.domain,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function listTimeEntries(rangeStart: number, rangeEnd: number): TimeEntry[] {
  const rows = getDb()
    .prepare(
      'SELECT * FROM time_entry WHERE start_time < ? AND end_time > ? ORDER BY start_time ASC'
    )
    .all(rangeEnd, rangeStart) as TimeEntryRow[]
  return rows.map(mapRow)
}

export function getTimeEntry(id: string): TimeEntry | null {
  const row = getDb().prepare('SELECT * FROM time_entry WHERE id = ?').get(id) as TimeEntryRow | undefined
  return row ? mapRow(row) : null
}

interface BucketRow {
  key: string | null
  ms: number
  count: number
}

interface ActivityDetailTargetRow extends BucketRow {
  /** Present only when every segment in the target group has a stored domain. */
  domain: string | null
}

function mapBuckets(rows: BucketRow[], fallbackKey: string): TimeStatBucket[] {
  return rows.map((r) => ({
    key: r.key ?? fallbackKey,
    minutes: Math.round(r.ms / 60000),
    count: r.count
  }))
}

export function mapActivityDetailTargets(rows: ActivityDetailTargetRow[]): ActivityDetailTarget[] {
  return rows.map((row) => {
    const target: ActivityDetailTarget = {
      key: row.key ?? '（未知页面）',
      minutes: Math.round(row.ms / 60000),
      count: row.count
    }
    const openHost = getSafeExternalHost(row.domain)
    return openHost ? { ...target, openHost } : target
  })
}

/**
 * 按指定列聚合 [rangeStart, rangeEnd) 内的追踪时长（分钟）。
 * 时长按段与区间的交集计算，避免跨区间的段被整段计入。
 * groupBy 只接受固定白名单列名，杜绝 SQL 注入。
 */
function aggregateBy(
  column: 'app_name' | 'domain' | 'window_title',
  rangeStart: number,
  rangeEnd: number
): TimeStatBucket[] {
  const rows = getDb()
    .prepare(
      `SELECT ${column} AS key,
              SUM(MIN(end_time, ?) - MAX(start_time, ?)) AS ms,
              COUNT(*) AS count
       FROM time_entry
       WHERE start_time < ? AND end_time > ? AND ${column} IS NOT NULL
       GROUP BY ${column}
       ORDER BY ms DESC`
    )
    .all(rangeEnd, rangeStart, rangeEnd, rangeStart) as BucketRow[]
  return mapBuckets(rows, '未知')
}

/** 按应用名聚合耗时（Top 应用）。 */
export function aggregateByApp(rangeStart: number, rangeEnd: number): TimeStatBucket[] {
  const rows = getDb()
    .prepare(
      `SELECT COALESCE(app_name, '手动记录') AS key,
              SUM(MIN(end_time, ?) - MAX(start_time, ?)) AS ms,
              COUNT(*) AS count
       FROM time_entry
       WHERE start_time < ? AND end_time > ?
       GROUP BY COALESCE(app_name, '手动记录')
       ORDER BY ms DESC`
    )
    .all(rangeEnd, rangeStart, rangeEnd, rangeStart) as BucketRow[]
  return mapBuckets(rows, '手动记录')
}

/** 按浏览器站点标签聚合耗时（Top 域名）。 */
export function aggregateByDomain(rangeStart: number, rangeEnd: number): TimeStatBucket[] {
  return aggregateBy('domain', rangeStart, rangeEnd)
}

/** 按窗口标题聚合耗时（Top 窗口标题）。 */
export function aggregateByWindowTitle(rangeStart: number, rangeEnd: number): TimeStatBucket[] {
  return aggregateBy('window_title', rangeStart, rangeEnd)
}

/** 按关联任务聚合耗时；未关联任务归入 taskId=null 的桶（key 为空串）。 */
export function aggregateByTask(rangeStart: number, rangeEnd: number): TimeStatBucket[] {
  const rows = getDb()
    .prepare(
      `SELECT COALESCE(task_id, '') AS key,
              SUM(MIN(end_time, ?) - MAX(start_time, ?)) AS ms,
              COUNT(*) AS count
       FROM time_entry
       WHERE start_time < ? AND end_time > ?
       GROUP BY task_id
       ORDER BY ms DESC`
    )
    .all(rangeEnd, rangeStart, rangeEnd, rangeStart) as BucketRow[]
  return mapBuckets(rows, '')
}

/** 某应用在区间内的明细：访问过的目标（域名/窗口标题）各自时长 + 原始段列表。 */
export function getAppActivityDetail(
  appName: string,
  rangeStart: number,
  rangeEnd: number
): { targets: ActivityDetailTarget[]; segments: TimeEntry[]; totalMinutes: number } {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT COALESCE(domain, window_title, '（未知页面）') AS key,
              SUM(MIN(end_time, ?) - MAX(start_time, ?)) AS ms,
              COUNT(*) AS count,
              CASE WHEN COUNT(*) = COUNT(domain) THEN MIN(domain) ELSE NULL END AS domain
       FROM time_entry
       WHERE start_time < ? AND end_time > ? AND app_name = ?
       GROUP BY key
       ORDER BY ms DESC`
    )
    .all(rangeEnd, rangeStart, rangeEnd, rangeStart, appName) as ActivityDetailTargetRow[]

  const segRows = db
    .prepare(
      `SELECT * FROM time_entry
       WHERE start_time < ? AND end_time > ? AND app_name = ?
       ORDER BY start_time ASC`
    )
    .all(rangeEnd, rangeStart, appName) as TimeEntryRow[]
  const segments = segRows.map(mapRow)
  const totalMinutes = segments.reduce(
    (sum, e) => sum + Math.round((Math.min(e.endTime, rangeEnd) - Math.max(e.startTime, rangeStart)) / 60000),
    0
  )

  return { targets: mapActivityDetailTargets(rows), segments, totalMinutes }
}

export function createAutoTimeEntry(input: {
  startTime: number
  endTime: number
  appName: string | null
  windowTitle: string | null
  domain?: string | null
  scheduleId?: string | null
}): TimeEntry {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()

  db.prepare(
    `INSERT INTO time_entry
       (id, task_id, schedule_id, start_time, end_time, source, app_name, window_title, domain, note, created_at, updated_at)
     VALUES (?, NULL, ?, ?, ?, 'auto', ?, ?, ?, NULL, ?, ?)`
  ).run(
    id,
    input.scheduleId ?? null,
    input.startTime,
    input.endTime,
    input.appName,
    input.windowTitle,
    input.domain ?? null,
    now,
    now
  )

  return getTimeEntry(id) as TimeEntry
}

export function createManualTimeEntry(input: CreateManualTimeEntryInput): TimeEntry {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()

  db.prepare(
    `INSERT INTO time_entry
       (id, task_id, schedule_id, start_time, end_time, source, app_name, window_title, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'manual', NULL, NULL, ?, ?, ?)`
  ).run(
    id,
    input.taskId ?? null,
    input.scheduleId ?? null,
    input.startTime,
    input.endTime,
    input.note ?? null,
    now,
    now
  )

  return getTimeEntry(id) as TimeEntry
}

export function updateTimeEntry(input: UpdateTimeEntryInput): TimeEntry {
  const db = getDb()
  const existing = getTimeEntry(input.id)
  if (!existing) {
    throw new Error(`TimeEntry not found: ${input.id}`)
  }

  const next = {
    taskId: input.taskId !== undefined ? input.taskId : existing.taskId,
    scheduleId: input.scheduleId !== undefined ? input.scheduleId : existing.scheduleId,
    startTime: input.startTime ?? existing.startTime,
    endTime: input.endTime ?? existing.endTime,
    note: input.note !== undefined ? input.note : existing.note
  }

  db.prepare(
    `UPDATE time_entry
       SET task_id = ?, schedule_id = ?, start_time = ?, end_time = ?, note = ?, updated_at = ?
     WHERE id = ?`
  ).run(next.taskId, next.scheduleId, next.startTime, next.endTime, next.note, Date.now(), input.id)

  return getTimeEntry(input.id) as TimeEntry
}

export function linkTimeEntryToTask(input: LinkTimeEntryToTaskInput): TimeEntry {
  const db = getDb()
  const existing = getTimeEntry(input.id)
  if (!existing) {
    throw new Error(`TimeEntry not found: ${input.id}`)
  }

  db.prepare('UPDATE time_entry SET task_id = ?, updated_at = ? WHERE id = ?').run(
    input.taskId,
    Date.now(),
    input.id
  )

  return getTimeEntry(input.id) as TimeEntry
}

/** 合并多条时间段为一条：取最早开始/最晚结束，来源统一为 manual，其余记录被删除。 */
export function mergeTimeEntries(input: MergeTimeEntriesInput): TimeEntry {
  const db = getDb()
  const entries = input.ids.map((id) => getTimeEntry(id)).filter((e): e is TimeEntry => e !== null)
  if (entries.length === 0) {
    throw new Error('No valid time entries to merge')
  }

  const startTime = Math.min(...entries.map((e) => e.startTime))
  const endTime = Math.max(...entries.map((e) => e.endTime))
  const taskId = input.taskId !== undefined ? input.taskId : entries.find((e) => e.taskId)?.taskId ?? null
  const scheduleId =
    input.scheduleId !== undefined ? input.scheduleId : entries.find((e) => e.scheduleId)?.scheduleId ?? null

  const mergeTxn = db.transaction(() => {
    for (const id of input.ids) {
      db.prepare('DELETE FROM time_entry WHERE id = ?').run(id)
    }
    const id = randomUUID()
    const now = Date.now()
    db.prepare(
      `INSERT INTO time_entry
         (id, task_id, schedule_id, start_time, end_time, source, app_name, window_title, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'manual', NULL, NULL, NULL, ?, ?)`
    ).run(id, taskId, scheduleId, startTime, endTime, now, now)
    return id
  })

  const newId = mergeTxn()
  return getTimeEntry(newId) as TimeEntry
}

export function deleteTimeEntry(id: string): void {
  getDb().prepare('DELETE FROM time_entry WHERE id = ?').run(id)
}
