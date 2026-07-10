import { describe, expect, it } from 'vitest'
import type { Schedule, ScheduleOccurrence } from '@shared/types/models'
import { computeReminders, nextReminder } from './reminderPlanner'

const MIN = 60_000

function makeSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 's1',
    title: '会议',
    description: null,
    categoryId: null,
    priority: 2,
    startTime: 1_000_000,
    endTime: 1_000_000 + 30 * MIN,
    recurrenceRuleId: null,
    reminderMinutesBefore: 10,
    status: 'planned',
    createdAt: 0,
    updatedAt: 0,
    ...overrides
  }
}

function makeOccurrence(schedule: Schedule, occurrenceStart: number, exceptionAction: ScheduleOccurrence['exceptionAction'] = null): ScheduleOccurrence {
  return {
    schedule,
    occurrenceStart,
    occurrenceEnd: occurrenceStart + (schedule.endTime - schedule.startTime),
    exceptionAction
  }
}

describe('computeReminders (non-recurring)', () => {
  it('computes fireAt = startTime - reminderMinutesBefore*60000 for a future schedule', () => {
    const s = makeSchedule({ startTime: 100 * MIN, reminderMinutesBefore: 10 })
    const result = computeReminders([s], [], 0)
    expect(result).toHaveLength(1)
    expect(result[0].fireAt).toBe(90 * MIN)
    expect(result[0].scheduleId).toBe('s1')
    expect(result[0].startTime).toBe(100 * MIN)
  })

  it('excludes schedules with no reminderMinutesBefore', () => {
    const s = makeSchedule({ reminderMinutesBefore: null })
    expect(computeReminders([s], [], 0)).toHaveLength(0)
  })

  it('excludes a reminder whose fireAt is already in the past', () => {
    const s = makeSchedule({ startTime: 5 * MIN, reminderMinutesBefore: 10 }) // fireAt = -5min
    expect(computeReminders([s], [], 0)).toHaveLength(0)
  })

  it('excludes a reminder whose fireAt equals now (strictly future only)', () => {
    const s = makeSchedule({ startTime: 10 * MIN, reminderMinutesBefore: 10 }) // fireAt = 0
    expect(computeReminders([s], [], 0)).toHaveLength(0)
  })

  it('excludes non-planned schedules (completed/skipped/cancelled)', () => {
    for (const status of ['completed', 'skipped', 'cancelled'] as const) {
      const s = makeSchedule({ startTime: 100 * MIN, status })
      expect(computeReminders([s], [], 0)).toHaveLength(0)
    }
  })
})

describe('computeReminders (recurring occurrences)', () => {
  it('computes a reminder per future occurrence', () => {
    const s = makeSchedule({ id: 'r1', recurrenceRuleId: 'rule1', reminderMinutesBefore: 5 })
    const occs = [makeOccurrence(s, 100 * MIN), makeOccurrence(s, 200 * MIN)]
    const result = computeReminders([], occs, 0)
    expect(result.map((r) => r.fireAt)).toEqual([95 * MIN, 195 * MIN])
  })

  it('skips an occurrence marked completed/skipped via exception', () => {
    const s = makeSchedule({ id: 'r1', recurrenceRuleId: 'rule1', reminderMinutesBefore: 5 })
    const occs = [makeOccurrence(s, 100 * MIN, 'skipped'), makeOccurrence(s, 200 * MIN)]
    const result = computeReminders([], occs, 0)
    expect(result).toHaveLength(1)
    expect(result[0].fireAt).toBe(195 * MIN)
  })
})

describe('computeReminders (sorting + mixing)', () => {
  it('merges recurring and non-recurring, sorted ascending by fireAt', () => {
    const single = makeSchedule({ id: 'a', startTime: 300 * MIN, reminderMinutesBefore: 10 }) // fireAt 290
    const recurring = makeSchedule({ id: 'b', recurrenceRuleId: 'rule', reminderMinutesBefore: 5 })
    const occs = [makeOccurrence(recurring, 100 * MIN)] // fireAt 95
    const result = computeReminders([single], occs, 0)
    expect(result.map((r) => r.fireAt)).toEqual([95 * MIN, 290 * MIN])
  })
})

describe('nextReminder', () => {
  it('returns the earliest (first) reminder', () => {
    const single = makeSchedule({ id: 'a', startTime: 300 * MIN, reminderMinutesBefore: 10 })
    const recurring = makeSchedule({ id: 'b', recurrenceRuleId: 'rule', reminderMinutesBefore: 5 })
    const result = computeReminders([single], [makeOccurrence(recurring, 100 * MIN)], 0)
    expect(nextReminder(result)?.scheduleId).toBe('b')
  })

  it('returns null when there are no reminders', () => {
    expect(nextReminder([])).toBeNull()
  })
})
