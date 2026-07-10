import { randomUUID } from 'crypto'
import { getDb } from '../connection'
import type { AIProviderConfig, AIProviderName } from '@shared/types/ai'

interface AIProviderConfigRow {
  id: string
  provider: string
  model: string
  encrypted_api_key: Buffer
  base_url: string | null
  is_active: number
  created_at: number
  updated_at: number
}

function mapRow(row: AIProviderConfigRow): AIProviderConfig {
  return {
    id: row.id,
    provider: row.provider as AIProviderName,
    model: row.model,
    isActive: row.is_active === 1,
    hasApiKey: row.encrypted_api_key.length > 0,
    baseUrl: row.base_url ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function listAIProviderConfigs(): AIProviderConfig[] {
  const rows = getDb().prepare('SELECT * FROM ai_provider_config ORDER BY created_at ASC').all() as AIProviderConfigRow[]
  return rows.map(mapRow)
}

export function getActiveAIProviderConfig(): AIProviderConfig | null {
  const row = getDb().prepare('SELECT * FROM ai_provider_config WHERE is_active = 1 LIMIT 1').get() as
    | AIProviderConfigRow
    | undefined
  return row ? mapRow(row) : null
}

/** 仅供 main 进程内部使用：拿到加密后的 key 原始 Buffer，调用方自行用 safeStorage 解密。不通过 IPC 暴露。 */
export function getEncryptedApiKey(id: string): Buffer | null {
  const row = getDb().prepare('SELECT encrypted_api_key FROM ai_provider_config WHERE id = ?').get(id) as
    | { encrypted_api_key: Buffer }
    | undefined
  return row?.encrypted_api_key ?? null
}

export function upsertAIProviderConfig(input: {
  id?: string
  provider: AIProviderName
  model: string
  encryptedApiKey: Buffer
  baseUrl?: string | null
}): AIProviderConfig {
  const db = getDb()
  const now = Date.now()
  const baseUrl = input.baseUrl ?? null

  if (input.id) {
    db.prepare(
      'UPDATE ai_provider_config SET provider = ?, model = ?, encrypted_api_key = ?, base_url = ?, updated_at = ? WHERE id = ?'
    ).run(input.provider, input.model, input.encryptedApiKey, baseUrl, now, input.id)
    return getAIProviderConfig(input.id) as AIProviderConfig
  }

  const id = randomUUID()
  db.prepare(
    `INSERT INTO ai_provider_config (id, provider, model, encrypted_api_key, base_url, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(id, input.provider, input.model, input.encryptedApiKey, baseUrl, now, now)
  return getAIProviderConfig(id) as AIProviderConfig
}

function getAIProviderConfig(id: string): AIProviderConfig | null {
  const row = getDb().prepare('SELECT * FROM ai_provider_config WHERE id = ?').get(id) as
    | AIProviderConfigRow
    | undefined
  return row ? mapRow(row) : null
}

export function setActiveAIProviderConfig(id: string): void {
  const db = getDb()
  const setActiveTxn = db.transaction(() => {
    db.prepare('UPDATE ai_provider_config SET is_active = 0').run()
    db.prepare('UPDATE ai_provider_config SET is_active = 1, updated_at = ? WHERE id = ?').run(Date.now(), id)
  })
  setActiveTxn()
}

export function deleteAIProviderConfig(id: string): void {
  getDb().prepare('DELETE FROM ai_provider_config WHERE id = ?').run(id)
}
