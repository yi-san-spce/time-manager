import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type {
  CreateSubtaskInput,
  CreateTagInput,
  CreateTaskInput,
  ReorderSubtasksInput,
  SetTaskQuickNoteInput,
  SetTaskTagsInput,
  UpdateSubtaskInput,
  UpdateTaskInput
} from '@shared/types/ipc'
import type { Subtask, Tag, Task, TaskDetail, TaskListItem, TaskQuickNote } from '@shared/types/models'
import { subtaskApi, tagApi, taskApi } from './api'

const TASKS_KEY = ['tasks']
const TAGS_KEY = ['tags']
const taskDetailKey = (id: string): (string | undefined)[] => ['task', id]
export const taskQuickNoteKey = (id: string) => ['task', id, 'quick-note'] as const

export function useTasks(): UseQueryResult<TaskListItem[]> {
  return useQuery({ queryKey: TASKS_KEY, queryFn: taskApi.list })
}

export function useTaskDetail(id: string | null): UseQueryResult<TaskDetail | null> {
  return useQuery({
    queryKey: taskDetailKey(id ?? ''),
    queryFn: () => (id ? taskApi.get(id) : Promise.resolve(null)),
    enabled: id !== null
  })
}

/** A free-form task note that is independent from its Markdown description. */
export function useTaskQuickNote(id: string | null): UseQueryResult<TaskQuickNote | null> {
  return useQuery({
    queryKey: taskQuickNoteKey(id ?? ''),
    queryFn: () => (id ? taskApi.getQuickNote(id) : Promise.resolve(null)),
    enabled: id !== null
  })
}

/** Saving is intentionally cache-neutral; the editor commits the newest response itself. */
export function useSetTaskQuickNote(): UseMutationResult<TaskQuickNote, Error, SetTaskQuickNoteInput> {
  return useMutation({ mutationFn: (input: SetTaskQuickNoteInput) => taskApi.setQuickNote(input) })
}

export function useCreateTask(): UseMutationResult<Task, Error, CreateTaskInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTaskInput) => taskApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY })
  })
}

export function useUpdateTask(): UseMutationResult<Task, Error, UpdateTaskInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateTaskInput) => taskApi.update(input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: TASKS_KEY })
      void queryClient.invalidateQueries({ queryKey: taskDetailKey(variables.id) })
    }
  })
}

export function useDeleteTask(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => taskApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY })
  })
}

function useTaskRefresh(): (taskId: string) => void {
  const queryClient = useQueryClient()
  return (taskId: string) => {
    void queryClient.invalidateQueries({ queryKey: taskDetailKey(taskId) })
    void queryClient.invalidateQueries({ queryKey: TASKS_KEY })
  }
}

export function useCreateSubtask(): UseMutationResult<Subtask, Error, CreateSubtaskInput> {
  const refresh = useTaskRefresh()
  return useMutation({
    mutationFn: (input: CreateSubtaskInput) => subtaskApi.create(input),
    onSuccess: (subtask) => refresh(subtask.taskId)
  })
}

export function useUpdateSubtask(taskId: string): UseMutationResult<Subtask, Error, UpdateSubtaskInput> {
  const refresh = useTaskRefresh()
  return useMutation({
    mutationFn: (input: UpdateSubtaskInput) => subtaskApi.update(input),
    onSuccess: () => refresh(taskId)
  })
}

export function useDeleteSubtask(taskId: string): UseMutationResult<void, Error, string> {
  const refresh = useTaskRefresh()
  return useMutation({
    mutationFn: (id: string) => subtaskApi.delete(id),
    onSuccess: () => refresh(taskId)
  })
}

export function useReorderSubtasks(): UseMutationResult<Subtask[], Error, ReorderSubtasksInput> {
  const refresh = useTaskRefresh()
  return useMutation({
    mutationFn: (input: ReorderSubtasksInput) => subtaskApi.reorder(input),
    onSuccess: (_data, variables) => refresh(variables.taskId)
  })
}

export function useSetTaskTags(): UseMutationResult<TaskDetail, Error, SetTaskTagsInput> {
  const refresh = useTaskRefresh()
  return useMutation({
    mutationFn: (input: SetTaskTagsInput) => taskApi.setTags(input),
    onSuccess: (_data, variables) => refresh(variables.taskId)
  })
}

export function useTags(): UseQueryResult<Tag[]> {
  return useQuery({ queryKey: TAGS_KEY, queryFn: tagApi.list })
}

export function useCreateTag(): UseMutationResult<Tag, Error, CreateTagInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTagInput) => tagApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TAGS_KEY })
  })
}
