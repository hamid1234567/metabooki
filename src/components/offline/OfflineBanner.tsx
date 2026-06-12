import { useState, useEffect } from 'react'
import { useI18n } from '@/lib/i18n'
import { Wifi, WifiOff } from 'lucide-react'

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const { t } = useI18n()

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div className="bg-warning text-warning-foreground px-4 py-2 text-sm text-center flex items-center justify-center gap-2">
      <WifiOff className="w-4 h-4" />
      <span>{t('offline_banner')}</span>
    </div>
  )
}