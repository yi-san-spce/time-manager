import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC } from '@shared/types/ipc'

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  getAllWindows: vi.fn(),
  createTask: vi.fn(),
  deleteTask: vi.fn(),
  getTask: vi.fn(),
  getTaskDetail: vi.fn(),
  listTasks: vi.fn(),
  updateTask: vi.fn(),
  getTaskQuickNote: vi.fn(),
  setTaskQuickNote: vi.fn(),
  emitWidgetContextChanged: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: { handle: mocks.handle },
  BrowserWindow: { getAllWindows: mocks.getAllWindows }
}))
vi.mock('../db/repositories/taskRepo', () => ({
  createTask: mocks.createTask,
  deleteTask: mocks.deleteTask,
  getTask: mocks.getTask,
  getTaskDetail: mocks.getTaskDetail,
  listTasks: mocks.listTasks,
  updateTask: mocks.updateTask
}))
vi.mock('../db/repositories/taskQuickNoteRepo', () => ({
  getTaskQuickNote: mocks.getTaskQuickNote,
  setTaskQuickNote: mocks.setTaskQuickNote
}))
vi.mock('../db/repositories/subtaskRepo', () => ({
  createSubtask: vi.fn(),
  deleteSubtask: vi.fn(),
  reorderSubtasks: vi.fn(),
  updateSubtask: vi.fn()
}))
vi.mock('../db/repositories/tagRepo', () => ({
  createTag: vi.fn(),
  deleteTag: vi.fn(),
  listTags: vi.fn(),
  setTaskTags: vi.fn()
}))
vi.mock('../services/widgetContextBus', () => ({ emitWidgetContextChanged: mocks.emitWidgetContextChanged }))

import { registerTaskHandlers } from './taskHandlers'

function handlerFor(channel: string): (event: unknown, input: unknown) => unknown {
  const call = mocks.handle.mock.calls.find(([registered]) => registered === channel)
  return call?.[1] as (event: unknown, input: unknown) => unknown
}

beforeEach(() => {
  mocks.handle.mockReset()
  mocks.getAllWindows.mockReset()
  mocks.getTask.mockReset()
  mocks.getTaskQuickNote.mockReset()
  mocks.setTaskQuickNote.mockReset()
  mocks.emitWidgetContextChanged.mockReset()
  registerTaskHandlers()
})

describe('task quick-note IPC', () => {
  it('validates the task, persists the note, and broadcasts only the task ID', () => {
    const firstWindow = { isDestroyed: () => false, webContents: { send: vi.fn() } }
    const secondWindow = { isDestroyed: () => false, webContents: { send: vi.fn() } }
    mocks.getAllWindows.mockReturnValue([firstWindow, secondWindow])
    mocks.getTask.mockReturnValue({ id: 'task-1', status: 'pending' })
    mocks.setTaskQuickNote.mockReturnValue({ taskId: 'task-1', text: 'Remember to demo it', updatedAt: 42 })

    const result = handlerFor(IPC.taskQuickNoteSet)({}, { taskId: 'task-1', text: 'Remember to demo it' })

    expect(result).toEqual({ taskId: 'task-1', text: 'Remember to demo it', updatedAt: 42 })
    expect(mocks.setTaskQuickNote).toHaveBeenCalledWith('task-1', 'Remember to demo it')
    expect(firstWindow.webContents.send).toHaveBeenCalledWith(IPC.eventTaskQuickNoteChanged, 'task-1')
    expect(secondWindow.webContents.send).toHaveBeenCalledWith(IPC.eventTaskQuickNoteChanged, 'task-1')
  })

  it('does not disclose or create notes for a task that does not exist', () => {
    mocks.getTask.mockReturnValue(null)

    expect(() => handlerFor(IPC.taskQuickNoteGet)({}, 'missing-task')).toThrow('Task not found')
    expect(mocks.getTaskQuickNote).not.toHaveBeenCalled()
  })
})
