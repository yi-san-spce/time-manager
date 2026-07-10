import { useEffect, useMemo, useState } from 'react'
import { Sparkles, Clock, Globe, ExternalLink } from 'lucide-react'
import { Drawer, Button, Textarea, GlassSurface, IconButton } from '../../design-system'
import { renderMarkdown } from '../../design-system/markdown'
import {
  useActivityDetail,
  useActivityNote,
  useSaveActivityNote,
  useSummarizeActivity
} from './useActivityDetail'
import styles from './ActivityDetailDrawer.module.css'

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}分钟`
  return `${Math.floor(minutes / 60)}小时${minutes % 60}分钟`
}

export interface ActivityDetailDrawerProps {
  appName: string | null
  range: { rangeStart: number; rangeEnd: number }
  onClose: () => void
}

/**
 * 追踪"总—分"里的"分"：点开某应用，看它何时运行、访问了哪些网站/窗口及各自时长，
 * 写自己的笔记/收获，一键让 AI 根据访问的网页地址总结（需求4）。
 */
export function ActivityDetailDrawer({ appName, range, onClose }: ActivityDetailDrawerProps): React.JSX.Element {
  const detailInput = appName ? { appName, rangeStart: range.rangeStart, rangeEnd: range.rangeEnd } : null
  const { data: detail } = useActivityDetail(detailInput)
  const { data: noteData } = useActivityNote(appName)
  const saveNote = useSaveActivityNote()
  const summarize = useSummarizeActivity()

  const [noteDraft, setNoteDraft] = useState('')
  const [summaryError, setSummaryError] = useState('')
  const [openHostError, setOpenHostError] = useState('')
  const loadedKey = useMemo(() => appName, [appName])

  // 切换应用时载入其已存笔记
  useEffect(() => {
    setNoteDraft(noteData?.note ?? '')
    setSummaryError('')
    setOpenHostError('')
  }, [noteData, loadedKey])

  function commitNote(): void {
    if (!appName) return
    if (noteDraft !== (noteData?.note ?? '')) {
      saveNote.mutate({ scopeKey: appName, note: noteDraft || null })
    }
  }

  function handleSummarize(): void {
    if (!appName) return
    setSummaryError('')
    summarize.mutate(
      { appName, rangeStart: range.rangeStart, rangeEnd: range.rangeEnd },
      { onError: (e) => setSummaryError(e instanceof Error ? e.message : String(e)) }
    )
  }

  function handleOpenHost(host: string): void {
    setOpenHostError('')
    void window.api.activity.openHost(host).catch((error: unknown) => {
      setOpenHostError(error instanceof Error ? error.message : '无法打开该网站。')
    })
  }

  const aiSummary = summarize.data ?? noteData?.aiSummary ?? null
  const summaryHtml = useMemo(() => (aiSummary ? renderMarkdown(aiSummary) : ''), [aiSummary])
  const maxMinutes = detail?.targets[0]?.minutes || 1

  return (
    <Drawer open={Boolean(appName)} onClose={onClose} title={appName ?? '活动详情'}>
      {detail && (
        <div className={styles.wrap}>
          <div className={styles.totalRow}>
            <Clock size={16} />
            <span>本时段共 {formatDuration(detail.totalMinutes)}，{detail.segments.length} 个片段</span>
          </div>

          {/* 访问的网站/窗口 + 各自时长 */}
          <div className={styles.block}>
            <div className={styles.blockLabel}>
              <Globe size={14} /> 访问的网站 / 窗口
            </div>
            <div className={styles.targetList}>
              {detail.targets.map((t) => (
                <div key={t.key} className={styles.targetRow}>
                  <div
                    className={styles.targetBar}
                    style={{ width: `${Math.round((t.minutes / maxMinutes) * 100)}%` }}
                  />
                  <span className={styles.targetName} title={t.key}>
                    {t.key}
                  </span>
                  <div className={styles.targetActions}>
                    {t.openHost && (
                      <IconButton
                        onClick={() => handleOpenHost(t.openHost as string)}
                        aria-label={`在浏览器中打开 ${t.openHost}`}
                        title={`打开 ${t.openHost}`}
                      >
                        <ExternalLink size={15} />
                      </IconButton>
                    )}
                    <span className={styles.targetValue}>{formatDuration(t.minutes)}</span>
                  </div>
                </div>
              ))}
            </div>
            {openHostError && <div className={styles.summaryError}>{openHostError}</div>}
          </div>

          {/* 用户笔记 */}
          <div className={styles.block}>
            <div className={styles.blockLabel}>我在这段时间做了什么 / 收获</div>
            <Textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onBlur={commitNote}
              rows={4}
              placeholder="写下你在这个应用里具体做了什么、有什么收获..."
            />
          </div>

          {/* AI 总结 */}
          <div className={styles.block}>
            <div className={styles.blockLabel}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} color="var(--stage-review)" /> AI 总结
              </span>
              <Button
                size="sm"
                variant="primary"
                icon={<Sparkles size={14} />}
                onClick={handleSummarize}
                disabled={summarize.isPending}
              >
                {summarize.isPending ? '总结中...' : '一键总结'}
              </Button>
            </div>
            {summaryError && <div className={styles.summaryError}>{summaryError}</div>}
            {aiSummary ? (
              <GlassSurface radius="md" className={styles.summaryBox}>
                <div dangerouslySetInnerHTML={{ __html: summaryHtml }} />
              </GlassSurface>
            ) : (
              !summarize.isPending && (
                <div className={styles.summaryHint}>
                  点击"一键总结"，AI 会根据你访问的网页/窗口和笔记归纳这段时间做了什么。
                </div>
              )
            )}
          </div>
        </div>
      )}
    </Drawer>
  )
}
