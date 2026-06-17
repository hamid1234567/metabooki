import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { AppUser } from '@/hooks/useAuth'

function normalizeRoles(user: AppUser, databaseRoles: string[] = []) {
  const metadata = { ...(user.app_metadata || {}), ...(user.user_metadata || {}) } as Record<string, unknown>
  const metadataRoles = [
    ...(Array.isArray(metadata.roles) ? metadata.roles : []),
    ...(typeof metadata.role === 'string' ? [metadata.role] : []),
  ].filter((role): role is string => typeof role === 'string')
  return [...new Set(['user', ...databaseRoles, ...metadataRoles])]
}

export function useRoles(user: AppUser | null) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [isPublisher, setIsPublisher] = useState(false)
  const [isEditor, setIsEditor] = useState(false)
  const [roles, setRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRoles() {
      if (!user) {
        setIsAdmin(false)
        setIsSuperAdmin(false)
        setIsPublisher(false)
        setIsEditor(false)
        setRoles([])
        setLoading(false)
        return
      }

      // Check for mock data first
      if (user.mockData) {
        const mockRoles = user.mockData.roles
        setRoles(mockRoles)
        setIsAdmin(mockRoles.includes('admin') || mockRoles.includes('super_admin'))
        setIsSuperAdmin(mockRoles.includes('super_admin'))
        setIsPublisher(mockRoles.includes('publisher'))
        setIsEditor(mockRoles.includes('editor'))
        setLoading(false)
        return
      }

      // Real Supabase
      try {
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)

        let roleNames = normalizeRoles(user, ((userRoles || []) as { role: string }[]).map(r => r.role))
        if (!roleNames.includes('publisher')) {
          const publisher = await supabase
            .from('publisher_profiles')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle()
          if ((publisher.data as { id?: string } | null)?.id) roleNames = [...roleNames, 'publisher']
        }
        setRoles(roleNames)
        setIsAdmin(roleNames.includes('admin') || roleNames.includes('super_admin'))
        setIsSuperAdmin(roleNames.includes('super_admin'))
        setIsPublisher(roleNames.includes('publisher'))
        setIsEditor(roleNames.includes('editor'))
      } catch (e) {
        console.warn('Error fetching roles:', e)
      } finally {
        setLoading(false)
      }
    }

    fetchRoles()
  }, [user])

  return { isAdmin, isSuperAdmin, isPublisher, isEditor, roles, loading }
}
