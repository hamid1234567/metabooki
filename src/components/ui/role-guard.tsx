import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthContext } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import { useRoles } from '@/hooks/useRoles'

interface RoleGuardProps { children: React.ReactNode; roles: string[]; redirectTo?: string }

export function RoleGuard({ children, roles, redirectTo = '/auth' }: RoleGuardProps) {
  const { user, loading } = useAuthContext()
  const { t } = useI18n()
  const { roles: userRoles, loading: rolesLoading } = useRoles(user)

  if (loading || rolesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to={redirectTo} replace />

  const hasRole = userRoles.some(role => roles.includes(role))
  if (!hasRole) return <Navigate to="/" replace />

  return <>{children}</>
}
