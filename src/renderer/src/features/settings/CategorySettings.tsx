import { useState } from 'react'
import { Trash2, FolderPlus } from 'lucide-react'
import { GlassSurface, Button, IconButton, TextField, Field } from '../../design-system'
import { useCategories, useUpsertCategory, useDeleteCategory } from '../categories/useCategories'
import settingsStyles from './AISettingsPage.module.css'

const DEFAULT_COLOR = '#f59e0b'

export function CategorySettings(): React.JSX.Element {
  const { data: categories, isLoading } = useCategories()
  const upsertCategory = useUpsertCategory()
  const deleteCategory = useDeleteCategory()

  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_COLOR)

  function handleAdd(): void {
    const trimmed = name.trim()
    if (!trimmed) return
    upsertCategory.mutate({ name: trimmed, color }, { onSuccess: () => setName('') })
  }

  return (
    <GlassSurface radius="lg" style={{ padding: 'var(--space-6)' }}>
      <h3 className={settingsStyles.cardTitle}>分类管理</h3>

      {isLoading && <p style={{ color: 'var(--color-text-muted)' }}>加载中...</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        {categories?.map((category) => (
          <div key={category.id} className={settingsStyles.providerRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <span
                aria-hidden
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  background: category.color ?? 'var(--color-text-muted)',
                  flexShrink: 0
                }}
              />
              <strong>{category.name}</strong>
            </div>
            <IconButton danger onClick={() => deleteCategory.mutate(category.id)} aria-label={`删除分类 ${category.name}`}>
              <Trash2 size={16} />
            </IconButton>
          </div>
        ))}
        {categories?.length === 0 && !isLoading && (
          <p style={{ color: 'var(--color-text-muted)' }}>暂无分类，添加一个开始使用。</p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
        <Field label="名称" className={settingsStyles.grow}>
          <TextField
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="如 工作、学习..."
          />
        </Field>
        <Field label="颜色">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            aria-label="分类颜色"
            style={{
              width: 44,
              height: 38,
              padding: 2,
              border: '1px solid var(--glass-surface-border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--field-bg)',
              cursor: 'pointer'
            }}
          />
        </Field>
        <Button
          variant="primary"
          icon={<FolderPlus size={16} />}
          onClick={handleAdd}
          disabled={upsertCategory.isPending || !name.trim()}
        >
          添加
        </Button>
      </div>
    </GlassSurface>
  )
}
