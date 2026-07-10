import type { BrowserWindow } from 'electron'
import { ipcMain } from 'electron'
import { IPC } from '@shared/types/ipc'
import type { PomodoroCommand, PomodoroSnapshot } from '@shared/types/ipc'
import { pomodoroSnapshotSchema, pomodoroCommandSchema } from '../ipc/schemas'

/**
 * 番茄钟跨窗中继（需求6）。主窗口渲染进程是唯一计时权威：
 *   - 主窗口 publishState → 缓存最新快照 + 转发给悬浮窗镜像
 *   - 悬浮窗 sendCommand → 转发给主窗口执行（pause/resume/stop/skip）
 * 这样两个渲染进程不各自计时，避免重复落库与状态漂移。
 */
let latestSnapshot: PomodoroSnapshot | null = null
let getMainWindow: () => BrowserWindow | null = () => null
let getWidgetWindow: () => BrowserWindow | null = () => null

export function initPomodoroBus(
  mainWindowGetter: () => BrowserWindow | null,
  widgetWindowGetter: () => BrowserWindow | null
): void {
  getMainWindow = mainWindowGetter
  getWidgetWindow = widgetWindowGetter

  ipcMain.on(IPC.pomodoroPublishState, (_event, raw) => {
    const snapshot = pomodoroSnapshotSchema.parse(raw)
    latestSnapshot = snapshot
    const widget = getWidgetWindow()
    if (widget && !widget.isDestroyed()) {
      widget.webContents.send(IPC.pomodoroStateChanged, snapshot)
    }
  })

  ipcMain.on(IPC.pomodoroSendCommand, (_event, raw) => {
    const command: PomodoroCommand = pomodoroCommandSchema.parse(raw)
    const main = getMainWindow()
    if (main && !main.isDestroyed()) {
      main.webContents.send(IPC.pomodoroCommandReceived, command)
    }
  })
}

/** 悬浮窗刚打开时，用缓存快照立即补一帧，避免空等下一次 publish。 */
export function pushLatestSnapshotTo(win: BrowserWindow): void {
  if (latestSnapshot && !win.isDestroyed()) {
    win.webContents.send(IPC.pomodoroStateChanged, latestSnapshot)
  }
}
