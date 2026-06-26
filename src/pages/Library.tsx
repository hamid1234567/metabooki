import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { BookCover } from '@/components/BookCover'
import { useAuthContext } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import { getAllReadingProgress, getMockLibraryEntries } from '@/lib/mock-library'
import type { MockBook } from '@/lib/mock-data'
import { filterByValue, normalizeBookType, pageNumbers, paginate, searchBooks, sortBooks, uniqueBookValues, type BookSortKey } from '@/lib/book-listing'
import { emptyFilterSettings, loadBookFilterSettings, mergeFilterOptions, type BookFilterSettings } from '@/lib/filter-settings'
import { resolveBookCoverArt } from '@/lib/ai-image-prompts'
import { ArrowLeft, BookOpen, CheckCircle, ChevronLeft, ChevronRight, Clock, PlayCircle, Search, ShoppingCart, Sparkles } from 'lucide-react'
import { getPublishedBooks, getPublisherDraftBooks, getUserLibrary } from '@/lib/book-repository'
import { useGridRowsPageSize } from '@/hooks/useGridRowsPageSize'

type ProgressMap = Record<string, { currentPage: number; totalPages: number; lastReadAt: string }>
type ShelfItem = { book: MockBook; isPurchased: boolean }

function ShelfBookCard({ book, isPurchased, progress, index }: { book: MockBook; isPurchased: boolean; progress?: ProgressMap[string]; index: number }) {
  const totalPages = book.page_count || book.pages.length || progress?.totalPages || 1
  const percent = progress ? Math.round(((progress.currentPage + 1) / totalPages) * 100) : 0
  const isFinished = percent >= 100
  const lastRead = progress?.lastReadAt ? new Date(progress.lastReadAt).toLocaleDateString('fa-IR') : null
  const actionText = isPurchased ? progress ? 'ادامه خواندن' : 'شروع خواندن' : 'افزودن به قفسه'

  return (
    <article className="shelf-card group" style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}>
      <Link to={`/b/${book.id}`} className="shelf-cover">
        <BookCover src={book.cover_url} title={book.title} category={book.category} loading={index < 8 ? 'eager' : 'lazy'} fetchPriority={index < 4 ? 'high' : 'auto'} />
        <div className="book-card-sheen" />
        <span className={isPurchased ? 'book-pill book-pill-primary' : 'book-pill book-pill-success'}>{isPurchased ? 'در قفسه شما' : 'رایگان'}</span>
      </Link>

      <div className="shelf-content">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="book-card-title">{book.title}</h3>
            <p className="book-card-subtitle">{book.author || 'نویسنده نامشخص'}</p>
          </div>
          {isFinished && <CheckCircle className="w-5 h-5 text-success shrink-0" />}
        </div>

        <p className="book-card-description">{book.book_type || 'تألیف'} · {book.publisher_name}</p>

        {isPurchased ? (
          <div className="rounded-2xl bg-muted/45 p-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">پیشرفت مطالعه</span>
              <span className="font-bold text-primary">{percent.toLocaleString('fa-IR')}٪</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-background">
              <div className={`h-full rounded-full transition-all duration-500 ${isFinished ? 'bg-success' : 'bg-primary'}`} style={{ width: `${Math.min(percent, 100)}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>صفحه {progress ? (progress.currentPage + 1).toLocaleString('fa-IR') : '۱'} از {totalPages.toLocaleString('fa-IR')}</span>
              {lastRead && <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{lastRead}</span>}
            </div>
          </div>
        ) : (
          <div className="book-tags">{book.tags.slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}</div>
        )}

        <div className="mt-auto grid grid-cols-[1fr_auto] gap-2">
          <Link to={`/read/${book.id}`}><Button className="w-full gap-2 rounded-xl"><PlayCircle className="w-4 h-4" />{actionText}</Button></Link>
          <Link to={`/b/${book.id}`}><Button variant="outline" size="icon" className="rounded-xl" title="جزئیات کتاب"><ArrowLeft className="w-4 h-4" /></Button></Link>
        </div>
      </div>
    </article>
  )
}

export default function Library() {
  const { user } = useAuthContext()
  const { t } = useI18n()
  const [libraryBooks, setLibraryBooks] = useState<MockBook[]>([])
  const [freeBooks, setFreeBooks] = useState<MockBook[]>([])
  const [publisherDraftBooks, setPublisherDraftBooks] = useState<MockBook[]>([])
  const [publisherDraftPage, setPublisherDraftPage] = useState(1)
  const [progress, setProgress] = useState<ProgressMap>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [ownershipFilter, setOwnershipFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [sort, setSort] = useState<BookSortKey>('newest')
  const [page, setPage] = useState(1)
  const [filterSettings, setFilterSettings] = useState<BookFilterSettings>(emptyFilterSettings)
  const shelfGrid = useGridRowsPageSize()
  const publisherDraftGrid = useGridRowsPageSize()

  useEffect(() => {
    setLoading(true)
    if (user?.mockData) {
      let cancelled = false
      ;(async () => {
        const { mockBooks } = await import('@/lib/mock-data')
        if (cancelled) return
        const entries = getMockLibraryEntries(user.mockData!.id)
        const books = entries
          .map(entry => mockBooks.find(book => book.id === entry.bookId))
          .filter((book): book is MockBook => Boolean(book))
          .map((book: MockBook) => ({ ...book, cover_url: resolveBookCoverArt({ coverUrl: book.cover_url, title: book.title, category: book.category, description: book.description }) })) as MockBook[]
        setLibraryBooks(books)
        setProgress(getAllReadingProgress(user.mockData!.id))
        setLoading(false)
      })()
      return () => { cancelled = true }
    } else if (user) {
      getUserLibrary(user.id).then(result => {
        setLibraryBooks(result.books)
        setProgress(result.progress)
      }).catch(() => {
        setLibraryBooks([])
        setProgress({})
      }).finally(() => setLoading(false))
      getPublisherDraftBooks(user.id).then(setPublisherDraftBooks).catch(() => setPublisherDraftBooks([]))
    } else {
      setPublisherDraftBooks([])
      setLoading(false)
    }
  }, [user])
  useEffect(() => {
    loadBookFilterSettings().then(setFilterSettings)
  }, [])
  useEffect(() => {
    getPublishedBooks().then(books => setFreeBooks(books.filter(book => book.price === 0))).catch(() => setFreeBooks([]))
  }, [])

  const availableFreeBooks = freeBooks.filter(book => !libraryBooks.find(item => item.id === book.id))
  const shelfItems: ShelfItem[] = [
    ...libraryBooks.map(book => ({ book, isPurchased: true })),
    ...availableFreeBooks.map(book => ({ book, isPurchased: false })),
  ]
  const totalBooks = shelfItems.length
  const activeBooks = libraryBooks.filter(book => progress[book.id] && progress[book.id].currentPage + 1 < (book.page_count || book.pages.length || progress[book.id].totalPages || 1)).length
  const categories = mergeFilterOptions(uniqueBookValues(shelfItems.map(item => item.book), book => book.category), filterSettings.categories)
  const bookTypes = mergeFilterOptions(uniqueBookValues(shelfItems.map(item => item.book), book => normalizeBookType(book.book_type)), filterSettings.bookTypes)
  const tags = mergeFilterOptions(uniqueBookValues(shelfItems.map(item => item.book), book => book.tags?.join('|')).flatMap(value => value.split('|')).filter(Boolean), filterSettings.tags)
  const byOwnership = ownershipFilter === 'purchased'
    ? shelfItems.filter(item => item.isPurchased)
    : ownershipFilter === 'free'
      ? shelfItems.filter(item => !item.isPurchased)
      : shelfItems
  const byCategory = filterByValue(byOwnership, categoryFilter, item => item.book.category)
  const byType = filterByValue(byCategory, typeFilter, item => normalizeBookType(item.book.book_type))
  const byTag = tagFilter === 'all' ? byType : byType.filter(item => item.book.tags?.includes(tagFilter))
  const searched = searchBooks(byTag.map(item => item.book), search)
  const ids = new Set(searched.map(book => book.id))
  const sortedBooks = sortBooks(byTag.filter(item => ids.has(item.book.id)).map(item => item.book), sort)
  const filteredItems = sortedBooks.map(book => byTag.find(item => item.book.id === book.id)!).filter(Boolean)
  const paged = paginate(filteredItems, page, shelfGrid.pageSize)
  const publisherDraftPaged = paginate(publisherDraftBooks, publisherDraftPage, publisherDraftGrid.pageSize)

  useEffect(() => setPage(1), [categoryFilter, ownershipFilter, search, sort, tagFilter, typeFilter])
  useEffect(() => setPublisherDraftPage(1), [publisherDraftBooks.length])
  useEffect(() => {
    if (page > paged.pageCount) setPage(paged.pageCount)
  }, [page, paged.pageCount])
  useEffect(() => {
    if (publisherDraftPage > publisherDraftPaged.pageCount) setPublisherDraftPage(publisherDraftPaged.pageCount)
  }, [publisherDraftPage, publisherDraftPaged.pageCount])

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <BookOpen className="w-20 h-20 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">{t('nav_library')}</h1>
        <p className="text-muted-foreground mb-6">برای دیدن قفسه و ادامه مطالعه وارد حساب شوید.</p>
        <Link to="/auth"><Button>ورود به حساب</Button></Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      <section className="library-hero">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary"><Sparkles className="w-4 h-4" /> قفسه شخصی شما</span>
          <h1 className="mt-5 text-3xl sm:text-4xl md:text-5xl font-black font-display">{t('nav_library')}</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground leading-relaxed">کتاب‌هایی که خریده‌ای یا رایگان در دسترس‌اند اینجا مرتب شده‌اند؛ مستقیم ادامه بده یا کتاب تازه‌ای به قفسه اضافه کن.</p>
        </div>
        <div className="library-stats">
          <div><b>{totalBooks.toLocaleString('fa-IR')}</b><span>کتاب در دسترس</span></div>
          <div><b>{libraryBooks.length.toLocaleString('fa-IR')}</b><span>خریداری شده</span></div>
          <div><b>{activeBooks.toLocaleString('fa-IR')}</b><span>در حال مطالعه</span></div>
        </div>
      </section>

      <div className="flex justify-end">
        <Link to="/store"><Button variant="outline" className="gap-2 rounded-full px-5"><ShoppingCart className="w-4 h-4" /> کشف کتاب‌های بیشتر</Button></Link>
      </div>

      {publisherDraftBooks.length > 0 && (
        <section className="menu-glass-70 rounded-3xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black font-display">پیش‌نویس‌های ناشر برای تست</h2>
              <p className="text-sm text-muted-foreground mt-1">این کتاب‌ها هنوز منتشر نشده‌اند و فقط برای خود ناشر جهت تست نمای فروشگاه و کتابخوان نمایش داده می‌شوند.</p>
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">{publisherDraftBooks.length.toLocaleString('fa-IR')} عنوان منتشرنشده</span>
          </div>
          <div ref={publisherDraftGrid.gridRef} className="library-book-grid">
            {publisherDraftPaged.items.map((book, index) => (
              <article key={`publisher-draft-${book.id}`} className="shelf-card group" style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}>
                <Link to={`/b/${book.id}`} className="shelf-cover">
                  <BookCover src={book.cover_url} title={book.title} category={book.category} loading={index < 6 ? 'eager' : 'lazy'} />
                  <span className="book-pill book-pill-warning">منتشر نشده</span>
                </Link>
                <div className="shelf-content">
                  <h3 className="book-card-title">{book.title}</h3>
                  <p className="book-card-subtitle">{book.author || 'نویسنده نامشخص'}</p>
                  <p className="book-card-description">تست ناشر · بدون هزینه</p>
                  <div className="mt-auto grid grid-cols-[1fr_auto] gap-2">
                    <Link to={`/read/${book.id}`}><Button className="w-full gap-2 rounded-xl"><PlayCircle className="w-4 h-4" />تست کتابخوان</Button></Link>
                    <Link to={`/b/${book.id}`}><Button variant="outline" size="icon" className="rounded-xl" title="جزئیات کتاب"><ArrowLeft className="w-4 h-4" /></Button></Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {publisherDraftPaged.pageCount > 1 && (
            <div className="book-pagination">
              <Button variant="outline" size="icon" onClick={() => setPublisherDraftPage(current => Math.max(1, current - 1))} disabled={publisherDraftPaged.page === 1}><ChevronRight className="w-4 h-4" /></Button>
              {pageNumbers(publisherDraftPaged.page, publisherDraftPaged.pageCount).map(number => <Button key={number} variant={publisherDraftPaged.page === number ? 'default' : 'outline'} size="icon" onClick={() => setPublisherDraftPage(number)}>{number.toLocaleString('fa-IR')}</Button>)}
              <Button variant="outline" size="icon" onClick={() => setPublisherDraftPage(current => Math.min(publisherDraftPaged.pageCount, current + 1))} disabled={publisherDraftPaged.page === publisherDraftPaged.pageCount}><ChevronLeft className="w-4 h-4" /></Button>
            </div>
          )}
        </section>
      )}

      <section className="list-control-panel">
        <label className="is-wide"><span>جستجو</span><div className="relative"><Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="عنوان، نویسنده یا برچسب..." className="pr-9" /></div></label>
        <label><span>نوع قفسه</span><select value={ownershipFilter} onChange={event => setOwnershipFilter(event.target.value)}><option value="all">همه</option><option value="purchased">خریداری‌شده</option><option value="free">رایگان</option></select></label>
        <label><span>دسته‌بندی</span><select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="all">همه دسته‌ها</option>{categories.map(category => <option key={category} value={category}>{category}</option>)}</select></label>
        <label><span>نوع کتاب</span><select value={typeFilter} onChange={event => setTypeFilter(event.target.value)}><option value="all">همه نوع‌ها</option>{bookTypes.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
        <label><span>تگ</span><select value={tagFilter} onChange={event => setTagFilter(event.target.value)}><option value="all">همه تگ‌ها</option>{tags.map(tag => <option key={tag} value={tag}>{tag}</option>)}</select></label>
        <label><span>مرتب‌سازی</span><select value={sort} onChange={event => setSort(event.target.value as BookSortKey)}><option value="newest">جدیدترین</option><option value="oldest">قدیمی‌ترین</option><option value="title-asc">عنوان: الف تا ی</option><option value="title-desc">عنوان: ی تا الف</option><option value="pages-desc">صفحات: زیاد به کم</option><option value="pages-asc">صفحات: کم به زیاد</option></select></label>
      </section>

      {loading ? (
        <div ref={shelfGrid.gridRef} className="library-book-grid">{Array.from({ length: Math.min(shelfGrid.pageSize, 15) }).map((_, index) => <div key={index} className="h-64 animate-pulse rounded-2xl bg-muted/70" />)}</div>
      ) : filteredItems.length === 0 ? (
        <div className="menu-glass-70 rounded-3xl p-12 text-center">
          <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">کتابی پیدا نشد</h2>
          <p className="text-muted-foreground mb-6">فیلترها را تغییر بده یا از فروشگاه کتاب تازه‌ای انتخاب کن.</p>
          <Link to="/store"><Button className="gap-2"><ShoppingCart className="w-4 h-4" />مشاهده فروشگاه</Button></Link>
        </div>
      ) : (
        <section>
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-black font-display flex items-center gap-2"><CheckCircle className="w-5 h-5 text-success" /> قفسه من</h2>
            <span className="text-sm text-muted-foreground">{filteredItems.length.toLocaleString('fa-IR')} کتاب؛ نمایش {paged.start.toLocaleString('fa-IR')} تا {paged.end.toLocaleString('fa-IR')}</span>
          </div>
          <div ref={shelfGrid.gridRef} className="library-book-grid">{paged.items.map((item, index) => <ShelfBookCard key={`${item.book.id}-${item.isPurchased ? 'owned' : 'free'}`} book={item.book} isPurchased={item.isPurchased} progress={progress[item.book.id]} index={index} />)}</div>
          {paged.pageCount > 1 && (
            <div className="book-pagination">
              <Button variant="outline" size="icon" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={paged.page === 1}><ChevronRight className="w-4 h-4" /></Button>
              {pageNumbers(paged.page, paged.pageCount).map(number => <Button key={number} variant={paged.page === number ? 'default' : 'outline'} size="icon" onClick={() => setPage(number)}>{number.toLocaleString('fa-IR')}</Button>)}
              <Button variant="outline" size="icon" onClick={() => setPage(current => Math.min(paged.pageCount, current + 1))} disabled={paged.page === paged.pageCount}><ChevronLeft className="w-4 h-4" /></Button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
