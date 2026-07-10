import type { AnalyzeResult } from '@shared/types/ai'

/**
 * AI 返回的 analyze 响应期望是纯 JSON，但模型有时会用 markdown 代码块包裹或加一些前后缀文字。
 * 解析失败时降级为纯文本展示（focusScore/summary/suggestions 为 null），不抛错。
 */
export function parseAnalyzeResponse(rawText: string): AnalyzeResult {
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { focusScore: null, summary: null, suggestions: null, rawText }
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      focusScore?: unknown
      summary?: unknown
      suggestions?: unknown
    }

    const focusScore = typeof parsed.focusScore === 'number' ? parsed.focusScore : null
    const summary = typeof parsed.summary === 'string' ? parsed.summary : null
    const suggestions =
      Array.isArray(parsed.suggestions) && parsed.suggestions.every((s) => typeof s === 'string')
        ? (parsed.suggestions as string[])
        : null

    return { focusScore, summary, suggestions, rawText }
  } catch {
    return { focusScore: null, summary: null, suggestions: null, rawText }
  }
}
