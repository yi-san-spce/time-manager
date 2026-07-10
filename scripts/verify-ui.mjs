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
await page.waitForTimeout(1200)

const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

// 1) 侧边栏与 7 个导航项都渲染出来
const navCount = await page.locator('aside a').count()
console.log('nav items:', navCount)

// 2) 逐页导航，确认每页标题渲染、无运行时错误
const routes = [
  { hash: '#/', expect: '日程' },
  { hash: '#/tracking', expect: '今日追踪' },
  { hash: '#/tasks', expect: '任务' },
  { hash: '#/stats', expect: '统计' },
  { hash: '#/reports', expect: '报告' },
  { hash: '#/assistant', expect: 'AI 助手' },
  { hash: '#/settings', expect: '设置' }
]

const pageResults = []
for (const route of routes) {
  await page.evaluate((h) => {
    window.location.hash = h
  }, route.hash)
  await page.waitForTimeout(350)
  const heading = await page.locator('h2').first().innerText()
  pageResults.push({ hash: route.hash, heading, ok: heading.includes(route.expect) })
}
console.log('page headings:', JSON.stringify(pageResults))

// 3) 三种主题切换：确认 data-theme 生效
await page.evaluate(() => {
  window.location.hash = '#/settings'
})
await page.waitForTimeout(400)

// 主题段控是设置页第一个 segmented（三个 button：浅色/深色/跟随系统）
const themeButtons = page.locator('section button').filter({ hasText: /浅色|深色|跟随系统/ })
const themeBtnCount = await themeButtons.count()
const themeResults = {}
for (let i = 0; i < Math.min(themeBtnCount, 3); i++) {
  const btn = themeButtons.nth(i)
  const label = (await btn.innerText()).trim()
  await btn.click()
  await page.waitForTimeout(200)
  themeResults[label] = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
}
console.log('theme after each toggle:', JSON.stringify(themeResults))
const themeApplied = themeResults['浅色'] === 'light' && themeResults['深色'] === 'dark'

// 4) 侧边栏折叠按钮工作
await page.evaluate(() => {
  window.location.hash = '#/'
})
await page.waitForTimeout(200)
const sidebarWidthBefore = await page.locator('aside').evaluate((el) => el.getBoundingClientRect().width)
await page.locator('aside button').last().click()
await page.waitForTimeout(400)
const sidebarWidthAfter = await page.locator('aside').evaluate((el) => el.getBoundingClientRect().width)
console.log('sidebar width before/after collapse:', sidebarWidthBefore, sidebarWidthAfter)

// 5) 深色模式下自定义下拉：打开设置页供应商下拉，确认选项文字可见（有实际前景色、非透明）
await page.evaluate(() => {
  window.location.hash = '#/settings'
})
await page.waitForTimeout(400)
// 确保处于深色模式（点击「深色」段控）
const darkBtn = page.locator('section button').filter({ hasText: '深色' }).first()
await darkBtn.click()
await page.waitForTimeout(200)
// 触发器是 SelectMenu 的 button（显示 "Claude (Anthropic)"）
const trigger = page.locator('button').filter({ hasText: 'Claude (Anthropic)' }).first()
let dropdownOk = false
let optionColor = 'n/a'
let portaled = false
let menuOpaque = false
if ((await trigger.count()) > 0) {
  await trigger.click()
  await page.waitForTimeout(250)
  const option = page.locator('button').filter({ hasText: 'OpenAI' }).first()
  if ((await option.count()) > 0) {
    const info = await option.evaluate((el) => {
      const s = getComputedStyle(el)
      // 向上找到 portal 菜单容器（body 的直接子节点）
      let node = el
      while (node.parentElement && node.parentElement !== document.body) {
        node = node.parentElement
      }
      // 玻璃面板本身带 popover 类
      const panel = node.querySelector('[class*="popover"]') ?? node
      const panelBg = getComputedStyle(panel).backgroundColor
      return {
        color: s.color,
        visible: el.offsetParent !== null,
        wrapIsBodyChild: node.parentElement === document.body,
        panelBg
      }
    })
    optionColor = info.color
    portaled = info.wrapIsBodyChild
    const panelAlpha = info.panelBg.match(/rgba?\([^)]*?,\s*([\d.]+)\)/)
    menuOpaque = !panelAlpha || parseFloat(panelAlpha[1]) >= 0.9
    const alpha = info.color.match(/rgba?\([^)]*?,\s*([\d.]+)\)/)
    const notTransparent = !alpha || parseFloat(alpha[1]) > 0.3
    dropdownOk = info.visible && notTransparent && info.color !== 'rgba(0, 0, 0, 0)'
    await option.click()
    await page.waitForTimeout(150)
  }
}
console.log('dark-mode dropdown option color:', optionColor, '=> textVisible:', dropdownOk, '| portaled:', portaled, '| opaqueMenu:', menuOpaque)

await app.close()

const allPagesOk = pageResults.every((r) => r.ok)
const collapseWorks = sidebarWidthAfter < sidebarWidthBefore
const runtimeErrors = errors.filter((e) => !e.includes('Autofill') && !e.toLowerCase().includes('devtools'))

if (navCount !== 7) {
  console.error(`[FAIL] expected 7 nav items, got ${navCount}`)
  process.exit(1)
}
if (!allPagesOk) {
  console.error('[FAIL] some pages did not render expected heading:', JSON.stringify(pageResults))
  process.exit(1)
}
if (!collapseWorks) {
  console.error('[FAIL] sidebar collapse did not reduce width')
  process.exit(1)
}
if (!themeApplied) {
  console.error('[FAIL] theme toggle did not apply expected data-theme:', JSON.stringify(themeResults))
  process.exit(1)
}
if (!dropdownOk) {
  console.error('[FAIL] dark-mode custom dropdown option text not clearly visible:', optionColor)
  process.exit(1)
}
if (!portaled) {
  console.error('[FAIL] dropdown menu is not portaled to body — will be clipped/obscured by sibling cards')
  process.exit(1)
}
if (!menuOpaque) {
  console.error('[FAIL] dropdown menu background too transparent — underlying text bleeds through')
  process.exit(1)
}
if (runtimeErrors.length > 0) {
  console.error('[FAIL] runtime errors detected:', JSON.stringify(runtimeErrors))
  process.exit(1)
}

console.log('[PASS] shell renders, all 7 pages navigate, theme toggles apply, sidebar collapses, no runtime errors')
