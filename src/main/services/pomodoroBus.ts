import type { BrowserWindow, WebContents } from 'electron'
import { ipcMain } from 'electron'
import { IPC } from '@shared/types/ipc'
import type {
  PomodoroCommand,
  PomodoroDispatchCommand,
  PomodoroResolvedStartCommand,
  PomodoroSnapshot
} from '@shared/types/ipc'
import { pomodoroSnapshotSchema, pomodoroCommandSchema } from '../ipc/schemas'
import { getTask } from '../db/repositories/taskRepo'
import { getSchedule } from '../db/repositories/scheduleRepo'

/**
 * The main-window renderer owns the timer. The main process only relays snapshots and commands,
 * while resolving floating-widget start requests against database records before they reach it.
 */
let latestSnapshot: PomodoroSnapshot | null = null
let getMainWindow: () => BrowserWindow | null = () => null
let getWidgetWindow: () => BrowserWindow | null = () => null

function isExpectedSender(sender: WebContents, getWindow: () => BrowserWindow | null): boolean {
  const window = getWindow()
  return Boolean(window && !window.isDestroyed() && sender === window.webContents)
}

/** Validates target IDs and turns an untrusted start request into a title-bearing timer command. */
export function resolvePomodoroCommand(command: PomodoroCommand): PomodoroDispatchCommand {
  if (typeof command === 'string') return command

  const task = command.taskId ? getTask(command.taskId) : null
  if (command.taskId && !task) {
    throw new Error(`Task not found: ${command.taskId}`)
  }
  if (task && (task.status === 'done' || task.status === 'cancelled')) {
    throw new Error(`Task is not focusable: ${task.id}`)
  }

  const schedule = command.scheduleId ? getSchedule(command.scheduleId) : null
  if (command.scheduleId && !schedule) {
    throw new Error(`Schedule not found: ${command.scheduleId}`)
  }
  if (schedule && schedule.status !== 'planned') {
    throw new Error(`Schedule is not focusable: ${schedule.id}`)
  }

  const labels = [task?.title, schedule?.title].filter((label): label is string => Boolean(label))
  const resolved: PomodoroResolvedStartCommand = {
    type: 'start',
    taskId: task?.id ?? null,
    scheduleId: schedule?.id ?? null,
    linkLabel: labels.join(' · ')
  }
  return resolved
}

export function initPomodoroBus(
  mainWindowGetter: () => BrowserWindow | null,
  widgetWindowGetter: () => BrowserWindow | null
): void {
  getMainWindow = mainWindowGetter
  getWidgetWindow = widgetWindowGetter

  ipcMain.on(IPC.pomodoroPublishState, (event, raw) => {
    if (!isExpectedSender(event.sender, getMainWindow)) return
    const snapshot = pomodoroSnapshotSchema.parse(raw)
    latestSnapshot = snapshot
    const widget = getWidgetWindow()
    if (widget && !widget.isDestroyed()) {
      widget.webContents.send(IPC.pomodoroStateChanged, snapshot)
    }
  })

  ipcMain.on(IPC.pomodoroSendCommand, (event, raw) => {
    if (!isExpectedSender(event.sender, getWidgetWindow)) return
    const command = resolvePomodoroCommand(pomodoroCommandSchema.parse(raw))
    const main = getMainWindow()
    if (main && !main.isDestroyed()) {
      main.webContents.send(IPC.pomodoroCommandReceived, command)
    }
  })
}

/** The widget receives the latest state immediately when it opens instead of waiting for a tick. */
export function pushLatestSnapshotTo(win: BrowserWindow): void {
  if (latestSnapshot && !win.isDestroyed()) {
    win.webContents.send(IPC.pomodoroStateChanged, latestSnapshot)
  }
}
