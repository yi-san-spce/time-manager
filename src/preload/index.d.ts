import { ElectronAPI } from '@electron-toolkit/preload'
import type { TimeManagerApi } from '@shared/types/ipc'

declare global {
  interface Window {
    electron: ElectronAPI
    api: TimeManagerApi
  }
}
