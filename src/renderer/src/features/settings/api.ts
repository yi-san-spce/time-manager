import type { SaveAIProviderConfigInput } from '@shared/types/ipc'

export const aiConfigApi = {
  list: () => window.api.ai.listConfigs(),
  save: (input: SaveAIProviderConfigInput) => window.api.ai.saveConfig(input),
  activate: (id: string) => window.api.ai.activateConfig(id),
  delete: (id: string) => window.api.ai.deleteConfig(id),
  testConnection: (id: string) => window.api.ai.testConnection(id)
}
