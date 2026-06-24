import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, BookOpen, ChevronDown, ChevronLeft, ChevronRight, Eye, FileText, Image as ImageIcon, Info, ListTree, Loader2, PanelRight, Save, Sparkles, Type, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BookRendererV2 } from '@/components/book-content-v2'
import { getBook } from '@/lib/book-repository'
import { updatePublisherBook, type PublisherBook } from '@/lib/publisher-books'
import { openReaderPreview } from '@/lib/app-routes'
import { supabase } from '@/integrations/supabase/client'
import { estimateAiTextUsage, runAiThroughGateway, type RunAiResult } from '@/lib/ai-gateway'
import { useAuthContext } from '@/lib/auth-context'
import { useCredits } from '@/hooks/useCredits'
import { creditsBus } from '@/lib/credits-bus'
import { buildTocFromHeadingsV2, createV2Id, documentV2ToConfirmedToc, documentV2ToLegacyPages, legacyBookToDocumentV2, normalizeBookTextV2, resolveTocTreeV2, tocAsFlatListV2, type BookBlockV2, type BookDocumentV2, type BookTocItemV2, type CalloutBlockV2, type HeadingBlockV2, type ParagraphBlockV2 } from '@/lib/book-document-v2'
import type { PrintPageValue } from '@/lib/book-content'
import type { MockBook } from '@/lib/mock-data'
import './editor-v2.css'

type EditorPanelV2 = 'toc' | 'upgrade' | 'media' | 'interactive' | 'ai'
type SaveStateV2 = 'idle' | 'saving' | 'saved' | 'error'
type AiApprovalV2 = {
  usage: RunAiResult['usage']
  provider: string
  model: string
  pageText: string
}

const PANEL_LABELS: Record<EditorPanelV2, { title: string; icon: typeof ListTree }> = {
  toc: { title: 'فهرست', icon: ListTree },
  upgrade: { title: 'ارتقا متن', icon: FileText },
  media: { title: 'رسانه', icon: ImageIcon },
  interactive: { title: 'ابزار تعاملی', icon: PanelRight },
  ai: { title: 'هوش مصنوعی', icon: Sparkles },
}

const CALLOUT_VARIANTS_V2 = ['key', 'question', 'warning', 'quote', 'deep', 'practice', 'glossary', 'data', 'margin'] as const

const CALLOUT_META_V2: Record<(typeof CALLOUT_VARIANTS_V2)[number], { title: string; icon: string }> = {
  key: { title: 'نکته کلیدی', icon: '💡' },
  question: { title: 'مکث و فکر کن', icon: '❔' },
  warning: { title: 'اشتباه رایج', icon: '⚠️' },
  quote: { title: 'جمله طلایی', icon: '❝' },
  deep: { title: 'عمیق‌تر بخوان', icon: '🔍' },
  practice: { title: 'تمرین سریع', icon: '✅' },
  glossary: { title: 'تعریف واژه', icon: '📘' },
  data: { title: 'داده و منبع', icon: '📊' },
  margin: { title: 'یادداشت حاشیه‌ای', icon: '📝' },
}

function mapBlocksV2(blocks: BookBlockV2[], mapper: (block: BookBlockV2) => BookBlockV2 | BookBlockV2[] | null): BookBlockV2[] {
  return blocks.flatMap(block => {
    const nextBlock = block.type === 'callout' ? { ...block, blocks: mapBlocksV2(block.blocks, mapper) } : block
    const mapped = mapper(nextBlock)
    if (!mapped) return []
    return Array.isArray(mapped) ? mapped : [mapped]
  })
}

function findBlockV2(blocks: BookBlockV2[], id?: string): BookBlockV2 | null {
  if (!id) return null
  for (const block of blocks) {
    if (block.id === id) return block
    if (block.type === 'callout') {
      const found = findBlockV2(block.blocks, id)
      if (found) return found
    }
  }
  return null
}

function findBlockInDocumentV2(document: BookDocumentV2, id?: string) {
  for (const page of document.pages) {
    const block = findBlockV2(page.blocks, id)
    if (block) return block
  }
  return null
}

