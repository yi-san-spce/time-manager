import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query'
import type { CreateScheduleInput, UpdateScheduleInput } from '@shared/types/ipc'
import type { Schedule } from '@shared/types/models'
import { scheduleApi } from './api'

const SCHEDULES_KEY = ['schedules']

export function useSchedules(): UseQueryResult<Schedule[]> {
  return useQuery({ queryKey: SCHEDULES_KEY, queryFn: scheduleApi.list })
}

export function useCreateSchedule(): UseMutationResult<Schedule, Error, CreateScheduleInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateScheduleInput) => scheduleApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SCHEDULES_KEY })
  })
}

export function useUpdateSchedule(): UseMutationResult<Schedule, Error, UpdateScheduleInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateScheduleInput) => scheduleApi.update(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SCHEDULES_KEY })
      void queryClient.invalidateQueries({ queryKey: ['recurrence-expand'] })
    }
  })
}

export function useDeleteSchedule(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => scheduleApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SCHEDULES_KEY })
      void queryClient.invalidateQueries({ queryKey: ['recurrence-expand'] })
    }
  })
}
