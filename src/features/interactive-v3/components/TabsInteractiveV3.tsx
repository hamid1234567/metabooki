import { type CSSProperties, useState } from 'react'
import type { InteractiveV3Block } from '../types'
import { blockTitle, bodyValue, imageValue, itemsFor, titleValue, MediaTextCard } from './utils'

const TAB_ACCENTS = ['#2563eb', '#7c3aed', '#0891b2', '#16a34a', '#f97316', '#db2777']

export function TabsInteractiveV3({ block }: { block: InteractiveV3Block }) {
  const [active, setActive] = useState(0)
  const tabs = itemsFor(block, 'tabs')
  const current = tabs[active]
  const title = blockTitle(block)
  const accent = TAB_ACCENTS[active % TAB_ACCENTS.length]
  if (!tabs.length) return null
  return (
    <section className="interactive-v3 interactive-v3-tabs" style={{ '--tab-accent': accent } as CSSProperties}>
      {title && <h3>{title}</h3>}
      <div className="interactive-v3-tab-row">
        {tabs.map((tab, index) => {
          const tabTitle = titleValue(tab, `تب ${index + 1}`)
          return (
            <button key={tab.id} type="button" className={active === index ? 'is-active' : ''} onClick={() => setActive(index)}>
              {tabTitle}
            </button>
          )
        })}
      </div>
      <div className="interactive-v3-tabs-panel">
        <MediaTextCard key={current?.id || active} image={imageValue(current)} title={titleValue(current)} body={bodyValue(current)} index={active} inheritDirection />
      </div>
    </section>
  )
}