function rebuildDocumentTocV2(document: BookDocumentV2): BookDocumentV2 {
  return { ...document, toc: buildTocFromHeadingsV2(document.pages), updatedAt: new Date().toISOString() }
}

function updateBlockInDocumentV2(document: BookDocumentV2, blockId: string, mapper: (block: BookBlockV2) => BookBlockV2 | BookBlockV2[] | null) {
  const pages = document.pages.map(page => ({ ...page, blocks: mapBlocksV2(page.blocks, block => block.id === blockId ? mapper(block) : block) }))
  return rebuildDocumentTocV2({ ...document, pages })
}

function insertBlockAfterV2(document: BookDocumentV2, selectedBlockId: string | undefined, newBlock: BookBlockV2) {
  let inserted = false
  const insertInBlocks = (blocks: BookBlockV2[]): BookBlockV2[] => {
    const next: BookBlockV2[] = []
    blocks.forEach(block => {
      if (block.type === 'callout') next.push({ ...block, blocks: insertInBlocks(block.blocks) })
      else next.push(block)
      if (!inserted && selectedBlockId && block.id === selectedBlockId) {
        next.push(newBlock)
        inserted = true
      }
    })
    return next
  }
  const pages = document.pages.map(page => ({ ...page, blocks: insertInBlocks(page.blocks) }))
  if (!inserted) {
    const firstPage = pages[0] || { id: createV2Id('page', 1), index: 0, printNumber: 1, blocks: [] }
    firstPage.blocks = [...firstPage.blocks, newBlock]
    if (!pages.length) pages.push(firstPage)
  }
  return rebuildDocumentTocV2({ ...document, pages })
}

function createInteractiveTemplateV2(kind: string, printNumber?: PrintPageValue): BookBlockV2 {
  const id = createV2Id('interactive', kind, Date.now())
  const common = { id, type: 'interactive' as const, kind: kind as any, anchor: id, printNumber }
  if (kind === 'quiz') return { ...common, title: 'کوییز چندگزینه‌ای', payload: { question: 'سؤال را اینجا بنویسید', options: ['گزینه اول', 'گزینه دوم', 'گزینه سوم'], correct: 0, explanation: '' } }
  if (kind === 'truefalse') return { ...common, title: 'صحیح یا غلط', payload: { question: 'گزاره را اینجا بنویسید', options: ['صحیح', 'غلط'], correct: 0, explanation: '' } }
  if (kind === 'flashcard') return { ...common, title: 'فلش‌کارت', payload: { cards: [{ front: 'روی کارت', back: 'پشت کارت', image: '' }] } }
  if (kind === 'gallery') return { ...common, title: 'گالری تصویر', payload: { title: 'گالری تصویر', images: [{ url: '', caption: '' }] } }
  if (kind === 'timeline') return { ...common, title: 'تایم‌لاین', payload: { title: 'تایم‌لاین', events: [{ title: 'مرحله اول', description: '', image: '' }, { title: 'مرحله دوم', description: '', image: '' }] } }
  if (kind === 'author') return { ...common, title: 'معرفی نویسندگان', payload: { title: 'نویسندگان', authors: [{ name: '', role: '', bio: '', image: '' }] } }
  return { ...common, title: 'مراحل تعاملی', payload: { title: 'مراحل تعاملی', steps: [{ title: 'مرحله اول', description: '', image: '' }, { title: 'مرحله دوم', description: '', image: '' }] } }
}

function plainTextFromBlockV2(block: BookBlockV2): string {
  if (block.type === 'heading' || block.type === 'paragraph') return block.text
  if (block.type === 'callout') return block.blocks.map(plainTextFromBlockV2).join('\n')
  if (block.type === 'image') return block.caption || ''
  if (block.type === 'list') return block.items.map(item => item.text).join('\n')
  if (block.type === 'table') return [...(block.headers || []), ...block.rows.flat()].join(' ')
  if (block.type === 'math') return block.expression
  if (block.type === 'interactive') return String(block.title || block.payload.title || '')
  return ''
}

