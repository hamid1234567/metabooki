import { useState } from 'react'
import type { InteractiveV3Block } from '../types'
import { blockTitle, bodyValue, directionFromText, imageValue, itemsFor, titleValue, MediaTextCard } from './utils'

export function TimelineInteractiveV3({ block }: { block: InteractiveV3Block }) {
  const [active, setActive] = useState(0)
  const events = itemsFor(block, 'events')
  const current = events[active]
  const title = blockTitle(block)
  if (!events.length) return null
  const dir = directionFromText([title, ...events.map(item => titleValue(item))].join(' '))
  return (
    <section className="interactive-v3 interactive-v3-timeline" dir={dir}>
      {title && <h3>{title}</h3>}
      <div className="interactive-v3-timeline-track" style={{ gridTemplateColumns: `repeat(${events.length}, minmax(0, 1fr))` }}>
        {events.map((event, index) => (
          <button key={event.id} type="button" className={active === index ? 'is-active' : ''} onClick={() => setActive(index)}>
            <span>{index + 1}</span>
            <small>{titleValue(event, `${index + 1}`)}</small>
          </button>
        ))}
      </div>
      <div className="interactive-v3-stage-wrap">
        <button type="button" className="interactive-v3-side-nav" disabled={active === 0} onClick={() => setActive(value => Math.max(0, value - 1))}>‹</button>
        <MediaTextCard key={current?.id || active} image={imageValue(current)} title={titleValue(current)} body={bodyValue(current)} index={active} />
        <button type="button" className="interactive-v3-side-nav" disabled={active === events.length - 1} onClick={() => setActive(value => Math.min(events.length - 1, value + 1))}>›</button>
      </div>
      <p className="interactive-v3-counter">{active + 1} / {events.length}</p>
    </section>
  )
}
