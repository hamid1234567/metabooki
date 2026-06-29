import { supabase } from '@/integrations/supabase/client'
import type { MockBook } from '@/lib/mock-data'
import { legacyBookToDocumentV2 } from '@/lib/book-document-v2/from-legacy'
import { buildTocFromHeadingsV2 } from '@/lib/book-document-v2/toc'
import { cleanImageCaptionV2, inlinePlainTextV2, normalizeBookTextV2 } from '@/lib/book-document-v2/normalize'
import type { BookAssetV2, BookBlockV2, BookDocumentV2, BookPageV2, BookTocItemV2 } from '@/lib/book-document-v2/schema'

export const PAGE_ENGINE_INITIAL_LOAD_COUNT = 50
export const PAGE_ENGINE_WINDOW_BEFORE = 10
export const PAGE_ENGINE_WINDOW_AFTER = 40
export const PAGE_ENGINE_SCHEMA_VERSION = '2.0-page'

export type PageEngineManifest = {
  bookId: string
  schemaVersion: string
  pageCount: number
  toc: BookTocItemV2[]
  assetsSummary: BookAssetV2[]
  searchReady: boolean
  updatedAt?: string
}

export type PageEnginePageRecord = {
  bookId: string
  pageIndex: number
  pageId: string
  printNumber?: string
  title?: string
  blocks: BookBlockV2[]
  plainText: string
  assetIds: string[]
  updatedAt?: string
}

export type PageEngineSaveResult = {
  mode: 'page-engine' | 'legacy-full-book'
  savedPageIndexes: number[]
  requestBytes: number
  responseBytes: number
  networkMs: number
}

type UnknownRecord = Record<string, unknown>

const hasSupabase = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL.startsWith('http'))

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? value as UnknownRecord : {}
}

