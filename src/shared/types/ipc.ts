import type {
  Category,
  Priority,
  RecurrenceFreq,
  Report,
  ReportKind,
  Schedule,
  ScheduleExceptionAction,
  ScheduleOccurrence,
  ScheduleStatus,
  Subtask,
  Tag,
  Task,
  TaskDetail,
  TaskListItem,
  TaskStatus,
  TimeEntry,
  TimeStatBucket,
  AgentScope,
  AgentMessage,
  AgentConversation
} from './models'
import type { ThemeMode } from './ui'
import type { AIProviderConfig, AIProviderName, AnalyzeInput, AnalyzeResult, SummarizeInput, TestConnectionResult } from './ai'

export type { TimeEntry }

export interface RecurrenceInput {
  freq: RecurrenceFreq
  interval?: number
  byWeekday?: number[] | null
  untilDate?: number | null
  count?: number | null
}

export interface CreateScheduleInput {
  title: string
  description?: string | null
  categoryId?: string | null
  priority?: Priority
  startTime: number
  endTime: number
  reminderMinutesBefore?: number | null
  recurrence?: RecurrenceInput | null
}

/** 提醒触发时推给渲染进程的载荷（同时会弹出系统通知）。 */
export interface ReminderFirePayload {
  scheduleId: string
  title: string
  /** 日程（或该次发生）的开始时间戳（毫秒） */
  startTime: number
}

export interface UpdateScheduleInput {
  id: string
  title?: string
  description?: string | null
  categoryId?: string | null
  priority?: Priority
  startTime?: number
  endTime?: number
  reminderMinutesBefore?: number | null
  status?: ScheduleStatus
}

export interface CreateTaskInput {
  title: string
  description?: string | null
  categoryId?: string | null
  priority?: Priority
  scheduleId?: string | null
  dueDate?: number | null
  estimateMinutes?: number | null
}

export interface UpdateTaskInput {
  id: string
  title?: string
  description?: string | null
  categoryId?: string | null
  priority?: Priority
  scheduleId?: string | null
  status?: TaskStatus
  dueDate?: number | null
  estimateMinutes?: number | null
}

export interface CreateSubtaskInput {
  taskId: string
  title: string
}

export interface UpdateSubtaskInput {
  id: string
  title?: string
  done?: boolean
}

export interface ReorderSubtasksInput {
  taskId: string
  orderedIds: string[]
}

export interface CreateTagInput {
  name: string
  color?: string | null
}

export interface SetTaskTagsInput {
  taskId: string
  tagIds: string[]
}

export interface UpsertCategoryInput {
  id?: string
  name: string
  color?: string | null
}

export interface ExpandRecurrenceInput {
  rangeStart: number
  rangeEnd: number
}

export interface StatsQueryInput {
  rangeStart: number
  rangeEnd: number
}

export interface TimeStatsResult {
  totalMinutes: number
  byApp: TimeStatBucket[]
  byDomain: TimeStatBucket[]
  byWindowTitle: TimeStatBucket[]
  byTask: TimeStatBucket[]
}

export interface ActivityNoteData {
  scopeKey: string
  note: string | null
  aiSummary: string | null
  updatedAt: number
}

export interface SaveActivityNoteInput {
  scopeKey: string
  note: string | null
}

/** 某应用在某时间段内访问过的目标（域名或窗口标题）+ 各自时长（分钟）。 */
export interface ActivityDetailTarget {
  key: string
  minutes: number
  count: number
  /** Present only when the recorded domain is a validated complete hostname. */
  readonly openHost?: string
}

export interface AppActivityDetail {
  appName: string
  totalMinutes: number
  targets: ActivityDetailTarget[]
  segments: TimeEntry[]
}

export interface ActivityDetailInput {
  appName: string
  rangeStart: number
  rangeEnd: number
}

export interface SummarizeActivityInput {
  appName: string
  rangeStart: number
  rangeEnd: number
}

export interface SetScheduleExceptionInput {
  scheduleId: string
  occurrenceDate: number
  action: ScheduleExceptionAction
}

export interface CreateManualTimeEntryInput {
  taskId?: string | null
  startTime: number
  endTime: number
  note?: string | null
}

export interface UpdateTimeEntryInput {
  id: string
  taskId?: string | null
  startTime?: number
  endTime?: number
  note?: string | null
}

export interface MergeTimeEntriesInput {
  ids: string[]
  taskId?: string | null
}

