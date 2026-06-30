import { useLocation, useNavigate, useParams, Link } from 'react-router-dom'
import { useState, useEffect, useMemo, useRef, useCallback, type ReactNode } from 'react'
import { useAuthContext } from '@/lib/auth-context'
import { type MockBook } from '@/lib/mock-data'
import { getBook } from '@/lib/book-repository'
import { isInMockLibrary, saveReadingProgress } from '@/lib/mock-library'
import { Button } from '@/components/ui/button'
import { ArrowLeft, BookOpen, Lock, Eye, List, Menu, Minus, Plus, X, Sparkles, FileText, HelpCircle, ChevronRight, ChevronLeft, Check, X as XIcon, Search, Highlighter, Sun, Moon, Play, Pause, PenTool, Image as ImageIcon, Network, GitBranch } from 'lucide-react'
import { toast } from 'sonner'
import { runAiThroughGateway, type AiStructuredContent, type ReaderAiAction, type RunAiResult } from '@/lib/ai-gateway'
import { supabase } from '@/integrations/supabase/client'
import { bookTextDirection, normalizeBookText, printPageLabel } from '@/lib/book-content'
import { BookContentBlock, resolveSharedBookContentBlock } from '@/components/book/BookContentBlocks'
import { subscribePublisherBookUpdates } from '@/lib/publisher-books'
import { BookRendererV2 } from '@/components/book-content-v2'
import { documentV2ToLegacyPages, type BookDocumentV2 } from '@/lib/book-document-v2'
import { loadPageEngineWindow } from '@/lib/page-content-engine'

type HighlightColor = 'yellow' | 'green' | 'red'
type HighlightEntry = {
  id: string
  text: string
  color: HighlightColor
  pageIndex: number
  blockKey?: string
  startOffset?: number
  endOffset?: number
}
type ReaderBackground = 'abstract' | 'image'
type SearchResult = { page: number; text: string; blockKey: string; offset: number; thumbnail?: string }
type SearchTarget = { page: number; blockKey: string; query: string; offset: number }
type TocTarget = { page: number; targetId?: string; title?: string }
type TocPosition = { pageIndex: number; blockIndex: number }
type HighlightDraft = { blockKey: string; startOffset: number; endOffset: number; color: HighlightColor }
type HighlightIndicator = { x: number; y: number; pointerType: string }
type ReaderTocItem = { key: string; title: string; level: number; pageIndex: number; targetId?: string }
type ReaderConfirmedTocItem = {
  id?: string
  title?: string
  level?: number
  page?: number
  pageIndex?: number
  blockId?: string
  anchor?: string
}

const highlightColors: Record<HighlightColor, { label: string; className: string; swatch: string }> = {
  yellow: { label: 'زرد', className: 'bg-yellow-200 text-yellow-950', swatch: 'bg-yellow-300' },
  green: { label: 'سبز', className: 'bg-green-200 text-green-950', swatch: 'bg-green-300' },
  red: { label: 'قرمز', className: 'bg-red-200 text-red-950', swatch: 'bg-red-300' },
}

function legacyListFromText(text = '') {
  const lines = String(text).split(/\n+/).map(line => line.trim()).filter(Boolean)
  if (lines.length < 2) return null
  const ordered = lines.every(line => /^[\d۰-۹٠-٩]+[.)-]\s+/.test(line))
  const bullet = lines.every(line => /^[•●*-]\s+/.test(line))
  if (!ordered && !bullet) return null
  return {
    ordered,
    items: lines.map(line => line.replace(ordered ? /^[\d۰-۹٠-٩]+[.)-]\s+/ : /^[•●*-]\s+/, '')),
  }
}

function readerTocItemHasChildren(items: ReaderTocItem[], index: number) {
  const level = Number(items[index]?.level || 1)
  for (let cursor = index + 1; cursor < items.length; cursor += 1) {
    const nextLevel = Number(items[cursor]?.level || 1)
    if (nextLevel <= level) return false
    if (nextLevel > level) return true
  }
  return false
}

function buildReaderTocTreeRows(items: ReaderTocItem[], collapsedKeys: Set<string>) {
  let h1Counter = 0
  const hiddenByLevels: number[] = []
  return items.map((item, index) => {
    const level = Math.min(6, Math.max(1, Number(item.level || 1)))
    while (hiddenByLevels.length && hiddenByLevels[hiddenByLevels.length - 1] >= level) hiddenByLevels.pop()
    const hidden = hiddenByLevels.length > 0
    const hasChildren = readerTocItemHasChildren(items, index)
    const collapsed = collapsedKeys.has(item.key)
    if (!hidden && hasChildren && collapsed) hiddenByLevels.push(level)
    if (level === 1) h1Counter += 1
    return { item, index, level, hidden, hasChildren, collapsed, h1Counter }
  })
}

