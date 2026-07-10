import { useMemo, useState } from 'react'
import { Plus, ChevronLeft, ChevronRight, CalendarClock, Repeat } from 'lucide-react'
import { GlassSurface, Button, Segmented, Fab, Badge } from '../../design-system'
import { PageHeader } from '../../shell/PageHeader'
import { useSchedules } from './useSchedules'
import { useRecurrenceExpansion } from './useRecurrence'
import { ScheduleDrawer } from './ScheduleDrawer'
import type { Schedule } from '@shared/types/models'
import styles from './CalendarPage.module.css'

type ViewMode = 'day' | 'week' | 'month'

const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function startOfWeek(ts: number): number {
  const d = new Date(startOfDay(ts))
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.getTime()
}

function fmtTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface DayEvent {
  id: string
  title: string
  start: number
  end: number
  recurring: boolean
  schedule: Schedule
}

export function CalendarPage(): React.JSX.Element {
  const { data: schedules } = useSchedules()
  const [view, setView] = useState<ViewMode>('week')
  const [anchor, setAnchor] = useState(() => Date.now())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Schedule | null>(null)
  const [defaultStart, setDefaultStart] = useState<number | undefined>(undefined)

  // 视图范围
  const rangeStart = useMemo(() => {
    if (view === 'week') return startOfWeek(anchor)
    if (view === 'day') return startOfDay(anchor)
    // month：从当月第一天所在周起
    const d = new Date(anchor)
    d.setDate(1)
    return startOfWeek(d.getTime())
  }, [view, anchor])

  const dayCount = view === 'day' ? 1 : view === 'week' ? 7 : 35
  const rangeEnd = rangeStart + dayCount * DAY_MS

  const { data: occurrences } = useRecurrenceExpansion({ rangeStart, rangeEnd })

  // 把单次日程 + 重复展开实例聚合到每一天
  const eventsByDay = useMemo(() => {
    const map = new Map<number, DayEvent[]>()
    const push = (dayStart: number, ev: DayEvent): void => {
      const list = map.get(dayStart) ?? []
      list.push(ev)
      map.set(dayStart, list)
    }
    ;(schedules ?? [])
      .filter((s) => !s.recurrenceRuleId && s.startTime < rangeEnd && s.endTime > rangeStart)
      .forEach((s) =>
        push(startOfDay(s.startTime), {
          id: s.id,
          title: s.title,
          start: s.startTime,
          end: s.endTime,
          recurring: false,
          schedule: s
        })
      )
    ;(occurrences ?? []).forEach((o) =>
      push(startOfDay(o.occurrenceStart), {
        id: `${o.schedule.id}-${o.occurrenceStart}`,
        title: o.schedule.title,
        start: o.occurrenceStart,
        end: o.occurrenceEnd,
        recurring: true,
        schedule: o.schedule
      })
    )
    for (const list of map.values()) list.sort((a, b) => a.start - b.start)
    return map
  }, [schedules, occurrences, rangeStart, rangeEnd])

  const days = useMemo(
    () => Array.from({ length: view === 'day' ? 1 : view === 'week' ? 7 : 35 }, (_, i) => rangeStart + i * DAY_MS),
    [rangeStart, view]
  )

  function shift(dir: -1 | 1): void {
    const step = view === 'day' ? DAY_MS : view === 'week' ? 7 * DAY_MS : 28 * DAY_MS
    setAnchor((a) => a + dir * step)
  }

  function openCreate(dayStart?: number): void {
    setEditing(null)
    setDefaultStart(dayStart)
    setDrawerOpen(true)
  }

  function openEdit(schedule: Schedule): void {
    setEditing(schedule)
    setDefaultStart(undefined)
    setDrawerOpen(true)
  }

  const today = startOfDay(Date.now())
  const rangeLabel = new Date(rangeStart).toLocaleDateString()

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <PageHeader
        title="日程"
        subtitle="规划你的时间"
        actions={
          <>
            <div className={styles.weekNav}>
              <Button variant="ghost" onClick={() => shift(-1)} aria-label="上一周">
                <ChevronLeft size={16} />
              </Button>
              <span className={styles.weekLabel}>{rangeLabel} 起</span>
              <Button variant="ghost" onClick={() => shift(1)} aria-label="下一周">
                <ChevronRight size={16} />
              </Button>
            </div>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'day', label: '日' },
                { value: 'week', label: '周' },
                { value: 'month', label: '月' }
              ]}
            />
          </>
        }
      />

      <div
        className={styles.grid}
        style={view === 'day' ? { gridTemplateColumns: '1fr' } : undefined}
      >
        {days.map((dayStart) => {
          const events = eventsByDay.get(dayStart) ?? []
          const isToday = dayStart === today
          const d = new Date(dayStart)
          return (
            <div
              key={dayStart}
              className={[styles.dayCol, isToday && styles.dayColToday, view === 'month' && styles.dayColMonth]
                .filter(Boolean)
                .join(' ')}
            >
              <div className={styles.dayHead} onDoubleClick={() => openCreate(dayStart)}>
                <div className={styles.dayName}>{WEEKDAY_NAMES[(new Date(dayStart).getDay() + 6) % 7]}</div>
                <div className={[styles.dayNum, isToday && styles.dayNumToday].filter(Boolean).join(' ')}>
                  {d.getMonth() + 1}/{d.getDate()}
                </div>
              </div>
              {events.length === 0 ? (
                <div className={styles.emptyDay}>—</div>
              ) : (
                events.map((ev) => (
                  <div
                    key={ev.id}
                    className={[styles.eventItem, ev.recurring && styles.eventItemRecurring].filter(Boolean).join(' ')}
                    onClick={() => openEdit(ev.schedule)}
                  >
                    <div className={styles.eventTitle}>{ev.title}</div>
                    <div className={styles.eventTime}>
                      {ev.recurring && <Repeat size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />}
                      {fmtTime(ev.start)} - {fmtTime(ev.end)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )
        })}
      </div>

      {view === 'month' && (
        <GlassSurface radius="md" style={{ padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
          <CalendarClock size={16} color="var(--stage-plan)" />
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            月视图显示未来数周概览
          </span>
          <Badge tone="neutral">Beta</Badge>
        </GlassSurface>
      )}

      <Fab icon={<Plus size={18} />} label="新建日程" onClick={() => openCreate()} />

      <ScheduleDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        schedule={editing}
        defaultStart={defaultStart}
      />
    </section>
  )
}
