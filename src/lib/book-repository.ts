import { supabase } from '@/integrations/supabase/client'
import { buildBookCoverImagePrompt, resolveBookCoverArt } from '@/lib/ai-image-prompts'
import { findPublisherBook } from '@/lib/publisher-books'
import type { MockBook } from '@/lib/mock-data'
import { documentV2ToLegacyPages, type BookDocumentV2 } from '@/lib/book-document-v2'

const hasSupabase = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL.startsWith('http'))

const BOOK_LIST_COLUMNS = [
  'id',
  'title',
  'subtitle',
  'description',
  'cover_url',
  'back_cover_url',
  'preview_pages',
  'price',
  'status',
  'review_status',
  'publisher_id',
  'language',
  'tags',
  'metadata',
  'series_id',
  'series_order',
  'created_at',
].join(',')

async function mockCatalog() {
  return import('@/lib/mock-data')
}

function stringValue(value: unknown, fallback = '') {
  return value === null || value === undefined ? fallback : String(value)
}

function metadataString(metadata: Record<string, unknown>, key: string, fallback: string) {
  return stringValue(metadata[key], fallback)
}

function textSampleFromPages(pages: unknown[]) {
  return pages
    .flatMap((page: any) => Array.isArray(page?.blocks) ? page.blocks : [])
    .map((block: any) => stringValue(block?.text || block?.content || block?.caption))
    .filter(Boolean)
    .join(' ')
    .slice(0, 1200)
}

function toBook(row: Record<string, unknown>): MockBook {
  const metadata = (row.metadata || {}) as Record<string, unknown>
  const storedV2 = metadata.editor_v2_document as BookDocumentV2 | undefined
  const pages = storedV2?.schemaVersion === '2.0' && Array.isArray(storedV2.pages)
    ? documentV2ToLegacyPages(storedV2)
    : Array.isArray(row.pages) ? row.pages : []
  const metadataPageCount = Number(metadata.page_count || metadata.print_page_count || metadata.total_pages || metadata.total_source_pages || 0)
  const pageCount = pages.length || metadataPageCount || Number(row.page_count || 0) || 0
  const title = stringValue(row.title)
  const description = stringValue(row.description)
  const category = metadataString(metadata, 'category', 'Ø¹Ù…ÙˆÙ…ÛŒ')
  const sample = stringValue(metadata.opening_sample || metadata.sample || metadata.first_page_text || textSampleFromPages(pages))
  const coverContext = { title, category, description, sample }
  const metadataWithCoverPrompt = {
    ...metadata,
    auto_cover_prompt: metadata.auto_cover_prompt || buildBookCoverImagePrompt(coverContext),
  }

  return {
    id: stringValue(row.id),
    title,
    subtitle: row.subtitle ? stringValue(row.subtitle) : null,
    description,
    cover_url: resolveBookCoverArt({ ...coverContext, coverUrl: stringValue(row.cover_url) }),
    back_cover_url: row.back_cover_url ? stringValue(row.back_cover_url) : null,
    pages: pages as MockBook['pages'],
    preview_pages: Array.isArray(row.preview_pages) ? row.preview_pages as number[] : [],
    price: Number(row.price || 0),
    status: row.status as MockBook['status'],
    review_status: row.review_status as MockBook['review_status'],
    publisher_id: stringValue(row.publisher_id),
    language: stringValue(row.language, 'fa'),
    tags: Array.isArray(row.tags) ? row.tags as string[] : [],
    category,
    series_id: row.series_id ? stringValue(row.series_id) : null,
    series_order: row.series_order === null || row.series_order === undefined ? null : Number(row.series_order),
    publisher_name: metadataString(metadata, 'publisher_name', 'ناشر متابوکی'),
    author: metadataString(metadata, 'author', 'نویسنده نامشخص'),
    book_type: metadataString(metadata, 'book_type', 'تألیف'),
    page_count: pageCount,
    created_at: stringValue(row.created_at),
    metadata: metadataWithCoverPrompt,
  }
}

