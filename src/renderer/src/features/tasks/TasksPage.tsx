import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { GlassSurface, TextField, Button, Badge, TagChip, ProgressBar, Checkbox, Segmented, SelectMenu } from '../../design-system'
import { PageHeader } from '../../shell/PageHeader'
import { StartFocusButton } from '../timer/PomodoroWidget'
import { useCreateTask, useTasks, useUpdateTask } from './useTasks'
import { useCategories } from '../categories/useCategories'
import { TaskDetailDrawer } from './TaskDetailDrawer'
import { TASK_STATUS_META, PRIORITY_META, formatDueDate, isOverdue } from './taskMeta'
import type { TaskStatus } from '@shared/types/models'
import styles from './TasksPage.module.css'

type StatusFilter = 'all' | TaskStatus

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待办' },
  { value: 'in_progress', label: '进行中' },
  { value: 'blocked', label: '阻塞' },
  { value: 'done', label: '已完成' }
]

export function TasksPage(): React.JSX.Element {
  const { data: tasks, isLoading } = useTasks()
  const { data: categories } = useCategories()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault()
    if (!title.trim()) return
    createTask.mutate(
      { title: title.trim(), categoryId: categoryId || null },
      { onSuccess: () => setTitle('') }
    )
  }

  const filtered = useMemo(
    () => (tasks ?? []).filter((t) => filter === 'all' || t.status === filter),
    [tasks, filter]
  )

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <PageHeader title="任务" subtitle="记录待办，拆解步骤" />

      <GlassSurface radius="lg" style={{ padding: 'var(--space-5)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <TextField value={title} onChange={(e) => setTitle(e.target.value)} placeholder="添加一个任务..." />
          <div style={{ minWidth: 140 }}>
            <SelectMenu<string>
              value={categoryId}
              onChange={setCategoryId}
              options={[
                { value: '', label: '未分类' },
                ...(categories?.map((c) => ({ value: c.id, label: c.name })) ?? [])
              ]}
            />
          </div>
          <Button type="submit" variant="primary" icon={<Plus size={16} />} disabled={createTask.isPending}>
            添加
          </Button>
        </form>
      </GlassSurface>

      <Segmented value={filter} onChange={setFilter} options={FILTER_OPTIONS} />

      {isLoading && <p style={{ color: 'var(--color-text-muted)' }}>加载中...</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {filtered.map((task) => {
          const meta = TASK_STATUS_META[task.status]
          const done = task.status === 'done'
          const overdue = isOverdue(task.dueDate, task.status)
          return (
            <GlassSurface
              key={task.id}
              radius="md"
              interactive
              className={styles.taskCard}
              onClick={() => setOpenTaskId(task.id)}
            >
              <div className={styles.cardLead} onClick={(e) => e.stopPropagation()}>
                <span className={styles.statusDot} style={{ background: meta.dot }} />
                <Checkbox
                  checked={done}
                  onChange={(checked) => updateTask.mutate({ id: task.id, status: checked ? 'done' : 'pending' })}
                />
              </div>

              <div className={styles.cardBody}>
                <div className={[styles.cardTitle, done && styles.cardTitleDone].filter(Boolean).join(' ')}>
                  {task.title}
                </div>
                {task.description && <div className={styles.cardDesc}>{task.description}</div>}
                {task.subtaskTotal > 0 && (
                  <div className={styles.cardProgress}>
                    <ProgressBar value={task.subtaskDone} max={task.subtaskTotal} showLabel />
                  </div>
                )}
              </div>

              <div className={styles.cardMeta}>
                {overdue && <Badge tone="danger">逾期</Badge>}
                {task.dueDate !== null && !overdue && <Badge tone="neutral">{formatDueDate(task.dueDate)}</Badge>}
                {task.tags.slice(0, 2).map((tag) => (
                  <TagChip key={tag.id} label={tag.name} color={tag.color} />
                ))}
                <Badge tone={PRIORITY_META[task.priority].tone}>{PRIORITY_META[task.priority].label}</Badge>
                <Badge tone={meta.tone}>{meta.label}</Badge>
                {!done && task.status !== 'cancelled' && (
                  <StartFocusButton taskId={task.id} label={task.title} />
                )}
              </div>
            </GlassSurface>
          )
        })}
      </div>

      {filtered.length === 0 && !isLoading && (
        <p style={{ color: 'var(--color-text-muted)' }}>
          {filter === 'all' ? '暂无任务，添加一个开始吧。' : '该筛选下暂无任务。'}
        </p>
      )}

      <TaskDetailDrawer taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
    </section>
  )
}
