import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, GitMerge, Plus, RotateCcw, Trash2, ZoomIn, ZoomOut } from 'lucide-react'
import {
  Badge,
  Button,
  Checkbox,
  Field,
  GlassSurface,
  IconButton,
  Modal,
  Segmented,
  SelectMenu,
  TextField,
  Textarea
} from '../../design-system'
import { PageHeader } from '../../shell/PageHeader'
import {
  useCreateManualTimeEntry,
  useDeleteTimeEntry,
  useLinkTimeEntryToTask,
  useMergeTimeEntries,
  useTimeEntries
} from './useTimeEntries'
import { useTimeStats } from '../stats/useTimeStats'
import { useTasks } from '../tasks/useTasks'
import { ActivityDetailDrawer } from './ActivityDetailDrawer'
import { getAnchoredHorizontalTimelineScrollLeft, layoutHorizontalTimelineEntries } from './timelineLayout'
import { getLinearWheelZoomDelta } from './timelineZoom'
import type { TimeEntry, TimeStatBucket } from '@shared/types/models'
import trackStyles from './TrackingPage.module.css'

type ViewMode = 'summary' | 'timeline'

const HOURS = Array.from({ length: 25 }, (_, hour) => hour)
const MINUTES_PER_HOUR = 60
const TIMELINE_DEFAULT_PIXELS_PER_HOUR = 720
const TIMELINE_MIN_PIXELS_PER_HOUR = 60
const TIMELINE_MAX_PIXELS_PER_HOUR = 7200
/** One zoom step is exactly one rendered pixel for each minute of the day. */
const TIMELINE_ZOOM_STEP = MINUTES_PER_HOUR
const TIMELINE_MINUTE_GRID_THRESHOLD = 600
const TIMELINE_ROW_HEIGHT = 74
const TIMELINE_ROW_GAP = 10
const TIMELINE_CANVAS_PADDING_Y = 12
const TIMELINE_MIN_CANVAS_HEIGHT = 172

interface TimelineDragState {
  pointerId: number
  startClientX: number
  startScrollLeft: number
  didDrag: boolean
}

interface PendingTimelineZoomAnchor {
  scrollLeftPx: number
  viewportOffsetPx: number
  currentPixelsPerHour: number
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function dayRange(date: Date): { rangeStart: number; rangeEnd: number } {
  const start = startOfLocalDay(date)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { rangeStart: start.getTime(), rangeEnd: end.getTime() }
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return startOfLocalDay(next)
}

function sameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateInput(value: string): Date | null {
  const [year, month, day] = value.split('-').map(Number)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  const parsed = new Date(year, month - 1, day)
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null
  return startOfLocalDay(parsed)
}

function dateTimeOnDay(date: Date, value: string): number | null {
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, 0, 0).getTime()
}

function formatDateLabel(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  }).format(date)
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(timestamp)
}

function formatDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60000))
  if (minutes < 60) return `${minutes}分钟`
  return `${Math.floor(minutes / 60)}小时${minutes % 60}分钟`
}

function entryTitle(entry: TimeEntry, taskTitle?: string): string {
  // Auto-tracked entries should always identify the app first. A linked task is
  // useful context, but making it the title hid the application the user opened.
  return entry.appName?.trim() || entry.windowTitle?.trim() || taskTitle?.trim() || entry.note?.trim() || '未命名记录'
}

function colorForApp(appName: string | null): string {
  const colors = ['#8b7cff', '#5ba7ff', '#41c9a0', '#f0a75c', '#e978a6', '#55b7c8', '#b78bf2']
  const key = appName ?? 'manual'
  let hash = 0
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return colors[hash % colors.length]
}

function visibleDuration(entry: TimeEntry, range: { rangeStart: number; rangeEnd: number }): number {
  return Math.max(0, Math.min(entry.endTime, range.rangeEnd) - Math.max(entry.startTime, range.rangeStart))
}

