import type {
  CreateManualTimeEntryInput,
  LinkTimeEntryToTaskInput,
  ListTimeEntriesInput,
  MergeTimeEntriesInput,
  TrackingConfig,
  UpdateTimeEntryInput
} from '@shared/types/ipc'

export const timeEntryApi = {
  list: (input: ListTimeEntriesInput) => window.api.timeEntry.list(input),
  createManual: (input: CreateManualTimeEntryInput) => window.api.timeEntry.createManual(input),
  update: (input: UpdateTimeEntryInput) => window.api.timeEntry.update(input),
  merge: (input: MergeTimeEntriesInput) => window.api.timeEntry.merge(input),
  linkToTask: (input: LinkTimeEntryToTaskInput) => window.api.timeEntry.linkToTask(input),
  delete: (id: string) => window.api.timeEntry.delete(id)
}

export const trackingConfigApi = {
  get: () => window.api.tracking.getConfig(),
  set: (input: TrackingConfig) => window.api.tracking.setConfig(input)
}
