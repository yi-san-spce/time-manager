import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC } from '@shared/types/ipc'
import type {
  AgentConfirmToolCallInput,
  AgentGetMessagesInput,
  AgentRenameConversationInput,
  AgentSendMessageInput,
  CreateManualTimeEntryInput,
  CreateScheduleInput,
  CreateSubtaskInput,
  CreateTagInput,
  CreateTaskInput,
  ExportReportInput,
  ExpandRecurrenceInput,
  GenerateReportInput,
  LinkTimeEntryToTaskInput,
  ListTimeEntriesInput,
  MergeTimeEntriesInput,
  PomodoroConfig,
  PomodoroSnapshot,
  PomodoroCommand,
  PomodoroDispatchCommand,
  ReminderFirePayload,
  ReorderSubtasksInput,
  SaveAIProviderConfigInput,
  SetScheduleExceptionInput,
  SetTaskTagsInput,
  SetTaskQuickNoteInput,
  StatsQueryInput,
  ActivityDetailInput,
  SaveActivityNoteInput,
  SummarizeActivityInput,
  TimeEntry,
  TimeManagerApi,
  TrackingConfig,
  UIConfig,
  UpdateReportReflectionInput,
  UpdateScheduleInput,
  UpdateSubtaskInput,
  UpdateTaskInput,
  UpdateTimeEntryInput,
  UpsertCategoryInput
} from '@shared/types/ipc'
import type { AnalyzeInput, SummarizeInput } from '@shared/types/ai'

