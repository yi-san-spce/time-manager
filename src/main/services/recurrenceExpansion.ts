import { RRule } from 'rrule'
import type { RecurrenceRule, Schedule, ScheduleException, ScheduleOccurrence } from '@shared/types/models'

const FREQ_MAP = {
  DAILY: RRule.DAILY,
  WEEKLY: RRule.WEEKLY,
  MONTHLY: RRule.MONTHLY
} as const

/**
 * 把一条重复日程母版按规则展开为 [rangeStart, rangeEnd) 区间内的具体发生实例。
 * 每次发生的时长固定等于母版的 (endTime - startTime)。
 */
export function expandSchedule(
  schedule: Schedule,
  rule: RecurrenceRule,
  exceptions: ScheduleException[],
  rangeStart: number,
  rangeEnd: number
): ScheduleOccurrence[] {
  const duration = schedule.endTime - schedule.startTime
  const exceptionByDate = new Map(exceptions.map((e) => [e.occurrenceDate, e.action]))

  const rrule = new RRule({
    freq: FREQ_MAP[rule.freq],
    interval: rule.interval,
    byweekday: rule.byWeekday ?? undefined,
    dtstart: new Date(schedule.startTime),
    until: rule.untilDate ? new Date(rule.untilDate) : undefined,
    count: rule.count ?? undefined
  })

  const occurrenceStarts = rrule.between(new Date(rangeStart), new Date(rangeEnd), true)

  return occurrenceStarts.map((date) => {
    const occurrenceStart = date.getTime()
    return {
      schedule,
      occurrenceStart,
      occurrenceEnd: occurrenceStart + duration,
      exceptionAction: exceptionByDate.get(occurrenceStart) ?? null
    }
  })
}
