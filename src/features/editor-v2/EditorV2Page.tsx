import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, BookOpen, ChevronDown, ChevronLeft, ChevronRight, Eye, FileText, Image as ImageIcon, Info, ListTree, Loader2, PanelRight, Save, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BookRendererV2 } from '@/components/book-content-v2'
import { getBook } from '@/lib/book-repository'
import { updatePublisherBook, type PublisherBook } from '@/lib/publisher-books'
import { openReaderPreview } from '@/lib/app-routes'
import { supabase } from '@/integrations/supabase/client'
import { documentV2ToConfirmedToc, documentV2ToLegacyPages, legacyBookToDocumentV2, resolveTocTreeV2, tocAsFlatListV2, type BookDocumentV2, type BookTocItemV2 } from '@/lib/book-document-v2'
import type { MockBook } from '@/lib/mock-data'
import './editor-v2.css'

type EditorPanelV2 = 'toc' | 'upgrade' | 'media' | 'interactive' | 'ai'
type SaveStateV2 = 'idle' | 'saving' | 'saved' | 'error'

const PANEL_LABELS: Record<EditorPanelV2, { title: string; icon: typeof ListTree }> = {
  toc: { title: 'فهرست', icon: ListTree },
  upgrade: { title: 'ارتقا متن', icon: FileText },
  media: { title: 'رسانه', icon: ImageIcon },
  interactive: { title: 'ابزار تعاملی', icon: PanelRight },
  ai: { title: 'هوش مصنوعی', icon: Sparkles },
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
                  {isOpen ? <ChevronDown size={15} /> : <ChevronLeft size={15} />}
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
}: {
  document: BookDocumentV2
  activePanel: EditorPanelV2
  setActivePanel: (panel: EditorPanelV2) => void
  activeTocId?: string
  onJumpToToc: (item: BookTocItemV2) => void
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
              <Icon size={18} />
              <span>{PANEL_LABELS[panel].title}</span>
            </button>
          )
        })}
      </nav>
      <section className="editor-v2-panel menu-glass-70">
        <header>
          <ActiveIcon size={18} />
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
        {activePanel === 'upgrade' && <p className="editor-v2-empty-panel">در فاز بعد، تبدیل متن انتخاب‌شده به calloutهای استاندارد اینجا فعال می‌شود.</p>}
        {activePanel === 'media' && <p className="editor-v2-empty-panel">{document.assets.length.toLocaleString('fa-IR')} تصویر/رسانه از کتاب شناسایی شده است. انتخاب و جایگذاری رسانه در فاز بعد فعال می‌شود.</p>}
        {activePanel === 'interactive' && <p className="editor-v2-empty-panel">بلوک‌های تعاملی از renderer مشترک نمایش داده می‌شوند؛ ادیت درون‌بلوک در فاز تعاملی اجرا می‌شود.</p>}
        {activePanel === 'ai' && <p className="editor-v2-empty-panel">پیشنهادهای هوش مصنوعی بعد از اتصال کامل ذخیره و انتخاب متن، با تایید هزینه قبل از مصرف کردیت فعال می‌شود.</p>}
      </section>
    </aside>
  )
}

export default function EditorV2Page() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [book, setBook] = useState<MockBook | null>(null)
  const [document, setDocument] = useState<BookDocumentV2 | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saveState, setSaveState] = useState<SaveStateV2>('idle')
  const [activePanel, setActivePanel] = useState<EditorPanelV2>('toc')
  const [activeTocId, setActiveTocId] = useState<string>()
  const [metadataOpen, setMetadataOpen] = useState(false)
  const canvasRef = useRef<HTMLDivElement | null>(null)

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
      setSaveState('saved')
      window.setTimeout(() => setSaveState('idle'), 2200)
    } catch {
      setSaveState('error')
    }
  }, [book, document])

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
        <RightPanelV2 document={document} activePanel={activePanel} setActivePanel={setActivePanel} activeTocId={activeTocId} onJumpToToc={jumpToToc} />
        <main className="editor-v2-canvas" ref={canvasRef}>
          <div className="editor-v2-paper">
            <BookRendererV2 document={document} />
          </div>
        </main>
      </div>

      <div className="editor-v2-floating">
        <button type="button" onClick={scrollToTop} aria-label="برگشت به ابتدای ادیتور">↑</button>
        <button type="button" onClick={() => window.scrollBy({ left: 0, top: -window.innerHeight * 0.72, behavior: 'smooth' })} aria-label="بخش قبلی"><ChevronRight size={18} /></button>
        <button type="button" onClick={() => window.scrollBy({ left: 0, top: window.innerHeight * 0.72, behavior: 'smooth' })} aria-label="بخش بعدی"><ChevronLeft size={18} /></button>
      </div>
    </div>
  )
}
