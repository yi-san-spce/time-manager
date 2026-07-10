/**
 * 日程变更通知总线。日程的增删改有两条写入路径——人工走 IPC handler、AI 走 Agent 工具，
 * 两者都应触发 ReminderScheduler 重排队列。用一个模块级监听器把两条路径汇到一处，
 * 避免在多个调用点各自记住要通知调度器。
 */
type Listener = () => void

let listener: Listener | null = null

/** 由 main 进程在启动时注册（通常指向 reminderScheduler.rebuild）。 */
export function onSchedulesChanged(fn: Listener): void {
  listener = fn
}

/** 任何日程写操作后调用。 */
export function emitSchedulesChanged(): void {
  listener?.()
}
