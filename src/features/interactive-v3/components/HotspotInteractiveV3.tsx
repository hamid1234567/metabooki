import { useState, type CSSProperties } from 'react'
import type { InteractiveV3Block } from '../types'
import { blockTitle, directionFromText, directionTextFromItem, itemsFor, stringValue, titleValue } from './utils'

function clampPercent(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 50
}

function fontSizeForPointCount(count: number) {
  if (count <= 5) return 13
  return Math.max(8, 13 - Math.ceil((count - 5) / 10))
}

function placementForPoint(x: number, y: number) {
  if (x > 68) return 'left'
  if (x < 32) return 'right'
  if (y > 62) return 'top'
  return 'bottom'
}

function imageWidthPercent(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(20, Math.min(100, Math.round(number))) : 100
}

export function HotspotInteractiveV3({ block }: { block: InteractiveV3Block }) {
  const [active, setActive] = useState<number | null>(null)
  const [showAll, setShowAll] = useState(false)
  const title = blockTitle(block)
  const image = stringValue(block.payload?.image)
  const caption = stringValue(block.payload?.caption)
  const points = itemsFor(block, 'points')
  const pointFontSize = fontSizeForPointCount(points.length)
  const widthPercent = imageWidthPercent(block.payload?.imageWidthPercent)
  const baseDirection = directionFromText([title, caption, ...points.map(directionTextFromItem)].filter(Boolean).join(' '))

  if (!image && !points.length) return null

  return (
    <section className="interactive-v3 interactive-v3-hotspot" dir={baseDirection} style={{ '--hotspot-image-width': `${widthPercent}%` } as CSSProperties}>
      {title && <h3>{title}</h3>}
      <div className="interactive-v3-hotspot-toolbar">
        <button type="button" className={showAll ? 'is-active' : ''} onClick={() => setShowAll(value => !value)}>
          {showAll ? 'مخفی کردن همه نقاط' : 'نمایش همه نقاط'}
        </button>
      </div>
      <div className="interactive-v3-hotspot-canvas">
        {image && <img src={image} alt={caption || title} loading="lazy" />}
        {points.map((point, index) => {
          const open = showAll || active === index
          const x = clampPercent(point.x)
          const y = clampPercent(point.y)
          const placement = placementForPoint(x, y)
          const nudge = showAll ? ((index % 5) - 2) * 10 : 0
          const pointText = stringValue(point.text)
          const pointTitle = titleValue(point, `نقطه ${index + 1}`)
          const pointDirection = directionFromText([pointTitle, pointText].filter(Boolean).join(' ')) || baseDirection
          const style = {
            '--x': `${x}%`,
            '--y': `${y}%`,
            '--hotspot-font-size': `${pointFontSize}px`,
            '--hotspot-offset': `${nudge}px`,
          } as CSSProperties

          return (
            <div
              key={point.id}
              className={`interactive-v3-hotspot-pin place-${placement} ${open ? 'is-open' : ''}`}
              style={style}
            >
              <button
                type="button"
                className={`interactive-v3-hotspot-marker ${open ? 'is-active' : ''}`}
                aria-expanded={open}
                aria-label={pointTitle}
                onClick={() => setActive(value => value === index ? null : index)}
              >
                <span>+</span>
              </button>
              {open && (
                <div className="interactive-v3-hotspot-popover interactive-v3-animated-panel" dir={pointDirection}>
                  <b>{pointTitle}</b>
                  {pointText && <small>{pointText}</small>}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {caption && <p className="interactive-v3-gallery-caption">{caption}</p>}
    </section>
  )
}
