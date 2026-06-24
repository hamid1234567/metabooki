import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import './index.css'
import { I18nProvider } from './lib/i18n'
import { ThemeProvider } from './lib/theme'
import { AuthProvider } from './lib/auth-context'
import App from './App'
import { ensureLatestOnlineVersion, refreshVersionedCaches } from './lib/version-cache'
import { APP_VERSION } from './lib/version'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000, refetchOnWindowFocus: false },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              <App />
              <Toaster position="top-center" richColors closeButton toastOptions={{ duration: 4000 }} />
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </HashRouter>
  </StrictMode>,
)

if (import.meta.env.PROD) {
  window.setTimeout(() => {
    void (async () => {
      const isLatestVersion = await ensureLatestOnlineVersion()
      if (isLatestVersion) await refreshVersionedCaches()
    })()
  }, 0)
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js?v=${APP_VERSION}`, { updateViaCache: 'none', scope: import.meta.env.BASE_URL }).then(registration => registration.update()).catch(() => {})
  })
}

if ('serviceWorker' in navigator && !import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.getRegistrations()
      .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
      .then(async () => {
        if (!('caches' in window)) return
        const names = await caches.keys()
        await Promise.all(names.filter(name => name.startsWith('metabooki-')).map(name => caches.delete(name)))
      })
      .catch(() => {})
  })
}
