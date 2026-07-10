import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TimeEntry } from '@shared/types/models'

const mocks = vi.hoisted(() => ({
  powerMonitorOn: vi.fn(),
  createAutoTimeEntry: vi.fn()
}))

vi.mock('electron', () => ({
  powerMonitor: { on: mocks.powerMonitorOn }
}))

vi.mock('../db/repositories/timeEntryRepo', () => ({
  createAutoTimeEntry: mocks.createAutoTimeEntry
}))

import { TrackingService } from './trackingService'

interface AutoTimeEntryInput {
  startTime: number
  endTime: number
  appName: string | null
  windowTitle: string | null
  domain?: string | null
}

function invokeSample(service: TrackingService): Promise<void> {
  return (service as unknown as { sample: () => Promise<void> }).sample()
}

beforeEach(() => {
  mocks.powerMonitorOn.mockReset()
  mocks.createAutoTimeEntry.mockReset()
  mocks.createAutoTimeEntry.mockImplementation((input: AutoTimeEntryInput): TimeEntry => ({
    id: 'created-entry',
    taskId: null,
    startTime: input.startTime,
    endTime: input.endTime,
    source: 'auto',
    appName: input.appName,
    windowTitle: input.windowTitle,
    domain: input.domain ?? null,
    note: null,
    createdAt: 0,
    updatedAt: 0
  }))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('TrackingService domain persistence', () => {
  it('persists the closed segment domain after a window switch', async () => {
    let now = 0
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const getActiveWindow = vi
      .fn()
      .mockResolvedValueOnce({
        title: 'Issue - github.com - Google Chrome',
        owner: { name: 'chrome.exe' }
      })
      .mockResolvedValueOnce({ title: 'notes.ts', owner: { name: 'Code.exe' } })
    const service = new TrackingService(
      { intervalSeconds: 10, minSegmentSeconds: 30 },
      getActiveWindow,
      vi.fn()
    )

    await invokeSample(service)
    now = 60_000
    await invokeSample(service)

    expect(mocks.createAutoTimeEntry).toHaveBeenCalledWith({
      startTime: 0,
      endTime: 60_000,
      appName: 'chrome.exe',
      windowTitle: 'Issue - github.com - Google Chrome',
      domain: 'github.com'
    })
  })

  it('persists the current domain when power-monitor flushes the segment', async () => {
    let now = 0
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const service = new TrackingService(
      { intervalSeconds: 10, minSegmentSeconds: 30 },
      vi.fn().mockResolvedValue({
        title: 'Docs - developer.mozilla.org - Mozilla Firefox',
        owner: { name: 'firefox.exe' }
      }),
      vi.fn()
    )

    await invokeSample(service)
    now = 60_000
    const suspendListener = mocks.powerMonitorOn.mock.calls.find(([event]) => event === 'suspend')?.[1] as
      | (() => void)
      | undefined

    expect(suspendListener).toBeTypeOf('function')
    suspendListener?.()

    expect(mocks.createAutoTimeEntry).toHaveBeenCalledWith({
      startTime: 0,
      endTime: 60_000,
      appName: 'firefox.exe',
      windowTitle: 'Docs - developer.mozilla.org - Mozilla Firefox',
      domain: 'developer.mozilla.org'
    })
  })
})
