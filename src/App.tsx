import React, { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { Navbar } from '@/components/navbar/Navbar'
import { OfflineBanner } from '@/components/offline/OfflineBanner'
import { RoleGuard } from '@/components/ui/role-guard'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { ScrollToTop } from '@/components/navigation/ScrollToTop'
import { recoverFromDynamicImportError } from '@/lib/version-cache'

const loadLanding = () => import('@/pages/Landing')
const loadAuth = () => import('@/pages/Auth')
const loadStore = () => import('@/pages/Store')
const loadLibrary = () => import('@/pages/Library')
const loadReader = () => import('@/pages/Reader')
const loadBookLanding = () => import('@/pages/BookLanding')
const loadUpload = () => import('@/pages/Upload')
const loadEdit = () => import('@/pages/Edit')
const loadEditV2 = () => import('@/features/editor-v2/EditorV2Page')
const loadPublish = () => import('@/pages/Publish')
const loadPublisher = () => import('@/pages/Publisher')
const loadPublisherSettings = () => import('@/pages/PublisherSettings')
const loadAdmin = () => import('@/pages/Admin')
const loadCredits = () => import('@/pages/Credits')
const loadEditorRequests = () => import('@/pages/EditorRequests')
const loadProfile = () => import('@/pages/Profile')
const loadInstall = () => import('@/pages/Install')
const loadWordAddin = () => import('@/pages/WordAddin')
const loadAudioStudioPage = () => import('@/pages/AudioStudioPage')
const loadAudioReader = () => import('@/pages/AudioReader')
const loadNotFound = () => import('@/pages/NotFound')

const Landing = lazy(loadLanding)
const Auth = lazy(loadAuth)
const Store = lazy(loadStore)
const Library = lazy(loadLibrary)
const Reader = lazy(loadReader)
const BookLanding = lazy(loadBookLanding)
const Upload = lazy(loadUpload)
const Edit = lazy(loadEdit)
const EditV2 = lazy(loadEditV2)
const Publish = lazy(loadPublish)
const Publisher = lazy(loadPublisher)
const PublisherSettings = lazy(loadPublisherSettings)
const Admin = lazy(loadAdmin)
const Credits = lazy(loadCredits)
const EditorRequests = lazy(loadEditorRequests)
const Profile = lazy(loadProfile)
const Install = lazy(loadInstall)
const WordAddin = lazy(loadWordAddin)
const AudioStudioPage = lazy(loadAudioStudioPage)
const AudioReader = lazy(loadAudioReader)
const NotFound = lazy(loadNotFound)

function preloadRoutesWhenIdle(loaders: Array<() => Promise<unknown>>) {
  if (typeof window === 'undefined' || !loaders.length) return () => {}
  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
    cancelIdleCallback?: (handle: number) => void
  }
  const run = () => loaders.forEach(loader => void loader().catch(error => recoverFromDynamicImportError(error)))
  if (idleWindow.requestIdleCallback) {
    const handle = idleWindow.requestIdleCallback(run, { timeout: 2400 })
    return () => idleWindow.cancelIdleCallback?.(handle)
  }
  const handle = window.setTimeout(run, 900)
  return () => window.clearTimeout(handle)
}

function RouteLoading() {
  return (
    <div className="min-h-[55vh] grid place-items-center px-6">
      <div className="menu-glass-70 rounded-2xl border px-6 py-5 text-center shadow-soft">
        <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        <p className="text-sm font-semibold text-foreground">در حال آماده‌سازی صفحه...</p>
      </div>
    </div>
  )
}

