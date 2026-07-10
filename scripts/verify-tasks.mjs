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

// 通过 IPC 直接验证阶段10 的数据层契约（不依赖点选坐标，稳定）
const result = await page.evaluate(async () => {
  // 1) 建任务，带新字段
  const task = await window.api.task.create({
    title: '验证任务-步骤',
    description: '# 目标\n- 第一点\n- 第二点',
    priority: 1,
    estimateMinutes: 45
  })

  // 2) 加两个子任务，勾选一个
  const s1 = await window.api.subtask.create({ taskId: task.id, title: '步骤A' })
  const s2 = await window.api.subtask.create({ taskId: task.id, title: '步骤B' })
  await window.api.subtask.update({ id: s1.id, done: true })

  // 3) 建标签并关联
  const tag = await window.api.tag.create({ name: '验证标签' })
  await window.api.task.setTags({ taskId: task.id, tagIds: [tag.id] })

  // 4) 重排：把 B 放到 A 前
  const reordered = await window.api.subtask.reorder({ taskId: task.id, orderedIds: [s2.id, s1.id] })

  // 5) 读详情 + 列表计数
  const detail = await window.api.task.get(task.id)
  const list = await window.api.task.list()
  const listItem = list.find((t) => t.id === task.id)

  // 清理
  await window.api.task.delete(task.id)
  await window.api.tag.delete(tag.id)

  return {
    descPersisted: detail?.description?.includes('第一点') ?? false,
    estimate: detail?.estimateMinutes,
    priority: detail?.priority,
    subtaskCount: detail?.subtasks.length,
    firstAfterReorder: reordered[0]?.title,
    tagName: detail?.tags[0]?.name,
    listDone: listItem?.subtaskDone,
    listTotal: listItem?.subtaskTotal
  }
})

console.log('stage-10 data-layer result:', JSON.stringify(result))

await app.close()

const runtimeErrors = errors.filter((e) => !e.includes('Autofill') && !e.toLowerCase().includes('devtools'))
const checks = {
  descPersisted: result.descPersisted === true,
  estimate: result.estimate === 45,
  priority: result.priority === 1,
  subtaskCount: result.subtaskCount === 2,
  reorder: result.firstAfterReorder === '步骤B',
  tag: result.tagName === '验证标签',
  listCounts: result.listDone === 1 && result.listTotal === 2
}

const failed = Object.entries(checks).filter(([, ok]) => !ok)
if (failed.length > 0) {
  console.error('[FAIL] stage-10 checks failed:', failed.map(([k]) => k).join(', '), JSON.stringify(result))
  process.exit(1)
}
if (runtimeErrors.length > 0) {
  console.error('[FAIL] runtime errors:', JSON.stringify(runtimeErrors))
  process.exit(1)
}

console.log('[PASS] stage-10: task description/estimate/priority persist, subtasks CRUD+reorder work, tags link, list progress counts correct')
