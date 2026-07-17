export type Priority = 1 | 2 | 3

export type ScheduleStatus = 'planned' | 'completed' | 'skipped' | 'cancelled'

export type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'done' | 'cancelled'

export type TimeEntrySource = 'auto' | 'manual'

export type RecurrenceFreq = 'DAILY' | 'WEEKLY' | 'MONTHLY'

export interface Category {
  id: string
  name: string
  color: string | null
  createdAt: number
}

export interface RecurrenceRule {
  id: string
  freq: RecurrenceFreq
  interval: number
  byWeekday: number[] | null
  untilDate: number | null
  count: number | null
}

export interface Schedule {
  id: string
  title: string
  description: string | null
  categoryId: string | null
  priority: Priority
  startTime: number
  endTime: number
  recurrenceRuleId: string | null
  reminderMinutesBefore: number | null
  status: ScheduleStatus
  createdAt: number
  updatedAt: number
}

export type ScheduleExceptionAction = 'skipped' | 'completed'

export interface ScheduleException {
  scheduleId: string
  occurrenceDate: number
  action: ScheduleExceptionAction
}

/**
 * 重复日程展开后的一次具体发生实例。母版重复日程按需展开为多个 ScheduleOccurrence，
 * 不在数据库里持久化每一次发生 —— occurrenceStart/occurrenceEnd 是计算得出的。
 */
export interface ScheduleOccurrence {
  schedule: Schedule
  occurrenceStart: number
  occurrenceEnd: number
  exceptionAction: ScheduleExceptionAction | null
}

export interface Task {
  id: string
  title: string
  description: string | null
  categoryId: string | null
  priority: Priority
  scheduleId: string | null
  status: TaskStatus
  dueDate: number | null
  estimateMinutes: number | null
  createdAt: number
  updatedAt: number
}

export interface Subtask {
  id: string
  taskId: string
  title: string
  done: boolean
  sortOrder: number
  createdAt: number
  updatedAt: number
}

export interface Tag {
  id: string
  name: string
  color: string | null
}

/** 任务详情：任务本体 + 子任务清单 + 标签，用于 task:get 与详情抽屉。 */
export interface TaskDetail extends Task {
  subtasks: Subtask[]
  tags: Tag[]
}

/** 列表视图用：任务本体 + 子任务完成计数（用于进度条）+ 标签。 */
export interface TaskListItem extends Task {
  subtaskDone: number
  subtaskTotal: number
  tags: Tag[]
}

export interface TimeEntry {
  id: string
  taskId: string | null
  /** Optional calendar context selected when the entry was created or edited. */
  scheduleId: string | null
  startTime: number
  endTime: number
  source: TimeEntrySource
  appName: string | null
  windowTitle: string | null
  domain: string | null
  note: string | null
  createdAt: number
  updatedAt: number
}

/** A free-form note that belongs to one task and is shared by task detail and the floating widget. */
export interface TaskQuickNote {
  taskId: string
  text: string
  updatedAt: number
}

export type ReportKind = 'daily' | 'weekly' | 'adhoc'

/** 追踪时长聚合的一个分组桶（按应用/域名/窗口标题/任务/分类）。 */
export interface TimeStatBucket {
  /** 分组键（如应用名、域名、任务标题、分类名）。 */
  key: string
  minutes: number
  /** 该分组下的记录条数。 */
  count: number
}

export interface Report {
  id: string
  type: ReportKind
  periodStart: number
  periodEnd: number
  selfReflection: string | null
  aiSummary: string | null
  aiProviderUsed: string | null
  generatedAt: number | null
  createdAt: number
  updatedAt: number
}

export type AgentScope = 'global' | 'task'

export type AgentMessageRole = 'user' | 'assistant' | 'tool'

/** 消息层面的确认态：写类工具调用需用户确认 */
export type AgentMessageStatus = 'pending' | 'confirmed' | 'cancelled' | 'executed' | 'failed'

/** AI 拟调用的一个工具（含参数），用于渲染工具卡/确认卡 */
export interface AgentToolCall {
  id: string
  name: string
  arguments: unknown
  /** 是否写类工具（需确认） */
  write: boolean
}

/** 一条对话的元信息（用于助手页历史侧栏，需求7）。global 可有多条；task 每任务一条。 */
export interface AgentConversation {
  id: string
  scope: AgentScope
  taskId: string | null
  /** 显示标题；为空时 UI 用 preview 兜底 */
  title: string | null
  /** 首条用户消息摘要，供侧栏预览 */
  preview: string | null
  /** 不含 tool 角色的消息数 */
  messageCount: number
  createdAt: number
  updatedAt: number
}

/** 渲染给 UI 的对话消息（不含底层 tool_result 细节） */
export interface AgentMessage {
  id: string
  role: AgentMessageRole
  content: string
  /** assistant 消息附带的工具调用（若有） */
  toolCalls: AgentToolCall[] | null
  status: AgentMessageStatus | null
  /** AI 思考摘要（需求11）：来自 Claude 适配层 stream + display:"summarized"；可空。 */
  thinking: string | null
  createdAt: number
}
