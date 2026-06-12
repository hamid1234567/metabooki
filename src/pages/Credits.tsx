import { useAuth } from '@/hooks/useAuth'
import { useCredits } from '@/hooks/useCredits'
import { useI18n } from '@/lib/i18n'
import { CreditCard, History } from 'lucide-react'

export default function Credits() {
  const { user } = useAuth()
  const { balance } = useCredits(user)
  const { t } = useI18n()

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold font-display mb-8">{t('credits_balance')}</h1>
      <div className="glass rounded-2xl p-8 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">{t('credits_balance')}</p>
              <p className="text-3xl font-bold">{balance.toLocaleString()} <span className="text-lg text-muted-foreground">اعتبار</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}