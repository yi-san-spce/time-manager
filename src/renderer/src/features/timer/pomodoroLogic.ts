import type { PomodoroConfig } from '@shared/types/ipc'

export type PomodoroPhase = 'focus' | 'shortBreak' | 'longBreak'

export const MIN_LOG_MS = 60 * 1000 // 专注不足 1 分钟不落库

export function phaseDurationMs(phase: PomodoroPhase, config: PomodoroConfig): number {
  if (phase === 'focus') return config.focusMinutes * 60 * 1000
  if (phase === 'shortBreak') return config.shortBreakMinutes * 60 * 1000
  return config.longBreakMinutes * 60 * 1000
}

/**
 * 一个专注段结束后，下一阶段是长休还是短休：
 * 完成的专注计数是 longBreakInterval 的整数倍时进入长休。
 */
export function nextPhaseAfterFocus(completedFocus: number, config: PomodoroConfig): PomodoroPhase {
  return completedFocus % config.longBreakInterval === 0 ? 'longBreak' : 'shortBreak'
}

/** 是否应把这段专注写入 time_entry（达最小时长阈值才落库；休息段永不落库）。 */
export function shouldLogFocus(phase: PomodoroPhase, accumMs: number): boolean {
  return phase === 'focus' && accumMs >= MIN_LOG_MS
}

/** 构造落库用的 time_entry 备注（区分是否关联具体任务/日程）。 */
export function focusNote(label: string | undefined | null): string {
  return `🍅 专注${label && label !== '专注' ? ` · ${label}` : ''}`
}
