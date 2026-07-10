import { useEffect, useState } from 'react'
import type { InteractiveV3Block, InteractiveV3Item } from '../types'
import { blockTitle, directionFromText, directionTextFromItem, imageValue, itemsFor, stringValue, titleValue } from './utils'

type GalleryVisualItem = {
  image: InteractiveV3Item
  index: number
}

export function GalleryInteractiveV3({ block }: { block: InteractiveV3Block }) {
  const [active, setActive] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  const [showCaption, setShowCaption] = useState(true)
  const images = itemsFor(block, 'images').filter(item => imageValue(item) || stringValue(item.caption))
  const title = blockTitle(block)
  const dir = directionFromText([title, ...images.map(directionTextFromItem)].filter(Boolean).join(' '))
  const isRtl = (dir || 'rtl') === 'rtl'
  const visualImages: GalleryVisualItem[] = isRtl
    ? images.map((image, index) => ({ image, index })).reverse()
    : images.map((image, index) => ({ image, index }))
  const visualActive = isRtl ? images.length - 1 - active : active
  const translate = -visualActive * 100

  useEffect(() => {
    if (!isAutoPlaying || images.length <= 1) return
    const timer = window.setInterval(() => {
      setActive(value => (value + 1) % images.length)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [images.length, isAutoPlaying])

  if (!images.length) return null

  return (
    <section className={`interactive-v3 interactive-v3-gallery ${isRtl ? 'is-rtl' : 'is-ltr'}`} dir={dir}>
      {title && <h3>{title}</h3>}
      <div className="interactive-v3-gallery-stage">
        <div className="interactive-v3-gallery-frame">
          {images.length > 1 && (
            <div className="interactive-v3-gallery-overlay-controls">
              <button
                type="button"
                className="interactive-v3-gallery-timer"
                aria-pressed={!isAutoPlaying}
                aria-label={isAutoPlaying ? 'توقف حرکت خودکار' : 'شروع حرکت خودکار'}
                onClick={() => setIsAutoPlaying(value => !value)}
              >
                {isAutoPlaying ? 'Ⅱ' : isRtl ? '▶' : '◀'}
              </button>
              <button
                type="button"
                className={`interactive-v3-gallery-caption-toggle ${showCaption ? 'is-caption-on' : 'is-caption-off'}`}
                aria-pressed={showCaption}
                aria-label={showCaption ? 'مخفی کردن کپشن' : 'نمایش کپشن'}
                onClick={() => setShowCaption(value => !value)}
              >
                CC
              </button>
            </div>
          )}
          <div className="interactive-v3-gallery-track" style={{ transform: `translateX(${translate}%)` }}>
            {visualImages.map(({ image, index }) => {
              const caption = stringValue(image.caption)
              return (
                <figure key={image.id} className="interactive-v3-gallery-slide" aria-hidden={active !== index}>
                  {imageValue(image) && <img src={imageValue(image)} alt={titleValue(image)} loading={index === 0 ? 'eager' : 'lazy'} />}
                  {showCaption && caption && <figcaption>{caption}</figcaption>}
                </figure>
              )
            })}
          </div>
        </div>
      </div>
      {images.length > 1 && (
        <div className="interactive-v3-nav-actions interactive-v3-gallery-actions">
          <button type="button" disabled={active === 0} aria-label="قبلی" onClick={() => setActive(value => Math.max(0, value - 1))}>›</button>
          <span>{active + 1} / {images.length}</span>
          <button type="button" disabled={active === images.length - 1} aria-label="بعدی" onClick={() => setActive(value => Math.min(images.length - 1, value + 1))}>‹</button>
        </div>
      )}
      {images.length > 1 && (
        <div className="interactive-v3-thumbs">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              className={active === index ? 'is-active' : ''}
              data-skip-image-zoom="true"
              onClick={event => {
                event.preventDefault()
                event.stopPropagation()
                setActive(index)
              }}
            >
              {imageValue(image) ? <img src={imageValue(image)} alt={titleValue(image)} loading="lazy" /> : <span>{index + 1}</span>}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
