import type { MockBook } from '@/lib/mock-data'
import { buildBookCoverImagePrompt, resolveBookCoverArt } from '@/lib/ai-image-prompts'

const KEY = 'metabooki_publisher_books'
const LAST_UPDATE_KEY = 'metabooki_publisher_books_last_update'
const BOOK_UPDATE_CHANNEL = 'metabooki-book-updates'
export const PUBLISHER_BOOK_UPDATED_EVENT = 'metabooki:publisher-book-updated'

export type PublisherBookStage = 'editing' | 'pricing' | 'store' | 'published'

export interface PublisherBook extends MockBook {
  stage: PublisherBookStage
  readers: number
  sales: number
  revenue: number
  author: string
  importStatus?: 'manual' | 'word-imported' | 'needs-review'
  metadata?: Record<string, unknown>
}

export type PublisherBookUpdateDetail = {
  bookId: string
  action: 'created' | 'updated' | 'deleted'
  updatedAt: number
}

let updateChannel: BroadcastChannel | null = null

function getUpdateChannel() {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return null
  if (!updateChannel) updateChannel = new BroadcastChannel(BOOK_UPDATE_CHANNEL)
  return updateChannel
}

export function notifyPublisherBookChanged(bookId: string, action: PublisherBookUpdateDetail['action'] = 'updated') {
  if (typeof window === 'undefined') return
  const detail: PublisherBookUpdateDetail = { bookId, action, updatedAt: Date.now() }
  window.dispatchEvent(new CustomEvent(PUBLISHER_BOOK_UPDATED_EVENT, { detail }))
  try {
    localStorage.setItem(LAST_UPDATE_KEY, JSON.stringify(detail))
  } catch {
    // Storage is a best-effort cross-tab fallback.
  }
  try {
    getUpdateChannel()?.postMessage(detail)
  } catch {
    // BroadcastChannel is optional; storage/custom events still cover the app.
  }
}

export function subscribePublisherBookUpdates(bookId: string | undefined, onUpdate: (detail: PublisherBookUpdateDetail) => void) {
  if (typeof window === 'undefined') return () => {}
  const matches = (detail: PublisherBookUpdateDetail | null | undefined) => {
    if (!detail?.bookId) return false
    return !bookId || detail.bookId === bookId
  }
  const emit = (detail: PublisherBookUpdateDetail | null | undefined) => {
    if (matches(detail)) onUpdate(detail!)
  }

  const handleCustom = ((event: CustomEvent<PublisherBookUpdateDetail>) => emit(event.detail)) as EventListener
  const handleStorage = (event: StorageEvent) => {
    if (event.key === LAST_UPDATE_KEY && event.newValue) {
      try { emit(JSON.parse(event.newValue) as PublisherBookUpdateDetail) } catch {}
      return
    }
    if (event.key === KEY && bookId) emit({ bookId, action: 'updated', updatedAt: Date.now() })
  }
  const channel = getUpdateChannel()
  const handleMessage = (event: MessageEvent<PublisherBookUpdateDetail>) => emit(event.data)

  window.addEventListener(PUBLISHER_BOOK_UPDATED_EVENT, handleCustom)
  window.addEventListener('storage', handleStorage)
  channel?.addEventListener('message', handleMessage)

  return () => {
    window.removeEventListener(PUBLISHER_BOOK_UPDATED_EVENT, handleCustom)
    window.removeEventListener('storage', handleStorage)
    channel?.removeEventListener('message', handleMessage)
  }
}

function read(): PublisherBook[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

function write(items: PublisherBook[]) { localStorage.setItem(KEY, JSON.stringify(items)) }

function pageSample(pages: MockBook['pages']) {
  return (pages || [])
    .flatMap((page: any) => Array.isArray(page?.blocks) ? page.blocks : [])
    .map((block: any) => String(block?.content || block?.text || block?.caption || ''))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200)
}

