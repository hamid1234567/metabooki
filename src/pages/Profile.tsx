import { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/lib/i18n'
import { mockBooks, setMockUserPassword } from '@/lib/mock-data'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { BookOpen, Camera, CreditCard, KeyRound, Receipt, ShieldCheck, User, Wallet } from 'lucide-react'

export default function Profile() {
  const { user, isMock } = useAuth()
  const { t } = useI18n()
  const mock = user?.mockData
  const [displayName, setDisplayName] = useState(mock?.display_name || user?.user_metadata?.display_name || '')
  const [phone, setPhone] = useState(mock?.phone || '')
  const [avatar, setAvatar] = useState(user?.user_metadata?.avatar_url || '')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  const userBooks = useMemo(() => mockBooks.filter(book => book.publisher_id === user?.id || book.author === mock?.display_name), [user?.id, mock?.display_name])
  const roles = mock?.roles || []

  const savePassword = async () => {
    if (!user?.email) return
    if (password.length < 8) {
      setMessage('رمز عبور باید حداقل ۸ کاراکتر باشد.')
      return
    }
    try {
      if (isMock) {
        setMockUserPassword(user.email, password)
      } else {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
      }
      setPassword('')
      setMessage('رمز عبور با موفقیت به‌روزرسانی شد.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تغییر رمز عبور ناموفق بود.')
    }
    window.setTimeout(() => setMessage(''), 5000)
  }

  const saveProfile = async () => {
    try {
      if (!isMock) {
        const { error } = await supabase.auth.updateUser({ data: { display_name: displayName, phone, avatar_url: avatar } })
        if (error) throw error
      }
      if (mock) {
        mock.display_name = displayName
        mock.phone = phone
      }
      setMessage('مشخصات پروفایل ذخیره شد.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ذخیره پروفایل ناموفق بود.')
    }
    window.setTimeout(() => setMessage(''), 5000)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold font-display">{t('profile_title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">مشخصات، امنیت، کردیت و فعالیت‌های حساب کاربری</p>
        </div>
        <Button onClick={saveProfile} className="gap-2"><ShieldCheck className="w-4 h-4" />ذخیره پروفایل</Button>
      </div>

      {message && <div className="mb-5 rounded-2xl border border-primary/20 bg-primary/10 p-4 text-sm text-primary">{message}</div>}

      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-6">
        <section className="glass rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              {avatar ? <img src={avatar} alt={displayName || user?.email || ''} className="w-24 h-24 rounded-3xl object-cover" /> : <div className="w-24 h-24 rounded-3xl bg-primary/10 grid place-items-center"><User className="w-10 h-10 text-primary" /></div>}
              <span className="absolute -bottom-2 -left-2 rounded-full bg-background border p-2 shadow"><Camera className="w-4 h-4 text-primary" /></span>
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold truncate">{displayName || 'کاربر متابوکی'}</h2>
              <p className="text-sm text-muted-foreground truncate" dir="ltr">{user?.email}</p>
              <div className="flex flex-wrap gap-1 mt-2">{roles.map(role => <span key={role} className="text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5">{role}</span>)}</div>
            </div>
          </div>

          <div className="grid gap-4">
            <label className="grid gap-2 text-sm"><span className="text-muted-foreground">نام نمایشی</span><input value={displayName} onChange={event => setDisplayName(event.target.value)} className="rounded-xl border bg-background px-3 py-2" /></label>
            <label className="grid gap-2 text-sm"><span className="text-muted-foreground">شماره تلفن</span><input value={phone} onChange={event => setPhone(event.target.value)} dir="ltr" className="rounded-xl border bg-background px-3 py-2" /></label>
            <label className="grid gap-2 text-sm"><span className="text-muted-foreground">آدرس تصویر پروفایل</span><input value={avatar} onChange={event => setAvatar(event.target.value)} dir="ltr" className="rounded-xl border bg-background px-3 py-2" placeholder="https://..." /></label>
          </div>
        </section>

        <section className="grid sm:grid-cols-2 gap-4">
          <div className="glass rounded-2xl p-5"><Wallet className="w-6 h-6 text-primary mb-3" /><p className="text-sm text-muted-foreground">کردیت فعلی</p><strong className="text-3xl">{(mock?.credits || 0).toLocaleString()}</strong></div>
          <div className="glass rounded-2xl p-5"><BookOpen className="w-6 h-6 text-primary mb-3" /><p className="text-sm text-muted-foreground">کتاب‌های مرتبط</p><strong className="text-3xl">{userBooks.length}</strong></div>
          <div className="glass rounded-2xl p-5"><Receipt className="w-6 h-6 text-primary mb-3" /><p className="text-sm text-muted-foreground">پرداخت‌ها و هزینه‌ها</p><strong>در انتظار اتصال کامل تراکنش‌ها</strong></div>
          <div className="glass rounded-2xl p-5"><CreditCard className="w-6 h-6 text-primary mb-3" /><p className="text-sm text-muted-foreground">آخرین ورودها</p><strong>در انتظار اتصال لاگ‌ها</strong></div>
        </section>
      </div>

      <div className="grid lg:grid-cols-[1fr_1fr] gap-6 mt-6">
        <section className="glass rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><KeyRound className="w-5 h-5 text-primary" />تغییر رمز عبور</h2>
          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
            <label className="grid gap-2 text-sm"><span className="text-muted-foreground">رمز جدید</span><input type="password" value={password} onChange={event => setPassword(event.target.value)} dir="ltr" className="rounded-xl border bg-background px-3 py-2" placeholder="حداقل ۸ کاراکتر" /></label>
            <Button onClick={savePassword} disabled={password.length < 8}>ثبت رمز جدید</Button>
          </div>
        </section>

        <section className="glass rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-4">کتاب‌های مرتبط با حساب</h2>
          <div className="space-y-2 max-h-56 overflow-auto pr-1">
            {userBooks.length ? userBooks.map(book => <div key={book.id} className="flex items-center justify-between rounded-xl bg-background/60 p-3 text-sm"><span>{book.title}</span><span className="text-xs text-muted-foreground">{book.status === 'published' ? 'منتشر شده' : 'پیش‌نویس'}</span></div>) : <p className="text-sm text-muted-foreground">هنوز کتابی برای این حساب ثبت نشده است.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
