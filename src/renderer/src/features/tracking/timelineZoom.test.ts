import { describe, expect, it } from 'vitest'
import { getLinearWheelZoomDelta, PIXELS_PER_HOUR_PER_ZOOM_MINUTE } from './timelineZoom'

describe('getLinearWheelZoomDelta', () => {
  const common = {
    deltaMode: 0,
    viewportHeightPx: 600
  }

  it('uses one-minute steps for slow, small wheel input', () => {
    expect(getLinearWheelZoomDelta({ ...common, deltaY: -4, elapsedMs: 80 })).toBe(
      -PIXELS_PER_HOUR_PER_ZOOM_MINUTE
    )
    expect(getLinearWheelZoomDelta({ ...common, deltaY: 4, elapsedMs: 80 })).toBe(
      PIXELS_PER_HOUR_PER_ZOOM_MINUTE
    )
  })

  it('increases the zoom delta linearly as the same wheel movement gets faster', () => {
    const slow = getLinearWheelZoomDelta({ ...common, deltaY: -100, elapsedMs: 160 })
    const normal = getLinearWheelZoomDelta({ ...common, deltaY: -100, elapsedMs: 80 })
    const fast = getLinearWheelZoomDelta({ ...common, deltaY: -100, elapsedMs: 25 })

    expect(slow).toBe(-2 * PIXELS_PER_HOUR_PER_ZOOM_MINUTE)
    expect(normal).toBe(-3 * PIXELS_PER_HOUR_PER_ZOOM_MINUTE)
    expect(fast).toBe(-11 * PIXELS_PER_HOUR_PER_ZOOM_MINUTE)
    expect(slow).toBeGreaterThan(normal)
    expect(normal).toBeGreaterThan(fast)
  })

  it('normalizes line and page deltas and caps an extreme gesture', () => {
    expect(getLinearWheelZoomDelta({ deltaY: -3, deltaMode: 1, elapsedMs: 80, viewportHeightPx: 600 })).toBe(
      -2 * PIXELS_PER_HOUR_PER_ZOOM_MINUTE
    )
    expect(getLinearWheelZoomDelta({ deltaY: 1, deltaMode: 2, elapsedMs: 16, viewportHeightPx: 600 })).toBe(
      24 * PIXELS_PER_HOUR_PER_ZOOM_MINUTE
    )
  })

  it('ignores empty or non-finite wheel input', () => {
    expect(getLinearWheelZoomDelta({ ...common, deltaY: 0, elapsedMs: 80 })).toBe(0)
    expect(getLinearWheelZoomDelta({ ...common, deltaY: Number.NaN, elapsedMs: 80 })).toBe(0)
  })
})