export interface LinkTimeEntryToTaskInput {
  id: string
  taskId: string | null
}

export interface ListTimeEntriesInput {
  rangeStart: number
  rangeEnd: number
}

export interface TrackingConfig {
  intervalSeconds: number
  minSegmentSeconds: number
}

export interface PomodoroConfig {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  longBreakInterval: number
}

/**
 * 番茄钟快照（需求6）：主窗口渲染进程是唯一计时权威，通过主进程中继把此快照广播给悬浮小窗，
 * 悬浮窗只镜像展示 + 回传命令，避免两个渲染进程各自计时导致重复落库/状态漂移。
 */
export interface PomodoroSnapshot {
  phase: 'focus' | 'shortBreak' | 'longBreak'
  running: boolean
  remainingMs: number
  totalMs: number
  /** 关联的任务/日程标题；未启动为 null */
  linkLabel: string | null
  /** 是否已启动（link 非空） */
  active: boolean
}

/** 悬浮小窗回传给主窗口计时器的控制命令（需求6）。 */
export type PomodoroCommand = 'pause' | 'resume' | 'stop' | 'skip'

/** 悬浮小窗“当前上下文”卡片数据（需求6）：此刻命中的日程 + 其关联任务。 */
export interface WidgetContext {
  schedule: {
    id: string
    title: string
    startTime: number
    endTime: number
  } | null
  tasks: Array<{
    id: string
    title: string
    status: TaskStatus
  }>
}

export interface UIConfig {
  themeMode: ThemeMode
}

export interface SaveAIProviderConfigInput {
  id?: string
  provider: AIProviderName
  model: string
  apiKey: string
  baseUrl?: string | null
}

export interface GenerateReportInput {
  type: ReportKind
  periodStart: number
  periodEnd: number
  selfReflection?: string | null
}

export interface UpdateReportReflectionInput {
  id: string
  selfReflection: string | null
}

export interface ExportReportInput {
  id: string
  format: 'md' | 'pdf'
}

export interface ExportReportResult {
  filePath: string
}

export interface AgentSendMessageInput {
  scope: AgentScope
  taskId?: string | null
  /** global 多对话：目标对话 id，省略则用最近一条或新建（需求7）。 */
  conversationId?: string | null
  text: string
}

export interface AgentConfirmToolCallInput {
  scope: AgentScope
  taskId?: string | null
  conversationId?: string | null
  messageId: string
  approved: boolean
  /** 需求11：用户在确认前编辑了 AI 拟的工具参数（按 toolCallId 映射覆盖 arguments）。 */
  editedToolCalls?: Record<string, unknown>
}

export interface AgentGetMessagesInput {
  scope: AgentScope
  taskId?: string | null
  conversationId?: string | null
}

export interface AgentRenameConversationInput {
  conversationId: string
  title: string | null
}

export interface AgentReply {
  conversationId: string
  messages: AgentMessage[]
  awaitingConfirmation: boolean
}

