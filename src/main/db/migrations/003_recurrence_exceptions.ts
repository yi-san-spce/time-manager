import type Database from 'better-sqlite3'

export function up(db: Database.Database): void {
  db.exec(`
    CREATE TABLE schedule_exception (
      schedule_id TEXT NOT NULL REFERENCES schedule(id) ON DELETE CASCADE,
      occurrence_date INTEGER NOT NULL,
      action TEXT NOT NULL,
      PRIMARY KEY (schedule_id, occurrence_date)
    );
  `)
}
