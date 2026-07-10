import { ipcMain, nativeTheme, type BrowserWindow } from 'electron'
import { IPC } from '@shared/types/ipc'
import type { PomodoroConfig, TrackingConfig, UIConfig } from '@shared/types/ipc'
import { getSetting, setSetting } from '../db/repositories/settingsRepo'
import { uiConfigSchema, trackingConfigSchema, pomodoroConfigSchema } from './schemas'

const THEME_MODE_KEY = 'themeMode'
const TRACKING_INTERVAL_KEY = 'trackingIntervalSeconds'
const TRACKING_MIN_SEGMENT_KEY = 'trackingMinSegmentSeconds'
const POMODORO_KEY = 'pomodoroConfig'

const DEFAULT_TRACKING_CONFIG: TrackingConfig = { intervalSeconds: 10, minSegmentSeconds: 30 }
const DEFAULT_POMODORO_CONFIG: PomodoroConfig = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4
}

function getPomodoroConfig(): PomodoroConfig {
  const stored = getSetting(POMODORO_KEY)
  if (!stored) return DEFAULT_POMODORO_CONFIG
  try {
    return { ...DEFAULT_POMODORO_CONFIG, ...JSON.parse(stored) }
  } catch {
    return DEFAULT_POMODORO_CONFIG
  }
}

function getUIConfig(): UIConfig {
  const stored = getSetting(THEME_MODE_KEY)
  return { themeMode: stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system' }
}

function applyThemeMode(themeMode: UIConfig['themeMode']): void {
  nativeTheme.themeSource = themeMode
}

export function getTrackingConfig(): TrackingConfig {
  const interval = getSetting(TRACKING_INTERVAL_KEY)
  const minSegment = getSetting(TRACKING_MIN_SEGMENT_KEY)
  return {
    intervalSeconds: interval ? Number(interval) : DEFAULT_TRACKING_CONFIG.intervalSeconds,
    minSegmentSeconds: minSegment ? Number(minSegment) : DEFAULT_TRACKING_CONFIG.minSegmentSeconds
  }
}

function setTrackingConfig(config: TrackingConfig): void {
  setSetting(TRACKING_INTERVAL_KEY, String(config.intervalSeconds))
  setSetting(TRACKING_MIN_SEGMENT_KEY, String(config.minSegmentSeconds))
}

export function registerSettingsHandlers(
  getWindow: () => BrowserWindow | null,
  onTrackingConfigChanged?: (config: TrackingConfig) => void
): void {
  applyThemeMode(getUIConfig().themeMode)

  ipcMain.handle(IPC.settingsGetUIConfig, () => getUIConfig())

  ipcMain.handle(IPC.settingsSetUIConfig, (_event, input) => {
    const parsed = uiConfigSchema.parse(input)
    setSetting(THEME_MODE_KEY, parsed.themeMode)
    applyThemeMode(parsed.themeMode)
    return getUIConfig()
  })

  ipcMain.handle(IPC.trackingGetConfig, () => getTrackingConfig())

  ipcMain.handle(IPC.trackingSetConfig, (_event, input) => {
    const parsed = trackingConfigSchema.parse(input)
    setTrackingConfig(parsed)
    onTrackingConfigChanged?.(parsed)
    return getTrackingConfig()
  })

  ipcMain.handle(IPC.pomodoroGetConfig, () => getPomodoroConfig())

  ipcMain.handle(IPC.pomodoroSetConfig, (_event, input) => {
    const parsed = pomodoroConfigSchema.parse(input)
    setSetting(POMODORO_KEY, JSON.stringify(parsed))
    return getPomodoroConfig()
  })

  nativeTheme.on('updated', () => {
    const window = getWindow()
    window?.webContents.send(
      IPC.eventEffectiveThemeChanged,
      nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    )
  })
}
