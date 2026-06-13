import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { BookCover } from '@/components/BookCover'
import { useAuthContext } from '@/lib/auth-context'
import { CREDIT_VALUE_TOMAN, type MockBook } from '@/lib/mock-data'
import { getBook } from '@/lib/book-repository'
import { addToMockLibrary, isInMockLibrary } from '@/lib/mock-library'
import { creditsBus } from '@/lib/credits-bus'
import { saveCredits } from '@/lib/mock-user-store'
import { addBookComment, getBookComments, type MockComment } from '@/lib/mock-comments'
import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  CheckCircle,
  Eye,
  FileText,
  MessageSquare,
  PlayCircle,
  Send,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
} from 'lucide-react'
import { toast } from 'sonner'
import { useCredits } from '@/hooks/useCredits'
import { supabase } from '@/integrations/supabase/client'

const featureLabels: Record<string, string> = {
  quiz: 'آزمون تعاملی',
  image: 'تصویر',
  math: 'فرمول',
  code: 'کد',
  table: 'جدول',
  timeline: 'تایم‌لاین',
  mindmap: 'نقشه ذهنی',
  scrollytelling: 'روایت اسکرولی',
  audio: 'صوت',
  hotspot: 'هات‌اسپات',
}

function collectFeatures(book: MockBook) {
  const types = new Set<string>()
  book.pages.forEach(page => {
    page.blocks?.forEach((block: any) => {
      if (featureLabels[block.type]) types.add(block.type)
    })
  })
  return Array.from(types).slice(0, 6)
}

