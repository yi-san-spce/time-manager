import { ipcMain, type BrowserWindow } from 'electron'
import { z } from 'zod'
import { IPC } from '@shared/types/ipc'
import {
  aggregateByApp,
  aggregateByDomain,
  aggregateByTask,
  aggregateByWindowTitle,
  createManualTimeEntry,
  deleteTimeEntry,
  getAppActivityDetail,
  linkTimeEntryToTask,
  listTimeEntries,
  mergeTimeEntries,
  updateTimeEntry
} from '../db/repositories/timeEntryRepo'
import { getActivityNote, saveActivityNote } from '../db/repositories/activityNoteRepo'
import { summarizeAppActivity } from '../services/activitySummaryService'
import {
  activityDetailSchema,
  createManualTimeEntrySchema,
  linkTimeEntryToTaskSchema,
  listTimeEntriesSchema,
  mergeTimeEntriesSchema,
  saveActivityNoteSchema,
  statsQuerySchema,
  summarizeActivitySchema,
  updateTimeEntrySchema
} from './schemas'

export function registerTimeEntryHandlers(): void {
  ipcMain.handle(IPC.timeEntryList, (_event, input) => {
    const { rangeStart, rangeEnd } = listTimeEntriesSchema.parse(input)
    return listTimeEntries(rangeStart, rangeEnd)
  })

  ipcMain.handle(IPC.timeEntryCreateManual, (_event, input) =>
    createManualTimeEntry(createManualTimeEntrySchema.parse(input))
  )

  ipcMain.handle(IPC.timeEntryUpdate, (_event, input) => updateTimeEntry(updateTimeEntrySchema.parse(input)))

  ipcMain.handle(IPC.timeEntryMerge, (_event, input) => mergeTimeEntries(mergeTimeEntriesSchema.parse(input)))

  ipcMain.handle(IPC.timeEntryLinkToTask, (_event, input) =>
    linkTimeEntryToTask(linkTimeEntryToTaskSchema.parse(input))
  )

  ipcMain.handle(IPC.timeEntryDelete, (_event, id) => deleteTimeEntry(z.string().min(1).parse(id)))

  ipcMain.handle(IPC.statsQuery, (_event, input) => {
    const { rangeStart, rangeEnd } = statsQuerySchema.parse(input)
    const byApp = aggregateByApp(rangeStart, rangeEnd)
    const byDomain = aggregateByDomain(rangeStart, rangeEnd)
    const byWindowTitle = aggregateByWindowTitle(rangeStart, rangeEnd)
    const byTask = aggregateByTask(rangeStart, rangeEnd)
    const totalMinutes = byApp.reduce((sum, b) => sum + b.minutes, 0)
    return { totalMinutes, byApp, byDomain, byWindowTitle, byTask }
  })

  ipcMain.handle(IPC.activityDetail, (_event, input) => {
    const { appName, rangeStart, rangeEnd } = activityDetailSchema.parse(input)
    const { targets, segments, totalMinutes } = getAppActivityDetail(appName, rangeStart, rangeEnd)
    return {
      appName,
      totalMinutes,
      targets,
      segments
    }
  })

  ipcMain.handle(IPC.activityNoteGet, (_event, scopeKey) =>
    getActivityNote(z.string().min(1).parse(scopeKey))
  )

  ipcMain.handle(IPC.activityNoteSave, (_event, input) => {
    const { scopeKey, note } = saveActivityNoteSchema.parse(input)
    return saveActivityNote(scopeKey, note)
  })

  ipcMain.handle(IPC.activitySummarize, (_event, input) => {
    const { appName, rangeStart, rangeEnd } = summarizeActivitySchema.parse(input)
    return summarizeAppActivity({ appName, rangeStart, rangeEnd })
  })
}

export function emitTimeEntryCreated(getWindow: () => BrowserWindow | null, entry: unknown): void {
  getWindow()?.webContents.send(IPC.eventTimeEntryNew, entry)
}
