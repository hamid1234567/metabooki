import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { Check, ChevronLeft, ChevronRight, Clock3, X as XIcon } from 'lucide-react'
import { calloutPreset, INTERACTIVE_KIND_SET, interactiveLabel, normalizeBookText } from '@/lib/book-content'

type StateMap<T> = Record<string, T>

export type BookContentBlockRendererProps = {
  block: any
  blockKey: string
  renderChild?: (block: any, index: number) => ReactNode
  quizAnswers?: StateMap<number>
  setQuizAnswers?: Dispatch<SetStateAction<StateMap<number>>>
  timelineStep?: StateMap<number>
  setTimelineStep?: Dispatch<SetStateAction<StateMap<number>>>
  storyStep?: StateMap<number>
  setStoryStep?: Dispatch<SetStateAction<StateMap<number>>>
  tabStep?: StateMap<number>
  setTabStep?: Dispatch<SetStateAction<StateMap<number>>>
  hotspotsVisible?: StateMap<boolean[]>
  setHotspotsVisible?: Dispatch<SetStateAction<StateMap<boolean[]>>>
}

export function isSharedBookContentBlock(type?: string) {
  return type === 'callout' || INTERACTIVE_KIND_SET.has(String(type || ''))
}

function textOf(...values: unknown[]) {
  return normalizeBookText(String(values.find(value => value !== undefined && value !== null && String(value).trim()) || ''))
}

function renderInteractiveImage(url?: string, alt?: string, className = 'max-h-52 rounded-xl mb-3 object-contain bg-background/50') {
  return url ? <img src={url} alt={alt || ''} className={className} loading="lazy" /> : null
}