function withResolvedCover(book: MockBook): MockBook {
  const metadata = (book.metadata || {}) as Record<string, unknown>
  const storedV2 = metadata.editor_v2_document as BookDocumentV2 | undefined
  const pages = storedV2?.schemaVersion === '2.0' && Array.isArray(storedV2.pages)
    ? documentV2ToLegacyPages(storedV2)
    : book.pages
  const context = {
    title: book.title,
    category: book.category || metadataString(metadata, 'category', 'عمومی'),
    description: book.description || '',
    sample: stringValue(metadata.opening_sample || metadata.sample || textSampleFromPages(pages || [])),
  }
  return {
    ...book,
    pages,
    page_count: pages?.length || book.page_count,
    cover_url: resolveBookCoverArt({ ...context, coverUrl: book.cover_url }),
    metadata: { ...metadata, auto_cover_prompt: metadata.auto_cover_prompt || buildBookCoverImagePrompt(context) },
  }
}

export async function getPublishedBooks(): Promise<MockBook[]> {
  if (!hasSupabase) {
    const { getAllPublishedBooks } = await mockCatalog()
    return getAllPublishedBooks().map(withResolvedCover)
  }

  const { data, error } = await supabase
    .from('books')
    .select(BOOK_LIST_COLUMNS)
    .eq('status', 'published')
    .eq('review_status', 'approved')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(row => toBook(row as unknown as Record<string, unknown>))
}

export async function getPopularBookIds(): Promise<string[]> {
  if (!hasSupabase) {
    const { mockBooks } = await mockCatalog()
    return mockBooks.slice(0, 10).map(book => book.id)
  }

  const { data, error } = await (supabase as any).rpc('get_popular_book_ids')
  if (error) return []
  return (data || []).map((item: { book_id: string }) => item.book_id)
}

export async function getBook(bookId: string): Promise<MockBook | null> {
  if (hasSupabase) {
    const { data, error } = await supabase.from('books').select('*').eq('id', bookId).maybeSingle()
    if (data) return toBook(data as unknown as Record<string, unknown>)
    if (error) throw error
    return null
  }

  const localPublisherBook = findPublisherBook(bookId)
  if (localPublisherBook) return withResolvedCover(localPublisherBook)

  if (!hasSupabase) {
    const { findBookById } = await mockCatalog()
    const book = findBookById(bookId) || null
    return book ? withResolvedCover(book) : null
  }

  const { data, error } = await supabase.from('books').select('*').eq('id', bookId).maybeSingle()
  if (error) throw error
  return data ? toBook(data as unknown as Record<string, unknown>) : null
}

export async function getPublisherDraftBooks(userId: string): Promise<MockBook[]> {
  if (!hasSupabase || !userId) return []
  const { data, error } = await (supabase as any).rpc('get_my_publisher_books')
  if (error) return []
  const byId = new Map<string, Record<string, unknown>>()
  for (const row of data || []) {
    const item = row as Record<string, unknown>
    const id = stringValue(item.id)
    if (!id || item.status === 'published') continue
    byId.set(id, item)
  }
  return [...byId.values()]
    .map(row => toBook(row))
    .sort((a, b) => (Date.parse(b.created_at || '') || 0) - (Date.parse(a.created_at || '') || 0))
}

export async function getUserLibrary(userId: string): Promise<{ books: MockBook[]; progress: Record<string, { currentPage: number; totalPages: number; lastReadAt: string }> }> {
  if (!hasSupabase) {
    const { mockBooks } = await mockCatalog()
    return { books: mockBooks.map(withResolvedCover), progress: {} }
  }

  const [{ data: owned, error }, { data: states }] = await Promise.all([
    supabase.from('user_books').select(`book_id, books(${BOOK_LIST_COLUMNS})`).eq('user_id', userId),
    (supabase as any).from('reader_states').select('*').eq('user_id', userId),
  ])

  if (error) throw error
  const books = (owned || [])
    .map((entry: any) => entry.books)
    .filter(Boolean)
    .map((row: Record<string, unknown>) => toBook(row))
  const progress = Object.fromEntries((states || []).map((state: any) => [state.book_key, { currentPage: state.current_page, totalPages: state.total_pages, lastReadAt: state.updated_at }]))

  return { books, progress }
}
