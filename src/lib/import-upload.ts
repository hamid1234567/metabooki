/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/integrations/supabase/client'
import { createPublisherBook } from '@/lib/publisher-books'
import { analysisToReaderPages } from '@/lib/import-document'
import type { ImportBookMetadata, LocalImportProject } from '@/lib/word-import-types'

const CHUNK_SIZE = 5 * 1024 * 1024

export interface UploadProgress {
  uploaded: number
  total: number
  percent: number
  label: string
}

function hasSupabase() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL?.startsWith('http'))
}

export function uploadErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : error && typeof error === 'object'
    ? [(error as { message?: string }).message, (error as { details?: string }).details].filter(Boolean).join(' · ')
    : String(error || '')
  if (/Bucket not found|book_import_projects|PGRST205/i.test(raw)) {
    return 'زیرساخت آپلود Supabase هنوز نصب نشده است؛ جدول پروژه‌های تبدیل یا فضای خصوصی book-imports در دسترس نیست'
  }
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const item = error as { message?: string; details?: string; hint?: string; code?: string }
    return [item.message, item.details, item.hint, item.code && `کد: ${item.code}`].filter(Boolean).join(' · ')
  }
  return String(error || 'خطای نامشخص در ارسال بسته')
}

async function uploadChunked(userId: string, projectId: string, file: File, onProgress: (progress: UploadProgress) => void) {
  const storage = (supabase as any).storage
  const chunkCount = Math.ceil(file.size / CHUNK_SIZE)
  const folder = `${userId}/${projectId}/source`
  const { data: existing, error: listError } = await storage.from('book-imports').list(folder, { limit: Math.min(1000, chunkCount) })
  if (listError) throw listError
  const uploadedNames = new Set((existing || []).map((item: { name: string }) => item.name))
  for (let index = 0; index < chunkCount; index += 1) {
    const start = index * CHUNK_SIZE
    const end = Math.min(file.size, start + CHUNK_SIZE)
    const name = `${String(index).padStart(6, '0')}.part`
    const path = `${folder}/${name}`
    if (uploadedNames.has(name)) {
      onProgress({ uploaded: end, total: file.size, percent: Math.round(end / file.size * 85), label: `بخش ${index + 1} قبلاً ارسال شده بود` })
      continue
    }
    const chunk = file.slice(start, end)
    const { error } = await storage.from('book-imports').upload(path, chunk, { upsert: true, contentType: 'application/octet-stream' })
    if (error) throw error
    onProgress({ uploaded: end, total: file.size, percent: Math.round(end / file.size * 85), label: `ارسال بخش ${index + 1} از ${chunkCount}` })
  }
}

function safeFileName(value: string) {
  return value.replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '') || 'image.png'
}

async function uploadPreparedImages(userId: string, projectId: string, project: LocalImportProject, onProgress: (progress: UploadProgress) => void) {
  const storage = (supabase as any).storage.from('book-imports')
  const paths: Record<string, string> = {}
  const readyImages = project.analysis.images.filter(image => image.isReferenced !== false && image.conversionStatus !== 'conversion-failed')
  const folder = `${userId}/${projectId}/images`
  const { data: existing, error: listError } = await storage.list(folder, { limit: Math.min(1000, readyImages.length) })
  if (listError) throw listError
  const uploadedNames = new Set((existing || []).map((item: { name: string }) => item.name))
  for (const [index, image] of readyImages.entries()) {
    const name = `${image.id}-${safeFileName(image.name)}`
    const path = `${folder}/${name}`
    if (!uploadedNames.has(name)) {
      const { error } = await storage.upload(path, image.data, { upsert: true, contentType: image.mimeType })
      if (error) throw error
    }
    paths[image.id] = path
    onProgress({
      uploaded: project.sourceFile.size,
      total: project.sourceFile.size,
      percent: 85 + Math.round((index + 1) / Math.max(1, readyImages.length) * 8),
      label: uploadedNames.has(name) ? `تصویر آماده ${index + 1} قبلاً ارسال شده بود` : `ارسال تصویر آماده ${index + 1} از ${readyImages.length}`,
    })
  }
  const entries = Object.entries(paths)
  const urls: Record<string, string> = {}
  if (entries.length) {
    const { data } = await storage.createSignedUrls(entries.map(([, path]) => path), 60 * 60 * 24 * 365)
    data?.forEach((item: { signedUrl?: string }, index: number) => {
      if (item.signedUrl) urls[entries[index][0]] = item.signedUrl
    })
  }
  return { paths, urls }
}

