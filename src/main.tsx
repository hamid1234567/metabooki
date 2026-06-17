import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
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

const routerBasename = import.meta.env.BASE_URL === '/' ? '/' : import.meta.env.BASE_URL.replace(/\/$/, '')
const restoredPath = sessionStorage.getItem('metabooki_restore_path')
if (restoredPath && restoredPath !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
  sessionStorage.removeItem('metabooki_restore_path')
  window.history.replaceState(null, '', restoredPath)
}

const isLatestVersion = await ensureLatestOnlineVersion()
if (isLatestVersion) await refreshVersionedCaches()

if (isLatestVersion) createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={routerBasename}>
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
    </BrowserRouter>
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js?v=${APP_VERSION}`, { updateViaCache: 'none', scope: import.meta.env.BASE_URL }).then(registration => registration.update()).catch(() => {})
  })
}
