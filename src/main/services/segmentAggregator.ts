/**
 * 活跃窗口采样聚合的纯状态机逻辑，从 TrackingService 中抽取出来，
 * 不依赖 electron/定时器/数据库，方便用固定时间戳做单元测试。
 */

export interface WindowSample {
  appName: string | null
  windowTitle: string | null
  domain?: string | null
}

export interface Segment extends WindowSample {
  startTime: number
}

export interface ClosedSegment extends Segment {
  endTime: number
}

export interface AggregatorState {
  currentSegment: Segment | null
}

export interface SampleResult {
  nextState: AggregatorState
  /** 本次采样触发落盘的时间段，没有则为 null（未变化 / 未达到最短时长）。 */
  closedSegment: ClosedSegment | null
}

export interface AggregatorConfig {
  minSegmentSeconds: number
  /** 同一窗口持续活跃超过这个时长（毫秒）就提交一次并续开新段。 */
  maxSegmentMs: number
}

function toClosedIfLongEnough(
  segment: Segment,
  endTime: number,
  minSegmentSeconds: number
): ClosedSegment | null {
  const durationSeconds = (endTime - segment.startTime) / 1000
  if (durationSeconds < minSegmentSeconds) return null
  return { ...segment, endTime }
}

/** 处理一次采样结果，返回新状态和（如有）应该落盘的已完成时间段。 */
export function applySample(
  state: AggregatorState,
  sample: WindowSample,
  now: number,
  config: AggregatorConfig
): SampleResult {
  if (!sample.appName && !sample.windowTitle) {
    return { nextState: state, closedSegment: null }
  }

  if (!state.currentSegment) {
    return {
      nextState: { currentSegment: { ...sample, startTime: now } },
      closedSegment: null
    }
  }

  const sameWindow =
    state.currentSegment.appName === sample.appName && state.currentSegment.windowTitle === sample.windowTitle

  if (sameWindow) {
    if (now - state.currentSegment.startTime >= config.maxSegmentMs) {
      const closedSegment = toClosedIfLongEnough(state.currentSegment, now, config.minSegmentSeconds)
      return {
        nextState: { currentSegment: { ...sample, startTime: now } },
        closedSegment
      }
    }
    return { nextState: state, closedSegment: null }
  }

  const closedSegment = toClosedIfLongEnough(state.currentSegment, now, config.minSegmentSeconds)
  return {
    nextState: { currentSegment: { ...sample, startTime: now } },
    closedSegment
  }
}

/** 应用退出/系统睡眠时把当前未落盘的段强制关闭。 */
export function flush(
  state: AggregatorState,
  now: number,
  minSegmentSeconds: number
): { nextState: AggregatorState; closedSegment: ClosedSegment | null } {
  if (!state.currentSegment) {
    return { nextState: state, closedSegment: null }
  }
  const closedSegment = toClosedIfLongEnough(state.currentSegment, now, minSegmentSeconds)
  return { nextState: { currentSegment: null }, closedSegment }
}
