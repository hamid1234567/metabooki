import { useState } from 'react'
import type { InteractiveV3Block } from '../types'
import { blockTitle, bodyValue, directionFromText, imageValue, itemsFor, titleValue, MediaTextCard } from './utils'

export function TabsInteractiveV3({ block }: { block: InteractiveV3Block }) {
  const [active, setActive] = useState(0)
  const tabs = itemsFor(block, 'tabs')
  const current = tabs[active]
  const title = blockTitle(block)
  if (!tabs.length) return null
  return (
    <section className="interactive-v3 interactive-v3-tabs" dir={directionFromText(`${title} ${titleValue(current)} ${bodyValue(current)}`)}>
      {title && <h3>{title}</h3>}
      <div className="interactive-v3-tab-row">
        {tabs.map((tab, index) => (
          <button key={tab.id} type="button" className={active === index ? 'is-active' : ''} onClick={() => setActive(index)}>
            {titleValue(tab, `تب ${index + 1}`)}
          </button>
        ))}
      </div>
      <MediaTextCard key={current?.id || active} image={imageValue(current)} title={titleValue(current)} body={bodyValue(current)} index={active} />
    </section>
  )
}