export default function BookLanding() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthContext()
  const { balance: databaseBalance } = useCredits(user)
  const navigate = useNavigate()
  const [book, setBook] = useState<MockBook | null>(null)
  const [loadingBook, setLoadingBook] = useState(true)
  const [purchased, setPurchased] = useState(false)
  const [buying, setBuying] = useState(false)
  const [comments, setComments] = useState<MockComment[]>([])
  const [commentText, setCommentText] = useState('')

  useEffect(() => {
    if (!id) return
    setLoadingBook(true)
    getBook(id).then(found => {
      setBook(found)
      if (found && user?.mockData) setComments(getBookComments(found.id))
      else if (found) (supabase as any).from('book_comments').select('*').eq('book_id', found.id).eq('is_hidden', false).order('created_at', { ascending: false }).then(({ data }: { data: any[] | null }) => setComments((data || []).map(item => ({ id: item.id, bookId: item.book_id, userId: item.user_id, displayName: 'کاربر متابوکی', text: item.content, status: 'visible', createdAt: item.created_at }))))
      if (found && user?.mockData) setPurchased(isInMockLibrary(user.mockData.id, found.id))
      else if (found && user) supabase.from('user_books').select('id').eq('user_id', user.id).eq('book_id', found.id).maybeSingle().then(({ data }) => setPurchased(Boolean(data)))
    }).catch(() => setBook(null)).finally(() => setLoadingBook(false))
  }, [id, user])

  const features = useMemo(() => book ? collectFeatures(book) : [], [book])

  if (loadingBook) {
    return <BookLoading />
  }

  if (!book) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <BookOpen className="w-20 h-20 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">کتاب یافت نشد</h1>
        <p className="text-muted-foreground mb-6">این کتاب در فروشگاه موجود نیست.</p>
        <Link to="/store"><Button>بازگشت به فروشگاه</Button></Link>
      </div>
    )
  }

  const isFree = book.price === 0
  const canRead = isFree || purchased
  const mockData = user?.mockData
  const balance = mockData?.credits ?? databaseBalance
  const canBuy = book.price > 0 && book.price <= balance && !purchased
  const tomanPrice = book.price * CREDIT_VALUE_TOMAN
  const rating = '4.8'

  const handleBuy = async () => {
    if (!user) {
      toast.error('برای خرید ابتدا وارد حساب شوید')
      navigate('/auth')
      return
    }
    if (balance < book.price) {
      toast.error('اعتبار کافی نیست')
      return
    }

    setBuying(true)
    try {
      if (!mockData) {
        const { data: newBalance, error } = await (supabase as any).rpc('purchase_book', { target_book_id: book.id })
        if (error) throw error
        setPurchased(true)
        creditsBus.emit(Number(newBalance))
        toast.success('کتاب به قفسه شما اضافه شد')
        return
      }
      const success = addToMockLibrary(mockData.id, book.id, book.price)
      if (success) {
        setPurchased(true)
        mockData.credits -= book.price
        saveCredits(mockData.id, mockData.credits)
        creditsBus.emit(mockData.credits)
        toast.success('کتاب به قفسه شما اضافه شد')
      }
    } catch {
      toast.error('خرید کتاب انجام نشد')
    } finally {
      setBuying(false)
    }
  }

  const handleAddComment = async () => {
    if (!user) {
      toast.error('برای ثبت دیدگاه ابتدا وارد شوید')
      navigate('/auth')
      return
    }
    const text = commentText.trim()
    if (!text) {
      toast.error('متن دیدگاه را بنویسید')
      return
    }
    if (user.mockData) {
      addBookComment({ bookId: book.id, userId: user.mockData.id, displayName: user.mockData.display_name || user.email || 'کاربر', text })
      setComments(getBookComments(book.id))
    } else {
      const { data, error } = await (supabase as any).from('book_comments').insert({ book_id: book.id, user_id: user.id, content: text }).select().single()
      if (error) { toast.error(error.message); return }
      setComments(current => [{ id: data.id, bookId: data.book_id, userId: data.user_id, displayName: user.email || 'کاربر', text: data.content, status: 'visible', createdAt: data.created_at }, ...current])
    }
    setCommentText('')
    toast.success('دیدگاه شما ثبت شد')
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <Link to="/store" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary">
        <ArrowLeft className="w-4 h-4" /> بازگشت به فروشگاه
      </Link>

      <section className="book-detail-hero">
        <div className="book-detail-cover-wrap">
          <div className="book-detail-cover">
            <BookCover src={book.cover_url} title={book.title} category={book.category} loading="eager" />
            <div className="book-card-sheen" />
          </div>
          <div className="book-detail-mini-stats">
            <span><Eye className="w-4 h-4" /> {book.preview_pages.length.toLocaleString('fa-IR')} پیش‌نمایش</span>
            <span><FileText className="w-4 h-4" /> {book.page_count.toLocaleString('fa-IR')} صفحه</span>
          </div>
        </div>

        <div className="book-detail-main">
          <div className="flex flex-wrap gap-2">
            <span className={isFree ? 'book-pill book-pill-success' : 'book-pill book-pill-primary'}>
              {isFree ? 'رایگان' : `${book.price.toLocaleString('fa-IR')} کردیت`}
            </span>
            <span className="book-pill book-pill-glass">{book.category}</span>
            {purchased && <span className="book-pill book-pill-success">در قفسه شما</span>}
          </div>

          <h1 className="book-detail-title">{book.title}</h1>
          {book.subtitle && <p className="book-detail-subtitle">{book.subtitle}</p>}
          <div className="book-credit-line">
            <span>نویسنده: <b>{book.author || 'نویسنده نامشخص'}</b></span>
            <span>نوع اثر: <b>{book.book_type || 'تألیف'}</b></span>
          </div>

          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="book-detail-stat"><b>{rating}</b><span><Star className="w-4 h-4 fill-warning text-warning" /> امتیاز</span></div>
            <div className="book-detail-stat"><b>{book.page_count.toLocaleString('fa-IR')}</b><span>صفحه</span></div>
            <div className="book-detail-stat"><b>{book.preview_pages.length.toLocaleString('fa-IR')}</b><span>صفحه پیش‌نمایش</span></div>
            <div className="book-detail-stat"><b>{book.language === 'fa' ? 'فارسی' : 'English'}</b><span>زبان</span></div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {book.tags.map(tag => <span key={tag} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{tag}</span>)}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {canRead ? (
              <Link to={`/read/${book.id}`}>
                <Button size="lg" className="gap-2 rounded-full px-7 shadow-glow">
                  <PlayCircle className="w-5 h-5" /> شروع خواندن
                </Button>
              </Link>
            ) : (
              <Button size="lg" onClick={handleBuy} disabled={!canBuy || buying} className="gap-2 rounded-full px-7 shadow-glow">
                {buying ? <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" /> : <ShoppingCart className="w-5 h-5" />}
                {canBuy ? 'خرید و افزودن به قفسه' : user ? 'اعتبار ناکافی' : 'ورود برای خرید'}
              </Button>
            )}
            {book.preview_pages.length > 0 && (
              <Link to={`/read/${book.id}`}>
                <Button size="lg" variant="outline" className="gap-2 rounded-full px-7">
                  <Eye className="w-5 h-5" /> خواندن پیش‌نمایش
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
        <main className="space-y-8">
          <section className="book-detail-section book-summary-section">
            <div>
              <span>درباره کتاب</span>
              <h2>خلاصه کتاب</h2>
            </div>
            <p>{book.description}</p>
          </section>

          <section className="book-detail-section">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-black font-display">چرا این کتاب؟</h2>
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="book-benefit">
                <BookOpen className="w-6 h-6 text-primary" />
                <h3>مطالعه روان</h3>
                <p>طراحی مناسب موبایل و دسکتاپ برای شروع سریع مطالعه.</p>
              </div>
              <div className="book-benefit">
                <ShieldCheck className="w-6 h-6 text-primary" />
                <h3>پیش‌نمایش قبل از خرید</h3>
                <p>چند صفحه اول را ببینید و با خیال راحت تصمیم بگیرید.</p>
              </div>
              <div className="book-benefit">
                <Bookmark className="w-6 h-6 text-primary" />
                <h3>ذخیره در قفسه</h3>
                <p>پس از خرید، کتاب همیشه از بخش قفسه من در دسترس است.</p>
              </div>
            </div>
          </section>

          <section className="book-detail-section">
            <h2 className="mb-5 text-2xl font-black font-display">امکانات داخل کتاب</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {features.length > 0 ? features.map(type => (
                <div key={type} className="book-feature-tile">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span>{featureLabels[type]}</span>
                </div>
              )) : (
                <div className="book-feature-tile">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span>متن خواندنی</span>
                </div>
              )}
              {book.preview_pages.length > 0 && (
                <div className="book-feature-tile">
                  <Eye className="w-4 h-4 text-primary" />
                  <span>{book.preview_pages.length.toLocaleString('fa-IR')} صفحه پیش‌نمایش رایگان</span>
                </div>
              )}
            </div>
          </section>

          <section className="book-detail-section">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-black font-display">دیدگاه کاربران</h2>
              <span className="text-sm text-muted-foreground">{comments.length.toLocaleString('fa-IR')} دیدگاه</span>
            </div>

            {user ? (
              <div className="mb-6 rounded-2xl bg-background/55 p-4">
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="نظر خود را درباره این کتاب بنویسید..."
                  className="min-h-28 w-full resize-none rounded-xl border border-input bg-background/75 p-3 text-sm outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
                />
                <div className="mt-3 flex justify-end">
                  <Button onClick={handleAddComment} className="gap-2 rounded-full px-5">
                    <Send className="w-4 h-4" /> ثبت دیدگاه
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mb-6 rounded-2xl bg-muted/45 p-4 text-sm text-muted-foreground">
                برای ثبت دیدگاه باید وارد حساب شوید. <Link to="/auth" className="font-bold text-primary hover:underline">ورود</Link>
              </div>
            )}

            <div className="space-y-3">
              {comments.length === 0 ? (
                <p className="rounded-2xl bg-background/45 py-8 text-center text-sm text-muted-foreground">هنوز دیدگاهی ثبت نشده است.</p>
              ) : comments.map(comment => (
                <article key={comment.id} className="book-comment">
                  <div className="flex items-center justify-between gap-3">
                    <strong>{comment.displayName}</strong>
                    <span>{new Date(comment.createdAt).toLocaleDateString('fa-IR')}</span>
                  </div>
                  <p>{comment.text}</p>
                </article>
              ))}
            </div>
          </section>
        </main>

        <aside className="book-buy-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">قیمت کتاب</p>
              {isFree ? (
                <p className="text-3xl font-black text-success">رایگان</p>
              ) : (
                <>
                  <p className="text-3xl font-black text-primary">{book.price.toLocaleString('fa-IR')} کردیت</p>
                  <p className="text-sm text-muted-foreground">{tomanPrice.toLocaleString('fa-IR')} تومان</p>
                </>
              )}
            </div>
            {purchased && <CheckCircle className="w-8 h-8 text-success" />}
          </div>

          {user && !isFree && !purchased && (
            <div className="mt-5 rounded-2xl bg-muted/45 p-4">
              <p className="text-sm text-muted-foreground">موجودی شما</p>
              <p className={`text-xl font-black ${canBuy ? 'text-success' : 'text-destructive'}`}>{balance.toLocaleString('fa-IR')} کردیت</p>
            </div>
          )}

          <div className="mt-5 grid gap-3">
            {canRead ? (
              <Link to={`/read/${book.id}`}>
                <Button className="w-full gap-2 rounded-xl shadow-glow">
                  <PlayCircle className="w-4 h-4" /> خواندن کتاب
                </Button>
              </Link>
            ) : user ? (
              <Button onClick={handleBuy} disabled={!canBuy || buying} className="w-full gap-2 rounded-xl shadow-glow">
                <ShoppingCart className="w-4 h-4" />
                {canBuy ? 'خرید کتاب' : 'اعتبار کافی نیست'}
              </Button>
            ) : (
              <Link to="/auth">
                <Button className="w-full gap-2 rounded-xl shadow-glow">
                  <ShoppingCart className="w-4 h-4" /> ورود برای خرید
                </Button>
              </Link>
            )}

            {book.preview_pages.length > 0 && (
              <Link to={`/read/${book.id}`}>
                <Button variant="outline" className="w-full gap-2 rounded-xl">
                  <Eye className="w-4 h-4" /> پیش‌نمایش رایگان
                </Button>
              </Link>
            )}
          </div>

          <div className="mt-5 space-y-3 border-t pt-5 text-sm text-muted-foreground">
            <div className="flex items-center justify-between"><span>ناشر</span><b className="text-foreground">{book.publisher_name}</b></div>
            <div className="flex items-center justify-between"><span>نویسنده</span><b className="text-foreground">{book.author || 'نویسنده نامشخص'}</b></div>
            <div className="flex items-center justify-between"><span>نوع اثر</span><b className="text-foreground">{book.book_type || 'تألیف'}</b></div>
            <div className="flex items-center justify-between"><span>دسته‌بندی</span><b className="text-foreground">{book.category}</b></div>
            <div className="flex items-center justify-between"><span>زبان</span><b className="text-foreground">{book.language === 'fa' ? 'فارسی' : 'English'}</b></div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function BookLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <div className="aspect-[3/4] animate-pulse rounded-2xl bg-muted/70" />
        <div className="space-y-5 py-4">
          <div className="h-7 w-32 animate-pulse rounded-lg bg-muted/70" />
          <div className="h-14 w-3/4 animate-pulse rounded-xl bg-muted/70" />
          <div className="h-5 w-1/2 animate-pulse rounded-lg bg-muted/60" />
          <div className="space-y-2 pt-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-4 animate-pulse rounded bg-muted/50" />)}</div>
        </div>
      </div>
    </div>
  )
}
