import type { CalloutVariant, InteractiveKind, PrintPageValue } from '@/lib/book-content'

export type BookDirectionV2 = 'rtl' | 'ltr' | 'auto'

export type InlineMarkV2 = 'bold' | 'italic' | 'underline' | 'strike' | 'subscript' | 'superscript' | 'code'

export type BookBlockTypeV2 =
  | 'paragraph'
  | 'heading'
  | 'image'
  | 'table'
  | 'list'
  | 'math'
  | 'callout'
  | 'interactive'
  | 'page-break'

export interface BookInlineStyleV2 {
  color?: string
  fontFamily?: string
  fontSize?: string
}

export interface BookInlineV2 {
  id?: string
  text: string
  marks?: InlineMarkV2[]
  href?: string
  footnoteId?: string
  footnoteText?: string
  referenceAnchor?: string
  referenceText?: string
  style?: BookInlineStyleV2
}

export interface BookBlockBaseV2 {
  id: string
  sourceId?: string
  type: BookBlockTypeV2
  anchor?: string
  anchors?: string[]
  printNumber?: PrintPageValue
  direction?: BookDirectionV2
  style?: Record<string, unknown>
}

export interface ParagraphBlockV2 extends BookBlockBaseV2 {
  type: 'paragraph'
  text: string
  inline?: BookInlineV2[]
  semantic?: string
}

export interface HeadingBlockV2 extends BookBlockBaseV2 {
  type: 'heading'
  level: 1 | 2 | 3 | 4 | 5 | 6
  text: string
  inline?: BookInlineV2[]
}

export interface ImageBlockV2 extends BookBlockBaseV2 {
  type: 'image'
  url: string
  caption?: string
  captionInline?: BookInlineV2[]
  imageId?: string
  widthPx?: number
  widthPercent?: number
  wrap?: 'tight-inline' | 'square-inline' | 'top-bottom'
  status?: 'ready' | 'missing' | 'needs-conversion' | 'error'
  issue?: string
}

export interface TableBlockV2 extends BookBlockBaseV2 {
  type: 'table'
  headers?: string[]
  rows: string[][]
  caption?: string
}

export interface ListBlockV2 extends BookBlockBaseV2 {
  type: 'list'
  ordered: boolean
  items: Array<{ id: string; text: string; inline?: BookInlineV2[]; level?: number }>
}

export interface MathBlockV2 extends BookBlockBaseV2 {
  type: 'math'
  expression: string
}

export interface CalloutBlockV2 extends BookBlockBaseV2 {
  type: 'callout'
  variant: CalloutVariant
  title: string
  icon?: string
  blocks: BookBlockV2[]
}

export interface InteractiveBlockV2 extends BookBlockBaseV2 {
  type: 'interactive'
  kind: InteractiveKind
  title?: string
  payload: Record<string, unknown>
}

export interface PageBreakBlockV2 extends BookBlockBaseV2 {
  type: 'page-break'
  label?: string
  beforeLabel?: string
  afterLabel?: string
}

export type BookBlockV2 =
  | ParagraphBlockV2
  | HeadingBlockV2
  | ImageBlockV2
  | TableBlockV2
  | ListBlockV2
  | MathBlockV2
  | CalloutBlockV2
  | InteractiveBlockV2
  | PageBreakBlockV2

export interface BookPageV2 {
  id: string
  index: number
  sourceId?: string
  title?: string
  printNumber?: PrintPageValue
  blocks: BookBlockV2[]
}

export interface BookTocItemV2 {
  id: string
  title: string
  level: 1 | 2 | 3 | 4 | 5 | 6
  blockId?: string
  anchor?: string
  pageIndex: number
  printNumber?: PrintPageValue
  sourceStyle?: string
  children?: BookTocItemV2[]
}

export interface BookAssetV2 {
  id: string
  type: 'image' | 'audio' | 'video' | 'file'
  url: string
  caption?: string
  printNumber?: PrintPageValue
  status?: ImageBlockV2['status']
  issue?: string
}

export interface BookDocumentMetadataV2 {
  author?: string
  publisherName?: string
  category?: string
  bookType?: string
  language?: string
  source?: 'word-import' | 'legacy-book' | 'manual'
  importProjectId?: string
  originalMetadata?: Record<string, unknown>
}

export interface BookDocumentV2 {
  schemaVersion: '2.0'
  id: string
  sourceBookId: string
  title: string
  subtitle?: string | null
  description?: string
  coverUrl?: string | null
  direction: BookDirectionV2
  language: string
  metadata: BookDocumentMetadataV2
  pages: BookPageV2[]
  toc: BookTocItemV2[]
  assets: BookAssetV2[]
  updatedAt: string
}

export function createV2Id(prefix: string, ...parts: Array<string | number | undefined | null>) {
  const clean = parts
    .map(part => String(part ?? '').trim())
    .filter(Boolean)
    .join('-')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return `${prefix}-${clean || Math.random().toString(36).slice(2, 10)}`
}