function seededPublisherBooks(): PublisherBook[] {
  return [0, 1, 2, 3].map(index => {
    const id = `seed-publisher-${index + 1}`
    return {
      id,
      title: ['کتاب نمونه ناشر', 'راهنمای طراحی کتاب', 'آموزش تعاملی', 'نمونه فروشگاهی'][index],
      subtitle: null,
      description: 'نمونه محلی سبک برای نمایش وضعیت انتشارات.',
      cover_url: resolveBookCoverArt({
        coverUrl: `https://picsum.photos/seed/${id}/360/500`,
        title: ['Ú©ØªØ§Ø¨ Ù†Ù…ÙˆÙ†Ù‡ Ù†Ø§Ø´Ø±', 'Ø±Ø§Ù‡Ù†Ù…Ø§ÛŒ Ø·Ø±Ø§Ø­ÛŒ Ú©ØªØ§Ø¨', 'Ø¢Ù…ÙˆØ²Ø´ ØªØ¹Ø§Ù…Ù„ÛŒ', 'Ù†Ù…ÙˆÙ†Ù‡ ÙØ±ÙˆØ´Ú¯Ø§Ù‡ÛŒ'][index],
        category: 'Ø¹Ù…ÙˆÙ…ÛŒ',
        description: 'Ù†Ù…ÙˆÙ†Ù‡ Ù…Ø­Ù„ÛŒ Ø³Ø¨Ú© Ø¨Ø±Ø§ÛŒ Ù†Ù…Ø§ÛŒØ´ ÙˆØ¶Ø¹ÛŒØª Ø§Ù†ØªØ´Ø§Ø±Ø§Øª.',
      }),
      back_cover_url: null,
      pages: [],
      preview_pages: [],
      price: index === 0 ? 0 : 120,
      status: index > 1 ? 'published' : 'draft',
      review_status: index > 1 ? 'approved' : 'pending',
      publisher_id: 'publisher-001',
      language: 'fa',
      tags: ['نمونه'],
      category: 'عمومی',
      series_id: null,
      series_order: null,
      publisher_name: 'ناشر متابوکی',
      book_type: 'تألیف',
      page_count: 0,
      created_at: new Date(Date.now() - index * 86400000).toISOString(),
      stage: index === 0 ? 'editing' : index === 1 ? 'pricing' : 'store',
      readers: [1, 9, 4, 2][index] || 0,
      sales: [0, 3, 1, 0][index] || 0,
      revenue: [0, 540, 250, 0][index] || 0,
      author: index === 0 ? 'نویسنده نمونه' : 'ناشر متابوکی',
      importStatus: index === 0 ? 'word-imported' : 'manual',
    } as PublisherBook
  })
}

export function getPublisherBooks(): PublisherBook[] {
  const custom = read()
  const seeded = seededPublisherBooks()
  const ids = new Set(custom.map(b => b.id))
  return [...custom, ...seeded.filter(b => !ids.has(b.id))]
}

export function createPublisherBook(input: { title: string; subtitle?: string; author: string; category: string; description: string; publisherName?: string; fileName?: string; pages?: MockBook['pages']; importProjectId?: string; bookTypes?: string[]; metadata?: Record<string, unknown> }) {
  const now = new Date().toISOString()
  const id = `pub-${Date.now()}`
  const pages = input.pages || [
    { title: 'فصل ۱', blocks: [
      { type: 'heading', level: 2, content: 'فصل ۱' },
      { type: 'paragraph', content: input.fileName ? 'متن اولیه از فایل Word شبیه‌سازی و برای ویرایش آماده شد.' : 'محتوای کتاب را اینجا بنویسید یا از فایل Word وارد کنید.' },
      { type: 'quiz', question: 'آیا این فصل آماده ویرایش است؟', options: ['بله', 'خیر'], correct: 0 },
    ] },
  ]
  const coverContext = {
    title: input.title || 'Ú©ØªØ§Ø¨ Ø¨Ø¯ÙˆÙ† Ø¹Ù†ÙˆØ§Ù†',
    category: input.category,
    description: input.description || '',
    sample: pageSample(pages),
  }
  const book: PublisherBook = {
    id,
    title: input.title || 'کتاب بدون عنوان',
    subtitle: input.subtitle || (input.fileName ? `ایجاد شده از فایل ${input.fileName}` : 'کتاب جدید'),
    description: input.description || 'کتاب جدید آماده ویرایش و تکمیل محتوا است.',
    cover_url: resolveBookCoverArt({ ...coverContext, coverUrl: '' }),
    back_cover_url: null,
    pages,
    preview_pages: [0],
    price: 0,
    status: 'draft',
    review_status: 'pending',
    publisher_id: 'publisher-001',
    language: 'fa',
    tags: [input.category],
    category: input.category,
    series_id: null,
    series_order: null,
    publisher_name: input.publisherName || 'ناشر متابوکی',
    book_type: input.bookTypes?.join('، ') || 'تألیف',
    page_count: pages.length,
    created_at: now,
    stage: 'editing',
    readers: 0,
    sales: 0,
    revenue: 0,
    author: input.author || 'نویسنده نامشخص',
    importStatus: input.fileName ? 'word-imported' : 'manual',
    metadata: { ...(input.metadata || {}), ...(input.importProjectId ? { import_project_id: input.importProjectId } : {}), auto_cover_prompt: buildBookCoverImagePrompt(coverContext) },
  }
  const items = read()
  items.unshift(book)
  write(items)
  notifyPublisherBookChanged(book.id, 'created')
  return book
}

export function findPublisherBook(id: string) {
  return getPublisherBooks().find(b => b.id === id) || null
}

export function updatePublisherBook(id: string, patch: Partial<PublisherBook>) {
  const items = read()
  const index = items.findIndex(b => b.id === id)
  if (index >= 0) items[index] = { ...items[index], ...patch }
  else {
    const existing = findPublisherBook(id)
    if (existing) items.unshift({ ...existing, ...patch })
  }
  write(items)
  notifyPublisherBookChanged(id, 'updated')
}

export function deletePublisherBook(id: string) {
  write(read().filter(b => b.id !== id))
  notifyPublisherBookChanged(id, 'deleted')
}
