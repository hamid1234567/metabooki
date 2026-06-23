import { pageBoundaryLabelsV2 } from '@/lib/book-document-v2'
import type { BookPageV2 } from '@/lib/book-document-v2'

export function PageBreakV2({ previous, next }: { previous?: BookPageV2; next?: BookPageV2 }) {
  const labels = pageBoundaryLabelsV2(previous, next)
  return (
    <div
      className="book-page-divider book-page-divider-v2"
      data-before={labels.before}
      data-after={labels.after}
      data-page-label={labels.page}
      aria-label={labels.page}
    >
      <span>{labels.page}</span>
    </div>
  )
}
