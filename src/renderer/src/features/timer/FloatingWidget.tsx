import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarClock,
  Check,
  ChevronDown,
  ListChecks,
  Pause,
  Play,
  SkipForward,
  Square,
  StickyNote,
  Timer,
  X
} from 'lucide-react'
import type {
  PomodoroSnapshot,
  WidgetContext,
  WidgetFocusableTask,
  WidgetSchedule
} from '@shared/types/ipc'
import { IconButton } from '../../design-system'
import styles from './FloatingWidget.module.css'

const EMPTY_CONTEXT: WidgetContext = {
  currentSchedule: null,
  todaySchedules: [],
  focusableTasks: []
}

const PHASE_LABEL: Record<PomodoroSnapshot['phase'], string> = {
  focus: '专注中',
  shortBreak: '短休息',
  longBreak: '长休息'
}

function fmt(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function fmtRange(start: number, end: number): string {
  const format = (value: number): string =>
    new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  return `${format(start)} – ${format(end)}`
}

function taskStatusLabel(task: WidgetFocusableTask): string {
  if (task.status === 'in_progress') return '进行中'
  if (task.status === 'blocked') return '受阻'
  return '待办'
}

/**
 * 独立悬浮窗口的即时专注面板。
 *
 * 这里不装载 PomodoroProvider：主窗口始终是计时和落库的唯一权威；小窗只选择可信的
 * 日程/任务并通过受限 IPC 发起请求，再镜像主窗口发出的状态。
 */
export function FloatingWidget(): React.JSX.Element {
  const [context, setContext] = useState<WidgetContext>(EMPTY_CONTEXT)
  const [snapshot, setSnapshot] = useState<PomodoroSnapshot | null>(null)
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [scheduleMenuOpen, setScheduleMenuOpen] = useState(false)
  const [taskMenuOpen, setTaskMenuOpen] = useState(false)

  // BrowserWindow 本身透明；让网页根节点也透明，避免系统窗口角落出现第二层方底。
  useLayoutEffect(() => {
    const htmlBackground = document.documentElement.style.background
    const bodyBackground = document.body.style.background
    const htmlColor = document.documentElement.style.backgroundColor
    const bodyColor = document.body.style.backgroundColor
    document.documentElement.style.background = 'transparent'
    document.documentElement.style.backgroundColor = 'transparent'
    document.body.style.background = 'transparent'
    document.body.style.backgroundColor = 'transparent'
    return () => {
      document.documentElement.style.background = htmlBackground
      document.documentElement.style.backgroundColor = htmlColor
      document.body.style.background = bodyBackground
      document.body.style.backgroundColor = bodyColor
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const load = (): void => {
      void window.api.floatingWidget.getContext().then((next) => {
        if (mounted) setContext(next)
      })
    }
    load()
    const unsubscribe = window.api.floatingWidget.onContextChanged(load)
    // 日程自然跨越边界时仍会更新；任务/日程选择不依赖此轮询。
    const timer = window.setInterval(load, 15_000)
    return () => {
      mounted = false
      window.clearInterval(timer)
      unsubscribe()
    }
  }, [])

  useEffect(() => window.api.pomodoroSync.onStateChanged(setSnapshot), [])

  // 数据刷新后不抢走用户已选内容，只在选择已失效时给出合理默认值。
  useEffect(() => {
    setSelectedScheduleId((current) => {
      if (current && context.todaySchedules.some((schedule) => schedule.id === current)) return current
      // 只有正在进行的日程才作为默认上下文；未来日程必须由用户明确选择，
      // 这样未关联任务可以真正独立开始，不会被悄悄挂到当天第一条日程上。
      return context.currentSchedule?.id ?? null
    })
    setSelectedTaskId((current) =>
      current && context.focusableTasks.some((task) => task.id === current) ? current : null
    )
  }, [context.currentSchedule, context.focusableTasks, context.todaySchedules])

  // 主窗口已在专注时，小窗以对应的目标为起点；之后用户仍可在小窗自由换选。
  useEffect(() => {
    if (!snapshot?.active) return
    if (snapshot.scheduleId) {
      setSelectedScheduleId((current) => current ?? snapshot.scheduleId)
    }
    if (snapshot.taskId) {
      setSelectedTaskId((current) => current ?? snapshot.taskId)
    }
  }, [snapshot?.active, snapshot?.scheduleId, snapshot?.taskId])

  const selectedSchedule = useMemo(
    () => context.todaySchedules.find((schedule) => schedule.id === selectedScheduleId) ?? null,
    [context.todaySchedules, selectedScheduleId]
  )
  const selectedTask = useMemo(
    () => context.focusableTasks.find((task) => task.id === selectedTaskId) ?? null,
    [context.focusableTasks, selectedTaskId]
  )

  function startFocus(): void {
    const scheduleId = selectedSchedule?.id ?? selectedTask?.scheduleId ?? null
    if (!selectedTask && !scheduleId) return
    window.api.pomodoroSync.sendCommand({
      type: 'start',
      taskId: selectedTask?.id ?? null,
      scheduleId
    })
  }

  return (
    <div className={styles.root}>
      <header className={styles.bar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <Timer size={14} />
          </span>
          <span>即时专注</span>
          <span className={styles.liveDot} data-active={Boolean(snapshot?.active)} aria-label={snapshot?.active ? '正在专注' : '空闲'} />
        </div>
        <IconButton
          size="sm"
          aria-label="关闭悬浮窗"
          className={styles.noDrag}
          onClick={() => void window.api.floatingWidget.close()}
        >
          <X size={15} />
        </IconButton>
      </header>

      <main className={styles.content}>
        <FocusPanel snapshot={snapshot} fallbackTask={selectedTask} fallbackSchedule={selectedSchedule} onStart={startFocus} />

        <section className={styles.selectionSection} aria-label="选择日程">
          <div className={styles.sectionLabel}>
            <CalendarClock size={14} />
            <span>日程</span>
            <span className={styles.sectionHint}>今天</span>
          </div>
          <ChoicePicker
            open={scheduleMenuOpen}
            onOpenChange={setScheduleMenuOpen}
            placeholder="选择一个日程（可跳过）"
            value={selectedSchedule?.title ?? null}
            options={context.todaySchedules.map((schedule) => ({
              id: schedule.id,
              title: schedule.title,
              detail: fmtRange(schedule.startTime, schedule.endTime),
              current: schedule.id === context.currentSchedule?.id
            }))}
            selectedId={selectedScheduleId}
            clearLabel="不选择日程"
            clearDetail="仅专注任务"
            onClear={() => setSelectedScheduleId(null)}
            onSelect={(id) => {
              setSelectedScheduleId(id)
              setScheduleMenuOpen(false)
            }}
          />
        </section>

        <section className={styles.selectionSection} aria-label="选择任务">
          <div className={styles.sectionLabel}>
            <ListChecks size={14} />
            <span>任务</span>
            <span className={styles.sectionHint}>可独立开始</span>
          </div>
          <ChoicePicker
            open={taskMenuOpen}
            onOpenChange={setTaskMenuOpen}
            placeholder="选择一个任务"
            value={selectedTask?.title ?? null}
            options={context.focusableTasks.map((task) => ({
              id: task.id,
              title: task.title,
              detail: taskStatusLabel(task),
              current: task.id === snapshot?.taskId
            }))}
            selectedId={selectedTaskId}
            clearLabel="不选择任务"
            clearDetail="仅专注日程"
            onClear={() => setSelectedTaskId(null)}
            onSelect={(id) => {
              setSelectedTaskId(id)
              setTaskMenuOpen(false)
            }}
          />
        </section>

        <TaskQuickNote task={selectedTask} />
      </main>
    </div>
  )
}

function FocusPanel({
  snapshot,
  fallbackTask,
  fallbackSchedule,
  onStart
}: {
  snapshot: PomodoroSnapshot | null
  fallbackTask: WidgetFocusableTask | null
  fallbackSchedule: WidgetSchedule | null
  onStart: () => void
}): React.JSX.Element {
  const active = snapshot?.active ?? false
  const running = snapshot?.running ?? false
  const progress = snapshot && snapshot.totalMs > 0 ? Math.min(1, Math.max(0, 1 - snapshot.remainingMs / snapshot.totalMs)) : 0
  const target = active
    ? (snapshot?.linkLabel ?? '专注')
    : (fallbackTask?.title ?? fallbackSchedule?.title ?? '先选择日程或任务')
  const canStart = Boolean(fallbackTask || fallbackSchedule)

  return (
    <section className={styles.focusPanel} data-active={active}>
      <div className={styles.focusMeta}>
        <span>{active ? PHASE_LABEL[snapshot?.phase ?? 'focus'] : '准备开始'}</span>
        {active && <span className={styles.focusStatus}>{running ? '进行中' : '已暂停'}</span>}
      </div>
      <div className={styles.focusMain}>
        <div className={styles.focusCopy}>
          <div className={styles.focusTarget} title={target}>
            {target}
          </div>
          <div className={styles.focusSubline}>
            {active ? '主窗口与悬浮窗实时同步' : '任务无需预先关联日程'}
          </div>
        </div>
        {active && snapshot ? <div className={styles.focusTime}>{fmt(snapshot.remainingMs)}</div> : null}
      </div>
      {active && snapshot ? (
        <>
          <div className={styles.progressTrack} aria-label={`进度 ${Math.round(progress * 100)}%`}>
            <span className={styles.progressFill} style={{ width: `${progress * 100}%` }} />
          </div>
          <div className={styles.focusControls}>
            {running ? (
              <button type="button" className={styles.controlButton} onClick={() => window.api.pomodoroSync.sendCommand('pause')}>
                <Pause size={14} /> 暂停
              </button>
            ) : (
              <button type="button" className={styles.controlButton} onClick={() => window.api.pomodoroSync.sendCommand('resume')}>
                <Play size={14} /> 继续
              </button>
            )}
            <IconButton size="sm" aria-label="跳过当前阶段" onClick={() => window.api.pomodoroSync.sendCommand('skip')}>
              <SkipForward size={15} />
            </IconButton>
            <IconButton size="sm" danger aria-label="停止专注" onClick={() => window.api.pomodoroSync.sendCommand('stop')}>
              <Square size={14} />
            </IconButton>
          </div>
        </>
      ) : (
        <button type="button" className={styles.startButton} disabled={!canStart} onClick={onStart}>
          <Play size={15} fill="currentColor" />
          开始专注
        </button>
      )}
    </section>
  )
}

interface ChoiceOption {
  id: string
  title: string
  detail: string
  current: boolean
}

function ChoicePicker({
  open,
  onOpenChange,
  placeholder,
  value,
  options,
  selectedId,
  clearLabel,
  clearDetail,
  onClear,
  onSelect
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  placeholder: string
  value: string | null
  options: ChoiceOption[]
  selectedId: string | null
  clearLabel: string
  clearDetail: string
  onClear: () => void
  onSelect: (id: string) => void
}): React.JSX.Element {
  return (
    <div className={styles.choicePicker}>
      <button
        type="button"
        className={styles.choiceTrigger}
        onClick={() => onOpenChange(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={value ? styles.choiceValue : styles.choicePlaceholder}>{value ?? placeholder}</span>
        <ChevronDown size={15} className={styles.choiceChevron} data-open={open} />
      </button>
      {open && (
        <div className={styles.choiceList} role="listbox">
          <button
            type="button"
            role="option"
            aria-selected={selectedId === null}
            className={styles.choiceOption}
            onClick={() => {
              onClear()
              onOpenChange(false)
            }}
          >
            <span className={styles.optionCopy}>
              <span>{clearLabel}</span>
              <span className={styles.optionDetail}>{clearDetail}</span>
            </span>
            {selectedId === null && <Check size={14} />}
          </button>
          {options.length === 0 ? (
            <div className={styles.emptyOptions}>暂无可选项</div>
          ) : (
            options.map((option) => (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={option.id === selectedId}
                className={styles.choiceOption}
                data-current={option.current}
                onClick={() => onSelect(option.id)}
              >
                <span className={styles.optionCopy}>
                  <span className={styles.optionTitle} title={option.title}>
                    {option.title}
                  </span>
                  <span className={styles.optionDetail}>{option.current ? `当前 · ${option.detail}` : option.detail}</span>
                </span>
                {option.id === selectedId && <Check size={14} />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

type NoteSaveState = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

function TaskQuickNote({ task }: { task: WidgetFocusableTask | null }): React.JSX.Element {
  const taskId = task?.id ?? null
  const [value, setValue] = useState('')
  const [saveState, setSaveState] = useState<NoteSaveState>('idle')
  const draftRef = useRef({ taskId: null as string | null, value: '', dirty: false })
  const timerRef = useRef<number | null>(null)

  const persist = useCallback((id: string, text: string): void => {
    setSaveState('saving')
    void window.api.task.setQuickNote({ taskId: id, text }).then(
      (note) => {
        if (draftRef.current.taskId !== id) return
        if (draftRef.current.value === note.text) {
          draftRef.current.dirty = false
          setSaveState('saved')
        }
      },
      () => {
        if (draftRef.current.taskId === id) setSaveState('error')
      }
    )
  }, [])

  // 切换目标时先提交旧任务草稿，永远不把它写入新任务。
  useEffect(() => {
    const previous = draftRef.current
    if (previous.taskId === taskId) return
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (previous.taskId && previous.dirty) persist(previous.taskId, previous.value)

    draftRef.current = { taskId, value: '', dirty: false }
    setValue('')
    if (!taskId) {
      setSaveState('idle')
      return
    }

    let cancelled = false
    setSaveState('loading')
    void window.api.task.getQuickNote(taskId).then(
      (note) => {
        if (cancelled || draftRef.current.taskId !== taskId || draftRef.current.dirty) return
        const text = note?.text ?? ''
        draftRef.current = { taskId, value: text, dirty: false }
        setValue(text)
        setSaveState('saved')
      },
      () => {
        if (!cancelled && draftRef.current.taskId === taskId) setSaveState('error')
      }
    )
    return () => {
      cancelled = true
    }
  }, [persist, taskId])

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      const draft = draftRef.current
      if (draft.taskId && draft.dirty) persist(draft.taskId, draft.value)
    }
  }, [persist])

  // 主窗口任务详情编辑后刷新小窗；正在输入时优先保护本地草稿。
  useEffect(() => {
    if (!taskId) return
    return window.api.task.onQuickNoteChanged((changedTaskId) => {
      if (changedTaskId !== taskId || draftRef.current.dirty) return
      void window.api.task.getQuickNote(taskId).then((note) => {
        if (draftRef.current.taskId !== taskId || draftRef.current.dirty) return
        const text = note?.text ?? ''
        draftRef.current = { taskId, value: text, dirty: false }
        setValue(text)
        setSaveState('saved')
      }, () => {
        if (draftRef.current.taskId === taskId && !draftRef.current.dirty) setSaveState('error')
      })
    })
  }, [taskId])

  function change(next: string): void {
    if (!taskId) return
    draftRef.current = { taskId, value: next, dirty: true }
    setValue(next)
    setSaveState('saving')
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      const draft = draftRef.current
      if (draft.taskId === taskId && draft.dirty) persist(taskId, draft.value)
    }, 600)
  }

  function flush(): void {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const draft = draftRef.current
    if (draft.taskId && draft.dirty) persist(draft.taskId, draft.value)
  }

  const status = saveState === 'saving' ? '保存中' : saveState === 'saved' ? '已同步' : saveState === 'error' ? '保存失败' : ''

  return (
    <section className={styles.noteSection} data-disabled={!task}>
      <div className={styles.sectionLabel}>
        <StickyNote size={14} />
        <span>随心记</span>
        <span className={styles.noteStatus} data-error={saveState === 'error'}>
          {status}
        </span>
      </div>
      <div className={styles.noteTask} title={task?.title}>
        {task ? `写入任务：${task.title}` : '选择任务后，随心记会同步到任务详情'}
      </div>
      <textarea
        className={styles.noteArea}
        value={value}
        disabled={!task}
        rows={3}
        placeholder={task ? '记下灵感、阻塞点或下一步…' : '暂未选择任务'}
        onChange={(event) => change(event.target.value)}
        onBlur={flush}
      />
    </section>
  )
}
