/* eslint-disable @typescript-eslint/no-explicit-any */
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, BarChart3, BookOpen, CheckCircle, Eye, FileText, Loader2, MessageSquare, Plus, RefreshCcw, Rocket, Settings, Share2, Store, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getPublisherBooks, type PublisherBook } from '@/lib/publisher-books'
import { canDeletePublisherBook, deletePublisherBookCompletely } from '@/lib/publisher-delete'
import { getAllComments } from '@/lib/mock-comments'
import metabookiMark from '@/assets/metabooki-mark.png'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuthContext } from '@/lib/auth-context'
import { BOOK_LIST_PAGE_SIZE, filterByValue, normalizeBookType, pageNumbers, paginate, searchBooks, sortBooks, uniqueBookValues, type BookSortKey } from '@/lib/book-listing'
import { emptyFilterSettings, loadBookFilterSettings, mergeFilterOptions, type BookFilterSettings } from '@/lib/filter-settings'

const stageMeta = {
  editing: { label: 'در حال ویرایش', className: 'bg-blue-500 text-white', icon: FileText },
  pricing: { label: 'قیمت و سهام', className: 'bg-amber-500 text-white', icon: Rocket },
  store: { label: 'در فروشگاه', className: 'bg-green-600 text-white', icon: Store },
  published: { label: 'انتشار نهایی', className: 'bg-primary text-primary-foreground', icon: CheckCircle },
}

const appPath = (path: string) => `${window.location.origin}${import.meta.env.BASE_URL}#/${path.replace(/^\//, '')}`
const openBookPreview = (id: string) => window.open(appPath(`/read/${id}`), '_blank', 'noopener,noreferrer')
const PUBLISHER_BOOK_LIST_COLUMNS = 'id,title,subtitle,description,cover_url,back_cover_url,preview_pages,price,status,review_status,publisher_id,language,tags,metadata,series_id,series_order,created_at'

