import { type CSSProperties, useEffect, useRef, useState } from 'react'
import type { InteractiveV3Block, InteractiveV3Item } from '../types'
import { blockTitle, bodyValue, directionFromText, directionTextFromItem, imageValue, itemsFor, titleValue } from './utils'

const STORY_ACCENTS = ['#2563eb', '#7c3aed', '#db2777', '#0891b2', '#16a34a', '#f97316']

export function StorytellingInteractiveV3({ block }: { block: InteractiveV3Block }) {
  const [active, setActive] = useState(0)
  const [renderedActive, setRenderedActive] = useState(0)
  const [outgoingActive, setOutgoingActive] = useState<number | null>(null)
  const [isCrossfading, setIsCrossfading] = useState(false)
  const fadeTimer = useRef<number | null>(null)
  const steps = itemsFor(block, 'steps')
  const safeActive = Math.min(active, Math.max(0, steps.length - 1))
  const safeRenderedActive = Math.min(renderedActive, Math.max(0, steps.length - 1))
  const title = blockTitle(block)
  const blockDir = directionFromText([title, ...steps.map(directionTextFromItem)].filter(Boolean).join(' '))
  const storyStyle = { '--story-accent': STORY_ACCENTS[safeActive % STORY_ACCENTS.length] } as CSSProperties

  useEffect(() => {
    if (active !== safeActive) setActive(safeActive)
    if (renderedActive !== safeRenderedActive) setRenderedActive(safeRenderedActive)
    if (outgoingActive !== null && outgoingActive >= steps.length) setOutgoingActive(null)
  }, [active, outgoingActive, renderedActive, safeActive, safeRenderedActive, steps.length])

  useEffect(() => () => {
    if (fadeTimer.current) window.clearTimeout(fadeTimer.current)
  }, [])

  const showStep = (index: number) => {
    if (index < 0 || index >= steps.length || index === safeActive) return
    if (fadeTimer.current) window.clearTimeout(fadeTimer.current)
    setActive(index)
    setOutgoingActive(safeRenderedActive)
    setRenderedActive(index)
    setIsCrossfading(true)
    fadeTimer.current = window.setTimeout(() => {
      setOutgoingActive(null)
      setIsCrossfading(false)
      fadeTimer.current = null
    }, 340)
  }

  const renderFrame = (step: InteractiveV3Item | undefined, index: number, state: 'incoming' | 'outgoing' | 'idle') => {
    const stepTitle = titleValue(step)
    const stepBody = bodyValue(step)
    const stepImage = imageValue(step)
    const stepDir = directionFromText([stepTitle, stepBody].filter(Boolean).join(' ')) || blockDir || 'rtl'
    return (
      <div className={`interactive-v3-story-frame is-${state}`} aria-hidden={state === 'outgoing'}>
        {stepImage && (
          <figure className="interactive-v3-story-media">
            <img src={stepImage} alt={stepTitle || title} loading={index === 0 ? 'eager' : 'lazy'} />
            <span>{index + 1} / {steps.length}</span>
          </figure>
        )}

        {(stepTitle || stepBody) && (
          <article className="interactive-v3-story-card" dir={stepDir}>
            <small>مرحله {index + 1}</small>
            {stepTitle && <h4>{stepTitle}</h4>}
            {stepBody && <p>{stepBody}</p>}
          </article>
        )}
      </div>
    )
  }

  if (!steps.length) return null

  return (
    <section className="interactive-v3 interactive-v3-story" dir={blockDir} style={storyStyle}>
      {title && <h3 className="interactive-v3-story-title">{title}</h3>}
      <div className="interactive-v3-story-layout">
        <nav className="interactive-v3-story-tabs" aria-label="Story steps">
          {steps.map((step, index) => {
            const stepTitle = titleValue(step)
            return (
              <button key={step.id} type="button" className={safeActive === index ? 'is-active' : ''} onClick={() => showStep(index)}>
                <span className="interactive-v3-story-tab-copy">
                  <small>مرحله {index + 1}</small>
                  {stepTitle && <b>{stepTitle}</b>}
                </span>
                <span className="interactive-v3-story-tab-index">{index + 1}</span>
              </button>
            )
          })}
        </nav>

        <div className="interactive-v3-story-panel">
          <div className={`interactive-v3-story-crossfade ${isCrossfading ? 'is-crossfading' : ''}`}>
            {outgoingActive !== null && renderFrame(steps[outgoingActive], outgoingActive, 'outgoing')}
            {renderFrame(steps[safeRenderedActive], safeRenderedActive, isCrossfading ? 'incoming' : 'idle')}
          </div>

          {steps.length > 1 && (
            <div className="interactive-v3-story-controls">
              <button
                type="button"
                className="interactive-v3-story-next"
                disabled={safeActive === steps.length - 1}
                aria-label="بعدی"
                onClick={() => showStep(Math.min(steps.length - 1, safeActive + 1))}
              >
                ‹ بعدی
              </button>
              <div className="interactive-v3-story-progress" aria-label={`${safeActive + 1} / ${steps.length}`}>
                {steps.map((step, index) => (
                  <button key={step.id} type="button" className={safeActive === index ? 'is-active' : ''} onClick={() => showStep(index)} />
                ))}
              </div>
              <button
                type="button"
                className="interactive-v3-story-prev"
                disabled={safeActive === 0}
                aria-label="قبلی"
                onClick={() => showStep(Math.max(0, safeActive - 1))}
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
