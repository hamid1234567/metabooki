import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { BookCover } from '@/components/BookCover'
import { useI18n } from '@/lib/i18n'
import { type MockBook } from '@/lib/mock-data'
import { getPublishedBooks } from '@/lib/book-repository'
import { BOOK_LIST_PAGE_SIZE, filterByValue, normalizeBookType, pageNumbers, paginate, searchBooks, sortBooks, uniqueBookValues, type BookSortKey } from '@/lib/book-listing'
import { loadBookFilterSettings, mergeFilterOptions, type BookFilterSettings, emptyFilterSettings } from '@/lib/filter-settings'
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Eye, Search, ShoppingCart, Sparkles, Star } from 'lucide-react'

function BookShowcaseCard({ book, index }: { book: MockBook; index: number }) {
  const isFree = book.price === 0
  const rating = (4.4 + (index % 5) * 0.1).toFixed(1)

  return (
    <Link
      to={`/b/${book.id}`}
      className="book-card book-card-compact group"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <div className="book-card-cover">
        <BookCover src={book.cover_url} title={book.title} category={book.category} loading={index < 8 ? 'eager' : 'lazy'} fetchPriority={index < 4 ? 'high' : 'auto'} />
        <div className="book-card-sheen" />
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <span className={isFree ? 'book-pill book-pill-success' : 'book-pill book-pill-primary'}>
            {isFree ? 'رایگان' : `${book.price.toLocaleString('fa-IR')} کردیت`}
          </span>
        </div>
        <div className="book-card-hover">
          <Button size="sm" className="gap-2 rounded-full px-4 shadow-glow">
            {isFree ? <BookOpen className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
            {isFree ? 'شروع خواندن' : 'مشاهده و خرید'}
          </Button>
        </div>
      </div>

      <div className="book-card-body">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="book-card-title">{book.title}</h3>
            <p className="book-card-subtitle">{book.author || 'نویسنده نامشخص'}</p>
          </div>
          <span className="book-rating">
            <Star className="w-3.5 h-3.5 fill-warning text-warning" />
            {rating}
          </span>
        </div>

        <p className="book-card-description">{book.book_type || 'تألیف'} · {book.publisher_name}</p>
        <div className="book-tags">{book.tags.slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}</div>
        <div className="book-card-footer">
          <span className="text-xs text-muted-foreground">{book.publisher_name}</span>
          <span className="book-card-link">جزئیات <ArrowLeft className="w-4 h-4" /></span>
        </div>
      </div>
    </Link>
  )
}

export default function Store() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [priceFilter, setPriceFilter] = useState('all')
  const [sort, setSort] = useState<BookSortKey>('newest')
  const [filterSettings, setFilterSettings] = useState<BookFilterSettings>(emptyFilterSettings)
  const [featuredSeed] = useState(() => new Date().getDate() * 24 + new Date().getHours())
  const [searchParams, setSearchParams] = useSearchParams()
  const { t } = useI18n()
  const activeCategory = searchParams.get('cat') || 'all'
  const [allBooks, setAllBooks] = useState<MockBook[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  useEffect(() => {
    setLoading(true)
    getPublishedBooks().then(setAllBooks).catch(() => setAllBooks([])).finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    loadBookFilterSettings().then(setFilterSettings)
  }, [])

  const bookTypes = useMemo(() => mergeFilterOptions(uniqueBookValues(allBooks, book => normalizeBookType(book.book_type)), filterSettings.bookTypes), [allBooks, filterSettings.bookTypes])
  const configuredCategories = useMemo(() => mergeFilterOptions(uniqueBookValues(allBooks, book => book.category), filterSettings.categories), [allBooks, filterSettings.categories])
  const configuredTags = useMemo(() => mergeFilterOptions(uniqueBookValues(allBooks, book => book.tags?.join('|')).flatMap(value => value.split('|')).filter(Boolean), filterSettings.tags), [allBooks, filterSettings.tags])

  const filtered = useMemo(() => {
    const byCategory = activeCategory === 'all' ? allBooks : allBooks.filter(book => book.category === activeCategory)
    const byType = filterByValue(byCategory, typeFilter, book => normalizeBookType(book.book_type))
    const byTag = tagFilter === 'all' ? byType : byType.filter(book => book.tags?.includes(tagFilter))
    const byPrice = priceFilter === 'free'
      ? byTag.filter(book => book.price === 0)
      : priceFilter === 'paid'
        ? byTag.filter(book => book.price > 0)
        : byTag
    return sortBooks(searchBooks(byPrice, search), sort)
  }, [activeCategory, allBooks, priceFilter, search, sort, tagFilter, typeFilter])

  const featuredPool = filtered.length ? filtered : allBooks
  const featuredBook = featuredPool.length ? featuredPool[featuredSeed % featuredPool.length] : undefined
  const paged = paginate(filtered, page, BOOK_LIST_PAGE_SIZE)
  const pageCount = paged.pageCount
  const visibleBooks = paged.items

  useEffect(() => setPage(1), [activeCategory, priceFilter, search, sort, tagFilter, typeFilter])
  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <section className="store-hero">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            <Sparkles className="w-4 h-4" /> انتخاب امروز متابوکی
          </span>
          <h1 className="mt-5 text-3xl sm:text-4xl md:text-5xl font-black font-display leading-tight">{t('nav_store')}</h1>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            کتاب بعدی‌ات را سریع‌تر پیدا کن؛ پیش‌نمایش بخوان، جزئیات را ببین و با یک مسیر روشن وارد خرید یا مطالعه شو.
          </p>
          <div className="relative mt-6 max-w-xl">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('search')}
              className="w-full rounded-2xl border border-border bg-background/75 py-3.5 pr-12 pl-4 text-sm shadow-soft outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
            />
          </div>
        </div>

        {featuredBook && (
          <Link to={`/b/${featuredBook.id}`} className="featured-book-card">
            <BookCover src={featuredBook.cover_url} title={featuredBook.title} category={featuredBook.category} loading="eager" fetchPriority="high" />
            <div className="min-w-0">
              <p className="text-xs text-primary font-bold">پیشنهاد ویژه</p>
              <h2 className="mt-1 text-xl font-black line-clamp-2">{featuredBook.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{featuredBook.author || 'نویسنده نامشخص'} · {featuredBook.book_type || 'تألیف'}</p>
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary">دیدن معرفی <ArrowLeft className="w-4 h-4" /></div>
            </div>
          </Link>
        )}
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[{ key: 'all', label: 'همه' }, ...configuredCategories.filter(category => category !== 'all').map(category => ({ key: category, label: category }))].map(category => (
          <button
            key={category.key}
            type="button"
            onClick={() => {
              const next = new URLSearchParams(searchParams)
              if (category.key === 'all') next.delete('cat')
              else next.set('cat', category.key)
              setSearchParams(next)
            }}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all ${activeCategory === category.key ? 'bg-primary text-primary-foreground shadow-glow' : 'bg-card/70 text-muted-foreground hover:bg-primary/10 hover:text-primary'}`}
          >
            {category.label}
          </button>
        ))}
      </div>

      <section className="list-control-panel">
        <label><span>نوع کتاب</span><select value={typeFilter} onChange={event => setTypeFilter(event.target.value)}><option value="all">همه نوع‌ها</option>{bookTypes.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
        <label><span>تگ</span><select value={tagFilter} onChange={event => setTagFilter(event.target.value)}><option value="all">همه تگ‌ها</option>{configuredTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}</select></label>
        <label><span>قیمت</span><select value={priceFilter} onChange={event => setPriceFilter(event.target.value)}><option value="all">همه</option><option value="free">رایگان</option><option value="paid">غیررایگان</option></select></label>
        <label><span>مرتب‌سازی</span><select value={sort} onChange={event => setSort(event.target.value as BookSortKey)}><option value="newest">جدیدترین</option><option value="oldest">قدیمی‌ترین</option><option value="title-asc">عنوان: الف تا ی</option><option value="title-desc">عنوان: ی تا الف</option><option value="price-asc">قیمت: کم به زیاد</option><option value="price-desc">قیمت: زیاد به کم</option><option value="pages-desc">صفحات: زیاد به کم</option><option value="pages-asc">صفحات: کم به زیاد</option></select></label>
      </section>

      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black font-display">کتاب‌های آماده خواندن</h2>
            <p className="mt-1 text-sm text-muted-foreground">{filtered.length.toLocaleString('fa-IR')} کتاب؛ نمایش {paged.start.toLocaleString('fa-IR')} تا {paged.end.toLocaleString('fa-IR')} در صفحه ۵۰تایی</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground"><Eye className="w-4 h-4" /> روی جلدها حرکت کنید</div>
        </div>

        {loading ? (
          <div className="store-book-grid">{Array.from({ length: 12 }).map((_, index) => <div key={index} className="aspect-[3/5] animate-pulse rounded-xl bg-muted/70" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="menu-glass-70 rounded-3xl py-20 text-center">
            <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{search.trim() ? 'کتابی با این مشخصات پیدا نشد' : 'کتابی برای نمایش موجود نیست'}</p>
          </div>
        ) : (
          <>
            <div className="store-book-grid">{visibleBooks.map((book, index) => <BookShowcaseCard key={book.id} book={book} index={index} />)}</div>
            {pageCount > 1 && (
              <div className="book-pagination">
                <Button variant="outline" size="icon" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1} title="صفحه قبل"><ChevronRight className="h-4 w-4" /></Button>
                {pageNumbers(page, pageCount).map(number => <Button key={number} variant={page === number ? 'default' : 'outline'} size="icon" onClick={() => setPage(number)}>{number.toLocaleString('fa-IR')}</Button>)}
                <Button variant="outline" size="icon" onClick={() => setPage(current => Math.min(pageCount, current + 1))} disabled={page === pageCount} title="صفحه بعد"><ChevronLeft className="h-4 w-4" /></Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
