import { type CSSProperties, useEffect, useRef, useState } from 'react'
import type { InteractiveV3Block } from '../types'
import { blockTitle, bodyValue, directionFromText, directionTextFromItem, imageValue, itemsFor, titleValue } from './utils'

const STORY_ACCENTS = ['#2563eb', '#7c3aed', '#db2777', '#0891b2', '#16a34a', '#f97316']

export function StorytellingInteractiveV3({ block }: { block: InteractiveV3Block }) {
  const [active, setActive] = useState(0)
  const [visibleActive, setVisibleActive] = useState(0)
  const [fadePhase, setFadePhase] = useState<'idle' | 'out' | 'in'>('idle')
  const fadeTimer = useRef<number | null>(null)
  const steps = itemsFor(block, 'steps')
  const safeActive = Math.min(active, Math.max(0, steps.length - 1))
  const safeVisibleActive = Math.min(visibleActive, Math.max(0, steps.length - 1))
  const current = steps[safeVisibleActive]
  const title = blockTitle(block)
  const blockDir = directionFromText([title, ...steps.map(directionTextFromItem)].filter(Boolean).join(' '))
  const currentTitle = titleValue(current)
  const currentBody = bodyValue(current)
  const currentImage = imageValue(current)
  const currentDir = directionFromText([currentTitle, currentBody].filter(Boolean).join(' ')) || blockDir || 'rtl'
  const storyStyle = { '--story-accent': STORY_ACCENTS[safeActive % STORY_ACCENTS.length] } as CSSProperties

  useEffect(() => {
    if (active !== safeActive) setActive(safeActive)
    if (visibleActive !== safeVisibleActive) setVisibleActive(safeVisibleActive)
  }, [active, safeActive, safeVisibleActive, visibleActive])

  useEffect(() => () => {
    if (fadeTimer.current) window.clearTimeout(fadeTimer.current)
  }, [])

  const showStep = (index: number) => {
    if (index < 0 || index >= steps.length || index === safeActive) return
    if (fadeTimer.current) window.clearTimeout(fadeTimer.current)
    setActive(index)
    setFadePhase('out')
    fadeTimer.current = window.setTimeout(() => {
      setVisibleActive(index)
      setFadePhase('in')
      fadeTimer.current = window.setTimeout(() => {
        setFadePhase('idle')
        fadeTimer.current = null
      }, 280)
    }, 180)
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
          <div className={`interactive-v3-story-frame is-${fadePhase}`}>
            {currentImage && (
              <figure className="interactive-v3-story-media">
                <img src={currentImage} alt={currentTitle || title} loading={safeVisibleActive === 0 ? 'eager' : 'lazy'} />
                <span>{safeVisibleActive + 1} / {steps.length}</span>
              </figure>
            )}

            {(currentTitle || currentBody) && (
              <article className="interactive-v3-story-card" dir={currentDir}>
                <small>مرحله {safeVisibleActive + 1}</small>
                {currentTitle && <h4>{currentTitle}</h4>}
                {currentBody && <p>{currentBody}</p>}
              </article>
            )}
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
