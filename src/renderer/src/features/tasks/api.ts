import type {
  CreateSubtaskInput,
  CreateTagInput,
  CreateTaskInput,
  ReorderSubtasksInput,
  SetTaskTagsInput,
  UpdateSubtaskInput,
  UpdateTaskInput
} from '@shared/types/ipc'

export const taskApi = {
  list: () => window.api.task.list(),
  get: (id: string) => window.api.task.get(id),
  create: (input: CreateTaskInput) => window.api.task.create(input),
  update: (input: UpdateTaskInput) => window.api.task.update(input),
  delete: (id: string) => window.api.task.delete(id),
  setTags: (input: SetTaskTagsInput) => window.api.task.setTags(input)
}

export const subtaskApi = {
  create: (input: CreateSubtaskInput) => window.api.subtask.create(input),
  update: (input: UpdateSubtaskInput) => window.api.subtask.update(input),
  delete: (id: string) => window.api.subtask.delete(id),
  reorder: (input: ReorderSubtasksInput) => window.api.subtask.reorder(input)
}

export const tagApi = {
  list: () => window.api.tag.list(),
  create: (input: CreateTagInput) => window.api.tag.create(input),
  delete: (id: string) => window.api.tag.delete(id)
}