export function TrackingPage(): React.JSX.Element {
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfLocalDay(new Date()))
  const range = useMemo(() => dayRange(selectedDate), [selectedDate])
  const { data: entries, isLoading } = useTimeEntries(range)
  const { data: timeStats } = useTimeStats(range)
  const { data: tasks } = useTasks()
  const createManual = useCreateManualTimeEntry()
  const deleteEntry = useDeleteTimeEntry()
  const linkToTask = useLinkTimeEntryToTask()
  const mergeEntries = useMergeTimeEntries()
  const queryClient = useQueryClient()

  const [viewMode, setViewMode] = useState<ViewMode>('summary')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [openApp, setOpenApp] = useState<string | null>(null)
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null)
  const [timelinePixelsPerHour, setTimelinePixelsPerHour] = useState(TIMELINE_DEFAULT_PIXELS_PER_HOUR)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualStart, setManualStart] = useState('09:00')
  const [manualEnd, setManualEnd] = useState('09:30')
  const [manualTaskId, setManualTaskId] = useState('')
  const [manualNote, setManualNote] = useState('')
  const [manualError, setManualError] = useState('')
  const [isTimelineDragging, setIsTimelineDragging] = useState(false)
  const timelineViewportRef = useRef<HTMLDivElement>(null)
  const focusedTimelineDateRef = useRef<number | null>(null)
  const timelineDragRef = useRef<TimelineDragState | null>(null)
  const suppressTimelineBlockClickRef = useRef(false)
  const pendingTimelineZoomAnchorRef = useRef<PendingTimelineZoomAnchor | null>(null)
  // A native wheel listener can receive several events before React has painted
  // the previous state update. Keep the logical scale in sync immediately so
  // fast scrolling never drops a zoom increment.
  const timelinePixelsPerHourRef = useRef(TIMELINE_DEFAULT_PIXELS_PER_HOUR)
  const lastTimelineWheelTimestampRef = useRef<number | null>(null)

  const today = startOfLocalDay(new Date())
  const isToday = sameLocalDay(selectedDate, today)
  const totalMs = entries?.reduce((sum, entry) => sum + visibleDuration(entry, range), 0) ?? 0
  const taskOptions = useMemo(
    () => [
      { value: '', label: '未关联' },
      ...(tasks?.map((task) => ({ value: task.id, label: task.title })) ?? [])
    ],
    [tasks]
  )
  const timelineItems = useMemo(
    () => layoutHorizontalTimelineEntries(entries ?? [], range, { pixelsPerHour: timelinePixelsPerHour }),
    [entries, range.rangeEnd, range.rangeStart, timelinePixelsPerHour]
  )
  const timelineRowCount = timelineItems[0]?.rowCount ?? 1
  const timelineCanvasWidth = 24 * timelinePixelsPerHour
  const timelineCanvasHeight = Math.max(
    TIMELINE_MIN_CANVAS_HEIGHT,
    timelineRowCount * TIMELINE_ROW_HEIGHT + (timelineRowCount - 1) * TIMELINE_ROW_GAP + TIMELINE_CANVAS_PADDING_Y * 2
  )
  const timelinePixelsPerMinute = timelinePixelsPerHour / MINUTES_PER_HOUR
  const activeTimelineItem = timelineItems.find((item) => item.entry.id === activeEntryId) ?? null
  const activeEntry = activeTimelineItem?.entry ?? null
  const activeTask = activeEntry?.taskId ? tasks?.find((task) => task.id === activeEntry.taskId) : undefined

  useEffect(() => {
    return window.api.timeEntry.onNewEntry(() => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['time-entries'] }),
        queryClient.invalidateQueries({ queryKey: ['time-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['activity-detail'] })
      ])
    })
  }, [queryClient])

  useEffect(() => {
    setSelectedIds([])
    setActiveEntryId(null)
  }, [range.rangeStart])

  useEffect(() => {
    if (viewMode !== 'timeline' || focusedTimelineDateRef.current === range.rangeStart || timelineItems.length === 0) {
      return
    }

    const viewport = timelineViewportRef.current
    if (!viewport) return

    const firstVisibleStart = timelineItems[0].visibleStartTime
    const firstVisibleHour = (firstVisibleStart - range.rangeStart) / (60 * 60 * 1000)
    const frame = window.requestAnimationFrame(() => {
      viewport.scrollLeft = Math.max(0, firstVisibleHour * timelinePixelsPerHour - viewport.clientWidth * 0.2)
      focusedTimelineDateRef.current = range.rangeStart
    })

    return () => window.cancelAnimationFrame(frame)
  }, [range.rangeStart, timelineItems, timelinePixelsPerHour, viewMode])

  useLayoutEffect(() => {
    const anchor = pendingTimelineZoomAnchorRef.current
    if (!anchor) return

    pendingTimelineZoomAnchorRef.current = null
    const viewport = timelineViewportRef.current
    if (!viewport) return

    viewport.scrollLeft = getAnchoredHorizontalTimelineScrollLeft({
      ...anchor,
      nextPixelsPerHour: timelinePixelsPerHour,
      contentWidthPx: timelineCanvasWidth,
      viewportWidthPx: viewport.clientWidth
    })
  }, [timelineCanvasWidth, timelinePixelsPerHour])

  // React delegates wheel events passively, which prevents `preventDefault()` from stopping
  // the page scroll. Attach this listener directly so the timeline owns the wheel while hovered.
  useEffect(() => {
    if (viewMode !== 'timeline') return
    const viewport = timelineViewportRef.current
    if (!viewport) return

    const onWheel = (event: WheelEvent): void => {
      if (event.deltaY === 0) return
      event.preventDefault()

      const timestamp = Number.isFinite(event.timeStamp) ? event.timeStamp : performance.now()
      const previousTimestamp = lastTimelineWheelTimestampRef.current
      lastTimelineWheelTimestampRef.current = timestamp
      const elapsedMs = previousTimestamp === null ? 120 : Math.max(0, timestamp - previousTimestamp)
      const bounds = viewport.getBoundingClientRect()
      const pointerOffsetPx = Math.min(viewport.clientWidth, Math.max(0, event.clientX - bounds.left))
      const wheelZoomDelta = getLinearWheelZoomDelta({
        deltaY: event.deltaY,
        deltaMode: event.deltaMode,
        elapsedMs,
        viewportHeightPx: viewport.clientHeight
      })
      // A negative wheel delta conventionally zooms in, while the helper keeps
      // the wheel's native sign (negative is upward) for testable normalization.
      setTimelineZoom(timelinePixelsPerHourRef.current - wheelZoomDelta, pointerOffsetPx)
    }

    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      lastTimelineWheelTimestampRef.current = null
      viewport.removeEventListener('wheel', onWheel)
    }
  }, [viewMode])

  function toggleSelect(id: string): void {
    setSelectedIds((previous) => (previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]))
  }

  function handleMerge(): void {
    if (selectedIds.length < 2) return
    mergeEntries.mutate({ ids: selectedIds }, { onSuccess: () => setSelectedIds([]) })
  }

  function openManualForm(): void {
    setManualStart('09:00')
    setManualEnd('09:30')
    setManualTaskId('')
    setManualNote('')
    setManualError('')
    setManualOpen(true)
  }

  function handleManualSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const startTime = dateTimeOnDay(selectedDate, manualStart)
    const endTime = dateTimeOnDay(selectedDate, manualEnd)
    if (startTime === null || endTime === null) {
      setManualError('请输入有效的开始和结束时间。')
      return
    }
    if (endTime <= startTime) {
      setManualError('结束时间必须晚于开始时间。')
      return
    }

    setManualError('')
    createManual.mutate(
      {
        startTime,
        endTime,
        taskId: manualTaskId || null,
        note: manualNote.trim() || null
      },
      {
        onSuccess: () => setManualOpen(false),
        onError: (error) => setManualError(error instanceof Error ? error.message : '保存手动记录失败。')
      }
    )
  }

  function handleDateChange(value: string): void {
    const nextDate = parseDateInput(value)
    if (nextDate && nextDate.getTime() <= today.getTime()) setSelectedDate(nextDate)
  }

  function setTimelineZoom(nextValue: number, viewportOffsetPx?: number): void {
    const snapped = Math.round(nextValue / TIMELINE_ZOOM_STEP) * TIMELINE_ZOOM_STEP
    const nextPixelsPerHour = Math.min(TIMELINE_MAX_PIXELS_PER_HOUR, Math.max(TIMELINE_MIN_PIXELS_PER_HOUR, snapped))
    const currentPixelsPerHour = timelinePixelsPerHourRef.current
    if (nextPixelsPerHour === currentPixelsPerHour) return

    const viewport = timelineViewportRef.current
    if (viewport) {
      const firstVisibleItem = timelineItems.find(
        (item) =>
          item.leftPx + item.renderWidthPx >= viewport.scrollLeft &&
          item.leftPx <= viewport.scrollLeft + viewport.clientWidth
      )
      // Toolbar controls have no pointer position. Keep the first visible activity in view
      // instead of zooming around a blank midpoint; wheel zoom still passes its exact cursor x.
      const defaultAnchorOffset = firstVisibleItem
        ? firstVisibleItem.leftPx - viewport.scrollLeft
        : viewport.clientWidth / 2
      const anchorX = Math.min(
        viewport.clientWidth,
        Math.max(0, viewportOffsetPx ?? defaultAnchorOffset)
      )
      pendingTimelineZoomAnchorRef.current = {
        scrollLeftPx: viewport.scrollLeft,
        viewportOffsetPx: anchorX,
        currentPixelsPerHour
      }
    }

    timelinePixelsPerHourRef.current = nextPixelsPerHour
    setTimelinePixelsPerHour(nextPixelsPerHour)
  }

  function handleTimelinePointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.button !== 0 || event.pointerType === 'touch') return

    const viewport = event.currentTarget
    viewport.setPointerCapture(event.pointerId)
    timelineDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startScrollLeft: viewport.scrollLeft,
      didDrag: false
    }
    setIsTimelineDragging(true)
  }

  function handleTimelinePointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = timelineDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const deltaX = event.clientX - drag.startClientX
    if (!drag.didDrag && Math.abs(deltaX) >= 3) {
      drag.didDrag = true
    }
    if (!drag.didDrag) return

    event.preventDefault()
    const maxScrollLeft = Math.max(0, event.currentTarget.scrollWidth - event.currentTarget.clientWidth)
    event.currentTarget.scrollLeft = Math.min(maxScrollLeft, Math.max(0, drag.startScrollLeft - deltaX))
  }

  function stopTimelineDrag(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = timelineDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    timelineDragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setIsTimelineDragging(false)

    if (drag.didDrag) {
      suppressTimelineBlockClickRef.current = true
      window.setTimeout(() => {
        suppressTimelineBlockClickRef.current = false
      }, 0)
    }
  }

  function handleTimelineBlockClick(id: string): void {
    if (suppressTimelineBlockClickRef.current) return
    setActiveEntryId(id)
  }

  function deleteActiveEntry(): void {
    if (!activeEntry) return
    deleteEntry.mutate(activeEntry.id, { onSuccess: () => setActiveEntryId(null) })
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <PageHeader
        title={isToday ? '今日追踪' : '时间追踪'}
        subtitle={entries && entries.length > 0 ? `已记录 ${formatDuration(totalMs)}` : '自动 + 手动时间线'}
        actions={
          <>
            <div className={trackStyles.dateNav} aria-label="选择追踪日期">
              <IconButton onClick={() => setSelectedDate((date) => addDays(date, -1))} aria-label="前一天">
                <ChevronLeft size={17} />
              </IconButton>
              <label className={trackStyles.dateLabel}>
                <CalendarDays size={15} />
                <TextField
                  type="date"
                  value={formatDateInput(selectedDate)}
                  max={formatDateInput(today)}
                  aria-label="追踪日期"
                  onChange={(event) => handleDateChange(event.target.value)}
                />
              </label>
              <IconButton
                onClick={() => setSelectedDate((date) => addDays(date, 1))}
                disabled={isToday}
                aria-label="后一天"
              >
                <ChevronRight size={17} />
              </IconButton>
            </div>
            <Segmented
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: 'summary', label: '总览' },
                { value: 'timeline', label: '时间线' }
              ]}
            />
            <Button icon={<Plus size={16} />} onClick={openManualForm}>
              手动新增
            </Button>
            <Button
              variant="secondary"
              icon={<GitMerge size={16} />}
              onClick={handleMerge}
              disabled={viewMode !== 'timeline' || selectedIds.length < 2}
            >
              合并({selectedIds.length})
            </Button>
          </>
        }
      />

      {isLoading && <p style={{ color: 'var(--color-text-muted)' }}>加载中...</p>}

      {viewMode === 'summary' ? (
        <TrackingSummary buckets={timeStats?.byApp} onSelect={setOpenApp} />
      ) : (
        <>
          <div className={trackStyles.timelinePanel}>
            <div className={trackStyles.timelineToolbar}>
              <div>
                <div className={trackStyles.timelineToolbarTitle}>横向时间轴</div>
                <p className={trackStyles.timelineToolbarHint}>
                  按真实起止时间排列；左键拖动平移，悬停后滚轮缩放。慢滚逐分钟微调，快速滚动线性加速。
                </p>
              </div>
              <div className={trackStyles.timelineZoomControls}>
                <IconButton
                  size="sm"
                  aria-label="缩小时间轴"
                  title="缩小时间轴"
                  onClick={() => setTimelineZoom(timelinePixelsPerHour - TIMELINE_ZOOM_STEP)}
                  disabled={timelinePixelsPerHour <= TIMELINE_MIN_PIXELS_PER_HOUR}
                >
                  <ZoomOut size={15} />
                </IconButton>
                <label className={trackStyles.timelineZoomRange}>
                  <span>缩放</span>
                  <input
                    type="range"
                    min={TIMELINE_MIN_PIXELS_PER_HOUR}
                    max={TIMELINE_MAX_PIXELS_PER_HOUR}
                    step={TIMELINE_ZOOM_STEP}
                    value={timelinePixelsPerHour}
                    aria-label="时间轴缩放"
                    onChange={(event) => setTimelineZoom(Number(event.target.value))}
                  />
                </label>
                <output
                  className={trackStyles.timelineZoomValue}
                  aria-live="polite"
                  title={`每分钟 ${timelinePixelsPerMinute} 像素`}
                >
                  {timelinePixelsPerMinute}px/分
                </output>
                <IconButton
                  size="sm"
                  aria-label="放大时间轴"
                  title="放大时间轴"
                  onClick={() => setTimelineZoom(timelinePixelsPerHour + TIMELINE_ZOOM_STEP)}
                  disabled={timelinePixelsPerHour >= TIMELINE_MAX_PIXELS_PER_HOUR}
                >
                  <ZoomIn size={15} />
                </IconButton>
                <IconButton
                  size="sm"
                  aria-label="重置时间轴缩放"
                  title="重置为 100%"
                  onClick={() => setTimelineZoom(TIMELINE_DEFAULT_PIXELS_PER_HOUR)}
                  disabled={timelinePixelsPerHour === TIMELINE_DEFAULT_PIXELS_PER_HOUR}
                >
                  <RotateCcw size={14} />
                </IconButton>
              </div>
            </div>
            <div
              ref={timelineViewportRef}
              className={[trackStyles.timelineViewport, isTimelineDragging && trackStyles.timelineViewportDragging]
                .filter(Boolean)
                .join(' ')}
              tabIndex={0}
              aria-label="横向追踪时间轴。左键拖动平移，鼠标滚轮缩放。"
              onPointerDown={handleTimelinePointerDown}
              onPointerMove={handleTimelinePointerMove}
              onPointerUp={stopTimelineDrag}
              onPointerCancel={stopTimelineDrag}
              onLostPointerCapture={stopTimelineDrag}
            >
              <div
                className={trackStyles.timelineSurface}
                data-minute-grid={timelinePixelsPerHour >= TIMELINE_MINUTE_GRID_THRESHOLD ? 'true' : undefined}
                style={
                  {
                    width: `${timelineCanvasWidth}px`,
                    '--timeline-hour-width': `${timelinePixelsPerHour}px`,
                    '--timeline-minute-width': `${timelinePixelsPerMinute}px`,
                    '--timeline-row-height': `${TIMELINE_ROW_HEIGHT}px`
                  } as CSSProperties
                }
              >
                <div className={trackStyles.timelineRuler} aria-hidden="true">
              {HOURS.map((hour) => (
                <span key={hour} className={trackStyles.timelineHour} style={{ left: `${hour * timelinePixelsPerHour}px` }}>
                  {String(hour).padStart(2, '0')}:00
                </span>
              ))}
            </div>
                <div className={trackStyles.timelineCanvas} style={{ height: `${timelineCanvasHeight}px` }}>
              {timelineItems.map((item) => {
                const task = item.entry.taskId ? tasks?.find((candidate) => candidate.id === item.entry.taskId) : undefined
                const title = entryTitle(item.entry, task?.title)
                const taskLabel = task?.title && task.title !== title ? `任务：${task.title}` : ''
                const taskPrefix = taskLabel ? `${taskLabel} · ` : ''
                const selected = selectedIds.includes(item.entry.id) || activeEntryId === item.entry.id
                const tooltip = [
                  title,
                  taskLabel,
                  `${formatTime(item.visibleStartTime)} – ${formatTime(item.visibleEndTime)} · ${formatDuration(item.durationMs)}`,
                  item.entry.windowTitle
                ]
                  .filter(Boolean)
                  .join('\n')
                const blockStyle = {
                  top: `${TIMELINE_CANVAS_PADDING_Y + item.row * (TIMELINE_ROW_HEIGHT + TIMELINE_ROW_GAP)}px`,
                  height: `${TIMELINE_ROW_HEIGHT}px`,
                  left: `${item.leftPx}px`,
                  width: `${item.renderWidthPx}px`,
                  '--app-color': colorForApp(item.entry.appName)
                } as CSSProperties

                return (
                  <GlassSurface
                    key={item.entry.id}
                    interactive
                    radius="sm"
                    role="button"
                    tabIndex={0}
                    aria-label={tooltip}
                    aria-pressed={selected}
                    className={[
                      trackStyles.timelineBlock,
                      item.renderMode === 'marker' && trackStyles.timelineBlockMarker,
                      item.renderMode === 'compact' && trackStyles.timelineBlockCompact,
                      selected && trackStyles.timelineBlockSelected
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={blockStyle}
                    title={tooltip}
                    onClick={() => handleTimelineBlockClick(item.entry.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setActiveEntryId(item.entry.id)
                      }
                    }}
                  >
                    {item.renderMode !== 'marker' && <span className={trackStyles.timelineBlockHeader}>{title}</span>}
                    {item.renderMode === 'card' && (
                      <span className={trackStyles.timelineBlockMeta}>
                        {taskPrefix}
                        {formatTime(item.visibleStartTime)} – {formatTime(item.visibleEndTime)} · {formatDuration(item.durationMs)}
                      </span>
                    )}
                  </GlassSurface>
                )
              })}

              {timelineItems.length === 0 && !isLoading && (
                <div className={trackStyles.timelineEmpty}>这一天还没有追踪记录。</div>
              )}
                </div>
              </div>
            </div>
          </div>

          {activeEntry && activeTimelineItem && (
            <GlassSurface strong radius="md" className={trackStyles.timelineInspector}>
              <div>
                <div className={trackStyles.timelineBlockHeader}>{entryTitle(activeEntry, activeTask?.title)}</div>
                <div className={trackStyles.timelineBlockMeta}>
                  {formatTime(activeTimelineItem.visibleStartTime)} – {formatTime(activeTimelineItem.visibleEndTime)} ·{' '}
                  {formatDuration(activeTimelineItem.durationMs)}
                  {activeEntry.windowTitle ? ` · ${activeEntry.windowTitle}` : ''}
                </div>
              </div>
              <div className={trackStyles.timelineBlockActions}>
                <Checkbox
                  size="sm"
                  checked={selectedIds.includes(activeEntry.id)}
                  onChange={() => toggleSelect(activeEntry.id)}
                  label="合并选择"
                />
                <SelectMenu
                  value={activeEntry.taskId ?? ''}
                  onChange={(taskId) => linkToTask.mutate({ id: activeEntry.id, taskId: taskId || null })}
                  align="right"
                  style={{ width: 176 }}
                  options={taskOptions}
                />
                {activeEntry.appName && (
                  <Button size="sm" variant="secondary" onClick={() => setOpenApp(activeEntry.appName)}>
                    应用详情
                  </Button>
                )}
                <IconButton danger onClick={deleteActiveEntry} aria-label="删除记录">
                  <Trash2 size={16} />
                </IconButton>
              </div>
            </GlassSurface>
          )}
        </>
      )}

      <ActivityDetailDrawer appName={openApp} range={range} onClose={() => setOpenApp(null)} />

      <Modal open={manualOpen} onClose={() => setManualOpen(false)} title={`补录时间 · ${formatDateLabel(selectedDate)}`}>
        <form className={trackStyles.manualForm} onSubmit={handleManualSubmit}>
          <div className={trackStyles.manualFieldRow}>
            <Field label="开始时间">
              <TextField type="time" value={manualStart} onChange={(event) => setManualStart(event.target.value)} required />
            </Field>
            <Field label="结束时间">
              <TextField type="time" value={manualEnd} onChange={(event) => setManualEnd(event.target.value)} required />
            </Field>
          </div>
          <Field label="关联任务（可选）">
            <SelectMenu value={manualTaskId} onChange={setManualTaskId} options={taskOptions} />
          </Field>
          <Field label="备注（可选）">
            <Textarea
              rows={3}
              value={manualNote}
              onChange={(event) => setManualNote(event.target.value)}
              placeholder="例如：整理会议纪要、专注阅读…"
            />
          </Field>
          {manualError && <div className={trackStyles.manualError}>{manualError}</div>}
          <Button type="submit" variant="primary" block disabled={createManual.isPending}>
            {createManual.isPending ? '保存中…' : '保存记录'}
          </Button>
        </form>
      </Modal>
    </section>
  )
}

