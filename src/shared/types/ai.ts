export type AIProviderName = 'claude' | 'openai'

export interface TimeEntrySummaryItem {
  taskTitle: string
  categoryName: string
  durationMinutes: number
  source: 'auto' | 'manual'
}

export interface ScheduleCompletionItem {
  title: string
  planned: boolean
  completed: boolean
}

export interface CategoryBreakdownItem {
  categoryName: string
  totalMinutes: number
  percentage: number
}

export interface AnalyzeInput {
  periodStart: number
  periodEnd: number
  timeEntries: TimeEntrySummaryItem[]
  scheduleCompletion: ScheduleCompletionItem[]
  categoryBreakdown: CategoryBreakdownItem[]
}

export interface AnalyzeResult {
  /** 结构化解析成功时的字段；解析失败时为 null，仅保留 rawText 供降级展示。 */
  focusScore: number | null
  summary: string | null
  suggestions: string[] | null
  rawText: string
}

export type ReportType = 'daily' | 'weekly' | 'adhoc'

export interface SummarizeInput extends AnalyzeInput {
  selfReflection?: string | null
  reportType: ReportType
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string
  toolCalls?: { id: string; name: string; arguments: unknown }[]
}

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface ChatInput {
  messages: ChatMessage[]
  tools: ToolDefinition[]
}

export type ChatResult =
  | { type: 'text'; content: string; thinking?: string | null }
  | { type: 'tool_calls'; calls: { id: string; name: string; arguments: unknown }[]; thinking?: string | null }

export interface TestConnectionResult {
  ok: boolean
  message?: string
}

export interface AIProviderConfig {
  id: string
  provider: AIProviderName
  model: string
  isActive: boolean
  /** 是否已配置 API Key（renderer 永远拿不到明文 key 本身）。 */
  hasApiKey: boolean
  /** 自定义 API Base URL（兼容协议的第三方代理）；null 表示用官方默认端点。 */
  baseUrl: string | null
  createdAt: number
  updatedAt: number
}