const api: TimeManagerApi = {
  schedule: {
    create: (input: CreateScheduleInput) => ipcRenderer.invoke(IPC.scheduleCreate, input),
    update: (input: UpdateScheduleInput) => ipcRenderer.invoke(IPC.scheduleUpdate, input),
    delete: (id: string) => ipcRenderer.invoke(IPC.scheduleDelete, id),
    list: () => ipcRenderer.invoke(IPC.scheduleList),
    get: (id: string) => ipcRenderer.invoke(IPC.scheduleGet, id),
    onReminderFire: (callback: (reminder: ReminderFirePayload) => void) => {
      const listener = (_event: unknown, reminder: ReminderFirePayload): void => callback(reminder)
      ipcRenderer.on(IPC.eventReminderFire, listener)
      return () => ipcRenderer.removeListener(IPC.eventReminderFire, listener)
    }
  },
  task: {
    create: (input: CreateTaskInput) => ipcRenderer.invoke(IPC.taskCreate, input),
    update: (input: UpdateTaskInput) => ipcRenderer.invoke(IPC.taskUpdate, input),
    delete: (id: string) => ipcRenderer.invoke(IPC.taskDelete, id),
    list: () => ipcRenderer.invoke(IPC.taskList),
    get: (id: string) => ipcRenderer.invoke(IPC.taskGet, id),
    setTags: (input: SetTaskTagsInput) => ipcRenderer.invoke(IPC.taskSetTags, input),
    getQuickNote: (taskId: string) => ipcRenderer.invoke(IPC.taskQuickNoteGet, taskId),
    setQuickNote: (input: SetTaskQuickNoteInput) => ipcRenderer.invoke(IPC.taskQuickNoteSet, input),
    onQuickNoteChanged: (callback: (taskId: string) => void) => {
      const listener = (_event: unknown, taskId: string): void => callback(taskId)
      ipcRenderer.on(IPC.eventTaskQuickNoteChanged, listener)
      return () => ipcRenderer.removeListener(IPC.eventTaskQuickNoteChanged, listener)
    }
  },
  subtask: {
    create: (input: CreateSubtaskInput) => ipcRenderer.invoke(IPC.subtaskCreate, input),
    update: (input: UpdateSubtaskInput) => ipcRenderer.invoke(IPC.subtaskUpdate, input),
    delete: (id: string) => ipcRenderer.invoke(IPC.subtaskDelete, id),
    reorder: (input: ReorderSubtasksInput) => ipcRenderer.invoke(IPC.subtaskReorder, input)
  },
  tag: {
    list: () => ipcRenderer.invoke(IPC.tagList),
    create: (input: CreateTagInput) => ipcRenderer.invoke(IPC.tagCreate, input),
    delete: (id: string) => ipcRenderer.invoke(IPC.tagDelete, id)
  },
  category: {
    list: () => ipcRenderer.invoke(IPC.categoryList),
    upsert: (input: UpsertCategoryInput) => ipcRenderer.invoke(IPC.categoryUpsert, input),
    delete: (id: string) => ipcRenderer.invoke(IPC.categoryDelete, id)
  },
  recurrence: {
    expand: (input: ExpandRecurrenceInput) => ipcRenderer.invoke(IPC.recurrenceExpand, input),
    setException: (input: SetScheduleExceptionInput) =>
      ipcRenderer.invoke(IPC.recurrenceSetException, input)
  },
  timeEntry: {
    list: (input: ListTimeEntriesInput) => ipcRenderer.invoke(IPC.timeEntryList, input),
    createManual: (input: CreateManualTimeEntryInput) =>
      ipcRenderer.invoke(IPC.timeEntryCreateManual, input),
    update: (input: UpdateTimeEntryInput) => ipcRenderer.invoke(IPC.timeEntryUpdate, input),
    merge: (input: MergeTimeEntriesInput) => ipcRenderer.invoke(IPC.timeEntryMerge, input),
    linkToTask: (input: LinkTimeEntryToTaskInput) => ipcRenderer.invoke(IPC.timeEntryLinkToTask, input),
    delete: (id: string) => ipcRenderer.invoke(IPC.timeEntryDelete, id),
    onNewEntry: (callback: (entry: TimeEntry) => void) => {
      const listener = (_event: unknown, entry: TimeEntry): void => callback(entry)
      ipcRenderer.on(IPC.eventTimeEntryNew, listener)
      return () => ipcRenderer.removeListener(IPC.eventTimeEntryNew, listener)
    }
  },
  tracking: {
    getConfig: () => ipcRenderer.invoke(IPC.trackingGetConfig),
    setConfig: (input: TrackingConfig) => ipcRenderer.invoke(IPC.trackingSetConfig, input)
  },
  stats: {
    query: (input: StatsQueryInput) => ipcRenderer.invoke(IPC.statsQuery, input)
  },
  activity: {
    detail: (input: ActivityDetailInput) => ipcRenderer.invoke(IPC.activityDetail, input),
    openHost: (host: string) => ipcRenderer.invoke(IPC.activityOpenHost, host),
    getNote: (scopeKey: string) => ipcRenderer.invoke(IPC.activityNoteGet, scopeKey),
    saveNote: (input: SaveActivityNoteInput) => ipcRenderer.invoke(IPC.activityNoteSave, input),
    summarize: (input: SummarizeActivityInput) => ipcRenderer.invoke(IPC.activitySummarize, input)
  },
  pomodoro: {
    getConfig: () => ipcRenderer.invoke(IPC.pomodoroGetConfig),
    setConfig: (input: PomodoroConfig) => ipcRenderer.invoke(IPC.pomodoroSetConfig, input)
  },
  settings: {
    getUIConfig: () => ipcRenderer.invoke(IPC.settingsGetUIConfig),
    setUIConfig: (input: UIConfig) => ipcRenderer.invoke(IPC.settingsSetUIConfig, input),
    onEffectiveThemeChanged: (callback: (effective: 'light' | 'dark') => void) => {
      const listener = (_event: unknown, effective: 'light' | 'dark'): void => callback(effective)
      ipcRenderer.on(IPC.eventEffectiveThemeChanged, listener)
      return () => ipcRenderer.removeListener(IPC.eventEffectiveThemeChanged, listener)
    }
  },
  ai: {
    listConfigs: () => ipcRenderer.invoke(IPC.aiListConfigs),
    saveConfig: (input: SaveAIProviderConfigInput) => ipcRenderer.invoke(IPC.aiSaveConfig, input),
    activateConfig: (id: string) => ipcRenderer.invoke(IPC.aiActivateConfig, id),
    deleteConfig: (id: string) => ipcRenderer.invoke(IPC.aiDeleteConfig, id),
    testConnection: (id: string) => ipcRenderer.invoke(IPC.aiTestConnection, id),
    analyze: (input: AnalyzeInput) => ipcRenderer.invoke(IPC.aiAnalyze, input),
    summarize: (input: SummarizeInput) => ipcRenderer.invoke(IPC.aiSummarize, input)
  },
  report: {
    generate: (input: GenerateReportInput) => ipcRenderer.invoke(IPC.reportGenerate, input),
    list: () => ipcRenderer.invoke(IPC.reportList),
    get: (id: string) => ipcRenderer.invoke(IPC.reportGet, id),
    updateReflection: (input: UpdateReportReflectionInput) =>
      ipcRenderer.invoke(IPC.reportUpdateReflection, input),
    export: (input: ExportReportInput) => ipcRenderer.invoke(IPC.reportExport, input),
    delete: (id: string) => ipcRenderer.invoke(IPC.reportDelete, id)
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onMaximizedChanged: (callback: (maximized: boolean) => void) => {
      const listener = (_event: unknown, maximized: boolean): void => callback(maximized)
      ipcRenderer.on('window:maximizedChanged', listener)
      return () => ipcRenderer.removeListener('window:maximizedChanged', listener)
    }
  },
  agent: {
    sendMessage: (input: AgentSendMessageInput) => ipcRenderer.invoke(IPC.agentSendMessage, input),
    confirmToolCall: (input: AgentConfirmToolCallInput) => ipcRenderer.invoke(IPC.agentConfirmToolCall, input),
    getMessages: (input: AgentGetMessagesInput) => ipcRenderer.invoke(IPC.agentGetMessages, input),
    clearConversation: (input: AgentGetMessagesInput) => ipcRenderer.invoke(IPC.agentClearConversation, input),
    listConversations: () => ipcRenderer.invoke(IPC.agentListConversations),
    createConversation: () => ipcRenderer.invoke(IPC.agentCreateConversation),
    deleteConversation: (conversationId: string) => ipcRenderer.invoke(IPC.agentDeleteConversation, conversationId),
    renameConversation: (input: AgentRenameConversationInput) =>
      ipcRenderer.invoke(IPC.agentRenameConversation, input)
  },
  floatingAssistant: {
    open: () => ipcRenderer.invoke(IPC.floatingAssistantOpen),
    close: () => ipcRenderer.invoke(IPC.floatingAssistantClose)
  },
  floatingWidget: {
    open: () => ipcRenderer.invoke(IPC.floatingWidgetOpen),
    close: () => ipcRenderer.invoke(IPC.floatingWidgetClose),
    getContext: () => ipcRenderer.invoke(IPC.widgetGetContext),
    onContextChanged: (callback: () => void) => {
      const listener = (): void => callback()
      ipcRenderer.on(IPC.eventWidgetContextChanged, listener)
      return () => ipcRenderer.removeListener(IPC.eventWidgetContextChanged, listener)
    },
    getQuickNote: () => ipcRenderer.invoke(IPC.quickNoteGet),
    setQuickNote: (text: string) => ipcRenderer.invoke(IPC.quickNoteSet, text)
  },
  pomodoroSync: {
    publishState: (snapshot: PomodoroSnapshot) => ipcRenderer.send(IPC.pomodoroPublishState, snapshot),
    onStateChanged: (callback: (snapshot: PomodoroSnapshot) => void) => {
      const listener = (_event: unknown, snapshot: PomodoroSnapshot): void => callback(snapshot)
      ipcRenderer.on(IPC.pomodoroStateChanged, listener)
      return () => ipcRenderer.removeListener(IPC.pomodoroStateChanged, listener)
    },
    sendCommand: (command: PomodoroCommand) => ipcRenderer.send(IPC.pomodoroSendCommand, command),
    onCommand: (callback: (command: PomodoroDispatchCommand) => void) => {
      const listener = (_event: unknown, command: PomodoroDispatchCommand): void => callback(command)
      ipcRenderer.on(IPC.pomodoroCommandReceived, listener)
      return () => ipcRenderer.removeListener(IPC.pomodoroCommandReceived, listener)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error contextIsolation 关闭时的兜底路径，不应发生
  window.electron = electronAPI
  // @ts-expect-error contextIsolation 关闭时的兜底路径，不应发生
  window.api = api
}
