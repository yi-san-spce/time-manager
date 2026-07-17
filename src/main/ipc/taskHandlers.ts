import { BrowserWindow, ipcMain } from 'electron'
import { z } from 'zod'
import { IPC } from '@shared/types/ipc'
import { createTask, deleteTask, getTask, getTaskDetail, listTasks, updateTask } from '../db/repositories/taskRepo'
import {
  createSubtask,
  deleteSubtask,
  reorderSubtasks,
  updateSubtask
} from '../db/repositories/subtaskRepo'
import { createTag, deleteTag, listTags, setTaskTags } from '../db/repositories/tagRepo'
import { getTaskQuickNote, setTaskQuickNote } from '../db/repositories/taskQuickNoteRepo'
import { emitWidgetContextChanged } from '../services/widgetContextBus'
import {
  createTaskSchema,
  updateTaskSchema,
  createSubtaskSchema,
  updateSubtaskSchema,
  reorderSubtasksSchema,
  createTagSchema,
  setTaskTagsSchema,
  taskQuickNoteInputSchema
} from './schemas'

export function registerTaskHandlers(): void {
  ipcMain.handle(IPC.taskCreate, (_event, input) => {
    const task = createTask(createTaskSchema.parse(input))
    emitWidgetContextChanged()
    return task
  })
  ipcMain.handle(IPC.taskUpdate, (_event, input) => {
    const task = updateTask(updateTaskSchema.parse(input))
    emitWidgetContextChanged()
    return task
  })
  ipcMain.handle(IPC.taskDelete, (_event, id) => {
    deleteTask(z.string().min(1).parse(id))
    emitWidgetContextChanged()
  })
  ipcMain.handle(IPC.taskList, () => listTasks())
  ipcMain.handle(IPC.taskGet, (_event, id) => getTaskDetail(z.string().min(1).parse(id)))

  ipcMain.handle(IPC.taskQuickNoteGet, (_event, rawTaskId) => {
    const taskId = z.string().min(1).parse(rawTaskId)
    requireExistingTask(taskId)
    return getTaskQuickNote(taskId)
  })

  ipcMain.handle(IPC.taskQuickNoteSet, (_event, input) => {
    const { taskId, text } = taskQuickNoteInputSchema.parse(input)
    requireExistingTask(taskId)
    const note = setTaskQuickNote(taskId, text)
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(IPC.eventTaskQuickNoteChanged, taskId)
      }
    }
    return note
  })

  ipcMain.handle(IPC.taskSetTags, (_event, input) => {
    const parsed = setTaskTagsSchema.parse(input)
    setTaskTags(parsed.taskId, parsed.tagIds)
    return getTaskDetail(parsed.taskId)
  })

  ipcMain.handle(IPC.subtaskCreate, (_event, input) => createSubtask(createSubtaskSchema.parse(input)))
  ipcMain.handle(IPC.subtaskUpdate, (_event, input) => updateSubtask(updateSubtaskSchema.parse(input)))
  ipcMain.handle(IPC.subtaskDelete, (_event, id) => deleteSubtask(z.string().min(1).parse(id)))
  ipcMain.handle(IPC.subtaskReorder, (_event, input) => {
    const parsed = reorderSubtasksSchema.parse(input)
    return reorderSubtasks(parsed.taskId, parsed.orderedIds)
  })

  ipcMain.handle(IPC.tagList, () => listTags())
  ipcMain.handle(IPC.tagCreate, (_event, input) => createTag(createTagSchema.parse(input)))
  ipcMain.handle(IPC.tagDelete, (_event, id) => deleteTag(z.string().min(1).parse(id)))
}

function requireExistingTask(taskId: string): void {
  if (!getTask(taskId)) {
    throw new Error(`Task not found: ${taskId}`)
  }
}
