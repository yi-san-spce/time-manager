import { describe, expect, it } from 'vitest'
import { computeReorder } from './subtaskRepo'

describe('computeReorder', () => {
  it('assigns sequential sort orders following the requested order', () => {
    const result = computeReorder(['a', 'b', 'c'], ['c', 'a', 'b'])
    expect(result).toEqual([
      { id: 'c', sortOrder: 0 },
      { id: 'a', sortOrder: 1 },
      { id: 'b', sortOrder: 2 }
    ])
  })

  it('ignores unknown ids not belonging to the task', () => {
    const result = computeReorder(['a', 'b'], ['x', 'b', 'a'])
    expect(result).toEqual([
      { id: 'b', sortOrder: 0 },
      { id: 'a', sortOrder: 1 }
    ])
  })

  it('appends existing ids missing from the requested order to the end', () => {
    const result = computeReorder(['a', 'b', 'c'], ['c'])
    expect(result).toEqual([
      { id: 'c', sortOrder: 0 },
      { id: 'a', sortOrder: 1 },
      { id: 'b', sortOrder: 2 }
    ])
  })

  it('dedupes repeated ids in the requested order', () => {
    const result = computeReorder(['a', 'b'], ['a', 'a', 'b'])
    expect(result).toEqual([
      { id: 'a', sortOrder: 0 },
      { id: 'b', sortOrder: 1 }
    ])
  })

  it('returns empty for no subtasks', () => {
    expect(computeReorder([], [])).toEqual([])
  })
})
