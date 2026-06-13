import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, BookOpen, CreditCard, Download, Headphones, Highlighter, MessageSquare, ShieldCheck, Sparkles, Store, UploadCloud, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BookCover } from '@/components/BookCover'
import { useAuthContext } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import type { MockBook } from '@/lib/mock-data'
import { getPopularBookIds, getPublishedBooks } from '@/lib/book-repository'

const categoryVisuals: Record<string, { icon: string; gradient: string; desc: string }> = {
  all: { icon: '✨', gradient: 'from-primary/20 to-secondary/20', desc: 'همه کتاب‌ها در یک نگاه' },
  ادبیات: { icon: '📜', gradient: 'from-amber-300/30 to-rose-300/30', desc: 'شعر، داستان و میراث فارسی' },
  علمی: { icon: '🔭', gradient: 'from-sky-300/30 to-violet-300/30', desc: 'دانش، فیزیک و جهان آینده' },
  'برنامه‌نویسی': { icon: '💻', gradient: 'from-emerald-300/30 to-cyan-300/30', desc: 'کدنویسی و تکنولوژی' },
  تاریخ: { icon: '🏛️', gradient: 'from-orange-300/30 to-stone-300/30', desc: 'سفر در زمان و تمدن‌ها' },
  آشپزی: { icon: '🍲', gradient: 'from-red-300/30 to-yellow-300/30', desc: 'طعم‌ها و دستورهای ایرانی' },
  'سبک زندگی': { icon: '🌿', gradient: 'from-green-300/30 to-teal-300/30', desc: 'زندگی بهتر و آرام‌تر' },
  هنر: { icon: '🎼', gradient: 'from-fuchsia-300/30 to-indigo-300/30', desc: 'موسیقی، تصویر و خلاقیت' },
}

