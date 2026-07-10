import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type {
  CreateManualTimeEntryInput,
  LinkTimeEntryToTaskInput,
  ListTimeEntriesInput,
  MergeTimeEntriesInput,
  UpdateTimeEntryInput
} from '@shared/types/ipc'
import type { TimeEntry } from '@shared/types/models'
import { timeEntryApi } from './api'

function keyFor(range: ListTimeEntriesInput): unknown[] {
  return ['time-entries', range.rangeStart, range.rangeEnd]
}

/**
 * 追踪记录发生变化时，列表、聚合总览和已打开的活动详情都可能受影响。
 * 统一在这里失效，避免只刷新时间线而留下旧的总览数据。
 */
function invalidateTrackingQueries(queryClient: ReturnType<typeof useQueryClient>): Promise<unknown[]> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['time-entries'] }),
    queryClient.invalidateQueries({ queryKey: ['time-stats'] }),
    queryClient.invalidateQueries({ queryKey: ['activity-detail'] })
  ])
}

export function useTimeEntries(range: ListTimeEntriesInput): UseQueryResult<TimeEntry[]> {
  return useQuery({ queryKey: keyFor(range), queryFn: () => timeEntryApi.list(range) })
}

export function useCreateManualTimeEntry(): UseMutationResult<TimeEntry, Error, CreateManualTimeEntryInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateManualTimeEntryInput) => timeEntryApi.createManual(input),
    onSuccess: () => invalidateTrackingQueries(queryClient)
  })
}

export function useUpdateTimeEntry(): UseMutationResult<TimeEntry, Error, UpdateTimeEntryInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateTimeEntryInput) => timeEntryApi.update(input),
    onSuccess: () => invalidateTrackingQueries(queryClient)
  })
}

export function useMergeTimeEntries(): UseMutationResult<TimeEntry, Error, MergeTimeEntriesInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: MergeTimeEntriesInput) => timeEntryApi.merge(input),
    onSuccess: () => invalidateTrackingQueries(queryClient)
  })
}

export function useLinkTimeEntryToTask(): UseMutationResult<TimeEntry, Error, LinkTimeEntryToTaskInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: LinkTimeEntryToTaskInput) => timeEntryApi.linkToTask(input),
    onSuccess: () => invalidateTrackingQueries(queryClient)
  })
}

export function useDeleteTimeEntry(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => timeEntryApi.delete(id),
    onSuccess: () => invalidateTrackingQueries(queryClient)
  })
}
