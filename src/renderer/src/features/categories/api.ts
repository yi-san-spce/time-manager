import type { UpsertCategoryInput } from '@shared/types/ipc'

export const categoryApi = {
  list: () => window.api.category.list(),
  upsert: (input: UpsertCategoryInput) => window.api.category.upsert(input),
  delete: (id: string) => window.api.category.delete(id)
}
