import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppActivityDetail } from '@shared/types/ipc'

const mocks = vi.hoisted(() => ({
  detail: null as AppActivityDetail | null
}))

vi.mock('./useActivityDetail', () => ({
  useActivityDetail: () => ({ data: mocks.detail }),
  useActivityNote: () => ({ data: null }),
  useSaveActivityNote: () => ({ mutate: vi.fn() }),
  useSummarizeActivity: () => ({ data: null, isPending: false, mutate: vi.fn() })
}))

import { ActivityDetailDrawer } from './ActivityDetailDrawer'

function renderDrawer(detail: AppActivityDetail): string {
  mocks.detail = detail
  return renderToStaticMarkup(
    <ActivityDetailDrawer
      appName={detail.appName}
      range={{ rangeStart: 0, rangeEnd: 60 * 60 * 1000 }}
      onClose={() => undefined}
    />
  )
}

describe('ActivityDetailDrawer website opener', () => {
  beforeEach(() => {
    mocks.detail = null
  })

  it('shows the validated hostname and a clearly labelled homepage button', () => {
    const html = renderDrawer({
      appName: 'Chrome',
      totalMinutes: 8,
      segments: [],
      targets: [{ key: 'GitHub', minutes: 8, count: 1, openHost: 'github.com' }]
    })

    expect(html).toContain('github.com')
    expect(html).toContain('https://github.com')
    expect(html).toContain('打开主页')
  })

  it('does not render a homepage control for historical labels without a validated hostname', () => {
    const html = renderDrawer({
      appName: 'Chrome',
      totalMinutes: 8,
      segments: [],
      targets: [{ key: 'GitHub', minutes: 8, count: 1 }]
    })

    expect(html).not.toContain('打开主页')
  })
})
