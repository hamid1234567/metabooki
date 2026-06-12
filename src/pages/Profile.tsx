import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/lib/i18n'
import { User } from 'lucide-react'

export default function Profile() {
  const { user } = useAuth()
  const { t } = useI18n()

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold font-display mb-8">{t('profile_title')}</h1>
      <div className="glass rounded-2xl p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-8 h-8 text-primary" />
          </div>
          <div>
            <p className="font-semibold">{user?.email}</p>
            <p className="text-sm text-muted-foreground">{user?.id}</p>
          </div>
        </div>
      </div>
    </div>
  )
}