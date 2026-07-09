import { useState } from 'react'
import type { InteractiveV3Block } from '../types'
import { blockTitle, directionFromText, imageValue, itemsFor, stringValue } from './utils'

export function FlashcardInteractiveV3({ block }: { block: InteractiveV3Block }) {
  const [active, setActive] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const cards = itemsFor(block, 'cards')
  const card = cards[active]
  const title = blockTitle(block)
  const front = stringValue(card?.front || card?.title)
  const back = stringValue(card?.back || card?.description)
  const image = imageValue(card)
  if (!cards.length) return null
  return (
    <section className="interactive-v3 interactive-v3-flashcard" dir={directionFromText(`${front} ${back} ${title}`)}>
      {title && <h3>{title}</h3>}
      <div className="interactive-v3-tab-row">
        {cards.map((_, index) => (
          <button key={index} type="button" className={active === index ? 'is-active' : ''} onClick={() => { setActive(index); setFlipped(false) }}>
            {index + 1}
          </button>
        ))}
      </div>
      <button type="button" className={`interactive-v3-card ${flipped ? 'is-flipped' : ''}`} onClick={() => setFlipped(value => !value)}>
        <span className="interactive-v3-card-face interactive-v3-card-front">
          {image && <img src={image} alt={front || ''} loading="lazy" />}
          {front && <b>{front}</b>}
        </span>
        <span className="interactive-v3-card-face interactive-v3-card-back">
          {back && <b>{back}</b>}
        </span>
      </button>
    </section>
  )
}
