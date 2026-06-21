import type { MockBook } from '@/lib/mock-data'

const KEY = 'metabooki_publisher_books'

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

function read(): PublisherBook[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

function write(items: PublisherBook[]) { localStorage.setItem(KEY, JSON.stringify(items)) }

function seededPublisherBooks(): PublisherBook[] {
  return [0, 1, 2, 3].map(index => {
    const id = `seed-publisher-${index + 1}`
    return {
      id,
      title: ['کتاب نمونه ناشر', 'راهنمای طراحی کتاب', 'آموزش تعاملی', 'نمونه فروشگاهی'][index],
      subtitle: null,
      description: 'نمونه محلی سبک برای نمایش وضعیت انتشارات.',
      cover_url: `https://picsum.photos/seed/${id}/360/500`,
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
  const book: PublisherBook = {
    id,
    title: input.title || 'کتاب بدون عنوان',
    subtitle: input.subtitle || (input.fileName ? `ایجاد شده از فایل ${input.fileName}` : 'کتاب جدید'),
    description: input.description || 'کتاب جدید آماده ویرایش و تکمیل محتوا است.',
    cover_url: `https://picsum.photos/seed/${id}/400/560`,
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
    metadata: input.metadata ? { ...input.metadata, import_project_id: input.importProjectId } : input.importProjectId ? { import_project_id: input.importProjectId } : undefined,
  }
  const items = read()
  items.unshift(book)
  write(items)
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
}

export function deletePublisherBook(id: string) {
  write(read().filter(b => b.id !== id))
}
