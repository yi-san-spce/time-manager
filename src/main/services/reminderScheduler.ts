import { Notification, type BrowserWindow } from 'electron'
import type { Schedule } from '@shared/types/models'
import { IPC } from '@shared/types/ipc'
import { listSchedules } from '../db/repositories/scheduleRepo'
import { expandAllRecurringSchedules } from '../ipc/recurrenceHandlers'
import { computeReminders, nextReminder, type PlannedReminder } from './reminderPlanner'

/**
 * 向前展开重复日程用于提醒的窗口长度（毫秒）。60 天足够覆盖近期提醒；
 * 更远的实例在下一次 rebuild（应用重启 / 日程增删改）时会重新纳入。
 */
const LOOKAHEAD_MS = 60 * 24 * 60 * 60 * 1000

/**
 * setTimeout 的延迟用 32 位有符号整数存储，超过 2^31-1 毫秒（约 24.8 天）会溢出并立即触发。
 * 因此单个定时器最长只排这么久；若下一条提醒比这更远，到点后重排即可。
 */
const MAX_TIMER_MS = 2 ** 31 - 1

type GetWindow = () => BrowserWindow | null

/**
 * 提醒调度器：任何时刻只挂一个 setTimeout（指向"下一条最近的提醒"），触发后继续排下一条。
 * 队列是内存态，启动时和日程增删改时都从数据库重算 —— 天然支持重启恢复。
 * 应用未运行期间错过的提醒不会补发（第一版预期行为）。
 */
export class ReminderScheduler {
  private timer: NodeJS.Timeout | null = null
  private readonly getWindow: GetWindow
  private readonly now: () => number
  private readonly loadReminders: () => PlannedReminder[]

  constructor(getWindow: GetWindow, deps?: { now?: () => number; loadReminders?: () => PlannedReminder[] }) {
    this.getWindow = getWindow
    this.now = deps?.now ?? Date.now
    this.loadReminders = deps?.loadReminders ?? (() => this.computeFromDb())
  }

  /** 从数据库读取全部日程，展开重复实例，算出未来待触发的提醒。 */
  private computeFromDb(): PlannedReminder[] {
    const now = this.now()
    const all = listSchedules()
    const nonRecurring = all.filter((s: Schedule) => s.recurrenceRuleId == null)
    const occurrences = expandAllRecurringSchedules(now, now + LOOKAHEAD_MS)
    return computeReminders(nonRecurring, occurrences, now)
  }

  /** 应用启动时调用一次。 */
  start(): void {
    this.rebuild()
  }

  /** 日程增删改后调用：清掉当前定时器并按最新数据重排下一条。 */
  rebuild(): void {
    this.clearTimer()
    const reminders = this.loadReminders()
    const next = nextReminder(reminders)
    if (!next) return
    this.arm(next)
  }

  stop(): void {
    this.clearTimer()
  }

  private arm(reminder: PlannedReminder): void {
    const delay = reminder.fireAt - this.now()

    if (delay <= 0) {
      // 理论上 computeReminders 已过滤掉过去的提醒；兜底立即触发。
      this.fire(reminder)
      return
    }

    if (delay > MAX_TIMER_MS) {
      // 太远：先排一个上限定时器，到点后重算（届时它会更近或已可触发）。
      this.timer = setTimeout(() => this.rebuild(), MAX_TIMER_MS)
      return
    }

    this.timer = setTimeout(() => this.fire(reminder), delay)
  }

  private fire(reminder: PlannedReminder): void {
    this.timer = null
    this.notify(reminder)
    // 触发后继续排下一条（把刚触发的这条排除在外 —— 它的 fireAt 已成过去，computeReminders 会自动过滤）。
    this.rebuild()
  }

  private notify(reminder: PlannedReminder): void {
    const window = this.getWindow()
    // 推送应用内事件（渲染进程可据此提示 / 刷新），即使系统通知不可用也会发出
    window?.webContents.send(IPC.eventReminderFire, {
      scheduleId: reminder.scheduleId,
      title: reminder.title,
      startTime: reminder.startTime
    })

    if (!Notification.isSupported()) return
    const minutesToStart = Math.max(0, Math.round((reminder.startTime - this.now()) / 60_000))
    const body = minutesToStart > 0 ? `将于约 ${minutesToStart} 分钟后开始` : '即将开始'
    const notification = new Notification({ title: `日程提醒：${reminder.title}`, body })
    notification.on('click', () => {
      const win = this.getWindow()
      if (!win) return
      if (win.isMinimized()) win.restore()
      win.focus()
    })
    notification.show()
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}
