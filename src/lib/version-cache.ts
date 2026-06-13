import { APP_VERSION } from '@/lib/version'

const VERSION_STORAGE_KEY = 'metabooki_app_version'

async function clearAppCaches() {
  if (!('caches' in window)) return
  const names = await caches.keys()
  await Promise.all(names.filter(name => name.startsWith('metabooki-')).map(name => caches.delete(name)))
}

export async function ensureLatestOnlineVersion() {
  if (!navigator.onLine) return true

  try {
    const response = await fetch(`./version.json?check=${Date.now()}`, { cache: 'no-store' })
    if (!response.ok) return true
    const remote = await response.json() as { version?: string }
    if (!remote.version || remote.version === APP_VERSION) return true

    await clearAppCaches()
    const registrations = await navigator.serviceWorker?.getRegistrations()
    await Promise.all((registrations || []).map(registration => registration.unregister()))

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