function isUuid(value = '') {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function SaveIndicator({ state }: { state: SaveStateV2 }) {
  if (state === 'saving') return <span className="editor-v2-save-state saving"><Loader2 size={15} />در حال ذخیره</span>
  if (state === 'saved') return <span className="editor-v2-save-state saved">ذخیره شد</span>
  if (state === 'error') return <span className="editor-v2-save-state error">ذخیره ناموفق</span>
  return <span className="editor-v2-save-state">آماده</span>
}

function TocTreeV2({
  items,
  activeId,
  openIds,
  onToggle,
  onJump,
  depth = 0,
}: {
  items: BookTocItemV2[]
  activeId?: string
  openIds: Set<string>
  onToggle: (id: string) => void
  onJump: (item: BookTocItemV2) => void
  depth?: number
}) {
  return (
    <div className="editor-v2-toc-tree" style={{ ['--toc-depth' as string]: depth }}>
      {items.map(item => {
        const hasChildren = Boolean(item.children?.length)
        const isOpen = openIds.has(item.id)
        return (
          <div key={item.id} className={`editor-v2-toc-node level-${item.level} ${activeId === item.id ? 'is-active' : ''}`}>
            <div className="editor-v2-toc-row">
              <button className="editor-v2-toc-title" type="button" title={item.title} onClick={() => onJump(item)}>
                {item.level === 1 && <span className="editor-v2-toc-h1-number">{item.printNumber || item.pageIndex + 1}</span>}
                <span>{item.title}</span>
              </button>
              {hasChildren && (
                <button className="editor-v2-toc-toggle" type="button" onClick={() => onToggle(item.id)} aria-label={isOpen ? 'جمع کردن' : 'باز کردن'}>
                  {isOpen ? <ChevronDown size={12} /> : <ChevronLeft size={12} />}
                </button>
              )}
            </div>
            {hasChildren && isOpen && (
              <TocTreeV2 items={item.children || []} activeId={activeId} openIds={openIds} onToggle={onToggle} onJump={onJump} depth={depth + 1} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function RightPanelV2({
  document,
  activePanel,
  setActivePanel,
  activeTocId,
  onJumpToToc,
  onInsertImage,
  onInsertInteractive,
  onAiEnhance,
  aiBusy,
  aiMessage,
}: {
  document: BookDocumentV2
  activePanel: EditorPanelV2
  setActivePanel: (panel: EditorPanelV2) => void
  activeTocId?: string
  onJumpToToc: (item: BookTocItemV2) => void
  onInsertImage: (assetId: string) => void
  onInsertInteractive: (kind: string) => void
  onAiEnhance: () => void
  aiBusy: boolean
  aiMessage: string
}) {
  const tree = useMemo(() => resolveTocTreeV2(document.toc), [document.toc])
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(tree.map(item => item.id)))
  useEffect(() => {
    setOpenIds(new Set(tree.map(item => item.id)))
  }, [tree])
  const toggle = useCallback((id: string) => {
    setOpenIds(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])
  const ActiveIcon = PANEL_LABELS[activePanel].icon
  return (
    <aside className="editor-v2-side">
      <nav className="editor-v2-side-tabs" aria-label="ابزارهای ادیتور">
        {(Object.keys(PANEL_LABELS) as EditorPanelV2[]).map(panel => {
          const Icon = PANEL_LABELS[panel].icon
          return (
            <button key={panel} className={activePanel === panel ? 'is-active' : ''} type="button" onClick={() => setActivePanel(panel)}>
              <Icon size={14} />
              <span>{PANEL_LABELS[panel].title}</span>
            </button>
          )
        })}
      </nav>
      <section className="editor-v2-panel menu-glass-70">
        <header>
          <ActiveIcon size={14} />
          <strong>{PANEL_LABELS[activePanel].title}</strong>
        </header>
        {activePanel === 'toc' && (
          <>
            <div className="editor-v2-panel-actions">
              <button type="button" onClick={() => setOpenIds(new Set(tocAsFlatListV2(document).map(item => item.id)))}>باز کردن همه</button>
              <button type="button" onClick={() => setOpenIds(new Set())}>جمع کردن همه</button>
            </div>
            {tree.length ? <TocTreeV2 items={tree} activeId={activeTocId} openIds={openIds} onToggle={toggle} onJump={onJumpToToc} /> : <p className="editor-v2-empty-panel">فهرستی برای این کتاب ثبت نشده است.</p>}
          </>
        )}
        {activePanel === 'upgrade' && (
          <div className="editor-v2-action-grid">
            {CALLOUT_VARIANTS_V2.map(variant => <button key={variant} type="button" onClick={() => setActivePanel('upgrade')}><span>{CALLOUT_META_V2[variant].icon}</span>{CALLOUT_META_V2[variant].title}</button>)}
            <p>برای تبدیل متن به کال‌اوت، اول یک پاراگراف یا هدینگ را در متن انتخاب کنید و از نوار بالای کاغذ نوع کال‌اوت را بزنید.</p>
          </div>
        )}
        {activePanel === 'media' && (
          <div className="editor-v2-media-list">
            {document.assets.length ? document.assets.slice(0, 80).map(asset => (
              <button key={asset.id} type="button" onClick={() => onInsertImage(asset.id)}>
                <img src={asset.url} alt={asset.caption || ''} loading="lazy" />
                <span>{asset.caption || `تصویر صفحه ${asset.printNumber || ''}`}</span>
              </button>
            )) : <p className="editor-v2-empty-panel">تصویری در سند شناسایی نشده است.</p>}
          </div>
        )}
        {activePanel === 'interactive' && (
          <div className="editor-v2-action-grid">
            {[
              ['quiz', 'Quiz چندگزینه‌ای'],
              ['truefalse', 'صحیح/غلط'],
              ['flashcard', 'فلش‌کارت'],
              ['accordion', 'آکاردئون'],
              ['tabs', 'تب‌ها'],
              ['timeline', 'تایم‌لاین'],
              ['gallery', 'گالری تصویر'],
              ['scrollytelling', 'استوری‌تلینگ'],
              ['algorithm', 'الگوریتم تعاملی'],
              ['author', 'معرفی نویسنده'],
            ].map(([kind, label]) => <button key={kind} type="button" onClick={() => onInsertInteractive(kind)}><Sparkles size={15} />{label}</button>)}
          </div>
        )}
        {activePanel === 'ai' && (
          <div className="editor-v2-action-grid">
            <button type="button" disabled={aiBusy} onClick={onAiEnhance}>
              {aiBusy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              پیشنهاد ارتقای خوانایی
            </button>
            <p>{aiMessage || 'اگر بلوکی انتخاب شده باشد همان متن بررسی می‌شود؛ در غیر این صورت متن صفحه/ابتدای سند مبنا قرار می‌گیرد.'}</p>
          </div>
        )}
      </section>
    </aside>
  )
}

export default function EditorV2Page() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthContext()
  const { balance: creditBalance } = useCredits(user)
  const [book, setBook] = useState<MockBook | null>(null)
  const [document, setDocument] = useState<BookDocumentV2 | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saveState, setSaveState] = useState<SaveStateV2>('idle')
  const [activePanel, setActivePanel] = useState<EditorPanelV2>('toc')
  const [activeTocId, setActiveTocId] = useState<string>()
  const [selectedBlockId, setSelectedBlockId] = useState<string>()
  const [dirty, setDirty] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiMessage, setAiMessage] = useState('')
  const [aiApproval, setAiApproval] = useState<AiApprovalV2 | null>(null)
  const [metadataOpen, setMetadataOpen] = useState(false)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const selectedBlock = useMemo(() => document ? findBlockInDocumentV2(document, selectedBlockId) : null, [document, selectedBlockId])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    void getBook(id)
      .then(found => {
        if (!alive) return
        if (!found) {
          setError('کتاب پیدا نشد.')
          setBook(null)
          setDocument(null)
          return
        }
        const nextDocument = legacyBookToDocumentV2(found)
        setBook(found)
        setDocument(nextDocument)
        setActiveTocId(nextDocument.toc[0]?.id)
        setSelectedBlockId(undefined)
        setDirty(false)
      })
      .catch(reason => {
        if (!alive) return
        setError(reason instanceof Error ? reason.message : 'لود کتاب ناموفق بود.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [id])

  const saveDocument = useCallback(async () => {
    if (!book || !document) return
    setSaveState('saving')
    const nextDocument = { ...document, updatedAt: new Date().toISOString() }
    const pages = documentV2ToLegacyPages(nextDocument)
    const confirmedToc = documentV2ToConfirmedToc(nextDocument)
    const metadata = {
      ...(book.metadata || {}),
      confirmed_toc: confirmedToc,
      editor_v2_schema_version: '2.0',
      editor_v2_document: nextDocument,
      editor_v2_saved_at: nextDocument.updatedAt,
    }
    try {
      const patch = { metadata, pages, preview_pages: pages.slice(0, 3).map((_, index) => index), page_count: pages.length } as Partial<PublisherBook>
      updatePublisherBook(book.id, patch)
      if (isUuid(book.id)) await (supabase as any).from('books').update(patch).eq('id', book.id)
      setDocument(nextDocument)
      setBook({ ...book, ...patch })
      setDirty(false)
      setSaveState('saved')
      window.setTimeout(() => setSaveState('idle'), 2200)
    } catch {
      setSaveState('error')
    }
  }, [book, document])

  useEffect(() => {
    if (!dirty || !book || !document || saveState === 'saving') return
    const handle = window.setTimeout(() => void saveDocument(), 1800)
    return () => window.clearTimeout(handle)
  }, [book, dirty, document, saveDocument, saveState])

  const commitDocument = useCallback((updater: (current: BookDocumentV2) => BookDocumentV2) => {
    setDocument(current => {
      if (!current) return current
      const next = updater(current)
      setDirty(true)
      return next
    })
  }, [])

  const updateTextBlock = useCallback((blockId: string, value: string) => {
    commitDocument(current => updateBlockInDocumentV2(current, blockId, block => {
      if (block.type === 'heading') return { ...block, text: normalizeBookTextV2(value), inline: undefined }
      if (block.type === 'paragraph') return { ...block, text: normalizeBookTextV2(value), inline: undefined }
      return block
    }))
  }, [commitDocument])

  const setSelectedHeadingLevel = useCallback((level: 1 | 2 | 3 | 4 | 5 | 6 | 0) => {
    if (!selectedBlockId) return
    commitDocument(current => updateBlockInDocumentV2(current, selectedBlockId, block => {
      if (block.type === 'heading' && level > 0) return { ...block, level: level as 1 | 2 | 3 | 4 | 5 | 6 }
      if ((block.type === 'paragraph' || block.type === 'heading') && level > 0) return { ...block, type: 'heading', level: level as 1 | 2 | 3 | 4 | 5 | 6, text: 'text' in block ? block.text : '', inline: 'inline' in block ? block.inline : undefined } as HeadingBlockV2
      if (block.type === 'heading' && level === 0) return { ...block, type: 'paragraph', text: block.text, inline: block.inline, semantic: undefined } as ParagraphBlockV2
      return block
    }))
  }, [commitDocument, selectedBlockId])

  const wrapSelectedCallout = useCallback((variant: (typeof CALLOUT_VARIANTS_V2)[number]) => {
    if (!selectedBlockId) return
    const meta = CALLOUT_META_V2[variant]
    commitDocument(current => updateBlockInDocumentV2(current, selectedBlockId, block => {
      if (block.type === 'callout') return { ...block, variant, title: meta.title, icon: meta.icon }
      if (block.type !== 'paragraph' && block.type !== 'heading') return block
      const paragraph: ParagraphBlockV2 = block.type === 'paragraph'
        ? block
        : { ...block, type: 'paragraph', text: block.text, inline: block.inline, semantic: undefined }
      const callout: CalloutBlockV2 = {
        id: createV2Id('callout', selectedBlockId, Date.now()),
        type: 'callout',
        variant,
        title: meta.title,
        icon: meta.icon,
        anchor: createV2Id('callout-anchor', selectedBlockId),
        printNumber: block.printNumber,
        blocks: [{ ...paragraph, id: createV2Id('callout-text', selectedBlockId), anchor: createV2Id('callout-text-anchor', selectedBlockId) }],
      }
      window.setTimeout(() => setSelectedBlockId(callout.id), 0)
      return callout
    }))
  }, [commitDocument, selectedBlockId])

  const unwrapSelectedCallout = useCallback(() => {
    if (!selectedBlockId) return
    commitDocument(current => updateBlockInDocumentV2(current, selectedBlockId, block => block.type === 'callout' ? block.blocks : block))
    setSelectedBlockId(undefined)
  }, [commitDocument, selectedBlockId])

  const insertImageFromAsset = useCallback((assetId: string) => {
    const asset = document?.assets.find(item => item.id === assetId)
    if (!asset) return
    const block: BookBlockV2 = {
      id: createV2Id('image', asset.id, Date.now()),
      type: 'image',
      url: asset.url,
      caption: asset.caption,
      imageId: asset.id,
      anchor: createV2Id('image-anchor', asset.id, Date.now()),
      printNumber: asset.printNumber,
      status: asset.status,
      issue: asset.issue,
    }
    commitDocument(current => insertBlockAfterV2(current, selectedBlockId, block))
    setSelectedBlockId(block.id)
  }, [commitDocument, document?.assets, selectedBlockId])

  const insertInteractiveBlock = useCallback((kind: string) => {
    const printNumber = selectedBlock?.printNumber
    const block = createInteractiveTemplateV2(kind, printNumber)
    commitDocument(current => insertBlockAfterV2(current, selectedBlockId, block))
    setSelectedBlockId(block.id)
  }, [commitDocument, selectedBlock?.printNumber, selectedBlockId])

  const aiSourceText = useCallback(() => {
    if (!document) return ''
    const selectedText = selectedBlock ? plainTextFromBlockV2(selectedBlock).trim() : ''
    if (selectedText) return selectedText.slice(0, 6000)
    return document.pages
      .flatMap(page => page.blocks)
      .map(plainTextFromBlockV2)
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 6000)
  }, [document, selectedBlock])

  const requestAiEnhance = useCallback(async () => {
    if (!document) return
    const pageText = aiSourceText()
    if (!pageText.trim()) {
      setAiMessage('متنی برای تحلیل پیدا نشد.')
      return
    }
    setAiBusy(true)
    setAiMessage('در حال برآورد هزینه...')
    try {
      const estimate = await estimateAiTextUsage({ action: 'callout_suggestions', bookTitle: document.title, pageText, bookId: document.sourceBookId, user })
      setAiApproval({ usage: estimate.usage, provider: estimate.provider, model: estimate.model, pageText })
      setAiMessage('هزینه برآورد شد؛ برای اجرا تایید کنید.')
    } catch (error) {
      setAiMessage(error instanceof Error ? error.message : 'برآورد هزینه ناموفق بود.')
    } finally {
      setAiBusy(false)
    }
  }, [aiSourceText, document, user])

  const recordAiUsage = useCallback((usage: RunAiResult['usage']) => {
    const before = Math.max(Number(creditBalance || 0), Number(usage.chargedCredits || 0))
    const after = Math.max(0, before - Number(usage.chargedCredits || 0))
    creditsBus.emit(after)
  }, [creditBalance])

  const runApprovedAi = useCallback(async () => {
    if (!document || !aiApproval) return
    setAiBusy(true)
    setAiMessage('در حال تولید پیشنهاد...')
    try {
      const result = await runAiThroughGateway({ action: 'callout_suggestions', bookTitle: document.title, pageText: aiApproval.pageText, bookId: document.sourceBookId, user })
      const suggestion = result.content?.type === 'callout_suggestions' ? result.content.suggestions?.[0] : null
      const variant = CALLOUT_VARIANTS_V2.includes((suggestion?.variant || '') as any) ? suggestion?.variant as (typeof CALLOUT_VARIANTS_V2)[number] : 'key'
      const meta = CALLOUT_META_V2[variant]
      const paragraph: ParagraphBlockV2 = {
        id: createV2Id('ai-callout-text', Date.now()),
        type: 'paragraph',
        text: normalizeBookTextV2(suggestion?.text || result.text || aiApproval.pageText.slice(0, 600)),
        anchor: createV2Id('ai-callout-text-anchor', Date.now()),
      }
      const callout: CalloutBlockV2 = {
        id: createV2Id('ai-callout', Date.now()),
        type: 'callout',
        variant,
        title: normalizeBookTextV2(suggestion?.title || meta.title),
        icon: meta.icon,
        anchor: createV2Id('ai-callout-anchor', Date.now()),
        printNumber: selectedBlock?.printNumber,
        blocks: [paragraph],
      }
      commitDocument(current => insertBlockAfterV2(current, selectedBlockId, callout))
      setSelectedBlockId(callout.id)
      recordAiUsage(result.usage)
      setAiApproval(null)
      setAiMessage('پیشنهاد هوش مصنوعی به متن اضافه شد.')
    } catch (error) {
      setAiMessage(error instanceof Error ? error.message : 'تولید پیشنهاد ناموفق بود.')
    } finally {
      setAiBusy(false)
    }
  }, [aiApproval, commitDocument, document, recordAiUsage, selectedBlock?.printNumber, selectedBlockId, user])

  const jumpToToc = useCallback((item: BookTocItemV2) => {
    setActiveTocId(item.id)
    window.setTimeout(() => {
      const target = window.document.getElementById(item.anchor || item.blockId || '')
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      else canvasRef.current?.querySelector<HTMLElement>(`[data-page-index="${item.pageIndex}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 40)
  }, [])

  const scrollToTop = useCallback(() => {
    canvasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  if (loading) {
    return (
      <div className="editor-v2-loading">
        <Loader2 className="animate-spin" />
        <span>در حال آماده‌سازی ادیتور جدید...</span>
      </div>
    )
  }

  if (error || !document || !book) {
    return (
      <div className="editor-v2-error menu-glass-70">
        <BookOpen size={32} />
        <h1>{error || 'کتاب پیدا نشد.'}</h1>
        <Button onClick={() => navigate('/publisher/me')}><ArrowRight size={18} />بازگشت به انتشارات</Button>
      </div>
    )
  }

  return (
    <div className="editor-v2-root" dir="rtl">
      <header className="editor-v2-topbar menu-glass-70">
        <div className="editor-v2-title">
          <Button variant="ghost" size="icon" onClick={() => navigate('/publisher/me')} aria-label="بازگشت"><ArrowRight size={19} /></Button>
          {document.coverUrl && <img src={document.coverUrl} alt={document.title} loading="lazy" />}
          <div>
            <small>Editor V2</small>
            <h1>{document.title}</h1>
          </div>
        </div>
        <div className="editor-v2-actions">
          <SaveIndicator state={saveState} />
          <Button variant="outline" onClick={() => setMetadataOpen(value => !value)}><Info size={17} />مشخصات</Button>
          <Button variant="outline" onClick={() => openReaderPreview(book.id, `/edit-v2/${book.id}`)}><Eye size={17} />پیش‌نمایش</Button>
          <Button onClick={() => void saveDocument()} disabled={saveState === 'saving'}><Save size={17} />ذخیره دستی</Button>
        </div>
      </header>

      {metadataOpen && (
        <section className="editor-v2-metadata menu-glass-70">
          <div><span>نویسنده</span><strong>{document.metadata.author || 'ثبت نشده'}</strong></div>
          <div><span>ناشر</span><strong>{document.metadata.publisherName || 'ثبت نشده'}</strong></div>
          <div><span>نوع کتاب</span><strong>{document.metadata.bookType || 'ثبت نشده'}</strong></div>
          <div><span>دسته‌بندی</span><strong>{document.metadata.category || 'ثبت نشده'}</strong></div>
          <div><span>صفحات</span><strong>{document.pages.length.toLocaleString('fa-IR')}</strong></div>
        </section>
      )}

      <div className="editor-v2-layout">
        <RightPanelV2 document={document} activePanel={activePanel} setActivePanel={setActivePanel} activeTocId={activeTocId} onJumpToToc={jumpToToc} onInsertImage={insertImageFromAsset} onInsertInteractive={insertInteractiveBlock} onAiEnhance={requestAiEnhance} aiBusy={aiBusy} aiMessage={aiMessage} />
        <main className="editor-v2-canvas" ref={canvasRef} onClick={() => setSelectedBlockId(undefined)}>
          <section className="editor-v2-toolbar menu-glass-70" onClick={event => event.stopPropagation()}>
            <Button variant="outline" size="icon" disabled={!selectedBlock} onClick={() => setSelectedHeadingLevel(0)} title="متن عادی"><Type size={17} /></Button>
            <select disabled={!selectedBlock || (selectedBlock.type !== 'paragraph' && selectedBlock.type !== 'heading')} value={selectedBlock?.type === 'heading' ? selectedBlock.level : 0} onChange={event => setSelectedHeadingLevel(Number(event.target.value) as 0 | 1 | 2 | 3 | 4 | 5 | 6)}>
              <option value={0}>متن</option>
              <option value={1}>H1</option>
              <option value={2}>H2</option>
              <option value={3}>H3</option>
              <option value={4}>H4</option>
              <option value={5}>H5</option>
              <option value={6}>H6</option>
            </select>
            {CALLOUT_VARIANTS_V2.map(variant => (
              <button key={variant} type="button" disabled={!selectedBlock || (selectedBlock.type !== 'paragraph' && selectedBlock.type !== 'heading' && selectedBlock.type !== 'callout')} onClick={() => wrapSelectedCallout(variant)}>
                <span>{CALLOUT_META_V2[variant].icon}</span>
                {CALLOUT_META_V2[variant].title}
              </button>
            ))}
            <Button variant="outline" size="icon" disabled={selectedBlock?.type !== 'callout'} onClick={unwrapSelectedCallout} title="برگشت کال‌اوت به متن عادی"><Undo2 size={17} /></Button>
          </section>

          <div className="editor-v2-paper">
            <BookRendererV2 document={document} editable selectedBlockId={selectedBlockId} onSelectBlock={setSelectedBlockId} onTextChange={updateTextBlock} />
          </div>
        </main>
      </div>

      <div className="editor-v2-floating">
        <button type="button" onClick={scrollToTop} aria-label="برگشت به ابتدای ادیتور">↑</button>
        <button type="button" onClick={() => window.scrollBy({ left: 0, top: -window.innerHeight * 0.72, behavior: 'smooth' })} aria-label="بخش قبلی"><ChevronRight size={18} /></button>
        <button type="button" onClick={() => window.scrollBy({ left: 0, top: window.innerHeight * 0.72, behavior: 'smooth' })} aria-label="بخش بعدی"><ChevronLeft size={18} /></button>
      </div>

      {aiApproval && (
        <div className="editor-v2-modal-backdrop">
          <section className="editor-v2-ai-modal menu-glass-70" role="dialog" aria-modal="true">
            <header>
              <Sparkles size={20} />
              <strong>تایید هزینه هوش مصنوعی</strong>
            </header>
            <p>این عملیات فقط پیشنهاد callout تولید می‌کند و هیچ بخشی از متن اصلی را حذف یا جایگزین نمی‌کند.</p>
            <div className="editor-v2-ai-cost">
              <span><b>{aiApproval.usage.chargedCredits.toLocaleString('fa-IR')}</b><small>کردیت</small></span>
              <span><b>{aiApproval.usage.chargedToman.toLocaleString('fa-IR')}</b><small>تومان</small></span>
              <span><b>${aiApproval.usage.chargedUsd.toFixed(6)}</b><small>دلار</small></span>
            </div>
            <small>{aiApproval.provider} · {aiApproval.model}</small>
            <footer>
              <Button variant="outline" onClick={() => setAiApproval(null)} disabled={aiBusy}>لغو</Button>
              <Button onClick={() => void runApprovedAi()} disabled={aiBusy}>{aiBusy ? 'در حال تولید...' : 'تایید و اجرا'}</Button>
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}
