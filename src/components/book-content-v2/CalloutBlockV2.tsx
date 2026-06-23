import type { ReactNode } from 'react'
import type { CalloutBlockV2 as CalloutBlockDataV2 } from '@/lib/book-document-v2'

const CALLOUT_FALLBACKS: Record<string, { title: string; icon: string }> = {
  key: { title: 'نکته کلیدی', icon: '💡' },
  question: { title: 'مکث و فکر کن', icon: '❔' },
  warning: { title: 'اشتباه رایج', icon: '⚠️' },
  quote: { title: 'جمله طلایی', icon: '❝' },
  deep: { title: 'عمیق‌تر بخوان', icon: '🔍' },
  practice: { title: 'تمرین سریع', icon: '✅' },
  glossary: { title: 'تعریف واژه', icon: '📘' },
  data: { title: 'داده و منبع', icon: '📊' },
  margin: { title: 'یادداشت حاشیه‌ای', icon: '📝' },
  normal: { title: 'یادداشت', icon: '•' },
}

export function calloutMetaV2(variant = 'key') {
  return CALLOUT_FALLBACKS[variant] || CALLOUT_FALLBACKS.key
}

export function CalloutBlockV2({ block, children }: { block: CalloutBlockDataV2; children?: ReactNode }) {
  const meta = calloutMetaV2(block.variant)
  const title = block.title || meta.title
  const icon = block.icon || meta.icon
  return (
    <section
      id={block.anchor || block.id}
      className={`book-callout has-rendered-title callout-${block.variant}`}
      data-callout-variant={block.variant}
      data-callout-title={title}
      data-callout-icon={icon}
      dir="rtl"
    >
      <div className="book-callout-head">
        <span className="book-callout-icon">{icon}</span>
        <strong>{title}</strong>
      </div>
      <div className="book-callout-content">
        {children}
      </div>
    </section>
  )
}
