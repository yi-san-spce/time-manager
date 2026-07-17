/**
 * A half-open local-time range for one visible calendar day: [rangeStart, rangeEnd).
 * Values are epoch milliseconds. The caller is responsible for constructing the
 * boundaries in the user's local timezone.
 */
export interface TimelineDayRange {
  rangeStart: number
  rangeEnd: number
}

/** The subset of a time entry required to position it in the timeline. */
export interface TimelineEntryLike {
  id: string
  startTime: number
  endTime: number
}

export interface TimelineLayoutOptions {
  /**
   * Visible segments at or below this duration should use the compact timeline
   * treatment. Defaults to five minutes.
   */
  compactThresholdMs?: number
  /**
   * Minimum rendered duration for a block. The real start/end timestamps stay
   * unchanged, but lane allocation also uses this visual interval so adjacent
   * short records do not paint on top of one another. Defaults to zero.
   */
  minimumVisualDurationMs?: number
}

/** Five minutes keeps very short automatic tracking segments readable. */
export const DEFAULT_COMPACT_THRESHOLD_MS = 5 * 60 * 1000

const HOUR_MS = 60 * 60 * 1000

export type HorizontalTimelineRenderMode = 'marker' | 'compact' | 'card'

export interface HorizontalTimelineLayoutOptions {
  /** Horizontal density of the visible time ruler. */
  pixelsPerHour: number
  /** Minimum hit target for very short segments. Defaults to 3px. */
  markerWidthPx?: number
  /** Width at which a compact, one-line application label can be shown. Defaults to 34px. */
  compactWidthPx?: number
  /** Width at which an application label and its metadata can be shown. Defaults to 104px. */
  cardWidthPx?: number
}

export interface HorizontalTimelineLayoutItem<T extends TimelineEntryLike> {
  entry: T
  visibleStartTime: number
  visibleEndTime: number
  durationMs: number
  leftPx: number
  actualWidthPx: number
  renderWidthPx: number
  /** Only truly overlapping intervals are assigned separate rows. */
  row: number
  /** Maximum rows needed by this day. Shared by every item. */
  rowCount: number
  renderMode: HorizontalTimelineRenderMode
}

export interface HorizontalTimelineZoomAnchor {
  /** The horizontal scroll offset before changing scale. */
  scrollLeftPx: number
  /** The cursor's x offset inside the scroll viewport. */
  viewportOffsetPx: number
  /** The scale used before changing zoom. */
  currentPixelsPerHour: number
  /** The scale to apply after changing zoom. */
  nextPixelsPerHour: number
  /** Total width of the zoomed timeline surface. */
  contentWidthPx: number
  /** Visible width of the scroll viewport. */
  viewportWidthPx: number
}

export interface TimelineLayoutItem<T extends TimelineEntryLike> {
  /** The original entry; it is never mutated by the layout routine. */
  entry: T
  /** The entry interval intersected with the visible day range. */
  visibleStartTime: number
  visibleEndTime: number
  /** The length of the visible (possibly clipped) interval. */
  durationMs: number
  /** End of the interval actually reserved for painting this block. */
  visualEndTime: number
  /** Rendered duration after applying the optional visual minimum. */
  visualDurationMs: number
  /** Top position as a percentage of the visible day, from 0 through 100. */
  top: number
  /** Rendered height as a percentage of the visible day, from 0 through 100. */
  height: number
  /** Zero-based column within its overlap group. */
  lane: number
  /** Number of columns used by the item's connected overlap group. */
  laneCount: number
  /** Whether the visible interval should use a compact visual treatment. */
  isCompact: boolean
}

interface ClippedEntry<T extends TimelineEntryLike> {
  entry: T
  visibleStartTime: number
  visibleEndTime: number
  durationMs: number
  visualEndTime: number
  visualDurationMs: number
  originalIndex: number
}

function compareClippedEntries<T extends TimelineEntryLike>(a: ClippedEntry<T>, b: ClippedEntry<T>): number {
  if (a.visibleStartTime !== b.visibleStartTime) {
    return a.visibleStartTime - b.visibleStartTime
  }
  if (a.visibleEndTime !== b.visibleEndTime) {
    return a.visibleEndTime - b.visibleEndTime
  }
  if (a.entry.id !== b.entry.id) {
    return a.entry.id < b.entry.id ? -1 : 1
  }
  return a.originalIndex - b.originalIndex
}

