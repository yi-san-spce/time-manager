import { useTheme } from '../../design-system/ThemeContext'
import { Segmented } from '../../design-system'
import type { ThemeMode } from '@shared/types/ui'

/** 主题切换段控（浅色/深色/跟随系统）。 */
export function ThemeSwitcher(): React.JSX.Element {
  const { themeMode, setThemeMode } = useTheme()

  return (
    <Segmented<ThemeMode>
      value={themeMode}
      onChange={setThemeMode}
      options={[
        { value: 'light', label: '浅色' },
        { value: 'dark', label: '深色' },
        { value: 'system', label: '跟随系统' }
      ]}
    />
  )
}
