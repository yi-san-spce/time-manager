import type {
  CreateScheduleInput,
  ExpandRecurrenceInput,
  SetScheduleExceptionInput,
  UpdateScheduleInput
} from '@shared/types/ipc'

export const scheduleApi = {
  list: () => window.api.schedule.list(),
  create: (input: CreateScheduleInput) => window.api.schedule.create(input),
  update: (input: UpdateScheduleInput) => window.api.schedule.update(input),
  delete: (id: string) => window.api.schedule.delete(id)
}

export const recurrenceApi = {
  expand: (input: ExpandRecurrenceInput) => window.api.recurrence.expand(input),
  setException: (input: SetScheduleExceptionInput) => window.api.recurrence.setException(input)
}
