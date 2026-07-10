import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { closeDb } from './db/connection'
import { registerScheduleHandlers } from './ipc/scheduleHandlers'
import { registerTaskHandlers } from './ipc/taskHandlers'
import { registerCategoryHandlers } from './ipc/categoryHandlers'
import { registerSettingsHandlers, getTrackingConfig } from './ipc/settingsHandlers'
import { registerRecurrenceHandlers } from './ipc/recurrenceHandlers'
import { registerTimeEntryHandlers, emitTimeEntryCreated } from './ipc/timeEntryHandlers'
import { registerExternalLinkHandlers } from './ipc/externalLinkHandlers'
import { registerAIHandlers } from './ipc/aiHandlers'
import { registerReportHandlers } from './ipc/reportHandlers'
import { registerAgentHandlers } from './ipc/agentHandlers'
import { TrackingService } from './services/trackingService'
import { ReminderScheduler } from './services/reminderScheduler'
import { onSchedulesChanged } from './services/scheduleChangeBus'
import { loadActiveWindow } from './services/activeWindowLoader'
import {
  openFloatingAssistant,
  closeFloatingAssistant,
  openFloatingWidget,
  closeFloatingWidget,
  getFloatingWidgetWindow
} from './services/floatingWindow'
import { initPomodoroBus, pushLatestSnapshotTo } from './services/pomodoroBus'
import { getWidgetContext } from './services/widgetContextService'
import { getQuickNote, setQuickNote } from './db/repositories/quickNoteRepo'
import { quickNoteSchema } from './ipc/schemas'
import { IPC } from '@shared/types/ipc'

let mainWindow: BrowserWindow | null = null
let trackingService: TrackingService | null = null
let reminderScheduler: ReminderScheduler | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    // 无边框 + 自定义标题栏，让窗控与侧边栏毛玻璃融合（UI规格第一组）
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const window = mainWindow

  window.on('ready-to-show', () => {
    window.show()
  })

  window.on('maximize', () => window.webContents.send('window:maximizedChanged', true))
  window.on('unmaximize', () => window.webContents.send('window:maximizedChanged', false))

  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.timemanager.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  reminderScheduler = new ReminderScheduler(() => mainWindow)
  onSchedulesChanged(() => reminderScheduler?.rebuild())

  registerScheduleHandlers()
  registerTaskHandlers()
  registerCategoryHandlers()
  registerRecurrenceHandlers()
  registerTimeEntryHandlers()
  registerExternalLinkHandlers()
  registerAIHandlers()
  registerReportHandlers()
  registerAgentHandlers()
  registerSettingsHandlers(
    () => mainWindow,
    (config) => trackingService?.updateConfig(config)
  )

  // 自定义标题栏的窗口控制（最小化/最大化-还原/关闭）
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:toggleMaximize', () => {
    if (!mainWindow) return false
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
      return false
    }
    mainWindow.maximize()
    return true
  })
  ipcMain.handle('window:close', () => mainWindow?.close())
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)

  // 悬浮 AI 助手小窗（需求7）
  ipcMain.handle(IPC.floatingAssistantOpen, () => openFloatingAssistant())
  ipcMain.handle(IPC.floatingAssistantClose, () => closeFloatingAssistant())

  // 悬浮信息小窗（需求6）：当前日程/任务/番茄/随心记
  initPomodoroBus(
    () => mainWindow,
    () => getFloatingWidgetWindow()
  )
  ipcMain.handle(IPC.floatingWidgetOpen, () => openFloatingWidget((win) => pushLatestSnapshotTo(win)))
  ipcMain.handle(IPC.floatingWidgetClose, () => closeFloatingWidget())
  ipcMain.handle(IPC.widgetGetContext, () => getWidgetContext())
  ipcMain.handle(IPC.quickNoteGet, () => getQuickNote())
  ipcMain.handle(IPC.quickNoteSet, (_event, raw) => setQuickNote(quickNoteSchema.parse(raw)))

  createWindow()

  reminderScheduler.start()

  void loadActiveWindow().then((getActiveWindow) => {
    trackingService = new TrackingService(getTrackingConfig(), getActiveWindow, (entry) =>
      emitTimeEntryCreated(() => mainWindow, entry)
    )
    trackingService.start()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  trackingService?.stop()
  reminderScheduler?.stop()
  closeFloatingAssistant()
  closeFloatingWidget()
  closeDb()
})
