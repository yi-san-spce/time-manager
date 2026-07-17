import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, ChevronUp, ChevronDown, Eye, Pencil, Tag as TagIcon, Sparkles, StickyNote } from 'lucide-react'
import {
  Drawer,
  Button,
  IconButton,
  TextField,
  Textarea,
  SelectMenu,
  Checkbox,
  Badge,
  TagChip,
  ProgressBar,
  Field
} from '../../design-system'
import { renderMarkdown } from '../../design-system/markdown'
import { useCategories } from '../categories/useCategories'
import { StartFocusButton } from '../timer/PomodoroWidget'
import { ChatPanel } from '../assistant/ChatPanel'
import {
  useTaskDetail,
  useUpdateTask,
  useDeleteTask,
  useCreateSubtask,
  useUpdateSubtask,
  useDeleteSubtask,
  useReorderSubtasks,
  useTags,
  useCreateTag,
  useSetTaskTags,
  useTaskQuickNote,
  useSetTaskQuickNote,
  taskQuickNoteKey
} from './useTasks'
import { TASK_STATUS_META, TASK_STATUS_ORDER, PRIORITY_META } from './taskMeta'
import type { Priority, TaskStatus } from '@shared/types/models'
import styles from './TaskDetailDrawer.module.css'

function toDateInput(ts: number | null): string {
  if (ts === null) return ''
  const d = new Date(ts)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export interface TaskDetailDrawerProps {
  taskId: string | null
  onClose: () => void
}

type QuickNoteSaveState = 'loading' | 'saved' | 'unsaved' | 'saving' | 'error'

interface QuickNoteDraft {
  taskId: string | null
  content: string
}

const QUICK_NOTE_DEBOUNCE_MS = 600

export function TaskDetailDrawer({ taskId, onClose }: TaskDetailDrawerProps): React.JSX.Element {
  const { data: task } = useTaskDetail(taskId)
  const quickNoteQuery = useTaskQuickNote(taskId)
  const { data: categories } = useCategories()
  const { data: allTags } = useTags()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const createSubtask = useCreateSubtask()
  const updateSubtask = useUpdateSubtask(taskId ?? '')
  const deleteSubtask = useDeleteSubtask(taskId ?? '')
  const reorderSubtasks = useReorderSubtasks()
  const createTag = useCreateTag()
  const setTaskTags = useSetTaskTags()
  const { mutate: saveTaskQuickNote } = useSetTaskQuickNote()
  const queryClient = useQueryClient()

  const [titleDraft, setTitleDraft] = useState('')
  const [descDraft, setDescDraft] = useState('')
  const [descMode, setDescMode] = useState<'edit' | 'preview'>('preview')
  const [newSubtask, setNewSubtask] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [aiOpen, setAiOpen] = useState(false)
  const [quickNoteDraft, setQuickNoteDraft] = useState('')
  const [quickNoteDraftTaskId, setQuickNoteDraftTaskId] = useState<string | null>(null)
  const [quickNoteSaveState, setQuickNoteSaveState] = useState<QuickNoteSaveState>('loading')
  const loadedTaskId = useRef<string | null>(null)
  const quickNoteDraftRef = useRef<QuickNoteDraft>({ taskId: null, content: '' })
  const quickNoteDirtyRef = useRef(false)
  const quickNoteSavedByTaskRef = useRef(new Map<string, string>())
  const quickNoteSavingByTaskRef = useRef(new Map<string, string>())
  const quickNoteSaveVersionByTaskRef = useRef(new Map<string, number>())
  const quickNoteSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 任务切换时同步草稿（只在 id 变化时，避免打字被覆盖）
  useEffect(() => {
    if (task && task.id !== loadedTaskId.current) {
      setTitleDraft(task.title)
      setDescDraft(task.description ?? '')
      setDescMode(task.description ? 'preview' : 'edit')
      loadedTaskId.current = task.id
    }
  }, [task])

  const saveQuickNote = useCallback(
    (taskIdToSave: string, content: string): void => {
      const activeDraft = quickNoteDraftRef.current
      const isActiveDraft = activeDraft.taskId === taskIdToSave && activeDraft.content === content

      if (quickNoteSavedByTaskRef.current.get(taskIdToSave) === content) {
        if (isActiveDraft) {
          quickNoteDirtyRef.current = false
          setQuickNoteSaveState('saved')
        }
        return
      }

      if (quickNoteSavingByTaskRef.current.get(taskIdToSave) === content) {
        if (isActiveDraft) setQuickNoteSaveState('saving')
        return
      }

      const nextVersion = (quickNoteSaveVersionByTaskRef.current.get(taskIdToSave) ?? 0) + 1
      quickNoteSaveVersionByTaskRef.current.set(taskIdToSave, nextVersion)
      quickNoteSavingByTaskRef.current.set(taskIdToSave, content)
      if (isActiveDraft) setQuickNoteSaveState('saving')

      saveTaskQuickNote(
        { taskId: taskIdToSave, text: content },
        {
          onSuccess: (savedQuickNote) => {
            if (quickNoteSaveVersionByTaskRef.current.get(taskIdToSave) !== nextVersion) return

            const savedContent = savedQuickNote.text
            quickNoteSavingByTaskRef.current.delete(taskIdToSave)
            quickNoteSavedByTaskRef.current.set(taskIdToSave, savedContent)
            queryClient.setQueryData(taskQuickNoteKey(taskIdToSave), savedQuickNote)

            const latestDraft = quickNoteDraftRef.current
            if (latestDraft.taskId !== taskIdToSave) return

            if (latestDraft.content === savedContent) {
              quickNoteDirtyRef.current = false
              setQuickNoteSaveState('saved')
            } else {
              setQuickNoteSaveState('unsaved')
            }
          },
          onError: () => {
            if (quickNoteSaveVersionByTaskRef.current.get(taskIdToSave) !== nextVersion) return

            quickNoteSavingByTaskRef.current.delete(taskIdToSave)
            const latestDraft = quickNoteDraftRef.current
            if (latestDraft.taskId === taskIdToSave) {
              setQuickNoteSaveState(latestDraft.content === content ? 'error' : 'unsaved')
            }
          }
        }
      )
    },
    [queryClient, saveTaskQuickNote]
  )

  // Clear the editor immediately when the drawer moves to another task, then flush the old task's draft.
  useEffect(() => {
    const previousDraft = quickNoteDraftRef.current
    if (previousDraft.taskId === taskId) return

    if (quickNoteSaveTimerRef.current) {
      clearTimeout(quickNoteSaveTimerRef.current)
      quickNoteSaveTimerRef.current = null
    }
    if (previousDraft.taskId && quickNoteDirtyRef.current) {
      saveQuickNote(previousDraft.taskId, previousDraft.content)
    }

    quickNoteDraftRef.current = { taskId, content: '' }
    quickNoteDirtyRef.current = false
    setQuickNoteDraftTaskId(taskId)
    setQuickNoteDraft('')
    setQuickNoteSaveState(taskId ? 'loading' : 'saved')
  }, [taskId, saveQuickNote])

  // A late response for a previous task must never replace the active editor's content.
  useEffect(() => {
    if (!taskId || !quickNoteQuery.isSuccess || quickNoteDraftRef.current.taskId !== taskId) return
    if (quickNoteDirtyRef.current) return

    const content = quickNoteQuery.data?.text ?? ''
    quickNoteSavedByTaskRef.current.set(taskId, content)
    quickNoteDraftRef.current = { taskId, content }
    setQuickNoteDraftTaskId(taskId)
    setQuickNoteDraft(content)
    setQuickNoteSaveState('saved')
  }, [taskId, quickNoteQuery.data, quickNoteQuery.isSuccess])

  useEffect(() => {
    if (taskId && quickNoteQuery.isError && quickNoteDraftRef.current.taskId === taskId) {
      setQuickNoteSaveState('error')
    }
  }, [taskId, quickNoteQuery.isError])

  useEffect(() => {
    if (!taskId) return

    return window.api.task.onQuickNoteChanged((changedTaskId) => {
      if (changedTaskId !== taskId || quickNoteDirtyRef.current) return
      void queryClient.invalidateQueries({ queryKey: taskQuickNoteKey(changedTaskId) })
    })
  }, [queryClient, taskId])

  useEffect(() => {
    return () => {
      if (quickNoteSaveTimerRef.current) {
        clearTimeout(quickNoteSaveTimerRef.current)
        quickNoteSaveTimerRef.current = null
      }
      const pendingDraft = quickNoteDraftRef.current
      if (pendingDraft.taskId && quickNoteDirtyRef.current) {
        saveQuickNote(pendingDraft.taskId, pendingDraft.content)
      }
    }
  }, [saveQuickNote])

  const descHtml = useMemo(() => (descDraft ? renderMarkdown(descDraft) : ''), [descDraft])

  if (!taskId) return <Drawer open={false} onClose={onClose} children={null} />

  function commitTitle(): void {
    if (task && titleDraft.trim() && titleDraft !== task.title) {
      updateTask.mutate({ id: task.id, title: titleDraft.trim() })
    }
  }

  function commitDesc(): void {
    if (task && descDraft !== (task.description ?? '')) {
      updateTask.mutate({ id: task.id, description: descDraft || null })
    }
  }

  function changeQuickNote(content: string): void {
    if (!taskId || quickNoteDraftRef.current.taskId !== taskId) return

    quickNoteDraftRef.current = { taskId, content }
    quickNoteDirtyRef.current = true
    setQuickNoteDraftTaskId(taskId)
    setQuickNoteDraft(content)
    setQuickNoteSaveState('unsaved')

    if (quickNoteSaveTimerRef.current) clearTimeout(quickNoteSaveTimerRef.current)
    quickNoteSaveTimerRef.current = setTimeout(() => {
      quickNoteSaveTimerRef.current = null
      const pendingDraft = quickNoteDraftRef.current
      if (pendingDraft.taskId === taskId && pendingDraft.content === content) {
        saveQuickNote(taskId, content)
      }
    }, QUICK_NOTE_DEBOUNCE_MS)
  }

  function flushQuickNote(): void {
    if (quickNoteSaveTimerRef.current) {
      clearTimeout(quickNoteSaveTimerRef.current)
      quickNoteSaveTimerRef.current = null
    }
    const pendingDraft = quickNoteDraftRef.current
    if (pendingDraft.taskId && quickNoteDirtyRef.current) {
      saveQuickNote(pendingDraft.taskId, pendingDraft.content)
    }
  }

  function handleAddSubtask(): void {
    if (!task || !newSubtask.trim()) return
    createSubtask.mutate({ taskId: task.id, title: newSubtask.trim() }, { onSuccess: () => setNewSubtask('') })
  }

  function moveSubtask(index: number, dir: -1 | 1): void {
    if (!task) return
    const ids = task.subtasks.map((s) => s.id)
    const target = index + dir
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    reorderSubtasks.mutate({ taskId: task.id, orderedIds: ids })
  }

  function handleAddTag(): void {
    if (!task || !newTagName.trim()) return
    createTag.mutate(
      { name: newTagName.trim() },
      {
        onSuccess: (tag) => {
          const nextIds = [...task.tags.map((t) => t.id), tag.id]
          setTaskTags.mutate({ taskId: task.id, tagIds: [...new Set(nextIds)] })
          setNewTagName('')
        }
      }
    )
  }

  function toggleTag(tagId: string): void {
    if (!task) return
    const current = new Set(task.tags.map((t) => t.id))
    if (current.has(tagId)) current.delete(tagId)
    else current.add(tagId)
    setTaskTags.mutate({ taskId: task.id, tagIds: [...current] })
  }

  const doneCount = task?.subtasks.filter((s) => s.done).length ?? 0
  const totalCount = task?.subtasks.length ?? 0
  const availableTags = allTags?.filter((t) => !task?.tags.some((tt) => tt.id === t.id)) ?? []
  const quickNoteValue = quickNoteDraftTaskId === taskId ? quickNoteDraft : ''
  const quickNoteReady = quickNoteDraftTaskId === taskId && quickNoteQuery.isSuccess
  const quickNoteStatusText: Record<QuickNoteSaveState, string> = {
    loading: '正在加载',
    saved: '已保存',
    unsaved: '待保存',
    saving: '保存中…',
    error: '保存失败'
  }
  const quickNoteStatusClassName = [
    styles.quickNoteSaveState,
    quickNoteSaveState === 'error' && styles.quickNoteSaveStateError,
    quickNoteSaveState === 'unsaved' && styles.quickNoteSaveStatePending
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Drawer
      open={Boolean(taskId)}
      onClose={onClose}
      title={
        task ? (
          <Badge tone={TASK_STATUS_META[task.status].tone}>{TASK_STATUS_META[task.status].label}</Badge>
        ) : (
          '加载中...'
        )
      }
      headerExtra={
        task && (
          <>
            {task.status !== 'done' && task.status !== 'cancelled' && (
              <StartFocusButton taskId={task.id} label={task.title} />
            )}
            <IconButton
              danger
              onClick={() => {
                deleteTask.mutate(task.id)
                onClose()
              }}
              aria-label="删除任务"
            >
              <Trash2 size={16} />
            </IconButton>
          </>
        )
      }
    >
      {task && (
        <>
          <input
            className={styles.drawerTitleInput}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            placeholder="任务标题"
          />

          <div className={styles.block}>
            <div className={styles.metaGrid}>
              <Field label="状态">
                <SelectMenu<TaskStatus>
                  value={task.status}
                  onChange={(status) => updateTask.mutate({ id: task.id, status })}
                  options={TASK_STATUS_ORDER.map((s) => ({ value: s, label: TASK_STATUS_META[s].label }))}
                />
              </Field>
              <Field label="优先级">
                <SelectMenu<string>
                  value={String(task.priority)}
                  onChange={(p) => updateTask.mutate({ id: task.id, priority: Number(p) as Priority })}
                  options={[1, 2, 3].map((p) => ({ value: String(p), label: PRIORITY_META[p as Priority].label }))}
                />
              </Field>
              <Field label="截止日期">
                <TextField
                  type="date"
                  value={toDateInput(task.dueDate)}
                  onChange={(e) =>
                    updateTask.mutate({
                      id: task.id,
                      dueDate: e.target.value ? new Date(e.target.value).getTime() : null
                    })
                  }
                />
              </Field>
              <Field label="预估时长（分钟）">
                <TextField
                  type="number"
                  min={0}
                  value={task.estimateMinutes ?? ''}
                  onChange={(e) =>
                    updateTask.mutate({
                      id: task.id,
                      estimateMinutes: e.target.value ? Number(e.target.value) : null
                    })
                  }
                  placeholder="—"
                />
              </Field>
            </div>
            <Field label="分类" className={styles.block}>
              <SelectMenu<string>
                value={task.categoryId ?? ''}
                onChange={(id) => updateTask.mutate({ id: task.id, categoryId: id || null })}
                options={[
                  { value: '', label: '未分类' },
                  ...(categories?.map((c) => ({ value: c.id, label: c.name })) ?? [])
                ]}
              />
            </Field>
          </div>

          {/* 详情正文 Markdown */}
          <div className={styles.block}>
            <div className={styles.blockLabel}>
              <span>详情</span>
              <span className={styles.mdToggle}>
                <IconButton
                  size="sm"
                  onClick={() => setDescMode('edit')}
                  aria-label="编辑"
                  style={descMode === 'edit' ? { color: 'var(--color-accent)' } : undefined}
                >
                  <Pencil size={15} />
                </IconButton>
                <IconButton
                  size="sm"
                  onClick={() => {
                    commitDesc()
                    setDescMode('preview')
                  }}
                  aria-label="预览"
                  style={descMode === 'preview' ? { color: 'var(--color-accent)' } : undefined}
                >
                  <Eye size={15} />
                </IconButton>
              </span>
            </div>
            {descMode === 'edit' ? (
              <Textarea
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                onBlur={commitDesc}
                rows={6}
                placeholder="用 Markdown 写下任务的背景、要求、清单..."
              />
            ) : descDraft ? (
              <div className={styles.markdownPreview} dangerouslySetInnerHTML={{ __html: descHtml }} />
            ) : (
              <div className={`${styles.markdownPreview} ${styles.mutedPreview}`}>暂无详情，点击编辑添加。</div>
            )}
          </div>

          {/* 随心记 */}
          <div className={styles.block}>
            <div className={styles.blockLabel}>
              <span className={styles.quickNoteHeading}>
                <StickyNote size={15} /> 随心记
              </span>
              <span className={quickNoteStatusClassName} aria-live="polite">
                {quickNoteStatusText[quickNoteSaveState]}
              </span>
            </div>
            {quickNoteQuery.isError ? (
              <div className={styles.quickNoteError} role="status">
                <span>无法读取这条任务的随心记。</span>
                <Button size="sm" variant="ghost" onClick={() => void quickNoteQuery.refetch()}>
                  重试
                </Button>
              </div>
            ) : (
              <Textarea
                className={styles.quickNoteArea}
                value={quickNoteValue}
                onChange={(event) => changeQuickNote(event.target.value)}
                onBlur={flushQuickNote}
                rows={5}
                disabled={!quickNoteReady}
                placeholder="记录此任务的灵感、进展或临时想法…"
                aria-label="任务随心记"
              />
            )}
            <p className={styles.quickNoteHint}>与悬浮窗随心记同步，停止输入后会自动保存。</p>
          </div>

          {/* 子任务清单 */}
          <div className={styles.block}>
            <div className={styles.progressHeader}>
              <span className={styles.progressCount}>
                步骤 {doneCount}/{totalCount}
              </span>
              <ProgressBar value={doneCount} max={totalCount || 1} />
            </div>
            <div className={styles.subtaskList}>
              {task.subtasks.map((sub, index) => (
                <div key={sub.id} className={styles.subtaskRow}>
                  <Checkbox
                    size="sm"
                    checked={sub.done}
                    onChange={(done) => updateSubtask.mutate({ id: sub.id, done })}
                  />
                  <span className={[styles.subtaskTitle, sub.done && styles.subtaskDone].filter(Boolean).join(' ')}>
                    {sub.title}
                  </span>
                  <span className={styles.subtaskReorder}>
                    <button
                      className={styles.reorderBtn}
                      onClick={() => moveSubtask(index, -1)}
                      disabled={index === 0}
                      aria-label="上移"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      className={styles.reorderBtn}
                      onClick={() => moveSubtask(index, 1)}
                      disabled={index === task.subtasks.length - 1}
                      aria-label="下移"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </span>
                  <IconButton size="sm" danger onClick={() => deleteSubtask.mutate(sub.id)} aria-label="删除步骤">
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              ))}
            </div>
            <div className={styles.addSubtaskRow}>
              <TextField
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                placeholder="添加一个步骤..."
              />
              <Button icon={<Plus size={16} />} onClick={handleAddSubtask}>
                添加
              </Button>
            </div>
          </div>

          {/* 标签 */}
          <div className={styles.block}>
            <div className={styles.blockLabel}>
              <span>标签</span>
            </div>
            <div className={styles.tagArea}>
              {task.tags.map((tag) => (
                <TagChip key={tag.id} label={tag.name} color={tag.color} onRemove={() => toggleTag(tag.id)} />
              ))}
              {availableTags.map((tag) => (
                <TagChip key={tag.id} label={tag.name} color={tag.color} onClick={() => toggleTag(tag.id)} />
              ))}
            </div>
            <div className={styles.newTagRow}>
              <TextField
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                placeholder="新建标签..."
              />
              <Button icon={<TagIcon size={15} />} onClick={handleAddTag}>
                新建
              </Button>
            </div>
          </div>

          {/* AI 拆解步骤 */}
          <div className={styles.block}>
            <div className={styles.blockLabel}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} color="var(--color-accent)" /> AI 拆解
              </span>
              <Button size="sm" variant="ghost" onClick={() => setAiOpen((o) => !o)}>
                {aiOpen ? '收起' : '展开对话'}
              </Button>
            </div>
            {aiOpen && (
              <div className={styles.aiChat}>
                <ChatPanel
                  scope="task"
                  taskId={task.id}
                  placeholder="让 AI 帮你拆解步骤，如「把这个任务拆成可执行的步骤」"
                  emptyHint="让 AI 帮你把这个任务拆解成有序步骤，确认后自动加入上面的步骤清单。"
                />
              </div>
            )}
          </div>
        </>
      )}
    </Drawer>
  )
}
