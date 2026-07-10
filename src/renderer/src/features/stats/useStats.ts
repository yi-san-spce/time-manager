import { useMemo } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { ListTimeEntriesInput } from '@shared/types/ipc'
import type { Category, Task, TimeEntry } from '@shared/types/models'
import { useTimeEntries } from '../tracking/useTimeEntries'
import { useTasks } from '../tasks/useTasks'
import { useCategories } from '../categories/useCategories'

export interface CategoryBreakdownItem {
  categoryId: string | null
  categoryName: string
  color: string | null
  totalMinutes: number
  percentage: number
}

export interface StatsData {
  totalMinutes: number
  categoryBreakdown: CategoryBreakdownItem[]
  completionRate: number
  completedTaskCount: number
  totalTaskCount: number
}

const UNASSIGNED_LABEL = '未分类'

function buildCategoryBreakdown(
  entries: TimeEntry[],
  tasks: Task[],
  categories: Category[]
): CategoryBreakdownItem[] {
  const taskById = new Map(tasks.map((t) => [t.id, t]))
  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const minutesByCategory = new Map<string, number>()

  for (const entry of entries) {
    const durationMinutes = (entry.endTime - entry.startTime) / 60000
    const task = entry.taskId ? taskById.get(entry.taskId) : undefined
    const categoryId = task?.categoryId ?? null
    const key = categoryId ?? '__unassigned__'
    minutesByCategory.set(key, (minutesByCategory.get(key) ?? 0) + durationMinutes)
  }

  const totalMinutes = [...minutesByCategory.values()].reduce((sum, m) => sum + m, 0)

  return [...minutesByCategory.entries()]
    .map(([key, totalMinutesForCategory]) => {
      const category = key === '__unassigned__' ? null : categoryById.get(key)
      return {
        categoryId: key === '__unassigned__' ? null : key,
        categoryName: category?.name ?? UNASSIGNED_LABEL,
        color: category?.color ?? null,
        totalMinutes: Math.round(totalMinutesForCategory),
        percentage: totalMinutes > 0 ? Math.round((totalMinutesForCategory / totalMinutes) * 1000) / 10 : 0
      }
    })
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
}

export function useStats(range: ListTimeEntriesInput): {
  data: StatsData | undefined
  isLoading: boolean
} {
  const entriesQuery: UseQueryResult<TimeEntry[]> = useTimeEntries(range)
  const tasksQuery: UseQueryResult<Task[]> = useTasks()
  const categoriesQuery: UseQueryResult<Category[]> = useCategories()

  const data = useMemo<StatsData | undefined>(() => {
    if (!entriesQuery.data || !tasksQuery.data || !categoriesQuery.data) return undefined

    const categoryBreakdown = buildCategoryBreakdown(entriesQuery.data, tasksQuery.data, categoriesQuery.data)
    const totalMinutes = categoryBreakdown.reduce((sum, item) => sum + item.totalMinutes, 0)

    const completedTaskCount = tasksQuery.data.filter((t) => t.status === 'done').length
    const totalTaskCount = tasksQuery.data.length
    const completionRate = totalTaskCount > 0 ? Math.round((completedTaskCount / totalTaskCount) * 100) : 0

    return { totalMinutes, categoryBreakdown, completionRate, completedTaskCount, totalTaskCount }
  }, [entriesQuery.data, tasksQuery.data, categoriesQuery.data])

  return {
    data,
    isLoading: entriesQuery.isLoading || tasksQuery.isLoading || categoriesQuery.isLoading
  }
}
