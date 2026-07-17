import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Schedule, Task } from '@shared/types/models'

const mocks = vi.hoisted(() => ({
  getTask: vi.fn(),
  getSchedule: vi.fn()
}))

vi.mock('electron', () => ({ ipcMain: { on: vi.fn() } }))
vi.mock('../db/repositories/taskRepo', () => ({ getTask: mocks.getTask }))
vi.mock('../db/repositories/scheduleRepo', () => ({ getSchedule: mocks.getSchedule }))

import { pomodoroCommandSchema } from '../ipc/schemas'
import { resolvePomodoroCommand } from './pomodoroBus'

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Prepare demo',
    description: null,
    categoryId: null,
    priority: 2,
    scheduleId: null,
    status: 'pending',
    dueDate: null,
    estimateMinutes: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides
  }
}

function schedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 'schedule-1',
    title: 'Demo rehearsal',
    description: null,
    categoryId: null,
    priority: 2,
    startTime: 0,
    endTime: 60_000,
    recurrenceRuleId: null,
    reminderMinutesBefore: null,
    status: 'planned',
    createdAt: 0,
    updatedAt: 0,
    ...overrides
  }
}

beforeEach(() => {
  mocks.getTask.mockReset()
  mocks.getSchedule.mockReset()
})

describe('pomodoro start target validation', () => {
  it('rejects malformed, empty, and title-bearing renderer start commands', () => {
    expect(() => pomodoroCommandSchema.parse({ type: 'start' })).toThrow()
    expect(() => pomodoroCommandSchema.parse({ type: 'start', taskId: '' })).toThrow()
    expect(() =>
      pomodoroCommandSchema.parse({
        type: 'start',
        scheduleId: 'schedule-1',
        linkLabel: 'A renderer-controlled label'
      })
    ).toThrow()
  })

  it('rejects cancelled tasks before forwarding a widget start request', () => {
    mocks.getTask.mockReturnValue(task({ status: 'cancelled' }))

    expect(() => resolvePomodoroCommand({ type: 'start', taskId: 'task-1' })).toThrow(
      'Task is not focusable: task-1'
    )
  })

  it.each(['completed', 'skipped', 'cancelled'] as const)(
    'rejects a %s schedule instead of starting a timer against it',
    (status) => {
      mocks.getSchedule.mockReturnValue(schedule({ status }))

      expect(() => resolvePomodoroCommand({ type: 'start', scheduleId: 'schedule-1' })).toThrow(
        'Schedule is not focusable: schedule-1'
      )
    }
  )
})