function App() {
  const location = useLocation()

  useEffect(() => {
    const pathname = location.pathname
    if (pathname.startsWith('/publisher/')) return preloadRoutesWhenIdle([loadEdit, loadEditV2, loadReader, loadUpload])
    if (pathname.startsWith('/b/') || pathname === '/library' || pathname === '/store') return preloadRoutesWhenIdle([loadReader])
    if (pathname.startsWith('/edit/')) return preloadRoutesWhenIdle([loadReader])
    if (pathname.startsWith('/edit-v2/')) return preloadRoutesWhenIdle([loadReader])
    return undefined
  }, [location.pathname])

  useEffect(() => {
    let activeReference: HTMLElement | null = null
    const positionTooltip = (reference: HTMLElement | null) => {
      if (!reference) return
      const rect = reference.getBoundingClientRect()
      const tooltipWidth = Math.min(448, window.innerWidth - 32)
      const tooltipMaxHeight = Math.min(288, window.innerHeight * 0.46)
      const edge = 16
      const bottomSafeArea = 92
      const centerX = rect.left + rect.width / 2
      const x = Math.min(Math.max(centerX, tooltipWidth / 2 + edge), window.innerWidth - tooltipWidth / 2 - edge)
      const spaceBelow = window.innerHeight - rect.bottom - bottomSafeArea
      const spaceAbove = rect.top - edge
      const placeAbove = spaceBelow < 150 && spaceAbove > spaceBelow
      const y = placeAbove ? Math.max(edge, rect.top - 10) : Math.min(window.innerHeight - bottomSafeArea, rect.bottom + 10)
      reference.style.setProperty('--citation-tooltip-x', `${x}px`)
      reference.style.setProperty('--citation-tooltip-y', `${y}px`)
      reference.style.setProperty('--citation-tooltip-width', `${tooltipWidth}px`)
      reference.style.setProperty('--citation-tooltip-max-height', `${tooltipMaxHeight}px`)
      reference.style.setProperty('--citation-tooltip-transform', placeAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)')
      reference.dataset.tooltipPlacement = placeAbove ? 'top' : 'bottom'
    }
    const activate = (target: EventTarget | null) => {
      const reference = target instanceof Element ? target.closest<HTMLElement>('.citation-reference') : null
      if (!reference) return
      activeReference = reference
      positionTooltip(reference)
    }
    const clear = (target: EventTarget | null) => {
      const reference = target instanceof Element ? target.closest<HTMLElement>('.citation-reference') : null
      if (reference && reference !== activeReference) return
      activeReference = null
    }
    const reposition = () => positionTooltip(activeReference)
    const handlePointerOver = (event: Event) => activate(event.target)
    const handleFocusIn = (event: Event) => activate(event.target)
    const handlePointerOut = (event: Event) => clear(event.target)
    const handleFocusOut = (event: Event) => clear(event.target)
    document.addEventListener('pointerover', handlePointerOver)
    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('pointerout', handlePointerOut)
    document.addEventListener('focusout', handleFocusOut)
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      document.removeEventListener('pointerover', handlePointerOver)
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('pointerout', handlePointerOut)
      document.removeEventListener('focusout', handleFocusOut)
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [])

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground">
        <ScrollToTop />
        <OfflineBanner />
        <Navbar />
        <main className="relative">
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/store" element={<Store />} />
              <Route path="/library" element={
                <RoleGuard roles={['user', 'editor', 'publisher', 'admin', 'super_admin']}>
                  <Library />
                </RoleGuard>
              } />
              <Route path="/read/:id" element={<Reader />} />
              <Route path="/b/:id" element={<BookLanding />} />
              <Route path="/upload" element={
                <RoleGuard roles={['publisher', 'editor', 'admin', 'super_admin']}>
                  <Upload />
                </RoleGuard>
              } />
              <Route path="/edit-legacy/:id" element={
                <RoleGuard roles={['publisher', 'editor', 'admin', 'super_admin']}>
                  <Edit />
                </RoleGuard>
              } />
              <Route path="/edit/:id" element={
                <RoleGuard roles={['publisher', 'editor', 'admin', 'super_admin']}>
                  <EditV2 />
                </RoleGuard>
              } />
              <Route path="/edit-v2/:id" element={
                <RoleGuard roles={['publisher', 'editor', 'admin', 'super_admin']}>
                  <EditV2 />
                </RoleGuard>
              } />
              <Route path="/publish/:id" element={
                <RoleGuard roles={['publisher', 'admin', 'super_admin']}>
                  <Publish />
                </RoleGuard>
              } />
              <Route path="/publisher/:id" element={
                <RoleGuard roles={['publisher', 'admin', 'super_admin']}>
                  <Publisher />
                </RoleGuard>
              } />
              <Route path="/publisher/:id/settings" element={
                <RoleGuard roles={['publisher', 'admin', 'super_admin']}>
                  <PublisherSettings />
                </RoleGuard>
              } />
              <Route path="/admin" element={
                <RoleGuard roles={['admin', 'super_admin']}>
                  <Admin />
                </RoleGuard>
              } />
              <Route path="/credits" element={
                <RoleGuard roles={['user', 'editor', 'publisher', 'admin', 'super_admin']}>
                  <Credits />
                </RoleGuard>
              } />
              <Route path="/editor-requests" element={
                <RoleGuard roles={['editor', 'publisher', 'admin', 'super_admin']}>
                  <EditorRequests />
                </RoleGuard>
              } />
              <Route path="/profile" element={
                <RoleGuard roles={['user', 'editor', 'publisher', 'admin', 'super_admin']}>
                  <Profile />
                </RoleGuard>
              } />
              <Route path="/install" element={<Install />} />
              <Route path="/word-addin" element={
                <RoleGuard roles={['publisher', 'editor', 'admin', 'super_admin']}>
                  <WordAddin />
                </RoleGuard>
              } />
              <Route path="/audio-studio/:id" element={
                <RoleGuard roles={['publisher', 'editor', 'admin', 'super_admin']}>
                  <AudioStudioPage />
                </RoleGuard>
              } />
              <Route path="/audio/:editionId" element={
                <RoleGuard roles={['user', 'editor', 'publisher', 'admin', 'super_admin']}>
                  <AudioReader />
                </RoleGuard>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </ErrorBoundary>
  )
}

export default App
