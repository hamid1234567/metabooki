import { generateAiImageThroughGateway } from '@/lib/ai-gateway'
import { buildBookCoverImagePrompt, type BookCoverPromptContext } from '@/lib/ai-image-prompts'
import type { AppUser } from '@/lib/auth-context'
import { updatePublisherBook } from '@/lib/publisher-books'
import { supabase } from '@/integrations/supabase/client'

const UUID_RE = /^[0-9a-f-]{36}$/i

function textOf(value: unknown): string {
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join(' ')
  if (value && typeof value === 'object') {
    const item = value as Record<string, unknown>
    return textOf(item.content || item.text || item.caption || item.title || item.description || item.blocks)
  }
  return String(value || '')
}

export function bookSampleFromPages(pages: unknown[] = [], limit = 1200) {
  return pages
    .flatMap((page: any) => Array.isArray(page?.blocks) ? page.blocks : [])
    .map(textOf)
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit)
}

export function coverContextFromBook(book: any): BookCoverPromptContext {
  const metadata = book?.metadata || {}
  return {
    title: String(book?.title || metadata.title || 'کتاب بدون عنوان'),
    category: String(metadata.category || book?.category || book?.tags?.[0] || 'عمومی'),
    description: String(book?.description || metadata.description || ''),
    sample: String(metadata.opening_sample || metadata.sample || bookSampleFromPages(book?.pages || [])),
  }
}

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('خواندن تصویر ناموفق بود.'))
    reader.readAsDataURL(blob)
  })
}

async function fetchAsDataUrl(url: string) {
  if (url.startsWith('data:')) return url
  const response = await fetch(url)
  if (!response.ok) throw new Error(`دریافت تصویر تولیدشده ناموفق بود (${response.status}).`)
  return blobToDataUrl(await response.blob())
}

export async function coverImageToThumbnailDataUrl(sourceUrl: string) {
  if (typeof Image === 'undefined' || typeof document === 'undefined') return sourceUrl
  let dataUrl = sourceUrl
  try {
    dataUrl = await fetchAsDataUrl(sourceUrl)
  } catch {
    return sourceUrl
  }
  return await new Promise<string>(resolve => {
    const image = new Image()
    image.onload = () => {
      const width = 480
      const height = 672
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx || !image.naturalWidth || !image.naturalHeight) {
        resolve(dataUrl)
        return
      }
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
      const sourceWidth = width / scale
      const sourceHeight = height / scale
      const sourceX = Math.max(0, (image.naturalWidth - sourceWidth) / 2)
      const sourceY = Math.max(0, (image.naturalHeight - sourceHeight) / 2)
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height)
      resolve(canvas.toDataURL('image/webp', 0.86))
    }
    image.onerror = () => resolve(dataUrl)
    image.src = dataUrl
  })
}

export async function generateAndAttachBookCover(options: {
  book: any
  user: AppUser | null
  onProgress?: (label: string) => void
}) {
  const { book, user, onProgress } = options
  if (!user) throw new Error('برای طراحی جلد هوشمند ابتدا وارد حساب شوید.')
  const cover = coverContextFromBook(book)
  onProgress?.('در حال طراحی جلد متناسب با عنوان و متن کتاب...')
  const result = await generateAiImageThroughGateway({
    prompt: cover.title,
    purpose: 'book_cover',
    cover,
    bookId: book.id,
    user,
  })
  onProgress?.('بهینه‌سازی تصویر جلد برای تامبنیل فروشگاه...')
  const coverUrl = await coverImageToThumbnailDataUrl(result.imageUrl)
  const metadata = {
    ...(book.metadata || {}),
    auto_cover_prompt: result.prompt || buildBookCoverImagePrompt(cover),
    auto_cover_status: 'generated',
    auto_cover_model: result.model,
    auto_cover_generated_at: new Date().toISOString(),
    auto_cover_usage: result.usage,
  }
  const patch = { cover_url: coverUrl, metadata }
  updatePublisherBook(book.id, patch as any)
  if (UUID_RE.test(String(book.id)) && import.meta.env.VITE_SUPABASE_URL?.startsWith('http')) {
    const { error } = await (supabase as any).from('books').update(patch).eq('id', book.id)
    if (error) throw error
  }
  onProgress?.('جلد هوشمند کتاب آماده شد.')
  return { ...book, ...patch }
}
