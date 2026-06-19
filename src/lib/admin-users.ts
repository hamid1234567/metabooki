import { supabase } from '@/integrations/supabase/client'
import { mockUsers, setMockUserPassword, type MockUser } from '@/lib/mock-data'

export type AdminUserRow = {
  id: string
  email: string
  displayName?: string
  roles: string[]
  credits?: number
  lastSignInAt?: string | null
  createdAt?: string | null
  isMock?: boolean
}

export function listMockAdminUsers(): AdminUserRow[] {
  return mockUsers.map((user: MockUser) => ({
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    roles: user.roles,
    credits: user.credits,
    isMock: true,
  }))
}

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const hasSupabase = Boolean(import.meta.env.VITE_SUPABASE_URL?.startsWith('http'))
  if (!hasSupabase) return listMockAdminUsers()
  const { data, error } = await supabase.functions.invoke('admin-users', { body: { operation: 'list_users' } })
  if (error) throw new Error(error.message)
  return (data?.users || []) as AdminUserRow[]
}

export async function setAdminUserPassword(email: string, password: string) {
  const hasSupabase = Boolean(import.meta.env.VITE_SUPABASE_URL?.startsWith('http'))
  if (!hasSupabase) {
    if (!setMockUserPassword(email, password)) throw new Error('کاربر پیدا نشد.')
    return { ok: true, mode: 'mock' as const }
  }
  const { data, error } = await supabase.functions.invoke('admin-users', { body: { operation: 'set_password', email, password } })
  if (error) throw new Error(error.message)
  return data
}

export async function sendAdminPasswordReset(email: string) {
  const hasSupabase = Boolean(import.meta.env.VITE_SUPABASE_URL?.startsWith('http'))
  if (!hasSupabase) return { ok: true, mode: 'mock' as const }
  const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}auth`
  const { data, error } = await supabase.functions.invoke('admin-users', { body: { operation: 'send_reset', email, redirectTo } })
  if (error) throw new Error(error.message)
  return data
}
