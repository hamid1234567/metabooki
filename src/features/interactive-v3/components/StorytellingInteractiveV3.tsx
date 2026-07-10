import { useState } from 'react'
import type { InteractiveV3Block } from '../types'
import { blockTitle, bodyValue, directionFromText, imageValue, itemsFor, titleValue, MediaTextCard } from './utils'

export function StorytellingInteractiveV3({ block }: { block: InteractiveV3Block }) {
  const [active, setActive] = useState(0)
  const steps = itemsFor(block, 'steps')
  const current = steps[active]
  const title = blockTitle(block)
  if (!steps.length) return null
  return (
    <section className="interactive-v3 interactive-v3-story" dir={directionFromText(`${title} ${titleValue(current)}`)}>
      {title && <h3>{title}</h3>}
      <div className="interactive-v3-story-layout">
        <div className="interactive-v3-story-tabs">
          {steps.map((step, index) => (
            <button key={step.id} type="button" className={active === index ? 'is-active' : ''} onClick={() => setActive(index)}>
              <span>{index + 1}</span>
              {titleValue(step, `مرحله ${index + 1}`)}
            </button>
          ))}
        </div>
        <div className="interactive-v3-story-panel">
          <MediaTextCard key={current?.id || active} image={imageValue(current)} title={titleValue(current)} body={bodyValue(current)} index={active} />
          <div className="interactive-v3-step-actions">
            <button type="button" disabled={active === 0} onClick={() => setActive(value => Math.max(0, value - 1))}>‹</button>
            <span>{active + 1} / {steps.length}</span>
            <button type="button" disabled={active === steps.length - 1} onClick={() => setActive(value => Math.min(steps.length - 1, value + 1))}>›</button>
          </div>
        </div>
      </div>
    </section>
  )
}
