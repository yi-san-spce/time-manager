import type Database from 'better-sqlite3'

export function up(db: Database.Database): void {
  db.exec(`
    CREATE TABLE report (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      period_start INTEGER NOT NULL,
      period_end INTEGER NOT NULL,
      self_reflection TEXT,
      ai_summary TEXT,
      ai_provider_used TEXT,
      generated_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX idx_report_period ON report(period_start, period_end);
  `)
}
