import { describe, expect, it } from 'vitest'
import { createScheduleSchema, createTaskSchema, updateScheduleSchema, upsertCategorySchema } from './schemas'

describe('createScheduleSchema', () => {
  it('accepts a minimal valid schedule', () => {
    const result = createScheduleSchema.parse({
      title: '写周报',
      startTime: 1000,
      endTime: 2000
    })
    expect(result.title).toBe('写周报')
    expect(result.startTime).toBe(1000)
  })

  it('rejects an empty title', () => {
    expect(() => createScheduleSchema.parse({ title: '', startTime: 1000, endTime: 2000 })).toThrow()
  })

  it('rejects a missing startTime', () => {
    expect(() => createScheduleSchema.parse({ title: '写周报', endTime: 2000 })).toThrow()
  })

  it('rejects an out-of-range priority', () => {
    expect(() =>
      createScheduleSchema.parse({ title: '写周报', startTime: 1000, endTime: 2000, priority: 5 })
    ).toThrow()
  })
})

describe('updateScheduleSchema', () => {
  it('requires an id but allows every other field to be omitted', () => {
    const result = updateScheduleSchema.parse({ id: 'abc' })
    expect(result.id).toBe('abc')
  })

  it('rejects an invalid status', () => {
    expect(() => updateScheduleSchema.parse({ id: 'abc', status: 'archived' })).toThrow()
  })
})

describe('createTaskSchema', () => {
  it('accepts a minimal valid task', () => {
    const result = createTaskSchema.parse({ title: '整理需求文档' })
    expect(result.title).toBe('整理需求文档')
  })

  it('rejects an empty title', () => {
    expect(() => createTaskSchema.parse({ title: '' })).toThrow()
  })
})

describe('upsertCategorySchema', () => {
  it('accepts a new category without an id', () => {
    const result = upsertCategorySchema.parse({ name: '工作' })
    expect(result.id).toBeUndefined()
  })

  it('rejects a missing name', () => {
    expect(() => upsertCategorySchema.parse({ id: 'abc' })).toThrow()
  })
})
