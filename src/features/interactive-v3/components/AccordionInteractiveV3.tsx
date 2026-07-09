import { useState } from 'react'
import type { InteractiveV3Block } from '../types'
import { blockTitle, bodyValue, directionFromText, imageValue, itemsFor, titleValue, MediaTextCard } from './utils'

export function AccordionInteractiveV3({ block }: { block: InteractiveV3Block }) {
  const [open, setOpen] = useState<Set<number>>(() => new Set([0]))
  const items = itemsFor(block, 'items')
  const title = blockTitle(block)
  if (!items.length) return null
  return (
    <section className="interactive-v3 interactive-v3-accordion" dir={directionFromText(title)}>
      {title && <h3>{title}</h3>}
      {items.map((item, index) => {
        const active = open.has(index)
        const itemTitle = titleValue(item, `بخش ${index + 1}`)
        return (
          <article key={item.id} className={active ? 'is-active' : ''}>
            <button
              type="button"
              onClick={() => setOpen(previous => {
                const next = new Set(previous)
                if (next.has(index)) next.delete(index)
                else next.add(index)
                return next
              })}
            >
              <span>{active ? '−' : '+'}</span>
              {itemTitle}
            </button>
            {active && <MediaTextCard image={imageValue(item)} title={itemTitle} body={bodyValue(item)} index={index} />}
          </article>
        )
      })}
    </section>
  )
}
