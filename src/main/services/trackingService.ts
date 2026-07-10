import { powerMonitor } from 'electron'
import { createAutoTimeEntry } from '../db/repositories/timeEntryRepo'
import type { TimeEntry } from '@shared/types/models'
import type { TrackingConfig } from '@shared/types/ipc'
import { applySample, flush, type AggregatorState, type WindowSample } from './segmentAggregator'

type ActiveWindowFn = () => Promise<{ title: string; owner: { name: string } } | undefined>

/**
 * 同一窗口持续活跃超过这个时长就提交一次并续开新段，
 * 否则长时间只用一个窗口时永远不会有数据落盘（用户看到的追踪时间线会一直是空的）。
 */
const MAX_SEGMENT_MS = 5 * 60 * 1000

/** 已知浏览器进程名（小写、去扩展名匹配），只有这些进程才尝试从标题解析站点。 */
const BROWSER_PROCESSES = ['chrome', 'msedge', 'edge', 'firefox', 'brave', 'opera', 'vivaldi', 'safari']

function isBrowser(appName: string | null): boolean {
  if (!appName) return false
  const name = appName.toLowerCase().replace(/\.exe$/, '')
  return BROWSER_PROCESSES.some((b) => name === b || name.includes(b))
}

/**
 * 从浏览器窗口标题启发式提取"站点标签"。get-windows 拿不到真实 URL，
 * 浏览器标题通常形如「页面标题 - 网站名 - Chrome」，取倒数第二段作为站点名。
 * 纯本地、无权限、粗粒度——够用于 Top 域名统计，但不是精确 URL。
 */
export function parseDomainFromTitle(title: string | null): string | null {
  if (!title) return null
  const parts = title.split(/\s[-–—|]\s/).map((s) => s.trim()).filter(Boolean)
  if (parts.length < 2) return null
  // 最后一段一般是浏览器名（Google Chrome / Mozilla Firefox…），取其前一段作为站点标签。
  const site = parts[parts.length - 2]
  if (!site || site.length > 40) return null
  return site
}

export class TrackingService {
  private timer: NodeJS.Timeout | null = null
  private state: AggregatorState = { currentSegment: null }
  private config: TrackingConfig
  private readonly getActiveWindow: ActiveWindowFn
  private readonly onEntryCreated: (entry: TimeEntry) => void

  constructor(
    config: TrackingConfig,
    getActiveWindow: ActiveWindowFn,
    onEntryCreated: (entry: TimeEntry) => void
  ) {
    this.config = config
    this.getActiveWindow = getActiveWindow
    this.onEntryCreated = onEntryCreated

    powerMonitor.on('suspend', () => this.flushNow())
    powerMonitor.on('lock-screen', () => this.flushNow())
  }

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => void this.sample(), this.config.intervalSeconds * 1000)
    void this.sample()
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.flushNow()
  }

  updateConfig(config: TrackingConfig): void {
    this.config = config
    if (this.timer) {
      this.stop()
      this.start()
    }
  }

  private async sample(): Promise<void> {
    let result: { title: string; owner: { name: string } } | undefined
    try {
      result = await this.getActiveWindow()
    } catch {
      return
    }

    const sample: WindowSample = result
      ? {
          appName: result.owner.name,
          windowTitle: result.title,
          domain: isBrowser(result.owner.name) ? parseDomainFromTitle(result.title) : null
        }
      : { appName: null, windowTitle: null, domain: null }

    const { nextState, closedSegment } = applySample(this.state, sample, Date.now(), {
      minSegmentSeconds: this.config.minSegmentSeconds,
      maxSegmentMs: MAX_SEGMENT_MS
    })

    this.state = nextState

    if (closedSegment) {
      const entry = createAutoTimeEntry({
        startTime: closedSegment.startTime,
        endTime: closedSegment.endTime,
        appName: closedSegment.appName,
        windowTitle: closedSegment.windowTitle,
        domain: closedSegment.domain ?? null
      })
      this.onEntryCreated(entry)
    }
  }

  private flushNow(): void {
    const { nextState, closedSegment } = flush(this.state, Date.now(), this.config.minSegmentSeconds)
    this.state = nextState

    if (closedSegment) {
      const entry = createAutoTimeEntry({
        startTime: closedSegment.startTime,
        endTime: closedSegment.endTime,
        appName: closedSegment.appName,
        windowTitle: closedSegment.windowTitle,
        domain: closedSegment.domain ?? null
      })
      this.onEntryCreated(entry)
    }
  }
}
