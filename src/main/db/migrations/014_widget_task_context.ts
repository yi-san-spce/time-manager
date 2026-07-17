import type Database from 'better-sqlite3'

/**
 * Adds calendar context to tracked time and a task-scoped quick note shared by the
 * floating widget and the task detail drawer. Both foreign keys intentionally
 * clear/cascade with their parent records so historical time tracking remains safe.
 */
export function up(db: Database.Database): void {
  db.exec(`
    ALTER TABLE time_entry
      ADD COLUMN schedule_id TEXT REFERENCES schedule(id) ON DELETE SET NULL;

    CREATE INDEX idx_time_entry_schedule_id ON time_entry(schedule_id);

    CREATE TABLE task_quick_note (
      task_id TEXT PRIMARY KEY REFERENCES task(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `)
}
