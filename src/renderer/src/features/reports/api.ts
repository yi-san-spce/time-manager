import type { ExportReportInput, GenerateReportInput, UpdateReportReflectionInput } from '@shared/types/ipc'

export const reportApi = {
  generate: (input: GenerateReportInput) => window.api.report.generate(input),
  list: () => window.api.report.list(),
  get: (id: string) => window.api.report.get(id),
  updateReflection: (input: UpdateReportReflectionInput) => window.api.report.updateReflection(input),
  export: (input: ExportReportInput) => window.api.report.export(input),
  delete: (id: string) => window.api.report.delete(id)
}
