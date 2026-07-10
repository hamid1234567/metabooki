import { type CSSProperties, useState } from 'react'
import type { InteractiveV3Block } from '../types'
import { blockTitle, bodyValue, directionFromText, directionTextFromItem, imageValue, itemsFor, titleValue } from './utils'

const STORY_ACCENTS = ['#2563eb', '#7c3aed', '#db2777', '#0891b2', '#16a34a', '#f97316']

export function StorytellingInteractiveV3({ block }: { block: InteractiveV3Block }) {
  const [active, setActive] = useState(0)
  const steps = itemsFor(block, 'steps')
  const current = steps[active]
  const title = blockTitle(block)
  const blockDir = directionFromText([title, ...steps.map(directionTextFromItem)].filter(Boolean).join(' '))
  const currentTitle = titleValue(current, `مرحله ${active + 1}`)
  const currentBody = bodyValue(current)
  const currentImage = imageValue(current)
  const currentDir = directionFromText([currentTitle, currentBody].filter(Boolean).join(' ')) || blockDir || 'rtl'
  const storyStyle = { '--story-accent': STORY_ACCENTS[active % STORY_ACCENTS.length] } as CSSProperties

  if (!steps.length) return null

  return (
    <section className="interactive-v3 interactive-v3-story" dir={blockDir} style={storyStyle}>
      {title && <h3 className="interactive-v3-story-title">{title}</h3>}
      <div className="interactive-v3-story-layout">
        <nav className="interactive-v3-story-tabs" aria-label="Story steps">
          {steps.map((step, index) => {
            const stepTitle = titleValue(step, `مرحله ${index + 1}`)
            return (
              <button key={step.id} type="button" className={active === index ? 'is-active' : ''} onClick={() => setActive(index)}>
                <span className="interactive-v3-story-tab-copy">
                  <small>مرحله {index + 1}</small>
                  <b>{stepTitle}</b>
                </span>
                <span className="interactive-v3-story-tab-index">{index + 1}</span>
              </button>
            )
          })}
        </nav>

        <div className="interactive-v3-story-panel">
          <div key={current?.id || active} className="interactive-v3-story-frame interactive-v3-animated-panel">
            {currentImage && (
              <figure className="interactive-v3-story-media">
                <img src={currentImage} alt={currentTitle} loading={active === 0 ? 'eager' : 'lazy'} />
                <span>{active + 1} / {steps.length}</span>
              </figure>
            )}

            <article className="interactive-v3-story-card" dir={currentDir}>
              <small>مرحله {active + 1}</small>
              {currentTitle && <h4>{currentTitle}</h4>}
              {currentBody && <p>{currentBody}</p>}
            </article>
          </div>

          {steps.length > 1 && (
            <div className="interactive-v3-story-controls">
              <button
                type="button"
                className="interactive-v3-story-next"
                disabled={active === steps.length - 1}
                aria-label="بعدی"
                onClick={() => setActive(value => Math.min(steps.length - 1, value + 1))}
              >
                ‹ بعدی
              </button>
              <div className="interactive-v3-story-progress" aria-label={`${active + 1} / ${steps.length}`}>
                {steps.map(step => (
                  <button key={step.id} type="button" className={steps[active]?.id === step.id ? 'is-active' : ''} onClick={() => setActive(steps.indexOf(step))} />
                ))}
              </div>
              <button
                type="button"
                className="interactive-v3-story-prev"
                disabled={active === 0}
                aria-label="قبلی"
                onClick={() => setActive(value => Math.max(0, value - 1))}
              >
                قبلی ›
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
