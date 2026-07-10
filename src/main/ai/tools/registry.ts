import { z } from 'zod'
import { listSchedules } from '../../db/repositories/scheduleRepo'
import { createSchedule } from '../../db/repositories/scheduleRepo'
import { listTasks, getTaskDetail, createTask, updateTask } from '../../db/repositories/taskRepo'
import { createSubtask } from '../../db/repositories/subtaskRepo'
import { listTimeEntries } from '../../db/repositories/timeEntryRepo'
import { listCategories } from '../../db/repositories/categoryRepo'
import { generateReport } from '../../services/reportGenerator'
import { emitSchedulesChanged } from '../../services/scheduleChangeBus'

/**
 * Agent 工具注册表。每个工具：
 * - schema：zod 输入校验（AI 返回的参数唯一入口，和人工走 IPC 校验一致）
 * - jsonSchema：给模型看的 JSON Schema（tool use 定义）
 * - write：是否写类（写类需用户确认后才执行）
 * - summarize：生成确认卡片的人类可读摘要
 * - execute：复用既有 repository/service，不另起写库逻辑
 */
export interface ToolContext {
  /** task scope 时绑定的任务 id，propose_subtasks 默认作用于它 */
  taskId?: string | null
}

export interface AgentTool {
  name: string
  description: string
  write: boolean
  schema: z.ZodTypeAny
  jsonSchema: Record<string, unknown>
  summarize: (args: unknown, ctx: ToolContext) => string
  execute: (args: unknown, ctx: ToolContext) => Promise<unknown> | unknown
}

const listSchedulesTool: AgentTool = {
  name: 'list_schedules',
  description: '列出所有日程（标题、起止时间、状态）。用于回答关于安排的问题。',
  write: false,
  schema: z.object({}).optional(),
  jsonSchema: { type: 'object', properties: {} },
  summarize: () => '查询日程列表',
  execute: () =>
    listSchedules().map((s) => ({
      id: s.id,
      title: s.title,
      startTime: s.startTime,
      endTime: s.endTime,
      status: s.status,
      priority: s.priority
    }))
}

const listTasksTool: AgentTool = {
  name: 'list_tasks',
  description: '列出所有任务（标题、状态、优先级、子任务完成数）。',
  write: false,
  schema: z.object({}).optional(),
  jsonSchema: { type: 'object', properties: {} },
  summarize: () => '查询任务列表',
  execute: () =>
    listTasks().map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      subtaskDone: t.subtaskDone,
      subtaskTotal: t.subtaskTotal,
      dueDate: t.dueDate
    }))
}

const getTaskTool: AgentTool = {
  name: 'get_task',
  description: '获取单个任务的完整详情，包括描述与子任务清单。',
  write: false,
  schema: z.object({ taskId: z.string().min(1) }),
  jsonSchema: {
    type: 'object',
    properties: { taskId: { type: 'string', description: '任务 id' } },
    required: ['taskId']
  },
  summarize: () => '查询任务详情',
  execute: (args) => {
    const { taskId } = args as { taskId: string }
    return getTaskDetail(taskId)
  }
}

const queryTimeStatsTool: AgentTool = {
  name: 'query_time_stats',
  description:
    '按时间范围聚合追踪时长，返回各任务/分类的耗时（分钟）。时间用毫秒时间戳。用于回答"我在X上花了多久"。',
  write: false,
  schema: z.object({ rangeStart: z.number(), rangeEnd: z.number() }),
  jsonSchema: {
    type: 'object',
    properties: {
      rangeStart: { type: 'number', description: '起始毫秒时间戳' },
      rangeEnd: { type: 'number', description: '结束毫秒时间戳' }
    },
    required: ['rangeStart', 'rangeEnd']
  },
  summarize: () => '查询时间统计',
  execute: (args) => {
    const { rangeStart, rangeEnd } = args as { rangeStart: number; rangeEnd: number }
    const entries = listTimeEntries(rangeStart, rangeEnd)
    const tasks = new Map(listTasks().map((t) => [t.id, t]))
    const categories = new Map(listCategories().map((c) => [c.id, c]))
    const byCategory = new Map<string, number>()
    let total = 0
    for (const e of entries) {
      const minutes = Math.round((e.endTime - e.startTime) / 60000)
      total += minutes
      const task = e.taskId ? tasks.get(e.taskId) : undefined
      const cat = task?.categoryId ? categories.get(task.categoryId) : undefined
      const key = cat?.name ?? '未分类'
      byCategory.set(key, (byCategory.get(key) ?? 0) + minutes)
    }
    // 隐私：只返回聚合后的分类/时长，绝不返回原始 window_title
    return {
      totalMinutes: total,
      byCategory: [...byCategory.entries()].map(([categoryName, minutes]) => ({ categoryName, minutes }))
    }
  }
}

