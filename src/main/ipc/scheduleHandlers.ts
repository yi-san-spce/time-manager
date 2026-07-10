import { ipcMain } from 'electron'
import { z } from 'zod'
import { IPC } from '@shared/types/ipc'
import {
  createSchedule,
  deleteSchedule,
  getSchedule,
  listSchedules,
  updateSchedule
} from '../db/repositories/scheduleRepo'
import { createScheduleSchema, updateScheduleSchema } from './schemas'
import { emitSchedulesChanged } from '../services/scheduleChangeBus'

export function registerScheduleHandlers(): void {
  ipcMain.handle(IPC.scheduleCreate, (_event, input) => {
    const created = createSchedule(createScheduleSchema.parse(input))
    emitSchedulesChanged()
    return created
  })

  ipcMain.handle(IPC.scheduleUpdate, (_event, input) => {
    const updated = updateSchedule(updateScheduleSchema.parse(input))
    emitSchedulesChanged()
    return updated
  })

  ipcMain.handle(IPC.scheduleDelete, (_event, id) => {
    deleteSchedule(z.string().min(1).parse(id))
    emitSchedulesChanged()
  })

  ipcMain.handle(IPC.scheduleList, () => listSchedules())

  ipcMain.handle(IPC.scheduleGet, (_event, id) => getSchedule(z.string().min(1).parse(id)))
}
