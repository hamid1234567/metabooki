import { APP_VERSION } from '@/lib/version'

const VERSION_STORAGE_KEY = 'metabooki_app_version'
const CHUNK_RECOVERY_STORAGE_KEY = 'metabooki_chunk_recovery'

async function clearAppCaches() {
  if (!('caches' in window)) return
  const names = await caches.keys()
  await Promise.all(names.filter(name => name.startsWith('metabooki-')).map(name => caches.delete(name)))
}

async function unregisterAppServiceWorkers() {
  if (!('serviceWorker' in navigator)) return
  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(registrations.map(registration => registration.unregister()))
}

function errorText(error: unknown) {
  if (error instanceof Error) return `${error.name} ${error.message}`.trim()
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    return String(record.message || record.reason || record.error || '')
  }
  return ''
}

export function isDynamicImportError(error: unknown) {
  const message = errorText(error).toLowerCase()
  return /dynamically imported module|dynamic import|loading chunk|failed to fetch.*module|importing a module script failed|module script/i.test(message)
}

export async function recoverFromDynamicImportError(error: unknown) {
  if (!isDynamicImportError(error)) return false
  if (typeof window === 'undefined') return false

  const marker = `${APP_VERSION}:${window.location.pathname}${window.location.search}${window.location.hash}`
  if (sessionStorage.getItem(CHUNK_RECOVERY_STORAGE_KEY) === marker) return false
  sessionStorage.setItem(CHUNK_RECOVERY_STORAGE_KEY, marker)

  await clearAppCaches()
  await unregisterAppServiceWorkers()

  const nextUrl = new URL(window.location.href)
  nextUrl.searchParams.set('appVersion', APP_VERSION)
  nextUrl.searchParams.set('recover', Date.now().toString())
  window.location.replace(nextUrl.toString())
  return true
}

export function installDynamicImportRecovery() {
  if (typeof window === 'undefined') return

  window.addEventListener('unhandledrejection', (event) => {
    if (!isDynamicImportError(event.reason)) return
    event.preventDefault()
    void recoverFromDynamicImportError(event.reason)
  })

  window.addEventListener('error', (event) => {
    const error = event.error || event.message
    if (!isDynamicImportError(error)) return
    event.preventDefault()
    void recoverFromDynamicImportError(error)
  })
}

export async function ensureLatestOnlineVersion() {
  if (!navigator.onLine) return true

  try {
    const response = await fetch(`./version.json?check=${Date.now()}`, { cache: 'no-store' })
    if (!response.ok) return true
    const remote = await response.json() as { version?: string }
    if (!remote.version || remote.version === APP_VERSION) return true

    await clearAppCaches()
    await unregisterAppServiceWorkers()

    const nextUrl = new URL(window.location.href)
    nextUrl.searchParams.set('appVersion', remote.version)
    window.location.replace(nextUrl.toString())
    return false
  } catch {
    return true
  }
}

export async function refreshVersionedCaches() {
  const previousVersion = localStorage.getItem(VERSION_STORAGE_KEY)
  if (previousVersion === APP_VERSION) return

  await clearAppCaches()

  sessionStorage.clear()
  localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION)
}
