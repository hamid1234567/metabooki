import { Fragment, useEffect, useMemo, useState } from 'react'
import { useAuthContext } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import { mockUsers, mockBooks, CREDIT_VALUE_TOMAN, setCreditValue } from '@/lib/mock-data'
import { Shield, Users, Activity, BookOpen, DollarSign, Settings, Bug, MessageSquare, Eye, EyeOff, Trash2, Sparkles, KeyRound, Server, CheckCircle, AlertTriangle, RefreshCw, ExternalLink, Filter, Edit3, Mail, Receipt, Clock3, LibraryBig, Search, ShoppingCart, TrendingUp, Wallet, BarChart3, CreditCard, ArrowUpDown } from 'lucide-react'
import { deleteComment, getAllComments, updateCommentStatus, type MockComment } from '@/lib/mock-comments'
import { Button } from '@/components/ui/button'
import { loadAiGatewaySettings, loadAiGatewaySettingsRemote, maskApiKey, saveAiGatewaySettings, testAiProvider, type AiGatewaySettings, type AiProviderConfig } from '@/lib/ai-gateway'
import { useRoles } from '@/hooks/useRoles'
import { supabase } from '@/integrations/supabase/client'
import { emptyFilterSettings, loadBookFilterSettings, parseFilterLines, saveBookFilterSettings, type BookFilterSettings } from '@/lib/filter-settings'
import { listAdminUsers, sendAdminPasswordReset, setAdminUserPassword, type AdminUserRow } from '@/lib/admin-users'
import { getAllReadingProgress, getMockLibraryEntries } from '@/lib/mock-library'

