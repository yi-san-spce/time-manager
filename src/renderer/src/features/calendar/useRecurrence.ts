import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query'
import type { ExpandRecurrenceInput, SetScheduleExceptionInput } from '@shared/types/ipc'
import type { ScheduleOccurrence } from '@shared/types/models'
import { recurrenceApi } from './api'

export function useRecurrenceExpansion(range: ExpandRecurrenceInput): UseQueryResult<ScheduleOccurrence[]> {
  return useQuery({
    queryKey: ['recurrence-expand', range.rangeStart, range.rangeEnd],
    queryFn: () => recurrenceApi.expand(range)
  })
}

export function useSetScheduleException(): UseMutationResult<void, Error, SetScheduleExceptionInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SetScheduleExceptionInput) => recurrenceApi.setException(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurrence-expand'] })
  })
}
