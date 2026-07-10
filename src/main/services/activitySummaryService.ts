import type { ChatInput } from '@shared/types/ai'
import { listTimeEntries } from '../db/repositories/timeEntryRepo'
import { getActiveAIProviderConfig } from '../db/repositories/aiConfigRepo'
import { getActivityNote, setActivityAISummary } from '../db/repositories/activityNoteRepo'
import { decryptApiKey } from './aiSettingsService'
import { createAIProvider } from '../ai/providerFactory'

/**
 * 对某个应用在某时间段内的活动做 AI 总结（需求4）。
 * 输入给模型的是该应用下访问过的网站/窗口标题 + 各自时长 + 用户已写的笔记，
 * 让它归纳"这段时间在这个应用里主要做了什么、时间花在哪"。落库到 activity_note.ai_summary。
 * 复用已激活的 AIProvider（走 chat()，非流式；流式在阶段17统一改造）。
 */
export async function summarizeAppActivity(input: {
  appName: string
  rangeStart: number
  rangeEnd: number
}): Promise<string> {
  const config = getActiveAIProviderConfig()
  if (!config) {
    throw new Error('未配置激活的 AI 供应商，请先在设置页配置并激活一个供应商')
  }

  const entries = listTimeEntries(input.rangeStart, input.rangeEnd).filter(
    (e) => e.appName === input.appName
  )
  if (entries.length === 0) {
    throw new Error('该应用在此时间段内没有追踪记录')
  }

  // 按 域名/窗口标题 聚合时长，给模型一个紧凑的"去向清单"
  const byTarget = new Map<string, number>()
  for (const e of entries) {
    const key = e.domain ?? e.windowTitle ?? '（未知页面）'
    const minutes = Math.round((e.endTime - e.startTime) / 60000)
    byTarget.set(key, (byTarget.get(key) ?? 0) + minutes)
  }
  const lines = [...byTarget.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([target, minutes]) => `- ${target}：约 ${minutes} 分钟`)
    .join('\n')

  const totalMinutes = entries.reduce((sum, e) => sum + Math.round((e.endTime - e.startTime) / 60000), 0)
  const userNote = getActivityNote(input.appName)?.note

  const prompt =
    `你是时间管理助手。下面是用户在应用「${input.appName}」上的活动记录（此时间段共约 ${totalMinutes} 分钟）。\n` +
    `访问的页面/窗口及时长：\n${lines}\n\n` +
    (userNote ? `用户自己的笔记：${userNote}\n\n` : '') +
    `请用简洁的中文 Markdown 总结这段时间在该应用里主要做了什么、时间花在了哪些方面。` +
    `只根据上面的记录归纳，不要臆测未出现的内容；如果用户写了笔记，结合它。控制在 3-5 句话。`

  const chatInput: ChatInput = {
    messages: [{ role: 'user', content: prompt }],
    tools: []
  }

  const apiKey = decryptApiKey(config.id)
  const provider = createAIProvider(config.provider, apiKey, config.model, config.baseUrl)
  const result = await provider.chat(chatInput)
  const summary = result.type === 'text' ? result.content : '（AI 未返回文本总结）'

  setActivityAISummary(input.appName, summary)
  return summary
}
