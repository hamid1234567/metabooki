import type { Database } from './types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

function wait(ms: number) {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

function requestInfoUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function requestInfoMethod(input: RequestInfo | URL, init?: RequestInit) {
  return String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
}

function shouldRetrySupabaseRequest(input: RequestInfo | URL, init?: RequestInit) {
  const method = requestInfoMethod(input, init)
  const url = requestInfoUrl(input)
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true
  if (method === 'POST' && url.includes('/auth/v1/token')) return true
  if (method === 'POST' && url.includes('/auth/v1/signup')) return true
  return false
}

async function supabaseFetchWithRetry(input: RequestInfo | URL, init?: RequestInit) {
  const retryable = shouldRetrySupabaseRequest(input, init)
  const attempts = retryable ? 3 : 1
  let lastError: unknown = null
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(input, init)
      if (!retryable || ![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === attempts) {
        return response
      }
      await wait(420 * attempt)
    } catch (error) {
      lastError = error
      if (!retryable || attempt === attempts) throw error
      await wait(520 * attempt)
    }
  }
  throw lastError
}

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
    global: {
      fetch: supabaseFetchWithRetry,
    },
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