/**
 * Produces CSS-ready vertical positions for entries visible in one local day.
 *
 * Intervals use half-open semantics, so an entry ending exactly when another
 * starts can reuse the same lane. A connected overlap group has a consistent
 * lane count so entries remain aligned while scrolling through the timeline.
 */
export function layoutTimelineEntries<T extends TimelineEntryLike>(
  entries: readonly T[],
  range: TimelineDayRange,
  options: TimelineLayoutOptions = {}
): TimelineLayoutItem<T>[] {
  const { rangeStart, rangeEnd } = range
  if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeEnd <= rangeStart) {
    throw new RangeError('Timeline range must have a finite, positive duration')
  }

  const requestedCompactThreshold = options.compactThresholdMs ?? DEFAULT_COMPACT_THRESHOLD_MS
  const compactThresholdMs = Number.isFinite(requestedCompactThreshold)
    ? Math.max(0, requestedCompactThreshold)
    : DEFAULT_COMPACT_THRESHOLD_MS
  const requestedMinimumVisualDuration = options.minimumVisualDurationMs ?? 0
  const minimumVisualDurationMs = Number.isFinite(requestedMinimumVisualDuration)
    ? Math.max(0, requestedMinimumVisualDuration)
    : 0
  const dayDurationMs = rangeEnd - rangeStart
  const clipped = entries
    .map((entry, originalIndex): ClippedEntry<T> | null => {
      if (!Number.isFinite(entry.startTime) || !Number.isFinite(entry.endTime) || entry.endTime <= entry.startTime) {
        return null
      }

      const visibleStartTime = Math.max(entry.startTime, rangeStart)
      const visibleEndTime = Math.min(entry.endTime, rangeEnd)
      if (visibleEndTime <= visibleStartTime) {
        return null
      }

      const durationMs = visibleEndTime - visibleStartTime
      const visualDurationMs = Math.min(
        rangeEnd - visibleStartTime,
        Math.max(durationMs, minimumVisualDurationMs)
      )

      return {
        entry,
        visibleStartTime,
        visibleEndTime,
        durationMs,
        visualEndTime: visibleStartTime + visualDurationMs,
        visualDurationMs,
        originalIndex
      }
    })
    .filter((entry): entry is ClippedEntry<T> => entry !== null)
    .sort(compareClippedEntries)

  const layouts: TimelineLayoutItem<T>[] = []
  let componentStart = 0

  while (componentStart < clipped.length) {
    let componentEnd = clipped[componentStart].visualEndTime
    let componentEndIndex = componentStart + 1

    // A component extends through entries which overlap it directly or through
    // another entry. Entries that only touch at an endpoint start a new group.
    while (
      componentEndIndex < clipped.length &&
      clipped[componentEndIndex].visibleStartTime < componentEnd
    ) {
      componentEnd = Math.max(componentEnd, clipped[componentEndIndex].visualEndTime)
      componentEndIndex += 1
    }

    const laneEnds: number[] = []
    const componentLayouts: TimelineLayoutItem<T>[] = []

    for (let index = componentStart; index < componentEndIndex; index += 1) {
      const item = clipped[index]
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= item.visibleStartTime)
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push(item.visualEndTime)
      } else {
        laneEnds[lane] = item.visualEndTime
      }

      componentLayouts.push({
        entry: item.entry,
        visibleStartTime: item.visibleStartTime,
        visibleEndTime: item.visibleEndTime,
        durationMs: item.durationMs,
        visualEndTime: item.visualEndTime,
        visualDurationMs: item.visualDurationMs,
        top: ((item.visibleStartTime - rangeStart) / dayDurationMs) * 100,
        height: (item.visualDurationMs / dayDurationMs) * 100,
        lane,
        laneCount: 0,
        isCompact: item.durationMs <= compactThresholdMs
      })
    }

    const laneCount = laneEnds.length
    layouts.push(...componentLayouts.map((item) => ({ ...item, laneCount })))
    componentStart = componentEndIndex
  }

  return layouts
}

/**
 * Lays a day out left-to-right. Unlike the legacy vertical presentation, the
 * row allocator uses only the real interval: adjacent short samples stay in a
 * single chronological track, while zoom controls their readable width.
 */
