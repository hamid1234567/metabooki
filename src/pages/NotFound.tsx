import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { ArrowLeft } from 'lucide-react'

export default function NotFound() {
  const { t } = useI18n()

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold font-display text-primary mb-4">404</h1>
        <h2 className="text-2xl font-semibold mb-2">{t('not_found')}</h2>
        <p className="text-muted-foreground mb-8">{t('not_found_desc')}</p>
        <Link to="/">
          <Button className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            {t('back')}
          </Button>
        </Link>
      </div>
    </div>
  )
}