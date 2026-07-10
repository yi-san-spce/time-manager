import { useState } from 'react'
import { KeyRound, Plug, Trash2, CheckCircle2 } from 'lucide-react'
import { GlassSurface, Button, IconButton, TextField, SelectMenu, Field, Badge } from '../../design-system'
import { PageHeader } from '../../shell/PageHeader'
import { ThemeSwitcher } from './ThemeSwitcher'
import { PomodoroSettings } from './PomodoroSettings'
import { CategorySettings } from './CategorySettings'
import {
  useActivateAIConfig,
  useAIConfigs,
  useDeleteAIConfig,
  useSaveAIConfig,
  useTestAIConnection
} from './useAIConfig'
import type { AIProviderName } from '@shared/types/ai'
import settingsStyles from './AISettingsPage.module.css'

const PROVIDER_LABELS: Record<AIProviderName, string> = {
  claude: 'Claude (Anthropic)',
  openai: 'OpenAI'
}

const DEFAULT_MODELS: Record<AIProviderName, string> = {
  claude: 'claude-sonnet-5',
  openai: 'gpt-4o'
}

export function AISettingsPage(): React.JSX.Element {
  const { data: configs, isLoading } = useAIConfigs()
  const saveConfig = useSaveAIConfig()
  const activateConfig = useActivateAIConfig()
  const deleteConfig = useDeleteAIConfig()
  const testConnection = useTestAIConnection()

  const [provider, setProvider] = useState<AIProviderName>('claude')
  const [model, setModel] = useState(DEFAULT_MODELS.claude)
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [testResultById, setTestResultById] = useState<Record<string, string>>({})

  function handleProviderChange(next: AIProviderName): void {
    setProvider(next)
    setModel(DEFAULT_MODELS[next])
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault()
    if (!apiKey.trim() || !model.trim()) return
    saveConfig.mutate(
      { provider, model: model.trim(), apiKey: apiKey.trim(), baseUrl: baseUrl.trim() || null },
      { onSuccess: () => setApiKey('') }
    )
  }

  async function handleTestConnection(id: string): Promise<void> {
    setTestResultById((prev) => ({ ...prev, [id]: '测试中...' }))
    const result = await testConnection.mutateAsync(id)
    setTestResultById((prev) => ({
      ...prev,
      [id]: result.ok ? '连接成功' : `连接失败：${result.message ?? '未知错误'}`
    }))
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <PageHeader title="设置" subtitle="AI 供应商与外观" />

      <GlassSurface radius="lg" style={{ padding: 'var(--space-6)' }}>
        <h3 className={settingsStyles.cardTitle}>外观主题</h3>
        <ThemeSwitcher />
      </GlassSurface>

      <PomodoroSettings />

      <CategorySettings />

      <GlassSurface radius="lg" style={{ padding: 'var(--space-6)' }}>
        <h3 className={settingsStyles.cardTitle}>添加 AI 供应商</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Field label="供应商" className={settingsStyles.grow}>
              <SelectMenu<AIProviderName>
                value={provider}
                onChange={handleProviderChange}
                options={Object.entries(PROVIDER_LABELS).map(([value, label]) => ({
                  value: value as AIProviderName,
                  label
                }))}
              />
            </Field>
            <Field label="模型" className={settingsStyles.grow}>
              <TextField value={model} onChange={(e) => setModel(e.target.value)} placeholder="模型名称" />
            </Field>
          </div>
          <Field label="API Key">
            <TextField
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="加密存储在本地，不会上传"
            />
          </Field>
          <Field label="自定义 Base URL（可选，兼容协议的第三方代理；留空用官方端点）">
            <TextField
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="如 https://your-proxy.example.com"
            />
          </Field>
          <Button
            type="submit"
            variant="primary"
            icon={<KeyRound size={16} />}
            disabled={saveConfig.isPending}
            style={{ alignSelf: 'flex-start' }}
          >
            保存配置
          </Button>
        </form>
      </GlassSurface>

      <GlassSurface radius="lg" style={{ padding: 'var(--space-6)' }}>
        <h3 className={settingsStyles.cardTitle}>已配置的供应商</h3>
        {isLoading && <p style={{ color: 'var(--color-text-muted)' }}>加载中...</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {configs?.map((config) => (
            <div
              key={config.id}
              className={[settingsStyles.providerRow, config.isActive && settingsStyles.providerActive]
                .filter(Boolean)
                .join(' ')}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <strong>{PROVIDER_LABELS[config.provider]}</strong>
                  <span style={{ color: 'var(--color-text-muted)' }}>· {config.model}</span>
                  {config.isActive && (
                    <Badge tone="success">
                      <CheckCircle2 size={12} /> 已激活
                    </Badge>
                  )}
                </div>
                {config.baseUrl && (
                  <div className={settingsStyles.testResult}>端点：{config.baseUrl}</div>
                )}
                {testResultById[config.id] && (
                  <div className={settingsStyles.testResult}>{testResultById[config.id]}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button size="sm" icon={<Plug size={15} />} onClick={() => handleTestConnection(config.id)}>
                  测试连接
                </Button>
                {!config.isActive && (
                  <Button size="sm" variant="primary" onClick={() => activateConfig.mutate(config.id)}>
                    设为激活
                  </Button>
                )}
                <IconButton danger onClick={() => deleteConfig.mutate(config.id)} aria-label="删除配置">
                  <Trash2 size={16} />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
        {configs?.length === 0 && !isLoading && (
          <p style={{ color: 'var(--color-text-muted)' }}>暂无配置，添加一个供应商开始使用 AI 功能。</p>
        )}
      </GlassSurface>
    </section>
  )
}
