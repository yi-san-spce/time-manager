import { describe, expect, it } from 'vitest'
import {
  createManualTimeEntrySchema,
  createScheduleSchema,
  createTaskSchema,
  pomodoroCommandSchema,
  pomodoroSnapshotSchema,
  taskQuickNoteInputSchema,
  updateScheduleSchema,
  upsertCategorySchema
} from './schemas'

describe('createScheduleSchema', () => {
  it('accepts a minimal valid schedule', () => {
    const result = createScheduleSchema.parse({
      title: '写周报',
      startTime: 1000,
      endTime: 2000
    })
    expect(result.title).toBe('写周报')
    expect(result.startTime).toBe(1000)
  })

  it('rejects an empty title', () => {
    expect(() => createScheduleSchema.parse({ title: '', startTime: 1000, endTime: 2000 })).toThrow()
  })

  it('rejects a missing startTime', () => {
    expect(() => createScheduleSchema.parse({ title: '写周报', endTime: 2000 })).toThrow()
  })

  it('rejects an out-of-range priority', () => {
    expect(() =>
      createScheduleSchema.parse({ title: '写周报', startTime: 1000, endTime: 2000, priority: 5 })
    ).toThrow()
  })
})

describe('updateScheduleSchema', () => {
  it('requires an id but allows every other field to be omitted', () => {
    const result = updateScheduleSchema.parse({ id: 'abc' })
    expect(result.id).toBe('abc')
  })

  it('rejects an invalid status', () => {
    expect(() => updateScheduleSchema.parse({ id: 'abc', status: 'archived' })).toThrow()
  })
})

describe('createTaskSchema', () => {
  it('accepts a minimal valid task', () => {
    const result = createTaskSchema.parse({ title: '整理需求文档' })
    expect(result.title).toBe('整理需求文档')
  })

  it('rejects an empty title', () => {
    expect(() => createTaskSchema.parse({ title: '' })).toThrow()
  })
})

describe('upsertCategorySchema', () => {
  it('accepts a new category without an id', () => {
    const result = upsertCategorySchema.parse({ name: '工作' })
    expect(result.id).toBeUndefined()
  })

  it('rejects a missing name', () => {
    expect(() => upsertCategorySchema.parse({ id: 'abc' })).toThrow()
  })
})

describe('widget and calendar-context schemas', () => {
  it('accepts a selected schedule on a manual time entry', () => {
    expect(
      createManualTimeEntrySchema.parse({
        taskId: 'task-1',
        scheduleId: 'schedule-1',
        startTime: 0,
        endTime: 60_000
      })
    ).toMatchObject({ taskId: 'task-1', scheduleId: 'schedule-1' })
  })

  it('limits task quick notes and requires a task ID', () => {
    expect(taskQuickNoteInputSchema.parse({ taskId: 'task-1', text: 'A small note' })).toEqual({
      taskId: 'task-1',
      text: 'A small note'
    })
    expect(() => taskQuickNoteInputSchema.parse({ taskId: '', text: 'No task' })).toThrow()
    expect(() => taskQuickNoteInputSchema.parse({ taskId: 'task-1', text: 'x'.repeat(5001) })).toThrow()
  })

  it('accepts only target IDs for a cross-window start command', () => {
    expect(pomodoroCommandSchema.parse({ type: 'start', taskId: 'task-1' })).toMatchObject({
      type: 'start',
      taskId: 'task-1'
    })
    expect(() => pomodoroCommandSchema.parse({ type: 'start' })).toThrow()
    expect(() =>
      pomodoroCommandSchema.parse({ type: 'start', taskId: 'task-1', linkLabel: 'Untrusted title' })
    ).toThrow()
  })

  it('normalizes omitted snapshot target IDs to null during a rolling renderer reload', () => {
    expect(
      pomodoroSnapshotSchema.parse({
        phase: 'focus',
        running: false,
        remainingMs: 0,
        totalMs: 0,
        linkLabel: null,
        active: false
      })
    ).toMatchObject({ taskId: null, scheduleId: null })
  })
})
