import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { mockUsers, findUserByEmail, type MockUser } from '@/lib/mock-data'
import { getStoredCredits, saveCredits } from '@/lib/mock-user-store'
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
      const savedEmail = localStorage.getItem('metabooki_mock_user')
      if (savedEmail) {
        const mockUser = findUserByEmail(savedEmail)
        if (mockUser) {
          const storedCredits = getStoredCredits(mockUser.id, mockUser.credits)
          const userWithCredits = { ...mockUser, credits: storedCredits }
          setUser({ id: mockUser.id, email: mockUser.email, mockData: userWithCredits } as unknown as AppUser)
        }
      }
      setLoading(false)
      setIsMock(true)
    }
  }, [hasSupabase])

  const signIn = useCallback(async (email: string, password: string) => {
    if (hasSupabase) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error }
    }
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
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider')
  return ctx
}
