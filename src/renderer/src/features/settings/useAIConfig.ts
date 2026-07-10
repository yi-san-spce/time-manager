import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query'
import type { SaveAIProviderConfigInput } from '@shared/types/ipc'
import type { AIProviderConfig, TestConnectionResult } from '@shared/types/ai'
import { aiConfigApi } from './api'

const AI_CONFIGS_KEY = ['ai-configs']

export function useAIConfigs(): UseQueryResult<AIProviderConfig[]> {
  return useQuery({ queryKey: AI_CONFIGS_KEY, queryFn: aiConfigApi.list })
}

export function useSaveAIConfig(): UseMutationResult<AIProviderConfig, Error, SaveAIProviderConfigInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SaveAIProviderConfigInput) => aiConfigApi.save(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AI_CONFIGS_KEY })
  })
}

export function useActivateAIConfig(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => aiConfigApi.activate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AI_CONFIGS_KEY })
  })
}

export function useDeleteAIConfig(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => aiConfigApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AI_CONFIGS_KEY })
  })
}

export function useTestAIConnection(): UseMutationResult<TestConnectionResult, Error, string> {
  return useMutation({
    mutationFn: (id: string) => aiConfigApi.testConnection(id)
  })
}
