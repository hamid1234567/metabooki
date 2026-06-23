import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { normalizeBookTextV2, textDirectionV2, type InteractiveBlockV2 as InteractiveBlockDataV2 } from '@/lib/book-document-v2'

type ItemRecord = Record<string, unknown>

function asArray(value: unknown): ItemRecord[] {
  return Array.isArray(value) ? value.map(item => (item && typeof item === 'object' ? item as ItemRecord : { text: item })) : []
}

function textOf(...values: unknown[]) {
  const found = values.find(value => normalizeBookTextV2(value).trim())
  return normalizeBookTextV2(found ?? '')
}

function imageOf(item: ItemRecord) {
  return textOf(item.image, item.url, item.src)
}

function titleOf(item: ItemRecord, fallback: string) {
  return textOf(item.title, item.year, item.front, item.name, item.label, fallback)
}

function bodyOf(item: ItemRecord) {
  return textOf(item.description, item.text, item.back, item.bio, item.caption)
}

function interactiveItems(block: InteractiveBlockDataV2) {
  const payload = block.payload || {}
  return asArray(payload.steps).length ? asArray(payload.steps)
    : asArray(payload.events).length ? asArray(payload.events)
      : asArray(payload.tabs).length ? asArray(payload.tabs)
        : asArray(payload.items).length ? asArray(payload.items)
          : asArray(payload.cards).length ? asArray(payload.cards)
            : asArray(payload.images).length ? asArray(payload.images)
              : asArray(payload.authors)
}

