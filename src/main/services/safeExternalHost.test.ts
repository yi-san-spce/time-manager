import { describe, expect, it } from 'vitest'
import { buildSafeExternalUrl, getSafeExternalHost } from './safeExternalHost'

describe('getSafeExternalHost', () => {
  it('returns a lowercase complete hostname', () => {
    expect(getSafeExternalHost('Docs.GitHub.COM')).toBe('docs.github.com')
    expect(buildSafeExternalUrl('Docs.GitHub.COM')).toBe('https://docs.github.com')
  })

  it.each([
    'GitHub',
    'https://github.com',
    '//github.com',
    'github.com/issues',
    'github.com?tab=activity',
    'github.com#readme',
    'github.com:443',
    'user@github.com',
    ' github.com',
    'github.com ',
    '127.0.0.1',
    'localhost',
    '-github.com',
    'github-.com',
    'github..com',
    'github.中国'
  ])('rejects non-host or unsafe input: %s', (value) => {
    expect(getSafeExternalHost(value)).toBeNull()
    expect(buildSafeExternalUrl(value)).toBeNull()
  })
})
