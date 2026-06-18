import React, { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Navbar } from '@/components/navbar/Navbar'
import { OfflineBanner } from '@/components/offline/OfflineBanner'
import { RoleGuard } from '@/components/ui/role-guard'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { ScrollToTop } from '@/components/navigation/ScrollToTop'

// Direct imports (no lazy loading for stability)
import Landing from '@/pages/Landing'
import Auth from '@/pages/Auth'
import Store from '@/pages/Store'
import Library from '@/pages/Library'
import Reader from '@/pages/Reader'
import BookLanding from '@/pages/BookLanding'
import Upload from '@/pages/Upload'
import Edit from '@/pages/Edit'
import Publish from '@/pages/Publish'
import Publisher from '@/pages/Publisher'
import PublisherSettings from '@/pages/PublisherSettings'
import Admin from '@/pages/Admin'
import Credits from '@/pages/Credits'
import EditorRequests from '@/pages/EditorRequests'
import Profile from '@/pages/Profile'
import Install from '@/pages/Install'
import WordAddin from '@/pages/WordAddin'
import AudioStudioPage from '@/pages/AudioStudioPage'
import AudioReader from '@/pages/AudioReader'
import NotFound from '@/pages/NotFound'

function App() {
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
            <Route path="/edit/:id" element={
              <RoleGuard roles={['publisher', 'editor', 'admin', 'super_admin']}>
                <Edit />
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
        </main>
      </div>
    </ErrorBoundary>
  )
}

export default App
