import { useEffect, useRef, useState } from 'react'
import type { InteractiveV3Block } from '../types'
import { blockTitle, directionFromText, directionTextFromItem, imageValue, itemsFor, stringValue } from './utils'

export function AuthorInteractiveV3({ block }: { block: InteractiveV3Block }) {
  const [active, setActive] = useState<number | null>(null)
  const [exiting, setExiting] = useState<number | null>(null)
  const exitTimerRef = useRef<number | null>(null)
  const title = blockTitle(block)
  const authors = itemsFor(block, 'authors').filter(author => stringValue(author.name || author.bio || author.image))

  useEffect(() => () => {
    if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current)
  }, [])

  const clearExitTimer = () => {
    if (!exitTimerRef.current) return
    window.clearTimeout(exitTimerRef.current)
    exitTimerRef.current = null
  }

  const openAuthor = (index: number) => {
    clearExitTimer()
    setExiting(null)
    setActive(index)
  }

  const closeAuthor = (index: number) => {
    if (active !== index) return
    clearExitTimer()
    setActive(null)
    setExiting(index)
    exitTimerRef.current = window.setTimeout(() => {
      setExiting(null)
      exitTimerRef.current = null
    }, 240)
  }

  if (!authors.length) return null
  return (
    <section className="interactive-v3 interactive-v3-authors" dir={directionFromText([title, ...authors.map(directionTextFromItem)].filter(Boolean).join(' '))}>
      {title && <h3>{title}</h3>}
      <div className="interactive-v3-author-row">
        {authors.map((author, index) => (
          <button
            key={author.id}
            type="button"
            className={active === index ? 'is-active' : ''}
            onMouseEnter={() => openAuthor(index)}
            onMouseLeave={() => closeAuthor(index)}
            onFocus={() => openAuthor(index)}
            onBlur={() => closeAuthor(index)}
            onClick={() => active === index ? closeAuthor(index) : openAuthor(index)}
          >
            {imageValue(author) && <img src={imageValue(author)} alt={stringValue(author.name)} loading="lazy" />}
            <span>{stringValue(author.name) || `نویسنده ${index + 1}`}</span>
            {stringValue(author.role) && <small>{stringValue(author.role)}</small>}
            {(active === index || exiting === index) && (
              <b className={`interactive-v3-author-popover ${exiting === index ? 'is-exiting' : 'is-entering'}`}>
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
