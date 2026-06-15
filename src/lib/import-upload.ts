/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/integrations/supabase/client'
import { createPublisherBook } from '@/lib/publisher-books'
import { analysisToReaderPages } from '@/lib/import-document'
import type { LocalImportProject } from '@/lib/word-import-types'

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

async function uploadChunked(userId: string, projectId: string, file: File, onProgress: (progress: UploadProgress) => void) {
  const storage = (supabase as any).storage
  const chunkCount = Math.ceil(file.size / CHUNK_SIZE)
  const folder = `${userId}/${projectId}/source`
  const { data: existing } = await storage.from('book-imports').list(folder, { limit: Math.min(1000, chunkCount) })
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
  const readyImages = project.analysis.images.filter(image => image.conversionStatus !== 'conversion-failed')
  const folder = `${userId}/${projectId}/images`
  const { data: existing } = await storage.list(folder, { limit: Math.min(1000, readyImages.length) })
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

export async function confirmAndUploadImport(
  project: LocalImportProject,
  userId: string,
  onProgress: (progress: UploadProgress) => void,
) {
  if (!hasSupabase()) {
    const localImageUrls = Object.fromEntries(project.analysis.images
      .filter(image => image.conversionStatus !== 'conversion-failed')
      .map(image => [image.id, URL.createObjectURL(new Blob([image.data], { type: image.mimeType }))]))
    const readerPages = analysisToReaderPages(project.analysis, localImageUrls)
    onProgress({ uploaded: project.sourceFile.size, total: project.sourceFile.size, percent: 100, label: 'پیش‌نویس محلی آماده شد' })
    return createPublisherBook({
      title: project.title,
      author: project.author,
      category: project.category,
      description: project.description,
      fileName: project.sourceFile.name,
      pages: readerPages,
      importProjectId: project.id,
    })
  }

  const client = supabase as any
  const { data: publisher, error: publisherError } = await client.from('publisher_profiles').select('id').eq('user_id', userId).maybeSingle()
  if (publisherError || !publisher) throw publisherError || new Error('پروفایل ناشر برای این حساب پیدا نشد.')

  const { data: previousImport } = await client.from('book_import_projects').select('id,book_id').eq('owner_id', userId).eq('source_checksum', project.analysis.checksum).maybeSingle()
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

  const manifest = new Blob([JSON.stringify({
    version: 1,
    project: { title: project.title, author: project.author, category: project.category, description: project.description },
    analysis: {
      ...project.analysis,
      images: project.analysis.images.map(image => ({
        id: image.id, name: image.name, mimeType: image.mimeType, originalName: image.originalName,
        originalMimeType: image.originalMimeType, conversionStatus: image.conversionStatus,
        storagePath: uploadedImages.paths[image.id],
      })),
    },
    pages: readerPages,
  })], { type: 'application/json' })
  const manifestPath = `${userId}/${importRow.id}/manifest.json`
  const { error: manifestError } = await client.storage.from('book-imports').upload(manifestPath, manifest, { upsert: true, contentType: 'application/json' })
  if (manifestError) throw manifestError
  onProgress({ uploaded: project.sourceFile.size, total: project.sourceFile.size, percent: 92, label: 'ثبت بسته تبدیل و ساخت پیش‌نویس' })

  if (importRow.book_id) {
    await client.from('book_import_projects').update({ status: 'queued', uploaded_at: new Date().toISOString() }).eq('id', importRow.id)
    const { data: existingBook } = await client.from('books').select('*').eq('id', importRow.book_id).single()
    onProgress({ uploaded: project.sourceFile.size, total: project.sourceFile.size, percent: 100, label: 'ارسال قبلی بازیابی شد' })
    return existingBook
  }

  const { data: book, error: bookError } = await client.from('books').insert({
    title: project.title || project.sourceFile.name.replace(/\.docx$/i, ''),
    subtitle: `واردشده از ${project.sourceFile.name}`,
    description: project.description,
    pages: readerPages,
    preview_pages: readerPages.slice(0, 3).map((_, index) => index),
    publisher_id: publisher.id,
    language: 'fa',
    tags: [project.category],
    metadata: {
      author: project.author,
      category: project.category,
      import_project_id: importRow.id,
      source_checksum: project.analysis.checksum,
      total_source_pages: project.analysis.totalPages,
    },
    publish_complexity_factor: Math.max(1, project.analysis.complexity.score / 20),
  }).select('*').single()
  if (bookError) throw bookError

  await client.from('book_import_projects').update({ status: 'queued', book_id: book.id, uploaded_at: new Date().toISOString() }).eq('id', importRow.id)
  onProgress({ uploaded: project.sourceFile.size, total: project.sourceFile.size, percent: 100, label: 'بسته آماده پردازش تخصصی است' })
  return book
}
