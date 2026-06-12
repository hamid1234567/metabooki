import type { Database } from './types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Mock client for when Supabase is not configured
function createMockClient() {
  const emptyPromise = Promise.resolve({ data: null, error: null })
  return {
    auth: {
      getSession: () => emptyPromise,
      signInWithPassword: () => emptyPromise,
      signUp: () => emptyPromise,
      signOut: () => emptyPromise,
      signInWithOAuth: () => emptyPromise,
      onAuthStateChange: (_cb: Function) => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ order: () => ({ limit: () => emptyPromise }) }) }),
      insert: () => emptyPromise,
      update: () => ({ eq: () => emptyPromise }),
      delete: () => ({ eq: () => emptyPromise }),
    }),
    rpc: () => ({ single: () => emptyPromise }),
    channel: () => ({
      on: () => ({ subscribe: () => ({}) }),
    }),
    removeChannel: () => {},
  }
}

// Only create real client when properly configured
let client: any
if (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http')) {
  const { createClient } = await import('@supabase/supabase-js')
  client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
} else {
  console.warn('⚠️ Supabase not configured. Running in demo mode. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env')
  client = createMockClient()
}

export const supabase = client as ReturnType<typeof import('@supabase/supabase-js').createClient<Database>>