export const IPC = {
  scheduleCreate: 'schedule:create',
  scheduleUpdate: 'schedule:update',
  scheduleDelete: 'schedule:delete',
  scheduleList: 'schedule:list',
  scheduleGet: 'schedule:get',
  taskCreate: 'task:create',
  taskUpdate: 'task:update',
  taskDelete: 'task:delete',
  taskList: 'task:list',
  taskGet: 'task:get',
  subtaskCreate: 'subtask:create',
  subtaskUpdate: 'subtask:update',
  subtaskDelete: 'subtask:delete',
  subtaskReorder: 'subtask:reorder',
  tagList: 'tag:list',
  tagCreate: 'tag:create',
  tagDelete: 'tag:delete',
  taskSetTags: 'task:setTags',
  categoryList: 'category:list',
  categoryUpsert: 'category:upsert',
  categoryDelete: 'category:delete',
  recurrenceExpand: 'recurrence:expand',
  recurrenceSetException: 'recurrence:setException',
  timeEntryList: 'timeEntry:list',
  timeEntryCreateManual: 'timeEntry:createManual',
  timeEntryUpdate: 'timeEntry:update',
  timeEntryMerge: 'timeEntry:merge',
  timeEntryLinkToTask: 'timeEntry:linkToTask',
  timeEntryDelete: 'timeEntry:delete',
  statsQuery: 'stats:query',
  activityDetail: 'activity:detail',
  activityOpenHost: 'activity:openHost',
  activityNoteGet: 'activityNote:get',
  activityNoteSave: 'activityNote:save',
  activitySummarize: 'activity:summarize',
  trackingGetConfig: 'tracking:getConfig',
  trackingSetConfig: 'tracking:setConfig',
  pomodoroGetConfig: 'pomodoro:getConfig',
  pomodoroSetConfig: 'pomodoro:setConfig',
  settingsGetUIConfig: 'settings:getUIConfig',
  settingsSetUIConfig: 'settings:setUIConfig',
  aiListConfigs: 'ai:listConfigs',
  aiSaveConfig: 'ai:saveConfig',
  aiActivateConfig: 'ai:activateConfig',
  aiDeleteConfig: 'ai:deleteConfig',
  aiTestConnection: 'ai:testConnection',
  aiAnalyze: 'ai:analyze',
  aiSummarize: 'ai:summarize',
  reportGenerate: 'report:generate',
  reportList: 'report:list',
  reportGet: 'report:get',
  reportUpdateReflection: 'report:updateReflection',
  reportExport: 'report:export',
  reportDelete: 'report:delete',
  agentSendMessage: 'agent:sendMessage',
  agentConfirmToolCall: 'agent:confirmToolCall',
  agentGetMessages: 'agent:getMessages',
  agentClearConversation: 'agent:clearConversation',
  agentListConversations: 'agent:listConversations',
  agentCreateConversation: 'agent:createConversation',
  agentDeleteConversation: 'agent:deleteConversation',
  agentRenameConversation: 'agent:renameConversation',
  floatingAssistantOpen: 'floatingAssistant:open',
  floatingAssistantClose: 'floatingAssistant:close',
  floatingWidgetOpen: 'floatingWidget:open',
  floatingWidgetClose: 'floatingWidget:close',
  widgetGetContext: 'widget:getContext',
  quickNoteGet: 'quickNote:get',
  quickNoteSet: 'quickNote:set',
  // 番茄钟跨窗同步（需求6）：主窗口发布状态、悬浮窗回传命令，均经主进程中继
  pomodoroPublishState: 'pomodoro:publishState',
  pomodoroStateChanged: 'pomodoro:stateChanged',
  pomodoroSendCommand: 'pomodoro:sendCommand',
  pomodoroCommandReceived: 'pomodoro:commandReceived',
  eventEffectiveThemeChanged: 'event:effectiveThemeChanged',
  eventTimeEntryNew: 'event:timeEntry:new',
  eventReminderFire: 'event:reminder:fire'
} as const

