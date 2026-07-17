import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }))

vi.mock('../connection', () => ({ getDb: mocks.getDb }))

import {
  aggregateByApp,
  aggregateByDomain,
  createAutoTimeEntry,
  createManualTimeEntry,
  getAppActivityDetail
} from './timeEntryRepo'

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

function makeEntryRow(overrides: Partial<TimeEntryRow> = {}): TimeEntryRow {
  return {
    id: 'entry-1',
    task_id: null,
    schedule_id: null,
    start_time: 0,
    end_time: 60_000,
    source: 'auto',
    app_name: 'chrome.exe',
    window_title: 'Docs - github.com - Google Chrome',
    domain: 'github.com',
    note: null,
    created_at: 0,
    updated_at: 0,
    ...overrides
  }
}

function installDbFixture(input: {
  appBuckets?: { key: string | null; ms: number; count: number }[]
  domainBuckets: { key: string | null; ms: number; count: number }[]
  activityRows: Record<string, { key: string | null; ms: number; count: number; domain: string | null }[]>
  segments: Record<string, TimeEntryRow[]>
  entryById?: TimeEntryRow
}): ReturnType<typeof vi.fn> {
  const insertRun = vi.fn()
  const prepare = vi.fn((sql: string) => {
    if (sql.includes('INSERT INTO time_entry')) return { run: insertRun }
    if (sql.includes('SELECT * FROM time_entry WHERE id = ?')) return { get: () => input.entryById }
    if (sql.includes("COALESCE(app_name, '手动记录')")) return { all: () => input.appBuckets ?? [] }
    if (sql.includes('SELECT domain AS key')) return { all: () => input.domainBuckets }
    if (sql.includes('COALESCE(domain, window_title')) {
      return { all: (_rangeEnd: number, _rangeStart: number, _end: number, _start: number, appName: string) => input.activityRows[appName] ?? [] }
    }
    if (sql.includes('SELECT * FROM time_entry')) {
      return { all: (_rangeEnd: number, _rangeStart: number, appName: string) => input.segments[appName] ?? [] }
    }
    throw new Error(`Unexpected query: ${sql}`)
  })
  mocks.getDb.mockReturnValue({ prepare })
  return insertRun
}

beforeEach(() => {
  mocks.getDb.mockReset()
})

describe('time-entry domain aggregation and activity details', () => {
  it('includes manually added records in the application overview bucket', () => {
    installDbFixture({
      appBuckets: [{ key: '手动记录', ms: 30 * 60_000, count: 1 }],
      domainBuckets: [],
      activityRows: {},
      segments: {}
    })

    expect(aggregateByApp(0, 30 * 60_000)).toEqual([{ key: '手动记录', minutes: 30, count: 1 }])
  })

  it('writes a stored domain, keeps it in stats, and exposes a validated open host in details', () => {
    const row = makeEntryRow({ end_time: 120_000 })
    const insertRun = installDbFixture({
      domainBuckets: [{ key: 'github.com', ms: 120_000, count: 1 }],
      activityRows: {
        'chrome.exe': [{ key: 'github.com', ms: 120_000, count: 1, domain: 'github.com' }]
      },
      segments: { 'chrome.exe': [row] },
      entryById: row
    })

    createAutoTimeEntry({
      startTime: 0,
      endTime: 120_000,
      appName: 'chrome.exe',
      windowTitle: 'Docs - github.com - Google Chrome',
      domain: 'github.com'
    })

    expect(insertRun).toHaveBeenCalledWith(
      expect.any(String),
      null,
      0,
      120_000,
      'chrome.exe',
      'Docs - github.com - Google Chrome',
      'github.com',
      expect.any(Number),
      expect.any(Number)
    )
    expect(aggregateByDomain(0, 120_000)).toEqual([{ key: 'github.com', minutes: 2, count: 1 }])
    expect(getAppActivityDetail('chrome.exe', 0, 120_000).targets).toEqual([
      { key: 'github.com', minutes: 2, count: 1, openHost: 'github.com' }
    ])
  })

  it('persists the selected schedule on manually created time entries', () => {
    const row = makeEntryRow({
      task_id: 'task-1',
      schedule_id: 'schedule-1',
      source: 'manual',
      app_name: null,
      window_title: null,
      domain: null,
      note: 'Focused implementation'
    })
    const insertRun = installDbFixture({
      domainBuckets: [],
      activityRows: {},
      segments: {},
      entryById: row
    })

    createManualTimeEntry({
      taskId: 'task-1',
      scheduleId: 'schedule-1',
      startTime: 0,
      endTime: 60_000,
      note: 'Focused implementation'
    })

    expect(insertRun).toHaveBeenCalledWith(
      expect.any(String),
      'task-1',
      'schedule-1',
      0,
      60_000,
      'Focused implementation',
      expect.any(Number),
      expect.any(Number)
    )
  })

  it('keeps historical labels visible but never infers an open host from them', () => {
    installDbFixture({
      domainBuckets: [{ key: 'GitHub', ms: 60_000, count: 1 }],
      activityRows: {
        'legacy-browser.exe': [{ key: 'github.com', ms: 60_000, count: 1, domain: null }],
        'label-browser.exe': [{ key: 'GitHub', ms: 60_000, count: 1, domain: 'GitHub' }]
      },
      segments: {
        'legacy-browser.exe': [makeEntryRow({ app_name: 'legacy-browser.exe', domain: null, window_title: 'github.com' })],
        'label-browser.exe': [makeEntryRow({ app_name: 'label-browser.exe', domain: 'GitHub' })]
      }
    })

    expect(aggregateByDomain(0, 120_000)).toEqual([{ key: 'GitHub', minutes: 1, count: 1 }])
    expect(getAppActivityDetail('legacy-browser.exe', 0, 120_000).targets).toEqual([
      { key: 'github.com', minutes: 1, count: 1 }
    ])
    expect(getAppActivityDetail('label-browser.exe', 0, 120_000).targets).toEqual([
      { key: 'GitHub', minutes: 1, count: 1 }
    ])
  })
})
