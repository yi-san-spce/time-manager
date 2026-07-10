import type Database from 'better-sqlite3'

/**
 * 追踪详情页的用户笔记 + AI 总结。按"活动分组键"存储（首版 scope_key = 应用名），
 * 不塞进单条 time_entry，因为一个应用对应多条 raw 段。需求4：用户在详情页写"我干了什么/收获"，
 * 并可一键 AI 总结（基于该应用下访问过的网站/窗口标题）。
 */
export function up(db: Database.Database): void {
  db.exec(`
    CREATE TABLE activity_note (
      scope_key TEXT PRIMARY KEY,
      note TEXT,
      ai_summary TEXT,
      updated_at INTEGER NOT NULL
    );
  `)
}
