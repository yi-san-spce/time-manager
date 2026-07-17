import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { PomodoroConfig, PomodoroDispatchCommand } from '@shared/types/ipc'
import {
  focusNote,
  nextPhaseAfterFocus,
  phaseDurationMs,
  shouldLogFocus,
  type PomodoroPhase
} from './pomodoroLogic'

export type { PomodoroPhase }

const DEFAULT_CONFIG: PomodoroConfig = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4
}

export interface PomodoroLink {
  taskId?: string | null
  scheduleId?: string | null
  label: string // 显示用：任务标题 / 日程标题 / “专注”
}

interface PomodoroContextValue {
  config: PomodoroConfig
  setConfig: (config: PomodoroConfig) => void
  phase: PomodoroPhase
  running: boolean
  /** 当前阶段剩余毫秒 */
  remainingMs: number
  /** 当前阶段总时长毫秒 */
  totalMs: number
  /** 已完成的专注段数（用于决定长休） */
  completedFocus: number
  link: PomodoroLink | null
  /** 从某任务/日程启动专注 */
  start: (link: PomodoroLink) => void
  pause: () => void
  resume: () => void
  /** 停止并结算（专注段达阈值则落库） */
  stop: () => void
  /** 跳过当前阶段进入下一阶段 */
  skip: () => void
}

const PomodoroContext = createContext<PomodoroContextValue | null>(null)

