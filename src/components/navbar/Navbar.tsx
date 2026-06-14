import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { BookOpen, Building2, CircleUserRound, CreditCard, Home, Languages, LogOut, Menu, Moon, Shield, Store, Sun, User, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthContext } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'
import { creditsBus } from '@/lib/credits-bus'
import metabookiMark from '@/assets/metabooki-mark.png'
import { useCredits } from '@/hooks/useCredits'
import { useRoles } from '@/hooks/useRoles'
import { APP_VERSION } from '@/lib/version'

export function Navbar() {
  const { user, signOut } = useAuthContext()
  const { t, lang, setLang } = useI18n()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const [siteMenuOpen, setSiteMenuOpen] = useState(false)
  const [creditFlash, setCreditFlash] = useState(false)
  const [eventBalance, setEventBalance] = useState<number | null>(null)
  const { balance } = useCredits(user)
  const { isAdmin, isPublisher, isEditor } = useRoles(user)
  const displayName = String(user?.mockData?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || '')
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || ''
  const themes = ['silver', 'sky', 'paper', 'midnight'] as const
  const userInitials = displayName.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'U'

  useEffect(() => {
    const unsubscribe = creditsBus.subscribe(newBalance => {
      setEventBalance(newBalance)
      setCreditFlash(true)
      setTimeout(() => setCreditFlash(false), 1500)
    })
    return () => { unsubscribe() }
  }, [])
  const cycleTheme = () => setTheme(themes[(themes.indexOf(theme as typeof themes[number]) + 1) % themes.length])
  const closeMenu = () => setSiteMenuOpen(false)
  const displayBalance = eventBalance ?? balance
  const handleSignOut = async () => {
    await signOut()
    closeMenu()
    navigate('/')
  }
  const desktopLinkClass = ({ isActive }: { isActive: boolean }) => `nav-pill ${isActive ? 'nav-pill-active' : ''}`

  return (
    <>
      <nav className="app-top-nav">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-2">
            <Link to="/" className="brand-lockup shrink-0">
              <img src={metabookiMark} alt="Metabooki" className="h-9 w-auto max-w-16 object-contain" />
              <span className="hidden sm:inline">متابوکی</span>
              <span className="app-version-chip">v{APP_VERSION}</span>
            </Link>

            <div className="desktop-primary-nav" aria-label="منوهای اصلی">
              <NavLink to="/" end onClick={closeMenu} className={desktopLinkClass}><Home className="w-4 h-4" />خانه</NavLink>
              <NavLink to="/store" onClick={closeMenu} className={desktopLinkClass}><Store className="w-4 h-4" />فروشگاه</NavLink>
            </div>

            <div className="top-nav-actions">
              {user && (
                <Link to="/credits" className={`credit-chip ${creditFlash ? 'credit-chip-flash' : ''}`} title="اعتبار">
                  <CreditCard className="w-4 h-4" /><span>{displayBalance.toLocaleString('fa-IR')}</span>
                </Link>
              )}

              {user ? (
                <Link to="/profile" onClick={closeMenu} className="user-menu-trigger" title={displayName}>
                  {avatarUrl ? <img src={avatarUrl} alt={displayName} /> : <span className="user-avatar-chip">{userInitials.slice(0, 2)}</span>}
                  <span className="hidden sm:block">{displayName}</span>
                </Link>
              ) : (
                <Link to="/auth" className="top-login-trigger" title={t('nav_login')}>
                  <CircleUserRound className="w-5 h-5" /><span className="hidden sm:inline">{t('nav_login')}</span>
                </Link>
              )}

              <Button variant="ghost" size="icon" onClick={() => setSiteMenuOpen(open => !open)} aria-label="منوی سایت" aria-expanded={siteMenuOpen}>
                {siteMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {siteMenuOpen && <button className="fixed inset-0 top-16 z-40 menu-backdrop-blur" onClick={closeMenu} aria-label="بستن منو" />}

      {siteMenuOpen && (
        <div className="nav-glass-panel frosted-menu-surface site-menu-panel" onClick={event => {
          if ((event.target as HTMLElement).closest('a')) closeMenu()
        }}>
          <div className="mobile-primary-menu">
            <Link to="/" className="mobile-menu-row"><Home className="w-4 h-4" />خانه</Link>
            <Link to="/store" className="mobile-menu-row"><Store className="w-4 h-4" />فروشگاه</Link>
          </div>

          {user && (
            <>
              <div className="nav-menu-divider" />
              <div className="mobile-user-summary">
                {avatarUrl ? <img src={avatarUrl} alt={displayName} className="user-avatar-chip object-cover" /> : <span className="user-avatar-chip">{userInitials.slice(0, 2)}</span>}
                <span className="min-w-0"><b className="block truncate">{displayName}</b><small className="block truncate">{user.email}</small></span>
              </div>
              <div className="space-y-1">
                <Link to="/profile" className="mobile-menu-row"><User className="w-4 h-4" />پروفایل من</Link>
                <Link to="/library" className="mobile-menu-row"><BookOpen className="w-4 h-4" />قفسه من</Link>
                <Link to="/credits" className="mobile-menu-row"><CreditCard className="w-4 h-4" />اعتبار و تراکنش‌ها</Link>
                {(isPublisher || isEditor || isAdmin) && <Link to="/publisher/me" className="mobile-menu-row"><Building2 className="w-4 h-4" />انتشارات</Link>}
                {isAdmin && <Link to="/admin" className="mobile-menu-row"><Shield className="w-4 h-4" />مدیریت</Link>}
                <button type="button" onClick={handleSignOut} className="mobile-menu-row nav-logout-row"><LogOut className="w-4 h-4" />خروج از حساب</button>
              </div>
            </>
          )}

          {!user && (
            <>
              <div className="nav-menu-divider" />
              <Link to="/auth" className="mobile-menu-row"><CircleUserRound className="w-4 h-4" />ورود یا ثبت‌نام</Link>
            </>
          )}

          <div className="nav-menu-divider" />
          <div className="mobile-menu-actions">
            <Button variant="outline" size="sm" onClick={() => setLang(lang === 'fa' ? 'en' : 'fa')} className="gap-2"><Languages className="w-4 h-4" />{lang === 'fa' ? 'English' : 'فارسی'}</Button>
            <Button variant="outline" size="sm" onClick={cycleTheme} className="gap-2">{theme === 'midnight' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}تم</Button>
          </div>
          <div className="nav-version-status"><span>نسخه همگام‌شده</span><b>v{APP_VERSION}</b></div>
        </div>
      )}
    </>
  )
}
