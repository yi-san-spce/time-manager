import { HashRouter } from 'react-router-dom'
import { AppRoutes } from './routes'
import { GlassDistortionFilter } from './design-system/GlassDistortionFilter'
import { ThemeProvider } from './design-system/ThemeContext'
import { PomodoroProvider } from './features/timer/PomodoroContext'
import { MainLayout } from './shell/MainLayout'
import { FloatingAssistant } from './features/assistant/FloatingAssistant'
import { FloatingWidget } from './features/timer/FloatingWidget'

/**
 * 悬浮小窗以固定 hash 载入同一渲染包，走精简 shell（无侧栏/标题栏）。
 * 兼容两种 hash 形态：dev 的 `#/floating-*` 与打包 loadFile 的 `#floating-*`。
 */
function floatingRoute(): 'assistant' | 'widget' | null {
  const hash = window.location.hash.replace(/^#\/?/, '')
  if (hash.startsWith('floating-assistant')) return 'assistant'
  if (hash.startsWith('floating-widget')) return 'widget'
  return null
}

function App(): React.JSX.Element {
  const floating = floatingRoute()
  if (floating) {
    return (
      <ThemeProvider>
        <GlassDistortionFilter />
        {floating === 'assistant' ? <FloatingAssistant /> : <FloatingWidget />}
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      <GlassDistortionFilter />
      <PomodoroProvider>
        <HashRouter>
          <MainLayout>
            <AppRoutes />
          </MainLayout>
        </HashRouter>
      </PomodoroProvider>
    </ThemeProvider>
  )
}

export default App
