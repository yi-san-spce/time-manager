import { ipcMain } from 'electron'
import { z } from 'zod'
import { IPC } from '@shared/types/ipc'
import { createTask, deleteTask, getTaskDetail, listTasks, updateTask } from '../db/repositories/taskRepo'
import {
  createSubtask,
  deleteSubtask,
  reorderSubtasks,
  updateSubtask
} from '../db/repositories/subtaskRepo'
import { createTag, deleteTag, listTags, setTaskTags } from '../db/repositories/tagRepo'
import {
  createTaskSchema,
  updateTaskSchema,
  createSubtaskSchema,
  updateSubtaskSchema,
  reorderSubtasksSchema,
  createTagSchema,
  setTaskTagsSchema
} from './schemas'

export function registerTaskHandlers(): void {
  ipcMain.handle(IPC.taskCreate, (_event, input) => createTask(createTaskSchema.parse(input)))
  ipcMain.handle(IPC.taskUpdate, (_event, input) => updateTask(updateTaskSchema.parse(input)))
  ipcMain.handle(IPC.taskDelete, (_event, id) => deleteTask(z.string().min(1).parse(id)))
  ipcMain.handle(IPC.taskList, () => listTasks())
  ipcMain.handle(IPC.taskGet, (_event, id) => getTaskDetail(z.string().min(1).parse(id)))

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
