import { supabase } from '@/integrations/supabase/client'
import { deletePublisherBook, type PublisherBook } from '@/lib/publisher-books'

const UUID_RE = /^[0-9a-f-]{36}$/i

export function canDeletePublisherBook(book: Pick<PublisherBook, 'status' | 'review_status' | 'stage'>) {
  return !(book.status === 'published' && book.review_status === 'approved' && book.stage === 'published')
}

async function listStoragePaths(prefix: string): Promise<string[]> {
  const storage = (supabase as any).storage.from('book-imports')
  const output: string[] = []

  async function walk(folder: string) {
    const { data, error } = await storage.list(folder, { limit: 1000 })
    if (error || !Array.isArray(data)) return
    for (const item of data) {
      const path = `${folder}/${item.name}`.replace(/^\/+/, '')
      if (item.id || item.metadata || item.name.includes('.')) output.push(path)
      else await walk(path)
    }
  }

  await walk(prefix.replace(/\/+$/, ''))
  return output
}

async function removeStoragePrefix(prefix?: string | null) {
  if (!prefix) return
  const paths = await listStoragePaths(prefix)
  if (!paths.length) return
  for (let index = 0; index < paths.length; index += 100) {
    await (supabase as any).storage.from('book-imports').remove(paths.slice(index, index + 100))
  }
}

export async function deletePublisherBookCompletely(book: PublisherBook, userId?: string) {
  if (!canDeletePublisherBook(book)) throw new Error('کتاب منتشرشده و فعال را نمی‌توان از این بخش حذف کرد.')

  deletePublisherBook(book.id)

  if (!UUID_RE.test(book.id) || !import.meta.env.VITE_SUPABASE_URL?.startsWith('http')) return

  const importId = String(book.metadata?.import_project_id || '')
  const projectQuery = importId
    ? await (supabase as any).from('book_import_projects').select('id, owner_id').eq('id', importId).maybeSingle()
    : await (supabase as any).from('book_import_projects').select('id, owner_id').eq('book_id', book.id).maybeSingle()
  const project = projectQuery.data
  const ownerId = project?.owner_id || userId

  await (supabase as any).from('reader_highlights').delete().eq('book_key', book.id)
  await (supabase as any).from('reader_states').delete().eq('book_key', book.id)
  await (supabase as any).from('ai_saved_outputs').delete().eq('book_id', book.id)

  if (project?.id) {
    await (supabase as any).from('book_import_projects').delete().eq('id', project.id)
    if (ownerId) await removeStoragePrefix(`${ownerId}/${project.id}`)
  }

  if (ownerId) await removeStoragePrefix(`${ownerId}/${book.id}`)

  const { error } = await (supabase as any).from('books').delete().eq('id', book.id)
  if (error) throw error
}
