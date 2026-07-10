import { useEffect, useState } from 'react'
import { Minus, Square, Copy, X } from 'lucide-react'
import styles from './MainLayout.module.css'

/** 自定义窗口标题栏：可拖拽区 + Windows 风格窗控按钮。 */
export function TitleBar(): React.JSX.Element {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    void window.api.window.isMaximized().then(setMaximized)
    return window.api.window.onMaximizedChanged(setMaximized)
  }, [])

  return (
    <div className={styles.titlebar}>
      <span className={styles.titlebarTitle}>时间管理器</span>
      <div className={styles.winControls}>
        <button className={styles.winBtn} onClick={() => window.api.window.minimize()} aria-label="最小化">
          <Minus size={16} />
        </button>
        <button
          className={styles.winBtn}
          onClick={() => window.api.window.toggleMaximize()}
          aria-label={maximized ? '还原' : '最大化'}
        >
          {maximized ? <Copy size={13} /> : <Square size={13} />}
        </button>
        <button
          className={`${styles.winBtn} ${styles.winClose}`}
          onClick={() => window.api.window.close()}
          aria-label="关闭"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
