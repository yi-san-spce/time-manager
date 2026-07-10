import { useEffect, useState } from 'react'
import { Trash2, Repeat } from 'lucide-react'
import {
  Drawer,
  Button,
  IconButton,
  TextField,
  Textarea,
  SelectMenu,
  Field
} from '../../design-system'
import { useCategories } from '../categories/useCategories'
import { useCreateSchedule, useDeleteSchedule, useUpdateSchedule } from './useSchedules'
import type { Priority, Schedule } from '@shared/types/models'
import type { RecurrenceInput } from '@shared/types/ipc'
import styles from './CalendarPage.module.css'

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']
// getDay(): 0=周日..6=周六；rrule byWeekday 用 0=周一..6=周日。这里 UI 用后者。
const RRULE_WEEKDAY = [0, 1, 2, 3, 4, 5, 6]

function toInputValue(timestamp: number): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export interface ScheduleDrawerProps {
  open: boolean
  onClose: () => void
  /** 编辑已有日程；null 表示新建 */
  schedule: Schedule | null
  /** 新建时的默认开始时间（点周视图某天时预填） */
  defaultStart?: number
}

export function ScheduleDrawer({ open, onClose, schedule, defaultStart }: ScheduleDrawerProps): React.JSX.Element {
  const { data: categories } = useCategories()
  const createSchedule = useCreateSchedule()
  const updateSchedule = useUpdateSchedule()
  const deleteSchedule = useDeleteSchedule()

  const isEdit = schedule !== null

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [priority, setPriority] = useState<Priority>(2)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [reminderMinutes, setReminderMinutes] = useState('')
  const [repeatWeekly, setRepeatWeekly] = useState(false)
  const [byWeekday, setByWeekday] = useState<number[]>([])

  useEffect(() => {
    if (!open) return
    if (schedule) {
      setTitle(schedule.title)
      setDescription(schedule.description ?? '')
      setCategoryId(schedule.categoryId ?? '')
      setPriority(schedule.priority)
      setStartTime(toInputValue(schedule.startTime))
      setEndTime(toInputValue(schedule.endTime))
      setReminderMinutes(schedule.reminderMinutesBefore != null ? String(schedule.reminderMinutesBefore) : '')
      setRepeatWeekly(false)
      setByWeekday([])
    } else {
      const base = defaultStart ?? Date.now()
      const start = new Date(base)
      if (defaultStart === undefined) {
        start.setMinutes(0, 0, 0)
        start.setHours(start.getHours() + 1)
      } else {
        start.setHours(9, 0, 0, 0)
      }
      const end = new Date(start.getTime() + 60 * 60 * 1000)
      setTitle('')
      setDescription('')
      setCategoryId('')
      setPriority(2)
      setStartTime(toInputValue(start.getTime()))
      setEndTime(toInputValue(end.getTime()))
      setReminderMinutes('')
      setRepeatWeekly(false)
      setByWeekday([])
    }
  }, [open, schedule, defaultStart])

  function toggleWeekday(day: number): void {
    setByWeekday((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()))
  }

  function handleSave(): void {
    if (!title.trim()) return
    const reminder = reminderMinutes.trim() ? Number(reminderMinutes) : null

    if (isEdit && schedule) {
      updateSchedule.mutate(
        {
          id: schedule.id,
          title: title.trim(),
          description: description || null,
          categoryId: categoryId || null,
          priority,
          startTime: new Date(startTime).getTime(),
          endTime: new Date(endTime).getTime(),
          reminderMinutesBefore: reminder
        },
        { onSuccess: onClose }
      )
    } else {
      const recurrence: RecurrenceInput | null =
        repeatWeekly && byWeekday.length > 0 ? { freq: 'WEEKLY', byWeekday, interval: 1 } : null
      createSchedule.mutate(
        {
          title: title.trim(),
          description: description || null,
          categoryId: categoryId || null,
          priority,
          startTime: new Date(startTime).getTime(),
          endTime: new Date(endTime).getTime(),
          reminderMinutesBefore: reminder,
          recurrence
        },
        { onSuccess: onClose }
      )
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? '编辑日程' : '新建日程'}
      headerExtra={
        isEdit &&
        schedule && (
          <IconButton
            danger
            onClick={() => {
              deleteSchedule.mutate(schedule.id)
              onClose()
            }}
            aria-label="删除日程"
          >
            <Trash2 size={16} />
          </IconButton>
        )
      }
    >
      <div className={styles.drawerForm}>
        <Field label="标题">
          <TextField value={title} onChange={(e) => setTitle(e.target.value)} placeholder="日程标题" autoFocus />
        </Field>

        <Field label="描述">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="补充说明（可选）"
          />
        </Field>

        <div className={styles.formRow}>
          <Field label="分类">
            <SelectMenu<string>
              value={categoryId}
              onChange={setCategoryId}
              options={[
                { value: '', label: '未分类' },
                ...(categories?.map((c) => ({ value: c.id, label: c.name })) ?? [])
              ]}
            />
          </Field>
          <Field label="优先级">
            <SelectMenu<string>
              value={String(priority)}
              onChange={(p) => setPriority(Number(p) as Priority)}
              options={[
                { value: '1', label: 'P1 高' },
                { value: '2', label: 'P2 中' },
                { value: '3', label: 'P3 低' }
              ]}
            />
          </Field>
        </div>

        <div className={styles.formRow}>
          <Field label="开始时间">
            <TextField type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
          <Field label="结束时间">
            <TextField type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </Field>
        </div>

        <Field label="提前提醒（分钟，留空则不提醒）">
          <TextField
            type="number"
            min={0}
            value={reminderMinutes}
            onChange={(e) => setReminderMinutes(e.target.value)}
            placeholder="如 10"
          />
        </Field>

        {!isEdit && (
          <Field label="重复">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                <input type="checkbox" checked={repeatWeekly} onChange={(e) => setRepeatWeekly(e.target.checked)} />
                <Repeat size={15} /> 每周重复
              </label>
              {repeatWeekly && (
                <div className={styles.weekdayPicker}>
                  {WEEKDAY_LABELS.map((label, i) => {
                    const day = RRULE_WEEKDAY[i]
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleWeekday(day)}
                        className={[styles.weekday, byWeekday.includes(day) && styles.weekdayActive]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </Field>
        )}

        <Button variant="primary" block onClick={handleSave} disabled={createSchedule.isPending || updateSchedule.isPending}>
          {isEdit ? '保存修改' : '创建日程'}
        </Button>
      </div>
    </Drawer>
  )
}
