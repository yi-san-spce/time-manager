import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserWindow } from 'electron'
import type { Schedule, Task } from '@shared/types/models'
import { IPC } from '@shared/types/ipc'

const mocks = vi.hoisted(() => ({
  on: vi.fn(),
  getTask: vi.fn(),
  getSchedule: vi.fn()
}))

vi.mock('electron', () => ({ ipcMain: { on: mocks.on } }))
vi.mock('../db/repositories/taskRepo', () => ({ getTask: mocks.getTask }))
vi.mock('../db/repositories/scheduleRepo', () => ({ getSchedule: mocks.getSchedule }))

import { initPomodoroBus, resolvePomodoroCommand } from './pomodoroBus'

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Ship floating widget',
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
    title: 'Interview preparation',
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

function fakeWindow(): { window: BrowserWindow; webContents: { send: ReturnType<typeof vi.fn> } } {
  const webContents = { send: vi.fn() }
  return {
    window: { isDestroyed: () => false, webContents } as unknown as BrowserWindow,
    webContents
  }
}

beforeEach(() => {
  mocks.on.mockReset()
  mocks.getTask.mockReset()
  mocks.getSchedule.mockReset()
})

describe('resolvePomodoroCommand', () => {
  it('resolves verified task and schedule IDs into a main-process-generated label', () => {
    mocks.getTask.mockReturnValue(task())
    mocks.getSchedule.mockReturnValue(schedule())

    expect(resolvePomodoroCommand({ type: 'start', taskId: 'task-1', scheduleId: 'schedule-1' })).toEqual({
      type: 'start',
      taskId: 'task-1',
      scheduleId: 'schedule-1',
      linkLabel: 'Ship floating widget · Interview preparation'
    })
  })

  it('allows an unlinked task target but rejects missing or closed tasks', () => {
    mocks.getTask.mockReturnValue(task({ scheduleId: null }))
    expect(resolvePomodoroCommand({ type: 'start', taskId: 'task-1' })).toMatchObject({
      taskId: 'task-1',
      scheduleId: null,
      linkLabel: 'Ship floating widget'
    })

    mocks.getTask.mockReturnValue(null)
    expect(() => resolvePomodoroCommand({ type: 'start', taskId: 'missing' })).toThrow('Task not found')

    mocks.getTask.mockReturnValue(task({ status: 'done' }))
    expect(() => resolvePomodoroCommand({ type: 'start', taskId: 'task-1' })).toThrow('not focusable')
  })

  it('rejects a missing schedule instead of accepting a renderer-provided title', () => {
    mocks.getSchedule.mockReturnValue(null)
    expect(() => resolvePomodoroCommand({ type: 'start', scheduleId: 'missing' })).toThrow('Schedule not found')
  })
})

describe('initPomodoroBus sender isolation', () => {
  it('only accepts snapshots from the main window and commands from the widget window', () => {
    const main = fakeWindow()
    const widget = fakeWindow()
    mocks.getTask.mockReturnValue(task())
    initPomodoroBus(() => main.window, () => widget.window)

    const publish = mocks.on.mock.calls.find(([channel]) => channel === IPC.pomodoroPublishState)?.[1] as
      | ((event: { sender: unknown }, raw: unknown) => void)
      | undefined
    const command = mocks.on.mock.calls.find(([channel]) => channel === IPC.pomodoroSendCommand)?.[1] as
      | ((event: { sender: unknown }, raw: unknown) => void)
      | undefined

    const snapshot = {
      phase: 'focus',
      running: true,
      remainingMs: 1_000,
      totalMs: 60_000,
      linkLabel: 'Ship floating widget',
      active: true,
      taskId: 'task-1',
      scheduleId: null
    }

    publish?.({ sender: {} }, snapshot)
    command?.({ sender: {} }, { type: 'start', taskId: 'task-1' })
    expect(widget.webContents.send).not.toHaveBeenCalled()
    expect(main.webContents.send).not.toHaveBeenCalled()

    publish?.({ sender: main.window.webContents }, snapshot)
    expect(widget.webContents.send).toHaveBeenCalledWith(IPC.pomodoroStateChanged, snapshot)

    command?.({ sender: widget.window.webContents }, { type: 'start', taskId: 'task-1' })
    expect(main.webContents.send).toHaveBeenCalledWith(IPC.pomodoroCommandReceived, {
      type: 'start',
      taskId: 'task-1',
      scheduleId: null,
      linkLabel: 'Ship floating widget'
    })
  })
})
