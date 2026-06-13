import { useParams, Link } from 'react-router-dom'
import { useState, useEffect, useRef, type ReactNode } from 'react'
import { useAuthContext } from '@/lib/auth-context'
import { type MockBook } from '@/lib/mock-data'
import { getBook } from '@/lib/book-repository'
import { isInMockLibrary, saveReadingProgress } from '@/lib/mock-library'
import { Button } from '@/components/ui/button'
import { ArrowLeft, BookOpen, Lock, Eye, List, X, Sparkles, FileText, HelpCircle, ChevronRight, ChevronLeft, Check, X as XIcon, Search, Highlighter, Sun, Moon, Play, Pause, PenTool, Image as ImageIcon, Network, GitBranch } from 'lucide-react'
import { toast } from 'sonner'
import { runAiThroughGateway, type AiStructuredContent, type ReaderAiAction, type RunAiResult } from '@/lib/ai-gateway'
import { supabase } from '@/integrations/supabase/client'

type HighlightColor = 'yellow' | 'green' | 'red'
type HighlightEntry = { id: string; text: string; color: HighlightColor; pageIndex: number }
type ReaderBackground = 'abstract' | 'image'

const highlightColors: Record<HighlightColor, { label: string; className: string; swatch: string }> = {
  yellow: { label: 'زرد', className: 'bg-yellow-200 text-yellow-950', swatch: 'bg-yellow-300' },
  green: { label: 'سبز', className: 'bg-green-200 text-green-950', swatch: 'bg-green-300' },
  red: { label: 'قرمز', className: 'bg-red-200 text-red-950', swatch: 'bg-red-300' },
}

