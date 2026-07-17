import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }))

vi.mock('../connection', () => ({ getDb: mocks.getDb }))

import { createManualTimeEntry, mergeTimeEntries } from './timeEntryRepo'

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

function entryRow(overrides: Partial<TimeEntryRow> = {}): TimeEntryRow {
  return {
    id: 'entry-1',
    task_id: null,
    schedule_id: null,
    start_time: 1_000,
    end_time: 2_000,
    source: 'manual',
    app_name: null,
    window_title: null,
    domain: null,
    note: null,
    created_at: 0,
    updated_at: 0,
    ...overrides
  }
}

beforeEach(() => {
  mocks.getDb.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('time-entry schedule context persistence', () => {
  it('writes the selected schedule ID alongside a manual record', () => {
    const run = vi.fn()
    const saved = entryRow({ id: 'manual-1', task_id: 'task-1', schedule_id: 'schedule-1' })
    const prepare = vi.fn((sql: string) => {
      if (sql.includes('INSERT INTO time_entry')) return { run }
      if (sql.includes('SELECT * FROM time_entry WHERE id = ?')) return { get: () => saved }
      throw new Error(`Unexpected SQL: ${sql}`)
    })
    mocks.getDb.mockReturnValue({ prepare })
    vi.spyOn(Date, 'now').mockReturnValue(100)

    expect(
      createManualTimeEntry({
        taskId: 'task-1',
        scheduleId: 'schedule-1',
        startTime: 1_000,
        endTime: 2_000,
        note: 'Prepare the walkthrough'
      })
    ).toMatchObject({ taskId: 'task-1', scheduleId: 'schedule-1' })
    expect(run).toHaveBeenCalledWith(
      expect.any(String),
      'task-1',
      'schedule-1',
      1_000,
      2_000,
      'Prepare the walkthrough',
      100,
      100
    )
  })

  it('uses an explicitly selected schedule when merging records', () => {
    const deleteRun = vi.fn()
    const insertRun = vi.fn()
    const rows = new Map<string, TimeEntryRow>([
      ['first', entryRow({ id: 'first', schedule_id: 'old-schedule', start_time: 1_000, end_time: 2_000 })],
      [
        'second',
        entryRow({
          id: 'second',
          task_id: 'task-2',
          schedule_id: 'another-schedule',
          start_time: 2_500,
          end_time: 4_000
        })
      ]
    ])
    const merged = entryRow({
      id: 'merged',
      task_id: 'task-2',
      schedule_id: 'selected-schedule',
      start_time: 1_000,
      end_time: 4_000
    })
    const prepare = vi.fn((sql: string) => {
      if (sql.includes('SELECT * FROM time_entry WHERE id = ?')) {
        return { get: (id: string) => rows.get(id) ?? merged }
      }
      if (sql.includes('DELETE FROM time_entry')) return { run: deleteRun }
      if (sql.includes('INSERT INTO time_entry')) return { run: insertRun }
      throw new Error(`Unexpected SQL: ${sql}`)
    })
    const transaction = vi.fn((callback: () => string) => callback)
    mocks.getDb.mockReturnValue({ prepare, transaction })
    vi.spyOn(Date, 'now').mockReturnValue(200)

    expect(
      mergeTimeEntries({
        ids: ['first', 'second'],
        scheduleId: 'selected-schedule'
      })
    ).toMatchObject({
      taskId: 'task-2',
      scheduleId: 'selected-schedule',
      startTime: 1_000,
      endTime: 4_000
    })
    expect(deleteRun).toHaveBeenNthCalledWith(1, 'first')
    expect(deleteRun).toHaveBeenNthCalledWith(2, 'second')
    expect(insertRun).toHaveBeenCalledWith(
      expect.any(String),
      'task-2',
      'selected-schedule',
      1_000,
      4_000,
      200,
      200
    )
  })
})
