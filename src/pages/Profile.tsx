import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useCredits } from '@/hooks/useCredits'
import { useI18n } from '@/lib/i18n'
import { mockBooks, setMockUserPassword } from '@/lib/mock-data'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import {
  BookOpen,
  Camera,
  CreditCard,
  Heart,
  Home,
  IdCard,
  KeyRound,
  MapPin,
  Receipt,
  ShieldCheck,
  User,
  Wallet,
} from 'lucide-react'

type ProfileForm = {
  display_name: string
  username: string
  phone: string
  national_id: string
  bio: string
  avatar_url: string
  address_province: string
  address_city: string
  address_district: string
  address_street: string
  address_alley: string
  address_plaque: string
  address_unit: string
  postal_code: string
  address_notes: string
  reading_interests: string[]
  bank_card_number: string
  bank_iban: string
}

const emptyProfile: ProfileForm = {
  display_name: '',
  username: '',
  phone: '',
  national_id: '',
  bio: '',
  avatar_url: '',
  address_province: '',
  address_city: '',
  address_district: '',
  address_street: '',
  address_alley: '',
  address_plaque: '',
  address_unit: '',
  postal_code: '',
  address_notes: '',
  reading_interests: [],
  bank_card_number: '',
  bank_iban: '',
}

const profileStorageKey = (userId: string) => `metabooki_profile_${userId}`