export function PomodoroProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const queryClient = useQueryClient()
  const [config, setConfigState] = useState<PomodoroConfig>(DEFAULT_CONFIG)
  const [phase, setPhase] = useState<PomodoroPhase>('focus')
  const [running, setRunning] = useState(false)
  const [remainingMs, setRemainingMs] = useState(DEFAULT_CONFIG.focusMinutes * 60 * 1000)
  const [totalMs, setTotalMs] = useState(DEFAULT_CONFIG.focusMinutes * 60 * 1000)
  const [completedFocus, setCompletedFocus] = useState(0)
  const [link, setLink] = useState<PomodoroLink | null>(null)

  // 用 ref 跟踪本段专注实际起止，落库用（不受暂停影响，累计有效专注时长）
  const focusAccumMs = useRef(0)
  const lastTickAt = useRef<number | null>(null)

  useEffect(() => {
    void window.api.pomodoro.getConfig().then((cfg) => {
      setConfigState(cfg)
      setPhase('focus')
      setRemainingMs(cfg.focusMinutes * 60 * 1000)
      setTotalMs(cfg.focusMinutes * 60 * 1000)
    })
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission()
    }
  }, [])

  const logFocus = useCallback(
    (accumMs: number, forLink: PomodoroLink | null) => {
      if (!shouldLogFocus('focus', accumMs)) return
      const end = Date.now()
      const start = end - accumMs
      void window.api.timeEntry
        .createManual({
          taskId: forLink?.taskId ?? null,
          scheduleId: forLink?.scheduleId ?? null,
          startTime: start,
          endTime: end,
          note: focusNote(forLink?.label)
        })
        .then(() => queryClient.invalidateQueries({ queryKey: ['time-entries'] }))
    },
    [queryClient]
  )

  // 计时循环：running 时每 250ms 递减
  useEffect(() => {
    if (!running) {
      lastTickAt.current = null
      return
    }
    lastTickAt.current = Date.now()
    const id = setInterval(() => {
      const now = Date.now()
      const delta = lastTickAt.current ? now - lastTickAt.current : 0
      lastTickAt.current = now
      if (phase === 'focus') focusAccumMs.current += delta
      setRemainingMs((prev) => Math.max(0, prev - delta))
    }, 250)
    return () => clearInterval(id)
  }, [running, phase])

  // 阶段到点：结算并切换
  useEffect(() => {
    if (remainingMs > 0 || !running) return
    // 到点
    if (phase === 'focus') {
      logFocus(focusAccumMs.current, link)
      focusAccumMs.current = 0
      const nextCompleted = completedFocus + 1
      setCompletedFocus(nextCompleted)
      const nextPhase = nextPhaseAfterFocus(nextCompleted, config)
      const dur = phaseDurationMs(nextPhase, config)
      setPhase(nextPhase)
      setTotalMs(dur)
      setRemainingMs(dur)
      setRunning(false)
      notify(nextPhase === 'longBreak' ? '进入长休息' : '进入短休息', '专注完成，休息一下 🍵')
    } else {
      const dur = phaseDurationMs('focus', config)
      setPhase('focus')
      setTotalMs(dur)
      setRemainingMs(dur)
      setRunning(false)
      notify('开始专注', '休息结束，继续加油 🍅')
    }
  }, [remainingMs, running, phase, config, completedFocus, link, logFocus])

  const start = useCallback(
    (nextLink: PomodoroLink) => {
      const isSameTarget =
        link?.taskId === (nextLink.taskId ?? null) && link?.scheduleId === (nextLink.scheduleId ?? null)

      // 点击同一目标只恢复专注，避免小窗重复点击把计时重新归零。
      if (isSameTarget && phase === 'focus') {
        setRunning(true)
        return
      }

      // 从另一任务/日程切换时，先结算已经累积的有效专注，不能直接覆盖它。
      if (phase === 'focus') {
        logFocus(focusAccumMs.current, link)
      }
      focusAccumMs.current = 0
      const dur = phaseDurationMs('focus', config)
      setLink(nextLink)
      setPhase('focus')
      setTotalMs(dur)
      setRemainingMs(dur)
      focusAccumMs.current = 0
      setRunning(true)
    },
    [config, link, logFocus, phase]
  )

  const pause = useCallback(() => setRunning(false), [])
  const resume = useCallback(() => setRunning(true), [])

  const stop = useCallback(() => {
    if (phase === 'focus') {
      logFocus(focusAccumMs.current, link)
    }
    focusAccumMs.current = 0
    const dur = phaseDurationMs('focus', config)
    setRunning(false)
    setPhase('focus')
    setTotalMs(dur)
    setRemainingMs(dur)
    setLink(null)
  }, [phase, link, config, logFocus])

  const skip = useCallback(() => {
    // 跳过当前阶段：专注跳过也结算已累计的有效时长
    if (phase === 'focus') {
      logFocus(focusAccumMs.current, link)
      focusAccumMs.current = 0
      const nextCompleted = completedFocus + 1
      setCompletedFocus(nextCompleted)
      const nextPhase = nextPhaseAfterFocus(nextCompleted, config)
      const dur = phaseDurationMs(nextPhase, config)
      setPhase(nextPhase)
      setTotalMs(dur)
      setRemainingMs(dur)
    } else {
      const dur = phaseDurationMs('focus', config)
      setPhase('focus')
      setTotalMs(dur)
      setRemainingMs(dur)
    }
    setRunning(false)
  }, [phase, link, config, completedFocus, logFocus])

  const setConfig = useCallback(
    (next: PomodoroConfig) => {
      setConfigState(next)
      void window.api.pomodoro.setConfig(next)
      // 空闲时同步当前阶段时长
      if (!running) {
        const dur = phaseDurationMs(phase, next)
        setTotalMs(dur)
        setRemainingMs(dur)
      }
    },
    [running, phase]
  )

  // 需求6：本窗口是计时权威，向主进程发布快照供悬浮小窗镜像
  useEffect(() => {
    window.api.pomodoroSync.publishState({
      phase,
      running,
      remainingMs,
      totalMs,
      linkLabel: link?.label ?? null,
      active: link !== null,
      taskId: link?.taskId ?? null,
      scheduleId: link?.scheduleId ?? null
    })
  }, [phase, running, remainingMs, totalMs, link])

  // 需求6：响应悬浮小窗回传的控制命令
  useEffect(() => {
    return window.api.pomodoroSync.onCommand((command: PomodoroDispatchCommand) => {
      if (command === 'pause') pause()
      else if (command === 'resume') resume()
      else if (command === 'stop') stop()
      else if (command === 'skip') skip()
      else if (command.type === 'start') {
        start({ taskId: command.taskId, scheduleId: command.scheduleId, label: command.linkLabel })
      }
    })
  }, [pause, resume, start, stop, skip])

  const value = useMemo<PomodoroContextValue>(
    () => ({
      config,
      setConfig,
      phase,
      running,
      remainingMs,
      totalMs,
      completedFocus,
      link,
      start,
      pause,
      resume,
      stop,
      skip
    }),
    [config, setConfig, phase, running, remainingMs, totalMs, completedFocus, link, start, pause, resume, stop, skip]
  )

  return <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>
}

function notify(title: string, body: string): void {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(title, { body })
  }
}

export function usePomodoro(): PomodoroContextValue {
  const ctx = useContext(PomodoroContext)
  if (!ctx) throw new Error('usePomodoro must be used within PomodoroProvider')
  return ctx
}
