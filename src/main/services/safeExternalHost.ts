/**
 * Returns a canonical DNS hostname only when the value is safe to turn into an
 * external HTTPS URL. Activity tracking stores browser-title labels, not URLs,
 * so callers must treat every value as untrusted.
 */
export function getSafeExternalHost(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 253 || value !== value.trim()) {
    return null
  }

  const host = value.toLowerCase()
  if (!/^[a-z0-9.-]+$/.test(host)) return null

  const labels = host.split('.')
  // A bare site name such as "GitHub" is a tracking label, not a complete host.
  if (labels.length < 2 || labels.some((label) => !isHostnameLabel(label))) return null

  const topLevelLabel = labels[labels.length - 1]
  // Require a DNS-style top-level label so IPv4 addresses and local/bare names
  // cannot be used as an external navigation target.
  if (!topLevelLabel || topLevelLabel.length < 2 || !/^[a-z](?:[a-z0-9-]*[a-z0-9])?$/.test(topLevelLabel)) {
    return null
  }

  return host
}

function isHostnameLabel(label: string): boolean {
  return label.length > 0 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
}

export function buildSafeExternalUrl(value: unknown): string | null {
  const host = getSafeExternalHost(value)
  return host ? `https://${host}` : null
}
