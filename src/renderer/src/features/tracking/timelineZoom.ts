/**
 * Wheel input needs to be normalized because a mouse, a precision touchpad,
 * and the browser's line/page wheel modes report very different delta units.
 * The returned value is intentionally linear with the measured scroll speed:
 * a faster wheel motion changes more rendered minutes per event.
 */
export interface LinearWheelZoomInput {
  deltaY: number
  deltaMode: number
  /** Time since the prior wheel event, in milliseconds. */
  elapsedMs: number
  /** Used only for DOM_DELTA_PAGE input. */
  viewportHeightPx: number
}

const PIXELS_PER_LINE = 16
const DEFAULT_PAGE_HEIGHT_PX = 800
const MIN_ELAPSED_MS = 16
const MAX_ELAPSED_MS = 200
const SCROLL_PIXELS_PER_SECOND_PER_ZOOM_MINUTE = 375
const MAX_ZOOM_MINUTES_PER_EVENT = 24

/** A single zoom minute equals 60 pixels per hour in the timeline scale. */
export const PIXELS_PER_HOUR_PER_ZOOM_MINUTE = 60

/**
 * Returns a signed timeline zoom delta in pixels-per-hour.
 *
 * Slow, small wheel input advances by one rendered minute. Consecutive or
 * larger wheel input advances in a straight-line proportion to its measured
 * speed, capped so one accidental gesture cannot jump across the whole range.
 */
export function getLinearWheelZoomDelta({
  deltaY,
  deltaMode,
  elapsedMs,
  viewportHeightPx
}: LinearWheelZoomInput): number {
  if (!Number.isFinite(deltaY) || deltaY === 0) return 0

  const normalizedDelta = normalizeWheelDelta(deltaY, deltaMode, viewportHeightPx)
  const elapsed = clamp(Number.isFinite(elapsedMs) ? elapsedMs : MAX_ELAPSED_MS, MIN_ELAPSED_MS, MAX_ELAPSED_MS)
  const pixelsPerSecond = (Math.abs(normalizedDelta) / elapsed) * 1000
  const zoomMinutes = clamp(
    Math.round(pixelsPerSecond / SCROLL_PIXELS_PER_SECOND_PER_ZOOM_MINUTE),
    1,
    MAX_ZOOM_MINUTES_PER_EVENT
  )

  return Math.sign(normalizedDelta) * zoomMinutes * PIXELS_PER_HOUR_PER_ZOOM_MINUTE
}

function normalizeWheelDelta(deltaY: number, deltaMode: number, viewportHeightPx: number): number {
  if (deltaMode === 1) return deltaY * PIXELS_PER_LINE
  if (deltaMode === 2) {
    const pageHeight = Number.isFinite(viewportHeightPx) && viewportHeightPx > 0 ? viewportHeightPx : DEFAULT_PAGE_HEIGHT_PX
    return deltaY * pageHeight
  }
  return deltaY
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