export interface TimeManagerApi {
  schedule: {
    create(input: CreateScheduleInput): Promise<Schedule>
    update(input: UpdateScheduleInput): Promise<Schedule>
    delete(id: string): Promise<void>
    list(): Promise<Schedule[]>
    get(id: string): Promise<Schedule | null>
    /** 提醒到点时主进程推送（同时弹系统通知）；返回取消订阅函数 */
    onReminderFire(callback: (reminder: ReminderFirePayload) => void): () => void
  }
  task: {
    create(input: CreateTaskInput): Promise<Task>
    update(input: UpdateTaskInput): Promise<Task>
    delete(id: string): Promise<void>
    list(): Promise<TaskListItem[]>
    get(id: string): Promise<TaskDetail | null>
    setTags(input: SetTaskTagsInput): Promise<TaskDetail>
  }
  subtask: {
    create(input: CreateSubtaskInput): Promise<Subtask>
    update(input: UpdateSubtaskInput): Promise<Subtask>
    delete(id: string): Promise<void>
    reorder(input: ReorderSubtasksInput): Promise<Subtask[]>
  }
  tag: {
    list(): Promise<Tag[]>
    create(input: CreateTagInput): Promise<Tag>
    delete(id: string): Promise<void>
  }
  category: {
    list(): Promise<Category[]>
    upsert(input: UpsertCategoryInput): Promise<Category>
    delete(id: string): Promise<void>
  }
  recurrence: {
    expand(input: ExpandRecurrenceInput): Promise<ScheduleOccurrence[]>
    setException(input: SetScheduleExceptionInput): Promise<void>
  }
  timeEntry: {
    list(input: ListTimeEntriesInput): Promise<TimeEntry[]>
    createManual(input: CreateManualTimeEntryInput): Promise<TimeEntry>
    update(input: UpdateTimeEntryInput): Promise<TimeEntry>
    merge(input: MergeTimeEntriesInput): Promise<TimeEntry>
    linkToTask(input: LinkTimeEntryToTaskInput): Promise<TimeEntry>
    delete(id: string): Promise<void>
    onNewEntry(callback: (entry: TimeEntry) => void): () => void
  }
  tracking: {
    getConfig(): Promise<TrackingConfig>
    setConfig(input: TrackingConfig): Promise<TrackingConfig>
  }
  stats: {
    query(input: StatsQueryInput): Promise<TimeStatsResult>
  }
  activity: {
    detail(input: ActivityDetailInput): Promise<AppActivityDetail>
    openHost(host: string): Promise<void>
    getNote(scopeKey: string): Promise<ActivityNoteData | null>
    saveNote(input: SaveActivityNoteInput): Promise<ActivityNoteData>
    summarize(input: SummarizeActivityInput): Promise<string>
  }
  pomodoro: {
    getConfig(): Promise<PomodoroConfig>
    setConfig(input: PomodoroConfig): Promise<PomodoroConfig>
  }
  settings: {
    getUIConfig(): Promise<UIConfig>
    setUIConfig(input: UIConfig): Promise<UIConfig>
    /** 系统跟随模式下，主进程 nativeTheme 变化时推送当前生效的明暗主题（'light' | 'dark'） */
    onEffectiveThemeChanged(callback: (effective: 'light' | 'dark') => void): () => void
  }
  ai: {
    listConfigs(): Promise<AIProviderConfig[]>
    saveConfig(input: SaveAIProviderConfigInput): Promise<AIProviderConfig>
    activateConfig(id: string): Promise<void>
    deleteConfig(id: string): Promise<void>
    testConnection(id: string): Promise<TestConnectionResult>
    analyze(input: AnalyzeInput): Promise<AnalyzeResult>
    summarize(input: SummarizeInput): Promise<string>
  }
  report: {
    generate(input: GenerateReportInput): Promise<Report>
    list(): Promise<Report[]>
    get(id: string): Promise<Report | null>
    updateReflection(input: UpdateReportReflectionInput): Promise<Report>
    export(input: ExportReportInput): Promise<ExportReportResult>
    delete(id: string): Promise<void>
  }
  window: {
    minimize(): Promise<void>
    toggleMaximize(): Promise<boolean>
    close(): Promise<void>
    isMaximized(): Promise<boolean>
    onMaximizedChanged(callback: (maximized: boolean) => void): () => void
  }
  agent: {
    sendMessage(input: AgentSendMessageInput): Promise<AgentReply>
    confirmToolCall(input: AgentConfirmToolCallInput): Promise<AgentReply>
    getMessages(input: AgentGetMessagesInput): Promise<AgentMessage[]>
    clearConversation(input: AgentGetMessagesInput): Promise<void>
    /** 列出全部 global 对话（历史侧栏，需求7） */
    listConversations(): Promise<AgentConversation[]>
    /** 新建一条 global 对话，返回其 id */
    createConversation(): Promise<string>
    /** 删除一条对话（含消息） */
    deleteConversation(conversationId: string): Promise<void>
    /** 重命名对话标题（null 恢复自动预览） */
    renameConversation(input: AgentRenameConversationInput): Promise<void>
  }
  floatingAssistant: {
    /** 打开/聚焦悬浮 AI 助手小窗（始终置顶） */
    open(): Promise<void>
    /** 关闭悬浮小窗 */
    close(): Promise<void>
  }
  floatingWidget: {
    /** 打开/聚焦悬浮信息小窗（当前日程/任务/番茄/随心记，需求6） */
    open(): Promise<void>
    close(): Promise<void>
    /** 此刻命中的日程及其关联任务 */
    getContext(): Promise<WidgetContext>
    /** 随心记读取/保存（app_settings 持久化，重启仍在） */
    getQuickNote(): Promise<string>
    setQuickNote(text: string): Promise<void>
  }
  pomodoroSync: {
    /** 主窗口渲染进程发布最新计时快照给主进程中继 */
    publishState(snapshot: PomodoroSnapshot): void
    /** 订阅计时快照（悬浮窗镜像用）；返回取消订阅 */
    onStateChanged(callback: (snapshot: PomodoroSnapshot) => void): () => void
    /** 悬浮窗向主窗口发送控制命令 */
    sendCommand(command: PomodoroCommand): void
    /** 主窗口订阅来自悬浮窗的命令；返回取消订阅 */
    onCommand(callback: (command: PomodoroCommand) => void): () => void
  }
}
