import type Database from 'better-sqlite3'

export function up(db: Database.Database): void {
  db.exec(`
    CREATE TABLE time_entry (
      id TEXT PRIMARY KEY,
      task_id TEXT REFERENCES task(id) ON DELETE SET NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER NOT NULL,
      source TEXT NOT NULL,
      app_name TEXT,
      window_title TEXT,
      note TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX idx_time_entry_start_end ON time_entry(start_time, end_time);
    CREATE INDEX idx_time_entry_task_id ON time_entry(task_id);
  `)
}
