import { ipcMain, dialog } from 'electron'
import { z } from 'zod'
import { IPC } from '@shared/types/ipc'
import { deleteReport, getReport, listReports, updateReportSelfReflection } from '../db/repositories/reportRepo'
import { generateReport } from '../services/reportGenerator'
import { exportReportAsMarkdown, exportReportAsPDF, getDefaultExportDir, suggestExportFileName } from '../services/exportService'
import { generateReportSchema, updateReportReflectionSchema, exportReportSchema } from './schemas'
import path from 'path'

export function registerReportHandlers(): void {
  ipcMain.handle(IPC.reportGenerate, async (_event, input) => generateReport(generateReportSchema.parse(input)))

  ipcMain.handle(IPC.reportList, () => listReports())

  ipcMain.handle(IPC.reportGet, (_event, id) => getReport(z.string().min(1).parse(id)))

  ipcMain.handle(IPC.reportUpdateReflection, (_event, input) => {
    const parsed = updateReportReflectionSchema.parse(input)
    return updateReportSelfReflection(parsed.id, parsed.selfReflection)
  })

  ipcMain.handle(IPC.reportExport, async (_event, input) => {
    const parsed = exportReportSchema.parse(input)
    const report = getReport(parsed.id)
    if (!report) {
      throw new Error('未找到该报告')
    }

    const fileName = suggestExportFileName(report, parsed.format)
    const defaultPath = path.join(getDefaultExportDir(), fileName)

    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath,
      filters:
        parsed.format === 'md'
          ? [{ name: 'Markdown', extensions: ['md'] }]
          : [{ name: 'PDF', extensions: ['pdf'] }]
    })

    if (canceled || !filePath) {
      throw new Error('用户取消了导出')
    }

    if (parsed.format === 'md') {
      await exportReportAsMarkdown(report, filePath)
    } else {
      await exportReportAsPDF(report, filePath)
    }

    return { filePath }
  })

  ipcMain.handle(IPC.reportDelete, (_event, id) => deleteReport(z.string().min(1).parse(id)))
}
