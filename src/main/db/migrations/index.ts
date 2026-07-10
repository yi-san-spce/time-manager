import type Database from 'better-sqlite3'
import * as m001 from './001_init'
import * as m002 from './002_app_settings'
import * as m003 from './003_recurrence_exceptions'
import * as m004 from './004_time_entry'
import * as m005 from './005_ai_provider_config'
import * as m006 from './006_report'
import * as m007 from './007_task_enrichment'
import * as m008 from './008_agent_conversation'
import * as m009 from './009_ai_base_url'
import * as m010 from './010_seed_categories'
import * as m011 from './011_time_entry_url'
import * as m012 from './012_activity_note'
import * as m013 from './013_agent_thinking'

interface Migration {
  version: number
  up: (db: Database.Database) => void
}

const migrations: Migration[] = [
  { version: 1, up: m001.up },
  { version: 2, up: m002.up },
  { version: 3, up: m003.up },
  { version: 4, up: m004.up },
  { version: 5, up: m005.up },
  { version: 6, up: m006.up },
  { version: 7, up: m007.up },
  { version: 8, up: m008.up },
  { version: 9, up: m009.up },
  { version: 10, up: m010.up },
  { version: 11, up: m011.up },
  { version: 12, up: m012.up },
  { version: 13, up: m013.up }
]

export function runMigrations(db: Database.Database): void {
  const currentVersion = db.pragma('user_version', { simple: true }) as number

  const pending = migrations
    .filter((migration) => migration.version > currentVersion)
    .sort((a, b) => a.version - b.version)

  for (const migration of pending) {
    db.transaction(() => {
      migration.up(db)
      db.pragma(`user_version = ${migration.version}`)
    })()
  }
}
