import { _electron as electron } from 'playwright-core'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_DIR = path.resolve(__dirname, '..')

const API_KEY = process.env.TM_API_KEY
const BASE_URL = process.env.TM_BASE_URL
const MODEL = process.env.TM_MODEL || 'claude-sonnet-5'

if (!API_KEY || !BASE_URL) {
  console.error('need TM_API_KEY and TM_BASE_URL env vars')
  process.exit(2)
}

const app = await electron.launch({
  args: [path.join(APP_DIR, 'out', 'main', 'index.js')],
  timeout: 30000
})
const page = await app.firstWindow()
await page.waitForLoadState('domcontentloaded')
await page.waitForTimeout(1000)

// 1) 保存 + 激活自定义端点配置
const setup = await page.evaluate(
  async ({ apiKey, baseUrl, model }) => {
    const cfg = await window.api.ai.saveConfig({ provider: 'claude', model, apiKey, baseUrl })
    await window.api.ai.activateConfig(cfg.id)
    const test = await window.api.ai.testConnection(cfg.id)
    return { id: cfg.id, baseUrl: cfg.baseUrl, test }
  },
  { apiKey: API_KEY, baseUrl: BASE_URL, model: MODEL }
)
console.log('setup + testConnection:', JSON.stringify(setup))

// 2) 全局助手：发一条只读请求（列任务），确认能拿到文本回复
const globalChat = await page.evaluate(async () => {
  const reply = await window.api.agent.sendMessage({ scope: 'global', text: '现在有几个任务？简短回答。' })
  return {
    awaiting: reply.awaitingConfirmation,
    lastRole: reply.messages[reply.messages.length - 1]?.role,
    lastText: reply.messages[reply.messages.length - 1]?.content?.slice(0, 120)
  }
})
console.log('global read-only chat:', JSON.stringify(globalChat))

// 3) 任务内嵌：让 AI 拆解步骤 → 应进入待确认；确认后子任务落库
const taskFlow = await page.evaluate(async () => {
  const task = await window.api.task.create({ title: '筹备产品发布会' })
  const reply = await window.api.agent.sendMessage({
    scope: 'task',
    taskId: task.id,
    text: '把这个任务拆解成 4 个左右的执行步骤。'
  })
  // 找到待确认的 propose_subtasks 消息
  const pending = reply.messages.find(
    (m) => m.status === 'pending' && m.toolCalls?.some((c) => c.name === 'propose_subtasks')
  )
  let detailAfter = null
  if (pending) {
    await window.api.agent.confirmToolCall({
      scope: 'task',
      taskId: task.id,
      messageId: pending.id,
      approved: true
    })
    detailAfter = await window.api.task.get(task.id)
  }
  const subtaskCount = detailAfter?.subtasks.length ?? 0
  await window.api.task.delete(task.id)
  return {
    awaited: reply.awaitingConfirmation,
    hadProposeCard: Boolean(pending),
    proposedSubtasks: pending?.toolCalls?.find((c) => c.name === 'propose_subtasks')?.arguments,
    subtaskCountAfterConfirm: subtaskCount
  }
})
console.log('task decompose flow:', JSON.stringify(taskFlow))

// 清理配置
await page.evaluate(async (id) => {
  await window.api.ai.deleteConfig(id)
}, setup.id)

await app.close()

if (!setup.test.ok) {
  console.error('[FAIL] testConnection failed:', JSON.stringify(setup.test))
  process.exit(1)
}
if (globalChat.lastRole !== 'assistant' || !globalChat.lastText) {
  console.error('[FAIL] global chat did not return an assistant text reply')
  process.exit(1)
}
if (!taskFlow.hadProposeCard || taskFlow.subtaskCountAfterConfirm < 1) {
  console.error('[FAIL] task decompose did not produce a confirm card + subtasks:', JSON.stringify(taskFlow))
  process.exit(1)
}

console.log('[PASS] LIVE: custom baseURL works; testConnection ok; global chat replies; task AI decompose → confirm → subtasks persisted')
