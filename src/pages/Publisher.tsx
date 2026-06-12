import { Link, useNavigate } from 'react-router-dom'
import { BarChart3, BookOpen, CheckCircle, Eye, FileText, MessageSquare, Plus, RefreshCcw, Rocket, Settings, Share2, Store, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deletePublisherBook, getPublisherBooks, type PublisherBook } from '@/lib/publisher-books'
import { getAllComments } from '@/lib/mock-comments'
import metabookiMark from '@/assets/metabooki-mark.svg'
import { useState } from 'react'

const stageMeta = {
  editing: { label: 'در حال ویرایش', className: 'bg-blue-500 text-white', icon: FileText },
  pricing: { label: 'قیمت و سهام', className: 'bg-amber-500 text-white', icon: Rocket },
  store: { label: 'در فروشگاه', className: 'bg-green-600 text-white', icon: Store },
  published: { label: 'انتشار نهایی', className: 'bg-primary text-primary-foreground', icon: CheckCircle },
}

export default function Publisher() {
  const navigate = useNavigate()
  const [books, setBooks] = useState<PublisherBook[]>(() => getPublisherBooks())
  const comments = getAllComments()
  const totalReaders = books.reduce((sum, b) => sum + b.readers, 0)
  const inStore = books.filter(b => b.stage === 'store' || b.stage === 'published').length
  const ready = books.filter(b => b.stage === 'pricing').length
  const revenue = books.reduce((sum, b) => sum + b.revenue, 0)

  const removeBook = (id: string) => {
    deletePublisherBook(id)
    setBooks(getPublisherBooks())
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
        ].map(card => <div key={card.label} className="menu-glass-70 rounded-2xl p-6"><card.icon className="w-7 h-7 text-primary mb-4" /><p className="text-3xl font-black">{card.value.toLocaleString('fa-IR')}</p><p className="text-sm text-muted-foreground mt-1">{card.label}</p></div>)}
      </section>

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
          <div className="text-sm text-muted-foreground">درآمد نمونه: <b className="text-primary">{revenue.toLocaleString('fa-IR')}</b> کردیت</div>
        </div>
        {books.map(book => {
          const meta = stageMeta[book.stage]
          const commentsCount = comments.filter(c => c.bookId === book.id).length
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
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-3"><span>👁 {book.readers} خواننده</span><span>🛒 {book.sales} فروش</span><span>💬 {commentsCount} نظر</span><span>{book.price === 0 ? 'رایگان' : `${book.price} کردیت`}</span></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-background/50 p-3"><p className="font-bold">{book.readers}</p><p className="text-[10px] text-muted-foreground">خواننده</p></div>
                      <div className="rounded-xl bg-background/50 p-3"><p className="font-bold">{book.sales}</p><p className="text-[10px] text-muted-foreground">فروش</p></div>
                      <div className="rounded-xl bg-background/50 p-3"><p className="font-bold">{book.revenue}</p><p className="text-[10px] text-muted-foreground">سهم شما</p></div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-auto">
                    <Button onClick={() => navigate(`/edit/${book.id}`)} className="gap-2 flex-1 sm:min-w-56"><FileText className="w-4 h-4" />ویرایش متن و محتوا</Button>
                    <Button onClick={() => navigate(`/publish/${book.id}`)} className="gap-2 bg-amber-500 hover:bg-amber-600 flex-1 sm:min-w-56"><Rocket className="w-4 h-4" />قیمت، سهام و انتشار</Button>
                    <Button variant="outline" onClick={() => navigate(`/read/${book.id}`)} className="gap-2"><Eye className="w-4 h-4" />پیش‌نمایش</Button>
                    <Button variant="outline" className="gap-2"><MessageSquare className="w-4 h-4" />نظرات</Button>
                    <Button variant="outline" className="gap-2"><RefreshCcw className="w-4 h-4" />تبدیل مجدد</Button>
                    <Button variant="ghost" onClick={() => removeBook(book.id)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
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
