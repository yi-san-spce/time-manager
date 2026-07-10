import type Database from 'better-sqlite3'

/**
 * 给 time_entry 增加 domain 列，用于"打开了什么网站"的统计（需求4/需求3 的 Top 域名）。
 * get-windows 只能拿到窗口标题+进程名，拿不到浏览器真实 URL，所以这里存的是从浏览器
 * 窗口标题启发式解析出的站点标签（粗粒度、纯本地、无需权限），不是精确 URL。
 * 非浏览器进程 domain 为 NULL。
 */
export function up(db: Database.Database): void {
  db.exec(`
    ALTER TABLE time_entry ADD COLUMN domain TEXT;
    CREATE INDEX idx_time_entry_domain ON time_entry(domain);
    CREATE INDEX idx_time_entry_app_name ON time_entry(app_name);
  `)
}