export default function Publisher() {
  const navigate = useNavigate()
  const { user } = useAuthContext()
  const [books, setBooks] = useState<PublisherBook[]>(() => getPublisherBooks())
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [remoteLoaded, setRemoteLoaded] = useState(false)
  const [remoteError, setRemoteError] = useState('')
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [sort, setSort] = useState<BookSortKey>('newest')
  const [page, setPage] = useState(1)
  const [filterSettings, setFilterSettings] = useState<BookFilterSettings>(emptyFilterSettings)
  const comments = getAllComments()
  const totalReaders = books.reduce((sum, b) => sum + b.readers, 0)
  const inStore = books.filter(b => b.stage === 'store' || b.stage === 'published').length
  const ready = books.filter(b => b.stage === 'pricing').length
  const revenue = books.reduce((sum, b) => sum + b.revenue, 0)
  const isRemoteConfigured = Boolean(user && import.meta.env.VITE_SUPABASE_URL?.startsWith('http'))
  const listStatusLabel = remoteLoading
    ? 'در حال تکمیل فهرست از سرور'
    : remoteError
      ? 'فهرست کامل دریافت نشد'
      : remoteLoaded && isRemoteConfigured
        ? 'فهرست کامل شد'
        : 'فهرست محلی'
  const categories = useMemo(() => mergeFilterOptions(uniqueBookValues(books, book => book.category), filterSettings.categories), [books, filterSettings.categories])
  const bookTypes = useMemo(() => mergeFilterOptions(uniqueBookValues(books, book => normalizeBookType(book.book_type)), filterSettings.bookTypes), [books, filterSettings.bookTypes])
  const tags = useMemo(() => mergeFilterOptions(uniqueBookValues(books, book => book.tags?.join('|')).flatMap(value => value.split('|')).filter(Boolean), filterSettings.tags), [books, filterSettings.tags])
  const filteredBooks = useMemo(() => {
    const byStage = stageFilter === 'published'
      ? books.filter(book => book.stage === 'published' || book.stage === 'store' || book.status === 'published')
      : stageFilter === 'unpublished'
        ? books.filter(book => book.stage !== 'published' && book.stage !== 'store' && book.status !== 'published')
        : books
    const byCategory = filterByValue(byStage, categoryFilter, book => book.category)
    const byType = filterByValue(byCategory, typeFilter, book => normalizeBookType(book.book_type))
    const byTag = tagFilter === 'all' ? byType : byType.filter(book => book.tags?.includes(tagFilter))
    return sortBooks(searchBooks(byTag, search), sort)
  }, [books, categoryFilter, search, sort, stageFilter, tagFilter, typeFilter])
  const pagedBooks = paginate(filteredBooks, page, BOOK_LIST_PAGE_SIZE)

  useEffect(() => setPage(1), [categoryFilter, search, sort, stageFilter, tagFilter, typeFilter])
  useEffect(() => {
    if (page > pagedBooks.pageCount) setPage(pagedBooks.pageCount)
  }, [page, pagedBooks.pageCount])

  useEffect(() => {
    if (!user || !import.meta.env.VITE_SUPABASE_URL?.startsWith('http')) {
      setRemoteLoaded(true)
      return
    }
    let cancelled = false
    setRemoteLoading(true)
    setRemoteLoaded(false)
    setRemoteError('')
    ;(async () => {
      try {
        const ownPublisher = await (supabase as any).from('publisher_profiles').select('id').eq('user_id', user.id).maybeSingle()
        const roles = await (supabase as any).from('user_roles').select('role').eq('user_id', user.id)
        const isAdmin = roles.data?.some((item: { role: string }) => item.role === 'admin' || item.role === 'super_admin')
        let query = (supabase as any).from('books').select(PUBLISHER_BOOK_LIST_COLUMNS).order('created_at', { ascending: false })
        if (ownPublisher.data?.id) query = query.eq('publisher_id', ownPublisher.data.id)
        else if (!isAdmin) return
        const result = await query
        if (result.error) throw result.error
        const remote: PublisherBook[] = (result.data || []).map((row: any) => ({
          ...row,
          cover_url: row.cover_url || `https://picsum.photos/seed/${row.id}/400/560`,
          back_cover_url: row.back_cover_url || null,
          category: row.metadata?.category || row.tags?.[0] || 'عمومی',
          publisher_name: row.metadata?.publisher_name || 'ناشر متابوکی',
          book_type: row.metadata?.book_type || 'تألیف',
          author: row.metadata?.author || 'نویسنده نامشخص',
          page_count: Number(row.metadata?.page_count || row.metadata?.print_page_count || row.metadata?.total_pages || row.metadata?.total_source_pages || 0),
          stage: row.status === 'published' && row.review_status === 'approved' ? 'published' : 'editing',
          readers: 0, sales: 0, revenue: 0,
          importStatus: row.metadata?.import_project_id ? 'word-imported' : 'manual',
        }))
        if (cancelled) return
        setBooks(current => {
          const remoteIds = new Set(remote.map(item => item.id))
          return [...remote, ...current.filter(item => !remoteIds.has(item.id))]
        })
      } catch (error) {
        if (!cancelled) setRemoteError(error instanceof Error ? error.message : 'دریافت فهرست کامل کتاب‌ها ناموفق بود.')
      } finally {
        if (!cancelled) {
          setRemoteLoading(false)
          setRemoteLoaded(true)
        }
      }
    })()
    return () => { cancelled = true }
  }, [user])
  useEffect(() => {
    loadBookFilterSettings().then(setFilterSettings)
  }, [])

  const reconvert = async (book: PublisherBook) => {
    const importId = book.metadata?.import_project_id
    if (!importId) return
    const reset = await (supabase as any).from('book_import_projects').update({ status: 'uploading', error_message: null }).eq('id', importId)
    if (reset.error) return
    await (supabase as any).from('book_import_projects').update({ status: 'queued', error_message: null }).eq('id', importId)
    setBooks(current => current.map(item => item.id === book.id ? { ...item, importStatus: 'needs-review' } : item))
  }

  const removeBook = async (book: PublisherBook) => {
    if (!canDeletePublisherBook(book)) return
    const confirmed = window.confirm(`کتاب «${book.title}» و همه محتوای وابسته، فایل‌ها و تصاویر واردشده حذف شود؟ این کار قابل برگشت نیست.`)
    if (!confirmed) return
    setDeletingBookId(book.id)
    try {
      await deletePublisherBookCompletely(book, user?.id)
      setBooks(current => current.filter(item => item.id !== book.id))
    } catch (error) {
      console.error(error)
      window.alert(error instanceof Error ? error.message : 'حذف کتاب ناموفق بود.')
    } finally {
      setDeletingBookId(null)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <section className="menu-glass-70 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <img src={metabookiMark} alt="publisher" className="w-20 h-16 object-contain rounded-2xl bg-background/60 p-2" />
          <div>
            <p className="text-sm text-muted-foreground">مرکز کاری ناشر</p>
            <h1 className="text-4xl font-black font-display">ناشر تست</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">اول محتوای کتاب را کامل کنید؛ سپس از دکمه‌های «ویرایش متن و محتوا»، «قیمت، سهام و انتشار» وارد مراحل بعد شوید.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="gap-2"><Share2 className="w-4 h-4" />ویترین عمومی</Button>
          <Link to="/publisher/me/settings"><Button variant="outline" className="gap-2"><Settings className="w-4 h-4" />تنظیمات</Button></Link>
          <Link to="/upload"><Button className="gap-2 shadow-glow"><Plus className="w-4 h-4" />کتاب جدید</Button></Link>
        </div>
      </section>

      <section className="grid md:grid-cols-4 gap-5">
        {[
          { label: 'کل', value: books.length, icon: BookOpen },
          { label: 'در فروشگاه', value: inStore, icon: CheckCircle },
          { label: 'آماده‌سازی', value: ready, icon: FileText },
          { label: 'خوانندگان', value: totalReaders, icon: Users },
        ].map(card => <div key={card.label} className="menu-glass-70 rounded-2xl p-6 relative overflow-hidden">
          {remoteLoading && <span className="publisher-sync-card-chip"><Loader2 className="w-3 h-3 animate-spin" />در حال تکمیل</span>}
          <card.icon className="w-7 h-7 text-primary mb-4" />
          <p className="text-3xl font-black">{card.value.toLocaleString('fa-IR')}</p>
          <p className="text-sm text-muted-foreground mt-1">{card.label}</p>
        </div>)}
      </section>

      {(remoteLoading || remoteError || (remoteLoaded && isRemoteConfigured)) && (
        <section className={`publisher-sync-banner ${remoteError ? 'is-error' : remoteLoading ? 'is-loading' : 'is-done'}`} aria-live="polite">
          <div className="publisher-sync-icon">
            {remoteError ? <AlertTriangle className="w-5 h-5" /> : remoteLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold">{listStatusLabel}</h3>
              <span className="publisher-sync-count">{books.length.toLocaleString('fa-IR')} کتاب فعلا نمایش داده شده</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {remoteLoading
                ? 'فهرست اولیه سریع نمایش داده شده و سامانه هنوز کتاب‌ها و آمار کامل انتشارات را از دیتابیس دریافت می‌کند.'
                : remoteError
                  ? 'اگر اینترنت یا اتصال Supabase کند باشد، فعلا همان فهرست محلی نمایش داده می‌شود. با رفرش صفحه، دریافت از ادامه دوباره تلاش می‌شود.'
                  : 'همگام‌سازی فهرست انتشارات با دیتابیس کامل شد.'}
            </p>
            {remoteLoading && <div className="publisher-sync-progress" role="progressbar" aria-label="در حال دریافت فهرست کامل کتاب‌ها"><span /></div>}
            {remoteError && <p className="publisher-sync-error">{remoteError}</p>}
          </div>
        </section>
      )}

      <section className="menu-glass-70 rounded-2xl p-5 grid md:grid-cols-3 gap-4">
        {[
          { n: 1, title: 'ویرایش محتوا', desc: 'متن، فصل‌ها، تصاویر و محتوای تعاملی کتاب را باز کنید.' },
          { n: 2, title: 'قیمت و سهام', desc: 'قیمت‌گذاری، سهم‌بندی و وضعیت فروشگاه را تنظیم کنید.' },
          { n: 3, title: 'انتشار نهایی', desc: 'بعد از ذخیره و پیش‌نمایش، انتشار نهایی فعال می‌شود.' },
        ].map((s, i) => <div key={s.n} className="flex items-start gap-3"><span className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold ${i===0?'bg-blue-500':i===1?'bg-amber-500':'bg-green-600'}`}>{s.n}</span><div><h3 className="font-bold">{s.title}</h3><p className="text-sm text-muted-foreground">{s.desc}</p></div></div>)}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black font-display">کتاب‌های من</h2>
          <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-muted-foreground">
            <span className={`publisher-list-state ${remoteError ? 'is-error' : remoteLoading ? 'is-loading' : remoteLoaded && isRemoteConfigured ? 'is-done' : ''}`}>{listStatusLabel}</span>
            <span>درآمد نمونه: <b className="text-primary">{revenue.toLocaleString('fa-IR')}</b> کردیت</span>
          </div>
        </div>

        <div className="list-control-panel">
          <label className="is-wide"><span>جستجو</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="عنوان، نویسنده، ناشر یا برچسب..." /></label>
          <label><span>وضعیت</span><select value={stageFilter} onChange={event => setStageFilter(event.target.value)}><option value="all">همه</option><option value="published">منتشر شده / فروشگاه</option><option value="unpublished">منتشر نشده</option></select></label>
          <label><span>دسته‌بندی</span><select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="all">همه دسته‌ها</option>{categories.map(category => <option key={category} value={category}>{category}</option>)}</select></label>
          <label><span>نوع کتاب</span><select value={typeFilter} onChange={event => setTypeFilter(event.target.value)}><option value="all">همه نوع‌ها</option>{bookTypes.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
          <label><span>تگ</span><select value={tagFilter} onChange={event => setTagFilter(event.target.value)}><option value="all">همه تگ‌ها</option>{tags.map(tag => <option key={tag} value={tag}>{tag}</option>)}</select></label>
          <label><span>مرتب‌سازی</span><select value={sort} onChange={event => setSort(event.target.value as BookSortKey)}><option value="newest">جدیدترین</option><option value="oldest">قدیمی‌ترین</option><option value="title-asc">عنوان: الف تا ی</option><option value="title-desc">عنوان: ی تا الف</option><option value="price-asc">قیمت: کم به زیاد</option><option value="price-desc">قیمت: زیاد به کم</option><option value="pages-desc">صفحات: زیاد به کم</option><option value="pages-asc">صفحات: کم به زیاد</option></select></label>
        </div>

        <div className="text-sm text-muted-foreground">
          {filteredBooks.length.toLocaleString('fa-IR')} کتاب مطابق فیلترها؛ نمایش {pagedBooks.start.toLocaleString('fa-IR')} تا {pagedBooks.end.toLocaleString('fa-IR')} در صفحه ۵۰تایی
        </div>

        {pagedBooks.items.map(book => {
          const meta = stageMeta[book.stage]
          const commentsCount = comments.filter(c => c.bookId === book.id).length
          const canDelete = canDeletePublisherBook(book)
          return (
            <div key={book.id} className="menu-glass-70 rounded-3xl overflow-hidden border border-primary/20">
              <div className="grid md:grid-cols-[140px_1fr] gap-5">
                <img src={book.cover_url} alt={book.title} className="w-full h-full min-h-52 object-cover" />
                <div className="p-5 flex flex-col gap-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <span className={`inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full ${meta.className}`}><meta.icon className="w-3 h-3" />{meta.label}</span>
                      <h3 className="text-2xl font-black mt-3">{book.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{book.author}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-3">
                        <span>{book.readers.toLocaleString('fa-IR')} خواننده</span>
                        <span>{book.sales.toLocaleString('fa-IR')} فروش</span>
                        <span>{commentsCount.toLocaleString('fa-IR')} نظر</span>
                        <span>{book.price === 0 ? 'رایگان' : `${book.price.toLocaleString('fa-IR')} کردیت`}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-background/50 p-3"><p className="font-bold">{book.readers.toLocaleString('fa-IR')}</p><p className="text-[10px] text-muted-foreground">خواننده</p></div>
                      <div className="rounded-xl bg-background/50 p-3"><p className="font-bold">{book.sales.toLocaleString('fa-IR')}</p><p className="text-[10px] text-muted-foreground">فروش</p></div>
                      <div className="rounded-xl bg-background/50 p-3"><p className="font-bold">{book.revenue.toLocaleString('fa-IR')}</p><p className="text-[10px] text-muted-foreground">سهم شما</p></div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-auto">
                    <Button onClick={() => navigate(`/edit/${book.id}`)} className="gap-2 flex-1 sm:min-w-56"><FileText className="w-4 h-4" />ویرایش متن و محتوا</Button>
                    <Button onClick={() => navigate(`/publish/${book.id}`)} className="gap-2 bg-amber-500 hover:bg-amber-600 flex-1 sm:min-w-56"><Rocket className="w-4 h-4" />قیمت، سهام و انتشار</Button>
                    <Button variant="outline" onClick={() => openBookPreview(book.id)} className="gap-2"><Eye className="w-4 h-4" />پیش‌نمایش</Button>
                    <Button variant="outline" className="gap-2"><MessageSquare className="w-4 h-4" />نظرات</Button>
                    <Button variant="outline" disabled={!book.metadata?.import_project_id} onClick={() => reconvert(book)} className="gap-2"><RefreshCcw className="w-4 h-4" />تبدیل مجدد از فایل سرور</Button>
                    {canDelete && <Button variant="ghost" disabled={deletingBookId === book.id} onClick={() => removeBook(book)} className="text-destructive"><Trash2 className="w-4 h-4" />{deletingBookId === book.id ? 'در حال حذف...' : ''}</Button>}
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {filteredBooks.length === 0 && (
          <div className="menu-glass-70 rounded-3xl p-12 text-center text-muted-foreground">کتابی با این فیلترها پیدا نشد.</div>
        )}

        {pagedBooks.pageCount > 1 && (
          <div className="book-pagination">
            <Button variant="outline" size="icon" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={pagedBooks.page === 1}>‹</Button>
            {pageNumbers(pagedBooks.page, pagedBooks.pageCount).map(number => <Button key={number} variant={pagedBooks.page === number ? 'default' : 'outline'} size="icon" onClick={() => setPage(number)}>{number.toLocaleString('fa-IR')}</Button>)}
            <Button variant="outline" size="icon" onClick={() => setPage(current => Math.min(pagedBooks.pageCount, current + 1))} disabled={pagedBooks.page === pagedBooks.pageCount}>›</Button>
          </div>
        )}
      </section>

      <section className="grid md:grid-cols-3 gap-5">
        {[
          { icon: BarChart3, title: 'آمار فروش', desc: 'نمودارهای فروش، خوانده‌شدن و درآمد هر کتاب.' },
          { icon: MessageSquare, title: 'مدیریت دیدگاه', desc: 'دیدگاه‌های کاربران را بررسی، مخفی یا پاسخ دهید.' },
          { icon: Store, title: 'ویترین ناشر', desc: 'صفحه عمومی ناشر و برندینگ اختصاصی شما.' },
        ].map(f => <div key={f.title} className="menu-glass-70 rounded-2xl p-6"><f.icon className="w-7 h-7 text-primary mb-3" /><h3 className="font-bold">{f.title}</h3><p className="text-sm text-muted-foreground mt-1">{f.desc}</p></div>)}
      </section>
    </div>
  )
}
