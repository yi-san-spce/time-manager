import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { StatsQueryInput, TimeStatsResult } from '@shared/types/ipc'

function keyFor(range: StatsQueryInput): unknown[] {
  return ['time-stats', range.rangeStart, range.rangeEnd]
}

/** 拉取按应用/域名/窗口标题/任务分组的追踪时长聚合（ActivityWatch 式看板）。 */
export function useTimeStats(range: StatsQueryInput): UseQueryResult<TimeStatsResult> {
  return useQuery({ queryKey: keyFor(range), queryFn: () => window.api.stats.query(range) })
}
