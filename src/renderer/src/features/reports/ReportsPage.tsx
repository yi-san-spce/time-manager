import { useMemo, useState } from 'react'
import { FileDown, FileText, Trash2, Sparkles } from 'lucide-react'
import { GlassSurface, Button, IconButton, Segmented, Textarea, Badge, TextField, Field } from '../../design-system'
import { PageHeader } from '../../shell/PageHeader'
import { renderMarkdown } from '../../design-system/markdown'
import {
  useDeleteReport,
  useExportReport,
  useGenerateReport,
  useReports,
  useUpdateReportReflection
} from './useReports'
import type { ReportKind } from '@shared/types/models'
import reportStyles from './ReportsPage.module.css'

function startOfDay(base: number): number {
  const d = new Date(base)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function endOfDay(base: number): number {
  const d = new Date(base)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

function startOfWeek(base: number): number {
  const d = new Date(base)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return startOfDay(d.getTime())
}

function toDateInput(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const KIND_LABEL: Record<ReportKind, string> = { daily: '日报', weekly: '周报', adhoc: '按需报告' }

export function ReportsPage(): React.JSX.Element {
  const { data: reports, isLoading } = useReports()
  const generateReport = useGenerateReport()
  const updateReflection = useUpdateReportReflection()
  const exportReport = useExportReport()
  const deleteReport = useDeleteReport()

  const [reportType, setReportType] = useState<ReportKind>('daily')
  const [reflectionDrafts, setReflectionDrafts] = useState<Record<string, string>>({})
  const [exportStatus, setExportStatus] = useState<string>('')
  // 按需报告的自定义区间，默认最近 7 天
  const [adhocStart, setAdhocStart] = useState<string>(() => toDateInput(Date.now() - 6 * 86400000))
  const [adhocEnd, setAdhocEnd] = useState<string>(() => toDateInput(Date.now()))
  const [adhocError, setAdhocError] = useState<string>('')

  function handleGenerate(): void {
    const now = Date.now()
    if (reportType === 'adhoc') {
      if (!adhocStart || !adhocEnd) {
        setAdhocError('请选择开始和结束日期')
        return
      }
      const periodStart = startOfDay(new Date(adhocStart).getTime())
      const periodEnd = endOfDay(new Date(adhocEnd).getTime())
      if (periodStart > periodEnd) {
        setAdhocError('开始日期不能晚于结束日期')
        return
      }
      setAdhocError('')
      generateReport.mutate({ type: 'adhoc', periodStart, periodEnd })
      return
    }
    const periodStart = reportType === 'weekly' ? startOfWeek(now) : startOfDay(now)
    const periodEnd = endOfDay(now)
    generateReport.mutate({ type: reportType, periodStart, periodEnd })
  }

  function handleSaveReflection(reportId: string): void {
    const text = reflectionDrafts[reportId]
    if (text === undefined) return
    updateReflection.mutate({ id: reportId, selfReflection: text })
  }

  async function handleExport(reportId: string, format: 'md' | 'pdf'): Promise<void> {
    setExportStatus('导出中...')
    try {
      const result = await exportReport.mutateAsync({ id: reportId, format })
      setExportStatus(`已导出到 ${result.filePath}`)
    } catch (error) {
      setExportStatus(`导出失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <PageHeader
        title="报告"
        subtitle="复盘与总结"
        actions={
          <>
            <Segmented
              value={reportType}
              onChange={setReportType}
              options={[
                { value: 'daily', label: '日报' },
                { value: 'weekly', label: '周报' },
                { value: 'adhoc', label: '按需' }
              ]}
            />
            <Button variant="primary" icon={<Sparkles size={16} />} onClick={handleGenerate} disabled={generateReport.isPending}>
              {generateReport.isPending ? '生成中...' : '生成报告'}
            </Button>
          </>
        }
      />

      {reportType === 'adhoc' && (
        <GlassSurface radius="md" className={reportStyles.adhocRange}>
          <Field label="开始日期">
            <TextField
              type="date"
              value={adhocStart}
              max={adhocEnd || undefined}
              onChange={(e) => {
                setAdhocStart(e.target.value)
                setAdhocError('')
              }}
            />
          </Field>
          <Field label="结束日期">
            <TextField
              type="date"
              value={adhocEnd}
              min={adhocStart || undefined}
              onChange={(e) => {
                setAdhocEnd(e.target.value)
                setAdhocError('')
              }}
            />
          </Field>
          {adhocError && <span className={reportStyles.adhocError}>{adhocError}</span>}
        </GlassSurface>
      )}

      {exportStatus && <p className={reportStyles.statusText}>{exportStatus}</p>}

      {generateReport.isError && (
        <GlassSurface radius="md" style={{ padding: '12px 16px', color: 'var(--color-danger)' }}>
          生成失败：{generateReport.error instanceof Error ? generateReport.error.message : '未知错误'}
        </GlassSurface>
      )}

      {isLoading && <p style={{ color: 'var(--color-text-muted)' }}>加载中...</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {reports?.map((report) => (
          <GlassSurface key={report.id} radius="lg" className={reportStyles.reportCard}>
            <div className={reportStyles.reportHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <Badge tone="warning">{KIND_LABEL[report.type]}</Badge>
                <h3 className={reportStyles.reportTitle}>{new Date(report.periodStart).toLocaleDateString()}</h3>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button size="sm" icon={<FileText size={15} />} onClick={() => handleExport(report.id, 'md')}>
                  Markdown
                </Button>
                <Button size="sm" icon={<FileDown size={15} />} onClick={() => handleExport(report.id, 'pdf')}>
                  PDF
                </Button>
                <IconButton danger onClick={() => deleteReport.mutate(report.id)} aria-label="删除报告">
                  <Trash2 size={16} />
                </IconButton>
              </div>
            </div>

            <div className={reportStyles.section}>
              <label className={reportStyles.sectionLabel}>自我心得</label>
              <Textarea
                value={reflectionDrafts[report.id] ?? report.selfReflection ?? ''}
                onChange={(e) => setReflectionDrafts((prev) => ({ ...prev, [report.id]: e.target.value }))}
                onBlur={() => handleSaveReflection(report.id)}
                rows={3}
                placeholder="写下你今天/这周的收获或反思..."
              />
            </div>

            <div className={reportStyles.section}>
              <label className={reportStyles.sectionLabel}>
                <Sparkles size={14} color="var(--stage-review)" /> AI 总结
              </label>
              <ReportSummary summary={report.aiSummary} />
            </div>
          </GlassSurface>
        ))}
      </div>

      {reports?.length === 0 && !isLoading && (
        <p style={{ color: 'var(--color-text-muted)' }}>暂无报告，点击"生成报告"开始。</p>
      )}
    </section>
  )
}

/** AI 总结区：把 markdown 渲染成 HTML（复用 design-system 的 renderMarkdown）。 */
function ReportSummary({ summary }: { summary: string | null }): React.JSX.Element {
  const html = useMemo(() => (summary ? renderMarkdown(summary) : ''), [summary])
  if (!summary) {
    return <div className={reportStyles.aiSummary}>（尚未生成）</div>
  }
  return <div className={reportStyles.aiSummary} dangerouslySetInnerHTML={{ __html: html }} />
}
