import { describe, expect, it } from 'vitest'
import { applySample, flush, type AggregatorConfig, type AggregatorState } from './segmentAggregator'

const config: AggregatorConfig = { minSegmentSeconds: 30, maxSegmentMs: 5 * 60 * 1000 }
const empty: AggregatorState = { currentSegment: null }

describe('applySample', () => {
  it('opens a new segment on the first sample and closes nothing', () => {
    const result = applySample(empty, { appName: 'Code.exe', windowTitle: 'index.ts' }, 1000, config)
    expect(result.closedSegment).toBeNull()
    expect(result.nextState.currentSegment).toEqual({
      appName: 'Code.exe',
      windowTitle: 'index.ts',
      startTime: 1000
    })
  })

  it('does not close the segment while the same window stays active', () => {
    const afterFirst = applySample(empty, { appName: 'Code.exe', windowTitle: 'a.ts' }, 0, config)
    const afterSecond = applySample(
      afterFirst.nextState,
      { appName: 'Code.exe', windowTitle: 'a.ts' },
      10_000,
      config
    )
    expect(afterSecond.closedSegment).toBeNull()
    expect(afterSecond.nextState.currentSegment?.startTime).toBe(0)
  })

  it('closes the segment and opens a new one when the window changes', () => {
    const afterFirst = applySample(empty, { appName: 'Code.exe', windowTitle: 'a.ts' }, 0, config)
    const afterSwitch = applySample(
      afterFirst.nextState,
      { appName: 'chrome.exe', windowTitle: 'GitHub' },
      60_000,
      config
    )
    expect(afterSwitch.closedSegment).toEqual({
      appName: 'Code.exe',
      windowTitle: 'a.ts',
      startTime: 0,
      endTime: 60_000
    })
    expect(afterSwitch.nextState.currentSegment).toEqual({
      appName: 'chrome.exe',
      windowTitle: 'GitHub',
      startTime: 60_000
    })
  })

  it('retains the domain when a browser segment closes on a window change', () => {
    const afterFirst = applySample(
      empty,
      { appName: 'chrome.exe', windowTitle: 'GitHub', domain: 'github.com' },
      0,
      config
    )
    const afterSwitch = applySample(
      afterFirst.nextState,
      { appName: 'Code.exe', windowTitle: 'a.ts' },
      60_000,
      config
    )

    expect(afterSwitch.closedSegment).toEqual({
      appName: 'chrome.exe',
      windowTitle: 'GitHub',
      domain: 'github.com',
      startTime: 0,
      endTime: 60_000
    })
  })

  it('discards a segment shorter than minSegmentSeconds when the window changes', () => {
    const afterFirst = applySample(empty, { appName: 'Code.exe', windowTitle: 'a.ts' }, 0, config)
    // 只过了 5 秒，小于 minSegmentSeconds=30
    const afterSwitch = applySample(
      afterFirst.nextState,
      { appName: 'chrome.exe', windowTitle: 'GitHub' },
      5_000,
      config
    )
    expect(afterSwitch.closedSegment).toBeNull()
    expect(afterSwitch.nextState.currentSegment?.appName).toBe('chrome.exe')
  })

  it('commits and reopens a segment once it exceeds maxSegmentMs even without a window change', () => {
    const afterFirst = applySample(empty, { appName: 'Code.exe', windowTitle: 'a.ts' }, 0, config)
    const afterLongStay = applySample(
      afterFirst.nextState,
      { appName: 'Code.exe', windowTitle: 'a.ts' },
      config.maxSegmentMs,
      config
    )
    expect(afterLongStay.closedSegment).toEqual({
      appName: 'Code.exe',
      windowTitle: 'a.ts',
      startTime: 0,
      endTime: config.maxSegmentMs
    })
    expect(afterLongStay.nextState.currentSegment?.startTime).toBe(config.maxSegmentMs)
  })

  it('ignores a sample with no window info and keeps the current segment open', () => {
    const afterFirst = applySample(empty, { appName: 'Code.exe', windowTitle: 'a.ts' }, 0, config)
    const afterBlank = applySample(afterFirst.nextState, { appName: null, windowTitle: null }, 5_000, config)
    expect(afterBlank.closedSegment).toBeNull()
    expect(afterBlank.nextState).toBe(afterFirst.nextState)
  })

  it('starts no segment when the very first sample has no window info', () => {
    const result = applySample(empty, { appName: null, windowTitle: null }, 0, config)
    expect(result.closedSegment).toBeNull()
    expect(result.nextState.currentSegment).toBeNull()
  })
})

describe('flush', () => {
  it('closes the current segment if long enough', () => {
    const afterFirst = applySample(empty, { appName: 'Code.exe', windowTitle: 'a.ts' }, 0, config)
    const result = flush(afterFirst.nextState, 60_000, config.minSegmentSeconds)
    expect(result.closedSegment).toEqual({
      appName: 'Code.exe',
      windowTitle: 'a.ts',
      startTime: 0,
      endTime: 60_000
    })
    expect(result.nextState.currentSegment).toBeNull()
  })

  it('retains the domain while flushing a browser segment', () => {
    const afterFirst = applySample(
      empty,
      { appName: 'chrome.exe', windowTitle: 'GitHub', domain: 'github.com' },
      0,
      config
    )
    const result = flush(afterFirst.nextState, 60_000, config.minSegmentSeconds)

    expect(result.closedSegment).toEqual({
      appName: 'chrome.exe',
      windowTitle: 'GitHub',
      domain: 'github.com',
      startTime: 0,
      endTime: 60_000
    })
  })

  it('discards a too-short segment without emitting it', () => {
    const afterFirst = applySample(empty, { appName: 'Code.exe', windowTitle: 'a.ts' }, 0, config)
    const result = flush(afterFirst.nextState, 5_000, config.minSegmentSeconds)
    expect(result.closedSegment).toBeNull()
    expect(result.nextState.currentSegment).toBeNull()
  })

  it('is a no-op when there is no current segment', () => {
    const result = flush(empty, 1000, config.minSegmentSeconds)
    expect(result.closedSegment).toBeNull()
    expect(result.nextState).toBe(empty)
  })
})