function NavigationButton({ side, onClick, disabled }: { side: 'next' | 'prev'; onClick: () => void; disabled: boolean }) {
  return (
    <button className="interactive-v2-nav" type="button" onClick={onClick} disabled={disabled} aria-label={side === 'next' ? 'بعدی' : 'قبلی'}>
      {side === 'next' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
    </button>
  )
}

function EmptyInteractive({ title }: { title: string }) {
  return <div className="interactive-v2-empty">{title || 'این بخش تعاملی هنوز محتوا ندارد.'}</div>
}

function GalleryInteractive({ block }: { block: InteractiveBlockDataV2 }) {
  const images = interactiveItems(block)
  const [active, setActive] = useState(0)
  const current = images[active]
  if (!images.length) return <EmptyInteractive title={block.title || 'گالری تصویر'} />
  return (
    <div className="interactive-v2 interactive-v2-gallery" dir="rtl">
      <header><strong>{block.title || textOf(block.payload.title) || 'گالری تصویر'}</strong><span>{`${active + 1} / ${images.length}`}</span></header>
      <div className="interactive-v2-stage">
        <NavigationButton side="prev" onClick={() => setActive(value => Math.max(0, value - 1))} disabled={active === 0} />
        <figure>
          {imageOf(current) ? <img src={imageOf(current)} alt={titleOf(current, '')} loading="lazy" /> : <div className="interactive-v2-image-placeholder" />}
          {bodyOf(current) && <figcaption>{bodyOf(current)}</figcaption>}
        </figure>
        <NavigationButton side="next" onClick={() => setActive(value => Math.min(images.length - 1, value + 1))} disabled={active === images.length - 1} />
      </div>
      <div className="interactive-v2-thumbs">
        {images.map((item, index) => (
          <button key={index} className={index === active ? 'is-active' : ''} type="button" onClick={() => setActive(index)}>
            {imageOf(item) ? <img src={imageOf(item)} alt={titleOf(item, '')} loading="lazy" /> : <span>{index + 1}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

function TimelineInteractive({ block }: { block: InteractiveBlockDataV2 }) {
  const items = interactiveItems(block)
  const [active, setActive] = useState(0)
  const current = items[active]
  const direction = textDirectionV2(titleOf(items[0] || {}, ''))
  if (!items.length) return <EmptyInteractive title={block.title || 'تایم‌لاین'} />
  return (
    <div className="interactive-v2 interactive-v2-timeline" dir={direction}>
      <header><strong>{block.title || textOf(block.payload.title) || 'تایم‌لاین'}</strong></header>
      <div className="interactive-v2-line" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item, index) => (
          <button key={index} className={index === active ? 'is-active' : ''} type="button" onClick={() => setActive(index)}>
            <span>{index + 1}</span>
            <small>{titleOf(item, String(index + 1))}</small>
          </button>
        ))}
      </div>
      <div className="interactive-v2-card">
        {imageOf(current) && <img src={imageOf(current)} alt={titleOf(current, '')} loading="lazy" />}
        <div>
          <small>{active + 1}</small>
          <h4>{titleOf(current, `مرحله ${active + 1}`)}</h4>
          {bodyOf(current) && <p>{bodyOf(current)}</p>}
        </div>
      </div>
      <footer>
        <NavigationButton side="prev" onClick={() => setActive(value => Math.max(0, value - 1))} disabled={active === 0} />
        <span>{`${active + 1} / ${items.length}`}</span>
        <NavigationButton side="next" onClick={() => setActive(value => Math.min(items.length - 1, value + 1))} disabled={active === items.length - 1} />
      </footer>
    </div>
  )
}

function StepInteractive({ block }: { block: InteractiveBlockDataV2 }) {
  const items = interactiveItems(block)
  const [active, setActive] = useState(0)
  const current = items[active]
  if (!items.length) return <EmptyInteractive title={block.title || 'مراحل تعاملی'} />
  return (
    <div className="interactive-v2 interactive-v2-steps" dir="rtl">
      <header><strong>{block.title || textOf(block.payload.title) || 'مراحل تعاملی'}</strong></header>
      <div className="interactive-v2-step-layout">
        <nav>
          {items.map((item, index) => (
            <button key={index} className={index === active ? 'is-active' : ''} type="button" onClick={() => setActive(index)}>
              <span>{index + 1}</span>
              <b>{titleOf(item, `مرحله ${index + 1}`)}</b>
            </button>
          ))}
        </nav>
        <article>
          {imageOf(current) && <img src={imageOf(current)} alt={titleOf(current, '')} loading="lazy" />}
          <h4>{titleOf(current, `مرحله ${active + 1}`)}</h4>
          {bodyOf(current) && <p>{bodyOf(current)}</p>}
          <div className="interactive-v2-step-actions">
            <NavigationButton side="prev" onClick={() => setActive(value => Math.max(0, value - 1))} disabled={active === 0} />
            <NavigationButton side="next" onClick={() => setActive(value => Math.min(items.length - 1, value + 1))} disabled={active === items.length - 1} />
          </div>
        </article>
      </div>
    </div>
  )
}

function AuthorInteractive({ block }: { block: InteractiveBlockDataV2 }) {
  const authors = interactiveItems(block)
  const [active, setActive] = useState<number | null>(null)
  if (!authors.length) return <EmptyInteractive title={block.title || 'معرفی نویسندگان'} />
  return (
    <div className="interactive-v2 interactive-v2-authors" dir="rtl">
      <strong>{block.title || textOf(block.payload.title) || 'نویسندگان'}</strong>
      <div className="interactive-v2-author-chips">
        {authors.map((author, index) => (
          <button key={index} className={index === active ? 'is-active' : ''} type="button" onClick={() => setActive(active === index ? null : index)}>
            {imageOf(author) && <img src={imageOf(author)} alt={titleOf(author, '')} loading="lazy" />}
            <span>{titleOf(author, `نویسنده ${index + 1}`)}</span>
          </button>
        ))}
      </div>
      {active !== null && (
        <div className="interactive-v2-author-popover">
          {imageOf(authors[active]) && <img src={imageOf(authors[active])} alt={titleOf(authors[active], '')} loading="lazy" />}
          <h4>{titleOf(authors[active], '')}</h4>
          {textOf(authors[active].role) && <small>{textOf(authors[active].role)}</small>}
          {bodyOf(authors[active]) && <p>{bodyOf(authors[active])}</p>}
        </div>
      )}
    </div>
  )
}

function QuizInteractive({ block }: { block: InteractiveBlockDataV2 }) {
  const options = asArray(block.payload.options).map((option, index) => textOf(option.text, option.label, option, `گزینه ${index + 1}`))
  const [selected, setSelected] = useState<number | null>(null)
  return (
    <div className="interactive-v2 interactive-v2-quiz" dir="rtl">
      <h4>{textOf(block.payload.question, block.title, 'سؤال')}</h4>
      <div>
        {options.map((option, index) => (
          <button key={index} className={selected === index ? 'is-active' : ''} type="button" onClick={() => setSelected(index)}>
            {option}
          </button>
        ))}
      </div>
      {selected !== null && textOf(block.payload.explanation) && <p>{textOf(block.payload.explanation)}</p>}
    </div>
  )
}

function FlashcardInteractive({ block }: { block: InteractiveBlockDataV2 }) {
  const cards = interactiveItems(block)
  const [active, setActive] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const current = cards[active]
  if (!cards.length) return <EmptyInteractive title={block.title || 'فلش‌کارت'} />
  return (
    <div className="interactive-v2 interactive-v2-flashcard" dir="rtl">
      <button type="button" className={flipped ? 'is-flipped' : ''} onClick={() => setFlipped(value => !value)}>
        {imageOf(current) && <img src={imageOf(current)} alt={titleOf(current, '')} loading="lazy" />}
        <strong>{flipped ? bodyOf(current) || textOf(current.back) : titleOf(current, 'روی کارت بزنید')}</strong>
      </button>
      <footer>
        <NavigationButton side="prev" onClick={() => { setActive(value => Math.max(0, value - 1)); setFlipped(false) }} disabled={active === 0} />
        <span>{`${active + 1} / ${cards.length}`}</span>
        <NavigationButton side="next" onClick={() => { setActive(value => Math.min(cards.length - 1, value + 1)); setFlipped(false) }} disabled={active === cards.length - 1} />
      </footer>
    </div>
  )
}

function SimpleInteractive({ block }: { block: InteractiveBlockDataV2 }) {
  const items = interactiveItems(block)
  const [active, setActive] = useState(0)
  const current = items[active]
  if (!items.length) return <EmptyInteractive title={block.title || 'بخش تعاملی'} />
  return (
    <div className="interactive-v2 interactive-v2-simple" dir="rtl">
      <header><strong>{block.title || textOf(block.payload.title) || 'بخش تعاملی'}</strong></header>
      <nav>
        {items.map((item, index) => <button key={index} className={index === active ? 'is-active' : ''} type="button" onClick={() => setActive(index)}>{titleOf(item, `بخش ${index + 1}`)}</button>)}
      </nav>
      <article>
        {imageOf(current) && <img src={imageOf(current)} alt={titleOf(current, '')} loading="lazy" />}
        <h4>{titleOf(current, `بخش ${active + 1}`)}</h4>
        {bodyOf(current) && <p>{bodyOf(current)}</p>}
      </article>
    </div>
  )
}

export function InteractiveBlockV2({ block }: { block: InteractiveBlockDataV2 }) {
  const kind = block.kind
  const content = useMemo(() => {
    if (kind === 'gallery') return <GalleryInteractive block={block} />
    if (kind === 'timeline') return <TimelineInteractive block={block} />
    if (kind === 'steps' || kind === 'scrollytelling' || kind === 'algorithm') return <StepInteractive block={block} />
    if (kind === 'author') return <AuthorInteractive block={block} />
    if (kind === 'quiz' || kind === 'truefalse') return <QuizInteractive block={block} />
    if (kind === 'flashcard') return <FlashcardInteractive block={block} />
    return <SimpleInteractive block={block} />
  }, [block, kind])
  return <section id={block.anchor || block.id}>{content}</section>
}
