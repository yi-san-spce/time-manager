import { Play, Pause, Square, SkipForward } from 'lucide-react'
import { GlassSurface, IconButton, Button } from '../../design-system'
import { usePomodoro, type PomodoroPhase } from './PomodoroContext'
import styles from './PomodoroWidget.module.css'

const PHASE_LABEL: Record<PomodoroPhase, string> = {
  focus: '专注',
  shortBreak: '短休息',
  longBreak: '长休息'
}

const PHASE_COLOR: Record<PomodoroPhase, string> = {
  focus: 'var(--stage-track)',
  shortBreak: 'var(--color-info)',
  longBreak: 'var(--stage-review)'
}

function fmt(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const RADIUS = 58
const CIRC = 2 * Math.PI * RADIUS

export interface PomodoroWidgetProps {
  collapsed?: boolean
}

/** 番茄钟计时组件，常驻侧边栏底部。link 为 null 时不显示（未启动）。 */
export function PomodoroWidget({ collapsed = false }: PomodoroWidgetProps): React.JSX.Element | null {
  const { phase, running, remainingMs, totalMs, link, pause, resume, stop, skip } = usePomodoro()

  // 未启动（无关联）时不占位
  if (!link) return null

  const progress = totalMs > 0 ? 1 - remainingMs / totalMs : 0
  const color = PHASE_COLOR[phase]

  if (collapsed) {
    const miniR = 19
    const miniCirc = 2 * Math.PI * miniR
    return (
      <div className={styles.mini}>
        <div className={styles.miniRing} title={`${PHASE_LABEL[phase]} · ${fmt(remainingMs)}`}>
          <svg className={styles.ringSvg} viewBox="0 0 44 44">
            <circle className={styles.ringTrack} cx="22" cy="22" r={miniR} style={{ strokeWidth: 4 }} />
            <circle
              className={styles.ringFill}
              cx="22"
              cy="22"
              r={miniR}
              style={{
                strokeWidth: 4,
                stroke: color,
                strokeDasharray: miniCirc,
                strokeDashoffset: miniCirc * (1 - progress)
              }}
            />
          </svg>
          <span className={styles.miniTime}>{fmt(remainingMs)}</span>
        </div>
      </div>
    )
  }

  return (
    <GlassSurface radius="lg" className={styles.widget}>
      <div className={styles.ring}>
        <svg className={styles.ringSvg} viewBox="0 0 132 132">
          <circle className={styles.ringTrack} cx="66" cy="66" r={RADIUS} />
          <circle
            className={styles.ringFill}
            cx="66"
            cy="66"
            r={RADIUS}
            style={{ stroke: color, strokeDasharray: CIRC, strokeDashoffset: CIRC * (1 - progress) }}
          />
        </svg>
        <div className={styles.ringCenter}>
          <span className={styles.time}>{fmt(remainingMs)}</span>
          <span className={styles.phaseLabel}>{PHASE_LABEL[phase]}</span>
        </div>
      </div>

      {link.label !== '专注' && <div className={styles.linkLabel}>{link.label}</div>}

      <div className={styles.controls}>
        {running ? (
          <IconButton onClick={pause} aria-label="暂停">
            <Pause size={18} />
          </IconButton>
        ) : (
          <IconButton onClick={resume} aria-label="继续">
            <Play size={18} />
          </IconButton>
        )}
        <IconButton onClick={skip} aria-label="跳过">
          <SkipForward size={18} />
        </IconButton>
        <IconButton danger onClick={stop} aria-label="停止">
          <Square size={18} />
        </IconButton>
      </div>
    </GlassSurface>
  )
}

/** 「开始专注」入口按钮，供任务卡片/详情/日程条复用。 */
export function StartFocusButton({
  taskId,
  label,
  size = 'sm'
}: {
  taskId?: string | null
  label: string
  size?: 'sm' | 'md'
}): React.JSX.Element {
  const { start, running, link } = usePomodoro()
  const isActiveForThis = running && link?.taskId === taskId && taskId != null
  return (
    <Button
      size={size}
      variant={isActiveForThis ? 'primary' : 'secondary'}
      icon={<Play size={14} />}
      onClick={(e) => {
        e.stopPropagation()
        start({ taskId, label })
      }}
    >
      {isActiveForThis ? '专注中' : '专注'}
    </Button>
  )
}