export default function Landing() {
  const { user, signIn } = useAuthContext()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [books, setBooks] = useState<MockBook[]>([])
  const [popularIds, setPopularIds] = useState<string[]>([])
  const [loadingBooks, setLoadingBooks] = useState(true)

  useEffect(() => {
    Promise.all([getPublishedBooks(), getPopularBookIds()])
      .then(([published, ids]) => {
        setBooks(published)
        setPopularIds(ids)
      })
      .finally(() => setLoadingBooks(false))
  }, [])

  const categories = useMemo(() => {
    const values = Array.from(new Set(books.map(book => book.category).filter(Boolean)))
    return [{ key: 'all', label: 'همه کتاب‌ها' }, ...values.map(value => ({ key: value, label: value }))]
  }, [books])
  const freeBooks = books.filter(b => b.price === 0)
  const latestBooks = [...books].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 5)
  const popularBooks = popularIds.map(id => books.find(book => book.id === id)).filter(Boolean) as MockBook[]
  const suggestedBooks = books.filter(book => !popularIds.slice(0, 6).includes(book.id)).slice(0, 18)
  const heroBooks = books.slice(0, 4)
  const roles = user?.mockData?.roles || (user?.role ? [user.role] : [])
  const isPublisher = roles.includes('publisher') || roles.includes('admin') || roles.includes('super_admin')
  const isAdmin = roles.includes('admin') || roles.includes('super_admin')
  const memberLink = (path: string) => user ? path : '/auth'
  const testAccounts = [
    { label: 'کاربر آزمایشی ۱', email: 'reader1@metabooki.local' },
    { label: 'کاربر آزمایشی ۲', email: 'reader2@metabooki.local' },
    { label: 'ناشر آزمایشی', email: 'publisher@metabooki.local' },
  ]

  const quickLogin = async (email: string) => {
    const { error } = await signIn(email, 'test1234')
    if (error) toast.error(error.message)
    else {
      toast.success('ورود آزمایشی انجام شد')
      navigate(email.startsWith('publisher') ? '/publisher/me' : '/library')
    }
  }

  const BookCard = ({ book, compact = false, rail = false }: { book: MockBook; compact?: boolean; rail?: boolean }) => (
    <Link to={`/b/${book.id}`} className={`group menu-glass-70 rounded-2xl overflow-hidden hover:-translate-y-1 hover:shadow-book transition-all duration-300 ${compact ? 'flex gap-3 p-3' : 'block'} ${rail ? 'landing-rail-card' : ''}`}>
      <div className={compact ? 'w-20 aspect-[3/4] rounded-xl overflow-hidden bg-muted shrink-0' : 'aspect-[3/4] bg-muted overflow-hidden relative'}>
        <BookCover src={book.cover_url} title={book.title} category={book.category} className="w-full h-full" />
        {!compact && book.price === 0 && <span className="absolute top-2 right-2 bg-success text-success-foreground text-[10px] px-2 py-0.5 rounded-full">رایگان</span>}
      </div>
      <div className={compact ? 'flex-1 min-w-0' : 'p-4'}>
        <h3 className="font-bold text-sm line-clamp-2 group-hover:text-primary transition-colors">{book.title}</h3>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{book.author || 'نویسنده نامشخص'}</p>
        <div className="flex flex-wrap gap-1 mt-2">
          {book.tags.slice(0, 2).map(tag => <span key={tag} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{tag}</span>)}
        </div>
        <p className={`mt-2 text-xs font-bold ${book.price === 0 ? 'text-success' : 'text-primary'}`}>{book.price === 0 ? 'رایگان' : `${book.price.toLocaleString()} کردیت`}</p>
      </div>
    </Link>
  )

  return (
    <div className="min-h-[calc(100vh-4rem)] overflow-hidden">
      {/* Hero */}
      <section className="relative px-4 sm:px-6 lg:px-8 py-10 md:py-16">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,hsl(220_60%_55%/0.18),transparent_32%),radial-gradient(circle_at_80%_10%,hsl(215_50%_50%/0.16),transparent_28%),radial-gradient(circle_at_45%_85%,hsl(38_92%_50%/0.13),transparent_34%)]" />
        <div className="max-w-7xl mx-auto grid lg:grid-cols-[1fr_520px] gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 menu-glass-70 rounded-full px-4 py-2 text-sm text-primary mb-6">
              <Sparkles className="w-4 h-4" /> پلتفرم تعاملی نشر و خواندن کتاب
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-black font-display leading-tight mb-5">
              کتاب فقط خواندنی نیست؛ <span className="text-primary">تجربه‌کردنی</span> است
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed mb-8 max-w-2xl">
              متابوکی فروشگاه، کتابخانه و کتابخوان هوشمند فارسی است؛ با هایلایت، کامنت، AI، تایم‌لاین، استوری‌تلینگ و محتوای تعاملی.
            </p>
            <div className="flex flex-wrap gap-3 mb-8">
              <Link to="/store"><Button size="lg" className="gap-2 shadow-glow"><Store className="w-5 h-5" />ورود به فروشگاه</Button></Link>
              {!user && <Link to="/auth"><Button size="lg" variant="outline">شروع رایگان</Button></Link>}
            </div>
            <div className="grid grid-cols-3 gap-3 max-w-xl">
              {[
                { n: books.length, l: 'کتاب منتشرشده' },
                { n: Math.max(categories.length - 1, 0), l: 'دسته‌بندی' },
                { n: freeBooks.length, l: 'کتاب رایگان' },
              ].map(s => <div key={s.l} className="menu-glass-70 rounded-2xl p-2.5 sm:p-4 text-center"><p className="text-xl sm:text-2xl font-black text-primary">{s.n}</p><p className="text-[10px] sm:text-xs text-muted-foreground">{s.l}</p></div>)}
            </div>
          </div>

          <div className="relative min-h-[440px] hidden lg:block">
            {heroBooks.map((book, i) => (
              <Link key={book.id} to={`/b/${book.id}`} className={`absolute w-48 rounded-3xl overflow-hidden shadow-book transition-all hover:scale-105 ${i===0?'right-8 top-8 rotate-6 z-30':i===1?'left-16 top-0 -rotate-6 z-20':i===2?'right-0 bottom-12 -rotate-3 z-10': 'left-4 bottom-0 rotate-3 z-20'}`}>
                <BookCover src={book.cover_url} title={book.title} category={book.category} className="w-full aspect-[3/4]" />
              </Link>
            ))}
            <div className="absolute left-20 top-48 menu-glass-70 rounded-2xl p-4 z-40 max-w-56">
              <Zap className="w-6 h-6 text-primary mb-2" />
              <p className="font-bold text-sm">خواندن تعاملی</p>
              <p className="text-xs text-muted-foreground mt-1">هات‌اسپات، تایم‌لاین و استوری داخل کتاب‌ها</p>
            </div>
          </div>
        </div>
      </section>

      {!user && (
        <section className="px-4 pb-6 sm:px-6 lg:px-8">
          <div className="menu-glass-70 mx-auto flex max-w-7xl flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="font-bold">ورود سریع برای بررسی سایت</p>
              <p className="text-xs text-muted-foreground">یکی از نقش‌های آزمایشی را انتخاب کنید.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {testAccounts.map(account => (
                <Button key={account.email} variant="outline" size="sm" onClick={() => quickLogin(account.email)}>
                  {account.label}
                </Button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Category cards */}
      <section className="py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-6">
            <div><h2 className="text-2xl md:text-3xl font-black font-display">دنیای کتاب‌ها را انتخاب کن</h2><p className="text-sm text-muted-foreground mt-1">هر دسته با حال‌وهوای خودش</p></div>
            <Link to="/store" className="text-primary hover:underline text-sm flex items-center gap-1">همه دسته‌ها <ArrowLeft className="w-4 h-4" /></Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map(cat => {
              const v = categoryVisuals[cat.key] || categoryVisuals.all
              return (
                <Link key={cat.key} to={`/store?cat=${cat.key}`} className={`rounded-2xl sm:rounded-3xl p-3 sm:p-5 bg-gradient-to-br ${v.gradient} border border-border/60 hover:-translate-y-1 hover:shadow-book transition-all`}>
                  <div className="text-3xl mb-4">{v.icon}</div>
                  <h3 className="font-bold">{cat.label}</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{v.desc}</p>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      <section className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl md:text-3xl font-black font-display">محبوب‌ترین کتاب‌ها</h2>
              <p className="mt-1 text-sm text-muted-foreground">بیشترین انتخاب خوانندگان متابوکی</p>
            </div>
            <Link to="/store" className="text-primary hover:underline text-sm flex items-center gap-1">همه کتاب‌ها <ArrowLeft className="w-4 h-4" /></Link>
          </div>
          {loadingBooks ? (
            <div className="landing-book-grid">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="aspect-[3/5] animate-pulse rounded-2xl bg-muted/60" />)}</div>
          ) : (
            <div className="landing-book-grid">{popularBooks.slice(0, 6).map(book => <BookCard key={book.id} book={book} />)}</div>
          )}
        </div>
      </section>

      <section className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl md:text-3xl font-black font-display">پیشنهاد برای مطالعه بعدی</h2>
              <p className="mt-1 text-sm text-muted-foreground">برای دیدن کتاب‌های بیشتر، ردیف را به طرفین بکشید</p>
            </div>
            <Link to="/store" className="text-primary hover:underline text-sm flex items-center gap-1">رفتن به فروشگاه <ArrowLeft className="w-4 h-4" /></Link>
          </div>
          <div className="landing-book-rail">
            {suggestedBooks.map(book => <BookCard key={book.id} book={book} rail />)}
          </div>
        </div>
      </section>

      {/* Book rails */}
      <section className="py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-[1fr_360px] gap-8">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black font-display">کتاب‌های پیشنهادی امروز</h2>
              <Link to="/store" className="text-primary hover:underline text-sm flex items-center gap-1">مشاهده همه <ArrowLeft className="w-4 h-4" /></Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-5">
              {books.slice(0, 10).map(book => <BookCard key={book.id} book={book} />)}
            </div>
          </div>
          <aside className="space-y-5">
            <div className="menu-glass-70 rounded-3xl p-5">
              <h3 className="font-black mb-4 flex items-center gap-2"><BookOpen className="w-5 h-5 text-primary" />تازه‌ترین‌ها</h3>
              <div className="space-y-3">{latestBooks.map(book => <BookCard key={book.id} book={book} compact />)}</div>
            </div>
            <div className="menu-glass-70 rounded-3xl p-5">
              <h3 className="font-black mb-4">رایگان شروع کن</h3>
              <div className="space-y-3">{freeBooks.slice(0, 3).map(book => <BookCard key={book.id} book={book} compact />)}</div>
            </div>
          </aside>
        </div>
      </section>

      {/* Feature strip */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-4">
          {[
            { icon: <Highlighter className="w-6 h-6" />, title: 'هایلایت هوشمند', desc: 'رنگ ثابت، لیست اختصاصی و رفتن به صفحه' },
            { icon: <MessageSquare className="w-6 h-6" />, title: 'کامنت کتاب', desc: 'گفتگو با خوانندگان و کنترل ادمین' },
            { icon: <Sparkles className="w-6 h-6" />, title: 'دستیار AI', desc: 'خلاصه، پرسش و توضیح تکمیلی' },
            { icon: <Zap className="w-6 h-6" />, title: 'تعامل داخل کتاب', desc: 'تایم‌لاین، استوری و هات‌اسپات' },
          ].map(f => (
            <div key={f.title} className="menu-glass-70 rounded-3xl p-5">
              <div className="text-primary mb-3">{f.icon}</div>
              <h3 className="font-bold mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6"><h2 className="text-2xl font-black font-display">امکانات کامل پلتفرم</h2><p className="text-sm text-muted-foreground mt-1">مطابق نقشه راه متابوکی، همه مسیرهای اصلی در دسترس‌اند.</p></div>
          <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { icon: UploadCloud, title: 'تولید از Word', link: isPublisher ? '/upload' : '/auth' },
              { icon: Headphones, title: 'نسخه صوتی', link: isPublisher && heroBooks[0] ? `/audio-studio/${heroBooks[0].id}` : '/store' },
              { icon: CreditCard, title: 'کردیت و پرداخت', link: memberLink('/credits') },
              { icon: Download, title: 'نصب و آفلاین', link: '/install' },
              { icon: ShieldCheck, title: 'پنل ادمین', link: isAdmin ? '/admin' : '/auth' },
              { icon: BookOpen, title: 'داشبورد ناشر', link: isPublisher ? '/publisher/me' : '/auth' },
            ].map(item => (
              <Link key={item.title} to={item.link} className="menu-glass-70 rounded-2xl p-4 text-center hover:-translate-y-1 transition-all">
                <item.icon className="w-7 h-7 text-primary mx-auto mb-3" />
                <p className="text-sm font-bold">{item.title}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