function normalizeReaderSearchText(value = '') {
  return normalizeBookText(String(value))
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[‌\u200B\u200C\u200D\u00AC\u00AD]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function compactReaderSearchText(value = '') {
  return normalizeReaderSearchText(value).replace(/[\s._\-–—:؛،,()[\]{}«»"'`]+/g, '')
}

function readerTextMatches(text: string, query: string) {
  const raw = String(text || '')
  const cleanQuery = normalizeReaderSearchText(query)
  if (!cleanQuery) return { matched: false, offset: -1 }
  const exactOffset = raw.toLowerCase().indexOf(query.toLowerCase())
  if (exactOffset >= 0) return { matched: true, offset: exactOffset }
  const normalizedOffset = normalizeReaderSearchText(raw).indexOf(cleanQuery)
  if (normalizedOffset >= 0) return { matched: true, offset: Math.min(normalizedOffset, raw.length) }
  const compactOffset = compactReaderSearchText(raw).indexOf(compactReaderSearchText(query))
  return { matched: compactOffset >= 0, offset: compactOffset >= 0 ? Math.min(compactOffset, raw.length) : -1 }
}

function snippetForReaderSearch(text: string, query: string, offset: number) {
  const safeOffset = Math.max(0, offset)
  const start = Math.max(0, safeOffset - 38)
  return `...${String(text || '').slice(start, safeOffset + query.length + 54)}...`
}

function readerBlockSearchEntries(block: any): Array<{ text: string; blockKey: string; thumbnail?: string }> {
  if (!block) return []
  const blockId = String(block.id || block.anchor || '')
  const key = blockId || `legacy:${String(block.content || block.text || block.caption || '').slice(0, 24)}`
  const values: Array<{ text: string; blockKey: string; thumbnail?: string }> = []
  const push = (text: unknown, thumbnail?: string) => {
    const normalized = normalizeBookText(String(text || '')).trim()
    if (normalized) values.push({ text: normalized, blockKey: key, thumbnail })
  }
  push(block.title)
  push(block.subtitle)
  push(block.content)
  push(block.text)
  push(block.caption, block.url)
  push(block.question)
  push(block.answer)
  push(block.description)
  if (Array.isArray(block.items)) block.items.forEach((item: any) => push(typeof item === 'string' ? item : `${item?.text || ''} ${item?.title || ''}`))
  if (Array.isArray(block.rows)) block.rows.flat().forEach((cell: unknown) => push(cell))
  if (Array.isArray(block.blocks)) block.blocks.forEach((child: any) => values.push(...readerBlockSearchEntries(child)))
  const payload = block.payload || block.data
  if (payload && typeof payload === 'object') {
    const stack = [payload]
    while (stack.length) {
      const item: any = stack.pop()
      if (!item || typeof item !== 'object') continue
      Object.entries(item).forEach(([entryKey, entryValue]) => {
        if (entryKey === 'url' || entryKey === 'image') return
        if (typeof entryValue === 'string' || typeof entryValue === 'number') push(entryValue, typeof item.image === 'string' ? item.image : undefined)
        else if (Array.isArray(entryValue)) stack.push(...entryValue)
        else if (entryValue && typeof entryValue === 'object') stack.push(entryValue)
      })
    }
  }
  return values
}

export default function Reader() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuthContext()
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
  const [aiMindmapBranch, setAiMindmapBranch] = useState(0)
  const [aiUsage, setAiUsage] = useState<RunAiResult['usage'] | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({})
  const [highlights, setHighlights] = useState<HighlightEntry[]>([])
  const [showHighlights, setShowHighlights] = useState(false)
  const [showHighlightMenu, setShowHighlightMenu] = useState(false)
  const [highlightActive, setHighlightActive] = useState(false)
  const [selectedHighlightColor, setSelectedHighlightColor] = useState<HighlightColor>('yellow')
  const [searchQuery, setSearchQuery] = useState('')
  const [tocSearchQuery, setTocSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchTarget, setSearchTarget] = useState<SearchTarget | null>(null)
  const [tocTarget, setTocTarget] = useState<TocTarget | null>(null)
  const [collapsedReaderTocKeys, setCollapsedReaderTocKeys] = useState<Set<string>>(() => new Set())
  const [seenReaderTocKeys, setSeenReaderTocKeys] = useState<Set<string>>(() => new Set())
  const [showSearch, setShowSearch] = useState(false)
  const [timelineStep, setTimelineStep] = useState<Record<string, number>>({})
  const [storyStep, setStoryStep] = useState<Record<string, number>>({})
  const [tabStep, setTabStep] = useState<Record<string, number>>({})
  const [hotspotsVisible, setHotspotsVisible] = useState<Record<string, boolean[]>>({})
  const [fontSize, setFontSize] = useState(18)
  const [readingMode, setReadingMode] = useState<'day'|'night'|'sepia'>('day')
  const [readerBackground, setReaderBackground] = useState<ReaderBackground>('abstract')
  const [autoScroll, setAutoScroll] = useState(false)
  const [autoScrollSpeed, setAutoScrollSpeed] = useState(2)
  const [highlightHolding, setHighlightHolding] = useState(false)
  const [highlightArmed, setHighlightArmed] = useState(false)
  const [highlightDraft, setHighlightDraft] = useState<HighlightDraft | null>(null)
  const [highlightIndicator, setHighlightIndicator] = useState<HighlightIndicator | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const highlightStartRef = useRef<{
    node: Node
    offset: number
    block: HTMLElement
    blockKey: string
    blockOffset: number
    x: number
    y: number
    drawing: boolean
  } | null>(null)
  const highlightTapRef = useRef<{ x: number; y: number; time: number; blockKey: string } | null>(null)
  const highlightArmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const highlightReadyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const highlightReadyUntilRef = useRef(0)
  const liveBookRefreshTimerRef = useRef<number | null>(null)
  const pendingLiveBookRefreshRef = useRef(false)

  const refreshBook = useCallback(async (options: { showLoading?: boolean } = {}) => {
    if (!id || authLoading) return null
    if (options.showLoading) setLoadingBook(true)
    try {
      const latest = await getBook(id)
      setBook(latest)
      if (latest?.pages?.length) {
        setCurrentPage(page => Math.max(0, Math.min(page, latest.pages.length - 1)))
      }
      return latest
    } catch {
      if (options.showLoading) setBook(null)
      return null
    } finally {
      if (options.showLoading) setLoadingBook(false)
    }
  }, [authLoading, id])

  const scheduleLiveBookRefresh = useCallback((delay = 180) => {
    pendingLiveBookRefreshRef.current = true
    if (liveBookRefreshTimerRef.current) window.clearTimeout(liveBookRefreshTimerRef.current)
    liveBookRefreshTimerRef.current = window.setTimeout(() => {
      pendingLiveBookRefreshRef.current = false
      void refreshBook()
    }, delay)
  }, [refreshBook])

  useEffect(() => {
    if (authLoading) {
      setLoadingBook(true)
      return
    }
    if (id) {
      void refreshBook({ showLoading: true })
      const savedBg = localStorage.getItem(`metabooki_reader_bg_${id}`) as ReaderBackground | null
      if (savedBg === 'abstract' || savedBg === 'image') setReaderBackground(savedBg)
    }
  }, [authLoading, id, refreshBook, user?.id])

  useEffect(() => {
    if (!id || authLoading) return
    const unsubscribe = subscribePublisherBookUpdates(id, detail => {
      if (detail.action === 'deleted') {
        setBook(null)
        return
      }
      scheduleLiveBookRefresh(0)
    })
    return () => {
      unsubscribe()
      if (liveBookRefreshTimerRef.current) window.clearTimeout(liveBookRefreshTimerRef.current)
    }
  }, [authLoading, id, scheduleLiveBookRefresh])

  useEffect(() => {
    if (!id || authLoading) return
    const channel = (supabase as any)
      .channel(`metabooki-reader-live-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'books', filter: `id=eq.${id}` }, () => {
        scheduleLiveBookRefresh(0)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'books', filter: `id=eq.${id}` }, () => {
        setBook(null)
      })
      .subscribe()
    return () => {
      void (supabase as any).removeChannel(channel)
    }
  }, [authLoading, id, scheduleLiveBookRefresh])

  useEffect(() => {
    if (!book) return
    const localUserId = user?.id || user?.mockData?.id || 'guest'
    try {
      const seen = localStorage.getItem(`metabooki_reader_seen_toc_${localUserId}_${book.id}`)
      const collapsed = localStorage.getItem(`metabooki_reader_collapsed_toc_${localUserId}_${book.id}`)
      setSeenReaderTocKeys(new Set(seen ? JSON.parse(seen) : []))
      setCollapsedReaderTocKeys(new Set(collapsed ? JSON.parse(collapsed) : []))
    } catch {
      setSeenReaderTocKeys(new Set())
      setCollapsedReaderTocKeys(new Set())
    }
  }, [book?.id, user?.id, user?.mockData?.id])

  useEffect(() => {
    if (!book) return
    const localUserId = user?.id || user?.mockData?.id || 'guest'
    const key = `metabooki_highlights_${localUserId}_${book.id}`
    try {
      const saved = localStorage.getItem(key)
      if (saved) setHighlights(JSON.parse(saved))
    } catch {}
    if (!user || user.mockData) {
      const colorKey = `metabooki_highlight_color_${user?.mockData?.id || 'guest'}_${book.id}`
      try {
        const savedColor = localStorage.getItem(colorKey) as HighlightColor | null
        if (savedColor && ['yellow', 'green', 'red'].includes(savedColor)) setSelectedHighlightColor(savedColor)
      } catch {}
      return
    }
    const loadReaderData = async () => {
      const [{ data: savedHighlights }, { data: state }] = await Promise.all([
        (supabase as any).from('reader_highlights').select('*').eq('user_id', user.id).eq('book_key', book.id).order('created_at'),
        (supabase as any).from('reader_states').select('*').eq('user_id', user.id).eq('book_key', book.id).maybeSingle(),
      ])
      const remoteHighlights = (savedHighlights || []).map((item: any) => {
        const sourceParts = typeof item.source === 'string' ? item.source.split('|') : []
        return {
          id: item.id,
          text: item.text_content,
          color: item.color,
          pageIndex: item.page_index,
          blockKey: sourceParts[0] === 'selection' && sourceParts[1] ? decodeURIComponent(sourceParts[1]) : undefined,
          startOffset: sourceParts[2] !== undefined ? Number(sourceParts[2]) : undefined,
          endOffset: sourceParts[3] !== undefined ? Number(sourceParts[3]) : undefined,
        }
      })
      setHighlights(current => {
        const merged = new Map([...current, ...remoteHighlights].map(item => [item.id, item]))
        return [...merged.values()]
      })
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

  useEffect(() => {
    if (!book?.metadata?.editor_v2_page_engine) return
    const candidatePage = book.pages[currentPage] as any
    if (!candidatePage?.pageEnginePlaceholder) return
    let alive = true
    loadPageEngineWindow(book, currentPage, 10, 40).then(loaded => {
      if (!alive || !loaded.pageEngine) return
      const convertedPages = documentV2ToLegacyPages(loaded.document)
      setBook(current => {
        if (!current || current.id !== book.id) return current
        const pages = [...current.pages]
        loaded.document.pages.forEach((page, index) => {
          pages[page.index] = convertedPages[index]
        })
        return {
          ...current,
          pages,
          metadata: {
            ...(current.metadata || {}),
            confirmed_toc: loaded.manifest.toc,
            editor_v2_page_engine: true,
            editor_v2_loaded_pages: [...new Set([...(Array.isArray(current.metadata?.editor_v2_loaded_pages) ? current.metadata.editor_v2_loaded_pages as number[] : []), ...loaded.document.pages.map(page => page.index)])],
            editor_v2_window_document: loaded.document,
            page_count: loaded.manifest.pageCount,
          },
        }
      })
    }).catch(() => {})
    return () => {
      alive = false
    }
  }, [book?.id, book?.metadata?.editor_v2_page_engine, currentPage])

  const readerReturnTo = useMemo(() => {
    const raw = new URLSearchParams(location.search).get('returnTo') || ''
    return raw.startsWith('/') && !raw.startsWith('//') ? raw : ''
  }, [location.search])

  const goReaderBack = () => {
    if (readerReturnTo) {
      navigate(readerReturnTo)
      return
    }
    if (window.history.length > 1) navigate(-1)
    else navigate('/store')
  }

  const tocLookup = useMemo(() => {
    if (!book) return null
    const byId = new Map<string, TocPosition>()
    const byTitle = new Map<string, TocPosition>()
    const byPrint = new Map<number, TocPosition>()
    book.pages.forEach((candidatePage: any, pageIndex: number) => {
      const printValue = Number(candidatePage.printNumber || candidatePage.number || pageIndex + 1)
      if (Number.isFinite(printValue) && !byPrint.has(printValue)) byPrint.set(printValue, { pageIndex, blockIndex: 0 })
      ;(candidatePage.blocks || []).forEach((block: any, blockIndex: number) => {
        const position = { pageIndex, blockIndex }
        ;[block.id, block.anchor, ...(Array.isArray(block.anchors) ? block.anchors : [])].filter(Boolean).forEach((key: string) => {
          if (!byId.has(String(key))) byId.set(String(key), position)
        })
        if (block.type === 'heading') {
          const title = normalizeBookText(String(block.content || block.text || '')).trim()
          if (title && !byTitle.has(title)) byTitle.set(title, position)
        }
      })
    })
    return { byId, byTitle, byPrint }
  }, [book])

  useEffect(() => {
    if (!searchTarget || searchTarget.page !== currentPage) return
    const frame = requestAnimationFrame(() => {
      const safeKey = CSS.escape(searchTarget.blockKey)
      const target = contentRef.current?.querySelector<HTMLElement>(`[data-reader-block="${safeKey}"], [data-block-id="${safeKey}"]`)
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      target?.classList.add('reader-search-target-block')
      window.setTimeout(() => target?.classList.remove('reader-search-target-block'), 2600)
      window.setTimeout(() => setSearchTarget(current => current === searchTarget ? null : current), 3200)
    })
    return () => cancelAnimationFrame(frame)
  }, [searchTarget, currentPage])

  useEffect(() => {
    if (!tocTarget || tocTarget.page !== currentPage) return
    const frame = requestAnimationFrame(() => {
      const root = contentRef.current
      if (!root) return
      const target = tocTarget.targetId
        ? root.querySelector<HTMLElement>(`#${CSS.escape(tocTarget.targetId)}, [data-reader-anchor="${CSS.escape(tocTarget.targetId)}"]`)
        : null
      const fallback = tocTarget.title
        ? [...root.querySelectorAll<HTMLElement>('[data-reader-heading="true"], [data-book-heading="true"]')]
            .find(element => element.textContent?.trim() === tocTarget.title?.trim())
        : null
      const pageCandidate = book?.pages?.[currentPage] as any
      if (!target && !fallback && (pageCandidate?.pageEnginePlaceholder || !(pageCandidate?.blocks || []).length)) return
      const element = target || fallback || root
      const top = element.getBoundingClientRect().top + window.scrollY - 72
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
      window.setTimeout(() => setTocTarget(current => current === tocTarget ? null : current), 900)
    })
    return () => cancelAnimationFrame(frame)
  }, [tocTarget, currentPage, book])

  // Auto scroll - must be before any early returns (Rules of Hooks)
  useEffect(() => {
    if (!autoScroll || !book) return
    const interval = setInterval(() => {
      window.scrollBy({ top: autoScrollSpeed, behavior: 'auto' })
      const rect = contentRef.current?.getBoundingClientRect()
      if (rect && rect.bottom <= window.innerHeight + 100) setAutoScroll(false)
    }, 80)
    return () => clearInterval(interval)
  }, [autoScroll, autoScrollSpeed, currentPage, book])

  if (loadingBook) {
    return <ReaderLoading />
  }

  if (!book) {
    return <div className="max-w-4xl mx-auto px-4 py-20 text-center"><BookOpen className="w-20 h-20 text-muted-foreground mx-auto mb-4" /><h1 className="text-2xl font-bold">کتاب یافت نشد</h1><Button variant="outline" className="mt-4" onClick={goReaderBack}>بازگشت</Button></div>
  }

  const isFree = book.price === 0
  const isOwner = user?.mockData ? isInMockLibrary(user.mockData.id, book.id) : realOwner
  const canReadFull = isFree || isOwner
  const isPreview = book.preview_pages.includes(currentPage)
  const readerTotalPages = Math.max(1, Number(book.page_count || 0) || book.pages.length)
  const page = book.pages[currentPage] || { title: '', blocks: [] }
  const editorV2DocumentSource = book.metadata?.editor_v2_document || book.metadata?.editor_v2_window_document
  const editorV2Document = editorV2DocumentSource && (editorV2DocumentSource as BookDocumentV2).schemaVersion === '2.0'
    ? editorV2DocumentSource as BookDocumentV2
    : null
  const editorV2Page = editorV2Document?.pages?.find(item => item.index === currentPage) || editorV2Document?.pages?.[currentPage]
  const dir = book.language === 'fa' ? 'rtl' : 'ltr'
  const pageBackgroundUrl = page.background_url || book.metadata?.page_background_url
  const pageBackgroundAlpha = Number(page.background_alpha ?? book.metadata?.page_background_alpha ?? 0)
  const confirmedToc = Array.isArray(book.metadata?.confirmed_toc) ? book.metadata.confirmed_toc as ReaderConfirmedTocItem[] : []
  const preludeTitle = String(book.metadata?.prelude_title || 'ابتدای کتاب')
  const currentPrintNumber = page.printNumber
  const currentPrintLabel = currentPrintNumber === undefined || currentPrintNumber === null || currentPrintNumber === ''
    ? 'بدون شماره چاپی'
    : printPageLabel(currentPrintNumber)
  const findTocPosition = (item: ReaderConfirmedTocItem) => {
    if (Number.isFinite(Number(item.pageIndex))) {
      return { pageIndex: Math.max(0, Math.min(readerTotalPages - 1, Number(item.pageIndex))), blockIndex: 0 }
    }
    const targetIds = [item.blockId, item.anchor, item.id].filter(Boolean).map(String)
    for (const targetId of targetIds) {
      const byId = tocLookup?.byId.get(targetId)
      if (byId) return byId
    }
    const title = normalizeBookText(String(item.title || '')).trim()
    if (title) {
      const byTitle = tocLookup?.byTitle.get(title)
      if (byTitle) return byTitle
    }
    const targetPrint = Number(item.page || 1)
    const byPrint = tocLookup?.byPrint.get(targetPrint)
    if (byPrint) return byPrint
    return { pageIndex: Math.max(0, Math.min(readerTotalPages - 1, targetPrint - 1)), blockIndex: 0 }
  }
  const findTocPageIndex = (item: ReaderConfirmedTocItem) => {
    return findTocPosition(item).pageIndex
  }
  const firstTocPosition = confirmedToc.length ? findTocPosition(confirmedToc[0]) : null
  const hasPreludeToc = Boolean(firstTocPosition && (firstTocPosition.pageIndex > 0 || firstTocPosition.blockIndex > 0))
  const readerToc: ReaderTocItem[] = confirmedToc.length
    ? [
      ...(hasPreludeToc ? [{ key: 'prelude', title: preludeTitle, level: 1, pageIndex: 0, targetId: undefined }] : []),
      ...confirmedToc.map((item, index) => ({
        key: item.id || `${item.title || 'toc'}-${index}`,
        title: item.title || `بخش ${index + 1}`,
        level: Math.max(1, Math.min(6, Number(item.level || 1))),
        pageIndex: findTocPageIndex(item),
        targetId: item.anchor || item.blockId || item.id,
      })),
    ]
    : book.pages.map((p: any, i: number) => ({
        key: `page-${i}`,
        title: String(p.title || `صفحه ${i + 1}`),
        level: 1,
        pageIndex: i,
        targetId: undefined,
      }))
  const readerTocTreeRows = buildReaderTocTreeRows(readerToc, collapsedReaderTocKeys)
  const readerTocStorageUserId = user?.id || user?.mockData?.id || 'guest'
  const persistSeenReaderToc = (next: Set<string>) => {
    setSeenReaderTocKeys(next)
    localStorage.setItem(`metabooki_reader_seen_toc_${readerTocStorageUserId}_${book.id}`, JSON.stringify([...next]))
  }
  const persistCollapsedReaderToc = (next: Set<string>) => {
    setCollapsedReaderTocKeys(next)
    localStorage.setItem(`metabooki_reader_collapsed_toc_${readerTocStorageUserId}_${book.id}`, JSON.stringify([...next]))
  }
  const markReaderTocSeen = (key: string) => {
    const next = new Set(seenReaderTocKeys)
    next.add(key)
    persistSeenReaderToc(next)
  }
  const markReaderTocForPage = (pageIndex: number, target?: TocTarget) => {
    const next = new Set(seenReaderTocKeys)
    readerToc.forEach(item => {
      if (item.pageIndex === pageIndex || (target?.targetId && item.targetId === target.targetId) || (target?.title && item.title === target.title)) next.add(item.key)
    })
    if (next.size !== seenReaderTocKeys.size) persistSeenReaderToc(next)
  }
  const toggleReaderTocBranch = (key: string) => {
    const next = new Set(collapsedReaderTocKeys)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    persistCollapsedReaderToc(next)
  }
  const expandReaderToc = () => persistCollapsedReaderToc(new Set())
  const collapseReaderToc = () => persistCollapsedReaderToc(new Set(readerToc.filter((_, index) => readerTocItemHasChildren(readerToc, index)).map(item => item.key)))

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
    if (user?.mockData && canReadFull) saveReadingProgress(user.mockData.id, book.id, pg, readerTotalPages)
    else if (user) (supabase as any).from('reader_states').upsert({ user_id: user.id, book_key: book.id, current_page: pg, total_pages: readerTotalPages, background: readerBackground, highlight_color: selectedHighlightColor, updated_at: new Date().toISOString() }).then(() => {})
  }

  const goPage = (pg: number, target?: TocTarget) => {
    if (pendingLiveBookRefreshRef.current) {
      pendingLiveBookRefreshRef.current = false
      if (liveBookRefreshTimerRef.current) window.clearTimeout(liveBookRefreshTimerRef.current)
      void refreshBook()
    }
    const next = Math.max(0, Math.min(readerTotalPages - 1, pg))
    if (canReadFull || book.preview_pages.includes(next)) {
      if (target) setTocTarget({ ...target, page: next })
      markReaderTocForPage(next, target)
      setCurrentPage(next); setShowToc(false); saveProgress(next)
    }
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (highlightActive || highlightHolding || highlightArmed || Date.now() < highlightReadyUntilRef.current) return
    if (e.touches.length !== 1) return
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() }
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (highlightActive || highlightHolding || highlightArmed || Date.now() < highlightReadyUntilRef.current) {
      touchStartRef.current = null
      return
    }
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
    const key = `metabooki_highlights_${user?.id || user?.mockData?.id || 'guest'}_${book.id}`
    localStorage.setItem(key, JSON.stringify(items))
  }

  const caretAtPoint = (x: number, y: number) => {
    const doc = document as Document & {
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
      caretRangeFromPoint?: (x: number, y: number) => Range | null
    }
    const position = doc.caretPositionFromPoint?.(x, y)
    if (position) return { node: position.offsetNode, offset: position.offset }
    const range = doc.caretRangeFromPoint?.(x, y)
    return range ? { node: range.startContainer, offset: range.startOffset } : null
  }

  const getHighlightBlock = (node: Node) => {
    const element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement
    return element?.closest<HTMLElement>('[data-reader-text="true"]') || null
  }

  const getOffsetWithinBlock = (block: HTMLElement, node: Node, offset: number) => {
    const range = document.createRange()
    range.selectNodeContents(block)
    range.setEnd(node, offset)
    return range.toString().length
  }

  const getPointAtBlockOffset = (block: HTMLElement, targetOffset: number) => {
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
    let consumed = 0
    let node = walker.nextNode()
    while (node) {
      const length = node.textContent?.length || 0
      if (consumed + length >= targetOffset) return { node, offset: Math.max(0, targetOffset - consumed) }
      consumed += length
      node = walker.nextNode()
    }
    return { node: block, offset: block.childNodes.length }
  }

  const drawHighlightRange = (end: { node: Node; offset: number }, commit = false) => {
    const start = highlightStartRef.current
    const endBlock = getHighlightBlock(end.node)
    if (!start || !endBlock || endBlock.dataset.readerBlock !== start.blockKey || !contentRef.current?.contains(end.node)) return
    const liveBlock = contentRef.current.querySelector<HTMLElement>(`[data-reader-block="${CSS.escape(start.blockKey)}"]`)
    if (!liveBlock) return
    const endBlockOffset = getOffsetWithinBlock(endBlock, end.node, end.offset)
    const from = Math.min(start.blockOffset, endBlockOffset)
    const to = Math.max(start.blockOffset, endBlockOffset)
    const rangeStart = getPointAtBlockOffset(liveBlock, from)
    const rangeEnd = getPointAtBlockOffset(liveBlock, to)
    const range = document.createRange()
    try {
      range.setStart(rangeStart.node, rangeStart.offset)
      range.setEnd(rangeEnd.node, rangeEnd.offset)
    } catch {
      return
    }
    window.getSelection()?.removeAllRanges()
    if (!commit) {
      setHighlightDraft({ blockKey: start.blockKey, startOffset: from, endOffset: to, color: selectedHighlightColor })
      return
    }
    const startOffset = from
    const endOffset = to
    const text = range.toString()
    setHighlightDraft(null)
    highlightStartRef.current = null
    if (text.trim()) {
      addHighlight(selectedHighlightColor, text, 'selection', start.blockKey, startOffset, endOffset)
      highlightReadyUntilRef.current = Date.now() + 3000
      setHighlightActive(true)
      if (highlightReadyTimerRef.current) clearTimeout(highlightReadyTimerRef.current)
      highlightReadyTimerRef.current = setTimeout(() => {
        highlightReadyUntilRef.current = 0
        setHighlightActive(false)
        setHighlightIndicator(null)
      }, 3000)
    } else {
      highlightReadyUntilRef.current = 0
      setHighlightActive(false)
      setHighlightIndicator(null)
    }
  }

  const startHighlightStroke = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button,a,input,textarea,select,audio,[data-no-swipe="true"]')) return
    const caret = caretAtPoint(e.clientX, e.clientY)
    const block = caret ? getHighlightBlock(caret.node) : null
    if (!caret || !block || !contentRef.current?.contains(caret.node)) return
    const blockKey = block.dataset.readerBlock
    if (!blockKey) return
    const now = Date.now()
    const previousTap = highlightTapRef.current
    const isDoubleTap = Boolean(
      previousTap &&
      previousTap.blockKey === blockKey &&
      now - previousTap.time <= 420 &&
      Math.hypot(e.clientX - previousTap.x, e.clientY - previousTap.y) <= 42
    )
    highlightStartRef.current = { ...caret, block, blockKey, blockOffset: getOffsetWithinBlock(block, caret.node, caret.offset), x: e.clientX, y: e.clientY, drawing: false }
    if (now < highlightReadyUntilRef.current || isDoubleTap) {
      highlightTapRef.current = null
      setHighlightArmed(false)
      if (highlightArmTimerRef.current) clearTimeout(highlightArmTimerRef.current)
      highlightStartRef.current.drawing = true
      setHighlightActive(true)
      setHighlightHolding(true)
      setHighlightIndicator({ x: e.clientX, y: e.clientY, pointerType: e.pointerType })
      e.currentTarget.setPointerCapture(e.pointerId)
      e.preventDefault()
      return
    }
    highlightTapRef.current = { x: e.clientX, y: e.clientY, time: now, blockKey }
    setHighlightArmed(true)
    if (highlightArmTimerRef.current) clearTimeout(highlightArmTimerRef.current)
    highlightArmTimerRef.current = setTimeout(() => {
      highlightTapRef.current = null
      highlightStartRef.current = null
      setHighlightArmed(false)
    }, 450)
  }

  const moveHighlightStroke = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = highlightStartRef.current
    if (!start) return
    const dx = Math.abs(e.clientX - start.x)
    const dy = Math.abs(e.clientY - start.y)
    if (!start.drawing && Math.max(dx, dy) > 8) {
      highlightStartRef.current = null
      highlightTapRef.current = null
      setHighlightArmed(false)
      setHighlightIndicator(null)
      window.getSelection()?.removeAllRanges()
      return
    }
    if (!start.drawing) return
    e.preventDefault()
    const caret = caretAtPoint(e.clientX, e.clientY)
    if (caret) drawHighlightRange(caret)
  }

  const finishHighlightStroke = (e: React.PointerEvent<HTMLDivElement>) => {
    setHighlightHolding(false)
    if (!highlightStartRef.current?.drawing) {
      highlightStartRef.current = null
      setHighlightDraft(null)
      window.getSelection()?.removeAllRanges()
      return
    }
    const caret = caretAtPoint(e.clientX, e.clientY)
    if (caret) {
      setHighlightIndicator({ x: e.clientX, y: e.clientY, pointerType: e.pointerType })
      drawHighlightRange(caret, true)
    }
    else highlightStartRef.current = null
  }

  const cancelHighlightStroke = () => {
    if (highlightArmTimerRef.current) clearTimeout(highlightArmTimerRef.current)
    highlightStartRef.current = null
    highlightTapRef.current = null
    setHighlightArmed(false)
    setHighlightHolding(false)
    setHighlightDraft(null)
    setHighlightIndicator(null)
    highlightReadyUntilRef.current = 0
    setHighlightActive(false)
    window.getSelection()?.removeAllRanges()
  }

  const chooseHighlightColor = (color: HighlightColor) => {
    setSelectedHighlightColor(color)
    localStorage.setItem(`metabooki_highlight_color_${user?.id || user?.mockData?.id || 'guest'}_${book.id}`, color)
    if (user?.mockData) return setShowHighlightMenu(false)
    else if (user) (supabase as any).from('reader_states').upsert({ user_id: user.id, book_key: book.id, current_page: currentPage, total_pages: readerTotalPages, background: readerBackground, highlight_color: color, updated_at: new Date().toISOString() }).then(() => {})
    setShowHighlightMenu(false)
  }

  const toggleReaderBackground = () => {
    const next: ReaderBackground = readerBackground === 'abstract' ? 'image' : 'abstract'
    setReaderBackground(next)
    localStorage.setItem(`metabooki_reader_bg_${book.id}`, next)
    if (user?.mockData) return
    else if (user) (supabase as any).from('reader_states').upsert({ user_id: user.id, book_key: book.id, current_page: currentPage, total_pages: readerTotalPages, background: next, highlight_color: selectedHighlightColor, updated_at: new Date().toISOString() }).then(() => {})
  }

  const addHighlight = (color: HighlightColor, text: string, source: 'selection' | 'ai' = 'selection', blockKey?: string, startOffset?: number, endOffset?: number) => {
    if (!text) return
    const newHL: HighlightEntry = {
      id: crypto.randomUUID(),
      text,
      color,
      pageIndex: currentPage,
      blockKey,
      startOffset,
      endOffset,
    }
    const updated = [...highlights, newHL]
    setHighlights(updated)
    saveHighlightsForUser(updated)
    const storedSource = source === 'selection' && blockKey
      ? `selection|${encodeURIComponent(blockKey)}|${startOffset ?? ''}|${endOffset ?? ''}`
      : source
    if (user && !user.mockData) (supabase as any).from('reader_highlights').insert({ id: newHL.id, user_id: user.id, book_key: book.id, page_index: currentPage, text_content: text, color, source: storedSource }).then(() => {})
    window.getSelection()?.removeAllRanges()
  }

  const removeHighlight = (id: string) => {
    const updated = highlights.filter(h => h.id !== id)
    setHighlights(updated)
    saveHighlightsForUser(updated)
    if (user && !user.mockData) (supabase as any).from('reader_highlights').delete().eq('id', id).eq('user_id', user.id).then(() => {})
  }

  const renderHighlightedText = (text: string, blockKey: string) => {
    const pageItems = highlights.filter(h => h.pageIndex === currentPage && h.text && h.blockKey === blockKey)
    const parts: ReactNode[] = []
    let cursor = 0
    const matches: Array<{ h?: HighlightEntry; index: number; end: number; search?: boolean; draft?: HighlightDraft }> = pageItems
      .map(h => {
        const hasPreciseOffsets = Number.isInteger(h.startOffset) && Number.isInteger(h.endOffset) && h.startOffset! >= 0 && h.endOffset! <= text.length && h.endOffset! > h.startOffset!
        const legacyIndex = text.indexOf(h.text)
        const legacyIsUnique = legacyIndex >= 0 && legacyIndex === text.lastIndexOf(h.text)
        const index = hasPreciseOffsets ? h.startOffset! : legacyIsUnique ? legacyIndex : -1
        return { h, index, end: hasPreciseOffsets ? h.endOffset! : index + h.text.length, search: false }
      })
      .filter(item => item.index >= 0 && item.end > item.index)
    if (searchTarget?.page === currentPage && searchTarget.blockKey === blockKey) {
      matches.push({ index: searchTarget.offset, end: searchTarget.offset + searchTarget.query.length, search: true })
    }
    if (highlightDraft?.blockKey === blockKey && highlightDraft.endOffset > highlightDraft.startOffset) {
      matches.push({ index: highlightDraft.startOffset, end: highlightDraft.endOffset, draft: highlightDraft })
    }
    if (matches.length === 0) return text
    matches.sort((a, b) => a.index - b.index)

    matches.forEach(({ h, index, end, search, draft }) => {
      if (index < cursor) return
      if (index > cursor) parts.push(text.slice(cursor, index))
      parts.push(
        <mark key={search ? `search-${index}` : draft ? `draft-${index}-${end}` : h!.id} className={`rounded px-1 ${search ? 'reader-search-flash' : draft ? `${highlightColors[draft.color].className} reader-highlight-draft` : highlightColors[h!.color]?.className || highlightColors.yellow.className}`}>
          {text.slice(index, end)}
        </mark>
      )
      cursor = end
    })

    if (cursor < text.length) parts.push(text.slice(cursor))
    return parts
  }

  // Search
  const doSearch = async (query = searchQuery) => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      setSearchQuery('')
      setSearchResults([])
      setSearchTarget(null)
      return
    }
    const resultsFromBlocks = (blocks: any[], pageIndex: number, fallbackThumbnail?: string) => {
      const results: SearchResult[] = []
      blocks.forEach((block: any, blockIndex: number) => {
        const entries = readerBlockSearchEntries(block)
        const thumbnail = block?.type === 'image' && block.url ? block.url : fallbackThumbnail
        entries.forEach(entry => {
          const match = readerTextMatches(entry.text, trimmedQuery)
          if (!match.matched) return
          const blockKey = entry.blockKey || String(block.id || block.anchor || `p:${blockIndex}`)
          results.push({
            page: pageIndex,
            text: snippetForReaderSearch(entry.text, trimmedQuery, match.offset),
            blockKey,
            offset: Math.max(0, match.offset),
            thumbnail: entry.thumbnail || thumbnail,
          })
        })
      })
      return results
    }
    if (book.metadata?.editor_v2_page_engine) {
      const fetchSearchRows = async (needle: string, limit = 80) => (supabase as any)
        .from('book_search_index')
        .select('page_index,plain_text')
        .eq('book_id', book.id)
        .ilike('plain_text', `%${needle}%`)
        .order('page_index', { ascending: true })
        .limit(limit)
      let { data, error } = await fetchSearchRows(trimmedQuery, 80)
      if ((!Array.isArray(data) || !data.length) && compactReaderSearchText(trimmedQuery).length >= 4) {
        const fallbackNeedle = normalizeReaderSearchText(trimmedQuery).split(/\s+/).sort((a, b) => b.length - a.length)[0]?.slice(0, 5)
          || compactReaderSearchText(trimmedQuery).slice(0, 5)
        if (fallbackNeedle) {
          const fallback = await fetchSearchRows(fallbackNeedle, 160)
          data = fallback.data
          error = fallback.error
        }
      }
      if (!error && Array.isArray(data)) {
        const matchedRows = data.filter((row: any) => readerTextMatches(String(row.plain_text || ''), trimmedQuery).matched)
        const pageIndexes = matchedRows.map((row: any) => Number(row.page_index || 0)).filter(Number.isFinite)
        if (pageIndexes.length) {
          const { data: pageRows } = await (supabase as any)
            .from('book_pages')
            .select('page_index,blocks')
            .eq('book_id', book.id)
            .in('page_index', pageIndexes)
          if (Array.isArray(pageRows) && pageRows.length) {
            const blockResults = pageRows
              .sort((a: any, b: any) => Number(a.page_index || 0) - Number(b.page_index || 0))
              .flatMap((row: any) => {
                const blocks = Array.isArray(row.blocks) ? row.blocks : []
                const fallbackThumbnail = blocks.find((block: any) => block.type === 'image' && block.url)?.url
                return resultsFromBlocks(blocks, Number(row.page_index || 0), fallbackThumbnail)
              })
            if (blockResults.length) {
              setSearchResults(blockResults.slice(0, 80))
              return
            }
          }
        }
        const engineResults = matchedRows.map((row: any) => {
          const text = String(row.plain_text || '')
          const idx = readerTextMatches(text, trimmedQuery).offset
          const offset = idx >= 0 ? idx : 0
          return {
            page: Number(row.page_index || 0),
            text: snippetForReaderSearch(text, trimmedQuery, offset),
            blockKey: `page-engine:${row.page_index}`,
            offset,
          } satisfies SearchResult
        })
        setSearchResults(engineResults)
        return
      }
    }
    const results: SearchResult[] = []
    book.pages.forEach((p, i) => {
      const thumbnail = p.blocks.find((block: any) => block.type === 'image' && block.url)?.url
      results.push(...resultsFromBlocks(p.blocks || [], i, thumbnail))
    })
    setSearchResults(results.slice(0, 80))
  }

  const openSearchResult = (result: SearchResult) => {
    setSearchTarget({ page: result.page, blockKey: result.blockKey, query: searchQuery, offset: result.offset })
    goPage(result.page)
    setShowSearch(false)
  }

  const blockToPlainText = (block: any): string => {
    if (!block) return ''
    if (typeof block === 'string') return normalizeBookText(block)
    const values = [block.title, block.subtitle, block.content, block.text, block.caption, block.central, block.question, block.answer, block.description]
    if (Array.isArray(block.items)) values.push(block.items.map((item: any) => typeof item === 'string' ? item : Object.values(item || {}).join(' ')).join('\n'))
    if (Array.isArray(block.nodes)) values.push(block.nodes.join('، '))
    if (Array.isArray(block.steps)) values.push(block.steps.map((step: any) => step.text || step.title || '').join('\n'))
    if (Array.isArray(block.points)) values.push(block.points.map((point: any) => `${point.title || ''} ${point.text || ''}`).join('\n'))
    return normalizeBookText(values.filter(Boolean).join('\n'))
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
      setAiMindmapBranch(0)
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
    if (content.type === 'callout_suggestions') return content.suggestions.map(item => `${item.title}\n${item.text}\n${item.reason || ''}`).join('\n\n')
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
      return <div className="ai-timeline">
        <h4 className="text-lg font-bold mb-4">{content.title}</h4>
        <div className="ai-timeline-track">
          {content.steps.map((item, index) => <button key={`${item.title}-${index}`} onClick={() => setAiTimelineStep(index)} className={`ai-timeline-node ${index === aiTimelineStep ? 'is-active' : ''}`} title={item.title}><span>{index + 1}</span><small>{item.title}</small></button>)}
        </div>
        <div className="ai-timeline-card">
          <div className="flex items-center justify-between gap-3 mb-3"><span className="text-xs font-bold text-primary">مرحله {aiTimelineStep + 1} از {content.steps.length}</span><div className="flex gap-1"><button disabled={aiTimelineStep === 0} onClick={() => setAiTimelineStep(value => Math.max(0, value - 1))} className="ai-nav-button" title="مرحله قبل"><ChevronRight className="w-4 h-4"/></button><button disabled={aiTimelineStep >= content.steps.length - 1} onClick={() => setAiTimelineStep(value => Math.min(content.steps.length - 1, value + 1))} className="ai-nav-button" title="مرحله بعد"><ChevronLeft className="w-4 h-4"/></button></div></div>
          <h5 className="font-bold mb-2">{step?.title}</h5><p className="text-sm text-muted-foreground leading-relaxed">{step?.description}</p>
        </div>
      </div>
    }
    if (content.type === 'mindmap') {
      const branch = content.branches[aiMindmapBranch] || content.branches[0]
      return <div className="ai-mindmap">
        <div className="ai-mindmap-center">{content.title}</div>
        <div className="ai-mindmap-branches">{content.branches.map((item, index) => <button key={item.title} onClick={() => setAiMindmapBranch(index)} className={index === aiMindmapBranch ? 'is-active' : ''}><span>{index + 1}</span>{item.title}</button>)}</div>
        <div className="ai-mindmap-items">{branch?.items.map((item, index) => <button key={`${item}-${index}`} className="ai-mindmap-leaf"><span>{index + 1}</span><p>{item}</p></button>)}</div>
      </div>
    }
    if (content.type === 'callout_suggestions') {
      return <div className="space-y-3">
        {content.suggestions.map((item, index) => <section key={`${item.title}-${index}`} className="rounded-xl border bg-background/70 p-3">
          <div className="flex items-center justify-between gap-3"><h4 className="font-bold text-primary">{item.title}</h4><span className="text-xs rounded-full bg-primary/10 px-2 py-1">{index + 1}</span></div>
          <p className="mt-2 text-sm leading-7">{item.text}</p>
          {item.reason && <small className="mt-2 block text-muted-foreground">{item.reason}</small>}
        </section>)}
      </div>
    }
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
    const textOf = (...values: unknown[]) => normalizeBookText(String(values.find(value => value !== undefined && value !== null && String(value).trim()) || ''))
    const renderInteractiveImage = (url?: string, alt?: string, className = 'max-h-52 rounded-xl mb-3 object-contain bg-background/50') =>
      url ? <img src={url} alt={alt || ''} className={className} loading="lazy" /> : null
    const renderInline = () => block.inline?.length ? block.inline.map((span: any, inlineIndex: number) => {
      const spanText = normalizeBookText(span.text || '')
      const content = span.footnoteId ? <sup className="word-footnote-reference">{span.footnoteId}</sup> : span.superscript ? <sup>{spanText}</sup> : span.subscript ? <sub>{spanText}</sub> : spanText
      const formatted = <span style={{ fontWeight: span.bold ? 800 : undefined, fontStyle: span.italic ? 'italic' : undefined, color: span.color, fontFamily: span.fontFamily, fontSize: span.fontSize }}>{content}</span>
      if (span.footnoteId && span.footnoteText) return <span key={inlineIndex} className="citation-reference footnote-reference" role="button" tabIndex={0} data-tooltip-dir={bookTextDirection(span.footnoteText)}>{formatted}<span className="citation-tooltip" dir={bookTextDirection(span.footnoteText)}>{normalizeBookText(span.footnoteText)}</span></span>
      if (span.referenceText) return <span key={inlineIndex} className="citation-reference" role="button" tabIndex={0} data-tooltip-dir={bookTextDirection(span.referenceText)}>{formatted}<span className="citation-tooltip" dir={bookTextDirection(span.referenceText)}>{normalizeBookText(span.referenceText)}</span></span>
      return span.href ? <a key={inlineIndex} href={span.href} target={String(span.href).startsWith('#') ? undefined : '_blank'} rel="noreferrer" className="reader-inline-link">{formatted}</a> : <span key={inlineIndex}>{formatted}</span>
    }) : null
    const sharedBlock = resolveSharedBookContentBlock(block)
    if (sharedBlock) {
      return (
        <BookContentBlock
          key={idx}
          block={sharedBlock}
          blockKey={qKey}
          renderChild={(child, childIndex) => renderBlock(child, childIndex)}
          quizAnswers={quizAnswers}
          setQuizAnswers={setQuizAnswers}
          timelineStep={timelineStep}
          setTimelineStep={setTimelineStep}
          storyStep={storyStep}
          setStoryStep={setStoryStep}
          tabStep={tabStep}
          setTabStep={setTabStep}
          hotspotsVisible={hotspotsVisible}
          setHotspotsVisible={setHotspotsVisible}
        />
      )
    }
    switch (block.type) {
      case 'callout':
        return (
          <section key={idx} className={`book-callout reader-callout has-rendered-title callout-${block.variant || 'key'}`} data-callout-variant={block.variant || 'key'} data-callout-title={block.title || 'نکته کلیدی'} data-callout-icon={block.icon || '💡'}>
            <div className="book-callout-head">
              <span className="book-callout-icon">{block.icon || '💡'}</span>
              <strong>{block.title || 'نکته کلیدی'}</strong>
            </div>
            <div className="book-callout-content">
              {(block.blocks || []).map((child: any, childIndex: number) => renderBlock(child, childIndex))}
            </div>
          </section>
        )
      case 'list': {
        const ListTag = block.ordered ? 'ol' : 'ul'
        return (
          <ListTag key={idx} dir={block.format?.direction} className={`reader-list ${block.ordered ? 'reader-list-ordered' : 'reader-list-bullet'}`} style={{ fontSize: block.format?.fontSizePt ? `${block.format.fontSizePt}pt` : `${fontSize}px`, color: block.format?.color ? `#${block.format.color}` : undefined, fontWeight: block.format?.bold ? 800 : undefined, fontStyle: block.format?.italic ? 'italic' : undefined, textAlign: block.format?.alignment }}>
            {(block.items || []).map((item: any, itemIndex: number) => (
              <li key={itemIndex}>
                {item.inline?.length ? item.inline.map((span: any, inlineIndex: number) => {
                  const spanText = normalizeBookText(span.text || '')
                  const content = span.footnoteId ? <sup className="word-footnote-reference">{span.footnoteId}</sup> : span.superscript ? <sup>{spanText}</sup> : span.subscript ? <sub>{spanText}</sub> : spanText
                  const formatted = <span style={{ fontWeight: span.bold ? 800 : undefined, fontStyle: span.italic ? 'italic' : undefined, color: span.color, fontFamily: span.fontFamily, fontSize: span.fontSize }}>{content}</span>
                  if (span.footnoteId && span.footnoteText) return <span key={inlineIndex} className="citation-reference footnote-reference" role="button" tabIndex={0} data-tooltip-dir={bookTextDirection(span.footnoteText)}>{formatted}<span className="citation-tooltip" dir={bookTextDirection(span.footnoteText)}>{normalizeBookText(span.footnoteText)}</span></span>
                  if (span.referenceText) return <span key={inlineIndex} className="citation-reference" role="button" tabIndex={0} data-tooltip-dir={bookTextDirection(span.referenceText)}>{formatted}<span className="citation-tooltip" dir={bookTextDirection(span.referenceText)}>{normalizeBookText(span.referenceText)}</span></span>
                  return span.href ? <a key={inlineIndex} href={span.href} target={String(span.href).startsWith('#') ? undefined : '_blank'} rel="noreferrer" className="reader-inline-link">{formatted}</a> : <span key={inlineIndex}>{formatted}</span>
                }) : normalizeBookText(item.text)}
              </li>
            ))}
          </ListTag>
        )
      }
      case 'paragraph': {
        const blockKey = `p:${idx}:${block.content.length}:${block.content.slice(0, 16)}`
        const legacyList = !block.inline?.length ? legacyListFromText(block.content) : null
        if (legacyList) {
          const LegacyListTag = legacyList.ordered ? 'ol' : 'ul'
          return <LegacyListTag key={idx} className={`reader-list ${legacyList.ordered ? 'reader-list-ordered' : 'reader-list-bullet'}`} style={{ fontSize: block.format?.fontSizePt ? `${block.format.fontSizePt}pt` : `${fontSize}px`, color: block.format?.color ? `#${block.format.color}` : undefined, fontWeight: block.format?.bold ? 800 : undefined, fontStyle: block.format?.italic ? 'italic' : undefined, textAlign: block.format?.alignment }}>{legacyList.items.map((item, itemIndex) => <li key={itemIndex}>{normalizeBookText(item)}</li>)}</LegacyListTag>
        }
        return <p key={idx} id={block.anchor} dir={block.format?.direction} data-reader-text="true" data-reader-block={blockKey} className={`mb-5 leading-loose text-justify ${block.semantic === 'caption' ? 'reader-figure-caption' : block.semantic === 'table-title' ? 'reader-table-title' : block.semantic === 'footnote' ? 'reader-footnote' : block.semantic ? `reader-${block.semantic}` : ''}`} style={{fontSize: block.format?.fontSizePt ? `${block.format.fontSizePt}pt` : `${fontSize}px`, lineHeight: '2.2', color: block.format?.color ? `#${block.format.color}` : undefined, fontWeight: block.format?.bold ? 800 : undefined, fontStyle: block.format?.italic ? 'italic' : undefined, textAlign: block.format?.alignment}}>{block.anchors?.filter((anchor: string) => anchor !== block.anchor).map((anchor: string) => <span key={anchor} id={anchor} className="word-bookmark-anchor" />)}{block.inline?.length ? renderInline() : renderHighlightedText(normalizeBookText(block.content), blockKey)}</p>
      }
      case 'heading': {
        const headingId = block.anchor || block.id
        return <div key={idx} className="mb-8"><h2 id={headingId} data-reader-anchor={headingId} data-reader-heading="true" dir={block.format?.direction} className="font-bold font-display mb-5 text-primary border-r-4 border-primary pr-4" style={{fontSize: block.format?.fontSizePt ? `${block.format.fontSizePt}pt` : `${Math.max(20, 32 - (block.level || 2) * 2)}px`, color: block.format?.color ? `#${block.format.color}` : undefined, textAlign: block.format?.alignment}}>{block.anchors?.filter((anchor: string) => anchor !== block.anchor).map((anchor: string) => <span key={anchor} id={anchor} className="word-bookmark-anchor" />)}{block.inline?.length ? renderInline() : normalizeBookText(block.content)}</h2>{block.blocks?.map((b:any,i:number)=>renderBlock(b,i))}</div>
      }
      case 'image': return <div key={idx} className="mb-8 flex flex-col items-center"><img src={block.url} alt={block.caption||''} className="h-auto max-w-full rounded-2xl shadow-book" style={{ width: block.widthPx ? (String(block.widthPx).endsWith('%') || String(block.widthPx).endsWith('px') ? String(block.widthPx) : `${block.widthPx}px`) : block.widthPercent ? `${block.widthPercent}%` : '100%' }} loading="lazy" />{block.caption && <p className="text-center text-sm text-muted-foreground mt-3">{block.caption}</p>}</div>
      case 'quiz': {
        const ua = quizAnswers[qKey]; const answered = ua !== undefined
        const options = block.options || []
        return (
          <div key={idx} className="reader-interactive glass rounded-2xl p-6 mb-8 border-2 border-primary/10">
            <h3 className="font-semibold mb-4 text-lg">{textOf(block.question, block.title, 'سؤال')}</h3>
            {renderInteractiveImage(block.image, block.question)}
            <div className="space-y-2">{options.map((opt:string,i:number)=>(<button key={i} onClick={()=>{if(!answered)setQuizAnswers(q=>({...q,[qKey]:i}))}} disabled={answered} className={`w-full text-right p-3.5 rounded-xl border-2 transition-all ${answered?i===block.correct?'bg-success/20 border-success':i===ua?'bg-destructive/20 border-destructive':'bg-muted/30 border-border opacity-60':'bg-muted/50 border-border hover:bg-muted hover:border-primary/30 cursor-pointer'}`}><div className="flex items-center justify-between"><span>{textOf(opt)}</span>{answered&&i===block.correct&&<Check className="w-5 h-5 text-success"/>}{answered&&i===ua&&i!==block.correct&&<XIcon className="w-5 h-5 text-destructive"/>}</div></button>))}</div>
            {answered&&<div className={`mt-3 rounded-xl p-3 text-sm font-medium ${ua===block.correct?'bg-success/10 text-success':'bg-destructive/10 text-destructive'}`}>
              <p>{ua===block.correct?'پاسخ صحیح است.':'پاسخ نادرست است.'}</p>
              {block.explanation && <p className="mt-2 text-muted-foreground leading-relaxed">{textOf(block.explanation)}</p>}
            </div>}
          </div>)
      }
      case 'truefalse': {
        const ua = quizAnswers[qKey]; const answered = ua !== undefined
        const correct = block.answer === true || block.correct === true || block.correct === 0 ? 0 : 1
        return <div key={idx} className="reader-interactive menu-glass-70 rounded-2xl p-5 mb-8">
          <h3 className="font-semibold mb-4">{textOf(block.statement, block.question, block.title, 'درست یا نادرست')}</h3>
          {renderInteractiveImage(block.image, block.statement)}
          <div className="grid grid-cols-2 gap-3">
            {['صحیح', 'غلط'].map((label, i) => <button key={label} onClick={()=>{if(!answered)setQuizAnswers(q=>({...q,[qKey]:i}))}} disabled={answered} className={`rounded-xl border p-3 transition-all ${answered ? i === correct ? 'bg-success/15 border-success text-success' : i === ua ? 'bg-destructive/15 border-destructive text-destructive' : 'bg-background/40' : 'bg-background/60 hover:border-primary/40'}`}>{label}</button>)}
          </div>
          {answered && block.explanation && <p className="mt-3 rounded-xl bg-background/60 p-3 text-sm text-muted-foreground leading-relaxed">{textOf(block.explanation)}</p>}
        </div>
      }
      case 'flashcard': return <div key={idx} className="reader-interactive menu-glass-70 rounded-2xl p-5 mb-8"><h3 className="font-semibold mb-4">{textOf(block.title, 'فلش‌کارت‌ها')}</h3><div className="grid sm:grid-cols-2 gap-3">{(block.cards || []).map((card:any, cardIndex:number)=><details key={cardIndex} className="rounded-xl border bg-background/55 p-4 cursor-pointer"><summary className="font-bold">{textOf(card.front, card.title)}</summary>{renderInteractiveImage(card.image, card.front, 'mt-3 max-h-44 rounded-lg object-contain bg-background/50')}<p className="mt-3 text-sm text-muted-foreground leading-relaxed">{textOf(card.back, card.description, card.text)}</p></details>)}</div></div>
      case 'algorithm':
      case 'steps': {
        const steps = block.steps || block.items || block.events || []
        return <div key={idx} className="reader-interactive menu-glass-70 rounded-2xl p-5 mb-8"><h3 className="font-semibold mb-4">{textOf(block.title, block.type === 'algorithm' ? 'الگوریتم تعاملی' : 'مراحل فرآیند')}</h3><div className="grid gap-3">{steps.map((step:any, stepIndex:number)=><div key={stepIndex} className="grid grid-cols-[2.5rem_1fr] gap-3 items-start rounded-xl bg-background/55 p-3"><span className="w-10 h-10 rounded-full bg-primary text-primary-foreground grid place-items-center font-bold">{stepIndex+1}</span><div>{renderInteractiveImage(step.image, step.title, 'max-h-44 rounded-lg mb-2 object-contain bg-background/50')}<h4 className="font-bold">{textOf(step.title, step.label, `مرحله ${stepIndex + 1}`)}</h4><p className="text-sm text-muted-foreground leading-relaxed">{textOf(step.description, step.text, step.body)}</p></div></div>)}</div></div>
      }
      case 'accordion': return <div key={idx} className="reader-interactive menu-glass-70 rounded-2xl p-5 mb-8"><h3 className="font-semibold mb-4">{textOf(block.title, 'آکاردئون')}</h3><div className="space-y-3">{(block.items || block.steps || []).map((item:any, itemIndex:number)=><details key={itemIndex} className="rounded-xl border bg-background/55 p-4"><summary className="font-bold cursor-pointer">{textOf(item.title, item.label, `بخش ${itemIndex + 1}`)}</summary>{renderInteractiveImage(item.image, item.title, 'mt-3 max-h-44 rounded-lg object-contain bg-background/50')}<p className="mt-3 text-sm text-muted-foreground leading-relaxed">{textOf(item.description, item.text, item.body)}</p></details>)}</div></div>
      case 'tabs': {
        const tabs = block.tabs || block.items || block.steps || []
        const active = Math.min(tabStep[qKey] ?? 0, Math.max(0, tabs.length - 1))
        const tab = tabs[active] || {}
        return <div key={idx} className="reader-interactive reader-tabs menu-glass-70 rounded-2xl p-5 mb-8" data-no-swipe="true"><h3 className="font-semibold mb-4">{textOf(block.title, 'تب‌ها')}</h3><div className="reader-tabs-list">{tabs.map((item:any, ti:number)=><button key={ti} onClick={()=>setTabStep(s=>({...s,[qKey]:ti}))} className={`reader-tabs-tab ${active===ti?'is-active':''}`}>{textOf(item.title, item.label, `تب ${ti + 1}`)}</button>)}</div><div className="reader-tabs-panel">{renderInteractiveImage(tab.image, tab.title)}<p>{textOf(tab.description, tab.text, tab.body)}</p></div></div>
      }
      case 'author': {
        const authors = block.authors || block.items || [{ name: block.name || block.title, role: block.role, bio: block.bio || block.description, image: block.image }]
        return <div key={idx} className="reader-interactive menu-glass-70 rounded-2xl p-5 mb-8"><h3 className="font-semibold mb-4">{textOf(block.title, 'معرفی نویسنده')}</h3><div className="grid sm:grid-cols-2 gap-3">{authors.map((author:any, authorIndex:number)=><div key={authorIndex} className="rounded-xl border bg-background/55 p-4">{author.image && <img src={author.image} alt={author.name || ''} className="w-20 h-20 rounded-full object-cover mb-3" loading="lazy" />}<h4 className="font-bold">{textOf(author.name, `نویسنده ${authorIndex + 1}`)}</h4>{author.role && <p className="text-xs text-primary mt-1">{textOf(author.role)}</p>}<p className="mt-3 text-sm text-muted-foreground leading-relaxed">{textOf(author.bio, author.description, author.text)}</p></div>)}</div></div>
      }
      case 'gallery': return <div key={idx} className="reader-interactive menu-glass-70 rounded-2xl p-4 mb-8"><h3 className="font-semibold mb-4">{textOf(block.title, '')}</h3><div className="grid sm:grid-cols-2 gap-3">{(block.images || []).map((image:any, imageIndex:number)=><figure key={imageIndex} className="rounded-xl overflow-hidden bg-background/55">{image.url && <img src={image.url} alt={image.caption || ''} className="w-full h-auto" loading="lazy" />}<figcaption className="p-3 text-sm text-muted-foreground">{textOf(image.caption)}</figcaption></figure>)}</div></div>
      case 'table': return <div key={idx} className="overflow-x-auto mb-8"><table className="w-full glass rounded-2xl overflow-hidden"><thead><tr className="bg-primary/10">{block.headers.map((h:string,i:number)=><th key={i} className="p-4 text-right font-semibold text-sm">{h}</th>)}</tr></thead><tbody>{block.rows.map((row:string[],ri:number)=><tr key={ri} className="border-t border-border">{row.map((c:string,ci:number)=><td key={ci} className="p-4 text-sm">{c}</td>)}</tr>)}</tbody></table></div>
      case 'math': return <div key={idx} className="glass rounded-2xl p-6 mb-8 text-center text-lg font-mono bg-muted/30 overflow-x-auto">{block.content}</div>
      case 'code': return <div key={idx} className="mb-8"><div className="glass rounded-2xl overflow-hidden"><div className="bg-muted px-4 py-2 text-xs flex items-center justify-between"><span>{block.language}</span><button onClick={()=>navigator.clipboard.writeText(block.code)} className="text-xs hover:text-primary">📋 کپی</button></div><pre className="p-5 text-sm font-mono overflow-x-auto" dir="ltr">{block.code}</pre></div></div>
      case 'timeline': {
        const events = block.events || block.steps || []
        const active = timelineStep[qKey] ?? 0
        const ev = events[active] || events[0] || {}
        return (
          <div key={idx} className="reader-interactive menu-glass-70 rounded-2xl p-5 mb-8">
            <h3 className="font-semibold mb-5 text-lg">{textOf(block.title, 'تایم‌لاین تعاملی')}</h3>
            <div className="relative overflow-x-auto pb-4" data-no-swipe="true">
              <div className="absolute top-5 right-8 left-8 h-0.5 bg-primary/25" />
              <div className="relative flex gap-4 min-w-max px-2">
              {events.map((item:any, ei:number) => (
                <button key={ei} onClick={()=>setTimelineStep(s=>({...s,[qKey]:ei}))} className="w-44 text-center" title={item.title}>
                  <span className={`mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${active===ei?'bg-primary text-primary-foreground border-primary shadow-glow':'bg-background border-primary/40 text-primary'}`}>{ei+1}</span>
                  <span className={`block rounded-xl px-3 py-2 text-xs transition-all ${active===ei?'bg-primary/10 text-primary font-bold':'bg-muted/40 text-muted-foreground'}`}>{textOf(item.year, item.title, `مرحله ${ei + 1}`)}</span>
                </button>
              ))}
              </div>
            </div>
            <div className="rounded-2xl bg-background/55 border p-5 animate-fade-in">
              {renderInteractiveImage(ev.image, ev.title)}
              <p className="text-xs text-primary font-bold mb-1">{textOf(ev.year)}</p>
              <h4 className="font-bold text-lg mb-2">{textOf(ev.title, ev.label)}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{textOf(ev.description, ev.text, ev.body)}</p>
            </div>
          </div>
        )
      }
      case 'mindmap': return <div key={idx} className="glass rounded-2xl p-6 mb-8 text-center"><h3 className="font-semibold mb-4 text-lg">{textOf(block.central, block.title, 'نقشه ذهنی')}</h3>{renderInteractiveImage(block.image, block.central)}<div className="flex flex-wrap justify-center gap-3">{(block.nodes || block.items || []).map((n:any,ni:number)=><div key={ni} className="px-5 py-2.5 rounded-full bg-primary/10 text-primary font-medium">{textOf(n.title, n.label, n)}</div>)}</div></div>
      case 'scrollytelling': {
        const steps = block.steps || block.items || []
        const active = storyStep[qKey] ?? 0
        const step = steps[active] || steps[0] || {}
        return (
          <div key={idx} className="reader-interactive reader-story menu-glass-70 rounded-2xl p-4 mb-8" data-no-swipe="true">
            <div className="grid md:grid-cols-[1.2fr_0.8fr] gap-4 items-stretch">
              <div className="relative rounded-2xl overflow-hidden min-h-72">
                {step.image ? <img src={step.image} alt={textOf(step.title, step.text)} className="absolute inset-0 w-full h-full object-cover transition-all duration-500" loading="lazy" /> : <div className="absolute inset-0 bg-primary/10" />}
                <div className="absolute inset-0 bg-gradient-to-l from-black/55 via-black/10 to-transparent" />
                <div className="absolute top-4 right-4 rounded-full bg-white/20 backdrop-blur px-3 py-1 text-xs text-white">استوری {active + 1}</div>
              </div>
              <div className="rounded-2xl bg-background/65 p-5 flex flex-col justify-between">
                <div>
                  <p className="text-xs text-primary font-bold mb-2">{textOf(block.title, 'روایت تصویری')}</p>
                  {step.title && <h4 className="font-bold mb-2">{textOf(step.title)}</h4>}
                  <p className="leading-relaxed text-sm">{textOf(step.text, step.description, step.body)}</p>
                </div>
                <div className="mt-5 flex gap-2">
                  {steps.map((_:any, si:number)=>(
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

  const bgClass = readingMode === 'night' ? 'bg-[#0f172a] text-slate-100' : readingMode === 'sepia' ? 'bg-[#f4ecd8] text-[#5b4636]' : 'bg-background text-foreground'
  const sidePanelClass = `reader-side-panel ${dir === 'rtl' ? 'right-0 border-l' : 'left-0 border-r'} frosted-menu-surface`

  return (
    <div
      className={`reader-protected min-h-screen transition-colors duration-500 ${bgClass}`}
      dir={dir}
      onCopy={e => e.preventDefault()}
      onCut={e => e.preventDefault()}
      onDragStart={e => e.preventDefault()}
      onContextMenu={e => {
        if ((e.target as HTMLElement).closest('.reader-content-protected')) e.preventDefault()
      }}
    >
      {readerBackground === 'abstract' ? (
        <div className={`reader-abstract-bg ${getReaderBgClass()}`} />
      ) : (
        <div className="reader-image-bg" style={{ ['--reader-bg-image' as string]: `url("${book.cover_url}")` }} />
      )}
      {highlightActive && highlightIndicator && (
        <div
          className={`reader-highlight-indicator ${highlightIndicator.pointerType === 'touch' ? 'is-touch' : 'is-pointer'} ${highlightColors[selectedHighlightColor].className}`}
          style={{ left: highlightIndicator.x, top: highlightIndicator.y }}
          aria-hidden="true"
        >
          <Highlighter className="w-4 h-4"/>
        </div>
      )}
      {(showToc || showSearch || showAiPanel || showHighlights || showHighlightMenu) && (
        <div
          className="fixed inset-0 z-40 menu-backdrop-blur animate-fade-in"
          onClick={() => { setShowToc(false); setShowSearch(false); setShowAiPanel(false); setShowHighlights(false); setShowHighlightMenu(false) }}
          aria-hidden="true"
        />
      )}
      {/* Top Bar */}
      <div className="sticky top-0 z-40 frosted-menu-surface border-b px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={canReadFull ? `/b/${book.id}` : '/store'} className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm"><ArrowLeft className="w-4 h-4"/>بازگشت</Link>
          <div className="h-5 w-px bg-border mx-1"/>
          <button onClick={() => setShowToc(!showToc)} className="p-2 rounded-lg hover:bg-muted transition-colors" title="فهرست"><Menu className="w-5 h-5"/></button>
        </div>
        <div className="text-center hidden sm:block"><h1 className="text-sm font-bold font-display">{book.title}</h1></div>
        <div className="flex items-center gap-2">
          {!canReadFull && <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded-full">پیش‌نمایش</span>}
          <div className="text-xs text-muted-foreground">صفحه چاپی <span className="font-bold text-foreground">{currentPrintLabel}</span></div>
        </div>
      </div>

      <div className="relative flex min-w-0">
        {/* TOC Sidebar - on same side based on language */}
        {showToc && (
          <div className={`reader-toc-panel fixed top-0 ${dir==='rtl'?'right-0 border-l':'left-0 border-r'} z-[70] h-full w-80 frosted-menu-surface p-5 overflow-y-auto animate-slide-in-right shadow-glass`} style={{paddingTop:'4rem'}}>
            <div className="flex items-center justify-between mb-5"><h2 className="font-bold font-display text-lg">📑 فهرست</h2><button title="بستن فهرست" onClick={()=>setShowToc(false)} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4"/></button></div>
            <div className="reader-panel-search relative mb-4"><Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/><input value={tocSearchQuery} placeholder="جستجو در عناوین..." className="w-full pr-10 pl-9 py-2 rounded-xl border bg-background text-sm" onChange={e=>setTocSearchQuery(e.target.value)}/>{tocSearchQuery && <button type="button" title="پاک کردن جستجوی فهرست" onClick={() => setTocSearchQuery('')} className="reader-panel-search-clear"><X className="w-3.5 h-3.5"/></button>}</div>
            <div className="reader-toc-tools">
              <button title="باز کردن همه شاخه‌ها" onClick={expandReaderToc}><ChevronRight /></button>
              <button title="جمع کردن شاخه‌ها" onClick={collapseReaderToc}><ChevronLeft /></button>
            </div>
            <div className="reader-toc-tree">
              {readerTocTreeRows
                .filter(row => !row.hidden || tocSearchQuery.trim())
                .filter(row => !tocSearchQuery.trim() || normalizeReaderSearchText(row.item.title).includes(normalizeReaderSearchText(tocSearchQuery)))
                .map(({ item, level, hasChildren, collapsed, h1Counter }) => {
                  const seen = seenReaderTocKeys.has(item.key)
                  const locked = !canReadFull && !book.preview_pages.includes(item.pageIndex)
                  return (
                    <div key={item.key} className={`reader-toc-row level-${level} ${currentPage===item.pageIndex?'is-active':''} ${seen?'is-seen':''}`} title={item.title} style={{ '--toc-level': level } as React.CSSProperties}>
                      <button className="reader-toc-link" disabled={locked} onClick={()=>{ markReaderTocSeen(item.key); goPage(item.pageIndex, { page: item.pageIndex, targetId: item.targetId, title: item.title }) }}>
                        <span className="reader-toc-number">{level === 1 ? h1Counter.toLocaleString('fa-IR') : ''}</span>
                        <span className="reader-toc-title">{item.title}</span>
                      </button>
                      <span className="reader-toc-status">
                        {seen && <Check className="reader-toc-seen" />}
                        {locked && <Lock className="reader-toc-lock" />}
                        {hasChildren && <button title={collapsed ? 'باز کردن شاخه' : 'جمع کردن شاخه'} onClick={() => toggleReaderTocBranch(item.key)}>{collapsed ? <ChevronLeft /> : <ChevronRight />}</button>}
                      </span>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="reader-main min-w-0 w-full flex-1 max-w-3xl mx-auto px-4 sm:px-8 py-10 pb-32" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <div
            ref={contentRef}
            className={`reader-content-protected reader-page-background mb-10 min-h-[65vh] ${highlightActive ? `reader-highlight-mode reader-highlight-${selectedHighlightColor}` : ''} ${highlightArmed ? 'reader-highlight-armed' : ''} ${highlightHolding ? 'reader-highlight-holding' : ''}`}
            style={{ '--reader-page-bg': pageBackgroundUrl ? `url("${pageBackgroundUrl}")` : 'none', '--reader-page-bg-alpha': pageBackgroundAlpha } as React.CSSProperties}
            onPointerDown={startHighlightStroke}
            onPointerMove={moveHighlightStroke}
            onPointerUp={finishHighlightStroke}
            onPointerCancel={cancelHighlightStroke}
            onContextMenu={e => e.preventDefault()}
          >
            {editorV2Page ? <BookRendererV2 pages={[editorV2Page]} compact /> : page.blocks.map((block:any,i:number)=>renderBlock(block,i))}
          </div>

          {/* Page Nav */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={()=>goPage(currentPage-1)} disabled={currentPage===0}><ChevronRight className="w-4 h-4"/>قبلی</Button>
            <span className="text-sm text-muted-foreground">صفحه چاپی {currentPrintLabel} <span className="text-xs opacity-70">({currentPage + 1} از {readerTotalPages})</span></span>
            <Button variant="outline" onClick={()=>goPage(currentPage+1)} disabled={currentPage >= readerTotalPages - 1 || !canReadFull}>بعدی<ChevronLeft className="w-4 h-4"/></Button>
          </div>
        </div>
      </div>

      {/* Floating Toolbar */}
      <div className="reader-floating-toolbar frosted-menu-surface">
        <button onClick={()=>setShowToc(!showToc)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground" title="فهرست مطالب"><List className="w-4 h-4"/></button>
        <div className="w-px h-6 bg-border mx-1"/>
        {/* Reading controls */}
        <button title="کوچک‌تر کردن نوشته" onClick={()=>setFontSize(size => Math.max(12, size - 2))} disabled={fontSize <= 12} className="p-2 rounded-lg hover:bg-muted text-muted-foreground disabled:opacity-35"><Minus className="w-4 h-4"/></button>
        <button title="بزرگ‌تر کردن نوشته" onClick={()=>setFontSize(size => Math.min(28, size + 2))} disabled={fontSize >= 28} className="p-2 rounded-lg hover:bg-muted text-muted-foreground disabled:opacity-35"><Plus className="w-4 h-4"/></button>
        <div className="w-px h-6 bg-border mx-1"/>
        <button onClick={()=>setReadingMode(readingMode==='day'?'sepia':readingMode==='sepia'?'night':'day')} className="p-2 rounded-lg hover:bg-muted text-muted-foreground" title="حالت مطالعه">
          {readingMode==='day'?<Sun className="w-4 h-4"/>:readingMode==='night'?<Moon className="w-4 h-4"/>:<Sun className="w-4 h-4 text-amber-500"/>}
        </button>
        <button onClick={toggleReaderBackground} className={`p-2 rounded-lg transition-colors ${readerBackground === 'image' ? 'bg-primary/20 text-primary' : 'hover:bg-muted text-muted-foreground'}`} title={readerBackground === 'abstract' ? 'پس‌زمینه تصویری' : 'پس‌زمینه ابسترکت'}>
          {readerBackground === 'abstract' ? <ImageIcon className="w-4 h-4"/> : <Sparkles className="w-4 h-4"/>}
        </button>
        <button onClick={()=>setAutoScroll(!autoScroll)} className={`p-2 rounded-lg transition-colors ${autoScroll?'bg-primary/20 text-primary':'hover:bg-muted text-muted-foreground'}`} title="پیمایش خودکار">{autoScroll?<Pause className="w-4 h-4"/>:<Play className="w-4 h-4"/>}</button>
        {autoScroll && <label className="reader-scroll-speed" title="سرعت پیمایش خودکار"><span>{autoScrollSpeed}</span><input type="range" min="1" max="6" step="1" value={autoScrollSpeed} onChange={e => setAutoScrollSpeed(Number(e.target.value))}/></label>}
        <div className="w-px h-6 bg-border mx-1"/>
        {/* Highlight */}
        <button onClick={()=>setShowHighlightMenu(!showHighlightMenu)} className={`p-2 rounded-lg hover:bg-primary/10 transition-colors ${highlightColors[selectedHighlightColor].className}`} title="رنگ قلم هایلایت"><Highlighter className="w-4 h-4"/></button>
        <button onClick={()=>setShowHighlights(!showHighlights)} className="relative p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="لیست هایلایت‌ها">
          <PenTool className="w-4 h-4"/>
          {highlights.length > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">{highlights.length > 99 ? '+99' : highlights.length}</span>}
        </button>
        {/* Search */}
        <button onClick={()=>setShowSearch(!showSearch)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground" title="جستجو"><Search className="w-4 h-4"/></button>
        <div className="w-px h-6 bg-border mx-1"/>
        {/* AI (single icon) */}
        <button onClick={()=>setShowAiPanel(!showAiPanel)} className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="دستیار هوش مصنوعی"><Sparkles className="w-4 h-4"/></button>
      </div>

      {/* Highlight Color Menu */}
      {showHighlightMenu && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 w-full max-w-xs frosted-menu-surface rounded-2xl p-3 shadow-glass animate-slide-up">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-1.5"><Highlighter className="w-3.5 h-3.5 text-primary"/>قلم هایلایت</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                رنگ فعلی: {highlightColors[selectedHighlightColor].label}
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
          <p className="rounded-lg bg-primary/10 px-2.5 py-2 text-[11px] leading-5 text-muted-foreground">روی محل شروع دوبار کلیک یا دبل‌تپ کنید و در حرکت دوم، بدون برداشتن دست یا قلم روی متن بکشید. پس از هر هایلایت، قلم تا سه ثانیه آماده است و هایلایت بعدی فوری شروع می‌شود.</p>
        </div>
      )}

      {/* Highlights List Panel */}
      {showHighlights && (
        <div className={`${sidePanelClass} reader-highlights-panel`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2"><PenTool className="w-4 h-4 text-primary"/>لیست هایلایت‌های من</h3>
            <button title="بستن لیست هایلایت‌ها" onClick={()=>setShowHighlights(false)} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4"/></button>
          </div>
          {highlights.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">هنوز هایلایتی ثبت نشده است.</p>
          ) : (
            <div className="reader-highlights-list space-y-2">
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
        <div className={sidePanelClass}>
                <div className="flex items-center gap-2 mb-3"><Search className="w-4 h-4 text-muted-foreground"/><input value={searchQuery} onChange={e=>{const query=e.target.value;setSearchQuery(query);void doSearch(query)}} placeholder="جستجو در کتاب..." className="flex-1 bg-transparent border-none outline-none text-sm"/>{searchQuery && <button title="پاک کردن جستجو" onClick={()=>{setSearchQuery('');setSearchResults([]);setSearchTarget(null)}} className="p-1 rounded hover:bg-muted"><XIcon className="w-4 h-4"/></button>}<button title="بستن جستجو" onClick={()=>{setShowSearch(false);setSearchQuery('');setSearchResults([]);setSearchTarget(null)}} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4"/></button></div>
          {searchResults.length > 0 ? (
            <div className="reader-search-results space-y-2 overflow-y-auto">
              {searchResults.map((r,i)=>(<button key={i} onClick={()=>openSearchResult(r)} className="reader-search-result w-full text-right p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-sm">{r.thumbnail && <img src={r.thumbnail} alt="" loading="lazy"/>}<span className="min-w-0"><p className="text-xs text-primary font-bold mb-1">صفحه {r.page+1}</p><p className="text-xs">{r.text}</p></span></button>))}
            </div>
          ) : searchQuery ? <p className="text-sm text-muted-foreground text-center py-4">نتیجه‌ای یافت نشد</p> : <p className="text-sm text-muted-foreground text-center py-4">عبارت مورد نظر را جستجو کنید</p>}
        </div>
      )}

      {/* AI Panel */}
      {showAiPanel && (
        <div className={sidePanelClass}>
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
              {aiResult.type === 'quiz' ? <Button size="sm" onClick={() => runAi('quiz')} className="w-full">تولید سؤال بعدی</Button> : <Button size="sm" variant="outline" onClick={() => addHighlight(selectedHighlightColor, aiContentAsText(aiResult), 'ai')} className="w-full gap-2"><Highlighter className="w-4 h-4"/>افزودن خروجی به هایلایت‌ها</Button>}
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
