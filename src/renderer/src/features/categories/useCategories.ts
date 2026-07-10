import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query'
import type { UpsertCategoryInput } from '@shared/types/ipc'
import type { Category } from '@shared/types/models'
import { categoryApi } from './api'

const CATEGORIES_KEY = ['categories']

export function useCategories(): UseQueryResult<Category[]> {
  return useQuery({ queryKey: CATEGORIES_KEY, queryFn: categoryApi.list })
}

export function useUpsertCategory(): UseMutationResult<Category, Error, UpsertCategoryInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpsertCategoryInput) => categoryApi.upsert(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY })
  })
}

export function useDeleteCategory(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => categoryApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY })
  })
}
