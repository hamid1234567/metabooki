/* eslint-disable @typescript-eslint/no-explicit-any */
import { Link, useNavigate } from 'react-router-dom'
import { BarChart3, BookOpen, CheckCircle, Eye, FileText, MessageSquare, Plus, RefreshCcw, Rocket, Settings, Share2, Store, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getPublisherBooks, type PublisherBook } from '@/lib/publisher-books'
import { canDeletePublisherBook, deletePublisherBookCompletely } from '@/lib/publisher-delete'
import { getAllComments } from '@/lib/mock-comments'
import metabookiMark from '@/assets/metabooki-mark.png'
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuthContext } from '@/lib/auth-context'

const stageMeta = {
  editing: { label: 'Ø¯Ø± Ø­Ø§Ù„ ÙˆÛŒØ±Ø§ÛŒØ´', className: 'bg-blue-500 text-white', icon: FileText },
  pricing: { label: 'Ù‚ÛŒÙ…Øª Ùˆ Ø³Ù‡Ø§Ù…', className: 'bg-amber-500 text-white', icon: Rocket },
  store: { label: 'Ø¯Ø± ÙØ±ÙˆØ´Ú¯Ø§Ù‡', className: 'bg-green-600 text-white', icon: Store },
  published: { label: 'Ø§Ù†ØªØ´Ø§Ø± Ù†Ù‡Ø§ÛŒÛŒ', className: 'bg-primary text-primary-foreground', icon: CheckCircle },
}

const appPath = (path: string) => `${window.location.origin}${import.meta.env.BASE_URL}#/${path.replace(/^\//, '')}`
const openBookPreview = (id: string) => window.open(appPath(`/read/${id}`), '_blank', 'noopener,noreferrer')

