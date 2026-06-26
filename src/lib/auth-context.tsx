import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { MockUser } from '@/lib/mock-data'
import { getStoredCredits } from '@/lib/mock-user-store'
import type { Session, User } from '@supabase/supabase-js'

export type AppUser = User & { mockData?: MockUser }

interface AuthContextType {
  user: AppUser | null
  session: Session | null
  loading: boolean
  isMock: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<{ error: Error | null }>
  signInWithGoogle: () => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)
const ACTIVE_SESSION_KEY = 'metabooki_active_session_id'
const ACTIVE_SESSION_FRESH_MS = 45_000
const ACTIVE_SESSION_POLL_MS = 5_000
const ACTIVE_SESSION_HEARTBEAT_MS = 15_000
const ACTIVE_SESSION_COUNTDOWN = 10

async function mockAuthData() {
  return import('@/lib/mock-data')
}

function browserSessionId() {
  try {
    const saved = localStorage.getItem(ACTIVE_SESSION_KEY)
    if (saved) return saved
    const next = crypto.randomUUID()
    localStorage.setItem(ACTIVE_SESSION_KEY, next)
    return next
  } catch {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

function isFreshActiveSession(lastSeenAt?: string | null) {
  if (!lastSeenAt) return false
  return Date.now() - Date.parse(lastSeenAt) < ACTIVE_SESSION_FRESH_MS
}

type SessionLockState = {
  mode: 'claim' | 'kicked'
  countdown: number
  busy?: boolean
  error?: string
}

function ActiveSessionGuard({ user, hasSupabase, signOut }: { user: AppUser | null; hasSupabase: boolean; signOut: () => Promise<{ error: Error | null }> }) {
  const sessionId = useMemo(browserSessionId, [])
  const ownsSession = useRef(false)
  const [lock, setLock] = useState<SessionLockState | null>(null)

  const claimSession = useCallback(async () => {
    if (!user || !hasSupabase) return false
    const payload = {
      user_id: user.id,
      session_id: sessionId,
      user_agent: navigator.userAgent.slice(0, 300),
      last_seen_at: new Date().toISOString(),
      claimed_at: new Date().toISOString(),
    }
    const { error } = await (supabase as any).from('user_active_sessions').upsert(payload, { onConflict: 'user_id' })
    if (error) {
      setLock(current => current ? { ...current, busy: false, error: 'ثبت نشست فعال ناموفق بود. اتصال را بررسی کنید.' } : null)
      return false
    }
    ownsSession.current = true
    setLock(null)
    return true
  }, [hasSupabase, sessionId, user])

  const forceLocalSignOut = useCallback(async () => {
    ownsSession.current = false
    await signOut()
  }, [signOut])

  const checkSession = useCallback(async () => {
    if (!user || !hasSupabase) {
      ownsSession.current = false
      setLock(null)
      return
    }
    const { data, error } = await (supabase as any)
      .from('user_active_sessions')
      .select('session_id,last_seen_at')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) return
    if (!data || data.session_id === sessionId || !isFreshActiveSession(data.last_seen_at)) {
      await claimSession()
      return
    }
    if (ownsSession.current) {
      ownsSession.current = false
      setLock(current => current?.mode === 'kicked' ? current : { mode: 'kicked', countdown: ACTIVE_SESSION_COUNTDOWN })
      return
    }
    setLock(current => current?.mode === 'claim' ? current : { mode: 'claim', countdown: ACTIVE_SESSION_COUNTDOWN })
  }, [claimSession, hasSupabase, sessionId, user])

  useEffect(() => {
    void checkSession()
  }, [checkSession])

  useEffect(() => {
    if (!user || !hasSupabase) return
    const interval = window.setInterval(() => { void checkSession() }, ACTIVE_SESSION_POLL_MS)
    return () => window.clearInterval(interval)
  }, [checkSession, hasSupabase, user])

  useEffect(() => {
    if (!user || !hasSupabase) return
    const interval = window.setInterval(async () => {
      if (!ownsSession.current || lock) return
      const { data, error } = await (supabase as any)
        .from('user_active_sessions')
        .update({ last_seen_at: new Date().toISOString(), user_agent: navigator.userAgent.slice(0, 300) })
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .select('session_id')
        .maybeSingle()
      if (!error && !data) {
        ownsSession.current = false
        setLock({ mode: 'kicked', countdown: ACTIVE_SESSION_COUNTDOWN })
      }
    }, ACTIVE_SESSION_HEARTBEAT_MS)
    return () => window.clearInterval(interval)
  }, [hasSupabase, lock, sessionId, user])

  useEffect(() => {
    if (!lock) return
    const interval = window.setInterval(() => {
      setLock(current => {
        if (!current) return current
        if (current.countdown <= 1) {
          window.setTimeout(() => { void forceLocalSignOut() }, 0)
          return { ...current, countdown: 0 }
        }
        return { ...current, countdown: current.countdown - 1 }
      })
    }, 1000)
    return () => window.clearInterval(interval)
  }, [forceLocalSignOut, lock])

  const continueHere = async () => {
    setLock(current => current ? { ...current, busy: true, error: '' } : current)
    await claimSession()
  }

  const leaveHere = async () => {
    await forceLocalSignOut()
  }

  if (!lock || !user || !hasSupabase) return null
  const isClaim = lock.mode === 'claim'
  return (
    <div className="active-session-backdrop" role="dialog" aria-modal="true" aria-labelledby="active-session-title">
      <section className="active-session-modal menu-glass-70">
        <div className="active-session-orb">{lock.countdown.toLocaleString('fa-IR')}</div>
        <div>
          <p className="active-session-eyebrow">امنیت حساب</p>
          <h2 id="active-session-title">{isClaim ? 'این حساب در جای دیگری فعال است' : 'این حساب از جای دیگری فعال شد'}</h2>
          <p>
            {isClaim
              ? 'برای جلوگیری از ویرایش همزمان و تداخل داده‌ها، فقط یک نشست فعال برای هر حساب مجاز است. اگر می‌خواهید همینجا ادامه دهید، نشست قبلی بسته می‌شود.'
              : 'نشست دیگری برای همین حساب فعال شده است. برای جلوگیری از تغییرات همزمان، این نشست تا چند ثانیه دیگر بسته می‌شود.'}
          </p>
          {lock.error && <p className="active-session-error">{lock.error}</p>}
        </div>
        <div className="active-session-actions">
          {isClaim && <button type="button" className="active-session-primary" disabled={lock.busy} onClick={continueHere}>{lock.busy ? 'در حال انتقال...' : 'ادامه در همینجا'}</button>}
          <button type="button" className="active-session-secondary" onClick={leaveHere}>{isClaim ? 'خروج از اینجا' : 'خروج اکنون'}</button>
        </div>
      </section>
    </div>
  )
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isMock, setIsMock] = useState(false)

  const hasSupabase = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL.startsWith('http')

  // Initialize auth state
  useEffect(() => {
    if (hasSupabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session)
        setUser(session?.user as AppUser ?? null)
        setLoading(false)
        setIsMock(false)
      })
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'TOKEN_REFRESHED' && !session) return
        if (event === 'SIGNED_OUT') { setUser(null); setSession(null) }
        else { setSession(session); setUser(session?.user as AppUser ?? null) }
      })
      return () => subscription.unsubscribe()
    } else {
      let cancelled = false
      ;(async () => {
        const savedEmail = localStorage.getItem('metabooki_mock_user')
        if (savedEmail) {
          const { findUserByEmail } = await mockAuthData()
          if (cancelled) return
          const mockUser = findUserByEmail(savedEmail)
          if (mockUser) {
            const storedCredits = getStoredCredits(mockUser.id, mockUser.credits)
            const userWithCredits = { ...mockUser, credits: storedCredits }
            setUser({ id: mockUser.id, email: mockUser.email, mockData: userWithCredits } as unknown as AppUser)
          }
        }
        if (!cancelled) {
          setLoading(false)
          setIsMock(true)
        }
      })()
      return () => { cancelled = true }
    }
  }, [hasSupabase])

  const signIn = useCallback(async (email: string, password: string) => {
    if (hasSupabase) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error }
    }
    const { findUserByEmail } = await mockAuthData()
    const mockUser = findUserByEmail(email)
    if (!mockUser) return { error: new Error('کاربر یافت نشد') }
    if (mockUser.password !== password) return { error: new Error('رمز عبور اشتباه است') }
    localStorage.setItem('metabooki_mock_user', mockUser.email)
    // Load persisted credits from localStorage
    const storedCredits = getStoredCredits(mockUser.id, mockUser.credits)
    const userWithCredits = { ...mockUser, credits: storedCredits }
    setUser({ id: mockUser.id, email: mockUser.email, mockData: userWithCredits } as unknown as AppUser)
    setIsMock(true)
    return { error: null }
  }, [hasSupabase])

  const signUp = useCallback(async (email: string, password: string) => {
    if (hasSupabase) {
      const { error } = await supabase.auth.signUp({ email, password })
      return { error }
    }
    return { error: new Error('ثبت‌نام در حالت دمو پشتیبانی نمی‌شود') }
  }, [hasSupabase])

  const signOut = useCallback(async () => {
    if (hasSupabase) {
      const activeSessionId = localStorage.getItem(ACTIVE_SESSION_KEY)
      if (activeSessionId) {
        await (supabase as any).from('user_active_sessions').delete().eq('session_id', activeSessionId)
      }
      const { error } = await supabase.auth.signOut()
      return { error }
    }
    localStorage.removeItem('metabooki_mock_user')
    setUser(null)
    setIsMock(false)
    return { error: null }
  }, [hasSupabase])

  const signInWithGoogle = useCallback(async () => {
    if (hasSupabase) {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}auth/callback` } })
      return { error }
    }
    return { error: new Error('ورود با گوگل در حالت دمو پشتیبانی نمی‌شود') }
  }, [hasSupabase])

  return (
    <AuthContext.Provider value={{ user, session, loading, isMock, signIn, signUp, signOut, signInWithGoogle }}>
      {children}
      <ActiveSessionGuard user={user} hasSupabase={Boolean(hasSupabase)} signOut={signOut} />
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider')
  return ctx
}
