import { describe, expect, it } from 'vitest'
import {
  DEFAULT_COMPACT_THRESHOLD_MS,
  layoutTimelineEntries,
  type TimelineEntryLike,
  type TimelineDayRange
} from './timelineLayout'

const HOUR = 60 * 60 * 1000
const MINUTE = 60 * 1000

function dayRange(): TimelineDayRange {
  const start = new Date(2026, 6, 10)
  start.setHours(0, 0, 0, 0)
  const end = new Date(2026, 6, 11)
  end.setHours(0, 0, 0, 0)
  return { rangeStart: start.getTime(), rangeEnd: end.getTime() }
}

function entry(id: string, startTime: number, endTime: number): TimelineEntryLike {
  return { id, startTime, endTime }
}

describe('layoutTimelineEntries', () => {
  it('keeps only intervals intersecting the half-open local day range', () => {
    const range = dayRange()
    const layouts = layoutTimelineEntries(
      [
        entry('before', range.rangeStart - HOUR, range.rangeStart),
        entry('at-start', range.rangeStart, range.rangeStart + HOUR),
        entry('inside', range.rangeStart + 12 * HOUR, range.rangeStart + 13 * HOUR),
        entry('at-end', range.rangeEnd, range.rangeEnd + HOUR)
      ],
      range
    )

    expect(layouts.map((item) => item.entry.id)).toEqual(['at-start', 'inside'])
    expect(layouts[0]).toMatchObject({ top: 0, lane: 0, laneCount: 1 })
    expect(layouts[0].height).toBeCloseTo(100 / 24)
    expect(layouts[1].top).toBeCloseTo(50)
  })

  it('clips entries crossing either midnight boundary before positioning them', () => {
    const range = dayRange()
    const layouts = layoutTimelineEntries(
      [
        entry('from-yesterday', range.rangeStart - HOUR, range.rangeStart + HOUR),
        entry('to-tomorrow', range.rangeEnd - HOUR, range.rangeEnd + HOUR)
      ],
      range
    )

    expect(layouts[0]).toMatchObject({
      visibleStartTime: range.rangeStart,
      visibleEndTime: range.rangeStart + HOUR,
      durationMs: HOUR,
      top: 0
    })
    expect(layouts[1]).toMatchObject({
      visibleStartTime: range.rangeEnd - HOUR,
      visibleEndTime: range.rangeEnd,
      durationMs: HOUR
    })
    expect(layouts[1].top).toBeCloseTo(100 - 100 / 24)
    expect(layouts[0].height).toBeCloseTo(100 / 24)
    expect(layouts[1].height).toBeCloseTo(100 / 24)
  })

  it('sorts entries and assigns reusable lanes to a connected overlap group', () => {
    const range = dayRange()
    const layouts = layoutTimelineEntries(
      [
        entry('third', range.rangeStart + 3 * HOUR, range.rangeStart + 5 * HOUR),
        entry('first', range.rangeStart + HOUR, range.rangeStart + 4 * HOUR),
        entry('second', range.rangeStart + 2 * HOUR, range.rangeStart + 3 * HOUR)
      ],
      range
    )

    expect(layouts.map((item) => item.entry.id)).toEqual(['first', 'second', 'third'])
    expect(layouts.map(({ lane, laneCount }) => ({ lane, laneCount }))).toEqual([
      { lane: 0, laneCount: 2 },
      { lane: 1, laneCount: 2 },
      { lane: 1, laneCount: 2 }
    ])
  })

  it('marks only short visible segments as compact, using a configurable threshold', () => {
    const range = dayRange()
    const layouts = layoutTimelineEntries(
      [
        entry('short', range.rangeStart, range.rangeStart + 4 * MINUTE),
        entry('long', range.rangeStart + HOUR, range.rangeStart + HOUR + 6 * MINUTE)
      ],
      range
    )

    expect(DEFAULT_COMPACT_THRESHOLD_MS).toBe(5 * MINUTE)
    expect(layouts.map((item) => item.isCompact)).toEqual([true, false])

    const custom = layoutTimelineEntries(
      [entry('custom', range.rangeStart, range.rangeStart + 6 * MINUTE)],
      range,
      { compactThresholdMs: 6 * MINUTE }
    )
    expect(custom[0].isCompact).toBe(true)
  })

  it('reserves lanes for visually expanded short records so they do not overlap', () => {
    const range = dayRange()
    const layouts = layoutTimelineEntries(
      [
        entry('first', range.rangeStart, range.rangeStart + MINUTE),
        entry('second', range.rangeStart + 2 * MINUTE, range.rangeStart + 3 * MINUTE)
      ],
      range,
      { minimumVisualDurationMs: 10 * MINUTE }
    )

    expect(layouts[0]).toMatchObject({
      durationMs: MINUTE,
      visualDurationMs: 10 * MINUTE,
      visualEndTime: range.rangeStart + 10 * MINUTE,
      lane: 0,
      laneCount: 2
    })
    expect(layouts[1]).toMatchObject({ lane: 1, laneCount: 2 })
    expect(layouts[0].height).toBeCloseTo((10 / (24 * 60)) * 100)
  })

  it('clips a visually expanded late-night block at the end of the day', () => {
    const range = dayRange()
    const layouts = layoutTimelineEntries(
      [entry('late', range.rangeEnd - MINUTE, range.rangeEnd)],
      range,
      { minimumVisualDurationMs: 10 * MINUTE }
    )

    expect(layouts[0]).toMatchObject({
      visibleEndTime: range.rangeEnd,
      visualEndTime: range.rangeEnd,
      visualDurationMs: MINUTE
    })
    expect(layouts[0].height).toBeCloseTo(100 / (24 * 60))
  })
})
