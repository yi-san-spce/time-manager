import { app } from 'electron'
import { join } from 'path'
import Database from 'better-sqlite3'
import { runMigrations } from './migrations'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db

  const dbPath = join(app.getPath('userData'), 'data.sqlite3')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db)

  return db
}

export function closeDb(): void {
  db?.close()
  db = null
}
