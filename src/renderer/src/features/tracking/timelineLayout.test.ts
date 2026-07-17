import { describe, expect, it } from 'vitest'
import {
  DEFAULT_COMPACT_THRESHOLD_MS,
  getAnchoredHorizontalTimelineScrollLeft,
  layoutHorizontalTimelineEntries,
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

describe('layoutHorizontalTimelineEntries', () => {
  it('keeps adjacent short segments in one chronological row', () => {
    const range = dayRange()
    const layouts = layoutHorizontalTimelineEntries(
      [
        entry('first', range.rangeStart, range.rangeStart + 30 * 1000),
        entry('second', range.rangeStart + 30 * 1000, range.rangeStart + MINUTE)
      ],
      range,
      { pixelsPerHour: 120 }
    )

    expect(layouts.map(({ row, rowCount }) => ({ row, rowCount }))).toEqual([
      { row: 0, rowCount: 1 },
      { row: 0, rowCount: 1 }
    ])
    expect(layouts.map((item) => item.renderMode)).toEqual(['marker', 'marker'])
    expect(layouts[0]).toMatchObject({ leftPx: 0, actualWidthPx: 1, renderWidthPx: 3 })
  })

  it('uses another row only for real overlap and preserves horizontal proportions', () => {
    const range = dayRange()
    const layouts = layoutHorizontalTimelineEntries(
      [
        entry('long', range.rangeStart + HOUR, range.rangeStart + 2 * HOUR),
        entry('overlap', range.rangeStart + HOUR + 30 * MINUTE, range.rangeStart + 2 * HOUR + 30 * MINUTE)
      ],
      range,
      { pixelsPerHour: 120 }
    )

    expect(layouts.map(({ row, rowCount }) => ({ row, rowCount }))).toEqual([
      { row: 0, rowCount: 2 },
      { row: 1, rowCount: 2 }
    ])
    expect(layouts[0]).toMatchObject({ leftPx: 120, actualWidthPx: 120, renderMode: 'card' })
    expect(layouts[1]).toMatchObject({ leftPx: 180, actualWidthPx: 120, renderMode: 'card' })
  })

  it('clips at midnight and changes readable mode with zoom', () => {
    const range = dayRange()
    const source = entry('cross-day', range.rangeStart - HOUR, range.rangeStart + 5 * MINUTE)
    const compact = layoutHorizontalTimelineEntries([source], range, { pixelsPerHour: 120 })[0]
    const card = layoutHorizontalTimelineEntries([source], range, { pixelsPerHour: 1536 })[0]

    expect(compact).toMatchObject({ visibleStartTime: range.rangeStart, leftPx: 0, actualWidthPx: 10, renderMode: 'marker' })
    expect(card).toMatchObject({ actualWidthPx: 128, renderMode: 'card' })
  })

  it('uses marker, compact-label, and full-card modes at readable widths', () => {
    const range = dayRange()
    const layouts = layoutHorizontalTimelineEntries(
      [
        entry('marker', range.rangeStart, range.rangeStart + 8 * MINUTE),
        entry('compact', range.rangeStart + HOUR, range.rangeStart + HOUR + 35 * MINUTE),
        entry('card', range.rangeStart + 2 * HOUR, range.rangeStart + 2 * HOUR + 2 * HOUR)
      ],
      range,
      { pixelsPerHour: 60 }
    )

    expect(layouts.map((item) => item.renderMode)).toEqual(['marker', 'compact', 'card'])
  })
})

describe('getAnchoredHorizontalTimelineScrollLeft', () => {
  it('keeps the minute under the cursor fixed while zooming', () => {
    const currentPixelsPerHour = 240
    const nextPixelsPerHour = 7200
    const scrollLeftPx = 440
    const viewportOffsetPx = 280
    const result = getAnchoredHorizontalTimelineScrollLeft({
      scrollLeftPx,
      viewportOffsetPx,
      currentPixelsPerHour,
      nextPixelsPerHour,
      contentWidthPx: 24 * nextPixelsPerHour,
      viewportWidthPx: 800
    })

    const hourBefore = (scrollLeftPx + viewportOffsetPx) / currentPixelsPerHour
    const hourAfter = (result + viewportOffsetPx) / nextPixelsPerHour
    expect(hourAfter).toBeCloseTo(hourBefore)
  })

  it('clamps an anchored zoom at the beginning and end of the day', () => {
    const common = {
      currentPixelsPerHour: 240,
      nextPixelsPerHour: 7200,
      contentWidthPx: 24 * 7200,
      viewportWidthPx: 800
    }

    expect(
      getAnchoredHorizontalTimelineScrollLeft({
        ...common,
        scrollLeftPx: 0,
        viewportOffsetPx: 0
      })
    ).toBe(0)
    expect(
      getAnchoredHorizontalTimelineScrollLeft({
        ...common,
        scrollLeftPx: 24 * 240 - common.viewportWidthPx,
        viewportOffsetPx: common.viewportWidthPx
      })
    ).toBe(common.contentWidthPx - common.viewportWidthPx)
  })
})
