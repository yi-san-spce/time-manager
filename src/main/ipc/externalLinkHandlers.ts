import { ipcMain, shell } from 'electron'
import { IPC } from '@shared/types/ipc'
import { buildSafeExternalUrl } from '../services/safeExternalHost'

type OpenExternal = (url: string) => Promise<void>

/**
 * Opens only a validated hostname over HTTPS. The renderer must never be able
 * to choose a protocol, path, port, or another shell target.
 */
export async function openSafeExternalHost(
  rawHost: unknown,
  openExternal: OpenExternal = shell.openExternal
): Promise<void> {
  const url = buildSafeExternalUrl(rawHost)
  if (!url) {
    throw new Error('Invalid external hostname')
  }
  await openExternal(url)
}

export function registerExternalLinkHandlers(): void {
  ipcMain.handle(IPC.activityOpenHost, (_event, rawHost: unknown) => openSafeExternalHost(rawHost))
}
