const PARAM = 'played'

export function buildShareUrl(ids: Iterable<string>): string {
  const list = [...ids].sort().map(encodeURIComponent).join(',')
  const { origin, pathname, search } = window.location
  return `${origin}${pathname}${search}#${PARAM}=${list}`
}

// Liefert die gültigen IDs aus einem Share-Link-Fragment oder null, wenn das Fragment kein Share-Link ist.
export function parseShareHash(hash: string, validIds: Set<string>): Set<string> | null {
  const match = new RegExp(`^#?${PARAM}=(.*)$`).exec(hash)
  if (!match) return null
  const ids = match[1].split(',').flatMap((part) => {
    try {
      return [decodeURIComponent(part)]
    } catch {
      return []
    }
  })
  return new Set(ids.filter((id) => validIds.has(id)))
}

export function clearShareHash() {
  const { pathname, search } = window.location
  window.history.replaceState(null, '', pathname + search)
}
