import { ipcMain } from 'electron'
import { z } from 'zod'
import { IPC } from '@shared/types/ipc'
import { deleteCategory, listCategories, upsertCategory } from '../db/repositories/categoryRepo'
import { upsertCategorySchema } from './schemas'

export function registerCategoryHandlers(): void {
  ipcMain.handle(IPC.categoryList, () => listCategories())

  ipcMain.handle(IPC.categoryUpsert, (_event, input) => upsertCategory(upsertCategorySchema.parse(input)))

  ipcMain.handle(IPC.categoryDelete, (_event, id) => deleteCategory(z.string().min(1).parse(id)))
}
