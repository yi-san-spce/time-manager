import { describe, expect, it } from 'vitest'
import type { PomodoroConfig } from '@shared/types/ipc'
import {
  MIN_LOG_MS,
  focusNote,
  nextPhaseAfterFocus,
  phaseDurationMs,
  shouldLogFocus
} from './pomodoroLogic'

const config: PomodoroConfig = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4
}

describe('phaseDurationMs', () => {
  it('returns configured durations in ms per phase', () => {
    expect(phaseDurationMs('focus', config)).toBe(25 * 60 * 1000)
    expect(phaseDurationMs('shortBreak', config)).toBe(5 * 60 * 1000)
    expect(phaseDurationMs('longBreak', config)).toBe(15 * 60 * 1000)
  })
})

describe('nextPhaseAfterFocus', () => {
  it('gives short break for non-interval completions', () => {
    expect(nextPhaseAfterFocus(1, config)).toBe('shortBreak')
    expect(nextPhaseAfterFocus(2, config)).toBe('shortBreak')
    expect(nextPhaseAfterFocus(3, config)).toBe('shortBreak')
  })

  it('gives long break every longBreakInterval completions', () => {
    expect(nextPhaseAfterFocus(4, config)).toBe('longBreak')
    expect(nextPhaseAfterFocus(8, config)).toBe('longBreak')
  })
})

describe('shouldLogFocus', () => {
  it('logs a focus segment at or above the minimum threshold', () => {
    expect(shouldLogFocus('focus', MIN_LOG_MS)).toBe(true)
    expect(shouldLogFocus('focus', MIN_LOG_MS + 1)).toBe(true)
  })

  it('does not log focus segments under the threshold', () => {
    expect(shouldLogFocus('focus', MIN_LOG_MS - 1)).toBe(false)
    expect(shouldLogFocus('focus', 0)).toBe(false)
  })

  it('never logs break phases regardless of duration', () => {
    expect(shouldLogFocus('shortBreak', 10 * 60 * 1000)).toBe(false)
    expect(shouldLogFocus('longBreak', 10 * 60 * 1000)).toBe(false)
  })
})

describe('focusNote', () => {
  it('appends a task/schedule label when present', () => {
    expect(focusNote('写方案')).toBe('🍅 专注 · 写方案')
  })

  it('omits the label for a bare focus session', () => {
    expect(focusNote('专注')).toBe('🍅 专注')
    expect(focusNote(null)).toBe('🍅 专注')
    expect(focusNote(undefined)).toBe('🍅 专注')
  })
})
