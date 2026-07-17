import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Schedule, ScheduleOccurrence, TaskListItem } from '@shared/types/models'

const mocks = vi.hoisted(() => ({
  listSchedules: vi.fn(),
  listTasks: vi.fn(),
  expandAllRecurringSchedules: vi.fn()
}))

vi.mock('../db/repositories/scheduleRepo', () => ({ listSchedules: mocks.listSchedules }))
vi.mock('../db/repositories/taskRepo', () => ({ listTasks: mocks.listTasks }))
vi.mock('../ipc/recurrenceHandlers', () => ({
  expandAllRecurringSchedules: mocks.expandAllRecurringSchedules
}))

import { getWidgetContext } from './widgetContextService'

function schedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 'schedule-1',
    title: 'Design review',
    description: null,
    categoryId: null,
    priority: 2,
    startTime: new Date(2026, 6, 10, 9, 0).getTime(),
    endTime: new Date(2026, 6, 10, 10, 0).getTime(),
    recurrenceRuleId: null,
    reminderMinutesBefore: null,
    status: 'planned',
    createdAt: 0,
    updatedAt: 0,
    ...overrides
  }
}

function task(overrides: Partial<TaskListItem> = {}): TaskListItem {
  return {
    id: 'task-1',
    title: 'Ship widget',
    description: null,
    categoryId: null,
    priority: 2,
    scheduleId: null,
    status: 'pending',
    dueDate: null,
    estimateMinutes: null,
    createdAt: 0,
    updatedAt: 0,
    subtaskDone: 0,
    subtaskTotal: 0,
    tags: [],
    ...overrides
  }
}

beforeEach(() => {
  mocks.listSchedules.mockReset()
  mocks.listTasks.mockReset()
  mocks.expandAllRecurringSchedules.mockReset()
})

describe('getWidgetContext', () => {
  it('returns local-day schedule instances, including recurrence occurrences, and preserves current schedule', () => {
    const now = new Date(2026, 6, 10, 9, 30).getTime()
    const regular = schedule()
    const recurring = schedule({
      id: 'schedule-recurring',
      title: 'Daily stand-up',
      recurrenceRuleId: 'rule-1',
      startTime: new Date(2026, 0, 1, 8, 30).getTime(),
      endTime: new Date(2026, 0, 1, 8, 45).getTime()
    })
    const cancelled = schedule({ id: 'schedule-cancelled', status: 'cancelled' })
    const skippedOccurrence: ScheduleOccurrence = {
      schedule: recurring,
      occurrenceStart: new Date(2026, 6, 10, 12, 0).getTime(),
      occurrenceEnd: new Date(2026, 6, 10, 12, 15).getTime(),
      exceptionAction: 'skipped'
    }

    mocks.listSchedules.mockReturnValue([regular, recurring, cancelled])
    mocks.expandAllRecurringSchedules.mockReturnValue([
      {
        schedule: recurring,
        occurrenceStart: new Date(2026, 6, 10, 8, 30).getTime(),
        occurrenceEnd: new Date(2026, 6, 10, 8, 45).getTime(),
        exceptionAction: null
      },
      skippedOccurrence
    ])
    mocks.listTasks.mockReturnValue([])

    const context = getWidgetContext(now)

    expect(context.currentSchedule).toMatchObject({ id: 'schedule-1', title: 'Design review' })
    expect(context.todaySchedules).toEqual([
      {
        id: 'schedule-recurring',
        title: 'Daily stand-up',
        startTime: new Date(2026, 6, 10, 8, 30).getTime(),
        endTime: new Date(2026, 6, 10, 8, 45).getTime(),
        status: 'planned'
      },
      {
        id: 'schedule-1',
        title: 'Design review',
        startTime: new Date(2026, 6, 10, 9, 0).getTime(),
        endTime: new Date(2026, 6, 10, 10, 0).getTime(),
        status: 'planned'
      }
    ])
  })

  it('keeps all unfinished tasks, including tasks without schedule links, and excludes closed tasks', () => {
    const now = new Date(2026, 6, 10, 9, 30).getTime()
    mocks.listSchedules.mockReturnValue([])
    mocks.expandAllRecurringSchedules.mockReturnValue([])
    mocks.listTasks.mockReturnValue([
      task({ id: 'unlinked', title: 'Inbox cleanup', scheduleId: null, status: 'pending' }),
      task({ id: 'linked', title: 'Prepare review', scheduleId: 'schedule-1', status: 'in_progress' }),
      task({ id: 'done', status: 'done' }),
      task({ id: 'cancelled', status: 'cancelled' })
    ])

    expect(getWidgetContext(now)).toMatchObject({
      currentSchedule: null,
      todaySchedules: [],
      focusableTasks: [
        { id: 'unlinked', title: 'Inbox cleanup', status: 'pending', scheduleId: null },
        { id: 'linked', title: 'Prepare review', status: 'in_progress', scheduleId: 'schedule-1' }
      ]
    })
  })

  it('includes a single event that started before midnight when it overlaps today', () => {
    const now = new Date(2026, 6, 10, 0, 15).getTime()
    const overnight = schedule({
      id: 'overnight',
      title: 'Night deployment',
      startTime: new Date(2026, 6, 9, 23, 30).getTime(),
      endTime: new Date(2026, 6, 10, 0, 30).getTime()
    })
    mocks.listSchedules.mockReturnValue([overnight])
    mocks.expandAllRecurringSchedules.mockReturnValue([])
    mocks.listTasks.mockReturnValue([])

    expect(getWidgetContext(now).currentSchedule).toMatchObject({ id: 'overnight' })
  })
})
