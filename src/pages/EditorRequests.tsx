import { useI18n } from '@/lib/i18n'

export default function EditorRequests() {
  const { t } = useI18n()
  return <div className="max-w-4xl mx-auto px-4 py-8"><h1 className="text-3xl font-bold font-display mb-8">{t('nav_editor_requests')}</h1></div>
}