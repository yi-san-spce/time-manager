import { describe, expect, it, vi } from 'vitest'
import { up } from './014_widget_task_context'

describe('014 widget task context migration', () => {
  it('adds nullable schedule context and cascades quick-note deletion with its task', () => {
    const exec = vi.fn()

    up({ exec } as never)

    const ddl = exec.mock.calls[0]?.[0] as string
    expect(ddl).toContain('ADD COLUMN schedule_id TEXT REFERENCES schedule(id) ON DELETE SET NULL')
    expect(ddl).toContain('CREATE TABLE task_quick_note')
    expect(ddl).toContain('task_id TEXT PRIMARY KEY REFERENCES task(id) ON DELETE CASCADE')
  })
})