export default function Reader() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthContext()
  const [book, setBook] = useState<MockBook | null>(null)
  const [loadingBook, setLoadingBook] = useState(true)
  const [realOwner, setRealOwner] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const [showToc, setShowToc] = useState(false)
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [aiResult, setAiResult] = useState<AiStructuredContent | null>(null)
  const [aiAction, setAiAction] = useState<ReaderAiAction | null>(null)
  const [aiQuizAnswer, setAiQuizAnswer] = useState<number | null>(null)
  const [aiTimelineStep, setAiTimelineStep] = useState(0)
  const [aiUsage, setAiUsage] = useState<RunAiResult['usage'] | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({})
  const [highlights, setHighlights] = useState<HighlightEntry[]>([])
  const [showHighlights, setShowHighlights] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [showHighlightMenu, setShowHighlightMenu] = useState(false)
  const [highlightActive, setHighlightActive] = useState(false)
  const [selectedHighlightColor, setSelectedHighlightColor] = useState<HighlightColor>('yellow')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{page: number, text: string}[]>([])
  const [showSearch, setShowSearch] = useState(false)
  const [timelineStep, setTimelineStep] = useState<Record<string, number>>({})
  const [storyStep, setStoryStep] = useState<Record<string, number>>({})
  const [hotspotsVisible, setHotspotsVisible] = useState<Record<string, boolean[]>>({})
  const [fontSize, setFontSize] = useState(18)
  const [readingMode, setReadingMode] = useState<'day'|'night'|'sepia'>('day')
  const [readerBackground, setReaderBackground] = useState<ReaderBackground>('abstract')
  const [autoScroll, setAutoScroll] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)

  useEffect(() => {
    if (id) {
      setLoadingBook(true)
      getBook(id).then(setBook).catch(() => setBook(null)).finally(() => setLoadingBook(false))
      const savedBg = localStorage.getItem(`metabooki_reader_bg_${id}`) as ReaderBackground | null
      if (savedBg === 'abstract' || savedBg === 'image') setReaderBackground(savedBg)
    }
  }, [id])

  useEffect(() => {
    if (!user || !book) return
    if (user.mockData) {
      const key = `metabooki_highlights_${user.mockData.id}_${book.id}`
      const colorKey = `metabooki_highlight_color_${user.mockData.id}_${book.id}`
      try {
        const savedColor = localStorage.getItem(colorKey) as HighlightColor | null
        if (savedColor && ['yellow', 'green', 'red'].includes(savedColor)) setSelectedHighlightColor(savedColor)
        const saved = localStorage.getItem(key)
        if (saved) {
          const parsed = JSON.parse(saved) as Array<HighlightEntry | any>
          setHighlights(parsed.map((h) => ({
            ...h,
            color: ['yellow', 'green', 'red'].includes(h.color) ? h.color : 'yellow'
          })))
        }
      } catch {}
      return
    }
    const loadReaderData = async () => {
      const [{ data: savedHighlights }, { data: state }] = await Promise.all([
        (supabase as any).from('reader_highlights').select('*').eq('user_id', user.id).eq('book_key', book.id).order('created_at'),
        (supabase as any).from('reader_states').select('*').eq('user_id', user.id).eq('book_key', book.id).maybeSingle(),
      ])
      setHighlights((savedHighlights || []).map((item: any) => ({ id: item.id, text: item.text_content, color: item.color, pageIndex: item.page_index })))
      if (state) {
        setCurrentPage(state.current_page || 0)
        setReaderBackground(state.background === 'image' ? 'image' : 'abstract')
        if (['yellow', 'green', 'red'].includes(state.highlight_color)) setSelectedHighlightColor(state.highlight_color)
      }
    }
    loadReaderData()
  }, [user, book])

  useEffect(() => {
    if (!user || user.mockData || !book) return
    supabase.from('user_books').select('id').eq('user_id', user.id).eq('book_id', book.id).maybeSingle()
      .then(({ data }) => setRealOwner(Boolean(data)))
  }, [user, book])

  useEffect(() => {
    if (!book) return
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior }))
    })
    return () => cancelAnimationFrame(frame)
  }, [currentPage, book?.id])

  // Auto scroll - must be before any early returns (Rules of Hooks)
  useEffect(() => {
    if (!autoScroll || !book) return
    const b = book
    const interval = setInterval(() => {
      window.scrollBy({ top: 1, behavior: 'smooth' })
      const rect = contentRef.current?.getBoundingClientRect()
      if (rect && rect.bottom <= window.innerHeight + 100 && currentPage < b.pages.length - 1) {
        setCurrentPage(p => p + 1)
      }
    }, 80)
    return () => clearInterval(interval)
  }, [autoScroll, currentPage, book])

  if (loadingBook) {
    return <ReaderLoading />
  }

  if (!book) {
    return <div className="max-w-4xl mx-auto px-4 py-20 text-center"><BookOpen className="w-20 h-20 text-muted-foreground mx-auto mb-4" /><h1 className="text-2xl font-bold">کتاب یافت نشد</h1><Link to="/store"><Button variant="outline" className="mt-4">بازگشت</Button></Link></div>
  }

  const isFree = book.price === 0
  const isOwner = user?.mockData ? isInMockLibrary(user.mockData.id, book.id) : realOwner
  const canReadFull = isFree || isOwner
  const isPreview = book.preview_pages.includes(currentPage)
  const page = book.pages[currentPage] || { title: '', blocks: [] }
  const dir = book.language === 'fa' ? 'rtl' : 'ltr'

  const getReaderBgClass = () => {
    if (book.category.includes('ادبیات') || book.category.includes('شعر')) return 'reader-bg-literature'
    if (book.category.includes('علمی') || book.category.includes('نجوم')) return 'reader-bg-science'
    if (book.category.includes('برنامه')) return 'reader-bg-code'
    if (book.category.includes('تاریخ')) return 'reader-bg-history'
    if (book.category.includes('هنر') || book.category.includes('موسیقی')) return 'reader-bg-art'
    if (book.category.includes('سبک') || book.category.includes('باغبانی') || book.category.includes('آشپزی')) return 'reader-bg-nature'
    return 'reader-bg-literature'
  }

  const saveProgress = (pg: number) => {
    if (user?.mockData && canReadFull) saveReadingProgress(user.mockData.id, book.id, pg, book.pages.length)
    else if (user) (supabase as any).from('reader_states').upsert({ user_id: user.id, book_key: book.id, current_page: pg, total_pages: book.pages.length, background: readerBackground, highlight_color: selectedHighlightColor, updated_at: new Date().toISOString() }).then(() => {})
  }

  const goPage = (pg: number) => {
    const next = Math.max(0, Math.min(book.pages.length - 1, pg))
    if (canReadFull || book.preview_pages.includes(next)) {
      setCurrentPage(next); setShowToc(false); saveProgress(next)
    }
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() }
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current
    touchStartRef.current = null
    if (!start || e.changedTouches.length !== 1) return
    const target = e.target as HTMLElement
    if (target.closest('button,a,input,textarea,select,[data-no-swipe="true"]')) return
    const dx = e.changedTouches[0].clientX - start.x
    const dy = e.changedTouches[0].clientY - start.y
    const dt = Date.now() - start.time
    if (dt > 700 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.35) return
    const isRtl = dir === 'rtl'
    if (isRtl) {
      if (dx > 0) goPage(currentPage + 1)
      else goPage(currentPage - 1)
    } else {
      if (dx < 0) goPage(currentPage + 1)
      else goPage(currentPage - 1)
    }
  }

  const saveHighlightsForUser = (items: HighlightEntry[]) => {
    if (!user?.mockData) return
    const key = `metabooki_highlights_${user.mockData.id}_${book.id}`
    localStorage.setItem(key, JSON.stringify(items))
  }

  // Capture selected text; color is chosen separately from toolbar menu
  const captureSelection = () => {
    if (!highlightActive) return
    const sel = window.getSelection()
    const text = sel?.toString().trim() || ''
    if (!text) return
    setSelectedText(text)
    addHighlight(selectedHighlightColor, text)
  }

  const chooseHighlightColor = (color: HighlightColor) => {
    setSelectedHighlightColor(color)
    setHighlightActive(true)
    if (user?.mockData) localStorage.setItem(`metabooki_highlight_color_${user.mockData.id}_${book.id}`, color)
    else if (user) (supabase as any).from('reader_states').upsert({ user_id: user.id, book_key: book.id, current_page: currentPage, total_pages: book.pages.length, background: readerBackground, highlight_color: color, updated_at: new Date().toISOString() }).then(() => {})
    setShowHighlightMenu(false)
  }

  const toggleReaderBackground = () => {
    const next: ReaderBackground = readerBackground === 'abstract' ? 'image' : 'abstract'
    setReaderBackground(next)
    if (user?.mockData) localStorage.setItem(`metabooki_reader_bg_${book.id}`, next)
    else if (user) (supabase as any).from('reader_states').upsert({ user_id: user.id, book_key: book.id, current_page: currentPage, total_pages: book.pages.length, background: next, highlight_color: selectedHighlightColor, updated_at: new Date().toISOString() }).then(() => {})
  }

  const addHighlight = (color: HighlightColor, text = selectedText) => {
    if (!text || !user) return
    const newHL: HighlightEntry = {
      id: crypto.randomUUID(),
      text,
      color,
      pageIndex: currentPage
    }
    const updated = [...highlights, newHL]
    setHighlights(updated)
    if (user.mockData) saveHighlightsForUser(updated)
    else (supabase as any).from('reader_highlights').insert({ id: newHL.id, user_id: user.id, book_key: book.id, page_index: currentPage, text_content: text, color, source: text === selectedText ? 'selection' : 'ai' }).then(() => {})
    setSelectedText('')
    window.getSelection()?.removeAllRanges()
  }

  const removeHighlight = (id: string) => {
    const updated = highlights.filter(h => h.id !== id)
    setHighlights(updated)
    if (user?.mockData) saveHighlightsForUser(updated)
    else if (user) (supabase as any).from('reader_highlights').delete().eq('id', id).eq('user_id', user.id).then(() => {})
  }

  const renderHighlightedText = (text: string) => {
    const pageItems = highlights.filter(h => h.pageIndex === currentPage && h.text)
    if (pageItems.length === 0) return text

    const parts: ReactNode[] = []
    let cursor = 0
    const matches = pageItems
      .map(h => ({ h, index: text.indexOf(h.text, cursor) }))
      .filter(item => item.index >= 0)
      .sort((a, b) => a.index - b.index)

    matches.forEach(({ h, index }) => {
      if (index < cursor) return
      if (index > cursor) parts.push(text.slice(cursor, index))
      parts.push(
        <mark key={h.id} className={`rounded px-1 ${highlightColors[h.color]?.className || highlightColors.yellow.className}`}>
          {text.slice(index, index + h.text.length)}
        </mark>
      )
      cursor = index + h.text.length
    })

    if (cursor < text.length) parts.push(text.slice(cursor))
    return parts
  }

  // Search
  const doSearch = () => {
    if (!searchQuery.trim()) { setSearchResults([]); return }
    const results: {page: number, text: string}[] = []
    book.pages.forEach((p, i) => {
      p.blocks.forEach((b: any) => {
        if (b.content && b.content.includes(searchQuery)) {
          const idx = b.content.indexOf(searchQuery)
          const start = Math.max(0, idx - 30)
          results.push({page: i, text: '...' + b.content.slice(start, idx + searchQuery.length + 30) + '...'})
        }
      })
    })
    setSearchResults(results)
  }

  const blockToPlainText = (block: any): string => {
    if (!block) return ''
    if (typeof block === 'string') return block
    const values = [block.title, block.subtitle, block.content, block.text, block.caption, block.central, block.question, block.answer, block.description]
    if (Array.isArray(block.items)) values.push(block.items.map((item: any) => typeof item === 'string' ? item : Object.values(item || {}).join(' ')).join('\n'))
    if (Array.isArray(block.nodes)) values.push(block.nodes.join('، '))
    if (Array.isArray(block.steps)) values.push(block.steps.map((step: any) => step.text || step.title || '').join('\n'))
    if (Array.isArray(block.points)) values.push(block.points.map((point: any) => `${point.title || ''} ${point.text || ''}`).join('\n'))
    return values.filter(Boolean).join('\n')
  }

  const currentPageText = () => page.blocks.map((block: any) => blockToPlainText(block)).filter(Boolean).join('\n\n')

  // AI
  const runAi = async (action: ReaderAiAction) => {
    try {
      setAiLoading(true)
      setShowAiPanel(true)
      setAiResult(null)
      setAiUsage(null)
      setAiAction(action)
      setAiQuizAnswer(null)
      setAiTimelineStep(0)
      const result = await runAiThroughGateway({
        action,
        bookTitle: book.title,
        pageTitle: `صفحه ${currentPage + 1}${page.title ? ` - ${page.title}` : ''}`,
        pageText: currentPageText(),
        bookId: book.id,
        pageIndex: currentPage,
        user,
      })
      if (!result.content) throw new Error('خروجی ساختاریافته از سرویس دریافت نشد.')
      setAiResult(result.content)
      setAiUsage(result.usage)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'اجرای دستیار هوش مصنوعی ناموفق بود')
      setAiResult(null)
    } finally {
      setAiLoading(false)
    }
  }

  const aiContentAsText = (content: AiStructuredContent) => {
    if (content.type === 'quiz') return `${content.question}\n${content.options.join('\n')}\n${content.explanation}`
    if (content.type === 'timeline') return `${content.title}\n${content.steps.map(step => `${step.title}: ${step.description}`).join('\n')}`
    if (content.type === 'mindmap') return `${content.title}\n${content.branches.map(branch => `${branch.title}: ${branch.items.join('، ')}`).join('\n')}`
    return `${content.title}\n${content.lead || ''}\n${content.sections.map(section => `${section.heading}\n${section.paragraphs.join('\n')}\n${section.bullets?.join('\n') || ''}`).join('\n')}`
  }

  const renderAiResult = (content: AiStructuredContent) => {
    if (content.type === 'quiz') {
      const answered = aiQuizAnswer !== null
      return <div className="space-y-3">
        <h4 className="text-base font-bold leading-relaxed">{content.question}</h4>
        {content.options.map((option, index) => {
          const correct = answered && index === content.correctIndex
          const wrong = answered && index === aiQuizAnswer && index !== content.correctIndex
          return <button key={`${option}-${index}`} disabled={answered} onClick={() => setAiQuizAnswer(index)} className={`w-full rounded-xl border p-3 text-right text-sm transition-all ${correct ? 'border-success bg-success/15 text-success' : wrong ? 'border-destructive bg-destructive/15 text-destructive' : 'border-border bg-background/60 hover:border-primary/50'}`}>
            <span className="flex items-center justify-between gap-3"><span>{option}</span>{correct ? <Check className="w-4 h-4"/> : wrong ? <XIcon className="w-4 h-4"/> : null}</span>
          </button>
        })}
        {answered && <div className="rounded-xl bg-primary/10 p-3 text-sm leading-relaxed"><b>{aiQuizAnswer === content.correctIndex ? 'پاسخ درست است.' : 'پاسخ درست نبود.'}</b><p className="mt-1 text-muted-foreground">{content.explanation}</p></div>}
      </div>
    }
    if (content.type === 'timeline') {
      const step = content.steps[aiTimelineStep] || content.steps[0]
      return <div><h4 className="text-lg font-bold mb-4">{content.title}</h4><div className="flex gap-2 overflow-x-auto pb-3">{content.steps.map((item, index) => <button key={`${item.title}-${index}`} onClick={() => setAiTimelineStep(index)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${index === aiTimelineStep ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{index + 1}. {item.title}</button>)}</div><div className="rounded-xl border bg-background/60 p-4"><h5 className="font-bold mb-2">{step?.title}</h5><p className="text-sm text-muted-foreground leading-relaxed">{step?.description}</p></div></div>
    }
    if (content.type === 'mindmap') return <div><h4 className="text-center text-lg font-bold text-primary mb-4">{content.title}</h4><div className="grid sm:grid-cols-2 gap-3">{content.branches.map(branch => <section key={branch.title} className="rounded-xl border bg-background/60 p-3"><h5 className="font-bold mb-2">{branch.title}</h5><ul className="space-y-1.5 text-sm text-muted-foreground">{branch.items.map(item => <li key={item} className="border-r-2 border-primary/40 pr-2">{item}</li>)}</ul></section>)}</div></div>
    return <article><header className="mb-4 border-b pb-3"><h4 className="text-xl font-bold">{content.title}</h4>{content.lead && <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{content.lead}</p>}</header><div className="space-y-5">{content.sections.map(section => <section key={section.heading}><h5 className="font-bold text-primary mb-2">{section.heading}</h5>{section.paragraphs.map(paragraph => <p key={paragraph} className="text-sm leading-8 text-foreground/85 mb-2">{paragraph}</p>)}{section.bullets?.length ? <ul className="space-y-2">{section.bullets.map(item => <li key={item} className="rounded-lg bg-primary/5 border-r-2 border-primary px-3 py-2 text-sm">{item}</li>)}</ul> : null}</section>)}</div></article>
  }

  const bookUrl = '/b/' + book.id
  const readUrl = '/read/' + book.id

  if (!book.preview_pages.includes(currentPage) && !canReadFull) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="text-center max-w-md">
          <Lock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">دسترسی محدود</h1>
          <p className="text-muted-foreground mb-6">
            برای خواندن کامل این کتاب باید آن را خریداری کنید
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to={bookUrl}>
              <Button variant="outline">صفحه کتاب</Button>
            </Link>
            <Link to={readUrl}>
              <Button className="gap-2">
                <Eye className="w-4 h-4" />
                پیش‌نمایش
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const renderBlock = (block: any, idx: number) => {
    const qKey = `${currentPage}-${idx}`
    switch (block.type) {
      case 'paragraph': return <p key={idx} className="mb-5 leading-loose text-justify select-text" style={{fontSize: `${fontSize}px`, lineHeight: '2.2'}}>{renderHighlightedText(block.content)}</p>
      case 'heading': return <div key={idx} className="mb-8"><h2 className="text-2xl font-bold font-display mb-5 text-primary border-r-4 border-primary pr-4">{block.content}</h2>{block.blocks?.map((b:any,i:number)=>renderBlock(b,i))}</div>
      case 'image': return <div key={idx} className="mb-8"><img src={block.url} alt={block.caption||''} className="w-full rounded-2xl shadow-book" loading="lazy" />{block.caption && <p className="text-center text-sm text-muted-foreground mt-3">{block.caption}</p>}</div>
      case 'quiz': {
        const ua = quizAnswers[qKey]; const answered = ua !== undefined
        return (
          <div key={idx} className="reader-interactive glass rounded-2xl p-6 mb-8 border-2 border-primary/10">
            <h3 className="font-semibold mb-4 text-lg">📝 {block.question}</h3>
            <div className="space-y-2">{block.options.map((opt:string,i:number)=>(<button key={i} onClick={()=>{if(!answered)setQuizAnswers(q=>({...q,[qKey]:i}))}} disabled={answered} className={`w-full text-right p-3.5 rounded-xl border-2 transition-all ${answered?i===block.correct?'bg-success/20 border-success':i===ua?'bg-destructive/20 border-destructive':'bg-muted/30 border-border opacity-60':'bg-muted/50 border-border hover:bg-muted hover:border-primary/30 cursor-pointer'}`}><div className="flex items-center justify-between"><span>{opt}</span>{answered&&i===block.correct&&<Check className="w-5 h-5 text-success"/>}{answered&&i===ua&&i!==block.correct&&<XIcon className="w-5 h-5 text-destructive"/>}</div></button>))}</div>
            {answered&&<p className={`mt-3 text-sm font-medium ${ua===block.correct?'text-success':'text-destructive'}`}>{ua===block.correct?'✅ پاسخ صحیح! آفرین!':'❌ پاسخ نادرست'}</p>}
          </div>)
      }
      case 'table': return <div key={idx} className="overflow-x-auto mb-8"><table className="w-full glass rounded-2xl overflow-hidden"><thead><tr className="bg-primary/10">{block.headers.map((h:string,i:number)=><th key={i} className="p-4 text-right font-semibold text-sm">{h}</th>)}</tr></thead><tbody>{block.rows.map((row:string[],ri:number)=><tr key={ri} className="border-t border-border">{row.map((c:string,ci:number)=><td key={ci} className="p-4 text-sm">{c}</td>)}</tr>)}</tbody></table></div>
      case 'math': return <div key={idx} className="glass rounded-2xl p-6 mb-8 text-center text-lg font-mono bg-muted/30 overflow-x-auto">{block.content}</div>
      case 'code': return <div key={idx} className="mb-8"><div className="glass rounded-2xl overflow-hidden"><div className="bg-muted px-4 py-2 text-xs flex items-center justify-between"><span>{block.language}</span><button onClick={()=>navigator.clipboard.writeText(block.code)} className="text-xs hover:text-primary">📋 کپی</button></div><pre className="p-5 text-sm font-mono overflow-x-auto" dir="ltr">{block.code}</pre></div></div>
      case 'timeline': {
        const active = timelineStep[qKey] ?? 0
        const ev = block.events[active] || block.events[0]
        return (
          <div key={idx} className="reader-interactive menu-glass-70 rounded-2xl p-5 mb-8">
            <h3 className="font-semibold mb-5 text-lg">⏳ تایم‌لاین تعاملی</h3>
            <div className="relative overflow-x-auto pb-4" data-no-swipe="true">
              <div className="absolute top-5 right-8 left-8 h-0.5 bg-primary/25" />
              <div className="relative flex gap-4 min-w-max px-2">
              {block.events.map((item:any, ei:number) => (
                <button key={ei} onClick={()=>setTimelineStep(s=>({...s,[qKey]:ei}))} className="w-44 text-center" title={item.title}>
                  <span className={`mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${active===ei?'bg-primary text-primary-foreground border-primary shadow-glow':'bg-background border-primary/40 text-primary'}`}>{ei+1}</span>
                  <span className={`block rounded-xl px-3 py-2 text-xs transition-all ${active===ei?'bg-primary/10 text-primary font-bold':'bg-muted/40 text-muted-foreground'}`}>{item.year}</span>
                </button>
              ))}
              </div>
            </div>
            <div className="rounded-2xl bg-background/55 border p-5 animate-fade-in">
              <p className="text-xs text-primary font-bold mb-1">{ev.year}</p>
              <h4 className="font-bold text-lg mb-2">{ev.title}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{ev.description}</p>
            </div>
          </div>
        )
      }
      case 'mindmap': return <div key={idx} className="glass rounded-2xl p-6 mb-8 text-center"><h3 className="font-semibold mb-4 text-lg">🧠 {block.central}</h3><div className="flex flex-wrap justify-center gap-3">{block.nodes.map((n:string,ni:number)=><div key={ni} className="px-5 py-2.5 rounded-full bg-primary/10 text-primary font-medium">{n}</div>)}</div></div>
      case 'scrollytelling': {
        const active = storyStep[qKey] ?? 0
        const step = block.steps[active] || block.steps[0]
        return (
          <div key={idx} className="reader-interactive reader-story menu-glass-70 rounded-2xl p-4 mb-8" data-no-swipe="true">
            <div className="grid md:grid-cols-[1.2fr_0.8fr] gap-4 items-stretch">
              <div className="relative rounded-2xl overflow-hidden min-h-72">
                <img src={step.image} alt={step.text} className="absolute inset-0 w-full h-full object-cover transition-all duration-500" />
                <div className="absolute inset-0 bg-gradient-to-l from-black/55 via-black/10 to-transparent" />
                <div className="absolute top-4 right-4 rounded-full bg-white/20 backdrop-blur px-3 py-1 text-xs text-white">استوری {active + 1}</div>
              </div>
              <div className="rounded-2xl bg-background/65 p-5 flex flex-col justify-between">
                <div>
                  <p className="text-xs text-primary font-bold mb-2">روایت تصویری</p>
                  <p className="leading-relaxed text-sm">{step.text}</p>
                </div>
                <div className="mt-5 flex gap-2">
                  {block.steps.map((_:any, si:number)=>(
                    <button key={si} onClick={()=>setStoryStep(s=>({...s,[qKey]:si}))}
                      className={`flex-1 rounded-xl py-2 text-xs transition-all ${active===si?'bg-primary text-primary-foreground':'bg-muted/60 hover:bg-muted'}`}
                      title={`استوری ${si+1}`}
                    >{si+1}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      }
      case 'hotspot': {
        const visible = hotspotsVisible[qKey] || block.points.map(()=>false)
        const allVisible = visible.every(Boolean)
        const togglePoint = (pi:number) => setHotspotsVisible(s => {
          const current = s[qKey] || block.points.map(()=>false)
          const next = [...current]
          next[pi] = !next[pi]
          return {...s, [qKey]: next}
        })
        const setAll = (value:boolean) => setHotspotsVisible(s => ({...s, [qKey]: block.points.map(()=>value)}))
        return (
          <div key={idx} className="reader-interactive reader-hotspot menu-glass-70 rounded-2xl p-4 mb-8 overflow-visible" data-no-swipe="true">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="font-semibold">📍 تصویر هات‌اسپات</h3>
              <button onClick={()=>setAll(!allVisible)} className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20">
                {allVisible ? 'مخفی کردن همه' : 'نمایش همه'}
              </button>
            </div>
            <div className="relative rounded-2xl overflow-visible">
              <img src={block.image} alt={block.caption || 'hotspot'} className="w-full h-auto" />
              {block.points.map((pt:any, pi:number)=>(
                <div key={pi} className="absolute" style={{left:`${pt.x}%`, top:`${pt.y}%`, transform:'translate(-50%, -50%)'}}>
                  <button onClick={()=>togglePoint(pi)} className="w-8 h-8 rounded-full bg-primary text-primary-foreground shadow-glow animate-pulse-glow border-2 border-white" title={pt.title}>{pi+1}</button>
                  {visible[pi] && (
                    <div className={`reader-hotspot-popover absolute top-9 w-56 menu-glass-70 rounded-xl p-3 text-sm animate-fade-in ${pt.x > 62 ? 'left-0' : 'right-0'}`}>
                      <p className="font-bold mb-1">{pt.title}</p>
                      <p className="text-muted-foreground leading-relaxed">{pt.text}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {block.caption && <p className="text-center text-xs text-muted-foreground mt-3">{block.caption}</p>}
          </div>
        )
      }
      case 'audio': return <div key={idx} className="glass rounded-2xl p-6 mb-8"><h3 className="font-semibold mb-2">🎵 {block.title}</h3><audio controls className="w-full mt-3"><source src={block.url}/></audio></div>
      default: return null
    }
  }

  const pageHighlights = highlights.filter(h => h.pageIndex === currentPage)
  const bgClass = readingMode === 'night' ? 'bg-[#0f172a] text-slate-100' : readingMode === 'sepia' ? 'bg-[#f4ecd8] text-[#5b4636]' : 'bg-background text-foreground'

  return (
    <div className={`min-h-screen transition-colors duration-500 ${bgClass}`} dir={dir}>
      {readerBackground === 'abstract' ? (
        <div className={`reader-abstract-bg ${getReaderBgClass()}`} />
      ) : (
        <div className="reader-image-bg" style={{ ['--reader-bg-image' as string]: `url("${book.cover_url}")` }} />
      )}
      {(showToc || showSearch || showAiPanel || showHighlights || showHighlightMenu) && (
        <div
          className="fixed inset-0 z-40 menu-backdrop-blur animate-fade-in"
          onClick={() => { setShowToc(false); setShowSearch(false); setShowAiPanel(false); setShowHighlights(false); setShowHighlightMenu(false) }}
          aria-hidden="true"
        />
      )}
      {/* Top Bar */}
      <div className="sticky top-0 z-40 menu-glass-70 border-b px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={canReadFull ? `/b/${book.id}` : '/store'} className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm"><ArrowLeft className="w-4 h-4"/>بازگشت</Link>
          <div className="h-5 w-px bg-border mx-1"/>
          <div className="text-xs text-muted-foreground">
            <span className="font-bold text-foreground">{currentPage + 1}</span> / {book.pages.length}
          </div>
        </div>
        <div className="text-center hidden sm:block"><h1 className="text-sm font-bold font-display">{book.title}</h1></div>
        <div className="flex items-center gap-2">
          {!canReadFull && <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded-full">پیش‌نمایش</span>}
          <button onClick={() => setShowToc(!showToc)} className="p-2 rounded-lg hover:bg-muted transition-colors" title="فهرست"><List className="w-5 h-5"/></button>
        </div>
      </div>

      <div className="relative flex min-w-0">
        {/* TOC Sidebar - on same side based on language */}
        {showToc && (
          <div className={`reader-toc-panel fixed top-0 ${dir==='rtl'?'right-0 border-l':'left-0 border-r'} z-[70] h-full w-80 toc-menu-clear p-5 overflow-y-auto animate-slide-in-right shadow-glass`} style={{paddingTop:'4rem'}}>
            <div className="flex items-center justify-between mb-5"><h2 className="font-bold font-display text-lg">📑 فهرست</h2><button title="بستن فهرست" onClick={()=>setShowToc(false)} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4"/></button></div>
            <div className="relative mb-4"><Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/><input placeholder="جستجو در عناوین..." className="w-full pr-10 pl-3 py-2 rounded-xl border bg-background text-sm" onChange={e=>setSearchQuery(e.target.value)}/></div>
            {book.pages.map((p:any,i:number)=>(<button key={i} onClick={()=>goPage(i)} className={`block w-full text-right p-2.5 rounded-xl text-sm mb-1 transition-all ${currentPage===i?'bg-primary/10 text-primary font-bold':'hover:bg-muted'}`}><div className="flex items-center justify-between"><span>{p.title||`صفحه ${i+1}`}</span>{!canReadFull&&!book.preview_pages.includes(i)&&<Lock className="w-3 h-3 text-muted-foreground"/>}</div></button>))}
          </div>
        )}

        {/* Main Content */}
        <div className="reader-main min-w-0 w-full flex-1 max-w-3xl mx-auto px-4 sm:px-8 py-10 pb-32" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <div ref={contentRef} className="mb-10 min-h-[65vh]" onMouseUp={captureSelection}>
            {/* Highlights bar */}
            {pageHighlights.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {pageHighlights.map(hl => (
                  <div key={hl.id} className={`text-sm px-3 py-1 rounded-full flex items-center gap-2 ${highlightColors[hl.color]?.className || highlightColors.yellow.className}`}>
                    <PenTool className="w-3 h-3"/><span className="truncate max-w-[200px]">{hl.text.slice(0,40)}</span>
                  </div>
                ))}
              </div>
            )}
            {page.blocks.map((block:any,i:number)=>renderBlock(block,i))}
          </div>

          {/* Page Nav */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={()=>goPage(currentPage-1)} disabled={currentPage===0}><ChevronRight className="w-4 h-4"/>قبلی</Button>
            <span className="text-sm text-muted-foreground">{currentPage+1} از {book.pages.length}</span>
            <Button variant="outline" onClick={()=>goPage(currentPage+1)} disabled={currentPage>=book.pages.length-1||!canReadFull}>بعدی<ChevronLeft className="w-4 h-4"/></Button>
          </div>
        </div>
      </div>

      {/* Floating Toolbar */}
      <div className="reader-floating-toolbar menu-glass-70">
        {/* Reading controls */}
        {[12,14,18,22,28].map(sz=><button key={sz} title={`اندازه فونت ${sz}`} onClick={()=>setFontSize(sz)} className={`px-2 py-1 rounded-lg text-xs font-bold transition-colors ${fontSize===sz?'bg-primary text-primary-foreground':'hover:bg-muted text-muted-foreground'}`}>A{sz===12?'':sz===28?'+':''}</button>)}
        <div className="w-px h-6 bg-border mx-1"/>
        <button onClick={()=>setReadingMode(readingMode==='day'?'sepia':readingMode==='sepia'?'night':'day')} className="p-2 rounded-lg hover:bg-muted text-muted-foreground" title="حالت مطالعه">
          {readingMode==='day'?<Sun className="w-4 h-4"/>:readingMode==='night'?<Moon className="w-4 h-4"/>:<Sun className="w-4 h-4 text-amber-500"/>}
        </button>
        <button onClick={toggleReaderBackground} className={`p-2 rounded-lg transition-colors ${readerBackground === 'image' ? 'bg-primary/20 text-primary' : 'hover:bg-muted text-muted-foreground'}`} title={readerBackground === 'abstract' ? 'پس‌زمینه تصویری' : 'پس‌زمینه ابسترکت'}>
          {readerBackground === 'abstract' ? <ImageIcon className="w-4 h-4"/> : <Sparkles className="w-4 h-4"/>}
        </button>
        <button onClick={()=>setAutoScroll(!autoScroll)} className={`p-2 rounded-lg transition-colors ${autoScroll?'bg-primary/20 text-primary':'hover:bg-muted text-muted-foreground'}`} title="پیمایش خودکار">{autoScroll?<Pause className="w-4 h-4"/>:<Play className="w-4 h-4"/>}</button>
        <div className="w-px h-6 bg-border mx-1"/>
        {/* Highlight */}
        <button onClick={()=>setShowHighlightMenu(!showHighlightMenu)} className={`p-2 rounded-lg hover:bg-primary/10 transition-colors ${highlightActive ? highlightColors[selectedHighlightColor].className : 'text-muted-foreground hover:text-primary'}`} title="قلم هایلایت / انتخاب رنگ"><Highlighter className="w-4 h-4"/></button>
        <button onClick={()=>setShowHighlights(!showHighlights)} className="relative p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="لیست هایلایت‌ها">
          <PenTool className="w-4 h-4"/>
          {highlights.length > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">{highlights.length > 99 ? '+99' : highlights.length}</span>}
        </button>
        {/* Search */}
        <button onClick={()=>setShowSearch(!showSearch)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground" title="جستجو"><Search className="w-4 h-4"/></button>
        <div className="w-px h-6 bg-border mx-1"/>
        {/* AI (single icon) */}
        <button onClick={()=>setShowAiPanel(!showAiPanel)} className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="دستیار هوش مصنوعی"><Sparkles className="w-4 h-4"/></button>
        {/* TOC toggle */}
        <button onClick={()=>setShowToc(!showToc)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground" title="فهرست مطالب"><List className="w-4 h-4"/></button>
      </div>

      {/* Highlight Color Menu */}
      {showHighlightMenu && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 w-full max-w-xs menu-glass-70 rounded-2xl p-3 shadow-glass animate-slide-up">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-1.5"><Highlighter className="w-3.5 h-3.5 text-primary"/>قلم هایلایت</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                رنگ فعلی: {highlightColors[selectedHighlightColor].label} — وضعیت: {highlightActive ? 'فعال' : 'غیرفعال'}
              </p>
            </div>
            <button title="بستن منوی هایلایت" onClick={()=>setShowHighlightMenu(false)} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4"/></button>
          </div>
          <div className="flex items-center justify-center gap-3 mb-2">
            {(Object.keys(highlightColors) as HighlightColor[]).map(color => (
              <button
                key={color}
                onClick={()=>chooseHighlightColor(color)}
                className={`h-8 w-8 rounded-full border-2 transition-all hover:scale-110 cursor-pointer ${highlightColors[color].swatch} ${selectedHighlightColor === color ? 'ring-2 ring-primary ring-offset-2' : 'border-white/80'}`}
                title={`انتخاب رنگ ${highlightColors[color].label}`}
                aria-label={`انتخاب رنگ ${highlightColors[color].label}`}
              />
            ))}
          </div>
          <button
            onClick={()=>{ setHighlightActive(!highlightActive); setShowHighlightMenu(false) }}
            className={`w-full rounded-lg py-2 text-xs font-medium ${highlightActive ? 'bg-destructive/15 text-destructive hover:bg-destructive/20' : 'bg-primary/15 text-primary hover:bg-primary/20'}`}
          >
            {highlightActive ? 'غیرفعال کردن هایلایت' : 'فعال کردن هایلایت'}
          </button>
        </div>
      )}

      {/* Highlights List Panel */}
      {showHighlights && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg menu-glass-70 rounded-2xl p-5 shadow-glass animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2"><PenTool className="w-4 h-4 text-primary"/>لیست هایلایت‌های من</h3>
            <button title="بستن لیست هایلایت‌ها" onClick={()=>setShowHighlights(false)} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4"/></button>
          </div>
          {highlights.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">هنوز هایلایتی ثبت نشده است.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {highlights.map(hl => (
                <div key={hl.id} className="rounded-xl bg-muted/40 p-3 border border-border/60">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      onClick={()=>{ goPage(hl.pageIndex); setShowHighlights(false) }}
                      className="text-right flex-1"
                      title={`رفتن به صفحه ${hl.pageIndex + 1}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-block w-3 h-3 rounded-full ${highlightColors[hl.color]?.swatch || highlightColors.yellow.swatch}`} />
                        <span className="text-xs text-primary font-bold">صفحه {hl.pageIndex + 1}</span>
                        <span className="text-xs text-muted-foreground">{highlightColors[hl.color]?.label}</span>
                      </div>
                      <p className={`text-sm rounded-lg px-2 py-1 inline ${highlightColors[hl.color]?.className || highlightColors.yellow.className}`}>{hl.text}</p>
                    </button>
                    <button onClick={()=>removeHighlight(hl.id)} title="حذف هایلایت" className="p-1 rounded hover:bg-destructive/10 text-destructive shrink-0"><X className="w-4 h-4"/></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search Panel */}
      {showSearch && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg menu-glass-70 rounded-2xl p-4 shadow-glass animate-slide-up">
          <div className="flex items-center gap-2 mb-3"><Search className="w-4 h-4 text-muted-foreground"/><input value={searchQuery} onChange={e=>{setSearchQuery(e.target.value);doSearch()}} placeholder="جستجو در کتاب..." className="flex-1 bg-transparent border-none outline-none text-sm"/><button title="بستن جستجو" onClick={()=>setShowSearch(false)} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4"/></button></div>
          {searchResults.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {searchResults.map((r,i)=>(<button key={i} onClick={()=>{goPage(r.page);setShowSearch(false)}} className="w-full text-right p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-sm"><p className="text-xs text-primary font-bold mb-1">صفحه {r.page+1}</p><p className="text-xs">{r.text}</p></button>))}
            </div>
          ) : searchQuery ? <p className="text-sm text-muted-foreground text-center py-4">نتیجه‌ای یافت نشد</p> : <p className="text-sm text-muted-foreground text-center py-4">عبارت مورد نظر را جستجو کنید</p>}
        </div>
      )}

      {/* AI Panel */}
      {showAiPanel && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg menu-glass-70 rounded-2xl p-5 shadow-glass animate-slide-up">
          <div className="flex items-center justify-between mb-4"><h3 className="font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary"/>دستیار هوش مصنوعی</h3><button title="بستن دستیار" onClick={()=>setShowAiPanel(false)} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4"/></button></div>
          <div className="grid grid-cols-5 gap-1.5 mb-4">
            {([
              ['summary', FileText, 'خلاصه'],
              ['quiz', HelpCircle, 'سؤال'],
              ['mindmap', Network, 'ذهنی'],
              ['learning_path', GitBranch, 'مراحل'],
              ['explain', Sparkles, 'شرح'],
            ] as const).map(([action, Icon, label]) => <button key={action} disabled={aiLoading} onClick={() => runAi(action)} title={label} className={`flex min-w-0 flex-col items-center gap-1 rounded-xl p-2 text-[10px] transition-colors ${aiAction === action ? 'bg-primary text-primary-foreground' : 'bg-muted/50 hover:bg-muted'}`}><Icon className="w-4 h-4"/><span>{label}</span></button>)}
          </div>
          {aiLoading ? (
            <div className="ai-thinking-loader">
              <div className="ai-thinking-orbit"><Sparkles className="h-5 w-5" /></div>
              <div>
                <p className="font-bold">در حال خواندن و تحلیل این صفحه</p>
                <p className="mt-1 text-xs text-muted-foreground">ساخت پاسخ دقیق بر اساس متن کتاب...</p>
              </div>
              <div className="ai-thinking-bars"><span/><span/><span/><span/><span/></div>
            </div>
          ) : !aiResult ? (
            <div className="py-6 text-center">
              <p className="text-sm font-medium">یک ابزار را برای تحلیل همین صفحه انتخاب کنید.</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-2">هزینه واقعی درخواست طبق تنظیمات ادمین از کردیت شما کسر می‌شود.</p>
            </div>
          ) : (
            <div className="animate-fade-in">
              <div className="bg-muted/35 rounded-xl p-4 mb-3 max-h-[55vh] overflow-y-auto">{renderAiResult(aiResult)}</div>
              {aiResult.type === 'quiz' ? <Button size="sm" onClick={() => runAi('quiz')} className="w-full">تولید سؤال بعدی</Button> : <Button size="sm" variant="outline" onClick={() => addHighlight(selectedHighlightColor, aiContentAsText(aiResult))} className="w-full gap-2"><Highlighter className="w-4 h-4"/>افزودن خروجی به هایلایت‌ها</Button>}
              {aiUsage && <p className="mt-3 text-center text-[11px] text-muted-foreground">{aiUsage.chargedCredits.toLocaleString('fa-IR')} کردیت کسر شد</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ReaderLoading() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="menu-glass-70 w-full max-w-md rounded-2xl p-8 text-center">
        <div className="mx-auto mb-5 h-24 w-16 animate-pulse rounded-lg bg-primary/20 shadow-book" />
        <p className="font-bold">در حال آماده‌کردن کتابخوان</p>
        <div className="mx-auto mt-4 h-1.5 max-w-xs overflow-hidden rounded-full bg-muted"><div className="h-full w-1/2 animate-[reader-load_1.2s_ease-in-out_infinite] rounded-full bg-primary" /></div>
      </div>
    </div>
  )
}
