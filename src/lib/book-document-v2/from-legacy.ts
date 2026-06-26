import { INTERACTIVE_KIND_SET, type CalloutVariant, type InteractiveKind, type PrintPageValue } from '@/lib/book-content'
import type { MockBook } from '@/lib/mock-data'
import { buildTocFromHeadingsV2 } from '@/lib/book-document-v2/toc'
import { inlinePlainTextV2, normalizeBookTextV2, normalizeInlineV2, textDirectionV2 } from '@/lib/book-document-v2/normalize'
import { createV2Id, type BookAssetV2, type BookBlockV2, type BookDocumentV2, type BookInlineV2, type BookPageV2, type BookTocItemV2 } from '@/lib/book-document-v2/schema'

type UnknownRecord = Record<string, unknown>

const CALLOUT_DEFAULTS: Record<string, { title: string; icon: string }> = {
  key: { title: 'نکته کلیدی', icon: '💡' },
  question: { title: 'مکث و فکر کن', icon: '❔' },
  warning: { title: 'اشتباه رایج', icon: '⚠️' },
  quote: { title: 'جمله طلایی', icon: '❝' },
  deep: { title: 'عمیق‌تر بخوان', icon: '🔍' },
  practice: { title: 'تمرین سریع', icon: '✅' },
  glossary: { title: 'تعریف واژه', icon: '📘' },
  data: { title: 'داده و منبع', icon: '📊' },
  margin: { title: 'یادداشت حاشیه‌ای', icon: '📝' },
  normal: { title: 'یادداشت', icon: '•' },
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? value as UnknownRecord : {}
}

function asStoredDocumentV2(value: unknown): BookDocumentV2 | null {
  const record = asRecord(value)
  if (record.schemaVersion !== '2.0') return null
  if (!Array.isArray(record.pages)) return null
  return record as unknown as BookDocumentV2
}

function textOf(...values: unknown[]) {
  const found = values.find(value => value !== undefined && value !== null && normalizeBookTextV2(value).trim())
  return normalizeBookTextV2(found ?? '')
}

