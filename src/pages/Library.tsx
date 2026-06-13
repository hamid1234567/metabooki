import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { BookCover } from '@/components/BookCover'
import { useAuthContext } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import { getAllReadingProgress, getMockLibraryEntries } from '@/lib/mock-library'
import { mockBooks, type MockBook } from '@/lib/mock-data'
import { ArrowLeft, BookOpen, CheckCircle, Clock, PlayCircle, ShoppingCart, Sparkles } from 'lucide-react'
import { getUserLibrary } from '@/lib/book-repository'

type ProgressMap = Record<string, { currentPage: number; totalPages: number; lastReadAt: string }>

function ShelfBookCard({
  book,
  isPurchased,
  progress,
  index,
}: {
  book: MockBook
  isPurchased: boolean
  progress?: ProgressMap[string]
  index: number
}) {
  const percent = progress ? Math.round(((progress.currentPage + 1) / book.pages.length) * 100) : 0
  const isFinished = percent >= 100
  const lastRead = progress?.lastReadAt ? new Date(progress.lastReadAt).toLocaleDateString('fa-IR') : null
  const actionText = isPurchased
    ? progress ? 'ادامه خواندن' : 'شروع خواندن'
    : 'افزودن به قفسه'

  return (
    <article
      className="shelf-card group"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <Link to={`/b/${book.id}`} className="shelf-cover">
        <BookCover src={book.cover_url} title={book.title} category={book.category} loading={index < 8 ? 'eager' : 'lazy'} fetchPriority={index < 4 ? 'high' : 'auto'} />
        <div className="book-card-sheen" />
        <span className={isPurchased ? 'book-pill book-pill-primary' : 'book-pill book-pill-success'}>
          {isPurchased ? 'در قفسه شما' : 'رایگان'}
        </span>
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
              <div
                className={`h-full rounded-full transition-all duration-500 ${isFinished ? 'bg-success' : 'bg-primary'}`}
                style={{ width: `${Math.min(percent, 100)}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>صفحه {progress ? progress.currentPage + 1 : 1} از {book.pages.length}</span>
              {lastRead && <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{lastRead}</span>}
            </div>
          </div>
        ) : (
          <div className="book-tags">
            {book.tags.slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}
          </div>
        )}

        <div className="mt-auto grid grid-cols-[1fr_auto] gap-2">
          <Link to={`/read/${book.id}`}>
            <Button className="w-full gap-2 rounded-xl">
              <PlayCircle className="w-4 h-4" />
              {actionText}
            </Button>
          </Link>
          <Link to={`/b/${book.id}`}>
            <Button variant="outline" size="icon" className="rounded-xl" title="جزئیات کتاب">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </article>
  )
}

export default function Library() {
  const { user } = useAuthContext()
  const { t } = useI18n()
  const [libraryBooks, setLibraryBooks] = useState<MockBook[]>([])
  const [progress, setProgress] = useState<ProgressMap>({})

  useEffect(() => {
    if (user?.mockData) {
      const entries = getMockLibraryEntries(user.mockData.id)
      const books = entries
        .map(entry => mockBooks.find(book => book.id === entry.bookId))
        .filter(Boolean) as MockBook[]
      setLibraryBooks(books)
      setProgress(getAllReadingProgress(user.mockData.id))
    } else if (user) {
      getUserLibrary(user.id).then(result => {
        setLibraryBooks(result.books)
        setProgress(result.progress)
      }).catch(() => {
        setLibraryBooks([])
        setProgress({})
      })
    }
  }, [user])

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

  const freeBooks = mockBooks.filter(book => book.price === 0 && !libraryBooks.find(item => item.id === book.id))
  const totalBooks = libraryBooks.length + freeBooks.length
  const activeBooks = libraryBooks.filter(book => progress[book.id] && progress[book.id].currentPage + 1 < book.pages.length).length

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      <section className="library-hero">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            <Sparkles className="w-4 h-4" /> قفسه شخصی شما
          </span>
          <h1 className="mt-5 text-3xl sm:text-4xl md:text-5xl font-black font-display">{t('nav_library')}</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground leading-relaxed">
            کتاب‌هایی که خریده‌ای یا رایگان در دسترس‌اند اینجا مرتب شده‌اند؛ مستقیم ادامه بده یا کتاب تازه‌ای به قفسه اضافه کن.
          </p>
        </div>
        <div className="library-stats">
          <div><b>{totalBooks.toLocaleString('fa-IR')}</b><span>کتاب در دسترس</span></div>
          <div><b>{libraryBooks.length.toLocaleString('fa-IR')}</b><span>خریداری شده</span></div>
          <div><b>{activeBooks.toLocaleString('fa-IR')}</b><span>در حال مطالعه</span></div>
        </div>
      </section>

      <div className="flex justify-end">
        <Link to="/store">
          <Button variant="outline" className="gap-2 rounded-full px-5">
            <ShoppingCart className="w-4 h-4" /> کشف کتاب‌های بیشتر
          </Button>
        </Link>
      </div>

      {libraryBooks.length === 0 && freeBooks.length === 0 ? (
        <div className="menu-glass-70 rounded-3xl p-12 text-center">
          <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">قفسه هنوز خالی است</h2>
          <p className="text-muted-foreground mb-6">از فروشگاه شروع کن و اولین کتابت را اضافه کن.</p>
          <Link to="/store"><Button className="gap-2"><ShoppingCart className="w-4 h-4" />مشاهده فروشگاه</Button></Link>
        </div>
      ) : (
        <>
          {libraryBooks.length > 0 && (
            <section>
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="text-2xl font-black font-display flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-success" /> خریداری شده‌ها
                </h2>
                <span className="text-sm text-muted-foreground">{libraryBooks.length.toLocaleString('fa-IR')} کتاب</span>
              </div>
              <div className="library-book-grid">
                {libraryBooks.map((book, index) => (
                  <ShelfBookCard
                    key={book.id}
                    book={book}
                    isPurchased={true}
                    progress={progress[book.id]}
                    index={index}
                  />
                ))}
              </div>
            </section>
          )}

          {freeBooks.length > 0 && (
            <section>
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="text-2xl font-black font-display flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" /> رایگان برای شروع
                </h2>
                <span className="text-sm text-muted-foreground">بدون پرداخت، مستقیم بخوانید</span>
              </div>
              <div className="library-book-grid">
                {freeBooks.map((book, index) => (
                  <ShelfBookCard
                    key={book.id}
                    book={book}
                    isPurchased={false}
                    progress={undefined}
                    index={index}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
