import type { MockBook } from '@/lib/mock-data'
import { bookSearchIncludes } from '@/lib/book-content'

export const BOOK_LIST_MAX_ROWS = 15
export const BOOK_LIST_PAGE_SIZE = BOOK_LIST_MAX_ROWS

export type BookSortKey =
  | 'newest'
  | 'oldest'
  | 'title-asc'
  | 'title-desc'
  | 'price-asc'
  | 'price-desc'
  | 'pages-desc'
  | 'pages-asc'

export type BookLike = Pick<MockBook, 'title' | 'subtitle' | 'description' | 'author' | 'publisher_name' | 'book_type' | 'category' | 'tags' | 'price' | 'page_count' | 'created_at'> & {
  status?: string
  review_status?: string
  stage?: string
  readers?: number
  sales?: number
  revenue?: number
}

export function searchBooks<T extends BookLike>(books: T[], query: string) {
  const q = query.trim()
  if (!q) return books
  return books.filter(book => [
    book.title,
    book.subtitle || '',
    book.description || '',
    book.author || '',
    book.publisher_name || '',
    book.book_type || '',
    book.category || '',
    ...(book.tags || []),
  ].some(value => bookSearchIncludes(String(value), q)))
}

export function normalizeBookType(value?: string | null) {
  return String(value || 'نامشخص').trim() || 'نامشخص'
}

export function uniqueBookValues<T extends BookLike>(books: T[], selector: (book: T) => string | undefined | null) {
  return Array.from(new Set(books.map(selector).map(value => String(value || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fa'))
}

export function filterByValue<T>(items: T[], selected: string, selector: (item: T) => string | undefined | null) {
  if (!selected || selected === 'all') return items
  return items.filter(item => String(selector(item) || '') === selected)
}

export function sortBooks<T extends BookLike>(books: T[], sort: BookSortKey) {
  const sorted = [...books]
  sorted.sort((a, b) => {
    if (sort === 'oldest') return dateValue(a.created_at) - dateValue(b.created_at)
    if (sort === 'title-asc') return a.title.localeCompare(b.title, 'fa')
    if (sort === 'title-desc') return b.title.localeCompare(a.title, 'fa')
    if (sort === 'price-asc') return Number(a.price || 0) - Number(b.price || 0)
    if (sort === 'price-desc') return Number(b.price || 0) - Number(a.price || 0)
    if (sort === 'pages-asc') return Number(a.page_count || 0) - Number(b.page_count || 0)
    if (sort === 'pages-desc') return Number(b.page_count || 0) - Number(a.page_count || 0)
    return dateValue(b.created_at) - dateValue(a.created_at)
  })
  return sorted
}

export function paginate<T>(items: T[], page: number, pageSize = BOOK_LIST_PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(Math.max(1, page), pageCount)
  const start = (safePage - 1) * pageSize
  return {
    page: safePage,
    pageCount,
    items: items.slice(start, start + pageSize),
    start: items.length ? start + 1 : 0,
    end: Math.min(start + pageSize, items.length),
  }
}

export function pageNumbers(page: number, pageCount: number) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1)
  const numbers = new Set([1, pageCount, page - 1, page, page + 1].filter(value => value >= 1 && value <= pageCount))
  return Array.from(numbers).sort((a, b) => a - b)
}

function dateValue(value?: string) {
  const time = value ? new Date(value).getTime() : 0
  return Number.isFinite(time) ? time : 0
}