function bookRecord(project: LocalImportProject, metadata: ImportBookMetadata, publisherId: string, readerPages: unknown[], importProjectId?: string) {
  return {
    title: metadata.title || project.sourceFile.name.replace(/\.docx$/i, ''),
    subtitle: metadata.subtitle || `واردشده از ${project.sourceFile.name}`,
    description: metadata.description,
    pages: readerPages,
    preview_pages: readerPages.slice(0, 3).map((_, index) => index),
    publisher_id: publisherId,
    language: metadata.language,
    tags: [metadata.category, ...metadata.keywords],
    metadata: {
      author: metadata.author,
      authors: metadata.authors,
      translators: metadata.translators,
      category: metadata.category,
      book_type: metadata.bookTypes.join('، '),
      book_types: metadata.bookTypes,
      publisher_name: metadata.publisherName,
      isbn: metadata.isbn,
      publication_year: metadata.publicationYear,
      edition: metadata.edition,
      keywords: metadata.keywords,
      import_project_id: importProjectId,
      source_checksum: project.analysis.checksum,
      total_source_pages: project.analysis.totalPages,
    },
    publish_complexity_factor: Math.max(1, project.analysis.complexity.score / 20),
  }
}

async function resolvePublisher(client: any, userId: string, publisherName: string) {
  const own = await client.from('publisher_profiles').select('id').eq('user_id', userId).maybeSingle()
  if (own.error) throw own.error
  if (own.data) return own.data

  const slug = `publisher-${userId.slice(0, 8)}`
  const created = await client.from('publisher_profiles').insert({ user_id: userId, slug, bio: publisherName ? `نام انتشارات: ${publisherName}` : null }).select('id').single()
  if (!created.error) return created.data

  const roles = await client.from('user_roles').select('role').eq('user_id', userId)
  const isAdmin = roles.data?.some((item: { role: string }) => item.role === 'admin' || item.role === 'super_admin')
  if (isAdmin) {
    const fallback = await client.from('publisher_profiles').select('id').limit(1).maybeSingle()
    if (fallback.data) return fallback.data
  }
  throw created.error
}

async function uploadManifest(client: any, userId: string, projectId: string, project: LocalImportProject, metadata: ImportBookMetadata, paths: Record<string, string>, readerPages: unknown[]) {
  const manifest = new Blob([JSON.stringify({
    version: 1,
    project: metadata,
    analysis: {
      ...project.analysis,
      images: project.analysis.images.map(image => ({
        id: image.id, name: image.name, mimeType: image.mimeType, originalName: image.originalName,
        originalMimeType: image.originalMimeType, conversionStatus: image.conversionStatus,
        storagePath: paths[image.id],
      })),
    },
    pages: readerPages,
  })], { type: 'application/json' })
  const manifestPath = `${userId}/${projectId}/manifest.json`
  const { error } = await client.storage.from('book-imports').upload(manifestPath, manifest, { upsert: true, contentType: 'application/json' })
  if (error) throw error
}

