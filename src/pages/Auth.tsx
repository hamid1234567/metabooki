import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { BookOpen, Lock, LogIn, Mail, User as UserIcon } from 'lucide-react'
import { useAuthContext } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/components/ui/button'

const authSchema = z.object({
  email: z.string().email('ایمیل معتبر وارد کنید'),
  password: z.string().min(8, 'رمز عبور باید حداقل ۸ کاراکتر باشد'),
})

type AuthForm = z.infer<typeof authSchema>
type AuthMode = 'login' | 'register'

const quickLoginUsers = [
  { id: 'quick-publisher', email: 'publisher@metabooki.local', password: 'test1234', display_name: 'ناشر نمونه', icon: BookOpen, color: 'text-green-600', label: 'ناشر' },
  { id: 'quick-reader-1', email: 'reader1@metabooki.local', password: 'test1234', display_name: 'کاربر نمونه ۱', icon: UserIcon, color: 'text-purple-600', label: 'کاربر' },
  { id: 'quick-reader-2', email: 'reader2@metabooki.local', password: 'test1234', display_name: 'کاربر نمونه ۲', icon: UserIcon, color: 'text-blue-600', label: 'کاربر' },
]

export default function Auth() {
  const { signIn, signUp, signInWithGoogle } = useAuthContext()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [mode, setMode] = useState<AuthMode>('login')
  const form = useForm<AuthForm>({ resolver: zodResolver(authSchema) })

  const submit = async (data: AuthForm) => {
    const { error } = mode === 'login'
      ? await signIn(data.email, data.password)
      : await signUp(data.email, data.password)

    if (error) {
      toast.error(error.message)
      return
    }
    if (mode === 'register') {
      toast.success('حساب ساخته شد. در صورت دریافت ایمیل تأیید، آن را تأیید کنید.')
      setMode('login')
      return
    }
    toast.success('خوش آمدید!')
    navigate('/')
  }

  const quickLogin = async (email: string, password: string) => {
    const { error } = await signIn(email, password)
    if (error) toast.error(error.message)
    else navigate('/')
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg space-y-6">
        <div className="glass rounded-2xl p-6">
          <div className="mb-4 flex items-center gap-2">
            <LogIn className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">ورود سریع حساب‌های آزمایشی</h2>
          </div>
          <div className="grid gap-2">
            {quickLoginUsers.map(user => (
              <button key={user.id} type="button" onClick={() => quickLogin(user.email, user.password)}
                className="flex w-full items-center gap-3 rounded-xl border bg-background/70 p-3 text-right transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                <user.icon className={`h-5 w-5 ${user.color}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{user.display_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
                <span className="text-xs text-muted-foreground">{user.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="mx-auto mb-6 grid max-w-xs grid-cols-2 rounded-xl bg-muted/70 p-1">
            <ModeButton active={mode === 'login'} onClick={() => setMode('login')}>ورود</ModeButton>
            <ModeButton active={mode === 'register'} onClick={() => setMode('register')}>ثبت‌نام</ModeButton>
          </div>

          <div className="mb-6 text-center">
            <h1 className="mb-2 text-xl font-bold font-display">{mode === 'login' ? t('auth_login') : t('auth_register')}</h1>
            <p className="text-sm text-muted-foreground">{mode === 'login' ? 'با ایمیل و رمز عبور وارد شوید' : 'حساب متابوکی خود را بسازید'}</p>
          </div>

          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input {...form.register('email')} type="email" autoComplete="email" placeholder={t('auth_email')}
                className="w-full rounded-xl border border-input bg-background py-2.5 pl-4 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input {...form.register('password')} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={t('auth_password')}
                className="w-full rounded-xl border border-input bg-background py-2.5 pl-4 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            {(form.formState.errors.email || form.formState.errors.password) && (
              <p className="text-sm text-destructive">{form.formState.errors.email?.message || form.formState.errors.password?.message}</p>
            )}
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {mode === 'login' ? t('auth_login') : t('auth_register')}
            </Button>
            <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="w-full text-sm font-medium text-primary hover:underline">
              {mode === 'login' ? 'حساب ندارید؟ ثبت‌نام کنید' : 'قبلاً ثبت‌نام کرده‌اید؟ وارد شوید'}
            </button>
            {mode === 'login' && (
              <Button type="button" variant="outline" className="w-full" onClick={() => signInWithGoogle().then(result => result.error && toast.error(result.error.message))}>
                ورود با گوگل
              </Button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition ${active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
      {children}
    </button>
  )
}
