import { useMemo, useState } from 'react'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from 'recharts'
import { Clock, CheckCircle2 } from 'lucide-react'
import { GlassSurface, Segmented } from '../../design-system'
import { PageHeader } from '../../shell/PageHeader'
import { useStats } from './useStats'
import { useTimeStats } from './useTimeStats'
import type { TimeStatBucket } from '@shared/types/models'
import statsStyles from './StatsPage.module.css'

type RangeMode = 'day' | 'week' | 'month'

const FALLBACK_COLORS = ['#4a7dff', '#f5a623', '#2fd6c4', '#f03b8d', '#a63bf0', '#e8b64c', '#3bf05e']

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

function startOfMonth(base: number): number {
  const d = new Date(base)
  d.setDate(1)
  return startOfDay(d.getTime())
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}分钟`
  return `${Math.floor(minutes / 60)}小时${minutes % 60}分钟`
}

export function StatsPage(): React.JSX.Element {
  const [rangeMode, setRangeMode] = useState<RangeMode>('day')

  const range = useMemo(() => {
    const now = Date.now()
    if (rangeMode === 'day') {
      return { rangeStart: startOfDay(now), rangeEnd: endOfDay(now) }
    }
    if (rangeMode === 'month') {
      return { rangeStart: startOfMonth(now), rangeEnd: endOfDay(now) }
    }
    return { rangeStart: startOfWeek(now), rangeEnd: endOfDay(now) }
  }, [rangeMode])

  const { data, isLoading } = useStats(range)
  const { data: timeStats } = useTimeStats(range)

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <PageHeader
        title="统计"
        subtitle="时间都去哪儿了"
        actions={
          <Segmented
            value={rangeMode}
            onChange={setRangeMode}
            options={[
              { value: 'day', label: '今日' },
              { value: 'week', label: '本周' },
              { value: 'month', label: '本月' }
            ]}
          />
        }
      />

      {isLoading && <p style={{ color: 'var(--color-text-muted)' }}>加载中...</p>}

      {data && (
        <div className={statsStyles.grid}>
          <GlassSurface radius="lg" interactive className={statsStyles.statCard}>
            <div className={statsStyles.statIcon} data-tone="track">
              <Clock size={22} />
            </div>
            <div>
              <div className={statsStyles.statLabel}>追踪总时长</div>
              <div className={statsStyles.statValue}>{formatMinutes(data.totalMinutes)}</div>
            </div>
          </GlassSurface>

          <GlassSurface radius="lg" interactive className={statsStyles.statCard}>
            <div className={statsStyles.statIcon} data-tone="success">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <div className={statsStyles.statLabel}>任务完成率</div>
              <div className={statsStyles.statValue}>{data.completionRate}%</div>
              <div className={statsStyles.statHint}>
                {data.completedTaskCount} / {data.totalTaskCount} 已完成
              </div>
            </div>
          </GlassSurface>

          <GlassSurface radius="lg" className={statsStyles.chartCard}>
            <h3 className={statsStyles.chartTitle}>分类耗时分布</h3>
            {data.categoryBreakdown.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)' }}>暂无数据。</p>
            ) : (
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.categoryBreakdown}
                      dataKey="totalMinutes"
                      nameKey="categoryName"
                      innerRadius={62}
                      outerRadius={104}
                      paddingAngle={2}
                    >
                      {data.categoryBreakdown.map((item, index) => (
                        <Cell
                          key={item.categoryId ?? 'unassigned'}
                          fill={item.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]}
                          stroke="transparent"
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatMinutes(Number(value))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </GlassSurface>

          <GlassSurface radius="lg" className={statsStyles.chartCard}>
            <h3 className={statsStyles.chartTitle}>分类耗时对比</h3>
            {data.categoryBreakdown.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)' }}>暂无数据。</p>
            ) : (
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.categoryBreakdown} layout="vertical">
                    <XAxis type="number" stroke="var(--color-text-muted)" fontSize={12} />
                    <YAxis
                      type="category"
                      dataKey="categoryName"
                      width={90}
                      stroke="var(--color-text-muted)"
                      fontSize={12}
                    />
                    <Tooltip formatter={(value) => formatMinutes(Number(value))} cursor={{ fill: 'var(--glass-hover-bg)' }} />
                    <Bar dataKey="totalMinutes" fill="var(--color-accent)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </GlassSurface>

          <GlassSurface radius="lg" className={statsStyles.chartCard}>
            <h3 className={statsStyles.chartTitle}>Top 应用</h3>
            <TopList buckets={timeStats?.byApp} />
          </GlassSurface>

          <GlassSurface radius="lg" className={statsStyles.chartCard}>
            <h3 className={statsStyles.chartTitle}>Top 网站</h3>
            <TopList buckets={timeStats?.byDomain} emptyHint="暂无网站数据（仅浏览器窗口标题可解析）。" />
          </GlassSurface>

          <GlassSurface radius="lg" className={statsStyles.chartCard}>
            <h3 className={statsStyles.chartTitle}>Top 窗口标题</h3>
            <TopList buckets={timeStats?.byWindowTitle} />
          </GlassSurface>
        </div>
      )}
    </section>
  )
}

/** ActivityWatch 式 Top 榜单：每行标题 + 时长，背景条按占比填充。取前 8 项。 */
function TopList({ buckets, emptyHint }: { buckets?: TimeStatBucket[]; emptyHint?: string }): React.JSX.Element {
  const top = (buckets ?? []).slice(0, 8)
  if (top.length === 0) {
    return <p style={{ color: 'var(--color-text-muted)' }}>{emptyHint ?? '暂无数据。'}</p>
  }
  const max = top[0].minutes || 1
  return (
    <div className={statsStyles.topList}>
      {top.map((b) => (
        <div
          key={b.key}
          className={statsStyles.topRow}
          style={{ ['--bar-pct' as string]: `${Math.round((b.minutes / max) * 100)}%` }}
        >
          <span className={statsStyles.topName} title={b.key}>
            {b.key}
          </span>
          <span className={statsStyles.topValue}>{formatMinutes(b.minutes)}</span>
        </div>
      ))}
    </div>
  )
}