export default function Admin() {
  const { t } = useI18n()
  const { user } = useAuthContext()
  const { isAdmin, loading: rolesLoading } = useRoles(user)
  const [tab, setTab] = useState<'dashboard' | 'users' | 'treasury' | 'books' | 'comments' | 'ai' | 'settings'>('dashboard')
  const [creditVal, setCreditVal] = useState(CREDIT_VALUE_TOMAN)
  const [message, setMessage] = useState('')
  const [comments, setComments] = useState<MockComment[]>(() => getAllComments())
  const [aiSettings, setAiSettings] = useState<AiGatewaySettings>(() => loadAiGatewaySettings())
  const [connectionTest, setConnectionTest] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [connectionMessage, setConnectionMessage] = useState('')
  const [aiProviderTests, setAiProviderTests] = useState<Record<string, { state: 'idle' | 'testing' | 'ok' | 'error'; message: string; sample?: string }>>({})
  const [filterSettings, setFilterSettings] = useState<BookFilterSettings>(emptyFilterSettings)
  const [filterDraft, setFilterDraft] = useState({ categories: '', tags: '', bookTypes: '' })
  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [selectedUserEmail, setSelectedUserEmail] = useState('mohammadi219@gmail.com')
  const [newUserPassword, setNewUserPassword] = useState('Hamid@219')
  const [passwordActionLoading, setPasswordActionLoading] = useState(false)
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [rowPasswordDrafts, setRowPasswordDrafts] = useState<Record<string, string>>({})
  const [adminBookQuery, setAdminBookQuery] = useState('')
  const [adminBookStatusFilter, setAdminBookStatusFilter] = useState<'all' | 'published' | 'draft' | 'pending'>('all')
  const [adminBookSort, setAdminBookSort] = useState<'sales' | 'revenue' | 'date' | 'title'>('sales')
  const [adminUserQuery, setAdminUserQuery] = useState('')
  const [adminTransactionFilter, setAdminTransactionFilter] = useState<'all' | 'purchase' | 'ai' | 'topup'>('all')
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '')
  const hasSupabaseUrl = supabaseUrl.startsWith('https://') && !supabaseUrl.includes('your_supabase')
  const hasSupabaseKey = Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY && !String(import.meta.env.VITE_SUPABASE_ANON_KEY).includes('your_supabase'))
  const projectRef = hasSupabaseUrl ? supabaseUrl.replace('https://', '').split('.')[0] : ''

  useEffect(() => {
    if (!isAdmin || user?.mockData) return
    loadAiGatewaySettingsRemote().then(setAiSettings).catch(error => setMessage(error instanceof Error ? error.message : 'خطا در دریافت تنظیمات AI'))
  }, [isAdmin, user])

  useEffect(() => {
    if (!isAdmin) return
    loadBookFilterSettings().then(settings => {
      setFilterSettings(settings)
      setFilterDraft({
        categories: settings.categories.join('\n'),
        tags: settings.tags.join('\n'),
        bookTypes: settings.bookTypes.join('\n'),
      })
    })
  }, [isAdmin])

  const refreshAdminUsers = async () => {
    setUsersLoading(true)
    try {
      const users = await listAdminUsers()
      setAdminUsers(users)
      if (!selectedUserEmail && users[0]?.email) setSelectedUserEmail(users[0].email)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'دریافت لیست کاربران ناموفق بود.')
    } finally {
      setUsersLoading(false)
    }
  }

  useEffect(() => {
    if (!isAdmin || tab !== 'users') return
    void refreshAdminUsers()
  }, [isAdmin, tab])

  if (rolesLoading) return null
  if (!isAdmin) {
    return <div className="max-w-4xl mx-auto px-4 py-20 text-center"><Shield className="w-16 h-16 text-muted-foreground mx-auto mb-4" /><h1 className="text-2xl font-bold">دسترسی محدود</h1><p className="text-muted-foreground">فقط مدیران به این بخش دسترسی دارند</p></div>
  }

  const tabs = [
    { key: 'dashboard' as const, label: 'داشبورد', icon: Activity },
    { key: 'users' as const, label: 'کاربران', icon: Users },
    { key: 'treasury' as const, label: 'خزانه', icon: DollarSign },
    { key: 'books' as const, label: 'کتاب‌ها', icon: BookOpen },
    { key: 'comments' as const, label: 'کامنت‌ها', icon: MessageSquare },
    { key: 'ai' as const, label: 'هوش مصنوعی', icon: Sparkles },
    { key: 'settings' as const, label: 'تنظیمات', icon: Settings },
  ]

  const saveCreditSetting = () => {
    setCreditValue(creditVal)
    setMessage('✅ تنظیمات با موفقیت ذخیره شد')
    setTimeout(() => setMessage(''), 3000)
  }

  const updateAiProvider = (providerId: AiProviderConfig['id'], patch: Partial<AiProviderConfig>) => {
    setAiSettings(current => ({
      ...current,
      providers: current.providers.map(provider => provider.id === providerId ? { ...provider, ...patch } : provider),
    }))
  }

  const saveAiSettings = async () => {
    try {
      await saveAiGatewaySettings(aiSettings)
      setMessage('تنظیمات هوش مصنوعی با امنیت کامل روی سرور ذخیره شد')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ذخیره تنظیمات ناموفق بود')
    }
    setTimeout(() => setMessage(''), 3000)
  }

  const runAiProviderTest = async (provider: AiProviderConfig) => {
    setAiProviderTests(current => ({ ...current, [provider.id]: { state: 'testing', message: 'در حال تست کلید و مدل...' } }))
    try {
      const result = await testAiProvider(provider)
      setAiProviderTests(current => ({
        ...current,
        [provider.id]: { state: 'ok', message: `${result.message} (${result.provider} / ${result.model})`, sample: result.sample },
      }))
    } catch (error) {
      setAiProviderTests(current => ({
        ...current,
        [provider.id]: { state: 'error', message: error instanceof Error ? error.message : 'تست کلید ناموفق بود.' },
      }))
    }
  }

  const saveFilterOptions = async () => {
    const next = {
      categories: parseFilterLines(filterDraft.categories),
      tags: parseFilterLines(filterDraft.tags),
      bookTypes: parseFilterLines(filterDraft.bookTypes),
    }
    try {
      await saveBookFilterSettings(next)
      setFilterSettings(next)
      setMessage('گزینه‌های فیلتر کتاب ذخیره شد.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ذخیره گزینه‌های فیلتر ناموفق بود.')
    }
    setTimeout(() => setMessage(''), 3000)
  }

  const fillFiltersFromBooks = () => {
    const categories = Array.from(new Set(mockBooks.map(book => book.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fa'))
    const tags = Array.from(new Set(mockBooks.flatMap(book => book.tags || []).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fa'))
    const bookTypes = Array.from(new Set(mockBooks.map(book => book.book_type || 'تألیف').filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fa'))
    setFilterDraft({
      categories: categories.join('\n'),
      tags: tags.join('\n'),
      bookTypes: bookTypes.join('\n'),
    })
  }

  const testSupabaseConnection = async () => {
    if (!hasSupabaseUrl || !hasSupabaseKey) {
      setConnectionTest('error')
      setConnectionMessage('ابتدا Project URL و Publishable Key را در فایل .env وارد و سرور را دوباره اجرا کنید.')
      return
    }
    setConnectionTest('testing')
    setConnectionMessage('')
    try {
      const { error } = await supabase.from('books').select('id', { count: 'exact', head: true })
      if (error) throw error
      setConnectionTest('ok')
      setConnectionMessage('اتصال دیتابیس برقرار است و جدول books قابل دسترسی است.')
    } catch (error) {
      setConnectionTest('error')
      setConnectionMessage(error instanceof Error ? error.message : 'اتصال به Supabase ناموفق بود.')
    }
  }

  const changePasswordForUser = async (email: string, password: string) => {
    if (!email.trim()) {
      setMessage('ایمیل کاربر را انتخاب یا وارد کنید.')
      return
    }
    if (password.length < 8) {
      setMessage('رمز عبور باید حداقل ۸ کاراکتر باشد.')
      return
    }
    setPasswordActionLoading(true)
    try {
      await setAdminUserPassword(email.trim(), password)
      setMessage(`رمز عبور ${email.trim()} به‌روزرسانی شد.`)
      await refreshAdminUsers()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تغییر رمز عبور ناموفق بود.')
    } finally {
      setPasswordActionLoading(false)
      setTimeout(() => setMessage(''), 5000)
    }
  }

  const changeUserPasswordFromAdmin = async () => {
    await changePasswordForUser(selectedUserEmail, newUserPassword)
  }

  const sendPasswordResetForUser = async (email: string) => {
    if (!email.trim()) {
      setMessage('ایمیل کاربر را انتخاب یا وارد کنید.')
      return
    }
    setPasswordActionLoading(true)
    try {
      const result = await sendAdminPasswordReset(email.trim()) as { actionLink?: string }
      setMessage(result?.actionLink ? `لینک ریست ساخته شد: ${result.actionLink}` : `لینک ریست برای ${email.trim()} آماده/ارسال شد.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ارسال لینک ریست ناموفق بود.')
    } finally {
      setPasswordActionLoading(false)
      setTimeout(() => setMessage(''), 8000)
    }
  }

  const sendPasswordResetFromAdmin = async () => {
    await sendPasswordResetForUser(selectedUserEmail)
  }

  const commentBookTitle = (bookId: string) => mockBooks.find(b => b.id === bookId)?.title || bookId
  const adminUserRows = useMemo(() => (
    adminUsers.length ? adminUsers : mockUsers.map(u => ({ id: u.id, email: u.email, displayName: u.display_name, roles: u.roles, credits: u.credits, phone: u.phone }))
  ), [adminUsers])
  const purchaseRows = useMemo(() => mockUsers.flatMap(mockUser => getMockLibraryEntries(mockUser.id).map(entry => ({
    ...entry,
    userId: mockUser.id,
    userName: mockUser.display_name,
    userEmail: mockUser.email,
    book: mockBooks.find(book => book.id === entry.bookId),
  }))), [])
  const userProgressRows = useMemo(() => mockUsers.flatMap(mockUser => Object.values(getAllReadingProgress(mockUser.id)).map(progress => ({
    ...progress,
    userId: mockUser.id,
    userName: mockUser.display_name,
    book: mockBooks.find(book => book.id === progress.bookId),
  }))), [])
  const bookMetrics = useMemo(() => mockBooks.map(book => {
    const purchases = purchaseRows.filter(row => row.bookId === book.id)
    const bookComments = comments.filter(comment => comment.bookId === book.id)
    const revenueCredits = purchases.reduce((sum, row) => sum + Number(row.price || 0), 0)
    return {
      book,
      sales: purchases.length,
      revenueCredits,
      revenueToman: revenueCredits * CREDIT_VALUE_TOMAN,
      comments: bookComments.length,
      hiddenComments: bookComments.filter(comment => comment.status !== 'visible').length,
      readers: userProgressRows.filter(row => row.bookId === book.id).length,
    }
  }), [comments, purchaseRows, userProgressRows])
  const totalBooks = mockBooks.length
  const totalUsers = adminUserRows.length
  const publishedBooks = mockBooks.filter(b => b.status === 'published').length
  const draftBooks = mockBooks.filter(b => b.status !== 'published').length
  const pendingBooks = mockBooks.filter(b => b.review_status === 'pending').length
  const freeBooks = mockBooks.filter(b => b.price === 0).length
  const paidBooks = publishedBooks - freeBooks
  const totalRevenueCredits = purchaseRows.reduce((sum, row) => sum + Number(row.price || 0), 0)
  const totalRevenueToman = totalRevenueCredits * CREDIT_VALUE_TOMAN
  const totalUserCredits = adminUserRows.reduce((sum, row) => sum + Number(row.credits || 0), 0)
  const lowCreditUsers = adminUserRows.filter(row => Number(row.credits || 0) < 500).length
  const visibleComments = comments.filter(comment => comment.status === 'visible').length
  const hiddenComments = comments.length - visibleComments
  const enabledAiProviders = aiSettings.providers.filter(provider => provider.enabled).length
  const configuredAiProviders = aiSettings.providers.filter(provider => provider.apiKey || provider.id === aiSettings.activeProvider).length
  const filteredBookMetrics = bookMetrics
    .filter(item => adminBookStatusFilter === 'all' ? true : adminBookStatusFilter === 'pending' ? item.book.review_status === 'pending' : item.book.status === adminBookStatusFilter)
    .filter(item => !adminBookQuery.trim() || `${item.book.title} ${item.book.author || ''} ${item.book.publisher_name || ''} ${item.book.category || ''}`.toLowerCase().includes(adminBookQuery.trim().toLowerCase()))
    .sort((a, b) => adminBookSort === 'sales' ? b.sales - a.sales : adminBookSort === 'revenue' ? b.revenueCredits - a.revenueCredits : adminBookSort === 'date' ? +new Date(b.book.created_at) - +new Date(a.book.created_at) : a.book.title.localeCompare(b.book.title, 'fa'))
  const filteredUsers = adminUserRows.filter(row => !adminUserQuery.trim() || `${row.displayName || ''} ${row.email || ''} ${(row.roles || []).join(' ')}`.toLowerCase().includes(adminUserQuery.trim().toLowerCase()))
  const transactionRows = [
    ...purchaseRows.map(row => ({ id: `purchase-${row.userId}-${row.bookId}`, type: 'purchase' as const, title: 'خرید کتاب', user: row.userName, detail: row.book?.title || row.bookId, amount: -Number(row.price || 0), date: row.purchasedAt })),
    ...comments.slice(0, 8).map(comment => ({ id: `comment-${comment.id}`, type: 'comment' as const, title: 'دیدگاه کاربر', user: comment.displayName, detail: commentBookTitle(comment.bookId), amount: 0, date: comment.createdAt })),
    ...aiSettings.providers.filter(provider => provider.enabled).map(provider => ({ id: `ai-${provider.id}`, type: 'ai' as const, title: 'ارائه‌دهنده AI فعال', user: provider.label, detail: provider.model, amount: 0, date: new Date().toISOString() })),
  ].filter(row => adminTransactionFilter === 'all' ? true : adminTransactionFilter === 'purchase' ? row.type === 'purchase' : adminTransactionFilter === 'ai' ? row.type === 'ai' : false)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
  const topBooks = [...bookMetrics].sort((a, b) => b.sales - a.sales || b.revenueCredits - a.revenueCredits).slice(0, 5)
  const categoryStats = Array.from(new Set(mockBooks.map(book => book.category || 'بدون دسته'))).map(category => ({
    category,
    count: mockBooks.filter(book => (book.category || 'بدون دسته') === category).length,
    revenue: bookMetrics.filter(item => (item.book.category || 'بدون دسته') === category).reduce((sum, item) => sum + item.revenueCredits, 0),
  })).sort((a, b) => b.count - a.count)

  const refreshComments = () => setComments(getAllComments())

  const setCommentVisibility = (id: string, visible: boolean) => {
    updateCommentStatus(id, visible ? 'visible' : 'hidden')
    refreshComments()
  }

  const removeComment = (id: string) => {
    deleteComment(id)
    refreshComments()
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold font-display">{t('admin_dashboard')}</h1>
      </div>

      {/* Tab Navigation */}
      <div className="admin-tabs flex gap-2 mb-8 overflow-x-auto pb-2">
        {tabs.map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`flex shrink-0 items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === tb.key ? 'bg-primary text-primary-foreground' : 'menu-glass-70 hover:bg-muted'}`}>
            <tb.icon className="w-4 h-4" />{tb.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { icon: Users, title: 'کاربران', value: totalUsers.toLocaleString('fa-IR'), meta: `${lowCreditUsers.toLocaleString('fa-IR')} کاربر کم‌اعتبار`, tone: 'text-primary' },
              { icon: BookOpen, title: 'کتاب‌ها', value: totalBooks.toLocaleString('fa-IR'), meta: `${publishedBooks.toLocaleString('fa-IR')} منتشر شده · ${draftBooks.toLocaleString('fa-IR')} پیش‌نویس`, tone: 'text-primary' },
              { icon: ShoppingCart, title: 'فروش ثبت‌شده', value: purchaseRows.length.toLocaleString('fa-IR'), meta: `${totalRevenueCredits.toLocaleString('fa-IR')} کردیت`, tone: 'text-success' },
              { icon: DollarSign, title: 'درآمد تخمینی', value: totalRevenueToman.toLocaleString('fa-IR'), meta: 'تومان بر اساس خریدهای ثبت‌شده', tone: 'text-warning' },
            ].map(item => <div key={item.title} className="glass rounded-2xl p-6"><item.icon className={`w-8 h-8 ${item.tone} mb-3`} /><p className="text-3xl font-black">{item.value}</p><p className="text-sm font-bold mt-1">{item.title}</p><p className="text-xs text-muted-foreground mt-2">{item.meta}</p></div>)}
          </div>

          <div className="grid xl:grid-cols-[1.4fr_1fr] gap-6">
            <section className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between gap-4 mb-5">
                <h2 className="font-bold text-lg flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" />نمای کلی سامانه</h2>
                <span className="text-xs rounded-full bg-primary/10 text-primary px-3 py-1">۱ کردیت = {CREDIT_VALUE_TOMAN.toLocaleString('fa-IR')} تومان</span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  ['کتاب رایگان', freeBooks],
                  ['کتاب پولی', paidBooks],
                  ['در انتظار بررسی', pendingBooks],
                  ['کامنت قابل نمایش', visibleComments],
                  ['کامنت مخفی', hiddenComments],
                  ['ارائه‌دهنده AI فعال', enabledAiProviders],
                  ['کل کردیت کاربران', totalUserCredits],
                  ['خوانش‌های ثبت‌شده', userProgressRows.length],
                  ['کلیدهای AI تنظیم‌شده', configuredAiProviders],
                ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border bg-background/55 p-4"><p className="text-xs text-muted-foreground">{label}</p><strong className="mt-1 block text-2xl">{Number(value).toLocaleString('fa-IR')}</strong></div>)}
              </div>
            </section>

            <section className="glass rounded-2xl p-6">
              <h2 className="font-bold text-lg flex items-center gap-2 mb-4"><AlertTriangle className="w-5 h-5 text-warning" />نیازمند توجه</h2>
              <div className="space-y-3 text-sm">
                {[
                  { label: 'کتاب‌های در انتظار بررسی', value: pendingBooks, action: 'تب کتاب‌ها' },
                  { label: 'کاربران کم‌اعتبار', value: lowCreditUsers, action: 'تب کاربران' },
                  { label: 'کامنت‌های مخفی/نیازمند رسیدگی', value: hiddenComments, action: 'تب کامنت‌ها' },
                  { label: 'Providerهای AI غیرفعال', value: aiSettings.providers.length - enabledAiProviders, action: 'تب هوش مصنوعی' },
                ].map(item => <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl bg-background/55 p-3"><span>{item.label}</span><b className={item.value ? 'text-warning' : 'text-success'}>{item.value.toLocaleString('fa-IR')}</b><small className="text-muted-foreground">{item.action}</small></div>)}
              </div>
            </section>
          </div>

          <div className="grid xl:grid-cols-[1fr_1fr_1fr] gap-6">
            <section className="glass rounded-2xl p-6">
              <h2 className="font-bold text-lg flex items-center gap-2 mb-4"><TrendingUp className="w-5 h-5 text-success" />پرفروش‌ها</h2>
              <div className="space-y-3">
                {topBooks.map(item => <div key={item.book.id} className="rounded-xl bg-background/60 p-3"><div className="flex items-center justify-between gap-3"><b className="line-clamp-1">{item.book.title}</b><span className="text-xs text-success">{item.sales.toLocaleString('fa-IR')} فروش</span></div><div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden"><span className="block h-full bg-success" style={{ width: `${Math.min(100, item.sales * 20)}%` }} /></div><p className="mt-2 text-xs text-muted-foreground">{item.revenueCredits.toLocaleString('fa-IR')} کردیت درآمد</p></div>)}
              </div>
            </section>

            <section className="glass rounded-2xl p-6">
              <h2 className="font-bold text-lg flex items-center gap-2 mb-4"><Filter className="w-5 h-5 text-primary" />دسته‌بندی‌ها</h2>
              <div className="space-y-2">
                {categoryStats.slice(0, 7).map(item => <div key={item.category} className="flex items-center justify-between rounded-xl bg-background/55 p-3 text-sm"><span>{item.category}</span><span className="text-muted-foreground">{item.count.toLocaleString('fa-IR')} کتاب · {item.revenue.toLocaleString('fa-IR')} کردیت</span></div>)}
              </div>
            </section>

            <section className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="font-bold text-lg flex items-center gap-2"><Activity className="w-5 h-5 text-primary" />آخرین رخدادها</h2>
                <select value={adminTransactionFilter} onChange={event => setAdminTransactionFilter(event.target.value as typeof adminTransactionFilter)} className="rounded-xl border bg-background px-3 py-2 text-xs" title="فیلتر رخدادها"><option value="all">همه</option><option value="purchase">خریدها</option><option value="ai">AI</option></select>
              </div>
              <div className="space-y-2 max-h-80 overflow-auto pr-1">
                {transactionRows.slice(0, 10).map(row => <div key={row.id} className="rounded-xl bg-background/55 p-3 text-sm"><div className="flex items-center justify-between gap-3"><b>{row.title}</b><span className={row.amount < 0 ? 'text-destructive' : 'text-muted-foreground'}>{row.amount ? `${row.amount.toLocaleString('fa-IR')} کردیت` : 'بدون مبلغ'}</span></div><p className="mt-1 text-xs text-muted-foreground">{row.user} · {row.detail}</p></div>)}
                {!transactionRows.length && <p className="text-sm text-muted-foreground">رخدادی برای نمایش نیست.</p>}
              </div>
            </section>
          </div>

          <div className="glass rounded-2xl p-6">
            <h2 className="font-bold text-lg mb-4">خلاصه وضعیت مدیریتی</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-muted-foreground">فروش کل: </span><span className="font-bold">{purchaseRows.length.toLocaleString('fa-IR')}</span></div>
              <div><span className="text-muted-foreground">درآمد کردیتی: </span><span className="font-bold">{totalRevenueCredits.toLocaleString('fa-IR')}</span></div>
              <div><span className="text-muted-foreground">نرخ کردیت: </span><span className="font-bold">۱ کردیت = {CREDIT_VALUE_TOMAN.toLocaleString('fa-IR')} تومان</span></div>
              <div><span className="text-muted-foreground">ادمین: </span><span className="font-bold">{user?.email}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {tab === 'users' && (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="p-6 border-b bg-primary/5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-bold text-lg flex items-center gap-2"><Users className="w-5 h-5 text-primary" />مدیریت کاربران</h2>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  ویرایش مشخصات، نقش‌ها، کردیت، لینک ریست و تغییر رمز از ردیف هر کاربر انجام می‌شود.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={refreshAdminUsers} disabled={usersLoading} className="gap-2">
                <RefreshCw className={`w-4 h-4 ${usersLoading ? 'animate-spin' : ''}`} />به‌روزرسانی کاربران
              </Button>
            </div>
            {message && <p className="mt-4 rounded-xl bg-primary/10 p-3 text-sm text-primary break-all">{message}</p>}
          </div>
          <div className="p-6 border-b">
            <div className="grid md:grid-cols-[1fr_auto_auto] gap-3 items-center">
              <h2 className="font-bold text-lg">لیست کاربران</h2>
              <label className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input value={adminUserQuery} onChange={event => setAdminUserQuery(event.target.value)} className="w-full md:w-72 rounded-xl border bg-background py-2 pr-9 pl-3 text-sm" placeholder="جستجوی نام، ایمیل یا نقش..." />
              </label>
              <span className="rounded-full bg-muted px-3 py-2 text-xs text-muted-foreground">{filteredUsers.length.toLocaleString('fa-IR')} از {adminUserRows.length.toLocaleString('fa-IR')} کاربر</span>
            </div>
            <div className="mt-4 grid sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl bg-background/55 p-3"><Wallet className="w-4 h-4 text-primary mb-1" /><span className="text-muted-foreground">کل کردیت کاربران</span><b className="block text-xl">{totalUserCredits.toLocaleString('fa-IR')}</b></div>
              <div className="rounded-xl bg-background/55 p-3"><AlertTriangle className="w-4 h-4 text-warning mb-1" /><span className="text-muted-foreground">کم‌اعتبار</span><b className="block text-xl">{lowCreditUsers.toLocaleString('fa-IR')}</b></div>
              <div className="rounded-xl bg-background/55 p-3"><LibraryBig className="w-4 h-4 text-primary mb-1" /><span className="text-muted-foreground">خریدهای ثبت‌شده</span><b className="block text-xl">{purchaseRows.length.toLocaleString('fa-IR')}</b></div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-muted/50">{['نام','ایمیل','نقش‌ها','کردیت','تلفن','وضعیت','عملیات'].map(h=><th key={h} className="p-4 text-right text-sm font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {filteredUsers.map(u => {
                  const passwordDraft = rowPasswordDrafts[u.id] || ''
                  const userBookCount = mockBooks.filter(book => book.publisher_id === u.id || book.author === u.displayName).length
                  const isExpanded = expandedUserId === u.id
                  return (
                    <Fragment key={u.id}>
                      <tr className="border-t hover:bg-muted/30 transition-colors">
                        <td className="p-4 font-medium">{u.displayName || 'کاربر بدون نام'}</td>
                        <td className="p-4 text-sm" dir="ltr">{u.email}</td>
                        <td className="p-4"><div className="flex flex-wrap gap-1">{u.roles.map(r=><span key={r} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{r==='super_admin'?'مدیر ارشد':r==='admin'?'ادمین':r==='publisher'?'ناشر':r==='editor'?'ویراستار':'کاربر'}</span>)}</div></td>
                        <td className="p-4 font-bold">{(u.credits || 0).toLocaleString()}</td>
                        <td className="p-4 text-sm" dir="ltr">{'phone' in u ? u.phone : '-'}</td>
                        <td className="p-4"><span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full">فعال</span></td>
                        <td className="p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setExpandedUserId(isExpanded ? null : u.id)} className="gap-1"><Edit3 className="w-3.5 h-3.5" />ویرایش</Button>
                            <Button variant="outline" size="sm" onClick={() => sendPasswordResetForUser(u.email)} disabled={passwordActionLoading} className="gap-1"><Mail className="w-3.5 h-3.5" />ریست</Button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-t bg-muted/20">
                          <td colSpan={7} className="p-4">
                            <div className="grid xl:grid-cols-[1.1fr_1fr_1fr] gap-4">
                              <div className="rounded-2xl border bg-background/70 p-4">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary grid place-items-center font-bold text-lg">{(u.displayName || u.email || 'U').slice(0, 1).toUpperCase()}</div>
                                  <div>
                                    <h3 className="font-bold">{u.displayName || 'کاربر بدون نام'}</h3>
                                    <p className="text-xs text-muted-foreground" dir="ltr">{u.email}</p>
                                  </div>
                                </div>
                                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                                  <label className="grid gap-1"><span className="text-muted-foreground">نام نمایشی</span><input className="rounded-xl border bg-background px-3 py-2" defaultValue={u.displayName || ''} /></label>
                                  <label className="grid gap-1"><span className="text-muted-foreground">تلفن</span><input className="rounded-xl border bg-background px-3 py-2" dir="ltr" defaultValue={'phone' in u ? u.phone || '' : ''} /></label>
                                  <label className="grid gap-1"><span className="text-muted-foreground">نقش‌ها</span><input className="rounded-xl border bg-background px-3 py-2" dir="ltr" defaultValue={u.roles.join(', ')} /></label>
                                  <label className="grid gap-1"><span className="text-muted-foreground">کردیت</span><input className="rounded-xl border bg-background px-3 py-2" type="number" defaultValue={u.credits || 0} /></label>
                                </div>
                                <p className="mt-3 text-xs text-muted-foreground">ذخیره مشخصات عمومی بعد از اتصال کامل جدول پروفایل و تراکنش‌ها فعال می‌شود؛ تغییر رمز و لینک ریست همین حالا عملیاتی است.</p>
                              </div>
                              <div className="rounded-2xl border bg-background/70 p-4">
                                <h3 className="font-bold mb-3 flex items-center gap-2"><KeyRound className="w-4 h-4 text-primary" />امنیت و رمز عبور</h3>
                                <label className="grid gap-2 text-sm">
                                  <span className="text-muted-foreground">رمز عبور جدید</span>
                                  <input type="text" value={passwordDraft} onChange={event => setRowPasswordDrafts(current => ({ ...current, [u.id]: event.target.value }))} className="w-full p-2.5 rounded-xl border border-input bg-background text-sm" dir="ltr" placeholder="حداقل ۸ کاراکتر" />
                                </label>
                                <div className="flex flex-wrap gap-2 mt-3">
                                  <Button size="sm" onClick={() => changePasswordForUser(u.email, passwordDraft)} disabled={passwordActionLoading || passwordDraft.length < 8} className="gap-1"><KeyRound className="w-3.5 h-3.5" />ثبت رمز</Button>
                                  <Button size="sm" variant="outline" onClick={() => sendPasswordResetForUser(u.email)} disabled={passwordActionLoading} className="gap-1"><Mail className="w-3.5 h-3.5" />ارسال لینک ریست</Button>
                                </div>
                                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                                  <div className="rounded-xl bg-muted/40 p-3"><Clock3 className="w-4 h-4 text-primary mb-2" /><p className="text-muted-foreground">آخرین ورود</p><strong>در انتظار لاگ</strong></div>
                                  <div className="rounded-xl bg-muted/40 p-3"><Receipt className="w-4 h-4 text-primary mb-2" /><p className="text-muted-foreground">پرداخت‌ها</p><strong>در انتظار اتصال</strong></div>
                                </div>
                              </div>
                              <div className="rounded-2xl border bg-background/70 p-4">
                                <h3 className="font-bold mb-3 flex items-center gap-2"><LibraryBig className="w-4 h-4 text-primary" />فعالیت در سامانه</h3>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div className="rounded-xl bg-primary/10 p-3"><p className="text-muted-foreground">کتاب‌های کاربر</p><strong className="text-2xl">{userBookCount}</strong></div>
                                  <div className="rounded-xl bg-primary/10 p-3"><p className="text-muted-foreground">کردیت فعلی</p><strong className="text-2xl">{(u.credits || 0).toLocaleString()}</strong></div>
                                  <div className="rounded-xl bg-muted/40 p-3"><p className="text-muted-foreground">هزینه‌های AI</p><strong>در انتظار گزارش</strong></div>
                                  <div className="rounded-xl bg-muted/40 p-3"><p className="text-muted-foreground">خریدها</p><strong>در انتظار اتصال</strong></div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Treasury Tab */}
      {tab === 'treasury' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="glass rounded-2xl p-5"><Wallet className="w-7 h-7 text-primary mb-3" /><p className="text-sm text-muted-foreground">کل موجودی کاربران</p><b className="text-3xl">{totalUserCredits.toLocaleString('fa-IR')}</b><small className="block mt-2 text-muted-foreground">{(totalUserCredits * CREDIT_VALUE_TOMAN).toLocaleString('fa-IR')} تومان</small></div>
            <div className="glass rounded-2xl p-5"><ShoppingCart className="w-7 h-7 text-success mb-3" /><p className="text-sm text-muted-foreground">فروش ثبت‌شده</p><b className="text-3xl">{purchaseRows.length.toLocaleString('fa-IR')}</b><small className="block mt-2 text-muted-foreground">{totalRevenueCredits.toLocaleString('fa-IR')} کردیت</small></div>
            <div className="glass rounded-2xl p-5"><CreditCard className="w-7 h-7 text-warning mb-3" /><p className="text-sm text-muted-foreground">درآمد تومانی</p><b className="text-3xl">{totalRevenueToman.toLocaleString('fa-IR')}</b><small className="block mt-2 text-muted-foreground">برآورد از تراکنش‌های موجود</small></div>
            <div className="glass rounded-2xl p-5"><Sparkles className="w-7 h-7 text-primary mb-3" /><p className="text-sm text-muted-foreground">AI فعال</p><b className="text-3xl">{enabledAiProviders.toLocaleString('fa-IR')}</b><small className="block mt-2 text-muted-foreground">از {aiSettings.providers.length.toLocaleString('fa-IR')} provider</small></div>
          </div>

          <div className="glass rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="font-bold text-lg">دفتر رخدادها و تراکنش‌ها</h2>
              <select value={adminTransactionFilter} onChange={event => setAdminTransactionFilter(event.target.value as typeof adminTransactionFilter)} className="rounded-xl border bg-background px-3 py-2 text-sm" title="فیلتر تراکنش‌ها"><option value="all">همه</option><option value="purchase">خرید کتاب</option><option value="ai">AI</option></select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="bg-muted/50">{['کاربر/سرویس','نوع','جزئیات','مبلغ (کردیت)','تاریخ'].map(h=><th key={h} className="p-3 text-right text-sm">{h}</th>)}</tr></thead>
                <tbody>
                  {transactionRows.map(tx=>(
                    <tr key={tx.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 font-medium">{tx.user}</td>
                      <td className="p-3 text-sm">{tx.title}</td>
                      <td className="p-3 text-sm text-muted-foreground">{tx.detail}</td>
                      <td className={`p-3 font-bold ${tx.amount>0?'text-success':tx.amount<0?'text-destructive':'text-muted-foreground'}`}>{tx.amount ? tx.amount.toLocaleString('fa-IR') : '-'}</td>
                      <td className="p-3 text-sm">{new Date(tx.date).toLocaleDateString('fa-IR')}</td>
                    </tr>
                  ))}
                  {!transactionRows.length && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">رخدادی برای نمایش نیست.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass rounded-2xl p-6">
            <h2 className="font-bold text-lg mb-4">تنظیم اعتبار کاربر</h2>
            <div className="flex items-end gap-4">
              <div className="flex-1"><label className="text-sm text-muted-foreground block mb-1">کاربر</label><select title="انتخاب کاربر" className="w-full p-2 rounded-xl border border-input bg-background text-sm">{adminUserRows.map(row => <option key={row.id}>{row.displayName || row.email}</option>)}</select></div>
              <div className="w-32"><label className="text-sm text-muted-foreground block mb-1">مبلغ</label><input title="مبلغ کردیت" type="number" className="w-full p-2 rounded-xl border border-input bg-background text-sm" placeholder="کردیت" /></div>
              <Button size="sm">اعمال</Button>
            </div>
          </div>
        </div>
      )}

      {/* Books Tab */}
      {tab === 'books' && (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="p-6 border-b">
            <div className="grid lg:grid-cols-[1fr_auto_auto_auto] gap-3 items-center">
              <h2 className="font-bold text-lg">لیست کتاب‌ها و عملکرد فروش</h2>
              <label className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input value={adminBookQuery} onChange={event => setAdminBookQuery(event.target.value)} className="w-full lg:w-72 rounded-xl border bg-background py-2 pr-9 pl-3 text-sm" placeholder="جستجوی عنوان، ناشر، نویسنده..." />
              </label>
              <select value={adminBookStatusFilter} onChange={event => setAdminBookStatusFilter(event.target.value as typeof adminBookStatusFilter)} className="rounded-xl border bg-background px-3 py-2 text-sm" title="فیلتر وضعیت"><option value="all">همه وضعیت‌ها</option><option value="published">منتشر شده</option><option value="draft">پیش‌نویس</option><option value="pending">در انتظار بررسی</option></select>
              <select value={adminBookSort} onChange={event => setAdminBookSort(event.target.value as typeof adminBookSort)} className="rounded-xl border bg-background px-3 py-2 text-sm" title="مرتب‌سازی"><option value="sales">بیشترین فروش</option><option value="revenue">بیشترین درآمد</option><option value="date">جدیدترین</option><option value="title">عنوان</option></select>
            </div>
            <div className="mt-4 grid sm:grid-cols-4 gap-3 text-sm">
              <div className="rounded-xl bg-background/55 p-3"><span className="text-muted-foreground">کل کتاب‌ها</span><b className="block text-xl">{totalBooks.toLocaleString('fa-IR')}</b></div>
              <div className="rounded-xl bg-background/55 p-3"><span className="text-muted-foreground">منتشر شده</span><b className="block text-xl">{publishedBooks.toLocaleString('fa-IR')}</b></div>
              <div className="rounded-xl bg-background/55 p-3"><span className="text-muted-foreground">فروش کل</span><b className="block text-xl">{purchaseRows.length.toLocaleString('fa-IR')}</b></div>
              <div className="rounded-xl bg-background/55 p-3"><span className="text-muted-foreground">درآمد کل</span><b className="block text-xl">{totalRevenueCredits.toLocaleString('fa-IR')} کردیت</b></div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-muted/50">{['عنوان','ناشر/نویسنده','قیمت','وضعیت','دسته‌بندی','فروش','درآمد','تعامل'].map(h=><th key={h} className="p-4 text-right text-sm font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {filteredBookMetrics.map(({ book: b, sales, revenueCredits, comments: commentCount, readers }) => (
                  <tr key={b.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="p-4"><p className="font-bold line-clamp-1">{b.title}</p><p className="text-xs text-muted-foreground mt-1">{(b.book_type || 'تألیف')} · {b.pages.length.toLocaleString('fa-IR')} صفحه</p></td>
                    <td className="p-4 text-sm"><p>{b.publisher_name}</p><p className="text-xs text-muted-foreground mt-1">{b.author || 'نویسنده نامشخص'}</p></td>
                    <td className="p-4 font-bold">{b.price === 0 ? <span className="text-success">رایگان</span> : `${b.price.toLocaleString('fa-IR')} کردیت`}</td>
                    <td className="p-4"><div className="flex flex-col gap-1 items-start"><span className={`text-xs px-2 py-0.5 rounded-full ${b.status==='published'?'bg-success/20 text-success':'bg-warning/20 text-warning'}`}>{b.status==='published'?'منتشر شده':'پیش‌نویس'}</span><span className={`text-xs px-2 py-0.5 rounded-full ${b.review_status==='approved'?'bg-success/10 text-success':b.review_status==='pending'?'bg-warning/10 text-warning':'bg-destructive/10 text-destructive'}`}>{b.review_status==='approved'?'تأیید شده':b.review_status==='pending'?'در انتظار بررسی':'رد شده'}</span></div></td>
                    <td className="p-4 text-sm">{b.category}</td>
                    <td className="p-4 font-bold">{sales.toLocaleString('fa-IR')}</td>
                    <td className="p-4"><b>{revenueCredits.toLocaleString('fa-IR')}</b><p className="text-xs text-muted-foreground">{(revenueCredits * CREDIT_VALUE_TOMAN).toLocaleString('fa-IR')} تومان</p></td>
                    <td className="p-4 text-sm"><p>{commentCount.toLocaleString('fa-IR')} نظر</p><p className="text-xs text-muted-foreground">{readers.toLocaleString('fa-IR')} خوانش</p></td>
                  </tr>
                ))}
                {!filteredBookMetrics.length && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">کتابی با این فیلتر پیدا نشد.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Comments Tab */}
      {tab === 'comments' && (
        <div className="menu-glass-70 rounded-2xl overflow-hidden">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="font-bold text-lg flex items-center gap-2"><MessageSquare className="w-5 h-5 text-primary" />مدیریت کامنت‌ها</h2>
            <span className="text-xs text-muted-foreground">{comments.length} کامنت</span>
          </div>
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">هنوز کامنتی ثبت نشده است.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50">
                    {['کتاب','کاربر','متن','تاریخ','وضعیت','عملیات'].map(h => <th key={h} className="p-4 text-right text-sm font-semibold">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {comments.map(comment => (
                    <tr key={comment.id} className="border-t hover:bg-muted/30 align-top">
                      <td className="p-4 text-sm font-medium whitespace-nowrap">{commentBookTitle(comment.bookId)}</td>
                      <td className="p-4 text-sm whitespace-nowrap">{comment.displayName}</td>
                      <td className="p-4 text-sm max-w-md leading-relaxed">{comment.text}</td>
                      <td className="p-4 text-xs text-muted-foreground whitespace-nowrap">{new Date(comment.createdAt).toLocaleDateString('fa-IR')}</td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${comment.status === 'visible' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                          {comment.status === 'visible' ? 'نمایش' : 'مخفی'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {comment.status === 'visible' ? (
                            <Button size="sm" variant="outline" onClick={() => setCommentVisibility(comment.id, false)} className="gap-1"><EyeOff className="w-4 h-4" />مخفی</Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => setCommentVisibility(comment.id, true)} className="gap-1"><Eye className="w-4 h-4" />نمایش</Button>
                          )}
                          <Button size="sm" variant="destructive" onClick={() => removeComment(comment.id)} className="gap-1"><Trash2 className="w-4 h-4" />حذف</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* AI Gateway Tab */}
      {tab === 'ai' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="font-bold text-lg flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" />مسیر مرکزی API هوش مصنوعی</h2>
                <p className="text-sm text-muted-foreground mt-1">کل درخواست‌های AI کاربران از این مسیر اجرا می‌شود و ۲ برابر هزینه دلاری، با دلار ۱۷۰٬۰۰۰ تومانی، به کردیت تبدیل و از حساب کاربر کم می‌شود.</p>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary whitespace-nowrap">نرخ دلار: {aiSettings.usdToToman.toLocaleString('fa-IR')} تومان</span>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="text-sm text-muted-foreground block mb-2">ارائه‌دهنده فعال</label>
                <select title="ارائه‌دهنده فعال هوش مصنوعی" value={aiSettings.activeProvider} onChange={e => setAiSettings({ ...aiSettings, activeProvider: e.target.value as AiGatewaySettings['activeProvider'] })} className="w-full p-2.5 rounded-xl border border-input bg-background text-sm">
                  {aiSettings.providers.map(provider => <option key={provider.id} value={provider.id}>{provider.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-2">نرخ دلار مبنا (تومان)</label>
                <input title="نرخ دلار" type="number" value={aiSettings.usdToToman} onChange={e => setAiSettings({ ...aiSettings, usdToToman: Number(e.target.value) })} className="w-full p-2.5 rounded-xl border border-input bg-background text-sm font-bold" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-2">ضریب شارژ کاربر</label>
                <input title="ضریب شارژ" type="number" step="0.1" value={aiSettings.chargeMultiplier} onChange={e => setAiSettings({ ...aiSettings, chargeMultiplier: Number(e.target.value) })} className="w-full p-2.5 rounded-xl border border-input bg-background text-sm font-bold" />
                <p className="text-xs text-muted-foreground mt-1">طبق درخواست فعلی: ۲ برابر هزینه واقعی</p>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              {aiSettings.providers.map(provider => (
                <div key={provider.id} className={`rounded-2xl border p-4 ${aiSettings.activeProvider === provider.id ? 'border-primary bg-primary/5' : 'border-border bg-background/50'}`}>
                  {(() => {
                    const test = aiProviderTests[provider.id] || { state: 'idle' as const, message: '' }
                    return (
                      <>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h3 className="font-bold flex items-center gap-2"><KeyRound className="w-4 h-4 text-primary" />{provider.label}</h3>
                      <p className="text-xs text-muted-foreground mt-1">کلید فعلی: {maskApiKey(provider.apiKey)}</p>
                    </div>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={provider.enabled} onChange={e => updateAiProvider(provider.id, { enabled: e.target.checked })} /> فعال
                    </label>
                  </div>
                  <div className="space-y-3">
                    <input title="API Key" type="password" value={provider.apiKey} onChange={e => updateAiProvider(provider.id, { apiKey: e.target.value })} placeholder="API Key را وارد کنید" className="w-full p-2.5 rounded-xl border border-input bg-background text-sm" dir="ltr" />
                    <input title="Base URL" value={provider.baseUrl || ''} onChange={e => updateAiProvider(provider.id, { baseUrl: e.target.value })} placeholder="Base URL" className="w-full p-2.5 rounded-xl border border-input bg-background text-sm" dir="ltr" />
                    <input title="Model" value={provider.model} onChange={e => updateAiProvider(provider.id, { model: e.target.value })} placeholder="Model" className="w-full p-2.5 rounded-xl border border-input bg-background text-sm" dir="ltr" />
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-xs text-muted-foreground block mb-1">هزینه ورودی / ۱۰۰۰ توکن ($)</label><input title="هزینه ورودی" type="number" step="0.000001" value={provider.inputCostPer1kUsd} onChange={e => updateAiProvider(provider.id, { inputCostPer1kUsd: Number(e.target.value) })} className="w-full p-2 rounded-xl border border-input bg-background text-sm" /></div>
                      <div><label className="text-xs text-muted-foreground block mb-1">هزینه خروجی / ۱۰۰۰ توکن ($)</label><input title="هزینه خروجی" type="number" step="0.000001" value={provider.outputCostPer1kUsd} onChange={e => updateAiProvider(provider.id, { outputCostPer1kUsd: Number(e.target.value) })} className="w-full p-2 rounded-xl border border-input bg-background text-sm" /></div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void runAiProviderTest(provider)} disabled={test.state === 'testing'} className="gap-2">
                      <RefreshCw className={`w-4 h-4 ${test.state === 'testing' ? 'animate-spin' : ''}`} />تست کلید
                    </Button>
                    {test.message && <span className={`text-xs rounded-full px-3 py-1.5 ${test.state === 'ok' ? 'bg-success/15 text-success' : test.state === 'error' ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground'}`}>{test.message}</span>}
                  </div>
                  {test.sample && <pre className="mt-3 max-h-24 overflow-auto rounded-xl bg-muted/50 p-3 text-xs leading-relaxed whitespace-pre-wrap" dir="auto">{test.sample}</pre>}
                      </>
                    )
                  })()}
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button onClick={saveAiSettings} className="gap-2">💾 ذخیره تنظیمات AI</Button>
              {message && <p className="text-sm text-success font-medium">{message}</p>}
            </div>
          </div>

          <div className="glass rounded-2xl p-6">
            <h2 className="font-bold text-lg mb-4">فرمول کسر کردیت</h2>
            <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
              <p>۱) هزینه واقعی دلاری از مصرف توکن ورودی/خروجی محاسبه می‌شود.</p>
              <p>۲) مبلغ قابل کسر = هزینه واقعی × {aiSettings.chargeMultiplier.toLocaleString('fa-IR')} × {aiSettings.usdToToman.toLocaleString('fa-IR')} تومان.</p>
              <p>۳) مبلغ تومانی بر اساس ضریب فعلی کردیت تبدیل می‌شود: ۱ کردیت = {CREDIT_VALUE_TOMAN.toLocaleString('fa-IR')} تومان.</p>
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {tab === 'settings' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="font-bold text-lg flex items-center gap-2"><Server className="w-5 h-5 text-primary" />وضعیت اتصال Supabase</h2>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">این بخش فقط وضعیت اتصال را نمایش می‌دهد و هیچ کلید محرمانه‌ای را در مرورگر ذخیره یا نمایش نمی‌دهد.</p>
              </div>
              <Button variant="outline" size="sm" onClick={testSupabaseConnection} disabled={connectionTest === 'testing'} className="gap-2">
                <RefreshCw className={`w-4 h-4 ${connectionTest === 'testing' ? 'animate-spin' : ''}`} />تست اتصال
              </Button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="rounded-xl border bg-background/55 p-4">
                <p className="text-xs text-muted-foreground mb-2">Project URL</p>
                <p className={`flex items-center gap-2 text-sm font-bold ${hasSupabaseUrl ? 'text-success' : 'text-destructive'}`}>{hasSupabaseUrl ? <CheckCircle className="w-4 h-4"/> : <AlertTriangle className="w-4 h-4"/>}{hasSupabaseUrl ? 'تنظیم شده' : 'تنظیم نشده'}</p>
                {projectRef && <p className="mt-2 truncate text-xs text-muted-foreground" dir="ltr">{projectRef}.supabase.co</p>}
              </div>
              <div className="rounded-xl border bg-background/55 p-4">
                <p className="text-xs text-muted-foreground mb-2">Publishable Key</p>
                <p className={`flex items-center gap-2 text-sm font-bold ${hasSupabaseKey ? 'text-success' : 'text-destructive'}`}>{hasSupabaseKey ? <CheckCircle className="w-4 h-4"/> : <AlertTriangle className="w-4 h-4"/>}{hasSupabaseKey ? 'تنظیم شده و پنهان' : 'تنظیم نشده'}</p>
              </div>
              <div className="rounded-xl border bg-background/55 p-4">
                <p className="text-xs text-muted-foreground mb-2">وضعیت تست</p>
                <p className={`flex items-center gap-2 text-sm font-bold ${connectionTest === 'ok' ? 'text-success' : connectionTest === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>{connectionTest === 'ok' ? <CheckCircle className="w-4 h-4"/> : connectionTest === 'error' ? <AlertTriangle className="w-4 h-4"/> : <Server className="w-4 h-4"/>}{connectionTest === 'ok' ? 'متصل' : connectionTest === 'error' ? 'خطا' : 'تست نشده'}</p>
              </div>
            </div>
            {connectionMessage && <p className={`mt-4 rounded-xl p-3 text-sm ${connectionTest === 'ok' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>{connectionMessage}</p>}
            <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-muted px-3 py-1.5">کلیدهای عمومی: فایل .env</span>
              <span className="rounded-full bg-muted px-3 py-1.5">کلیدهای محرمانه: Edge Function Secrets</span>
              <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-primary">باز کردن داشبورد Supabase <ExternalLink className="w-3 h-3"/></a>
            </div>
          </div>

          <div className="glass rounded-2xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="font-bold text-lg flex items-center gap-2"><Filter className="w-5 h-5 text-primary" />گزینه‌های فیلتر کتاب</h2>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">هر گزینه را در یک خط وارد کنید. این گزینه‌ها بدون نیاز به کدنویسی در فروشگاه، قفسه من و صفحه انتشارات کنار گزینه‌های کشف‌شده از کتاب‌ها نمایش داده می‌شوند.</p>
              </div>
              <Button variant="outline" size="sm" onClick={fillFiltersFromBooks}>پر کردن از کتاب‌های فعلی</Button>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <label className="admin-filter-field">
                <span>دسته‌بندی‌ها</span>
                <textarea value={filterDraft.categories} onChange={event => setFilterDraft(current => ({ ...current, categories: event.target.value }))} placeholder="علمی&#10;ادبیات&#10;مدیریت" />
                <small>{filterSettings.categories.length.toLocaleString('fa-IR')} گزینه ذخیره‌شده</small>
              </label>
              <label className="admin-filter-field">
                <span>تگ‌ها</span>
                <textarea value={filterDraft.tags} onChange={event => setFilterDraft(current => ({ ...current, tags: event.target.value }))} placeholder="فیزیک&#10;هوش مصنوعی&#10;رمان" />
                <small>{filterSettings.tags.length.toLocaleString('fa-IR')} گزینه ذخیره‌شده</small>
              </label>
              <label className="admin-filter-field">
                <span>نوع کتاب</span>
                <textarea value={filterDraft.bookTypes} onChange={event => setFilterDraft(current => ({ ...current, bookTypes: event.target.value }))} placeholder="تألیف&#10;ترجمه&#10;گردآوری" />
                <small>{filterSettings.bookTypes.length.toLocaleString('fa-IR')} گزینه ذخیره‌شده</small>
              </label>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button onClick={saveFilterOptions}>ذخیره گزینه‌های فیلتر</Button>
              {message && <p className="text-sm text-success font-medium">{message}</p>}
            </div>
          </div>

          <div className="glass rounded-2xl p-6">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><DollarSign className="w-5 h-5 text-primary" />تنظیمات مالی</h2>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="text-sm text-muted-foreground block mb-2">ارزش هر کردیت (تومان)</label>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">۱ کردیت =</span>
                  <input title="ارزش هر کردیت" type="number" value={creditVal} onChange={e => setCreditVal(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-input bg-background text-sm font-bold" />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">تومان</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">با تغییر این مقدار، ارزش کل کردیت‌ها در سیستم به‌روز می‌شود</p>
              </div>
              <Button onClick={saveCreditSetting} className="gap-2">💾 ذخیره تنظیمات</Button>
              {message && <p className="text-sm text-success font-medium">{message}</p>}
            </div>
          </div>

          <div className="glass rounded-2xl p-6">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><Settings className="w-5 h-5 text-primary" />تنظیمات عمومی</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b"><span>کارمزد پلتفرم</span><span className="font-bold">۱۵٪</span></div>
              <div className="flex items-center justify-between py-2 border-b"><span>هزینه انتشار کتاب</span><span className="font-bold">۵۰,۰۰۰ تومان</span></div>
              <div className="flex items-center justify-between py-2 border-b"><span>حداقل برداشت ناشر</span><span className="font-bold">۲۰۰,۰۰۰ تومان</span></div>
              <div className="flex items-center justify-between py-2 border-b"><span>حداکثر دستگاه آفلاین</span><span className="font-bold">۳ دستگاه</span></div>
            </div>
          </div>

          <div className="glass rounded-2xl p-6">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><Bug className="w-5 h-5 text-primary" />خطاهای سیستم</h2>
            <p className="text-sm text-muted-foreground">هیچ خطایی ثبت نشده است.</p>
          </div>
        </div>
      )}
    </div>
  )
}
