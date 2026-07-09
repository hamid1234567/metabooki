import { useState } from 'react'
import type { InteractiveV3Block } from '../types'
import { blockTitle, directionFromText, imageValue, itemsFor, stringValue } from './utils'

export function AuthorInteractiveV3({ block }: { block: InteractiveV3Block }) {
  const [active, setActive] = useState<number | null>(null)
  const title = blockTitle(block)
  const authors = itemsFor(block, 'authors').filter(author => stringValue(author.name || author.bio || author.image))
  if (!authors.length) return null
  return (
    <section className="interactive-v3 interactive-v3-authors" dir={directionFromText(title)}>
      {title && <h3>{title}</h3>}
      <div className="interactive-v3-author-row">
        {authors.map((author, index) => (
          <button
            key={author.id}
            type="button"
            className={active === index ? 'is-active' : ''}
            onMouseEnter={() => setActive(index)}
            onFocus={() => setActive(index)}
            onClick={() => setActive(value => value === index ? null : index)}
          >
            {imageValue(author) && <img src={imageValue(author)} alt={stringValue(author.name)} loading="lazy" />}
            <span>{stringValue(author.name) || `نویسنده ${index + 1}`}</span>
            {stringValue(author.role) && <small>{stringValue(author.role)}</small>}
            {active === index && (
              <b className="interactive-v3-author-popover">
                {imageValue(author) && <img src={imageValue(author)} alt="" loading="lazy" />}
                <strong>{stringValue(author.name)}</strong>
                {stringValue(author.bio) && <em>{stringValue(author.bio)}</em>}
              </b>
            )}
          </button>
        ))}
      </div>
    </section>
  )
}
