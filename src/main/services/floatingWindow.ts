import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

/** 悬浮 AI 助手小窗：始终置顶、无边框、复用同一渲染包的 #/floating-assistant 路由（需求7）。 */
let floatingWindow: BrowserWindow | null = null

const WIDTH = 400
const HEIGHT = 560
const MARGIN = 24

function preloadPath(): string {
  return join(__dirname, '../preload/index.js')
}

/** 打开或聚焦悬浮助手窗。默认停靠在主屏右下角。 */
export function openFloatingAssistant(): void {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.show()
    floatingWindow.focus()
    return
  }

  const { workArea } = screen.getPrimaryDisplay()
  const x = workArea.x + workArea.width - WIDTH - MARGIN
  const y = workArea.y + workArea.height - HEIGHT - MARGIN

  floatingWindow = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    x,
    y,
    minWidth: 320,
    minHeight: 400,
    show: false,
    frame: false,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: preloadPath(),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const win = floatingWindow
  win.setAlwaysOnTop(true, 'floating')

  win.on('ready-to-show', () => win.show())
  win.on('closed', () => {
    if (floatingWindow === win) floatingWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/floating-assistant`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'floating-assistant' })
  }
}

export function closeFloatingAssistant(): void {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.close()
  }
}

// ── 悬浮信息小窗（需求6：当前日程/任务/番茄/随心记）───────────────────────────

let widgetWindow: BrowserWindow | null = null
const WIDGET_WIDTH = 340
const WIDGET_HEIGHT = 560

export function getFloatingWidgetWindow(): BrowserWindow | null {
  return widgetWindow
}

/** 打开或聚焦悬浮信息小窗。停靠主屏右侧偏上，置顶级别 'screen-saver'（可压全屏应用）。 */
export function openFloatingWidget(onReady?: (win: BrowserWindow) => void): void {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.show()
    widgetWindow.focus()
    return
  }

  const { workArea } = screen.getPrimaryDisplay()
  const x = workArea.x + workArea.width - WIDGET_WIDTH - MARGIN
  const y = workArea.y + MARGIN

  widgetWindow = new BrowserWindow({
    width: WIDGET_WIDTH,
    height: WIDGET_HEIGHT,
    x,
    y,
    minWidth: 300,
    minHeight: 360,
    show: false,
    frame: false,
    // `backgroundColor: transparent` alone still leaves an opaque native surface on Windows.
    // The widget's rounded CSS shell needs a genuinely transparent BrowserWindow behind it.
    transparent: true,
    hasShadow: false,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: preloadPath(),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const win = widgetWindow
  // 'screen-saver' 级别可压住全屏应用（计划要求），比 'floating' 更高
  win.setAlwaysOnTop(true, 'screen-saver')

  win.on('ready-to-show', () => {
    win.show()
    onReady?.(win)
  })
  win.on('closed', () => {
    if (widgetWindow === win) widgetWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/floating-widget`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'floating-widget' })
  }
}

export function closeFloatingWidget(): void {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.close()
  }
}