function numberOf(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function printValueOf(value: unknown): PrintPageValue {
  if (typeof value === 'number' || typeof value === 'string' || value === null || value === undefined) return value
  return undefined
}

function levelOf(value: unknown): 1 | 2 | 3 | 4 | 5 | 6 {
  const level = Math.max(1, Math.min(6, Number(value) || 2))
  return level as 1 | 2 | 3 | 4 | 5 | 6
}

function sourceStyleOf(format: unknown) {
  const item = asRecord(format)
  return item.styleName ? String(item.styleName) : undefined
}

function legacyListItems(block: UnknownRecord, pageIndex: number, blockIndex: number) {
  const items = Array.isArray(block.items) ? block.items : []
  return items.map((item, itemIndex) => {
    const record = asRecord(item)
    const inline = normalizeInlineV2(record.inline)
    return {
      id: createV2Id('item', pageIndex, blockIndex, itemIndex),
      text: inlinePlainTextV2(inline, textOf(record.text, item)),
      inline,
      level: numberOf(record.level ?? block.level),
    }
  })
}

function legacyRows(block: UnknownRecord) {
  const rows = Array.isArray(block.rows) ? block.rows : []
  return rows.map(row => Array.isArray(row) ? row.map(cell => normalizeBookTextV2(cell)) : [normalizeBookTextV2(row)])
}

function legacyHeaders(block: UnknownRecord) {
  const headers = Array.isArray(block.headers) ? block.headers : []
  return headers.map(header => normalizeBookTextV2(header))
}

function legacyBlockToV2(block: unknown, page: BookPageV2, pageIndex: number, blockIndex: number): BookBlockV2 {
  const item = asRecord(block)
  const legacyType = String(item.type || 'paragraph')
  const id = String(item.id || createV2Id('block', pageIndex, blockIndex, legacyType))
  const inline = normalizeInlineV2(item.inline)
  const anchor = item.anchor ? String(item.anchor) : id
  const base = {
    id,
    sourceId: item.id ? String(item.id) : undefined,
    anchor,
    anchors: Array.isArray(item.anchors) ? item.anchors.map(String) : undefined,
    printNumber: page.printNumber,
    direction: item.format ? textDirectionV2(textOf(item.text, item.content)) : undefined,
    style: asRecord(item.format),
  }

  if (legacyType === 'heading') {
    const text = inlinePlainTextV2(inline, textOf(item.text, item.content))
    return { ...base, type: 'heading', level: levelOf(item.level), text, inline }
  }

  if (legacyType === 'image') {
    const captionInline = normalizeInlineV2(item.captionInline)
    return {
      ...base,
      type: 'image',
      url: textOf(item.url, item.src),
      caption: inlinePlainTextV2(captionInline, textOf(item.caption)),
      captionInline,
      autoCaption: item.autoCaption === true || item.autoCaption === 'true',
      imageId: item.imageId ? String(item.imageId) : undefined,
      widthPx: numberOf(item.widthPx ?? item.imageWidthPx),
      widthPercent: numberOf(item.widthPercent ?? item.imageWidthPercent),
      status: item.conversionStatus === 'failed' ? 'error' : textOf(item.url, item.src) ? 'ready' : 'missing',
      issue: textOf(item.conversionError, item.issue),
    }
  }

  if (legacyType === 'table') {
    return {
      ...base,
      type: 'table',
      headers: legacyHeaders(item),
      rows: legacyRows(item),
      caption: textOf(item.caption, item.title),
    }
  }

  if (legacyType === 'list') {
    return { ...base, type: 'list', ordered: Boolean(item.ordered), items: legacyListItems(item, pageIndex, blockIndex) }
  }

  if (legacyType === 'math') {
    return { ...base, type: 'math', expression: textOf(item.expression, item.text, item.content) }
  }

  if (legacyType === 'callout') {
    const variant = String(item.variant || 'key') as CalloutVariant
    const preset = CALLOUT_DEFAULTS[variant] || CALLOUT_DEFAULTS.key
    const children = Array.isArray(item.blocks) ? item.blocks.map((child, childIndex) => legacyBlockToV2(child, page, pageIndex, blockIndex * 1000 + childIndex)) : []
    return {
      ...base,
      type: 'callout',
      variant,
      title: textOf(item.title) || preset.title,
      icon: textOf(item.icon) || preset.icon,
      blocks: children,
    }
  }

  if (INTERACTIVE_KIND_SET.has(legacyType)) {
    return {
      ...base,
      type: 'interactive',
      kind: legacyType as InteractiveKind,
      title: textOf(item.title, item.caption, item.question),
      payload: { ...item, type: legacyType },
    }
  }

  return {
    ...base,
    type: 'paragraph',
    text: inlinePlainTextV2(inline, textOf(item.text, item.content)),
    inline,
    semantic: legacyType !== 'paragraph' ? legacyType : undefined,
  }
}

function legacyPagesToV2(book: MockBook): BookPageV2[] {
  const pages = Array.isArray(book.pages) ? book.pages : []
  return pages.map((legacyPage, pageIndex) => {
    const record = asRecord(legacyPage)
    const page: BookPageV2 = {
      id: String(record.id || createV2Id('page', pageIndex + 1)),
      index: pageIndex,
      sourceId: record.id ? String(record.id) : undefined,
      title: textOf(record.title),
      printNumber: printValueOf(record.printNumber ?? record.number ?? pageIndex + 1),
      blocks: [],
    }
    page.blocks = (Array.isArray(record.blocks) ? record.blocks : []).map((block, blockIndex) => legacyBlockToV2(block, page, pageIndex, blockIndex))
    return page
  })
}

function readMetadataToc(metadata: UnknownRecord, pages: BookPageV2[]): BookTocItemV2[] {
  const source = [metadata.confirmed_toc, metadata.confirmedToc, metadata.toc, metadata.word_toc]
    .find(value => Array.isArray(value)) as unknown[] | undefined
  if (!source?.length) return []
  const headings = buildTocFromHeadingsV2(pages)
  return source.map((raw, index) => {
    const item = asRecord(raw)
    const title = textOf(item.title, item.text, item.label)
    const match = headings.find(heading =>
      (item.blockId && heading.blockId === String(item.blockId)) ||
      (item.anchor && heading.anchor === String(item.anchor)) ||
      (title && normalizeBookTextV2(heading.title) === title),
    )
    const pageIndex = Math.max(0, Math.min(pages.length - 1, numberOf(item.pageIndex) ?? numberOf(item.page) ?? match?.pageIndex ?? 0))
    return {
      id: String(item.id || match?.id || createV2Id('toc', index + 1)),
      title: title || match?.title || `بخش ${index + 1}`,
      level: levelOf(item.level ?? match?.level),
      blockId: item.blockId ? String(item.blockId) : match?.blockId,
      anchor: item.anchor ? String(item.anchor) : match?.anchor,
      pageIndex,
      printNumber: printValueOf(item.printNumber ?? pages[pageIndex]?.printNumber),
      sourceStyle: item.styleName ? String(item.styleName) : sourceStyleOf(item.format),
    }
  })
}

function collectAssetsV2(pages: BookPageV2[]) {
  const assets: BookAssetV2[] = []
  pages.forEach(page => {
    page.blocks.forEach(block => {
      if (block.type === 'image' && block.url) {
        assets.push({
          id: block.imageId || block.id,
          type: 'image',
          url: block.url,
          caption: block.caption,
          printNumber: page.printNumber,
          status: block.status,
          issue: block.issue,
        })
      }
    })
  })
  return assets
}

export function legacyBookToDocumentV2(book: MockBook): BookDocumentV2 {
  const metadata = asRecord(book.metadata)
  const storedDocument = asStoredDocumentV2(metadata.editor_v2_document)
  if (storedDocument) {
    return {
      ...storedDocument,
      sourceBookId: book.id,
      title: normalizeBookTextV2(storedDocument.title || book.title),
      subtitle: storedDocument.subtitle ?? book.subtitle,
      description: normalizeBookTextV2(storedDocument.description || book.description),
      coverUrl: storedDocument.coverUrl || book.cover_url || null,
      pages: storedDocument.pages.map((page, pageIndex) => ({
        ...page,
        index: pageIndex,
        blocks: Array.isArray(page.blocks) ? page.blocks : [],
      })),
      toc: Array.isArray(storedDocument.toc) ? storedDocument.toc : [],
      assets: Array.isArray(storedDocument.assets) ? storedDocument.assets : [],
    }
  }
  const pages = legacyPagesToV2(book)
  const metadataToc = readMetadataToc(metadata, pages)
  const toc = metadataToc.length ? metadataToc : buildTocFromHeadingsV2(pages)
  return {
    schemaVersion: '2.0',
    id: createV2Id('doc', book.id),
    sourceBookId: book.id,
    title: normalizeBookTextV2(book.title),
    subtitle: book.subtitle ? normalizeBookTextV2(book.subtitle) : null,
    description: normalizeBookTextV2(book.description),
    coverUrl: book.cover_url || null,
    direction: book.language === 'en' ? 'ltr' : 'rtl',
    language: book.language || 'fa',
    metadata: {
      author: normalizeBookTextV2(book.author),
      publisherName: normalizeBookTextV2(book.publisher_name),
      category: normalizeBookTextV2(book.category),
      bookType: normalizeBookTextV2(book.book_type),
      language: book.language || 'fa',
      source: metadata.import_project_id ? 'word-import' : 'legacy-book',
      importProjectId: metadata.import_project_id ? String(metadata.import_project_id) : undefined,
      originalMetadata: metadata,
    },
    pages,
    toc,
    assets: collectAssetsV2(pages),
    updatedAt: new Date().toISOString(),
  }
}

function inlineV2ToLegacy(inline?: BookInlineV2[]) {
  if (!Array.isArray(inline)) return undefined
  return inline.map(span => ({
    text: normalizeBookTextV2(span.text),
    bold: span.marks?.includes('bold') || undefined,
    italic: span.marks?.includes('italic') || undefined,
    underline: span.marks?.includes('underline') || undefined,
    strike: span.marks?.includes('strike') || undefined,
    superscript: span.marks?.includes('superscript') || undefined,
    subscript: span.marks?.includes('subscript') || undefined,
    href: span.href,
    imageRefId: span.imageRefId,
    footnoteId: span.footnoteId,
    footnoteText: span.footnoteText,
    referenceAnchor: span.referenceAnchor,
    referenceText: span.referenceText,
    color: span.style?.color,
    fontFamily: span.style?.fontFamily,
    fontSize: span.style?.fontSize,
  }))
}

function blockV2ToLegacy(block: BookBlockV2): any {
  const common = { id: block.id, anchor: block.anchor, anchors: block.anchors, format: block.style }
  if (block.type === 'heading') return { ...common, type: 'heading', level: block.level, content: block.text, text: block.text, inline: inlineV2ToLegacy(block.inline) }
  if (block.type === 'paragraph') return { ...common, type: block.semantic || 'paragraph', content: block.text, text: block.text, inline: inlineV2ToLegacy(block.inline) }
  if (block.type === 'image') return { ...common, type: 'image', url: block.url, caption: block.caption, captionInline: inlineV2ToLegacy(block.captionInline), autoCaption: block.autoCaption || undefined, imageId: block.imageId, widthPx: block.widthPx, widthPercent: block.widthPercent, conversionStatus: block.status === 'error' ? 'failed' : block.status, conversionError: block.issue }
  if (block.type === 'table') return { ...common, type: 'table', headers: block.headers || [], rows: block.headers?.length ? block.rows : block.rows }
  if (block.type === 'list') return { ...common, type: 'list', ordered: block.ordered, items: block.items.map(item => ({ text: item.text, inline: inlineV2ToLegacy(item.inline), level: item.level })) }
  if (block.type === 'math') return { ...common, type: 'math', expression: block.expression, content: block.expression, text: block.expression }
  if (block.type === 'callout') return { ...common, type: 'callout', variant: block.variant, title: block.title, icon: block.icon, blocks: block.blocks.map(blockV2ToLegacy) }
  if (block.type === 'interactive') return { ...common, ...block.payload, type: block.kind, title: block.title || block.payload.title }
  return null
}

export function documentV2ToLegacyPages(document: BookDocumentV2): MockBook['pages'] {
  return document.pages.map(page => ({
    id: page.id,
    title: page.title || page.blocks.find(block => block.type === 'heading')?.text || `صفحه ${page.index + 1}`,
    printNumber: page.printNumber,
    blocks: page.blocks.map(blockV2ToLegacy).filter(Boolean),
  }))
}

export function documentV2ToConfirmedToc(document: BookDocumentV2) {
  return (document.toc.length ? document.toc : buildTocFromHeadingsV2(document.pages)).map(item => ({
    id: item.anchor || item.blockId || item.id,
    title: item.title,
    level: item.level,
    page: item.printNumber ?? item.pageIndex + 1,
    pageIndex: item.pageIndex,
    blockId: item.blockId,
    anchor: item.anchor,
  }))
}
