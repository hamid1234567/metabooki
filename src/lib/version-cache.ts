import { APP_VERSION } from '@/lib/version'

const VERSION_STORAGE_KEY = 'metabooki_app_version'

export async function refreshVersionedCaches() {
  const previousVersion = localStorage.getItem(VERSION_STORAGE_KEY)
  if (previousVersion === APP_VERSION) return

  if ('caches' in window) {
    const names = await caches.keys()
    await Promise.all(names.filter(name => name.startsWith('metabooki-')).map(name => caches.delete(name)))
  }

  sessionStorage.clear()
  localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION)
}
