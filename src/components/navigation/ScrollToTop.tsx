import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

function smoothlyScrollToTop() {
  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'

  requestAnimationFrame(() => {
    requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior }))
  })
}

export function ScrollToTop() {
  const location = useLocation()

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
    smoothlyScrollToTop()
  }, [location.key])

  return null
}
