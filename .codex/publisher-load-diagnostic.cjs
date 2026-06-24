const fs = require('fs')
const path = require('path')
const { performance } = require('perf_hooks')
const { createClient } = require('@supabase/supabase-js')

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return {}
  return Object.fromEntries(fs.readFileSync(envPath, 'utf8').split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#')).map(line => {
    const idx = line.indexOf('=')
    return idx >= 0 ? [line.slice(0, idx).trim(), line.slice(idx + 1).trim()] : [line, '']
  }))
}

const env = loadEnv()
const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const email = 'mohammadi219@gmail.com'
const password = process.env.METABOOKI_DIAG_PASSWORD || process.argv[2] || 'Hamid@219'
const columns = 'id,title,subtitle,description,cover_url,back_cover_url,preview_pages,price,status,review_status,publisher_id,language,tags,metadata,series_id,series_order,created_at'

function now() { return performance.now() }
async function step(name, fn, rowsOf) {
  const t0 = now()
  try {
    const value = await fn()
    const ms = now() - t0
    const rows = typeof rowsOf === 'function' ? rowsOf(value) : undefined
    console.log(JSON.stringify({ name, ms: Number(ms.toFixed(1)), rows }))
    return value
  } catch (error) {
    const ms = now() - t0
    console.log(JSON.stringify({ name, ms: Number(ms.toFixed(1)), error: error?.message || String(error) }))
    throw error
  }
}
function resolveStage(row) {
  if (row.status === 'published' && row.review_status === 'approved') return 'published'
  if (row.status === 'published') return 'store'
  if (String(row.status || '') === 'pricing') return 'pricing'
  return 'editing'
}
function normalize(row, index) {
  const metadata = row.metadata || {}
  const title = String(row.title || metadata.title || 'کتاب بدون عنوان')
  const category = String(metadata.category || row.tags?.[0] || 'عمومی')
  return {
    id: String(row.id || `publisher-book-${index}`), title,
    subtitle: row.subtitle ?? null,
    description: String(row.description || metadata.description || ''),
    cover_url: String(row.cover_url || ''),
    back_cover_url: row.back_cover_url ?? null,
    preview_pages: Array.isArray(row.preview_pages) ? row.preview_pages : [],
    price: Number(row.price || 0), status: row.status === 'published' ? 'published' : 'draft',
    review_status: row.review_status === 'approved' || row.review_status === 'rejected' ? row.review_status : 'pending',
    publisher_id: String(row.publisher_id || 'publisher-001'), language: String(row.language || 'fa'),
    tags: Array.isArray(row.tags) ? row.tags.filter(Boolean) : [], category,
    series_id: row.series_id ?? null, series_order: row.series_order ?? null,
    publisher_name: String(metadata.publisher_name || 'ناشر متابوکی'),
    book_type: String(metadata.book_type || 'تألیف'),
    page_count: Number(metadata.page_count || metadata.print_page_count || metadata.total_pages || metadata.total_source_pages || 0),
    created_at: String(row.created_at || new Date(0).toISOString()),
    stage: resolveStage(row), readers: 0, sales: 0, revenue: 0,
    author: String(metadata.author || 'نویسنده نامشخص'),
    importStatus: metadata.import_project_id ? 'word-imported' : 'manual', metadata,
  }
}
function unique(arr) { return [...new Set(arr.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'fa')) }
function searchBooks(books, q) {
  const query = String(q || '').trim().toLowerCase()
  if (!query) return books
  return books.filter(b => `${b.title} ${b.subtitle||''} ${b.author||''} ${b.description||''} ${(b.tags||[]).join(' ')}`.toLowerCase().includes(query))
}
function sortBooks(books) { return [...books].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))) }

;(async () => {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Supabase env is missing')
  const client = createClient(supabaseUrl, supabaseAnonKey)
  console.log(JSON.stringify({ name: 'diagnostic_target', email, supabaseUrl }))
  const auth = await step('auth.signInWithPassword', () => client.auth.signInWithPassword({ email, password }), v => v?.data?.user ? 1 : 0)
  if (auth.error || !auth.data.user) throw new Error(auth.error?.message || 'login returned no user')
  const user = auth.data.user
  await step('auth.getSession', () => client.auth.getSession(), v => v?.data?.session ? 1 : 0)
  const ownPublisher = await step('publisher_profiles.select(id)', () => client.from('publisher_profiles').select('id').eq('user_id', user.id).maybeSingle(), v => v?.data ? 1 : 0)
  const roles = await step('user_roles.select(role)', () => client.from('user_roles').select('role').eq('user_id', user.id), v => v?.data?.length || 0)
  const isAdmin = roles.data?.some(item => item.role === 'admin' || item.role === 'super_admin')
  let query = client.from('books').select(columns).order('created_at', { ascending: false })
  if (ownPublisher.data?.id) query = query.eq('publisher_id', ownPublisher.data.id)
  else if (!isAdmin) throw new Error('No publisher profile and not admin')
  const remoteResult = await step('books.select(list columns)', () => query, v => v?.data?.length || 0)
  if (remoteResult.error) throw remoteResult.error
  const remote = await step('normalizePublisherBook(remote rows)', async () => remoteResult.data.map(normalize), v => v.length)
  await step('stats.reduce(all books)', async () => ({
    totalReaders: remote.reduce((sum,b)=>sum+b.readers,0),
    inStore: remote.filter(b=>b.stage==='store'||b.stage==='published').length,
    ready: remote.filter(b=>b.stage==='pricing').length,
    revenue: remote.reduce((sum,b)=>sum+b.revenue,0),
  }))
  await step('filter options(categories/types/tags)', async () => ({
    categories: unique(remote.map(b=>b.category)).length,
    types: unique(remote.map(b=>b.book_type)).length,
    tags: unique(remote.flatMap(b=>b.tags||[])).length,
  }))
  await step('search/sort/paginate 50', async () => sortBooks(searchBooks(remote, '')).slice(0, 50), v => v.length)
  await step('cover_url availability check', async () => ({ missingCover: remote.filter(b=>!b.cover_url).length, withCover: remote.filter(b=>b.cover_url).length }))
  await client.auth.signOut()
})().catch(error => { console.error(JSON.stringify({ fatal: error.message || String(error) })); process.exit(1) })


