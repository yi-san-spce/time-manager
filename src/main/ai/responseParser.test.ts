import { describe, expect, it } from 'vitest'
import { parseAnalyzeResponse } from './responseParser'

describe('parseAnalyzeResponse', () => {
  it('parses a clean JSON response', () => {
    const raw = '{"focusScore": 82, "summary": "整体专注度不错", "suggestions": ["减少切换频率"]}'
    const result = parseAnalyzeResponse(raw)
    expect(result.focusScore).toBe(82)
    expect(result.summary).toBe('整体专注度不错')
    expect(result.suggestions).toEqual(['减少切换频率'])
    expect(result.rawText).toBe(raw)
  })

  it('extracts JSON wrapped in a markdown code block', () => {
    const raw = '```json\n{"focusScore": 70, "summary": "还行", "suggestions": []}\n```'
    const result = parseAnalyzeResponse(raw)
    expect(result.focusScore).toBe(70)
    expect(result.summary).toBe('还行')
    expect(result.suggestions).toEqual([])
  })

  it('extracts JSON with leading/trailing prose text', () => {
    const raw = '好的，这是分析结果：\n{"focusScore": 55, "summary": "一般", "suggestions": ["休息一下"]}\n希望有帮助！'
    const result = parseAnalyzeResponse(raw)
    expect(result.focusScore).toBe(55)
    expect(result.suggestions).toEqual(['休息一下'])
  })

  it('falls back to null fields when there is no JSON at all', () => {
    const raw = '抱歉，我无法完成这个分析。'
    const result = parseAnalyzeResponse(raw)
    expect(result.focusScore).toBeNull()
    expect(result.summary).toBeNull()
    expect(result.suggestions).toBeNull()
    expect(result.rawText).toBe(raw)
  })

  it('falls back to null fields when the JSON is malformed', () => {
    const raw = '{"focusScore": 80, "summary": "缺少右括号"'
    const result = parseAnalyzeResponse(raw)
    expect(result.focusScore).toBeNull()
    expect(result.summary).toBeNull()
    expect(result.suggestions).toBeNull()
  })

  it('falls back to null fields when types do not match the expected shape', () => {
    const raw = '{"focusScore": "high", "summary": 123, "suggestions": "not an array"}'
    const result = parseAnalyzeResponse(raw)
    expect(result.focusScore).toBeNull()
    expect(result.summary).toBeNull()
    expect(result.suggestions).toBeNull()
  })

  it('rejects a suggestions array containing non-string entries', () => {
    const raw = '{"focusScore": 60, "summary": "ok", "suggestions": ["fine", 42]}'
    const result = parseAnalyzeResponse(raw)
    expect(result.suggestions).toBeNull()
  })
})
