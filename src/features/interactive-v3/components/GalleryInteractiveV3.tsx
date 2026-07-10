import { useEffect, useState } from 'react'
import type { InteractiveV3Block } from '../types'
import { blockTitle, directionFromText, directionTextFromItem, imageValue, itemsFor, stringValue, titleValue } from './utils'

export function GalleryInteractiveV3({ block }: { block: InteractiveV3Block }) {
  const [active, setActive] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  const images = itemsFor(block, 'images').filter(item => imageValue(item) || stringValue(item.caption))
  const current = images[active]
  const title = blockTitle(block)

  useEffect(() => {
    if (!isAutoPlaying || images.length <= 1) return
    const timer = window.setInterval(() => {
      setActive(value => (value + 1) % images.length)
    }, 3000)
    return () => window.clearInterval(timer)
  }, [images.length, isAutoPlaying])

  if (!images.length) return null

  return (
    <section className="interactive-v3 interactive-v3-gallery" dir={directionFromText([title, ...images.map(directionTextFromItem)].filter(Boolean).join(' '))}>
      {title && <h3>{title}</h3>}
      <div className="interactive-v3-gallery-stage">
        <div key={current?.id || active} className="interactive-v3-gallery-frame interactive-v3-animated-panel">
          {imageValue(current) && <img src={imageValue(current)} alt={titleValue(current)} loading="lazy" />}
        </div>
      </div>
      {images.length > 1 && (
        <div className="interactive-v3-nav-actions">
          <button type="button" disabled={active === 0} aria-label="قبلی" onClick={() => setActive(value => Math.max(0, value - 1))}>›</button>
          <button
            type="button"
            className="interactive-v3-gallery-timer"
            aria-pressed={!isAutoPlaying}
            aria-label={isAutoPlaying ? 'توقف حرکت خودکار' : 'شروع حرکت خودکار'}
            onClick={() => setIsAutoPlaying(value => !value)}
          >
            {isAutoPlaying ? 'Ⅱ' : '▶'}
          </button>
          <span>{active + 1} / {images.length}</span>
          <button type="button" disabled={active === images.length - 1} aria-label="بعدی" onClick={() => setActive(value => Math.min(images.length - 1, value + 1))}>‹</button>
        </div>
      )}
      {stringValue(current?.caption) && <p key={`caption-${current?.id || active}`} className="interactive-v3-gallery-caption interactive-v3-animated-panel">{stringValue(current?.caption)}</p>}
      {images.length > 1 && (
        <div className="interactive-v3-thumbs">
          {images.map((image, index) => (
            <button key={image.id} type="button" className={active === index ? 'is-active' : ''} onClick={() => setActive(index)}>
              {imageValue(image) ? <img src={imageValue(image)} alt={titleValue(image)} loading="lazy" /> : <span>{index + 1}</span>}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
