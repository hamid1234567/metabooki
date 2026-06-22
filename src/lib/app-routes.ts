export function appHashUrl(path: string) {
  const base = import.meta.env.BASE_URL || '/'
  const cleanBase = base.endsWith('/') ? base : `${base}/`
  const cleanPath = path.replace(/^#?\//, '')
  const url = new URL(cleanBase, window.location.origin)
  url.hash = `/${cleanPath}`
  return url.toString()
}

export function readerRoute(bookId: string, returnTo?: string) {
  const params = new URLSearchParams()
  if (returnTo) params.set('returnTo', returnTo)
  const query = params.toString()
  return `/read/${encodeURIComponent(bookId)}${query ? `?${query}` : ''}`
}

export function readerUrl(bookId: string, returnTo?: string) {
  return appHashUrl(readerRoute(bookId, returnTo))
}

export function openReaderPreview(bookId: string, returnTo?: string) {
  return window.open(readerUrl(bookId, returnTo), '_blank', 'noopener,noreferrer')
}