function profileFromLocal(userId: string): Partial<ProfileForm> {
  try {
    const raw = localStorage.getItem(profileStorageKey(userId))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveProfileLocal(userId: string, profile: ProfileForm) {
  localStorage.setItem(profileStorageKey(userId), JSON.stringify(profile))
}

function normalizeCard(value: string) {
  return value.replace(/[^\d]/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ')
}

function normalizeIban(value: string) {
  const clean = value.replace(/\s+/g, '').replace(/^IR/i, '').replace(/[^\d]/g, '').slice(0, 24)
  return clean ? `IR${clean}` : ''
}

export default function Profile() {
  const { user, isMock } = useAuth()
  const { t } = useI18n()
  const { balance, loading: creditsLoading } = useCredits(user)
  const mock = user?.mockData
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile)
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const userId = user?.id || mock?.id || ''

  const tagOptions = useMemo(() => {
    const values = new Set<string>()
    mockBooks.forEach(book => {
      if (book.category) values.add(book.category)
      ;(book.tags || []).forEach(tag => values.add(tag))
    })
    return Array.from(values).filter(Boolean).sort((a, b) => a.localeCompare(b, 'fa'))
  }, [])

  const userBooks = useMemo(
    () => mockBooks.filter(book => book.publisher_id === user?.id || book.publisher_id === mock?.id || book.author === profile.display_name),
    [mock?.id, profile.display_name, user?.id],
  )
  const roles = mock?.roles || []

  useEffect(() => {
    if (!user) return
    const currentUserId = user.id
    let alive = true
    const metadata = user.user_metadata || {}
    const localProfile = isMock ? profileFromLocal(user.id) : {}
    const baseProfile: ProfileForm = {
      ...emptyProfile,
      display_name: mock?.display_name || metadata.display_name || metadata.full_name || '',
      username: mock?.username || '',
      phone: mock?.phone || '',
      national_id: mock?.national_id || '',
      bio: mock?.bio || '',
      avatar_url: metadata.avatar_url || '',
      ...localProfile,
      reading_interests: Array.isArray(localProfile.reading_interests) ? localProfile.reading_interests : [],
    }

    async function loadProfile() {
      if (isMock) {
        if (alive) setProfile(baseProfile)
        return
      }
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('*')
        .eq('id', currentUserId)
        .maybeSingle()
      if (!alive) return
      if (error || !data) {
        setProfile(baseProfile)
        return
      }
      setProfile({
        ...baseProfile,
        display_name: data.display_name || baseProfile.display_name,
        username: data.username || '',
        phone: data.phone || '',
        national_id: data.national_id || '',
        bio: data.bio || '',
        avatar_url: data.avatar_url || baseProfile.avatar_url,
        address_province: data.address_province || '',
        address_city: data.address_city || '',
        address_district: data.address_district || '',
        address_street: data.address_street || '',
        address_alley: data.address_alley || '',
        address_plaque: data.address_plaque || '',
        address_unit: data.address_unit || '',
        postal_code: data.postal_code || '',
        address_notes: data.address_notes || '',
        reading_interests: Array.isArray(data.reading_interests) ? data.reading_interests : [],
        bank_card_number: data.bank_card_number || '',
        bank_iban: data.bank_iban || '',
      })
    }

    loadProfile()
    return () => {
      alive = false
    }
  }, [isMock, mock, user])

  const setField = (field: keyof ProfileForm, value: string | string[]) => {
    setProfile(current => ({ ...current, [field]: value }))
  }

  const toggleInterest = (tag: string) => {
    setProfile(current => {
      const exists = current.reading_interests.includes(tag)
      return {
        ...current,
        reading_interests: exists
          ? current.reading_interests.filter(item => item !== tag)
          : [...current.reading_interests, tag],
      }
    })
  }

  const showMessage = (text: string) => {
    setMessage(text)
    window.setTimeout(() => setMessage(''), 5000)
  }

  const handleAvatarFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !userId) return
    setUploadingAvatar(true)
    try {
      if (isMock) {
        const reader = new FileReader()
        reader.onload = () => setField('avatar_url', String(reader.result || ''))
        reader.readAsDataURL(file)
        return
      }

      const extension = file.name.split('.').pop() || 'jpg'
      const path = `${userId}/avatar-${Date.now()}.${extension}`
      const { error } = await (supabase as any).storage
        .from('profile-avatars')
        .upload(path, file, { cacheControl: '3600', upsert: true })
      if (error) throw error
      const { data } = (supabase as any).storage.from('profile-avatars').getPublicUrl(path)
      setField('avatar_url', data.publicUrl)
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'آپلود تصویر پروفایل ناموفق بود.')
    } finally {
      setUploadingAvatar(false)
      event.target.value = ''
    }
  }

  const savePassword = async () => {
    if (!user?.email) return
    if (password.length < 8) {
      showMessage('رمز عبور باید حداقل ۸ کاراکتر باشد.')
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
      showMessage('رمز عبور با موفقیت به‌روزرسانی شد.')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'تغییر رمز عبور ناموفق بود.')
    }
  }

  const saveProfile = async () => {
    if (!user || !userId) return
    setSaving(true)
    try {
      if (isMock) {
        saveProfileLocal(userId, profile)
      } else {
        const { error } = await (supabase as any).from('profiles').upsert({
          id: user.id,
          ...profile,
          updated_at: new Date().toISOString(),
        })
        if (error) throw error
        const { error: authError } = await supabase.auth.updateUser({
          data: { display_name: profile.display_name, phone: profile.phone, avatar_url: profile.avatar_url },
        })
        if (authError) throw authError
      }
      if (mock) {
        mock.display_name = profile.display_name
        mock.phone = profile.phone
        mock.national_id = profile.national_id
        mock.bio = profile.bio
      }
      showMessage('مشخصات پروفایل ذخیره شد.')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'ذخیره پروفایل ناموفق بود.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold font-display">{t('profile_title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">مشخصات، آدرس، علایق، اطلاعات مالی، امنیت و کردیت حساب کاربری</p>
        </div>
        <Button onClick={saveProfile} disabled={saving} className="gap-2">
          <ShieldCheck className="w-4 h-4" />
          {saving ? 'در حال ذخیره...' : 'ذخیره پروفایل'}
        </Button>
      </div>

      {message && <div className="mb-5 rounded-2xl border border-primary/20 bg-primary/10 p-4 text-sm text-primary">{message}</div>}

      <div className="grid xl:grid-cols-[0.9fr_1.4fr] gap-6">
        <section className="glass rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-6">
            <button type="button" onClick={() => avatarInputRef.current?.click()} className="relative group shrink-0" aria-label="آپلود تصویر پروفایل">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.display_name || user?.email || ''} className="w-24 h-24 rounded-3xl object-cover border" />
              ) : (
                <div className="w-24 h-24 rounded-3xl bg-primary/10 grid place-items-center border">
                  <User className="w-10 h-10 text-primary" />
                </div>
              )}
              <span className="absolute -bottom-2 -left-2 rounded-full bg-background border p-2 shadow transition group-hover:scale-105">
                <Camera className="w-4 h-4 text-primary" />
              </span>
              {uploadingAvatar && <span className="absolute inset-0 rounded-3xl bg-background/70 grid place-items-center text-xs font-bold">آپلود...</span>}
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarFile} className="hidden" />
            <div className="min-w-0">
              <h2 className="text-xl font-bold truncate">{profile.display_name || 'کاربر متابوکی'}</h2>
              <p className="text-sm text-muted-foreground truncate" dir="ltr">{user?.email}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {roles.map(role => <span key={role} className="text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5">{role}</span>)}
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <label className="grid gap-2 text-sm">
              <span className="text-muted-foreground">نام نمایشی</span>
              <input value={profile.display_name} onChange={event => setField('display_name', event.target.value)} className="rounded-xl border bg-background px-3 py-2" />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-muted-foreground">نام کاربری</span>
              <input value={profile.username} onChange={event => setField('username', event.target.value)} dir="ltr" className="rounded-xl border bg-background px-3 py-2" />
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="grid gap-2 text-sm">
                <span className="text-muted-foreground">شماره تلفن</span>
                <input value={profile.phone} onChange={event => setField('phone', event.target.value)} dir="ltr" className="rounded-xl border bg-background px-3 py-2" />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="text-muted-foreground">کد ملی</span>
                <input value={profile.national_id} onChange={event => setField('national_id', event.target.value)} dir="ltr" className="rounded-xl border bg-background px-3 py-2" />
              </label>
            </div>
            <label className="grid gap-2 text-sm">
              <span className="text-muted-foreground">بیو کوتاه</span>
              <textarea
                value={profile.bio}
                onChange={event => setField('bio', event.target.value.slice(0, 260))}
                rows={3}
                className="rounded-xl border bg-background px-3 py-2 resize-none"
                placeholder="دو سه خط درباره خودتان..."
              />
              <small className="text-muted-foreground">{profile.bio.length.toLocaleString('fa-IR')} / ۲۶۰ کاراکتر</small>
            </label>
          </div>
        </section>

        <section className="grid sm:grid-cols-2 gap-4">
          <div className="glass rounded-2xl p-5">
            <Wallet className="w-6 h-6 text-primary mb-3" />
            <p className="text-sm text-muted-foreground">کردیت فعلی</p>
            <strong className="text-3xl">{creditsLoading ? '...' : balance.toLocaleString('fa-IR')}</strong>
            {!creditsLoading && balance === 0 && !mock && (
              <p className="mt-2 text-xs text-muted-foreground leading-6">
                موجودی از جدول تراکنش‌های کردیت محاسبه می‌شود. اگر صفر است یعنی هنوز تراکنش شارژ یا اعتبار برای این کاربر ثبت نشده است.
              </p>
            )}
          </div>
          <div className="glass rounded-2xl p-5">
            <BookOpen className="w-6 h-6 text-primary mb-3" />
            <p className="text-sm text-muted-foreground">کتاب‌های مرتبط</p>
            <strong className="text-3xl">{userBooks.length.toLocaleString('fa-IR')}</strong>
          </div>
          <div className="glass rounded-2xl p-5">
            <Receipt className="w-6 h-6 text-primary mb-3" />
            <p className="text-sm text-muted-foreground">پرداخت‌ها و هزینه‌ها</p>
            <strong>در انتظار تکمیل گزارش تراکنش‌ها</strong>
          </div>
          <div className="glass rounded-2xl p-5">
            <IdCard className="w-6 h-6 text-primary mb-3" />
            <p className="text-sm text-muted-foreground">اطلاعات هویتی و مالی</p>
            <strong>{profile.bank_iban || profile.bank_card_number ? 'ثبت شده' : 'تکمیل نشده'}</strong>
          </div>
        </section>
      </div>

      <div className="grid xl:grid-cols-[1.1fr_0.9fr] gap-6 mt-6">
        <section className="glass rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><MapPin className="w-5 h-5 text-primary" />آدرس پستی و مشخصات اقامت</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <label className="profile-field"><span>استان</span><input value={profile.address_province} onChange={event => setField('address_province', event.target.value)} /></label>
            <label className="profile-field"><span>شهر</span><input value={profile.address_city} onChange={event => setField('address_city', event.target.value)} /></label>
            <label className="profile-field"><span>محله / منطقه</span><input value={profile.address_district} onChange={event => setField('address_district', event.target.value)} /></label>
            <label className="profile-field sm:col-span-2"><span>خیابان و نشانی اصلی</span><input value={profile.address_street} onChange={event => setField('address_street', event.target.value)} /></label>
            <label className="profile-field"><span>کوچه</span><input value={profile.address_alley} onChange={event => setField('address_alley', event.target.value)} /></label>
            <label className="profile-field"><span>پلاک</span><input value={profile.address_plaque} onChange={event => setField('address_plaque', event.target.value)} /></label>
            <label className="profile-field"><span>واحد</span><input value={profile.address_unit} onChange={event => setField('address_unit', event.target.value)} /></label>
            <label className="profile-field"><span>کد پستی</span><input dir="ltr" value={profile.postal_code} onChange={event => setField('postal_code', event.target.value.replace(/[^\d]/g, '').slice(0, 10))} /></label>
            <label className="profile-field sm:col-span-2 lg:col-span-3"><span>توضیح تکمیلی آدرس</span><textarea rows={2} value={profile.address_notes} onChange={event => setField('address_notes', event.target.value)} /></label>
          </div>
        </section>

        <section className="glass rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><Heart className="w-5 h-5 text-primary" />علایق کتابخوانی</h2>
          <p className="text-sm text-muted-foreground mb-4">این گزینه‌ها از دسته‌بندی و تگ‌های کتاب‌های سامانه ساخته می‌شوند.</p>
          <div className="flex flex-wrap gap-2 max-h-56 overflow-auto pr-1">
            {tagOptions.map(tag => (
              <button
                type="button"
                key={tag}
                onClick={() => toggleInterest(tag)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${profile.reading_interests.includes(tag) ? 'bg-primary text-primary-foreground border-primary shadow-glow' : 'bg-background/70 hover:bg-primary/10'}`}
              >
                {tag}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="grid xl:grid-cols-[1fr_1fr] gap-6 mt-6">
        <section className="glass rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5 text-primary" />اطلاعات مالی کاربر</h2>
          <div className="grid gap-3">
            <label className="profile-field">
              <span>شماره کارت بانکی</span>
              <input dir="ltr" value={profile.bank_card_number} onChange={event => setField('bank_card_number', normalizeCard(event.target.value))} placeholder="0000 0000 0000 0000" />
            </label>
            <label className="profile-field">
              <span>شماره شبای حساب</span>
              <input dir="ltr" value={profile.bank_iban} onChange={event => setField('bank_iban', normalizeIban(event.target.value))} placeholder="IR000000000000000000000000" />
            </label>
            <p className="text-xs text-muted-foreground leading-6">
              این اطلاعات برای تسویه‌ها و تراکنش‌های مالی بعدی ذخیره می‌شود و با RLS فقط برای خود کاربر و مدیر مجاز قابل دسترسی است.
            </p>
          </div>
        </section>

        <section className="glass rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><KeyRound className="w-5 h-5 text-primary" />امنیت حساب</h2>
          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
            <label className="profile-field">
              <span>رمز جدید</span>
              <input type="password" value={password} onChange={event => setPassword(event.target.value)} dir="ltr" placeholder="حداقل ۸ کاراکتر" />
            </label>
            <Button onClick={savePassword} disabled={password.length < 8}>ثبت رمز جدید</Button>
          </div>
        </section>
      </div>

      <section className="glass rounded-2xl p-6 mt-6">
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2"><Home className="w-5 h-5 text-primary" />کتاب‌های مرتبط با حساب</h2>
        <div className="space-y-2 max-h-56 overflow-auto pr-1">
          {userBooks.length ? (
            userBooks.map(book => (
              <div key={book.id} className="flex items-center justify-between rounded-xl bg-background/60 p-3 text-sm">
                <span>{book.title}</span>
                <span className="text-xs text-muted-foreground">{book.status === 'published' ? 'منتشر شده' : 'پیش‌نویس'}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">هنوز کتابی برای این حساب ثبت نشده است.</p>
          )}
        </div>
      </section>
    </div>
  )
}
