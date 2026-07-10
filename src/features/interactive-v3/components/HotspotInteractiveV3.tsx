import { useState } from 'react'
import type { InteractiveV3Block } from '../types'
import { blockTitle, directionFromText, directionTextFromItem, itemsFor, stringValue, titleValue } from './utils'

function clampPercent(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 50
}

export function HotspotInteractiveV3({ block }: { block: InteractiveV3Block }) {
  const [active, setActive] = useState<number | null>(null)
  const [showAll, setShowAll] = useState(false)
  const title = blockTitle(block)
  const image = stringValue(block.payload?.image)
  const caption = stringValue(block.payload?.caption)
  const points = itemsFor(block, 'points')
  if (!image && !points.length) return null
  return (
    <section className="interactive-v3 interactive-v3-hotspot" dir={directionFromText([title, caption, ...points.map(directionTextFromItem)].filter(Boolean).join(' '))}>
      {title && <h3>{title}</h3>}
      <div className="interactive-v3-hotspot-toolbar">
        <button type="button" className={showAll ? 'is-active' : ''} onClick={() => setShowAll(value => !value)}>{showAll ? 'مخفی کردن همه' : 'نمایش همه'}</button>
      </div>
      <div className="interactive-v3-hotspot-canvas">
        {image && <img src={image} alt={caption || title} loading="lazy" />}
        {points.map((point, index) => {
          const open = showAll || active === index
          return (
            <button
              key={point.id}
              type="button"
              className={`interactive-v3-hotspot-point ${open ? 'is-active' : ''}`}
              style={{ left: `${clampPercent(point.x)}%`, top: `${clampPercent(point.y)}%` }}
              onClick={() => setActive(value => value === index ? null : index)}
            >
              <span>+</span>
              {open && (
                <b className="interactive-v3-hotspot-popover interactive-v3-animated-panel">
                  {titleValue(point, `نقطه ${index + 1}`)}
                  {stringValue(point.text) && <small>{stringValue(point.text)}</small>}
                </b>
              )}
            </button>
          )
        })}
      </div>
      {caption && <p className="interactive-v3-gallery-caption">{caption}</p>}
    </section>
  )
}
