import { mockBooks, type MockBook } from '@/lib/mock-data'

const KEY = 'metabooki_publisher_books'

export type PublisherBookStage = 'editing' | 'pricing' | 'store' | 'published'

export interface PublisherBook extends MockBook {
  stage: PublisherBookStage
  readers: number
  sales: number
  revenue: number
  author: string
  importStatus?: 'manual' | 'word-imported' | 'needs-review'
}

function read(): PublisherBook[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

function write(items: PublisherBook[]) { localStorage.setItem(KEY, JSON.stringify(items)) }

export function getPublisherBooks(): PublisherBook[] {
  const custom = read()
  const seeded: PublisherBook[] = mockBooks.slice(0, 4).map((b, i) => ({
    ...b,
    stage: i === 0 ? 'editing' : i === 1 ? 'pricing' : 'store',
    readers: [1, 9, 4, 2][i] || 0,
    sales: [0, 3, 1, 0][i] || 0,
    revenue: [0, 540, 250, 0][i] || 0,
    author: i === 0 ? 'دکتر علیرضا چوبینه' : 'نویسنده تست',
    importStatus: i === 0 ? 'word-imported' : 'manual',
  }))
  const ids = new Set(custom.map(b => b.id))
  return [...custom, ...seeded.filter(b => !ids.has(b.id))]
}

export function createPublisherBook(input: { title: string; author: string; category: string; description: string; fileName?: string }) {
  const now = new Date().toISOString()
  const id = `pub-${Date.now()}`
  const book: PublisherBook = {
    id,
    title: input.title || 'کتاب بدون عنوان',
    subtitle: input.fileName ? `ایجاد شده از فایل ${input.fileName}` : 'کتاب جدید',
    description: input.description || 'کتاب جدید آماده ویرایش و تکمیل محتوا است.',
    cover_url: `https://picsum.photos/seed/${id}/400/560`,
    back_cover_url: null,
    pages: [
      { title: 'فصل ۱', blocks: [
        { type: 'heading', level: 2, content: 'فصل ۱' },
        { type: 'paragraph', content: input.fileName ? 'متن اولیه از فایل Word شبیه‌سازی و برای ویرایش آماده شد. در نسخه واقعی، ساختار فصل‌ها، تصاویر و جداول از DOCX استخراج می‌شود.' : 'محتوای کتاب را اینجا بنویسید یا از فایل Word وارد کنید.' },
        { type: 'quiz', question: 'آیا این فصل آماده ویرایش است؟', options: ['بله', 'خیر'], correct: 0 },
      ]}
    ],
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
    publisher_name: 'انتشارات دانش نو',
    page_count: 1,
    created_at: now,
    stage: 'editing',
    readers: 0,
    sales: 0,
    revenue: 0,
    author: input.author || 'نویسنده نامشخص',
    importStatus: input.fileName ? 'word-imported' : 'manual',
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
