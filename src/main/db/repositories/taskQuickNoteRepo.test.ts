import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }))

vi.mock('../connection', () => ({ getDb: mocks.getDb }))

import { getTaskQuickNote, setTaskQuickNote } from './taskQuickNoteRepo'

beforeEach(() => {
  mocks.getDb.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('task quick-note repository', () => {
  it('maps a persisted note and returns null before a task receives its first note', () => {
    const get = vi
      .fn()
      .mockReturnValueOnce({ task_id: 'task-1', text: 'First draft', updated_at: 20 })
      .mockReturnValueOnce(undefined)
    const prepare = vi.fn(() => ({ get }))
    mocks.getDb.mockReturnValue({ prepare })

    expect(getTaskQuickNote('task-1')).toEqual({
      taskId: 'task-1',
      text: 'First draft',
      updatedAt: 20
    })
    expect(getTaskQuickNote('task-2')).toBeNull()
    expect(get).toHaveBeenNthCalledWith(1, 'task-1')
    expect(get).toHaveBeenNthCalledWith(2, 'task-2')
  })

  it('upserts by task ID and returns the freshly read shared note', () => {
    const run = vi.fn()
    const get = vi.fn(() => ({ task_id: 'task-1', text: 'Updated note', updated_at: 4_242 }))
    const prepare = vi.fn((sql: string) => (sql.includes('INSERT INTO task_quick_note') ? { run } : { get }))
    mocks.getDb.mockReturnValue({ prepare })
    vi.spyOn(Date, 'now').mockReturnValue(4_242)

    expect(setTaskQuickNote('task-1', 'Updated note')).toEqual({
      taskId: 'task-1',
      text: 'Updated note',
      updatedAt: 4_242
    })
    expect(run).toHaveBeenCalledWith('task-1', 'Updated note', 4_242)
    expect(get).toHaveBeenCalledWith('task-1')
  })
})
