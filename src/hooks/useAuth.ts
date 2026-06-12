import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { mockUsers, findUserByEmail, type MockUser } from '@/lib/mock-data'
import type { Session, User } from '@supabase/supabase-js'

// Unified user type that works with both Supabase and mock
export type AppUser = User & { mockData?: MockUser }

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isMock, setIsMock] = useState(false)

  // Check if Supabase is configured
  const hasSupabase = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL.startsWith('http')

  // Restore mock session from localStorage
  useEffect(() => {
    if (hasSupabase) {
      // Use real Supabase
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session)
        setUser(session?.user as AppUser ?? null)
        setLoading(false)
        setIsMock(false)
      })

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'TOKEN_REFRESHED' && !session) {
          return
        }
        if (event === 'SIGNED_OUT') {
          setUser(null)
          setSession(null)
        } else {
          setSession(session)
          setUser(session?.user as AppUser ?? null)
        }
      })

      return () => {
        subscription.unsubscribe()
      }
    } else {
      // Use mock auth
      const savedEmail = localStorage.getItem('metabooki_mock_user')
      if (savedEmail) {
        const mockUser = findUserByEmail(savedEmail)
        if (mockUser) {
          setUser({
            id: mockUser.id,
            email: mockUser.email,
            mockData: mockUser,
          } as unknown as AppUser)
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
    } else {
      const mockUser = findUserByEmail(email)
      if (!mockUser) {
        return { error: new Error('کاربر یافت نشد') }
      }
      if (mockUser.password !== password) {
        return { error: new Error('رمز عبور اشتباه است') }
      }
      localStorage.setItem('metabooki_mock_user', mockUser.email)
      setUser({
        id: mockUser.id,
        email: mockUser.email,
        mockData: mockUser,
      } as unknown as AppUser)
      setIsMock(true)
      return { error: null }
    }
  }, [hasSupabase])

  const signUp = useCallback(async (email: string, password: string) => {
    if (hasSupabase) {
      const { error } = await supabase.auth.signUp({ email, password })
      return { error }
    } else {
      return { error: new Error('ثبت‌نام در حالت دمو پشتیبانی نمی‌شود') }
    }
  }, [hasSupabase])

  const signOut = useCallback(async () => {
    if (hasSupabase) {
      const { error } = await supabase.auth.signOut()
      return { error }
    } else {
      localStorage.removeItem('metabooki_mock_user')
      setUser(null)
      setIsMock(false)
      return { error: null }
    }
  }, [hasSupabase])

  const signInWithGoogle = useCallback(async () => {
    if (hasSupabase) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      return { error }
    } else {
      return { error: new Error('ورود با گوگل در حالت دمو پشتیبانی نمی‌شود') }
    }
  }, [hasSupabase])

  return {
    user,
    session,
    loading,
    isMock,
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
  }
}