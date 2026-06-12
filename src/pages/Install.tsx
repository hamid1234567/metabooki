import { useI18n } from '@/lib/i18n'
import { Download, Smartphone, Monitor } from 'lucide-react'

export default function Install() {
  const { t } = useI18n()

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold font-display mb-8">{t('install_title')}</h1>
      <p className="text-muted-foreground mb-8">{t('install_description')}</p>
      <div className="glass rounded-2xl p-8 text-center">
        <Download className="w-16 h-16 text-primary mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">{t('install_pwa')}</h2>
        <p className="text-muted-foreground mb-4">{t('install_button')}</p>
      </div>
    </div>
  )
}