function GallerySlideshow({ block }: { block: any }) {
  const images = Array.isArray(block.images) ? block.images.filter((image: any) => image?.url) : []
  const [active, setActive] = useState(0)
  const activeThumbRef = useRef<HTMLButtonElement | null>(null)
  const current = images[Math.min(active, Math.max(0, images.length - 1))]
  const go = (delta: number) => setActive(index => (index + delta + images.length) % images.length)
  useEffect(() => {
    if (active > images.length - 1) setActive(Math.max(0, images.length - 1))
  }, [active, images.length])
  useEffect(() => {
    activeThumbRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [active])
  if (!images.length) return null
  return (
    <div className="reader-interactive book-gallery-slider menu-glass-70 rounded-2xl p-4 mb-8" data-no-swipe="true" dir="rtl">
      {block.title && <h3 className="book-gallery-title">{textOf(block.title)}</h3>}
      <figure className="book-gallery-slide" aria-live="polite">
        <div className="book-gallery-counter">{(active + 1).toLocaleString('fa-IR')} / {images.length.toLocaleString('fa-IR')}</div>
        <div className="book-gallery-stage">
          <img src={current.url} alt={current.caption || block.title || ''} loading="lazy" />
        </div>
        {images.length > 1 && <>
          <button className="book-gallery-nav prev" type="button" onClick={() => go(-1)} aria-label="تصویر قبلی"><ChevronRight /></button>
          <button className="book-gallery-nav next" type="button" onClick={() => go(1)} aria-label="تصویر بعدی"><ChevronLeft /></button>
        </>}
      </figure>
      {images.length > 1 && <div className="book-gallery-thumbs" aria-label="تصاویر گالری">
        {images.map((image: any, index: number) => (
          <button
            key={`${image.url}-${index}`}
            ref={active === index ? activeThumbRef : null}
            className={active === index ? 'is-active' : ''}
            onClick={() => setActive(index)}
            title={image.caption || `تصویر ${index + 1}`}
            aria-label={`نمایش تصویر ${(index + 1).toLocaleString('fa-IR')}`}
          >
            <img src={image.url} alt={image.caption || ''} loading="lazy" />
          </button>
        ))}
      </div>}
      {(current.caption || block.caption) && <p className="book-gallery-caption">{textOf(current.caption, block.caption)}</p>}
    </div>
  )
}

function StepTimelineBlock({
  block,
  blockKey,
  timelineStep = {},
  setTimelineStep,
}: {
  block: any
  blockKey: string
  timelineStep?: StateMap<number>
  setTimelineStep?: Dispatch<SetStateAction<StateMap<number>>>
}) {
  const rawItems = block.type === 'timeline'
    ? (block.events || block.steps || block.items || [])
    : (block.steps || block.items || block.events || [])
  const items = Array.isArray(rawItems) ? rawItems.filter(Boolean) : []
  const [localActive, setLocalActive] = useState(0)
  const active = Math.min(Math.max(0, timelineStep[blockKey] ?? localActive), Math.max(0, items.length - 1))
  const item = items[active] || {}
  const setActive = (next: number) => {
    const clamped = (next + items.length) % items.length
    if (setTimelineStep) setTimelineStep(current => ({ ...current, [blockKey]: clamped }))
    else setLocalActive(clamped)
  }
  useEffect(() => {
    if (active > items.length - 1 && items.length) setActive(items.length - 1)
  }, [active, items.length])
  if (!items.length) return null
  const title = textOf(block.title, block.type === 'timeline' ? interactiveLabel('timeline') : interactiveLabel('steps'))
  const displayTitle = textOf(item.title, item.label, item.year, `مرحله ${active + 1}`)
  const description = textOf(item.description, item.text, item.body, item.caption)
  return (
    <div className="reader-interactive reader-step-slider menu-glass-70 rounded-2xl p-4 mb-8" data-no-swipe="true" dir="rtl">
      <header className="reader-step-head">
        <h3>{title}</h3>
        <Clock3 />
      </header>
      <div className="reader-step-track" aria-label="مسیر مراحل">
        <div className="reader-step-line" />
        {items.map((step: any, index: number) => (
          <button
            key={`${textOf(step.title, step.label, step.year, index)}-${index}`}
            type="button"
            className={index === active ? 'is-active' : index < active ? 'is-seen' : ''}
            onClick={() => setActive(index)}
            title={textOf(step.title, step.label, `مرحله ${index + 1}`)}
          >
            <span>{(index + 1).toLocaleString('fa-IR')}</span>
            <small>{textOf(step.year, step.shortTitle, String(index + 1))}</small>
          </button>
        ))}
      </div>
      <div className="reader-step-progress"><span style={{ width: `${((active + 1) / items.length) * 100}%` }} /></div>
      <section className="reader-step-card">
        {items.length > 1 && <>
          <button className="reader-step-side prev" type="button" onClick={() => setActive(active - 1)} aria-label="مرحله قبلی"><ChevronRight /></button>
          <button className="reader-step-side next" type="button" onClick={() => setActive(active + 1)} aria-label="مرحله بعدی"><ChevronLeft /></button>
        </>}
        {item.image && <div className="reader-step-image"><img src={item.image} alt={displayTitle} loading="lazy" /></div>}
        <div className="reader-step-body">
          <span>{(active + 1).toLocaleString('fa-IR')}</span>
          <h4>{displayTitle}</h4>
          {description && <p>{description}</p>}
        </div>
      </section>
      {items.length > 1 && <footer className="reader-step-footer">
        <button type="button" onClick={() => setActive(active - 1)} aria-label="مرحله قبلی"><ChevronRight /></button>
        <b>{(active + 1).toLocaleString('fa-IR')} / {items.length.toLocaleString('fa-IR')}</b>
        <button type="button" onClick={() => setActive(active + 1)} aria-label="مرحله بعدی"><ChevronLeft /></button>
      </footer>}
    </div>
  )
}

function MultiStepInteractiveBlock({
  block,
  blockKey,
  stepMap = {},
  setStepMap,
}: {
  block: any
  blockKey: string
  stepMap?: StateMap<number>
  setStepMap?: Dispatch<SetStateAction<StateMap<number>>>
}) {
  const rawItems = block.steps || block.items || block.events || []
  const items = Array.isArray(rawItems) ? rawItems.filter(Boolean) : []
  const [localActive, setLocalActive] = useState(0)
  const active = Math.min(Math.max(0, stepMap[blockKey] ?? localActive), Math.max(0, items.length - 1))
  const item = items[active] || {}
  const setActive = (next: number) => {
    if (!items.length) return
    const clamped = (next + items.length) % items.length
    if (setStepMap) setStepMap(current => ({ ...current, [blockKey]: clamped }))
    else setLocalActive(clamped)
  }
  useEffect(() => {
    if (active > items.length - 1 && items.length) setActive(items.length - 1)
  }, [active, items.length])
  if (!items.length) return null

  const title = textOf(block.title, block.caption, interactiveLabel(block.type === 'scrollytelling' ? 'scrollytelling' : 'steps'))
  const titleCandidate = textOf(item.title, item.label, item.year)
  const description = textOf(item.description, item.body, item.caption, item.text)
  const displayTitle = titleCandidate || textOf(`مرحله ${active + 1}`)
  const media = item.media
  const firstImage = Array.isArray(item.images) ? item.images.find((imageItem: any) => imageItem?.url || typeof imageItem === 'string') : null
  const image = item.image || item.imageUrl || item.cover || (typeof media === 'string' ? media : media?.url || media?.src) || (typeof firstImage === 'string' ? firstImage : firstImage?.url)

  return (
    <div className="reader-interactive reader-multistep menu-glass-70 rounded-2xl p-4 mb-8" data-no-swipe="true" dir="rtl">
      <header className="reader-multistep-head">
        <h3>{title}</h3>
      </header>
      <div className="reader-multistep-layout">
        <nav className="reader-multistep-rail" aria-label="مراحل">
          {items.map((step: any, index: number) => (
            <button
              key={`${textOf(step.title, step.label, step.text, index)}-${index}`}
              type="button"
              className={index === active ? 'is-active' : ''}
              onClick={() => setActive(index)}
              title={textOf(step.title, step.label, step.text, `مرحله ${index + 1}`)}
            >
              <span>{(index + 1).toLocaleString('fa-IR')}</span>
              <strong>{textOf(step.title, step.label, step.text, `مرحله ${index + 1}`)}</strong>
            </button>
          ))}
        </nav>
        <section className="reader-multistep-stage" aria-live="polite">
          <div className="reader-multistep-media">
            <span className="reader-multistep-counter">{(active + 1).toLocaleString('fa-IR')} / {items.length.toLocaleString('fa-IR')}</span>
            {image ? <img src={image} alt={displayTitle} loading="lazy" /> : <div className="reader-multistep-empty">{displayTitle}</div>}
            {items.length > 1 && <>
              <button className="reader-multistep-side prev" type="button" onClick={() => setActive(active - 1)} aria-label="مرحله قبلی"><ChevronRight /></button>
              <button className="reader-multistep-side next" type="button" onClick={() => setActive(active + 1)} aria-label="مرحله بعدی"><ChevronLeft /></button>
            </>}
          </div>
          <div className="reader-multistep-copy">
            <span>{(active + 1).toLocaleString('fa-IR')}</span>
            <h4>{displayTitle}</h4>
            {description && <p>{description}</p>}
          </div>
          {items.length > 1 && <footer className="reader-multistep-footer">
            <button type="button" onClick={() => setActive(active + 1)}><ChevronLeft /> بعدی</button>
            <div>{items.map((_: any, index: number) => <span key={index} className={index === active ? 'is-active' : ''} />)}</div>
            <button type="button" onClick={() => setActive(active - 1)}>قبلی <ChevronRight /></button>
          </footer>}
        </section>
      </div>
    </div>
  )
}

function AuthorStrip({ block }: { block: any }) {
  const authors = block.authors || block.items || [{ name: block.name || block.title, role: block.role, bio: block.bio || block.description, image: block.image }]
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (openIndex === null) return
    const closeOnOutside = (event: PointerEvent) => {
      if (ref.current?.contains(event.target as Node)) return
      setOpenIndex(null)
    }
    document.addEventListener('pointerdown', closeOnOutside)
    return () => document.removeEventListener('pointerdown', closeOnOutside)
  }, [openIndex])
  return (
    <div ref={ref} className="reader-interactive book-author-strip menu-glass-70 rounded-2xl p-3 mb-8" data-no-swipe="true">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-muted-foreground px-2">{textOf(block.title, 'تألیف:')}</span>
        {authors.map((author: any, authorIndex: number) => {
          const name = textOf(author.name, `نویسنده ${authorIndex + 1}`)
          const role = textOf(author.role, author.position, '')
          const bio = textOf(author.bio, author.description, author.text, 'توضیحات تکمیلی برای این نویسنده ثبت نشده است.')
          const initials = name.split(/\s+/).filter(Boolean).slice(-1)[0]?.slice(0, 2) || String(authorIndex + 1)
          const open = openIndex === authorIndex
          return (
            <div key={authorIndex} className={`book-author-chip group relative ${open ? 'is-open' : ''}`}>
              <button type="button" className="book-author-summary" onClick={() => setOpenIndex(open ? null : authorIndex)}>
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-background/55 px-2.5 py-1.5 shadow-sm transition hover:border-primary/55 hover:bg-primary/10">
                  {author.image ? <img src={author.image} alt={name} className="h-8 w-8 rounded-full object-cover ring-2 ring-background" loading="lazy" /> : <span className="h-8 w-8 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold">{initials}</span>}
                  <span className="text-sm font-bold text-foreground whitespace-nowrap">{name}</span>
                  {role && <small className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{role}</small>}
                </span>
              </button>
              {open && <div className="book-author-popover absolute right-0 z-30 mt-2 min-w-72 max-w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-primary/20 bg-background/90 p-4 shadow-2xl backdrop-blur-xl">
                <div className="flex items-start gap-3">
                  {author.image ? <img src={author.image} alt={name} className="h-16 w-16 rounded-2xl object-cover" loading="lazy" /> : <span className="h-16 w-16 rounded-2xl bg-primary/10 text-primary grid place-items-center text-base font-black">{initials}</span>}
                  <div className="min-w-0">
                    <h4 className="font-black leading-relaxed">{name}</h4>
                    {role && <p className="text-xs text-primary mt-1">{role}</p>}
                  </div>
                </div>
                <p className="mt-3 text-sm leading-8 text-muted-foreground">{bio}</p>
              </div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AlgorithmBlock({ block, blockKey }: { block: any; blockKey: string }) {
  const legacySteps = Array.isArray(block.steps) ? block.steps : []
  const nodes = Array.isArray(block.nodes) && block.nodes.length
    ? block.nodes
    : legacySteps.map((step: any, index: number) => ({
      id: step.id || `step-${index + 1}`,
      kind: index === 0 ? 'start' : index === legacySteps.length - 1 ? 'result' : 'action',
      title: step.title,
      description: step.description || step.text,
      image: step.image,
      options: index < legacySteps.length - 1 ? [{ label: 'ادامه', targetId: `step-${index + 2}` }] : [],
    }))
  const [currentId, setCurrentId] = useState(block.startId || nodes[0]?.id || '')
  const [path, setPath] = useState<string[]>([])
  const current = nodes.find((node: any) => node.id === currentId) || nodes[0] || {}
  const choose = (option: any) => {
    if (!option?.targetId) return
    setPath(items => [...items, current.id || current.title || 'node'])
    setCurrentId(option.targetId)
  }
  const reset = () => {
    setPath([])
    setCurrentId(block.startId || nodes[0]?.id || '')
  }
  if (!nodes.length) return null
  return (
    <div className="reader-interactive reader-algorithm menu-glass-70 rounded-2xl p-5 mb-8" data-no-swipe="true" data-algorithm-key={blockKey}>
      <div className="reader-algorithm-head">
        <div>
          <p>الگوریتم تعاملی</p>
          <h3>{textOf(block.title, interactiveLabel('algorithm'))}</h3>
        </div>
        {path.length > 0 && <button type="button" onClick={reset}>شروع دوباره</button>}
      </div>
      <section className={`reader-algorithm-node node-${current.kind || 'action'}`}>
        <span className="reader-algorithm-badge">{current.kind === 'decision' ? 'تصمیم' : current.kind === 'result' ? 'نتیجه' : current.kind === 'start' ? 'شروع' : 'اقدام'}</span>
        {renderInteractiveImage(current.image, current.title, 'reader-algorithm-image')}
        <h4>{textOf(current.title, current.label, 'گره بدون عنوان')}</h4>
        {current.description && <p>{textOf(current.description, current.text, current.body)}</p>}
        {Array.isArray(current.options) && current.options.length > 0 ? (
          <div className="reader-algorithm-options">
            {current.options.map((option: any, index: number) => <button key={index} type="button" disabled={!option.targetId} onClick={() => choose(option)}>{textOf(option.label, `مسیر ${index + 1}`)}</button>)}
          </div>
        ) : <div className="reader-algorithm-finish">پایان مسیر</div>}
      </section>
      {path.length > 0 && <div className="reader-algorithm-path">
        {path.map((id, index) => {
          const node = nodes.find((item: any) => item.id === id)
          return <span key={`${id}-${index}`}>{textOf(node?.title, id)}</span>
        })}
        <span>{textOf(current.title, current.id)}</span>
      </div>}
    </div>
  )
}

export function BookContentBlock({
  block,
  blockKey,
  renderChild,
  quizAnswers = {},
  setQuizAnswers,
  timelineStep = {},
  setTimelineStep,
  storyStep = {},
  setStoryStep,
  tabStep = {},
  setTabStep,
  hotspotsVisible = {},
  setHotspotsVisible,
}: BookContentBlockRendererProps) {
  if (block.type === 'author') return <AuthorStrip block={block} />

  if (block.type === 'gallery') return <GallerySlideshow block={block} />

  if (block.type === 'callout') {
    const preset = calloutPreset(block.variant)
    const title = block.title || preset.label
    const icon = block.icon || preset.emoji
    return (
      <section className={`book-callout reader-callout has-rendered-title callout-${block.variant || preset.value}`} data-callout-variant={block.variant || preset.value} data-callout-title={title} data-callout-icon={icon}>
        <div className="book-callout-head">
          <span className="book-callout-icon">{icon}</span>
          <strong>{title}</strong>
        </div>
        <div className="book-callout-content">
          {(block.blocks || []).map((child: any, childIndex: number) => renderChild ? renderChild(child, childIndex) : null)}
        </div>
      </section>
    )
  }

  if (block.type === 'quiz') {
    const answered = quizAnswers[blockKey] !== undefined
    const selected = quizAnswers[blockKey]
    const options = block.options || []
    return (
      <div className="reader-interactive glass rounded-2xl p-6 mb-8 border-2 border-primary/10">
        <h3 className="font-semibold mb-4 text-lg">{textOf(block.question, block.title, interactiveLabel('quiz'))}</h3>
        {renderInteractiveImage(block.image, block.question)}
        <div className="space-y-2">{options.map((option: string, optionIndex: number) => (
          <button key={optionIndex} onClick={() => !answered && setQuizAnswers?.(current => ({ ...current, [blockKey]: optionIndex }))} disabled={answered} className={`w-full text-right p-3.5 rounded-xl border-2 transition-all ${answered ? optionIndex === block.correct ? 'bg-success/20 border-success' : optionIndex === selected ? 'bg-destructive/20 border-destructive' : 'bg-muted/30 border-border opacity-60' : 'bg-muted/50 border-border hover:bg-muted hover:border-primary/30 cursor-pointer'}`}>
            <div className="flex items-center justify-between"><span>{textOf(option)}</span>{answered && optionIndex === block.correct && <Check className="w-5 h-5 text-success" />}{answered && optionIndex === selected && optionIndex !== block.correct && <XIcon className="w-5 h-5 text-destructive" />}</div>
          </button>
        ))}</div>
        {answered && <div className={`mt-3 rounded-xl p-3 text-sm font-medium ${selected === block.correct ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
          <p>{selected === block.correct ? 'پاسخ صحیح است.' : 'پاسخ نادرست است.'}</p>
          {block.explanation && <p className="mt-2 text-muted-foreground leading-relaxed">{textOf(block.explanation)}</p>}
        </div>}
      </div>
    )
  }

  if (block.type === 'truefalse') {
    const answered = quizAnswers[blockKey] !== undefined
    const selected = quizAnswers[blockKey]
    const correct = block.answer === true || block.correct === true || block.correct === 0 ? 0 : 1
    return (
      <div className="reader-interactive menu-glass-70 rounded-2xl p-5 mb-8">
        <h3 className="font-semibold mb-4">{textOf(block.statement, block.question, block.title, interactiveLabel('truefalse'))}</h3>
        {renderInteractiveImage(block.image, block.statement)}
        <div className="grid grid-cols-2 gap-3">
          {['صحیح', 'غلط'].map((label, index) => <button key={label} onClick={() => !answered && setQuizAnswers?.(current => ({ ...current, [blockKey]: index }))} disabled={answered} className={`rounded-xl border p-3 transition-all ${answered ? index === correct ? 'bg-success/15 border-success text-success' : index === selected ? 'bg-destructive/15 border-destructive text-destructive' : 'bg-background/40' : 'bg-background/60 hover:border-primary/40'}`}>{label}</button>)}
        </div>
        {answered && block.explanation && <p className="mt-3 rounded-xl bg-background/60 p-3 text-sm text-muted-foreground leading-relaxed">{textOf(block.explanation)}</p>}
      </div>
    )
  }

  if (block.type === 'flashcard') return (
    <div className="reader-interactive menu-glass-70 rounded-2xl p-5 mb-8">
      <h3 className="font-semibold mb-4">{textOf(block.title, interactiveLabel('flashcard'))}</h3>
      <div className="grid sm:grid-cols-2 gap-3">{(block.cards || []).map((card: any, cardIndex: number) => (
        <details key={cardIndex} className="rounded-xl border bg-background/55 p-4 cursor-pointer">
          <summary className="font-bold">{textOf(card.front, card.title)}</summary>
          {renderInteractiveImage(card.image, card.front, 'mt-3 max-h-44 rounded-lg object-contain bg-background/50')}
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{textOf(card.back, card.description, card.text)}</p>
        </details>
      ))}</div>
    </div>
  )

  if (block.type === 'algorithm') return <AlgorithmBlock block={block} blockKey={blockKey} />

  if (block.type === 'steps') return <MultiStepInteractiveBlock block={block} blockKey={blockKey} stepMap={timelineStep} setStepMap={setTimelineStep} />

  if (block.type === 'accordion') return <div className="reader-interactive menu-glass-70 rounded-2xl p-5 mb-8"><h3 className="font-semibold mb-4">{textOf(block.title, interactiveLabel('accordion'))}</h3><div className="space-y-3">{(block.items || block.steps || []).map((item: any, itemIndex: number) => <details key={itemIndex} className="rounded-xl border bg-background/55 p-4"><summary className="font-bold cursor-pointer">{textOf(item.title, item.label, `بخش ${itemIndex + 1}`)}</summary>{renderInteractiveImage(item.image, item.title, 'mt-3 max-h-44 rounded-lg object-contain bg-background/50')}<p className="mt-3 text-sm text-muted-foreground leading-relaxed">{textOf(item.description, item.text, item.body)}</p></details>)}</div></div>

  if (block.type === 'tabs') {
    const tabs = block.tabs || block.items || block.steps || []
    const active = Math.min(tabStep[blockKey] ?? 0, Math.max(0, tabs.length - 1))
    const tab = tabs[active] || {}
    return <div className="reader-interactive reader-tabs menu-glass-70 rounded-2xl p-5 mb-8" data-no-swipe="true"><h3 className="font-semibold mb-4">{textOf(block.title, interactiveLabel('tabs'))}</h3><div className="reader-tabs-list">{tabs.map((item: any, tabIndex: number) => <button key={tabIndex} onClick={() => setTabStep?.(current => ({ ...current, [blockKey]: tabIndex }))} className={`reader-tabs-tab ${active === tabIndex ? 'is-active' : ''}`}>{textOf(item.title, item.label, `تب ${tabIndex + 1}`)}</button>)}</div><div className="reader-tabs-panel">{renderInteractiveImage(tab.image, tab.title)}<p>{textOf(tab.description, tab.text, tab.body)}</p></div></div>
  }

  if (block.type === 'author') {
    const authors = block.authors || block.items || [{ name: block.name || block.title, role: block.role, bio: block.bio || block.description, image: block.image }]
    return (
      <div className="reader-interactive book-author-strip menu-glass-70 rounded-2xl p-3 mb-8" data-no-swipe="true">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-muted-foreground px-2">{textOf(block.title, 'تألیف:')}</span>
          {authors.map((author: any, authorIndex: number) => {
            const name = textOf(author.name, `نویسنده ${authorIndex + 1}`)
            const role = textOf(author.role, author.position, '')
            const bio = textOf(author.bio, author.description, author.text, 'توضیحات تکمیلی برای این نویسنده ثبت نشده است.')
            const initials = name.split(/\s+/).filter(Boolean).slice(-1)[0]?.slice(0, 2) || String(authorIndex + 1)
            return (
              <details key={authorIndex} className="book-author-chip group relative">
                <summary className="list-none cursor-pointer select-none">
                  <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-background/55 px-2.5 py-1.5 shadow-sm transition hover:border-primary/55 hover:bg-primary/10">
                    {author.image ? <img src={author.image} alt={name} className="h-8 w-8 rounded-full object-cover ring-2 ring-background" loading="lazy" /> : <span className="h-8 w-8 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold">{initials}</span>}
                    <span className="text-sm font-bold text-foreground whitespace-nowrap">{name}</span>
                    {role && <small className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{role}</small>}
                  </span>
                </summary>
                <div className="book-author-popover absolute right-0 z-30 mt-2 min-w-72 max-w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-primary/20 bg-background/90 p-4 shadow-2xl backdrop-blur-xl">
                  <div className="flex items-start gap-3">
                    {author.image ? <img src={author.image} alt={name} className="h-16 w-16 rounded-2xl object-cover" loading="lazy" /> : <span className="h-16 w-16 rounded-2xl bg-primary/10 text-primary grid place-items-center text-base font-black">{initials}</span>}
                    <div className="min-w-0">
                      <h4 className="font-black leading-relaxed">{name}</h4>
                      {role && <p className="text-xs text-primary mt-1">{role}</p>}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-8 text-muted-foreground">{bio}</p>
                </div>
              </details>
            )
          })}
        </div>
      </div>
    )
  }

  if (block.type === 'gallery') return <div className="reader-interactive menu-glass-70 rounded-2xl p-4 mb-8"><h3 className="font-semibold mb-4">{textOf(block.title, '')}</h3><div className="grid sm:grid-cols-2 gap-3">{(block.images || []).map((image: any, imageIndex: number) => <figure key={imageIndex} className="rounded-xl overflow-hidden bg-background/55">{image.url && <img src={image.url} alt={image.caption || ''} className="w-full h-auto" loading="lazy" />}<figcaption className="p-3 text-sm text-muted-foreground">{textOf(image.caption)}</figcaption></figure>)}</div></div>

  if (block.type === 'timeline') {
    return <StepTimelineBlock block={block} blockKey={blockKey} timelineStep={timelineStep} setTimelineStep={setTimelineStep} />
  }

  if (block.type === 'scrollytelling') return <MultiStepInteractiveBlock block={block} blockKey={blockKey} stepMap={storyStep} setStepMap={setStoryStep} />

  if (block.type === 'hotspot') {
    const points = block.points || []
    const visible = hotspotsVisible[blockKey] || points.map(() => false)
    const allVisible = visible.every(Boolean)
    const togglePoint = (pointIndex: number) => setHotspotsVisible?.(current => {
      const currentPoints = current[blockKey] || points.map(() => false)
      const next = [...currentPoints]
      next[pointIndex] = !next[pointIndex]
      return { ...current, [blockKey]: next }
    })
    const setAll = (value: boolean) => setHotspotsVisible?.(current => ({ ...current, [blockKey]: points.map(() => value) }))
    return <div className="reader-interactive reader-hotspot menu-glass-70 rounded-2xl p-4 mb-8 overflow-visible" data-no-swipe="true"><div className="flex items-center justify-between gap-3 mb-3"><h3 className="font-semibold">{textOf(block.title, interactiveLabel('hotspot'))}</h3><button onClick={() => setAll(!allVisible)} className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20">{allVisible ? 'مخفی کردن همه' : 'نمایش همه'}</button></div><div className="relative rounded-2xl overflow-visible"><img src={block.image} alt={block.caption || 'hotspot'} className="w-full h-auto" loading="lazy" />{points.map((point: any, pointIndex: number) => <div key={pointIndex} className="absolute" style={{ left: `${point.x}%`, top: `${point.y}%`, transform: 'translate(-50%, -50%)' }}><button onClick={() => togglePoint(pointIndex)} className="w-8 h-8 rounded-full bg-primary text-primary-foreground shadow-glow animate-pulse-glow border-2 border-white" title={point.title}>{pointIndex + 1}</button>{visible[pointIndex] && <div className={`reader-hotspot-popover absolute top-9 w-56 menu-glass-70 rounded-xl p-3 text-sm animate-fade-in ${point.x > 62 ? 'left-0' : 'right-0'}`}><p className="font-bold mb-1">{textOf(point.title)}</p><p className="text-muted-foreground leading-relaxed">{textOf(point.text, point.description)}</p></div>}</div>)}</div>{block.caption && <p className="text-center text-xs text-muted-foreground mt-3">{textOf(block.caption)}</p>}</div>
  }

  if (block.type === 'mindmap') return <div className="glass rounded-2xl p-6 mb-8 text-center"><h3 className="font-semibold mb-4 text-lg">{textOf(block.central, block.title, 'نقشه ذهنی')}</h3>{renderInteractiveImage(block.image, block.central)}<div className="flex flex-wrap justify-center gap-3">{(block.nodes || block.items || []).map((node: any, nodeIndex: number) => <div key={nodeIndex} className="px-5 py-2.5 rounded-full bg-primary/10 text-primary font-medium">{textOf(node.title, node.label, node)}</div>)}</div></div>

  return null
}
