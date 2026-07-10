import { _electron as electron } from 'playwright-core'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_DIR = path.resolve(__dirname, '..')

const app = await electron.launch({
  args: [path.join(APP_DIR, 'out', 'main', 'index.js')],
  timeout: 30000
})

const page = await app.firstWindow()
await page.waitForLoadState('domcontentloaded')
await page.waitForTimeout(1000)

const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

// 场景1：无激活供应商时 sendMessage 抛可读错误，不崩溃
const noProvider = await page.evaluate(async () => {
  try {
    await window.api.agent.sendMessage({ scope: 'global', text: '你好' })
    return { threw: false }
  } catch (error) {
    return { threw: true, message: String(error?.message || error) }
  }
})
console.log('no-provider sendMessage:', JSON.stringify(noProvider))

// 场景2：确认一个写类工具（propose_subtasks）真的落库为子任务。
// 无 live key，无法让模型产生 tool_call，所以这里直接调 IPC 契约验证 execute 路径：
// 用 subtask API 反推 propose_subtasks 工具执行后的效果由 12c 的 confirm 流程覆盖；
// 这里验证工具 execute 复用的 repo 契约：创建任务 -> 通过 agent getMessages 契约不崩溃。
const contract = await page.evaluate(async () => {
  const task = await window.api.task.create({ title: 'AI拆解验证' })
  // task scope 对话历史初始为空且不崩溃
  const initial = await window.api.agent.getMessages({ scope: 'task', taskId: task.id })
  // 清理
  await window.api.task.delete(task.id)
  return { initialLen: initial.length }
})
console.log('agent getMessages contract:', JSON.stringify(contract))

await app.close()

const runtimeErrors = errors.filter((e) => !e.includes('Autofill') && !e.toLowerCase().includes('devtools'))

if (!noProvider.threw || !noProvider.message.includes('未配置激活的 AI 供应商')) {
  console.error('[FAIL] expected readable "no active provider" error, got:', JSON.stringify(noProvider))
  process.exit(1)
}
if (contract.initialLen !== 0) {
  console.error('[FAIL] fresh task conversation should start empty, got:', contract.initialLen)
  process.exit(1)
}
if (runtimeErrors.length > 0) {
  console.error('[FAIL] runtime errors:', JSON.stringify(runtimeErrors))
  process.exit(1)
}

console.log('[PASS] stage-12: agent sendMessage fails gracefully without a provider; conversation contract holds; no crash')
