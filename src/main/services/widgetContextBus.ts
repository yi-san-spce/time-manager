import { BrowserWindow } from 'electron'
import { IPC } from '@shared/types/ipc'

/** Broadcasts that the floating widget's derived schedule/task context should be reloaded. */
export function emitWidgetContextChanged(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC.eventWidgetContextChanged)
    }
  }
}
