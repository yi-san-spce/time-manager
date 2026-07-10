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

// 在渲染进程装一个提醒事件收集器
await page.evaluate(() => {
  window.__reminders = []
  window.api.schedule.onReminderFire((r) => window.__reminders.push(r))
})

// 场景1：创建一个"3秒后开始、提前0分钟提醒"的日程 → 提醒应在约3秒后触发（fireAt = start）
const created = await page.evaluate(async () => {
  const now = Date.now()
  const start = now + 3000
  const schedule = await window.api.schedule.create({
    title: '提醒验证会议',
    startTime: start,
    endTime: start + 30 * 60 * 1000,
    reminderMinutesBefore: 0
  })
  return { id: schedule.id, start }
})
console.log('created schedule:', JSON.stringify(created))

// 等待提醒触发（给足 5 秒余量）
await page.waitForFunction(() => window.__reminders.length > 0, null, { timeout: 6000 }).catch(() => {})

const fired = await page.evaluate(() => window.__reminders)
console.log('fired reminders:', JSON.stringify(fired))

// 场景2：删除日程会重排队列且不崩溃；已删除日程不应再触发新提醒
const afterDelete = await page.evaluate(async (id) => {
  await window.api.schedule.delete(id)
  return { deleted: true }
}, created.id)
console.log('after delete:', JSON.stringify(afterDelete))

// 场景3：过去时间的日程不应触发提醒（computeReminders 过滤 fireAt <= now）
const pastCheck = await page.evaluate(async () => {
  const before = window.__reminders.length
  const past = Date.now() - 60 * 60 * 1000
  const s = await window.api.schedule.create({
    title: '过去的日程',
    startTime: past,
    endTime: past + 30 * 60 * 1000,
    reminderMinutesBefore: 0
  })
  await new Promise((r) => setTimeout(r, 500))
  const after = window.__reminders.length
  await window.api.schedule.delete(s.id)
  return { firedNew: after - before }
})
console.log('past-schedule check:', JSON.stringify(pastCheck))

await app.close()

const runtimeErrors = errors.filter((e) => !e.includes('Autofill') && !e.toLowerCase().includes('devtools'))

if (fired.length === 0) {
  console.error('[FAIL] no reminder fired for a schedule due ~3s out')
  process.exit(1)
}
const match = fired.find((r) => r.scheduleId === created.id)
if (!match) {
  console.error('[FAIL] fired reminder scheduleId did not match created schedule:', JSON.stringify(fired))
  process.exit(1)
}
if (match.title !== '提醒验证会议' || match.startTime !== created.start) {
  console.error('[FAIL] reminder payload mismatch:', JSON.stringify(match))
  process.exit(1)
}
if (pastCheck.firedNew !== 0) {
  console.error('[FAIL] a past-dated schedule should never fire a reminder, got:', pastCheck.firedNew)
  process.exit(1)
}
if (runtimeErrors.length > 0) {
  console.error('[FAIL] runtime errors:', JSON.stringify(runtimeErrors))
  process.exit(1)
}

console.log(
  '[PASS] stage-13: schedule reminder fires at fireAt with correct payload; delete re-arms without crash; past-dated schedules never fire'
)
