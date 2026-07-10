import { useEffect, useRef, useState } from 'react'
import type { InteractiveV3Block } from '../types'
import { blockTitle, directionFromText, directionTextFromItem, imageValue, itemsFor, stringValue, titleValue } from './utils'

export function GalleryInteractiveV3({ block }: { block: InteractiveV3Block }) {
  const [active, setActive] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  const thumbsRef = useRef<HTMLDivElement | null>(null)
  const images = itemsFor(block, 'images').filter(item => imageValue(item) || stringValue(item.caption))
  const title = blockTitle(block)

  useEffect(() => {
    if (!isAutoPlaying || images.length <= 1) return
    const timer = window.setInterval(() => {
      setActive(value => (value + 1) % images.length)
    }, 3000)
    return () => window.clearInterval(timer)
  }, [images.length, isAutoPlaying])

  useEffect(() => {
    thumbsRef.current?.querySelector<HTMLElement>(`[data-gallery-thumb="${active}"]`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [active])

  if (!images.length) return null

  const goPrevious = () => setActive(value => (value - 1 + images.length) % images.length)
  const goNext = () => setActive(value => (value + 1) % images.length)

  return (
    <section className="interactive-v3 interactive-v3-gallery" dir={directionFromText([title, ...images.map(directionTextFromItem)].filter(Boolean).join(' '))}>
      {title && <h3>{title}</h3>}
      <div className="interactive-v3-gallery-shell">
        {images.length > 1 && (
          <button
            type="button"
            className="interactive-v3-gallery-autoplay"
            aria-pressed={!isAutoPlaying}
            aria-label={isAutoPlaying ? 'توقف حرکت خودکار' : 'شروع حرکت خودکار'}
            onClick={() => setIsAutoPlaying(value => !value)}
          >
            {isAutoPlaying ? 'Ⅱ' : '▶'}
          </button>
        )}
        {images.length > 1 && (
          <button type="button" className="interactive-v3-gallery-nav is-previous" aria-label="قبلی" onClick={goPrevious}>›</button>
        )}
        <div className="interactive-v3-gallery-viewport">
          <div className="interactive-v3-gallery-track" style={{ transform: `translateX(-${active * 100}%)` }}>
            {images.map((image, index) => {
              const caption = stringValue(image.caption)
              return (
                <figure key={image.id} className="interactive-v3-gallery-slide" aria-hidden={active !== index}>
                  {imageValue(image) ? <img src={imageValue(image)} alt={titleValue(image)} loading={index === 0 ? 'eager' : 'lazy'} /> : <div />}
                  {caption && <figcaption>{caption}</figcaption>}
                </figure>
              )
            })}
          </div>
        </div>
        {images.length > 1 && (
          <button type="button" className="interactive-v3-gallery-nav is-next" aria-label="بعدی" onClick={goNext}>‹</button>
        )}
      </div>
      {images.length > 1 && (
        <>
          <div className="interactive-v3-thumbs" ref={thumbsRef}>
            {images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                data-gallery-thumb={index}
                className={active === index ? 'is-active' : ''}
                aria-label={`نمایش تصویر ${index + 1}`}
                onClick={() => setActive(index)}
              >
                {imageValue(image) ? <img src={imageValue(image)} alt={titleValue(image)} loading="lazy" /> : <span>{index + 1}</span>}
              </button>
            ))}
          </div>
          <p className="interactive-v3-counter">{active + 1} / {images.length}</p>
        </>
      )}
    </section>
  )
}
