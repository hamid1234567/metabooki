import { useEffect, useState } from 'react'
import { useAuthContext } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import { mockUsers, mockBooks, CREDIT_VALUE_TOMAN, setCreditValue } from '@/lib/mock-data'
import { Shield, Users, Activity, BookOpen, DollarSign, Settings, Bug, MessageSquare, Eye, EyeOff, Trash2, Sparkles, KeyRound, Server, CheckCircle, AlertTriangle, RefreshCw, ExternalLink, Filter } from 'lucide-react'
import { deleteComment, getAllComments, updateCommentStatus, type MockComment } from '@/lib/mock-comments'
import { Button } from '@/components/ui/button'
import { loadAiGatewaySettings, loadAiGatewaySettingsRemote, maskApiKey, saveAiGatewaySettings, type AiGatewaySettings, type AiProviderConfig } from '@/lib/ai-gateway'
import { useRoles } from '@/hooks/useRoles'
import { supabase } from '@/integrations/supabase/client'
import { emptyFilterSettings, loadBookFilterSettings, parseFilterLines, saveBookFilterSettings, type BookFilterSettings } from '@/lib/filter-settings'

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
  const [filterSettings, setFilterSettings] = useState<BookFilterSettings>(emptyFilterSettings)
  const [filterDraft, setFilterDraft] = useState({ categories: '', tags: '', bookTypes: '' })
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

  const totalBooks = mockBooks.length
  const totalUsers = mockUsers.length
  const publishedBooks = mockBooks.filter(b => b.status === 'published').length
  const freeBooks = mockBooks.filter(b => b.price === 0).length
  const totalRevenue = 0 // Mock

  const refreshComments = () => setComments(getAllComments())
  const commentBookTitle = (bookId: string) => mockBooks.find(b => b.id === bookId)?.title || bookId

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
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass rounded-2xl p-6"><Users className="w-8 h-8 text-primary mb-3" /><p className="text-3xl font-bold">{totalUsers}</p><p className="text-sm text-muted-foreground">کل کاربران</p></div>
            <div className="glass rounded-2xl p-6"><BookOpen className="w-8 h-8 text-primary mb-3" /><p className="text-3xl font-bold">{totalBooks}</p><p className="text-sm text-muted-foreground">کل کتاب‌ها</p></div>
            <div className="glass rounded-2xl p-6"><Activity className="w-8 h-8 text-success mb-3" /><p className="text-3xl font-bold">{publishedBooks}</p><p className="text-sm text-muted-foreground">کتاب‌های منتشر شده</p></div>
            <div className="glass rounded-2xl p-6"><DollarSign className="w-8 h-8 text-warning mb-3" /><p className="text-3xl font-bold">{totalRevenue.toLocaleString()}</p><p className="text-sm text-muted-foreground">درآمد (تومان)</p></div>
          </div>

          <div className="glass rounded-2xl p-6">
            <h2 className="font-bold text-lg mb-4">خلاصه وضعیت</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-muted-foreground">کتاب‌های رایگان: </span><span className="font-bold">{freeBooks}</span></div>
              <div><span className="text-muted-foreground">کتاب‌های پولی: </span><span className="font-bold">{publishedBooks - freeBooks}</span></div>
              <div><span className="text-muted-foreground">نرخ کردیت: </span><span className="font-bold">۱ کردیت = {CREDIT_VALUE_TOMAN.toLocaleString()} تومان</span></div>
              <div><span className="text-muted-foreground">ادمین: </span><span className="font-bold">{user?.email}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {tab === 'users' && (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="p-6 border-b"><h2 className="font-bold text-lg">لیست کاربران</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-muted/50">{['نام','ایمیل','نقش‌ها','کردیت','تلفن','وضعیت'].map(h=><th key={h} className="p-4 text-right text-sm font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {mockUsers.map(u => (
                  <tr key={u.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-medium">{u.display_name}</td>
                    <td className="p-4 text-sm">{u.email}</td>
                    <td className="p-4"><div className="flex flex-wrap gap-1">{u.roles.map(r=><span key={r} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{r==='super_admin'?'مدیر ارشد':r==='admin'?'ادمین':r==='publisher'?'ناشر':r==='editor'?'ویراستار':'کاربر'}</span>)}</div></td>
                    <td className="p-4 font-bold">{u.credits.toLocaleString()}</td>
                    <td className="p-4 text-sm" dir="ltr">{u.phone}</td>
                    <td className="p-4"><span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full">فعال</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Treasury Tab */}
      {tab === 'treasury' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-6">
            <h2 className="font-bold text-lg mb-4">آخرین تراکنش‌ها (نمونه)</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="bg-muted/50">{['کاربر','نوع','مبلغ (کردیت)','تاریخ'].map(h=><th key={h} className="p-3 text-right text-sm">{h}</th>)}</tr></thead>
                <tbody>
                  {[
                    {user:'سارا احمدی',type:'خرید کتاب',amount:-2500,date:'۱۴۰۵/۰۳/۲۰'},
                    {user:'علی رضایی',type:'افزایش اعتبار',amount:5000,date:'۱۴۰۵/۰۳/۱۹'},
                    {user:'نرگس کریمی',type:'خرید کتاب',amount:-1800,date:'۱۴۰۵/۰۳/۱۸'},
                    {user:'انتشارات دانش نو',type:'درآمد فروش',amount:15000,date:'۱۴۰۵/۰۳/۱۷'},
                  ].map((tx,i)=>(
                    <tr key={i} className="border-t hover:bg-muted/30">
                      <td className="p-3 font-medium">{tx.user}</td>
                      <td className="p-3 text-sm">{tx.type}</td>
                      <td className={`p-3 font-bold ${tx.amount>0?'text-success':'text-destructive'}`}>{tx.amount>0?'+':''}{tx.amount.toLocaleString()}</td>
                      <td className="p-3 text-sm">{tx.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass rounded-2xl p-6">
            <h2 className="font-bold text-lg mb-4">تنظیم اعتبار کاربر</h2>
            <div className="flex items-end gap-4">
              <div className="flex-1"><label className="text-sm text-muted-foreground block mb-1">کاربر</label><select title="انتخاب کاربر" className="w-full p-2 rounded-xl border border-input bg-background text-sm"><option>سارا احمدی</option><option>علی رضایی</option><option>نرگس کریمی</option></select></div>
              <div className="w-32"><label className="text-sm text-muted-foreground block mb-1">مبلغ</label><input title="مبلغ کردیت" type="number" className="w-full p-2 rounded-xl border border-input bg-background text-sm" placeholder="کردیت" /></div>
              <Button size="sm">اعمال</Button>
            </div>
          </div>
        </div>
      )}

      {/* Books Tab */}
      {tab === 'books' && (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="p-6 border-b"><h2 className="font-bold text-lg">لیست کتاب‌ها</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-muted/50">{['عنوان','ناشر','قیمت','وضعیت','دسته‌بندی','صفحات'].map(h=><th key={h} className="p-4 text-right text-sm font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {mockBooks.map(b => (
                  <tr key={b.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-medium">{b.title}</td>
                    <td className="p-4 text-sm">{b.publisher_name}</td>
                    <td className="p-4 font-bold">{b.price === 0 ? <span className="text-success">رایگان</span> : b.price.toLocaleString() + ' تومان'}</td>
                    <td className="p-4"><span className={`text-xs px-2 py-0.5 rounded-full ${b.status==='published'?'bg-success/20 text-success':'bg-warning/20 text-warning'}`}>{b.status==='published'?'منتشر شده':'پیش‌نویس'}</span></td>
                    <td className="p-4 text-sm">{b.category}</td>
                    <td className="p-4 text-sm">{b.pages.length}</td>
                  </tr>
                ))}
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
