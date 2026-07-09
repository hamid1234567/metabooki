import { useState } from 'react'
import type { InteractiveV3Block } from '../types'
import { blockTitle, directionFromText, imageValue, itemsFor, stringValue, titleValue } from './utils'

export function GalleryInteractiveV3({ block }: { block: InteractiveV3Block }) {
  const [active, setActive] = useState(0)
  const images = itemsFor(block, 'images').filter(item => imageValue(item) || stringValue(item.caption))
  const current = images[active]
  const title = blockTitle(block)
  if (!images.length) return null
  return (
    <section className="interactive-v3 interactive-v3-gallery" dir={directionFromText(title)}>
      {title && <h3>{title}</h3>}
      <div className="interactive-v3-gallery-stage">
        <button type="button" disabled={active === 0} onClick={() => setActive(value => Math.max(0, value - 1))}>‹</button>
        {imageValue(current) && <img src={imageValue(current)} alt={titleValue(current)} loading="lazy" />}
        <button type="button" disabled={active === images.length - 1} onClick={() => setActive(value => Math.min(images.length - 1, value + 1))}>›</button>
      </div>
      {stringValue(current?.caption) && <p className="interactive-v3-gallery-caption">{stringValue(current?.caption)}</p>}
      <div className="interactive-v3-thumbs">
        {images.map((image, index) => (
          <button key={image.id} type="button" className={active === index ? 'is-active' : ''} onClick={() => setActive(index)}>
            {imageValue(image) ? <img src={imageValue(image)} alt={titleValue(image)} loading="lazy" /> : <span>{index + 1}</span>}
          </button>
        ))}
      </div>
    </section>
  )
}
