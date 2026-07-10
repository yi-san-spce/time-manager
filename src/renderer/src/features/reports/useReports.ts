import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query'
import type { ExportReportInput, ExportReportResult, GenerateReportInput, UpdateReportReflectionInput } from '@shared/types/ipc'
import type { Report } from '@shared/types/models'
import { reportApi } from './api'

const REPORTS_KEY = ['reports']

export function useReports(): UseQueryResult<Report[]> {
  return useQuery({ queryKey: REPORTS_KEY, queryFn: reportApi.list })
}

export function useGenerateReport(): UseMutationResult<Report, Error, GenerateReportInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: GenerateReportInput) => reportApi.generate(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REPORTS_KEY })
  })
}

export function useUpdateReportReflection(): UseMutationResult<Report, Error, UpdateReportReflectionInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateReportReflectionInput) => reportApi.updateReflection(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REPORTS_KEY })
  })
}

export function useExportReport(): UseMutationResult<ExportReportResult, Error, ExportReportInput> {
  return useMutation({
    mutationFn: (input: ExportReportInput) => reportApi.export(input)
  })
}

export function useDeleteReport(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => reportApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REPORTS_KEY })
  })
}