export function isUuidV2(value = '') {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function jsonBytesV2(value: unknown) {
  try {
    return new Blob([JSON.stringify(value)]).size
  } catch {
    return 0
  }
}

function pagePrintToString(value: BookPageV2['printNumber']) {
  if (value === null || value === undefined || value === '') return undefined
  return String(value)
}

export function blockPlainTextV2(block: BookBlockV2): string {
  if (block.type === 'heading' || block.type === 'paragraph') return inlinePlainTextV2(block.inline, block.text)
  if (block.type === 'list') return block.items.map(item => inlinePlainTextV2(item.inline, item.text)).join('\n')
  if (block.type === 'image') return cleanImageCaptionV2(block.caption)
  if (block.type === 'table') return [...(block.headers || []), ...block.rows.flat()].map(normalizeBookTextV2).join(' ')
  if (block.type === 'math') return normalizeBookTextV2(block.expression)
  if (block.type === 'callout') return [block.title, ...block.blocks.map(blockPlainTextV2)].join('\n')
  if (block.type === 'interactive') {
    const payload = asRecord(block.payload)
    return [
      block.title,
      payload.title,
      payload.question,
      payload.description,
      Array.isArray(payload.steps) ? payload.steps.map(step => Object.values(asRecord(step)).join(' ')).join('\n') : '',
      Array.isArray(payload.events) ? payload.events.map(step => Object.values(asRecord(step)).join(' ')).join('\n') : '',
      Array.isArray(payload.cards) ? payload.cards.map(step => Object.values(asRecord(step)).join(' ')).join('\n') : '',
    ].filter(Boolean).map(normalizeBookTextV2).join('\n')
  }
  return ''
}

function collectPageAssets(bookId: string, page: BookPageV2) {
  const assets: BookAssetV2[] = []
  const visit = (blocks: BookBlockV2[]) => {
    blocks.forEach(block => {
      if (block.type === 'image' && block.url) {
        assets.push({
          id: block.imageId || block.id,
          type: 'image',
          url: block.url,
          caption: cleanImageCaptionV2(block.caption),
          printNumber: page.printNumber,
          status: block.status,
          issue: block.issue,
        })
      }
      if (block.type === 'callout') visit(block.blocks)
    })
  }
  visit(page.blocks)
  return assets.map(asset => ({ ...asset, id: asset.id || `${bookId}-image-${page.index}-${assets.indexOf(asset)}` }))
}

export function pageRecordFromPageV2(bookId: string, page: BookPageV2): PageEnginePageRecord {
  const assets = collectPageAssets(bookId, page)
  return {
    bookId,
    pageIndex: page.index,
    pageId: page.id,
    printNumber: pagePrintToString(page.printNumber),
    title: page.title,
    blocks: page.blocks,
    plainText: page.blocks.map(blockPlainTextV2).filter(Boolean).join('\n\n'),
    assetIds: assets.map(asset => asset.id),
  }
}

export function pageFromRecordV2(record: PageEnginePageRecord): BookPageV2 {
  return {
    id: record.pageId,
    index: record.pageIndex,
    title: record.title,
    printNumber: record.printNumber,
    blocks: Array.isArray(record.blocks) ? record.blocks : [],
  }
}

export function recordsFromDocumentV2(document: BookDocumentV2) {
  return document.pages.map(page => pageRecordFromPageV2(document.sourceBookId, page))
}

export function assetsFromDocumentV2(document: BookDocumentV2) {
  const byId = new Map<string, BookAssetV2>()
  document.pages.forEach(page => {
    collectPageAssets(document.sourceBookId, page).forEach(asset => byId.set(asset.id, asset))
  })
  return [...byId.values()]
}

export function manifestFromDocumentV2(document: BookDocumentV2, options: { pageCount?: number; assetsSummary?: BookAssetV2[] } = {}): PageEngineManifest {
  const toc = document.toc.length ? document.toc : buildTocFromHeadingsV2(document.pages)
  return {
    bookId: document.sourceBookId,
    schemaVersion: PAGE_ENGINE_SCHEMA_VERSION,
    pageCount: Math.max(document.pages.length, Number(options.pageCount || 0) || 0),
    toc,
    assetsSummary: options.assetsSummary || assetsFromDocumentV2(document),
    searchReady: true,
    updatedAt: document.updatedAt,
  }
}

function pageRecordFromRemote(row: UnknownRecord, bookId: string): PageEnginePageRecord {
  return {
    bookId,
    pageIndex: Number(row.page_index || 0),
    pageId: String(row.page_id || `page-${Number(row.page_index || 0) + 1}`),
    printNumber: row.print_number === null || row.print_number === undefined ? undefined : String(row.print_number),
    title: row.title ? String(row.title) : undefined,
    blocks: Array.isArray(row.blocks) ? row.blocks as BookBlockV2[] : [],
    plainText: normalizeBookTextV2(row.plain_text),
    assetIds: Array.isArray(row.asset_ids) ? row.asset_ids.map(String) : [],
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  }
}

function documentWithPages(base: BookDocumentV2, pages: BookPageV2[], manifest?: PageEngineManifest): BookDocumentV2 {
  return {
    ...base,
    pages: pages.map((page, index) => ({ ...page, index: page.index ?? index })),
    toc: manifest?.toc?.length ? manifest.toc : base.toc,
    assets: manifest?.assetsSummary?.length ? manifest.assetsSummary : base.assets,
    updatedAt: manifest?.updatedAt || base.updatedAt,
  }
}

export async function loadPageEngineManifest(bookId: string): Promise<PageEngineManifest | null> {
  if (!hasSupabase || !isUuidV2(bookId)) return null
  const { data, error } = await (supabase as any)
    .from('book_content_manifests')
    .select('book_id,schema_version,page_count,toc,assets_summary,search_ready,updated_at')
    .eq('book_id', bookId)
    .maybeSingle()
  if (error || !data) return null
  const row = data as UnknownRecord
  return {
    bookId,
    schemaVersion: String(row.schema_version || PAGE_ENGINE_SCHEMA_VERSION),
    pageCount: Number(row.page_count || 0),
    toc: Array.isArray(row.toc) ? row.toc as BookTocItemV2[] : [],
    assetsSummary: Array.isArray(row.assets_summary) ? row.assets_summary as BookAssetV2[] : [],
    searchReady: row.search_ready === true,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  }
}

export async function loadPageEngineWindow(book: MockBook, centerPage = 0, beforeCount = PAGE_ENGINE_WINDOW_BEFORE, afterCount = PAGE_ENGINE_WINDOW_AFTER) {
  const base = legacyBookToDocumentV2(book)
  const manifest = await loadPageEngineManifest(book.id)
  if (!manifest || !isUuidV2(book.id)) {
    return { document: base, manifest: manifest || manifestFromDocumentV2(base), records: recordsFromDocumentV2(base), pageEngine: false }
  }
  const { data, error } = await (supabase as any).rpc('get_book_page_window', {
    target_book_id: book.id,
    center_page: centerPage,
    before_count: beforeCount,
    after_count: afterCount,
  })
  if (error || !Array.isArray(data) || !data.length) {
    return { document: base, manifest, records: recordsFromDocumentV2(base), pageEngine: false }
  }
  const records = data.map((row: UnknownRecord) => pageRecordFromRemote(row, book.id))
  const pages = records.map(pageFromRecordV2)
  return { document: documentWithPages(base, pages, manifest), manifest, records, pageEngine: true }
}

export async function loadPageEngineDocument(book: MockBook) {
  const base = legacyBookToDocumentV2(book)
  const manifest = await loadPageEngineManifest(book.id)
  if (!manifest || !isUuidV2(book.id)) {
    return { document: base, manifest: manifest || manifestFromDocumentV2(base), records: recordsFromDocumentV2(base), pageEngine: false }
  }
  const { data, error } = await (supabase as any)
    .from('book_pages')
    .select('page_index,page_id,print_number,title,blocks,plain_text,asset_ids,updated_at')
    .eq('book_id', book.id)
    .order('page_index', { ascending: true })
  if (error || !Array.isArray(data) || !data.length) {
    return { document: base, manifest, records: recordsFromDocumentV2(base), pageEngine: false }
  }
  const records = data.map((row: UnknownRecord) => pageRecordFromRemote(row, book.id))
  return { document: documentWithPages(base, records.map(pageFromRecordV2), manifest), manifest, records, pageEngine: true }
}

export async function savePageEngineDocument(
  bookId: string,
  document: BookDocumentV2,
  dirtyPageIndexes: Iterable<number> | null,
  options: { pageCount?: number; assetsSummary?: BookAssetV2[]; updateManifest?: boolean } = {},
): Promise<PageEngineSaveResult | null> {
  if (!hasSupabase || !isUuidV2(bookId)) return null
  const dirtySet = dirtyPageIndexes ? new Set([...dirtyPageIndexes].map(Number).filter(Number.isFinite)) : new Set(document.pages.map(page => page.index))
  const dirtyPages = document.pages.filter(page => dirtySet.has(page.index))
  if (!dirtyPages.length) return {
    mode: 'page-engine',
    savedPageIndexes: [],
    requestBytes: 0,
    responseBytes: 0,
    networkMs: 0,
  }

  const pageRows = dirtyPages.map(page => {
    const record = pageRecordFromPageV2(bookId, page)
    return {
      book_id: bookId,
      page_index: record.pageIndex,
      page_id: record.pageId,
      print_number: record.printNumber || null,
      title: record.title || null,
      blocks: record.blocks,
      plain_text: record.plainText,
      asset_ids: record.assetIds,
      content_hash: String(jsonBytesV2(record.blocks)),
      updated_at: document.updatedAt,
    }
  })
  const searchRows = pageRows.map(row => ({
    book_id: row.book_id,
    page_index: row.page_index,
    plain_text: row.plain_text,
    headings: row.blocks
      .filter((block: BookBlockV2) => block.type === 'heading')
      .map((block: BookBlockV2) => blockPlainTextV2(block))
      .join('\n'),
    updated_at: row.updated_at,
  }))
  const assetRows = dirtyPages.flatMap(page => collectPageAssets(bookId, page).map(asset => ({
    book_id: bookId,
    asset_id: asset.id,
    page_index: page.index,
    block_id: asset.id,
    url: asset.url,
    caption: asset.caption || null,
    caption_inline: null,
    status: asset.status || 'ready',
    issue: asset.issue || null,
    metadata: { printNumber: asset.printNumber ?? null },
    updated_at: document.updatedAt,
  })))
  const shouldUpdateManifest = options.updateManifest !== false
  const manifest = shouldUpdateManifest ? manifestFromDocumentV2(document, options) : null
  const manifestRow = {
    book_id: bookId,
    schema_version: PAGE_ENGINE_SCHEMA_VERSION,
    page_count: manifest?.pageCount || Math.max(document.pages.length, Number(options.pageCount || 0) || 0),
    toc: manifest?.toc || [],
    assets_summary: manifest?.assetsSummary || [],
    search_ready: true,
    content_hash: manifest ? String(jsonBytesV2(manifest)) : '',
    updated_at: document.updatedAt,
  }

  const requestBytes = jsonBytesV2({ manifestRow: shouldUpdateManifest ? manifestRow : null, pageRows, searchRows, assetRows })
  const started = performance.now()
  const [manifestResult, pagesResult, searchResult, assetsResult] = await Promise.all([
    shouldUpdateManifest
      ? (supabase as any).from('book_content_manifests').upsert(manifestRow, { onConflict: 'book_id' })
      : Promise.resolve({ data: null, error: null, status: 204 }),
    (supabase as any).from('book_pages').upsert(pageRows, { onConflict: 'book_id,page_index' }),
    (supabase as any).from('book_search_index').upsert(searchRows, { onConflict: 'book_id,page_index' }),
    assetRows.length
      ? (supabase as any).from('book_assets').upsert(assetRows, { onConflict: 'book_id,asset_id' })
      : Promise.resolve({ data: null, error: null, status: 204 }),
  ])
  const networkMs = performance.now() - started
  const errors = [manifestResult, pagesResult, searchResult, assetsResult].map(result => result?.error).filter(Boolean)
  const responseBytes = jsonBytesV2({ manifestResult, pagesResult, searchResult, assetsResult })
  if (errors.length) throw errors[0]
  return {
    mode: 'page-engine',
    savedPageIndexes: dirtyPages.map(page => page.index),
    requestBytes,
    responseBytes,
    networkMs,
  }
}

export async function backfillPageEngineForBook(book: MockBook) {
  const document = legacyBookToDocumentV2(book)
  return savePageEngineDocument(book.id, document, document.pages.map(page => page.index))
}
