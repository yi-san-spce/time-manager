import { describe, expect, it } from 'vitest'
import { ALL_TOOLS, findTool, toolsForScope } from './registry'

describe('tool registry', () => {
  it('exposes only subtask-proposal + read-only tools in task scope', () => {
    const names = toolsForScope('task').map((t) => t.name)
    expect(names).toContain('propose_subtasks')
    expect(names).toContain('get_task')
    expect(names).not.toContain('create_schedule')
    expect(names).not.toContain('generate_report')
  })

  it('exposes the full tool set in global scope', () => {
    const names = toolsForScope('global').map((t) => t.name)
    expect(names).toContain('create_schedule')
    expect(names).toContain('generate_report')
    expect(names).toContain('list_tasks')
  })

  it('marks write tools correctly', () => {
    expect(findTool('propose_subtasks')?.write).toBe(true)
    expect(findTool('create_schedule')?.write).toBe(true)
    expect(findTool('list_tasks')?.write).toBe(false)
    expect(findTool('query_time_stats')?.write).toBe(false)
  })

  it('every tool has a matching JSON schema and zod schema', () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.jsonSchema).toBeTypeOf('object')
      expect(tool.schema).toBeDefined()
    }
  })
})

describe('propose_subtasks validation', () => {
  const tool = findTool('propose_subtasks')!

  it('accepts a non-empty subtask array', () => {
    const parsed = tool.schema.parse({ subtasks: ['a', 'b'] })
    expect(parsed).toEqual({ subtasks: ['a', 'b'] })
  })

  it('rejects an empty subtask array', () => {
    expect(() => tool.schema.parse({ subtasks: [] })).toThrow()
  })

  it('rejects missing subtasks', () => {
    expect(() => tool.schema.parse({})).toThrow()
  })

  it('summarizes as a numbered list', () => {
    const summary = tool.summarize({ subtasks: ['写大纲', '查资料'] }, {})
    expect(summary).toContain('1. 写大纲')
    expect(summary).toContain('2. 查资料')
  })
})

describe('create_schedule validation', () => {
  const tool = findTool('create_schedule')!

  it('requires title and timestamps', () => {
    expect(() => tool.schema.parse({ title: '会议' })).toThrow()
    expect(tool.schema.parse({ title: '会议', startTime: 1000, endTime: 2000 })).toMatchObject({
      title: '会议'
    })
  })

  it('summarizes with the title', () => {
    expect(tool.summarize({ title: '周会', startTime: Date.now() }, {})).toContain('周会')
  })
})

describe('update_task validation', () => {
  const tool = findTool('update_task')!

  it('rejects an invalid status', () => {
    expect(() => tool.schema.parse({ taskId: 't1', status: 'nope' })).toThrow()
  })

  it('accepts a valid status', () => {
    expect(tool.schema.parse({ taskId: 't1', status: 'done' })).toMatchObject({ status: 'done' })
  })
})
