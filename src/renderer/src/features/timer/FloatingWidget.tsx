import { useEffect, useRef, useState } from 'react'
import { CalendarClock, ListChecks, Play, Pause, Square, SkipForward, X, StickyNote } from 'lucide-react'
import type { PomodoroSnapshot, WidgetContext } from '@shared/types/ipc'
import { GlassSurface, IconButton } from '../../design-system'
import styles from './FloatingWidget.module.css'

const PHASE_LABEL: Record<PomodoroSnapshot['phase'], string> = {
  focus: '专注',
  shortBreak: '短休息',
  longBreak: '长休息'
}
const PHASE_COLOR: Record<PomodoroSnapshot['phase'], string> = {
  focus: 'var(--stage-track)',
  shortBreak: 'var(--color-info)',
  longBreak: 'var(--stage-review)'
}

function fmt(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function fmtRange(start: number, end: number): string {
  const t = (ms: number): string =>
    new Date(ms).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  return `${t(start)} – ${t(end)}`
}

/**
 * 悬浮信息小窗（需求6）：四张纵向堆叠的迷你玻璃卡——当前日程 / 关联任务 / 番茄 / 随心记。
 * 番茄卡镜像主窗口经主进程中继来的快照，控制命令回传主窗口执行（本窗口不自计时）。
 */
export function FloatingWidget(): React.JSX.Element {
  const [context, setContext] = useState<WidgetContext>({ schedule: null, tasks: [] })
  const [snapshot, setSnapshot] = useState<PomodoroSnapshot | null>(null)

  // 每 15s 刷新一次上下文（当前日程会随时间推移变化）
  useEffect(() => {
    let active = true
    const load = (): void => {
      void window.api.floatingWidget.getContext().then((c) => {
        if (active) setContext(c)
      })
    }
    load()
    const id = setInterval(load, 15000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  // 订阅番茄钟快照
  useEffect(() => window.api.pomodoroSync.onStateChanged((s) => setSnapshot(s)), [])

  return (
    <div className={styles.root}>
      <header className={styles.bar}>
        <div className={styles.barTitle}>时间管理 · 悬浮</div>
        <IconButton
          size="sm"
          aria-label="关闭"
          className={styles.noDrag}
          onClick={() => void window.api.floatingWidget.close()}
        >
          <X size={15} />
        </IconButton>
      </header>

      <div className={styles.cards}>
        <ScheduleCard context={context} />
        <TasksCard context={context} />
        <PomodoroCard snapshot={snapshot} />
        <QuickNoteCard />
      </div>
    </div>
  )
}

function ScheduleCard({ context }: { context: WidgetContext }): React.JSX.Element {
  return (
    <GlassSurface radius="md" className={styles.card}>
      <div className={styles.cardHead}>
        <CalendarClock size={14} />
        <span>当前日程</span>
      </div>
      {context.schedule ? (
        <div>
          <div className={styles.scheduleTitle}>{context.schedule.title}</div>
          <div className={styles.scheduleTime}>
            {fmtRange(context.schedule.startTime, context.schedule.endTime)}
          </div>
        </div>
      ) : (
        <div className={styles.muted}>此刻没有进行中的日程</div>
      )}
    </GlassSurface>
  )
}

function TasksCard({ context }: { context: WidgetContext }): React.JSX.Element {
  return (
    <GlassSurface radius="md" className={styles.card}>
      <div className={styles.cardHead}>
        <ListChecks size={14} />
        <span>日程任务</span>
      </div>
      {context.tasks.length > 0 ? (
        <ul className={styles.taskList}>
          {context.tasks.map((t) => (
            <li key={t.id} className={styles.taskItem} data-done={t.status === 'done'}>
              {t.title}
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.muted}>{context.schedule ? '该日程暂无关联任务' : '—'}</div>
      )}
    </GlassSurface>
  )
}

const RADIUS = 40
const CIRC = 2 * Math.PI * RADIUS

function PomodoroCard({ snapshot }: { snapshot: PomodoroSnapshot | null }): React.JSX.Element {
  const active = snapshot?.active ?? false
  const phase = snapshot?.phase ?? 'focus'
  const progress = snapshot && snapshot.totalMs > 0 ? 1 - snapshot.remainingMs / snapshot.totalMs : 0

  return (
    <GlassSurface radius="md" className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.tomato}>🍅</span>
        <span>番茄钟</span>
      </div>
      {active && snapshot ? (
        <div className={styles.pomo}>
          <div className={styles.ring}>
            <svg viewBox="0 0 96 96" className={styles.ringSvg}>
              <circle className={styles.ringTrack} cx="48" cy="48" r={RADIUS} />
              <circle
                className={styles.ringFill}
                cx="48"
                cy="48"
                r={RADIUS}
                style={{
                  stroke: PHASE_COLOR[phase],
                  strokeDasharray: CIRC,
                  strokeDashoffset: CIRC * (1 - progress)
                }}
              />
            </svg>
            <div className={styles.ringCenter}>
              <span className={styles.ringTime}>{fmt(snapshot.remainingMs)}</span>
              <span className={styles.ringPhase}>{PHASE_LABEL[phase]}</span>
            </div>
          </div>
          {snapshot.linkLabel && snapshot.linkLabel !== '专注' && (
            <div className={styles.pomoLink}>{snapshot.linkLabel}</div>
          )}
          <div className={styles.pomoControls}>
            {snapshot.running ? (
              <IconButton size="sm" aria-label="暂停" onClick={() => window.api.pomodoroSync.sendCommand('pause')}>
                <Pause size={16} />
              </IconButton>
            ) : (
              <IconButton size="sm" aria-label="继续" onClick={() => window.api.pomodoroSync.sendCommand('resume')}>
                <Play size={16} />
              </IconButton>
            )}
            <IconButton size="sm" aria-label="跳过" onClick={() => window.api.pomodoroSync.sendCommand('skip')}>
              <SkipForward size={16} />
            </IconButton>
            <IconButton size="sm" danger aria-label="停止" onClick={() => window.api.pomodoroSync.sendCommand('stop')}>
              <Square size={16} />
            </IconButton>
          </div>
        </div>
      ) : (
        <div className={styles.muted}>未在专注。从主窗口的任务/日程开始专注。</div>
      )}
    </GlassSurface>
  )
}

function QuickNoteCard(): React.JSX.Element {
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    void window.api.floatingWidget.getQuickNote().then(setText)
  }, [])

  function onChange(next: string): void {
    setText(next)
    setSaved(false)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    // 去抖保存，落 app_settings（重启仍在）
    saveTimer.current = setTimeout(() => {
      void window.api.floatingWidget.setQuickNote(next).then(() => setSaved(true))
    }, 500)
  }

  return (
    <GlassSurface radius="md" className={`${styles.card} ${styles.noteCard}`}>
      <div className={styles.cardHead}>
        <StickyNote size={14} />
        <span>随心记</span>
        <span className={styles.saveHint}>{saved ? '已保存' : '…'}</span>
      </div>
      <textarea
        className={styles.noteArea}
        value={text}
        placeholder="随手记点什么…（自动保存）"
        onChange={(e) => onChange(e.target.value)}
      />
    </GlassSurface>
  )
}
