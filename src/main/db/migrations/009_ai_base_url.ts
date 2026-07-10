import type Database from 'better-sqlite3'

/**
 * 阶段12+：支持自定义 API Base URL（兼容 Claude/OpenAI 协议的第三方代理端点）。
 * 旧记录 base_url 为 NULL，表示使用官方默认端点。
 */
export function up(db: Database.Database): void {
  db.exec(`ALTER TABLE ai_provider_config ADD COLUMN base_url TEXT;`)
}
