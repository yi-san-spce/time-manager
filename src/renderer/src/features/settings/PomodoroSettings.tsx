import { GlassSurface, TextField, Field } from '../../design-system'
import { usePomodoro } from '../timer/PomodoroContext'
import type { PomodoroConfig } from '@shared/types/ipc'
import settingsStyles from './AISettingsPage.module.css'

const FIELDS: { key: keyof PomodoroConfig; label: string; min: number; max: number }[] = [
  { key: 'focusMinutes', label: '专注时长（分钟）', min: 1, max: 180 },
  { key: 'shortBreakMinutes', label: '短休息（分钟）', min: 1, max: 60 },
  { key: 'longBreakMinutes', label: '长休息（分钟）', min: 1, max: 120 },
  { key: 'longBreakInterval', label: '每几轮长休息', min: 1, max: 12 }
]

export function PomodoroSettings(): React.JSX.Element {
  const { config, setConfig } = usePomodoro()

  function update(key: keyof PomodoroConfig, raw: string): void {
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 1) return
    setConfig({ ...config, [key]: Math.round(n) })
  }

  return (
    <GlassSurface radius="lg" style={{ padding: 'var(--space-6)' }}>
      <h3 className={settingsStyles.cardTitle}>番茄钟</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3)' }}>
        {FIELDS.map((f) => (
          <Field key={f.key} label={f.label}>
            <TextField
              type="number"
              min={f.min}
              max={f.max}
              value={config[f.key]}
              onChange={(e) => update(f.key, e.target.value)}
            />
          </Field>
        ))}
      </div>
    </GlassSurface>
  )
}
