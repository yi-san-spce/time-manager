import { useState } from 'react'
import { TitleBar } from './TitleBar'
import { Sidebar } from './Sidebar'
import { ReminderToaster } from './ReminderToaster'
import styles from './MainLayout.module.css'

/** 应用外壳：顶部自定义标题栏 + 左侧可折叠玻璃侧边栏 + 右侧滚动内容区。 */
export function MainLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={styles.shell}>
      <TitleBar />
      <div className={styles.main}>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        <main className={styles.content}>{children}</main>
      </div>
      <ReminderToaster />
    </div>
  )
}
