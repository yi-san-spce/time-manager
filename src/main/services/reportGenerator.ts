import type { AnalyzeInput, SummarizeInput } from '@shared/types/ai'
import type { Report, ReportKind } from '@shared/types/models'
import { listSchedules } from '../db/repositories/scheduleRepo'
import { listTimeEntries } from '../db/repositories/timeEntryRepo'
import { listTasks } from '../db/repositories/taskRepo'
import { listCategories } from '../db/repositories/categoryRepo'
import { createReport, setReportAISummary } from '../db/repositories/reportRepo'
import { getActiveAIProviderConfig } from '../db/repositories/aiConfigRepo'
import { decryptApiKey } from './aiSettingsService'
import { createAIProvider } from '../ai/providerFactory'

/**
 * 把某个时间范围内的 time_entry/task/schedule/category 聚合成 AnalyzeInput，
 * 供 AI analyze/summarize 使用。不传原始 window_title 给 AI（隐私考虑）。
 */
export function buildAnalyzeInput(periodStart: number, periodEnd: number): AnalyzeInput {
  const timeEntries = listTimeEntries(periodStart, periodEnd)
  const tasks = listTasks()
  const categories = listCategories()
  const schedules = listSchedules().filter(
    (s) => s.startTime < periodEnd && s.endTime > periodStart
  )

  const taskById = new Map(tasks.map((t) => [t.id, t]))
  const categoryById = new Map(categories.map((c) => [c.id, c]))

  const timeEntrySummary = timeEntries.map((entry) => {
    const task = entry.taskId ? taskById.get(entry.taskId) : undefined
    const category = task?.categoryId ? categoryById.get(task.categoryId) : undefined
    return {
      taskTitle: task?.title ?? entry.note ?? entry.appName ?? '未命名活动',
      categoryName: category?.name ?? '未分类',
      durationMinutes: Math.round((entry.endTime - entry.startTime) / 60000),
      source: entry.source
    }
  })

  const scheduleCompletion = schedules.map((s) => ({
    title: s.title,
    planned: true,
    completed: s.status === 'completed'
  }))

  const minutesByCategory = new Map<string, number>()
  for (const item of timeEntrySummary) {
    minutesByCategory.set(item.categoryName, (minutesByCategory.get(item.categoryName) ?? 0) + item.durationMinutes)
  }
  const totalMinutes = [...minutesByCategory.values()].reduce((sum, m) => sum + m, 0)
  const categoryBreakdown = [...minutesByCategory.entries()].map(([categoryName, minutes]) => ({
    categoryName,
    totalMinutes: minutes,
    percentage: totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 1000) / 10 : 0
  }))

  return { periodStart, periodEnd, timeEntries: timeEntrySummary, scheduleCompletion, categoryBreakdown }
}

export async function generateReport(input: {
  type: ReportKind
  periodStart: number
  periodEnd: number
  selfReflection?: string | null
}): Promise<Report> {
  const config = getActiveAIProviderConfig()
  if (!config) {
    throw new Error('未配置激活的 AI 供应商，请先在设置页配置并激活一个供应商')
  }

  const report = createReport(input)

  const analyzeInput = buildAnalyzeInput(input.periodStart, input.periodEnd)
  const summarizeInput: SummarizeInput = {
    ...analyzeInput,
    selfReflection: input.selfReflection,
    reportType: input.type
  }

  const apiKey = decryptApiKey(config.id)
  const provider = createAIProvider(config.provider, apiKey, config.model, config.baseUrl)
  const aiSummary = await provider.summarize(summarizeInput)

  return setReportAISummary(report.id, aiSummary, `${config.provider}:${config.model}`)
}