export function layoutHorizontalTimelineEntries<T extends TimelineEntryLike>(
  entries: readonly T[],
  range: TimelineDayRange,
  options: HorizontalTimelineLayoutOptions
): HorizontalTimelineLayoutItem<T>[] {
  const { rangeStart, rangeEnd } = range
  if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeEnd <= rangeStart) {
    throw new RangeError('Timeline range must have a finite, positive duration')
  }
  if (!Number.isFinite(options.pixelsPerHour) || options.pixelsPerHour <= 0) {
    throw new RangeError('pixelsPerHour must be a finite, positive number')
  }

  const markerWidthPx = finiteNonNegative(options.markerWidthPx, 3)
  const compactWidthPx = finiteNonNegative(options.compactWidthPx, 34)
  const cardWidthPx = Math.max(compactWidthPx, finiteNonNegative(options.cardWidthPx, 104))
  const pixelsPerMs = options.pixelsPerHour / HOUR_MS

  const clipped = entries
    .map((entry, originalIndex): ClippedEntry<T> | null => {
      if (!Number.isFinite(entry.startTime) || !Number.isFinite(entry.endTime) || entry.endTime <= entry.startTime) {
        return null
      }

      const visibleStartTime = Math.max(entry.startTime, rangeStart)
      const visibleEndTime = Math.min(entry.endTime, rangeEnd)
      if (visibleEndTime <= visibleStartTime) return null

      const durationMs = visibleEndTime - visibleStartTime
      return {
        entry,
        visibleStartTime,
        visibleEndTime,
        durationMs,
        visualEndTime: visibleEndTime,
        visualDurationMs: durationMs,
        originalIndex
      }
    })
    .filter((entry): entry is ClippedEntry<T> => entry !== null)
    .sort(compareClippedEntries)

  const rowEnds: number[] = []
  const layouts: HorizontalTimelineLayoutItem<T>[] = []

  for (const item of clipped) {
    let row = rowEnds.findIndex((endTime) => endTime <= item.visibleStartTime)
    if (row === -1) {
      row = rowEnds.length
      rowEnds.push(item.visibleEndTime)
    } else {
      rowEnds[row] = item.visibleEndTime
    }

    const actualWidthPx = item.durationMs * pixelsPerMs
    const renderWidthPx = Math.max(actualWidthPx, markerWidthPx)
    const renderMode: HorizontalTimelineRenderMode =
      actualWidthPx >= cardWidthPx ? 'card' : actualWidthPx >= compactWidthPx ? 'compact' : 'marker'

    layouts.push({
      entry: item.entry,
      visibleStartTime: item.visibleStartTime,
      visibleEndTime: item.visibleEndTime,
      durationMs: item.durationMs,
      leftPx: (item.visibleStartTime - rangeStart) * pixelsPerMs,
      actualWidthPx,
      renderWidthPx,
      row,
      rowCount: 0,
      renderMode
    })
  }

  const rowCount = Math.max(rowEnds.length, 1)
  return layouts.map((item) => ({ ...item, rowCount }))
}

/**
 * Returns the scroll offset that keeps the time under a cursor at that cursor
 * position after the horizontal timeline changes zoom. The result is clamped
 * to the real scrollable range so zooming near midnight cannot overscroll.
 */
export function getAnchoredHorizontalTimelineScrollLeft(anchor: HorizontalTimelineZoomAnchor): number {
  const {
    scrollLeftPx,
    viewportOffsetPx,
    currentPixelsPerHour,
    nextPixelsPerHour,
    contentWidthPx,
    viewportWidthPx
  } = anchor

  if (!Number.isFinite(currentPixelsPerHour) || currentPixelsPerHour <= 0) {
    throw new RangeError('currentPixelsPerHour must be a finite, positive number')
  }
  if (!Number.isFinite(nextPixelsPerHour) || nextPixelsPerHour <= 0) {
    throw new RangeError('nextPixelsPerHour must be a finite, positive number')
  }
  if (!Number.isFinite(scrollLeftPx) || !Number.isFinite(viewportOffsetPx)) {
    throw new RangeError('scroll positions must be finite numbers')
  }
  if (!Number.isFinite(contentWidthPx) || !Number.isFinite(viewportWidthPx)) {
    throw new RangeError('timeline dimensions must be finite numbers')
  }

  const anchoredHour = (scrollLeftPx + viewportOffsetPx) / currentPixelsPerHour
  const targetScrollLeft = anchoredHour * nextPixelsPerHour - viewportOffsetPx
  const maxScrollLeft = Math.max(0, contentWidthPx - viewportWidthPx)
  return Math.min(maxScrollLeft, Math.max(0, targetScrollLeft))
}

function finiteNonNegative(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? Math.max(0, value) : fallback
}
