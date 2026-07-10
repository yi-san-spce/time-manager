import type { AIProviderName } from '@shared/types/ai'
import type { AIProvider } from './types'
import { ClaudeAdapter } from './claudeAdapter'
import { OpenAIAdapter } from './openaiAdapter'

export function createAIProvider(
  provider: AIProviderName,
  apiKey: string,
  model: string,
  baseUrl?: string | null
): AIProvider {
  switch (provider) {
    case 'claude':
      return new ClaudeAdapter(apiKey, model, baseUrl)
    case 'openai':
      return new OpenAIAdapter(apiKey, model, baseUrl)
  }
}