export async function confirmAndUploadImport(
  project: LocalImportProject,
  userId: string,
  onProgress: (progress: UploadProgress) => void,
  getLatestMetadata?: () => ImportBookMetadata,
) {
  if (!hasSupabase()) {
    const metadata = getLatestMetadata?.() || project
    const localImageUrls = Object.fromEntries(project.analysis.images
      .filter(image => image.conversionStatus !== 'conversion-failed')
      .map(image => [image.id, URL.createObjectURL(new Blob([image.data], { type: image.mimeType }))]))
    const readerPages = analysisToReaderPages(project.analysis, localImageUrls)
    onProgress({ uploaded: project.sourceFile.size, total: project.sourceFile.size, percent: 100, label: 'پیش‌نویس محلی آماده شد' })
    return createPublisherBook({
      title: metadata.title,
      author: metadata.author,
      category: metadata.category,
      description: metadata.description,
      fileName: project.sourceFile.name,
      pages: readerPages,
      importProjectId: project.id,
      subtitle: metadata.subtitle,
      publisherName: metadata.publisherName,
      bookTypes: metadata.bookTypes,
      metadata: { ...metadata },
    })
  }

  const client = supabase as any
  onProgress({ uploaded: 0, total: project.sourceFile.size, percent: 2, label: 'آماده‌سازی فضای امن ناشر' })
  const publisher = await resolvePublisher(client, userId, project.publisherName)

  onProgress({ uploaded: 0, total: project.sourceFile.size, percent: 4, label: 'ثبت پروژه ارسال' })
  const { data: previousImport, error: previousImportError } = await client.from('book_import_projects').select('id,book_id').eq('owner_id', userId).eq('source_checksum', project.analysis.checksum).maybeSingle()
  if (previousImportError?.code === 'PGRST205') {
    const directProjectId = project.id
    await uploadChunked(userId, directProjectId, project.sourceFile, onProgress)
    const uploadedImages = await uploadPreparedImages(userId, directProjectId, project, onProgress)
    const readerPages = analysisToReaderPages(project.analysis, uploadedImages.urls)
    const metadata = getLatestMetadata?.() || project
    await uploadManifest(client, userId, directProjectId, project, metadata, uploadedImages.paths, readerPages)
    onProgress({ uploaded: project.sourceFile.size, total: project.sourceFile.size, percent: 96, label: 'ساخت پیش‌نویس در ادیتور وب' })
    const existing = await client.from('books').select('id').eq('metadata->>source_checksum', project.analysis.checksum).maybeSingle()
    if (existing.error) throw existing.error
    if (existing.data) {
      const updated = await client.from('books').update(bookRecord(project, metadata, publisher.id, readerPages)).eq('id', existing.data.id).select('*').single()
      if (updated.error) throw updated.error
      onProgress({ uploaded: project.sourceFile.size, total: project.sourceFile.size, percent: 100, label: 'پیش‌نویس آماده و در ادیتور باز می‌شود' })
      return updated.data
    }
    const created = await client.from('books').insert(bookRecord(project, metadata, publisher.id, readerPages)).select('*').single()
    if (created.error) throw created.error
    onProgress({ uploaded: project.sourceFile.size, total: project.sourceFile.size, percent: 100, label: 'پیش‌نویس آماده و در ادیتور باز می‌شود' })
    return created.data
  }
  if (previousImportError) throw previousImportError
  const { data: importRow, error: importError } = await client.from('book_import_projects').upsert({
    id: previousImport?.id || project.id,
    owner_id: userId,
    publisher_id: publisher.id,
    title: project.title,
    status: 'uploading',
    source_name: project.sourceFile.name,
    source_size: project.sourceFile.size,
    source_checksum: project.analysis.checksum,
    local_analysis: {
      ...project.analysis,
      documentPages: undefined,
      images: project.analysis.images.map(image => ({
        id: image.id, name: image.name, mimeType: image.mimeType, originalName: image.originalName,
        originalMimeType: image.originalMimeType, conversionStatus: image.conversionStatus,
      })),
    },
    complexity_score: project.analysis.complexity.score,
    complexity_grade: project.analysis.complexity.grade,
    estimated_credits: project.analysis.complexity.estimatedCredits,
  }, { onConflict: 'owner_id,source_checksum' }).select('id,book_id').single()
  if (importError) throw importError

  await uploadChunked(userId, importRow.id, project.sourceFile, onProgress)
  const uploadedImages = await uploadPreparedImages(userId, importRow.id, project, onProgress)
  const readerPages = analysisToReaderPages(project.analysis, uploadedImages.urls)
  const metadata = getLatestMetadata?.() || project

  const { error: titleUpdateError } = await client.from('book_import_projects').update({ title: metadata.title }).eq('id', importRow.id)
  if (titleUpdateError) throw titleUpdateError

  await uploadManifest(client, userId, importRow.id, project, metadata, uploadedImages.paths, readerPages)
  onProgress({ uploaded: project.sourceFile.size, total: project.sourceFile.size, percent: 92, label: 'ثبت بسته تبدیل و ساخت پیش‌نویس' })

  if (importRow.book_id) {
    const { error: bookUpdateError } = await client.from('books').update({
      title: metadata.title,
      subtitle: metadata.subtitle,
      description: metadata.description,
      language: metadata.language,
      tags: [metadata.category, ...metadata.keywords],
      metadata: {
        author: metadata.author,
        authors: metadata.authors,
        translators: metadata.translators,
        category: metadata.category,
        book_type: metadata.bookTypes.join('، '),
        book_types: metadata.bookTypes,
        publisher_name: metadata.publisherName,
        isbn: metadata.isbn,
        publication_year: metadata.publicationYear,
        edition: metadata.edition,
        keywords: metadata.keywords,
        import_project_id: importRow.id,
        source_checksum: project.analysis.checksum,
        total_source_pages: project.analysis.totalPages,
      },
    }).eq('id', importRow.book_id)
    if (bookUpdateError) throw bookUpdateError
    const { error: queueError } = await client.from('book_import_projects').update({ status: 'queued', uploaded_at: new Date().toISOString() }).eq('id', importRow.id)
    if (queueError) throw queueError
    const { data: existingBook, error: existingBookError } = await client.from('books').select('*').eq('id', importRow.book_id).single()
    if (existingBookError) throw existingBookError
    onProgress({ uploaded: project.sourceFile.size, total: project.sourceFile.size, percent: 100, label: 'ارسال قبلی بازیابی شد' })
    return existingBook
  }

  const { data: book, error: bookError } = await client.from('books').insert(bookRecord(project, metadata, publisher.id, readerPages, importRow.id)).select('*').single()
  if (bookError) throw bookError

  const { error: queueError } = await client.from('book_import_projects').update({ status: 'queued', book_id: book.id, uploaded_at: new Date().toISOString() }).eq('id', importRow.id)
  if (queueError) throw queueError
  onProgress({ uploaded: project.sourceFile.size, total: project.sourceFile.size, percent: 100, label: 'بسته آماده پردازش تخصصی است' })
  return book
}
