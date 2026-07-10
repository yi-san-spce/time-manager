import { z } from 'zod'

const priority = z.union([z.literal(1), z.literal(2), z.literal(3)])

const recurrenceSchema = z.object({
  freq: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  interval: z.number().int().min(1).optional(),
  byWeekday: z.array(z.number().int().min(0).max(6)).nullable().optional(),
  untilDate: z.number().nullable().optional(),
  count: z.number().int().min(1).nullable().optional()
})

export const createScheduleSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  priority: priority.optional(),
  startTime: z.number(),
  endTime: z.number(),
  reminderMinutesBefore: z.number().nullable().optional(),
  recurrence: recurrenceSchema.nullable().optional()
})

export const updateScheduleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  priority: priority.optional(),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
  reminderMinutesBefore: z.number().nullable().optional(),
  status: z.enum(['planned', 'completed', 'skipped', 'cancelled']).optional()
})

export const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  priority: priority.optional(),
  scheduleId: z.string().nullable().optional(),
  dueDate: z.number().nullable().optional(),
  estimateMinutes: z.number().int().min(0).nullable().optional()
})

export const updateTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  priority: priority.optional(),
  scheduleId: z.string().nullable().optional(),
  status: z.enum(['pending', 'in_progress', 'blocked', 'done', 'cancelled']).optional(),
  dueDate: z.number().nullable().optional(),
  estimateMinutes: z.number().int().min(0).nullable().optional()
})

export const createSubtaskSchema = z.object({
  taskId: z.string().min(1),
  title: z.string().min(1)
})

export const updateSubtaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  done: z.boolean().optional()
})

export const reorderSubtasksSchema = z.object({
  taskId: z.string().min(1),
  orderedIds: z.array(z.string().min(1))
})

export const createTagSchema = z.object({
  name: z.string().min(1),
  color: z.string().nullable().optional()
})

export const setTaskTagsSchema = z.object({
  taskId: z.string().min(1),
  tagIds: z.array(z.string().min(1))
})

export const upsertCategorySchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  color: z.string().nullable().optional()
})

export const expandRecurrenceSchema = z.object({
  rangeStart: z.number(),
  rangeEnd: z.number()
})

export const setScheduleExceptionSchema = z.object({
  scheduleId: z.string().min(1),
  occurrenceDate: z.number(),
  action: z.enum(['skipped', 'completed'])
})

export const listTimeEntriesSchema = z.object({
  rangeStart: z.number(),
  rangeEnd: z.number()
})

export const statsQuerySchema = z.object({
  rangeStart: z.number(),
  rangeEnd: z.number()
})

export const activityDetailSchema = z.object({
  appName: z.string().min(1),
  rangeStart: z.number(),
  rangeEnd: z.number()
})

export const saveActivityNoteSchema = z.object({
  scopeKey: z.string().min(1),
  note: z.string().nullable()
})

export const summarizeActivitySchema = z.object({
  appName: z.string().min(1),
  rangeStart: z.number(),
  rangeEnd: z.number()
})

export const createManualTimeEntrySchema = z.object({
  taskId: z.string().nullable().optional(),
  startTime: z.number(),
  endTime: z.number(),
  note: z.string().nullable().optional()
})

export const updateTimeEntrySchema = z.object({
  id: z.string().min(1),
  taskId: z.string().nullable().optional(),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
  note: z.string().nullable().optional()
})

export const mergeTimeEntriesSchema = z.object({
  ids: z.array(z.string().min(1)).min(2),
  taskId: z.string().nullable().optional()
})

export const linkTimeEntryToTaskSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().nullable()
})

export const trackingConfigSchema = z.object({
  intervalSeconds: z.number().int().min(5).max(60),
  minSegmentSeconds: z.number().int().min(0).max(300)
})

export const pomodoroConfigSchema = z.object({
  focusMinutes: z.number().int().min(1).max(180),
  shortBreakMinutes: z.number().int().min(1).max(60),
  longBreakMinutes: z.number().int().min(1).max(120),
  longBreakInterval: z.number().int().min(1).max(12)
})

export const uiConfigSchema = z.object({
  themeMode: z.enum(['light', 'dark', 'system'])
})

export const saveAIProviderConfigSchema = z.object({
  id: z.string().min(1).optional(),
  provider: z.enum(['claude', 'openai']),
  model: z.string().min(1),
  apiKey: z.string().min(1),
  baseUrl: z.string().url().nullable().optional()
})

export const generateReportSchema = z.object({
  type: z.enum(['daily', 'weekly', 'adhoc']),
  periodStart: z.number(),
  periodEnd: z.number(),
  selfReflection: z.string().nullable().optional()
})

export const updateReportReflectionSchema = z.object({
  id: z.string().min(1),
  selfReflection: z.string().nullable()
})

export const exportReportSchema = z.object({
  id: z.string().min(1),
  format: z.enum(['md', 'pdf'])
})

const agentScope = z.enum(['global', 'task'])

export const agentSendMessageSchema = z.object({
  scope: agentScope,
  taskId: z.string().min(1).nullable().optional(),
  conversationId: z.string().min(1).nullable().optional(),
  text: z.string().min(1)
})

export const agentConfirmToolCallSchema = z.object({
  scope: agentScope,
  taskId: z.string().min(1).nullable().optional(),
  conversationId: z.string().min(1).nullable().optional(),
  messageId: z.string().min(1),
  approved: z.boolean(),
  editedToolCalls: z.record(z.string(), z.unknown()).optional()
})

export const agentGetMessagesSchema = z.object({
  scope: agentScope,
  taskId: z.string().min(1).nullable().optional(),
  conversationId: z.string().min(1).nullable().optional()
})

export const agentRenameConversationSchema = z.object({
  conversationId: z.string().min(1),
  title: z.string().max(80).nullable()
})

// 悬浮小窗（需求6）
export const quickNoteSchema = z.string().max(5000)

export const pomodoroSnapshotSchema = z.object({
  phase: z.enum(['focus', 'shortBreak', 'longBreak']),
  running: z.boolean(),
  remainingMs: z.number().nonnegative(),
  totalMs: z.number().nonnegative(),
  linkLabel: z.string().nullable(),
  active: z.boolean()
})

export const pomodoroCommandSchema = z.enum(['pause', 'resume', 'stop', 'skip'])
