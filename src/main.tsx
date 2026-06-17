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

function preserveRouteForHashRouter() {
  if (window.location.hash.startsWith('#/')) return true

  const routeRoots = new Set([
    'auth', 'store', 'library', 'read', 'b', 'upload', 'edit', 'publish', 'publisher',
    'admin', 'credits', 'editor-requests', 'profile', 'install', 'word-addin',
    'audio-studio', 'audio',
  ])
  const pathParts = window.location.pathname.split('/').filter(Boolean)
  const routeIndex = pathParts.findIndex(part => routeRoots.has(part))
  if (routeIndex < 0) return true

  const basePath = `/${pathParts.slice(0, routeIndex).join('/')}`
  const routePath = `/${pathParts.slice(routeIndex).join('/')}`
  const nextUrl = `${window.location.origin}${basePath === '/' ? '' : basePath}/#${routePath}${window.location.search}`
  window.location.replace(nextUrl)
  return false
}

if (preserveRouteForHashRouter()) {
  const isLatestVersion = await ensureLatestOnlineVersion()
  if (isLatestVersion) await refreshVersionedCaches()

  if (isLatestVersion) createRoot(document.getElementById('root')!).render(
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
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`./sw.js?v=${APP_VERSION}`, { updateViaCache: 'none' }).then(registration => registration.update()).catch(() => {})
  })
}