export default function Publisher() {
  const navigate = useNavigate()
  const { user } = useAuthContext()
  const [books, setBooks] = useState<PublisherBook[]>(() => getPublisherBooks())
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [remoteLoaded, setRemoteLoaded] = useState(false)
  const [remoteError, setRemoteError] = useState('')
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null)
  const comments = getAllComments()
  const totalReaders = books.reduce((sum, b) => sum + b.readers, 0)
  const inStore = books.filter(b => b.stage === 'store' || b.stage === 'published').length
  const ready = books.filter(b => b.stage === 'pricing').length
  const revenue = books.reduce((sum, b) => sum + b.revenue, 0)

  useEffect(() => {
    if (!user || !import.meta.env.VITE_SUPABASE_URL?.startsWith('http')) {
      setRemoteLoaded(true)
      return
    }
    let cancelled = false
    setRemoteLoading(true)
    setRemoteError('')
    ;(async () => {
      try {
        const ownPublisher = await (supabase as any).from('publisher_profiles').select('id').eq('user_id', user.id).maybeSingle()
        const roles = await (supabase as any).from('user_roles').select('role').eq('user_id', user.id)
        const isAdmin = roles.data?.some((item: { role: string }) => item.role === 'admin' || item.role === 'super_admin')
        let query = (supabase as any).from('books').select('*').order('created_at', { ascending: false })
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
          page_count: row.pages?.length || 0,
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
    const confirmed = window.confirm(`Ú©ØªØ§Ø¨ Â«${book.title}Â» Ùˆ Ù‡Ù…Ù‡ Ù…Ø­ØªÙˆØ§ÛŒ ÙˆØ§Ø¨Ø³ØªÙ‡ØŒ ÙØ§ÛŒÙ„â€ŒÙ‡Ø§ Ùˆ ØªØµØ§ÙˆÛŒØ± ÙˆØ§Ø±Ø¯Ø´Ø¯Ù‡ Ø­Ø°Ù Ø´ÙˆØ¯ØŸ Ø§ÛŒÙ† Ú©Ø§Ø± Ù‚Ø§Ø¨Ù„ Ø¨Ø±Ú¯Ø´Øª Ù†ÛŒØ³Øª.`)
    if (!confirmed) return
    setDeletingBookId(book.id)
    try {
      await deletePublisherBookCompletely(book, user?.id)
      setBooks(current => current.filter(item => item.id !== book.id))
    } catch (error) {
      console.error(error)
      window.alert(error instanceof Error ? error.message : 'Ø­Ø°Ù Ú©ØªØ§Ø¨ Ù†Ø§Ù…ÙˆÙÙ‚ Ø¨ÙˆØ¯.')
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
            <p className="text-sm text-muted-foreground">Ù…Ø±Ú©Ø² Ú©Ø§Ø±ÛŒ Ù†Ø§Ø´Ø±</p>
            <h1 className="text-4xl font-black font-display">Ù†Ø§Ø´Ø± ØªØ³Øª</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">Ø§ÙˆÙ„ Ù…Ø­ØªÙˆØ§ÛŒ Ú©ØªØ§Ø¨ Ø±Ø§ Ú©Ø§Ù…Ù„ Ú©Ù†ÛŒØ¯Ø› Ø³Ù¾Ø³ Ø§Ø² Ø¯Ú©Ù…Ù‡â€ŒÙ‡Ø§ÛŒ Â«ÙˆÛŒØ±Ø§ÛŒØ´ Ù…ØªÙ† Ùˆ Ù…Ø­ØªÙˆØ§Â»ØŒ Â«Ù‚ÛŒÙ…ØªØŒ Ø³Ù‡Ø§Ù… Ùˆ Ø§Ù†ØªØ´Ø§Ø±Â» ÙˆØ§Ø±Ø¯ Ù…Ø±Ø§Ø­Ù„ Ø¨Ø¹Ø¯ Ø´ÙˆÛŒØ¯.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="gap-2"><Share2 className="w-4 h-4" />ÙˆÛŒØªØ±ÛŒÙ† Ø¹Ù…ÙˆÙ…ÛŒ</Button>
          <Link to="/publisher/me/settings"><Button variant="outline" className="gap-2"><Settings className="w-4 h-4" />ØªÙ†Ø¸ÛŒÙ…Ø§Øª</Button></Link>
          <Link to="/upload"><Button className="gap-2 shadow-glow"><Plus className="w-4 h-4" />Ú©ØªØ§Ø¨ Ø¬Ø¯ÛŒØ¯</Button></Link>
        </div>
      </section>

      <section className="grid md:grid-cols-4 gap-5">
        {[
          { label: 'Ú©Ù„', value: books.length, icon: BookOpen },
          { label: 'Ø¯Ø± ÙØ±ÙˆØ´Ú¯Ø§Ù‡', value: inStore, icon: CheckCircle },
          { label: 'Ø¢Ù…Ø§Ø¯Ù‡â€ŒØ³Ø§Ø²ÛŒ', value: ready, icon: FileText },
          { label: 'Ø®ÙˆØ§Ù†Ù†Ø¯Ú¯Ø§Ù†', value: totalReaders, icon: Users },
        ].map(card => <div key={card.label} className="menu-glass-70 rounded-2xl p-6"><card.icon className="w-7 h-7 text-primary mb-4" /><p className="text-3xl font-black">{card.value.toLocaleString('fa-IR')}</p><p className="text-sm text-muted-foreground mt-1">{card.label}</p></div>)}
      </section>

      <section className="menu-glass-70 rounded-2xl p-5 grid md:grid-cols-3 gap-4">
        {[
          { n: 1, title: 'ÙˆÛŒØ±Ø§ÛŒØ´ Ù…Ø­ØªÙˆØ§', desc: 'Ù…ØªÙ†ØŒ ÙØµÙ„â€ŒÙ‡Ø§ØŒ ØªØµØ§ÙˆÛŒØ± Ùˆ Ù…Ø­ØªÙˆØ§ÛŒ ØªØ¹Ø§Ù…Ù„ÛŒ Ú©ØªØ§Ø¨ Ø±Ø§ Ø¨Ø§Ø² Ú©Ù†ÛŒØ¯.' },
          { n: 2, title: 'Ù‚ÛŒÙ…Øª Ùˆ Ø³Ù‡Ø§Ù…', desc: 'Ù‚ÛŒÙ…Øªâ€ŒÚ¯Ø°Ø§Ø±ÛŒØŒ Ø³Ù‡Ù…â€ŒØ¨Ù†Ø¯ÛŒ Ùˆ ÙˆØ¶Ø¹ÛŒØª ÙØ±ÙˆØ´Ú¯Ø§Ù‡ Ø±Ø§ ØªÙ†Ø¸ÛŒÙ… Ú©Ù†ÛŒØ¯.' },
          { n: 3, title: 'Ø§Ù†ØªØ´Ø§Ø± Ù†Ù‡Ø§ÛŒÛŒ', desc: 'Ø¨Ø¹Ø¯ Ø§Ø² Ø°Ø®ÛŒØ±Ù‡ Ùˆ Ù¾ÛŒØ´â€ŒÙ†Ù…Ø§ÛŒØ´ØŒ Ø§Ù†ØªØ´Ø§Ø± Ù†Ù‡Ø§ÛŒÛŒ ÙØ¹Ø§Ù„ Ù…ÛŒâ€ŒØ´ÙˆØ¯.' },
        ].map((s, i) => <div key={s.n} className="flex items-start gap-3"><span className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold ${i===0?'bg-blue-500':i===1?'bg-amber-500':'bg-green-600'}`}>{s.n}</span><div><h3 className="font-bold">{s.title}</h3><p className="text-sm text-muted-foreground">{s.desc}</p></div></div>)}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black font-display">Ú©ØªØ§Ø¨â€ŒÙ‡Ø§ÛŒ Ù…Ù†</h2>
          <div className="text-sm text-muted-foreground">Ø¯Ø±Ø¢Ù…Ø¯ Ù†Ù…ÙˆÙ†Ù‡: <b className="text-primary">{revenue.toLocaleString('fa-IR')}</b> Ú©Ø±Ø¯ÛŒØª</div>
        </div>
        {books.map(book => {
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
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-3"><span>ðŸ‘ {book.readers} Ø®ÙˆØ§Ù†Ù†Ø¯Ù‡</span><span>ðŸ›’ {book.sales} ÙØ±ÙˆØ´</span><span>ðŸ’¬ {commentsCount} Ù†Ø¸Ø±</span><span>{book.price === 0 ? 'Ø±Ø§ÛŒÚ¯Ø§Ù†' : `${book.price} Ú©Ø±Ø¯ÛŒØª`}</span></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-background/50 p-3"><p className="font-bold">{book.readers}</p><p className="text-[10px] text-muted-foreground">Ø®ÙˆØ§Ù†Ù†Ø¯Ù‡</p></div>
                      <div className="rounded-xl bg-background/50 p-3"><p className="font-bold">{book.sales}</p><p className="text-[10px] text-muted-foreground">ÙØ±ÙˆØ´</p></div>
                      <div className="rounded-xl bg-background/50 p-3"><p className="font-bold">{book.revenue}</p><p className="text-[10px] text-muted-foreground">Ø³Ù‡Ù… Ø´Ù…Ø§</p></div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-auto">
                    <Button onClick={() => navigate(`/edit/${book.id}`)} className="gap-2 flex-1 sm:min-w-56"><FileText className="w-4 h-4" />ÙˆÛŒØ±Ø§ÛŒØ´ Ù…ØªÙ† Ùˆ Ù…Ø­ØªÙˆØ§</Button>
                    <Button onClick={() => navigate(`/publish/${book.id}`)} className="gap-2 bg-amber-500 hover:bg-amber-600 flex-1 sm:min-w-56"><Rocket className="w-4 h-4" />Ù‚ÛŒÙ…ØªØŒ Ø³Ù‡Ø§Ù… Ùˆ Ø§Ù†ØªØ´Ø§Ø±</Button>
                    <Button variant="outline" onClick={() => openBookPreview(book.id)} className="gap-2"><Eye className="w-4 h-4" />Ù¾ÛŒØ´â€ŒÙ†Ù…Ø§ÛŒØ´</Button>
                    <Button variant="outline" className="gap-2"><MessageSquare className="w-4 h-4" />Ù†Ø¸Ø±Ø§Øª</Button>
                    <Button variant="outline" disabled={!book.metadata?.import_project_id} onClick={() => reconvert(book)} className="gap-2"><RefreshCcw className="w-4 h-4" />ØªØ¨Ø¯ÛŒÙ„ Ù…Ø¬Ø¯Ø¯ Ø§Ø² ÙØ§ÛŒÙ„ Ø³Ø±ÙˆØ±</Button>
                    {canDelete && <Button variant="ghost" disabled={deletingBookId === book.id} onClick={() => removeBook(book)} className="text-destructive"><Trash2 className="w-4 h-4" />{deletingBookId === book.id ? 'Ø¯Ø± Ø­Ø§Ù„ Ø­Ø°Ù...' : ''}</Button>}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </section>

      <section className="grid md:grid-cols-3 gap-5">
        {[
          { icon: BarChart3, title: 'Ø¢Ù…Ø§Ø± ÙØ±ÙˆØ´', desc: 'Ù†Ù…ÙˆØ¯Ø§Ø±Ù‡Ø§ÛŒ ÙØ±ÙˆØ´ØŒ Ø®ÙˆØ§Ù†Ø¯Ù‡â€ŒØ´Ø¯Ù† Ùˆ Ø¯Ø±Ø¢Ù…Ø¯ Ù‡Ø± Ú©ØªØ§Ø¨.' },
          { icon: MessageSquare, title: 'Ù…Ø¯ÛŒØ±ÛŒØª Ø¯ÛŒØ¯Ú¯Ø§Ù‡', desc: 'Ø¯ÛŒØ¯Ú¯Ø§Ù‡â€ŒÙ‡Ø§ÛŒ Ú©Ø§Ø±Ø¨Ø±Ø§Ù† Ø±Ø§ Ø¨Ø±Ø±Ø³ÛŒØŒ Ù…Ø®ÙÛŒ ÛŒØ§ Ù¾Ø§Ø³Ø® Ø¯Ù‡ÛŒØ¯.' },
          { icon: Store, title: 'ÙˆÛŒØªØ±ÛŒÙ† Ù†Ø§Ø´Ø±', desc: 'ØµÙØ­Ù‡ Ø¹Ù…ÙˆÙ…ÛŒ Ù†Ø§Ø´Ø± Ùˆ Ø¨Ø±Ù†Ø¯ÛŒÙ†Ú¯ Ø§Ø®ØªØµØ§ØµÛŒ Ø´Ù…Ø§.' },
        ].map(f => <div key={f.title} className="menu-glass-70 rounded-2xl p-6"><f.icon className="w-7 h-7 text-primary mb-3" /><h3 className="font-bold">{f.title}</h3><p className="text-sm text-muted-foreground mt-1">{f.desc}</p></div>)}
      </section>
    </div>
  )
}
