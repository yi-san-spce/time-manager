import type Database from 'better-sqlite3'

export function up(db: Database.Database): void {
  db.exec(`
    CREATE TABLE category (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE recurrence_rule (
      id TEXT PRIMARY KEY,
      freq TEXT NOT NULL,
      interval INTEGER NOT NULL DEFAULT 1,
      by_weekday TEXT,
      until_date INTEGER,
      count INTEGER
    );

    CREATE TABLE schedule (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      category_id TEXT REFERENCES category(id) ON DELETE SET NULL,
      priority INTEGER NOT NULL DEFAULT 2,
      start_time INTEGER NOT NULL,
      end_time INTEGER NOT NULL,
      recurrence_rule_id TEXT REFERENCES recurrence_rule(id) ON DELETE SET NULL,
      reminder_minutes_before INTEGER,
      status TEXT NOT NULL DEFAULT 'planned',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX idx_schedule_start_time ON schedule(start_time);

    CREATE TABLE task (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category_id TEXT REFERENCES category(id) ON DELETE SET NULL,
      priority INTEGER NOT NULL DEFAULT 2,
      schedule_id TEXT REFERENCES schedule(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX idx_task_schedule_id ON task(schedule_id);
  `)
}
