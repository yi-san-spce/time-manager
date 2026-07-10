import { describe, expect, it, vi } from 'vitest'
import { IPC } from '@shared/types/ipc'

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  openExternal: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: { handle: mocks.handle },
  shell: { openExternal: mocks.openExternal }
}))

import { openSafeExternalHost, registerExternalLinkHandlers } from './externalLinkHandlers'

describe('openSafeExternalHost', () => {
  it('opens only the canonical HTTPS URL', async () => {
    const openExternal = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined)

    await openSafeExternalHost('WWW.Example.COM', openExternal)

    expect(openExternal).toHaveBeenCalledWith('https://www.example.com')
  })

  it('rejects URLs and never invokes the shell callback', async () => {
    const openExternal = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined)

    await expect(openSafeExternalHost('https://example.com', openExternal)).rejects.toThrow(
      'Invalid external hostname'
    )
    expect(openExternal).not.toHaveBeenCalled()
  })
})

describe('registerExternalLinkHandlers', () => {
  it('registers a hostname-only IPC handler', async () => {
    mocks.handle.mockReset()
    mocks.openExternal.mockReset().mockResolvedValue(undefined)

    registerExternalLinkHandlers()

    expect(mocks.handle).toHaveBeenCalledWith(IPC.activityOpenHost, expect.any(Function))
    const handler = mocks.handle.mock.calls[0]?.[1] as
      | ((event: unknown, host: unknown) => Promise<void>)
      | undefined

    await handler?.({}, 'example.com')
    expect(mocks.openExternal).toHaveBeenCalledWith('https://example.com')

    await expect(handler?.({}, 'example.com/path')).rejects.toThrow('Invalid external hostname')
    expect(mocks.openExternal).toHaveBeenCalledTimes(1)
  })
})
