import { ipcMain } from 'electron'
import { z } from 'zod'
import { IPC } from '@shared/types/ipc'
import type { AIProvider } from '../ai/types'
import { createAIProvider } from '../ai/providerFactory'
import {
  activateConfig,
  decryptApiKey,
  listConfigs,
  removeConfig,
  saveConfig
} from '../services/aiSettingsService'
import { getActiveAIProviderConfig } from '../db/repositories/aiConfigRepo'
import { saveAIProviderConfigSchema } from './schemas'

function getActiveProvider(): AIProvider {
  const config = getActiveAIProviderConfig()
  if (!config) {
    throw new Error('未配置激活的 AI 供应商，请先在设置页配置并激活一个供应商')
  }
  const apiKey = decryptApiKey(config.id)
  return createAIProvider(config.provider, apiKey, config.model, config.baseUrl)
}

export function registerAIHandlers(): void {
  ipcMain.handle(IPC.aiListConfigs, () => listConfigs())

  ipcMain.handle(IPC.aiSaveConfig, (_event, input) => saveConfig(saveAIProviderConfigSchema.parse(input)))

  ipcMain.handle(IPC.aiActivateConfig, (_event, id) => activateConfig(z.string().min(1).parse(id)))

  ipcMain.handle(IPC.aiDeleteConfig, (_event, id) => removeConfig(z.string().min(1).parse(id)))

  ipcMain.handle(IPC.aiTestConnection, async (_event, id) => {
    const config = listConfigs().find((c) => c.id === z.string().min(1).parse(id))
    if (!config) {
      return { ok: false, message: '未找到该配置' }
    }
    try {
      const apiKey = decryptApiKey(config.id)
      const provider = createAIProvider(config.provider, apiKey, config.model, config.baseUrl)
      return await provider.testConnection()
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle(IPC.aiAnalyze, async (_event, input) => getActiveProvider().analyze(input))

  ipcMain.handle(IPC.aiSummarize, async (_event, input) => getActiveProvider().summarize(input))
}
