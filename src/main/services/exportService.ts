import { app, BrowserWindow } from 'electron'
import { writeFile } from 'fs/promises'
import { marked } from 'marked'
import type { Report } from '@shared/types/models'

const REPORT_TYPE_LABEL: Record<Report['type'], string> = {
  daily: '日报',
  weekly: '周报',
  adhoc: '按需报告'
}

export function buildReportMarkdown(report: Report): string {
  const period = `${new Date(report.periodStart).toLocaleDateString()} - ${new Date(report.periodEnd).toLocaleDateString()}`
  const parts = [
    `# ${REPORT_TYPE_LABEL[report.type]}（${period}）`,
    '',
    '## 自我心得',
    '',
    report.selfReflection?.trim() || '（未填写）',
    '',
    '## AI 总结',
    '',
    report.aiSummary?.trim() || '（尚未生成）'
  ]
  return parts.join('\n')
}

export async function exportReportAsMarkdown(report: Report, filePath: string): Promise<void> {
  await writeFile(filePath, buildReportMarkdown(report), 'utf-8')
}

export async function exportReportAsPDF(report: Report, filePath: string): Promise<void> {
  const markdown = buildReportMarkdown(report)
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body { font-family: -apple-system, 'Segoe UI', sans-serif; padding: 40px; line-height: 1.6; }
h1 { font-size: 22px; } h2 { font-size: 18px; margin-top: 24px; }
</style></head><body>${await marked(markdown)}</body></html>`

  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } })
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    const pdfBuffer = await win.webContents.printToPDF({})
    await writeFile(filePath, pdfBuffer)
  } finally {
    win.destroy()
  }
}

export function suggestExportFileName(report: Report, extension: 'md' | 'pdf'): string {
  const dateStr = new Date(report.periodStart).toISOString().slice(0, 10)
  return `${REPORT_TYPE_LABEL[report.type]}-${dateStr}.${extension}`
}

export function getDefaultExportDir(): string {
  return app.getPath('documents')
}
