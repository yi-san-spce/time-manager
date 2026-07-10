import type Database from 'better-sqlite3'

/**
 * 种子默认分类。此前 category 表建好却从无写入，导致任务/日程的分类下拉永远只有"未分类"。
 * 迁移只跑一次（user_version 守卫），用固定 id，便于识别是种子数据。
 */
export function up(db: Database.Database): void {
  const now = Date.now()
  const defaults: { id: string; name: string; color: string }[] = [
    { id: 'cat-work', name: '工作', color: '#f59e0b' },
    { id: 'cat-study', name: '学习', color: '#3b82f6' },
    { id: 'cat-life', name: '娱乐', color: '#ec4899' },
    { id: 'cat-rest', name: '休息', color: '#10b981' }
  ]
  const insert = db.prepare(
    'INSERT OR IGNORE INTO category (id, name, color, created_at) VALUES (?, ?, ?, ?)'
  )
  for (const c of defaults) {
    insert.run(c.id, c.name, c.color, now)
  }
}
