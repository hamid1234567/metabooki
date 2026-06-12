import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, Building2, CreditCard, Languages, LogOut, Menu, Moon, Shield, Store, Sun, User, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthContext } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'
import { creditsBus } from '@/lib/credits-bus'
import metabookiMark from '@/assets/metabooki-mark.svg'
import { useCredits } from '@/hooks/useCredits'
import { useRoles } from '@/hooks/useRoles'

export function Navbar() {
  const { user, signOut } = useAuthContext()
  const { t, lang, setLang } = useI18n()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [creditFlash, setCreditFlash] = useState(false)
  const [displayBalance, setDisplayBalance] = useState(0)
  const mockData = user?.mockData
  const { balance } = useCredits(user)
  const { isAdmin, isPublisher, isEditor } = useRoles(user)
  const displayName = mockData?.display_name || user?.email?.split('@')[0] || ''
  const themes = ['silver', 'sky', 'paper', 'midnight'] as const
  const userInitials = displayName.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'U'

  useEffect(() => setDisplayBalance(balance), [balance])
  useEffect(() => {
    const unsubscribe = creditsBus.subscribe(newBalance => {
      setDisplayBalance(newBalance)
      setCreditFlash(true)
      setTimeout(() => setCreditFlash(false), 1500)
    })
    return () => { unsubscribe() }
  }, [])
  useEffect(() => setMobileMenuOpen(false), [location.pathname])

  const cycleTheme = () => setTheme(themes[(themes.indexOf(theme as typeof themes[number]) + 1) % themes.length])
  const handleSignOut = async () => {
    await signOut()
    setMobileMenuOpen(false)
    navigate('/')
  }
  const navLinkClass = (active: boolean) => `nav-pill ${active ? 'nav-pill-active' : ''}`

  return (
    <nav className="app-top-nav">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-2">
          <Link to="/" className="brand-lockup shrink-0">
            <img src={metabookiMark} alt="Metabooki" className="h-9 w-9 object-contain" />
            <span className="hidden sm:inline">متابوکی</span>
          </Link>

          <div className="hidden items-center gap-2 md:flex">
            <Link to="/store" className={navLinkClass(location.pathname === '/store')}><Store className="w-4 h-4" />{t('nav_store')}</Link>
            {user && <Link to="/library" className={navLinkClass(location.pathname === '/library')}><BookOpen className="w-4 h-4" />{t('nav_library')}</Link>}
            {(isPublisher || isEditor || isAdmin) && <Link to="/publisher/me" className={navLinkClass(location.pathname.startsWith('/publisher'))}><Building2 className="w-4 h-4" />انتشارات</Link>}
            {isAdmin && <Link to="/admin" className={navLinkClass(location.pathname === '/admin')}><Shield className="w-4 h-4" />{t('nav_admin')}</Link>}
          </div>

          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            {user && <Link to="/credits" className={`credit-chip ${creditFlash ? 'credit-chip-flash' : ''}`} title="اعتبار"><CreditCard className="w-4 h-4" /><span>{displayBalance.toLocaleString('fa-IR')}</span></Link>}
            {user && <Link to="/profile" className="user-name-chip hidden md:inline-flex" title={displayName}><User className="w-4 h-4" /><span>{displayName}</span></Link>}
            {user && <Link to="/profile" className="user-avatar-chip md:hidden" title={displayName}>{userInitials.slice(0, 2)}</Link>}

            <Button className="hidden md:inline-flex" variant="ghost" size="icon" onClick={() => setLang(lang === 'fa' ? 'en' : 'fa')} title={lang === 'fa' ? 'English' : 'فارسی'}><Languages className="w-5 h-5" /></Button>
            <Button className="hidden md:inline-flex" variant="ghost" size="icon" onClick={cycleTheme} title="تغییر تم">{theme === 'midnight' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}</Button>

            {user ? (
              <Button className="hidden md:inline-flex" variant="ghost" size="icon" onClick={handleSignOut} title="خروج"><LogOut className="w-5 h-5" /></Button>
            ) : (
              <Link to="/auth" className="hidden md:block"><Button size="sm">{t('nav_login')}</Button></Link>
            )}
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(open => !open)} aria-label="منوی سایت">
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <>
          <button className="fixed inset-0 top-16 z-40 md:hidden menu-backdrop-blur" onClick={() => setMobileMenuOpen(false)} aria-label="بستن منو" />
          <div className="mobile-menu-panel md:hidden">
            <div className="space-y-1 px-3 py-3">
              {user && <Link to="/profile" className="mobile-user-summary"><span className="user-avatar-chip">{userInitials.slice(0, 2)}</span><span className="min-w-0"><b className="block truncate">{displayName}</b><small>{displayBalance.toLocaleString('fa-IR')} کردیت</small></span></Link>}
              <Link to="/store" className="mobile-menu-row"><Store className="w-4 h-4" />فروشگاه</Link>
              {user && <Link to="/library" className="mobile-menu-row"><BookOpen className="w-4 h-4" />قفسه من</Link>}
              {user && <Link to="/credits" className="mobile-menu-row"><CreditCard className="w-4 h-4" />اعتبار و تراکنش‌ها</Link>}
              {(isPublisher || isEditor || isAdmin) && <Link to="/publisher/me" className="mobile-menu-row"><Building2 className="w-4 h-4" />انتشارات</Link>}
              {isAdmin && <Link to="/admin" className="mobile-menu-row"><Shield className="w-4 h-4" />مدیریت</Link>}
              <div className="mobile-menu-actions">
                <Button variant="outline" size="sm" onClick={() => setLang(lang === 'fa' ? 'en' : 'fa')} className="gap-2"><Languages className="w-4 h-4" />{lang === 'fa' ? 'English' : 'فارسی'}</Button>
                <Button variant="outline" size="sm" onClick={cycleTheme} className="gap-2">{theme === 'midnight' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}تم</Button>
                {user ? <Button variant="destructive" size="sm" onClick={handleSignOut} className="gap-2"><LogOut className="w-4 h-4" />خروج</Button> : <Link to="/auth"><Button size="sm" className="w-full">ورود</Button></Link>}
              </div>
            </div>
          </div>
        </>
      )}
    </nav>
  )
}
