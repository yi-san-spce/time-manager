import { safeStorage } from 'electron'
import type { AIProviderConfig, AIProviderName } from '@shared/types/ai'
import {
  deleteAIProviderConfig,
  getEncryptedApiKey,
  listAIProviderConfigs,
  setActiveAIProviderConfig,
  upsertAIProviderConfig
} from '../db/repositories/aiConfigRepo'

export function listConfigs(): AIProviderConfig[] {
  return listAIProviderConfigs()
}

export function saveConfig(input: {
  id?: string
  provider: AIProviderName
  model: string
  apiKey: string
  baseUrl?: string | null
}): AIProviderConfig {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('系统加密不可用，无法安全存储 API Key')
  }
  const encryptedApiKey = safeStorage.encryptString(input.apiKey)
  return upsertAIProviderConfig({
    id: input.id,
    provider: input.provider,
    model: input.model,
    encryptedApiKey,
    baseUrl: input.baseUrl ?? null
  })
}

export function activateConfig(id: string): void {
  setActiveAIProviderConfig(id)
}

export function removeConfig(id: string): void {
  deleteAIProviderConfig(id)
}

/** 解密后的 key 只在调用生命周期内存在于内存，不做持久缓存。换机器/用户后 safeStorage 解密会失败，抛错交由调用方处理。 */
export function decryptApiKey(id: string): string {
  const encrypted = getEncryptedApiKey(id)
  if (!encrypted) {
    throw new Error('未找到该 AI 供应商配置')
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('系统加密不可用，无法解密 API Key')
  }
  return safeStorage.decryptString(encrypted)
}
