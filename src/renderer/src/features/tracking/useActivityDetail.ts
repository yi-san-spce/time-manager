import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query'
import type {
  ActivityDetailInput,
  ActivityNoteData,
  AppActivityDetail,
  SaveActivityNoteInput,
  SummarizeActivityInput
} from '@shared/types/ipc'

/** 某应用在时间范围内的明细（何时运行、访问了哪些网站/窗口、各自时长）。 */
export function useActivityDetail(input: ActivityDetailInput | null): UseQueryResult<AppActivityDetail> {
  return useQuery({
    queryKey: ['activity-detail', input?.appName, input?.rangeStart, input?.rangeEnd],
    queryFn: () => window.api.activity.detail(input as ActivityDetailInput),
    enabled: input !== null
  })
}

/** 某活动分组的用户笔记 + AI 总结。 */
export function useActivityNote(scopeKey: string | null): UseQueryResult<ActivityNoteData | null> {
  return useQuery({
    queryKey: ['activity-note', scopeKey],
    queryFn: () => window.api.activity.getNote(scopeKey as string),
    enabled: scopeKey !== null
  })
}

export function useSaveActivityNote(): UseMutationResult<ActivityNoteData, Error, SaveActivityNoteInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SaveActivityNoteInput) => window.api.activity.saveNote(input),
    onSuccess: (data) => queryClient.setQueryData(['activity-note', data.scopeKey], data)
  })
}

export function useSummarizeActivity(): UseMutationResult<string, Error, SummarizeActivityInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SummarizeActivityInput) => window.api.activity.summarize(input),
    onSuccess: (_summary, input) =>
      queryClient.invalidateQueries({ queryKey: ['activity-note', input.appName] })
  })
}
