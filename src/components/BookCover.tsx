import { useState } from 'react'
import { BookOpen } from 'lucide-react'

interface BookCoverProps {
  src?: string | null
  title: string
  category?: string
  className?: string
  loading?: 'eager' | 'lazy'
}

export function BookCover({ src, title, category = 'کتاب', className = '', loading = 'lazy' }: BookCoverProps) {
  const [failed, setFailed] = useState(!src)
  const [loaded, setLoaded] = useState(false)

  return (
    <div className={`book-cover-art ${className}`} data-category={category}>
      <div className="book-cover-art-fallback">
        <BookOpen aria-hidden="true" />
        <span>{category}</span>
        <strong>{title}</strong>
        <small>متابوکی</small>
      </div>
      {!failed && (
        <img
          src={src || ''}
          alt={title}
          loading={loading}
          className={loaded ? 'is-loaded' : ''}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}