const createScheduleTool: AgentTool = {
  name: 'create_schedule',
  description: '创建一个日程。startTime/endTime 用毫秒时间戳。',
  write: true,
  schema: z.object({
    title: z.string().min(1),
    startTime: z.number(),
    endTime: z.number(),
    description: z.string().nullable().optional()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      startTime: { type: 'number', description: '开始毫秒时间戳' },
      endTime: { type: 'number', description: '结束毫秒时间戳' },
      description: { type: 'string' }
    },
    required: ['title', 'startTime', 'endTime']
  },
  summarize: (args) => {
    const a = args as { title: string; startTime: number }
    return `创建日程「${a.title}」，时间 ${new Date(a.startTime).toLocaleString()}`
  },
  execute: (args) => {
    const a = args as { title: string; startTime: number; endTime: number; description?: string | null }
    const created = createSchedule({
      title: a.title,
      startTime: a.startTime,
      endTime: a.endTime,
      description: a.description ?? null
    })
    // AI 建的日程也要重排提醒队列（与人工走 IPC 的路径一致）
    emitSchedulesChanged()
    return created
  }
}

const createTaskTool: AgentTool = {
  name: 'create_task',
  description: '创建一个任务。',
  write: true,
  schema: z.object({
    title: z.string().min(1),
    description: z.string().nullable().optional(),
    priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      priority: { type: 'number', enum: [1, 2, 3], description: '1=高 2=中 3=低' }
    },
    required: ['title']
  },
  summarize: (args) => `创建任务「${(args as { title: string }).title}」`,
  execute: (args) => {
    const a = args as { title: string; description?: string | null; priority?: 1 | 2 | 3 }
    return createTask({ title: a.title, description: a.description ?? null, priority: a.priority })
  }
}

const updateTaskTool: AgentTool = {
  name: 'update_task',
  description: '更新一个任务的状态、优先级或标题。',
  write: true,
  schema: z.object({
    taskId: z.string().min(1),
    title: z.string().min(1).optional(),
    status: z.enum(['pending', 'in_progress', 'blocked', 'done', 'cancelled']).optional(),
    priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      taskId: { type: 'string' },
      title: { type: 'string' },
      status: { type: 'string', enum: ['pending', 'in_progress', 'blocked', 'done', 'cancelled'] },
      priority: { type: 'number', enum: [1, 2, 3] }
    },
    required: ['taskId']
  },
  summarize: (args) => {
    const a = args as { taskId: string; status?: string }
    return `更新任务${a.status ? `（状态→${a.status}）` : ''}`
  },
  execute: (args) => {
    const a = args as { taskId: string; title?: string; status?: never; priority?: 1 | 2 | 3 }
    return updateTask({ id: a.taskId, title: a.title, status: a.status, priority: a.priority })
  }
}

const proposeSubtasksTool: AgentTool = {
  name: 'propose_subtasks',
  description:
    '把一个任务拆解成有序的步骤/子任务清单。用户确认后写入该任务。task scope 下默认作用于当前任务，无需传 taskId。',
  write: true,
  schema: z.object({
    taskId: z.string().min(1).optional(),
    subtasks: z.array(z.string().min(1)).min(1)
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: '目标任务 id；在任务内对话时可省略' },
      subtasks: {
        type: 'array',
        items: { type: 'string' },
        description: '有序的步骤标题列表'
      }
    },
    required: ['subtasks']
  },
  summarize: (args) => {
    const a = args as { subtasks: string[] }
    const preview = a.subtasks.map((s, i) => `${i + 1}. ${s}`).join('\n')
    return `拆解为 ${a.subtasks.length} 个步骤：\n${preview}`
  },
  execute: (args, ctx) => {
    const a = args as { taskId?: string; subtasks: string[] }
    const taskId = a.taskId ?? ctx.taskId
    if (!taskId) throw new Error('propose_subtasks 需要 taskId（不在任务内对话时必须显式提供）')
    const created = a.subtasks.map((title) => createSubtask({ taskId, title }))
    return { taskId, created: created.length }
  }
}

const generateReportTool: AgentTool = {
  name: 'generate_report',
  description: '生成日报/周报/按需报告（会调用 AI 总结并落库）。period 用毫秒时间戳。',
  write: true,
  schema: z.object({
    type: z.enum(['daily', 'weekly', 'adhoc']),
    periodStart: z.number(),
    periodEnd: z.number()
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['daily', 'weekly', 'adhoc'] },
      periodStart: { type: 'number' },
      periodEnd: { type: 'number' }
    },
    required: ['type', 'periodStart', 'periodEnd']
  },
  summarize: (args) => `生成${{ daily: '日报', weekly: '周报', adhoc: '按需报告' }[(args as { type: 'daily' | 'weekly' | 'adhoc' }).type]}`,
  execute: (args) => {
    const a = args as { type: 'daily' | 'weekly' | 'adhoc'; periodStart: number; periodEnd: number }
    return generateReport({ type: a.type, periodStart: a.periodStart, periodEnd: a.periodEnd })
  }
}

export const ALL_TOOLS: AgentTool[] = [
  listSchedulesTool,
  listTasksTool,
  getTaskTool,
  queryTimeStatsTool,
  createScheduleTool,
  createTaskTool,
  updateTaskTool,
  proposeSubtasksTool,
  generateReportTool
]

/** 任务内嵌场景只暴露拆步骤 + 只读上下文；全局助手暴露全套。 */
export function toolsForScope(scope: 'global' | 'task'): AgentTool[] {
  if (scope === 'task') {
    return [getTaskTool, queryTimeStatsTool, proposeSubtasksTool]
  }
  return ALL_TOOLS
}

export function findTool(name: string): AgentTool | undefined {
  return ALL_TOOLS.find((t) => t.name === name)
}
