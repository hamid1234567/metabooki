import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthContext } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import { useRoles } from '@/hooks/useRoles'
import { Button } from '@/components/ui/button'

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
  if (!hasRole) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="menu-glass-70 rounded-3xl p-8">
          <h1 className="mb-3 text-2xl font-black">دسترسی این بخش برای حساب شما فعال نیست</h1>
          <p className="mb-6 text-sm leading-8 text-muted-foreground">
            اگر تازه وارد شده‌اید، چند ثانیه صبر کنید و دوباره همین صفحه را تازه‌سازی کنید. مسیر صفحه حفظ می‌شود و به خانه منتقل نمی‌شوید.
          </p>
          <Button onClick={() => window.location.reload()}>تلاش دوباره</Button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
