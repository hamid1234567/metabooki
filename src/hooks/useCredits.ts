import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { AppUser } from '@/hooks/useAuth'
import { creditsBus } from '@/lib/credits-bus'

export function useCredits(user: AppUser | null) {
  const [balance, setBalance] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setBalance(0)
      setLoading(false)
      return
    }

    // Use mock credits if available
    if (user.mockData) {
      setBalance(user.mockData.credits)
      setLoading(false)
      return
    }

    // Real Supabase
    async function fetchBalance() {
      try {
        const { data: transactions } = await supabase
          .from('credit_transactions')
          .select('amount')
          .eq('user_id', user!.id)

        const sum = (transactions || []).reduce((acc: number, t: any) => acc + (t.amount || 0), 0)
        setBalance(sum)
      } catch (e) {
        console.warn('Error fetching credits:', e)
      } finally {
        setLoading(false)
      }
    }

    fetchBalance()
  }, [user])

  useEffect(() => {
    const unsubscribe = creditsBus.subscribe(setBalance)
    return () => {
      unsubscribe()
    }
  }, [])

  return { balance, loading }
}
