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

// 1) 番茄钟配置 IPC 往返持久化
const configResult = await page.evaluate(async () => {
  const original = await window.api.pomodoro.getConfig()
  const saved = await window.api.pomodoro.setConfig({
    focusMinutes: 30,
    shortBreakMinutes: 6,
    longBreakMinutes: 20,
    longBreakInterval: 3
  })
  const reread = await window.api.pomodoro.getConfig()
  // 还原默认，避免污染
  await window.api.pomodoro.setConfig(original)
  return { saved, reread }
})
console.log('pomodoro config round-trip:', JSON.stringify(configResult))

// 2) 从任务卡片启动专注 → 侧边栏出现计时环
const uiResult = await page.evaluate(async () => {
  // 建一个临时任务供启动
  const task = await window.api.task.create({ title: '番茄验证任务' })
  return { taskId: task.id }
})

await page.evaluate(() => {
  window.location.hash = '#/tasks'
})
await page.waitForTimeout(500)

// 点任务卡片上的“专注”按钮
const focusBtn = page.locator('button').filter({ hasText: '专注' }).first()
let ringVisible = false
if ((await focusBtn.count()) > 0) {
  await focusBtn.click()
  await page.waitForTimeout(500)
  // 侧边栏计时环里应出现 mm:ss
  const timeText = await page.locator('aside').innerText()
  ringVisible = /\d{2}:\d{2}/.test(timeText)
}
console.log('sidebar shows timer after start:', ringVisible)

// 停止计时并清理任务
await page.evaluate(async (taskId) => {
  await window.api.task.delete(taskId)
}, uiResult.taskId)

await app.close()

const runtimeErrors = errors.filter((e) => !e.includes('Autofill') && !e.toLowerCase().includes('devtools'))
const configOk =
  configResult.saved.focusMinutes === 30 &&
  configResult.reread.focusMinutes === 30 &&
  configResult.reread.longBreakInterval === 3

if (!configOk) {
  console.error('[FAIL] pomodoro config did not persist:', JSON.stringify(configResult))
  process.exit(1)
}
if (!ringVisible) {
  console.error('[FAIL] timer ring did not appear in sidebar after starting focus')
  process.exit(1)
}
if (runtimeErrors.length > 0) {
  console.error('[FAIL] runtime errors:', JSON.stringify(runtimeErrors))
  process.exit(1)
}

console.log('[PASS] stage-11: pomodoro config persists via IPC; starting focus shows the timer ring in sidebar')
