import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { Check, X as XIcon } from 'lucide-react'
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

  if (block.type === 'steps' || block.type === 'algorithm') {
    const steps = block.steps || block.items || block.events || []
    return <div className="reader-interactive menu-glass-70 rounded-2xl p-5 mb-8"><h3 className="font-semibold mb-4">{textOf(block.title, interactiveLabel(block.type))}</h3><div className="grid gap-3">{steps.map((step: any, stepIndex: number) => <div key={stepIndex} className="grid grid-cols-[2.5rem_1fr] gap-3 items-start rounded-xl bg-background/55 p-3"><span className="w-10 h-10 rounded-full bg-primary text-primary-foreground grid place-items-center font-bold">{stepIndex + 1}</span><div>{renderInteractiveImage(step.image, step.title, 'max-h-44 rounded-lg mb-2 object-contain bg-background/50')}<h4 className="font-bold">{textOf(step.title, step.label, `مرحله ${stepIndex + 1}`)}</h4><p className="text-sm text-muted-foreground leading-relaxed">{textOf(step.description, step.text, step.body)}</p></div></div>)}</div></div>
  }

  if (block.type === 'accordion') return <div className="reader-interactive menu-glass-70 rounded-2xl p-5 mb-8"><h3 className="font-semibold mb-4">{textOf(block.title, interactiveLabel('accordion'))}</h3><div className="space-y-3">{(block.items || block.steps || []).map((item: any, itemIndex: number) => <details key={itemIndex} className="rounded-xl border bg-background/55 p-4"><summary className="font-bold cursor-pointer">{textOf(item.title, item.label, `بخش ${itemIndex + 1}`)}</summary>{renderInteractiveImage(item.image, item.title, 'mt-3 max-h-44 rounded-lg object-contain bg-background/50')}<p className="mt-3 text-sm text-muted-foreground leading-relaxed">{textOf(item.description, item.text, item.body)}</p></details>)}</div></div>

  if (block.type === 'tabs') {
    const tabs = block.tabs || block.items || block.steps || []
    const active = Math.min(tabStep[blockKey] ?? 0, Math.max(0, tabs.length - 1))
    const tab = tabs[active] || {}
    return <div className="reader-interactive menu-glass-70 rounded-2xl p-5 mb-8" data-no-swipe="true"><h3 className="font-semibold mb-4">{textOf(block.title, interactiveLabel('tabs'))}</h3><div className="flex gap-2 overflow-x-auto pb-2">{tabs.map((item: any, tabIndex: number) => <button key={tabIndex} onClick={() => setTabStep?.(current => ({ ...current, [blockKey]: tabIndex }))} className={`shrink-0 rounded-xl px-4 py-2 text-sm ${active === tabIndex ? 'bg-primary text-primary-foreground' : 'bg-background/60 hover:bg-muted'}`}>{textOf(item.title, item.label, `تب ${tabIndex + 1}`)}</button>)}</div><div className="mt-3 rounded-xl bg-background/55 p-4">{renderInteractiveImage(tab.image, tab.title)}<p className="text-sm text-muted-foreground leading-relaxed">{textOf(tab.description, tab.text, tab.body)}</p></div></div>
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
    const events = block.events || block.steps || []
    const active = timelineStep[blockKey] ?? 0
    const event = events[active] || events[0] || {}
    return <div className="reader-interactive menu-glass-70 rounded-2xl p-5 mb-8"><h3 className="font-semibold mb-5 text-lg">{textOf(block.title, interactiveLabel('timeline'))}</h3><div className="relative overflow-x-auto pb-4" data-no-swipe="true"><div className="absolute top-5 right-8 left-8 h-0.5 bg-primary/25" /><div className="relative flex gap-4 min-w-max px-2">{events.map((item: any, eventIndex: number) => <button key={eventIndex} onClick={() => setTimelineStep?.(current => ({ ...current, [blockKey]: eventIndex }))} className="w-44 text-center" title={item.title}><span className={`mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${active === eventIndex ? 'bg-primary text-primary-foreground border-primary shadow-glow' : 'bg-background border-primary/40 text-primary'}`}>{eventIndex + 1}</span><span className={`block rounded-xl px-3 py-2 text-xs transition-all ${active === eventIndex ? 'bg-primary/10 text-primary font-bold' : 'bg-muted/40 text-muted-foreground'}`}>{textOf(item.year, item.title, `مرحله ${eventIndex + 1}`)}</span></button>)}</div></div><div className="rounded-2xl bg-background/55 border p-5 animate-fade-in">{renderInteractiveImage(event.image, event.title)}<p className="text-xs text-primary font-bold mb-1">{textOf(event.year)}</p><h4 className="font-bold text-lg mb-2">{textOf(event.title, event.label)}</h4><p className="text-sm text-muted-foreground leading-relaxed">{textOf(event.description, event.text, event.body)}</p></div></div>
  }

  if (block.type === 'scrollytelling') {
    const steps = block.steps || block.items || []
    const active = storyStep[blockKey] ?? 0
    const step = steps[active] || steps[0] || {}
    return <div className="reader-interactive reader-story menu-glass-70 rounded-2xl p-4 mb-8" data-no-swipe="true"><div className="grid md:grid-cols-[1.2fr_0.8fr] gap-4 items-stretch"><div className="relative rounded-2xl overflow-hidden min-h-72">{step.image ? <img src={step.image} alt={textOf(step.title, step.text)} className="absolute inset-0 w-full h-full object-cover transition-all duration-500" loading="lazy" /> : <div className="absolute inset-0 bg-primary/10" />}<div className="absolute inset-0 bg-gradient-to-l from-black/55 via-black/10 to-transparent" /><div className="absolute top-4 right-4 rounded-full bg-white/20 backdrop-blur px-3 py-1 text-xs text-white">استوری {active + 1}</div></div><div className="rounded-2xl bg-background/65 p-5 flex flex-col justify-between"><div><p className="text-xs text-primary font-bold mb-2">{textOf(block.title, 'روایت تصویری')}</p>{step.title && <h4 className="font-bold mb-2">{textOf(step.title)}</h4>}<p className="leading-relaxed text-sm">{textOf(step.text, step.description, step.body)}</p></div><div className="mt-5 flex gap-2">{steps.map((_: any, stepIndex: number) => <button key={stepIndex} onClick={() => setStoryStep?.(current => ({ ...current, [blockKey]: stepIndex }))} className={`flex-1 rounded-xl py-2 text-xs transition-all ${active === stepIndex ? 'bg-primary text-primary-foreground' : 'bg-muted/60 hover:bg-muted'}`} title={`استوری ${stepIndex + 1}`}>{stepIndex + 1}</button>)}</div></div></div></div>
  }

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
