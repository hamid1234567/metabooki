import { supabase } from '@/integrations/supabase/client'
import { findBookById, getAllPublishedBooks, mockBooks, type MockBook } from '@/lib/mock-data'

const hasSupabase = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL.startsWith('http'))

function toBook(row: Record<string, unknown>): MockBook {
  const metadata = (row.metadata || {}) as Record<string, unknown>
  const pages = Array.isArray(row.pages) ? row.pages : []
  return {
    id: String(row.id),
    title: String(row.title || ''),
    subtitle: row.subtitle ? String(row.subtitle) : null,
    description: String(row.description || ''),
    cover_url: String(row.cover_url || ''),
    back_cover_url: row.back_cover_url ? String(row.back_cover_url) : null,
    pages: pages as MockBook['pages'],
    preview_pages: Array.isArray(row.preview_pages) ? row.preview_pages as number[] : [],
    price: Number(row.price || 0),
    status: row.status as MockBook['status'],
    review_status: row.review_status as MockBook['review_status'],
    publisher_id: String(row.publisher_id || ''),
    language: String(row.language || 'fa'),
    tags: Array.isArray(row.tags) ? row.tags as string[] : [],
    category: String(metadata.category || 'عمومی'),
    series_id: row.series_id ? String(row.series_id) : null,
    series_order: row.series_order === null || row.series_order === undefined ? null : Number(row.series_order),
    publisher_name: String(metadata.publisher_name || 'ناشر متابوکی'),
    author: String(metadata.author || 'نویسنده نامشخص'),
    book_type: String(metadata.book_type || 'تألیف'),
    page_count: pages.length,
    created_at: String(row.created_at || ''),
  }
}

export async function getPublishedBooks(): Promise<MockBook[]> {
  if (!hasSupabase) return getAllPublishedBooks()
  const { data, error } = await supabase.from('books').select('*').eq('status', 'published').eq('review_status', 'approved').order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(row => toBook(row as unknown as Record<string, unknown>))
}

export async function getPopularBookIds(): Promise<string[]> {
  if (!hasSupabase) return mockBooks.slice(0, 10).map(book => book.id)
  const { data, error } = await (supabase as any).rpc('get_popular_book_ids')
  if (error) return []
  return (data || []).map((item: { book_id: string }) => item.book_id)
}

export async function getBook(bookId: string): Promise<MockBook | null> {
  if (!hasSupabase) return findBookById(bookId) || null
  const { data, error } = await supabase.from('books').select('*').eq('id', bookId).maybeSingle()
  if (error) throw error
  return data ? toBook(data as unknown as Record<string, unknown>) : null
}

export async function getUserLibrary(userId: string): Promise<{ books: MockBook[]; progress: Record<string, { currentPage: number; totalPages: number; lastReadAt: string }> }> {
  if (!hasSupabase) return { books: mockBooks, progress: {} }
  const [{ data: owned, error }, { data: states }] = await Promise.all([
    supabase.from('user_books').select('book_id, books(*)').eq('user_id', userId),
    (supabase as any).from('reader_states').select('*').eq('user_id', userId),
  ])
  if (error) throw error
  const books = (owned || []).map((entry: any) => entry.books).filter(Boolean).map((row: Record<string, unknown>) => toBook(row))
  const progress = Object.fromEntries((states || []).map((state: any) => [state.book_key, { currentPage: state.current_page, totalPages: state.total_pages, lastReadAt: state.updated_at }]))
  return { books, progress }
}