/** 按应用分组的合并时长卡；点击进入该应用的活动详情。 */
function TrackingSummary({
  buckets,
  onSelect
}: {
  buckets?: TimeStatBucket[]
  onSelect: (appName: string) => void
}): React.JSX.Element {
  const rows = buckets ?? []
  if (rows.length === 0) {
    return <p style={{ color: 'var(--color-text-muted)' }}>这一天还没有追踪记录。</p>
  }

  const maxMinutes = rows[0].minutes || 1
  return (
    <div className={trackStyles.summaryList}>
      {rows.map((bucket) => (
        <GlassSurface
          key={bucket.key}
          radius="md"
          interactive
          className={trackStyles.summaryRow}
          style={{ '--app-color': colorForApp(bucket.key) } as CSSProperties}
          onClick={() => onSelect(bucket.key)}
        >
          <div
            className={trackStyles.summaryBar}
            style={{ width: `${Math.max(6, Math.round((bucket.minutes / maxMinutes) * 100))}%` }}
          />
          <span className={trackStyles.summaryName} title={bucket.key}>
            {bucket.key}
          </span>
          <Badge tone="neutral" className={trackStyles.summaryCount}>
            {bucket.count} 段
          </Badge>
          <span className={trackStyles.summaryValue}>{formatDuration(bucket.minutes * 60000)}</span>
        </GlassSurface>
      ))}
    </div>
  )
}
