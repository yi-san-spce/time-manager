import type { AnalyzeInput, SummarizeInput } from '@shared/types/ai'

const ANALYZE_SYSTEM_PROMPT = `你是一个时间管理分析助手。根据用户提供的日程完成情况、任务耗时统计和分类占比，输出一段简明的分析。
必须严格输出如下 JSON 格式，不要输出任何其他文字：
{"focusScore": <0-100的整数，表示专注度评分>, "summary": "<一段话总结>", "suggestions": ["<建议1>", "<建议2>"]}`

const SUMMARIZE_SYSTEM_PROMPT = `你是一个时间管理复盘助手。根据用户提供的时间段数据、日程完成情况、分类耗时占比，以及用户自己写的心得（如果有），
生成一段 Markdown 格式的总结报告。语气客观、有建设性，避免空泛的鼓励语。直接输出 Markdown 正文，不要额外包裹代码块。`

function formatAnalyzeInput(input: AnalyzeInput): string {
  const period = `${new Date(input.periodStart).toLocaleString()} - ${new Date(input.periodEnd).toLocaleString()}`
  const entries = input.timeEntries
    .map((e) => `- ${e.taskTitle}（${e.categoryName}）：${e.durationMinutes}分钟，来源：${e.source}`)
    .join('\n')
  const schedules = input.scheduleCompletion
    .map((s) => `- ${s.title}：计划${s.planned ? '是' : '否'}，完成${s.completed ? '是' : '否'}`)
    .join('\n')
  const categories = input.categoryBreakdown
    .map((c) => `- ${c.categoryName}：${c.totalMinutes}分钟（${c.percentage}%）`)
    .join('\n')

  return `统计周期：${period}

时间段记录：
${entries || '（无记录）'}

日程完成情况：
${schedules || '（无日程）'}

分类耗时占比：
${categories || '（无数据）'}`
}

export function buildAnalyzePrompt(input: AnalyzeInput): { system: string; user: string } {
  return { system: ANALYZE_SYSTEM_PROMPT, user: formatAnalyzeInput(input) }
}

export function buildSummarizePrompt(input: SummarizeInput): { system: string; user: string } {
  const base = formatAnalyzeInput(input)
  const reportTypeLabel = { daily: '日报', weekly: '周报', adhoc: '按需报告' }[input.reportType]
  const reflection = input.selfReflection ? `\n\n用户自我心得：\n${input.selfReflection}` : ''

  return {
    system: SUMMARIZE_SYSTEM_PROMPT,
    user: `报告类型：${reportTypeLabel}\n\n${base}${reflection}`
  }
}
