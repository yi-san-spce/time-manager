import type Database from 'better-sqlite3'

/**
 * 阶段10：任务能力增强。
 * - task 增列：description（Markdown 正文）、due_date（截止）、estimate_minutes（预估时长）
 * - subtask：任务下的步骤/子任务清单，可勾选、可拖拽排序（sort_order）
 * - tag / task_tag：任务标签多对多
 * status 是 TEXT 列，取值扩展为 pending|in_progress|blocked|done|cancelled 无需改表。
 */
export function up(db: Database.Database): void {
  db.exec(`
    ALTER TABLE task ADD COLUMN description TEXT;
    ALTER TABLE task ADD COLUMN due_date INTEGER;
    ALTER TABLE task ADD COLUMN estimate_minutes INTEGER;

    CREATE TABLE subtask (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX idx_subtask_task_id ON subtask(task_id);

    CREATE TABLE tag (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT
    );

    CREATE TABLE task_tag (
      task_id TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
      PRIMARY KEY (task_id, tag_id)
    );

    CREATE INDEX idx_task_tag_tag_id ON task_tag(tag_id);
  `)
}
