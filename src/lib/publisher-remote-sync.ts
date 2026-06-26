import { supabase } from '@/integrations/supabase/client'
import type { MockBook } from '@/lib/mock-data'
import { getPublisherBooks, updatePublisherBook, type PublisherBook } from '@/lib/publisher-books'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i

function hasSupabase() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL?.startsWith('http'))
}

function isBlobUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('blob:')
}

function extensionFromType(type: string) {
  if (type.includes('png')) return 'png'
  if (type.includes('webp')) return 'webp'
  if (type.includes('gif')) return 'gif'
  if (type.includes('svg')) return 'svg'
  return 'jpg'
}

async function resolvePublisherProfile(userId: string, publisherName?: string) {
  const client = supabase as any
  const own = await client.from('publisher_profiles').select('id').eq('user_id', userId).maybeSingle()
  if (own.error) throw own.error
  if (own.data?.id) return own.data.id as string

  const slug = `publisher-${userId.slice(0, 8)}`
  const created = await client
    .from('publisher_profiles')
    .insert({ user_id: userId, slug, bio: publisherName ? `Publisher name: ${publisherName}` : null })
    .select('id')
    .single()
  if (!created.error && created.data?.id) return created.data.id as string
  throw created.error
}

async function uploadBlobUrl(userId: string, bookId: string, key: string, url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Local image is no longer readable: ${key}`)
  const blob = await response.blob()
  const path = `${userId}/publisher-sync/${bookId}/${key}.${extensionFromType(blob.type || 'image/jpeg')}`
  const storage = (supabase as any).storage.from('book-imports')
  const uploaded = await storage.upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' })
  if (uploaded.error) throw uploaded.error
  const signed = await storage.createSignedUrl(path, 60 * 60 * 24 * 365)
  if (signed.error) throw signed.error
  return signed.data?.signedUrl || url
}

async function materializeBlobUrls(value: unknown, userId: string, bookId: string, path = 'asset'): Promise<unknown> {
  if (isBlobUrl(value)) return uploadBlobUrl(userId, bookId, path.replace(/[^\w.-]+/g, '-'), value)
  if (Array.isArray(value)) {
    const next = []
    for (const [index, item] of value.entries()) {
      next.push(await materializeBlobUrls(item, userId, bookId, `${path}-${index}`))
    }
    return next
  }
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      next[key] = await materializeBlobUrls(item, userId, bookId, `${path}-${key}`)
    }
    return next
  }
  return value
}

function bookPayload(book: PublisherBook, publisherId: string, pages: MockBook['pages'], metadata: Record<string, unknown>) {
  const payload: Record<string, unknown> = {
    title: book.title || 'Untitled book',
    subtitle: book.subtitle || null,
    description: book.description || '',
    cover_url: book.cover_url || null,
    back_cover_url: book.back_cover_url || null,
    pages: pages || [],
    preview_pages: Array.isArray(book.preview_pages) ? book.preview_pages : [],
    price: Number(book.price || 0),
    status: book.status === 'published' ? 'published' : 'draft',
    review_status: book.review_status === 'approved' || book.review_status === 'rejected' ? book.review_status : 'pending',
    publisher_id: publisherId,
    language: book.language || 'fa',
    tags: Array.isArray(book.tags) ? book.tags : [],
    series_id: book.series_id || null,
    series_order: book.series_order ?? null,
    metadata: {
      ...metadata,
      author: metadata.author || book.author,
      category: metadata.category || book.category,
      publisher_name: metadata.publisher_name || book.publisher_name,
      book_type: metadata.book_type || book.book_type,
      local_source_book_id: metadata.local_source_book_id || book.id,
      local_synced_at: new Date().toISOString(),
    },
  }
  if (UUID_RE.test(book.id)) payload.id = book.id
  return payload
}

export async function syncLocalPublisherBooksToSupabase(userId: string) {
  if (!hasSupabase()) return { synced: 0, skipped: 0, errors: [] as string[] }
  const localBooks = getPublisherBooks({ includeSeed: false }).filter(book => book.id && !book.id.startsWith('seed-publisher-'))
  if (!localBooks.length) return { synced: 0, skipped: 0, errors: [] as string[] }

  const errors: string[] = []
  let synced = 0
  let skipped = 0
  const publisherId = await resolvePublisherProfile(userId, localBooks[0]?.publisher_name)

  for (const book of localBooks) {
    try {
      const materialized = await materializeBlobUrls(
        {
          cover_url: book.cover_url,
          back_cover_url: book.back_cover_url,
          pages: book.pages || [],
          metadata: book.metadata || {},
        },
        userId,
        book.id,
      ) as { cover_url?: string; back_cover_url?: string; pages?: MockBook['pages']; metadata?: Record<string, unknown> }

      const payload = bookPayload(
        { ...book, cover_url: materialized.cover_url || book.cover_url, back_cover_url: materialized.back_cover_url || book.back_cover_url },
        publisherId,
        materialized.pages || book.pages || [],
        materialized.metadata || book.metadata || {},
      )
      const result = await (supabase as any).from('books').upsert(payload, { onConflict: 'id' }).select('*').single()
      if (result.error) throw result.error
      const nextId = result.data?.id || book.id
      updatePublisherBook(book.id, {
        ...book,
        id: nextId,
        publisher_id: publisherId,
        cover_url: String(result.data?.cover_url || payload.cover_url || book.cover_url || ''),
        back_cover_url: (result.data?.back_cover_url || payload.back_cover_url || book.back_cover_url || null) as string | null,
        pages: (result.data?.pages || payload.pages || book.pages || []) as MockBook['pages'],
        metadata: (result.data?.metadata || payload.metadata || book.metadata || {}) as Record<string, unknown>,
      })
      synced += 1
    } catch (error) {
      skipped += 1
      errors.push(`${book.title || book.id}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return { synced, skipped, errors }
}
